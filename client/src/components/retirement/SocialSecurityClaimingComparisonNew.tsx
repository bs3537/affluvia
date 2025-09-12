import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, TrendingUp, ChevronUp, ChevronDown, RefreshCw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

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
    userMonthly: number;
    spouseMonthly: number;
    combinedMonthly: number;
    userCumulative: number;
    spouseCumulative: number;
    combinedCumulative: number;
    yearsReceiving: number;
  }>;
}

interface ClaimingScenario {
  label: string;
  age: string;
  cumulative: number;
  monthly: number;
  description: string;
  isOptimal?: boolean;
  color: string;
}

interface Props {
  profile: any;
  isLocked?: boolean;
  variables?: any;
}

export function SocialSecurityClaimingComparisonNew({ profile, isLocked = false, variables }: Props) {
  const [optimizationData, setOptimizationData] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(isLocked);
  const { toast } = useToast();

  const fetchOptimization = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/calculate-cumulative-ss-optimization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setOptimizationData(data);
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

  useEffect(() => {
    if (isLocked) {
      setIsCollapsed(true);
    }
  }, [isLocked]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompactCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  const getClaimingScenarios = (): ClaimingScenario[] => {
    if (!optimizationData || !optimizationData.ageAnalysis) return [];

    const scenarios: ClaimingScenario[] = [];
    const { ageAnalysis, combined } = optimizationData;
    
    // Determine marital status
    const isMarried = profile.maritalStatus === 'married' || profile.maritalStatus === 'partnered';
    
    // Get baseline retirement ages for comparison from optimized plan first (Optimization tab),
    // then fall back to saved optimizationVariables, then intake form values
    const baselineUserRetirementAge = (
      variables?.retirementAge ??
      profile?.optimizationVariables?.retirementAge ??
      profile.desiredRetirementAge ?? 65
    );
    const baselineSpouseRetirementAge = isMarried ? (
      variables?.spouseRetirementAge ??
      profile?.optimizationVariables?.spouseRetirementAge ??
      profile.spouseDesiredRetirementAge ?? 65
    ) : baselineUserRetirementAge;
    
    // Get optimized retirement ages from variables (if available)
    const optimizedUserRetirementAge = variables?.retirementAge;
    const optimizedSpouseRetirementAge = variables?.spouseRetirementAge;
    const earliestRetirementAge = Math.min(baselineUserRetirementAge, baselineSpouseRetirementAge);

    // Helper function to find scenario by age
    const findScenario = (targetUserAge: number, targetSpouseAge?: number) => {
      if (isMarried) {
        // For married couples, find where both claim at same age for simplicity
        return ageAnalysis.find(s => 
          s.userAge === targetUserAge && 
          (targetSpouseAge ? s.spouseAge === targetSpouseAge : s.spouseAge === targetUserAge)
        );
      } else {
        // For single person, just match user age
        return ageAnalysis.find(s => s.userAge === targetUserAge);
      }
    };

    // 1. Age 62 (Earliest claiming)
    const age62Scenario = findScenario(62, isMarried ? 62 : undefined);
    if (age62Scenario) {
      scenarios.push({
        label: 'Earliest Age (62)',
        age: '62',
        cumulative: age62Scenario.combinedCumulative || age62Scenario.userCumulative,
        monthly: age62Scenario.combinedMonthly || age62Scenario.userMonthly,
        description: 'Claiming at earliest eligible age',
        color: '#EF4444', // red
      });
    }

    // 2. Baseline Strategy (from intake form)
    // Determine who retires first for the label
    const firstRetiringAge = Math.min(baselineUserRetirementAge, baselineSpouseRetirementAge);
    
    // For married couples with different retirement ages, find the scenario where each claims at their own retirement age
    if (isMarried && baselineUserRetirementAge !== baselineSpouseRetirementAge) {
      // Find scenario where each spouse claims at their respective retirement age
      const retirementScenario = ageAnalysis.find(s => 
        s.userAge === baselineUserRetirementAge && s.spouseAge === baselineSpouseRetirementAge
      );
      if (retirementScenario) {
        scenarios.push({
          label: `Baseline Strategy (${firstRetiringAge})`,
          age: `${baselineUserRetirementAge}/${baselineSpouseRetirementAge}`,
          cumulative: retirementScenario.combinedCumulative,
          monthly: retirementScenario.combinedMonthly,
          description: 'Claiming at retirement ages',
          color: '#F59E0B', // amber
        });
      }
    } else {
      // Single or same retirement age for both spouses
      const earliestBaselineRetirement = Math.min(baselineUserRetirementAge, baselineSpouseRetirementAge);
      if (earliestBaselineRetirement !== 62 && earliestBaselineRetirement !== 67 && earliestBaselineRetirement !== 70) {
        const retirementScenario = findScenario(earliestBaselineRetirement, isMarried ? earliestBaselineRetirement : undefined);
        if (retirementScenario) {
          scenarios.push({
            label: `Baseline Strategy (${earliestBaselineRetirement})`,
            age: earliestBaselineRetirement.toString(),
            cumulative: retirementScenario.combinedCumulative || retirementScenario.userCumulative,
            monthly: retirementScenario.combinedMonthly || retirementScenario.userMonthly,
            description: 'Claiming at retirement age',
            color: '#F59E0B', // amber
          });
        }
      }
    }

    // 3. Age 67 (Full Retirement Age)
    const age67Scenario = findScenario(67, isMarried ? 67 : undefined);
    if (age67Scenario) {
      scenarios.push({
        label: 'Full Retirement Age (67)',
        age: '67',
        cumulative: age67Scenario.combinedCumulative || age67Scenario.userCumulative,
        monthly: age67Scenario.combinedMonthly || age67Scenario.userMonthly,
        description: 'No reduction or credits',
        color: '#3B82F6', // blue
      });
    }

    // 4. Optimal Age - Removed from optimized plan tab
    // (The Optimal Age bar is not shown in the optimized plan tab)

    // 5. Age 70 (Max claiming) — always include (important reference)
    {
      const age70Scenario = findScenario(70, isMarried ? 70 : undefined);
      if (age70Scenario) {
        // Avoid duplicate if a bar with same label already exists
        const exists = scenarios.some(s => s.label === 'Maximum Age (70)');
        if (!exists) {
          scenarios.push({
            label: 'Maximum Age (70)',
            age: isMarried ? '70/70' : '70',
            cumulative: age70Scenario.combinedCumulative || age70Scenario.userCumulative,
            monthly: age70Scenario.combinedMonthly || age70Scenario.userMonthly,
            description: 'Maximum delayed credits',
            color: '#8B5CF6', // purple
          });
        }
      }
    }

    // 6. Optimized Strategy (using optimization form variables)
    if (variables && (variables.socialSecurityAge || variables.spouseSocialSecurityAge)) {
      const optimizedUserAge = variables.socialSecurityAge || combined.optimalUserAge;
      const optimizedSpouseAge = variables.spouseSocialSecurityAge || combined.optimalSpouseAge;
      
      // Find the scenario that matches optimized ages
      const optimizedScenario = findScenario(optimizedUserAge, isMarried ? optimizedSpouseAge : undefined);
      
      if (optimizedScenario) {
        const optimizedLabel = isMarried && optimizedSpouseAge !== optimizedUserAge
          ? `✨ Optimized Strategy (${optimizedUserAge}/${optimizedSpouseAge})`
          : `✨ Optimized Strategy (${optimizedUserAge})`;
        
        // Check if this is already in the list (as optimal)
        const isDuplicate = scenarios.some(s => 
          s.label.includes('Optimal') && 
          ((isMarried && s.age === `${optimizedUserAge}/${optimizedSpouseAge}`) ||
           (!isMarried && s.age === optimizedUserAge.toString()))
        );
        
        if (!isDuplicate) {
          scenarios.push({
            label: optimizedLabel,
            age: isMarried && optimizedSpouseAge !== optimizedUserAge
              ? `${optimizedUserAge}/${optimizedSpouseAge}`
              : optimizedUserAge.toString(),
            cumulative: optimizedScenario.combinedCumulative || optimizedScenario.userCumulative,
            monthly: optimizedScenario.combinedMonthly || optimizedScenario.userMonthly,
            description: 'Optimized with all variables',
            isOptimal: true,
            color: '#A855F7', // purple-500 for optimized
          });
        }
      }
    }

    // Sort by cumulative benefits (highest first)
    return scenarios.sort((a, b) => b.cumulative - a.cumulative);
  };

  const scenarios = getClaimingScenarios();
  const maxCumulative = scenarios.length > 0 ? scenarios[0].cumulative : 0;

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <BarChart className="w-5 h-5 text-blue-400" />
            Social Security Claiming Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            <span className="ml-2 text-gray-300">Loading comparison...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!optimizationData || scenarios.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <BarChart className="w-5 h-5 text-blue-400" />
            Social Security Claiming Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <p>No optimization data available. Please ensure your profile is complete.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
      <CardHeader 
        className="pb-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <BarChart className="w-5 h-5 text-blue-400" />
              Social Security Claiming Strategies Comparison
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              {isCollapsed 
                ? `Best strategy: ${scenarios[0]?.label || 'N/A'} - ${formatCurrency(scenarios[0]?.cumulative || 0)} lifetime`
                : 'Cumulative lifetime benefits (undiscounted) from claim age to 93 for key claiming strategies'
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                fetchOptimization();
              }}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
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
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Info Alert */}
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-blue-300">
                        Shows cumulative Social Security benefits from claim age to age 93, including 2.5% annual COLA adjustments.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Summary Stats - Moved above the chart */}
                {scenarios.length > 1 && (
                  <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Best Strategy</p>
                        <p className="text-lg font-bold text-green-400">
                          {scenarios[0].label}
                        </p>
                        <p className="text-xs text-gray-500">{formatCurrency(scenarios[0].cumulative)} lifetime</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">vs. Baseline Strategy</p>
                        {(() => {
                          // Find the baseline strategy scenario
                          const userRetirementAge = profile.desiredRetirementAge || 65;
                          const spouseRetirementAge = profile.spouseDesiredRetirementAge || 65;
                          const isMarried = profile.maritalStatus === 'married' || profile.maritalStatus === 'partnered';
                          
                          // Look for baseline strategy in the list
                          let baselineScenario = scenarios.find(s => 
                            s.label.includes('Baseline Strategy')
                          );
                          
                          const difference = baselineScenario ? scenarios[0].cumulative - baselineScenario.cumulative : 0;
                          const percentIncrease = baselineScenario && baselineScenario.cumulative > 0 ? (difference / baselineScenario.cumulative * 100) : 0;
                          
                          return (
                            <>
                              <p className="text-lg font-bold text-yellow-400">
                                {difference > 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                              </p>
                              <p className="text-xs text-gray-500">
                                {difference !== 0 ? `${difference > 0 ? '+' : ''}${Math.abs(percentIncrease).toFixed(1)}% ${difference > 0 ? 'more' : 'less'} income` : 'Same as optimal'}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Horizontal Bar Chart */}
                <div className="space-y-3 mt-4">
                  {scenarios.map((scenario, index) => {
                    const percentage = (scenario.cumulative / maxCumulative) * 100;
                    
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${scenario.isOptimal ? 'text-green-400' : 'text-gray-300'}`}>
                              {scenario.label}
                              {scenario.isOptimal && ' ⭐'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {scenario.description}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${scenario.isOptimal ? 'text-green-400' : 'text-white'}`}>
                              {formatCurrency(scenario.cumulative)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatCompactCurrency(scenario.monthly)}/mo
                            </p>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-700 rounded-full h-8 overflow-hidden relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, delay: index * 0.1 }}
                            className="h-full rounded-full flex items-center justify-end pr-2"
                            style={{ 
                              backgroundColor: scenario.color,
                              boxShadow: scenario.isOptimal ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
                            }}
                          >
                            <span className="text-xs text-white font-medium">
                              {percentage.toFixed(0)}%
                            </span>
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
