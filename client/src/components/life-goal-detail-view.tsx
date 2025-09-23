import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Home,
  Building2,
  Briefcase,
  CreditCard,
  Sparkles,
  TrendingUp,
  Calculator,
  DollarSign,
  Calendar,
  Target,
  Lightbulb,
  Info,
  Brain,
  PiggyBank,
  AlertCircle,
  Wallet,
  Banknote,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface FundingSource {
  id: string;
  type: 'asset' | 'loan' | 'monthly_savings';
  name: string;
  amount: number;
  interestRate?: number;
  termMonths?: number;
  monthlyAmount?: number;
}

interface LifeGoal {
  id: number;
  goalType: string;
  goalName: string;
  description?: string;
  targetDate: string;
  targetAmount: number;
  currentAmount?: number;
  fundingSources: FundingSource[];
  fundingPercentage?: number;
  priority?: 'high' | 'medium' | 'low';
  status?: 'on-track' | 'at-risk' | 'behind' | 'completed';
  metadata?: Record<string, unknown>;
}

interface WhatIfScenario {
  monthlySavings?: number;
  loanAmount?: number;
  loanRate?: number;
  targetDate?: string;
  targetAmount?: number;
}

interface ScenarioResult {
  fundingPercentage: number;
  fundingGap: number;
  monthlyPayment?: number;
  totalInterest?: number;
  breakEvenMonth?: number;
}

interface AIInsight {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  estimatedImpact?: string;
  fundingType?: 'cashflow' | 'investment' | 'heloc' | '401k' | 'other';
  monthlyPayment?: number | null;
  totalCost?: number;
  shortfallReduction?: number;
}

interface LifeGoalDetailViewProps {
  goal: LifeGoal;
  isOpen?: boolean;
  onClose: () => void;
  onUpdate?: (goal: LifeGoal) => void;
  userProfile?: any;
}

export function LifeGoalDetailView({
  goal,
  isOpen = true,
  onClose,
  onUpdate,
  userProfile
}: LifeGoalDetailViewProps) {
  const [activeTab, setActiveTab] = useState('analysis');
  const [whatIfScenario, setWhatIfScenario] = useState<WhatIfScenario>({
    monthlySavings: 500,
    loanAmount: 0,
    loanRate: 5,
    targetDate: goal.targetDate,
    targetAmount: goal.targetAmount
  });
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);

  // Fetch AI insights for the goal
  const { data: aiInsights, isLoading: insightsLoading } = useQuery({
    queryKey: ['/api/life-goal-insights', goal.id],
    queryFn: async () => {
      const response = await fetch(`/api/life-goal-insights/${goal.id}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      return response.json();
    },
    enabled: isOpen && !!goal.id
  });

  // Loading timer for AI insights generation
  const [insightsSeconds, setInsightsSeconds] = useState(0);
  useEffect(() => {
    let interval: any;
    if (insightsLoading) {
      setInsightsSeconds(0);
      interval = setInterval(() => setInsightsSeconds((s) => s + 1), 1000);
    }
    return () => interval && clearInterval(interval);
  }, [insightsLoading]);

  // Calculate what-if scenario
  const calculateScenarioMutation = useMutation({
    mutationFn: async (scenario: WhatIfScenario) => {
      const response = await fetch(`/api/life-goal-scenario/${goal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario)
      });
      if (!response.ok) throw new Error('Failed to calculate scenario');
      return response.json();
    },
    onSuccess: (data) => {
      setScenarioResult(data);
    }
  });

  // Calculate funding breakdown (funded portions only)
  const fundingBreakdown = React.useMemo(() => {
    let assetTotal = 0;
    let loanTotal = 0;
    let savingsTotal = 0;
    
    // Ensure fundingSources is an array
    const fundingSources = Array.isArray(goal.fundingSources) 
      ? goal.fundingSources 
      : (typeof goal.fundingSources === 'string' ? JSON.parse(goal.fundingSources) : []);
    
    fundingSources.forEach(source => {
      if (source.type === 'asset') {
        assetTotal += source.amount;
      } else if (source.type === 'loan') {
        loanTotal += source.amount;
      } else if (source.type === 'monthly_savings') {
        const monthsToGoal = Math.max(0,
          (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        savingsTotal += (source.monthlyAmount || 0) * monthsToGoal;
      }
    });
    
    return [
      { name: 'Assets', value: assetTotal, color: '#10b981' },
      { name: 'Loans', value: loanTotal, color: '#f59e0b' },
      { name: 'Savings', value: savingsTotal, color: '#3b82f6' }
    ].filter(item => item.value > 0);
  }, [goal]);

  // Build chart breakdown that includes shortfall so the pie equals target amount
  const chartBreakdown = React.useMemo(() => {
    const totalFunded = fundingBreakdown.reduce((sum, item) => sum + item.value, 0);
    const shortfall = Math.max(0, Number(goal.targetAmount || 0) - totalFunded);
    const data = [...fundingBreakdown];
    if (shortfall > 0) {
      data.push({ name: 'Funding Gap', value: shortfall, color: '#ef4444' });
    }
    return data;
  }, [fundingBreakdown, goal.targetAmount]);

  // Calculate time to goal
  const monthsToGoal = React.useMemo(() => {
    return Math.max(0,
      Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
  }, [goal.targetDate]);

  // Generate projection data
  const projectionData = React.useMemo(() => {
    const data = [];
    const currentDate = new Date();
    let accumulated = goal.currentAmount || 0;
    
    // Calculate monthly contribution from all sources
    let monthlyContribution = 0;
    const fundingSources = Array.isArray(goal.fundingSources) 
      ? goal.fundingSources 
      : (typeof goal.fundingSources === 'string' ? JSON.parse(goal.fundingSources) : []);
    
    fundingSources.forEach(source => {
      if (source.type === 'monthly_savings') {
        monthlyContribution += source.monthlyAmount || 0;
      }
    });
    
    for (let i = 0; i <= monthsToGoal; i++) {
      const date = new Date(currentDate);
      date.setMonth(date.getMonth() + i);
      
      accumulated += monthlyContribution;
      
      data.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        projected: Math.round(accumulated),
        target: goal.targetAmount
      });
    }
    
    return data;
  }, [goal, monthsToGoal]);

  const getGoalIcon = () => {
    const icons: Record<string, React.ElementType> = {
      'home-purchase': Home,
      'investment-property': Building2,
      'debt-free': CreditCard,
      'business': Briefcase,
      'custom': Sparkles
    };
    return icons[goal.goalType] || Sparkles;
  };

  const Icon = getGoalIcon();

  const handleScenarioChange = (field: keyof WhatIfScenario, value: any) => {
    setWhatIfScenario(prev => ({ ...prev, [field]: value }));
  };

  const runScenario = () => {
    calculateScenarioMutation.mutate(whatIfScenario);
  };

  return (
    <div className="w-full h-full overflow-hidden flex flex-col">
      <div className="w-full h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Icon className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold text-white">{goal.goalName}</h2>
              <p className="text-gray-400">{goal.description || 'Your financial goal'}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Target className="h-5 w-5 text-gray-400" />
                  <span className="text-xs text-gray-400">Target</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  ${Math.round(goal.targetAmount).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <span className="text-xs text-gray-400">Timeline</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {monthsToGoal} months
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(goal.targetDate).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="h-5 w-5 text-gray-400" />
                  <span className="text-xs text-gray-400">Coverage</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {Number(goal.fundingPercentage || 0).toFixed(1)}%
                </p>
                <Progress 
                  value={Number(goal.fundingPercentage || 0)} 
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <span className="text-xs text-gray-400">Gap</span>
                </div>
                <p className={`text-2xl font-bold ${
                  (goal.fundingPercentage || 0) >= 100 ? 'text-green-400' : 'text-red-400'
                }`}>
                  ${Math.max(0, Number(goal.targetAmount || 0) -
                    fundingBreakdown.reduce((sum, item) => sum + item.value, 0)
                  ).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800 mb-6">
              <TabsTrigger value="analysis" className="text-white data-[state=active]:bg-primary data-[state=active]:text-white">
                Analysis
              </TabsTrigger>
              <TabsTrigger value="insights" className="text-white data-[state=active]:bg-primary data-[state=active]:text-white">
                Insights
              </TabsTrigger>
            </TabsList>

            {/* Analysis Tab */}
            <TabsContent value="analysis" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Funding Breakdown Pie Chart */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Funding Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={chartBreakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ value }) => `$${value.toLocaleString()}`}
                        >
                          {chartBreakdown.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                          labelStyle={{ color: '#9ca3af' }}
                        />
                        <Legend 
                          wrapperStyle={{ color: '#ffffff' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Funding Sources List */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Funding Sources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(() => {
                      const fundingSources = Array.isArray(goal.fundingSources) 
                        ? goal.fundingSources 
                        : (typeof goal.fundingSources === 'string' ? JSON.parse(goal.fundingSources) : []);
                      return fundingSources.map((source) => (
                      <div key={source.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded">
                        <div className="flex items-center gap-2">
                          {source.type === 'asset' && <Wallet className="h-4 w-4 text-green-400" />}
                          {source.type === 'loan' && <Banknote className="h-4 w-4 text-yellow-400" />}
                          {source.type === 'monthly_savings' && <PiggyBank className="h-4 w-4 text-blue-400" />}
                          <div>
                            <p className="text-sm font-medium text-white">{source.name}</p>
                            {source.type === 'loan' && (
                              <p className="text-xs text-gray-400">
                                {source.interestRate}% for {source.termMonths} months
                              </p>
                            )}
                            {source.type === 'monthly_savings' && (
                              <p className="text-xs text-gray-400">
                                ${source.monthlyAmount}/month
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-white">
                          ${source.type === 'monthly_savings' 
                            ? ((source.monthlyAmount || 0) * monthsToGoal).toLocaleString()
                            : source.amount.toLocaleString()
                          }
                        </p>
                      </div>
                      ));
                    })()}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* AI Insights Tab */}
            <TabsContent value="insights" className="space-y-4">
              {/* Shortfall Summary Card */}
              {(() => {
                // Use the same calculation as the Gap card to ensure consistency
                const totalCurrentFunding = fundingBreakdown.reduce((sum, item) => sum + item.value, 0);
                const shortfall = Math.max(0, goal.targetAmount - totalCurrentFunding);
                const hasShortfall = shortfall > 100;
                
                if (hasShortfall && (goal.priority === 'high' || goal.priority === 'medium')) {
                  return (
                    <Alert className="bg-red-900/20 border-red-800 mb-6">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <div className="ml-2">
                        <p className="text-red-300 font-semibold">
                          Funding Gap: ${Math.round(shortfall).toLocaleString()}
                        </p>
                        <p className="text-red-200 text-sm mt-1">
                          This {goal.priority}-priority goal requires complete funding. 
                          Review the recommendations below to eliminate this shortfall.
                        </p>
                      </div>
                    </Alert>
                  );
                } else if (!hasShortfall) {
                  return (
                    <Alert className="bg-green-900/20 border-green-800 mb-6">
                      <AlertCircle className="h-5 w-5 text-green-400" />
                      <div className="ml-2">
                        <p className="text-green-300 font-semibold">
                          Goal Fully Funded! 
                        </p>
                        <p className="text-green-200 text-sm mt-1">
                          Excellent! This goal is on track with current funding sources.
                        </p>
                      </div>
                    </Alert>
                  );
                }
                return null;
              })()}

              {insightsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Brain className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
                    <p className="text-gray-200">
                      Analyzing funding strategies… <span className="text-gray-400">{insightsSeconds}s</span>
                    </p>
                  </div>
                </div>
              ) : aiInsights && aiInsights.length > 0 ? (
                <>
                  {/* Group insights by funding type */}
                  {(() => {
                    const groupedInsights: Record<string, typeof aiInsights> = {};
                    const summaryInsight = aiInsights.find((i: AIInsight) => 
                      i.title?.toLowerCase().includes('summary') || 
                      i.title?.toLowerCase().includes('combined')
                    );
                    const otherInsights = aiInsights.filter((i: AIInsight) => 
                      !i.title?.toLowerCase().includes('summary') && 
                      !i.title?.toLowerCase().includes('combined')
                    );
                    
                    return (
                      <>
                        {/* Funding Strategies */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-white mb-3">
                            Funding Elimination Strategies
                          </h3>
                          
                          {otherInsights.map((insight: AIInsight, index: number) => (
                            <Card key={index} className="bg-gray-800 border-gray-700">
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg ${
                                    insight.fundingType === 'cashflow' ? 'bg-green-900/20' :
                                    insight.fundingType === 'investment' ? 'bg-blue-900/20' :
                                    insight.fundingType === 'heloc' ? 'bg-yellow-900/20' :
                                    insight.fundingType === '401k' ? 'bg-orange-900/20' :
                                    'bg-purple-900/20'
                                  }`}>
                                    {insight.fundingType === 'cashflow' && <DollarSign className="h-5 w-5 text-green-400" />}
                                    {insight.fundingType === 'investment' && <TrendingUp className="h-5 w-5 text-blue-400" />}
                                    {insight.fundingType === 'heloc' && <Home className="h-5 w-5 text-yellow-400" />}
                                    {insight.fundingType === '401k' && <PiggyBank className="h-5 w-5 text-orange-400" />}
                                    {insight.fundingType === 'other' && <Lightbulb className="h-5 w-5 text-purple-400" />}
                                    {!insight.fundingType && <Lightbulb className="h-5 w-5 text-gray-400" />}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                      <h4 className="text-white font-medium">{insight.title}</h4>
                                      {insight.shortfallReduction && (
                                        <span className="text-sm font-semibold text-green-400">
                                          -${insight.shortfallReduction.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <p className="text-gray-200 text-sm mb-3">{insight.description}</p>
                                    
                                    {/* Financial Details */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                      {insight.monthlyPayment && (
                                        <div className="bg-gray-700/30 px-2 py-1 rounded">
                                          <p className="text-xs text-gray-400">Monthly</p>
                                          <p className="text-sm font-medium text-white">
                                            ${insight.monthlyPayment.toLocaleString()}/mo
                                          </p>
                                        </div>
                                      )}
                                      {insight.totalCost && insight.fundingType === 'heloc' && (
                                        <div className="bg-gray-700/30 px-2 py-1 rounded">
                                          <p className="text-xs text-gray-400">Total Cost</p>
                                          <p className="text-sm font-medium text-white">
                                            ${insight.totalCost.toLocaleString()}
                                          </p>
                                        </div>
                                      )}
                                      {insight.estimatedImpact && (
                                        <div className="bg-gray-700/30 px-2 py-1 rounded col-span-2 md:col-span-1">
                                          <p className="text-xs text-gray-400">Impact</p>
                                          <p className="text-sm font-medium text-white">
                                            {insight.estimatedImpact}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Implement Strategy button intentionally removed per request */}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        
                        {/* Summary Card */}
                        {summaryInsight && (
                          <Card className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-700">
                            <CardContent className="p-6">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-primary/20 rounded-lg">
                                  <Target className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-white">
                                  {summaryInsight.title}
                                </h3>
                              </div>
                              <p className="text-gray-100 mb-4">
                                {summaryInsight.description}
                              </p>
                              {summaryInsight.monthlyPayment && (
                                <div className="bg-gray-800/50 p-4 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-200">Total Monthly Commitment</span>
                                    <span className="text-2xl font-bold text-white">
                                      ${summaryInsight.monthlyPayment.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-8 text-center">
                    <Brain className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-200">Click to generate funding recommendations</p>
                    <Button 
                      className="mt-4 bg-primary hover:bg-primary/90"
                      onClick={() => window.location.reload()}
                    >
                      Generate Analysis
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
