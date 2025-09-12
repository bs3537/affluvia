import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LastCalculated } from '@/components/ui/last-calculated';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { BarChart3, Calculator, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type BandsResponse = {
  ages: number[];
  percentiles: {
    p05: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
  meta: {
    currentAge: number;
    retirementAge: number;
    longevityAge: number;
    runs: number;
    calculatedAt: string;
  };
  cached?: boolean;
  calculationTime?: number;
};

interface ProjectionData {
  age: number;
  baseline: number;
  optimized: number;
  difference: number;
}

interface PortfolioBalanceComparisonProps {
  variables: any;
  profile: any;
}

const currency = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
      <p className="text-gray-200 font-medium mb-2">{`Age ${label}`}</p>
      {payload.map((entry: any, index: number) => {
        const isBaseline = entry.dataKey === 'baseline';
        const isOptimized = entry.dataKey === 'optimized';
        
        if (isBaseline || isOptimized) {
          return (
            <div key={entry.dataKey} className="flex justify-between items-center">
              <span className="text-sm text-gray-300">
                {isBaseline ? 'Baseline Plan:' : 'Optimized Plan:'}
              </span>
              <span className="ml-2 text-gray-200">
                {currency(entry.value)}
              </span>
            </div>
          );
        }
        return null;
      })}
      {payload.length > 0 && payload[0].payload?.difference && (
        <div className="flex justify-between items-center border-t border-gray-600 mt-2 pt-2">
          <span className="text-sm text-gray-300">Difference:</span>
          <span className={`ml-2 font-semibold ${payload[0].payload.difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {payload[0].payload.difference >= 0 ? '+' : ''}{currency(payload[0].payload.difference)}
          </span>
        </div>
      )}
    </div>
  );
};

export function PortfolioBalanceComparison({ variables, profile }: PortfolioBalanceComparisonProps) {
  const [baselineData, setBaselineData] = useState<BandsResponse | null>(null);
  const [optimizedData, setOptimizedData] = useState<BandsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateProjections = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Make parallel API calls for both baseline and optimized data
      const [baselineResponse, optimizedResponse] = await Promise.all([
        // Baseline calculation (current profile without optimization)
        fetch('/api/calculate-retirement-bands', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skipCache: true })
        }),
        // Optimized calculation (with optimization variables)
        fetch('/api/calculate-retirement-bands-optimization', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(variables || {})
        })
      ]);

      if (!baselineResponse.ok || !optimizedResponse.ok) {
        throw new Error('Failed to calculate projections');
      }

      const baselineResult = await baselineResponse.json();
      const optimizedResult = await optimizedResponse.json();

      setBaselineData(baselineResult);
      setOptimizedData(optimizedResult);
    } catch (err) {
      console.error('Error calculating projections:', err);
      setError('Failed to calculate portfolio projections. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Process data to extract median values and create chart data
  const { projectionData, comparison } = useMemo(() => {
    if (!baselineData || !optimizedData) {
      return { projectionData: [], comparison: null };
    }

    const chartData: ProjectionData[] = [];
    const ages = baselineData.ages;
    const baselineMedian = baselineData.percentiles.p50;
    const optimizedMedian = optimizedData.percentiles.p50;

    // Create data points for each age
    for (let i = 0; i < ages.length; i++) {
      chartData.push({
        age: ages[i],
        baseline: baselineMedian[i],
        optimized: optimizedMedian[i],
        difference: optimizedMedian[i] - baselineMedian[i]
      });
    }

    // Calculate ending values comparison
    const lastIndex = ages.length - 1;
    const finalBaseline = baselineMedian[lastIndex];
    const finalOptimized = optimizedMedian[lastIndex];
    const finalDifference = finalOptimized - finalBaseline;
    const percentageImprovement = finalBaseline > 0 
      ? Math.round(((finalOptimized - finalBaseline) / finalBaseline) * 100)
      : 0;

    return {
      projectionData: chartData,
      comparison: {
        finalBaseline,
        finalOptimized,
        finalDifference,
        percentageImprovement
      }
    };
  }, [baselineData, optimizedData]);

  const retirementAge = baselineData?.meta?.retirementAge || optimizedData?.meta?.retirementAge;
  const hasData = projectionData.length > 0;

  // Show ready state when no data
  if (!hasData && !loading) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Portfolio Balance Comparison
                <div className="px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-full">
                  <span className="text-xs text-purple-400 font-medium">Enhanced Monte Carlo</span>
                </div>
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                Compare baseline vs optimized median portfolio projections
              </p>
            </div>
            <Button
              onClick={calculateProjections}
              disabled={loading}
              size="sm"
              variant="outline"
              className="bg-purple-800 border-purple-700 hover:bg-purple-700 text-white"
            >
              <Calculator className="w-4 h-4" />
              <span className="ml-2">Calculate Impact</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <Calculator className="w-12 h-12 mx-auto mb-4 text-purple-400 opacity-70" />
            <p className="text-lg font-medium mb-2">Ready to Analyze</p>
            <p className="text-sm">
              Click "Calculate Impact" to compare baseline and optimized portfolio projections
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Portfolio Balance Comparison
            <div className="px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-full">
              <span className="text-xs text-purple-400 font-medium">Enhanced Monte Carlo</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
            <p>Calculating portfolio projections...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Portfolio Balance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-400">
            <p className="text-lg font-medium mb-2">Error</p>
            <p className="text-sm">{error}</p>
            <Button
              onClick={calculateProjections}
              className="mt-4"
              size="sm"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show main chart with data
  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Portfolio Balance Comparison
              <div className="px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-full">
                <span className="text-xs text-purple-400 font-medium">Enhanced Monte Carlo</span>
              </div>
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              Compare baseline vs optimized median portfolio projections
            </p>
          </div>
          <Button
            onClick={calculateProjections}
            disabled={loading}
            size="sm"
            variant="outline"
            className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <div className="px-6 -mt-2">
        <LastCalculated
          timestamp={optimizedData?.meta?.calculatedAt || baselineData?.meta?.calculatedAt}
          onRefresh={calculateProjections}
        />
      </div>
      <CardContent className="space-y-6">
        {/* Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projectionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="age" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                tickFormatter={currency}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Reference line for retirement age */}
              {retirementAge && (
                <ReferenceLine 
                  x={retirementAge} 
                  stroke="#60A5FA" 
                  strokeDasharray="5 5" 
                  label={{ 
                    value: 'Retirement', 
                    position: 'top', 
                    fill: '#60A5FA' 
                  }} 
                />
              )}

              {/* Baseline Plan Line */}
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#6366f1"
                strokeWidth={3}
                dot={false}
                strokeOpacity={0.8}
                name="Baseline Plan"
              />

              {/* Optimized Plan Line */}
              <Line
                type="monotone"
                dataKey="optimized"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                strokeOpacity={0.8}
                name="Optimized Plan"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-indigo-500 rounded"></div>
            <span className="text-sm text-gray-300">Baseline Plan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-300">Optimized Plan</span>
          </div>
        </div>
        
        {/* Comparison Summary */}
        {comparison && (
          <div className={`border rounded-lg p-4 mt-4 ${
            comparison.finalDifference >= 0 
              ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-700/30'
              : 'bg-gradient-to-r from-red-900/20 to-rose-900/20 border-red-700/30'
          }`}>
            <div className="text-center">
              <div className="text-lg font-semibold text-white">
                Optimized plan has{' '}
                <span className={`text-2xl font-bold ${
                  comparison.finalDifference >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {currency(Math.abs(comparison.finalDifference))}
                </span>{' '}
                {comparison.finalDifference >= 0 ? 'more' : 'less'} ending assets
              </div>
              {comparison.percentageImprovement !== 0 && (
                <div className={`text-sm mt-2 ${
                  comparison.percentageImprovement >= 0 ? 'text-green-300' : 'text-red-300'
                }`}>
                  ({comparison.percentageImprovement >= 0 ? '+' : ''}{comparison.percentageImprovement}% change)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Source Info */}
        {baselineData?.calculationTime && optimizedData?.calculationTime && (
          <div className="text-xs text-gray-500 text-center">
            Baseline calculated in {(baselineData.calculationTime / 1000).toFixed(1)}s, 
            Optimized in {(optimizedData.calculationTime / 1000).toFixed(1)}s
          </div>
        )}
      </CardContent>
    </Card>
  );
}
