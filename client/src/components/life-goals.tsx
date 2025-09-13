import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Gauge } from "@/components/ui/gauge";
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { GoalFormModal } from './education-goal-form';
import { UniversalGoalFormModal } from './universal-goal-form';
import { UniversalGoalFormEnhanced } from './universal-goal-form-enhanced';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [geminiRecommendations, setGeminiRecommendations] = useState<string[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const queryClient = useQueryClient();

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
    const op = Number(profile?.optimizationVariables?.optimizedScore?.probabilityOfSuccess || 0);
    return op > 1 ? Math.round(op) : Math.round(op * 100);
  })();
  const deltaPts = optimizedProb ? (optimizedProb - baselineProb) : 0;

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

  // Fetch life goals
  const { data: lifeGoals = [], isLoading: isLoadingLifeGoals } = useQuery({
    queryKey: ['/api/life-goals'],
    queryFn: async () => {
      const response = await fetch('/api/life-goals');
      if (!response.ok) throw new Error('Failed to fetch life goals');
      return response.json();
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    cacheTime: 60000  // Keep in cache for 1 minute
  });

  // Fetch education goals
  const { data: educationGoals = [], isLoading: isLoadingEducation } = useQuery({
    queryKey: ['/api/education/goals'],
    queryFn: async () => {
      const response = await fetch('/api/education/goals');
      if (!response.ok) throw new Error('Failed to fetch education goals');
      return response.json();
    },
    staleTime: 30000,
    cacheTime: 60000
  });

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
      queryClient.invalidateQueries({ queryKey: ['/api/life-goals'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/life-goals'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/education/goals'] });
      toast.success('Education goal deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete education goal');
    },
  });

  // Combine all goals
  const allGoals = React.useMemo(() => {
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
  }, [lifeGoals, educationGoals, profile]);

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
    setLoadingRecommendations(true);
    setGeminiRecommendations([]);

    try {
      // Fetch user's financial profile to pass to Gemini
      const profileResponse = await fetch('/api/financial-profile');
      const userProfile = profileResponse.ok ? await profileResponse.json() : null;

      // Calculate shortfall
      const fundingPercentage = calculateFundingPercentage(goal);
      const currentFunding = goal.targetAmount ? goal.targetAmount * (fundingPercentage / 100) : 0;
      const shortfall = Math.max(0, (goal.targetAmount || 0) - currentFunding);

      // Prepare context for Gemini
      const prompt = `
        I need personalized recommendations for achieving a financial goal. This is NOT a retirement goal - the user needs 100% funding to purchase this asset/achieve this goal. Focus on the FUNDING SHORTFALL and provide specific, actionable recommendations to close the gap.

        Goal Details:
        - Goal Type: ${goal.goalType}
        - Goal Name: ${goal.goalName}
        - Target Amount: $${goal.targetAmount?.toLocaleString() || 0}
        - Current Funding: $${currentFunding.toLocaleString()}
        - FUNDING SHORTFALL: $${shortfall.toLocaleString()} (THIS IS THE KEY METRIC - USER NEEDS THIS AMOUNT)
        - Target Date: ${goal.targetDate ? new Date(goal.targetDate).toLocaleDateString() : 'Not set'}
        - Months to Goal: ${goal.targetDate ? Math.max(0, Math.round((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30))) : 'Unknown'}
        - Current Monthly Contribution: $${goal.monthlyContribution?.toLocaleString() || 0}
        - Funding Sources: ${JSON.stringify(goal.metadata?.fundingSources || [])}

        User Financial Context:
        - Monthly Cash Flow: $${userProfile?.calculations?.monthlyCashFlow?.toLocaleString() || 'Unknown'}
        - Total Assets: $${userProfile?.calculations?.totalAssets?.toLocaleString() || 'Unknown'}
        - Total Liquid Assets: $${userProfile?.calculations?.totalLiquidAssets?.toLocaleString() || 'Unknown'}
        - Home Value: $${userProfile?.homeValue?.toLocaleString() || 0}
        - Mortgage Balance: $${userProfile?.mortgageBalance?.toLocaleString() || 0}
        - Home Equity Available: $${((userProfile?.homeValue || 0) - (userProfile?.mortgageBalance || 0)).toLocaleString()}
        - 401k Balance: $${userProfile?.retirement401k?.toLocaleString() || 0}
        - Spouse 401k Balance: $${userProfile?.spouseRetirement401k?.toLocaleString() || 0}
        - Taxable Brokerage: $${userProfile?.taxableBrokerage?.toLocaleString() || 0}
        - Emergency Fund: $${userProfile?.emergencyFund?.toLocaleString() || 0}
        - Monthly Income: $${((userProfile?.annualIncome || 0) / 12).toLocaleString()}
        - Spouse Monthly Income: $${((userProfile?.spouseAnnualIncome || 0) / 12).toLocaleString()}

        CRITICAL: The user has a $${shortfall.toLocaleString()} SHORTFALL that needs to be funded. 
        ${shortfall > 0 ? `
        This is NOT a retirement goal where 80-90% funding might be acceptable. The user NEEDS the full $${goal.targetAmount?.toLocaleString()} to ${goal.goalType === 'investment-property' ? 'purchase the investment property' : goal.goalType === 'home-purchase' ? 'buy their home' : goal.goalType === 'business' ? 'start their business' : 'achieve this goal'}.
        
        Provide 3-5 SPECIFIC recommendations to fund the $${shortfall.toLocaleString()} shortfall. Consider these funding sources in order of preference:
        
        1. Monthly Cash Flow: If user has positive monthly cash flow, calculate exactly how much extra they could contribute monthly to close the gap by the target date
        2. Taxable Brokerage/Investment Accounts: Suggest reallocating from taxable accounts if available
        3. Home Equity Line of Credit (HELOC): If user has home equity > $100k, suggest HELOC for the shortfall amount
        4. 401(k) Loan: If user/spouse has 401k balance > 2x shortfall, suggest 401k loan (max $50k or 50% of balance)
        5. Reduce Emergency Fund: Only if emergency fund > 6 months expenses
        6. Extend Timeline: Calculate how much longer needed with current contributions
        7. Reduce Target Amount: As last resort, suggest adjusting goal amount

        Be SPECIFIC with dollar amounts and timelines. For example:
        - "Increase monthly contributions by $X to close the $${shortfall.toLocaleString()} gap by [date]"
        - "Consider a $${Math.min(shortfall, (userProfile?.homeValue || 0) - (userProfile?.mortgageBalance || 0) - 100000).toLocaleString()} HELOC against your home equity"
        - "Take a $${Math.min(50000, shortfall, (userProfile?.retirement401k || 0) * 0.5).toLocaleString()} loan from your 401(k)"
        ` : `
        The user has FULLY FUNDED this goal. Provide recommendations to:
        1. Protect the funding (ensure it's in appropriate accounts)
        2. Optimize for taxes
        3. Consider if they can achieve the goal sooner
        4. Ensure proper insurance/protection
        `}

        Return recommendations as "urgent" type if shortfall > 20% of target, "caution" if 5-20%, "info" for specific strategies, and "success" only if fully funded.

        Format your response as a JSON array of recommendation objects, each with:
        {
          "type": "success" | "info" | "caution" | "urgent",
          "text": "Specific recommendation text"
        }
      `;

      // Call Gemini API
      const geminiResponse = await fetch('/api/generate-goal-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, goalData: goal })
      });

      if (geminiResponse.ok) {
        const data = await geminiResponse.json();
        if (data.recommendations) {
          setGeminiRecommendations(data.recommendations);
        }
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Life Goal
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              sideOffset={8}
              className="w-56 bg-gray-800 border-gray-700"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddGoal('education');
                }}
                className="text-gray-300 hover:text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white"
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                Education
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddGoal('home-purchase');
                }}
                className="text-gray-300 hover:text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white"
              >
                <Home className="h-4 w-4 mr-2" />
                Buying First Home
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddGoal('investment-property');
                }}
                className="text-gray-300 hover:text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Buying Investment Property
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddGoal('debt-free');
                }}
                className="text-gray-300 hover:text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Debt-Free
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddGoal('business');
                }}
                className="text-gray-300 hover:text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Start a New Business
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddGoal('custom');
                }}
                className="text-gray-300 hover:text-white hover:bg-gray-700 focus:bg-gray-700 focus:text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Custom Goal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allGoals.map((goal, index) => {
          const config = goalTypeConfig[goal.goalType];
          const Icon = config.icon;
          
          return (
            <motion.div
              key={goal.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={`bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all cursor-pointer`}
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
                            <span className="text-white font-semibold text-lg">{baselineProb}%</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${readinessChip.cls}`}>{readinessChip.label}</span>
                          </div>
                          {deltaPts !== 0 && (
                            <p className="text-xs text-gray-400">{deltaPts > 0 ? `+${deltaPts}` : `${deltaPts}`} pts with optimized plan</p>
                          )}
                        </div>
                      </div>

                      {/* Secondary metric: Funding progress */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">Funding Progress</span>
                          <span className="text-xs text-gray-300">{fundingProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full ${fundingProgress >= 100 ? 'bg-emerald-500' : fundingProgress >= 80 ? 'bg-blue-500' : fundingProgress >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${fundingProgress}%` }} />
                        </div>
                      </div>

                      {/* Risk signals */}
                      <div className="flex flex-wrap gap-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${gapCheck?.funded ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50' : 'bg-amber-900/30 text-amber-300 border-amber-700/50'}`}>
                          Gap years {gapCheck?.funded ? 'funded' : 'needs plan'}{gapCheck?.first && gapCheck?.last ? ` (${gapCheck.first}-${gapCheck.last})` : ''}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-blue-900/30 text-blue-200 border-blue-700/50">
                          SS ages: You {profile?.socialSecurityClaimAge || '—'}{profile?.maritalStatus === 'married' && profile?.spouseSocialSecurityClaimAge ? ` / Sp ${profile.spouseSocialSecurityClaimAge}` : ''}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-purple-900/30 text-purple-200 border-purple-700/50">
                          Cash buffer: {yearsCash.toFixed(1)} yrs
                        </span>
                      </div>

                      {/* CTA row */}
                      <div className="flex gap-2 pt-1">
                        <Button onClick={() => navigateToPlanningCenter('retirement')} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white" size="sm">
                          Planning Center
                        </Button>
                        {(baselineProb < 80 || fundingProgress < 100) && (
                          <Button onClick={() => navigateToPlanningCenter('retirement')} variant="outline" className="border-purple-500/40 text-purple-300 hover:bg-purple-900/20" size="sm">
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

                  {/* Progress Bar (non-retirement generic) */}
                  {goal.goalType !== 'retirement' && (() => {
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
                  {goal.goalType !== 'retirement' && (
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
                  
                  {/* Action Buttons (non-retirement generic) */}
                  <div className="flex gap-2 pt-2">
                    {goal.goalType === 'retirement' ? null : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
                          onClick={() => {
                            if (goal.goalType === 'education') handleEditGoal(goal);
                            else {
                              setSelectedGoal(goal);
                              setSelectedGoalType(goal.goalType);
                              setShowUniversalForm(true);
                            }
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </>
                    )}
                    
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
                            handleEditGoal(goal);
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

      {/* Forms */}
      {showEducationForm && (
        <GoalFormModal
          goal={editingEducationGoal}
          onClose={() => {
            setShowEducationForm(false);
            setEditingEducationGoal(null);
          }}
          onSave={(goal) => {
            // The education goal will be saved through the education funding center API
            // and will automatically sync to life goals
            setShowEducationForm(false);
            setEditingEducationGoal(null);
            queryClient.invalidateQueries({ queryKey: ['/api/education/goals'] });
          }}
        />
      )}
      
      {showUniversalForm && (
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
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmGoal} onOpenChange={(open) => !open && setDeleteConfirmGoal(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-white">
              Delete Education Goal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete the education goal for{' '}
              <span className="text-white font-medium">
                {deleteConfirmGoal?.goalName || 'this student'}
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

      {/* Goal Analysis Modal */}
      <Dialog open={showAnalysisModal} onOpenChange={setShowAnalysisModal}>
        <DialogContent className="max-w-none w-[calc(100vw-4rem)] h-[80vh] bg-gray-900 border-gray-800 text-white overflow-hidden fixed left-16 top-20 translate-x-0 translate-y-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">
              {analysisGoal?.goalName} - Detailed Analysis
            </DialogTitle>
          </DialogHeader>
          
          {analysisGoal && (
            <LifeGoalDetailView
              goal={analysisGoal}
              isOpen={showAnalysisModal}
              userProfile={profile}
              onClose={() => setShowAnalysisModal(false)}
              onUpdate={(updatedGoal) => {
                // Refresh the goals list and update local modal state
                queryClient.invalidateQueries({ queryKey: ['/api/life-goals'] });
                setAnalysisGoal(updatedGoal);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
    </ErrorBoundary>
  );
};

export const LifeGoals = React.memo(LifeGoalsComponent);
