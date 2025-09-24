import crypto from 'crypto';
import { storage } from '../storage';
import { cacheService } from './cache.service';
import { calculateFastFinancialMetrics } from '../financial-calculations-fast';

// Increment when snapshot schema/logic changes in a way that should invalidate caches
const DASHBOARD_MODEL_VERSION = '2025-09-12-2';

type SnapshotWidget = {
  id: string;
  version: string;
  data: any;
  updatedAt: string;
};

export type DashboardSnapshot = {
  userId: number;
  scenarioHash: string;
  modelVersion: string;
  createdAt: string;
  widgets: SnapshotWidget[];
  meta: {
    hasPlaidSnapshot: boolean;
    source: 'cache' | 'fresh';
  };
};

// Remove null/undefined and sort keys for stable hashing
function stableNormalize(value: any): any {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    // For arrays, keep order but normalize items
    return value.map(stableNormalize);
  }
  if (typeof value === 'object') {
    const out: any = {};
    Object.keys(value)
      .sort()
      .forEach((k) => {
        const v = stableNormalize((value as any)[k]);
        if (v !== undefined) out[k] = v;
      });
    return out;
  }
  return value;
}

function pickScenarioInputs(profile: any): any {
  // Select inputs that materially influence dashboard widgets
  const p = profile || {};
  return {
    // Demographics
    dateOfBirth: p.dateOfBirth,
    spouseDateOfBirth: p.spouseDateOfBirth,
    maritalStatus: p.maritalStatus,
    state: p.state,

    // Income/expenses
    annualIncome: Number(p.annualIncome) || 0,
    spouseAnnualIncome: Number(p.spouseAnnualIncome) || 0,
    takeHomeIncome: Number(p.takeHomeIncome) || 0,
    spouseTakeHomeIncome: Number(p.spouseTakeHomeIncome) || 0,
    monthlyExpenses: p.monthlyExpenses || {},

    // Assets/liabilities (use compact summaries to avoid huge payloads)
    assetsSummary: Array.isArray(p.assets)
      ? {
          count: p.assets.length,
          total: p.assets.reduce((s: number, a: any) => s + (Number(a.value) || 0), 0),
        }
      : { count: 0, total: 0 },
    liabilitiesSummary: Array.isArray(p.liabilities)
      ? {
          count: p.liabilities.length,
          total: p.liabilities.reduce((s: number, l: any) => s + (Number(l.balance ?? l.value) || 0), 0),
        }
      : { count: 0, total: 0 },
    primaryResidence: p.primaryResidence
      ? {
          marketValue: Number(p.primaryResidence.marketValue) || 0,
          mortgageBalance: Number(p.primaryResidence.mortgageBalance) || 0,
          monthlyPayment: Number(p.primaryResidence.monthlyPayment) || 0,
        }
      : undefined,

    // Retirement parameters that affect success widget (score is fetched if persisted)
    desiredRetirementAge: p.desiredRetirementAge || p.retirementAge || 65,
    socialSecurityAge: p.socialSecurityAge || p.optimalSocialSecurityAge || 67,
    retirementContributions: p.retirementContributions || { employee: 0, employer: 0 },
    spouseRetirementContributions: p.spouseRetirementContributions || { employee: 0, employer: 0 },
    hasLongTermCareInsurance: !!p.hasLongTermCareInsurance,

    // Optimization variables that affect optimized projections
    optimizationVariables: p.optimizationVariables ? {
      retirementAge: p.optimizationVariables.retirementAge,
      spouseRetirementAge: p.optimizationVariables.spouseRetirementAge,
      socialSecurityAge: p.optimizationVariables.socialSecurityAge,
      spouseSocialSecurityAge: p.optimizationVariables.spouseSocialSecurityAge,
      monthlyEmployee401k: p.optimizationVariables.monthlyEmployee401k,
      monthlyEmployer401k: p.optimizationVariables.monthlyEmployer401k,
      spouseMonthlyEmployee401k: p.optimizationVariables.spouseMonthlyEmployee401k,
      spouseMonthlyEmployer401k: p.optimizationVariables.spouseMonthlyEmployer401k,
      annualTraditionalIRA: p.optimizationVariables.annualTraditionalIRA,
      annualRothIRA: p.optimizationVariables.annualRothIRA,
      spouseAnnualTraditionalIRA: p.optimizationVariables.spouseAnnualTraditionalIRA,
      spouseAnnualRothIRA: p.optimizationVariables.spouseAnnualRothIRA,
      monthlyExpenses: p.optimizationVariables.monthlyExpenses,
      partTimeIncome: p.optimizationVariables.partTimeIncome,
      spousePartTimeIncome: p.optimizationVariables.spousePartTimeIncome,
      hasLongTermCareInsurance: p.optimizationVariables.hasLongTermCareInsurance,
    } : undefined,

    // Risk profile/allocation
    riskScore: Number(p.riskScore || p.userRiskScore) || 3,
    spouseRiskScore: Number(p.spouseRiskScore) || 0,
    currentAllocation: p.currentAllocation || null,

    // Calculations snapshot presence (affects fast path)
    hasCalculations: !!p.calculations,
    lastUpdated: p.lastUpdated || p.updatedAt || null,
  };
}

function sha256(data: string) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function computeScenarioHash(profile: any): string {
  const inputs = pickScenarioInputs(profile);
  const normalized = stableNormalize(inputs);
  const payload = JSON.stringify({ normalized, modelVersion: DASHBOARD_MODEL_VERSION });
  return sha256(payload);
}

async function buildSnapshot(userId: number): Promise<DashboardSnapshot> {
  const profile = await storage.getFinancialProfile(userId);
  if (!profile) {
    const empty: DashboardSnapshot = {
      userId,
      scenarioHash: sha256('empty:' + userId + ':' + DASHBOARD_MODEL_VERSION),
      modelVersion: DASHBOARD_MODEL_VERSION,
      createdAt: new Date().toISOString(),
      widgets: [],
      meta: { hasPlaidSnapshot: false, source: 'fresh' },
    };
    return empty;
  }

  // Prefer persisted calculations if present; otherwise compute fast metrics now
  let calcs: any = profile.calculations;
  if (!calcs || typeof calcs !== 'object') {
    calcs = await calculateFastFinancialMetrics(profile, userId);
  }

  // Retirement success (do NOT auto-run heavy calcs here). Use saved Monte Carlo if available.
  const savedMC: any = (profile as any).monteCarloSimulation;
  const savedProbDecimal: number | undefined = savedMC?.retirementSimulation?.results?.successProbability ?? savedMC?.probabilityOfSuccess;
  const retirementSuccess = typeof savedProbDecimal === 'number'
    ? {
        probabilityDecimal: savedProbDecimal,
        probability: Math.round(savedProbDecimal * 1000) / 10, // percentage with 0.1 precision
        calculatedAt: savedMC?.retirementSimulation?.calculatedAt || null,
      }
    : null;

  const clampBands = (b: any) => {
    if (!b || !Array.isArray(b.ages)) return null;
    const CLAMP_LONGEVITY_AGE = 93;
    const ages: number[] = Array.from(b.ages);
    const p25: number[] = Array.from(b.percentiles?.p25 || []);
    const p50: number[] = Array.from(b.percentiles?.p50 || []);
    const p75: number[] = Array.from(b.percentiles?.p75 || []);
    const currentAge = ages[0] ?? undefined;
    if (typeof currentAge === 'number') {
      const maxLen = Math.max(0, Math.min(ages.length, (CLAMP_LONGEVITY_AGE - currentAge + 1)));
      if (maxLen > 0 && maxLen < ages.length) {
        ages.splice(maxLen);
        p25.splice(maxLen); p50.splice(maxLen); p75.splice(maxLen);
      }
    }
    const meta = {
      ...(b.meta || {}),
      longevityAge: ages.length ? ages[ages.length - 1] : b.meta?.longevityAge,
    };
    return { ages, percentiles: { p25, p50, p75 }, meta };
  };

  const widgets: SnapshotWidget[] = [
    {
      id: 'financial_health',
      version: 'v1',
      data: {
        score: Math.round(Number(calcs.healthScore ?? calcs.financialHealthScore ?? profile.financialHealthScore ?? 0)),
        breakdown: calcs.breakdown || null,
      },
      updatedAt: calcs.calculatedAt || new Date().toISOString(),
    },
    {
      id: 'net_worth',
      version: 'v1',
      data: {
        value: Number(profile.netWorth ?? calcs.netWorth ?? 0),
      },
      updatedAt: calcs.calculatedAt || new Date().toISOString(),
    },
    {
      id: 'cash_flow',
      version: 'v1',
      data: {
        monthly: Number(profile.monthlyCashFlow ?? calcs.monthlyCashFlow ?? 0),
        afterContributions: Number(profile.monthlyCashFlowAfterContributions ?? calcs.monthlyCashFlowAfterContributions ?? 0),
      },
      updatedAt: calcs.calculatedAt || new Date().toISOString(),
    },
    {
      id: 'emergency_readiness',
      version: 'v1',
      data: {
        score: Math.round(Number(profile.emergencyReadinessScore ?? calcs.emergencyScore ?? 0)),
      },
      updatedAt: calcs.calculatedAt || new Date().toISOString(),
    },
    {
      id: 'risk_profile',
      version: 'v1',
      data: {
        profile: calcs.riskProfile,
        score: Number(calcs.riskScore || 0),
        allocation: calcs.currentAllocation || profile.currentAllocation || null,
        targetAllocation: calcs.targetAllocation || null,
      },
      updatedAt: calcs.calculatedAt || new Date().toISOString(),
    },
    {
      id: 'spouse_risk_profile',
      version: 'v1',
      data: {
        profile: calcs.spouseRiskProfile || (profile as any)?.spouseRiskProfile || null,
        score: Number(calcs.spouseRiskScore || 0),
        allocation: (profile as any)?.spouseAllocation || null,
        targetAllocation: calcs.spouseTargetAllocation || null,
      },
      updatedAt: calcs.calculatedAt || new Date().toISOString(),
    },
    {
      id: 'insurance_adequacy',
      version: 'v1',
      data: {
        score: Number(
          (calcs as any)?.insuranceAdequacy?.score ??
          (profile as any)?.riskManagementScore ??
          calcs.insuranceScore ?? 0
        )
      },
      updatedAt: calcs.calculatedAt || new Date().toISOString(),
    },
    {
      id: 'retirement_success',
      version: 'v1',
      data: retirementSuccess || { needsCalculation: true },
      updatedAt: retirementSuccess?.calculatedAt || profile.lastUpdated || new Date().toISOString(),
    },
    {
      id: 'retirement_bands',
      version: 'v1',
      data: clampBands((profile as any)?.monteCarloSimulation?.retirementConfidenceBands),
      updatedAt: (profile as any)?.monteCarloSimulation?.retirementConfidenceBands?.meta?.calculatedAt || profile.lastUpdated || new Date().toISOString(),
    },
    {
      id: 'retirement_bands_optimized',
      version: 'v1',
      data: clampBands((profile as any)?.optimizationVariables?.optimizedRetirementBands),
      updatedAt: (profile as any)?.optimizationVariables?.optimizedRetirementBands?.meta?.calculatedAt || profile.lastUpdated || new Date().toISOString(),
    },
  ];

  // Include dashboard insights if generated (manual generation via endpoints)
  try {
    const di = await storage.getDashboardInsights(userId);
    if (di && (di as any).insights) {
      widgets.push({
        id: 'dashboard_insights',
        version: 'v1',
        data: {
          insights: (di as any).insights,
          generatedAt: (di as any).updatedAt || (di as any).createdAt,
          isValid: !di.validUntil || new Date(di.validUntil) > new Date(),
          generatedByModel: (di as any).generatedByModel,
        },
        updatedAt: ((di as any).updatedAt || (di as any).createdAt || new Date()).toString(),
      });
    } else {
      // Fallback: hydrate from financial_profiles.central_insights if present
      const ci: any = (profile as any)?.centralInsights || null;
      const asArray = Array.isArray(ci) ? ci : (Array.isArray(ci?.insights) ? ci.insights : null);
      if (asArray && asArray.length > 0) {
        widgets.push({
          id: 'dashboard_insights',
          version: 'v1',
          data: {
            insights: asArray,
            generatedAt: (ci && (ci.updatedAt || ci.lastUpdated)) || new Date().toISOString(),
            isValid: true,
            generatedByModel: (ci && ci.generatedByModel) || undefined,
          },
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Last-resort fallback: generate fresh insights automatically
        try {
          const { generateGeminiInsights, createProfileDataHash } = await import('../gemini-insights');
          // Ensure we have calculations (fast path) if missing
          let workingProfile: any = profile;
          if (!workingProfile?.calculations) {
            try {
              const estateDocs = await storage.getEstateDocuments(userId);
              const freshCalcs = await calculateFastFinancialMetrics(workingProfile || {}, userId);
              await storage.updateFinancialProfile(userId, { calculations: freshCalcs });
              workingProfile = await storage.getFinancialProfile(userId);
            } catch {}
          }
          const estateDocuments = await storage.getEstateDocuments(userId);
          const gen = await generateGeminiInsights(workingProfile, workingProfile?.calculations || {}, estateDocuments);
          const profileDataHash = createProfileDataHash(workingProfile || {}, estateDocuments);
          const saved = await storage.createDashboardInsights(userId, {
            insights: gen.insights,
            generatedByModel: 'grok-4-fast-reasoning',
            generationPrompt: gen.generationPrompt,
            generationVersion: '1.0',
            financialSnapshot: gen.financialSnapshot,
            profileDataHash,
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
          widgets.push({
            id: 'dashboard_insights',
            version: 'v1',
            data: {
              insights: saved.insights as any,
              generatedAt: (saved as any).updatedAt || saved.createdAt,
              isValid: true,
              generatedByModel: saved.generatedByModel,
            },
            updatedAt: ((saved as any).updatedAt || saved.createdAt || new Date()).toString(),
          });
        } catch (autoErr) {
          try { console.warn('[dashboard-snapshot] auto-generate insights failed:', (autoErr as any)?.message || autoErr); } catch {}
        }
      }
    }
  } catch {}

  const scenarioHash = computeScenarioHash(profile);
  const snapshot: DashboardSnapshot = {
    userId,
    scenarioHash,
    modelVersion: DASHBOARD_MODEL_VERSION,
    createdAt: new Date().toISOString(),
    widgets,
    meta: {
      hasPlaidSnapshot: !!(profile as any)?.plaidAccounts || false,
      source: 'fresh',
    },
  };
  return snapshot;
}

export async function getDashboardSnapshot(userId: number, { bypassCache = false } = {}): Promise<DashboardSnapshot> {
  const profile = await storage.getFinancialProfile(userId);
  const scenarioHash = computeScenarioHash(profile);

  const cacheKeyParams = { userId, scenarioHash, v: DASHBOARD_MODEL_VERSION };
  if (!bypassCache) {
    const cached = await cacheService.get<DashboardSnapshot>('dashboard_snapshot', cacheKeyParams);
    if (cached) {
      // If cached snapshot lacks insights but persisted insights exist, rebuild fresh
      const hasWidget = Array.isArray(cached.widgets) && cached.widgets.some(w => w.id === 'dashboard_insights');
      let persistedInsights = false;
      try {
        const di = await storage.getDashboardInsights(userId);
        persistedInsights = !!(di && (di as any).insights && (di as any).insights.length > 0);
      } catch {}
      if (!persistedInsights) {
        const ci: any = (profile as any)?.centralInsights || null;
        const arr = Array.isArray(ci) ? ci : (Array.isArray(ci?.insights) ? ci.insights : null);
        if (arr && arr.length > 0) persistedInsights = true;
      }
      if (hasWidget || !persistedInsights) {
        return { ...cached, meta: { ...cached.meta, source: 'cache' } };
      }
      // persisted insights exist but cache lacks them; fall through to build fresh
    }
  }

  const fresh = await buildSnapshot(userId);
  // 24h TTL by default
  await cacheService.set('dashboard_snapshot', cacheKeyParams, fresh, 24 * 60 * 60);
  return fresh;
}

export function getModelVersion() {
  return DASHBOARD_MODEL_VERSION;
}
