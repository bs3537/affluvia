/**
 * On-demand retirement calculation endpoints
 * These heavy calculations are triggered by user action, not during form submission
 */

import { Router } from 'express';
import os from 'os';
import { storage } from '../storage';
import { runEnhancedMonteCarloSimulation, runParallelMonteCarloSimulation, DEFAULT_RETURN_CONFIG, DEFAULT_DISTRIBUTION, DEFAULT_VARIANCE_REDUCTION } from '../monte-carlo-enhanced';
import { calculateMonteCarloWithdrawalSequence } from '../monte-carlo-withdrawal-sequence';
import { profileToRetirementParams } from '../monte-carlo-base';
import { ProbabilityUtils } from '../monte-carlo-validation';
// Widget cache manager for optimized performance
import { widgetCacheManager } from '../services/widget-cache-manager';
import { computeScenarioHash } from '../services/dashboard-snapshot';
import { cacheService } from '../services/cache.service';
import { withDatabaseRetry } from '../db-utils';
// Piscina worker pool for parallel Monte Carlo
import { mcPool } from '../services/mc-pool';
import { applyOptimizationVariables } from '../services/apply-optimization-variables';
import { runMcScore, runMcBands, mergePerYearPercentiles, RUNS_DEFAULT, MAX_THREADS } from '../services/mc-runner';

const router = Router();

/**
 * Helper function to merge per-year percentiles from multiple workers
 */
const mergePerYearPercentiles = (workerResults: any[]): { [yearIndex: number]: { p05: number; p25: number; p50: number; p75: number; p95: number; count: number; age: number } } => {
  const merged: { [yearIndex: number]: { values: number[]; age: number } } = {};
  
  // Collect all values for each year from all workers
  workerResults.forEach(workerResult => {
    Object.keys(workerResult).forEach(yearIndexStr => {
      const yearIndex = parseInt(yearIndexStr);
      const yearData = workerResult[yearIndex];
      
      if (!merged[yearIndex]) {
        merged[yearIndex] = { values: [], age: yearData.age };
      }
      
      // Add values from this worker (simulate distribution from percentiles)
      const count = yearData.count || 100;
      const values = [];
      for (let i = 0; i < count; i++) {
        const percentile = (i / (count - 1)) * 100;
        if (percentile <= 5) values.push(yearData.p05);
        else if (percentile <= 25) values.push(yearData.p25);
        else if (percentile <= 50) values.push(yearData.p50);
        else if (percentile <= 75) values.push(yearData.p75);
        else values.push(yearData.p95);
      }
      merged[yearIndex].values.push(...values);
    });
  });
  
  // Calculate merged percentiles for each year
  const result: { [yearIndex: number]: { p05: number; p25: number; p50: number; p75: number; p95: number; count: number; age: number } } = {};
  
  Object.keys(merged).forEach(yearIndexStr => {
    const yearIndex = parseInt(yearIndexStr);
    const yearData = merged[yearIndex];
    const sortedValues = yearData.values.sort((a, b) => a - b);
    
    if (sortedValues.length > 0) {
      result[yearIndex] = {
        p05: calculatePercentile(sortedValues, 5),
        p25: calculatePercentile(sortedValues, 25),
        p50: calculatePercentile(sortedValues, 50),
        p75: calculatePercentile(sortedValues, 75),
        p95: calculatePercentile(sortedValues, 95),
        count: sortedValues.length,
        age: yearData.age
      };
    }
  });
  
  return result;
};

/**
 * Helper function to calculate percentiles
 */
const calculatePercentile = (sortedArray: number[], percentile: number): number => {
  if (sortedArray.length === 0) return 0;
  
  const index = (percentile / 100) * (sortedArray.length - 1);
  
  if (index % 1 === 0) {
    return sortedArray[index];
  } else {
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }
};

/**
 * Get saved retirement confidence score from database
 * Used by widget to check if calculation already exists
 */
router.get('/api/retirement-score', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const actingAsClientId = (req.session as any)?.actingAsClientId as number | undefined;
    const userId = actingAsClientId || req.user!.id;
    
    const profile = await storage.getFinancialProfile(userId);
    if (!profile) {
      return res.status(404).json({ 
        error: 'Financial profile not found' 
      });
    }
    
    // Do not auto-recompute here to keep dashboard fast; return saved value only
    
    // Check if we have saved Monte Carlo results; fall back to compact fields if detailed results missing
    const monteCarlo = profile.monteCarloSimulation as any;
    let probabilityRaw: number = 0;
    let results: any = monteCarlo?.retirementSimulation?.results;
    if (results) {
      probabilityRaw = results.probabilityOfSuccess || results.successProbability || 0;
    } else if (monteCarlo?.retirementSimulation?.probabilityOfSuccess != null) {
      probabilityRaw = monteCarlo.retirementSimulation.probabilityOfSuccess; // decimal
    } else if (monteCarlo?.probabilityOfSuccess != null) {
      probabilityRaw = monteCarlo.probabilityOfSuccess; // may be decimal or percentage; normalized below
    } else if ((profile as any)?.calculations?.retirementScore != null) {
      // Fallback to older calculations snapshot (percentage)
      probabilityRaw = Number((profile as any).calculations.retirementScore) || 0;
    } else {
      return res.status(404).json({ 
        needsCalculation: true,
        message: 'No saved retirement score found' 
      });
    }
    
    // STANDARDIZED: Handle legacy data that might be in percentage format
    const probabilityDecimal = ProbabilityUtils.toDecimal(probabilityRaw);
    const probabilityPercentage = ProbabilityUtils.toPercentage(probabilityDecimal);
    
    // Calculate score from probability percentage
    let score = 0;
    let message = '';
    
    if (probabilityPercentage >= 90) {
      score = 95;
      message = 'Excellent! Your retirement plan is very well funded.';
    } else if (probabilityPercentage >= 80) {
      score = 85;
      message = 'Great! You\'re on track for a comfortable retirement.';
    } else if (probabilityPercentage >= 70) {
      score = 75;
      message = 'Good progress, but consider increasing savings.';
    } else if (probabilityPercentage >= 60) {
      score = 65;
      message = 'Fair, but improvements needed for security.';
    } else if (probabilityPercentage >= 50) {
      score = 55;
      message = 'At risk - significant changes recommended.';
    } else {
      score = 35;
      message = 'High risk - urgent action needed.';
    }
    
    res.json({
      score: profile.retirementReadinessScore || score,
      // STANDARDIZED: Return percentage for display, include both formats
      probability: probabilityPercentage,
      probabilityDecimal: probabilityDecimal,
      message,
      cached: true,
      calculatedAt: monteCarlo?.retirementSimulation?.calculatedAt,
      medianEndingBalance: (results && results.medianFinalValue) || monteCarlo?.retirementSimulation?.medianEndingBalance || monteCarlo?.medianEndingBalance || 0
    });
    
  } catch (error) {
    console.error('Error retrieving retirement score:', error);
    next(error);
  }
});

/**
 * Get saved retirement confidence bands from database
 * Used by widget to check if calculation already exists
 */
router.get('/api/retirement-bands', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const actingAsClientId = (req.session as any)?.actingAsClientId as number | undefined;
    const userId = actingAsClientId || req.user!.id;
    
    const profile = await storage.getFinancialProfile(userId);
    if (!profile) {
      return res.status(404).json({ 
        error: 'Financial profile not found' 
      });
    }
    
    // Check if we have saved bands data
    const monteCarlo = profile.monteCarloSimulation as any;
    if (!monteCarlo?.retirementConfidenceBands) {
      return res.status(404).json({ 
        needsCalculation: true,
        message: 'No saved confidence bands found' 
      });
    }
    
    const bandsData = monteCarlo.retirementConfidenceBands as any;
    // Slim API payload (remove p05/p95 if present)
    const slim = bandsData ? {
      ages: bandsData.ages,
      percentiles: {
        p25: bandsData.percentiles?.p25 || [],
        p50: bandsData.percentiles?.p50 || [],
        p75: bandsData.percentiles?.p75 || [],
      },
      meta: bandsData.meta,
    } : null;

    res.json({
      ...(slim || {}),
      cached: true
    });
    
  } catch (error) {
    console.error('Error retrieving retirement bands:', error);
    next(error);
  }
});

/**
 * Generate retirement confidence score (Monte Carlo simulation)
 * Triggered by button click on dashboard widget
 */
router.post('/api/calculate-retirement-score', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.user!.id;
    
    console.log('🎯 On-demand retirement score calculation requested for user', userId);
    
    // Get saved profile from database
    const profile = await storage.getFinancialProfile(userId);
    if (!profile) {
      return res.status(404).json({ 
        error: 'Financial profile not found. Please complete the intake form first.' 
      });
    }
    
    // Allow client to force fresh calculation
    const skipCache = Boolean((req.body || {}).skipCache);

    // Check cache first if Redis is enabled (unless skipCache is true)
    if (!skipCache && widgetCacheManager.isEnabled()) {
      const scenarioHash = computeScenarioHash(profile);
      const cached = await widgetCacheManager.getWidget(userId, 'retirement_confidence_score', scenarioHash);
      if (cached && cached.data) {
        console.log('📦 Returning cached retirement score');
        return res.json({
          ...cached.data,
          cached: true,
          cacheAge: Math.round((Date.now() - new Date(cached.cachedAt).getTime()) / 1000)
        });
      }
    } else if (skipCache) {
      console.log('⏭️ Skipping widget cache due to skipCache=true');
    }
    
    // Run Monte Carlo simulation using Piscina worker pool
    const runs = 1000;
    const threads = Math.min(8, Math.max(2, os.cpus().length));
    const per = Math.floor(runs / threads);
    const remainder = runs - per * threads;
    
    console.log(`🎲 Running parallel Monte Carlo simulation (${runs} scenarios across ${threads} workers)...`);
    const startTime = Date.now();
    
    const params = profileToRetirementParams(profile);
    // Real dollars for consistency with prior behavior
    (params as any).useNominalDollars = false;
    (params as any).displayInTodaysDollars = true;
    // Integrate charitable goal into success probability
    (params as any).includeLegacyGoalInSuccess = true;
    
    // Split work across multiple workers
    const tasks = Array.from({ length: threads }, (_, i) => per + (i < remainder ? 1 : 0))
      .filter(n => n > 0)
      .map((n, i) => mcPool.run({ 
        kind: 'score', 
        params, 
        runs: n, 
        variance: DEFAULT_VARIANCE_REDUCTION,
        seed: i * 1000 // Different seed per worker for variance
      }));

    const parts = await Promise.all(tasks);
    
    // Merge results from all workers
    const successes = parts.reduce((s: number, p: any) => s + (p.successes || 0), 0);
    const total = parts.reduce((s: number, p: any) => s + (p.total || 0), 0);
    const medianEndingBalance = Math.round(
      parts.reduce((s: number, p: any) => s + (p.medianEndingBalance || 0) * (p.total / total), 0)
    );
    const percentile10 = Math.round(
      parts.reduce((s: number, p: any) => s + (p.percentile10 || 0) * (p.total / total), 0)
    );
    const percentile90 = Math.round(
      parts.reduce((s: number, p: any) => s + (p.percentile90 || 0) * (p.total / total), 0)
    );

    const duration = Date.now() - startTime;
    console.log(`✅ Parallel Monte Carlo completed in ${duration}ms across ${threads} workers`);

    // Create result object compatible with existing code
    const result = {
      probabilityOfSuccess: total > 0 ? successes / total : 0,
      medianEndingBalance,
      confidenceIntervals: {
        percentile10,
        percentile90
      }
    };
    
    // STANDARDIZED: Handle probability as 0-1 decimal, convert to percentage for display
    const probabilityDecimal = ProbabilityUtils.toDecimal(result.probabilityOfSuccess);
    const probabilityPercentage = ProbabilityUtils.toPercentage(probabilityDecimal);
    
    let score = 0;
    let message = '';
    
    if (probabilityPercentage >= 90) {
      score = 95;
      message = 'Excellent! Your retirement plan is very well funded.';
    } else if (probabilityPercentage >= 80) {
      score = 85;
      message = 'Great! You\'re on track for a comfortable retirement.';
    } else if (probabilityPercentage >= 70) {
      score = 75;
      message = 'Good progress, but consider increasing savings.';
    } else if (probabilityPercentage >= 60) {
      score = 65;
      message = 'Fair, but improvements needed for security.';
    } else if (probabilityPercentage >= 50) {
      score = 55;
      message = 'At risk - significant changes recommended.';
    } else {
      score = 35;
      message = 'High risk - urgent action needed.';
    }
    
    // Respond first
    const scorePayload = {
      score,
      // STANDARDIZED: Return percentage for display, but include both formats for compatibility
      probability: probabilityPercentage, // Display format (0-100)
      probabilityDecimal: probabilityDecimal, // Internal format (0-1) for consistency
      message,
      cached: false,
      calculatedAt: new Date().toISOString(),
      calculationTime: duration
    };
    console.log(`[SCORE] Responding to client in ${Date.now() - startTime}ms`);
    res.json(scorePayload);

    // Background persistence (non-blocking)
    setImmediate(async () => {
      try {
        const bgStart = Date.now();
        await withDatabaseRetry(async () => {
          await storage.updateFinancialProfile(userId, {
            retirementReadinessScore: score,
            monteCarloSimulation: {
              retirementSimulation: {
                calculatedAt: new Date().toISOString(),
                parameters: params,
                results: {
                  successProbability: probabilityDecimal,
                  probabilityOfSuccess: probabilityDecimal,
                  totalScenarios: 1000,
                  successfulScenarios: Math.round(probabilityDecimal * 1000),
                  medianFinalValue: result.medianEndingBalance || 0,
                  percentile10: result.confidenceIntervals?.percentile10 || 0,
                  percentile90: result.confidenceIntervals?.percentile90 || 0
                }
              },
              probabilityOfSuccess: probabilityDecimal,
              medianEndingBalance: result.medianEndingBalance || 0
            }
          });
        }, 1, 500);
        console.log(`[SCORE][BG] DB persisted in ${Date.now() - bgStart}ms`);
      } catch (e: any) {
        console.error('[SCORE][BG] DB persistence failed:', e?.message || e);
      }

      try {
        const cacheStart = Date.now();
        const scenarioHashForScore = computeScenarioHash(profile);
        await widgetCacheManager.cacheWidget(
          userId,
          'retirement_confidence_score',
          scenarioHashForScore,
          {
            score,
            probability: probabilityPercentage,
            probabilityDecimal,
            message,
            calculatedAt: new Date().toISOString()
          }
        );
        console.log(`[SCORE][BG] Redis cached in ${Date.now() - cacheStart}ms`);
      } catch (e: any) {
        console.error('[SCORE][BG] Redis cache failed:', e?.message || e);
      }

      try {
        const invStart = Date.now();
        await cacheService.invalidateUser(userId);
        console.log(`[SCORE][BG] Snapshot invalidated in ${Date.now() - invStart}ms`);
      } catch (e: any) {
        console.error('[SCORE][BG] Snapshot invalidation failed:', e?.message || e);
      }
    });
    
  } catch (error) {
    console.error('Error calculating retirement score:', error);
    next(error);
  }
});

/**
 * Generate retirement confidence bands
 * Triggered by button click on dashboard widget
 */
router.post('/api/calculate-retirement-bands', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.user!.id;
    
    console.log('📊 On-demand retirement bands calculation requested for user', userId);
    
    // Get saved profile from database
    const profile = await storage.getFinancialProfile(userId);
    if (!profile) {
      return res.status(404).json({ 
        error: 'Financial profile not found. Please complete the intake form first.' 
      });
    }
    
    // Allow client to force fresh calculation
    const skipCache = Boolean((req.body || {}).skipCache);

    // Check cache first if Redis is enabled (unless skipCache is true)
    if (!skipCache && widgetCacheManager.isEnabled()) {
      const scenarioHash = computeScenarioHash(profile);
      const cached = await widgetCacheManager.getWidget(userId, 'retirement_confidence_bands', scenarioHash);
      if (cached && cached.data) {
        console.log('📦 Returning cached retirement bands');
        return res.json({
          ...cached.data,
          cached: true,
          cacheAge: Math.round((Date.now() - new Date(cached.cachedAt).getTime()) / 1000)
        });
      }
    } else if (skipCache) {
      console.log('⏭️ Skipping widget cache due to skipCache=true');
    }
    
    console.log('📈 Generating retirement confidence bands using Piscina worker pool...');
    const startTime = Date.now();
    
    // Run Monte Carlo simulation using Piscina worker pool
    const runs = 1000;
    const threads = Math.min(8, Math.max(2, os.cpus().length));
    const per = Math.floor(runs / threads);
    const remainder = runs - per * threads;
    
    const params = profileToRetirementParams(profile);
    // Real dollars for consistency with prior behavior
    (params as any).useNominalDollars = false;
    (params as any).displayInTodaysDollars = true;
    
    // Split work across multiple workers
    const tasks = Array.from({ length: threads }, (_, i) => per + (i < remainder ? 1 : 0))
      .filter(n => n > 0)
      .map((n, i) => mcPool.run({ 
        kind: 'bands', 
        params, 
        runs: n, 
        variance: DEFAULT_VARIANCE_REDUCTION,
        seed: i * 1000 // Different seed per worker for variance
      }));

    const parts = await Promise.all(tasks);
    console.log(`[BANDS] Received ${parts.length} worker results`);
    
    // Merge per-year percentiles from all workers
    const mergedPerYear = mergePerYearPercentiles(parts.map((p: any) => p.perYear || {}));
    
    // Convert merged data to arrays for chart compatibility
    const sortedYears = Object.keys(mergedPerYear)
      .map(k => parseInt(k))
      .sort((a, b) => a - b);
    
    const ages: number[] = [];
    const p05: number[] = [];
    const p25: number[] = [];
    const p50: number[] = [];
    const p75: number[] = [];
    const p95: number[] = [];
    
    sortedYears.forEach(yearIdx => {
      const yearData = mergedPerYear[yearIdx];
      ages.push(yearData.age);
      p05.push(yearData.p05);
      p25.push(yearData.p25);
      p50.push(yearData.p50);
      p75.push(yearData.p75);
      p95.push(yearData.p95);
    });
    
    const yearsCount = ages.length;
    
    if (yearsCount === 0) {
      // Fallback: use withdrawal sequence engine which returns per-age percentiles
      const mcSeq = await calculateMonteCarloWithdrawalSequence(profile);
      const projections = mcSeq?.projections || [];
      for (const row of projections) {
        ages.push(row.age);
        const pb = row.portfolioBalance || {} as any;
        const v25 = Number(pb.p25 || 0);
        const v50 = Number(pb.p50 || 0);
        const v75 = Number(pb.p75 || 0);
        const v05 = Number(pb.p5 || pb.p10 || v25);
        const v95 = Number(pb.p95 || pb.p90 || v75);
        p05.push(Math.max(0, v05));
        p25.push(Math.max(0, v25));
        p50.push(Math.max(0, v50));
        p75.push(Math.max(0, v75));
        p95.push(Math.max(0, v95));
      }
    }
    
    // Clamp to standard longevity age (93)
    const CLAMP_LONGEVITY_AGE = 93;
    if (ages.length > 0) {
      const currentAge = params.currentAge;
      const maxLen = Math.max(0, Math.min(ages.length, (CLAMP_LONGEVITY_AGE - currentAge + 1)));
      if (maxLen > 0 && maxLen < ages.length) {
        ages.splice(maxLen);
        p05.splice(maxLen); p25.splice(maxLen); p50.splice(maxLen); p75.splice(maxLen); p95.splice(maxLen);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Confidence bands generated in ${duration}ms`);
    
    const bandsAll = {
      ages,
      percentiles: { p05, p25, p50, p75, p95 },
      meta: {
        currentAge: params.currentAge,
        retirementAge: params.retirementAge,
        longevityAge: ages.length ? ages[ages.length - 1] : params.currentAge,
        runs: 1000,
        calculatedAt: new Date().toISOString()
      }
    } as const;

    // Slim API payload (remove p05/p95)
    const bandsData = {
      ages: bandsAll.ages,
      percentiles: {
        p25: bandsAll.percentiles.p25,
        p50: bandsAll.percentiles.p50,
        p75: bandsAll.percentiles.p75,
      },
      meta: bandsAll.meta,
    };
    
    // Respond to client immediately with computed data
    const respondPayload = {
      ...bandsData,
      cached: false,
      calculationTime: duration
    };
    console.log(`[BANDS] Responding to client in ${Date.now() - startTime}ms`);
    res.json(respondPayload);

    // Background persistence (non-blocking)
    setImmediate(async () => {
      try {
        const bgStart = Date.now();
        await withDatabaseRetry(async () => {
          const currentProfile = await storage.getFinancialProfile(userId);
          const existingMonteCarlo = currentProfile?.monteCarloSimulation || {};
          await storage.updateFinancialProfile(userId, {
            monteCarloSimulation: {
              ...existingMonteCarlo,
              retirementConfidenceBands: bandsData,
              lastBandsCalculation: new Date().toISOString()
            }
          });
        }, 1, 500);
        console.log(`[BANDS][BG] DB persisted in ${Date.now() - bgStart}ms`);
      } catch (e: any) {
        console.error('[BANDS][BG] DB persistence failed:', e?.message || e);
      }

      try {
        const cacheStart = Date.now();
        const scenarioHashForBands = computeScenarioHash(profile);
        await widgetCacheManager.cacheWidget(
          userId,
          'retirement_confidence_bands',
          scenarioHashForBands,
          bandsData
        );
        console.log(`[BANDS][BG] Redis cached in ${Date.now() - cacheStart}ms`);
      } catch (e: any) {
        console.error('[BANDS][BG] Redis cache failed:', e?.message || e);
      }

      try {
        const invStart = Date.now();
        await cacheService.invalidateUser(userId);
        console.log(`[BANDS][BG] Snapshot invalidated in ${Date.now() - invStart}ms`);
      } catch (e: any) {
        console.error('[BANDS][BG] Snapshot invalidation failed:', e?.message || e);
      }
    });
    
  } catch (error) {
    console.error('Error calculating retirement bands:', error);
    next(error);
  }
});

/**
 * Clear retirement calculations cache
 * Useful when user updates their profile
 */
router.delete('/api/retirement-calculations-cache', async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.user!.id;
    
    await widgetCacheManager.invalidateWidget(userId, 'retirement_confidence_score');
    await widgetCacheManager.invalidateWidget(userId, 'retirement_confidence_bands');
    
    res.json({ message: 'Retirement calculations cache cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * Batch refresh: Re-run optimization on demand and return a coherent result set
 * Input: { optimizationVariables?: object, persist?: boolean, runs?: number }
 * Output: {
 *   probabilityDecimal, probability, optimizedScore,
 *   optimizedBands, baselineBands,
 *   impact: { projectionData, comparison },
 *   yearlyCashFlows?, calculatedAt, runs
 * }
 */
router.post('/api/retirement/optimization-refresh', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.user!.id;

    const body = (req.body || {}) as any;
    const persist = Boolean(body.persist);
    const runs = Number(body.runs || 1000);

    // Load profile
    const profile = await storage.getFinancialProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Financial profile not found', requiresStep: 11 });
    }

    // Variables: provided or saved
    const optimizationVariables = body.optimizationVariables || (profile as any).optimizationVariables || {};

    // Validate key inputs (mirror existing checks)
    const requiredRetirementFields = [
      'desiredRetirementAge',
      'expectedMonthlyExpensesRetirement',
      'socialSecurityClaimAge',
      'socialSecurityBenefit'
    ];
    const missingFields = requiredRetirementFields.filter(f => !profile[f as keyof typeof profile]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Retirement planning data incomplete',
        message: 'Complete Step 11 of intake form to run optimization',
        requiresStep: 11,
        missingFields
      });
    }

    // Build optimized profile via shared mapper
    const optimizedProfile = applyOptimizationVariables(profile, optimizationVariables);

    // Enhanced Monte Carlo everywhere (same engine as dashboard and optimize endpoint)
    const { profileToRetirementParams } = await import('../monte-carlo-base');

    // Optimized run
    const optParams = profileToRetirementParams(optimizedProfile);
    (optParams as any).includeLegacyGoalInSuccess = true;
    const optimizedResult: any = await mcPool.run({ params: optParams, simulationCount: runs, type: 'bands' });

    // Bands (optimized)
    // Prefer allScenarios if available; otherwise, retry without variance reduction to collect cash flows
    let optimizedBands: any;
    const buildBands = (params: any, enhanced: any) => {
      // Handle both Piscina pool result (with perYear) and legacy result (with allScenarios)
      if (enhanced.perYear) {
        // New Piscina result format
        const ages = Object.keys(enhanced.perYear).sort((a, b) => parseInt(a) - parseInt(b)).map(key => enhanced.perYear[key].age);
        const p05 = ages.map((_, i) => enhanced.perYear[i]?.p05 || 0);
        const p25 = ages.map((_, i) => enhanced.perYear[i]?.p25 || 0);
        const p50 = ages.map((_, i) => enhanced.perYear[i]?.p50 || 0);
        const p75 = ages.map((_, i) => enhanced.perYear[i]?.p75 || 0);
        const p95 = ages.map((_, i) => enhanced.perYear[i]?.p95 || 0);
        
        return {
          ages,
          percentiles: { p05, p25, p50, p75, p95 },
          meta: {
            currentAge: params.currentAge,
            retirementAge: params.retirementAge,
            longevityAge: params.currentAge + (ages.length ? ages.length - 1 : 0),
            runs,
            calculatedAt: new Date().toISOString()
          }
        };
      } else {
        // Legacy format with allScenarios
        const scenarios: any[] = (enhanced as any).allScenarios || [];
        const valid = scenarios.filter(s => Array.isArray(s.yearlyCashFlows) && s.yearlyCashFlows.length > 0);
        const yearsCount = valid.length > 0 ? Math.min(...valid.map(s => s.yearlyCashFlows.length)) : 0;
        const ages: number[] = [];
        const p05: number[] = [], p25: number[] = [], p50: number[] = [], p75: number[] = [], p95: number[] = [];
        if (yearsCount > 0) {
          for (let i = 0; i < yearsCount; i++) {
            const vals: number[] = [];
            let age = params.currentAge + i;
            for (const s of valid) {
              const year = s.yearlyCashFlows?.[i];
              if (year) vals.push(Math.max(0, Number(year.portfolioBalance || 0)));
            }
            if (vals.length > 0) {
              vals.sort((a, b) => a - b);
              const pct = (p: number) => vals[Math.floor((p / 100) * (vals.length - 1))] || 0;
              ages.push(age);
              p05.push(pct(5)); p25.push(pct(25)); p50.push(pct(50)); p75.push(pct(75)); p95.push(pct(95));
            }
          }
        }
        return {
          ages,
          percentiles: { p05, p25, p50, p75, p95 },
          meta: {
            currentAge: params.currentAge,
            retirementAge: params.retirementAge,
            longevityAge: params.currentAge + (ages.length ? ages.length - 1 : 0),
            runs,
            calculatedAt: new Date().toISOString()
          }
        };
      }
    };

    // With Piscina pool using 'bands' type, we should always get perYear data
    optimizedBands = buildBands(optParams, optimizedResult);

    // Baseline bands (fresh)
    const baselineParams = profileToRetirementParams(profile);
    (baselineParams as any).includeLegacyGoalInSuccess = true;
    const baselineEnhanced: any = await mcPool.run({ params: baselineParams, simulationCount: runs, type: 'bands' });
    const baselineBands = buildBands(baselineParams, baselineEnhanced);

    // Impact (p50 median diff by age)
    const ages = baselineBands.ages && optimizedBands.ages ? Math.min(baselineBands.ages.length, optimizedBands.ages.length) : 0;
    const projectionData: Array<{ age: number; baseline: number; optimized: number; difference: number }> = [];
    for (let i = 0; i < ages; i++) {
      const age = baselineBands.ages[i] || optimizedBands.ages[i];
      const b = Math.round(baselineBands.percentiles.p50[i] || 0);
      const o = Math.round(optimizedBands.percentiles.p50[i] || 0);
      projectionData.push({ age, baseline: b, optimized: o, difference: o - b });
    }
    const last = projectionData[projectionData.length - 1];
    const comparison = last ? {
      finalBaseline: last.baseline,
      finalOptimized: last.optimized,
      finalDifference: last.difference,
      percentageImprovement: last.baseline > 0 ? Math.round(((last.optimized - last.baseline) / last.baseline) * 100) : 0
    } : null;

    // Build response
    const probabilityDecimal = (optimizedResult as any).probabilityOfSuccess ?? 0;
    const probability = Math.round(probabilityDecimal * 1000) / 10; // 1 decimal percent
    // Slim bands for API response (remove p05/p95)
    const slim = (bands: any) => bands ? ({
      ages: bands.ages,
      percentiles: { p25: bands.percentiles?.p25 || [], p50: bands.percentiles?.p50 || [], p75: bands.percentiles?.p75 || [] },
      meta: bands.meta,
    }) : null;

    const out = {
      probabilityDecimal,
      probability,
      optimizedScore: {
        probabilityOfSuccess: probability,
        medianEndingBalance: optimizedResult.medianEndingBalance || 0,
        scenarios: optimizedResult.scenarios || { successful: Math.round(probabilityDecimal * runs), failed: Math.round((1 - probabilityDecimal) * runs), total: runs },
      },
      optimizedBands: slim(optimizedBands),
      baselineBands: slim(baselineBands),
      impact: { projectionData, comparison },
      yearlyCashFlows: (optimizedResult as any).yearlyCashFlows || [],
      calculatedAt: new Date().toISOString(),
      runs
    };

    // Optional persistence (no overwriting of variables themselves)
    if (persist) {
      // Build input snapshot for tracking what data was used
      const inputSnapshot = {
        variables: optimizationVariables,
        params: optParams,
        sourceProfile: {
          currentAge: optParams.currentAge,
          spouseAge: optParams.spouseAge,
          expectedRealReturn: optimizedProfile.expectedRealReturn,
          spouseExpectedRealReturn: optimizedProfile.spouseExpectedRealReturn,
          retirementContributions: optimizedProfile.retirementContributions,
          spouseRetirementContributions: optimizedProfile.spouseRetirementContributions,
          socialSecurityClaimAge: optimizedProfile.socialSecurityClaimAge,
          spouseSocialSecurityClaimAge: optimizedProfile.spouseSocialSecurityClaimAge,
          socialSecurityBenefit: optimizedProfile.socialSecurityBenefit,
          spouseSocialSecurityBenefit: optimizedProfile.spouseSocialSecurityBenefit,
          pensionBenefit: optimizedProfile.pensionBenefit,
          spousePensionBenefit: optimizedProfile.spousePensionBenefit,
          expectedMonthlyExpensesRetirement: optimizedProfile.expectedMonthlyExpensesRetirement,
          partTimeIncomeRetirement: optimizedProfile.partTimeIncomeRetirement,
          spousePartTimeIncomeRetirement: optimizedProfile.spousePartTimeIncomeRetirement,
          hasLongTermCareInsurance: optimizedProfile.hasLongTermCareInsurance,
          currentRetirementAssets: optParams.currentRetirementAssets
        },
        meta: { calculatedAt: out.calculatedAt, runs }
      };

      await storage.updateFinancialProfile(userId, {
        optimizationVariables: {
          ...optimizationVariables, // Keep the actual variables
          optimizedScore: out.optimizedScore,
          optimizedRetirementSuccessProbability: probability,
          optimizedRetirementBands: out.optimizedBands,
          hasOptimized: true // Mark as optimized
        },
        retirementPlanningData: {
          ...(profile as any).retirementPlanningData,
          optimizationInputSnapshot: inputSnapshot, // Store snapshot
          impactOnPortfolioBalance: {
            projectionData: out.impact.projectionData,
            comparison: out.impact.comparison,
            calculatedAt: out.calculatedAt,
          }
        }
      });
    }

    res.json(out);
  } catch (error) {
    console.error('Error in optimization refresh:', error);
    next(error);
  }
});

/**
 * Calculate retirement success probability with optimization variables
 * Combines intake form data with optimization variables for enhanced Monte Carlo simulation
 */
router.post('/api/optimize-retirement-score', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.user!.id;
    // Accept both payload shapes:
    // 1) { optimizationVariables: { ... }, skipCache }
    // 2) { retirementAge, socialSecurityAge, ... } (top-level variables)
    const body = (req.body || {}) as any;
    const optimizationVariables = (body && typeof body.optimizationVariables === 'object' && body.optimizationVariables !== null)
      ? body.optimizationVariables
      : body;
    const skipCache = Boolean(body?.skipCache);
    const runsParam = Number(body?.runs);
    const runs = Number.isFinite(runsParam) && runsParam > 0 ? runsParam : RUNS_DEFAULT;
    
    console.log('🎯 Optimization retirement score calculation requested for user', userId);
    
    // Get saved profile from database
    const profile = await storage.getFinancialProfile(userId);
    if (!profile) {
      return res.status(404).json({ 
        error: 'Financial profile not found. Please complete the intake form first.',
        requiresStep: 11
      });
    }
    
    // Check cache first if Redis is enabled and not skipping cache
    if (!skipCache && widgetCacheManager.isEnabled()) {
      const cacheKey = `optimization_${JSON.stringify(optimizationVariables)}`;
      const cached = await widgetCacheManager.getWidget(userId, cacheKey);
      if (cached && cached.data) {
        console.log('📦 Returning cached optimization score');
        return res.json({
          ...cached.data,
          cached: true,
          cacheAge: Math.round((Date.now() - new Date(cached.cachedAt).getTime()) / 1000)
        });
      }
    }
    
    // Build optimized profile via shared mapper
    const optimizedProfile = applyOptimizationVariables(profile, optimizationVariables);
    
    // Log critical values to detect issues
    console.log('📊 Optimization input snapshot:', {
      monthlyExpenses: optimizedProfile.expectedMonthlyExpensesRetirement,
      employee401k: optimizedProfile.retirementContributions?.employee,
      employer401k: optimizedProfile.retirementContributions?.employer,
      traditionalIRA: optimizedProfile.traditionalIRAContribution,
      rothIRA: optimizedProfile.rothIRAContribution,
      retirementAge: optimizedProfile.desiredRetirementAge,
      socialSecurityAge: optimizedProfile.socialSecurityClaimAge,
      assetAllocation: optimizedProfile.expectedRealReturn
    });
    
    console.log(`🎲 Running optimization Monte Carlo simulation (${runs} scenarios across ${MAX_THREADS} workers)...`);
    const startTime = Date.now();
    
    // Convert optimized profile to Monte Carlo parameters
    const params = profileToRetirementParams(optimizedProfile);
    // Align with enhanced endpoint behavior: run in nominal dollars and display in today's dollars
    (params as any).useNominalDollars = false;
    (params as any).displayInTodaysDollars = true;
    // Integrate charitable goal into success probability
    (params as any).includeLegacyGoalInSuccess = true;
    
    // Log Monte Carlo parameters to detect conversion issues
    console.log('🎯 Monte Carlo parameters:', {
      currentRetirementAssets: params.currentRetirementAssets,
      annualSavings: params.annualSavings,
      annualRetirementExpenses: params.annualRetirementExpenses,
      annualGuaranteedIncome: params.annualGuaranteedIncome,
      expectedReturn: params.expectedReturn,
      retirementAge: params.retirementAge,
      currentAge: params.currentAge
    });
    
    // Run enhanced Monte Carlo simulation using worker pool splitting
    const result = await runMcScore(params, runs);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Optimization Monte Carlo completed in ${duration}ms`);
    
    // STANDARDIZED: Handle probability as 0-1 decimal, convert to percentage for display
    const probabilityDecimal = ProbabilityUtils.toDecimal((result.successes / (result.total || 1)));
    const probabilityPercentage = ProbabilityUtils.toPercentage(probabilityDecimal);
    
    let score = 0;
    let message = '';
    
    if (probabilityPercentage >= 90) {
      score = 95;
      message = 'Excellent! Your optimized retirement plan is very well funded.';
    } else if (probabilityPercentage >= 80) {
      score = 85;
      message = 'Great! Your optimization puts you on track for a comfortable retirement.';
    } else if (probabilityPercentage >= 70) {
      score = 75;
      message = 'Good optimization progress, consider further adjustments.';
    } else if (probabilityPercentage >= 60) {
      score = 65;
      message = 'Fair optimization, but more improvements needed.';
    } else if (probabilityPercentage >= 50) {
      score = 55;
      message = 'At risk - try different optimization variables.';
    } else {
      score = 35;
      message = 'High risk - significant optimization needed.';
    }
    
    const responseData = {
      score,
      // STANDARDIZED: Return percentage for display, but include both formats for compatibility
      probability: probabilityPercentage, // Display format (0-100)
      probabilityDecimal: probabilityDecimal, // Internal format (0-1) for consistency
      probabilityOfSuccess: probabilityPercentage, // Alias for compatibility
      message,
      medianEndingBalance: result.medianEndingBalance || 0,
      optimizationVariables,
      
      // Keep compatibility fields; detailed yearly flows are not returned by runMcScore
      yearlyCashFlows: [],
      scenarios: { successful: Math.round(probabilityDecimal * (result.total || runs)), failed: Math.round((1 - probabilityDecimal) * (result.total || runs)), total: result.total || runs },
      confidenceIntervals: {
        percentile10: result.percentile10 || 0,
        percentile25: 0,
        percentile50: result.medianEndingBalance || 0,
        percentile75: 0,
        percentile90: result.percentile90 || 0,
      },
      percentile10EndingBalance: result.percentile10 || 0,
      percentile90EndingBalance: result.percentile90 || 0,
      yearsUntilDepletion: null,
      safeWithdrawalRate: 0,
      
      cached: false,
      calculatedAt: new Date().toISOString(),
      calculationTime: duration
    };
    
    // ✅ ADD RESPONSE VALIDATION LOGGING
    console.log('📊 Optimization response prepared:', {
      hasYearlyCashFlows: Array.isArray(responseData.yearlyCashFlows),
      yearlyCashFlowsLength: responseData.yearlyCashFlows?.length || 0,
      hasScenarios: !!responseData.scenarios,
      successfulScenarios: responseData.scenarios?.successful || 0,
      probability: responseData.probability
    });
    
    // Cache the result with optimization variables as key
    if (widgetCacheManager.isEnabled()) {
      const cacheKey = `optimization_${JSON.stringify(optimizationVariables)}`;
      await widgetCacheManager.cacheWidget(
        userId,
        cacheKey,
        `${userId}_opt_${Date.now()}`,
        responseData
      );
    }
    
    res.json(responseData);
    
    // Pre-calculate stress tests in background (non-blocking) — opt-in only
    const enableStressPrecalc = (process.env.ENABLE_OPTIMIZATION_STRESS_PRECALC === '1') || body?.precomputeStress === true;
    if (enableStressPrecalc) {
      console.log('🚀 Triggering background stress test pre-calculation (opt-in)...');
      setTimeout(async () => {
        try {
          const { DEFAULT_STRESS_SCENARIOS } = await import('../../shared/stress-test-types');
          const { runStressTests } = await import('../stress-test-engine');
          const { widgetCacheManager } = await import('../widget-cache-manager');
          
          // Pre-calculate batch stress tests for optimized plan
          const scenarioRequests = DEFAULT_STRESS_SCENARIOS.map(scenario => ({
            request: {
              scenarios: [{ ...scenario, enabled: true }],
              optimizationVariables: optimizationVariables,
              runCombined: false
            },
            scenario
          }));
          
          // Run all scenarios in parallel
          const [baselineResponse, ...scenarioResponses] = await Promise.all([
            runStressTests(profile, { scenarios: [], optimizationVariables, runCombined: false }),
            ...scenarioRequests.map(({ request }) => runStressTests(profile, request))
          ]);
          
          const baselineScore = baselineResponse.baseline.successProbability;
          const individualResults = scenarioResponses.map((result, index) => {
            const scenario = scenarioRequests[index].scenario;
            return {
              scenarioId: scenario.id,
              scenarioName: scenario.name,
              baselineScore,
              stressedScore: result.individualResults[0]?.successProbability || baselineScore,
              impact: result.individualResults[0]?.impactPercentage || 0,
              description: scenario.description
            };
          });
          
          // Cache the batch stress test results
          const cacheKey = 'batch_stress_optimized';
          const cacheHash = widgetCacheManager.generateInputHash(cacheKey, {
            profileUpdatedAt: profile.lastUpdated,
            optimizationVariables,
            plan: 'optimized'
          });
          
          await widgetCacheManager.cacheWidget(userId, cacheKey, cacheHash, {
            baseline: baselineScore,
            scenarios: individualResults,
            timestamp: Date.now()
          }, 4);
          
          console.log('✅ Background stress test pre-calculation complete');
        } catch (error) {
          console.error('Background stress test pre-calculation failed:', error);
        }
      }, 100); // Small delay to ensure response is sent first
    } else {
      console.log('⏭️ Skipping background stress test pre-calculation (disabled)');
    }
    
  } catch (error) {
    console.error('Error calculating optimization score:', error);
    next(error);
  }
});

/**
 * Generate retirement confidence bands with optimization variables
 * Used by Impact on Portfolio Balance widget for optimized scenario
 */
router.post('/api/calculate-retirement-bands-optimization', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.user!.id;
    const optimizationVariables = req.body || {};
    const skipCache = Boolean((req.body || {}).skipCache);
    
    console.log('📊 Optimization retirement bands calculation requested for user', userId);
    
    // Get saved profile from database
    const profile = await storage.getFinancialProfile(userId);
    if (!profile) {
      return res.status(404).json({ 
        error: 'Financial profile not found. Please complete the intake form first.' 
      });
    }
    
    console.log('📈 Generating optimization retirement confidence bands...');
    const startTime = Date.now();
    
    // Apply optimization variables via shared mapper
    const optimizedProfile = applyOptimizationVariables(profile, optimizationVariables);
    
    // Optional: return cached optimized bands if available and not skipping cache
    if (!skipCache && widgetCacheManager.isEnabled()) {
      const cacheKey = 'retirement_confidence_bands_optimized';
      const cacheHash = widgetCacheManager.generateInputHash(cacheKey, {
        profileUpdatedAt: profile.lastUpdated,
        optimizationVariables,
        plan: 'optimized'
      });
      const cached = await widgetCacheManager.getCachedWidget(userId, cacheKey, cacheHash);
      if (cached && cached.data) {
        const duration = Date.now() - startTime;
        console.log(`✅ Optimization confidence bands retrieved from cache in ${duration}ms`);
        return res.json({ ...cached.data, cached: true, calculationTime: cached.data?.calculationTime ?? duration });
      }
    } else if (skipCache) {
      console.log('⏭️ Skipping widget cache for optimized bands due to skipCache=true');
    }

    // Run enhanced Monte Carlo with detailed scenarios (same logic as calculate-retirement-bands)
    const params = profileToRetirementParams(optimizedProfile);
    const start = Date.now();
    const bands = await runMcBands(params, RUNS_DEFAULT, 93);
    const duration = Date.now() - start;
    // Slim API payload (remove p05/p95)
    const out = {
      ages: bands.ages,
      percentiles: {
        p25: bands.percentiles?.p25 || [],
        p50: bands.percentiles?.p50 || [],
        p75: bands.percentiles?.p75 || [],
      },
      meta: {
        ...bands.meta,
        currentAge: params.currentAge,
        retirementAge: params.retirementAge,
      },
      calculationTime: duration,
      optimizationApplied: true,
    };
    console.log(`✅ Optimization confidence bands generated in ${duration}ms`);
    // Cache the optimized bands for subsequent requests
    try {
      const cacheKey = 'retirement_confidence_bands_optimized';
      const cacheHash = widgetCacheManager.generateInputHash(cacheKey, {
        profileUpdatedAt: profile.lastUpdated,
        optimizationVariables,
        plan: 'optimized'
      });
      await widgetCacheManager.cacheWidget(userId, cacheKey, cacheHash, out, 4 /* hours */);
    } catch (cacheErr) {
      console.warn('Failed to cache optimized bands:', (cacheErr as any)?.message || cacheErr);
    }
    res.json(out);
    
  } catch (error) {
    console.error('Error calculating optimization retirement bands:', error);
    next(error);
  }
});

export default router;
