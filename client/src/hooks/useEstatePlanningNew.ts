import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { estatePlanningService } from "@/services/estate-planning.service";
import {
  buildAssetCompositionFromProfile,
  calculateEstateProjection,
  EstateAssetComposition,
  EstateStrategyInputs,
  EstateAssumptionInputs,
  EstateProjectionSummary
} from "@/lib/estate-new/analysis";

interface MonteCarloSummary {
  successProbability?: number;
  medianEndingBalance?: number;
  percentile10?: number;
  percentile90?: number;
  longevityAge?: number;
  retirementAge?: number;
  currentAge?: number;
  yearlyCashFlows?: Array<{
    age?: number;
    year?: number;
    portfolioValue?: number;
    portfolioBalance?: number;
  }>;
}

interface EstatePlanningNewData {
  profile: any | null;
  estatePlan: any | null;
  documents: any[];
  beneficiaries: any[];
  scenarios: any[];
  assetComposition: EstateAssetComposition;
  monteCarlo: MonteCarloSummary | null;
  projectedEstateValue: number;
  estateProjection: EstateProjectionSummary | null;
  strategies: EstateStrategyInputs;
  assumptions: EstateAssumptionInputs;
  isLoading: boolean;
  error: string | null;
  refetchAll: () => void;
}

async function fetchFinancialProfile() {
  const response = await fetch("/api/financial-profile", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch financial profile");
  }

  return response.json();
}

function parseMonteCarlo(profile: any): MonteCarloSummary | null {
  const mc = profile?.monteCarloSimulation?.retirementSimulation;
  if (!mc) return null;

  const results = mc.results || {};
  const bands = mc.retirementConfidenceBands || {};

  const medianEndingBalance = Number(results.medianEndingBalance ?? results.medianFinalValue ?? results.percentile50 ?? 0);
  const percentile10 = Number(results.percentile10 ?? results.p10 ?? 0);
  const percentile90 = Number(results.percentile90 ?? results.p90 ?? 0);
  const successProbability = Number(results.probabilityOfSuccess ?? results.successProbability ?? 0);

  const fallbackLongevity = profile?.desiredRetirementAge ? profile.desiredRetirementAge + 25 : undefined;
  const longevityAge = Number(bands?.meta?.longevityAge ?? profile?.longevityAge ?? fallbackLongevity ?? 0);
  const retirementAge = Number(bands?.meta?.retirementAge ?? profile?.desiredRetirementAge ?? profile?.retirementAge ?? 65);
  const currentAge = Number(bands?.meta?.currentAge ?? profile?.currentAge ?? 55);

  return {
    successProbability,
    medianEndingBalance: medianEndingBalance > 0 ? medianEndingBalance : undefined,
    percentile10: percentile10 > 0 ? percentile10 : undefined,
    percentile90: percentile90 > 0 ? percentile90 : undefined,
    longevityAge: Number.isFinite(longevityAge) && longevityAge > 0 ? longevityAge : undefined,
    retirementAge: Number.isFinite(retirementAge) && retirementAge > 0 ? retirementAge : undefined,
    currentAge: Number.isFinite(currentAge) && currentAge > 0 ? currentAge : undefined,
    yearlyCashFlows: Array.isArray(results.yearlyCashFlows) ? results.yearlyCashFlows : mc.results?.yearlyCashFlows || profile?.netWorthProjections?.projectionData || undefined,
  };
}

function deriveBaseEstateValue(
  profile: any,
  estatePlan: any,
  assetComposition: EstateAssetComposition,
  monteCarlo: MonteCarloSummary | null
): number {
  const fromNetWorthProjection = Number(profile?.netWorthProjections?.netWorthAtLongevity || 0);
  if (Number.isFinite(fromNetWorthProjection) && fromNetWorthProjection > 0) {
    return fromNetWorthProjection;
  }

  const fromEstatePlan = Number(estatePlan?.analysisResults?.projectedEstateValue ?? estatePlan?.totalEstateValue ?? 0);
  if (Number.isFinite(fromEstatePlan) && fromEstatePlan > 0) {
    return fromEstatePlan;
  }

  if (monteCarlo?.medianEndingBalance && monteCarlo.medianEndingBalance > 0) {
    return monteCarlo.medianEndingBalance + assetComposition.illiquid;
  }

  return assetComposition.taxable + assetComposition.taxDeferred + assetComposition.roth + assetComposition.illiquid;
}

function extractStrategies(estatePlan: any, profile?: any): EstateStrategyInputs {
  if (!estatePlan) {
    // Fallback to intake charitable goal when no plan exists
    const fromIntake = Number(profile?.legacyGoal || 0) || undefined;
    return fromIntake && fromIntake > 0 ? { charitableBequest: fromIntake } : {};
  }

  const trustStrategies = Array.isArray(estatePlan.trustStrategies) ? estatePlan.trustStrategies : [];
  const trustFunding = trustStrategies.map((strategy: any) => ({
    label: strategy?.name || strategy?.type || "Trust Strategy",
    amount: Number(strategy?.fundingAmount || strategy?.amount || 0),
  })).filter((item: any) => Number.isFinite(item.amount) && item.amount > 0);

  const gifting = estatePlan.analysisResults?.gifting || {};
  const insurance = estatePlan.analysisResults?.insurance || {};
  const charitable = estatePlan.charitableGifts || estatePlan.analysisResults?.charitable || {};
  const analysisStrategies = estatePlan.analysisResults?.strategies || {};
  const estateNewStrategies = estatePlan.analysisResults?.estateNew?.strategies || {};
  // Resolve charitable bequest with fallback to intake legacyGoal when plan lacks a value
  const fromPlan = Number(charitable?.plannedTotal || charitable?.amount || charitable?.bequestAmount || 0) || undefined;
  const fromIntake = Number(profile?.legacyGoal || 0) || undefined;
  const resolvedCharity = (fromPlan && fromPlan > 0) ? fromPlan : (fromIntake && fromIntake > 0 ? fromIntake : undefined);

  return {
    lifetimeGifts: Number(gifting?.lifetimeGifts || estatePlan?.lifetimeGiftAmount || 0) || undefined,
    annualGiftAmount: Number(gifting?.annualGiftAmount || estatePlan?.annualGiftAmount || 0) || undefined,
    trustFunding: trustFunding.length ? trustFunding : undefined,
    charitableBequest: resolvedCharity,
    ilitDeathBenefit: Number(insurance?.ilitDeathBenefit || insurance?.deathBenefit || 0) || undefined,
    bypassTrust: Boolean(
      (analysisStrategies?.bypassTrust ?? estateNewStrategies?.bypassTrust) ??
      trustStrategies.some((strategy: any) => String(strategy?.type || "").toLowerCase().includes("bypass"))
    ),
  };
}

function extractAssumptions(estatePlan: any, profile: any, monteCarlo: MonteCarloSummary | null): EstateAssumptionInputs {
  const assumptions = estatePlan?.analysisResults?.assumptions || {};

  const projectedDeathAge = Number(assumptions?.deathAge || assumptions?.longevityAge || profile?.longevityAge || monteCarlo?.longevityAge || 0);

  return {
    projectedDeathAge: projectedDeathAge > 0 ? projectedDeathAge : undefined,
    federalExemptionOverride: Number(assumptions?.federalExemption || estatePlan?.federalExemptionUsed || 0) || undefined,
    stateOverride: assumptions?.stateOverride || profile?.estatePlanningState || undefined,
    portability: assumptions?.portability ?? undefined,
    dsueAmount: Number(assumptions?.dsueAmount || 0) || undefined,
    liquidityTargetPercent: Number(assumptions?.liquidityTarget || 110) || undefined,
    appreciationRate: Number(assumptions?.appreciationRate || profile?.estateAppreciationRate || 0) || undefined,
    assumedHeirIncomeTaxRate: Number(assumptions?.heirIncomeTaxRate || 0) || undefined,
    currentAge: Number(profile?.currentAge || monteCarlo?.currentAge || 0) || undefined,
  };
}

export function useEstatePlanningNew(): EstatePlanningNewData {
  const queryClient = useQueryClient();
  const [creatingPlan, setCreatingPlan] = useState(false);

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ["/api/financial-profile"],
    queryFn: fetchFinancialProfile,
    staleTime: 1000 * 60 * 5,
    cacheTime: 1000 * 60 * 10,
  });

  const {
    data: estatePlan,
    isLoading: planLoading,
    error: planError,
  } = useQuery({
    queryKey: ["estate-plan"],
    queryFn: () => estatePlanningService.getEstatePlan(),
  });

  const estatePlanId = estatePlan?.id;

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["estate-documents", estatePlanId],
    queryFn: () => estatePlanningService.getEstateDocuments(estatePlanId),
    enabled: Boolean(estatePlanId),
  });

  const { data: beneficiaries = [], isLoading: beneficiariesLoading } = useQuery({
    queryKey: ["estate-beneficiaries", estatePlanId],
    queryFn: () => estatePlanningService.getEstateBeneficiaries(estatePlanId),
    enabled: Boolean(estatePlanId),
  });

  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery({
    queryKey: ["estate-scenarios", estatePlanId],
    queryFn: () => estatePlanningService.getEstateScenarios(estatePlanId),
    enabled: Boolean(estatePlanId),
  });

  const assetComposition = useMemo(() => buildAssetCompositionFromProfile(profile || {}), [profile]);
  const monteCarlo = useMemo(() => parseMonteCarlo(profile), [profile]);
  const strategies = useMemo(() => extractStrategies(estatePlan, profile), [estatePlan, profile]);
  const assumptions = useMemo(() => extractAssumptions(estatePlan, profile, monteCarlo), [estatePlan, profile, monteCarlo]);

  // Helper to derive current ages from profile DOBs if present
  const getAgeFromDOB = (iso?: string): number | undefined => {
    try {
      if (!iso) return undefined;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return undefined;
      const diff = Date.now() - d.getTime();
      return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
    } catch { return undefined; }
  };

  const currentAge = useMemo(() => {
    return (
      (profile?.currentAge as number | undefined) ??
      getAgeFromDOB((profile as any)?.dateOfBirth) ??
      monteCarlo?.currentAge ??
      55
    );
  }, [profile, monteCarlo]);

  const spouseAge = useMemo(() => {
    return (
      (profile as any)?.spouseCurrentAge ??
      getAgeFromDOB((profile as any)?.spouseDateOfBirth)
    );
  }, [profile]);

  const elderAge = useMemo(() => {
    if (typeof spouseAge === 'number') return Math.max(currentAge, spouseAge);
    return currentAge;
  }, [currentAge, spouseAge]);

  const yearsTo93 = useMemo(() => Math.max(0, 93 - elderAge), [elderAge]);

  // Retirement assets at age 93 (optimized if available; baseline otherwise)
  const retirementAt93 = useMemo(() => {
    // Try optimized/baseline combined series saved in profile.retirementPlanningData.impactOnPortfolioBalance
    const impact = (profile as any)?.retirementPlanningData?.impactOnPortfolioBalance;
    if (impact?.projectionData && Array.isArray(impact.projectionData)) {
      const row = impact.projectionData.find((r: any) => Math.floor(r.age) === 93);
      if (row) {
        const hasOptimized = Boolean(profile?.optimizationVariables?.optimizedScore);
        const val = hasOptimized ? (Number(row.optimized) || 0) : (Number(row.baseline) || 0);
        if (val > 0) return val;
      }
    }
    // Fallback to baseline Monte Carlo median yearlyCashFlows
    const flows = (profile as any)?.monteCarloSimulation?.retirementSimulation?.results?.yearlyCashFlows
      || (profile as any)?.monteCarloSimulation?.retirementSimulation?.yearlyCashFlows;
    if (Array.isArray(flows) && flows.length) {
      const r = flows.find((y: any) => Math.floor(y.age || 0) === 93) || flows[flows.length - 1];
      const val = Number(r?.portfolioValue || r?.portfolioBalance || 0);
      if (val >= 0) return val;
    }
    // Last resort
    return 0;
  }, [profile]);

  // Real estate projection to age 93 (5% CAGR, mortgage assumed paid off)
  const projectedRealEstate = useMemo(() => {
    const primary = Number((profile as any)?.primaryResidence?.marketValue || 0);
    const additional = Array.isArray((profile as any)?.additionalProperties)
      ? (profile as any).additionalProperties.reduce((sum: number, p: any) => sum + Number(p?.marketValue || 0), 0)
      : 0;
    const currentRE = Math.max(0, primary + additional);
    const factor = Math.pow(1.03, yearsTo93);
    return Math.round(currentRE * factor);
  }, [profile, yearsTo93]);

  // Total projected estate used by projection calc
  const projectedEstateValue = useMemo(() => {
    const total = Math.max(0, Number(retirementAt93 || 0)) + Math.max(0, Number(projectedRealEstate || 0));
    return total;
  }, [retirementAt93, projectedRealEstate]);

  // Auto-create an estate plan when missing so the new section has no dependency on the legacy view
  useEffect(() => {
    // Only auto-create when the server explicitly returns null (no plan).
    // Do not auto-create on errors to avoid duplicate plans.
    if (!creatingPlan && !planLoading && estatePlan === null && profile && !planError) {
      setCreatingPlan(true);
      estatePlanningService
        .createInitialEstatePlanFromProfile(profile)
        .then((created) => {
          if (created) {
            queryClient.invalidateQueries({ queryKey: ["estate-plan"] });
            queryClient.invalidateQueries({ queryKey: ["estate-documents", created.id] });
            queryClient.invalidateQueries({ queryKey: ["estate-beneficiaries", created.id] });
            queryClient.invalidateQueries({ queryKey: ["/api/financial-profile"] });
          }
        })
        .catch((e) => {
          console.warn("[Estate-New] Failed to auto-create estate plan:", (e as any)?.message || e);
        })
        .finally(() => setCreatingPlan(false));
    }
  }, [creatingPlan, planLoading, estatePlan, planError, profile, queryClient]);

  // Legacy fallback if needed (retain, but prefer our computed projectedEstateValue)
  const legacyProjectedEstateValue = useMemo(
    () => deriveBaseEstateValue(profile, estatePlan, assetComposition, monteCarlo),
    [profile, estatePlan, assetComposition, monteCarlo]
  );

  const estateProjection = useMemo(() => {
    const base = projectedEstateValue > 0 ? projectedEstateValue : legacyProjectedEstateValue;
    if (!base || base <= 0) return null;
    return calculateEstateProjection({
      baseEstateValue: base,
      assetComposition,
      strategies,
      assumptions,
      profile,
    });
  }, [projectedEstateValue, legacyProjectedEstateValue, assetComposition, strategies, assumptions, profile]);

  const isLoading = profileLoading || planLoading || docsLoading || beneficiariesLoading || scenariosLoading;
  const error = profileError?.message || planError?.message || null;

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/financial-profile"] });
    queryClient.invalidateQueries({ queryKey: ["estate-plan"] });
    if (estatePlanId) {
      queryClient.invalidateQueries({ queryKey: ["estate-documents", estatePlanId] });
      queryClient.invalidateQueries({ queryKey: ["estate-beneficiaries", estatePlanId] });
      queryClient.invalidateQueries({ queryKey: ["estate-scenarios", estatePlanId] });
    }
  };

  return {
    profile: profile || null,
    estatePlan: estatePlan || null,
    documents,
    beneficiaries,
    scenarios,
    assetComposition,
    monteCarlo,
    projectedEstateValue,
    estateProjection,
    // Expose exact composition for UI breakdowns
    retirementAt93,
    projectedRealEstate,
    strategies,
    assumptions,
    isLoading,
    error,
    refetchAll,
  };
}
