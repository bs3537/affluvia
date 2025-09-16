import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const STRATEGIES = [
  { value: "conservative", label: "Conservative" },
  { value: "mod-conservative", label: "Moderately Conservative" },
  { value: "balanced", label: "Balanced" },
  { value: "mod-aggressive", label: "Moderately Aggressive" },
  { value: "aggressive", label: "Aggressive" },
  { value: "glide", label: "Age-Based Glide Path" }
] as const;

type StrategyValue = (typeof STRATEGIES)[number]["value"];

type OptimizerDefaults = {
  strategy?: string | null;
  tuitionInflation?: number | null; // percent
  annualScholarships?: number | null;
  extraYearProbability?: number | null; // percent
  maxMonthlyContribution?: number | null;
  maxLoanPerYear?: number | null;
  monthlyContribution?: number | null;
  loanPerYear?: number | null;
};

type OptimizerCaps = {
  maxMonthlyContribution: number;
  maxLoanPerYear: number;
};

export type OptimizerSavePayload = {
  controls: {
    strategy: StrategyValue;
    targetSuccess: number;
    maxMonthlyContribution: number;
    maxLoanPerYear: number;
    tuitionInflation: number;
    annualScholarships: number;
    extraYearProbability: number;
  };
  result: any;
};

type Props = {
  goalId: number | string;
  defaults: OptimizerDefaults;
  caps: OptimizerCaps;
  affordabilityHint?: {
    monthlyPaymentLimit: number;
    impliedMaxTotalLoan: number;
    impliedMaxLoanPerYear: number;
    termYears: number;
    ratePct: number;
    constraintsUsed?: { burden: number | null; dtiRoom: number | null; surplus: number | null };
    // Typical private loan scenario
    privateRatePct?: number;
    privateTermYears?: number;
    impliedMaxTotalLoanPrivate?: number;
    impliedMaxLoanPerYearPrivate?: number;
  };
  latestResult?: any;
  onOptimized: (result: any) => void;
  onSave?: (payload: OptimizerSavePayload) => Promise<void> | void;
  isSaving?: boolean;
};

export function EducationOptimizerForm({ goalId, defaults, caps, affordabilityHint, latestResult, onOptimized, onSave, isSaving }: Props) {
  const [strategy, setStrategy] = React.useState<StrategyValue>(() => {
    const preset = defaults.strategy?.toLowerCase() as StrategyValue | undefined;
    return STRATEGIES.some((s) => s.value === preset) ? preset! : "balanced";
  });
  const [maxMonthly, setMaxMonthly] = React.useState<number>(
    defaults.maxMonthlyContribution ?? caps.maxMonthlyContribution
  );
  const [maxLoan, setMaxLoan] = React.useState<number>(
    defaults.maxLoanPerYear ?? caps.maxLoanPerYear
  );
  const [targetSuccess, setTargetSuccess] = React.useState<number>(80);
  const [tuitionInflation, setTuitionInflation] = React.useState<number>(defaults.tuitionInflation ?? 2.4);
  const [annualScholarships, setAnnualScholarships] = React.useState<number>(defaults.annualScholarships ?? 0);
  const [extraYearProbability, setExtraYearProbability] = React.useState<number>(defaults.extraYearProbability ?? 0);
  const [preferLowerLoans, setPreferLowerLoans] = React.useState<boolean>(true);
  const [preferLowerMonthly, setPreferLowerMonthly] = React.useState<boolean>(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [saveDone, setSaveDone] = React.useState(false);

  const constraintBreakdown = React.useMemo(() => {
    if (!affordabilityHint?.constraintsUsed) return null as null | {
      bindingLabel: string;
      bindingKeys: Array<'burden' | 'dtiRoom' | 'surplus'>;
      burden?: number | null;
      dtiRoom?: number | null;
      surplus?: number | null;
    };
    const { burden, dtiRoom, surplus } = affordabilityHint.constraintsUsed;
    const candidates: Array<{ key: 'burden' | 'dtiRoom' | 'surplus'; label: string; value: number }> = [];
    if (typeof burden === 'number' && isFinite(burden) && burden > 0) candidates.push({ key: 'burden', label: 'Payment burden (10%)', value: burden });
    if (typeof dtiRoom === 'number' && isFinite(dtiRoom)) candidates.push({ key: 'dtiRoom', label: 'DTI room (43%)', value: Math.max(0, dtiRoom) });
    if (typeof surplus === 'number' && isFinite(surplus)) candidates.push({ key: 'surplus', label: 'Cash-flow surplus', value: Math.max(0, surplus) });
    if (candidates.length === 0) return null;
    const minVal = Math.min(...candidates.map(c => c.value));
    const bindingItems = candidates.filter(c => Math.abs(c.value - minVal) < 1e-6);
    const binding = bindingItems.map(c => c.label).join(' & ');
    return { bindingLabel: binding || 'N/A', bindingKeys: bindingItems.map(b => b.key), burden: burden ?? null, dtiRoom: dtiRoom ?? null, surplus: surplus ?? null };
  }, [affordabilityHint]);

  // Initialize from defaults when they load, without clobbering live edits
  React.useEffect(() => {
    // Initialize from incoming defaults when they change (avoid clobbering user edits)
    const preset = defaults.strategy?.toLowerCase() as StrategyValue | undefined;
    if (preset && STRATEGIES.some((s) => s.value === preset)) {
      setStrategy(preset);
    }

    if (typeof defaults.tuitionInflation === "number") {
      setTuitionInflation(defaults.tuitionInflation);
    }
    if (typeof defaults.annualScholarships === "number") {
      setAnnualScholarships(defaults.annualScholarships);
    }
    if (typeof defaults.extraYearProbability === "number") {
      setExtraYearProbability(defaults.extraYearProbability);
    }
    if (typeof defaults.maxMonthlyContribution === "number") {
      setMaxMonthly(defaults.maxMonthlyContribution);
    } else if (defaults.maxMonthlyContribution == null) {
      setMaxMonthly(caps.maxMonthlyContribution);
    }
    if (typeof defaults.maxLoanPerYear === "number") {
      setMaxLoan(defaults.maxLoanPerYear);
    } else if (defaults.maxLoanPerYear == null) {
      setMaxLoan(caps.maxLoanPerYear);
    }
  }, [
    goalId,
    defaults.strategy,
    defaults.tuitionInflation,
    defaults.annualScholarships,
    defaults.extraYearProbability,
    defaults.maxMonthlyContribution,
    defaults.maxLoanPerYear,
    caps.maxMonthlyContribution,
    caps.maxLoanPerYear
  ]);

  React.useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  // Reset saved state when goal changes or a new optimization result is produced
  React.useEffect(() => {
    setSaveDone(false);
  }, [goalId, latestResult]);

  const handleOptimization = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/education/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId,
          constraints: {
            maxMonthlyContribution: Number.isFinite(maxMonthly) ? maxMonthly : caps.maxMonthlyContribution,
            maxLoanPerYear: Number.isFinite(maxLoan) ? maxLoan : caps.maxLoanPerYear,
            preferLowerLoans,
            preferLowerMonthly
          },
          overrides: {
            strategy,
            tuitionInflation: Number(tuitionInflation) / 100,
            annualScholarships: Math.max(0, Number(annualScholarships) || 0),
            extraYearProbability: Math.max(0, Number(extraYearProbability) || 0) / 100
          },
          targetSuccessRate: Number.isFinite(targetSuccess) ? targetSuccess : 80
        })
      });

      if (!response.ok) {
        throw new Error(`Optimization failed with status ${response.status}`);
      }

      const result = await response.json();
      onOptimized(result);
      toast.success(`Optimized plan ready: ${result.probabilityOfSuccess?.toFixed?.(1) ?? result.probabilityOfSuccess}% success probability`);
    } catch (error) {
      console.error("Failed to optimize education goal", error);
      toast.error("Unable to optimize education funding right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!onSave || !latestResult) return;
    const payload: OptimizerSavePayload = {
      controls: {
        strategy,
        targetSuccess,
        maxMonthlyContribution: maxMonthly,
        maxLoanPerYear: maxLoan,
        tuitionInflation,
        annualScholarships,
        extraYearProbability,
      },
      result: latestResult,
    };
    try {
      await onSave(payload);
      setSaveDone(true);
    } catch (e) {
      setSaveDone(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-gray-400">Investment Strategy</label>
          <Select value={strategy} onValueChange={(value) => { setStrategy(value as StrategyValue); setSaveDone(false); }}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border border-gray-700">
              {STRATEGIES.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-white">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-gray-400">Target Success Rate</label>
          <Input
            type="number"
            value={targetSuccess}
            min={60}
            max={99}
            step={1}
            onChange={(event) => { setTargetSuccess(Number(event.target.value) || 80); setSaveDone(false); }}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-gray-400">Max Monthly 529 Contribution</label>
          <Input
            type="number"
            value={maxMonthly}
            min={0}
            step={25}
            onChange={(event) => {
              const n = Number(event.target.value);
              setMaxMonthly(Number.isFinite(n) ? n : maxMonthly);
              setSaveDone(false);
            }}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-gray-400">Max Loan Per Year</label>
          <Input
            type="number"
            value={maxLoan}
            min={0}
            step={500}
            onChange={(event) => {
              const n = Number(event.target.value);
              setMaxLoan(Number.isFinite(n) ? n : maxLoan);
              setSaveDone(false);
            }}
            className="bg-gray-800 border-gray-700 text-white"
          />
          {affordabilityHint && (
            <div className="text-[11px] text-gray-400 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  Max annual student loan ≈ ${Math.round(affordabilityHint.impliedMaxLoanPerYearPrivate ?? 0).toLocaleString()}/yr
                </span>
                <span className="text-gray-500">(assumes {affordabilityHint.privateRatePct ?? 8}% APR, {affordabilityHint.privateTermYears ?? 10}-year term)</span>
                {constraintBreakdown && (() => {
                  const key = constraintBreakdown.bindingKeys?.[0];
                  const color = key === 'surplus' ? 'bg-red-900/30 text-red-400 border-red-500/30'
                    : key === 'dtiRoom' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30'
                    : 'bg-green-900/30 text-green-400 border-green-500/30';
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${color}`}>
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      Binding: {constraintBreakdown.bindingLabel}
                    </span>
                  );
                })()}
                {constraintBreakdown && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1 text-gray-400 hover:text-white">
                        <Info className="h-3.5 w-3.5" />
                        <span>See limits</span>
                      </TooltipTrigger>
                      <TooltipContent className="bg-gray-800 border-gray-700">
                        <div className="text-xs">
                          <div className="font-semibold mb-1">Binding: {constraintBreakdown.bindingLabel}</div>
                          <ul className="space-y-1">
                            {typeof constraintBreakdown.burden === 'number' && (
                              <li className={constraintBreakdown.bindingKeys?.includes('burden') ? 'text-green-400' : ''}>
                                Payment burden (10%): ${Math.round(constraintBreakdown.burden).toLocaleString()}/mo
                              </li>
                            )}
                            {typeof constraintBreakdown.dtiRoom === 'number' && (
                              <li className={constraintBreakdown.bindingKeys?.includes('dtiRoom') ? 'text-yellow-400' : ''}>
                                DTI room (43%): ${Math.round(Math.max(0, constraintBreakdown.dtiRoom)).toLocaleString()}/mo
                              </li>
                            )}
                            {typeof constraintBreakdown.surplus === 'number' && (
                              <li className={constraintBreakdown.bindingKeys?.includes('surplus') ? 'text-red-400' : ''}>
                                Cash-flow surplus: ${Math.round(Math.max(0, constraintBreakdown.surplus)).toLocaleString()}/mo
                              </li>
                            )}
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div>
                Affordable payment ≈ ${Math.round(affordabilityHint.monthlyPaymentLimit).toLocaleString()}/mo
                {' '}• Total ≈ ${Math.round(affordabilityHint.impliedMaxTotalLoan).toLocaleString()}
                {' '}({affordabilityHint.termYears} yrs @ {affordabilityHint.ratePct.toFixed(1)}%) → ~${Math.round(affordabilityHint.impliedMaxLoanPerYear).toLocaleString()}/yr
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-gray-400">Tuition Inflation Assumption</label>
          <div className="flex items-center gap-4">
            <Slider
              min={1}
              max={7}
              step={0.1}
              value={[tuitionInflation]}
              onValueChange={([value]) => { setTuitionInflation(value); setSaveDone(false); }}
            />
            <span className="w-12 text-right text-sm text-gray-300">{tuitionInflation.toFixed(1)}%</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-gray-400">Expected Scholarships (per year)</label>
          <Input
            type="number"
            value={annualScholarships}
            min={0}
            step={500}
            onChange={(event) => { setAnnualScholarships(Math.max(0, Number(event.target.value) || 0)); setSaveDone(false); }}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-gray-400">Probability of 5th Year</label>
          <div className="flex items-center gap-4">
            <Slider
              min={0}
              max={25}
              step={1}
              value={[extraYearProbability]}
              onValueChange={([value]) => { setExtraYearProbability(value); setSaveDone(false); }}
            />
            <span className="w-12 text-right text-sm text-gray-300">{extraYearProbability.toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-6">
          <Checkbox id="prefer-loans" checked={preferLowerLoans} onCheckedChange={(checked) => { setPreferLowerLoans(Boolean(checked)); setSaveDone(false); }} />
          <label htmlFor="prefer-loans" className="text-xs text-gray-300">
            Prioritize plans with lower total student loans
          </label>
        </div>

        <div className="flex items-center gap-3 pt-6">
          <Checkbox id="prefer-monthly" checked={preferLowerMonthly} onCheckedChange={(checked) => { setPreferLowerMonthly(Boolean(checked)); setSaveDone(false); }} />
          <label htmlFor="prefer-monthly" className="text-xs text-gray-300">
            Prefer smaller monthly contributions when success is tied
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleOptimization} disabled={isLoading}
          className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white border-purple-500 hover:border-purple-400 transition-all">
          {isLoading ? `Running 1000 scenarios… ${elapsedSeconds}s` : "Run Optimization"}
        </Button>
        <Button
          onClick={handleSave}
          disabled={isLoading || isSaving || !latestResult}
          className="w-full sm:w-auto bg-gray-900 border border-purple-500 text-white hover:bg-purple-900/20 hover:border-purple-400 transition-all"
        >
          {isSaving ? "Saving…" : saveDone ? "Optimization saved" : "Save Optimization"}
        </Button>
      </div>
    </div>
  );
}
