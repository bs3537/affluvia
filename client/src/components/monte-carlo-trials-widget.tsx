import React, { useState, useEffect, useMemo } from 'react';
import { seedFromParams } from '@/lib/seed';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ChevronDown, TrendingUp, AlertTriangle, Info } from 'lucide-react';
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

interface MonteCarloTrialsWidgetProps {
  isExpanded: boolean;
  onToggle: () => void;
  monteCarloData?: any;
}

export const MonteCarloTrialsWidget: React.FC<MonteCarloTrialsWidgetProps> = ({
  isExpanded,
  onToggle,
  monteCarloData
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [simulationData, setSimulationData] = useState<any>(null);

  useEffect(() => {
    const fetchSimulationData = async () => {
      // Check if monteCarloData exists AND has the full results array
      // The saved data in database only has summary, not individual trials
      if (!monteCarloData || !monteCarloData.results || monteCarloData.results.length === 0) {
        setIsLoading(true);
        try {
          const response = await fetch('/api/calculate-retirement-monte-carlo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seed: seedFromParams(undefined, 'monte-carlo-trials-widget') })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Monte Carlo Trials Widget - Fetched data:', {
              hasResults: !!data.results,
              resultsLength: data.results?.length || 0,
              hasYearlyData: data.results?.[0]?.yearlyData ? true : false,
              successProbability: data.probabilityOfSuccess,
              summary: data.summary
            });
            setSimulationData(data);
          }
        } catch (error) {
          console.error('Error fetching Monte Carlo data:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSimulationData(monteCarloData);
      }
    };

    fetchSimulationData();
  }, [monteCarloData]);

  const { chartData, stats } = useMemo(() => {
    if (!simulationData || !simulationData.results || simulationData.results.length === 0) {
      return { chartData: [], stats: null };
    }

    const results = simulationData.results || [];
    const summary = simulationData.summary || {};
    
    // Process first 100 trials for visualization
    const trialsToShow = Math.min(100, results.length);
    const processedData: any[] = [];
    
    // Get the year range from the first trial
    const firstTrial = results[0];
    if (firstTrial && firstTrial.yearlyData) {
      const years = firstTrial.yearlyData.map((d: any) => d.year);
      
      years.forEach((year: number, yearIndex: number) => {
        const dataPoint: any = { year };
        
        // Add data for each trial
        for (let i = 0; i < trialsToShow; i++) {
          const trial = results[i];
          if (trial && trial.yearlyData && trial.yearlyData[yearIndex]) {
            dataPoint[`trial_${i}`] = trial.yearlyData[yearIndex].portfolioValue;
            dataPoint[`success_${i}`] = trial.success;
          }
        }
        
        processedData.push(dataPoint);
      });
    }

    const stats = {
      totalTrials: summary.totalRuns || 1000,
      successfulTrials: summary.successfulRuns || 0,
      failedTrials: (summary.totalRuns || 1000) - (summary.successfulRuns || 0),
      successRate: simulationData.probabilityOfSuccess || 0
    };

    return { chartData: processedData, stats };
  }, [simulationData]);

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const successCount = payload.filter((p: any) => p.dataKey.includes('trial_') && p.payload[p.dataKey.replace('trial_', 'success_')]).length;
      const totalCount = payload.filter((p: any) => p.dataKey.includes('trial_')).length;
      
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-semibold mb-2">Year {label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">Success Rate:</span>
              <span className="text-white font-medium">{((successCount / totalCount) * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-green-400">Successful:</span>
              <span className="text-white font-medium">{successCount}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-red-400">Failed:</span>
              <span className="text-white font-medium">{totalCount - successCount}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="card-gradient border-gray-700 widget-card bg-gradient-to-br from-gray-900/40 to-gray-800/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold text-white">Simulation Trials</CardTitle>
          {stats && (
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              stats.successRate >= 80 ? 'bg-green-900/30 text-green-400' :
              stats.successRate >= 60 ? 'bg-yellow-900/30 text-yellow-400' :
              'bg-red-900/30 text-red-400'
            }`}>
              {stats.successRate.toFixed(1)}% Success
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[#B040FF]" />
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
            <p className="text-gray-400 mt-2 text-sm">Running simulations...</p>
          </div>
        ) : stats ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{stats.totalTrials}</p>
                <p className="text-xs text-gray-400">Total Trials</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{stats.successfulTrials}</p>
                <p className="text-xs text-gray-400">Successes</p>
                <p className="text-xs text-gray-500">Money left at end</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{stats.failedTrials}</p>
                <p className="text-xs text-gray-400">Failures</p>
                <p className="text-xs text-gray-500">Ran out of money</p>
              </div>
            </div>

            {/* Graph */}
            {chartData.length > 0 && (
              <div className="relative">
                <h3 className="text-sm font-medium text-white mb-3 text-center">Individual Trials Graph</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
                    <XAxis 
                      dataKey="year"
                      stroke="#9CA3AF"
                      tick={{ fontSize: 10 }}
                      label={{ value: 'Year', position: 'insideBottom', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 10 }}
                      tickFormatter={formatCurrency}
                      label={{ value: 'Portfolio Value', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF', fontSize: 11 } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Draw lines for first 100 trials */}
                    {Array.from({ length: Math.min(100, stats.totalTrials) }, (_, i) => {
                      const isSuccess = simulationData.results[i]?.success;
                      return (
                        <Line
                          key={`trial_${i}`}
                          type="monotone"
                          dataKey={`trial_${i}`}
                          stroke={isSuccess ? '#10B98133' : '#EF444433'}
                          strokeWidth={1}
                          dot={false}
                          animationDuration={0}
                          connectNulls
                        />
                      );
                    })}
                    
                    {/* Reference line at $0 */}
                    <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="5 5" strokeOpacity={0.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Expanded Details */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#B040FF]" />
                    Understanding Your Results
                  </h4>
                  <div className="space-y-2 text-xs text-gray-300">
                    <p>• Each line represents one possible future scenario for your retirement</p>
                    <p>• Green lines: Scenarios where your money lasts through retirement</p>
                    <p>• Red lines: Scenarios where you run out of money</p>
                    <p>• The simulation accounts for market volatility, inflation, and sequence of returns risk</p>
                  </div>
                </div>

                {stats.successRate < 80 && (
                  <div className="bg-yellow-900/20 border border-yellow-500/30 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-300 mb-1">Action Needed</p>
                        <p className="text-xs text-yellow-200/80">
                          Your success rate is below the recommended 80%. Visit the Retirement Planning Center to explore optimization strategies.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 p-3 rounded-lg border border-green-500/20">
                    <p className="text-green-400 font-medium mb-1">Success Factors</p>
                    <ul className="text-green-300/80 space-y-1">
                      <li>• Strong market returns</li>
                      <li>• Lower inflation</li>
                      <li>• Favorable sequence</li>
                    </ul>
                  </div>
                  <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 p-3 rounded-lg border border-red-500/20">
                    <p className="text-red-400 font-medium mb-1">Risk Factors</p>
                    <ul className="text-red-300/80 space-y-1">
                      <li>• Market downturns</li>
                      <li>• High inflation</li>
                      <li>• Early losses</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No simulation data available</p>
            <p className="text-xs mt-1">Complete your financial profile to see projections</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
