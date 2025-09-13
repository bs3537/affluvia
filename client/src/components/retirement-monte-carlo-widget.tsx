import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { TrendingUp, AlertTriangle, ChevronDown, BarChart3, Zap, Info, Shield, DollarSign, Target, X, CheckCircle } from 'lucide-react';
import { Gauge } from './ui/gauge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useRetirementScore } from '@/contexts/retirement-score-context';
import { seedFromParams } from '@/lib/seed';
// Removed MonteCarloVisualization import - visualization moved to Retirement Planning section

interface MonteCarloResult {
  probabilityOfSuccess: number;
  medianEndingBalance: number;
  percentile10EndingBalance: number;
  percentile90EndingBalance: number;
  yearsUntilDepletion: number | null;
  safeWithdrawalRate: number;
  currentRetirementAssets: number; // Current portfolio value
  projectedRetirementPortfolio: number; // Projected portfolio value at retirement start
  results?: Array<any>; // Raw simulation results
  summary?: any; // Summary statistics
  successProbability?: number; // Raw success probability
  yearlyCashFlows?: Array<{
    year: number;
    age: number;
    portfolioBalance: number;
    withdrawal?: number;
    guaranteedIncome?: number;
    netCashFlow?: number;
  }>;
  percentile10CashFlows?: Array<{
    year: number;
    age: number;
    portfolioBalance: number;
    withdrawal?: number;
    guaranteedIncome?: number;
    netCashFlow?: number;
  }>;
  percentile90CashFlows?: Array<{
    year: number;
    age: number;
    portfolioBalance: number;
    withdrawal?: number;
    guaranteedIncome?: number;
    netCashFlow?: number;
  }>;
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
    // Healthcare breakdown
    annualHealthcareCosts?: number;
    monthlyHealthcareCosts?: number;
    healthcarePercentage?: number;
    healthcareInflationRate?: number;
  };
  ltcAnalysis?: {
    hasInsurance: boolean;
    probabilityOfLTC: number;
    avgCostIfOccurs: number;
    avgDurationIfOccurs: number;
    careTypeBreakdown: {
      home: number;
      assisted: number;
      nursing: number;
    };
    impactOnSuccess: {
      successWithLTC: number;
      successWithoutLTC: number;
      failuresDueToLTC: number;
      successDelta: number;
    };
  };
  gapAnalysis?: {
    currentScore: number;
    targetScore: number;
    gap: number;
    topFactors: Array<{
      id: string;
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      estimatedScoreImprovement: number;
      category: 'savings' | 'insurance' | 'optimization' | 'allocation' | 'income';
      priority: number;
    }>;
  };
  optimalRetirementAge?: {
    currentAge: number;
    desiredAge: number;
    optimalAge: number | null;
    canRetireEarlier: boolean;
    earliestAge?: number | null;
    currentProbability: number;
    optimalProbability: number | null;
    message: string;
  };
}

interface RetirementMonteCarloWidgetProps {
  isExpanded: boolean;
  onToggle: () => void;
  onCalculate?: () => void;
  savedMonteCarloData?: any; // Monte Carlo data from profile
  optimalRetirementAge?: {
    currentAge: number;
    desiredAge: number;
    optimalAge: number;
    canRetireEarlier: boolean;
    earliestAge?: number;
    currentProbability: number;
    optimalProbability: number;
    message: string;
  };
}

export function RetirementMonteCarloWidget({ 
  isExpanded, 
  onToggle, 
  onCalculate,
  savedMonteCarloData,
  optimalRetirementAge 
}: RetirementMonteCarloWidgetProps) {
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const { setRetirementScore, setLastFetchTime } = useRetirementScore();
  const [hasCalculated, setHasCalculated] = useState(false);
  // Removed isMonteCarloExpanded state - no longer needed without visualization
  const [error, setError] = useState<string | null>(null);
  
  // Debug logging removed for production
  
  const calculateMonteCarlo = async () => {
    setIsLoading(true);
    setError(null); // Clear any previous error
    try {
      const response = await fetch('/api/calculate-retirement-monte-carlo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skipCache: false,
          seed: seedFromParams(undefined, 'retirement-mc-widget-v1')
        }),
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to calculate retirement confidence score.';
        
        // Try to parse JSON error response
        try {
          const errorData = await response.json();
          console.error('API Error Response:', errorData);
          
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
          
          // Add specific messages for known error types
          if (response.status === 404) {
            errorMessage = 'Financial profile not found. Please complete your intake form to enable simulations.';
          } else if (response.status === 400) {
            // Check if it's specifically about Step 11
            if (errorData.requiresStep === 11) {
              errorMessage = errorData.message || 'Please complete Step 11 (Retirement Planning) of your intake form to enable Monte Carlo simulations.';
            } else {
              errorMessage = 'Invalid or incomplete profile data. Please review your financial information.';
            }
          }
        } catch (jsonError) {
          // If response is not JSON, use status-based messages
          if (response.status === 404) {
            errorMessage = 'Financial profile not found. Please complete your intake form to enable simulations.';
          } else if (response.status === 400) {
            errorMessage = 'Please complete Step 11 (Retirement Planning) of your intake form to enable Monte Carlo simulations.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error occurred. Please try again later.';
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Enhanced logging removed for production
      
      // More flexible validation - check for any of these fields
      if (result && (
        result.probabilityOfSuccess !== undefined ||
        result.successProbability !== undefined ||
        result.scenarios !== undefined ||
        result.results !== undefined
      )) {
        // Normalize the response structure
        const normalizedResult = {
          ...result,
          // Ensure probabilityOfSuccess exists (might be named differently in response)
          probabilityOfSuccess: result.probabilityOfSuccess !== undefined 
            ? result.probabilityOfSuccess 
            : (result.successProbability !== undefined 
              ? result.successProbability * 100  // Convert if it's a decimal
              : 0)
        };
        
        // Normalized Monte Carlo result processed
        
        setMonteCarloResult(normalizedResult);
        setHasCalculated(true);
        
        // Save to context for sharing with other components
        const simplifiedResult = {
          probabilityOfSuccess: normalizedResult.probabilityOfSuccess,
          medianEndingBalance: normalizedResult.medianEndingBalance,
          scenarios: normalizedResult.scenarios
        };
        setRetirementScore(simplifiedResult);
        setLastFetchTime(Date.now());
        
        if (onCalculate) onCalculate();
      } else {
        console.error('Invalid Monte Carlo result - validation failed:', result);
        console.error('Expected fields not found. Result keys:', result ? Object.keys(result) : 'null result');
        throw new Error('Invalid simulation results received. The server response is missing required data.');
      }
    } catch (error) {
      console.error('Error calculating Monte Carlo simulation:', error);
      setError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Use saved data if available, otherwise calculate fresh
  useEffect(() => {
    // Check multiple possible data structures
    let savedData = null;
    
    // Check for data in retirementSimulation wrapper
    if (savedMonteCarloData?.retirementSimulation?.probabilityOfSuccess !== undefined) {
      savedData = savedMonteCarloData.retirementSimulation;
      // Using saved Monte Carlo data from profile.retirementSimulation
    }
    // Check for data in retirementSimulation.results (NEW structure after persistence changes)
    else if (savedMonteCarloData?.retirementSimulation?.results?.probabilityOfSuccess !== undefined) {
      savedData = savedMonteCarloData.retirementSimulation.results;
      // Using saved Monte Carlo data from profile.retirementSimulation.results
    }
    // Check for data directly in savedMonteCarloData
    else if (savedMonteCarloData?.probabilityOfSuccess !== undefined) {
      savedData = savedMonteCarloData;
      // Using saved Monte Carlo data from profile (direct)
    }
    
    if (savedData) {
      // Use the saved baseline data
      const savedResult = {
        probabilityOfSuccess: savedData.probabilityOfSuccess,
        medianEndingBalance: savedData.medianEndingBalance || 0,
        percentile10EndingBalance: savedData.percentile10EndingBalance || 0,
        percentile90EndingBalance: savedData.percentile90EndingBalance || 0,
        yearsUntilDepletion: savedData.yearsUntilDepletion || null,
        safeWithdrawalRate: savedData.safeWithdrawalRate || 0,
        currentRetirementAssets: savedData.currentRetirementAssets || 0,
        projectedRetirementPortfolio: savedData.projectedRetirementPortfolio || 0,
        scenarios: savedData.scenarios || { successful: 0, failed: 0, total: 1000 },
        confidenceIntervals: savedData.confidenceIntervals || {},
        optimalRetirementAge: optimalRetirementAge || savedData.optimalRetirementAge,
        ...savedData
      };
      
      setMonteCarloResult(savedResult);
      setHasCalculated(true);
      
      // Also update context
      const simplifiedResult = {
        probabilityOfSuccess: savedResult.probabilityOfSuccess,
        medianEndingBalance: savedResult.medianEndingBalance,
        scenarios: savedResult.scenarios
      };
      setRetirementScore(simplifiedResult);
      setLastFetchTime(Date.now());
    } else {
      // No saved data, don't automatically calculate
      // User must click the button to trigger calculation
      // This prevents premature calculations before Step 11 completion
      // No saved Monte Carlo data found, waiting for user to trigger calculation
      // Don't auto-calculate: calculateMonteCarlo();
    }
  }, [savedMonteCarloData, optimalRetirementAge]); // Re-run if saved data changes

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
            <ChevronDown className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-400 mb-4">{error}</p>
            <Button 
              onClick={calculateMonteCarlo} 
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
            >
              Retry Calculation
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="text-gray-400 mt-2 text-sm">Calculating scenarios...</p>
          </div>
        ) : monteCarloResult ? (
          <>
            {/* Always show the gauge and score prominently at the top */}
            <div className="flex flex-col items-center mb-4">
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
              <div className="flex items-center justify-center gap-2 mt-1">
                <p className="text-xs text-gray-500 text-center">
                  Score of 80+ recommended
                </p>
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-transparent">
                      <Info className="w-3 h-3 text-gray-400 hover:text-white" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 bg-gray-800 border-gray-700" align="center">
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
                        onClick={() => setIsPopoverOpen(false)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <div className="space-y-3">
                        <h4 className="font-semibold text-white text-sm pr-4">Understanding Monte Carlo Analysis</h4>
                        <div className="space-y-2 text-xs text-gray-300">
                        <p>
                          This simulation uses historical volatility patterns to test how your retirement plan performs across various economic conditions.
                        </p>
                        <p>
                          Unlike simple projections, this sophisticated analysis accounts for:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong className="text-white">Market Volatility:</strong> Real-world ups and downs based on historical patterns</li>
                          <li><strong className="text-white">Sequence of Returns Risk:</strong> The critical impact of market timing near retirement</li>
                          <li><strong className="text-white">Inflation Variability:</strong> Dynamic inflation modeling (not just a fixed rate)</li>
                          <li><strong className="text-white">Longevity Variations:</strong> Mortality tables and life expectancy distributions</li>
                          <li><strong className="text-white">Withdrawal Modeling:</strong> Dynamic withdrawals based on portfolio performance</li>
                          <li><strong className="text-white">Long-Term Care Events:</strong> Stochastic shocks for LTC based on age-specific probabilities (70% lifetime risk), with costs averaging $100k/year</li>
                          <li><strong className="text-white">Healthcare Inflation:</strong> Separate modeling for healthcare costs at 2.69% vs general inflation at 2.6%</li>
                        </ul>
                        <p className="text-gray-400 mt-2">
                          This comprehensive approach provides a more realistic assessment of your retirement security than traditional straight-line projections.
                        </p>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Overview Content */}
            <div className="space-y-4">
              {/* Early Retirement Notification - Show from either saved Monte Carlo result or optimalRetirementAge prop */}
                {(() => {
                  // Use optimalRetirementAge from either monteCarloResult or prop fallback
                  const retirementAge = monteCarloResult?.optimalRetirementAge || optimalRetirementAge;
                  const canShowEarlyRetirement = retirementAge?.canRetireEarlier && 
                    retirementAge?.earliestAge && 
                    (retirementAge.desiredAge - retirementAge.earliestAge >= 1);
                  
                  return canShowEarlyRetirement && (
                    <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm">
                          <p className="text-green-300 font-medium">
                            Good news! You could retire {Math.floor(retirementAge.desiredAge - retirementAge.earliestAge)} year{Math.floor(retirementAge.desiredAge - retirementAge.earliestAge) > 1 ? 's' : ''} earlier
                          </p>
                          <p className="text-green-200/80 text-xs mt-1">
                            {monteCarloResult 
                              ? 'Visit the Retirement Planning Center to explore your options for early retirement.' 
                              : 'Click "Calculate Score" above for detailed analysis and explore options in the Retirement Planning Center.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Show prioritized insights if score is below 80% - expandable similar to other dashboard widgets */}
                {monteCarloResult && monteCarloResult.probabilityOfSuccess < 80 && (() => {
                  
                  return (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-700/50 w-full">
                        <div className="flex items-start gap-2">
                          <Target className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-amber-100 font-medium">Optimization Needed</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setInsightsExpanded(!insightsExpanded)}
                                className="h-6 w-6 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                              >
                                <ChevronDown className={`w-4 h-4 transform transition-transform ${insightsExpanded ? 'rotate-180' : ''}`} />
                              </Button>
                            </div>
                            <p className="text-xs text-gray-300 mb-2">
                              Your retirement confidence score is {Math.round(monteCarloResult.probabilityOfSuccess)}%, below the recommended 80% threshold.
                            </p>
                            
                            {/* Expandable Priority Insights */}
                            {insightsExpanded && (
                              <div className="space-y-2 mt-3">
                                <p className="text-xs font-medium text-amber-200">Top improvement opportunities:</p>
                            
                            {/* Insight 1: Savings Rate (Highest Priority) */}
                            <div className="flex items-start gap-2 p-2 bg-amber-900/10 rounded border border-amber-700/30">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0"></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-amber-100">1. Increase Retirement Savings</p>
                                <p className="text-xs text-gray-300 mt-0.5">
                                  Boost your monthly contributions. Even an extra $500/month could improve your score by 8-12 points.
                                </p>
                              </div>
                            </div>
                            
                            {/* Insight 2: LTC Insurance (High Priority if user doesn't have it) */}
                            {!monteCarloResult.ltcAnalysis?.hasInsurance && (
                              <div className="flex items-start gap-2 p-2 bg-amber-900/10 rounded border border-amber-700/30">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0"></div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-amber-100">2. Get Long-Term Care Insurance</p>
                                  <p className="text-xs text-gray-300 mt-0.5">
                                    Protect against LTC costs averaging $100K/year. Insurance could improve your score by 5-10 points.
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {/* Insight 3: Delayed Retirement or Work Longer (Medium Priority) */}
                            <div className="flex items-start gap-2 p-2 bg-amber-900/10 rounded border border-amber-700/30">
                              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0"></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-amber-100">
                                  {monteCarloResult.ltcAnalysis?.hasInsurance ? '2.' : '3.'} Consider Working 2-3 Years Longer
                                </p>
                                <p className="text-xs text-gray-300 mt-0.5">
                                  Delaying retirement allows more savings growth and could boost your score by 15-25 points.
                                </p>
                              </div>
                            </div>
                            
                                <p className="text-xs text-gray-400 mt-3">
                                  Visit the Retirement Planning Center to explore these optimization strategies.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Show earliest retirement age ONLY when score is 80% or above and not expanded */}
                {(() => {
                  const retirementAge = monteCarloResult?.optimalRetirementAge || optimalRetirementAge;
                  const hasGoodScore = monteCarloResult && monteCarloResult.probabilityOfSuccess >= 80;
                  
                  return retirementAge && !isExpanded && hasGoodScore && (
                    <div className="mt-4 p-3 bg-gradient-to-br from-green-900/20 to-green-800/20 border border-green-500/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-green-300 font-medium">
                            {retirementAge.canRetireEarlier && retirementAge.earliestAge
                              ? 'Earliest Retirement Age' 
                              : 'Target Retirement Age'}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-green-400">
                          {retirementAge.canRetireEarlier && retirementAge.earliestAge
                            ? retirementAge.earliestAge
                            : retirementAge.desiredAge}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {retirementAge.canRetireEarlier && retirementAge.earliestAge
                          ? `You can retire ${retirementAge.desiredAge - retirementAge.earliestAge} year(s) earlier than planned`
                          : 'Based on your current plan and 80% confidence threshold'}
                        {!monteCarloResult && ' - click above for detailed analysis'}
                      </p>
                    </div>
                  );
                })()}

                {/* Only show expanded content in Overview tab when widget is expanded */}
                {isExpanded && (
                  <div className="space-y-6 border-t border-gray-700 pt-6">
                {/* Action Items - Show when score is below 80 */}
                {monteCarloResult.gapAnalysis && monteCarloResult.probabilityOfSuccess < 80 && monteCarloResult.gapAnalysis.topFactors && monteCarloResult.gapAnalysis.topFactors.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-white">Top Actions to Improve Your Score</h4>
                      <span className="text-xs text-gray-400">
                        Gap to target: {monteCarloResult.gapAnalysis.gap?.toFixed(0) || 0} points
                      </span>
                    </div>
                    <div className="space-y-3">
                      {monteCarloResult.gapAnalysis.topFactors.map((factor, index) => (
                        <div
                          key={factor.id}
                          className={`p-4 rounded-lg border transition-all hover:shadow-lg ${
                            factor.impact === 'high' 
                              ? 'bg-gradient-to-br from-red-900/20 to-orange-900/20 border-red-500/30 hover:border-red-500/50' 
                              : factor.impact === 'medium'
                              ? 'bg-gradient-to-br from-yellow-900/20 to-amber-900/20 border-yellow-500/30 hover:border-yellow-500/50'
                              : 'bg-gradient-to-br from-gray-800/40 to-gray-700/40 border-gray-600/30 hover:border-gray-500/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              factor.impact === 'high' 
                                ? 'bg-red-500/20 text-red-400' 
                                : factor.impact === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-grow">
                              <div className="flex items-center justify-between mb-1">
                                <h5 className="text-sm font-semibold text-white">{factor.title}</h5>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                  factor.impact === 'high' 
                                    ? 'bg-red-500/20 text-red-400' 
                                    : factor.impact === 'medium'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                  +{factor.estimatedScoreImprovement?.toFixed(0) || 0} points
                                </span>
                              </div>
                              <p className="text-xs text-gray-300 mb-2">{factor.description}</p>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-gray-500">
                                  Category: {factor.category.charAt(0).toUpperCase() + factor.category.slice(1)}
                                </span>
                                <span className={`text-xs ${
                                  factor.impact === 'high' ? 'text-red-400' : 
                                  factor.impact === 'medium' ? 'text-yellow-400' : 
                                  'text-gray-400'
                                }`}>
                                  {factor.impact.toUpperCase()} IMPACT
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {/* LTC Analysis Section */}
                {monteCarloResult.ltcAnalysis && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-white">Long-Term Care Impact Analysis</h4>
                    <div className="bg-gradient-to-br from-gray-800/60 to-gray-700/60 p-4 rounded-lg border border-gray-600/30">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-gray-400 mb-1">Lifetime LTC Probability</p>
                          <p className="text-white font-medium">{(monteCarloResult.ltcAnalysis.probabilityOfLTC * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Avg Cost if Occurs</p>
                          <p className="text-white font-medium">${(monteCarloResult.ltcAnalysis.avgCostIfOccurs / 1000).toFixed(0)}K</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Avg Duration</p>
                          <p className="text-white font-medium">{monteCarloResult.ltcAnalysis.avgDurationIfOccurs.toFixed(1)} years</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Impact on Success</p>
                          <p className="text-red-400 font-medium">{monteCarloResult.ltcAnalysis.impactOnSuccess.successDelta.toFixed(0)} points</p>
                        </div>
                      </div>
                      {!monteCarloResult.ltcAnalysis.hasInsurance && (
                        <p className="text-xs text-yellow-400 mt-3 border-t border-gray-600 pt-3">
                          ⚠️ Consider long-term care insurance to protect against this significant risk
                        </p>
                      )}
                    </div>
                  </div>
                )}
                  </div>
                )}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <p className="text-gray-300 mb-4">Calculate your retirement confidence score</p>
            <Button 
              onClick={calculateMonteCarlo} 
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
            >
              Calculate Score
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
