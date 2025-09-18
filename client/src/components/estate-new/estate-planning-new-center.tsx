import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEstatePlanningNew } from "@/hooks/useEstatePlanningNew";
import { estatePlanningService } from "@/services/estate-planning.service";
import { calculateEstateProjection, EstateStrategyInputs, EstateAssumptionInputs } from "@/lib/estate-new/analysis";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Download,
  FileText,
  Lightbulb,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from "recharts";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatCurrency(value?: number | null, options?: { compact?: boolean; decimals?: number }) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  if (options?.compact) {
    return compactCurrencyFormatter.format(value);
  }
  if (typeof options?.decimals === "number") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: options.decimals,
    }).format(value);
  }
  return currencyFormatter.format(value);
}

function formatPercent(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return percentFormatter.format(value / 100);
}

const PIE_COLORS = ["#a855f7", "#f97316", "#22d3ee", "#94a3b8"];

// Custom tooltips for pie charts to ensure readable white text on dark background
const DistributionTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: data.color }} />
          <span className="text-white font-semibold">{data.name}</span>
        </div>
        <div className="text-white font-medium">{formatCurrency(data.value)}</div>
      </div>
    );
  }
  return null;
};

const CompositionTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: data.color }} />
          <span className="text-white font-semibold">{data.name}</span>
        </div>
        <div className="text-white font-medium">{formatCurrency(data.value)}</div>
      </div>
    );
  }
  return null;
};

// Compact value formatter for pie slice labels
function formatCompactLabel(value: number): string {
  if (value < 1_000) return `$${Math.round(value)}`;
  if (value < 1_000_000) return `$${Math.round(value / 1_000)}K`;
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

// Custom label renderer for pie slices
const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
  // Hide small slices to avoid clutter
  if (!value || value < 50_000) return null;
  const RADIAN = Math.PI / 180;
  // Position labels a bit further toward the outer edge for clarity
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const compact = formatCompactLabel(value);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
      className="drop-shadow-sm"
    >
      {compact}
    </text>
  );
};

export function EstatePlanningNewCenter() {
  const queryClient = useQueryClient();
  const {
    profile,
    estatePlan,
    documents,
    beneficiaries,
    scenarios,
    assetComposition,
    monteCarlo,
    projectedEstateValue,
    estateProjection,
    retirementAt93,
    projectedRealEstate,
    strategies,
    assumptions,
    isLoading,
    error,
    refetchAll,
  } = useEstatePlanningNew();

  const [activeTab, setActiveTab] = useState("overview");
  const [localStrategies, setLocalStrategies] = useState<EstateStrategyInputs>(strategies);
  const [localAssumptions, setLocalAssumptions] = useState<EstateAssumptionInputs>(assumptions);
  const [includeRoth, setIncludeRoth] = useState(false);

  // Initialize toggle from persisted estate plan preferences if available
  useEffect(() => {
    const persisted = (estatePlan as any)?.analysisResults?.estateNew?.includeRoth;
    if (typeof persisted === "boolean") {
      setIncludeRoth(persisted);
    }
  }, [(estatePlan as any)?.id]);

  useEffect(() => {
    setLocalStrategies((prev) => ({ ...prev, ...strategies }));
  }, [strategies]);

  useEffect(() => {
    setLocalAssumptions((prev) => ({ ...prev, ...assumptions }));
  }, [assumptions]);

  const recalculatedProjection = useMemo(() => {
    if (!projectedEstateValue || projectedEstateValue <= 0) return null;
    return calculateEstateProjection({
      baseEstateValue: projectedEstateValue,
      assetComposition,
      strategies: localStrategies,
      assumptions: localAssumptions,
      profile,
    });
  }, [projectedEstateValue, assetComposition, localStrategies, localAssumptions, profile]);

  const summary = recalculatedProjection ?? estateProjection;

  // Fetch stored Roth conversion analysis; include raw projections for overlay
  const { data: rothAnalysis, isLoading: rothLoading } = useQuery({
    queryKey: ["stored-roth-conversion-analysis"],
    queryFn: async () => {
      const res = await fetch("/api/roth-conversion/analysis", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch Roth conversion analysis");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Inline runner to compute analysis if toggle is on and none exists
  const runRothAnalysisMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/roth-conversion/ai-analysis", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to run Roth conversion analysis");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stored-roth-conversion-analysis"] });
    }
  });

  // If toggle is on but no analysis is present, auto-run the Roth analysis
  useEffect(() => {
    if (includeRoth && !rothLoading && !rothAnalysis && !runRothAnalysisMutation.isPending) {
      runRothAnalysisMutation.mutate();
    }
  }, [includeRoth, rothLoading, rothAnalysis, runRothAnalysisMutation.isPending]);

  // Build estate overlay using Roth engine balances at projected death age
  const withRothSummary = useMemo(() => {
    // Only compute when toggle is on and baseline summary exists
    if (!includeRoth || !summary) return null;

    // Pull Roth engine results (support both shapes)
    const raw = (rothAnalysis as any)?.rawResults || (rothAnalysis as any)?.results;
    const withProj = raw?.withConversionProjection;
    if (!Array.isArray(withProj) || withProj.length === 0) return null;

    // Determine death year from baseline assumptions
    const deathAge = Number(summary.assumptions?.deathAge ?? 93);
    const currentAgeAssumed = Number(summary.assumptions?.currentAge ?? 0);
    const yearsUntilDeath = Math.max(0, Math.floor(deathAge - currentAgeAssumed));
    const targetYear = new Date().getFullYear() + yearsUntilDeath;

    // Find the Roth projection row at (or nearest below) death year
    const deathRow =
      withProj.find((r: any) => r.year === targetYear) ||
      withProj.slice().reverse().find((r: any) => r.year <= targetYear) ||
      withProj[withProj.length - 1];

    if (!deathRow) return null;

    // Balances at death (Roth engine)
    const traditional = Math.max(0, Number(deathRow.traditionalBalance || 0));
    const rothBal = Math.max(0, Number(deathRow.rothBalance || 0));
    const taxable = Math.max(0, Number(deathRow.taxableBalance || 0));
    const savings = Math.max(0, Number(deathRow.savingsBalance || 0));

    // Overlay composition used by estate projection (keep illiquid from current composition)
    const overlayComposition = {
      taxable: taxable + savings,
      taxDeferred: traditional,
      roth: rothBal,
      illiquid: Math.max(0, Number((assetComposition as any)?.illiquid || 0)),
    } as any;

    // Replace baseline retirement assets with Roth retirement balances for base estate value
    const baselineRetirement = Math.max(0, Number(retirementAt93 || 0));
    const rothRetirement = traditional + rothBal + taxable + savings;

    const baseEstateValueRoth = Math.max(
      0,
      Number(summary.projectedEstateValue || 0) - baselineRetirement + rothRetirement
    );

    try {
      return calculateEstateProjection({
        baseEstateValue: baseEstateValueRoth,
        assetComposition: overlayComposition,
        strategies: localStrategies,
        assumptions: localAssumptions,
        profile,
      });
    } catch {
      return null;
    }
  }, [
    includeRoth,
    summary,
    rothAnalysis,
    retirementAt93,
    assetComposition,
    localStrategies,
    localAssumptions,
    profile,
  ]);

  const activeSummary = includeRoth && withRothSummary ? withRothSummary : summary;

  // Persist all displayed state and computed results for Estate Planning New
  const saveEstateNewMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!estatePlan?.id) return null;
      return estatePlanningService.updateEstatePlan(estatePlan.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estate-plan"] });
    }
  });

  // Build and save a snapshot whenever relevant inputs/results change (debounced)
  // Note: placed after compositionPieData declaration to avoid TDZ issues.

  const taxPieData = activeSummary
    ? [
        // Use final net to heirs after both estate taxes and heirs' income taxes
        { name: "Net to Heirs", value: Math.max(0, activeSummary.heirTaxEstimate.netAfterIncomeTax) },
        { name: "Estate Taxes", value: Math.max(0, activeSummary.totalTax) },
        { name: "Charitable Gifts", value: Math.max(0, activeSummary.charitableImpact.charitableBequests) },
        { name: "Income Tax Drag", value: Math.max(0, activeSummary.heirTaxEstimate.projectedIncomeTax) },
      ]
    : [];

  // Composition pie: retirement vs real estate breakdown (approximated from summary and hook projections)
  const compositionPieData = useMemo(() => {
    if (!activeSummary) return [] as { name: string; value: number }[];
    // If Roth overlay available and toggle on, approximate retirement assets from engine balances at death
    let retirement = Math.max(0, Number(retirementAt93 || 0));
    if (includeRoth && rothAnalysis?.rawResults) {
      const deathAge = Number(activeSummary.assumptions?.deathAge || 0);
      const currentAge = Number(activeSummary.assumptions?.currentAge || 0);
      if (deathAge > currentAge) {
        const yearsUntilDeath = Math.max(0, Math.floor(deathAge - currentAge));
        const targetYear = new Date().getFullYear() + yearsUntilDeath;
        const arr = rothAnalysis.rawResults.withConversionProjection || [];
        const row = Array.isArray(arr) && (arr.find((r: any) => r.year === targetYear) || arr.slice().reverse().find((r: any) => r.year <= targetYear) || arr[arr.length - 1]);
        if (row) {
          const t = Math.max(0, Number(row.traditionalBalance || 0));
          const r = Math.max(0, Number(row.rothBalance || 0));
          const x = Math.max(0, Number(row.taxableBalance || 0));
          const s = Math.max(0, Number(row.savingsBalance || 0));
          retirement = t + r + x + s;
        }
      }
    }
    const realEstate = Math.max(0, Number(projectedRealEstate || 0));
    const total = retirement + realEstate;
    if (!total) return [];
    return [
      { name: "Retirement Assets", value: retirement },
      { name: "Real Estate", value: realEstate },
    ];
  }, [activeSummary, includeRoth, rothAnalysis, retirementAt93, projectedRealEstate]);

  // Build and save a snapshot whenever relevant inputs/results change (debounced)
  useEffect(() => {
    if (!estatePlan?.id || !activeSummary) return;
    const timeout = setTimeout(() => {
      try {
        // Map local strategies to top-level fields for better persistence compatibility
        const trustStrategies = Array.isArray(localStrategies.trustFunding)
          ? localStrategies.trustFunding
              .filter((t) => (Number(t?.amount) || 0) > 0)
              .map((t) => ({ type: "funding", name: t.label || "Trust Funding", fundingAmount: Number(t.amount) }))
          : undefined;

        const charitableGifts = (Number(localStrategies.charitableBequest || 0) > 0)
          ? { plannedTotal: Number(localStrategies.charitableBequest || 0), source: "estate-new" }
          : undefined;

        // Build recommendations snapshot from current summary
        const recommendationsList = activeSummary ? [
          `Projected estate value at death: ${formatCurrency(activeSummary.projectedEstateValue)}`,
          `Estimated estate taxes: ${formatCurrency(activeSummary.totalTax)} (${formatPercent(activeSummary.effectiveTaxRate)})`,
          `Net inheritance for beneficiaries: ${formatCurrency(activeSummary.netToHeirs)}`,
          activeSummary.liquidity.gap > 0
            ? `Liquidity shortfall of ${formatCurrency(activeSummary.liquidity.gap)} detected for estate settlement.`
            : "Liquidity target met for projected estate obligations.",
          activeSummary.heirTaxEstimate.taxDeferredBalance > 0
            ? `Heirs may owe approximately ${formatCurrency(activeSummary.heirTaxEstimate.projectedIncomeTax)} in income taxes on inherited tax-deferred accounts.`
            : "Heirs are positioned for tax-efficient inheritance (limited tax-deferred balances).",
        ] : [];

        // Persist both baseline and withRoth summaries for auditability
        const estateNew = {
          includeRoth,
          strategies: localStrategies,
          assumptions: localAssumptions,
          summaries: {
            baseline: summary || null,
            withRoth: withRothSummary || null,
          },
          charts: {
            composition: compositionPieData,
            distribution: taxPieData,
          },
          recommendations: recommendationsList,
          updatedAt: new Date().toISOString(),
        };

        const mergedAnalysis = {
          ...(estatePlan as any)?.analysisResults,
          estateNew,
          // Keep a simple latest summary at root for easier server-side access
          assumptions: {
            ...(estatePlan as any)?.analysisResults?.assumptions,
            deathAge: activeSummary.assumptions?.deathAge,
            longevityAge: activeSummary.assumptions?.deathAge,
            currentAge: activeSummary.assumptions?.currentAge,
            federalExemption: activeSummary.assumptions?.federalExemption,
            stateExemption: activeSummary.assumptions?.stateExemption,
            liquidityTarget: localAssumptions.liquidityTargetPercent,
            stateOverride: localAssumptions.stateOverride,
            heirIncomeTaxRate: localAssumptions.assumedHeirIncomeTaxRate,
            portability: localAssumptions.portability,
            dsueAmount: localAssumptions.dsueAmount,
          },
          gifting: {
            ...(estatePlan as any)?.analysisResults?.gifting,
            lifetimeGifts: localStrategies.lifetimeGifts,
            annualGiftAmount: localStrategies.annualGiftAmount,
          },
          insurance: {
            ...(estatePlan as any)?.analysisResults?.insurance,
            ilitDeathBenefit: localStrategies.ilitDeathBenefit,
          },
          charitable: charitableGifts || (estatePlan as any)?.analysisResults?.charitable,
          latestSummary: activeSummary,
        };

        saveEstateNewMutation.mutate({
          // Update top-level helpful fields
          trustStrategies,
          charitableGifts,
          // Persist detailed analysis
          analysisResults: mergedAnalysis,
        });
      } catch (e) {
        // swallow; this is a best-effort background save
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [
    estatePlan?.id,
    includeRoth,
    JSON.stringify(localStrategies),
    JSON.stringify(localAssumptions),
    JSON.stringify(activeSummary),
    JSON.stringify(summary),
    JSON.stringify(withRothSummary),
    JSON.stringify(taxPieData),
    JSON.stringify(compositionPieData),
  ]);

  const taxBarData = activeSummary
    ? [
        {
          name: "Taxes",
          Federal: activeSummary.federalTax,
          State: activeSummary.stateTax,
          LiquidityGap: activeSummary.liquidity.gap,
        },
      ]
    : [];

  const trustFundingTotal = useMemo(() => {
    return (localStrategies.trustFunding || []).reduce((total, trust) => total + (Number(trust?.amount) || 0), 0);
  }, [localStrategies.trustFunding]);

  const liquidityStatusBadge = activeSummary
    ? activeSummary.liquidity.gap > 0
      ? { variant: "destructive" as const, label: `${formatCurrency(activeSummary.liquidity.gap)} gap` }
      : { variant: "default" as const, label: "Liquidity covered" }
    : null;

  const optimizedProb = (profile as any)?.optimizationVariables?.optimizedScore?.probabilityOfSuccess;
  const probabilityLabel = optimizedProb !== undefined
    ? percentFormatter.format(optimizedProb)
    : (monteCarlo?.successProbability !== undefined ? percentFormatter.format(monteCarlo.successProbability) : "—");

  const handleStrategyNumberChange = (key: keyof EstateStrategyInputs, value: number) => {
    setLocalStrategies((prev) => {
      const next = { ...prev } as EstateStrategyInputs;
      if (key === "trustFunding") {
        // Important: send an explicit empty array when clearing to ensure persistence clears server state
        next.trustFunding = value > 0 ? [{ label: "Modeled Trust Funding", amount: value }] : [];
      } else {
        (next as any)[key] = value > 0 ? value : undefined;
      }
      return next;
    });
  };

  const handleStrategyBooleanChange = (key: keyof EstateStrategyInputs, value: boolean) => {
    setLocalStrategies((prev) => ({ ...prev, [key]: value }));
  };

  const handleAssumptionChange = (key: keyof EstateAssumptionInputs, value: number) => {
    setLocalAssumptions((prev) => ({ ...prev, [key]: value }));
  };

  const reportSummary = activeSummary
    ? [
        `Projected estate value at death: ${formatCurrency(activeSummary.projectedEstateValue)}`,
        `Estimated estate taxes: ${formatCurrency(activeSummary.totalTax)} (${formatPercent(activeSummary.effectiveTaxRate)})`,
        `Net inheritance for beneficiaries: ${formatCurrency(activeSummary.netToHeirs)}`,
        activeSummary.liquidity.gap > 0
          ? `Liquidity shortfall of ${formatCurrency(activeSummary.liquidity.gap)} detected for estate settlement.`
          : "Liquidity target met for projected estate obligations.",
        activeSummary.heirTaxEstimate.taxDeferredBalance > 0
          ? `Heirs may owe approximately ${formatCurrency(activeSummary.heirTaxEstimate.projectedIncomeTax)} in income taxes on inherited tax-deferred accounts.`
          : "Heirs are positioned for tax-efficient inheritance (limited tax-deferred balances).",
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <Alert className="bg-blue-900/20 border-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-300" />
        <AlertTitle className="text-blue-100">Important Legal Notice</AlertTitle>
        <AlertDescription className="text-gray-300">
          This enhanced estate planning experience provides educational insights only and does not constitute legal or tax
          advice. Always consult qualified estate planning and tax professionals before making decisions.
        </AlertDescription>
      </Alert>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-8 w-8 text-primary" />
                    <div className="flex flex-col">
                      <CardTitle className="text-3xl text-white">Estate Planning New</CardTitle>
                      {includeRoth && (
                        <div className="text-xs uppercase tracking-wide text-purple-300 mt-1">Tax Bracket Filling Strategy (Roth conversions through age 72)</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
            {liquidityStatusBadge && (
              <Badge variant={liquidityStatusBadge.variant}>{liquidityStatusBadge.label}</Badge>
            )}
            {/* Plan type indicator: Optimized vs Baseline */}
            <Badge variant="outline" className="border-indigo-400/40 text-indigo-200">
              {(
                (profile as any)?.optimizationVariables?.optimizedScore
              ) ? 'Optimized Plan' : 'Baseline Plan'}
            </Badge>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all
                ${includeRoth
                  ? "bg-purple-600/15 border-purple-400/40 ring-2 ring-purple-400/30 shadow-[0_0_20px_rgba(168,85,247,0.25)]"
                  : "bg-gray-900/40 border-gray-700 hover:border-purple-500/40"}`}
              title="Toggle to overlay Roth conversion impact across the estate analysis"
            >
              <Sparkles className={`h-4 w-4 ${includeRoth ? "text-purple-300" : "text-gray-400"}`} />
              <span className={`text-xs font-medium ${includeRoth ? "text-purple-200" : "text-gray-300"}`}>Include Roth Conversions</span>
              <Switch checked={includeRoth} onCheckedChange={setIncludeRoth} />
            </div>
            <Button
              size="sm"
              onClick={refetchAll}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Insights
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-purple-500/40 text-purple-200 hover:bg-purple-500/10"
              onClick={() => window.print()}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Summary
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {includeRoth && !rothLoading && !rothAnalysis && (
            <Alert className="mb-4 bg-purple-900/30 border-purple-700">
              <AlertCircle className="h-4 w-4 text-purple-300" />
              <AlertTitle className="text-purple-100">Roth analysis not found</AlertTitle>
              <AlertDescription className="text-gray-200">
                Run a Roth conversion analysis to see estate impacts using the tax bracket filling strategy.
                <div className="mt-3">
                  <Button size="sm" onClick={() => runRothAnalysisMutation.mutate()} disabled={runRothAnalysisMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white">
                    {runRothAnalysisMutation.isPending ? 'Running…' : 'Run Roth Analysis'}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="mb-4 bg-red-900/30 border-red-700">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Unable to load estate data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="flex flex-wrap gap-2 bg-transparent p-0">
              {[
                { id: "overview", label: "Overview", icon: DollarSign },
                { id: "tax", label: "Tax Analysis", icon: Scale },
                { id: "strategies", label: "Strategies", icon: Lightbulb },
                { id: "beneficiaries", label: "Beneficiaries & Flow", icon: Users },
                { id: "documents", label: "Documents & Tasks", icon: Shield },
                { id: "recommendations", label: "Recommendations", icon: Target },
              ].map((section) => {
                const Icon = section.icon;
                return (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-300 transition hover:border-purple-500/50 hover:text-white data-[state=active]:border-purple-500 data-[state=active]:bg-purple-500/20 data-[state=active]:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {section.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-xl text-white">Estate Snapshot</CardTitle>
                    <p className="text-sm text-gray-400">
                      Combined estate value, modeled taxes, and inheritance results based on current retirement projections.
                    </p>
                  </div>
                  {activeSummary && optimizedProb !== undefined && (
                    <Badge variant="outline" className="border-purple-500/40 text-purple-300 w-fit text-xs">
                      Based on optimized retirement plan
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading && !activeSummary ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-28 rounded-xl bg-gray-800/60 animate-pulse" />
                      ))}
                    </div>
                  ) : activeSummary ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryTile
                        label="Projected Estate"
                        value={formatCurrency(activeSummary.projectedEstateValue, { compact: false, decimals: 0 })}
                        helper={`Modeled at age ${activeSummary.assumptions.deathAge}`}
                      />
                      <SummaryTile
                        label="Net to Heirs"
                        value={formatCurrency(activeSummary.netToHeirs)}
                        helper="After estate tax impact"
                        accent="emerald"
                      />
                      <SummaryTile
                        label="Estate Taxes"
                        value={formatCurrency(activeSummary.totalTax)}
                        helper={`Effective rate ${formatPercent(activeSummary.effectiveTaxRate)}`}
                        accent="orange"
                      />
                      <SummaryTile
                        label="After Heir Income Tax"
                        value={formatCurrency(activeSummary.heirTaxEstimate.netAfterIncomeTax)}
                        helper={`Assumes ${percentFormatter.format(activeSummary.heirTaxEstimate.assumedRate)} heir tax`}
                        accent="sky"
                      />
                    </div>
                  ) : (
                    <p className="text-gray-400">No estate projection available. Complete your financial profile to unlock insights.</p>
                  )}

                  {activeSummary && (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card className="bg-gray-950/40 border-gray-800">
                        <CardHeader>
                          <CardTitle className="text-white text-lg">Distribution Snapshot</CardTitle>
                        </CardHeader>
                        <CardContent className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                              <Pie
                                data={taxPieData}
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={3}
                                dataKey="value"
                                label={PieLabel}
                                labelLine={false}
                              >
                                {taxPieData.map((entry, index) => (
                                  <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip content={<DistributionTooltip />} />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                          <div className="mt-4 flex flex-wrap gap-3 text-xs">
                            {taxPieData.map((item, index) => (
                              <div key={item.name} className="flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-sm"
                                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                />
                                <span className="text-gray-300">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gray-950/40 border-gray-800">
                        <CardHeader>
                          <CardTitle className="text-white text-lg">Estate Composition</CardTitle>
                        </CardHeader>
                        <CardContent className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                              <Pie
                                data={compositionPieData}
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={3}
                                dataKey="value"
                                label={PieLabel}
                                labelLine={false}
                              >
                                {compositionPieData.map((entry, index) => (
                                  <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[(index + 2) % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip content={<CompositionTooltip />} />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                          <div className="mt-4 flex flex-wrap gap-3 text-xs">
                            {compositionPieData.map((item, index) => (
                              <div key={item.name} className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[(index + 2) % PIE_COLORS.length] }} />
                                <span className="text-gray-300">{item.name}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-[11px] text-gray-500">
                            Real estate assumed at 3% annual growth; mortgage fully paid by age 93.
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            

            <TabsContent value="tax" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Estate Tax Outlook</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {activeSummary ? (
                    <div className="overflow-hidden rounded-xl border border-gray-800">
                      <table className="min-w-full divide-y divide-gray-800 text-sm">
                        <thead className="bg-gray-950/60 text-gray-400">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Category</th>
                            <th className="px-4 py-3 text-right font-medium">Amount</th>
                            <th className="px-4 py-3 text-right font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          <tr>
                            <td className="px-4 py-3 text-gray-200">Gross estate</td>
                            <td className="px-4 py-3 text-right text-white">{formatCurrency(activeSummary.projectedEstateValue)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">Includes appreciation, net of gifts & trust funding</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-200">Taxable estate</td>
                            <td className="px-4 py-3 text-right text-white">{formatCurrency(activeSummary.projectedTaxableEstate)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">After deductions and charitable adjustments</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-200">Federal estate tax</td>
                            <td className="px-4 py-3 text-right text-orange-300">{formatCurrency(activeSummary.federalTax)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">
                              Exemption applied: {formatCurrency(activeSummary.assumptions.federalExemption)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-200">State estate/inheritance tax</td>
                            <td className="px-4 py-3 text-right text-orange-300">{formatCurrency(activeSummary.stateTax)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">
                              Based on {activeSummary.assumptions.state || "residence"} thresholds
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Add estate plan details to calculate projected tax exposure.</p>
                  )}

                  {summary && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="bg-gray-950/40 border-gray-800">
                        <CardHeader>
                          <CardTitle className="text-sm font-semibold text-gray-200">Liquidity for settlement</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-gray-300">
                          <div className="flex items-center justify-between">
                            <span>Available liquid assets (incl. Roth)</span>
                            <span className="text-white">{formatCurrency(activeSummary.liquidity.available)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Required liquidity ({percentFormatter.format((localAssumptions.liquidityTargetPercent ?? 110) / 100)})</span>
                            <span className="text-white">{formatCurrency(activeSummary.liquidity.required)}</span>
                          </div>
                          {/* Settlement expenses breakdown */}
                          <div className="flex items-center justify-between">
                            <span>Settlement expenses (probate + funeral)</span>
                            <span className="text-white">{formatCurrency(Number((summary as any).liquidity?.settlementExpenses || 0))}</span>
                          </div>
                          {/* Charitable reserve (earmarked funds not counted toward available liquidity) */}
                          {((summary as any).liquidity?.charitableReserve || 0) > 0 && (
                            <div className="flex items-center justify-between">
                              <span>Charitable reserve (earmarked)</span>
                            <span className="text-white">{formatCurrency(Number((activeSummary as any).liquidity?.charitableReserve || 0))}</span>
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            Probate (5%): {formatCurrency(Number((activeSummary as any).liquidity?.probateCosts || 0))} · Funeral: {formatCurrency(Number((activeSummary as any).liquidity?.funeralCost || 0))}
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Insurance need</span>
                            <span className="text-white">{formatCurrency(activeSummary.liquidity.insuranceNeed)}</span>
                          </div>
                          {/* Life insurance disclosure */}
                          {(activeSummary.liquidity.existingLifeInsuranceUser > 0 || activeSummary.liquidity.existingLifeInsuranceSpouse > 0 || activeSummary.liquidity.ilitCoverage > 0) && (
                            <div className="pt-1 text-xs text-gray-400">
                              {(() => {
                                const parts: string[] = [];
                                if (activeSummary.liquidity.existingLifeInsuranceUser > 0) {
                                  parts.push(`user in-estate ${formatCurrency(Number(activeSummary.liquidity.existingLifeInsuranceUser))}`);
                                }
                                if (activeSummary.liquidity.existingLifeInsuranceSpouse > 0) {
                                  parts.push(`spouse in-estate ${formatCurrency(Number(activeSummary.liquidity.existingLifeInsuranceSpouse))}`);
                                }
                                if (activeSummary.liquidity.ilitCoverage > 0) {
                                  parts.push(`ILIT ${formatCurrency(Number(activeSummary.liquidity.ilitCoverage))}`);
                                }
                                const total = Number(activeSummary.liquidity.existingLifeInsuranceUser || 0) + Number(activeSummary.liquidity.existingLifeInsuranceSpouse || 0) + Number(activeSummary.liquidity.ilitCoverage || 0);
                                return (
                                  <span>
                                    Includes life insurance: {formatCurrency(total)} ({parts.join(', ')})
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="bg-gray-950/40 border-gray-800">
                        <CardHeader>
                          <CardTitle className="text-sm font-semibold text-gray-200">Tax components</CardTitle>
                        </CardHeader>
                        <CardContent className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={taxBarData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                              <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(value, { compact: true })} />
                              <RechartsTooltip
                                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                                contentStyle={{
                                  backgroundColor: "#111827",
                                  borderColor: "#1f2937",
                                  color: "#E5E7EB",
                                }}
                              />
                              <Bar dataKey="Federal" stackId="a" fill="#f97316" radius={[6, 6, 0, 0]} />
                              <Bar dataKey="State" stackId="a" fill="#fb923c" radius={[6, 6, 0, 0]} />
                              <Bar dataKey="LiquidityGap" fill="#ef4444" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="strategies" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-xl text-white">Strategy Sandbox</CardTitle>
                    {scenarios.length > 0 && (
                      <Badge variant="outline" className="border-purple-500/40 text-purple-200">
                        {scenarios.length} saved scenario{scenarios.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    Toggle trusts, gifting, charitable moves, and insurance planning to see how they reshape the estate outcome.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {summary ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <StrategyToggle
                          label="Bypass trust on first death"
                          description="Preserve both exemptions for married clients and keep growth outside the survivor's estate."
                          checked={Boolean(localStrategies.bypassTrust)}
                          onChange={(value) => handleStrategyBooleanChange("bypassTrust", value)}
                        />
                        <StrategyInput
                          label="ILIT death benefit"
                          description="Proceeds inside an irrevocable life insurance trust stay outside the taxable estate yet boost liquidity."
                          value={localStrategies.ilitDeathBenefit ?? ""}
                          onChange={(value) => handleStrategyNumberChange("ilitDeathBenefit", value)}
                        />
                        <StrategyInput
                          label="Lifetime gifts already made"
                          description="Reduces taxable estate and lifetime exemption."
                          value={localStrategies.lifetimeGifts ?? ""}
                          onChange={(value) => handleStrategyNumberChange("lifetimeGifts", value)}
                        />
                        <StrategyInput
                          label="Annual gifting (per year)"
                          description="Modeled at current annual exclusion levels through longevity age."
                          value={localStrategies.annualGiftAmount ?? ""}
                          onChange={(value) => handleStrategyNumberChange("annualGiftAmount", value)}
                        />
                        <StrategyInput
                          label="Trust funding"
                          description="Total assets transferred into irrevocable trusts (GRAT, SLAT, etc.)."
                          value={trustFundingTotal || ""}
                          onChange={(value) => handleStrategyNumberChange("trustFunding", value)}
                        />
                        <StrategyInput
                          label="Charitable bequest"
                          description="Removes charitably directed assets from taxable estate and highlights legacy impact."
                          value={localStrategies.charitableBequest ?? ""}
                          onChange={(value) => handleStrategyNumberChange("charitableBequest", value)}
                        />
                      </div>

                      <Separator className="border-gray-800" />

                      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                          <h3 className="text-sm font-semibold text-gray-200 mb-3">Liquidity target</h3>
                          <p className="text-xs text-gray-400 mb-2">
                            Ensures readily accessible assets cover estate taxes and settlement costs without forcing fire-sale decisions.
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-300">Required buffer</span>
                            <span className="text-lg font-semibold text-white">
                              {percentFormatter.format((localAssumptions.liquidityTargetPercent ?? 110) / 100)}
                            </span>
                          </div>
                          <Slider
                            className="mt-4"
                            defaultValue={[localAssumptions.liquidityTargetPercent ?? 110]}
                            min={100}
                            max={200}
                            step={5}
                            onValueChange={([value]) => handleAssumptionChange("liquidityTargetPercent", value)}
                          />
                          <p className="mt-3 text-xs text-gray-500">
                            Liquidity required: {formatCurrency(activeSummary.liquidity.required)} · Available today: {formatCurrency(activeSummary.liquidity.available)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                          <h3 className="text-sm font-semibold text-gray-200 mb-3">Strategy impact check</h3>
                          <ul className="space-y-2 text-sm text-gray-300">
                            <li className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-purple-400" />
                              Net to heirs {activeSummary.netToHeirs >= (estateProjection?.netToHeirs || 0) ? "increased" : "changed"} to {formatCurrency(activeSummary.netToHeirs)}
                            </li>
                            <li className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-purple-400" />
                              Estate tax liability now {formatCurrency(activeSummary.totalTax)}
                            </li>
                            <li className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-purple-400" />
                              Liquidity gap {activeSummary.liquidity.gap > 0 ? `is ${formatCurrency(activeSummary.liquidity.gap)}` : "closed"}
                            </li>
                          </ul>
                          <Button
                            variant="ghost"
                            className="mt-4 text-sm text-purple-200 hover:text-white"
                            onClick={() => {
                              setLocalStrategies(strategies);
                              setLocalAssumptions(assumptions);
                            }}
                          >
                            Reset to saved baseline
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Load a baseline estate projection to begin scenario testing. Complete retirement and estate inputs to activate the sandbox.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="beneficiaries" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl text-white">Beneficiaries & Legacy Flow</CardTitle>
                  <p className="text-sm text-gray-400">
                    Review how assets flow between spouses, trusts, charities, and heirs—plus titling considerations to avoid probate surprises.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {beneficiaries.length ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {beneficiaries.map((beneficiary: any) => (
                        <BeneficiaryCard key={`${beneficiary.id}-${beneficiary.name}`} beneficiary={beneficiary} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No beneficiaries on file. Add designations to retirement accounts, insurance policies, and transfer-on-death assets to keep legacy plans enforceable.
                    </p>
                  )}

                  <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-200">High-level estate flow</h3>
                    <div className="flex flex-col gap-3 text-sm text-gray-300 md:flex-row md:items-center md:justify-between">
                      <FlowNode label="Client Estate" amount={activeSummary ? formatCurrency(activeSummary.projectedEstateValue) : "—"} />
                      <ArrowRight className="h-4 w-4 text-purple-400 self-center" />
                      <FlowNode
                        label="Surviving spouse / trusts"
                        amount={activeSummary ? formatCurrency(activeSummary.netToHeirs - activeSummary.heirTaxEstimate.projectedIncomeTax) : "—"}
                      />
                      <ArrowRight className="h-4 w-4 text-purple-400 self-center" />
                      <FlowNode label="Final heirs / charity" amount={activeSummary ? formatCurrency(activeSummary.heirTaxEstimate.netAfterIncomeTax) : "—"} />
                    </div>
                    <p className="text-xs text-gray-500">
                      Probate-sensitive assets (those without beneficiary designations or not titled in trust) may delay or reduce distributions. Confirm titling and contingent beneficiaries regularly.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl text-white">Document Checklist & Tasking</CardTitle>
                  <p className="text-sm text-gray-400">
                    Track critical estate documents, review cadences, and outstanding action items to keep the plan enforceable.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {documents.length ? (
                    <div className="overflow-hidden rounded-xl border border-gray-800">
                      <table className="min-w-full divide-y divide-gray-800 text-sm">
                        <thead className="bg-gray-950/60 text-gray-400">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Document</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Last reviewed</th>
                            <th className="px-4 py-3 text-left font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {documents.map((doc: any) => (
                            <tr key={`${doc.id}-${doc.documentName}`} className="bg-gray-950/30 hover:bg-gray-900/40">
                              <td className="px-4 py-3 text-gray-200">{doc.documentName}</td>
                              <td className="px-4 py-3">
                                <DocumentStatusBadge status={doc.status} />
                              </td>
                              <td className="px-4 py-3 text-gray-300">
                                {doc.executionDate ? dateFormatter.format(new Date(doc.executionDate)) : "—"}
                              </td>
                              <td className="px-4 py-3 text-gray-400">{doc.description || ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Capture will, trust, power of attorney, and healthcare directive status here. Keeping these updated prevents state intestacy rules from overriding your intentions.
                    </p>
                  )}

                  <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                    <h3 className="text-sm font-semibold text-gray-200 mb-2">Reminders</h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li>Review documents after major life events (marriage, divorce, new child, relocation to another state).</li>
                      <li>Coordinate beneficiary designations with will or trust instructions to avoid conflicts.</li>
                      <li>Store originals securely and share locations with trusted contacts or advisors.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl text-white">Advisor Playbook & Next Actions</CardTitle>
                  <p className="text-sm text-gray-400">
                    Action-oriented summary tailored to taxes, liquidity, beneficiary hygiene, and outstanding documents.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reportSummary.length ? (
                    <RecommendationList items={reportSummary} />
                  ) : (
                    <p className="text-sm text-gray-400">Run an estate projection to generate tailored recommendations.</p>
                  )}

                  <Separator className="border-gray-800" />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="bg-gray-950/40 border-gray-800">
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold text-gray-200">Documents & governance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-gray-300">
                        {documents.filter((doc: any) => doc.status !== "executed").length ? (
                          <p>
                            {documents.filter((doc: any) => doc.status !== "executed").length} document(s) need attention. Prioritize signing or updating wills, trusts, and powers of attorney.
                          </p>
                        ) : (
                          <p>Core estate documents are up to date—schedule periodic reviews to stay compliant with state law changes.</p>
                        )}
                        {beneficiaries.some((b: any) => !b.isPrimary && !b.isContingent) && (
                          <p>Add contingent beneficiaries to retirement and insurance assets to prevent default probate outcomes.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-950/40 border-gray-800">
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold text-gray-200">Liquidity & insurance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-gray-300">
                        {activeSummary && activeSummary.liquidity.gap > 0 ? (
                          <p>
                            Liquidity shortfall projected. Consider layering survivorship life insurance or earmarking brokerage assets to cover {formatCurrency(activeSummary.liquidity.gap)} in expected settlement costs.
                          </p>
                        ) : (
                          <p>Liquidity targets satisfied. Continue monitoring as projections shift with market returns or gifting.</p>
                        )}
                        {localStrategies.charitableBequest ? (
                          <p>Coordinate charitable bequests with advisors to confirm beneficiary language and potential use of donor-advised funds.</p>
                        ) : (
                          <p>Clarify charitable goals; gifting during lifetime or via testamentary bequests can shrink taxable estate and reinforce legacy values.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

interface SummaryTileProps {
  label: string;
  value: string;
  helper?: string;
  accent?: "emerald" | "orange" | "sky" | "default";
}

function SummaryTile({ label, value, helper, accent = "default" }: SummaryTileProps) {
  const accentColor = {
    emerald: "bg-emerald-500/10 text-emerald-300",
    orange: "bg-orange-500/10 text-orange-300",
    sky: "bg-sky-500/10 text-sky-300",
    default: "bg-purple-500/10 text-purple-200",
  }[accent];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
      <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${accentColor}`}>{label}</div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      {helper && <p className="mt-2 text-xs text-gray-400">{helper}</p>}
    </div>
  );
}

interface MetricTileProps {
  label: string;
  value: string | number;
  helper?: string;
  icon: any;
}

function MetricTile({ label, value, helper, icon: Icon }: MetricTileProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Icon className="h-4 w-4 text-purple-300" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {helper && <p className="mt-2 text-xs text-gray-400">{helper}</p>}
    </div>
  );
}

function AssumptionRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}

function StrategyToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

function StrategyInput({ label, description, value, onChange }: { label: string; description: string; value: string | number; onChange: (value: number) => void }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 space-y-2">
      <div className="space-y-1">
        <Label className="text-sm text-white">{label}</Label>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <Input
        type="number"
        inputMode="decimal"
        className="bg-gray-900/60 border-gray-700 text-sm text-white"
        value={value}
        onChange={(event) => onChange(parseNumericInput(event.target.value))}
        placeholder="0"
        min={0}
      />
    </div>
  );
}

function FlowNode({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 px-4 py-3 text-sm text-gray-300">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{amount}</p>
    </div>
  );
}

function BeneficiaryCard({ beneficiary }: { beneficiary: any }) {
  const distribution = beneficiary.distributionPercentage
    ? `${beneficiary.distributionPercentage}%`
    : beneficiary.distributionAmount
    ? formatCurrency(Number(beneficiary.distributionAmount))
    : "—";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">{beneficiary.name}</p>
        <Badge variant={beneficiary.isPrimary ? "default" : "outline"}>
          {beneficiary.isPrimary ? "Primary" : beneficiary.isContingent ? "Contingent" : "Unassigned"}
        </Badge>
      </div>
      <p className="text-xs text-gray-400">Relationship: {beneficiary.relationship || "—"}</p>
      <p className="text-xs text-gray-400">Distribution: {distribution}</p>
    </div>
  );
}

function DocumentStatusBadge({ status }: { status: string }) {
  const normalized = String(status || "draft").toLowerCase();
  const variants: Record<string, { label: string; className: string }> = {
    executed: { label: "Executed", className: "bg-emerald-500/10 text-emerald-300" },
    draft: { label: "Draft", className: "bg-purple-500/10 text-purple-200" },
    needs_update: { label: "Needs Update", className: "bg-orange-500/10 text-orange-300" },
    expired: { label: "Expired", className: "bg-red-500/10 text-red-300" },
  };
  const variant = variants[normalized] || variants.draft;

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${variant.className}`}>{variant.label}</span>;
}

function RecommendationList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-gray-300">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2">
          <ArrowRight className="mt-1 h-4 w-4 text-purple-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const numericSanitizer = /[^0-9.-]/g;
function parseNumericInput(value: string): number {
  if (!value) return 0;
  const parsed = Number(value.replace(numericSanitizer, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
