import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Area } from 'recharts';
import { AlertCircle, ChevronUp, ChevronDown, TrendingUp, DollarSign, Info, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  profile: any;
}

interface CumulativeData {
  age: number;
  retirementStrategy: number;
  optimalStrategy: number;
  difference: number;
}

export function CumulativeSocialSecurityComparison({ profile }: Props) {
  const [cumulativeData, setCumulativeData] = useState<CumulativeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [breakevenAge, setBreakevenAge] = useState<number | null>(null);

  useEffect(() => {
    if (profile) {
      fetchOptimizationAndCalculateComparison();
    }
  }, [profile]);

  const fetchOptimizationAndCalculateComparison = async () => {
    setIsLoading(true);
    try {
      // Fetch optimization data to get optimal ages
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
        
        // Calculate cumulative comparison
        const comparison = calculateCumulativeComparison(data, profile);
        setCumulativeData(comparison);
        
        // Find breakeven age
        const breakeven = findBreakevenAge(comparison);
        setBreakevenAge(breakeven);
      }
    } catch (error) {
      console.error('Error calculating comparison:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCumulativeComparison = (optData: any, profile: any): CumulativeData[] => {
    const data: CumulativeData[] = [];
    const longevityAge = 93;
    const colaRate = 0.025; // 2.5% annual COLA
    
    // Get claiming ages
    const userRetirementAge = profile.desiredRetirementAge || 65;
    const spouseRetirementAge = profile.spouseDesiredRetirementAge || 65;
    const earliestRetirementAge = Math.min(userRetirementAge, spouseRetirementAge);
    
    const userOptimalAge = optData.combined.optimalUserAge;
    const spouseOptimalAge = optData.combined.optimalSpouseAge;
    
    // Get monthly benefits
    const userMonthlyAtRetirement = optData.user.monthlyAtRetirement;
    const spouseMonthlyAtRetirement = optData.spouse?.monthlyAtRetirement || 0;
    const userMonthlyAtOptimal = optData.user.monthlyAtOptimal;
    const spouseMonthlyAtOptimal = optData.spouse?.monthlyAtOptimal || 0;
    
    let cumulativeRetirement = 0;
    let cumulativeOptimal = 0;
    
    // Start from age 62 for visualization
    for (let age = 62; age <= longevityAge; age++) {
      // Calculate retirement strategy benefits
      const userYearsReceiving = Math.max(0, age - userRetirementAge);
      const spouseYearsReceiving = Math.max(0, age - spouseRetirementAge);
      
      if (age >= userRetirementAge) {
        const userAnnual = userMonthlyAtRetirement * 12 * Math.pow(1 + colaRate, userYearsReceiving);
        cumulativeRetirement += userAnnual;
      }
      
      if (age >= spouseRetirementAge && spouseMonthlyAtRetirement > 0) {
        const spouseAnnual = spouseMonthlyAtRetirement * 12 * Math.pow(1 + colaRate, spouseYearsReceiving);
        cumulativeRetirement += spouseAnnual;
      }
      
      // Calculate optimal strategy benefits
      const userOptimalYears = Math.max(0, age - userOptimalAge);
      const spouseOptimalYears = Math.max(0, age - spouseOptimalAge);
      
      if (age >= userOptimalAge) {
        const userAnnual = userMonthlyAtOptimal * 12 * Math.pow(1 + colaRate, userOptimalYears);
        cumulativeOptimal += userAnnual;
      }
      
      if (age >= spouseOptimalAge && spouseMonthlyAtOptimal > 0) {
        const spouseAnnual = spouseMonthlyAtOptimal * 12 * Math.pow(1 + colaRate, spouseOptimalYears);
        cumulativeOptimal += spouseAnnual;
      }
      
      data.push({
        age,
        retirementStrategy: Math.round(cumulativeRetirement),
        optimalStrategy: Math.round(cumulativeOptimal),
        difference: Math.round(cumulativeOptimal - cumulativeRetirement)
      });
    }
    
    return data;
  };

  const findBreakevenAge = (data: CumulativeData[]): number | null => {
    for (let i = 0; i < data.length; i++) {
      if (data[i].optimalStrategy > data[i].retirementStrategy) {
        return data[i].age;
      }
    }
    return null;
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
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">Age {label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-400">
              Retirement Strategy: {formatCurrency(data.retirementStrategy)}
            </p>
            <p className="text-emerald-400">
              Optimal Strategy: {formatCurrency(data.optimalStrategy)}
            </p>
            {data.difference !== 0 && (
              <p className={`font-medium pt-1 border-t border-gray-700 ${data.difference > 0 ? 'text-green-400' : 'text-red-400'}`}>
                Difference: {data.difference > 0 ? '+' : ''}{formatCurrency(Math.abs(data.difference))}
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading || !cumulativeData.length) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-6 h-6 mx-auto text-amber-400" />
          <p className="text-gray-400 mt-2">Loading cumulative benefit comparison...</p>
        </CardContent>
      </Card>
    );
  }

  // Get final values
  const finalData = cumulativeData[cumulativeData.length - 1];
  const finalDifference = finalData.optimalStrategy - finalData.retirementStrategy;
  const percentageGain = finalData.retirementStrategy > 0 
    ? (finalDifference / finalData.retirementStrategy) * 100 
    : 0;

  // Get claiming ages
  const userRetirementAge = profile.desiredRetirementAge || 65;
  const spouseRetirementAge = profile.spouseDesiredRetirementAge || 65;
  const earliestRetirementAge = Math.min(userRetirementAge, spouseRetirementAge);
  const userOptimalAge = optimizationData?.combined.optimalUserAge;
  const spouseOptimalAge = optimizationData?.combined.optimalSpouseAge;

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
      
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
                  cumulativeSSComparisonCollapsed: newState
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
              <Calculator className="w-5 h-5 text-emerald-400" />
              Cumulative Benefit Comparison
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              {isCollapsed 
                ? `Optimal strategy provides +${formatCurrency(finalDifference)} (+${percentageGain.toFixed(1)}%) lifetime benefit`
                : userRetirementAge !== spouseRetirementAge && profile.maritalStatus === 'married'
                  ? `Comparing total benefits: Each spouse claiming at retirement (Ages ${userRetirementAge}/${spouseRetirementAge}) vs. Optimal claiming (Ages ${userOptimalAge}/${spouseOptimalAge})`
                  : `Comparing total benefits: Claiming at Retirement (Age ${earliestRetirementAge}) vs. Optimal claiming (Age ${userOptimalAge})`
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
              {/* Key Metrics - Only Breakeven Age */}
              <div className="flex justify-center">
                <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-700/30 max-w-sm w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="w-4 h-4 text-purple-400" />
                    <p className="text-sm text-gray-400">Breakeven Age</p>
                  </div>
                  <p className="text-2xl font-bold text-purple-400">
                    {breakevenAge ? `Age ${breakevenAge}` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {breakevenAge ? 'When optimal strategy surpasses' : 'Early claiming wins'}
                  </p>
                </div>
              </div>

              {/* Line Chart */}
              <div className="bg-gray-800/30 p-4 rounded-lg">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart 
                    data={cumulativeData} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="age" 
                      stroke="#9CA3AF"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      label={{ value: 'Age', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
                      domain={[62, 93]}
                      ticks={[62, 65, 70, 75, 80, 85, 90, 93]}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      label={{ value: 'Cumulative Benefits ($)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                      tickFormatter={(value) => formatCompactCurrency(value)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="line"
                      formatter={(value) => {
                        if (value === 'retirementStrategy') return `Claiming at Retirement (Age ${earliestRetirementAge})`;
                        if (value === 'optimalStrategy') return `Optimal Claiming (Age ${userOptimalAge})`;
                        return value;
                      }}
                    />
                    
                    {/* Reference lines for claiming ages */}
                    <ReferenceLine 
                      x={earliestRetirementAge} 
                      stroke="#60A5FA" 
                      strokeDasharray="5 5"
                      label={{ value: `Retirement Age ${earliestRetirementAge}`, position: 'top', fill: '#60A5FA', fontSize: 11 }}
                    />
                    <ReferenceLine 
                      x={userOptimalAge} 
                      stroke="#10B981" 
                      strokeDasharray="5 5"
                      label={{ value: `Optimal Age ${userOptimalAge}`, position: 'top', fill: '#10B981', fontSize: 11 }}
                    />
                    {breakevenAge && (
                      <ReferenceLine 
                        x={breakevenAge} 
                        stroke="#A78BFA" 
                        strokeDasharray="5 5"
                        label={{ value: `Breakeven Age ${breakevenAge}`, position: 'top', fill: '#A78BFA', fontSize: 11 }}
                      />
                    )}
                    
                    <Line 
                      type="monotone" 
                      dataKey="retirementStrategy" 
                      stroke="#60A5FA" 
                      strokeWidth={2}
                      dot={false}
                      name="retirementStrategy"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="optimalStrategy" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      dot={false}
                      name="optimalStrategy"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300">
                  <p>
                    This chart compares cumulative (non-discounted) Social Security benefits through age 93. 
                    The retirement strategy uses your planned retirement ages from the intake form{profile.maritalStatus === 'married' && userRetirementAge !== spouseRetirementAge ? ' (each spouse claims at their individual retirement age)' : ''}, 
                    while the optimal strategy uses ages calculated to maximize lifetime benefits.
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

function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}