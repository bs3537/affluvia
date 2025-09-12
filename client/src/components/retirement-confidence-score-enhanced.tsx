import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { TrendingUp, AlertTriangle, BarChart3, Info, Shield, Target, X, CheckCircle, ChevronDown } from 'lucide-react';
import { Gauge } from './ui/gauge';
import { LastCalculated } from './ui/last-calculated';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface MonteCarloResult {
  probabilityOfSuccess: number;
  medianEndingBalance: number;
  percentile10EndingBalance: number;
  percentile90EndingBalance: number;
  yearsUntilDepletion: number | null;
  safeWithdrawalRate: number;
  currentRetirementAssets: number;
  projectedRetirementPortfolio: number;
  results?: Array<any>;
  summary?: any;
  successProbability?: number;
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
  requiresIntakeForm?: boolean;
  message?: string;
  missingFields?: string[];
}

export function RetirementConfidenceScoreEnhanced() {
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedResult, setSavedResult] = useState<MonteCarloResult | null>(null);
  const [needsCalculation, setNeedsCalculation] = useState(true);
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);
  
  // Check for saved data on mount
  useEffect(() => {
    const checkSavedData = async () => {
      try {
        const response = await fetch('/api/retirement-score', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const savedData = await response.json();
          if (!savedData.needsCalculation) {
            // STANDARDIZED: Handle both old percentage and new decimal formats
            const probability = savedData.probabilityDecimal 
              ? savedData.probabilityDecimal * 100  // Convert decimal to percentage for display
              : savedData.probability || 0;         // Use existing percentage or default to 0
              
            setMonteCarloResult({
              probabilityOfSuccess: probability,
              medianEndingBalance: savedData.medianEndingBalance || 0,
              message: savedData.message,
              percentile10EndingBalance: 0,
              percentile90EndingBalance: 0,
              yearsUntilDepletion: null,
              safeWithdrawalRate: 0,
              currentRetirementAssets: 0,
              projectedRetirementPortfolio: 0,
              scenarios: { successful: 0, failed: 0, total: 1000 },
              confidenceIntervals: {
                percentile10: 0,
                percentile25: 0,
                percentile50: savedData.medianEndingBalance || 0,
                percentile75: 0,
                percentile90: 0
              }
            });
            setSavedResult(savedData);
            setNeedsCalculation(false);
            setHasCalculated(true);
          }
        }
      } catch (e) {
        console.log('No saved retirement score found');
      }
    };
    
    checkSavedData();
  }, []);

  const calculateMonteCarlo = async () => {
    setIsLoading(true);
    setLoadingSeconds(0);
    setError(null);
    try {
      // Use new on-demand calculation endpoint
      const response = await fetch('/api/calculate-retirement-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skipCache: false })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresStep === 11) {
          setMonteCarloResult({
            probabilityOfSuccess: 0,
            message: errorData.message || 'Please complete the retirement planning section in your intake form',
            requiresIntakeForm: true,
            missingFields: errorData.missingFields,
            medianEndingBalance: 0,
            percentile10EndingBalance: 0,
            percentile90EndingBalance: 0,
            yearsUntilDepletion: null,
            safeWithdrawalRate: 0,
            currentRetirementAssets: 0,
            projectedRetirementPortfolio: 0,
            scenarios: { successful: 0, failed: 0, total: 0 },
            confidenceIntervals: {
              percentile10: 0,
              percentile25: 0,
              percentile50: 0,
              percentile75: 0,
              percentile90: 0
            }
          });
          return;
        }
        throw new Error('Failed to calculate retirement confidence score.');
      }
      
      const result = await response.json();
      
      if (result && (
        result.probabilityOfSuccess !== undefined ||
        result.successProbability !== undefined ||
        result.probability !== undefined ||
        result.scenarios !== undefined ||
        result.results !== undefined
      )) {
        // STANDARDIZED: Handle probability from new API format
        let displayProbability = 0;
        
        if (result.probability !== undefined) {
          // New API format - already returns percentage for display
          displayProbability = result.probability;
        } else if (result.probabilityOfSuccess !== undefined) {
          // Legacy format - might be decimal or percentage
          displayProbability = result.probabilityOfSuccess > 1 
            ? result.probabilityOfSuccess 
            : result.probabilityOfSuccess * 100;
        } else if (result.successProbability !== undefined) {
          // Legacy decimal format - convert to percentage
          displayProbability = result.successProbability * 100;
        }
        
        const normalizedResult = {
          ...result,
          probabilityOfSuccess: displayProbability
        };
        
        setMonteCarloResult(normalizedResult);
        setSavedResult(normalizedResult);
        setHasCalculated(true);
        setCalculatedAt(new Date().toISOString());
      } else {
        throw new Error('Invalid simulation results received.');
      }
    } catch (error: any) {
      console.error('Error calculating Monte Carlo simulation:', error);
      setError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchSavedResult = async () => {
      try {
        const response = await fetch('/api/financial-profile', { credentials: 'include' });
        if (response.ok) {
          const profile = await response.json();
          if (profile?.calculations?.retirementConfidenceScoreEnhanced) {
            const savedData = profile.calculations.retirementConfidenceScoreEnhanced;
            // STANDARDIZED: Convert probability to display format if needed
            const displayProbability = savedData.probabilityOfSuccess > 1 
              ? savedData.probabilityOfSuccess 
              : savedData.probabilityOfSuccess * 100;
              
            setSavedResult({ ...savedData, probabilityOfSuccess: displayProbability });
            setMonteCarloResult({ ...savedData, probabilityOfSuccess: displayProbability });
            setHasCalculated(true);
            setNeedsCalculation(false);
            // use any saved calculated timestamp from MC summary
            try {
              const ts = profile?.monteCarloSimulation?.retirementSimulation?.calculatedAt;
              if (ts) setCalculatedAt(ts);
            } catch {}
          } else if (profile?.monteCarloSimulation?.retirementSimulation) {
            // Check if we have Monte Carlo data from previous calculation
            const mcData = profile.monteCarloSimulation.retirementSimulation;
            const rawProbability = mcData.results?.probabilityOfSuccess || mcData.results?.successProbability || 0;
            
            // STANDARDIZED: Handle legacy probability formats
            const displayProbability = rawProbability > 1 
              ? rawProbability      // Already percentage
              : rawProbability * 100; // Convert decimal to percentage
              
            const result = {
              probabilityOfSuccess: displayProbability,
              medianEndingBalance: mcData.results?.medianFinalValue || 0,
              scenarios: {
                successful: mcData.results?.successfulScenarios || 0,
                failed: (mcData.results?.totalScenarios || 1000) - (mcData.results?.successfulScenarios || 0),
                total: mcData.results?.totalScenarios || 1000
              }
            };
            setMonteCarloResult(result as any);
            setHasCalculated(true);
            setNeedsCalculation(false);
            try {
              const ts = profile?.monteCarloSimulation?.retirementSimulation?.calculatedAt;
              if (ts) setCalculatedAt(ts);
            } catch {}
          } else {
            // Don't auto-calculate, show button instead
            setNeedsCalculation(true);
          }
        }
      } catch (error) {
        console.error('Error fetching saved results:', error);
      }
    };
    
    fetchSavedResult();
  }, []);

  // Run fresh calculation on mount
  useEffect(() => {
    calculateMonteCarlo();
  }, []);

  useEffect(() => {
    const handler = () => {
      calculateMonteCarlo();
    };
    window.addEventListener('refreshDashboard', handler);
    return () => window.removeEventListener('refreshDashboard', handler);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoading]);

  // Clamp probability values to ensure they stay within 0-100 range
  const clampProbability = (probability: number | undefined): number => {
    return Math.min(100, Math.max(0, probability || 0));
  };

  const getSuccessColor = (probability: number) => {
    const clamped = clampProbability(probability);
    if (clamped >= 85) return { bg: 'bg-green-900/30', text: 'text-green-400', gradient: 'from-green-500/20 to-green-600/20', border: 'border-green-500/30' };
    if (clamped >= 75) return { bg: 'bg-blue-900/30', text: 'text-blue-400', gradient: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-500/30' };
    if (clamped >= 65) return { bg: 'bg-yellow-900/30', text: 'text-yellow-400', gradient: 'from-yellow-500/20 to-yellow-600/20', border: 'border-yellow-500/30' };
    return { bg: 'bg-red-900/30', text: 'text-red-400', gradient: 'from-red-500/20 to-red-600/20', border: 'border-red-500/30' };
  };

  const getSuccessLabel = (probability: number) => {
    const clamped = clampProbability(probability);
    if (clamped >= 85) return 'Highly Confident';
    if (clamped >= 75) return 'Good Outlook';
    if (clamped >= 65) return 'Fair Chance';
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

  return (
    <Card className="card-gradient border-gray-700 widget-card bg-gradient-to-br from-gray-900/40 to-gray-800/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-white">Retirement Success Probability (Monte Carlo)</CardTitle>
            {monteCarloResult && (
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                getSuccessColor(monteCarloResult.probabilityOfSuccess).bg
              } ${getSuccessColor(monteCarloResult.probabilityOfSuccess).text}`}>
                {getSuccessLabel(monteCarloResult.probabilityOfSuccess)}
              </div>
            )}
          </div>
        </div>
        <BarChart3 className="w-6 h-6 text-[#FF6B6B]" />
      </CardHeader>
      <div className="px-6 -mt-2">
        <LastCalculated timestamp={calculatedAt} onRefresh={calculateMonteCarlo} refreshing={isLoading} />
      </div>
      <CardContent>
        {needsCalculation && !isLoading && !monteCarloResult ? (
          <div className="text-center py-8">
            <Target className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <h3 className="text-white font-medium mb-2">Ready to Calculate</h3>
            <p className="text-gray-400 text-sm mb-4">
              Click below to run the full Monte Carlo simulation with 1000+ scenarios
            </p>
            <Button 
              onClick={() => {
                setNeedsCalculation(false);
                calculateMonteCarlo();
              }}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
            >
              Generate Retirement Analysis
            </Button>
          </div>
        ) : error ? (
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
            <p className="text-gray-400 mt-2 text-sm">Calculating enhanced scenarios...</p>
            <p className="text-gray-500 mt-1 text-xs">
              {loadingSeconds > 0 && `${loadingSeconds}s`}
            </p>
          </div>
        ) : monteCarloResult ? (
          monteCarloResult.requiresIntakeForm ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-400" />
              <p className="text-amber-400 font-semibold mb-2">Complete Your Retirement Planning</p>
              <p className="text-gray-400 text-sm mb-4">
                {monteCarloResult.message || 'Please complete the retirement planning section in your intake form to enable Monte Carlo simulations.'}
              </p>
              <Button 
                onClick={() => window.location.href = '/intake-form?step=11'} 
                className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
              >
                Complete Intake Form
              </Button>
            </div>
          ) : (
          <>
            <div className="flex flex-col items-center mb-4">
              <Gauge
                value={clampProbability(monteCarloResult.probabilityOfSuccess)}
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
                        <h4 className="font-semibold text-white text-sm pr-4">Enhanced Monte Carlo Analysis</h4>
                        <div className="space-y-2 text-xs text-gray-300">
                        <p>
                          This enhanced simulation uses advanced Monte Carlo techniques with variance reduction for improved accuracy.
                        </p>
                        <p>
                          Key features of the enhanced baseline model:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong className="text-white">Return Distribution:</strong> IID log-normal with historical CAGR/volatility parameters</li>
                          <li><strong className="text-white">Asset Correlations:</strong> Cholesky decomposition for realistic multi-asset portfolios</li>
                          <li><strong className="text-white">Guardrails Strategy:</strong> Guyton-Klinger dynamic withdrawal adjustments</li>
                          <li><strong className="text-white">LTC Modeling:</strong> Age-based probabilities with $75K/person average cost at ages 91-92</li>
                          <li><strong className="text-white">Variance Reduction:</strong> Antithetic variates, control variates, and stratified sampling</li>
                          <li><strong className="text-white">Simulation Runs:</strong> 10,000 scenarios for statistical significance</li>
                          <li><strong className="text-white">Nominal Projections:</strong> Future dollar values with separate inflation modeling</li>
                        </ul>
                        <p className="text-gray-400 mt-2">
                          This institutional-grade approach provides robust retirement security assessment aligned with CFP® standards.
                        </p>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-4">
              {(() => {
                const retirementAge = monteCarloResult?.optimalRetirementAge;
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
                          Good news! You could retire {Math.floor(retirementAge.desiredAge - retirementAge.earliestAge!)} year{Math.floor(retirementAge.desiredAge - retirementAge.earliestAge!) > 1 ? 's' : ''} earlier
                        </p>
                        <p className="text-green-200/80 text-xs mt-1">
                          Visit the Retirement Planning Center to explore your options for early retirement.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
                
              {monteCarloResult && clampProbability(monteCarloResult.probabilityOfSuccess) < 80 && (() => {
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
                            Your retirement confidence score is {Math.round(clampProbability(monteCarloResult.probabilityOfSuccess))}%, below the recommended 80% threshold.
                          </p>
                          
                          {insightsExpanded && (
                            <div className="space-y-2 mt-3">
                              <p className="text-xs font-medium text-amber-200">Top improvement opportunities:</p>
                          
                          <div className="flex items-start gap-2 p-2 bg-amber-900/10 rounded border border-amber-700/30">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-amber-100">1. Increase Retirement Savings</p>
                              <p className="text-xs text-gray-300 mt-0.5">
                                Boost your monthly contributions. Even an extra $500/month could improve your score by 8-12 points.
                              </p>
                            </div>
                          </div>
                          
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

              {(() => {
                const retirementAge = monteCarloResult?.optimalRetirementAge;
                const hasGoodScore = monteCarloResult && clampProbability(monteCarloResult.probabilityOfSuccess) >= 80;
                const hasExcellentScore = monteCarloResult && clampProbability(monteCarloResult.probabilityOfSuccess) >= 95;
                
                // For users with 95%+ score who don't have early retirement info
                if (hasExcellentScore && (!retirementAge || !retirementAge.canRetireEarlier)) {
                  return (
                    <div className="mt-4 p-3 bg-gradient-to-br from-green-900/20 to-green-800/20 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <div className="flex-1">
                          <p className="text-sm text-green-300 font-medium">Excellent Retirement Readiness</p>
                          <p className="text-xs text-gray-400 mt-1">
                            You're exceptionally well-positioned for retirement with a {Math.round(clampProbability(monteCarloResult.probabilityOfSuccess))}% success rate
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return retirementAge && hasGoodScore && (
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
                    </p>
                  </div>
                );
              })()}

            </div>
          </>
          )
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <p className="text-gray-300 mb-4">Calculate your enhanced retirement confidence score</p>
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
