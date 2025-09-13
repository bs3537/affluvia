import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';

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

interface MonteCarloVisualizationProps {
  results?: {
    results?: SimulationTrial[];
    summary?: {
      successfulRuns: number;
      totalRuns: number;
      percentile10: number;
      percentile25: number;
      medianFinalValue: number;
      percentile75: number;
      percentile90: number;
    };
    successProbability?: number;
  };
  currentAge?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export const MonteCarloVisualization: React.FC<MonteCarloVisualizationProps> = ({
  results,
  currentAge = 50,
  retirementAge = 65,
  lifeExpectancy = 90
}) => {
  if (!results || !results.results || results.results.length === 0) {
    return (
      <Card className="bg-gray-900/50 border-gray-700">
        <CardContent className="py-8 text-center text-gray-400">
          <p>No simulation data available. Run a Monte Carlo simulation to see results.</p>
        </CardContent>
      </Card>
    );
  }

  const { successfulTrials, failedTrials, allTrialsData, percentileData } = useMemo(() => {
    const trials = results.results || [];
    const successful = trials.filter(t => t.success);
    const failed = trials.filter(t => !t.success);

    // Process all trials for the individual trials graph
    const processedTrials = trials.slice(0, 100).map(trial => {
      if (!trial.yearlyData || trial.yearlyData.length === 0) {
        return null;
      }
      
      return trial.yearlyData.map(yearData => ({
        year: yearData.year,
        age: yearData.age,
        value: yearData.portfolioValue,
        success: trial.success,
        iteration: trial.iteration
      }));
    }).filter(Boolean);

    // Calculate percentiles for each age (not year)
    const agePercentiles: { [key: number]: { values: number[], year: number } } = {};
    
    trials.forEach(trial => {
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
        // Calculate differences for stacked areas
        outerBandLower: p5,
        innerBandLower: p25 - p5,  // Gap from 5th to 25th
        innerBandDiff: p75 - p25,  // Height of 25-75% band
        upperBandDiff: p95 - p75,  // Gap from 75th to 95th
      };
    }).sort((a, b) => a.age - b.age);

    return {
      successfulTrials: successful,
      failedTrials: failed,
      allTrialsData: processedTrials,
      percentileData: percentiles
    };
  }, [results, currentAge]);

  const successRate = results.summary?.successfulRuns && results.summary?.totalRuns
    ? (results.summary.successfulRuns / results.summary.totalRuns * 100).toFixed(1)
    : '0.0';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Find the data point for this age
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

  return (
    <Card className="bg-gray-900/50 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Monte Carlo Simulation Results</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-400">Successes: {results.summary?.successfulRuns || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-400">Failures: {results.summary?.totalRuns - (results.summary?.successfulRuns || 0) || 0}</span>
            </div>
            <div className="text-gray-300 font-semibold">
              Success Rate: {successRate}%
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Info className="w-4 h-4" />
                <span>Portfolio value projections across different confidence levels</span>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={percentileData} margin={{ top: 5, right: 30, left: 20, bottom: 30 }}>
                  <defs>
                    <linearGradient id="colorBand95" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#BFDBFE" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#BFDBFE" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorBand75" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#93C5FD" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#93C5FD" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  
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
              
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
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
            </div>
      </CardContent>
    </Card>
  );
};