import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { AlertCircle, ChevronUp, ChevronDown, DollarSign, TrendingUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  profile: any;
  isLocked?: boolean;
  variables?: any;
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

export function AnnualSocialSecurityCashFlowsNew({ profile, isLocked = false, variables }: Props) {
  const [cashFlows, setCashFlows] = useState<AnnualCashFlow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStart, setLoadingStart] = useState<number | null>(null);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  // Check for persisted collapse state from UI preferences
  const shouldAutoCollapse = profile?.retirementPlanningUIPreferences?.annualSSCashFlowsCollapsed;
  // Default to open (false) unless user has explicitly collapsed it
  const [isCollapsed, setIsCollapsed] = useState(shouldAutoCollapse !== undefined ? shouldAutoCollapse : false);
  const [optimizationData, setOptimizationData] = useState<any>(null);

  useEffect(() => {
    if (!profile) return;
    const cached = profile?.optimizationVariables?.socialSecurityOptimization?.result;
    if (cached) {
      setOptimizationData(cached);
      const flows = calculateAnnualFlows(cached, profile, variables);
      setCashFlows(flows);
      setIsLoading(false);
      return;
    }
    fetchOptimizationAndCalculateFlows();
  }, [profile, variables]);

  const fetchOptimizationAndCalculateFlows = async () => {
    setIsLoading(true);
    setLoadingStart(Date.now());
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
        const flows = calculateAnnualFlows(data, profile, variables);
        setCashFlows(flows);
      }
    } catch (error) {
      console.error('Error calculating cash flows:', error);
    } finally {
      setIsLoading(false);
      setLoadingStart(null);
      setLoadingSeconds(0);
    }
  };

  // Loading timer ticker
  useEffect(() => {
    if (!loadingStart) return;
    const t = setInterval(() => {
      setLoadingSeconds(Math.max(0, Math.round((Date.now() - loadingStart) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [loadingStart]);

  const calculateAnnualFlows = (optData: any, profile: any, variables: any): AnnualCashFlow[] => {
    const flows: AnnualCashFlow[] = [];
    const longevityAge = 93;
    const colaRate = 0.025; // 2.5% annual COLA
    
    // Get baseline claiming ages from optimized plan first (Optimization tab), then profile.optimizationVariables, then intake form
    const baselineUserClaimAge = (
      variables?.retirementAge ??
      profile?.optimizationVariables?.retirementAge ??
      profile.desiredRetirementAge ?? 65
    );
    const baselineSpouseClaimAge = (
      variables?.spouseRetirementAge ??
      profile?.optimizationVariables?.spouseRetirementAge ??
      profile.spouseDesiredRetirementAge ?? 65
    );
    
    // Get optimized claiming ages (from optimization form variables)
    const optimizedUserClaimAge = variables?.socialSecurityAge || optData.combined.optimalUserAge;
    const optimizedSpouseClaimAge = variables?.spouseSocialSecurityAge || optData.combined.optimalSpouseAge;
    
    // Get monthly benefits for baseline strategy (claiming at retirement)
    const userMonthlyAtBaseline = optData.user.monthlyAtRetirement;
    const spouseMonthlyAtBaseline = optData.spouse?.monthlyAtRetirement || 0;
    
    // Get monthly benefits for optimized strategy
    let userMonthlyAtOptimized = 0;
    let spouseMonthlyAtOptimized = 0;
    
    // Find the monthly benefits for optimized claiming ages from ageAnalysis
    if (optData.ageAnalysis) {
      const optimizedScenario = optData.ageAnalysis.find((s: any) => 
        s.userAge === optimizedUserClaimAge && 
        s.spouseAge === optimizedSpouseClaimAge
      );
      if (optimizedScenario) {
        userMonthlyAtOptimized = optimizedScenario.userMonthly;
        spouseMonthlyAtOptimized = optimizedScenario.spouseMonthly || 0;
      }
    }
    
    // Calculate current year
    const currentYear = new Date().getFullYear();
    const userCurrentAge = profile.dateOfBirth ? 
      Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 51;
    
    let cumulativeOptimized = 0;
    let cumulativeBaseline = 0;
    
    // Start from the earliest of all claiming ages
    const startAge = Math.min(
      optimizedUserClaimAge, 
      optimizedSpouseClaimAge || optimizedUserClaimAge,
      baselineUserClaimAge,
      baselineSpouseClaimAge || baselineUserClaimAge
    );
    
    for (let age = startAge; age <= longevityAge; age++) {
      // Optimized strategy calculations
      const yearsSinceUserOptimized = Math.max(0, age - optimizedUserClaimAge);
      const yearsSinceSpouseOptimized = optimizedSpouseClaimAge ? Math.max(0, age - optimizedSpouseClaimAge) : 0;
      
      const userOptimizedAnnual = age >= optimizedUserClaimAge ? 
        userMonthlyAtOptimized * 12 * Math.pow(1 + colaRate, yearsSinceUserOptimized) : 0;
      
      const spouseOptimizedAnnual = optimizedSpouseClaimAge && age >= optimizedSpouseClaimAge ? 
        spouseMonthlyAtOptimized * 12 * Math.pow(1 + colaRate, yearsSinceSpouseOptimized) : 0;
      
      const combinedOptimizedAnnual = userOptimizedAnnual + spouseOptimizedAnnual;
      cumulativeOptimized += combinedOptimizedAnnual;
      
      // Baseline strategy calculations (claiming at retirement)
      const yearsSinceUserBaseline = Math.max(0, age - baselineUserClaimAge);
      const yearsSinceSpouseBaseline = baselineSpouseClaimAge ? Math.max(0, age - baselineSpouseClaimAge) : 0;
      
      const userBaselineAnnual = age >= baselineUserClaimAge ? 
        userMonthlyAtBaseline * 12 * Math.pow(1 + colaRate, yearsSinceUserBaseline) : 0;
      
      const spouseBaselineAnnual = baselineSpouseClaimAge && age >= baselineSpouseClaimAge ? 
        spouseMonthlyAtBaseline * 12 * Math.pow(1 + colaRate, yearsSinceSpouseBaseline) : 0;
      
      const combinedBaselineAnnual = userBaselineAnnual + spouseBaselineAnnual;
      cumulativeBaseline += combinedBaselineAnnual;
      
      flows.push({
        age,
        year: currentYear + (age - userCurrentAge),
        // Optimized strategy
        userBenefit: Math.round(userOptimizedAnnual),
        spouseBenefit: Math.round(spouseOptimizedAnnual),
        combinedBenefit: Math.round(combinedOptimizedAnnual),
        cumulativeTotal: Math.round(cumulativeOptimized),
        // Baseline strategy
        retirementUserBenefit: Math.round(userBaselineAnnual),
        retirementSpouseBenefit: Math.round(spouseBaselineAnnual),
        retirementCombinedBenefit: Math.round(combinedBaselineAnnual),
        retirementCumulativeTotal: Math.round(cumulativeBaseline)
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
            {/* Max Lifetime SS Income Strategy */}
            <div className="space-y-1">
              <p className="text-purple-400 font-medium">
                Max Lifetime SS Income: {formatCurrency(data.combinedBenefit)}
              </p>
              {(data.userBenefit > 0 || data.spouseBenefit > 0) && (
                <div className="text-xs text-gray-400 pl-2">
                  {data.userBenefit > 0 && <p>You: {formatCurrency(data.userBenefit)}</p>}
                  {data.spouseBenefit > 0 && <p>Spouse: {formatCurrency(data.spouseBenefit)}</p>}
                </div>
              )}
            </div>
            
            {/* Baseline Strategy */}
            <div className="space-y-1 pt-1 border-t border-gray-700">
              <p className="text-gray-300 font-medium">
                Baseline Strategy: {formatCurrency(data.retirementCombinedBenefit)}
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
                Max-Income Advantage: +{formatCurrency(data.combinedBenefit - data.retirementCombinedBenefit)}/year
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
          <p className="text-gray-400 mt-2">Loading comparison... {loadingSeconds}s</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary statistics
  const totalLifetimeBenefit = cashFlows[cashFlows.length - 1]?.cumulativeTotal || 0;
  const averageAnnualBenefit = totalLifetimeBenefit / cashFlows.length;
  const peakAnnualBenefit = Math.max(...cashFlows.map(f => f.combinedBenefit));
  const baselineUserAge = profile?.desiredRetirementAge || 65;
  const baselineSpouseAge = profile?.spouseDesiredRetirementAge || 65;
  const optimizedUserAge = variables?.socialSecurityAge || optimizationData?.combined.optimalUserAge;
  const optimizedSpouseAge = variables?.spouseSocialSecurityAge || optimizationData?.combined.optimalSpouseAge;

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
                : `Projected annual benefits comparing baseline and optimized claiming strategies`
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
                        if (value === 'retirementCombinedBenefit') return 'Baseline Strategy';
                        if (value === 'combinedBenefit') return 'Max Lifetime SS Income';
                        return value;
                      }}
                    />
                    
                    {/* Reference lines for claiming ages */}
                    <ReferenceLine 
                      x={baselineUserAge} 
                      stroke="#6B7280" 
                      strokeDasharray="5 5"
                      label={{ value: `Baseline claim at ${baselineUserAge}`, position: 'top', fill: '#6B7280', fontSize: 11 }}
                    />
                    {baselineSpouseAge && baselineSpouseAge !== baselineUserAge && (
                      <ReferenceLine 
                        x={baselineSpouseAge} 
                        stroke="#9CA3AF" 
                        strokeDasharray="5 5"
                        label={{ value: `Spouse baseline at ${baselineSpouseAge}`, position: 'top', fill: '#9CA3AF', fontSize: 11 }}
                      />
                    )}
                    {optimizedUserAge !== baselineUserAge && (
                      <ReferenceLine 
                        x={optimizedUserAge} 
                        stroke="#A78BFA" 
                        strokeDasharray="5 5"
                        label={{ value: `Max-income claim at ${optimizedUserAge}`, position: 'top', fill: '#A78BFA', fontSize: 11 }}
                      />
                    )}
                    
                    {/* Grey bars for baseline strategy */}
                    <Bar 
                      dataKey="retirementCombinedBenefit" 
                      fill="#6B7280" 
                      radius={[4, 4, 0, 0]}
                    />
                    
                    {/* Purple bars for optimized strategy */}
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
                    This chart compares two claiming strategies: <span className="text-gray-300">Grey bars show baseline strategy (claiming at retirement)</span>, 
                    while <span className="text-purple-300">purple bars show the optimized claiming strategy</span>. 
                    Both include 2.5% annual COLA adjustments through age 93. 
                    {profile.maritalStatus === 'married' && (baselineUserAge !== baselineSpouseAge || optimizedUserAge !== optimizedSpouseAge) ? 
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
