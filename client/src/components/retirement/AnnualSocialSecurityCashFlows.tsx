import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { AlertCircle, ChevronUp, ChevronDown, DollarSign, TrendingUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  profile: any;
  isLocked?: boolean;
}

interface AnnualCashFlow {
  age: number;
  year: number;
  userBenefit: number;
  spouseBenefit: number;
  combinedBenefit: number;
  cumulativeTotal: number;
  // Retirement strategy fields
  retirementUserBenefit: number;
  retirementSpouseBenefit: number;
  retirementCombinedBenefit: number;
  retirementCumulativeTotal: number;
}

export function AnnualSocialSecurityCashFlows({ profile, isLocked = false }: Props) {
  const [cashFlows, setCashFlows] = useState<AnnualCashFlow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Check for persisted collapse state from UI preferences
  const shouldAutoCollapse = profile?.retirementPlanningUIPreferences?.annualSSCashFlowsCollapsed;
  // Default to open (false) unless user has explicitly collapsed it
  const [isCollapsed, setIsCollapsed] = useState(shouldAutoCollapse !== undefined ? shouldAutoCollapse : false);
  const [optimizationData, setOptimizationData] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      fetchOptimizationAndCalculateFlows();
    }
  }, [profile]);


  const fetchOptimizationAndCalculateFlows = async () => {
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
        
        // Calculate annual cash flows based on optimal ages
        const flows = calculateAnnualFlows(data, profile);
        setCashFlows(flows);
      }
    } catch (error) {
      console.error('Error calculating cash flows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAnnualFlows = (optData: any, profile: any): AnnualCashFlow[] => {
    const flows: AnnualCashFlow[] = [];
    const longevityAge = 93;
    const colaRate = 0.025; // 2.5% annual COLA
    
    // Get optimal claiming ages
    const userOptimalAge = optData.combined.optimalUserAge;
    const spouseOptimalAge = optData.combined.optimalSpouseAge;
    
    // Get retirement claiming ages from profile
    const userRetirementAge = profile.desiredRetirementAge || 65;
    const spouseRetirementAge = profile.spouseDesiredRetirementAge || 65;
    
    // Get initial monthly benefits
    const userMonthlyAtOptimal = optData.user.monthlyAtOptimal;
    const spouseMonthlyAtOptimal = optData.spouse?.monthlyAtOptimal || 0;
    const userMonthlyAtRetirement = optData.user.monthlyAtRetirement;
    const spouseMonthlyAtRetirement = optData.spouse?.monthlyAtRetirement || 0;
    
    // Calculate current year
    const currentYear = new Date().getFullYear();
    const userCurrentAge = profile.dateOfBirth ? 
      Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 51;
    
    let cumulativeOptimal = 0;
    let cumulativeRetirement = 0;
    
    // Start from the earliest of all claiming ages
    const startAge = Math.min(
      userOptimalAge, 
      spouseOptimalAge || userOptimalAge,
      userRetirementAge,
      spouseRetirementAge || userRetirementAge
    );
    
    for (let age = startAge; age <= longevityAge; age++) {
      // Optimal strategy calculations
      const yearsSinceUserOptimal = Math.max(0, age - userOptimalAge);
      const yearsSinceSpouseOptimal = spouseOptimalAge ? Math.max(0, age - spouseOptimalAge) : 0;
      
      const userOptimalAnnual = age >= userOptimalAge ? 
        userMonthlyAtOptimal * 12 * Math.pow(1 + colaRate, yearsSinceUserOptimal) : 0;
      
      const spouseOptimalAnnual = spouseOptimalAge && age >= spouseOptimalAge ? 
        spouseMonthlyAtOptimal * 12 * Math.pow(1 + colaRate, yearsSinceSpouseOptimal) : 0;
      
      const combinedOptimalAnnual = userOptimalAnnual + spouseOptimalAnnual;
      cumulativeOptimal += combinedOptimalAnnual;
      
      // Retirement strategy calculations
      const yearsSinceUserRetirement = Math.max(0, age - userRetirementAge);
      const yearsSinceSpouseRetirement = spouseRetirementAge ? Math.max(0, age - spouseRetirementAge) : 0;
      
      const userRetirementAnnual = age >= userRetirementAge ? 
        userMonthlyAtRetirement * 12 * Math.pow(1 + colaRate, yearsSinceUserRetirement) : 0;
      
      const spouseRetirementAnnual = spouseRetirementAge && age >= spouseRetirementAge ? 
        spouseMonthlyAtRetirement * 12 * Math.pow(1 + colaRate, yearsSinceSpouseRetirement) : 0;
      
      const combinedRetirementAnnual = userRetirementAnnual + spouseRetirementAnnual;
      cumulativeRetirement += combinedRetirementAnnual;
      
      flows.push({
        age,
        year: currentYear + (age - userCurrentAge),
        // Optimal strategy
        userBenefit: Math.round(userOptimalAnnual),
        spouseBenefit: Math.round(spouseOptimalAnnual),
        combinedBenefit: Math.round(combinedOptimalAnnual),
        cumulativeTotal: Math.round(cumulativeOptimal),
        // Retirement strategy
        retirementUserBenefit: Math.round(userRetirementAnnual),
        retirementSpouseBenefit: Math.round(spouseRetirementAnnual),
        retirementCombinedBenefit: Math.round(combinedRetirementAnnual),
        retirementCumulativeTotal: Math.round(cumulativeRetirement)
      });
    }
    
    return flows;
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
          <p className="text-white font-medium mb-2">Age {label} ({data.year})</p>
          <div className="space-y-2">
            {/* Optimal Strategy */}
            <div className="space-y-1">
              <p className="text-purple-400 font-medium">
                Optimal Strategy: {formatCurrency(data.combinedBenefit)}
              </p>
              {(data.userBenefit > 0 || data.spouseBenefit > 0) && (
                <div className="text-xs text-gray-400 pl-2">
                  {data.userBenefit > 0 && <p>You: {formatCurrency(data.userBenefit)}</p>}
                  {data.spouseBenefit > 0 && <p>Spouse: {formatCurrency(data.spouseBenefit)}</p>}
                </div>
              )}
            </div>
            
            {/* Retirement Strategy */}
            <div className="space-y-1 pt-1 border-t border-gray-700">
              <p className="text-gray-300 font-medium">
                Retirement Strategy: {formatCurrency(data.retirementCombinedBenefit)}
              </p>
              {(data.retirementUserBenefit > 0 || data.retirementSpouseBenefit > 0) && (
                <div className="text-xs text-gray-400 pl-2">
                  {data.retirementUserBenefit > 0 && <p>You: {formatCurrency(data.retirementUserBenefit)}</p>}
                  {data.retirementSpouseBenefit > 0 && <p>Spouse: {formatCurrency(data.retirementSpouseBenefit)}</p>}
                </div>
              )}
            </div>
            
            {/* Difference */}
            {data.combinedBenefit > 0 && data.retirementCombinedBenefit > 0 && (
              <p className="text-xs text-emerald-400 pt-1 border-t border-gray-700">
                Optimal Advantage: +{formatCurrency(data.combinedBenefit - data.retirementCombinedBenefit)}/year
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading || !cashFlows.length) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-6 h-6 mx-auto text-amber-400" />
          <p className="text-gray-400 mt-2">Loading cash flow projections...</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary statistics
  const totalLifetimeBenefit = cashFlows[cashFlows.length - 1]?.cumulativeTotal || 0;
  const averageAnnualBenefit = totalLifetimeBenefit / cashFlows.length;
  const peakAnnualBenefit = Math.max(...cashFlows.map(f => f.combinedBenefit));
  const userOptimalAge = optimizationData?.combined.optimalUserAge;
  const spouseOptimalAge = optimizationData?.combined.optimalSpouseAge;
  const userRetirementAge = profile?.desiredRetirementAge || 65;
  const spouseRetirementAge = profile?.spouseDesiredRetirementAge || 65;

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
      
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
                  annualSSCashFlowsCollapsed: newState
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
              <DollarSign className="w-5 h-5 text-blue-400" />
              Annual Social Security Cash Flows
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              {isCollapsed 
                ? `Household combined benefits: ${formatCurrency(totalLifetimeBenefit)} lifetime total`
                : `Projected annual benefits from optimal claiming ages through longevity`
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
              {/* Bar Chart */}
              <div className="bg-gray-800/30 p-4 rounded-lg">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={cashFlows} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="age" 
                      stroke="#9CA3AF"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      label={{ value: 'Age', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
                      domain={['dataMin', 'dataMax']}
                      ticks={[65, 70, 75, 80, 85, 90, 93]}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      label={{ value: 'Annual Benefit ($)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                      tickFormatter={(value) => formatCompactCurrency(value)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="rect"
                      formatter={(value) => {
                        if (value === 'retirementCombinedBenefit') return 'Retirement Strategy';
                        if (value === 'combinedBenefit') return 'Optimal Strategy';
                        return value;
                      }}
                    />
                    
                    {/* Reference lines for claiming ages */}
                    <ReferenceLine 
                      x={userRetirementAge} 
                      stroke="#6B7280" 
                      strokeDasharray="5 5"
                      label={{ value: `You retire at ${userRetirementAge}`, position: 'top', fill: '#6B7280', fontSize: 11 }}
                    />
                    {spouseRetirementAge && spouseRetirementAge !== userRetirementAge && (
                      <ReferenceLine 
                        x={spouseRetirementAge} 
                        stroke="#9CA3AF" 
                        strokeDasharray="5 5"
                        label={{ value: `Spouse retires at ${spouseRetirementAge}`, position: 'top', fill: '#9CA3AF', fontSize: 11 }}
                      />
                    )}
                    {userOptimalAge !== userRetirementAge && (
                      <ReferenceLine 
                        x={userOptimalAge} 
                        stroke="#A78BFA" 
                        strokeDasharray="5 5"
                        label={{ value: `Optimal claim at ${userOptimalAge}`, position: 'top', fill: '#A78BFA', fontSize: 11 }}
                      />
                    )}
                    
                    {/* Grey bars for retirement strategy */}
                    <Bar 
                      dataKey="retirementCombinedBenefit" 
                      fill="#6B7280" 
                      radius={[4, 4, 0, 0]}
                    />
                    
                    {/* Purple bars for optimal strategy */}
                    <Bar 
                      dataKey="combinedBenefit" 
                      fill="#A78BFA" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300">
                  <p>
                    This chart compares two claiming strategies: <span className="text-gray-300">Grey bars show benefits if you claim at retirement age</span>, 
                    while <span className="text-purple-300">purple bars show the optimal claiming strategy</span>. 
                    Both include 2.5% annual COLA adjustments through age 93. 
                    {profile.maritalStatus === 'married' && (userRetirementAge !== spouseRetirementAge || userOptimalAge !== spouseOptimalAge) ? 
                    ' Each spouse\'s benefits begin at their individual claiming age based on the strategy.' : ''}
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