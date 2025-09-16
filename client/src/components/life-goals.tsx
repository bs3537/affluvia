import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Target,
  Plus,
  TrendingUp,
  Home,
  Building2,
  Briefcase,
  GraduationCap,
  CreditCard,
  ChevronRight,
  DollarSign,
  Calendar,
  Edit,
  Trash2,
  PiggyBank,
  Sparkles,
  Calculator,
  BarChart3,
  Info,
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Gauge } from "@/components/ui/gauge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import DebouncedInvalidation from '@/utils/debounced-invalidation';
import { GoalFormModal } from './education-goal-form';
import { UniversalGoalFormModal } from './universal-goal-form';
import { UniversalGoalFormEnhanced } from './universal-goal-form-enhanced';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { LifeGoalDetailView } from './life-goal-detail-view';
import { ErrorBoundary } from './error-boundary';

// Types
interface LifeGoalMetadata {
  retirementAge?: number;
  currentAge?: number;
  successProbability?: number;
  projection?: {
    totalCost?: number;
    fundingPercentage?: number;
  };
  [key: string]: unknown;
}

interface LifeGoal {
  id?: string | number;
  goalType: 'retirement' | 'education' | 'home-purchase' | 'investment-property' | 'debt-free' | 'business' | 'custom';
  goalName: string;
  targetDate?: string;
  targetAmount?: number;
  currentAmount?: number;
  monthlyContribution?: number;
  fundingPercentage?: number;
  metadata?: LifeGoalMetadata;
  linkedEntityId?: string;
  linkedEntityType?: string;
  priority?: 'high' | 'medium' | 'low' | number;
  status?: 'on-track' | 'at-risk' | 'behind' | 'completed';
}

// EducationGoal type will be inferred from the API response
interface EducationGoalFromAPI {
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
  fundingSources?: any[];
  expectedReturn?: number;
  riskProfile?: string;
  stateOfResidence?: string;
  projection?: {
    fundingPercentage: number;
    totalCost: number;
    totalFunded: number;
  };
}

const goalTypeConfig = {
  retirement: {
    icon: Calculator,
    color: 'bg-blue-500',
    lightColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    label: 'Retirement',
    description: 'Financial independence'
  },
  education: {
    icon: GraduationCap,
    color: 'bg-green-500',
    lightColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    label: 'Education',
    description: 'Investing in future education'
  },
  'home-purchase': {
    icon: Home,
    color: 'bg-purple-500',
    lightColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    label: 'First Home',
    description: 'Your dream home awaits'
  },
  'investment-property': {
    icon: Building2,
    color: 'bg-indigo-500',
    lightColor: 'bg-indigo-100',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    label: 'Investment Property',
    description: 'Building wealth through real estate'
  },
  'debt-free': {
    icon: CreditCard,
    color: 'bg-orange-500',
    lightColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    label: 'Debt Freedom',
    description: 'Path to financial freedom'
  },
  business: {
    icon: Briefcase,
    color: 'bg-teal-500',
    lightColor: 'bg-teal-100',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
    label: 'Business',
    description: 'Your entrepreneurial journey'
  },
  custom: {
    icon: Sparkles,
    color: 'bg-gray-500',
    lightColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    label: 'Custom Goal',
    description: 'Your personalized financial goal'
  }
};

const LifeGoalsComponent = () => {
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [showUniversalForm, setShowUniversalForm] = useState(false);
  const [selectedGoalType, setSelectedGoalType] = useState<string>('');
  const [selectedGoal, setSelectedGoal] = useState<LifeGoal | null>(null);
  const [editingEducationGoal, setEditingEducationGoal] = useState<EducationGoalFromAPI | null>(null);
  const [deleteConfirmGoal, setDeleteConfirmGoal] = useState<LifeGoal | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);
  const [detailViewGoal, setDetailViewGoal] = useState<LifeGoal | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisGoal, setAnalysisGoal] = useState<LifeGoal | null>(null);
  const [showAddGoalDrawer, setShowAddGoalDrawer] = useState(false);
  // Removed legacy Gemini fetch flags; insights are fetched inside LifeGoalDetailView
  const queryClient = useQueryClient();

  // Create debounced invalidation instance
  const debouncedInvalidation = useMemo(() => new DebouncedInvalidation(queryClient), [queryClient]);

  // Refresh education goals immediately after optimization is saved elsewhere
  useEffect(() => {
    const onEduOpt = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/education/goals'] });
    };
    window.addEventListener('educationOptimizationUpdated', onEduOpt as any);
    return () => window.removeEventListener('educationOptimizationUpdated', onEduOpt as any);
  }, [queryClient]);

  // Profile + retirement score for Retirement Readiness tile
  const { data: profile } = useQuery({
    queryKey: ['/api/financial-profile'],
    queryFn: async () => {
      const res = await fetch('/api/financial-profile', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000,
    cacheTime: 60000,
    retry: 1
  });

  const { data: retirementScore } = useQuery<{ probability?: number; probabilityDecimal?: number }>({
    queryKey: ['/api/retirement-score'],
    queryFn: async () => {
      const res = await fetch('/api/retirement-score', { credentials: 'include' });
      if (!res.ok) return {} as any;
      return res.json();
    }
  });

  // Helpers used by the retirement tile
  const sumByType = (assets: any[], predicate: (t: string) => boolean) =>
    (assets || []).reduce((sum, a) => {
      const type = (a?.type || '').toString().toLowerCase();
      const val = Number(a?.value || 0);
      return predicate(type) ? sum + (Number.isFinite(val) ? val : 0) : sum;
    }, 0);

  const retirementAssetsTotal = (() => {
    const assets = Array.isArray(profile?.assets) ? profile.assets : [];
    const isRet = (t: string) => /401k|403b|ira|retirement|pension|457|tsp|sep|simple/.test(t) || /roth/.test(t);
    return sumByType(assets, isRet);
  })();

  const cashLikeTotal = (() => {
    const assets = Array.isArray(profile?.assets) ? profile.assets : [];
    const isCash = (t: string) => /cash|savings|checking|money market|cd/.test(t);
    return sumByType(assets, isCash);
  })();

  const baselineProb = (() => {
    const p = retirementScore?.probabilityDecimal
      ? (retirementScore?.probabilityDecimal || 0) * 100
      : (retirementScore?.probability || 0);
    return Math.max(0, Math.min(100, Math.round(p)));
  })();

  const readinessChip = (() => {
    if (baselineProb >= 90) return { label: 'Confident', cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60' };
    if (baselineProb >= 80) return { label: 'On track', cls: 'bg-blue-900/40 text-blue-300 border-blue-700/60' };
    if (baselineProb >= 60) return { label: 'Caution', cls: 'bg-amber-900/40 text-amber-300 border-amber-700/60' };
    return { label: 'Behind', cls: 'bg-red-900/40 text-red-300 border-red-700/60' };
  })();

  const optimizedProb = (() => {
    const raw = (
      profile?.optimizationVariables?.optimizedScore?.probabilityOfSuccess ??
      (profile as any)?.retirementPlanningData?.optimizedScore ??
      null
    );
    if (raw == null) return null as number | null;
    const op = Number(raw);
    if (!Number.isFinite(op)) return null as number | null;
    const pct = op > 1 ? op : op * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  })();
  const hasSavedRetOptimization = optimizedProb !== null;
  const deltaPts = hasSavedRetOptimization ? (optimizedProb! - baselineProb) : null;

  const monthlyExp = Number(profile?.expectedMonthlyExpensesRetirement || 0);
  const annualExpenses = monthlyExp * 12;
  const annualGuaranteedIncome = (
    Number(profile?.socialSecurityBenefit || 0) +
    Number(profile?.spouseSocialSecurityBenefit || 0) +
    Number(profile?.pensionBenefit || 0) +
    Number(profile?.spousePensionBenefit || 0)
  ) * 12;
  const shortfall = Math.max(0, annualExpenses - annualGuaranteedIncome);
  const swrFromProfile = (() => {
    try {
      const r = (profile?.monteCarloSimulation?.retirementSimulation?.results?.safeWithdrawalRate);
      const v = Number(r);
      return Number.isFinite(v) && v > 0 && v < 0.1 ? v : 0;
    } catch { return 0; }
  })();
  const swr = swrFromProfile || 0.04;
  const requiredCapital = swr > 0 ? (shortfall / swr) : Infinity;
  const fundingProgress = requiredCapital > 0 && Number.isFinite(requiredCapital)
    ? Math.max(0, Math.min(100, Math.round((retirementAssetsTotal / requiredCapital) * 100)))
    : 0;

  const yearsCash = annualExpenses > 0 ? (cashLikeTotal / annualExpenses) : 0;

  const [gapCheck, setGapCheck] = useState<{ funded: boolean; first?: number; last?: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!profile) return;
        const isMarried = profile.maritalStatus === 'married' || profile.maritalStatus === 'partnered';
        const uRet = profile?.desiredRetirementAge || 65;
        const sRet = isMarried ? (profile?.spouseDesiredRetirementAge || uRet) : undefined;
        const bestUserSS = profile?.socialSecurityOptimization?.optimalSocialSecurityAge || profile?.socialSecurityClaimAge || 67;
        const bestSpSS = isMarried ? (profile?.socialSecurityOptimization?.optimalSpouseSocialSecurityAge || profile?.spouseSocialSecurityClaimAge || bestUserSS) : undefined;
        const payload: any = {
          retirementAge: uRet,
          ...(isMarried ? { spouseRetirementAge: sRet } : {}),
          socialSecurityAge: bestUserSS,
          ...(isMarried && bestSpSS ? { spouseSocialSecurityAge: bestSpSS } : {})
        };
        const res = await fetch('/api/calculate-optimized-withdrawal-sequence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
        if (!res.ok) { if (!cancelled) setGapCheck(null); return; }
        const data = await res.json();
        const rows: any[] = data?.projections || [];
        let shortfallSum = 0; let first: number | undefined; let last: number | undefined;
        for (const row of rows) {
          const n = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
          const gapU = row.age >= uRet && row.age < bestUserSS;
          const gapS = isMarried && sRet !== undefined && bestSpSS !== undefined && row.spouseAge >= sRet && row.spouseAge < bestSpSS;
          if (!gapU && !gapS) continue;
          if (first === undefined) first = row.age; last = row.age;
          const annualExp = n(row.monthlyExpenses) * 12;
          const totalInc = n(row.totalIncome) || (n(row.workingIncome) + n(row.spouseWorkingIncome) + n(row.socialSecurity) + n(row.spouseSocialSecurity) + n(row.pension) + n(row.spousePension) + n(row.partTimeIncome) + n(row.spousePartTimeIncome));
          const net = totalInc + n(row.totalWithdrawals) - n(row.withdrawalTax);
          const deficit = Math.max(0, annualExp - net);
          shortfallSum += deficit;
        }
        if (!cancelled) setGapCheck({ funded: shortfallSum <= 0, first, last });
      } catch { if (!cancelled) setGapCheck(null); }
    })();
    return () => { cancelled = true; };
  }, [profile]);

  // Fetch life goals with optimized caching
  const { data: lifeGoals = [], isLoading: isLoadingLifeGoals } = useQuery({
    queryKey: ['/api/life-goals'],
    queryFn: async () => {
      const response = await fetch('/api/life-goals');
      if (!response.ok) throw new Error('Failed to fetch life goals');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (replaces cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Fetch education goals with optimized caching
  const { data: educationData, isLoading: isLoadingEducation } = useQuery({
    queryKey: ['/api/education/goals'],
    queryFn: async () => {
      const response = await fetch('/api/education/goals');
      if (!response.ok) throw new Error('Failed to fetch education goals');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: 'always'
  });

  // Normalize to an array for downstream logic
  const educationGoals = React.useMemo(() => {
    if (!educationData) return [] as any[];
    // Some environments might still return an array; prefer .goals if present
    return Array.isArray(educationData) ? educationData : (educationData.goals ?? []);
  }, [educationData]);

  // (removed duplicate profile query; using single definition above)

  // Create/Update life goal mutation
  const createLifeGoalMutation = useMutation({
    mutationFn: async (goalData: LifeGoal) => {
      // Don't save auto-generated goals (retirement-auto, edu-*)
      if (goalData.id && typeof goalData.id === 'string' && 
          (goalData.id === 'retirement-auto' || goalData.id.startsWith('edu-'))) {
        throw new Error('Cannot modify auto-generated goals');
      }
      
      const url = goalData.id ? `/api/life-goals/${goalData.id}` : '/api/life-goals';
      const method = goalData.id ? 'PATCH' : 'POST';
      
      // Remove the id field for POST requests
      const bodyData = method === 'POST' ? 
        { ...goalData, id: undefined } : 
        goalData;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      
      if (!response.ok) throw new Error('Failed to save goal');
      return response.json();
    },
    onSuccess: () => {
      // Use debounced invalidation to prevent UI freezing
      debouncedInvalidation.invalidateQueries(['/api/life-goals'], 500);
      toast.success('Goal saved successfully');
    },
    onError: () => {
      toast.error('Failed to save goal');
    },
  });

  // Delete life goal mutation
  const deleteLifeGoalMutation = useMutation({
    mutationFn: async (goalId: string | number) => {
      // Only delete database-backed goals (numeric IDs)
      if (typeof goalId === 'string' && isNaN(parseInt(goalId))) {
        throw new Error('Cannot delete auto-generated goals');
      }
      const response = await fetch(`/api/life-goals/${goalId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete goal');
    },
    onSuccess: () => {
      // Use debounced invalidation to prevent UI freezing
      debouncedInvalidation.invalidateQueries(['/api/life-goals'], 300);
      toast.success('Goal deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete goal');
    },
  });

  // Delete education goal mutation
  const deleteEducationGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const response = await fetch(`/api/education/goals/${goalId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete education goal');
    },
    onSuccess: () => {
      // Use debounced invalidation for education goals
      debouncedInvalidation.invalidateQueries(['/api/education/goals'], 300);
      toast.success('Education goal deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete education goal');
    },
  });

  // Create education goal mutation (used when adding from Life Goals)
  const createEducationGoalMutation = useMutation({
    mutationFn: async (goalData: EducationGoalFromAPI) => {
      // Transform to API shape consistent with Education Funding Center
      const fallbackCost = goalData.goalType === 'college' ? 35000 : 15000;
      const apiData = {
        studentName: goalData.studentName,
        relationship: goalData.relationship || 'child',
        goalType: goalData.goalType,
        degreeType: (goalData as any).degreeType || 'undergraduate',
        stateOfResidence: goalData.stateOfResidence || profile?.state || null,
        startYear: goalData.startYear,
        endYear: goalData.endYear,
        years: goalData.years,
        costOption: goalData.costOption,
        collegeId: (goalData as any).collegeId,
        collegeName: goalData.collegeName || null,
        costPerYear: goalData.costPerYear || fallbackCost,
        inflationRate: (goalData as any).inflationRate ?? 2.4,
        includeRoomBoard: (goalData as any).includeRoomBoard,
        isInState: (goalData as any).isInState,
        // Server aggregates these but include sane inputs
        scholarshipPerYear: (goalData as any).scholarshipPerYear || 0,
        loanPerYear: (goalData as any).loanPerYear || 0,
        coverPercent: goalData.coverPercent,
        currentSavings: goalData.currentSavings || 0,
        monthlyContribution: goalData.monthlyContribution || 0,
        accountType: goalData.accountType || '529',
        expectedReturn: goalData.expectedReturn || 6,
        riskProfile: goalData.riskProfile || 'moderate',
        fundingSources: goalData.fundingSources || []
      } as any;

      const response = await fetch('/api/education/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to create education goal: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      // Refresh both lists
      queryClient.invalidateQueries({ queryKey: ['/api/education/goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/life-goals'] });
      toast.success('Education goal created successfully');
    },
    onError: (err: any) => {
      const msg = err?.message || 'Failed to create education goal';
      toast.error(msg);
    }
  });

  // Combine all goals with optimized processing
  const allGoals = React.useMemo(() => {
    // Early return if data is still loading to prevent blocking operations
    if (isLoadingLifeGoals || isLoadingEducation) {
      return [];
    }

    const goals: LifeGoal[] = [...lifeGoals];
    
    // Add retirement goal if available
    if (profile?.calculations?.retirementScore) {
      // Calculate retirement date based on when the first spouse retires
      const calculateRetirementDate = () => {
        if (!profile.dateOfBirth && !profile.spouseDateOfBirth) return undefined;
        
        const currentDate = new Date();
        const userRetirementAge = profile.retirementAge || 65;
        
        // Calculate user's retirement date if DOB is available
        let userRetirementDate: Date | null = null;
        if (profile.dateOfBirth) {
          const userDOB = new Date(profile.dateOfBirth);
          userRetirementDate = new Date(
            userDOB.getFullYear() + userRetirementAge,
            userDOB.getMonth(),
            userDOB.getDate()
          );
        }
        
        // Calculate spouse's retirement date if DOB is available
        let spouseRetirementDate: Date | null = null;
        if (profile.spouseDateOfBirth) {
          const spouseDOB = new Date(profile.spouseDateOfBirth);
          const spouseRetirementAge = profile.retirementAge || 65; // Using same retirement age for both
          spouseRetirementDate = new Date(
            spouseDOB.getFullYear() + spouseRetirementAge,
            spouseDOB.getMonth(),
            spouseDOB.getDate()
          );
        }
        
        // Return the earlier retirement date (whoever retires first)
        if (userRetirementDate && spouseRetirementDate) {
          return userRetirementDate <= spouseRetirementDate ? 
            userRetirementDate.toISOString() : 
            spouseRetirementDate.toISOString();
        } else if (userRetirementDate) {
          return userRetirementDate.toISOString();
        } else if (spouseRetirementDate) {
          return spouseRetirementDate.toISOString();
        }
        
        // Fallback to old calculation if DOBs not available
        return new Date(
          currentDate.getFullYear() + (userRetirementAge - (profile.age || 65)),
          currentDate.getMonth(),
          1
        ).toISOString();
      };
      
      // Calculate total monthly retirement contributions from both spouses
      const calculateMonthlyRetirementContributions = () => {
        let totalMonthly = 0;
        
        // User's retirement contributions (401k, etc.) - these are already monthly
        if (profile.retirementContributions) {
          const userContributions = typeof profile.retirementContributions === 'object' ? 
            profile.retirementContributions : {};
          const userEmployee = Number(userContributions.employee || 0);
          const userEmployer = Number(userContributions.employer || 0);
          totalMonthly += userEmployee + userEmployer;
        }
        
        // Spouse's retirement contributions (401k, etc.) - these are already monthly
        if (profile.spouseRetirementContributions) {
          const spouseContributions = typeof profile.spouseRetirementContributions === 'object' ? 
            profile.spouseRetirementContributions : {};
          const spouseEmployee = Number(spouseContributions.employee || 0);
          const spouseEmployer = Number(spouseContributions.employer || 0);
          totalMonthly += spouseEmployee + spouseEmployer;
        }
        
        // User's IRA contributions (annual, so divide by 12)
        const userTraditionalIRA = Number(profile.traditionalIRAContribution || 0) / 12;
        const userRothIRA = Number(profile.rothIRAContribution || 0) / 12;
        totalMonthly += userTraditionalIRA + userRothIRA;
        
        // Spouse's IRA contributions (annual, so divide by 12)
        const spouseTraditionalIRA = Number(profile.spouseTraditionalIRAContribution || 0) / 12;
        const spouseRothIRA = Number(profile.spouseRothIRAContribution || 0) / 12;
        totalMonthly += spouseTraditionalIRA + spouseRothIRA;
        
        return totalMonthly;
      };
      
      const retirementGoal: LifeGoal = {
        id: 'retirement-auto',
        goalType: 'retirement',
        goalName: 'Retirement',
        targetDate: calculateRetirementDate(),
        targetAmount: profile.calculations?.retirementProjections?.targetRetirementSavings,
        currentAmount: profile.calculations?.totalAssets,
        monthlyContribution: calculateMonthlyRetirementContributions(),
        fundingPercentage: profile.calculations?.retirementScore || 0,
        status: profile.calculations?.retirementScore >= 80 ? 'on-track' : 
                profile.calculations?.retirementScore >= 60 ? 'at-risk' : 'behind',
        metadata: {
          retirementAge: profile.retirementAge,
          currentAge: profile.age,
          successProbability: profile.calculations?.retirementProjections?.successProbability
        }
      };
      
      // Only add if not already exists
      if (!goals.find(g => g.goalType === 'retirement')) {
        goals.unshift(retirementGoal); // Add at beginning
      }
    }
    
    // Add education goals
    educationGoals.forEach((eduGoal: EducationGoalFromAPI) => {
      const existingGoal = goals.find(g => 
        g.goalType === 'education' && g.linkedEntityId === eduGoal.id
      );
      
      if (!existingGoal) {
        goals.push({
          id: `edu-${eduGoal.id}`,
          goalType: 'education',
          goalName: `${eduGoal.studentName}'s Education`,
          targetDate: new Date(eduGoal.startYear, 8, 1).toISOString(),
          targetAmount: eduGoal.projection?.totalCost,
          currentAmount: eduGoal.currentSavings,
          monthlyContribution: eduGoal.monthlyContribution,
          fundingPercentage: eduGoal.projection?.fundingPercentage,
          linkedEntityId: eduGoal.id,
          linkedEntityType: 'education_goals',
          status: (eduGoal.projection?.fundingPercentage || 0) >= 80 ? 'on-track' : 
                  (eduGoal.projection?.fundingPercentage || 0) >= 60 ? 'at-risk' : 'behind',
          metadata: eduGoal
        });
      }
    });
    
    return goals;
  }, [
    lifeGoals,
    educationGoals,
    profile?.calculations?.retirementScore,
    profile?.dateOfBirth,
    profile?.spouseDateOfBirth,
    profile?.retirementAge,
    profile?.age,
    isLoadingLifeGoals,
    isLoadingEducation
  ]);

  const handleAddGoal = (goalType: string) => {
    console.log('handleAddGoal called with goalType:', goalType);
    setSelectedGoalType(goalType);
    
    if (goalType === 'education') {
      setShowEducationForm(true);
    } else {
      setShowUniversalForm(true);
    }
  };

  const handleEditGoal = (goal: LifeGoal) => {
    if (goal.goalType === 'education' && goal.metadata) {
      setEditingEducationGoal(goal.metadata);
      setShowEducationForm(true);
    } else if (goal.goalType !== 'retirement') {
      setSelectedGoal(goal);
      setSelectedGoalType(goal.goalType);
      setShowUniversalForm(true);
    }
  };

  const handleDeleteGoal = async () => {
    if (!deleteConfirmGoal) return;
    
    if (deleteConfirmGoal.goalType === 'retirement') {
      toast.error('Retirement goal cannot be deleted');
      setDeleteConfirmGoal(null);
      return;
    }
    
    if (deleteConfirmGoal.goalType === 'education' && deleteConfirmGoal.linkedEntityId) {
      // Delete education goal via the education API
      await deleteEducationGoalMutation.mutateAsync(deleteConfirmGoal.linkedEntityId);
      setDeleteConfirmGoal(null);
      return;
    }
    
    if (deleteConfirmGoal.id && typeof deleteConfirmGoal.id === 'number') {
      await deleteLifeGoalMutation.mutateAsync(deleteConfirmGoal.id);
      setDeleteConfirmGoal(null);
    }
  };

  const navigateToPlanningCenter = (goalType: string) => {
    switch (goalType) {
      case 'retirement':
        window.dispatchEvent(new CustomEvent('navigateToRetirement'));
        break;
      case 'education':
        window.dispatchEvent(new CustomEvent('navigateToEducation'));
        break;
      case 'debt-free':
        window.dispatchEvent(new CustomEvent('navigateToDebtManagement'));
        break;
      default:
        break;
    }
  };

  const handleViewAnalysis = async (goal: LifeGoal) => {
    setAnalysisGoal(goal);
    setShowAnalysisModal(true);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Helper function to calculate funding percentage for a goal
  const calculateFundingPercentage = (goal: LifeGoal): number => {
    // If we have explicit funding percentage, use it
    if (goal.fundingPercentage !== undefined) {
      return goal.fundingPercentage;
    }
    
    // Try to calculate from funding sources
    if (goal.metadata?.fundingSources && goal.targetAmount) {
      let totalFunding = 0;
      goal.metadata.fundingSources.forEach((source: any) => {
        if (source.type === 'asset' || source.type === 'loan') {
          totalFunding += source.amount || 0;
        } else if (source.type === 'monthly_savings' && goal.targetDate) {
          const monthsToGoal = Math.max(0, 
            (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30)
          );
          totalFunding += (source.monthlyAmount || 0) * monthsToGoal;
        }
      });
      return Math.min(100, (totalFunding / goal.targetAmount) * 100);
    }
    
    // Fallback to current amount
    if (goal.currentAmount && goal.targetAmount) {
      return Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
    }
    
    return 0;
  };

  if (isLoadingLifeGoals || isLoadingEducation) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 mb-8 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Life Goals</h1>
              <p className="text-blue-200">Track and manage all your financial goals in one place</p>
            </div>
          </div>
          
          {/* Add Goal Dropdown */}
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowAddGoalDrawer(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Life Goal
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {(isLoadingLifeGoals || isLoadingEducation) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-gray-800/50 border-gray-700 animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-700 w-9 h-9"></div>
                    <div>
                      <div className="h-5 bg-gray-700 rounded w-32 mb-2"></div>
                      <div className="h-4 bg-gray-700 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-700 rounded w-16"></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-4 bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-8 bg-gray-700 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Goals Grid */}
      {!isLoadingLifeGoals && !isLoadingEducation && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allGoals.map((goal, index) => {
          const config = goalTypeConfig[goal.goalType];
          const Icon = config.icon;
          const isEducationGoal = goal.goalType === 'education';
          const educationMeta: any = isEducationGoal ? goal.metadata : null;
          const educationProjection = educationMeta?.projection;
          const savedEducationOptimization = isEducationGoal ? educationMeta?.savedOptimization : null;
          const normalizeProbability = (value: unknown): number | null => {
            const num = Number(value);
            if (!Number.isFinite(num)) return null;
            const pct = num > 1 ? num : num * 100;
            const clamped = Math.max(0, Math.min(100, pct));
            return Math.round(clamped);
          };
          const savedOptimizationResult = savedEducationOptimization?.result;
          const baselineEducationProb = isEducationGoal
            ? normalizeProbability(
                savedOptimizationResult?.baselineProbabilityOfSuccess ??
                savedOptimizationResult?.baselineProjection?.probabilityOfSuccess ??
                educationProjection?.probabilityOfSuccess ??
                educationMeta?.probabilityOfSuccess ??
                educationMeta?.projectionData?.probabilityOfSuccess ??
                0
              ) ?? 0
            : 0;
          const optimizedEducationProbRaw = isEducationGoal
            ? normalizeProbability(
                savedOptimizationResult?.optimizedProbabilityOfSuccess ??
                savedOptimizationResult?.probabilityOfSuccess ??
                savedOptimizationResult?.monteCarlo?.probabilityOfSuccess ??
                savedOptimizationResult?.monteCarloAnalysis?.probabilityOfSuccess
              )
            : null;
          const hasOptimizationProbability = typeof optimizedEducationProbRaw === 'number';
          const optimizedEducationProb = hasOptimizationProbability
            ? optimizedEducationProbRaw!
            : baselineEducationProb;
          const educationDelta = hasOptimizationProbability ? optimizedEducationProb - baselineEducationProb : 0;
          const hasSavedEduOptimization = Boolean(savedEducationOptimization?.result);
          const educationTotalCost = isEducationGoal ? Number(educationProjection?.totalCost ?? 0) : 0;
          const educationTotalFunded = isEducationGoal ? Number(educationProjection?.totalFunded ?? 0) : 0;
          const educationTotalLoans = isEducationGoal ? Number(educationProjection?.totalLoans ?? 0) : 0;
          const educationShortfall = isEducationGoal
            ? Math.max(0, educationTotalCost - educationTotalFunded - educationTotalLoans)
            : 0;
          const educationTargetLabel = isEducationGoal
            ? (() => {
                const start = educationMeta?.startYear;
                const end = educationMeta?.endYear;
                if (start && end) return `${start}–${end}`;
                if (start) return `${start}`;
                return 'Not set';
              })()
            : '';

          return (
            <motion.div
              key={goal.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={`bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all cursor-pointer min-h-[360px]`}
                onClick={() => {
                  // Only show detail view for non-system goals (custom life goals)
                  if (!['retirement', 'education', 'debt-free'].includes(goal.goalType)) {
                    setDetailViewGoal(goal);
                    setShowDetailView(true);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.lightColor}`}>
                        <Icon className={`h-5 w-5 ${config.textColor}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-white">{goal.goalType === 'retirement' ? 'Retirement Readiness' : goal.goalName}</CardTitle>
                        <p className="text-sm text-gray-400">{config.description}</p>
                      </div>
                    </div>
                    {goal.status && (
                      <Badge 
                        variant={goal.status === 'on-track' ? 'default' : 
                                goal.status === 'at-risk' ? 'secondary' : 'destructive'}
                      >
                        {goal.status.replace('-', ' ')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Retirement Readiness (specialized) */}
                  {goal.goalType === 'retirement' && (
                    <div className="space-y-4">
                      {/* Primary metric: Success probability gauge */}
                      <div className="flex items-center gap-3">
                        <Gauge
                          value={baselineProb}
                          max={100}
                          size="sm"
                          showValue
                          colors={{ low: '#EF4444', medium: '#F59E0B', high: '#10B981' }}
                          thresholds={{ medium: 60, high: 80 }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${readinessChip.cls}`}>{readinessChip.label}</span>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-gray-400/80 hover:text-gray-300 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-sm p-3 !bg-gray-900 !border-gray-600 !text-gray-200">
                                  <div className="text-xs space-y-1">
                                    <p><span className="font-semibold">Gauge</span>: Baseline success probability (current plan)</p>
                                    <p><span className="font-semibold">Number</span>: Saved optimized success probability</p>
                                  </div>
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>

                      {/* Optimized summary under the gauge for consistent height */}
                      <div className="mt-2">
                        {hasSavedRetOptimization ? (
                          <div className="space-y-1">
                            <div>
                              <span className="text-white font-semibold text-xl">{optimizedProb}%</span>
                            </div>
                            <p className="text-xs text-purple-300">
                              After optimization: {deltaPts !== null && deltaPts !== 0 ? `${deltaPts > 0 ? '+' : ''}${Math.round(deltaPts)}%` : '+0%'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Visit retirement planning to optimize</p>
                        )}
                      </div>


                      {/* CTA row */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={() => navigateToPlanningCenter('retirement')}
                          className="bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_10px_rgba(168,85,247,0.35)]"
                          size="sm"
                        >
                          Planning Center
                        </Button>
                        {(baselineProb < 80 || fundingProgress < 100) && (
                          <Button
                            onClick={() => navigateToPlanningCenter('retirement')}
                            className="bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_10px_rgba(168,85,247,0.35)]"
                            size="sm"
                          >
                            Optimize variables
                          </Button>
                        )}
                        {gapCheck && !gapCheck.funded && (
                          <Button onClick={() => navigateToPlanningCenter('retirement')} variant="outline" className="border-blue-500/40 text-blue-300 hover:bg-blue-900/20" size="sm">
                            View Social Security timing
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Education Goal Overview (specialized) */}
                  {isEducationGoal && (
                    <div className="space-y-4">
                      {/* Primary metric: Education success probability gauge */}
                      <div className="flex items-center gap-3">
                        <Gauge
                          value={baselineEducationProb}
                          max={100}
                          size="sm"
                          showValue
                          colors={{ low: '#EF4444', medium: '#F59E0B', high: '#10B981' }}
                          thresholds={{ medium: 65, high: 80 }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${baselineEducationProb >= 80 ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60' : baselineEducationProb >= 60 ? 'bg-amber-900/40 text-amber-300 border-amber-700/60' : 'bg-red-900/40 text-red-300 border-red-700/60'}`}>
                              {baselineEducationProb >= 80 ? 'On track' : baselineEducationProb >= 60 ? 'Caution' : 'Behind'}
                            </span>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-gray-400/80 hover:text-gray-300 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-sm p-3 !bg-gray-900 !border-gray-600 !text-gray-200">
                                  <div className="text-xs space-y-1">
                                    <p><span className="font-semibold">Gauge</span>: Baseline education success probability</p>
                                    <p><span className="font-semibold">Right side</span>: Saved optimized probability (if available)</p>
                                  </div>
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>

                      {/* Optimized summary under the gauge for consistent height */}
                      <div className="mt-2">
                        {hasSavedEduOptimization ? (
                          <div className="space-y-1">
                            <div>
                              <span className="text-white font-semibold text-xl">{optimizedEducationProb}%</span>
                            </div>
                            <p className="text-xs text-purple-300">
                              After optimization: {educationDelta > 0 ? `+${Math.round(educationDelta)}%` : educationDelta < 0 ? `${Math.round(educationDelta)}%` : '+0%'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Visit Education Funding to optimize</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-gray-700/30 p-3 rounded">
                          <p className="text-xs text-gray-400">Total Cost</p>
                          <p className="text-sm font-semibold text-white">{formatCurrency(educationTotalCost)}</p>
                        </div>
                        <div className="bg-gray-700/30 p-3 rounded">
                          <p className="text-xs text-gray-400">Funding Shortfall</p>
                          <p className={`text-sm font-semibold ${educationShortfall > 0 ? 'text-red-400' : 'text-emerald-300'}`}>
                            {educationShortfall > 0 ? formatCurrency(educationShortfall) : 'Fully funded'}
                          </p>
                        </div>
                        <div className="bg-gray-700/30 p-3 rounded">
                          <p className="text-xs text-gray-400">Target Years</p>
                          <p className="text-sm font-semibold text-white">{educationTargetLabel}</p>
                        </div>
                        <div className="bg-gray-700/30 p-3 rounded">
                          <p className="text-xs text-gray-400">After optimization</p>
                          <p className="text-sm font-semibold text-white">
                            {hasSavedEduOptimization ? `${optimizedEducationProb}%` : 'Not saved yet'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar (non-retirement generic) */}
                  {!['retirement', 'education'].includes(goal.goalType) && (() => {
                    const fundingPercent = calculateFundingPercentage(goal);
                    if (fundingPercent > 0 || goal.targetAmount) {
                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Funding Progress</span>
                            <span className="text-white font-semibold">
                              {Math.round(fundingPercent)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${getProgressColor(fundingPercent)}`}
                              style={{ width: `${Math.min(100, fundingPercent)}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Key Metrics (non-retirement generic) */}
                  {!['retirement', 'education'].includes(goal.goalType) && (
                    <div className="grid grid-cols-2 gap-3">
                      {goal.targetAmount && (
                        <div className="bg-gray-700/30 p-2 rounded">
                        <p className="text-xs text-gray-400">Target</p>
                        <p className="text-sm font-semibold text-white">
                          {formatCurrency(goal.targetAmount)}
                        </p>
                      </div>
                    )}
                    {(goal.currentAmount !== undefined || goal.fundingPercentage !== undefined) && (
                      <div className="bg-gray-700/30 p-2 rounded">
                        <p className="text-xs text-gray-400">Current</p>
                        <p className="text-sm font-semibold text-white">
                          {(() => {
// Calculate current funded amount based on funding percentage if available
                            if (goal.fundingPercentage !== undefined && goal.targetAmount) {
                              return formatCurrency(goal.targetAmount * (goal.fundingPercentage / 100));
                            }
                            
                            // Try to calculate from funding sources if available
                            if (goal.metadata?.fundingSources && goal.targetAmount) {
                              let totalFunding = 0;
                              goal.metadata.fundingSources.forEach((source: any) => {
                                if (source.type === 'asset' || source.type === 'loan') {
                                  totalFunding += source.amount || 0;
                                } else if (source.type === 'monthly_savings' && goal.targetDate) {
                                  const monthsToGoal = Math.max(0, 
                                    (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30)
                                  );
                                  totalFunding += (source.monthlyAmount || 0) * monthsToGoal;
                                }
                              });
                              return formatCurrency(Math.min(totalFunding, goal.targetAmount));
                            }
                            
                            // Fallback to simple currentAmount if funding percentage not available
                            return formatCurrency(goal.currentAmount || 0);
                          })()}
                        </p>
                      </div>
                    )}
                    {goal.targetAmount && (
                      <div className="bg-gray-700/30 p-2 rounded">
                        <p className="text-xs text-gray-400">Shortfall</p>
                        <p className="text-sm font-semibold text-red-400">
                          {(() => {
                            // Calculate shortfall based on funding percentage if available
                            if (goal.fundingPercentage !== undefined) {
                              const fundedAmount = (goal.targetAmount * (goal.fundingPercentage / 100));
                              return formatCurrency(Math.max(0, goal.targetAmount - fundedAmount));
                            }
                            
                            // Try to calculate from funding sources if available
                            if (goal.metadata?.fundingSources && goal.targetAmount) {
                              let totalFunding = 0;
                              goal.metadata.fundingSources.forEach((source: any) => {
                                if (source.type === 'asset' || source.type === 'loan') {
                                  totalFunding += source.amount || 0;
                                } else if (source.type === 'monthly_savings' && goal.targetDate) {
                                  const monthsToGoal = Math.max(0, 
                                    (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30)
                                  );
                                  totalFunding += (source.monthlyAmount || 0) * monthsToGoal;
                                }
                              });
                              return formatCurrency(Math.max(0, goal.targetAmount - Math.min(totalFunding, goal.targetAmount)));
                            }
                            
                            // Fallback to simple calculation if funding percentage not available
                            return formatCurrency(Math.max(0, goal.targetAmount - (goal.currentAmount || 0)));
                          })()}
                        </p>
                      </div>
                    )}
                    {goal.monthlyContribution && (
                      <div className="bg-gray-700/30 p-2 rounded">
                        <p className="text-xs text-gray-400">Monthly</p>
                        <p className="text-sm font-semibold text-white">
                          {formatCurrency(goal.monthlyContribution)}
                        </p>
                      </div>
                    )}
                    {goal.targetDate && (
                      <div className="bg-gray-700/30 p-2 rounded">
                        <p className="text-xs text-gray-400">Target Date</p>
                        <p className="text-sm font-semibold text-white">
                          {formatDate(goal.targetDate)}
                        </p>
                      </div>
                    )}
                  </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    
                    {goal.goalType === 'education' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
                          onClick={() => handleEditGoal(goal)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 bg-gray-800 border border-gray-600 hover:border-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmGoal(goal);
                          }}
                          title="Delete goal"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => navigateToPlanningCenter('education')}
                        >
                          <ChevronRight className="h-4 w-4 mr-1" />
                          Funding Center
                        </Button>
                      </>
                    )}
                    
                    {goal.goalType === 'debt-free' && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => navigateToPlanningCenter('debt-free')}
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Debt Center
                      </Button>
                    )}
                    
                    {!['retirement', 'education', 'debt-free'].includes(goal.goalType) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGoal(goal);
                            setSelectedGoalType(goal.goalType);
                            setShowUniversalForm(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 bg-gray-800 border border-gray-600 hover:border-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmGoal(goal);
                          }}
                          title="Delete goal"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white border-purple-500 hover:border-purple-400 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewAnalysis(goal);
                          }}
                        >
                          <BarChart3 className="h-4 w-4 mr-1" />
                          View Analysis
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
          })}
        </div>
      )}

      {/* Forms */}
      {showEducationForm && (
        <GoalFormModal
          goal={editingEducationGoal}
          onClose={() => {
            setShowEducationForm(false);
            setEditingEducationGoal(null);
          }}
          onSave={(goal) => {
            // Persist the education goal via API so it appears across the app
            createEducationGoalMutation.mutate(goal as unknown as EducationGoalFromAPI);
            setShowEducationForm(false);
            setEditingEducationGoal(null);
          }}
        />
      )}
      
      <UniversalGoalFormEnhanced
        isOpen={showUniversalForm}
        onClose={() => {
          setShowUniversalForm(false);
          setSelectedGoal(null);
          setSelectedGoalType('');
        }}
        goalType={selectedGoalType}
        initialGoal={selectedGoal}
      />

      {/* Add Goal Drawer */}
      <Drawer
        shouldScaleBackground={false}
        open={showAddGoalDrawer}
        onOpenChange={(open) => setShowAddGoalDrawer(open)}
      >
        <DrawerContent className="bg-gray-900 border-gray-800 text-white h-[85vh] mt-0 left-0 sm:left-16 md:left-64 right-0 overflow-hidden">
          <DrawerHeader className="px-6 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-white">Create Life Goal</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close"
                  className="rounded-full text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  <X className="h-5 w-5" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-6 pb-6 overflow-y-auto h-[calc(85vh-64px)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Button className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white"
                onClick={() => { handleAddGoal('education'); setShowAddGoalDrawer(false); }}>
                <GraduationCap className="h-4 w-4 mr-2" /> Education
              </Button>
              <Button className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white"
                onClick={() => { handleAddGoal('home-purchase'); setShowAddGoalDrawer(false); }}>
                <Home className="h-4 w-4 mr-2" /> Buying First Home
              </Button>
              <Button className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white"
                onClick={() => { handleAddGoal('investment-property'); setShowAddGoalDrawer(false); }}>
                <Building2 className="h-4 w-4 mr-2" /> Investment Property
              </Button>
              <Button className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white"
                onClick={() => { handleAddGoal('debt-free'); setShowAddGoalDrawer(false); }}>
                <CreditCard className="h-4 w-4 mr-2" /> Debt-Free
              </Button>
              <Button className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white"
                onClick={() => { handleAddGoal('business'); setShowAddGoalDrawer(false); }}>
                <Briefcase className="h-4 w-4 mr-2" /> Start a Business
              </Button>
              <Button className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white"
                onClick={() => { handleAddGoal('custom'); setShowAddGoalDrawer(false); }}>
                <Sparkles className="h-4 w-4 mr-2" /> Custom Goal
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmGoal} onOpenChange={(open) => !open && setDeleteConfirmGoal(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-white">
              {deleteConfirmGoal?.goalType === 'education' ? 'Delete Education Goal' : 'Delete Life Goal'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {deleteConfirmGoal?.goalType === 'education'
                ? 'Are you sure you want to delete the education goal '
                : 'Are you sure you want to delete this goal '}
              <span className="text-white font-medium">
                {deleteConfirmGoal?.goalName || (deleteConfirmGoal?.goalType === 'education' ? 'this student' : 'this goal')}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel 
              className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white"
              onClick={() => setDeleteConfirmGoal(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 border-0"
              onClick={handleDeleteGoal}
            >
              Delete Goal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Life Goal Detail View */}
      {showDetailView && detailViewGoal && (
        <LifeGoalDetailView
          goal={detailViewGoal}
          isOpen={showDetailView}
          onClose={() => {
            setShowDetailView(false);
            setDetailViewGoal(null);
          }}
          onUpdate={(updatedGoal) => {
            // Refresh the goals list
            queryClient.invalidateQueries({ queryKey: ['/api/life-goals'] });
            setDetailViewGoal(updatedGoal);
          }}
        />
      )}

      {/* Goal Analysis Drawer */}
      <Drawer
        shouldScaleBackground={false}
        open={showAnalysisModal}
        onOpenChange={(open) => setShowAnalysisModal(open)}
      >
        <DrawerContent className="bg-gray-900 border-gray-800 text-white h-[95vh] mt-0 left-0 sm:left-16 md:left-64 right-0 overflow-hidden">
          <DrawerHeader className="px-6 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-white">
                {analysisGoal?.goalName} - Detailed Analysis
              </DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close analysis"
                  className="rounded-full text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  <X className="h-5 w-5" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          {analysisGoal && (
            <div className="px-6 pb-6 overflow-y-auto h-[calc(95vh-64px)]">
              <LifeGoalDetailView
                goal={analysisGoal}
                isOpen={showAnalysisModal}
                userProfile={profile}
                onClose={() => setShowAnalysisModal(false)}
                onUpdate={(updatedGoal) => {
                  queryClient.invalidateQueries({ queryKey: ['/api/life-goals'] });
                  setAnalysisGoal(updatedGoal);
                }}
              />
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
    </ErrorBoundary>
  );
};

export const LifeGoals = React.memo(LifeGoalsComponent);
