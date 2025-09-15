import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  Sparkles
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { EducationAIChatbot } from './education-ai-chatbot';
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
  fundingSources?: any[];
  expectedReturn?: number;
  riskProfile?: string;
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

export function EducationFundingCenter() {
  const [selectedGoal, setSelectedGoal] = useState<EducationGoal | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [whatIfVariables, setWhatIfVariables] = useState({
    annualCost: '',
    inflationRate: '',
    scholarships: '',
    monthlyContribution: '',
    expectedReturn: '',
    currentSavings: ''
  });
  const [scenarioResult, setScenarioResult] = useState<any>(null);
  const [isCalculatingScenario, setIsCalculatingScenario] = useState(false);
  const [isSavingScenario, setIsSavingScenario] = useState(false);
  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const queryClient = useQueryClient();

  // Initialize What-If variables with current goal data when goal is selected
  React.useEffect(() => {
    if (selectedGoal) {
      // Map risk profile to expected return (same mapping as in education goal form)
      const riskProfileReturns: { [key: string]: number } = {
        'conservative': 4,
        'moderate': 6,
        'aggressive': 8,
        'glide': 6 // Glide path starts with moderate baseline
      };
      
      // Get expected return from risk profile mapping or fall back to stored expectedReturn
      let expectedReturn = '6'; // Default
      if (selectedGoal.riskProfile && riskProfileReturns[selectedGoal.riskProfile] !== undefined) {
        expectedReturn = riskProfileReturns[selectedGoal.riskProfile].toString();
      } else if (selectedGoal.expectedReturn) {
        expectedReturn = selectedGoal.expectedReturn.toString();
      }
      
      // First set defaults from current goal
      const defaultVariables = {
        annualCost: selectedGoal.costPerYear?.toString() || '',
        inflationRate: '5', // Default inflation rate used in calculations
        scholarships: '0', // Default scholarship amount
        monthlyContribution: selectedGoal.monthlyContribution?.toString() || '',
        expectedReturn: expectedReturn,
        currentSavings: selectedGoal.currentSavings?.toString() || ''
      };
      
      setWhatIfVariables(defaultVariables);
      
      // Try to load any saved scenario for this goal
      loadSavedScenario();
    }
  }, [selectedGoal]);

  // Load saved What-If scenario if exists
  const loadSavedScenario = async () => {
    if (!selectedGoal?.id) return;
    
    try {
      const response = await fetch(`/api/education/saved-scenario/${selectedGoal.id}`);
      if (response.ok) {
        const savedScenario = await response.json();
        setWhatIfVariables(savedScenario.variables);
        setScenarioResult(savedScenario.result);
      }
    } catch (error) {
      // Silently fail - just means no saved scenario exists
      console.log('No saved scenario found for goal:', selectedGoal.id);
    }
  };

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
      inflationRate: 5.0,
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
  const calculateScenario = async () => {
    if (!selectedGoal?.id) return;
    
    setIsCalculatingScenario(true);
    try {
      const response = await fetch('/api/education/calculate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: selectedGoal.id,
          variables: {
            annualCost: whatIfVariables.annualCost ? parseFloat(whatIfVariables.annualCost) : undefined,
            inflationRate: whatIfVariables.inflationRate ? parseFloat(whatIfVariables.inflationRate) : undefined,
            scholarships: whatIfVariables.scholarships ? parseFloat(whatIfVariables.scholarships) : undefined,
            monthlyContribution: whatIfVariables.monthlyContribution ? parseFloat(whatIfVariables.monthlyContribution) : undefined,
            expectedReturn: whatIfVariables.expectedReturn ? parseFloat(whatIfVariables.expectedReturn) : undefined,
            currentSavings: whatIfVariables.currentSavings ? parseFloat(whatIfVariables.currentSavings) : undefined,
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to calculate scenario');
      }
      
      const result = await response.json();
      setScenarioResult(result);
      toast.success('Scenario calculated successfully');
    } catch (error) {
      console.error('Error calculating scenario:', error);
      toast.error('Failed to calculate scenario');
    } finally {
      setIsCalculatingScenario(false);
    }
  };

  // Save What-If scenario
  const saveScenario = async () => {
    if (!selectedGoal?.id || !scenarioResult) return;
    
    setIsSavingScenario(true);
    try {
      const response = await fetch('/api/education/save-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: selectedGoal.id,
          variables: whatIfVariables,
          result: scenarioResult
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save scenario');
      }
      
      toast.success('Scenario saved successfully');
    } catch (error) {
      console.error('Error saving scenario:', error);
      toast.error('Failed to save scenario');
    } finally {
      setIsSavingScenario(false);
    }
  };

  // Calculate aggregated metrics (guard for undefined goals)
  const totalCost = (goals || []).reduce((sum: number, goal: EducationGoal) => 
    sum + (goal.projection?.totalCost || 0), 0
  );
  const totalFunded = (goals || []).reduce((sum: number, goal: EducationGoal) => 
    sum + (goal.projection?.totalFunded || 0), 0
  );
  const totalGap = totalCost - totalFunded;
  const overallFundingPercentage = totalCost > 0 
    ? Math.round((totalFunded / totalCost) * 100) 
    : 0;

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
            {/* AI Chatbot Button */}
            <div className="relative group">
              <Button
                onClick={() => setShowAIChatbot(true)}
                variant="ghost"
                size="sm"
                className="bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 hover:from-blue-700 hover:via-purple-700 hover:to-purple-800 text-white border-0 transition-all duration-300 transform hover:scale-105"
              >
                <div className="relative">
                  <Sparkles className="h-5 w-5" />
                  {/* Glitter effect */}
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-300 rounded-full animate-ping"></div>
                  <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-purple-300 rounded-full animate-pulse delay-150"></div>
                </div>
              </Button>
              {/* Tooltip */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Ask Affluvia AI
              </div>
            </div>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            label="Total Cost"
            value={`$${totalCost.toLocaleString()} (includes tuition inflation)`}
            icon={<DollarSign className="h-5 w-5" />}
            trend="neutral"
          />
          <MetricCard
            label="Total Savings"
            value={`$${totalFunded.toLocaleString()}`}
            icon={<PiggyBank className="h-5 w-5" />}
            trend="positive"
          />
          <MetricCard
            label="Funding Gap"
            value={`$${totalGap.toLocaleString()}`}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend={totalGap > 0 ? "negative" : "positive"}
          />
          <MetricCard
            label="Funding %"
            value={`${overallFundingPercentage}%`}
            icon={<Target className="h-5 w-5" />}
            trend={overallFundingPercentage >= 80 ? "positive" : "negative"}
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
              whatIfVariables={whatIfVariables}
              onWhatIfChange={setWhatIfVariables}
              scenarioResult={scenarioResult}
              onCalculateScenario={calculateScenario}
              isCalculatingScenario={isCalculatingScenario}
              onSaveScenario={saveScenario}
              isSavingScenario={isSavingScenario}
            />
          )}

          {/* Personalized Recommendations */}
          {selectedGoal && (
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

      {/* AI Chatbot */}
      <EducationAIChatbot
        isOpen={showAIChatbot}
        onClose={() => setShowAIChatbot(false)}
        educationGoals={goals || []}
      />
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
  whatIfVariables,
  onWhatIfChange,
  scenarioResult,
  onCalculateScenario,
  isCalculatingScenario,
  onSaveScenario,
  isSavingScenario
}: {
  goal: EducationGoal;
  whatIfVariables: any;
  onWhatIfChange: (variables: any) => void;
  scenarioResult: any;
  onCalculateScenario: () => void;
  isCalculatingScenario: boolean;
  onSaveScenario: () => void;
  isSavingScenario: boolean;
}) {
  const successProbability = (goal.projection?.probabilityOfSuccess ?? (goal.projection as any)?.monteCarloAnalysis?.probabilityOfSuccess ?? 0) as number;

  return (
    <div className="space-y-6">
          {/* 1. Funding Coverage, Charts, and Monte Carlo Success Gauge */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      const totalFunded = scenarioResult?.totalFunded || goal.projection?.totalFunded || 0;
                      const totalCost = scenarioResult?.totalCost || goal.projection?.totalCost || 0;
                      const fundingGap = Math.max(0, totalCost - totalFunded);
                      
                      return {
                        labels: ['Funded', 'Gap'],
                        datasets: [{
                          data: [totalFunded, fundingGap],
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
                    Funding: {scenarioResult?.fundingPercentage || goal.projection?.fundingPercentage || 0}%
                  </p>
                  <p className="text-sm text-gray-400">
                    Monthly needed: ${(goal.projection?.monthlyContributionNeeded || 0).toLocaleString()}
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
                        labels: (scenarioResult?.years || goal.projection?.years || []).map((y: any) => y.toString()),
                        datasets: [
                          {
                            label: '529/Savings',
                            data: scenarioResult?.funded || goal.projection?.funded || [],
                            backgroundColor: '#10b981',
                          },
                          {
                            label: 'Loans',
                            data: scenarioResult?.loanAmounts || goal.projection?.loanAmounts || (scenarioResult?.costs || goal.projection?.costs || []).map(() => 0),
                            backgroundColor: '#3b82f6',
                          },
                          {
                            label: 'Gap',
                            data: (scenarioResult?.costs || goal.projection?.costs || []).map((cost: any, i: number) => {
                              const funded = (scenarioResult?.funded || goal.projection?.funded || [])[i] || 0;
                              const loans = (scenarioResult?.loanAmounts || goal.projection?.loanAmounts || [])[i] || 0;
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

            {/* Monte Carlo Success Probability Gauge */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  Monte Carlo Success Probability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center py-4">
                  <Gauge
                    value={successProbability}
                    max={100}
                    size="md"
                    showValue={true}
                    valueLabel=""
                    colors={{ low: '#EF4444', medium: '#F59E0B', high: '#10B981' }}
                    thresholds={{ medium: 65, high: 80 }}
                  />
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Probability of meeting education funding goals
                  </p>
                  <p className="text-xs text-gray-500 text-center">
                    Target: 80%+ recommended for confidence
                  </p>
                  <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium ${
                    successProbability >= 80 ? 'bg-green-900/30 text-green-400' :
                    successProbability >= 65 ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-red-900/30 text-red-400'
                  }`}>
                    {successProbability >= 80 ? 'High Confidence' : successProbability >= 65 ? 'Moderate Risk' : 'Needs Improvement'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 2. What-If Scenarios with Dropdown Menus */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                What-If Scenarios
                {(() => {
                  const fundingGap = Math.max(0, (goal.projection?.totalCost || 0) - (goal.projection?.totalFunded || 0));
                  if (fundingGap > 0) {
                    return (
                      <span className="text-sm font-normal text-gray-400 ml-2">
                        (Explore scenarios to close your ${fundingGap.toLocaleString()} funding gap)
                      </span>
                    );
                  }
                  return null;
                })()}
              </CardTitle>
              <p className="text-sm text-gray-400 mt-2">
                Adjust the variables below and click Submit to see how different strategies affect your funding plan
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Annual Cost */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Annual Cost</label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={whatIfVariables.annualCost}
                      onChange={(e) => onWhatIfChange({ ...whatIfVariables, annualCost: e.target.value })}
                      placeholder="Enter amount..."
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                    />
                    <Select
                      value={whatIfVariables.annualCost}
                      onValueChange={(value) => 
                        onWhatIfChange({ ...whatIfVariables, annualCost: value })
                      }
                    >
                      <SelectTrigger className="absolute right-0 top-0 w-8 h-full bg-transparent border-none">
                        <span className="text-gray-400">▼</span>
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="25000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$25,000</SelectItem>
                        <SelectItem value="35000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$35,000</SelectItem>
                        <SelectItem value="45000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$45,000</SelectItem>
                        <SelectItem value="55000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$55,000</SelectItem>
                        <SelectItem value="65000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$65,000</SelectItem>
                        <SelectItem value="75000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$75,000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tuition Inflation Rate */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Tuition Inflation Rate</label>
                  <Select
                    value={whatIfVariables.inflationRate}
                    onValueChange={(value) => 
                      onWhatIfChange({ ...whatIfVariables, inflationRate: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
                      <SelectValue placeholder="Select rate..." className="text-white placeholder:text-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="2" className="text-white hover:bg-gray-700 focus:bg-gray-700">2%</SelectItem>
                      <SelectItem value="3" className="text-white hover:bg-gray-700 focus:bg-gray-700">3%</SelectItem>
                      <SelectItem value="4" className="text-white hover:bg-gray-700 focus:bg-gray-700">4%</SelectItem>
                      <SelectItem value="5" className="text-white hover:bg-gray-700 focus:bg-gray-700">5%</SelectItem>
                      <SelectItem value="6" className="text-white hover:bg-gray-700 focus:bg-gray-700">6%</SelectItem>
                      <SelectItem value="7" className="text-white hover:bg-gray-700 focus:bg-gray-700">7%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Scholarships */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Annual Scholarships</label>
                  <Select
                    value={whatIfVariables.scholarships}
                    onValueChange={(value) => 
                      onWhatIfChange({ ...whatIfVariables, scholarships: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
                      <SelectValue placeholder="Select amount..." className="text-white placeholder:text-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="0" className="text-white hover:bg-gray-700 focus:bg-gray-700">$0</SelectItem>
                      <SelectItem value="5000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$5,000</SelectItem>
                      <SelectItem value="10000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$10,000</SelectItem>
                      <SelectItem value="15000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$15,000</SelectItem>
                      <SelectItem value="20000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$20,000</SelectItem>
                      <SelectItem value="25000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$25,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Monthly Contribution */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Monthly Contribution</label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={whatIfVariables.monthlyContribution}
                      onChange={(e) => onWhatIfChange({ ...whatIfVariables, monthlyContribution: e.target.value })}
                      placeholder="Enter amount..."
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                    />
                    <Select
                      value={whatIfVariables.monthlyContribution}
                      onValueChange={(value) => 
                        onWhatIfChange({ ...whatIfVariables, monthlyContribution: value })
                      }
                    >
                      <SelectTrigger className="absolute right-0 top-0 w-8 h-full bg-transparent border-none">
                        <span className="text-gray-400">▼</span>
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 max-h-40 overflow-y-auto">
                        <SelectItem value="200" className="text-white hover:bg-gray-700 focus:bg-gray-700">$200</SelectItem>
                        <SelectItem value="250" className="text-white hover:bg-gray-700 focus:bg-gray-700">$250</SelectItem>
                        <SelectItem value="300" className="text-white hover:bg-gray-700 focus:bg-gray-700">$300</SelectItem>
                        <SelectItem value="350" className="text-white hover:bg-gray-700 focus:bg-gray-700">$350</SelectItem>
                        <SelectItem value="400" className="text-white hover:bg-gray-700 focus:bg-gray-700">$400</SelectItem>
                        <SelectItem value="450" className="text-white hover:bg-gray-700 focus:bg-gray-700">$450</SelectItem>
                        <SelectItem value="500" className="text-white hover:bg-gray-700 focus:bg-gray-700">$500</SelectItem>
                        <SelectItem value="550" className="text-white hover:bg-gray-700 focus:bg-gray-700">$550</SelectItem>
                        <SelectItem value="600" className="text-white hover:bg-gray-700 focus:bg-gray-700">$600</SelectItem>
                        <SelectItem value="650" className="text-white hover:bg-gray-700 focus:bg-gray-700">$650</SelectItem>
                        <SelectItem value="700" className="text-white hover:bg-gray-700 focus:bg-gray-700">$700</SelectItem>
                        <SelectItem value="750" className="text-white hover:bg-gray-700 focus:bg-gray-700">$750</SelectItem>
                        <SelectItem value="800" className="text-white hover:bg-gray-700 focus:bg-gray-700">$800</SelectItem>
                        <SelectItem value="850" className="text-white hover:bg-gray-700 focus:bg-gray-700">$850</SelectItem>
                        <SelectItem value="900" className="text-white hover:bg-gray-700 focus:bg-gray-700">$900</SelectItem>
                        <SelectItem value="950" className="text-white hover:bg-gray-700 focus:bg-gray-700">$950</SelectItem>
                        <SelectItem value="1000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,000</SelectItem>
                        <SelectItem value="1050" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,050</SelectItem>
                        <SelectItem value="1100" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,100</SelectItem>
                        <SelectItem value="1150" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,150</SelectItem>
                        <SelectItem value="1200" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,200</SelectItem>
                        <SelectItem value="1250" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,250</SelectItem>
                        <SelectItem value="1300" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,300</SelectItem>
                        <SelectItem value="1350" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,350</SelectItem>
                        <SelectItem value="1400" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,400</SelectItem>
                        <SelectItem value="1450" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,450</SelectItem>
                        <SelectItem value="1500" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,500</SelectItem>
                        <SelectItem value="1550" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,550</SelectItem>
                        <SelectItem value="1600" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,600</SelectItem>
                        <SelectItem value="1650" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,650</SelectItem>
                        <SelectItem value="1700" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,700</SelectItem>
                        <SelectItem value="1750" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,750</SelectItem>
                        <SelectItem value="1800" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,800</SelectItem>
                        <SelectItem value="1850" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,850</SelectItem>
                        <SelectItem value="1900" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,900</SelectItem>
                        <SelectItem value="1950" className="text-white hover:bg-gray-700 focus:bg-gray-700">$1,950</SelectItem>
                        <SelectItem value="2000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,000</SelectItem>
                        <SelectItem value="2050" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,050</SelectItem>
                        <SelectItem value="2100" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,100</SelectItem>
                        <SelectItem value="2150" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,150</SelectItem>
                        <SelectItem value="2200" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,200</SelectItem>
                        <SelectItem value="2250" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,250</SelectItem>
                        <SelectItem value="2300" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,300</SelectItem>
                        <SelectItem value="2350" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,350</SelectItem>
                        <SelectItem value="2400" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,400</SelectItem>
                        <SelectItem value="2450" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,450</SelectItem>
                        <SelectItem value="2500" className="text-white hover:bg-gray-700 focus:bg-gray-700">$2,500</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Expected Return */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Expected Return</label>
                  <Select
                    value={whatIfVariables.expectedReturn}
                    onValueChange={(value) => 
                      onWhatIfChange({ ...whatIfVariables, expectedReturn: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
                      <SelectValue placeholder="Select return..." className="text-white placeholder:text-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="4" className="text-white hover:bg-gray-700 focus:bg-gray-700">4%</SelectItem>
                      <SelectItem value="5" className="text-white hover:bg-gray-700 focus:bg-gray-700">5%</SelectItem>
                      <SelectItem value="6" className="text-white hover:bg-gray-700 focus:bg-gray-700">6%</SelectItem>
                      <SelectItem value="7" className="text-white hover:bg-gray-700 focus:bg-gray-700">7%</SelectItem>
                      <SelectItem value="8" className="text-white hover:bg-gray-700 focus:bg-gray-700">8%</SelectItem>
                      <SelectItem value="9" className="text-white hover:bg-gray-700 focus:bg-gray-700">9%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Savings */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Current Savings</label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={whatIfVariables.currentSavings}
                      onChange={(e) => onWhatIfChange({ ...whatIfVariables, currentSavings: e.target.value })}
                      placeholder="Enter amount..."
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                    />
                    <Select
                      value={whatIfVariables.currentSavings}
                      onValueChange={(value) => 
                        onWhatIfChange({ ...whatIfVariables, currentSavings: value })
                      }
                    >
                      <SelectTrigger className="absolute right-0 top-0 w-8 h-full bg-transparent border-none">
                        <span className="text-gray-400">▼</span>
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="0" className="text-white hover:bg-gray-700 focus:bg-gray-700">$0</SelectItem>
                        <SelectItem value="5000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$5,000</SelectItem>
                        <SelectItem value="10000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$10,000</SelectItem>
                        <SelectItem value="25000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$25,000</SelectItem>
                        <SelectItem value="50000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$50,000</SelectItem>
                        <SelectItem value="75000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$75,000</SelectItem>
                        <SelectItem value="100000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$100,000</SelectItem>
                        <SelectItem value="150000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$150,000</SelectItem>
                        <SelectItem value="200000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$200,000</SelectItem>
                        <SelectItem value="250000" className="text-white hover:bg-gray-700 focus:bg-gray-700">$250,000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Submit and Save Buttons */}
              <div className="flex justify-center gap-4 pt-4">
                <Button
                  onClick={onCalculateScenario}
                  disabled={isCalculatingScenario}
                  className="bg-purple-600 hover:bg-purple-700 min-w-32"
                >
                  {isCalculatingScenario ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Calculating...
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
                
                {scenarioResult && (
                  <Button
                    onClick={onSaveScenario}
                    disabled={isSavingScenario}
                    variant="outline"
                    className="border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white min-w-32"
                  >
                    {isSavingScenario ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

    </div>
  );
}

// Personalized Recommendations Component
function PersonalizedRecommendations({ goalId }: { goalId?: string }) {
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

  if (isLoading || !recommendations?.recommendations?.length) {
    return null;
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-400" />
          Personalized Action Plan
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Prioritized recommendations to improve your education funding
        </p>
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
            <Badge variant="outline" className="mb-2">
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
