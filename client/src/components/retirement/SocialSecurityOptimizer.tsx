import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, DollarSign, Calendar, ChevronUp, ChevronDown, RefreshCw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

interface BridgePeriodAnalysis {
  yearsOfBridge: number;
  totalBridgeCost: number;
  portfolioDrawdownPercent: number;
  bridgeFeasible: boolean;
  cashFlowShortfall: number;
  recommendation: string;
}

interface SuccessProbabilityImpact {
  successAtOptimalAge: number;
  successAtRetirementAge: number;
  successAt62: number;
  recommendedAge: number;
  warning?: string;
}

interface OptimizationResult {
  user: {
    optimalAge: number;
    cumulativeAtOptimal: number;
    cumulativeAtRetirement: number;
    difference: number;
    monthlyAtOptimal: number;
    monthlyAtRetirement: number;
  };
  spouse?: {
    optimalAge: number;
    cumulativeAtOptimal: number;
    cumulativeAtRetirement: number;
    difference: number;
    monthlyAtOptimal: number;
    monthlyAtRetirement: number;
  };
  combined: {
    optimalUserAge: number;
    optimalSpouseAge: number;
    totalCumulativeAtOptimal: number;
    totalCumulativeAtRetirement: number;
    totalDifference: number;
    percentageGain: number;
  };
  ageAnalysis: Array<{
    userAge: number;
    spouseAge: number;
    combinedMonthly: number;
    combinedCumulative: number;
  }>;
  bridgeAnalysis?: BridgePeriodAnalysis;
  successProbabilityImpact?: SuccessProbabilityImpact;
  constrainedRecommendation?: {
    recommendedUserAge: number;
    recommendedSpouseAge: number;
    reason: string;
  };
}

interface Props {
  profile: any;
  isLocked?: boolean;
}

export function SocialSecurityOptimizer({ profile, isLocked = false }: Props) {
  const [optimizationData, setOptimizationData] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);
  // Check for persisted collapse state from UI preferences
  const shouldAutoCollapse = profile?.retirementPlanningUIPreferences?.socialSecurityOptimizerCollapsed;
  // Use persisted state if available, otherwise collapse by default
  const [isCollapsed, setIsCollapsed] = useState(shouldAutoCollapse !== undefined ? shouldAutoCollapse : true);
  const { toast } = useToast();

  const fetchOptimization = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const url = forceRefresh 
        ? '/api/calculate-cumulative-ss-optimization?force=true' 
        : '/api/calculate-cumulative-ss-optimization';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setOptimizationData(data);
        setIsCached(data.isCached || false);
        setCalculatedAt(data.calculatedAt || null);
        
        if (forceRefresh) {
          toast({
            title: "Success",
            description: "Social Security optimization recalculated successfully.",
          });
        }
      } else {
        throw new Error('Failed to calculate optimization');
      }
    } catch (error) {
      console.error('Error calculating SS optimization:', error);
      toast({
        title: "Error",
        description: "Failed to calculate Social Security optimization.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchOptimization();
    }
  }, [profile]);

  // Update collapse state when lock state changes
  useEffect(() => {
    // Auto-collapse when variables are locked (unless user has manually set a preference)
    if (isLocked && shouldAutoCollapse === undefined) {
      setIsCollapsed(true);
    }
  }, [isLocked, shouldAutoCollapse]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (!optimizationData) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-6 h-6 mx-auto text-amber-400" />
          <p className="text-gray-400 mt-2">Loading Social Security optimization...</p>
        </CardContent>
      </Card>
    );
  }

  const { user, spouse, combined } = optimizationData;

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
      
      <CardHeader 
        className="pb-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={async () => {
          const newState = !isCollapsed;
          setIsCollapsed(newState);
          
          // Save collapse preference to database
          try {
            await fetch('/api/financial-profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                retirementPlanningUIPreferences: {
                  ...(profile?.retirementPlanningUIPreferences || {}),
                  socialSecurityOptimizerCollapsed: newState
                }
              })
            });
          } catch (error) {
            console.error('Failed to save collapse preference:', error);
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Social Security Optimizer
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              {isCollapsed 
                ? `Optimal: You at ${combined.optimalUserAge}${spouse ? `, Spouse at ${combined.optimalSpouseAge}` : ''} | +${formatCurrency(combined.totalDifference)} lifetime`
                : 'Maximizing cumulative lifetime benefits (non-discounted) through age 93'
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCached && calculatedAt && (
              <span className="text-xs text-gray-500">
                Cached: {new Date(calculatedAt).toLocaleDateString()}
              </span>
            )}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                fetchOptimization(true); // Force refresh
              }}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
              title={isCached ? "Recalculate optimization" : "Refresh optimization"}
            >
              <RefreshCw className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent className="space-y-6">
              {/* Bridge Period Warning if applicable */}
              {optimizationData.bridgeAnalysis && !optimizationData.bridgeAnalysis.bridgeFeasible && (
                <div className="bg-red-900/20 border-2 border-red-600/50 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-300 mb-2">Bridge Period Alert</h4>
                      <p className="text-sm text-red-200 mb-2">
                        {optimizationData.bridgeAnalysis.recommendation}
                      </p>
                      {optimizationData.bridgeAnalysis.cashFlowShortfall > 0 && (
                        <p className="text-sm text-red-200">
                          Shortfall: {formatCurrency(optimizationData.bridgeAnalysis.cashFlowShortfall)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Success Probability Warning if applicable */}
              {optimizationData.successProbabilityImpact?.warning && (
                <div className="bg-amber-900/20 border-2 border-amber-600/50 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-300 mb-2">Success Rate Impact</h4>
                      <p className="text-sm text-amber-200">
                        {optimizationData.successProbabilityImpact.warning}
                      </p>
                    </div>
                  </div>
                </div>
              )}


              {/* Optimal Ages Display - Show recommended ages when constrained */}
              {!optimizationData.constrainedRecommendation ? (
                // Show standard optimal ages when no constraints
                <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 p-4 rounded-lg border-2 border-emerald-500/50">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-emerald-300 mb-3">
                      Optimal Social Security Claiming Ages
                    </h3>
                    <div className="flex justify-center items-center gap-8">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">You</p>
                        <p className="text-3xl font-bold text-white">Age {combined.optimalUserAge}</p>
                      </div>
                      {spouse && (
                        <>
                          <div className="w-px h-12 bg-gray-600"></div>
                          <div>
                            <p className="text-sm text-gray-400 mb-1">Spouse</p>
                            <p className="text-3xl font-bold text-white">Age {combined.optimalSpouseAge}</p>
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-emerald-400 mt-3 font-medium">
                      +{formatCurrency(combined.totalDifference)} lifetime benefit
                    </p>
                  </div>
                </div>
              ) : (
                // Show comparison: Theoretical Max vs Recommended
                <div className="space-y-3">
                  {/* Recommended Claiming Ages (Primary Display) */}
                  <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 p-4 rounded-lg border-2 border-blue-500/50">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-blue-300 mb-3">
                        ✓ Recommended Claiming Ages
                      </h3>
                      <div className="flex justify-center items-center gap-8">
                        <div>
                          <p className="text-sm text-gray-400 mb-1">You</p>
                          <p className="text-3xl font-bold text-white">
                            Age {optimizationData.constrainedRecommendation.recommendedUserAge}
                          </p>
                        </div>
                        {optimizationData.constrainedRecommendation.recommendedSpouseAge > 0 && (
                          <>
                            <div className="w-px h-12 bg-gray-600"></div>
                            <div>
                              <p className="text-sm text-gray-400 mb-1">Spouse</p>
                              <p className="text-3xl font-bold text-white">
                                Age {optimizationData.constrainedRecommendation.recommendedSpouseAge}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-blue-400 mt-3">
                        Optimized for retirement success & portfolio sustainability
                      </p>
                    </div>
                  </div>

                  {/* Theoretical Maximum (Secondary, de-emphasized) */}
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 opacity-60">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-2">
                        Theoretical Maximum (Not Recommended)
                      </p>
                      <div className="flex justify-center items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-500">You: </span>
                          <span className="text-gray-400 line-through">Age {combined.optimalUserAge}</span>
                        </div>
                        {spouse && (
                          <div>
                            <span className="text-gray-500">Spouse: </span>
                            <span className="text-gray-400 line-through">Age {combined.optimalSpouseAge}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Would provide +{formatCurrency(combined.totalDifference)} but not feasible
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Card - Adjust based on recommendations */}
              <div className={`bg-gradient-to-r ${
                optimizationData.constrainedRecommendation 
                  ? 'from-blue-900/30 to-blue-800/30 border-blue-600/30' 
                  : 'from-emerald-900/30 to-green-900/30 border-emerald-600/30'
              } p-4 rounded-lg border`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    {optimizationData.constrainedRecommendation ? 'Recommended Strategy Impact' : 'Optimal Strategy Impact'}
                  </h3>
                  {!optimizationData.constrainedRecommendation && (
                    <span className="text-2xl font-bold text-emerald-400">
                      {formatPercentage(combined.percentageGain)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">
                      {optimizationData.constrainedRecommendation ? 'Recommended Ages' : 'Optimal Ages'}
                    </p>
                    <p className="text-xl font-semibold text-white">
                      {optimizationData.constrainedRecommendation ? (
                        `Age ${optimizationData.constrainedRecommendation.recommendedUserAge}${
                          optimizationData.constrainedRecommendation.recommendedSpouseAge > 0 
                            ? ` / ${optimizationData.constrainedRecommendation.recommendedSpouseAge}` 
                            : ''
                        }`
                      ) : (
                        formatCurrency(combined.totalCumulativeAtOptimal)
                      )}
                    </p>
                    {!optimizationData.constrainedRecommendation && (
                      <p className="text-xs text-gray-500 mt-1">
                        You: {combined.optimalUserAge}, {spouse ? `Spouse: ${combined.optimalSpouseAge}` : ''}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-400">Claim at Retirement</p>
                    <p className="text-xl font-semibold text-gray-300">
                      {optimizationData.constrainedRecommendation ? (
                        `Age ${profile.desiredRetirementAge || 65}${
                          spouse ? ` / ${profile.spouseDesiredRetirementAge || 65}` : ''
                        }`
                      ) : (
                        formatCurrency(combined.totalCumulativeAtRetirement)
                      )}
                    </p>
                    {!optimizationData.constrainedRecommendation && (
                      <p className="text-xs text-gray-500 mt-1">
                        You: {profile.desiredRetirementAge || 65}, {spouse ? `Spouse: ${profile.spouseDesiredRetirementAge || 65}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                {!optimizationData.constrainedRecommendation && (
                  <div className="mt-3 pt-3 border-t border-emerald-700/30">
                    <p className="text-sm font-medium text-emerald-300">
                      Additional Lifetime Income: {formatCurrency(combined.totalDifference)}
                    </p>
                  </div>
                )}
              </div>

              {/* Bridge Period & Success Probability Details */}
              {(optimizationData.bridgeAnalysis || optimizationData.successProbabilityImpact) && (
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    Portfolio Impact Analysis
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {optimizationData.bridgeAnalysis && (
                      <>
                        <div>
                          <p className="text-gray-500 text-xs">Bridge Period</p>
                          <p className="text-white font-medium">
                            {optimizationData.bridgeAnalysis.yearsOfBridge} years
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Bridge Cost</p>
                          <p className="text-white font-medium">
                            {formatCurrency(optimizationData.bridgeAnalysis.totalBridgeCost)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Portfolio Drawdown</p>
                          <p className={`font-medium ${
                            optimizationData.bridgeAnalysis.portfolioDrawdownPercent > 50 
                              ? 'text-red-400' 
                              : optimizationData.bridgeAnalysis.portfolioDrawdownPercent > 30 
                              ? 'text-amber-400' 
                              : 'text-white'
                          }`}>
                            {optimizationData.bridgeAnalysis.portfolioDrawdownPercent.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Bridge Feasible</p>
                          <p className={`font-medium ${
                            optimizationData.bridgeAnalysis.bridgeFeasible ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {optimizationData.bridgeAnalysis.bridgeFeasible ? 'Yes' : 'No'}
                          </p>
                        </div>
                      </>
                    )}
                    {optimizationData.successProbabilityImpact && (
                      <>
                        <div>
                          <p className="text-gray-500 text-xs">Success at Optimal</p>
                          <p className={`font-medium ${
                            optimizationData.successProbabilityImpact.successAtOptimalAge >= 0.80 
                              ? 'text-green-400' 
                              : optimizationData.successProbabilityImpact.successAtOptimalAge >= 0.60 
                              ? 'text-amber-400' 
                              : 'text-red-400'
                          }`}>
                            {(optimizationData.successProbabilityImpact.successAtOptimalAge * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Success at 62</p>
                          <p className="text-white font-medium">
                            {(optimizationData.successProbabilityImpact.successAt62 * 100).toFixed(0)}%
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Individual Analysis */}
              <div className="space-y-4">
                {/* User Card */}
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-white">Your Analysis</h4>
                    <span className={`px-2 py-1 text-sm rounded-full ${
                      optimizationData.constrainedRecommendation
                        ? 'bg-blue-900/30 text-blue-400'
                        : 'bg-emerald-900/30 text-emerald-400'
                    }`}>
                      {optimizationData.constrainedRecommendation
                        ? `Recommended: Age ${optimizationData.constrainedRecommendation.recommendedUserAge}`
                        : `Optimal: Age ${user.optimalAge}`
                      }
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">
                        {optimizationData.constrainedRecommendation ? 'Monthly at Recommended' : 'Monthly at Optimal'}
                      </p>
                      <p className="text-white font-medium">
                        {optimizationData.constrainedRecommendation
                          ? formatCurrency(user.monthlyAtRetirement)
                          : formatCurrency(user.monthlyAtOptimal)
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">
                        {optimizationData.constrainedRecommendation ? 'Lifetime at Recommended' : 'Lifetime at Optimal'}
                      </p>
                      <p className="text-white font-medium">
                        {optimizationData.constrainedRecommendation
                          ? formatCurrency(user.cumulativeAtRetirement)
                          : formatCurrency(user.cumulativeAtOptimal)
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">
                        {optimizationData.constrainedRecommendation ? 'vs. Age 62' : 'Gain vs Retirement'}
                      </p>
                      <p className={`font-medium ${
                        optimizationData.constrainedRecommendation ? 'text-blue-400' : 'text-emerald-400'
                      }`}>
                        {optimizationData.constrainedRecommendation
                          ? formatCurrency(user.cumulativeAtRetirement - (user.monthlyAtOptimal * 0.75 * 12 * 31)) // Rough estimate vs age 62
                          : formatCurrency(user.difference)
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Spouse Card */}
                {spouse && (
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-white">Spouse Analysis</h4>
                      <span className={`px-2 py-1 text-sm rounded-full ${
                        optimizationData.constrainedRecommendation
                          ? 'bg-blue-900/30 text-blue-400'
                          : 'bg-emerald-900/30 text-emerald-400'
                      }`}>
                        {optimizationData.constrainedRecommendation && optimizationData.constrainedRecommendation.recommendedSpouseAge > 0
                          ? `Recommended: Age ${optimizationData.constrainedRecommendation.recommendedSpouseAge}`
                          : `Optimal: Age ${spouse.optimalAge}`
                        }
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">
                          {optimizationData.constrainedRecommendation ? 'Monthly at Recommended' : 'Monthly at Optimal'}
                        </p>
                        <p className="text-white font-medium">
                          {optimizationData.constrainedRecommendation
                            ? formatCurrency(spouse.monthlyAtRetirement)
                            : formatCurrency(spouse.monthlyAtOptimal)
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">
                          {optimizationData.constrainedRecommendation ? 'Lifetime at Recommended' : 'Lifetime at Optimal'}
                        </p>
                        <p className="text-white font-medium">
                          {optimizationData.constrainedRecommendation
                            ? formatCurrency(spouse.cumulativeAtRetirement)
                            : formatCurrency(spouse.cumulativeAtOptimal)
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">
                          {optimizationData.constrainedRecommendation ? 'vs. Age 62' : 'Gain vs Retirement'}
                        </p>
                        <p className={`font-medium ${
                          optimizationData.constrainedRecommendation ? 'text-blue-400' : 'text-emerald-400'
                        }`}>
                          {optimizationData.constrainedRecommendation
                            ? formatCurrency(spouse.cumulativeAtRetirement - (spouse.monthlyAtOptimal * 0.75 * 12 * 31))
                            : formatCurrency(spouse.difference)
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>


              {/* Info Note */}
              <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300 space-y-1">
                  <p>
                    <strong>Analysis Method:</strong> This optimizer calculates total cumulative (non-discounted) 
                    Social Security income from claiming age through age 93, including 2.5% annual COLA adjustments.
                  </p>
                  <p>
                    The optimal ages shown maximize total lifetime benefits without considering time value of money, 
                    providing a simpler view of the raw dollar advantage of delaying benefits.
                  </p>
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}