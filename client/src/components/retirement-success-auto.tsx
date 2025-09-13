import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { TrendingUp, AlertTriangle, BarChart3, Info, Shield, Target, X, CheckCircle, ChevronDown, RefreshCw } from 'lucide-react';
import { Gauge } from './ui/gauge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { LastCalculated } from './ui/last-calculated';
import { useDashboardSnapshot, pickWidget } from '@/hooks/useDashboardSnapshot';

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
  ltcAnalysis?: {
    hasInsurance: boolean;
    probabilityOfLTC: number;
    avgCostIfOccurs: number;
    avgDurationIfOccurs: number;
    impactOnSuccess: {
      successWithLTC: number;
      successWithoutLTC: number;
      failuresDueToLTC: number;
      successDelta: number;
    };
  };
  requiresIntakeForm?: boolean;
  message?: string;
  missingFields?: string[];
}

export function RetirementSuccessAuto() {
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTriggeredCalculation, setHasTriggeredCalculation] = useState(false);
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);
  const { data: snapshot } = useDashboardSnapshot();
  
  // Manual calculation (on-demand) for retirement success; not auto-run on mount
  const calculateRetirementSuccess = async () => {
    if (isLoading) return; // Prevent multiple concurrent calculations
    
    setIsLoading(true);
    setLoadingSeconds(0);
    setError(null);
    
    try {
      // Use the same enhanced Monte Carlo algorithm as the manual widget
      const response = await fetch('/api/calculate-retirement-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skipCache: true })
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
        throw new Error('Failed to calculate retirement success probability.');
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
        setHasTriggeredCalculation(true);
        setCalculatedAt(result?.calculatedAt || new Date().toISOString());
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

  // Do not auto-run heavy calculation on mount; rely on saved value or user action

  // Lightweight fetch of saved score without recomputation
  const fetchSavedRetirementScore = async () => {
    try {
      const response = await fetch('/api/retirement-score', { credentials: 'include' });
      if (!response.ok) return;
      const savedData = await response.json();
      if (savedData?.needsCalculation) return;
      const probability = savedData.probabilityDecimal
        ? savedData.probabilityDecimal * 100
        : (savedData.probability || 0);
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
          percentile90: 0,
        },
      });
      setHasTriggeredCalculation(true);
      if (savedData.calculatedAt) setCalculatedAt(savedData.calculatedAt);
    } catch {}
  };

  // Do not hydrate from snapshot to avoid showing stale numbers that change moments later

  // Listen for intake form completion and profile updates
  useEffect(() => {
    const handleProfileUpdate = () => {
      // On intake submission, load saved score (server computes it during submission)
      fetchSavedRetirementScore();
    };

    const handleDashboardRefresh = () => {
      // Refresh by fetching saved value first; user can click to recompute
      fetchSavedRetirementScore();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    window.addEventListener('refreshDashboard', handleDashboardRefresh);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('refreshDashboard', handleDashboardRefresh);
    };
  }, []);

  // Check for existing saved data on mount
  useEffect(() => {
    const checkExistingData = async () => {
      try {
        const response = await fetch('/api/retirement-score', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const savedData = await response.json();
          if (!savedData.needsCalculation && savedData.probability) {
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
            setHasTriggeredCalculation(true);
            if (savedData.calculatedAt) setCalculatedAt(savedData.calculatedAt);
          }
        }
      } catch (e) {
        // No existing data, will auto-calculate when profile is updated
        console.log('No saved retirement score found, will auto-calculate');
      }
    };
    
    checkExistingData();
  }, []);

  // Loading timer
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
            <CardTitle className="text-lg font-semibold text-white">Retirement Success</CardTitle>
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
          {monteCarloResult && !monteCarloResult.requiresIntakeForm && !error && (
            <Button
              size="sm"
              variant="ghost"
              onClick={calculateRetirementSuccess}
              disabled={isLoading}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-transparent">
                <Info className="w-4 h-4 text-gray-400 hover:text-white" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] bg-gray-800 border-gray-700" align="end">
              <div className="relative max-h-[70vh] overflow-y-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full z-10"
                  onClick={() => setIsPopoverOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="space-y-4">
                  <h4 className="font-semibold text-white text-sm pr-4">Enhanced Monte Carlo Retirement Algorithm</h4>
                  
                  <div className="space-y-3 text-xs text-gray-300">
                    <p className="text-gray-200">
                      This widget uses an advanced institutional-grade Monte Carlo simulation with sophisticated variance reduction techniques for maximum accuracy.
                    </p>
                    
                    <div className="space-y-2">
                      <h5 className="font-semibold text-white text-xs">Core Methodology:</h5>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong className="text-white">1,000 Scenarios:</strong> Comprehensive market volatility simulation</li>
                        <li><strong className="text-white">Correlated Returns:</strong> Models asset class correlations and economic regime changes</li>
                        <li><strong className="text-white">Stochastic Life Expectancy:</strong> Uses actuarial mortality tables with uncertainty</li>
                        <li><strong className="text-white">Dynamic Tax Planning:</strong> Federal/state tax optimization with bracket projections</li>
                        <li><strong className="text-white">Inflation Modeling:</strong> Multi-regime inflation scenarios with COLA adjustments</li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-semibold text-white text-xs">Advanced Variance Reduction:</h5>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong className="text-white">Antithetic Variates:</strong> Pairs mirror scenarios to reduce Monte Carlo error</li>
                        <li><strong className="text-white">Stratified Sampling:</strong> Latin Hypercube Sampling (LHS) for better coverage</li>
                        <li><strong className="text-white">Control Variates:</strong> Uses analytical benchmarks to improve precision</li>
                        <li><strong className="text-white">Quasi-Random Sequences:</strong> Low-discrepancy sampling for convergence</li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-semibold text-white text-xs">Comprehensive Risk Modeling:</h5>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong className="text-white">LTC Events:</strong> Probabilistic long-term care cost projections</li>
                        <li><strong className="text-white">Healthcare Inflation:</strong> IRMAA Medicare surcharges and medical cost growth</li>
                        <li><strong className="text-white">Sequence Risk:</strong> Early retirement market crash protection</li>
                        <li><strong className="text-white">Longevity Risk:</strong> Joint survival probabilities for couples</li>
                        <li><strong className="text-white">Withdrawal Sequencing:</strong> Tax-efficient asset liquidation strategies</li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-semibold text-white text-xs">Key Features:</h5>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong className="text-white">Auto-Trigger:</strong> Runs calculation automatically after intake form completion</li>
                        <li><strong className="text-white">Real-time Updates:</strong> Refreshes when profile data changes</li>
                        <li><strong className="text-white">Parallel Processing:</strong> Multi-threaded computation for speed</li>
                        <li><strong className="text-white">Statistical Validation:</strong> Built-in convergence and accuracy checks</li>
                      </ul>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mt-3">
                      <p className="text-blue-300 text-xs">
                        <strong>Accuracy Standard:</strong> This simulation achieves institutional-grade precision through advanced statistical techniques, providing confidence intervals typically within ±2% of the true probability at 95% confidence level.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <TrendingUp className="w-6 h-6 text-[#10B981]" />
        </div>
      </CardHeader>
      <div className="px-6 -mt-2">
        <LastCalculated timestamp={calculatedAt} />
      </div>
      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-400 mb-4">{error}</p>
            <Button 
              onClick={calculateRetirementSuccess} 
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
            >
              Retry Calculation
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
            <p className="text-gray-400 mt-2 text-sm">Calculating retirement success probability...</p>
            <p className="text-gray-500 mt-1 text-xs">
              Running Monte Carlo simulation with 1,000 scenarios
            </p>
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
                {monteCarloResult.message || 'Please complete the retirement planning section in your intake form to see your retirement success probability.'}
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
                Enhanced Monte Carlo analysis with market volatility modeling
              </p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <p className="text-xs text-gray-500 text-center">
                  Success probability of 80%+ recommended
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {monteCarloResult?.optimalRetirementAge?.canRetireEarlier && 
               monteCarloResult.optimalRetirementAge.earliestAge && 
               (monteCarloResult.optimalRetirementAge.desiredAge - monteCarloResult.optimalRetirementAge.earliestAge >= 1) && (
                <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="text-green-300 font-medium">
                        Great news! You could retire {Math.floor(monteCarloResult.optimalRetirementAge.desiredAge - monteCarloResult.optimalRetirementAge.earliestAge)} year{Math.floor(monteCarloResult.optimalRetirementAge.desiredAge - monteCarloResult.optimalRetirementAge.earliestAge) > 1 ? 's' : ''} earlier
                      </p>
                      <p className="text-green-200/80 text-xs mt-1">
                        Visit the Retirement Planning Center to explore early retirement options.
                      </p>
                    </div>
                  </div>
                </div>
              )}
                
              {monteCarloResult && clampProbability(monteCarloResult.probabilityOfSuccess) >= 85 && (
                <div className="p-3 bg-gradient-to-br from-green-900/20 to-green-800/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <div className="flex-1">
                      <p className="text-sm text-green-300 font-medium">Excellent Retirement Readiness!</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Your retirement plan is very well funded with a {Math.round(clampProbability(monteCarloResult.probabilityOfSuccess))}% success rate
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {monteCarloResult && clampProbability(monteCarloResult.probabilityOfSuccess) < 80 && (
                <div className="p-3 rounded-lg bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-700/50">
                  <div className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-100 font-medium">Optimization Opportunities</p>
                      <p className="text-xs text-gray-300 mb-2">
                        Your success probability is {Math.round(clampProbability(monteCarloResult.probabilityOfSuccess))}%. Consider these improvements:
                      </p>
                      <div className="space-y-1 text-xs text-gray-300">
                        <p>• Increase monthly retirement contributions</p>
                        <p>• Consider working 1-2 years longer</p>
                        {!monteCarloResult.ltcAnalysis?.hasInsurance && <p>• Evaluate long-term care insurance</p>}
                        <p className="text-gray-400 mt-2">
                          Visit Retirement Planning Center for detailed strategies.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
          )
        ) : (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-gray-300 mb-2">Waiting for intake form completion</p>
            <p className="text-gray-400 text-sm">
              Your retirement success probability will be calculated automatically
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
