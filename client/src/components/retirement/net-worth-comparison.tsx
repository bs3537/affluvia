import React, { useState, useEffect, useMemo } from 'react';
import { seedFromParams } from '@/lib/seed';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Sparkles, TrendingUp, BarChart3, ArrowUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface NetWorthComparisonProps {
  baselineData?: any;
  optimizedData?: any;
  profile?: any;
  optimizationVariables?: any;
}

const formatCurrency = (value: number): string => {
  if (!value || isNaN(value)) return '$0';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
        <p className="text-white font-semibold mb-2">Age {label}</p>
        <div className="space-y-1 text-sm">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="text-white font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
          {payload[0]?.payload?.totalNetWorth && (
            <div className="border-t border-gray-600 pt-1 mt-1">
              <div className="flex justify-between gap-4">
                <span className="text-gray-300">Total Net Worth:</span>
                <span className="text-white font-bold">{formatCurrency(payload[0].payload.totalNetWorth)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

function NetWorthProjectionChart({ 
  title, 
  data, 
  retirementAge, 
  longevityAge,
  netWorthAtRetirement,
  netWorthAtLongevity,
  isOptimized = false 
}: {
  title: string;
  data: any[];
  retirementAge: number;
  longevityAge: number;
  netWorthAtRetirement: number;
  netWorthAtLongevity: number;
  isOptimized?: boolean;
}) {
  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            {title}
            {isOptimized && <Sparkles className="w-4 h-4 text-yellow-400" />}
          </CardTitle>
          {isOptimized && (
            <div className="px-2 py-1 bg-green-900/30 border border-green-700/50 rounded-full">
              <span className="text-xs text-green-400 font-medium">Optimized</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">At retirement ({retirementAge})</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(netWorthAtRetirement)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">At longevity ({longevityAge})</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(netWorthAtLongevity)}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
              >
                <defs>
                  <linearGradient id={`colorSavings-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id={`colorRealEstate-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="age" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  label={{ value: 'Age', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Reference lines */}
                <ReferenceLine 
                  x={retirementAge} 
                  stroke="#F59E0B" 
                  strokeDasharray="3 3" 
                  label={{ value: "Retirement", position: "top", fill: "#F59E0B", fontSize: 10 }}
                />
                
                {/* Stacked areas */}
                <Area
                  type="monotone"
                  dataKey="savings"
                  stackId="1"
                  stroke="#10B981"
                  fill={`url(#colorSavings-${title})`}
                  name="Retirement Assets"
                />
                <Area
                  type="monotone"
                  dataKey="realEstate"
                  stackId="1"
                  stroke="#3B82F6"
                  fill={`url(#colorRealEstate-${title})`}
                  name="Real Estate"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-400">Retirement Assets (Median)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-400">Real Estate</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function NetWorthComparison({
  baselineData,
  optimizedData,
  profile,
  optimizationVariables
}: NetWorthComparisonProps) {
  const [baselineProjections, setBaselineProjections] = useState<any[]>([]);
  const [optimizedProjections, setOptimizedProjections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Early return if profile is not loaded
  if (!profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // Calculate projections from Monte Carlo data
  const calculateProjections = (monteCarloData: any, variables?: any) => {
    if (!monteCarloData || !monteCarloData.results || monteCarloData.results.length === 0) {
      return { projectionData: [], netWorthAtRetirement: 0, netWorthAtLongevity: 0 };
    }

    // Get current real estate equity
    const homeEquity = profile?.primaryResidence ? 
      ((profile?.primaryResidence?.marketValue || 0) - (profile?.primaryResidence?.mortgageBalance || 0)) : 0;
    
    const additionalPropertiesValue = (profile?.assets || [])
      .filter((asset: any) => asset.type === 'real-estate')
      .reduce((sum: number, asset: any) => sum + (asset.value || 0), 0);
    
    const currentRealEstateValue = homeEquity + additionalPropertiesValue;
    const realEstateAppreciationRate = 0.03; // 3% annual appreciation
    
    // Extract median values from Monte Carlo results
    const medianResults = monteCarloData.results.map((yearData: any) => {
      const values = yearData.values.sort((a: number, b: number) => a - b);
      const medianIndex = Math.floor(values.length / 2);
      return {
        year: yearData.year,
        medianValue: values[medianIndex] || 0
      };
    });

    // Get ages
    const currentYear = new Date().getFullYear();
    let birthYear = currentYear - 50; // Default to age 50
    if (profile && profile.dateOfBirth) {
      try {
        birthYear = new Date(profile.dateOfBirth).getFullYear();
      } catch (e) {
        console.warn('Invalid date of birth:', profile.dateOfBirth);
      }
    }
    const currentAge = currentYear - birthYear;
    const retirementAge = variables?.retirementAge || profile?.desiredRetirementAge || 65;
    const longevityAge = profile?.userLifeExpectancy || 93;

    // Create projection data
    const projectionData = [];
    let netWorthAtRetirement = 0;
    let netWorthAtLongevity = 0;

    for (let age = currentAge; age <= longevityAge; age++) {
      const yearIndex = age - currentAge;
      const yearsFromNow = age - currentAge;
      
      // Get median retirement assets from Monte Carlo
      const retirementAssets = medianResults[yearIndex]?.medianValue || 0;
      
      // Calculate real estate value with appreciation
      const realEstateValue = currentRealEstateValue * Math.pow(1 + realEstateAppreciationRate, yearsFromNow);
      
      const totalNetWorth = retirementAssets + realEstateValue;

      projectionData.push({
        age,
        year: currentYear + yearsFromNow,
        savings: retirementAssets,
        realEstate: realEstateValue,
        totalNetWorth
      });

      if (age === retirementAge) {
        netWorthAtRetirement = totalNetWorth;
      }
      if (age === longevityAge) {
        netWorthAtLongevity = totalNetWorth;
      }
    }

    return { projectionData, netWorthAtRetirement, netWorthAtLongevity };
  };

  // Fetch baseline data if not provided
  useEffect(() => {
    const fetchBaselineData = async () => {
      if (!baselineData) {
        setIsLoading(true);
        try {
          const response = await fetch('/api/calculate-retirement-monte-carlo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seed: seedFromParams(undefined, 'net-worth-comparison') })
          });
          
          if (response.ok) {
            const result = await response.json();
            const { projectionData, netWorthAtRetirement, netWorthAtLongevity } = calculateProjections(result);
            setBaselineProjections(projectionData);
          }
        } catch (error) {
          console.error('Error fetching baseline data:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        const { projectionData } = calculateProjections(baselineData);
        setBaselineProjections(projectionData);
      }
    };

    fetchBaselineData();
  }, [baselineData, profile]);

  // Fetch optimized data if optimization variables are provided
  useEffect(() => {
    const fetchOptimizedData = async () => {
      if (optimizationVariables && !optimizedData) {
        setIsLoading(true);
        try {
          const response = await fetch('/api/optimize-retirement-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ optimizationVariables })
          });
          
          if (response.ok) {
            const result = await response.json();
            const { projectionData, netWorthAtRetirement, netWorthAtLongevity } = calculateProjections(result, optimizationVariables);
            setOptimizedProjections(projectionData);
          }
        } catch (error) {
          console.error('Error fetching optimized data:', error);
        } finally {
          setIsLoading(false);
        }
      } else if (optimizedData) {
        const { projectionData } = calculateProjections(optimizedData, optimizationVariables);
        setOptimizedProjections(projectionData);
      }
    };

    fetchOptimizedData();
  }, [optimizedData, optimizationVariables, profile]);

  // Calculate ages for display
  const currentYear = new Date().getFullYear();
  let birthYear = currentYear - 50; // Default to age 50
  if (profile && profile.dateOfBirth) {
    try {
      birthYear = new Date(profile.dateOfBirth).getFullYear();
    } catch (e) {
      console.warn('Invalid date of birth:', profile.dateOfBirth);
    }
  }
  const currentAge = currentYear - birthYear;
  const retirementAge = optimizationVariables?.retirementAge || profile?.desiredRetirementAge || 65;
  const longevityAge = profile?.userLifeExpectancy || 93;

  // Get net worth values at key ages
  const baselineRetirement = baselineProjections.find(d => d.age === retirementAge)?.totalNetWorth || 0;
  const baselineLongevity = baselineProjections.find(d => d.age === longevityAge)?.totalNetWorth || 0;
  const optimizedRetirement = optimizedProjections.find(d => d.age === retirementAge)?.totalNetWorth || 0;
  const optimizedLongevity = optimizedProjections.find(d => d.age === longevityAge)?.totalNetWorth || 0;

  // Calculate improvements
  const retirementImprovement = optimizedRetirement > 0 ? ((optimizedRetirement - baselineRetirement) / baselineRetirement) * 100 : 0;
  const longevityImprovement = optimizedLongevity > 0 ? ((optimizedLongevity - baselineLongevity) / baselineLongevity) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with comparison metrics */}
      {optimizedProjections.length > 0 && (
        <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Optimization Impact
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-400 mb-1">Additional Net Worth at Retirement</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-green-400">
                    +{formatCurrency(optimizedRetirement - baselineRetirement)}
                  </p>
                  {retirementImprovement > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-900/30 border border-green-700/50 rounded-full">
                      <ArrowUp className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400 font-medium">+{retirementImprovement.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Additional Net Worth at Longevity</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-green-400">
                    +{formatCurrency(optimizedLongevity - baselineLongevity)}
                  </p>
                  {longevityImprovement > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-900/30 border border-green-700/50 rounded-full">
                      <ArrowUp className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400 font-medium">+{longevityImprovement.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Side by side charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Baseline Plan */}
        <NetWorthProjectionChart
          title="Baseline Plan"
          data={baselineProjections}
          retirementAge={retirementAge}
          longevityAge={longevityAge}
          netWorthAtRetirement={baselineRetirement}
          netWorthAtLongevity={baselineLongevity}
          isOptimized={false}
        />

        {/* Optimized Plan */}
        {optimizedProjections.length > 0 ? (
          <NetWorthProjectionChart
            title="Optimized Plan"
            data={optimizedProjections}
            retirementAge={retirementAge}
            longevityAge={longevityAge}
            netWorthAtRetirement={optimizedRetirement}
            netWorthAtLongevity={optimizedLongevity}
            isOptimized={true}
          />
        ) : (
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-white">Optimized Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm text-center">
                  Run optimization in Step 1 to see improved projections
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
