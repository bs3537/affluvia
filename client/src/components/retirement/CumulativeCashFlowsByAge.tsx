import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ChevronUp, ChevronDown, TrendingUp, DollarSign, Info, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// We'll calculate benefits inline since the function is on the server

interface Props {
  profile: any;
}

interface ClaimingStrategy {
  age: number;
  label: string;
  monthlyBenefit: number;
  cumulativeBenefit: number;
  color: string;
  percentage: number;
}

export function CumulativeCashFlowsByAge({ profile }: Props) {
  const [strategies, setStrategies] = useState<ClaimingStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [optimizationData, setOptimizationData] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      calculateStrategies();
    }
  }, [profile]);

  const calculateStrategies = async () => {
    setIsLoading(true);
    try {
      // Fetch optimization data to get optimal age
      const response = await fetch('/api/calculate-cumulative-ss-optimization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const optData = await response.json();
        setOptimizationData(optData);
        
        // Calculate strategies
        const calculatedStrategies = calculateAllStrategies(optData, profile);
        setStrategies(calculatedStrategies);
      }
    } catch (error) {
      console.error('Error calculating strategies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAllStrategies = (optData: any, profile: any): ClaimingStrategy[] => {
    const strategies: ClaimingStrategy[] = [];
    const longevityAge = 93;
    const colaRate = 0.025; // 2.5% annual COLA
    
    // Get key ages
    const userRetirementAge = profile.desiredRetirementAge || 65;
    const spouseRetirementAge = profile.spouseDesiredRetirementAge || 65;
    const earliestRetirementAge = Math.min(userRetirementAge, spouseRetirementAge);
    const userOptimalAge = optData.combined.optimalUserAge;
    const spouseOptimalAge = optData.combined.optimalSpouseAge;
    const FRA = 67; // Full Retirement Age
    
    // Build a map to quickly find data for each claiming age
    // For simplicity, we'll assume both spouses claim at the same age
    const isMarried = profile.maritalStatus === 'married' || profile.maritalStatus === 'partnered';
    
    // Create a function to find the best match in ageAnalysis for a given claiming age
    const findDataForAge = (claimAge: number) => {
      if (!optData.ageAnalysis || optData.ageAnalysis.length === 0) return null;
      
      // First try to find exact match where both claim at same age
      let match = optData.ageAnalysis.find((item: any) => {
        if (isMarried) {
          return item.userAge === claimAge && item.spouseAge === claimAge;
        } else {
          return item.userAge === claimAge;
        }
      });
      
      // If no exact match for married couple, find where at least user claims at this age
      if (!match && isMarried) {
        match = optData.ageAnalysis.find((item: any) => item.userAge === claimAge);
      }
      
      return match;
    };
    
    // Define claiming ages to evaluate
    const claimingAges = [
      { age: 62, label: "Earliest Age (62)" },
      { age: earliestRetirementAge, label: `Retirement Age (${earliestRetirementAge})` },
      { age: FRA, label: `Full Retirement Age (${FRA})` },
      { age: userOptimalAge, label: `Optimal Age (${userOptimalAge})` }
    ];
    
    // Add age 70 if optimal age is different
    if (userOptimalAge !== 70) {
      claimingAges.push({ age: 70, label: "Maximum Age (70)" });
    }
    
    // Remove duplicates
    const uniqueAges = Array.from(new Set(claimingAges.map(a => a.age)))
      .map(age => claimingAges.find(a => a.age === age)!)
      .sort((a, b) => a.age - b.age);
    
    // Calculate cumulative benefits for each claiming age
    let maxCumulative = 0;
    
    for (const claimingAge of uniqueAges) {
      let combinedMonthlyBenefit = 0;
      let cumulativeBenefit = 0;
      
      // Try to find data for this claiming age
      const ageData = findDataForAge(claimingAge.age);
      
      if (ageData) {
        // Use the pre-calculated values from the optimization data
        combinedMonthlyBenefit = ageData.combinedMonthly || 0;
        
        // Use the cumulative from the data
        cumulativeBenefit = ageData.combinedCumulative || 0;
        
        // If no combined values, calculate from individual values
        if (!combinedMonthlyBenefit && (ageData.userMonthly || ageData.spouseMonthly)) {
          combinedMonthlyBenefit = (ageData.userMonthly || 0) + (ageData.spouseMonthly || 0);
        }
        
        if (!cumulativeBenefit && (ageData.userCumulative || ageData.spouseCumulative)) {
          cumulativeBenefit = (ageData.userCumulative || 0) + (ageData.spouseCumulative || 0);
        }
        
        // If still no cumulative, calculate it
        if (!cumulativeBenefit && combinedMonthlyBenefit > 0) {
          for (let year = 0; year < (longevityAge - claimingAge.age); year++) {
            const adjustedAnnualBenefit = combinedMonthlyBenefit * 12 * Math.pow(1 + colaRate, year);
            cumulativeBenefit += adjustedAnnualBenefit;
          }
        }
      } else {
        // Fallback: Use specific data from optimization results
        if (claimingAge.age === userRetirementAge) {
          combinedMonthlyBenefit = optData.user.monthlyAtRetirement + (optData.spouse?.monthlyAtRetirement || 0);
          cumulativeBenefit = optData.user.cumulativeAtRetirement + (optData.spouse?.cumulativeAtRetirement || 0);
        } else if (claimingAge.age === userOptimalAge) {
          combinedMonthlyBenefit = optData.user.monthlyAtOptimal + (optData.spouse?.monthlyAtOptimal || 0);
          cumulativeBenefit = optData.user.cumulativeAtOptimal + (optData.spouse?.cumulativeAtOptimal || 0);
        }
      }
      
      strategies.push({
        age: claimingAge.age,
        label: claimingAge.label,
        monthlyBenefit: Math.round(combinedMonthlyBenefit),
        cumulativeBenefit: Math.round(cumulativeBenefit),
        color: getColorForAge(claimingAge.age, userOptimalAge),
        percentage: 0 // Will be calculated after
      });
      
      maxCumulative = Math.max(maxCumulative, cumulativeBenefit);
    }
    
    // Calculate percentages relative to maximum
    strategies.forEach(strategy => {
      strategy.percentage = (strategy.cumulativeBenefit / maxCumulative) * 100;
    });
    
    // Sort by cumulative benefit (highest first)
    strategies.sort((a, b) => b.cumulativeBenefit - a.cumulativeBenefit);
    
    return strategies;
  };

  const getColorForAge = (age: number, optimalAge: number): string => {
    if (age === optimalAge) return 'bg-emerald-500'; // Optimal age
    if (age === 62) return 'bg-blue-500'; // Earliest age
    if (age === 67) return 'bg-purple-500'; // FRA
    if (age === 70) return 'bg-amber-500'; // Maximum age
    return 'bg-gray-500'; // Retirement age or other
  };

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

  if (isLoading || !strategies.length) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-6 h-6 mx-auto text-amber-400" />
          <p className="text-gray-400 mt-2">Loading claiming strategies comparison...</p>
        </CardContent>
      </Card>
    );
  }

  // Get the highest and lowest values
  const highestStrategy = strategies[0];
  const lowestStrategy = strategies[strategies.length - 1];
  const difference = highestStrategy.cumulativeBenefit - lowestStrategy.cumulativeBenefit;
  const percentageGain = (difference / lowestStrategy.cumulativeBenefit) * 100;

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-amber-500"></div>
      
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
                  cumulativeCashFlowsByAgeCollapsed: newState
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
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Lifetime Income Comparison - Baseline (Sorted by Total)
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              {isCollapsed 
                ? `Best strategy: ${highestStrategy.label} with ${formatCurrency(highestStrategy.cumulativeBenefit)} lifetime income`
                : `Comparing cumulative lifetime benefits for different claiming ages (undiscounted)`
              }
            </p>
          </div>
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          )}
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
              {/* Info Note */}
              <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300">
                  Optimal claiming ages are determined by maximizing Net Present Value (NPV) of lifetime benefits to age 93, 
                  accounting for inflation (2.5%) and time value of money (3% discount rate).
                </div>
              </div>

              {/* Horizontal Bar Chart */}
              <div className="space-y-3">
                {strategies.map((strategy, index) => (
                  <div key={strategy.age} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300 font-medium min-w-[180px]">
                        {strategy.label}
                      </span>
                      <span className="text-gray-400 text-xs">
                        Total: {formatCompactCurrency(strategy.cumulativeBenefit)}
                      </span>
                    </div>
                    <div className="relative">
                      <div className="bg-gray-800 rounded-full h-10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${strategy.percentage}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className={`h-full ${strategy.color} rounded-full flex items-center justify-end pr-3`}
                        >
                          <span className="text-white text-sm font-bold">
                            {formatCurrency(strategy.cumulativeBenefit)}
                          </span>
                        </motion.div>
                      </div>
                      {/* Show monthly benefit on the right */}
                      <div className="absolute right-0 top-0 h-full flex items-center">
                        <span className="text-xs text-gray-500 ml-2">
                          ({formatCompactCurrency(strategy.monthlyBenefit)}/mo)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <p className="text-sm text-gray-400">Highest NPV Strategy</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-400">
                    {formatCurrency(highestStrategy.cumulativeBenefit)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {highestStrategy.label}
                  </p>
                </div>
                
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <p className="text-sm text-gray-400">Potential Gain</p>
                  </div>
                  <p className="text-xl font-bold text-amber-400">
                    +{formatCurrency(difference)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    +{percentageGain.toFixed(1)}% vs earliest claiming
                  </p>
                </div>
              </div>

              {/* Bottom Summary */}
              <div className="bg-gradient-to-r from-emerald-900/30 to-green-900/30 p-4 rounded-lg border border-emerald-600/30">
                <p className="text-sm text-emerald-300">
                  <strong>Recommendation:</strong> Claiming at {highestStrategy.label.toLowerCase()} provides the highest 
                  cumulative lifetime income of {formatCurrency(highestStrategy.cumulativeBenefit)}, which is {formatCurrency(difference)} more 
                  than claiming at {lowestStrategy.label.toLowerCase()}.
                </p>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}