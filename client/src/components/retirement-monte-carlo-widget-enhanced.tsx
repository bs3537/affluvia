import React, { useState } from 'react';
import { seedFromParams } from '@/lib/seed';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { TrendingUp, AlertTriangle, ChevronDown, BarChart3, Zap, Info, Shield, DollarSign, Target, Cpu } from 'lucide-react';
import { Gauge } from './ui/gauge';
import { Progress } from './ui/progress';
import { useMonteCarloWorker } from '../hooks/useMonteCarloWorker';
import { useToast } from '../hooks/use-toast';

interface MonteCarloResult {
  probabilityOfSuccess: number;
  medianEndingBalance: number;
  percentile10EndingBalance: number;
  percentile90EndingBalance: number;
  yearsUntilDepletion: number | null;
  safeWithdrawalRate?: number;
  currentRetirementAssets?: number;
  projectedRetirementPortfolio?: number;
  scenarios: {
    successful: number;
    failed: number;
    total: number;
  };
  confidenceIntervals: {
    percentile10: number;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    percentile90: number;
  };
  expenseBreakdown?: {
    totalExpensesNeeded: number;
    guaranteedIncome: number;
    netWithdrawalNeeded: number;
    monthlyExpenses: number;
    monthlyGuaranteedIncome: number;
    monthlyNetWithdrawal: number;
    annualHealthcareCosts?: number;
    monthlyHealthcareCosts?: number;
    healthcarePercentage?: number;
    healthcareInflationRate?: number;
  };
  guytonKlingerStats?: {
    averageAdjustmentsPerScenario: number;
    adjustmentTypeBreakdown: Record<string, number>;
  };
}

interface RetirementMonteCarloWidgetProps {
  isExpanded: boolean;
  onToggle: () => void;
  onCalculate?: () => void;
  useClientSide?: boolean; // New prop to enable client-side calculations
}

export function RetirementMonteCarloWidget({ 
  isExpanded, 
  onToggle, 
  onCalculate,
  useClientSide = false // Default to server-side for backward compatibility
}: RetirementMonteCarloWidgetProps) {
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useWorkers, setUseWorkers] = useState(useClientSide);
  
  const { runSimulation, progress, isRunning, cancel } = useMonteCarloWorker();
  const { toast } = useToast();
  
  // Server-side calculation (existing functionality)
  const calculateMonteCarloServer = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/calculate-retirement-monte-carlo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seed: seedFromParams(undefined, 'retirement-mc-widget') })
      });
      
      if (response.ok) {
        const result = await response.json();
        setMonteCarloResult(result);
        if (onCalculate) onCalculate();
      } else {
        console.error('Failed to calculate Monte Carlo simulation');
        toast({
          title: "Calculation Error",
          description: "Failed to calculate retirement confidence score",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error calculating Monte Carlo simulation:', error);
      toast({
        title: "Connection Error",
        description: "Unable to connect to server",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Client-side calculation using Web Workers
  const calculateMonteCarloClient = async () => {
    try {
      // First fetch the user's profile data
      const profileResponse = await fetch('/api/financial-profile');
      if (!profileResponse.ok) throw new Error('Failed to fetch profile');
      
      const profile = await profileResponse.json();
      
      // Convert profile to Monte Carlo parameters
      // This is a simplified version - you'd need to implement the full conversion
      const params = {
        currentAge: calculateAge(profile?.dateOfBirth),
        retirementAge: profile?.desiredRetirementAge || 65,
        lifeExpectancy: profile?.userLifeExpectancy || 90,
        currentRetirementAssets: calculateRetirementAssets(profile?.assets),
        annualGuaranteedIncome: calculateGuaranteedIncome(profile),
        annualRetirementExpenses: (profile?.expectedMonthlyExpensesRetirement || 8000) * 12,
        annualHealthcareCosts: estimateHealthcareCosts(profile),
        expectedReturn: (profile?.expectedRealReturn || 6) / 100,
        returnVolatility: 0.15,
        inflationRate: (profile?.expectedInflationRate || 3) / 100,
        stockAllocation: (profile?.currentAllocation?.usStocks || 60) / 100,
        bondAllocation: (profile?.currentAllocation?.bonds || 35) / 100,
        cashAllocation: (profile?.currentAllocation?.cash || 5) / 100,
        withdrawalRate: (profile?.withdrawalRate || 4) / 100,
        useGuardrails: true,
        taxRate: 0.22, // Simplified - would need proper calculation
        annualSavings: calculateAnnualSavings(profile),
        legacyGoal: profile?.legacyGoal || 0,
        assetBuckets: categorizeAssets(profile?.assets)
      };
      
      // Run simulation with Web Workers
      const result = await runSimulation(params, 1000);
      
      // Add expense breakdown (would need server calculation for accuracy)
      (result as any).expenseBreakdown = {
        totalExpensesNeeded: params.annualRetirementExpenses,
        guaranteedIncome: params.annualGuaranteedIncome,
        netWithdrawalNeeded: Math.max(0, params.annualRetirementExpenses - params.annualGuaranteedIncome),
        monthlyExpenses: params.annualRetirementExpenses / 12,
        monthlyGuaranteedIncome: params.annualGuaranteedIncome / 12,
        monthlyNetWithdrawal: Math.max(0, params.annualRetirementExpenses - params.annualGuaranteedIncome) / 12,
        annualHealthcareCosts: params.annualHealthcareCosts,
        monthlyHealthcareCosts: params.annualHealthcareCosts / 12,
        healthcarePercentage: (params.annualHealthcareCosts / params.annualRetirementExpenses) * 100,
        healthcareInflationRate: 2.69
      };
      
      setMonteCarloResult(result);
      if (onCalculate) onCalculate();
      
      toast({
        title: "Calculation Complete",
        description: `Analyzed ${result.scenarios.total.toLocaleString()} scenarios using ${navigator.hardwareConcurrency || 4} CPU cores`,
        duration: 3000
      });
      
    } catch (error) {
      console.error('Error in client-side calculation:', error);
      toast({
        title: "Calculation Error",
        description: "Falling back to server calculation",
        variant: "destructive"
      });
      // Fall back to server-side calculation
      await calculateMonteCarloServer();
    }
  };
  
  const calculateMonteCarlo = async () => {
    if (useWorkers) {
      await calculateMonteCarloClient();
    } else {
      await calculateMonteCarloServer();
    }
  };

  // Removed auto-calculation on mount to improve performance
  // Users can click the calculate button when they want to see the results

  const getSuccessColor = (probability: number) => {
    if (probability >= 85) return { bg: 'bg-green-900/30', text: 'text-green-400', gradient: 'from-green-500/20 to-green-600/20', border: 'border-green-500/30' };
    if (probability >= 75) return { bg: 'bg-blue-900/30', text: 'text-blue-400', gradient: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-500/30' };
    if (probability >= 65) return { bg: 'bg-yellow-900/30', text: 'text-yellow-400', gradient: 'from-yellow-500/20 to-yellow-600/20', border: 'border-yellow-500/30' };
    return { bg: 'bg-red-900/30', text: 'text-red-400', gradient: 'from-red-500/20 to-red-600/20', border: 'border-red-500/30' };
  };

  const getSuccessLabel = (probability: number) => {
    if (probability >= 85) return 'Highly Confident';
    if (probability >= 75) return 'Good Outlook';
    if (probability >= 65) return 'Fair Chance';
    return 'Needs Improvement';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`;
  };

  return (
    <Card className="card-gradient border-gray-700 widget-card bg-gradient-to-br from-gray-900/40 to-gray-800/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-white">Retirement Confidence Score</CardTitle>
            {monteCarloResult && (
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                getSuccessColor(monteCarloResult.probabilityOfSuccess).bg
              } ${getSuccessColor(monteCarloResult.probabilityOfSuccess).text}`}>
                {getSuccessLabel(monteCarloResult.probabilityOfSuccess)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#FF6B6B]" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-6 w-6 p-0 text-gray-400 hover:text-white expand-toggle-btn"
            aria-expanded={isExpanded}
            aria-label="Toggle Monte Carlo details"
          >
            <ChevronDown className={`w-4 h-4 chevron-icon ${isExpanded ? 'rotated' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {(isLoading || isRunning) ? (
          <div className="flex flex-col items-center py-8">
            {isRunning ? (
              <>
                <div className="w-full max-w-xs mb-4">
                  <Progress value={progress} className="h-2" />
                </div>
                <p className="text-gray-400 text-sm mb-2">
                  Running {useWorkers ? 'client-side' : 'server'} calculations...
                </p>
                <p className="text-gray-500 text-xs mb-3">
                  {formatPercentage(progress)} complete
                </p>
                {useWorkers && (
                  <Button
                    onClick={cancel}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="text-gray-400 mt-2 text-sm">Calculating scenarios...</p>
              </>
            )}
          </div>
        ) : monteCarloResult ? (
          <>
            <div className="flex flex-col items-center mb-6">
              <Gauge
                value={monteCarloResult.probabilityOfSuccess}
                max={100}
                size="lg"
                showValue={true}
                valueLabel=""
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
              <p className="text-xs text-gray-400 mt-3 text-center">
                Simulates market volatility, inflation, and sequence of returns risk
              </p>
              <p className="text-xs text-gray-500 mt-1 text-center">
                Based on {monteCarloResult.scenarios.total.toLocaleString()} scenarios • Score of 80+ recommended
              </p>
              <p className="text-xs text-gray-400 mt-1 text-center italic">
                Base scenario excludes Roth conversions • Evaluate tax strategies separately
              </p>
            </div>

            {isExpanded && (
              <div className="space-y-6 border-t border-gray-700 pt-6">
                {/* Calculation Mode Toggle */}
                <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Cpu className="w-5 h-5 text-purple-400" />
                      <div>
                        <h4 className="text-sm font-medium text-white">Calculation Mode</h4>
                        <p className="text-xs text-gray-400 mt-1">
                          {useWorkers ? 'Using local CPU for faster calculations' : 'Using server for calculations'}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setUseWorkers(!useWorkers)}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Switch to {useWorkers ? 'Server' : 'Client'}
                    </Button>
                  </div>
                </div>

                {/* Rest of the component remains the same */}
                {/* Methodology Explanation */}
                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Understanding Monte Carlo Analysis</h4>
                      <p className="text-xs text-gray-300 mb-2">
                        This simulation runs {monteCarloResult.scenarios.total.toLocaleString()} different market scenarios using historical volatility patterns to test how your retirement plan performs across various economic conditions.
                      </p>
                      <p className="text-xs text-gray-400">
                        Unlike simple projections, this accounts for market ups and downs, sequence of returns risk, and inflation variability.
                        {monteCarloResult.guytonKlingerStats && ' Includes dynamic withdrawal adjustments using Guyton-Klinger guardrails.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Guyton-Klinger Stats (if available) */}
                {monteCarloResult.guytonKlingerStats && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-white">Dynamic Withdrawal Strategy</h4>
                    <div className="bg-gradient-to-br from-gray-800/60 to-gray-700/60 p-4 rounded-lg border border-gray-600/30">
                      <div className="text-xs text-gray-400 mb-3">
                        Average adjustments per scenario: {monteCarloResult.guytonKlingerStats.averageAdjustmentsPerScenario.toFixed(1)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(monteCarloResult.guytonKlingerStats.adjustmentTypeBreakdown).map(([type, count]) => (
                          <div key={type} className="flex justify-between">
                            <span className="text-gray-400 capitalize">{type.replace('-', ' ')}:</span>
                            <span className="text-white">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Expense Breakdown */}
                {monteCarloResult.expenseBreakdown && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-white">Retirement Income Analysis</h4>
                    <div className="bg-gradient-to-br from-gray-800/60 to-gray-700/60 p-4 rounded-lg border border-gray-600/30">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">Monthly Expenses Needed</span>
                          <span className="text-sm font-semibold text-white">
                            {formatCurrency(monteCarloResult.expenseBreakdown.monthlyExpenses)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">Monthly Guaranteed Income</span>
                          <span className="text-sm font-semibold text-green-400">
                            - {formatCurrency(monteCarloResult.expenseBreakdown.monthlyGuaranteedIncome)}
                          </span>
                        </div>
                        <div className="border-t border-gray-600 pt-2 flex justify-between items-center">
                          <span className="text-xs text-gray-400">Net Monthly Portfolio Withdrawal</span>
                          <span className="text-sm font-bold text-yellow-400">
                            {formatCurrency(monteCarloResult.expenseBreakdown.monthlyNetWithdrawal)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          *Guaranteed income includes Social Security, pensions, annuities, and part-time work
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Key Metrics */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-white">Key Financial Insights</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-gray-800/60 to-gray-700/60 p-4 rounded-lg border border-gray-600/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-green-400" />
                        <div className="text-xs text-gray-400">Safe Withdrawal Rate</div>
                      </div>
                      <div className="text-xl font-semibold text-white mb-1">
                        {formatPercentage((monteCarloResult.safeWithdrawalRate || 0) * 100)}
                      </div>
                      <div className="text-xs text-gray-500 mb-1">For confidence score of 80</div>
                      <div className="text-sm text-green-400 font-medium">
                        ≈ {formatCurrency((monteCarloResult.safeWithdrawalRate || 0) * (monteCarloResult.projectedRetirementPortfolio || monteCarloResult.currentRetirementAssets || 0))}/year
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800/60 to-gray-700/60 p-4 rounded-lg border border-gray-600/30">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-blue-400" />
                        <div className="text-xs text-gray-400">Median End Balance</div>
                      </div>
                      <div className="text-xl font-semibold text-white mb-1">
                        {formatCurrency(monteCarloResult.medianEndingBalance)}
                      </div>
                      <div className="text-xs text-gray-500">Expected portfolio value</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-3">
                  <Button 
                    onClick={calculateMonteCarlo}
                    disabled={isLoading || isRunning}
                    className="bg-gradient-to-r from-[#FF6B6B] to-[#B040FF] hover:from-[#FF5252] hover:to-[#9333EA] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    size="sm"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Recalculate
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center py-12">
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-700/60 p-6 rounded-full mb-4">
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Ready to Analyze Your Retirement Plan?</h3>
            <p className="text-gray-400 text-sm mb-6 text-center max-w-sm">
              Run a comprehensive Monte Carlo simulation to see how your retirement strategy performs across thousands of different market scenarios.
            </p>
            <Button 
              onClick={calculateMonteCarlo}
              className="bg-gradient-to-r from-[#FF6B6B] to-[#B040FF] hover:from-[#FF5252] hover:to-[#9333EA] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              size="default"
            >
              <Zap className="w-4 h-4 mr-2" />
              Start Monte Carlo Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper functions for client-side calculations
function calculateAge(dateOfBirth: string | undefined): number {
  if (!dateOfBirth) return 45; // Default age if dateOfBirth is not available
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateRetirementAssets(assets: any[]): number {
  if (!assets) return 0;
  const retirementTypes = ['401k', '403b', 'traditional-ira', 'roth-ira', 'hsa', 'taxable-brokerage', 'savings', 'checking'];
  return assets
    .filter(asset => retirementTypes.includes(asset.type))
    .reduce((sum, asset) => sum + (Number(asset.value) || 0), 0);
}

function calculateGuaranteedIncome(profile: any): number {
  if (!profile) return 0;
  const socialSecurity = (Number(profile.socialSecurityBenefit) || 0) * 12;
  const pension = (Number(profile.pensionBenefit) || 0) * 12;
  const partTime = (Number(profile.partTimeIncomeRetirement) || 0) * 12;
  const spouseSS = (Number(profile.spouseSocialSecurityBenefit) || 0) * 12;
  const spousePension = (Number(profile.spousePensionBenefit) || 0) * 12;
  const spousePartTime = (Number(profile.spousePartTimeIncomeRetirement) || 0) * 12;
  
  return socialSecurity + pension + partTime + spouseSS + spousePension + spousePartTime;
}

function estimateHealthcareCosts(profile: any): number {
  // Simplified healthcare cost estimation
  const age = calculateAge(profile?.dateOfBirth);
  const isMarried = profile?.maritalStatus === 'married';
  
  if (age >= 65) {
    return isMarried ? 7200 : 3600; // Medicare estimates
  } else {
    return isMarried ? 24000 : 12000; // Pre-Medicare estimates
  }
}

function calculateAnnualSavings(profile: any): number {
  if (!profile) return 0;
  const savingsRate = Number(profile.savingsRate) || 0;
  const annualIncome = Number(profile.annualIncome) || 0;
  const spouseIncome = Number(profile.spouseAnnualIncome) || 0;
  const totalIncome = annualIncome + spouseIncome;
  
  return totalIncome * (savingsRate / 100);
}

function categorizeAssets(assets: any[]): any {
  if (!assets) {
    return {
      taxDeferred: 0,
      taxFree: 0,
      capitalGains: 0,
      cashEquivalents: 0,
      totalAssets: 0
    };
  }
  
  const buckets = {
    taxDeferred: 0,
    taxFree: 0,
    capitalGains: 0,
    cashEquivalents: 0,
    totalAssets: 0
  };
  
  assets.forEach(asset => {
    const value = Number(asset.value) || 0;
    
    if (['401k', '403b', 'traditional-ira'].includes(asset.type)) {
      buckets.taxDeferred += value;
    } else if (asset.type === 'roth-ira') {
      buckets.taxFree += value;
    } else if (asset.type === 'taxable-brokerage') {
      buckets.capitalGains += value;
    } else if (['savings', 'checking'].includes(asset.type)) {
      buckets.cashEquivalents += value;
    }
  });
  
  buckets.totalAssets = buckets.taxDeferred + buckets.taxFree + buckets.capitalGains + buckets.cashEquivalents;
  
  return buckets;
}
