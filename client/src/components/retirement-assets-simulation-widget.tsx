import React, { useState, useEffect, useMemo } from 'react';
import { seedFromParams } from '@/lib/seed';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ChevronDown, Info, TrendingUp, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface SimulationTrial {
  iteration: number;
  success: boolean;
  yearlyData: Array<{
    year: number;
    portfolioValue: number;
    age: number;
  }>;
  finalPortfolioValue: number;
}

interface RetirementAssetsSimulationWidgetProps {
  isExpanded: boolean;
  onToggle: () => void;
  monteCarloData?: any;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export function RetirementAssetsSimulationWidget({
  isExpanded,
  onToggle,
  monteCarloData
}: RetirementAssetsSimulationWidgetProps) {
  const [simulationData, setSimulationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSimulationData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/calculate-retirement-monte-carlo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seed: seedFromParams(undefined, 'retirement-assets-simulation') })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Retirement Assets Simulation - Fetched data:', {
          hasResults: !!result.results,
          resultsLength: result.results?.length || 0,
          hasYearlyData: result.results?.[0]?.yearlyData ? true : false,
        });
        setSimulationData(result);
      }
    } catch (error) {
      console.error('Error fetching simulation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!monteCarloData || !monteCarloData.results || monteCarloData.results.length === 0) {
      fetchSimulationData();
    } else {
      setSimulationData(monteCarloData);
    }
  }, []);

  const { percentileData, currentAge, retirementAge, lifeExpectancy } = useMemo(() => {
    if (!simulationData || !simulationData.results || simulationData.results.length === 0) {
      return { 
        percentileData: [], 
        currentAge: 50, 
        retirementAge: 65, 
        lifeExpectancy: 90 
      };
    }

    const trials = simulationData.results;
    
    // Get ages from the first trial
    const firstTrial = trials[0];
    const currentAge = firstTrial.yearlyData?.[0]?.age || 50;
    const lastDataPoint = firstTrial.yearlyData?.[firstTrial.yearlyData.length - 1];
    const lifeExpectancy = lastDataPoint?.age || 90;
    
    // Find retirement age (could be passed as prop or calculated)
    const retirementAge = simulationData.retirementAge || 65;

    // Calculate percentiles for each age
    const agePercentiles: { [key: number]: { values: number[], year: number } } = {};
    
    trials.forEach((trial: SimulationTrial) => {
      if (trial.yearlyData) {
        trial.yearlyData.forEach(yearData => {
          const age = yearData.age;
          if (!agePercentiles[age]) {
            agePercentiles[age] = { values: [], year: yearData.year };
          }
          agePercentiles[age].values.push(yearData.portfolioValue);
        });
      }
    });

    // Calculate percentile values for each age
    const percentiles = Object.keys(agePercentiles).map(ageStr => {
      const age = parseInt(ageStr);
      const data = agePercentiles[age];
      const values = data.values.sort((a, b) => a - b);
      const p5 = values[Math.floor(values.length * 0.05)] || 0;
      const p25 = values[Math.floor(values.length * 0.25)] || 0;
      const p50 = values[Math.floor(values.length * 0.50)] || 0;
      const p75 = values[Math.floor(values.length * 0.75)] || 0;
      const p95 = values[Math.floor(values.length * 0.95)] || 0;

      return {
        year: data.year,
        age: age,
        percentile5: p5,
        percentile25: p25,
        median: p50,
        percentile75: p75,
        percentile95: p95,
      };
    }).sort((a, b) => a.age - b.age);

    return { 
      percentileData: percentiles, 
      currentAge, 
      retirementAge, 
      lifeExpectancy 
    };
  }, [simulationData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = percentileData.find(d => d.age === label);
      if (!dataPoint) return null;
      
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-semibold mb-2">Age {label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">95th Percentile:</span>
              <span className="text-white font-medium">{formatCurrency(dataPoint.percentile95)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">75th Percentile:</span>
              <span className="text-white font-medium">{formatCurrency(dataPoint.percentile75)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-blue-400 font-semibold">Median (50th):</span>
              <span className="text-white font-medium">{formatCurrency(dataPoint.median)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">25th Percentile:</span>
              <span className="text-white font-medium">{formatCurrency(dataPoint.percentile25)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">5th Percentile:</span>
              <span className="text-white font-medium">{formatCurrency(dataPoint.percentile5)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const successRate = simulationData?.summary?.successfulRuns && simulationData?.summary?.totalRuns
    ? (simulationData.summary.successfulRuns / simulationData.summary.totalRuns * 100).toFixed(1)
    : '0.0';

  return (
    <Card className="card-gradient border-gray-700 widget-card bg-gradient-to-br from-gray-900/40 to-gray-800/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold text-white">Retirement Assets Simulation Results</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-400" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-6 w-6 p-0 text-gray-400 hover:text-white expand-toggle-btn"
            aria-expanded={isExpanded}
            aria-label="Toggle simulation details"
          >
            <ChevronDown className={`w-4 h-4 chevron-icon ${isExpanded ? 'rotated' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="text-gray-400 mt-2 text-sm">Loading simulation data...</p>
          </div>
        ) : percentileData.length > 0 ? (
          <>
            {/* Success Rate Summary */}
            <div className="flex items-center justify-between mb-4 p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-400">
                    Successes: {simulationData?.summary?.successfulRuns || 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-400">
                    Failures: {simulationData?.summary?.totalRuns - (simulationData?.summary?.successfulRuns || 0) || 0}
                  </span>
                </div>
              </div>
              <div className="text-gray-300 font-semibold">
                Success Rate: {successRate}%
              </div>
            </div>

            {/* Confidence Bands Chart */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Info className="w-4 h-4" />
                <span>Portfolio value projections across different confidence levels</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={percentileData} margin={{ top: 5, right: 30, left: 20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="age"
                    stroke="#9CA3AF"
                    label={{ value: 'Age', position: 'insideBottom', offset: -5, style: { fill: '#9CA3AF' } }}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tickFormatter={formatCurrency}
                    label={{ value: 'Portfolio Value', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Reference line for retirement age */}
                  <ReferenceLine 
                    x={retirementAge} 
                    stroke="#B040FF" 
                    strokeDasharray="5 5" 
                    label={{ value: 'Retirement', position: 'top', fill: '#B040FF' }}
                  />
                  
                  {/* 5th percentile line (bottom) */}
                  <Line
                    type="monotone"
                    dataKey="percentile5"
                    stroke="#DBEAFE"
                    strokeWidth={1}
                    strokeOpacity={0.5}
                    dot={false}
                  />
                  
                  {/* 25th percentile line */}
                  <Line
                    type="monotone"
                    dataKey="percentile25"
                    stroke="#93C5FD"
                    strokeWidth={1}
                    strokeOpacity={0.7}
                    dot={false}
                  />
                  
                  {/* 75th percentile line */}
                  <Line
                    type="monotone"
                    dataKey="percentile75"
                    stroke="#93C5FD"
                    strokeWidth={1}
                    strokeOpacity={0.7}
                    dot={false}
                  />
                  
                  {/* 95th percentile line (top) */}
                  <Line
                    type="monotone"
                    dataKey="percentile95"
                    stroke="#DBEAFE"
                    strokeWidth={1}
                    strokeOpacity={0.5}
                    dot={false}
                  />
                  
                  {/* Median Line - VERY prominent with dark color */}
                  <Line
                    type="monotone"
                    dataKey="median"
                    stroke="#1E40AF"
                    strokeWidth={4}
                    dot={false}
                    name="Median (50th Percentile)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            {isExpanded && (
              <div className="mt-6 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h4 className="text-white font-semibold mb-3">Understanding Confidence Bands</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-4 rounded" style={{ backgroundColor: '#1E40AF' }}></div>
                    <span className="text-gray-300">
                      <strong>Median (50th percentile):</strong> Most likely outcome
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-2 rounded" style={{ backgroundColor: '#93C5FD', opacity: 0.7 }}></div>
                    <span className="text-gray-300">
                      <strong>25th & 75th Percentiles:</strong> Middle 50% of outcomes
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-1 rounded" style={{ backgroundColor: '#DBEAFE', opacity: 0.5 }}></div>
                    <span className="text-gray-300">
                      <strong>5th & 95th Percentiles:</strong> 90% of all outcomes
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <p className="text-gray-300 mb-2">No simulation data available</p>
            <p className="text-gray-400 text-sm">Run a Monte Carlo simulation to see results</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
