import { useMemo } from "react";
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

function extractStrategies(estatePlan: any): EstateStrategyInputs {
  if (!estatePlan) return {};

  const trustStrategies = Array.isArray(estatePlan.trustStrategies) ? estatePlan.trustStrategies : [];
  const trustFunding = trustStrategies.map((strategy: any) => ({
    label: strategy?.name || strategy?.type || "Trust Strategy",
    amount: Number(strategy?.fundingAmount || strategy?.amount || 0),
  })).filter((item: any) => Number.isFinite(item.amount) && item.amount > 0);

  const gifting = estatePlan.analysisResults?.gifting || {};
  const insurance = estatePlan.analysisResults?.insurance || {};
  const charitable = estatePlan.charitableGifts || estatePlan.analysisResults?.charitable || {};

  return {
    lifetimeGifts: Number(gifting?.lifetimeGifts || estatePlan?.lifetimeGiftAmount || 0) || undefined,
    annualGiftAmount: Number(gifting?.annualGiftAmount || estatePlan?.annualGiftAmount || 0) || undefined,
    trustFunding: trustFunding.length ? trustFunding : undefined,
    charitableBequest: Number(charitable?.plannedTotal || charitable?.amount || charitable?.bequestAmount || 0) || undefined,
    ilitDeathBenefit: Number(insurance?.ilitDeathBenefit || insurance?.deathBenefit || 0) || undefined,
    bypassTrust: Boolean(
      estatePlan?.analysisResults?.strategies?.bypassTrust ||
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
  const strategies = useMemo(() => extractStrategies(estatePlan), [estatePlan]);
  const assumptions = useMemo(() => extractAssumptions(estatePlan, profile, monteCarlo), [estatePlan, profile, monteCarlo]);

  const projectedEstateValue = useMemo(
    () => deriveBaseEstateValue(profile, estatePlan, assetComposition, monteCarlo),
    [profile, estatePlan, assetComposition, monteCarlo]
  );

  const estateProjection = useMemo(() => {
    if (!projectedEstateValue || projectedEstateValue <= 0) return null;
    return calculateEstateProjection({
      baseEstateValue: projectedEstateValue,
      assetComposition,
      strategies,
      assumptions,
      profile,
    });
  }, [projectedEstateValue, assetComposition, strategies, assumptions, profile]);

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
    strategies,
    assumptions,
    isLoading,
    error,
    refetchAll,
  };
}
