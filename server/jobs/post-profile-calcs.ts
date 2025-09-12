import { storage } from '../storage';
import { runEnhancedMonteCarloSimulation, profileToRetirementParams } from '../monte-carlo-enhanced';
import { widgetCacheManager } from '../widget-cache-manager';
import { withDatabaseRetry } from '../db-utils';

// Lazy imports to avoid loading heavy modules on startup
async function lazyImportCalcs() {
  const [{ calculateFinancialMetricsWithPlaid }, netWorth] = await Promise.all([
    import('../financial-calculations-enhanced'),
    import('../net-worth-projections')
  ]);
  return { calculateFinancialMetricsWithPlaid, calculateNetWorthProjections: netWorth.calculateNetWorthProjections };
}

const vlog = (...args: any[]) => {
  if (process.env.VERBOSE_LOGS === '1') console.log(...args);
};

// Simple in-memory throttle to prevent overlapping or excessively frequent runs per user
const inFlight: Map<number, boolean> = new Map();
const lastRunAt: Map<number, number> = new Map();

export async function runPostProfileCalcs(userId: number) {
  try {
    // Throttle: skip if a run is already in-flight or last run was within 60 seconds
    if (inFlight.get(userId)) {
      vlog('[AsyncCalcs] Skipping – calculation already in-flight for user', userId);
      return;
    }
    const last = lastRunAt.get(userId) || 0;
    if (Date.now() - last < 60_000) {
      vlog('[AsyncCalcs] Skipping – last run too recent for user', userId);
      return;
    }
    inFlight.set(userId, true);

    // Add initial delay to let the main transaction complete
    // This prevents lock conflicts with the intake form submission
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Re-fetch latest saved profile
    const profile = await storage.getFinancialProfile(userId);
    if (!profile) return;

    vlog('[AsyncCalcs] Starting background calculations for user', userId);

    const { calculateFinancialMetricsWithPlaid, calculateNetWorthProjections } = await lazyImportCalcs();

    // 1) Fresh financial metrics (Plaid-aware)
    try {
      const calculations = await calculateFinancialMetricsWithPlaid(profile, [], userId);
      
      // Use retry logic for the update to handle lock conflicts
      await withDatabaseRetry(async () => {
        await storage.updateFinancialProfile(userId, {
        calculations,
        financialHealthScore: Math.round(Number(calculations?.healthScore) || 0),
        emergencyReadinessScore: Math.round(Number(calculations?.emergencyScore) || 0),
        retirementReadinessScore: Math.round(Number(calculations?.retirementScore) || 0),
        riskManagementScore: Math.round(Number(calculations?.insuranceScore) || 0),
        cashFlowScore: Math.round(Number(calculations?.cashFlowScore) || 0),
        netWorth: calculations?.netWorth || 0,
        monthlyCashFlow: calculations?.monthlyCashFlow || 0,
        monthlyCashFlowAfterContributions: calculations?.monthlyCashFlowAfterContributions || 0,
        userRiskProfile: calculations?.riskProfile || 'Not Assessed',
        targetAllocation: calculations?.targetAllocation || {},
        spouseRiskProfile: calculations?.spouseRiskProfile || 'Not Assessed',
        spouseTargetAllocation: calculations?.spouseTargetAllocation || {},
        });
      });
    } catch (e) {
      console.error('[AsyncCalcs] Financial metrics error:', (e as Error).message);
    }

    // 2) Monte Carlo + Bands widget cache
    try {
      const params = profileToRetirementParams(profile);
      const enhanced = await runEnhancedMonteCarloSimulation(params, 1000);

      // Persist compact Monte Carlo summary on profile
      await storage.updateFinancialProfile(userId, {
        monteCarloSimulation: {
          retirementSimulation: {
            calculatedAt: new Date().toISOString(),
            parameters: params,
            results: {
              successProbability: enhanced.probabilityOfSuccess,
              probabilityOfSuccess: Math.round((enhanced as any).successProbability * 1000) / 1000,
              totalScenarios: (enhanced as any).scenarios?.total ?? 1000,
              successfulScenarios: (enhanced as any).scenarios?.successful ?? Math.round((enhanced as any).successProbability * 1000),
              medianFinalValue: (enhanced as any).medianEndingBalance || 0,
              percentile10: (enhanced as any).confidenceIntervals?.percentile10 || 0,
              percentile90: (enhanced as any).confidenceIntervals?.percentile90 || 0,
              averageDeficit: 0,
              averageSurplus: 0,
              yearlyCashFlows: []
            }
          },
          probabilityOfSuccess: (enhanced as any).probabilityOfSuccess ?? ((enhanced as any).successProbability ?? 0) * 100,
          medianEndingBalance: (enhanced as any).medianEndingBalance
        }
      });

      // Compute percentile bands across scenarios (portfolioBalance each year)
      const scenarios: any[] = (enhanced as any).allScenarios || [];
      const yearsCount = scenarios.length > 0 ? Math.min(...scenarios.map(s => s.yearlyCashFlows?.length || 0)) : 0;
      const ages: number[] = [];
      const p05: number[] = [];
      const p25: number[] = [];
      const p50: number[] = [];
      const p75: number[] = [];
      const p95: number[] = [];

      if (yearsCount > 0) {
        for (let i = 0; i < yearsCount; i++) {
          const values: number[] = [];
          let age = 0;
          for (const s of scenarios) {
            const yd = s.yearlyCashFlows?.[i];
            if (yd) {
              age = yd.age || age;
              values.push(Math.max(0, Number(yd.portfolioBalance || 0)));
            }
          }
          values.sort((a, b) => a - b);
          const valAt = (q: number) => {
            if (values.length === 0) return 0;
            const idx = Math.floor((q / 100) * (values.length - 1));
            return values[Math.max(0, Math.min(values.length - 1, idx))];
          };
          ages.push(age || ((profile as any).dateOfBirth ? 0 : params.currentAge + i));
          p05.push(valAt(5));
          p25.push(valAt(25));
          p50.push(valAt(50));
          p75.push(valAt(75));
          p95.push(valAt(95));
        }

        // Persist to widget cache
        const dependencies = {
          lastUpdated: (profile as any).lastUpdated || new Date().toISOString(),
          currentAge: params.currentAge,
          retirementAge: params.retirementAge,
          longevityAge: 93,
          runs: 1000
        };
        const inputHash = widgetCacheManager.generateInputHash('retirement_confidence_bands', dependencies);
        await widgetCacheManager.cacheWidget(userId, 'retirement_confidence_bands', inputHash, {
          meta: {
            currentAge: params.currentAge,
            retirementAge: params.retirementAge,
            longevityAge: 93,
            runs: 1000,
            modelVersion: 1,
            calculatedAt: new Date().toISOString(),
            probabilityOfSuccess: ((enhanced as any).probabilityOfSuccess ?? ((enhanced as any).successProbability ?? 0) * 100)
          },
          bands: {
            ages,
            p95,
            p75,
            p50,
            p25,
            p05
          }
        }, 24 /* hours */);
      }
    } catch (e) {
      console.error('[AsyncCalcs] Monte Carlo error:', (e as Error).message);
    }

    // 3) Net Worth Projections
    try {
      const freshProfile = await storage.getFinancialProfile(userId);
      if (freshProfile) {
        const proj = calculateNetWorthProjections(freshProfile);
        await storage.updateFinancialProfile(userId, {
          netWorthProjections: {
            calculatedAt: new Date().toISOString(),
            projectionData: proj.projectionData,
            netWorthAtRetirement: proj.netWorthAtRetirement,
            netWorthAtLongevity: proj.netWorthAtLongevity,
            currentAge: proj.currentAge,
            retirementAge: proj.retirementAge,
            longevityAge: proj.longevityAge,
            parameters: {
              homeValue: freshProfile.primaryResidence?.marketValue || 0,
              mortgageBalance: freshProfile.primaryResidence?.mortgageBalance || 0,
              realEstateGrowthRate: 0.043
            }
          }
        });
      }
    } catch (e) {
      console.error('[AsyncCalcs] Net worth projections error:', (e as Error).message);
    }

    // 4) Gemini insights - SKIP: Now only generated on-demand via button click
    // This saves API costs and reduces database connections during intake form submission
    console.log('[AsyncCalcs] Skipping automatic Gemini insights generation - will be triggered on-demand');
    
    // OLD CODE (REMOVED TO SAVE RESOURCES):
    // try {
    //   const insights = await generateGeminiInsights(freshProfile, freshProfile.calculations, estateDocs);
    //   await storage.createDashboardInsights(userId, { ... });
    // } catch (e) {
    //   console.error('[AsyncCalcs] Insights generation error:', (e as Error).message);
    // }

    vlog('[AsyncCalcs] Completed background calculations for user', userId);
    lastRunAt.set(userId, Date.now());
  } catch (e) {
    console.error('[AsyncCalcs] Fatal background error:', (e as Error).message);
  } finally {
    inFlight.delete(userId);
  }
}

export function enqueuePostProfileCalcs(userId: number) {
  // Lightweight in-process queue; can be swapped for Redis/BullMQ later
  setImmediate(() => {
    runPostProfileCalcs(userId).catch(() => undefined);
  });
}
