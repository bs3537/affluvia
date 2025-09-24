import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  School,
  Plus,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  ChevronRight,
  Lightbulb,
  Edit,
  Trash2,
  Calculator,
  Target,
  PiggyBank,
  CreditCard,
  RefreshCcw
} from "lucide-react";
import { useQuery, useMutation, useQueryClient, useIsFetching } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { GoalFormModal } from './education-goal-form';
import { EducationOptimizerForm, OptimizerSavePayload } from './education-optimizer-form';
import { Gauge } from "@/components/ui/gauge";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels
);

// Types
interface EducationGoal {
  id?: string;
  studentName: string;
  relationship?: string;
  goalType: 'college' | 'pre-college';
  startYear: number;
  endYear: number;
  years: number;
  costOption: 'average' | 'specific' | 'custom';
  collegeName?: string;
  costPerYear?: number;
  coverPercent: number;
  currentSavings?: number;
  monthlyContribution?: number;
  accountType?: string;
  // funding sources include scholarships and student loans
  fundingSources?: Array<{ type: string; amount?: number }>;
  expectedReturn?: number;
  riskProfile?: string;
  // Added fields so we can baseline-fill the optimizer
  inflationRate?: number;
  scholarshipPerYear?: number;
  loanPerYear?: number;
  loanInterestRate?: number;
  loanRepaymentTerm?: number;
  stateOfResidence?: string;
  projection?: {
    years: number[];
    costs: number[];
    funded: number[];
    loanAmounts?: number[];
    totalCost: number;
    totalFunded: number;
    totalLoans?: number;
    fundingPercentage: number;
    monthlyContributionNeeded: number;
    comprehensiveFundingPercentage?: number;
    // Monte Carlo outputs (optional, provided by server)
    probabilityOfSuccess?: number;
    monteCarloAnalysis?: any;
  };
}

interface Recommendation {
  title: string;
  description: string;
  priority: number;
  actionSteps: string[];
  impact: string;
}

type OptimizerControls = {
  strategy?: string | null;
  tuitionInflation?: number | null;
  annualScholarships?: number | null;
  extraYearProbability?: number | null;
  maxMonthlyContribution?: number | null;
  maxLoanPerYear?: number | null;
  monthlyContribution?: number | null;
  loanPerYear?: number | null;
};

export function EducationFundingCenter() {
  const [selectedGoal, setSelectedGoal] = useState<EducationGoal | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<any>(null);
  const [optimizerDefaults, setOptimizerDefaults] = useState<OptimizerControls>({});
  const [isSavingOptimization, setIsSavingOptimization] = useState(false);
  const [canGenerateInsights, setCanGenerateInsights] = useState(true);
  const [showInsights, setShowInsights] = useState(false);
  const queryClient = useQueryClient();
  const isGeneratingCount = useIsFetching({ queryKey: selectedGoal?.id ? [`/api/education/goal-recommendations/${selectedGoal.id}`] : undefined });
  const isGenerating = Boolean(isGeneratingCount);
  const [genSeconds, setGenSeconds] = useState(0);
  React.useEffect(() => {
    let timer: any;
    if (isGenerating) {
      setGenSeconds(0);
      timer = setInterval(() => setGenSeconds((s) => s + 1), 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isGenerating, selectedGoal?.id]);

  const loadSavedScenario = React.useCallback(async (goalId: number | string, baseDefaults: OptimizerControls) => {
    try {
      const response = await fetch(`/api/education/saved-scenario/${goalId}`);
      if (!response.ok) {
        setScenarioResult(null);
        setOptimizerDefaults(baseDefaults);
        return;
      }
      const savedScenario = await response.json();
      setScenarioResult(savedScenario.result);
      setOptimizerDefaults({
        ...baseDefaults,
        strategy: savedScenario.variables?.investmentStrategy ?? savedScenario.variables?.strategy ?? baseDefaults.strategy ?? null,
        tuitionInflation: typeof savedScenario.variables?.tuitionInflationRate === 'number'
          ? Math.round(savedScenario.variables.tuitionInflationRate * 1000) / 10
          : baseDefaults.tuitionInflation ?? null,
        annualScholarships: typeof savedScenario.variables?.annualScholarships === 'number'
          ? savedScenario.variables.annualScholarships
          : baseDefaults.annualScholarships ?? null,
        extraYearProbability: typeof savedScenario.variables?.extraYearProbability === 'number'
          ? Math.round(savedScenario.variables.extraYearProbability * 100)
          : baseDefaults.extraYearProbability ?? null,
        maxMonthlyContribution: typeof savedScenario.variables?.monthlyContribution === 'number'
          ? savedScenario.variables.monthlyContribution
          : baseDefaults.maxMonthlyContribution ?? null,
        maxLoanPerYear: typeof savedScenario.variables?.loanPerYear === 'number'
          ? savedScenario.variables.loanPerYear
          : baseDefaults.maxLoanPerYear ?? null,
        monthlyContribution: typeof savedScenario.variables?.monthlyContribution === 'number'
          ? savedScenario.variables.monthlyContribution
          : baseDefaults.monthlyContribution ?? null,
        loanPerYear: typeof savedScenario.variables?.loanPerYear === 'number'
          ? savedScenario.variables.loanPerYear
          : baseDefaults.loanPerYear ?? null,
      });
    } catch (error) {
      console.log('No saved scenario found for goal:', goalId);
      setScenarioResult(null);
      setOptimizerDefaults(baseDefaults);
    }
  }, []);

  React.useEffect(() => {
    if (!selectedGoal) {
      setScenarioResult(null);
      setOptimizerDefaults({});
      setCanGenerateInsights(false);
      setShowInsights(false);
      return;
    }

    const baseDefaults: OptimizerControls = {
      strategy: selectedGoal.riskProfile || "balanced",
      tuitionInflation: (() => {
        const inflationValue = Number(selectedGoal.inflationRate ?? 2.4);
        return Number.isFinite(inflationValue) ? inflationValue : 2.4;
      })(),
      annualScholarships: (() => {
        const fromSources = Array.isArray(selectedGoal.fundingSources)
          ? selectedGoal.fundingSources
              .filter((s: any) => (s?.type || "").toLowerCase() === "scholarships")
              .reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0)
          : 0;
        const scholarshipsValue = Number(selectedGoal.scholarshipPerYear ?? fromSources ?? 0);
        return Number.isFinite(scholarshipsValue) ? scholarshipsValue : 0;
      })(),
      extraYearProbability: 0,
      maxMonthlyContribution: (() => {
        const val = Number(selectedGoal.monthlyContribution ?? 0);
        return Number.isFinite(val) ? val : 0;
      })(),
      maxLoanPerYear: (() => {
        const fromSources = Array.isArray(selectedGoal.fundingSources)
          ? selectedGoal.fundingSources
              .filter((s: any) => (s?.type || "").toLowerCase() === "student_loan")
              .reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0)
          : 0;
        const val = Number(selectedGoal.loanPerYear ?? fromSources ?? 0);
        return Number.isFinite(val) ? val : 0;
      })(),
      monthlyContribution: (() => {
        const val = Number(selectedGoal.monthlyContribution ?? 0);
        return Number.isFinite(val) ? val : 0;
      })(),
      loanPerYear: (() => {
        const fromSources = Array.isArray(selectedGoal.fundingSources)
          ? selectedGoal.fundingSources
              .filter((s: any) => (s?.type || "").toLowerCase() === "student_loan")
              .reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0)
          : 0;
        const val = Number(selectedGoal.loanPerYear ?? fromSources ?? 0);
        return Number.isFinite(val) ? val : 0;
      })(),
    };

    setScenarioResult(null);
    setOptimizerDefaults(baseDefaults);
    loadSavedScenario(selectedGoal.id ?? 0, baseDefaults);
  }, [selectedGoal?.id, loadSavedScenario]);

  React.useEffect(() => {
    // Always allow generating insights without requiring saved optimization
    setCanGenerateInsights(!!selectedGoal?.id);
    setShowInsights(false);
  }, [selectedGoal?.id]);

  React.useEffect(() => {
    if (!selectedGoal?.id || showInsights) {
      return;
    }

    const queryKey = [`/api/education/goal-recommendations/${selectedGoal.id}`];
    const cachedQuery = queryClient.getQueryData(queryKey) as any;
    if (cachedQuery?.recommendations?.length) {
      setShowInsights(true);
      return;
    }

    if (!canGenerateInsights) {
      return;
    }

    let aborted = false;
    async function preloadExistingInsights() {
      try {
        const response = await fetch(`/api/education/goal-recommendations/${selectedGoal.id}?cachedOnly=true`);
        if (!response.ok || response.status === 204) {
          return;
        }
        const data = await response.json();
        if (aborted) {
          return;
        }
        if (Array.isArray(data?.recommendations) && data.recommendations.length > 0) {
          queryClient.setQueryData(queryKey, data);
          setShowInsights(true);
        }
      } catch (error) {
        console.warn("Unable to preload education insights", error);
      }
    }

    preloadExistingInsights();
    return () => {
      aborted = true;
    };
  }, [selectedGoal?.id, showInsights, canGenerateInsights, queryClient]);

  const handleOptimizationSave = React.useCallback(async (payload: OptimizerSavePayload) => {
    if (!selectedGoal?.id) {
      toast.error('Select an education goal before saving.');
      return;
    }
    if (!scenarioResult) {
      toast.error('Run the optimizer before saving the plan.');
      return;
    }

    setIsSavingOptimization(true);
    try {
      const response = await fetch('/api/education/optimize/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: selectedGoal.id,
          optimizerControls: payload.controls,
          optimizerResult: scenarioResult,
        })
      });

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.optimizerResult) {
        setScenarioResult(data.optimizerResult);
      }
      if (data.goal) {
        setSelectedGoal((prev) => {
          if (!prev || String(prev.id) !== String(data.goal.id)) return prev;
          return { ...prev, ...data.goal };
        });
      }
      setOptimizerDefaults((prev) => ({
        ...prev,
        strategy: payload.controls.strategy,
        tuitionInflation: payload.controls.tuitionInflation,
        annualScholarships: payload.controls.annualScholarships,
        extraYearProbability: payload.controls.extraYearProbability,
        maxMonthlyContribution: payload.controls.maxMonthlyContribution,
        maxLoanPerYear: payload.controls.maxLoanPerYear,
        monthlyContribution: payload.controls.maxMonthlyContribution,
        loanPerYear: payload.controls.maxLoanPerYear,
      }));
      await queryClient.invalidateQueries({ queryKey: ['/api/education/goals'] });
      // Notify other views (e.g., Life Goals) to refresh immediately
      window.dispatchEvent(new CustomEvent('educationOptimizationUpdated'));
      setCanGenerateInsights(true);
      toast.success('Optimization saved successfully.');
    } catch (error) {
      console.error('Error saving optimization:', error);
      toast.error('Failed to save optimized plan.');
    } finally {
      setIsSavingOptimization(false);
    }
  }, [selectedGoal, scenarioResult, queryClient]);

  // Fetch education goals (server returns { goals: [...], plaid529Accounts: [...] })
  const { data: goalsPayload, isLoading } = useQuery({
    queryKey: ['/api/education/goals'],
    queryFn: async () => {
      const response = await fetch('/api/education/goals');
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    }
  });

  // Normalize payload to arrays for safer use
  const goals: EducationGoal[] = Array.isArray(goalsPayload)
    ? (goalsPayload as any)
    : (Array.isArray((goalsPayload as any)?.goals) ? (goalsPayload as any).goals : []);
  const plaid529Accounts: Array<{ accountId: string; accountName: string; balance: number; institutionName?: string }>
    = Array.isArray((goalsPayload as any)?.plaid529Accounts) ? (goalsPayload as any).plaid529Accounts : [];

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ['/api/financial-profile'],
    queryFn: async () => {
      const response = await fetch('/api/financial-profile');
      if (!response.ok) return null;
      return response.json();
    }
  });

  // Transform goal for API
  const transformGoalForAPI = (goal: EducationGoal) => {
    return {
      studentName: goal.studentName,
      relationship: goal.relationship || 'child',
      goalType: goal.goalType,
      startYear: goal.startYear,
      endYear: goal.endYear,
      years: goal.years,
      costOption: goal.costOption,
      collegeName: goal.collegeName || null,
      costPerYear: goal.costPerYear || (goal.goalType === 'college' ? 35000 : 15000),
      inflationRate: 2.4,
      coverPercent: goal.coverPercent,
      currentSavings: goal.currentSavings || 0,
      monthlyContribution: goal.monthlyContribution || 0,
      accountType: goal.accountType || '529',
      fundingSources: goal.fundingSources || [],
      expectedReturn: goal.expectedReturn || 6,
      riskProfile: goal.riskProfile || 'moderate',
      stateOfResidence: goal.stateOfResidence || profile?.state || null,
    };
  };

  // Mutations
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: EducationGoal) => {
      const apiData = transformGoalForAPI(goalData);
      console.log('Sending goal data:', apiData);
      const response = await fetch('/api/education/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to create goal: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/education/goals'] });
      toast.success('Education goal created successfully');
    },
    onError: (error) => {
      console.error('Error creating education goal:', error);
      toast.error('Failed to create education goal');
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async (goalData: EducationGoal) => {
      const apiData = transformGoalForAPI(goalData);
      const response = await fetch(`/api/education/goals/${goalData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });
      if (!response.ok) throw new Error('Failed to update goal');
      return response.json();
    },
    onSuccess: (updatedGoal) => {
      queryClient.invalidateQueries({ queryKey: ['/api/education/goals'] });
      if (selectedGoal?.id === updatedGoal.id) {
        setSelectedGoal(updatedGoal);
      }
      toast.success('Education goal updated successfully');
    },
    onError: () => {
      toast.error('Failed to update education goal');
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const response = await fetch(`/api/education/goals/${goalId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete goal');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/education/goals'] });
      setSelectedGoal(null);
      toast.success('Education goal deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete education goal');
    },
  });

  // Calculate What-If scenario


  // Save What-If scenario


  // Calculate aggregated metrics (guard for undefined goals)
  // Prefer saved optimized projection if available; otherwise use baseline projection
  const getOptimizedProjection = (goal: EducationGoal) => {
    const savedOpt = (goal as any)?.savedOptimization?.result;
    return (savedOpt?.optimizedProjection ?? goal.projection) as any;
  };
  const totalCost = (goals || []).reduce((sum: number, goal: EducationGoal) => {
    const p = getOptimizedProjection(goal);
    return sum + Number(p?.totalCost || 0);
  }, 0);
  const totalFundedFromProjections = (goals || []).reduce((sum: number, goal: EducationGoal) => {
    const p = getOptimizedProjection(goal);
    return sum + Number(p?.totalFunded || 0);
  }, 0);
  // Form-based savings across all goals: current 529 savings + asset funding sources (exclude loans and scholarships)
  const totalSavingsSources = (goals || []).reduce((sum: number, goal: EducationGoal) => {
    const currentSavings = Number(goal.currentSavings || 0);
    const sources = Array.isArray(goal.fundingSources) ? goal.fundingSources : [];
    const otherAssets = sources.reduce((s, src) => {
      const t = String((src as any)?.type || '').toLowerCase();
      const amt = Number((src as any)?.amount || 0);
      if (!Number.isFinite(amt)) return s;
      if (t === 'student_loan' || t === 'scholarships') return s;
      return s + amt;
    }, 0);
    return sum + currentSavings + otherAssets;
  }, 0);
  // Total loans from saved optimized plan when available; otherwise from projection or planned per-year loans
  const totalLoansFromPlan = (goals || []).reduce((sum: number, goal: EducationGoal) => {
    const savedOpt = (goal as any)?.savedOptimization?.result;
    const optProjLoans = Number(savedOpt?.optimizedProjection?.totalLoans ?? savedOpt?.optimizedTotalLoans);
    let loans = 0;
    if (Number.isFinite(optProjLoans)) {
      loans = optProjLoans;
    } else {
      const varLoanPerYear = Number(savedOpt?.variables?.loanPerYear ?? savedOpt?.variables?.maxLoanPerYear);
      const yrs = Number(goal.years || 0);
      if (Number.isFinite(varLoanPerYear) && yrs > 0) {
        loans = varLoanPerYear * yrs;
      } else {
        const p = getOptimizedProjection(goal);
        const projLoans = Number(p?.totalLoans || 0);
        if (Number.isFinite(projLoans) && projLoans > 0) {
          loans = projLoans;
        } else {
          const perYear = Number((goal as any)?.loanPerYear || 0);
          loans = (Number.isFinite(perYear) && yrs > 0) ? perYear * yrs : 0;
        }
      }
    }
    return sum + (Number.isFinite(loans) ? loans : 0);
  }, 0);
  // Aggregate gap and coverage from projections
  const totalGap = Math.max(0, totalCost - totalFundedFromProjections - totalLoansFromPlan);
  const overallComprehensiveFundingPercentage = totalCost > 0
    ? Math.round(Math.min(100, Math.max(0, ((totalFundedFromProjections + totalLoansFromPlan) / totalCost) * 100)))
    : 0;

  const optimizerCaps = React.useMemo(() => {
    const isIndependent = selectedGoal?.relationship?.toLowerCase() === 'independent';
    return {
      maxMonthlyContribution: 5000,
      maxLoanPerYear: isIndependent ? 12500 : 7500
    };
  }, [selectedGoal?.relationship]);

  // Affordable payment hint based on household income, expenses, existing debt, and loan terms
  const affordabilityHint = React.useMemo(() => {
    const goal = selectedGoal;
    if (!goal) return null as null | {
      monthlyPaymentLimit: number;
      impliedMaxTotalLoan: number;
      impliedMaxLoanPerYear: number;
      termYears: number;
      ratePct: number;
      constraintsUsed: { burden: number | null; dtiRoom: number | null; surplus: number | null };
    };

    const annualIncome = Number(profile?.annualIncome || 0) + Number(profile?.spouseAnnualIncome || 0);
    const monthlyIncome = annualIncome / 12;
    if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return null;

    // Existing debt (mirror server logic: mortgage, auto_loan, personal_loan)
    let existingDebt = 0;
    try {
      const liabilities: any[] = Array.isArray((profile as any)?.liabilities) ? (profile as any)?.liabilities : [];
      existingDebt = liabilities
        .filter(l => ['mortgage', 'auto_loan', 'personal_loan'].includes(String(l.type)))
        .reduce((s, l) => s + (Number(l.monthlyPayment || 0)), 0);
    } catch {}

    // Monthly expenses
    let monthlyExpenses = 0;
    let hasExpenses = false;
    if (profile?.totalMonthlyExpenses != null) {
      monthlyExpenses = Number(profile?.totalMonthlyExpenses || 0);
      hasExpenses = true;
    } else if ((profile as any)?.monthlyExpenses && typeof (profile as any).monthlyExpenses === 'object') {
      try {
        const me: any = (profile as any).monthlyExpenses;
        monthlyExpenses = Object.values(me).reduce((s: number, v: any) => s + (Number(v || 0)), 0);
        hasExpenses = true;
      } catch {}
    }

    const burdenMax = Math.min(0.10, Number((goal as any).loanBurdenMaxPct ?? 0.10));
    const m1 = monthlyIncome * burdenMax; // burden limit
    const m2 = Math.max(0, monthlyIncome * 0.43 - existingDebt); // DTI room
    const surplus = hasExpenses ? Math.max(0, monthlyIncome - monthlyExpenses) : null; // cash flow margin

    const candidates: number[] = [m1, m2].filter((x) => Number.isFinite(x));
    if (surplus != null) candidates.push(surplus);
    if (candidates.length === 0) return null;
    const monthlyPaymentLimit = Math.max(0, Math.min(...candidates));

    // Invert amortization to estimate max total loans supportable by this payment
    const ratePct = Number((goal as any).loanInterestRate ?? 10);
    const years = Math.max(1, Number((goal as any).loanRepaymentTerm ?? 10));
    const r = (ratePct / 100) / 12;
    const n = years * 12;
    const impliedMaxTotalLoan = r > 0
      ? monthlyPaymentLimit * ((Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n)))
      : monthlyPaymentLimit * n;

    const eduYears = Math.max(1, Number(goal.years || 1));
    const impliedMaxLoanPerYear = impliedMaxTotalLoan / eduYears;

    // Also provide a reference using typical private loan terms: 8% APR, 10 years
    const privateRatePct = 8;
    const privateYears = 10;
    const rp = (privateRatePct / 100) / 12;
    const np = privateYears * 12;
    const impliedMaxTotalLoanPrivate = rp > 0
      ? monthlyPaymentLimit * ((Math.pow(1 + rp, np) - 1) / (rp * Math.pow(1 + rp, np)))
      : monthlyPaymentLimit * np;
    const impliedMaxLoanPerYearPrivate = impliedMaxTotalLoanPrivate / eduYears;

    return {
      monthlyPaymentLimit,
      impliedMaxTotalLoan,
      impliedMaxLoanPerYear,
      termYears: years,
      ratePct,
      constraintsUsed: { burden: m1, dtiRoom: m2, surplus },
      privateRatePct,
      privateTermYears: privateYears,
      impliedMaxTotalLoanPrivate,
      impliedMaxLoanPerYearPrivate,
    };
  }, [selectedGoal, profile]);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header with Key Metrics - Industry Standard "At a Glance" Tiles */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <School className="h-8 w-8 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Education Funding Center</h1>
              <p className="text-purple-200">Plan and track education expenses</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setSelectedGoal(null);
                setShowGoalForm(true);
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </div>
        </div>

        {/* Key Metrics Row - Following Miller's Law (7±2 items) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <MetricCard
            label="Total Cost"
            value={`$${Math.round(totalCost).toLocaleString()}`}
            icon={<DollarSign className="h-5 w-5" />}
            trend="neutral"
          />
          <MetricCard
            label="Total Savings"
            value={`$${Math.round(totalSavingsSources).toLocaleString()}`}
            icon={<PiggyBank className="h-5 w-5" />}
            trend="positive"
          />
          <MetricCard
            label="Total Loans"
            value={`$${Math.round(totalLoansFromPlan).toLocaleString()}`}
            icon={<CreditCard className="h-5 w-5" />}
            trend="neutral"
          />
          <MetricCard
            label="Funding Gap"
            value={`$${Math.round(totalGap).toLocaleString()}`}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend={totalGap > 0 ? "negative" : "positive"}
          />
          <MetricCard
            label="Funding %"
            value={`${overallComprehensiveFundingPercentage}%`}
            icon={<Target className="h-5 w-5" />}
            trend={overallComprehensiveFundingPercentage >= 80 ? "positive" : "negative"}
          />
          <MetricCard
            label="Active Goals"
            value={(goals || []).length.toString()}
            icon={<School className="h-5 w-5" />}
            trend="neutral"
          />
          <MetricCard
            label="Avg Monthly"
            value={`$${(goals || []).length > 0 ? 
              Math.round((goals || []).reduce((sum: number, g: EducationGoal) => 
                sum + parseFloat(g.monthlyContribution?.toString() || '0'), 0
              ) / (goals || []).length).toLocaleString() : '0'
            }`}
            icon={<TrendingUp className="h-5 w-5" />}
            trend="neutral"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Loading education goals...</div>
      ) : goals.length === 0 ? (
        <EmptyState onAddGoal={() => setShowGoalForm(true)} />
      ) : (
        <div className="space-y-6">
          {/* Goals List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal: EducationGoal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isSelected={selectedGoal?.id === goal.id}
                onSelect={() => {
                  // Toggle selection - if already selected, deselect; otherwise select
                  setSelectedGoal(selectedGoal?.id === goal.id ? null : goal);
                }}
                onEdit={() => {
                  setSelectedGoal(goal);
                  setShowGoalForm(true);
                }}
                onDelete={() => goal.id && deleteGoalMutation.mutate(goal.id)}
              />
            ))}
          </div>

          {/* Selected Goal Analysis */}
          {selectedGoal && (
            <GoalAnalysis
              goal={selectedGoal}
              scenarioResult={scenarioResult}
              optimizerDefaults={optimizerDefaults}
              optimizerCaps={optimizerCaps}
              affordabilityHint={affordabilityHint}
              isSavingOptimization={isSavingOptimization}
              canGenerateInsights={canGenerateInsights}
              showInsights={showInsights}
              onOptimized={(result) => {
                setScenarioResult(result);
                toast.success(`Optimized: ${result.probabilityOfSuccess}% success`);
              }}
              onSaveOptimization={handleOptimizationSave}
              onGenerateInsights={() => setShowInsights(true)}
            />
          )}

          {/* Personalized Recommendations */}
          {selectedGoal && showInsights && (
            <PersonalizedRecommendations goalId={selectedGoal.id} />
          )}
        </div>
      )}

      {/* Goal Form Modal */}
      {showGoalForm && (
        <GoalFormModal
          goal={selectedGoal}
          onClose={() => {
            setShowGoalForm(false);
            setSelectedGoal(null);
          }}
          onSave={async (goalData) => {
            if (goalData.id) {
              await updateGoalMutation.mutateAsync(goalData);
            } else {
              const newGoal = await createGoalMutation.mutateAsync(goalData);
              setSelectedGoal(newGoal);
            }
            setShowGoalForm(false);
          }}
        />
      )}

    </div>
  );
}

// Metric Card Component
function MetricCard({ 
  label, 
  value, 
  icon, 
  trend 
}: { 
  label: string; 
  value: string; 
  icon: React.ReactNode; 
  trend: 'positive' | 'negative' | 'neutral';
}) {
  const trendColors = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    neutral: 'text-gray-400'
  };

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">{label}</span>
          <span className={trendColors[trend]}>{icon}</span>
        </div>
        <p className="text-xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

// Goal Card Component
function GoalCard({ 
  goal, 
  isSelected,
  onSelect, 
  onEdit, 
  onDelete 
}: { 
  goal: EducationGoal; 
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fundingPercentage = goal.projection?.fundingPercentage || 0;
  const successProbability = (goal.projection?.probabilityOfSuccess ?? (goal.projection as any)?.monteCarloAnalysis?.probabilityOfSuccess ?? 0) as number;
  const isOnTrack = fundingPercentage >= 70;

  const getSuccessColor = (p: number) => {
    if (p >= 80) return 'text-green-400';
    if (p >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSuccessBadgeVariant = (p: number) => {
    if (p >= 80) return 'default' as const;
    if (p >= 60) return 'secondary' as const;
    return 'destructive' as const;
  };

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Card 
        onClick={onSelect}
        className={`bg-gray-900/50 border-gray-800 hover:border-purple-500/50 transition-all cursor-pointer ${
          isSelected ? 'border-purple-500' : ''
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white">
              {goal.studentName}
            </CardTitle>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="inline-flex items-center justify-center w-8 h-8 border-2 border-purple-600 bg-purple-950/50 rounded shadow-[0_0_4px_rgba(168,85,247,0.5)] hover:border-purple-400 hover:bg-purple-900/70 transition-all duration-200 hover:shadow-[0_0_12px_rgba(168,85,247,1)] hover:scale-110"
                title="Edit goal"
              >
                <Edit className="h-4 w-4 text-purple-300 hover:text-white" />
              </button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-8 w-8 text-red-400 hover:text-red-300"
                title="Delete goal"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={isOnTrack ? "default" : "destructive"}>
              {fundingPercentage}% Funded
            </Badge>
            <Badge variant={getSuccessBadgeVariant(successProbability)} className="bg-opacity-80">
              {Math.round(successProbability)}% Success (Monte Carlo)
            </Badge>
            <span className="text-sm text-gray-400">
              {goal.startYear}-{goal.endYear}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Cost:</span>
              <span className="text-white font-medium">
                ${goal.projection?.totalCost.toLocaleString() || 0} (includes tuition inflation)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Success Probability:</span>
              <span className={`font-medium ${getSuccessColor(successProbability)}`}>
                {Math.round(successProbability)}% (Monte Carlo)
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end text-purple-400 text-sm">
            <span>{isSelected ? 'Hide Analysis' : 'View Analysis'}</span>
            <ChevronRight className={`h-4 w-4 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Goal Analysis Component
function GoalAnalysis({
  goal,
  scenarioResult,
  onOptimized,
  optimizerDefaults,
  optimizerCaps,
  affordabilityHint,
  isSavingOptimization,
  canGenerateInsights,
  showInsights,
  onSaveOptimization,
  onGenerateInsights,
}: {
  goal: EducationGoal;
  scenarioResult: any;
  onOptimized: (result: any) => void;
  optimizerDefaults: OptimizerControls;
  optimizerCaps: { maxMonthlyContribution: number; maxLoanPerYear: number };
  affordabilityHint: null | {
    monthlyPaymentLimit: number;
    impliedMaxTotalLoan: number;
    impliedMaxLoanPerYear: number;
    termYears: number;
    ratePct: number;
    constraintsUsed?: { burden: number | null; dtiRoom: number | null; surplus: number | null };
    privateRatePct?: number;
    privateTermYears?: number;
    impliedMaxTotalLoanPrivate?: number;
    impliedMaxLoanPerYearPrivate?: number;
  };
  isSavingOptimization: boolean;
  canGenerateInsights: boolean;
  showInsights: boolean;
  onSaveOptimization: (payload: OptimizerSavePayload) => Promise<void> | void;
  onGenerateInsights: () => void;
}) {
  const savedOptimization = (goal as any)?.savedOptimization;
  const savedOptimizationResult = savedOptimization?.result;

  // Local generating state for this goal's AI recommendations
  const genFetchCount = useIsFetching({ queryKey: [`/api/education/goal-recommendations/${goal.id}`] });
  const isGenerating = Boolean(genFetchCount);
  const [genSeconds, setGenSeconds] = React.useState(0);
  React.useEffect(() => {
    let t: any;
    if (isGenerating) {
      setGenSeconds(0);
      t = setInterval(() => setGenSeconds((s) => s + 1), 1000);
    }
    return () => { if (t) clearInterval(t); };
  }, [isGenerating, goal?.id]);

  const pickProbability = (...values: Array<number | string | null | undefined>) => {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  };
  const normalizeProbability = (value: number | null) => {
    if (value == null) return null;
    const pct = value > 1 ? value : value * 100;
    const clamped = Math.max(0, Math.min(100, pct));
    return Math.round(clamped);
  };
  const baselineSuccessProbability = normalizeProbability(
    pickProbability(
      scenarioResult?.baselineProbabilityOfSuccess,
      scenarioResult?.baselineProjection?.probabilityOfSuccess,
      savedOptimizationResult?.baselineProbabilityOfSuccess,
      savedOptimizationResult?.baselineProjection?.probabilityOfSuccess,
      goal.projection?.probabilityOfSuccess,
      (goal.projection as any)?.monteCarloAnalysis?.probabilityOfSuccess,
      (goal as any)?.probabilityOfSuccess
    )
  ) ?? 0;
  const optimizedSuccessProbability = normalizeProbability(
    pickProbability(
      scenarioResult?.optimizedProbabilityOfSuccess,
      scenarioResult?.probabilityOfSuccess,
      scenarioResult?.monteCarlo?.probabilityOfSuccess,
      scenarioResult?.monteCarloAnalysis?.probabilityOfSuccess,
      savedOptimizationResult?.optimizedProbabilityOfSuccess,
      savedOptimizationResult?.probabilityOfSuccess,
      savedOptimizationResult?.monteCarlo?.probabilityOfSuccess,
      savedOptimizationResult?.monteCarloAnalysis?.probabilityOfSuccess
    )
  );
  const successProbabilityDelta = optimizedSuccessProbability != null
    ? optimizedSuccessProbability - baselineSuccessProbability
    : null;
  const probabilityForWarnings = optimizedSuccessProbability ?? baselineSuccessProbability;
  // When an optimized probability exists, show it on the gauge and adjust labels accordingly
  const gaugeValue = optimizedSuccessProbability ?? baselineSuccessProbability;
  const isOptimizedShown = optimizedSuccessProbability != null;
  const baselineConfidenceLabel = baselineSuccessProbability >= 80
    ? 'High Confidence'
    : baselineSuccessProbability >= 65
      ? 'Moderate Risk'
      : 'Needs Improvement';
  const baselineConfidenceClass = baselineSuccessProbability >= 80
    ? 'bg-green-900/30 text-green-400'
    : baselineSuccessProbability >= 65
      ? 'bg-yellow-900/30 text-yellow-400'
      : 'bg-red-900/30 text-red-400';
  const optimizedConfidenceLabel = optimizedSuccessProbability != null
    ? optimizedSuccessProbability >= 80
      ? 'High Confidence'
      : optimizedSuccessProbability >= 65
        ? 'Moderate Risk'
        : 'Needs Improvement'
    : null;
  const optimizedConfidenceClass = optimizedSuccessProbability != null
    ? (optimizedSuccessProbability >= 80
        ? 'bg-green-900/30 text-green-400'
        : optimizedSuccessProbability >= 65
          ? 'bg-yellow-900/30 text-yellow-400'
          : 'bg-red-900/30 text-red-400')
    : '';

  // Unified series and totals (prefer scenario result; fall back to baseline projection). Use nullish coalescing so zeros are respected.
  const years = (scenarioResult?.years ?? goal.projection?.years ?? []) as number[];
  const costs = (scenarioResult?.costs ?? goal.projection?.costs ?? []) as number[];
  const fundedSeries = (scenarioResult?.funded ?? goal.projection?.funded ?? []) as number[];
  const loansSeries = (scenarioResult?.loanAmounts ?? goal.projection?.loanAmounts ?? (costs || []).map(() => 0)) as number[];

  const totalFunded = (scenarioResult?.totalFunded ?? goal.projection?.totalFunded ?? 0) as number;
  const totalLoans = (scenarioResult?.totalLoans ?? goal.projection?.totalLoans ?? (loansSeries || []).reduce((a, b) => a + (b || 0), 0)) as number;
  const totalCost = (scenarioResult?.totalCost ?? goal.projection?.totalCost ?? 0) as number;

  const fundingPercentage = (scenarioResult?.fundingPercentage ?? goal.projection?.fundingPercentage ?? 0) as number;
  const comprehensiveFundingPercentage = (() => {
    const explicit = scenarioResult?.comprehensiveFundingPercentage ?? goal.projection?.comprehensiveFundingPercentage;
    if (typeof explicit === 'number') return explicit;
    return totalCost > 0 ? Math.round(((totalFunded + totalLoans) / totalCost) * 100) : 0;
  })();

  const recommendedMonthly = (scenarioResult?.monteCarlo?.recommendedMonthlyContribution ?? scenarioResult?.monteCarloAnalysis?.recommendedMonthlyContribution ?? goal.projection?.monteCarloAnalysis?.recommendedMonthlyContribution ?? goal.projection?.monthlyContributionNeeded) as number | undefined;
  const currentMonthly = (scenarioResult?.variables?.monthlyContribution ?? goal.monthlyContribution ?? 0) as number;
  const loanCap = (scenarioResult?.variables?.loanPerYear ?? (goal as any)?.loanPerYear ?? 0) as number;
  const shortfallP50 = (scenarioResult?.monteCarlo?.shortfallPercentiles?.p50 ?? scenarioResult?.monteCarloAnalysis?.shortfallPercentiles?.p50 ?? goal.projection?.monteCarloAnalysis?.shortfallPercentiles?.p50) as number | undefined;
  const maxGap = costs.length ? Math.max(...costs.map((c, i) => Math.max(0, c - (fundedSeries[i] ?? 0) - (loansSeries[i] ?? 0)))) : 0;

  return (
    <div className="space-y-6">
          {/* 1. Monte Carlo Gauge, Funding Coverage, and Annual Cost */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monte Carlo Success Probability Gauge */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  Monte Carlo Success Probability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col items-center flex-1">
                      <Gauge
                        value={gaugeValue}
                        max={100}
                        size="md"
                        showValue={true}
                        valueLabel=""
                        colors={{ low: '#EF4444', medium: '#F59E0B', high: '#10B981' }}
                        thresholds={{ medium: 65, high: 80 }}
                      />
                      <p className="text-xs text-gray-400 mt-3 text-center">
                        {isOptimizedShown ? 'Optimized success probability' : 'Baseline probability of meeting education funding goals'}
                      </p>
                      <p className="text-[10px] text-gray-500 text-center mt-1">
                        Metric: Affordability-constrained coverage (529 + in-year cash + loans; payments ≤8–10% of income; DTI ≤43%; fits monthly cash flow; total loans ≤ starting salary)
                      </p>
                      <p className="text-xs text-gray-500 text-center">
                        Target: 80%+ recommended for confidence
                      </p>
                      <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium ${isOptimizedShown ? optimizedConfidenceClass : baselineConfidenceClass}`}>
                        {isOptimizedShown
                          ? `Optimized plan outlook: ${optimizedConfidenceLabel ?? baselineConfidenceLabel}`
                          : `Baseline outlook: ${baselineConfidenceLabel}`}
                      </div>
                    </div>
                    <div className="text-right flex-1 min-w-[160px]">
                      {optimizedSuccessProbability != null && successProbabilityDelta !== null ? (
                        <div className="space-y-1">
                          <div className="text-xs uppercase tracking-wide text-gray-400">vs Baseline</div>
                          <div className={`text-xl font-semibold ${
                            successProbabilityDelta > 0
                              ? 'text-emerald-300'
                              : successProbabilityDelta < 0
                                ? 'text-red-300'
                                : 'text-purple-300'
                          }`}>
                            {successProbabilityDelta > 0 ? '+' : ''}{Math.round(successProbabilityDelta)}%
                          </div>
                          <div className="text-xs text-gray-400">
                            Improvement from optimization
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 leading-snug max-w-[220px] ml-auto">
                          Save an optimized plan to compare against your baseline probability.
                        </p>
                      )}
                    </div>
                  </div>
                  {(scenarioResult?.monteCarlo?.probabilityOfComprehensiveCoverage ?? (goal.projection as any)?.monteCarloAnalysis?.probabilityOfComprehensiveCoverage) != null && (
                    <p className="text-xs text-gray-400 text-center">
                      Comprehensive coverage (529 + other + loans): {Math.round((scenarioResult?.monteCarlo?.probabilityOfComprehensiveCoverage ?? (goal.projection as any)?.monteCarloAnalysis?.probabilityOfComprehensiveCoverage) as number)}%
                    </p>
                  )}
                  {probabilityForWarnings < 80 && (
                    <div className="text-xs text-gray-300 text-center space-y-1">
                      {maxGap > 0 && <p>Largest annual gap up to ${maxGap.toLocaleString()} even after loans.</p>}
                      {typeof recommendedMonthly === 'number' && (
                        <p>Recommended monthly to reach 80%: ${Math.round(recommendedMonthly).toLocaleString()} (current: ${Math.round(currentMonthly).toLocaleString()}, loan cap: ${Math.round(loanCap).toLocaleString()}/yr)</p>
                      )}
                      {typeof shortfallP50 === 'number' && <p>Median shortfall in failed cases: ${Math.round(shortfallP50).toLocaleString()}.</p>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Current Plan - Update with scenario data when available */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  Funding Coverage Ratio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 max-w-sm mx-auto">
                  <Doughnut
                    data={(() => {
                      const covered = Math.max(0, totalFunded + totalLoans);
                      const gap = Math.max(0, totalCost - covered);

                      return {
                        labels: ['Covered (529 + Loans)', 'Gap'],
                        datasets: [{
                          data: [covered, gap],
                          backgroundColor: ['#10b981', '#ef4444'],
                          borderWidth: 0
                        }]
                      };
                    })()}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: { color: '#ffffff' }
                        },
                        datalabels: {
                          color: '#ffffff',
                          font: { weight: 'bold', size: 16 },
                          formatter: (value: number, context: any) => {
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return percentage > 0 ? `${percentage}%` : '';
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-400">
                    Coverage (incl. loans): {comprehensiveFundingPercentage}%
                  </p>
                  <p className="text-xs text-gray-500">
                    Savings-only coverage: {fundingPercentage}%
                  </p>
                  <p className="text-sm text-gray-400">
                    Monthly needed: ${(typeof recommendedMonthly === 'number' ? recommendedMonthly : 0).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Annual Cost vs Funding Sources - Update with scenario data when available */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  Annual Cost vs. Funding Sources
                </CardTitle>
                <p className="text-xs text-gray-400">(includes tuition inflation)</p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {(scenarioResult || goal.projection) && (
                    <Bar
                      data={{
                        labels: (years || []).map((y: any) => y.toString()),
                        datasets: [
                          {
                            label: '529/Savings',
                            data: fundedSeries || [],
                            backgroundColor: '#10b981',
                          },
                          {
                            label: 'Loans',
                            data: loansSeries || [],
                            backgroundColor: '#3b82f6',
                          },
                          {
                            label: 'Gap',
                            data: (costs || []).map((cost: any, i: number) => {
                              const funded = (fundedSeries || [])[i] || 0;
                              const loans = (loansSeries || [])[i] || 0;
                              return Math.max(0, cost - funded - loans);
                            }),
                            backgroundColor: '#ef4444',
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          x: { 
                            stacked: true,
                            ticks: { color: '#ffffff' },
                            grid: { display: false }
                          },
                          y: { 
                            stacked: true,
                            ticks: { 
                              color: '#ffffff',
                              callback: (value) => `$${(value as number / 1000).toFixed(0)}k`
                            },
                            grid: { color: '#374151' }
                          }
                        },
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: { color: '#ffffff' }
                          },
                          datalabels: { display: false }
                        }
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 2. Optimization Engine */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Optimization Engine
              </CardTitle>
              <p className="text-sm text-gray-400 mt-2">
                Tune the assumptions and let Affluvia search for the highest success probability plan within your guardrails.
              </p>
            </CardHeader>
            <CardContent>
              <EducationOptimizerForm
                key={goal.id}
                goalId={Number(goal.id ?? 0)}
                defaults={{
                  strategy: optimizerDefaults.strategy,
                  tuitionInflation: optimizerDefaults.tuitionInflation ?? undefined,
                  annualScholarships: optimizerDefaults.annualScholarships ?? undefined,
                  extraYearProbability: optimizerDefaults.extraYearProbability ?? undefined,
                  maxMonthlyContribution: optimizerDefaults.maxMonthlyContribution ?? undefined,
                  maxLoanPerYear: optimizerDefaults.maxLoanPerYear ?? undefined,
                  monthlyContribution: optimizerDefaults.monthlyContribution ?? undefined,
                  loanPerYear: optimizerDefaults.loanPerYear ?? undefined
                }}
                caps={optimizerCaps}
                affordabilityHint={affordabilityHint || undefined}
                latestResult={scenarioResult}
                onOptimized={onOptimized}
                onSave={onSaveOptimization}
                isSaving={isSavingOptimization}
              />
            </CardContent>
          </Card>

          <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-purple-600 rounded-full">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wide">Insights</h3>
              </div>
              <Button
                onClick={onGenerateInsights}
                disabled={isSavingOptimization || isGenerating}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 mr-16"
              >
                {isGenerating ? `Generating… ${genSeconds}s` : (showInsights ? "Insights Ready" : "Generate AI Insights")}
              </Button>
            </div>
            <p className="mt-2 text-sm text-gray-300">
              AI‑driven insights to strengthen your plan: optimize 529 contributions, surface scholarship/aid opportunities, and balance loan strategy based on your saved optimization and affordability.
            </p>
          </div>

    </div>
  );
}

// Personalized Recommendations Component
function PersonalizedRecommendations({ goalId }: { goalId?: string }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: recommendations, isLoading } = useQuery({
    queryKey: [`/api/education/goal-recommendations/${goalId}`],
    queryFn: async () => {
      if (!goalId) return { recommendations: [] };
      const response = await fetch(`/api/education/goal-recommendations/${goalId}`);
      if (!response.ok) return { recommendations: [] };
      return response.json();
    },
    enabled: !!goalId,
  });

  const handleRefresh = async () => {
    if (!goalId) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/education/goal-recommendations/${goalId}?refresh=true`);
      const data = await res.json();
      queryClient.setQueryData([`/api/education/goal-recommendations/${goalId}`], data);
    } finally {
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    let t: any;
    if (isLoading) {
      setElapsed(0);
      t = setInterval(() => setElapsed((s) => s + 1), 1000);
    }
    return () => { if (t) clearInterval(t); };
  }, [isLoading]);

  if (isLoading) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-purple-200">Generating… {elapsed}s</p>
        </CardContent>
      </Card>
    );
  }
  if (!recommendations?.recommendations?.length) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">No insights available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-400" />
            Personalized Action Plan
          </CardTitle>
          {/* Subtitle removed per request */}
        </div>
        <div className="flex items-center gap-3">
          {recommendations?.lastGeneratedAt && (
            <span className="text-xs text-gray-400">
              Last generated: {new Date(recommendations.lastGeneratedAt).toLocaleString()}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh insights"
          >
            <RefreshCcw className={`h-4 w-4 text-gray-300 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.recommendations
            .slice(0, 5)
            .map((rec: Recommendation, index: number) => (
              <RecommendationCard key={index} recommendation={rec} index={index} />
            ))}
        </div>

      </CardContent>
    </Card>
  );
}

// Recommendation Card Component
function RecommendationCard({ 
  recommendation, 
  index 
}: { 
  recommendation: Recommendation; 
  index: number;
}) {
  const priorityColors = {
    1: 'border-red-500 bg-red-500/10',
    2: 'border-yellow-500 bg-yellow-500/10',
    3: 'border-green-500 bg-green-500/10',
  };

  return (
    <div className={`p-4 rounded-lg border ${priorityColors[recommendation.priority as keyof typeof priorityColors] || priorityColors[3]}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold text-sm">
            {index + 1}
          </div>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-white mb-1">{recommendation.title}</h4>
          <p className="text-gray-300 text-sm mb-2">{recommendation.description}</p>
          {recommendation.impact && (
            <Badge variant="outline" className="mb-2 text-white border-gray-500">
              Impact: {recommendation.impact}
            </Badge>
          )}
          {recommendation.actionSteps?.length > 0 && (
            <ul className="space-y-1 mt-2">
              {recommendation.actionSteps.map((step, stepIndex) => (
                <li key={stepIndex} className="text-xs text-gray-400 flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function EmptyState({ onAddGoal }: { onAddGoal: () => void }) {
  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardContent className="p-12 text-center">
        <School className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">
          No Education Goals Yet
        </h3>
        <p className="text-gray-400 mb-6">
          Start planning for education expenses by adding your first goal.
        </p>
        <Button onClick={onAddGoal} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Goal
        </Button>
      </CardContent>
    </Card>
  );
}

function SensitivityBar({ label, impact }: { label: string; impact: number }) {
  const isPositive = impact > 0;
  const width = Math.abs(impact);
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-24">{label}</span>
      <div className="flex-1 flex items-center">
        <div className="w-1/2 flex justify-end pr-2">
          {!isPositive && (
            <div 
              className="h-4 bg-red-500"
              style={{ width: `${width}%` }}
            />
          )}
        </div>
        <div className="w-px h-6 bg-gray-600" />
        <div className="w-1/2 pl-2">
          {isPositive && (
            <div 
              className="h-4 bg-green-500"
              style={{ width: `${width}%` }}
            />
          )}
        </div>
      </div>
      <span className={`text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'} w-12 text-right`}>
        {isPositive ? '+' : ''}{impact}%
      </span>
    </div>
  );
}
