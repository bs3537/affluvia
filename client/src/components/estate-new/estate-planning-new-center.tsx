import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEstatePlanningNew } from "@/hooks/useEstatePlanningNew";
import { estatePlanningService } from "@/services/estate-planning.service";
import { calculateEstateProjection, EstateStrategyInputs, EstateAssumptionInputs } from "@/lib/estate-new/analysis";
import { getFederalExemption } from "@shared/estate-tax-config";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
  import { Checkbox } from "@/components/ui/checkbox";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Tooltip as RechartsTooltip,
  Legend
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

function formatMillions(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  const abs = Math.abs(Number(value)) / 1_000_000;
  const str = abs.toFixed(2);
  return (Number(value) < 0 ? "-" : "") + "$" + str + "M";
}

function formatPercent(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return percentFormatter.format(value / 100);
}

const PIE_COLORS = ["#a855f7", "#f97316", "#22d3ee", "#94a3b8", "#ef4444"];

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
  const { toast } = useToast();
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
  const isEditingRef = useRef(false);
  const lastEditAtRef = useRef(0);
  const markEdited = () => { try { lastEditAtRef.current = Date.now(); } catch {} };

  // Initialize toggle from persisted estate plan preferences if available
  useEffect(() => {
    const persisted = (estatePlan as any)?.analysisResults?.estateNew?.includeRoth;
    if (typeof persisted === "boolean") {
      setIncludeRoth(persisted);
    }
  }, [(estatePlan as any)?.id]);

  useEffect(() => {
    if (isEditingRef.current || Date.now() - lastEditAtRef.current < 1200) return;
    setLocalStrategies((prev) => ({ ...prev, ...strategies }));
  }, [strategies]);

  useEffect(() => {
    if (isEditingRef.current || Date.now() - lastEditAtRef.current < 1200) return;
    setLocalAssumptions((prev) => ({ ...prev, ...assumptions }));
  }, [assumptions]);

  // Manual-calc mode: committed inputs drive calculations; typing in local inputs does not recalc until Calculate is pressed
  const [committedStrategies, setCommittedStrategies] = useState<EstateStrategyInputs>(strategies);
  const [committedAssumptions, setCommittedAssumptions] = useState<EstateAssumptionInputs>(assumptions);

  // Keep committed inputs aligned with server when not actively editing
  useEffect(() => {
    if (isEditingRef.current || Date.now() - lastEditAtRef.current < 1200) return;
    setCommittedStrategies(strategies);
    setCommittedAssumptions(assumptions);
  }, [strategies, assumptions]);

  const recalculatedProjection = useMemo(() => {
    if (!projectedEstateValue || projectedEstateValue <= 0) return null;
    return calculateEstateProjection({
      baseEstateValue: projectedEstateValue,
      assetComposition,
      strategies: committedStrategies,
      assumptions: committedAssumptions,
      profile,
    });
  }, [projectedEstateValue, assetComposition, committedStrategies, committedAssumptions, profile]);

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
        strategies: committedStrategies,
        assumptions: committedAssumptions,
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
    committedStrategies,
    committedAssumptions,
    profile,
  ]);

  const activeSummary = includeRoth && withRothSummary ? withRothSummary : summary;

  // Persist all displayed state and computed results for Estate Planning New
  const pendingHashRef = useRef<string | null>(null);
  const lastSavedHashRef = useRef<string | null>(null);
  const lastSaveTimeRef = useRef(0);
  const saveEstateNewMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!estatePlan?.id) return null;
      return estatePlanningService.updateEstatePlan(estatePlan.id, updates);
    },
    onSuccess: () => {
      lastSaveTimeRef.current = Date.now();
      lastSavedHashRef.current = pendingHashRef.current;
      // Avoid invalidation here to prevent GET/PATCH loops and flicker
    },
    onError: () => {
      // Allow retrying on next change
      pendingHashRef.current = null;
    }
  });

  // Build and save a snapshot whenever relevant inputs/results change (debounced)
  // Note: placed after compositionPieData declaration to avoid TDZ issues.

  const taxPieData = useMemo(() => {
    if (!activeSummary) return [] as { name: string; value: number }[];
    const settlement = Math.max(0, Number((activeSummary as any).liquidity?.settlementExpenses || 0));
    const charitable = Math.max(0, Number(activeSummary.charitableImpact?.charitableBequests || 0));
    const incomeDrag = Math.max(0, Number(activeSummary.heirTaxEstimate?.projectedIncomeTax || 0));
    const taxes = Math.max(0, Number(activeSummary.totalTax || 0));
    const gross = Math.max(0, Number(activeSummary.projectedEstateValue || 0));
    const finalNet = Math.max(0, gross - taxes - incomeDrag - charitable - settlement);

    return [
      { name: "Net to Heirs", value: finalNet },
      { name: "Estate Taxes", value: taxes },
      { name: "Charitable Gifts", value: charitable },
      { name: "Income Tax Drag", value: incomeDrag },
      { name: "Other Expenses", value: settlement },
    ];
  }, [activeSummary]);

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

  // Save snapshot when committed inputs (via Calculate) change — throttled + hashed to avoid loops
  useEffect(() => {
    if (!estatePlan?.id || !activeSummary) return;
    if (saveEstateNewMutation.isPending) return;
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 5000) return; // throttle saves to at most once per 5s
    try {
      const trustStrategies = Array.isArray(committedStrategies.trustFunding)
        ? committedStrategies.trustFunding
            .filter((t) => (Number(t?.amount) || 0) > 0)
            .map((t) => ({ type: "funding", name: t.label || "Trust Funding", fundingAmount: Number(t.amount) }))
        : undefined;

      const charitableGifts = (Number(committedStrategies.charitableBequest || 0) > 0)
        ? { plannedTotal: Number(committedStrategies.charitableBequest || 0), source: "estate-new" }
        : undefined;

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

      const estateNew = {
        includeRoth,
        strategies: committedStrategies,
        assumptions: committedAssumptions,
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
        assumptions: {
          ...(estatePlan as any)?.analysisResults?.assumptions,
          deathAge: activeSummary.assumptions?.deathAge,
          longevityAge: activeSummary.assumptions?.deathAge,
          currentAge: activeSummary.assumptions?.currentAge,
          federalExemption: activeSummary.assumptions?.federalExemption,
          stateExemption: activeSummary.assumptions?.stateExemption,
          liquidityTarget: committedAssumptions.liquidityTargetPercent,
          stateOverride: committedAssumptions.stateOverride,
          heirIncomeTaxRate: committedAssumptions.assumedHeirIncomeTaxRate,
          portability: committedAssumptions.portability,
          dsueAmount: committedAssumptions.dsueAmount,
        },
        strategies: {
          ...(estatePlan as any)?.analysisResults?.strategies,
          bypassTrust: Boolean(committedStrategies.bypassTrust),
        },
        gifting: {
          ...(estatePlan as any)?.analysisResults?.gifting,
          lifetimeGifts: committedStrategies.lifetimeGifts,
          annualGiftAmount: committedStrategies.annualGiftAmount,
        },
        insurance: {
          ...(estatePlan as any)?.analysisResults?.insurance,
          ilitDeathBenefit: committedStrategies.ilitDeathBenefit,
        },
        charitable: charitableGifts || (estatePlan as any)?.analysisResults?.charitable,
        latestSummary: activeSummary,
      };

      // Compute a minimal hash to detect no-op saves
      const hashPayload = {
        includeRoth,
        strategies: committedStrategies,
        assumptions: committedAssumptions,
        latestSummary: activeSummary,
      };
      const nextHash = JSON.stringify(hashPayload);
      if (lastSavedHashRef.current && nextHash === lastSavedHashRef.current) {
        return; // nothing meaningful changed
      }

      pendingHashRef.current = nextHash;
      saveEstateNewMutation.mutate({
        trustStrategies,
        charitableGifts,
        analysisResults: mergedAnalysis,
      });
    } catch {}
  }, [
    estatePlan?.id,
    includeRoth,
    JSON.stringify(committedStrategies),
    JSON.stringify(committedAssumptions),
    JSON.stringify(activeSummary),
  ]);

  const taxBarData = activeSummary
    ? [
        {
          name: "Taxes",
          Federal: activeSummary.federalTax,
          State: activeSummary.stateTax,
          HeirIncome: activeSummary.heirTaxEstimate.projectedIncomeTax,
        },
      ]
    : [];

  const liquidityCoverage =
    activeSummary
      ? Math.min(
          1,
          (activeSummary.liquidity.available || 0) /
            Math.max(1, activeSummary.liquidity.required || 0)
        )
      : 0;

  const liquidityPieData = activeSummary
    ? [
        {
          name: "Covered",
          value: Math.min(
            activeSummary.liquidity.available,
            activeSummary.liquidity.required
          ),
        },
        {
          name: "Shortfall",
          value: Math.max(
            0,
            activeSummary.liquidity.required - activeSummary.liquidity.available
          ),
        },
      ]
    : [];

  const deltas =
    includeRoth && summary && withRothSummary
      ? {
          netToHeirs:
            (withRothSummary.heirTaxEstimate?.netAfterIncomeTax ??
              withRothSummary.netToHeirs) -
            (summary.heirTaxEstimate?.netAfterIncomeTax ?? summary.netToHeirs),
          totalTax: withRothSummary.totalTax - summary.totalTax,
          liquidityGap:
            (withRothSummary.liquidity?.gap ?? 0) -
            (summary.liquidity?.gap ?? 0),
        }
      : null;

  const netAfterAllCosts = useMemo(() => {
    if (!activeSummary) return 0;
    const settlement = Math.max(0, Number((activeSummary as any).liquidity?.settlementExpenses || 0));
    const netAfterIncome = Math.max(0, Number(activeSummary.heirTaxEstimate?.netAfterIncomeTax || 0));
    return Math.max(0, netAfterIncome - settlement);
  }, [activeSummary]);

  const baselineNetAfterAllCosts = useMemo(() => {
    const base = estateProjection;
    if (!base) return 0;
    const settlement = Math.max(0, Number((base as any).liquidity?.settlementExpenses || 0));
    const netAfterIncome = Math.max(0, Number(base.heirTaxEstimate?.netAfterIncomeTax || 0));
    return Math.max(0, netAfterIncome - settlement);
  }, [estateProjection]);

  // ——— Beneficiaries editor helpers ———
  type FPAsset = { type?: string; owner?: string; value?: number; name?: string; description?: string; beneficiaries?: { primary?: string; contingent?: string }; deathBenefit?: number };
  const allAssets: FPAsset[] = useMemo(() => Array.isArray((profile as any)?.assets) ? (profile as any).assets : [], [profile]);

  const normalizeOwner = (o?: string) => {
    const s = String(o || "").toLowerCase();
    if (["user","self","you","client","primary"].includes(s)) return "user";
    if (["spouse","partner"].includes(s)) return "spouse";
    if (s === "joint") return "joint";
    return "user";
  };

  const categoryOf = (a: FPAsset): string => {
    const t = String(a?.type || "").toLowerCase();
    if (t.includes("bank") || t.includes("checking") || t.includes("savings")) return "Bank";
    if (t.includes("401k") || t.includes("ira") || t.includes("roth") || t.includes("retirement")) return "Retirement Accounts";
    if (t.includes("life")) return "Life Insurance";
    if (t.includes("brokerage") || t.includes("investment") || t.includes("stock") || t.includes("ibkr")) return "Invested Assets";
    return "Other Assets";
  };

  const assetsByCategory = useMemo(() => {
    const map: Record<string, { user: FPAsset[]; spouse: FPAsset[]; joint: FPAsset[] }> = {};
    for (const a of allAssets) {
      const cat = categoryOf(a);
      if (!map[cat]) map[cat] = { user: [], spouse: [], joint: [] };
      map[cat][normalizeOwner(a.owner)].push(a);
    }
    return map;
  }, [allAssets]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editPrimary, setEditPrimary] = useState<string>("");
  const [editContingent, setEditContingent] = useState<string>("");
  const [editCustomPrimary, setEditCustomPrimary] = useState<string>("");
  const [editCustomContingent, setEditCustomContingent] = useState<string>("");

  const { mutate: saveAssets, isPending: savingAssets } = useMutation({
    mutationFn: async (updatedAssets: FPAsset[]) => {
      const res = await fetch("/api/financial-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assets: updatedAssets, isPartialSave: true, skipCalculations: true }),
      });
      if (!res.ok) throw new Error("Failed to save beneficiaries");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial-profile"] });
      toast({ title: "Beneficiaries saved" });
      setEditingIndex(null);
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" })
  });

  const startEdit = (globalIdx: number) => {
    const a = allAssets[globalIdx] || {} as FPAsset;
    setEditingIndex(globalIdx);
    setEditPrimary(a.beneficiaries?.primary || "");
    setEditContingent(a.beneficiaries?.contingent || "");
    setEditCustomPrimary("");
    setEditCustomContingent("");
  };

  const saveRow = (globalIdx: number) => {
    const updated = [...allAssets];
    const p = editPrimary === "Custom" ? (editCustomPrimary || "Custom") : editPrimary;
    const c = editContingent === "Custom" ? (editCustomContingent || "Custom") : editContingent;
    const target = { ...(updated[globalIdx] || {}) } as FPAsset;
    target.beneficiaries = { ...(target.beneficiaries || {}), primary: p || undefined, contingent: c || undefined };
    updated[globalIdx] = target;
    saveAssets(updated);
  };

  // Checklist helpers
  const isMarriedOrPartnered =
    String((profile as any)?.maritalStatus || "").toLowerCase() === "married" ||
    String((profile as any)?.maritalStatus || "").toLowerCase() === "partnered";

  const clientFirstName = (profile as any)?.firstName || "Client";
  const spouseFirstName = ((profile as any)?.spouseName || "").split(" ")[0] || "Spouse";

  type ChecklistItem = { type: string; label: string; sublabel: string; defaultName: string };
  const CHECKLIST_ITEMS: ChecklistItem[] = [
    { type: "will", label: "Will", sublabel: "Document created", defaultName: "Last Will and Testament" },
    { type: "poa", label: "Power of Attorney", sublabel: "Document created", defaultName: "Financial Power of Attorney" },
    { type: "healthcare_directive", label: "Living Will", sublabel: "Document created", defaultName: "Healthcare Directive / Living Will" },
    { type: "healthcare_proxy", label: "Health Care Proxy", sublabel: "Document created", defaultName: "Health Care Proxy" },
    { type: "beneficiary_form", label: "Beneficiary Designations", sublabel: "Created and reviewed", defaultName: "Beneficiary Designations" },
    { type: "trust", label: "Living Trust", sublabel: "Document created", defaultName: "Revocable Living Trust" },
  ];

  function isChecked(type: string, forSpouse: boolean) {
    return Array.isArray(documents)
      ? documents.some((d: any) => String(d.documentType) === type && Boolean(d.forSpouse) === forSpouse && String(d.status) === "executed")
      : false;
  }

  const upsertChecklist = useMutation({
    mutationFn: async (payload: { type: string; forSpouse: boolean; checked: boolean }) => {
      const existing = Array.isArray(documents)
        ? documents.find((d: any) => String(d.documentType) === payload.type && Boolean(d.forSpouse) === payload.forSpouse)
        : undefined;
      if (existing) {
        return estatePlanningService.updateEstateDocument(existing.id, { status: payload.checked ? "executed" : "draft" } as any);
      }
      if (payload.checked && estatePlan?.id) {
        const meta = CHECKLIST_ITEMS.find((i) => i.type === payload.type);
        return estatePlanningService.createEstateDocument({
          estatePlanId: estatePlan.id,
          documentType: payload.type,
          documentName: meta?.defaultName || payload.type,
          status: "executed",
          forSpouse: payload.forSpouse,
        } as any);
      }
      return null;
    },
    onSuccess: () => {
      if (estatePlan?.id) {
        queryClient.invalidateQueries({ queryKey: ["estate-documents", estatePlan.id] });
      }
      toast({ title: "Checklist updated" });
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    }
  });

  // Build compact waterfall data from active summary
  type WaterfallRow = { name: string; offset: number; value: number; color: string };
  const waterfallData: WaterfallRow[] = useMemo(() => {
    if (!activeSummary) return [];
    const gross = Math.max(0, Number(activeSummary.projectedEstateValue || 0));
    const taxable = Math.max(0, Number(activeSummary.projectedTaxableEstate || 0));
    const charitable = Math.max(0, Number(activeSummary.charitableImpact?.charitableBequests || 0));
    const totalDeductions = Math.max(0, gross - taxable);
    const adminDed = Math.max(0, totalDeductions - charitable);
    const estateTaxes = Math.max(0, Number(activeSummary.totalTax || 0));
    const heirsIncomeTax = Math.max(0, Number(activeSummary.heirTaxEstimate?.projectedIncomeTax || 0));
    const otherExpenses = Math.max(0, Number((activeSummary as any).liquidity?.settlementExpenses || 0));

    let running = gross;
    const rows: WaterfallRow[] = [];

    // 1) Gross Estate (total bar)
    rows.push({ name: "Gross Estate", offset: 0, value: running, color: "#a855f7" });

    // 2) Administrative Deductions (non-charitable)
    if (adminDed > 0) {
      rows.push({ name: "Administrative Deductions", offset: Math.max(0, running - adminDed), value: Math.min(adminDed, running), color: "#94a3b8" });
      running = Math.max(0, running - adminDed);
    }

    // 3) Charitable Gifts (drop)
    if (charitable > 0) {
      rows.push({ name: "Charitable Gifts", offset: Math.max(0, running - charitable), value: Math.min(charitable, running), color: "#22d3ee" });
      running = Math.max(0, running - charitable);
    }

    // 4) Estate Taxes (drop)
    if (estateTaxes > 0) {
      rows.push({ name: "Estate Taxes", offset: Math.max(0, running - estateTaxes), value: Math.min(estateTaxes, running), color: "#f97316" });
      running = Math.max(0, running - estateTaxes);
    }

    // 5) Heirs' Income Tax (drop)
    if (heirsIncomeTax > 0) {
      rows.push({ name: "Heirs' Income Tax", offset: Math.max(0, running - heirsIncomeTax), value: Math.min(heirsIncomeTax, running), color: "#60a5fa" });
      running = Math.max(0, running - heirsIncomeTax);
    }

    // 6) Other Expenses (probate + funeral)
    if (otherExpenses > 0) {
      rows.push({ name: "Other Expenses", offset: Math.max(0, running - otherExpenses), value: Math.min(otherExpenses, running), color: "#ef4444" });
      running = Math.max(0, running - otherExpenses);
    }

    // 7) Net to Heirs (final)
    rows.push({ name: "Net to Heirs", offset: 0, value: Math.max(0, running), color: "#10b981" });

    return rows;
  }, [activeSummary]);

  const trustFundingTotal = useMemo(() => {
    return (localStrategies.trustFunding || []).reduce((total, trust) => total + (Number(trust?.amount) || 0), 0);
  }, [localStrategies.trustFunding]);
  const trustFundingPrimary = (localStrategies.trustFunding && localStrategies.trustFunding.length)
    ? Number(localStrategies.trustFunding[0]?.amount || 0)
    : undefined;

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
    markEdited();
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
    markEdited();
    setLocalStrategies((prev) => ({ ...prev, [key]: value }));
  };

  const handleAssumptionChange = (key: keyof EstateAssumptionInputs, value: number) => {
    markEdited();
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
              { id: "checklist", label: "Checklist", icon: CheckCircle2 },
              { id: "beneficiaries-table", label: "Beneficiaries", icon: Users },
              { id: "recommendations", label: "Recommendations", icon: Target },
              { id: "will", label: "Will Creator", icon: FileText },
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
                  {deltas && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="bg-emerald-900/20 border-emerald-700/50">
                        <CardContent className="p-4">
                          <div className="text-xs text-emerald-300">Net to heirs (Δ after Roth conversions)</div>
                          <div className="text-lg font-semibold text-white">{formatCurrency(deltas.netToHeirs)}</div>
                          <div className="text-[11px] text-gray-400">
                            Change vs baseline after Roth conversions
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-orange-900/20 border-orange-700/50">
                        <CardContent className="p-4">
                          <div className="text-xs text-orange-300">Total estate taxes (Δ after Roth conversions)</div>
                          <div className="text-lg font-semibold text-white">{formatCurrency(deltas.totalTax)}</div>
                          <div className="text-[11px] text-gray-400">
                            Change vs baseline after Roth conversions
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-red-900/20 border-red-700/50">
                        <CardContent className="p-4">
                          <div className="text-xs text-red-300">Liquidity gap (Δ after Roth conversions)</div>
                          <div className="text-lg font-semibold text-white">{formatCurrency(deltas.liquidityGap)}</div>
                          <div className="text-[11px] text-gray-400">
                            Change vs baseline after Roth conversions
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
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
                        label="Estate Taxes"
                        value={formatCurrency(activeSummary.totalTax)}
                        helper={`Effective rate ${formatPercent(activeSummary.effectiveTaxRate)}`}
                        accent="orange"
                      />
                      <SummaryTile
                        label="Net Estate (after estate tax)"
                        value={formatCurrency(activeSummary.netToHeirs)}
                        helper="After estate tax only"
                      />
                      <SummaryTile
                        label="Net Estate (after taxes & other costs)"
                        value={formatCurrency(netAfterAllCosts)}
                        helper="After heirs’ income tax, probate (5%), and funeral costs"
                        accent="emerald"
                        highlight
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
                        <CardContent className="pt-2">
                          <div className="h-56 sm:h-60">
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
                          </div>
                          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px]">
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

            <TabsContent value="beneficiaries-table" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Beneficiaries</CardTitle>
                  <p className="text-sm text-gray-400">
                    Review accounts by owner and set primary and contingent beneficiaries. Changes are saved to your profile on Save.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-xl border border-gray-800">
                    <table className="min-w-full divide-y divide-gray-800 text-sm">
                      <thead className="bg-gray-950/60 text-gray-400">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Account / Group</th>
                          <th className="px-4 py-3 text-right font-medium">Account Balance</th>
                          <th className="px-4 py-3 text-right font-medium">Death Benefit</th>
                          <th className="px-4 py-3 text-left font-medium">Primary Beneficiary</th>
                          <th className="px-4 py-3 text-left font-medium">Contingent Beneficiary</th>
                          <th className="px-4 py-3 text-right font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {Object.entries(assetsByCategory).map(([category, owners]) => (
                          <tbody key={category} className="contents">
                            <tr>
                              <td className="px-4 py-2 font-semibold text-gray-200 bg-gray-900/30" colSpan={6}>{category}</td>
                            </tr>

                            {(["user","spouse","joint"] as const).map((ownerKey) => {
                              const rows = (owners as any)[ownerKey] as FPAsset[];
                              if (!rows.length) return null;
                              const ownerLabel =
                                ownerKey === "user" ? `${clientFirstName}'s Accounts` :
                                ownerKey === "spouse" ? `${spouseFirstName}'s Accounts` :
                                "Joint Accounts";

                              return (
                                <tbody key={`${category}-${ownerKey}`} className="contents">
                                  <tr>
                                    <td className="px-4 py-2 text-teal-300" colSpan={6}>{ownerLabel}</td>
                                  </tr>

                                  {rows.map((a, idxInOwner) => {
                                    const globalIdx = allAssets.indexOf(a);
                                    const isEditing = editingIndex === globalIdx;
                                    const displayName = a.name || a.description || a.type || "Account";
                                    const balance = Number(a.value || 0);
                                    const death = Number(typeof a.deathBenefit === "number" ? a.deathBenefit : (category === "Life Insurance" ? a.value || 0 : 0));

                                    return (
                                      <tr key={`${category}-${ownerKey}-${idxInOwner}`} className={isEditing ? "bg-blue-900/20" : "bg-gray-950/40 hover:bg-gray-900/40"}>
                                        <td className="px-4 py-3 text-gray-100">{displayName}</td>
                                        <td className="px-4 py-3 text-right text-gray-100">{formatCurrency(balance)}</td>
                                        <td className="px-4 py-3 text-right text-gray-100">{death > 0 ? formatCurrency(death) : "—"}</td>

                                        <td className="px-4 py-3">
                                          {isEditing ? (
                                            <div className="flex items-center gap-2">
                                              <Select value={editPrimary || ""} onValueChange={(v) => setEditPrimary(v)}>
                                                <SelectTrigger className="bg-gray-900/60 border-gray-700 text-white h-9 w-44">
                                                  <SelectValue placeholder="Select…" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-gray-800 border-gray-700">
                                                  {isMarriedOrPartnered && <SelectItem value={spouseFirstName} className="text-white">{spouseFirstName}</SelectItem>}
                                                  <SelectItem value="Charity" className="text-white">Charity</SelectItem>
                                                  <SelectItem value="Trust" className="text-white">Trust</SelectItem>
                                                  <SelectItem value="All children" className="text-white">All children</SelectItem>
                                                  <SelectItem value="All grandchildren" className="text-white">All grandchildren</SelectItem>
                                                  <SelectItem value="Custom" className="text-white">Custom</SelectItem>
                                                </SelectContent>
                                              </Select>
                                              {editPrimary === "Custom" && (
                                                <Input value={editCustomPrimary} onChange={(e) => setEditCustomPrimary(e.target.value)} placeholder="Custom name" className="h-9 bg-gray-900/60 border-gray-700 text-white w-40" />
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-gray-200">{(a as any).beneficiaries?.primary || "—"}</span>
                                          )}
                                        </td>

                                        <td className="px-4 py-3">
                                          {isEditing ? (
                                            <div className="flex items-center gap-2">
                                              <Select value={editContingent || ""} onValueChange={(v) => setEditContingent(v)}>
                                                <SelectTrigger className="bg-gray-900/60 border-gray-700 text-white h-9 w-44">
                                                  <SelectValue placeholder="Select…" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-gray-800 border-gray-700">
                                                  {isMarriedOrPartnered && <SelectItem value={spouseFirstName} className="text-white">{spouseFirstName}</SelectItem>}
                                                  <SelectItem value="Charity" className="text-white">Charity</SelectItem>
                                                  <SelectItem value="Trust" className="text-white">Trust</SelectItem>
                                                  <SelectItem value="All children" className="text-white">All children</SelectItem>
                                                  <SelectItem value="All grandchildren" className="text-white">All grandchildren</SelectItem>
                                                  <SelectItem value="Custom" className="text-white">Custom</SelectItem>
                                                </SelectContent>
                                              </Select>
                                              {editContingent === "Custom" && (
                                                <Input value={editCustomContingent} onChange={(e) => setEditCustomContingent(e.target.value)} placeholder="Custom name" className="h-9 bg-gray-900/60 border-gray-700 text-white w-40" />
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-gray-200">{(a as any).beneficiaries?.contingent || "—"}</span>
                                          )}
                                        </td>

                                        <td className="px-4 py-3 text-right">
                                          {isEditing ? (
                                            <div className="flex items-center gap-2 justify-end">
                                              <Button variant="outline" className="h-8 border-gray-600 text-gray-200" onClick={() => { setEditingIndex(null); }}>Cancel</Button>
                                              <Button className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={savingAssets} onClick={() => saveRow(globalIdx)}>
                                                {savingAssets ? "Saving…" : "Save"}
                                              </Button>
                                            </div>
                                          ) : (
                                            <Button variant="outline" className="h-8 border-gray-600 text-gray-200" onClick={() => startEdit(globalIdx)}>Edit</Button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              );
                            })}
                          </tbody>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl text-white">Estate Checklist</CardTitle>
                  <p className="text-sm text-gray-400">
                    To protect and control your family's future, keep track of progress on essential estate documents.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-xl border border-gray-800">
                    <table className="min-w-full divide-y divide-gray-800 text-sm">
                      <thead className="bg-gray-950/60 text-gray-400">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium"></th>
                          <th className="px-4 py-3 text-center font-medium text-gray-300">{clientFirstName}</th>
                          {isMarriedOrPartnered && (
                            <th className="px-4 py-3 text-center font-medium text-gray-300">{spouseFirstName}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {CHECKLIST_ITEMS.map((item) => (
                          <>
                            <tr key={`${item.type}-label`} className="bg-gray-900/30">
                              <td className="px-4 py-3 font-semibold text-gray-200">{item.label}</td>
                              <td className="px-4 py-3 text-center">
                                {item.type === 'will' && (
                                  <WillUploadInline docId={(documents.find((d: any) => String(d.documentType) === 'will' && !d.forSpouse)?.id)} documentType="will" />
                                )}
                              </td>
                              {isMarriedOrPartnered && (
                                <td className="px-4 py-3 text-center">
                                  {item.type === 'will' && (
                                    <WillUploadInline docId={(documents.find((d: any) => String(d.documentType) === 'will' && d.forSpouse)?.id)} documentType="will" />
                                  )}
                                </td>
                              )}
                            </tr>
                            <tr key={`${item.type}-row`} className="bg-gray-950/40">
                              <td className="px-4 py-3 text-gray-400"> {item.sublabel} </td>
                              <td className="px-4 py-3 text-center">
                                <Checkbox
                                  checked={isChecked(item.type, false)}
                                  onCheckedChange={(v) => upsertChecklist.mutate({ type: item.type, forSpouse: false, checked: Boolean(v) })}
                                />
                              </td>
                              {isMarriedOrPartnered && (
                                <td className="px-4 py-3 text-center">
                                  <Checkbox
                                    checked={isChecked(item.type, true)}
                                    onCheckedChange={(v) => upsertChecklist.mutate({ type: item.type, forSpouse: true, checked: Boolean(v) })}
                                  />
                                </td>
                              )}
                            </tr>
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Reminders (moved from Documents & Tasks tab) */}
                  <div className="mt-6">
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

            

            <TabsContent value="tax" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Tax Outlook</CardTitle>
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
                            <td className="px-4 py-3 text-right text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">
                              {(() => {
                                const year = Number(activeSummary.assumptions?.yearOfDeath || new Date().getFullYear());
                                const baseEx = getFederalExemption(year);
                                const safe = Number.isFinite(baseEx) ? Math.max(0, baseEx) : 0;
                                return <span>Exemption applied: {formatCurrency(safe)}</span>;
                              })()}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-200">State estate/inheritance tax</td>
                            <td className="px-4 py-3 text-right text-orange-300">{formatCurrency(activeSummary.stateTax)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">
                              Based on {activeSummary.assumptions.state || "residence"} thresholds
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-200">Heirs' income tax</td>
                            <td className="px-4 py-3 text-right text-sky-300">{formatCurrency(activeSummary.heirTaxEstimate.projectedIncomeTax)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">
                              Assumes {percentFormatter.format(activeSummary.heirTaxEstimate.assumedRate)} on {formatCurrency(activeSummary.heirTaxEstimate.taxDeferredBalance)} tax‑deferred balance
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Add estate plan details to calculate projected tax exposure.</p>
                  )}

                  {summary && (
                    <>
                      {/* Top: Waterfall (wider) + Taxes */}
                      <div className="grid gap-4 lg:grid-cols-3">
                        <Card className="bg-gray-950/40 border-gray-800 lg:col-span-2">
                          <CardHeader>
                            <CardTitle className="text-sm font-semibold text-gray-200">Estate Waterfall</CardTitle>
                          </CardHeader>
                          <CardContent className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={waterfallData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} interval={0} angle={-12} dy={8} />
                                <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, { compact: true })} />
                                <RechartsTooltip
                                  formatter={(value: number, name: string, props: any) => [formatMillions(value), props?.payload?.name]}
                                  contentStyle={{ backgroundColor: "#111827", borderColor: "#1f2937", color: "#E5E7EB" }}
                                  labelStyle={{ color: "#E5E7EB" }}
                                  itemStyle={{ color: "#E5E7EB" }}
                                  cursor={{ fill: "rgba(31,41,55,0.35)" }}
                                />
                                <Bar dataKey="offset" stackId="a" fill="transparent" isAnimationActive={false} />
                                <Bar dataKey="value" stackId="a" radius={[6, 6, 0, 0]}>
                                  {waterfallData.map((entry, index) => (
                                    <Cell key={`wf-${index}`} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            <div className="mt-2 text-[11px] text-gray-500">
                              Shows progression from gross estate to final net after taxes, heirs’ income tax, charitable gifts, and other expenses.
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gray-950/40 border-gray-800">
                          <CardHeader>
                            <CardTitle className="text-sm font-semibold text-gray-200">Tax components</CardTitle>
                          </CardHeader>
                          <CardContent className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={taxBarData} margin={{ top: 4, right: 8, left: 0, bottom: 24 }} barGap={8}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                                <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(value, { compact: true })} />
                                <RechartsTooltip
                                  cursor={{ fill: "rgba(31,41,55,0.35)" }}
                                  formatter={(value: number, name: string) => {
                                    const label = name === "HeirIncome" ? "Heir income tax" : name;
                                    return [formatCurrency(value), label];
                                  }}
                                  contentStyle={{ backgroundColor: "#111827", borderColor: "#1f2937", color: "#E5E7EB" }}
                                  labelStyle={{ color: "#E5E7EB" }}
                                  itemStyle={{ color: "#E5E7EB" }}
                                />
                                <Legend
                                  verticalAlign="bottom"
                                  align="center"
                                  iconType="square"
                                  formatter={(value: any) => <span className="text-gray-300 text-xs">{value === "HeirIncome" ? "Heir Income Tax" : value}</span>}
                                  wrapperStyle={{ paddingTop: 6 }}
                                />
                                <Bar dataKey="Federal" stackId="a" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="State" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="HeirIncome" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Bottom: Liquidity-related */}
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="bg-gray-950/40 border-gray-800">
                          <CardHeader>
                            <CardTitle className="text-sm font-semibold text-gray-200">Liquidity for settlement</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm text-gray-300">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300">Coverage status</span>
                              <span className={`font-semibold ${activeSummary.liquidity.gap > 0 ? "text-red-300" : "text-emerald-300"}`}>
                                {activeSummary.liquidity.gap > 0 ? `Shortfall ${formatCurrency(activeSummary.liquidity.gap)}` : "Covered"}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded bg-gray-800 overflow-hidden">
                              <div
                                className={`h-2 ${activeSummary.liquidity.gap > 0 ? "bg-red-500/70" : "bg-emerald-500/70"}`}
                                style={{ width: `${Math.min(100, Math.round(liquidityCoverage * 100))}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-gray-300 hover:text-gray-100 cursor-help">Available liquid assets (incl. Roth)</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-gray-800 border-gray-700 text-gray-100 max-w-[320px]">
                                    Includes taxable, Roth, ILIT, and in‑estate life insurance; excludes earmarked charitable bequests.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <span className="text-white">{formatCurrency(activeSummary.liquidity.available)}</span>
                            </div>

                            {/* Liquidity breakdown for clarity */}
                            <div className="flex items-center justify-between">
                              <span>Gross liquidity</span>
                              <span className="text-white">
                                {formatCurrency(Number(activeSummary.liquidity.available || 0) + Number((activeSummary as any).liquidity?.charitableReserve || 0))}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Less: charitable reserve</span>
                              <span className="text-white">{formatCurrency(Number((activeSummary as any).liquidity?.charitableReserve || 0))}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-gray-300 hover:text-gray-100 cursor-help">
                                      Required liquidity ({percentFormatter.format((localAssumptions.liquidityTargetPercent ?? 110) / 100)})
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-gray-800 border-gray-700 text-gray-100 max-w-[320px]">
                                    Target buffer to cover modeled estate taxes and settlement costs without forced asset sales.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <span className="text-white">{formatCurrency(activeSummary.liquidity.required)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Settlement expenses (probate + funeral)</span>
                              <span className="text-white">{formatCurrency(Number((summary as any).liquidity?.settlementExpenses || 0))}</span>
                            </div>
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
                            <CardTitle className="text-sm font-semibold text-gray-200">Liquidity coverage</CardTitle>
                          </CardHeader>
                          <CardContent className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsPieChart>
                                <Pie
                                  data={liquidityPieData}
                                  innerRadius={48}
                                  outerRadius={70}
                                  startAngle={90}
                                  endAngle={-270}
                                  paddingAngle={2}
                                  dataKey="value"
                                  labelLine={false}
                                >
                                  <Cell fill="#10b981" />
                                  <Cell fill="#ef4444" />
                                </Pie>
                                <RechartsTooltip
                                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                                  contentStyle={{ backgroundColor: "#111827", borderColor: "#1f2937", color: "#E5E7EB" }}
                                  labelStyle={{ color: "#E5E7EB" }}
                                  itemStyle={{ color: "#E5E7EB" }}
                                />
                              </RechartsPieChart>
                            </ResponsiveContainer>
                            <div className="mt-3 text-xs text-gray-400">
                              Coverage: {percentFormatter.format(liquidityCoverage)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
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
                      <div className="grid gap-4 md:grid-cols-3">
                        <SummaryTile
                          label="Net Estate (after taxes & other costs)"
                          value={formatCurrency(netAfterAllCosts)}
                          helper={`Change vs baseline${includeRoth ? " (after Roth conversions)" : ""}: ${(netAfterAllCosts - baselineNetAfterAllCosts >= 0 ? "+" : "")}${formatCurrency(netAfterAllCosts - baselineNetAfterAllCosts)}`}
                          accent="emerald"
                        />
                        <SummaryTile
                          label="Estate Taxes"
                          value={formatCurrency(activeSummary.totalTax)}
                          helper={`Change vs baseline${includeRoth ? " (after Roth conversions)" : ""}: ${(activeSummary.totalTax - (estateProjection?.totalTax || 0) >= 0 ? "+" : "")}${formatCurrency(activeSummary.totalTax - (estateProjection?.totalTax || 0))}`}
                          accent="orange"
                        />
                        <SummaryTile
                          label="Liquidity Gap"
                          value={activeSummary.liquidity.gap > 0 ? formatCurrency(activeSummary.liquidity.gap) : "Closed"}
                          helper={`Change vs baseline${includeRoth ? " (after Roth conversions)" : ""}: ${(activeSummary.liquidity.gap - (estateProjection?.liquidity?.gap || 0) >= 0 ? "+" : "")}${formatCurrency(activeSummary.liquidity.gap - (estateProjection?.liquidity?.gap || 0))}`}
                          accent="sky"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          className="bg-purple-600 hover:bg-purple-700"
                          onClick={() => {
                            try {
                              const prospective = calculateEstateProjection({
                                baseEstateValue: projectedEstateValue || estateProjection?.projectedEstateValue || 0,
                                assetComposition,
                                strategies: { ...localStrategies },
                                assumptions: { ...localAssumptions },
                                profile,
                              });
                              const pSettlement = Math.max(0, Number((prospective as any)?.liquidity?.settlementExpenses || 0));
                              const pNetAfterIncome = Math.max(0, Number(prospective?.heirTaxEstimate?.netAfterIncomeTax || 0));
                              const pNetAll = Math.max(0, pNetAfterIncome - pSettlement);

                              const bSettlement = Math.max(0, Number((estateProjection as any)?.liquidity?.settlementExpenses || 0));
                              const bNetAfterIncome = Math.max(0, Number(estateProjection?.heirTaxEstimate?.netAfterIncomeTax || 0));
                              const bNetAll = Math.max(0, bNetAfterIncome - bSettlement);

                              const delta = pNetAll - bNetAll;
                              const t = toast({
                                title: delta >= 0 ? "Net estate to heirs increased" : "Net estate to heirs decreased",
                                description: `${delta >= 0 ? "+" : ""}${formatCurrency(delta)} vs baseline${includeRoth ? " (after Roth conversions)" : ""} (after all taxes & costs)`,
                                variant: delta >= 0 ? "default" : "destructive",
                              });
                              setTimeout(() => t.dismiss(), 3000);
                            } catch {}
                            setCommittedStrategies({ ...localStrategies });
                            setCommittedAssumptions({ ...localAssumptions });
                            isEditingRef.current = false;
                            lastEditAtRef.current = Date.now();
                          }}
                        >
                          Calculate
                        </Button>
                        <span className="text-xs text-gray-400">Updates KPIs, syncs other tabs, and saves.</span>
                      </div>

                      <Separator className="border-gray-800" />
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
                          onFocus={() => { isEditingRef.current = true; lastEditAtRef.current = Date.now(); }}
                          onBlur={() => { isEditingRef.current = false; lastEditAtRef.current = Date.now(); }}
                          onChange={(value) => { lastEditAtRef.current = Date.now(); handleStrategyNumberChange("ilitDeathBenefit", value); }}
                        />
                        <StrategyInput
                          label="Lifetime gifts already made"
                          description="Reduces taxable estate and lifetime exemption."
                          value={localStrategies.lifetimeGifts ?? ""}
                          onFocus={() => { isEditingRef.current = true; lastEditAtRef.current = Date.now(); }}
                          onBlur={() => { isEditingRef.current = false; lastEditAtRef.current = Date.now(); }}
                          onChange={(value) => { lastEditAtRef.current = Date.now(); handleStrategyNumberChange("lifetimeGifts", value); }}
                        />
                        <StrategyInput
                          label="Annual gifting (per year)"
                          description="Modeled at current annual exclusion levels through longevity age."
                          value={localStrategies.annualGiftAmount ?? ""}
                          onFocus={() => { isEditingRef.current = true; lastEditAtRef.current = Date.now(); }}
                          onBlur={() => { isEditingRef.current = false; lastEditAtRef.current = Date.now(); }}
                          onChange={(value) => { lastEditAtRef.current = Date.now(); handleStrategyNumberChange("annualGiftAmount", value); }}
                        />
                        <StrategyInput
                          label="Trust funding"
                          description="Total assets transferred into irrevocable trusts (GRAT, SLAT, etc.)."
                          value={trustFundingPrimary ?? ""}
                          onFocus={() => { isEditingRef.current = true; lastEditAtRef.current = Date.now(); }}
                          onBlur={() => { isEditingRef.current = false; lastEditAtRef.current = Date.now(); }}
                          onChange={(value) => { lastEditAtRef.current = Date.now(); handleStrategyNumberChange("trustFunding", value); }}
                        />
                        <StrategyInput
                          label="Charitable bequest"
                          description="Removes charitably directed assets from taxable estate and highlights legacy impact."
                          value={localStrategies.charitableBequest ?? ""}
                          onFocus={() => { isEditingRef.current = true; lastEditAtRef.current = Date.now(); }}
                          onBlur={() => { isEditingRef.current = false; lastEditAtRef.current = Date.now(); }}
                          onChange={(value) => { lastEditAtRef.current = Date.now(); handleStrategyNumberChange("charitableBequest", value); }}
                        />
                      </div>

                      <Separator className="border-gray-800" />

                      <div className="grid gap-4">
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
                            onPointerDown={() => { isEditingRef.current = true; markEdited(); }}
                            onPointerUp={() => { isEditingRef.current = false; markEdited(); }}
                            onValueCommit={([value]) => { handleAssumptionChange("liquidityTargetPercent", value); }}
                            onValueChange={([value]) => { markEdited(); }}
                          />
                          <p className="mt-3 text-xs text-gray-500">
                            Liquidity required: {formatCurrency(activeSummary.liquidity.required)} · Available today: {formatCurrency(activeSummary.liquidity.available)}
                          </p>
                        </div>
                        {/* Strategy impact check removed per request */}
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

            

            <TabsContent value="documents" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl text-white">Document Checklist & Tasking</CardTitle>
                  <p className="text-sm text-gray-400">
                    Track critical estate documents, review cadences, and outstanding action items to keep the plan enforceable.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-sm text-gray-400">
                    Quick-reference reminders also appear on the Checklist tab.
                  </p>

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

            <TabsContent value="will" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl text-white">Create Your Will (Guided)</CardTitle>
                  <p className="text-sm text-gray-400">
                    A simple, state‑aware Last Will & Testament you can print and sign with witnesses. Electronic wills are not valid in every state.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Executed / action nudges */}
                  {(() => {
                    try {
                      const willDocs = (documents || []).filter((d: any) => String(d.documentType) === 'will' && !d.forSpouse);
                      const executed = willDocs.find((d: any) => String(d.status) === 'executed');
                      if (executed) {
                        return (
                          <div className="rounded-lg border border-emerald-700 bg-emerald-900/20 p-3 text-sm text-emerald-200">
                            Executed will on file{executed.executionDate ? ` (dated ${dateFormatter.format(new Date(executed.executionDate))})` : ''}.
                          </div>
                        );
                      }
                      if (willDocs.length) {
                        return (
                          <div className="rounded-lg border border-amber-700 bg-amber-900/20 p-3 text-sm text-amber-200">
                            Don’t forget to print, sign with two witnesses, and upload the signed PDF in the Checklist.
                          </div>
                        );
                      }
                    } catch {}
                    return null;
                  })()}
                  <WillWizard />
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
  highlight?: boolean;
}

function SummaryTile({ label, value, helper, accent = "default", highlight = false }: SummaryTileProps) {
  const accentColor = {
    emerald: "bg-emerald-500/10 text-emerald-300",
    orange: "bg-orange-500/10 text-orange-300",
    sky: "bg-sky-500/10 text-sky-300",
    default: "bg-purple-500/10 text-purple-200",
  }[accent];

  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-950/40 p-4 ${highlight ? "ring-2 ring-purple-500/40 shadow-lg shadow-purple-500/20" : ""}`}>
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

function StrategyInput({ label, description, value, onChange, onFocus, onBlur }: { label: string; description: string; value: string | number; onChange: (value: number) => void; onFocus?: () => void; onBlur?: () => void }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 space-y-2">
      <div className="space-y-1">
        <Label className="text-sm text-white">{label}</Label>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <Input
        type="text"
        inputMode="numeric"
        className="bg-gray-900/60 border-gray-700 text-sm text-white"
        value={String(value ?? "")}
        onFocus={onFocus}
        onChange={(event) => onChange(parseNumericInput(event.target.value))}
        onKeyDown={(e) => {
          const inc = (mult: number) => onChange((Number(value) || 0) + mult);
          if (e.key === 'ArrowUp') { e.preventDefault(); inc(e.shiftKey ? 10000 : 1000); }
          if (e.key === 'ArrowDown') { e.preventDefault(); inc(e.shiftKey ? -10000 : -1000); }
        }}
        onBlur={() => { onBlur?.(); }}
        placeholder="0"
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

  // --- Will Creator Wizard (MVP) ---
  function StateDetailsButton({ stateCode }: { stateCode: string }) {
    const [open, setOpen] = useState(false);
    let rules: any = undefined;
    try {
      const mod = require('@/lib/estate-new/will-rules');
      rules = mod.getWillRules?.(stateCode);
    } catch {}
    return (
      <>
        <Button variant="outline" className="border-gray-700 text-gray-200" onClick={()=>setOpen(true)}>State details</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-gray-900 border-gray-700 text-gray-200 max-w-lg">
            <DialogHeader>
              <DialogTitle>Signing details for {stateCode || 'your state'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p>Typical witness requirement: <span className="text-white font-medium">{rules?.witnessCount ?? 2}</span> witnesses.</p>
              <p>Self‑proving affidavit: <span className="text-white font-medium">{rules?.allowSelfProving ? 'generally available' : 'not typically available'}</span>.</p>
              {rules?.notes && <p className="text-amber-300">Note: {rules.notes}</p>}
              {rules?.tip && <p className="text-gray-300">Tip: {rules.tip}</p>}
              {rules?.citationUrl && (
                <p>
                  <a className="text-teal-300 underline" href={rules.citationUrl} target="_blank" rel="noreferrer">Reference</a>
                </p>
              )}
              <p className="text-gray-400 text-xs pt-2">This guidance is informational and not legal advice. Always follow your local statute and clerk guidance.</p>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  function WillWizard() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [step, setStep] = useState<number>(1);
    const maxStep = 4;

    // Inputs
    const [testatorName, setTestatorName] = useState<string>("");
    const [maritalStatus, setMaritalStatus] = useState<string>("single");
    const [spouseName, setSpouseName] = useState<string>("");
    const [stateCode, setStateCode] = useState<string>(String((typeof window !== 'undefined' ? (window as any).PROFILE_STATE : '') || ''));
    const [executorName, setExecutorName] = useState<string>("");
    const [altExecutorName, setAltExecutorName] = useState<string>("");
    const [guardianName, setGuardianName] = useState<string>("");
    const [altGuardianName, setAltGuardianName] = useState<string>("");
    const [specificBequests, setSpecificBequests] = useState<string>("");
    const [bequests, setBequests] = useState<Array<{ description: string; beneficiary: string; amount?: string }>>([
      { description: "", beneficiary: "", amount: "" }
    ]);
    const [resParts, setResParts] = useState<Array<{ beneficiary: string; percent: string }>>([
      { beneficiary: "Spouse or partner", percent: "100" }
    ]);
    const [survivorshipDays, setSurvivorshipDays] = useState<number>(30);
    const [noContest, setNoContest] = useState<boolean>(false);
    const [petGuardian, setPetGuardian] = useState<string>("");
    const [funeralPrefs, setFuneralPrefs] = useState<string>("");
    const [residuaryPlan, setResiduaryPlan] = useState<string>("All to my spouse, or if not living, to my children in equal shares.");

    useEffect(() => {
      try {
        const p = (JSON.parse(sessionStorage.getItem('affluvia_profile_cache') || 'null')) || {};
        if (!testatorName && p.firstName && p.lastName) setTestatorName(`${p.firstName} ${p.lastName}`);
        if (!stateCode && p.state) setStateCode(String(p.state));
        if (p.maritalStatus) setMaritalStatus(String(p.maritalStatus).toLowerCase());
        if (p.spouseName) setSpouseName(String(p.spouseName));
      } catch {}
    }, []);

    const generateMutation = useMutation({
      mutationFn: async () => {
        // Compose structured bequests into text if present
        let beqText = specificBequests?.trim() || "";
        const normalized = (bequests || []).filter(b => (b.description || b.beneficiary || b.amount));
        if (normalized.length) {
          const bullets = normalized.map(b => `• ${b.description || 'Item'} to ${b.beneficiary || '—'}${b.amount ? ` (${b.amount})` : ''}`);
          beqText = [beqText, bullets.join('\n')].filter(Boolean).join('\n');
        }
        // Compose residuary from parts if valid
        const parts = (resParts || []).filter(p => p.beneficiary && p.percent !== "");
        let residuaryText = residuaryPlan;
        if (parts.length) {
          residuaryText = parts.map(p => `${p.percent}% to ${p.beneficiary}`).join('; ');
        }
        const res = await fetch('/api/estate/will/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            inputs: { testatorName, maritalStatus, spouseName, state: stateCode, executorName, altExecutorName, guardianName, altGuardianName, specificBequests: beqText, residuaryPlan: residuaryText, survivorshipDays, noContest, petGuardian, funeralPrefs }
          })
        });
        if (!res.ok) throw new Error('Failed to generate will');
        return res.json();
      },
      onSuccess: (data: any) => {
        toast({ title: 'Will generated', description: 'Download your documents and follow signing instructions.' });
        queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
        setStep(maxStep);
        setLinks({ will: data?.willDocxUrl, willPdf: data?.willPdfUrl, affidavit: data?.affidavitDocxUrl, affidavitPdf: data?.affidavitPdfUrl, cover: data?.coverSheetPdfUrl });
      },
      onError: () => toast({ title: 'Generation failed', variant: 'destructive' })
    });

    const [links, setLinks] = useState<{ will?: string; willPdf?: string; affidavit?: string; affidavitPdf?: string }>({});

    const StepHeader = (
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-300">Step {step} of {maxStep}</div>
        <div className="flex gap-2">
          {Array.from({ length: maxStep }).map((_, i) => (
            <div key={i} className={`h-1.5 w-12 rounded ${i < step ? 'bg-purple-500' : 'bg-gray-700'}`} />
          ))}
        </div>
      </div>
    );

    // Compute state rules for instructions
    let rules: any = undefined;
    try {
      // Lazy import to keep bundle lean
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('@/lib/estate-new/will-rules');
      rules = mod.getWillRules?.(stateCode);
    } catch {}

    return (
      <div className="space-y-4">
        {StepHeader}

        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-white">Your full name</Label>
              <Input value={testatorName} onChange={(e) => setTestatorName(e.target.value)} placeholder="Full legal name" className="bg-gray-900/60 border-gray-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white">State</Label>
              <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="e.g., CA" className="bg-gray-900/60 border-gray-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Marital status</Label>
              <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                <SelectTrigger className="bg-gray-900/60 border-gray-700 text-white">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="single" className="text-white">Single</SelectItem>
                  <SelectItem value="married" className="text-white">Married</SelectItem>
                  <SelectItem value="partnered" className="text-white">Partnered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {maritalStatus === 'married' && (
              <div className="space-y-2">
                <Label className="text-white">Spouse name</Label>
                <Input value={spouseName} onChange={(e) => setSpouseName(e.target.value)} placeholder="Spouse full name" className="bg-gray-900/60 border-gray-700 text-white" />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-white">Executor</Label>
              <Input value={executorName} onChange={(e) => setExecutorName(e.target.value)} placeholder="Executor full name" className="bg-gray-900/60 border-gray-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Alternate executor (optional)</Label>
              <Input value={altExecutorName} onChange={(e) => setAltExecutorName(e.target.value)} placeholder="Alternate executor full name" className="bg-gray-900/60 border-gray-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Guardian (if minors)</Label>
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Guardian full name" className="bg-gray-900/60 border-gray-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Alternate guardian (optional)</Label>
              <Input value={altGuardianName} onChange={(e) => setAltGuardianName(e.target.value)} placeholder="Alternate guardian full name" className="bg-gray-900/60 border-gray-700 text-white" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label className="text-white">Specific gifts (optional)</Label>
              <Textarea value={specificBequests} onChange={(e) => setSpecificBequests(e.target.value)} placeholder={'Example:\n• My watch to Alex.\n• $5,000 to Local Charity.'} className="bg-gray-900/60 border-gray-700 text-white min-h-[120px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Structured gifts (optional)</Label>
              <div className="space-y-2">
                {bequests.map((b, idx) => (
                  <div key={idx} className="grid gap-2 md:grid-cols-3">
                    <Input value={b.description} onChange={(e)=>{
                      const v=[...bequests]; v[idx]={...v[idx],description:e.target.value}; setBequests(v);
                    }} placeholder="Description (e.g., Rolex watch)" className="bg-gray-900/60 border-gray-700 text-white" />
                    <Input value={b.beneficiary} onChange={(e)=>{
                      const v=[...bequests]; v[idx]={...v[idx],beneficiary:e.target.value}; setBequests(v);
                    }} placeholder="Beneficiary" className="bg-gray-900/60 border-gray-700 text-white" />
                    <Input value={b.amount} onChange={(e)=>{
                      const v=[...bequests]; v[idx]={...v[idx],amount:e.target.value}; setBequests(v);
                    }} placeholder="Amount/Notes (optional)" className="bg-gray-900/60 border-gray-700 text-white" />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" className="border-gray-700 text-gray-200" onClick={()=> setBequests([...bequests, {description:'',beneficiary:'',amount:''}])}>Add another</Button>
                  {bequests.length>1 && (
                    <Button variant="outline" className="border-gray-700 text-gray-200" onClick={()=> setBequests(bequests.slice(0,-1))}>Remove last</Button>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Residuary plan</Label>
              <Textarea value={residuaryPlan} onChange={(e) => setResiduaryPlan(e.target.value)} className="bg-gray-900/60 border-gray-700 text-white min-h-[80px]" />
              <div className="space-y-2">
                <Label className="text-gray-300">Structured residuary (optional)</Label>
                {resParts.map((p, idx) => (
                  <div key={idx} className="grid gap-2 md:grid-cols-3">
                    <Input value={p.beneficiary} onChange={(e)=>{ const v=[...resParts]; v[idx]={...v[idx], beneficiary:e.target.value}; setResParts(v); }} placeholder="Beneficiary" className="bg-gray-900/60 border-gray-700 text-white" />
                    <Input value={p.percent} onChange={(e)=>{ const v=[...resParts]; v[idx]={...v[idx], percent:e.target.value.replace(/[^0-9.]/g,'')}; setResParts(v); }} placeholder="Percent" className="bg-gray-900/60 border-gray-700 text-white" />
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="border-gray-700 text-gray-200" onClick={()=> setResParts([...resParts, { beneficiary:'', percent:'' }])}>Add</Button>
                      {resParts.length>1 && <Button variant="outline" className="border-gray-700 text-gray-200" onClick={()=> setResParts(resParts.slice(0,-1))}>Remove</Button>}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400">Percentages must total 100% if using structured residuary.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white">Survivorship period (days)</Label>
                <Input type="number" inputMode="numeric" value={String(survivorshipDays)} onChange={(e)=> setSurvivorshipDays(Math.max(0, Number(e.target.value||0)))} className="bg-gray-900/60 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-white">No‑contest clause</Label>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" className="accent-purple-500" checked={noContest} onChange={(e)=> setNoContest(e.target.checked)} />
                  <span>Include a no‑contest clause</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Pet guardian (optional)</Label>
                <Input value={petGuardian} onChange={(e)=> setPetGuardian(e.target.value)} placeholder="Pet guardian name" className="bg-gray-900/60 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Funeral preferences (optional)</Label>
                <Textarea value={funeralPrefs} onChange={(e)=> setFuneralPrefs(e.target.value)} placeholder="Burial/cremation preferences, ceremony wishes, etc." className="bg-gray-900/60 border-gray-700 text-white min-h-[80px]" />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
              <p className="text-sm text-gray-300">Review summary</p>
              <ul className="mt-2 text-sm text-gray-400 space-y-1">
                <li><strong>Name:</strong> {testatorName || '—'}</li>
                <li><strong>State:</strong> {stateCode || '—'}</li>
                <li><strong>Marital status:</strong> {maritalStatus}</li>
                {spouseName && <li><strong>Spouse:</strong> {spouseName}</li>}
                <li><strong>Executor:</strong> {executorName || '—'}</li>
                <li><strong>Guardian:</strong> {guardianName || '—'}</li>
                {rules && (
                  <li className="pt-1 text-amber-300">
                    Typical signing: {rules.witnessCount} witnesses; self‑proving affidavit {rules.allowSelfProving ? 'available' : 'not available'}{rules.notes ? ` — ${rules.notes}` : ''}.
                  </li>
                )}
                {rules?.tip && (<li className="text-xs text-gray-400">Tip: {rules.tip}</li>)}
              </ul>
            </div>
            <div className="text-xs text-gray-500">
              This tool is not a law firm and does not provide legal advice. Signing rules vary by state; many states require two witnesses, and a notarized self‑proving affidavit is optional but helpful. Electronic wills may not be valid in your state.
            </div>
            <div className="flex items-center gap-3">
              <Button className="bg-purple-600 hover:bg-purple-700" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
                {generateMutation.isPending ? 'Generating…' : 'Generate Will Packet'}
              </Button>
              <StateDetailsButton stateCode={stateCode} />
              {(() => {
                const RON_ENABLED = Boolean((import.meta as any).env?.VITE_RON_ENABLED);
                if (RON_ENABLED && rules?.allowSelfProving) {
                  return (
                    <a className="text-xs text-purple-300 underline" href="https://app.proof.com/signup/upload" target="_blank" rel="noreferrer">
                      Start remote notarization (if permitted)
                    </a>
                  );
                }
                return null;
              })()}
              {links.will && <a className="text-sm text-teal-300 underline" href={links.will} target="_blank" rel="noreferrer">Will (DOCX)</a>}
              {links.willPdf && <a className="text-sm text-teal-300 underline" href={links.willPdf} target="_blank" rel="noreferrer">Will (PDF)</a>}
              {links.affidavit && <a className="text-sm text-teal-300 underline" href={links.affidavit} target="_blank" rel="noreferrer">Affidavit (DOCX)</a>}
              {links.affidavitPdf && <a className="text-sm text-teal-300 underline" href={links.affidavitPdf} target="_blank" rel="noreferrer">Affidavit (PDF)</a>}
              {links.cover && <a className="text-sm text-teal-300 underline" href={links.cover} target="_blank" rel="noreferrer">Signing checklist (PDF)</a>}
            </div>
          </div>
        )}

        <WizardNav
          step={step}
          setStep={setStep}
          maxStep={maxStep}
          canNext={validateWillStep(step)}
        />
      </div>
    );

    function validateWillStep(current: number): boolean {
      if (current === 1) return Boolean(testatorName) && Boolean(stateCode);
      if (current === 2) return Boolean(executorName);
      if (current === 3) {
        // If structured residuary used, ensure total 100
        const parts = (resParts || []).filter(p => p.beneficiary && p.percent !== "");
        if (!parts.length) return true; // fallback to free text
        const total = parts.reduce((s, p) => s + (parseFloat(p.percent) || 0), 0);
        return Math.abs(total - 100) < 0.01;
      }
      return true;
    }
  }

  function WizardNav({ step, setStep, maxStep, canNext }: { step: number; setStep: (n: number)=>void; maxStep: number; canNext: boolean }) {
    return (
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" disabled={step <= 1} onClick={() => setStep(Math.max(1, step - 1))}>Back</Button>
        <div className="flex items-center gap-2">
          {step < maxStep && (
            <Button disabled={!canNext} onClick={() => setStep(Math.min(maxStep, step + 1))}>Next</Button>
          )}
        </div>
      </div>
    );
  }

  // Upload executed will (Checklist helper)
  function WillUploadInline({ docId, documentType = 'will' }: { docId?: number; documentType?: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [pending, setPending] = useState(false);
    const [notarized, setNotarized] = useState(false);
    const [execDate, setExecDate] = useState<string>("");
    const [w1, setW1] = useState('');
    const [w2, setW2] = useState('');
    const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type !== 'application/pdf') {
        toast({ title: 'Please upload a PDF', variant: 'destructive' });
        return;
      }
      const fd = new FormData();
      fd.append('document', file);
      fd.append('documentType', documentType);
      if (docId) fd.append('documentId', String(docId));
      fd.append('notarized', String(notarized));
      const witnesses = [w1, w2].filter(Boolean).map(n => ({ name: n }));
      if (witnesses.length) fd.append('witnesses', JSON.stringify(witnesses));
      if (execDate) fd.append('executionDate', execDate);
      setPending(true);
      try {
        const res = await fetch('/api/estate-documents/upload', { method: 'POST', credentials: 'include', body: fd });
        if (!res.ok) throw new Error('Upload failed');
        toast({ title: 'Executed document saved' });
        queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
      } catch (err) {
        toast({ title: 'Upload failed', variant: 'destructive' });
      } finally {
        setPending(false);
        e.currentTarget.value = '';
      }
    };
    return (
      <div className="text-xs text-gray-400 flex items-center gap-2">
        <label className="cursor-pointer inline-flex items-center gap-2">
          <span className="underline">Upload signed PDF</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={onChange} disabled={pending} />
        </label>
        <span className="inline-flex items-center gap-1">
          <input type="checkbox" className="accent-purple-500" checked={notarized} onChange={(e)=>setNotarized(e.target.checked)} />
          <span>Notarized</span>
        </span>
        <input value={w1} onChange={(e)=>setW1(e.target.value)} placeholder="Witness 1" className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-gray-200" />
        <input value={w2} onChange={(e)=>setW2(e.target.value)} placeholder="Witness 2" className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-gray-200" />
        <input type="date" value={execDate} onChange={(e)=>setExecDate(e.target.value)} className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-gray-200" />
        {pending && <span>Uploading…</span>}
      </div>
    );
  }
const numericSanitizer = /[^0-9.-]/g;
function parseNumericInput(value: string): number {
  if (value == null) return NaN;
  const trimmed = String(value).trim();
  if (trimmed === "") return NaN; // allow empty while editing
  const parsed = Number(trimmed.replace(numericSanitizer, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}
  
