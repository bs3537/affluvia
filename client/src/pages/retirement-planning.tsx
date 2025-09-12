import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gauge } from '@/components/ui/gauge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  TrendingUp, 
  Settings, 
  BarChart3, 
  Target,
  ArrowRight,
  RefreshCw,
  Save,
  Calculator,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  Heart,
  Sparkles,
  DollarSign,
  Users,
  User,
  X,
  CheckCircle,
  PieChart,
  Lightbulb,
  Shield,
  Clock,
  Briefcase,
  Wallet,
  Lock
} from 'lucide-react';
import { seedFromParams } from '@/lib/seed';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useRetirementScore } from '@/contexts/retirement-score-context';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import WithdrawalSequenceVisualization from '@/components/retirement/withdrawal-sequence-visualization';
import { MonteCarloWithdrawalVisualization } from '@/components/retirement/monte-carlo-withdrawal-visualization';
import { ImpactPortfolioBalanceNew } from '@/components/impact-portfolio-balance-new';
import { RetirementPortfolioProjectionsOptimized } from '@/components/retirement-portfolio-projections-optimized';
import { RetirementCashFlowSankey } from '@/components/retirement/cash-flow-sankey';
import { PortfolioProjectionChart } from '@/components/retirement/portfolio-projection-chart';
import { transformMonteCarloToCashFlow, type CashFlowData } from '@/lib/cash-flow-transformer';
import { useMonteCarloWorker } from '@/hooks/useMonteCarloWorker';
import { buildMonteCarloParams, calculateAge } from '@/lib/montecarlo-params';
import { calculateAIME, calculatePrimaryInsuranceAmount, calculateBenefitAtAge } from '@/utils/socialSecurityOptimizer';
import { RetirementMonteCarloWidget } from '@/components/retirement-monte-carlo-widget';
import { SocialSecurityOptimizer } from '@/components/retirement/SocialSecurityOptimizer';
import { StressTestContent } from '@/components/retirement/stress-test-content';
import SocialSecurityAnalysis from '@/components/retirement/SocialSecurityAnalysis';
import { RetirementInsights } from '@/components/retirement/retirement-insights';
import { RetirementBaselineWidget } from '@/components/retirement-baseline-widget';
import { RetirementOptimizationWidget } from '@/components/retirement-optimization-widget';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Removed ScenarioAnalysisComponent - now using ImpactPortfolioBalanceNew component


interface MonteCarloResult {
  probabilityOfSuccess: number;
  medianEndingBalance: number;
  scenarios: {
    successful: number;
    failed: number;
    total: number;
  };
  yearlyCashFlows?: any[];
  results?: any[]; // Monte Carlo simulation trials data
  sensitivityAnalysis?: {
    baselineSuccess: number;
    optimizedSuccess: number;
    absoluteChange: number;
    relativeChange: string;
    variableImpacts: Record<string, {
      change: number | string;
      expectedImpact: number;
      unit: string;
    }>;
  };
};

interface OptimizationVariables {
  retirementAge: number;
  spouseRetirementAge: number;
  socialSecurityAge: number;
  spouseSocialSecurityAge: number;
  socialSecurityBenefit?: number;      // Direct SS benefit override
  spouseSocialSecurityBenefit?: number; // Direct spouse SS benefit override
  pensionBenefit?: number;             // Monthly pension benefit
  spousePensionBenefit?: number;       // Monthly spouse pension benefit
  assetAllocation: string;
  spouseAssetAllocation: string;
  // Separate contribution fields to match intake form Step 11
  monthlyEmployee401k: number;        // Monthly employee 401k/403b contribution
  monthlyEmployer401k: number;        // Monthly employer match
  annualTraditionalIRA: number;       // Annual Traditional IRA
  annualRothIRA: number;              // Annual Roth IRA
  spouseMonthlyEmployee401k: number;  // Spouse monthly employee 401k/403b
  spouseMonthlyEmployer401k: number;  // Spouse monthly employer match
  spouseAnnualTraditionalIRA: number; // Spouse annual Traditional IRA
  spouseAnnualRothIRA: number;        // Spouse annual Roth IRA
  monthlyExpenses: number;
  partTimeIncome: number;
  spousePartTimeIncome: number;
  hasLongTermCareInsurance: boolean;
}


// Cash Flow Content Component
function CashFlowContent({
  variables,
  profile,
  optimizedScore,
  currentScore,
  setActiveTab,
  currentCashFlowData,
  optimizedCashFlowData,
  setCurrentCashFlowData,
  setOptimizedCashFlowData
}: {
  variables: any;
  profile?: any;
  optimizedScore?: any;
  currentScore?: any;
  setActiveTab: (tab: string) => void;
  currentCashFlowData: CashFlowData[] | null;
  optimizedCashFlowData: CashFlowData[] | null;
  setCurrentCashFlowData: (data: CashFlowData[] | null) => void;
  setOptimizedCashFlowData: (data: CashFlowData[] | null) => void;
  }) {
  const [isLoading, setIsLoading] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  
  // Helper function to check if cash flow data has detailed withdrawal breakdown
  const hasDetailedWithdrawalData = (data: CashFlowData[] | null): boolean => {
    if (!data?.length) return false;
    // Check if any entry has withdrawal breakdown fields populated
    // These fields indicate we have detailed data from the API
    return data.some(entry => 
      (entry.taxableWithdrawal !== undefined && entry.taxableWithdrawal !== null) ||
      (entry.taxDeferredWithdrawal !== undefined && entry.taxDeferredWithdrawal !== null) ||
      (entry.rothWithdrawal !== undefined && entry.rothWithdrawal !== null)
    );
  };

  // Fetch cash flow data when component mounts or when scores change
  useEffect(() => {
    const abortController = new AbortController();

    const fetchCashFlowData = async () => {
      // Skip fetching only if we have detailed withdrawal breakdown data
      const hasDetailedBaseline = hasDetailedWithdrawalData(currentCashFlowData);
      const hasDetailedOptimized = hasDetailedWithdrawalData(optimizedCashFlowData);

      // Only show spinner if we have no detailed data to display yet
      if (!hasDetailedBaseline && !hasDetailedOptimized) {
        setIsLoading(true);
      }

      try {
        const currentYear = new Date().getFullYear();
        const currentUserAge = profile?.age || 35;
        const lifeExpectancy = 93;
        const yearsToProject = lifeExpectancy - currentUserAge;

        const tasks: Promise<void>[] = [];

        // Fetch baseline data if we don't have detailed withdrawal breakdown
        if (!hasDetailedBaseline) {
          tasks.push(
            (async () => {
              try {
                const res = await fetch('/api/calculate-monte-carlo-withdrawal-sequence', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ startFromCurrentAge: true, projectionYears: yearsToProject }),
                  signal: abortController.signal
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data?.projections?.length) {
                    const flows = transformMonteCarloToCashFlow(
                      data.projections,
                      {
                        retirementAge: profile?.desiredRetirementAge || variables?.retirementAge || 67,
                        spouseRetirementAge: profile?.spouseDesiredRetirementAge || variables?.spouseRetirementAge || 67,
                        socialSecurityAge: profile?.socialSecurityClaimAge || variables?.socialSecurityAge || 67,
                        spouseSocialSecurityAge: profile?.spouseSocialSecurityClaimAge || variables?.spouseSocialSecurityAge || 67,
                        monthlyExpenses: profile?.expectedMonthlyExpensesRetirement ?? variables?.monthlyExpenses ?? undefined,
                        partTimeIncome: profile?.partTimeIncomeRetirement || variables?.partTimeIncome || 0,
                        spousePartTimeIncome: profile?.spousePartTimeIncomeRetirement || variables?.spousePartTimeIncome || 0
                      },
                      profile,
                      false
                    );
                    setCurrentCashFlowData(flows);
                    return;
                  }
                }
              } catch (error) {
                if (!abortController.signal.aborted) {
                  console.warn('Failed to fetch baseline data from API:', error);
                }
              }
              // Fallback to transforming currentScore if endpoint unavailable
              if (currentScore?.yearlyCashFlows?.length) {
                const flows = transformMonteCarloToCashFlow(currentScore.yearlyCashFlows, variables, profile, false);
                setCurrentCashFlowData(flows);
              }
            })()
          );
        }

        // Fetch optimized data if we don't have detailed withdrawal breakdown
        if (!hasDetailedOptimized && variables) {
          tasks.push(
            (async () => {
              try {
                const res = await fetch('/api/calculate-monte-carlo-withdrawal-sequence', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...variables, startFromCurrentAge: true, projectionYears: yearsToProject }),
                  signal: abortController.signal
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data?.projections?.length) {
                    const flows = transformMonteCarloToCashFlow(
                      data.projections,
                      {
                        retirementAge: variables?.retirementAge || profile?.desiredRetirementAge || 67,
                        spouseRetirementAge: variables?.spouseRetirementAge || profile?.spouseDesiredRetirementAge || 67,
                        socialSecurityAge: variables?.socialSecurityAge || profile?.socialSecurityClaimAge || 67,
                        spouseSocialSecurityAge: variables?.spouseSocialSecurityAge || profile?.spouseSocialSecurityClaimAge || 67,
                        monthlyExpenses: variables?.monthlyExpenses ?? profile?.expectedMonthlyExpensesRetirement ?? undefined,
                        partTimeIncome: variables?.partTimeIncome || profile?.partTimeIncomeRetirement || 0,
                        spousePartTimeIncome: variables?.spousePartTimeIncome || profile?.spousePartTimeIncomeRetirement || 0
                      },
                      profile,
                      true
                    );
                    setOptimizedCashFlowData(flows);
                    return;
                  }
                }
              } catch (error) {
                if (!abortController.signal.aborted) {
                  console.warn('Failed to fetch optimized data from API:', error);
                }
              }
              // Fallback to transforming optimizedScore if endpoint unavailable
              if (optimizedScore?.yearlyCashFlows?.length) {
                const flows = transformMonteCarloToCashFlow(optimizedScore.yearlyCashFlows, variables, profile, true);
                setOptimizedCashFlowData(flows);
              }
            })()
          );
        }

        if (tasks.length) {
          await Promise.all(tasks);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Error fetching cash flow data:', error);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
          setDataFetched(true);
        }
      }
    };

    // Guard: if data was fetched and we have something to show, avoid refetching
    if (!(dataFetched && (currentCashFlowData?.length || optimizedCashFlowData?.length))) {
      fetchCashFlowData();
    }

    return () => abortController.abort();
  // Do not depend on currentCashFlowData/optimizedCashFlowData to avoid loops
  }, [variables, profile, currentScore, optimizedScore, dataFetched]);
  
  // Add state for selected plan - default to 'optimized'
  const [selectedPlan, setSelectedPlan] = useState<'baseline' | 'optimized'>('optimized');
  
  // Keep Optimized selected by default - don't auto-switch to baseline
  // User can manually switch if they want to see baseline data
  
  // Determine which data to display based on selected plan
  const displayData = selectedPlan === 'baseline' ? currentCashFlowData : optimizedCashFlowData;
  
  const hasAnyData = !!(currentCashFlowData?.length || optimizedCashFlowData?.length);
  if (isLoading && !hasAnyData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
        <span className="ml-3 text-gray-400">Loading cash flow data...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Plan Toggle - Same design as MC Withdrawals tab */}
      <div className="text-center">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setSelectedPlan('baseline')}
            className={`px-6 py-2 text-sm font-medium border border-gray-600 rounded-l-lg focus:z-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
              selectedPlan === 'baseline'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            Baseline Plan
          </button>
          <button
            type="button"
            onClick={() => setSelectedPlan('optimized')}
            className={`px-6 py-2 text-sm font-medium border border-gray-600 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
              selectedPlan === 'optimized'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            Optimized Plan
          </button>
        </div>
      </div>
      
      {displayData?.length ? (
        <div className="space-y-4">
          {/* Cash Flow Visualization */}
          <RetirementCashFlowSankey
            data={displayData}
            retirementAge={Math.min(variables.retirementAge, variables.spouseRetirementAge || variables.retirementAge)}
            currentAge={profile?.age || 50}
            isOptimized={selectedPlan === 'optimized'}
          />
        </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No cash flow data available. Please run optimization first.</p>
          </div>
        )}
        
        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            onClick={() => setActiveTab("cash-flow")}
            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
          >
            <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
            Back to Cash Flow
          </Button>
          <Button
            onClick={() => setActiveTab("social-security")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            Next: Social Security
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Optimized Variables Table - Same as Net Worth and MC Withdrawals Tabs */}
        {variables && optimizedScore && (
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" />
                  Optimized Retirement Variables
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 bg-green-900/30 border border-green-700/50 rounded-full">
                    <span className="text-xs text-green-400 font-medium">✓ Saved</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Your optimized settings used for the cash flow projections above
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Retirement Planning Column */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🎯</span>
                    <h3 className="text-lg font-semibold text-white">Retirement Planning</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">Your Retirement Age</span>
                      <span className="text-sm text-white font-semibold">Age {variables.retirementAge}</span>
                    </div>
                    {profile?.maritalStatus === 'married' && variables.spouseRetirementAge && (
                      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <span className="text-sm text-gray-300">Spouse Retirement Age</span>
                        <span className="text-sm text-white font-semibold">Age {variables.spouseRetirementAge}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">Your Social Security Age</span>
                      <span className="text-sm text-white font-semibold">Age {variables.socialSecurityAge}</span>
                    </div>
                    {isMarried && variables.spouseSocialSecurityAge && (
                      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <span className="text-sm text-gray-300">Spouse Social Security Age</span>
                        <span className="text-sm text-white font-semibold">Age {variables.spouseSocialSecurityAge}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Investment & Contributions Column */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">💰</span>
                    <h3 className="text-lg font-semibold text-white">Investment Strategy</h3>
                  </div>
                  <div className="space-y-3">
                    {/* User Asset Allocation */}
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">Your Strategy</span>
                      <span className="text-sm text-white font-semibold">
                        {(() => {
                          const allocation = variables.assetAllocation;
                          if (allocation === '5') return 'Conservative';
                          if (allocation === '5.6') return 'Moderately Conservative';
                          if (allocation === '6.1') return 'Moderate';
                          if (allocation === '6.6') return 'Moderately Aggressive';
                          if (allocation === '7') return 'Aggressive';
                          if (allocation === 'current-allocation') return 'Current Allocation';
                          if (allocation === 'glide-path') return 'Age-Based Glide Path';
                          return allocation || 'Current Allocation';
                        })()}
                      </span>
                    </div>
                    
                    {/* Spouse Asset Allocation */}
                    {profile?.maritalStatus === 'married' && variables.spouseAssetAllocation && (
                      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <span className="text-sm text-gray-300">Spouse Strategy</span>
                        <span className="text-sm text-white font-semibold">
                          {(() => {
                            const allocation = variables.spouseAssetAllocation;
                            if (allocation === '5') return 'Conservative';
                            if (allocation === '5.6') return 'Moderately Conservative';
                            if (allocation === '6.1') return 'Moderate';
                            if (allocation === '6.6') return 'Moderately Aggressive';
                            if (allocation === '7') return 'Aggressive';
                            if (allocation === 'current-allocation') return 'Current Allocation';
                            if (allocation === 'glide-path') return 'Age-Based Glide Path';
                            return allocation || 'Current Allocation';
                          })()}
                        </span>
                      </div>
                    )}
                    
                    {(variables.monthlyEmployee401k > 0 || variables.monthlyEmployer401k > 0) && (
                      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <span className="text-sm text-gray-300">401(k) Monthly</span>
                        <span className="text-sm text-white font-semibold">
                          ${((variables.monthlyEmployee401k || 0) + (variables.monthlyEmployer401k || 0)).toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    {(variables.annualTraditionalIRA > 0 || variables.annualRothIRA > 0) && (
                      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <span className="text-sm text-gray-300">IRA Annual</span>
                        <span className="text-sm text-white font-semibold">
                          ${((variables.annualTraditionalIRA || 0) + (variables.annualRothIRA || 0)).toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">Monthly Expenses</span>
                      <span className="text-sm text-white font-semibold">${variables.monthlyExpenses?.toLocaleString()}</span>
                    </div>
                    
                    {variables.hasLongTermCareInsurance && (
                      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <span className="text-sm text-gray-300">Long-Term Care Insurance</span>
                        <span className="text-sm text-white font-semibold">✓ Yes</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Summary metrics at the bottom */}
              <div className="mt-6 pt-6 border-t border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Current Score</p>
                  <p className="text-lg font-bold text-white">{Math.round(currentScore?.probabilityOfSuccess || 0)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Optimized Score</p>
                  <p className="text-lg font-bold text-green-400">{Math.round(optimizedScore?.probabilityOfSuccess || 0)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Improvement</p>
                  <p className="text-lg font-bold text-blue-400">
                    +{Math.round((optimizedScore?.probabilityOfSuccess || 0) - (currentScore?.probabilityOfSuccess || 0))}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Years to Retire</p>
                  <p className="text-lg font-bold text-purple-400">
                    {Math.max(0, variables.retirementAge - (profile?.age || 35))}
                  </p>
                </div>
              </div>
              
              {/* Action button to modify */}
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={() => setActiveTab("optimize-score")}
                  variant="outline"
                  className="bg-gray-800/50 hover:bg-gray-700/50 text-white border-gray-600 hover:border-gray-500"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Modify Variables
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

// Monte Carlo Withdrawal Content Component
function MonteCarloWithdrawalContent({ 
  variables, 
  hasOptimizedOnce, 
  setActiveTab,
  profile,
  optimizedScore,
  currentScore,
  onDataUpdate
}: { 
  variables: any; boolean; 
  hasOptimizedOnce: boolean; 
  setActiveTab: (tab: string) => void;
  profile?: any;
  optimizedScore?: any;
  currentScore?: any;
  onDataUpdate?: (data: any) => void;
}) {
  // Match deterministic tab structure - separate baseline and optimized data
  const [baselineData, setBaselineData] = useState<any>(null);
  const [optimizedData, setOptimizedData] = useState<any>(null);
  const [baselineSummary, setBaselineSummary] = useState<any>(null);
  const [optimizedSummary, setOptimizedSummary] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<'baseline' | 'optimized'>('optimized');
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data has been loaded from saved state
  const [loadingSeconds, setLoadingSeconds] = useState(0); // Timer for loading state

  // Load saved MC Withdrawals data from profile if available
  useEffect(() => {
    if (profile?.optimizationVariables?.mcWithdrawalsData && !dataLoaded) {
      const savedData = profile.optimizationVariables.mcWithdrawalsData;
      
      // Check if saved data has the detailed withdrawal breakdown
      const hasDetailedBaselineData = savedData.baselineData?.length > 0 && 
        savedData.baselineData.some((d: any) => 
          'taxableWithdrawal' in d || 
          'taxDeferredWithdrawal' in d || 
          'taxFreeWithdrawal' in d
        );
      
      const hasDetailedOptimizedData = savedData.optimizedData?.length > 0 && 
        savedData.optimizedData.some((d: any) => 
          'taxableWithdrawal' in d || 
          'taxDeferredWithdrawal' in d || 
          'taxFreeWithdrawal' in d
        );
      
      // Only load data if it has the detailed breakdown
      if (hasDetailedBaselineData) {
        setBaselineData(savedData.baselineData);
        if (savedData.baselineSummary) setBaselineSummary(savedData.baselineSummary);
      }
      
      if (hasDetailedOptimizedData) {
        setOptimizedData(savedData.optimizedData);
        if (savedData.optimizedSummary) setOptimizedSummary(savedData.optimizedSummary);
      }
      
      // Only mark as loaded if we have detailed data
      if (hasDetailedBaselineData || hasDetailedOptimizedData) {
        setDataLoaded(true);
      }
    }
  }, [profile, dataLoaded]);

  // Timer effect for loading state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingSeconds(0);
      interval = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setLoadingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  // Fetch both baseline and optimized data (like deterministic tab)
  useEffect(() => {
    // Check if current data has the detailed withdrawal breakdown
    const hasDetailedData = (baselineData?.length > 0 && 
      baselineData.some((d: any) => 
        'taxableWithdrawal' in d || 
        'taxDeferredWithdrawal' in d || 
        'taxFreeWithdrawal' in d
      )) || (optimizedData?.length > 0 && 
      optimizedData.some((d: any) => 
        'taxableWithdrawal' in d || 
        'taxDeferredWithdrawal' in d || 
        'taxFreeWithdrawal' in d
      ));
    
    // Only skip fetching if we already have detailed withdrawal breakdown data
    if ( hasOptimizedOnce && !hasDetailedData) {
      fetchMonteCarloWithdrawals();
    }
  }, [ hasOptimizedOnce, variables, baselineData, optimizedData]);

  const fetchMonteCarloWithdrawals = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching Monte Carlo withdrawals - Both baseline and optimized');
      
      // Fetch both scenarios in parallel (like deterministic tab)
      let baselineResponse, optimizedResponse;
      let baselineResult = null, optimizedResult = null;
      
      try {
        [baselineResponse, optimizedResponse] = await Promise.all([
          fetch('/api/calculate-monte-carlo-withdrawal-sequence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}) // Empty for baseline
          }),
          fetch('/api/calculate-monte-carlo-withdrawal-sequence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(variables || {})
          })
        ]);
        
        if (baselineResponse.ok) {
          baselineResult = await baselineResponse.json();
        }
        if (optimizedResponse.ok) {
          optimizedResult = await optimizedResponse.json();
        }
      } catch (error) {
        console.error('Error fetching Monte Carlo withdrawals:', error);
      }

      if (baselineResult && baselineResult.projections && optimizedResult && optimizedResult.projections) {
        
        console.log('Monte Carlo results:', {
          baseline: baselineResult.monteCarloSummary?.probabilityOfSuccess,
          optimized: optimizedResult.monteCarloSummary?.probabilityOfSuccess
        });
        
        setBaselineData(baselineResult.projections);
        setOptimizedData(optimizedResult.projections);
        setBaselineSummary(baselineResult.monteCarloSummary || null);
        setOptimizedSummary(optimizedResult.monteCarloSummary || null);
        
        // Notify parent component of data update
        if (onDataUpdate) {
          onDataUpdate({
            baselineData: baselineResult.projections,
            optimizedData: optimizedResult.projections,
            baselineSummary: baselineResult.monteCarloSummary,
            optimizedSummary: optimizedResult.monteCarloSummary
          });
        }
      } else {
        // Fallback handling when one or both requests fail
        if (baselineResult && baselineResult.projections) {
          setBaselineData(baselineResult.projections);
          setBaselineSummary(baselineResult.monteCarloSummary || null);
        }
        if (optimizedResult && optimizedResult.projections) {
          setOptimizedData(optimizedResult.projections);
          setOptimizedSummary(optimizedResult.monteCarloSummary || null);
        }
        
        // Try to use any available score data as fallback
        if (!baselineResult && currentScore?.yearlyCashFlows) {
          console.log('Using currentScore as fallback for baseline data');
          setBaselineData(currentScore.yearlyCashFlows);
        }
        if (!optimizedResult && optimizedScore?.yearlyCashFlows) {
          console.log('Using optimizedScore as fallback for optimized data');
          setOptimizedData(optimizedScore.yearlyCashFlows);
        }
      }
    } catch (error) {
      console.error('Error fetching Monte Carlo withdrawals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasOptimizedOnce) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            Variables Not Saved
          </CardTitle>
          <p className="text-sm text-gray-400 mt-1">
            Please complete optimization and lock your variables before viewing Monte Carlo withdrawal projections
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-amber-400 opacity-70" />
            <h3 className="text-lg font-semibold text-white mb-3">Optimization & Save Required</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Monte Carlo withdrawals require saved optimization variables to ensure projections are based on your 
              locked settings. Please optimize and save your variables first.
            </p>
            <div className="space-y-3">
              <div className="text-sm text-gray-300 bg-gray-800 rounded-lg p-3 max-w-sm mx-auto">
                <p className="font-medium mb-1">Steps required:</p>
                <p>1. Go to Optimization tab</p>
                <p>2. Run optimization</p>
                <p>3. Click "Submit and Optimize" to save</p>
              </div>
              <Button
                onClick={() => setActiveTab("optimize-score")}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Go to Optimization Tab
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get current data based on selected plan
  const currentData = selectedPlan === 'baseline' ? baselineData : optimizedData;
  const currentSummary = selectedPlan === 'baseline' ? baselineSummary : optimizedSummary;

  return (
    <div className="space-y-6">
      {/* Header - Match deterministic tab style */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Monte Carlo-Based Withdrawal Projections
          </CardTitle>
          <p className="text-sm text-gray-400 mt-1">
            Using the same simulation engine as your retirement success probability
          </p>
        </CardHeader>
      </Card>



      {/* Plan Toggle - Exact match to deterministic tab */}
      <div className="text-center">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setSelectedPlan('baseline')}
            className={`px-6 py-2 text-sm font-medium border border-gray-600 rounded-l-lg focus:z-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
              selectedPlan === 'baseline'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            Baseline Plan
          </button>
          <button
            type="button"
            onClick={() => setSelectedPlan('optimized')}
            className={`px-6 py-2 text-sm font-medium border border-gray-600 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
              selectedPlan === 'optimized'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            Optimized Plan
          </button>
        </div>
      </div>

      {/* Monte Carlo Visualization Component */}
      <MonteCarloWithdrawalVisualization 
        data={currentData}
        summary={currentSummary}
        selectedPlan={selectedPlan}
        isLoading={isLoading}
        loadingSeconds={loadingSeconds}
      />

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          onClick={() => setActiveTab("stress-tests")}
          className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
        >
          <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
          Back to Stress Tests
        </Button>
        <Button
          onClick={() => setActiveTab("cash-flow")}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          Next: Cash Flow
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
      
      {/* Optimized Variables Table - Same as Net Worth Tab */}
      {variables && optimizedScore && (
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Optimized Retirement Variables
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-green-900/30 border border-green-700/50 rounded-full">
                  <span className="text-xs text-green-400 font-medium">✓ Locked & Saved</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Your optimized settings used for the Monte Carlo projections above
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Retirement Planning Column */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🎯</span>
                  <h3 className="text-lg font-semibold text-white">Retirement Planning</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <span className="text-sm text-gray-300">Your Retirement Age</span>
                    <span className="text-sm text-white font-semibold">Age {variables.retirementAge}</span>
                  </div>
                  {profile?.maritalStatus === 'married' && variables.spouseRetirementAge && (
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">Spouse Retirement Age</span>
                      <span className="text-sm text-white font-semibold">Age {variables.spouseRetirementAge}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <span className="text-sm text-gray-300">Your Social Security Age</span>
                    <span className="text-sm text-white font-semibold">Age {variables.socialSecurityAge}</span>
                  </div>
                  {profile?.maritalStatus === 'married' && variables.spouseSocialSecurityAge && (
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">Spouse Social Security Age</span>
                      <span className="text-sm text-white font-semibold">Age {variables.spouseSocialSecurityAge}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Investment & Contributions Column */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">💰</span>
                  <h3 className="text-lg font-semibold text-white">Investment Strategy</h3>
                </div>
                <div className="space-y-3">
                  {/* User Asset Allocation */}
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <span className="text-sm text-gray-300">Your Strategy</span>
                    <span className="text-sm text-white font-semibold">
                      {(() => {
                        const allocation = variables.assetAllocation;
                        if (allocation === '5') return 'Conservative';
                        if (allocation === '5.6') return 'Moderately Conservative';
                        if (allocation === '6.1') return 'Moderate';
                        if (allocation === '6.6') return 'Moderately Aggressive';
                        if (allocation === '7') return 'Aggressive';
                        if (allocation === 'current-allocation') return 'Current Allocation';
                        if (allocation === 'glide-path') return 'Age-Based Glide Path';
                        return allocation || 'Current Allocation';
                      })()}
                    </span>
                  </div>
                  
                  {/* Spouse Asset Allocation */}
                  {profile?.maritalStatus === 'married' && variables.spouseAssetAllocation && (
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">Spouse Strategy</span>
                      <span className="text-sm text-white font-semibold">
                        {(() => {
                          const allocation = variables.spouseAssetAllocation;
                          if (allocation === '5') return 'Conservative';
                          if (allocation === '5.6') return 'Moderately Conservative';
                          if (allocation === '6.1') return 'Moderate';
                          if (allocation === '6.6') return 'Moderately Aggressive';
                          if (allocation === '7') return 'Aggressive';
                          if (allocation === 'current-allocation') return 'Current Allocation';
                          if (allocation === 'glide-path') return 'Age-Based Glide Path';
                          return allocation || 'Current Allocation';
                        })()}
                      </span>
                    </div>
                  )}
                  
                  {(variables.monthlyEmployee401k > 0 || variables.monthlyEmployer401k > 0) && (
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">401(k) Monthly</span>
                      <span className="text-sm text-white font-semibold">
                        ${((variables.monthlyEmployee401k || 0) + (variables.monthlyEmployer401k || 0)).toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {(variables.annualTraditionalIRA > 0 || variables.annualRothIRA > 0) && (
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">IRA Annual</span>
                      <span className="text-sm text-white font-semibold">
                        ${((variables.annualTraditionalIRA || 0) + (variables.annualRothIRA || 0)).toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <span className="text-sm text-gray-300">Monthly Expenses</span>
                    <span className="text-sm text-white font-semibold">${variables.monthlyExpenses?.toLocaleString()}</span>
                  </div>
                  
                  {variables.hasLongTermCareInsurance && (
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <span className="text-sm text-gray-300">Long-Term Care Insurance</span>
                      <span className="text-sm text-white font-semibold">✓ Yes</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Summary metrics at the bottom */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-4 rounded-lg border border-purple-700/30">
                  <p className="text-xs text-gray-400 mb-1">Total Monthly Savings</p>
                  <p className="text-lg font-bold text-white">
                    ${(
                      (variables.monthlyEmployee401k || 0) + 
                      (variables.monthlyEmployer401k || 0) + 
                      (variables.spouseMonthlyEmployee401k || 0) + 
                      (variables.spouseMonthlyEmployer401k || 0) +
                      ((variables.annualTraditionalIRA || 0) / 12) +
                      ((variables.annualRothIRA || 0) / 12) +
                      ((variables.spouseAnnualTraditionalIRA || 0) / 12) +
                      ((variables.spouseAnnualRothIRA || 0) / 12)
                    ).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-4 rounded-lg border border-green-700/30">
                  <p className="text-xs text-gray-400 mb-1">Years to Retirement</p>
                  <p className="text-lg font-bold text-white">
                    {(() => {
                      if (!profile?.dateOfBirth || !variables.retirementAge) {
                        return 'N/A';
                      }
                      try {
                        const currentYear = new Date().getFullYear();
                        const birthYear = new Date(profile.dateOfBirth).getFullYear();
                        const currentAge = currentYear - birthYear;
                        const yearsToRetirement = Math.max(0, variables.retirementAge - currentAge);
                        return `${yearsToRetirement} years`;
                      } catch (error) {
                        return 'N/A';
                      }
                    })()}
                  </p>
                </div>
                
                <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 p-4 rounded-lg border border-orange-700/30">
                  <p className="text-xs text-gray-400 mb-1">Optimization Impact</p>
                  <p className="text-lg font-bold text-white">
                    +{Math.round(((optimizedScore?.probabilityOfSuccess || 0) - (currentScore?.probabilityOfSuccess || 0)))}%
                  </p>
                </div>
              </div>
            </div>
            
            {/* Action button to modify */}
            <div className="mt-6 flex justify-center">
              <Button
                onClick={() => setActiveTab("optimize-score")}
                variant="outline"
                className="bg-gray-800/50 hover:bg-gray-700/50 text-white border-gray-600 hover:border-gray-500"
              >
                <Settings className="w-4 h-4 mr-2" />
                Modify Variables
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Error boundary component
class RetirementPlanningErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('RetirementPlanning Error Boundary caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('RetirementPlanning Error Boundary details:', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] text-white p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <p className="text-gray-300 mb-4">
              The retirement planning page encountered an error. Please refresh the page to try again.
            </p>
            <pre className="bg-gray-800 p-4 rounded text-sm text-gray-300 overflow-auto">
              {this.state.error?.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Reusable chart component matching dashboard widget style

// Social Security Age Selector Component with dropdown presets and manual input
const SocialSecurityAgeSelector = ({ 
  id, 
  value, 
  onChange, 
  disabled = false, 
  retirementAge, 
  label,
  includeTooltip = true,
  optimalAge,
  profile
}: {
  id: string;
  value: number;
  onChange: (age: number) => void;
  disabled?: boolean;
  retirementAge: number;
  label: string;
  includeTooltip?: boolean;
  optimalAge?: number;
  profile?: any;
}) => {
  const [inputMode, setInputMode] = useState(false);
  const [customValue, setCustomValue] = useState(value.toString());
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Define the preset options with optimal strategy
  const presetOptions = [
    { label: "Age 62 (Earliest)", value: 62, description: "Earliest claim age" },
    { label: `Age ${retirementAge} (Retirement)`, value: retirementAge, description: "Your retirement age" },
    { label: "Age 67 (Full Retirement)", value: 67, description: "Full retirement age" },
    ...(optimalAge && optimalAge !== 62 && optimalAge !== retirementAge && optimalAge !== 67 && optimalAge !== 70 ? 
      [{ label: `Age ${optimalAge} (Optimal Strategy)`, value: optimalAge, description: "Maximizes lifetime spending", isOptimal: true }] : []),
    { label: "Age 70 (Maximum)", value: 70, description: "Maximum delayed retirement credits" }
  ].filter((option, index, arr) => 
    // Remove duplicates but keep the optimal one if it matches common ages
    arr.findIndex(o => o.value === option.value) === index ||
    (option as any).isOptimal
  );

  // Check if current value matches any preset
  const currentPreset = presetOptions.find(option => option.value === value);
  const isCustomValue = !currentPreset;

  // If the current value is not one of the presets, automatically switch to input mode
  useEffect(() => {
    if (isCustomValue && !inputMode) {
      setInputMode(true);
    }
  }, [isCustomValue, inputMode]);

  const handlePresetSelect = (selectedValue: string) => {
    if (selectedValue === "custom") {
      setInputMode(true);
      setCustomValue(value.toString());
    } else {
      const numValue = parseInt(selectedValue);
      onChange(numValue);
      setInputMode(false);
    }
  };

  const handleCustomInput = (inputValue: string) => {
    // Allow free typing; sanitize to digits only for numeric parsing
    const sanitized = inputValue.replace(/[^0-9]/g, '');
    setCustomValue(sanitized);
    const numValue = parseInt(sanitized);
    if (!isNaN(numValue) && numValue >= 62 && numValue <= 70) {
      onChange(numValue);
    }
  };

  const handleCustomBlur = () => {
    const numValue = parseInt(customValue);
    if (isNaN(numValue) || numValue < 62 || numValue > 70) {
      // Reset to previous valid value if invalid
      setCustomValue(value.toString());
      onChange(value);
    }
  };

  const handleDone = () => {
    const numValue = parseInt(customValue);
    if (!isNaN(numValue) && numValue >= 62 && numValue <= 70) {
      onChange(numValue);
    }
    setInputMode(false);
  };

  // Update customValue when value prop changes
  useEffect(() => {
    setCustomValue(value.toString());
  }, [value]);

  // Ensure focus when switching to custom input for reliable typing
  useEffect(() => {
    if (inputMode) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [inputMode]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-gray-300 flex items-center">
        {label}
        {includeTooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 ml-2 text-gray-500 hover:text-gray-400 transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="bg-gray-800 border-gray-700">
                <p>Age when Social Security benefits will be claimed (62-70)</p>
                <p className="text-xs text-gray-400 mt-1">Earlier claiming reduces monthly benefits</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Label>
      
      {!inputMode ? (
        <Select
          value={isCustomValue ? "custom" : value.toString()}
          onValueChange={handlePresetSelect}
          disabled={disabled}
        >
          <SelectTrigger 
            id={id}
            className="bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          >
            <SelectValue placeholder="Age 62–70">
              {isCustomValue ? (
                <span className="flex items-center justify-between w-full">
                  <span>Age {value}</span>
                  <span className="text-xs text-gray-400 ml-2">(Custom)</span>
                </span>
              ) : (
                <span className="flex items-center justify-between w-full">
                  <span>Age {currentPreset?.value}</span>
                  <span className="text-xs text-gray-400 ml-2">({currentPreset?.description})</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {presetOptions.map((option) => (
              <SelectItem 
                key={option.value} 
                value={option.value.toString()}
                className={`text-white hover:bg-gray-700 focus:bg-gray-700 ${
                  (option as any).isOptimal ? 'bg-green-900/20 border-l-2 border-green-500' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={(option as any).isOptimal ? 'text-green-300 font-medium' : ''}>
                    {option.label}
                    {(option as any).isOptimal && <span className="ml-2">✨</span>}
                  </span>
                  <span className="text-xs text-gray-400 ml-4">{option.description}</span>
                </div>
              </SelectItem>
            ))}
            <SelectItem 
              value="custom" 
              className="text-white hover:bg-gray-700 focus:bg-gray-700 border-t border-gray-600 mt-1 pt-2"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>Custom age (62-70)...</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              id={id}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={customValue}
              onChange={(e) => handleCustomInput(e.target.value)}
              onBlur={handleCustomBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleDone();
                }
              }}
              onFocus={(ev) => {
                try { (ev.target as HTMLInputElement)?.select(); } catch {}
              }}
              disabled={disabled}
              className="bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 pr-16"
              placeholder="62-70"
              autoFocus
            />
            
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleDone}
            disabled={disabled}
            className="bg-gray-800/50 border-gray-700 text-white hover:bg-gray-700 px-3"
          >
            <CheckCircle className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

function RetirementPlanningInner() {
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(false);
  const [currentScore, setCurrentScore] = useState<any>(null);
  const [optimizedScore, setOptimizedScore] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeTab, setActiveTab] = useState('optimize-score');
  const [optimizationTime, setOptimizationTime] = useState(0);
  const [optimizationController, setOptimizationController] = useState<AbortController | null>(null);
  const [optimalSSAges, setOptimalSSAges] = useState<{user: number, spouse: number} | null>(null);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<string | null>(null);
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [lockingTime, setLockingTime] = useState<number>(0);
  const { toast } = useToast();
  const { retirementScore, lastFetchTime } = useRetirementScore();
  

  // Cash flow data states
  const { runSimulation } = useMonteCarloWorker();
  const [currentCashFlowData, setCurrentCashFlowData] = useState<CashFlowData[] | null>(null);
  const [optimizedCashFlowData, setOptimizedCashFlowData] = useState<CashFlowData[] | null>(null);

  // Monte Carlo Withdrawals data states
  const [mcWithdrawalsData, setMcWithdrawalsData] = useState<any>(null);

  // Social Security optimization states (simplified - no real-time optimization)
  const [showSSComparison, setShowSSComparison] = useState(false);

  // State for suggestions collapsible - load from saved preferences if available
  // Start collapsed only if variables are locked, otherwise open by default
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [hasOptimizedOnce, setHasOptimizedOnce] = useState(false); // Track if user has optimized at least once
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  
  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const isMarried = (profile?.maritalStatus === 'married' || profile?.maritalStatus === 'partnered');
  
  // Withdrawal sequence state
  const [withdrawalSequence, setWithdrawalSequence] = useState<any[] | null>(null);

  // Form state for optimization variables
  const [variables, setVariables] = useState<OptimizationVariables>({
    retirementAge: 65,
    spouseRetirementAge: 65,
    socialSecurityAge: 67,
    spouseSocialSecurityAge: 67,
    socialSecurityBenefit: undefined,      // Will be populated from profile
    spouseSocialSecurityBenefit: undefined, // Will be populated from profile
    pensionBenefit: undefined,             // Will be populated from profile
    spousePensionBenefit: undefined,       // Will be populated from profile
    assetAllocation: 'glide-path',
    spouseAssetAllocation: 'glide-path',
    // Separate contribution fields to match intake form Step 11
    monthlyEmployee401k: 0,
    monthlyEmployer401k: 0,
    annualTraditionalIRA: 0,
    annualRothIRA: 0,
    spouseMonthlyEmployee401k: 0,
    spouseMonthlyEmployer401k: 0,
    spouseAnnualTraditionalIRA: 0,
    spouseAnnualRothIRA: 0,
    monthlyExpenses: 0,
    partTimeIncome: 0,
    spousePartTimeIncome: 0,
    hasLongTermCareInsurance: false,
  });
  
  // Debug render to catch any component-level errors
  console.log('RetirementPlanningInner rendering...', {
    hasCurrentScore: !!currentScore,
    hasOptimizedScore: !!optimizedScore,
    isLoading,
    isOptimizing,
    activeTab
  });
  
  const handleOptimizationGuideToggle = async () => {
    const newState = !showSuggestions;
    setShowSuggestions(newState);
    
    // Save UI preference when user has locked variables
    if ( hasOptimizedOnce) {
      try {
        await fetch('/api/financial-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            retirementPlanningUIPreferences: {
              optimizationGuideCollapsed: !newState
            }
          })
        });
      } catch (error) {
        console.error('Failed to save UI preference:', error);
      }
    }
  };


  // Fetch profile data on mount
  useEffect(() => {
    fetchProfileData();
  }, []);

  // Re-run optimization on tab activation (batch refresh) if saved optimized variables exist
  useEffect(() => {
    if (activeTab !== 'optimize-score') return;
    if (!profile) return;
    if (!(profile?.optimizationVariables?.hasOptimized)) return;
    if (optimizationController) {
      try { optimizationController.abort(); } catch {}
    }
    const controller = new AbortController();
    setOptimizationController(controller);
    (async () => {
      try {
        // Use saved variables from the database for automatic refresh
        const payload: any = { persist: true };
        const res = await fetch('/api/retirement/optimization-refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (!res.ok) {
          // Silently fail and keep existing UI data
          return;
        }
        const data = await res.json();
        // Update gauge
        setOptimizedScore({
          probabilityOfSuccess: data.probability,
          medianEndingBalance: data.optimizedScore?.medianEndingBalance || 0,
          scenarios: data.optimizedScore?.scenarios || { successful: 0, failed: 0, total: data.runs },
          yearlyCashFlows: data.yearlyCashFlows || []
        });
        setHasOptimizedOnce(true);
        // Broadcast both events so fixed and floating widgets sync immediately
        try {
          const formatted = {
            probabilityOfSuccess: data.probability,
            medianEndingBalance: data.optimizedScore?.medianEndingBalance || 0,
            scenarios: data.optimizedScore?.scenarios || { successful: 0, failed: 0, total: data.runs },
            yearlyCashFlows: data.yearlyCashFlows || [],
            calculatedAt: data.calculatedAt
          };
          window.dispatchEvent(new CustomEvent('retirementOptimizationCalculated', {
            detail: { result: formatted, variables }
          }));
        } catch (_) {}
        // Update optimized projections bands to profile snapshot area by dispatching event
        // Components read from profile/props; for now rely on their own data fetching.
        // Update Impact via global event listeners (components may listen)
        window.dispatchEvent(new CustomEvent('retirementOptimizationUpdated', {
          detail: { optimizedAt: data.calculatedAt }
        }));

        // Refresh profile snapshot so components that read from DB see updated values
        try {
          const pRes = await fetch('/api/financial-profile', { credentials: 'include' });
          if (pRes.ok) {
            const p = await pRes.json();
            setProfile(p);
          }
        } catch {}
      } catch (_) {
        // ignore
      }
    })();
    return () => {
      try { controller.abort(); } catch {}
    };
  }, [activeTab]);

  // Removed floating live widget & its loading overlay per request

  // Show Social Security comparison when optimal strategy is available and different from current
  useEffect(() => {
    if (profile?.optimalSocialSecurityAge && 
        (variables.socialSecurityAge !== profile.optimalSocialSecurityAge ||
         (profile.optimalSpouseSocialSecurityAge && variables.spouseSocialSecurityAge !== profile.optimalSpouseSocialSecurityAge))) {
      setShowSSComparison(true);
    } else {
      setShowSSComparison(false);
    }
  }, [variables.socialSecurityAge, variables.spouseSocialSecurityAge, profile]);

  // Fetch current score and profile data on mount
  useEffect(() => {
    // Check if we have a cached score that's less than 5 minutes old
    const isCacheValid = lastFetchTime && (Date.now() - lastFetchTime) < 5 * 60 * 1000;
    
    if (isCacheValid && retirementScore) {
      // Use cached score from dashboard
      setCurrentScore(retirementScore);
      setIsLoading(false);
      
      // Still need to fetch cash flow data even when using cached score
      // But we need to wait for profile data to get correct variables
      if (retirementScore.yearlyCashFlows && retirementScore.yearlyCashFlows.length > 0) {
        // Store the cached score's cash flows to process after profile loads
        fetch('/api/financial-profile')
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            throw new Error('Failed to fetch profile');
          })
          .then(profileData => {
              setProfile(profileData); // Set profile state
              // Use profile data to create variables for transformation
              const profileVariables = {
                retirementAge: profileData.desiredRetirementAge || 65,
                spouseRetirementAge: profileData.spouseDesiredRetirementAge || 65,
                socialSecurityAge: profileData.socialSecurityClaimAge || 67,
                spouseSocialSecurityAge: profileData.spouseSocialSecurityClaimAge || 67,
                assetAllocation: profileData.expectedRealReturn === -2 ? 'current-allocation' :
                  profileData.expectedRealReturn === -1 ? 'glide-path' : 
                  (profileData.expectedRealReturn ? (profileData.expectedRealReturn * 100).toString() : 'current-allocation'),
                monthlyContributions: Math.round(
                  (profileData.retirementContributions?.employee || 0) + 
                  (profileData.retirementContributions?.employer || 0) + 
                  (profileData.spouseRetirementContributions?.employee || 0) + 
                  (profileData.spouseRetirementContributions?.employer || 0)
                ),
                monthlyExpenses: profileData.expectedMonthlyExpensesRetirement ?? undefined,
                partTimeIncome: profileData.partTimeIncomeRetirement || 0,
                spousePartTimeIncome: profileData.spousePartTimeIncomeRetirement || 0,
              };
              
              const currentFlows = transformMonteCarloToCashFlow(
                retirementScore.yearlyCashFlows,
                profileVariables,
                profile,
                false
              );
              setCurrentCashFlowData(currentFlows);
          })
          .catch(error => {
            console.error('Error fetching profile for cash flow transformation:', error);
            // Still set the raw data as fallback
            setCurrentCashFlowData(retirementScore.yearlyCashFlows);
          });
      }
    } else {
      // Fetch fresh score
      fetchCurrentScore();
    }
    
    fetchProfileData();
  }, [retirementScore, lastFetchTime]);

  // Timer for optimization
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isOptimizing) {
      setOptimizationTime(0);
      interval = setInterval(() => {
        setOptimizationTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOptimizing]);

  const fetchCurrentScore = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/calculate-retirement-monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: seedFromParams(undefined, 'retirement-planning-current-score') })
      });
      
      if (response.ok) {
        const result = await response.json();
        setCurrentScore(result);
        
        // Transform Monte Carlo results to cash flow data for current plan
        if (result.yearlyCashFlows && result.yearlyCashFlows.length > 0) {
          const profileResponse = await fetch('/api/financial-profile');
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            setProfile(profileData);
            const profile = profileData;
            const currentFlows = transformMonteCarloToCashFlow(
              result.yearlyCashFlows,
              variables,
              profile,
              false
            );
            setCurrentCashFlowData(currentFlows);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching retirement score:', error);
      toast({
        title: "Error",
        description: "Failed to load retirement score. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  

  // Helper function to get optimal strategy label and value
  const getOptimalSSStrategy = (isSpouse = false) => {
    const optimalAge = isSpouse 
      ? profile?.optimalSpouseSocialSecurityAge 
      : profile?.optimalSocialSecurityAge;
    
    if (!optimalAge) return null;
    
    return {
      label: `Age ${optimalAge} (Optimal Strategy)`,
      value: optimalAge,
      description: 'Maximizes lifetime spending power'
    };
  };

  // Calculate benefit improvement for display
  const calculateBenefitImprovement = (currentAge: number, optimalAge: number) => {
    if (!profile?.socialSecurityOptimization || currentAge === optimalAge) return null;
    
    // Simple approximation: each year of delay after 67 = ~8% increase
    // each year before 67 = ~5% decrease
    const fra = 67;
    const currentBenefitMultiplier = currentAge >= fra ? 
      1 + (currentAge - fra) * 0.08 : 
      1 - (fra - currentAge) * 0.05;
    const optimalBenefitMultiplier = optimalAge >= fra ? 
      1 + (optimalAge - fra) * 0.08 : 
      1 - (fra - optimalAge) * 0.05;
    
    const improvement = ((optimalBenefitMultiplier - currentBenefitMultiplier) / currentBenefitMultiplier) * 100;
    return improvement;
  };

  const fetchProfileData = async () => {
    try {
      const response = await fetch('/api/financial-profile');
      if (response.ok) {
        const profileData = await response.json();
        setProfile(profileData); // Set profile state
        const profile = profileData; // Keep local reference for backward compatibility
        
        // Check if there are saved optimization variables AND user has actually optimized before
        // Only use saved variables if user has run optimization, otherwise use intake form data
        console.log('🔍 DEBUG: Checking optimization status:', {
          hasOptimizationVariables: !!profile.optimizationVariables,
          hasOptimized: profile.optimizationVariables?.hasOptimized,
          hasOptimizedScore: !!profile.optimizationVariables?.optimizedScore,
          hasOptimizedRetirementSuccessProbability: !!profile.optimizationVariables?.optimizedRetirementSuccessProbability,
          optimizedRetirementSuccessProbability: profile.optimizationVariables?.optimizedRetirementSuccessProbability,
          hasOptimizedRetirementBands: !!profile.optimizationVariables?.optimizedRetirementBands,
          hasImpactPortfolioBalanceData: !!profile.optimizationVariables?.impactPortfolioBalanceData,
          willUseSavedVariables: !!(profile.optimizationVariables && profile.optimizationVariables.hasOptimized === true)
        });
        
        // Log the full optimization variables to see what's actually loaded
        console.log('🔍 DEBUG: Full optimizationVariables from profile:', profile.optimizationVariables);
        
        // Simple check: if user has optimized before, use their saved variables
        // Otherwise, use intake form data as defaults
        const hasSavedOptimization = profile.optimizationVariables?.hasOptimized === true;
        
        console.log('🔍 Optimization status:', {
          hasSavedOptimization,
          savedVariables: profile.optimizationVariables,
          willUseSaved: hasSavedOptimization
        });
        
        if (hasSavedOptimization) {
          console.log('Using saved optimization variables (user has optimized before)');
          // Load saved optimization variables
          const savedOpt = profile.optimizationVariables;
          
          // Extract saved variables, using intake form values as fallback for missing/invalid data
          // This ensures we never have empty values that would break calculations
          const savedVariables: OptimizationVariables = {
            retirementAge: savedOpt.retirementAge || profile.desiredRetirementAge || 65,
            spouseRetirementAge: savedOpt.spouseRetirementAge || profile.spouseDesiredRetirementAge || 65,
            socialSecurityAge: savedOpt.socialSecurityAge || profile.socialSecurityClaimAge || 67,
            spouseSocialSecurityAge: savedOpt.spouseSocialSecurityAge || profile.spouseSocialSecurityClaimAge || 67,
            socialSecurityBenefit: savedOpt.socialSecurityBenefit || profile.socialSecurityBenefit || undefined,
            spouseSocialSecurityBenefit: savedOpt.spouseSocialSecurityBenefit || profile.spouseSocialSecurityBenefit || undefined,
            pensionBenefit: savedOpt.pensionBenefit || profile.pensionBenefit || undefined,
            spousePensionBenefit: savedOpt.spousePensionBenefit || profile.spousePensionBenefit || undefined,
            assetAllocation: savedOpt.assetAllocation || 
              (profile.expectedRealReturn === -2 ? 'current-allocation' :
               profile.expectedRealReturn === -1 ? 'glide-path' : 
               (profile.expectedRealReturn && profile.expectedRealReturn > 0 ? (profile.expectedRealReturn * 100).toString() : 'glide-path')),
            spouseAssetAllocation: savedOpt.spouseAssetAllocation || 
              (profile.spouseExpectedRealReturn === -2 ? 'current-allocation' :
               profile.spouseExpectedRealReturn === -1 ? 'glide-path' : 
               (profile.spouseExpectedRealReturn && profile.spouseExpectedRealReturn > 0 ? (profile.spouseExpectedRealReturn * 100).toString() : 'glide-path')),
            monthlyEmployee401k: savedOpt.monthlyEmployee401k || Math.round(profile.retirementContributions?.employee || 0),
            monthlyEmployer401k: savedOpt.monthlyEmployer401k || Math.round(profile.retirementContributions?.employer || 0),
            annualTraditionalIRA: savedOpt.annualTraditionalIRA || Math.round(profile.traditionalIRAContribution || 0),
            annualRothIRA: savedOpt.annualRothIRA || Math.round(profile.rothIRAContribution || 0),
            spouseMonthlyEmployee401k: savedOpt.spouseMonthlyEmployee401k || Math.round(profile.spouseRetirementContributions?.employee || 0),
            spouseMonthlyEmployer401k: savedOpt.spouseMonthlyEmployer401k || Math.round(profile.spouseRetirementContributions?.employer || 0),
            spouseAnnualTraditionalIRA: savedOpt.spouseAnnualTraditionalIRA || Math.round(profile.spouseTraditionalIRAContribution || 0),
            spouseAnnualRothIRA: savedOpt.spouseAnnualRothIRA || Math.round(profile.spouseRothIRAContribution || 0),
            monthlyExpenses: savedOpt.monthlyExpenses || (profile.expectedMonthlyExpensesRetirement ? Math.round(profile.expectedMonthlyExpensesRetirement) : undefined),
            partTimeIncome: savedOpt.partTimeIncome || Math.round(profile.partTimeIncomeRetirement || 0),
            spousePartTimeIncome: savedOpt.spousePartTimeIncome || Math.round(profile.spousePartTimeIncomeRetirement || 0),
            hasLongTermCareInsurance: savedOpt.hasLongTermCareInsurance ?? (profile.hasLongTermCareInsurance || false),
          };
          
          // Log the extracted variables to debug
          console.log('Extracted saved variables:', savedVariables);
          console.log('Full optimizationVariables:', profile.optimizationVariables);
          
          setVariables(savedVariables);
          
          // Restore locked state and optimization history
          const savedIsLocked = savedOpt.isLocked;
          if (savedIsLocked !== undefined) {
            setIsLocked(savedIsLocked);
          } else {
            setIsLocked(true); // Default to locked if we have saved variables
          }
          
          if (savedOpt.hasOptimized) {
            setHasOptimizedOnce(true);
          }
          
          // Load saved optimized score if available
          if (savedOpt.optimizedScore) {
            setOptimizedScore(savedOpt.optimizedScore);
          }
          
          // Load saved cash flow data if available in optimizationVariables
          if (savedOpt.currentCashFlowData) {
            setCurrentCashFlowData(savedOpt.currentCashFlowData);
          }
          if (savedOpt.optimizedCashFlowData) {
            setOptimizedCashFlowData(savedOpt.optimizedCashFlowData);
          }
          
          // NEW: Also load cash flows persisted by backend optimize endpoint
          const persisted = profile.monteCarloSimulation?.cashFlowProjections;
          if (persisted) {
            if (persisted.baselineCashFlow?.length && !currentCashFlowData) {
              setCurrentCashFlowData(persisted.baselineCashFlow);
            }
            if (persisted.optimizedCashFlow?.length && !optimizedCashFlowData) {
              setOptimizedCashFlowData(persisted.optimizedCashFlow);
            }
          }
          
          // Load saved MC Withdrawals data if available
          if (savedOpt.mcWithdrawalsData) {
            setMcWithdrawalsData(savedOpt.mcWithdrawalsData);
          }
          
          // Log restoration of new persisted data
          console.log('Restoring additional optimization data:', {
            hasOptimizedProbability: !!savedOpt.optimizedRetirementSuccessProbability,
            hasImpactPortfolioData: !!savedOpt.impactPortfolioBalanceData,
            impactDataStructure: savedOpt.impactPortfolioBalanceData ? Object.keys(savedOpt.impactPortfolioBalanceData) : null
          });
          
          // Additional data is restored automatically when components access profile.optimizationVariables
          // The optimized retirement success probability and impact portfolio balance data
          // will be available to their respective components via the profile context

          // Load UI preferences
          if (profile.retirementPlanningUIPreferences) {
            const uiPrefs = profile.retirementPlanningUIPreferences;
            // Auto-collapse optimization guide when locked and optimized
            if (uiPrefs.optimizationGuideCollapsed !== undefined && savedIsLocked && savedOpt.hasOptimized) {
              setShowSuggestions(!uiPrefs.optimizationGuideCollapsed);
            }
          } else if (savedIsLocked && savedOpt.hasOptimized) {
            // Default behavior: collapse guide when locked and optimized
            setShowSuggestions(false);
          }
          

          if (!savedOpt.optimizedScore && savedOpt.lockedAt) {
            // If variables are locked but no score saved, run optimization
            handleOptimize();
          }

          // Mark that profile data and any saved optimization variables are loaded
          setProfileLoaded(true);
        } else {
          // Pre-populate form with intake form data (baseline values)
          // This ensures users always start from their intake form values on first visit
          // or when they haven't run optimization yet
          console.log('Prepopulating variables from intake form data (baseline):', {
            desiredRetirementAge: profile.desiredRetirementAge,
            socialSecurityClaimAge: profile.socialSecurityClaimAge,
            retirementContributions: profile.retirementContributions,
            traditionalIRAContribution: profile.traditionalIRAContribution,
            rothIRAContribution: profile.rothIRAContribution,
            expectedMonthlyExpensesRetirement: profile.expectedMonthlyExpensesRetirement,
            hasLongTermCareInsurance: profile.hasLongTermCareInsurance,
            expectedRealReturn: profile.expectedRealReturn
          });
          
          // Map risk profiles to asset allocation values
          const riskProfileToAllocation: { [key: number]: string } = {
            1: '5',     // Conservative → 5%
            2: '5.6',   // Moderately Conservative → 5.6%
            3: '6.1',   // Moderate → 6.1%
            4: '6.6',   // Moderately Aggressive → 6.6%
            5: '7'      // Aggressive → 7%
          };
          
          // Get user and spouse risk profiles from intake form
          const userRiskProfile = profile.riskQuestions?.[0] || 3; // Default to Moderate
          const spouseRiskProfile = profile.spouseRiskQuestions?.[0] || userRiskProfile; // Default to user's profile
          
          console.log('Risk profiles from intake form:', {
            userRiskProfile,
            spouseRiskProfile,
            userRiskQuestions: profile.riskQuestions,
            spouseRiskQuestions: profile.spouseRiskQuestions
          });
          
          // Map risk profiles to asset allocation selections
          // expectedRealReturn values:
          // -3: Use risk profile-based returns (from intake form)
          // -2: Use current allocation
          // -1: Use glide path
          // > 0: Fixed return percentage
          const userAssetAllocation = 
            profile.expectedRealReturn === -3 ? riskProfileToAllocation[userRiskProfile] : // Risk-based (from intake)
            profile.expectedRealReturn === -2 ? 'current-allocation' :
            profile.expectedRealReturn === -1 ? 'glide-path' : 
            (profile.expectedRealReturn && profile.expectedRealReturn > 0 ? (profile.expectedRealReturn * 100).toString() : 
             riskProfileToAllocation[userRiskProfile]); // Default to risk-based
          
          // Map spouse risk profile to asset allocation
          const spouseAssetAllocation = profile.maritalStatus === 'married' && spouseRiskProfile ? 
            riskProfileToAllocation[spouseRiskProfile] : 
            userAssetAllocation; // Use user's allocation if not married
          
          // Pre-populate with existing contribution values from profile (matching intake form Step 11 structure)
          const prepopulatedVariables = {
            retirementAge: profile.desiredRetirementAge || 65,
            spouseRetirementAge: profile.spouseDesiredRetirementAge || 65,
            socialSecurityAge: profile.socialSecurityClaimAge || 67,
            spouseSocialSecurityAge: profile.spouseSocialSecurityClaimAge || 67,
            socialSecurityBenefit: profile.socialSecurityBenefit || undefined,
            spouseSocialSecurityBenefit: profile.spouseSocialSecurityBenefit || undefined,
            pensionBenefit: profile.pensionBenefit || undefined,
            spousePensionBenefit: profile.spousePensionBenefit || undefined,
            assetAllocation: userAssetAllocation,
            spouseAssetAllocation: spouseAssetAllocation,
            // User contribution fields - same as intake form Step 11
            monthlyEmployee401k: Math.round(profile.retirementContributions?.employee || 0),
            monthlyEmployer401k: Math.round(profile.retirementContributions?.employer || 0),
            annualTraditionalIRA: Math.round(profile.traditionalIRAContribution || 0),
            annualRothIRA: Math.round(profile.rothIRAContribution || 0),
            // Spouse contribution fields
            spouseMonthlyEmployee401k: Math.round(profile.spouseRetirementContributions?.employee || 0),
            spouseMonthlyEmployer401k: Math.round(profile.spouseRetirementContributions?.employer || 0),
            spouseAnnualTraditionalIRA: Math.round(profile.spouseTraditionalIRAContribution || 0),
            spouseAnnualRothIRA: Math.round(profile.spouseRothIRAContribution || 0),
            monthlyExpenses: profile.expectedMonthlyExpensesRetirement ? Math.round(profile.expectedMonthlyExpensesRetirement) : undefined,
            partTimeIncome: Math.round(profile.partTimeIncomeRetirement || 0),
            spousePartTimeIncome: Math.round(profile.spousePartTimeIncomeRetirement || 0),
            hasLongTermCareInsurance: profile.hasLongTermCareInsurance || false,
          };
          
          console.log('Setting prepopulated variables:', {
            ...prepopulatedVariables,
            mappedFromRiskProfiles: {
              userRiskProfile,
              spouseRiskProfile,
              userAllocation: userAssetAllocation,
              spouseAllocation: spouseAssetAllocation
            }
          });
          setVariables(prepopulatedVariables);
          
        }

        // Get optimization suggestions from Gemini
        fetchOptimizationSuggestions();
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    }
  };

  const fetchOptimizationSuggestions = async () => {
    try {
      const response = await fetch('/api/retirement-optimization-suggestions');
      if (response.ok) {
        const data = await response.json();
        setOptimalSSAges(data.optimalSSAges);
        setOptimizationSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Error fetching optimization suggestions:', error);
    }
  };

  const handleOptimize = async () => {
    console.log('🎯 Starting optimization process with variables:', variables);
    const controller = new AbortController();
    setOptimizationController(controller);
    setIsOptimizing(true);
    
    // Validate required fields before sending
    if (!variables.retirementAge || !variables.socialSecurityAge) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in retirement age and Social Security claim age before optimizing.",
        variant: "destructive",
      });
      setIsOptimizing(false);
      return;
    }
    
    try {
      // Use the new optimization endpoint
      const response = await fetch('/api/optimize-retirement-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          optimizationVariables: variables,
          skipCache: false
        }),
        signal: controller.signal
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Optimization failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Optimization result received:', {
        probability: result.probability,
        score: result.score,
        medianEndingBalance: result.medianEndingBalance,
        hasYearlyCashFlows: Array.isArray(result.yearlyCashFlows),
        yearlyCashFlowsLength: result.yearlyCashFlows?.length || 0,
        hasScenarios: !!result.scenarios,
        responseKeys: Object.keys(result)
      });
      
      // Track previous score for comparison
      if (optimizedScore) {
        setPreviousScore(optimizedScore.probabilityOfSuccess || optimizedScore.probability);
      }
      
      // Format result for existing UI expectations
      const formattedResult = {
        probabilityOfSuccess: result.probability || result.probabilityOfSuccess,
        score: result.score,
        medianEndingBalance: result.medianEndingBalance || 0,
        message: result.message,
        calculatedAt: result.calculatedAt,
        optimizationVariables: result.optimizationVariables,
        
        // ✅ ADD MISSING FIELDS FROM BACKEND RESPONSE
        yearlyCashFlows: result.yearlyCashFlows || [],
        scenarios: result.scenarios || { successful: 0, failed: 0, total: 0 },
        confidenceIntervals: result.confidenceIntervals || {},
        percentile10EndingBalance: result.percentile10EndingBalance || 0,
        percentile90EndingBalance: result.percentile90EndingBalance || 0,
        yearsUntilDepletion: result.yearsUntilDepletion || null,
        safeWithdrawalRate: result.safeWithdrawalRate || 0
      };
      
      setOptimizedScore(formattedResult);
      setHasOptimizedOnce(true);
      console.log('✅ Optimized score state updated');
      
      // Broadcast calculation so UI widgets (gauge) can refresh immediately
      try {
        window.dispatchEvent(new CustomEvent('retirementOptimizationCalculated', {
          detail: { result: formattedResult, variables }
        }));
      } catch (_) {}

      // Also notify projections/impact components to kick off their calculations without waiting
      try {
        window.dispatchEvent(new CustomEvent('retirementOptimizationUpdated', {
          detail: { optimizedAt: formattedResult.calculatedAt || new Date().toISOString(), variables }
        }));
      } catch (_) {}

      // Stop the UI spinner early – long-running projections/impact will run in background
      setIsOptimizing(false);
      setOptimizationController(null);

      // Save optimization data to database automatically (no projections yet)
      console.log('💾 Saving optimization data to database (score only)...');
      // Validate variables before saving to prevent empty data
      const validatedVariables = {
        ...variables,
        retirementAge: variables.retirementAge || profile?.desiredRetirementAge || 65,
        socialSecurityAge: variables.socialSecurityAge || profile?.socialSecurityClaimAge || 67,
        monthlyEmployee401k: variables.monthlyEmployee401k || 0,
        monthlyEmployer401k: variables.monthlyEmployer401k || 0,
        annualTraditionalIRA: variables.annualTraditionalIRA || 0,
        annualRothIRA: variables.annualRothIRA || 0,
        monthlyExpenses: variables.monthlyExpenses || 0,
        assetAllocation: variables.assetAllocation || 'glide-path',
      };

      // Persist in background so we don't block UI responsiveness
      (async () => {
        try {
          const saveResponse = await fetch('/api/financial-profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              optimizationVariables: {
                ...validatedVariables,
                optimizedAt: formattedResult.calculatedAt || new Date().toISOString(),
                optimizedScore: formattedResult,
                optimizedRetirementSuccessProbability: formattedResult.probabilityOfSuccess,
                hasOptimized: true,
                isLocked: isLocked
              },
              // Save Monte Carlo result summary for reference; no projections yet
              monteCarloSimulation: formattedResult
            })
          });
          if (!saveResponse.ok) {
            console.warn('⚠️ Failed to save optimization data to database');
          } else {
            console.log('✅ Optimization data saved (score only)');
          }
          // Light-weight profile refresh to help listeners relying on profile updates
          try {
            const pRes = await fetch('/api/financial-profile', { credentials: 'include' });
            if (pRes.ok) {
              const p = await pRes.json();
              setProfile(p);
            }
          } catch (_) {}
        } catch (saveError) {
          console.error('❌ Error saving optimization data:', saveError);
        }
      })();

      // Show success toast for score calculation only
      toast({
        title: "🎯 Optimization Complete",
        description: `Your retirement success probability is ${formattedResult.probabilityOfSuccess.toFixed(1)}%. Generating optimized projections in background...`,
        className: "bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-700/50 text-green-300",
      });
      
      // Determine if score increased or decreased
      const previousScore = currentScore?.probabilityOfSuccess || 0;
      const newScore = formattedResult.probabilityOfSuccess;
      const scoreDifference = newScore - previousScore;
      
      console.log('Score comparison:', { previousScore, newScore, scoreDifference });
      
      // Create detailed explanation for score change
      let description = '';
      let explanationNote = '';
      
      // Generate explanation based on key variables that changed
      const generateExplanation = () => {
        const explanations = [];
        
        if (variables.hasLongTermCareInsurance !== (currentScore?.optimizationVariables?.hasLongTermCareInsurance ?? false)) {
          if (variables.hasLongTermCareInsurance) {
            explanations.push('Added LTC insurance creates guaranteed premium costs (~$5K/year) that reduce portfolio growth, despite providing protection');
          } else {
            explanations.push('Removing LTC insurance eliminates premium costs, allowing more money for retirement savings');
          }
        }
        
        if (variables.socialSecurityAge !== (currentScore?.optimizationVariables?.socialSecurityAge ?? 67)) {
          if (variables.socialSecurityAge > (currentScore?.optimizationVariables?.socialSecurityAge ?? 67)) {
            explanations.push(`Delaying Social Security to age ${variables.socialSecurityAge} increases lifetime benefits through delayed retirement credits`);
          } else {
            explanations.push(`Claiming Social Security earlier at age ${variables.socialSecurityAge} reduces lifetime benefits but provides cash flow sooner`);
          }
        }
        
        if (variables.retirementAge !== (currentScore?.optimizationVariables?.retirementAge ?? 65)) {
          if (variables.retirementAge > (currentScore?.optimizationVariables?.retirementAge ?? 65)) {
            explanations.push(`Retiring later at age ${variables.retirementAge} allows more savings accumulation time`);
          } else {
            explanations.push(`Retiring earlier at age ${variables.retirementAge} reduces savings time but allows earlier withdrawal`);
          }
        }
        
        if (variables.monthlyExpenses !== (currentScore?.optimizationVariables?.monthlyExpenses ?? 0)) {
          const diff = variables.monthlyExpenses - (currentScore?.optimizationVariables?.monthlyExpenses ?? 0);
          if (diff > 0) {
            explanations.push(`Higher retirement expenses ($${Math.abs(diff).toLocaleString()}/month more) require larger portfolio`);
          } else if (diff < 0) {
            explanations.push(`Lower retirement expenses ($${Math.abs(diff).toLocaleString()}/month less) reduce required portfolio size`);
          }
        }
        
        return explanations.slice(0, 2); // Show up to 2 key explanations
      };
      
      const explanations = generateExplanation();
      
      if (scoreDifference > 0) {
        description = `🚀 Your retirement success probability increased to ${newScore.toFixed(1)}%`;
        if (explanations.length > 0) {
          explanationNote = ` Key factors: ${explanations.join('. ')}.`;
        }
      } else if (scoreDifference < 0) {
        description = `📉 Your retirement success probability decreased to ${newScore.toFixed(1)}%`;
        if (explanations.length > 0) {
          explanationNote = ` Key factors: ${explanations.join('. ')}.`;
        }
      } else {
        description = `➡️ Your retirement success probability remained at ${newScore.toFixed(1)}%`;
        explanationNote = ' No significant impact from variable changes.';
      }
      
      toast({
        title: scoreDifference > 0 ? "Success Rate Improved! ✨" : 
               scoreDifference < 0 ? "Success Rate Decreased ⚠️" : 
               "No Change in Success Rate",
        description: description + explanationNote,
        className: scoreDifference > 0 ? "bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-700/50 text-green-300" :
                   scoreDifference < 0 ? "bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-amber-700/50 text-amber-300" :
                   "bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-700/50 text-blue-300",
        duration: 8000, // Show for 8 seconds to allow reading the explanation
      });
      
      console.log('Optimization completed successfully:', {
        previousScore,
        newScore,
        scoreDifference,
        hasOptimizedScore: !!formattedResult,
        hasYearlyCashFlows: formattedResult.yearlyCashFlows?.length || 0
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Optimization was aborted by user');
        toast({
          title: "Optimization Cancelled",
          description: "The optimization was cancelled.",
        });
      } else {
        console.error('Error optimizing retirement score:', error);
        toast({
          title: "Error",
          description: "Failed to optimize retirement score. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      console.log('Optimization process finished, cleaning up state');
      // No-op if already cleared above; safe to call
      setIsOptimizing(false);
      setOptimizationController(null);
      console.log('State cleanup completed');
    }
  };

  const handleLockAndContinue = async () => {
    if (isLocking) return;
    if (!variables.retirementAge || !variables.socialSecurityAge) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in retirement age and Social Security claim age before locking.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLocking(true);
      setLockingTime(0);
      const t = setInterval(() => setLockingTime((s) => s + 1), 1000);

      // Persist lock state and variables
      const nowIso = new Date().toISOString();
      const validatedVariables = {
        ...variables,
        retirementAge: variables.retirementAge || profile?.desiredRetirementAge || 65,
        socialSecurityAge: variables.socialSecurityAge || profile?.socialSecurityClaimAge || 67,
        monthlyEmployee401k: variables.monthlyEmployee401k || 0,
        monthlyEmployer401k: variables.monthlyEmployer401k || 0,
        annualTraditionalIRA: variables.annualTraditionalIRA || 0,
        annualRothIRA: variables.annualRothIRA || 0,
        monthlyExpenses: variables.monthlyExpenses || 0,
        assetAllocation: variables.assetAllocation || 'glide-path',
      };

      await fetch('/api/financial-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          optimizationVariables: {
            ...validatedVariables,
            lockedAt: nowIso,
            isLocked: true,
            hasOptimized: true,
            optimizedAt: nowIso,
            optimizedScore: optimizedScore || null,
            optimizedRetirementSuccessProbability: optimizedScore?.probabilityOfSuccess ?? null
          }
        })
      });

      // Ensure baseline bands are available (generate if needed)
      let baselineBands: any | null = null;
      try {
        const baselineRes = await fetch('/api/retirement-bands', { credentials: 'include' });
        if (baselineRes.ok) {
          const saved = await baselineRes.json();
          if (!saved.needsCalculation) baselineBands = saved;
        }
      } catch {}
      if (!baselineBands) {
        const genRes = await fetch('/api/calculate-retirement-bands', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skipCache: true })
        });
        if (genRes.ok) baselineBands = await genRes.json();
      }

      // Generate optimized bands using same Piscina worker pool as optimization
      const optRes = await fetch('/api/calculate-retirement-bands-optimization', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedVariables)
      });
      if (!optRes.ok) {
        try {
          const err = await optRes.json();
          throw new Error(err?.error || 'Failed to calculate optimized projections');
        } catch (e: any) {
          throw new Error(e?.message || 'Failed to calculate optimized projections');
        }
      }
      const optimizedBands = await optRes.json();

      // Save optimized bands snapshot to profile (cache)
      try {
        await fetch('/api/financial-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ optimizationVariables: { optimizedRetirementBands: optimizedBands } })
        });
      } catch {}

      // Compute impact-on-portfolio-balance data and cache it
      try {
        if (baselineBands && optimizedBands) {
          const baselineAges = baselineBands.ages || [];
          const optimizedAges = optimizedBands.ages || [];
          const baselineMedian = baselineBands.percentiles?.p50 || [];
          const optimizedMedian = optimizedBands.percentiles?.p50 || [];
          const minLen = Math.min(baselineAges.length, optimizedAges.length, baselineMedian.length, optimizedMedian.length);
          const projectionData = [] as Array<{ age: number; baseline: number; optimized: number; difference: number }>;
          for (let i = 0; i < minLen; i++) {
            const age = baselineAges[i] || optimizedAges[i];
            const b = Math.round(baselineMedian[i] || 0);
            const o = Math.round(optimizedMedian[i] || 0);
            projectionData.push({ age, baseline: b, optimized: o, difference: o - b });
          }
          const last = projectionData[projectionData.length - 1];
          const comparison = last ? {
            finalBaseline: last.baseline,
            finalOptimized: last.optimized,
            finalDifference: last.difference,
            percentageImprovement: last.baseline > 0 ? Math.round(((last.optimized - last.baseline) / last.baseline) * 100) : 0
          } : null;

          if (projectionData.length > 0) {
            await fetch('/api/retirement/impact-on-portfolio-balance-cache', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectionData, comparison })
            });
          }
        }
      } catch (e) {
        console.warn('Failed to cache impact-on-portfolio-balance data', e);
      }

      // Refresh profile and broadcast update so widgets render instantly
      try {
        const profileResponse = await fetch('/api/financial-profile');
        if (profileResponse.ok) {
          const updatedProfile = await profileResponse.json();
          setProfile(updatedProfile);
        }
      } catch {}
      window.dispatchEvent(new CustomEvent('retirementOptimizationUpdated', {
        detail: { optimizedAt: nowIso, variables: validatedVariables }
      }));

      setIsLocked(true);
      toast({
        title: '🔒 Locked & Generated',
        description: 'Optimized projections and impact analysis are ready.',
      });

      clearInterval(t);
      setIsLocking(false);
      setLockingTime(0);
    } catch (err: any) {
      console.error('Lock & Continue failed', err);
      toast({
        title: 'Lock failed',
        description: err?.message || 'Unable to lock and generate projections.',
        variant: 'destructive'
      });
      setIsLocking(false);
    }
  };


  const handleCancelOptimization = () => {
    if (optimizationController) {
      optimizationController.abort();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return '#10B981';
    if (score >= 75) return '#3B82F6';
    if (score >= 65) return '#F59E0B';
    return '#EF4444';
  };
  
  const formatCurrency = (amount: number) => {
    // Safety check for invalid inputs
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      console.warn('formatCurrency received invalid amount:', amount);
      return '$0';
    }
    
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000000) {
      return `${amount < 0 ? '-' : ''}$${(absAmount / 1000000).toFixed(1)}M`;
    } else if (absAmount >= 1000) {
      return `${amount < 0 ? '-' : ''}$${(absAmount / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const ScoreDisplay = ({ score, title, isOptimized = false }: { score: MonteCarloResult | null; title: string; isOptimized?: boolean }) => {
    if (!score || typeof score.probabilityOfSuccess !== 'number') {
      console.warn('ScoreDisplay received invalid score:', score);
      return null;
    }

    const scoreColor = getScoreColor(score.probabilityOfSuccess);
    const improvementDelta = isOptimized && currentScore && typeof currentScore.probabilityOfSuccess === 'number' 
      ? score.probabilityOfSuccess - currentScore.probabilityOfSuccess 
      : 0;

    return (
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {isOptimized && improvementDelta > 0 && (
            <span className="text-sm font-medium text-green-400 bg-green-950/50 px-2 py-0.5 rounded-full border border-green-800/50">
              +{improvementDelta.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="relative inline-block">
          <div className="absolute inset-0 blur-3xl opacity-20" style={{ backgroundColor: scoreColor }}></div>
          <Gauge
            value={score.probabilityOfSuccess}
            max={100}
            size="lg"
            showValue={true}
            colors={{
              low: '#EF4444',
              medium: '#F59E0B',
              high: '#10B981'
            }}
            thresholds={{
              medium: 65,
              high: 85
            }}
          />
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-2xl font-bold text-white">
            {score.probabilityOfSuccess.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-400">
            Success Probability
          </p>
          <p className="text-xs text-gray-500">
            Based on market simulations
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            Retirement Planning
          </h1>
          
          {/* Compliance Disclaimer */}
          <Alert className="bg-gray-900/50 border-gray-800 mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-gray-400">
              <strong>Important:</strong> This retirement planning tool provides estimates based on historical data and assumptions. 
              Actual results may vary. Consult with a qualified financial advisor for personalized advice.
            </AlertDescription>
          </Alert>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-900/60 border border-gray-800/80 rounded-xl p-4 grid grid-cols-8 w-full gap-6 shadow-inner backdrop-blur-sm">
            <TabsTrigger 
              value="optimize-score" 
              className="h-11 w-full justify-center rounded-xl border border-gray-800/70 bg-gray-800/20 hover:bg-gray-800/40 hover:border-gray-700 data-[state=active]:bg-purple-600/90 data-[state=active]:border-purple-500/60 data-[state=active]:shadow-md text-white transition-all text-sm font-medium px-4"
            >
              <Calculator className="w-5 h-5 mr-2" />
              Optimization
            </TabsTrigger>
            <TabsTrigger 
              value="portfolio-projections" 
              className="h-11 w-full justify-center rounded-xl border border-gray-800/70 bg-gray-800/20 hover:bg-gray-800/40 hover:border-gray-700 data-[state=active]:bg-purple-600/90 data-[state=active]:border-purple-500/60 data-[state=active]:shadow-md text-white transition-all text-sm font-medium px-4"
            >
              <BarChart3 className="w-5 h-5 mr-2" />
              Portfolio projections
            </TabsTrigger>
            <TabsTrigger 
              value="portfolio-impact" 
              className="h-11 w-full justify-center rounded-xl border border-gray-800/70 bg-gray-800/20 hover:bg-gray-800/40 hover:border-gray-700 data-[state=active]:bg-purple-600/90 data-[state=active]:border-purple-500/60 data-[state=active]:shadow-md text-white transition-all text-sm font-medium px-4"
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              Portfolio impact
            </TabsTrigger>
            <TabsTrigger 
              value="stress-tests" 
              className="h-11 w-full justify-center rounded-xl border border-gray-800/70 bg-gray-800/20 hover:bg-gray-800/40 hover:border-gray-700 data-[state=active]:bg-purple-600/90 data-[state=active]:border-purple-500/60 data-[state=active]:shadow-md text-white transition-all text-sm font-medium px-4"
            >
              <Shield className="w-5 h-5 mr-2" />
              Stress Tests
            </TabsTrigger>
            <TabsTrigger 
              value="mc-withdrawals" 
              className={`h-11 w-full justify-center rounded-xl border border-gray-800/70 bg-gray-800/20 hover:bg-gray-800/40 hover:border-gray-700 data-[state=active]:bg-purple-600/90 data-[state=active]:border-purple-500/60 data-[state=active]:shadow-md text-white transition-all text-sm font-medium px-4 ${!hasOptimizedOnce ? 'opacity-60' : ''}`}
            >
              <BarChart3 className="w-5 h-5 mr-2" />
              Income
              {(!hasOptimizedOnce) && <AlertCircle className="w-3 h-3 ml-1 text-amber-400" />}
            </TabsTrigger>
            <TabsTrigger 
              value="cash-flow" 
              className="h-11 w-full justify-center rounded-xl border border-gray-800/70 bg-gray-800/20 hover:bg-gray-800/40 hover:border-gray-700 data-[state=active]:bg-purple-600/90 data-[state=active]:border-purple-500/60 data-[state=active]:shadow-md text-white transition-all text-sm font-medium px-4"
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Cash Flow
            </TabsTrigger>
            <TabsTrigger 
              value="social-security" 
              className="h-11 w-full justify-center rounded-xl border border-gray-800/70 bg-gray-800/20 hover:bg-gray-800/40 hover:border-gray-700 data-[state=active]:bg-purple-600/90 data-[state=active]:border-purple-500/60 data-[state=active]:shadow-md text-white transition-all text-sm font-medium px-4"
            >
              <Users className="w-5 h-5 mr-2" />
              Social Security
            </TabsTrigger>
            <TabsTrigger 
              value="insights" 
              className="h-11 w-full justify-center rounded-xl border border-gray-800/70 bg-gray-800/20 hover:bg-gray-800/40 hover:border-gray-700 data-[state=active]:bg-purple-600/90 data-[state=active]:border-purple-500/60 data-[state=active]:shadow-md text-white transition-all text-sm font-medium px-4"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Insights
            </TabsTrigger>
          </TabsList>

          {/* Optimizing Your Score Tab */}
          <TabsContent value="optimize-score" className="space-y-6">
            {/* Floating widget removed; rely on bottom-right notifications only */}
            
            {/* Important Note about Base Optimization */}
            <Alert className="bg-blue-900/20 border-blue-500/50 mb-6">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-300">
                <strong>Base Retirement Optimization:</strong> This analysis evaluates your core retirement success probability 
                without tax optimization strategies. Once you achieve a solid base score (80%+), explore Roth conversions 
                in the dedicated tab to potentially enhance your after-tax outcomes.
              </AlertDescription>
            </Alert>
            
            {/* Baseline and Optimization Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Baseline Retirement Success */}
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <h2 className="text-xl font-semibold text-white">Baseline Retirement Success</h2>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Your current retirement success probability. 
                  This serves as the baseline for comparison with optimization scenarios.
                </p>
                <div className="flex-1">
                  <RetirementBaselineWidget className="h-full" />
                </div>
              </div>

              {/* Optimization Retirement Success */}
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h2 className="text-xl font-semibold text-white">Optimization</h2>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Your retirement success probability with optimization variables applied. 
                  Adjust variables in the form below to see real-time impact on your retirement success.
                </p>
                <div className="flex-1">
                  <RetirementOptimizationWidget 
                    className="h-full"
                    optimizationVariables={variables}
                    profile={profile}
                    onOptimize={handleOptimize}
                  />
                </div>
              </div>
            </div>
            



            {/* Optimization Suggestions Section */}
            <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden mb-6">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
              <CardHeader 
                className="pb-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={handleOptimizationGuideToggle}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lightbulb className="w-6 h-6 text-amber-400" />
                    <div>
                      <CardTitle className="text-xl font-bold text-white">Optimization Strategy Guide</CardTitle>
                      <p className="text-sm text-gray-400 mt-1">Recommended order for adjusting variables to maximize your retirement score</p>
                    </div>
                  </div>
                  {showSuggestions ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </CardHeader>
              
              <AnimatePresence>
                {showSuggestions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="space-y-3 pt-0">
                      {/* Suggestion 1: Optimal Social Security */}
                      <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-amber-500/30 transition-colors">
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-amber-400">1</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-amber-400" />
                            <h4 className="text-sm font-semibold text-white">Select Optimal Social Security Claim Age</h4>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Use the recommended claim age shown above to maximize lifetime benefits. Can improve score by 8-12%.
                          </p>
                        </div>
                      </div>

                      {/* Suggestion 2: LTC Insurance */}
                      <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-amber-500/30 transition-colors">
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-amber-400">2</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-amber-400" />
                            <h4 className="text-sm font-semibold text-white">Get Long-Term Care Insurance</h4>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Protects your retirement savings from healthcare costs. Can improve your score by 5-10%.
                          </p>
                        </div>
                      </div>

                      {/* Suggestion 3: Maximize Contributions */}
                      <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-amber-500/30 transition-colors">
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-amber-400">3</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-amber-400" />
                            <h4 className="text-sm font-semibold text-white">Maximize Retirement Account Contributions</h4>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Max out 401(k), 403(b), and IRA contributions. Each $500/month can improve score by 3-5%.
                          </p>
                        </div>
                      </div>

                      {/* Suggestion 4: Optimize Allocation */}
                      <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-amber-500/30 transition-colors">
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-amber-400">4</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <PieChart className="w-4 h-4 text-amber-400" />
                            <h4 className="text-sm font-semibold text-white">Optimize Asset Allocation</h4>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Use a glide path strategy to automatically adjust risk as you approach retirement.
                          </p>
                        </div>
                      </div>

                      {/* Suggestion 5: Delay Retirement */}
                      <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-amber-500/30 transition-colors">
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-amber-400">5</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <h4 className="text-sm font-semibold text-white">Delay Retirement by 1-2 Years</h4>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Each additional year of work can improve your score by 5-7% through continued savings and growth.
                          </p>
                        </div>
                      </div>

                      {/* Suggestion 6: Part-time Work */}
                      <div className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-amber-500/30 transition-colors">
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-amber-400">6</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-amber-400" />
                            <h4 className="text-sm font-semibold text-white">Consider Part-Time Work in Retirement</h4>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Even $1,000-2,000/month in part-time income can significantly reduce portfolio withdrawals.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-300">
                            <strong>Pro Tip:</strong> Start with changes that require no lifestyle adjustments (LTC insurance, allocation), 
                            then consider larger changes if needed to reach your target score of 80%+.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Social Security Optimizer */}
            <SocialSecurityOptimizer profile={profile} />

            {/* Optimization Variables Form */}
            <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
              <CardHeader 
                className="pb-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => setIsFormCollapsed(!isFormCollapsed)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-2xl font-bold text-white">Optimization Variables</CardTitle>
                    </div>
                    {!isFormCollapsed ? (
                      <p className="text-sm text-gray-400 mt-1">Adjust these parameters to optimize your retirement plan</p>
                    ) : (
                      <p className="text-sm text-gray-400 mt-1">
                        {optimizedScore ? 
                          `Optimized Score: ${Math.round(optimizedScore.probabilityOfSuccess)}% | Click to expand and adjust variables` :
                          'Click to expand and adjust optimization variables'
                        }
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isFormCollapsed ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {/* Mini Summary when collapsed */}
              {isFormCollapsed && optimizedScore && (
                <CardContent className="pt-0 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <p className="text-gray-500">Retirement Age</p>
                      <p className="text-white font-medium">
                        {isMarried ? `${variables.retirementAge} / ${variables.spouseRetirementAge}` : variables.retirementAge}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">SS Claim Age</p>
                      <p className="text-white font-medium">
                        {isMarried ? `${variables.socialSecurityAge} / ${variables.spouseSocialSecurityAge}` : variables.socialSecurityAge}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Monthly Expenses</p>
                      <p className="text-white font-medium">${variables.monthlyExpenses.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">LTC Insurance</p>
                      <p className="text-white font-medium">{variables.hasLongTermCareInsurance ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </CardContent>
              )}
              
              <AnimatePresence>
                {!isFormCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: "hidden" }}
                  >
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* User Retirement Age */}
                  <div className="space-y-2">
                    <Label htmlFor="retirement-age" className="text-sm font-medium text-gray-300 flex items-center">
                      Your Retirement Age
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 ml-2 text-gray-500 hover:text-gray-400 transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-gray-800 border-gray-700">
                            <p>The age at which you plan to retire</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <div className="relative">
                      <Input
                        id="retirement-age"
                        type="number"
                        min="50"
                        max="75"
                        value={variables.retirementAge}
                        onChange={(e) => setVariables({...variables, retirementAge: parseInt(e.target.value) || 65})}
                        
                        className="bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      />
                      
                    </div>
                  </div>

                  {/* Spouse Retirement Age */}
                  {isMarried && (
                    <div className="space-y-2">
                      <Label htmlFor="spouse-retirement-age" className="text-sm font-medium text-gray-300">
                        Spouse Retirement Age
                      </Label>
                      <div className="relative">
                        <Input
                          id="spouse-retirement-age"
                          type="number"
                          min="50"
                          max="75"
                          value={variables.spouseRetirementAge}
                          onChange={(e) => setVariables({...variables, spouseRetirementAge: parseInt(e.target.value) || 65})}
                          
                          className="bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        />
                        
                      </div>
                    </div>
                  )}


                  {/* Investment Strategy (aligned; 2-up with spouse on desktop) */}
                  <div className={`grid grid-cols-1 ${isMarried ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-8 items-end`}>
                  {/* User Investment Strategy */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-300 flex items-center">
                      Your Investment Strategy
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 ml-2 text-gray-500 hover:text-gray-400 transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-gray-800 border-gray-700">
                            <p>Your retirement investment approach</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Select
                      value={variables.assetAllocation}
                      onValueChange={(value) => setVariables({...variables, assetAllocation: value})}
                      
                    >
                      <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500">
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="current-allocation" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                          <div className="flex items-center gap-2">
                            <PieChart className="w-4 h-4 text-purple-400" />
                            Current Allocation (Your Risk Profile)
                          </div>
                        </SelectItem>
                        <SelectItem value="glide-path" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                            Glide Path (Recommended)
                          </div>
                        </SelectItem>
                        <SelectItem value="5" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                          5% - Conservative
                        </SelectItem>
                        <SelectItem value="5.6" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                          5.6% - Moderately Conservative
                        </SelectItem>
                        <SelectItem value="6.1" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                          6.1% - Moderate
                        </SelectItem>
                        <SelectItem value="6.6" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                          6.6% - Moderately Aggressive
                        </SelectItem>
                        <SelectItem value="7" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                          7% - Aggressive
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Spouse Investment Strategy */}
                  {isMarried && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-300 flex items-center">
                        Spouse Investment Strategy
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 ml-2 text-gray-500 hover:text-gray-400 transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-gray-800 border-gray-700">
                              <p>Spouse's retirement investment approach</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select
                        value={variables.spouseAssetAllocation}
                        onValueChange={(value) => setVariables({...variables, spouseAssetAllocation: value})}
                        
                      >
                        <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500">
                          <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="current-allocation" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                            <div className="flex items-center gap-2">
                              <PieChart className="w-4 h-4 text-purple-400" />
                              Current Allocation (Spouse Risk Profile)
                            </div>
                          </SelectItem>
                          <SelectItem value="glide-path" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-purple-400" />
                              Glide Path (Recommended)
                            </div>
                          </SelectItem>
                          <SelectItem value="5" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                            5% - Conservative
                          </SelectItem>
                          <SelectItem value="5.6" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                            5.6% - Moderately Conservative
                          </SelectItem>
                          <SelectItem value="6.1" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                            6.1% - Moderate
                          </SelectItem>
                          <SelectItem value="6.6" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                            6.6% - Moderately Aggressive
                          </SelectItem>
                          <SelectItem value="7" className="text-white hover:bg-gray-700 focus:bg-purple-600/20">
                            7% - Aggressive
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  </div>

                  {/* 2025 Contribution Limits Information (Collapsible) */}
                  <div className="md:col-span-2">
                    <Accordion type="single" collapsible>
                      <AccordionItem value="contribution-limits" className="bg-blue-900/20 border border-blue-700/50 rounded-lg">
                        <AccordionTrigger className="px-4 hover:no-underline [&>svg]:text-white">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-blue-100 font-medium">2025 IRS Contribution Limits</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
                            <div>
                              <p className="font-medium text-white mb-1">401(k)/403(b)/457(b):</p>
                              <ul className="space-y-1 ml-3">
                                <li>• Under 50: <span className="text-blue-300">$23,500/year ($1,958/month)</span></li>
                                <li>• Age 50+: <span className="text-blue-300">$31,000/year ($2,583/month)</span></li>
                                <li>• Age 60-63: <span className="text-blue-300">$34,750/year ($2,896/month)</span> <span className="text-gray-400">(new!)</span></li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium text-white mb-1">IRA (Traditional & Roth combined):</p>
                              <ul className="space-y-1 ml-3">
                                <li>• Under 50: <span className="text-blue-300">$7,000/year</span></li>
                                <li>• Age 50+: <span className="text-blue-300">$8,000/year</span></li>
                              </ul>
                              <p className="text-gray-400 mt-2">Note: High earners may have reduced Roth IRA limits</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-3">
                            💡 Employer match doesn't count toward employee contribution limits. Total 401(k) limit (employee + employer) is $70,000 for 2025.
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>

                  {/* Retirement Contributions Section - Matching Intake Form Step 11 */}
                  <div className="md:col-span-2 space-y-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                    <h4 className="text-sm font-semibold text-white">Your Retirement Contributions</h4>
                    
                    {/* User 401k/403b Contributions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="monthly-employee-401k" className="text-sm font-medium text-gray-300">
                          Your Monthly 401(k)/403(b) Contribution
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="monthly-employee-401k"
                            type="number"
                            min="0"
                            value={variables.monthlyEmployee401k}
                            onChange={(e) => setVariables({...variables, monthlyEmployee401k: parseInt(e.target.value) || 0})}
                            
                            className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                            placeholder="0"
                          />
                          
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="monthly-employer-401k" className="text-sm font-medium text-gray-300">
                          Monthly Employer Match/Contribution
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="monthly-employer-401k"
                            type="number"
                            min="0"
                            value={variables.monthlyEmployer401k}
                            onChange={(e) => setVariables({...variables, monthlyEmployer401k: parseInt(e.target.value) || 0})}
                            
                            className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                            placeholder="0"
                          />
                          
                        </div>
                      </div>
                    </div>

                    {/* User IRA Contributions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="annual-traditional-ira" className="text-sm font-medium text-gray-300">
                          Your Annual Traditional IRA Contribution
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="annual-traditional-ira"
                            type="number"
                            min="0"
                            value={variables.annualTraditionalIRA}
                            onChange={(e) => setVariables({...variables, annualTraditionalIRA: parseInt(e.target.value) || 0})}
                            
                            className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                            placeholder="0"
                          />
                          
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="annual-roth-ira" className="text-sm font-medium text-gray-300">
                          Your Annual Roth IRA Contribution
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="annual-roth-ira"
                            type="number"
                            min="0"
                            value={variables.annualRothIRA}
                            onChange={(e) => setVariables({...variables, annualRothIRA: parseInt(e.target.value) || 0})}
                            
                            className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                            placeholder="0"
                          />
                          
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Spouse Retirement Contributions Section */}
                  {isMarried && (
                    <div className="md:col-span-2 space-y-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                    <h4 className="text-sm font-semibold text-white">Spouse Retirement Contributions</h4>
                    
                    {/* Spouse 401k/403b Contributions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="spouse-monthly-employee-401k" className="text-sm font-medium text-gray-300">
                          Spouse Monthly 401(k)/403(b) Contribution
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="spouse-monthly-employee-401k"
                            type="number"
                            min="0"
                            value={variables.spouseMonthlyEmployee401k}
                            onChange={(e) => setVariables({...variables, spouseMonthlyEmployee401k: parseInt(e.target.value) || 0})}
                            
                            className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                            placeholder="0"
                          />
                          
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="spouse-monthly-employer-401k" className="text-sm font-medium text-gray-300">
                          Spouse Monthly Employer Match/Contribution
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="spouse-monthly-employer-401k"
                            type="number"
                            min="0"
                            value={variables.spouseMonthlyEmployer401k}
                            onChange={(e) => setVariables({...variables, spouseMonthlyEmployer401k: parseInt(e.target.value) || 0})}
                            
                            className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                            placeholder="0"
                          />
                          
                        </div>
                      </div>
                    </div>

                    {/* Spouse IRA Contributions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="spouse-annual-traditional-ira" className="text-sm font-medium text-gray-300">
                          Spouse Annual Traditional IRA Contribution
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="spouse-annual-traditional-ira"
                            type="number"
                            min="0"
                            value={variables.spouseAnnualTraditionalIRA}
                            onChange={(e) => setVariables({...variables, spouseAnnualTraditionalIRA: parseInt(e.target.value) || 0})}
                            
                            className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                            placeholder="0"
                          />
                          
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="spouse-annual-roth-ira" className="text-sm font-medium text-gray-300">
                          Spouse Annual Roth IRA Contribution
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="spouse-annual-roth-ira"
                            type="number"
                            min="0"
                            value={variables.spouseAnnualRothIRA}
                            onChange={(e) => setVariables({...variables, spouseAnnualRothIRA: parseInt(e.target.value) || 0})}
                            
                            className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                            placeholder="0"
                          />
                          
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Monthly expenses and part-time income (aligned; spread out to fill full width) */}
                  <div className={`grid grid-cols-1 gap-8 ${isMarried ? 'md:grid-cols-3' : 'md:grid-cols-2'} items-end`}>
                    {/* Monthly Expenses in Retirement */}
                    <div className="space-y-2">
                      <Label htmlFor="monthly-expenses" className="text-sm font-medium text-gray-300 flex items-center">
                        Monthly Expenses (Retirement)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 ml-2 text-gray-500 hover:text-gray-400 transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-gray-800 border-gray-700">
                              <p>Your estimated monthly spending in retirement</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          id="monthly-expenses"
                          type="number"
                          min="0"
                          value={variables.monthlyExpenses}
                          onChange={(e) => setVariables({...variables, monthlyExpenses: parseInt(e.target.value) || 0})}
                          
                          className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Part-Time Retirement Income */}
                    <div className="space-y-2">
                      <Label htmlFor="part-time-income" className="text-sm font-medium text-gray-300 flex items-center">
                        Part-Time Income (Monthly)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 ml-2 text-gray-500 hover:text-gray-400 transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-gray-800 border-gray-700">
                              <p>Monthly income from part-time work in retirement</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          id="part-time-income"
                          type="number"
                          min="0"
                          value={variables.partTimeIncome}
                          onChange={(e) => setVariables({...variables, partTimeIncome: parseInt(e.target.value) || 0})}
                          
                          className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        />
                        
                      </div>
                    </div>

                    {/* Spouse Part-Time Retirement Income */}
                    {isMarried && (
                    <div className="space-y-2">
                      <Label htmlFor="spouse-part-time-income" className="text-sm font-medium text-gray-300 flex items-center">
                        Spouse Part-Time Income (Monthly)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 ml-2 text-gray-500 hover:text-gray-400 transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-gray-800 border-gray-700">
                              <p>Spouse's monthly income from part-time work in retirement</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          id="spouse-part-time-income"
                          type="number"
                          min="0"
                          value={variables.spousePartTimeIncome}
                          onChange={(e) => setVariables({...variables, spousePartTimeIncome: parseInt(e.target.value) || 0})}
                          
                          className="bg-gray-800/50 border-gray-700 text-white pl-8 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        />
                        
                      </div>
                    </div>
                    )}
                  </div>

                  {/* Long-Term Care Insurance moved next to Social Security Claim Age */}
                </div>

                {/* Social Security Optimization Section */}
                <div className="space-y-6 pt-6 border-t border-gray-700">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 hidden">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Social Security Strategy</h3>
                        <p className="text-sm text-gray-400">Choose your claiming strategy for maximum lifetime benefit</p>
                      </div>
                    </div>
                    
                    {/* Optimization Status */}
                    {profile?.socialSecurityOptimization && (
                      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-green-300">Optimal Strategy Available</span>
                        </div>
                        <p className="text-xs text-gray-300">
                          Based on your complete financial profile, we've calculated the optimal Social Security claiming strategy 
                          that maximizes your lifetime spending power. Look for the ✨ "Optimal Strategy" option in the dropdowns.
                        </p>
                        <div className="mt-3 p-3 bg-green-950/30 rounded border border-green-500/20">
                          <div className="text-xs font-medium text-green-300 mb-1">Improvement vs Age 67 Strategy</div>
                          <div className="text-sm text-white">
                            +{profile.socialSecurityOptimization.lifetimeBenefitIncrease.toFixed(1)}% lifetime spending power
                          </div>
                          <div className="text-xs text-green-200 mt-1">
                            ${profile.socialSecurityOptimization.sustainableAnnualSpending.toLocaleString()} sustainable annual spending
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-400">
                          Calculated: {new Date(profile.socialSecurityOptimization.calculatedAt).toLocaleDateString()} | 
                          Confidence: {(profile.socialSecurityOptimization.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    )}



                    {/* Optimal Ages Display Cards */}
                    {profile?.optimalSocialSecurityAge && (
                      <div className="space-y-4 mb-6 hidden">
                        {/* Combined Household Summary if married */}
                        {profile.maritalStatus === 'married' && profile.optimalSpouseSocialSecurityAge && 
                         profile.socialSecurityOptimization?.user && profile.socialSecurityOptimization?.spouse && (
                          <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border border-purple-500/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                                <span className="text-sm font-semibold text-purple-300">Optimal Household Strategy</span>
                              </div>
                              <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded-full">
                                Based on NPV Analysis
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Your Optimal Age</p>
                                <p className="text-2xl font-bold text-white">{profile.optimalSocialSecurityAge}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Spouse Optimal Age</p>
                                <p className="text-2xl font-bold text-white">{profile.optimalSpouseSocialSecurityAge}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Total Lifetime Benefit</p>
                                <p className="text-2xl font-bold text-purple-300">
                                  ${((profile.socialSecurityOptimization.user.maxLifetimeBenefit + 
                                     profile.socialSecurityOptimization.spouse.maxLifetimeBenefit) / 1000).toFixed(0)}K
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* User Optimal Age Card */}
                        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/40 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-green-400 uppercase tracking-wide">Your Optimal Claim Age</span>
                            <Target className="w-4 h-4 text-green-400" />
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white">{profile.optimalSocialSecurityAge}</span>
                            <span className="text-sm text-gray-400">years</span>
                          </div>
                          {profile.socialSecurityOptimization?.user && (
                            <div className="mt-3 pt-3 border-t border-green-500/20">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Lifetime Benefit (NPV)</span>
                                <span className="text-sm font-semibold text-green-300">
                                  ${(profile.socialSecurityOptimization.user.maxLifetimeBenefit / 1000).toFixed(0)}K
                                </span>
                              </div>
                            </div>
                          )}
                          {variables.socialSecurityAge !== profile.optimalSocialSecurityAge && (
                            <button
                              onClick={() => setVariables({...variables, socialSecurityAge: profile.optimalSocialSecurityAge})}
                              
                              className="mt-3 w-full text-xs bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Apply Optimal Age
                            </button>
                          )}
                        </div>

                        {/* Spouse Optimal Age Card */}
                        {profile.maritalStatus === 'married' && profile.optimalSpouseSocialSecurityAge && (
                          <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/20 border border-blue-500/40 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">Spouse Optimal Claim Age</span>
                              <Target className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-bold text-white">{profile.optimalSpouseSocialSecurityAge}</span>
                              <span className="text-sm text-gray-400">years</span>
                            </div>
                            {profile.socialSecurityOptimization?.spouse && (
                              <div className="mt-3 pt-3 border-t border-blue-500/20">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-400">Lifetime Benefit (NPV)</span>
                                  <span className="text-sm font-semibold text-blue-300">
                                    ${(profile.socialSecurityOptimization.spouse.maxLifetimeBenefit / 1000).toFixed(0)}K
                                  </span>
                                </div>
                              </div>
                            )}
                            {variables.spouseSocialSecurityAge !== profile.optimalSpouseSocialSecurityAge && (
                              <button
                                onClick={() => setVariables({...variables, spouseSocialSecurityAge: profile.optimalSpouseSocialSecurityAge})}
                                
                                className="mt-3 w-full text-xs bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Apply Optimal Age
                              </button>
                            )}
                          </div>
                        )}
                        </div>
                      </div>
                    )}

                    <div className={`grid grid-cols-1 md:grid-cols-2 ${isMarried ? 'lg:grid-cols-3' : ''} gap-6 items-end`}>
                      {/* User Social Security */}
                      <div className="space-y-4 order-1">
                        <SocialSecurityAgeSelector
                          id="ss-age"
                          value={variables.socialSecurityAge}
                          onChange={(age) => setVariables({...variables, socialSecurityAge: age})}
                          
                          retirementAge={variables.retirementAge}
                          label="Your Social Security Claim Age"
                          optimalAge={profile?.optimalSocialSecurityAge}
                          profile={profile}
                        />
                        
                        {/* Benefit Comparison */}
                        {showSSComparison && profile?.optimalSocialSecurityAge && (
                          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Info className="w-4 h-4 text-amber-400" />
                              <span className="text-sm font-medium text-amber-300">Strategy Comparison</span>
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-300">Current (Age {variables.socialSecurityAge}):</span>
                                <span className="text-white">Baseline benefits</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-300">Optimal (Age {profile.optimalSocialSecurityAge}):</span>
                                <span className="text-green-300 font-medium">
                                  +{calculateBenefitImprovement(variables.socialSecurityAge, profile.optimalSocialSecurityAge)?.toFixed(1) || '0'}% benefit
                                </span>
                              </div>
                              {profile.socialSecurityOptimization?.user && (
                                <div className="flex justify-between pt-1">
                                  <span className="text-gray-400">Lifetime benefit (NPV):</span>
                                  <span className="text-amber-300 font-medium">
                                    ${(profile.socialSecurityOptimization.user.maxLifetimeBenefit / 1000).toFixed(0)}K
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="mt-2 pt-2 border-t border-amber-500/20">
                              <p className="text-xs text-gray-400">
                                💡 Selecting the optimal strategy could increase your lifetime Social Security benefits
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* LTC Insurance toggle (aligned with SS age in same row) */}
                      <div className="space-y-2 order-3">
                        <div className="flex items-center justify-between mt-6 md:mt-0">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="ltc-insurance" className="text-sm font-medium text-gray-300 cursor-pointer">
                              LTC Insurance
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-gray-500 hover:text-gray-400 transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-gray-800 border-gray-700 max-w-xs">
                                  <p>Protects savings from potential long-term care costs.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Switch
                            id="ltc-insurance"
                            checked={variables.hasLongTermCareInsurance}
                            onCheckedChange={(checked) => setVariables({...variables, hasLongTermCareInsurance: checked})}
                            className="data-[state=checked]:bg-purple-600"
                          />
                        </div>
                      </div>

                      {/* Spouse Social Security */}
                      {isMarried && (
                        <div className="space-y-4 order-2">
                          <SocialSecurityAgeSelector
                            id="spouse-ss-age"
                            value={variables.spouseSocialSecurityAge}
                            onChange={(age) => setVariables({...variables, spouseSocialSecurityAge: age})}
                            
                            retirementAge={variables.spouseRetirementAge}
                            label="Spouse Social Security Claim Age"
                            includeTooltip={false}
                            optimalAge={profile?.optimalSpouseSocialSecurityAge}
                            profile={profile}
                          />
                          
                          {/* Spouse Benefit Comparison */}
                          {showSSComparison && profile?.optimalSpouseSocialSecurityAge && (
                            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-medium text-amber-300">Spouse Strategy Comparison</span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-300">Current (Age {variables.spouseSocialSecurityAge}):</span>
                                  <span className="text-white">Baseline benefits</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-300">Optimal (Age {profile.optimalSpouseSocialSecurityAge}):</span>
                                  <span className="text-green-300 font-medium">
                                    +{calculateBenefitImprovement(variables.spouseSocialSecurityAge, profile.optimalSpouseSocialSecurityAge)?.toFixed(1) || '0'}% benefit
                                  </span>
                                </div>
                                {profile.socialSecurityOptimization?.spouse && (
                                  <div className="flex justify-between pt-1">
                                    <span className="text-gray-400">Lifetime benefit (NPV):</span>
                                    <span className="text-amber-300 font-medium">
                                      ${(profile.socialSecurityOptimization.spouse.maxLifetimeBenefit / 1000).toFixed(0)}K
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 pt-2 border-t border-amber-500/20">
                                <p className="text-xs text-gray-400">
                                  💡 Coordinated strategy optimizes household Social Security benefits
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    {showSSComparison && (
                      <div className="flex gap-3">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          
                          onClick={() => {
                            setVariables(prev => ({
                              ...prev,
                              socialSecurityAge: profile?.optimalSocialSecurityAge || prev.socialSecurityAge,
                              spouseSocialSecurityAge: profile?.optimalSpouseSocialSecurityAge || prev.spouseSocialSecurityAge
                            }));
                            toast({
                              title: "Optimal Strategy Applied",
                              description: "Social Security claiming ages updated to optimal strategy",
                            });
                          }}
                        >
                          <Target className="w-4 h-4 mr-2" />
                          Use Optimal Strategy
                        </Button>
                        {profile?.socialSecurityOptimization && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                            onClick={() => {
                              toast({
                                title: "Optimization Details",
                                description: `Sustainable spending: $${profile.socialSecurityOptimization.sustainableAnnualSpending.toLocaleString()}/year | Confidence: ${(profile.socialSecurityOptimization.confidence * 100).toFixed(0)}%`,
                              });
                            }}
                          >
                            <Info className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4 border-t border-gray-700">
                  <Button
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium transition-all"
                  >
                    {isOptimizing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Optimizing... {optimizationTime}s
                      </>
                    ) : (
                      <>
                        <Calculator className="w-4 h-4 mr-2" />
                        Optimize
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleLockAndContinue}
                    disabled={isLocking || isOptimizing}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium transition-all"
                  >
                    {isLocking ? (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Locking & Generating... {lockingTime}s
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Save Only
                      </>
                    )}
                  </Button>

                  {isOptimizing && (
                    <Button
                      onClick={handleCancelOptimization}
                      variant="outline"
                      className="bg-gray-800 border-red-500/50 text-red-400 hover:bg-red-600/20 hover:border-red-500 hover:text-red-300"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                  
                  {/* Navigation button to Step 2 - only show after locking */}

                </div>
              </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Moved "Portfolio projections" and "Portfolio impact" to their own tabs */}

            {/* Navigation to Stress Tests */}
            <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
              <CardContent className="p-6">
                <Button
                  onClick={() => setActiveTab('stress-tests')}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                  size="lg"
                >
                  Continue to Stress Tests
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </CardContent>
            </Card>

          </TabsContent>

          {/* Portfolio Projections Tab (new Tab #2) */}
          <TabsContent value="portfolio-projections" className="space-y-6">
            <RetirementPortfolioProjectionsOptimized
              variables={variables}
              profile={profile}
              active={activeTab === 'portfolio-projections'}
              autoGenerateOnActive
            />
          </TabsContent>

          {/* Portfolio Impact Tab (new Tab #3) */}
          <TabsContent value="portfolio-impact" className="space-y-6">
            <ImpactPortfolioBalanceNew 
              variables={variables}
              profile={profile}
              active={activeTab === 'portfolio-impact'}
              autoStartOnActive
            />
          </TabsContent>

          {/* Monte Carlo Withdrawals Tab */}
          <TabsContent value="mc-withdrawals" className="space-y-6">
            <MonteCarloWithdrawalContent 
              variables={variables}
              hasOptimizedOnce={hasOptimizedOnce}
              setActiveTab={setActiveTab}
              profile={profile}
              optimizedScore={optimizedScore}
              currentScore={currentScore}
              onDataUpdate={setMcWithdrawalsData}
            />
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cash-flow" className="space-y-6">
            <CashFlowContent
              variables={variables}
              profile={profile}
              optimizedScore={optimizedScore}
              currentScore={currentScore}
              setActiveTab={setActiveTab}
              currentCashFlowData={currentCashFlowData}
              optimizedCashFlowData={optimizedCashFlowData}
              setCurrentCashFlowData={setCurrentCashFlowData}
              setOptimizedCashFlowData={setOptimizedCashFlowData}
            />
          </TabsContent>

          {/* Stress Tests Tab */}
          <TabsContent value="stress-tests" className="space-y-6">
            <StressTestContent 
              variables={variables}
              hasOptimizedOnce={hasOptimizedOnce}
              setActiveTab={setActiveTab}
              profile={profile}
              optimizedScore={optimizedScore}
              currentScore={currentScore}
            />
          </TabsContent>

          {/* Legacy stress test content - keep for now but hidden */}
          {false && (
            <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-xl text-white">Stress Test Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Monte Carlo Widget */}
                <RetirementMonteCarloWidget 
                  isExpanded={true}
                  onToggle={() => {}}
                />

                {/* Sensitivity Analysis */}
                {optimizedScore?.sensitivityAnalysis && (
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                        Sensitivity Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-gray-400 text-sm">Baseline Success Rate</p>
                          <p className="text-2xl font-bold text-white">
                            {optimizedScore.sensitivityAnalysis.baselineSuccess.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Optimized Success Rate</p>
                          <p className="text-2xl font-bold text-green-400">
                            {optimizedScore.sensitivityAnalysis.optimizedSuccess.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Improvement</p>
                          <p className="text-2xl font-bold text-blue-400">
                            +{optimizedScore.sensitivityAnalysis.absoluteChange.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Variable Impacts */}
                      <div className="space-y-2">
                        <p className="text-gray-400 text-sm font-medium mb-2">Variable Impacts:</p>
                        {Object.entries(optimizedScore.sensitivityAnalysis.variableImpacts).map(([key, impact]: [string, any]) => (
                          <div key={key} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                            <span className="text-gray-300 text-sm capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-medium">
                                {typeof impact.change === 'number' ? impact.change.toFixed(1) : impact.change} {impact.unit}
                              </span>
                              <span className={`text-sm ${impact.expectedImpact > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ({impact.expectedImpact > 0 ? '+' : ''}{impact.expectedImpact.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Market Scenarios */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-yellow-400" />
                      Market Scenario Testing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-900 p-3 rounded">
                        <p className="text-gray-400 text-xs mb-1">Bear Market</p>
                        <p className="text-white font-medium">-30% Year 1</p>
                        <p className="text-red-400 text-sm">75% Success</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded">
                        <p className="text-gray-400 text-xs mb-1">Recession</p>
                        <p className="text-white font-medium">2008 Scenario</p>
                        <p className="text-yellow-400 text-sm">82% Success</p>
                      </div>
                      <div className="bg-gray-900 p-3 rounded">
                        <p className="text-gray-400 text-xs mb-1">High Inflation</p>
                        <p className="text-white font-medium">5% Annual</p>
                        <p className="text-orange-400 text-sm">78% Success</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex justify-between pt-4">
                  <Button
                    onClick={() => setActiveTab("cash-flow")}
                    className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
                  >
                    <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                    Back to Cash Flow
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setActiveTab("cash-flow")}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                      Next: Cash Flow
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      onClick={() => setActiveTab("social-security")}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                    Next: Social Security
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* End legacy stress test content */}

          {/* Social Security Optimization Tab */}
          <TabsContent value="social-security" className="space-y-6">
            <SocialSecurityAnalysis 
              profile={profile}
              variables={variables}
              isOptimized={hasOptimizedOnce}
            />
            
            {/* Navigation Button */}
            <div className="flex justify-start">
              <Button
                onClick={() => setActiveTab("cash-flow")}
                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Cash Flow
              </Button>
            </div>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <RetirementInsights />
          </TabsContent>

          {/* Roth Conversion Tab */}
        </Tabs>
      </div>
    </div>
  );
}

// Main component wrapped with error boundary
function RetirementPlanning() {
  return (
    <RetirementPlanningErrorBoundary>
      <RetirementPlanningInner />
    </RetirementPlanningErrorBoundary>
  );
}

export default RetirementPlanning;
