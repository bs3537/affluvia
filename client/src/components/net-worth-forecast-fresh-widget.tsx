import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ChevronDown, TrendingUp, Info, DollarSign, Home, PiggyBank, Briefcase, Target, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

interface NetWorthProjection {
  year: number;
  age: number;
  spouseAge?: number;
  savings: number;
  realEstate: number;
  otherAssets: number;
  debt: number;
  totalNetWorth: number;
}

interface NetWorthForecastFreshWidgetProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function NetWorthForecastFreshWidget({ 
  isExpanded, 
  onToggle 
}: NetWorthForecastFreshWidgetProps) {
  const [projections, setProjections] = useState<NetWorthProjection[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentNetWorth, setCurrentNetWorth] = useState<number>(0);
  const [targetYear, setTargetYear] = useState<number>(0);
  const [targetNetWorth, setTargetNetWorth] = useState<number>(0);
  const [retirementAge, setRetirementAge] = useState<number>(65);
  const [lastCalculated, setLastCalculated] = useState<Date | null>(null);
  
  const fetchProjections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // First fetch the latest profile data to ensure we have fresh data
      const profileResponse = await fetch('/api/financial-profile');
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile data');
      }
      const profile = await profileResponse.json();
      setRetirementAge(profile.desiredRetirementAge || 65);
      
      // Now calculate projections with the fresh profile data
      // Force recalculation by passing a timestamp
      const response = await fetch('/api/calculate-net-worth-projections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forceRefresh: true,
          timestamp: new Date().getTime()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjections(data.projections);
        setCurrentNetWorth(data.currentNetWorth);
        setTargetNetWorth(data.targetNetWorth);
        setTargetYear(data.targetYear);
        setLastCalculated(new Date());
      } else {
        setError('Failed to calculate net worth projections');
      }
    } catch (error) {
      console.error('Error calculating net worth projections:', error);
      setError('Error loading projections');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjections();
    // Refresh every 30 seconds to ensure fresh data
    const interval = setInterval(fetchProjections, 30000);
    return () => clearInterval(interval);
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

  const formatCompactCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `${value < 0 ? '-' : ''}$${(absValue / 1000000).toFixed(1)}M`;
    }
    return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(0)}K`;
  };

  // Calculate growth metrics
  const retirementProjection = projections?.find(p => p.age === retirementAge);
  const retirementNetWorth = retirementProjection?.totalNetWorth || 0;
  const growthRate = currentNetWorth > 0 
    ? ((targetNetWorth / currentNetWorth) ** (1 / (projections?.length || 1)) - 1) * 100 
    : 0;

  // Find depletion age if assets deplete
  const depletionProjection = projections?.find(p => p.savings <= 0);
  const depletesAtAge = depletionProjection?.age;

  // Prepare chart data
  const chartData = projections?.map(p => ({
    age: p.age,
    year: p.year,
    'Investment Accounts': Math.max(0, p.savings),
    'Real Estate': Math.max(0, p.realEstate),
    'Other Assets': Math.max(0, p.otherAssets),
    'Total': p.totalNetWorth
  })) || [];

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#1a1f2e] border border-gray-700 rounded-lg p-3">
          <p className="text-white font-semibold mb-2">Age {label}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-emerald-400">Investment:</span>
              <span className="text-white">{formatCurrency(data['Investment Accounts'])}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-blue-400">Real Estate:</span>
              <span className="text-white">{formatCurrency(data['Real Estate'])}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-purple-400">Other:</span>
              <span className="text-white">{formatCurrency(data['Other Assets'])}</span>
            </div>
            <div className="border-t border-gray-600 pt-1 mt-1">
              <div className="flex justify-between gap-4 font-semibold">
                <span className="text-gray-300">Total:</span>
                <span className="text-white">{formatCurrency(data['Total'])}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading && !projections) {
    return (
      <Card className="bg-[#242837] border-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-white">
                  Net Worth Forecast (Fresh)
                </CardTitle>
                <p className="text-sm text-gray-400 mt-0.5">
                  Loading latest projections...
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 bg-gray-800" />
            <Skeleton className="h-48 bg-gray-800" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#242837] border-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <CardTitle className="text-lg font-semibold text-white">
                Net Worth Forecast
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-sm">{error}</div>
          <Button 
            onClick={fetchProjections}
            className="mt-4 bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#242837] border-gray-800">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white">
                Net Worth Forecast
              </CardTitle>
              <p className="text-sm text-gray-400 mt-0.5">
                Projection to life expectancy
                {lastCalculated && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Updated {lastCalculated.toLocaleTimeString()})
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {depletesAtAge && (
              <Badge variant="destructive" className="bg-red-900/50 text-red-400 border-red-800">
                <AlertCircle className="h-3 w-3 mr-1" />
                Depletes Age {depletesAtAge}
              </Badge>
            )}
            {!depletesAtAge && targetNetWorth > currentNetWorth && (
              <Badge variant="default" className="bg-emerald-900/50 text-emerald-400 border-emerald-800">
                <TrendingUp className="h-3 w-3 mr-1" />
                Growing
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="text-gray-400 hover:text-white"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Current</p>
            <p className="text-xl font-bold text-white">{formatCurrency(currentNetWorth)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">At Retirement</p>
            <p className="text-xl font-bold text-white">{formatCurrency(retirementNetWorth)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Growth Rate</p>
            <p className="text-xl font-bold text-emerald-400">{growthRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Final ({targetYear})</p>
            <p className="text-xl font-bold text-white">{formatCurrency(targetNetWorth)}</p>
          </div>
        </div>

        {/* Chart - Always show, not just when expanded */}
        {projections && (
          <div className="mt-6">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="investmentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="realEstateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="otherGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="age" 
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickFormatter={(value) => `${value}`}
                />
                <YAxis 
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickFormatter={(value) => formatCompactCurrency(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine 
                  x={retirementAge} 
                  stroke="#f59e0b" 
                  strokeDasharray="5 5" 
                  label={{ value: "Retirement", position: "top", fill: '#f59e0b', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="Investment Accounts"
                  stackId="1"
                  stroke="#10b981"
                  fill="url(#investmentGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Real Estate"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="url(#realEstateGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Other Assets"
                  stackId="1"
                  stroke="#a855f7"
                  fill="url(#otherGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                <span className="text-xs text-gray-400">Investment Accounts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                <span className="text-xs text-gray-400">Real Estate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
                <span className="text-xs text-gray-400">Other Assets</span>
              </div>
            </div>

            {/* Refresh Button */}
            <div className="flex justify-center mt-4">
              <Button 
                onClick={fetchProjections}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={isLoading}
              >
                {isLoading ? 'Refreshing...' : 'Refresh Projections'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}