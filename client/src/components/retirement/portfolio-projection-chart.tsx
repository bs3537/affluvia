import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Info } from 'lucide-react';

interface CashFlow {
  year: number;
  age: number;
  portfolioBalance: number;
  withdrawal?: number;
  guaranteedIncome?: number;
  netCashFlow?: number;
}

interface PortfolioProjectionChartProps {
  yearlyCashFlows: CashFlow[];
  percentile10CashFlows?: CashFlow[];
  percentile90CashFlows?: CashFlow[];
  showPercentiles?: boolean;
  height?: number;
}

export function PortfolioProjectionChart({
  yearlyCashFlows,
  percentile10CashFlows,
  percentile90CashFlows,
  showPercentiles = true,
  height = 300
}: PortfolioProjectionChartProps) {
  // Combine data for all percentiles
  const combinedData = yearlyCashFlows.map((flow, index) => {
    const data: any = {
      year: flow.year,
      age: flow.age,
      median: Math.max(0, flow.portfolioBalance),
    };

    if (showPercentiles && percentile10CashFlows && percentile90CashFlows) {
      data.percentile10 = Math.max(0, percentile10CashFlows[index]?.portfolioBalance || 0);
      data.percentile90 = Math.max(0, percentile90CashFlows[index]?.portfolioBalance || 0);
      // Calculate the range for the area between percentiles
      data.percentileRange = [data.percentile10, data.percentile90 - data.percentile10];
    }

    return data;
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-semibold mb-2">Year {label} (Age {data.age})</p>
          <div className="space-y-1 text-sm">
            {showPercentiles && data.percentile90 !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-green-400">90th Percentile:</span>
                <span className="text-white font-medium">{formatCurrency(data.percentile90)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-blue-400">Median (50th):</span>
              <span className="text-white font-medium">{formatCurrency(data.median)}</span>
            </div>
            {showPercentiles && data.percentile10 !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-red-400">10th Percentile:</span>
                <span className="text-white font-medium">{formatCurrency(data.percentile10)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-white">Portfolio Balance Projections</h4>
        <div className="group relative">
          <Info className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 rounded-lg border border-gray-700 text-xs text-gray-300 z-10">
            Shows the range of possible portfolio outcomes based on 1,000 Monte Carlo simulations. 
            The shaded area represents the 10th to 90th percentile range (80% of outcomes).
          </div>
        </div>
      </div>
      
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={combinedData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorPercentileRange" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorMedian" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.3}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            
            <XAxis 
              dataKey="year" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
            />
            
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={formatCurrency}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {showPercentiles && percentile10CashFlows && percentile90CashFlows && (
              <Area
                type="monotone"
                dataKey="percentileRange"
                stackId="1"
                stroke="none"
                fill="url(#colorPercentileRange)"
                name="10th-90th Percentile Range"
              />
            )}
            
            <Area
              type="monotone"
              dataKey="median"
              stackId={showPercentiles ? "2" : "1"}
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#colorMedian)"
              name="Median (Expected)"
            />
            
            <Legend 
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="rect"
              formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: '12px' }}>{value}</span>}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {showPercentiles && (
        <div className="text-xs text-gray-400 space-y-1">
          <p>• <span className="text-green-400">Green line</span>: Expected (median) portfolio balance</p>
          <p>• <span className="text-blue-400">Blue shaded area</span>: Range containing 80% of simulation outcomes</p>
          <p>• Portfolio may be depleted in worst-case scenarios (10th percentile)</p>
        </div>
      )}
    </div>
  );
}