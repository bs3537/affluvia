import { useEffect, useMemo, useState } from "react";
import { useEstatePlanningNew } from "@/hooks/useEstatePlanningNew";
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
  Workflow
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

export function EstatePlanningNewCenter() {
  const {
    profile,
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
  } = useEstatePlanningNew();

  const [activeTab, setActiveTab] = useState("overview");
  const [localStrategies, setLocalStrategies] = useState<EstateStrategyInputs>(strategies);
  const [localAssumptions, setLocalAssumptions] = useState<EstateAssumptionInputs>(assumptions);

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

  const taxPieData = summary
    ? [
        { name: "Net to Heirs", value: Math.max(0, summary.netToHeirs) },
        { name: "Estate Taxes", value: Math.max(0, summary.totalTax) },
        { name: "Charitable Gifts", value: Math.max(0, summary.charitableImpact.charitableBequests) },
        { name: "Income Tax Drag", value: Math.max(0, summary.heirTaxEstimate.projectedIncomeTax) },
      ]
    : [];

  const taxBarData = summary
    ? [
        {
          name: "Taxes",
          Federal: summary.federalTax,
          State: summary.stateTax,
          LiquidityGap: summary.liquidity.gap,
        },
      ]
    : [];

  const trustFundingTotal = useMemo(() => {
    return (localStrategies.trustFunding || []).reduce((total, trust) => total + (Number(trust?.amount) || 0), 0);
  }, [localStrategies.trustFunding]);

  const liquidityStatusBadge = summary
    ? summary.liquidity.gap > 0
      ? { variant: "destructive" as const, label: `${formatCurrency(summary.liquidity.gap)} gap` }
      : { variant: "default" as const, label: "Liquidity covered" }
    : null;

  const probabilityLabel = monteCarlo?.successProbability !== undefined
    ? percentFormatter.format(monteCarlo.successProbability)
    : "—";

  const handleStrategyNumberChange = (key: keyof EstateStrategyInputs, value: number) => {
    setLocalStrategies((prev) => {
      const next = { ...prev } as EstateStrategyInputs;
      if (key === "trustFunding") {
        next.trustFunding = value > 0 ? [{ label: "Modeled Trust Funding", amount: value }] : undefined;
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

  const reportSummary = summary
    ? [
        `Projected estate value at death: ${formatCurrency(summary.projectedEstateValue)}`,
        `Estimated estate taxes: ${formatCurrency(summary.totalTax)} (${formatPercent(summary.effectiveTaxRate)})`,
        `Net inheritance for beneficiaries: ${formatCurrency(summary.netToHeirs)}`,
        summary.liquidity.gap > 0
          ? `Liquidity shortfall of ${formatCurrency(summary.liquidity.gap)} detected for estate settlement.`
          : "Liquidity target met for projected estate obligations.",
        summary.heirTaxEstimate.taxDeferredBalance > 0
          ? `Heirs may owe approximately ${formatCurrency(summary.heirTaxEstimate.projectedIncomeTax)} in income taxes on inherited tax-deferred accounts.`
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
            <CardTitle className="text-3xl text-white">Estate Planning New</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {liquidityStatusBadge && (
              <Badge variant={liquidityStatusBadge.variant}>{liquidityStatusBadge.label}</Badge>
            )}
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
                { id: "projections", label: "Retirement Projections", icon: Workflow },
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
                  {summary && (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                      {probabilityLabel} retirement success probability
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading && !summary ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-28 rounded-xl bg-gray-800/60 animate-pulse" />
                      ))}
                    </div>
                  ) : summary ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryTile
                        label="Projected Estate"
                        value={formatCurrency(summary.projectedEstateValue, { compact: false, decimals: 0 })}
                        helper={`Modeled at age ${summary.assumptions.deathAge}`}
                      />
                      <SummaryTile
                        label="Net to Heirs"
                        value={formatCurrency(summary.netToHeirs)}
                        helper="After estate tax impact"
                        accent="emerald"
                      />
                      <SummaryTile
                        label="Estate Taxes"
                        value={formatCurrency(summary.totalTax)}
                        helper={`Effective rate ${formatPercent(summary.effectiveTaxRate)}`}
                        accent="orange"
                      />
                      <SummaryTile
                        label="After Heir Income Tax"
                        value={formatCurrency(summary.heirTaxEstimate.netAfterIncomeTax)}
                        helper={`Assumes ${percentFormatter.format(summary.heirTaxEstimate.assumedRate)} heir tax`}
                        accent="sky"
                      />
                    </div>
                  ) : (
                    <p className="text-gray-400">No estate projection available. Complete your financial profile to unlock insights.</p>
                  )}

                  {summary && (
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
                              >
                                {taxPieData.map((entry, index) => (
                                  <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                formatter={(val: number) => formatCurrency(val)}
                                contentStyle={{
                                  backgroundColor: "#111827",
                                  borderColor: "#1f2937",
                                  color: "#E5E7EB",
                                }}
                              />
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
                          <CardTitle className="text-white text-lg">Key Assumptions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-gray-300">
                          <AssumptionRow label="Year of death" value={summary.assumptions.yearOfDeath} />
                          <AssumptionRow label="State" value={summary.assumptions.state || "Not set"} />
                          <AssumptionRow
                            label="Federal exemption applied"
                            value={formatCurrency(summary.assumptions.federalExemption)}
                          />
                          <AssumptionRow
                            label="State exemption"
                            value={summary.assumptions.stateExemption ? formatCurrency(summary.assumptions.stateExemption) : "No state estate tax"}
                          />
                          <AssumptionRow
                            label="Liquidity target"
                            value={percentFormatter.format((localAssumptions.liquidityTargetPercent ?? 110) / 100)}
                          />
                          <AssumptionRow label="Portability" value={summary.assumptions.portability ? "Enabled" : "Disabled"} />
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="projections" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl text-white">Retirement & Legacy Alignment</CardTitle>
                  <p className="text-sm text-gray-400">
                    Pulls from Monte Carlo retirement projections to anchor estate values at the expected longevity age.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricTile
                      label="Longevity Age"
                      icon={Sparkles}
                      value={localAssumptions.projectedDeathAge || monteCarlo?.longevityAge || "—"}
                      helper="Adjust projected death age to test legacy outcomes."
                    />
                    <MetricTile
                      label="Retirement Success"
                      icon={CheckCircle2}
                      value={probabilityLabel}
                      helper="Monte Carlo success probability"
                    />
                    <MetricTile
                      label="Median Ending Portfolio"
                      icon={Briefcase}
                      value={formatCurrency(monteCarlo?.medianEndingBalance)}
                      helper="Excludes real estate and trust transfers"
                    />
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-300">Projected death age</p>
                        <p className="text-2xl font-semibold text-white">{localAssumptions.projectedDeathAge ?? monteCarlo?.longevityAge ?? "—"}</p>
                      </div>
                      <div className="text-xs text-gray-400">
                        Modeled from current age {(localAssumptions.currentAge ?? profile?.currentAge ?? 55)} to longevity
                      </div>
                    </div>
                    <Slider
                      defaultValue={[localAssumptions.projectedDeathAge ?? monteCarlo?.longevityAge ?? 90]}
                      min={(localAssumptions.currentAge ?? profile?.currentAge ?? 55) + 5}
                      max={110}
                      step={1}
                      onValueChange={([value]) => handleAssumptionChange("projectedDeathAge", value)}
                    />
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Median estate build-up</h3>
                    {Array.isArray(monteCarlo?.yearlyCashFlows) ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={monteCarlo?.yearlyCashFlows?.slice?.(0, 25) || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis
                            dataKey="age"
                            stroke="#9CA3AF"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value) => (value ? `${value}` : "")}
                          />
                          <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(value, { compact: true })} />
                          <RechartsTooltip
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(label) => `Age ${label}`}
                            contentStyle={{
                              backgroundColor: "#111827",
                              borderColor: "#1f2937",
                              color: "#E5E7EB",
                            }}
                          />
                          <Bar dataKey="portfolioValue" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Run retirement Monte Carlo analyses to unlock median balance trajectories and integrate them into estate outcomes.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tax" className="space-y-4">
              <Card className="bg-gray-900/40 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Estate Tax Outlook</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {summary ? (
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
                            <td className="px-4 py-3 text-right text-white">{formatCurrency(summary.projectedEstateValue)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">Includes appreciation, net of gifts & trust funding</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-200">Taxable estate</td>
                            <td className="px-4 py-3 text-right text-white">{formatCurrency(summary.projectedTaxableEstate)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">After deductions and charitable adjustments</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-200">Federal estate tax</td>
                            <td className="px-4 py-3 text-right text-orange-300">{formatCurrency(summary.federalTax)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">
                              Exemption applied: {formatCurrency(summary.assumptions.federalExemption)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-200">State estate/inheritance tax</td>
                            <td className="px-4 py-3 text-right text-orange-300">{formatCurrency(summary.stateTax)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">
                              Based on {summary.assumptions.state || "residence"} thresholds
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
                            <span className="text-white">{formatCurrency(summary.liquidity.available)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Required liquidity ({percentFormatter.format((localAssumptions.liquidityTargetPercent ?? 110) / 100)})</span>
                            <span className="text-white">{formatCurrency(summary.liquidity.required)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Insurance need</span>
                            <span className="text-white">{formatCurrency(summary.liquidity.insuranceNeed)}</span>
                          </div>
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
                            Liquidity required: {formatCurrency(summary.liquidity.required)} · Available today: {formatCurrency(summary.liquidity.available)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                          <h3 className="text-sm font-semibold text-gray-200 mb-3">Strategy impact check</h3>
                          <ul className="space-y-2 text-sm text-gray-300">
                            <li className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-purple-400" />
                              Net to heirs {summary.netToHeirs >= (estateProjection?.netToHeirs || 0) ? "increased" : "changed"} to {formatCurrency(summary.netToHeirs)}
                            </li>
                            <li className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-purple-400" />
                              Estate tax liability now {formatCurrency(summary.totalTax)}
                            </li>
                            <li className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-purple-400" />
                              Liquidity gap {summary.liquidity.gap > 0 ? `is ${formatCurrency(summary.liquidity.gap)}` : "closed"}
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
                      <FlowNode label="Client Estate" amount={summary ? formatCurrency(summary.projectedEstateValue) : "—"} />
                      <ArrowRight className="h-4 w-4 text-purple-400 self-center" />
                      <FlowNode
                        label="Surviving spouse / trusts"
                        amount={summary ? formatCurrency(summary.netToHeirs - summary.heirTaxEstimate.projectedIncomeTax) : "—"}
                      />
                      <ArrowRight className="h-4 w-4 text-purple-400 self-center" />
                      <FlowNode label="Final heirs / charity" amount={summary ? formatCurrency(summary.heirTaxEstimate.netAfterIncomeTax) : "—"} />
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
                        {summary && summary.liquidity.gap > 0 ? (
                          <p>
                            Liquidity shortfall projected. Consider layering survivorship life insurance or earmarking brokerage assets to cover {formatCurrency(summary.liquidity.gap)} in expected settlement costs.
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
