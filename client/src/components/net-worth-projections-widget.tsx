import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ChevronDown, TrendingUp, Info, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface NetWorthProjection {
  year: number;
  age: number;
  spouseAge?: number;
  savings: number;
  realEstate: number;
  otherAssets: number;
  debt: number;
  totalNetWorth: number;
  confidenceIntervals?: {
    percentile10: number;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    percentile90: number;
  };
}

interface NetWorthProjectionsWidgetProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function NetWorthProjectionsWidget({ 
  isExpanded, 
  onToggle 
}: NetWorthProjectionsWidgetProps) {
  const [projections, setProjections] = useState<NetWorthProjection[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentNetWorth, setCurrentNetWorth] = useState<number>(0);
  const [targetYear, setTargetYear] = useState<number>(2059); // Default from screenshot
  const [targetNetWorth, setTargetNetWorth] = useState<number>(0);
  
  const fetchProjections = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/calculate-net-worth-projections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjections(data.projections);
        setCurrentNetWorth(data.currentNetWorth);
        setTargetNetWorth(data.targetNetWorth);
        setTargetYear(data.targetYear);
      } else {
        console.error('Failed to calculate net worth projections');
      }
    } catch (error) {
      console.error('Error calculating net worth projections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!projections) {
      fetchProjections();
    }
  }, []);

  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000000) {
      return `${amount < 0 ? '-' : ''}$${(absAmount / 1000000).toFixed(1)}M`;
    } else if (absAmount >= 1000) {
      return `${amount < 0 ? '-' : ''}$${(absAmount / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-semibold mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-green-400">Savings:</span>
              <span className="text-white font-medium">{formatCurrency(data.savings)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-blue-400">Real Estate:</span>
              <span className="text-white font-medium">{formatCurrency(data.realEstate)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-yellow-400">Other Assets:</span>
              <span className="text-white font-medium">{formatCurrency(data.otherAssets)}</span>
            </div>
            {data.debt > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-red-400">Debt:</span>
                <span className="text-white font-medium">{formatCurrency(-data.debt)}</span>
              </div>
            )}
            <div className="border-t border-gray-600 pt-1 mt-1">
              <div className="flex justify-between gap-4">
                <span className="text-purple-400 font-semibold">Total:</span>
                <span className="text-white font-bold">{formatCurrency(data.totalNetWorth)}</span>
              </div>
            </div>
          </div>
          {data.spouseAge && (
            <p className="text-xs text-gray-400 mt-2">Spouse Age: {data.spouseAge}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="card-gradient border-gray-700 widget-card bg-gradient-to-br from-gray-900/40 to-gray-800/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-white">Net Worth Forecast</CardTitle>
            {projections && (
              <div className="px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400">
                {formatCurrency(targetNetWorth)} by {targetYear}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-400" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-6 w-6 p-0 text-gray-400 hover:text-white expand-toggle-btn"
            aria-expanded={isExpanded}
            aria-label="Toggle net worth projections details"
          >
            <ChevronDown className={`w-4 h-4 chevron-icon ${isExpanded ? 'rotated' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="text-gray-400 mt-2 text-sm">Calculating projections...</p>
          </div>
        ) : projections ? (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-400">Current Net Worth</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(currentNetWorth)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Projected at {targetYear}</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(targetNetWorth)}</p>
                </div>
              </div>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={projections}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.3}/>
                      </linearGradient>
                      <linearGradient id="colorRealEstate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      </linearGradient>
                      <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.3}/>
                      </linearGradient>
                      <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="year" 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="debt"
                      stackId="1"
                      stroke="#EF4444"
                      fill="url(#colorDebt)"
                      name="Debt"
                    />
                    <Area
                      type="monotone"
                      dataKey="otherAssets"
                      stackId="1"
                      stroke="#F59E0B"
                      fill="url(#colorOther)"
                      name="Other Assets"
                    />
                    <Area
                      type="monotone"
                      dataKey="realEstate"
                      stackId="1"
                      stroke="#3B82F6"
                      fill="url(#colorRealEstate)"
                      name="Real Estate"
                    />
                    <Area
                      type="monotone"
                      dataKey="savings"
                      stackId="1"
                      stroke="#10B981"
                      fill="url(#colorSavings)"
                      name="Savings"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <p className="text-xs text-gray-500 text-center">
                  Based on current savings rate and investment returns
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-transparent">
                      <Info className="w-3 h-3 text-gray-400 hover:text-white" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 bg-gray-800 border-gray-700" align="center">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-white text-sm">Net Worth Projection Methodology</h4>
                      <div className="space-y-2 text-xs text-gray-300">
                        <p>
                          This projection uses your current assets, savings rate, and expected returns to forecast your net worth over time.
                        </p>
                        <p>
                          The projection includes:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Investment account growth based on your risk profile</li>
                          <li>Real estate appreciation (4.0-4.3% annually based on 50-year historical average)</li>
                          <li>Regular contributions from savings</li>
                          <li>Debt paydown schedules</li>
                          <li>Inflation adjustments</li>
                        </ul>
                        <p className="text-gray-400 mt-2">
                          Note: This is a median projection. Actual results will vary based on market conditions.
                        </p>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {isExpanded && (
              <div className="space-y-6 border-t border-gray-700 pt-6">
                {/* Asset Breakdown at Target Year */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-white">Projected Asset Breakdown ({targetYear})</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-green-400">Savings</span>
                        <span className="text-sm font-medium text-white">
                          {projections && formatCurrency(projections[projections.length - 1].savings)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-400">Real Estate</span>
                        <span className="text-sm font-medium text-white">
                          {projections && formatCurrency(projections[projections.length - 1].realEstate)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-yellow-400">Other Assets</span>
                        <span className="text-sm font-medium text-white">
                          {projections && formatCurrency(projections[projections.length - 1].otherAssets)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-red-400">Debt</span>
                        <span className="text-sm font-medium text-white">
                          {projections && formatCurrency(-projections[projections.length - 1].debt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-700 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-purple-400">Total Net Worth</span>
                      <span className="text-lg font-bold text-white">
                        {projections && formatCurrency(projections[projections.length - 1].totalNetWorth)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Growth Summary */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-purple-400" />
                    <h4 className="text-sm font-medium text-white">Growth Summary</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Total Growth</p>
                      <p className="text-white font-medium">
                        {projections && formatCurrency(targetNetWorth - currentNetWorth)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Annual Growth Rate</p>
                      <p className="text-white font-medium">
                        {projections && `${((Math.pow(targetNetWorth / currentNetWorth, 1 / (projections.length - 1)) - 1) * 100).toFixed(1)}%`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={() => window.location.href = '/financial-planning-center'}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg"
                  >
                    Explore Wealth Building Strategies
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>Unable to calculate net worth projections</p>
            <Button onClick={fetchProjections} className="mt-4">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}