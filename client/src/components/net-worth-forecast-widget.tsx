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

interface NetWorthForecastWidgetProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function NetWorthForecastWidget({ 
  isExpanded, 
  onToggle 
}: NetWorthForecastWidgetProps) {
  const [projections, setProjections] = useState<NetWorthProjection[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentNetWorth, setCurrentNetWorth] = useState<number>(0);
  const [targetYear, setTargetYear] = useState<number>(0);
  const [targetNetWorth, setTargetNetWorth] = useState<number>(0);
  const [retirementAge, setRetirementAge] = useState<number>(65);
  
  const fetchProjections = async () => {
    setIsLoading(true);
    setError(null);
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
        
        // Get retirement age from profile
        const profileResponse = await fetch('/api/financial-profile');
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          setRetirementAge(profile.desiredRetirementAge || 65);
        }
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
  const calculateMetrics = () => {
    if (!projections || projections.length < 2) return null;
    
    const retirementProjection = projections.find(p => p.age === retirementAge);
    const finalProjection = projections[projections.length - 1];
    const growthAmount = targetNetWorth - currentNetWorth;
    const growthRate = ((Math.pow(targetNetWorth / currentNetWorth, 1 / (projections.length - 1)) - 1) * 100);
    
    // Check if assets last through retirement
    const depletionAge = projections.find(p => p.savings <= 0 && p.age >= retirementAge)?.age;
    
    return {
      retirementNetWorth: retirementProjection?.totalNetWorth || 0,
      retirementSavings: retirementProjection?.savings || 0,
      finalNetWorth: finalProjection.totalNetWorth,
      finalAge: finalProjection.age,
      growthAmount,
      growthRate,
      depletionAge,
      yearsInRetirement: finalProjection.age - retirementAge
    };
  };

  const metrics = calculateMetrics();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isRetirement = data.age >= retirementAge;
      
      return (
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-2xl">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-white font-semibold text-sm">Year {label}</p>
            <Badge variant={isRetirement ? "secondary" : "default"} className="text-xs">
              Age {data.age}{data.spouseAge ? ` / ${data.spouseAge}` : ''}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <PiggyBank className="w-3 h-3 text-green-400" />
                <span className="text-gray-300 text-sm">Savings:</span>
              </div>
              <span className="text-white font-medium">{formatCurrency(data.savings)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <Home className="w-3 h-3 text-blue-400" />
                <span className="text-gray-300 text-sm">Real Estate:</span>
              </div>
              <span className="text-white font-medium">{formatCurrency(data.realEstate)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3 h-3 text-purple-400" />
                <span className="text-gray-300 text-sm">Other Assets:</span>
              </div>
              <span className="text-white font-medium">{formatCurrency(data.otherAssets)}</span>
            </div>
            {data.debt > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-300 text-sm">Debt:</span>
                <span className="text-red-400 font-medium">-{formatCurrency(data.debt)}</span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-white font-semibold">Total Net Worth:</span>
                <span className="text-green-400 font-bold text-lg">{formatCurrency(data.totalNetWorth)}</span>
              </div>
            </div>
          </div>
          {isRetirement && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-xs text-yellow-400">In Retirement</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-400">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700 shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white">Net Worth Forecast</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">Projection to life expectancy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {metrics && !metrics.depletionAge && (
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                Assets Last
              </Badge>
            )}
            {metrics && metrics.depletionAge && (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                <AlertCircle className="w-3 h-3 mr-1" />
                Depletes Age {metrics.depletionAge}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-8 w-32 bg-gray-800" />
              <Skeleton className="h-8 w-32 bg-gray-800" />
            </div>
            <Skeleton className="h-64 w-full bg-gray-800" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-8">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-gray-400 text-sm">{error}</p>
            <Button onClick={fetchProjections} size="sm" className="mt-4">
              Retry
            </Button>
          </div>
        ) : projections ? (
          <>
            {/* Key Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-gray-400">Current</p>
                </div>
                <p className="text-lg font-bold text-white">{formatCurrency(currentNetWorth)}</p>
              </div>
              
              {metrics && (
                <>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-purple-400" />
                      <p className="text-xs text-gray-400">At Retirement</p>
                    </div>
                    <p className="text-lg font-bold text-white">{formatCurrency(metrics.retirementNetWorth)}</p>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <p className="text-xs text-gray-400">Growth Rate</p>
                    </div>
                    <p className="text-lg font-bold text-green-400">{metrics.growthRate.toFixed(1)}%</p>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-yellow-400" />
                      <p className="text-xs text-gray-400">Final ({targetYear})</p>
                    </div>
                    <p className="text-lg font-bold text-white">{formatCurrency(targetNetWorth)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Main Chart */}
            <div className="h-80 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={projections}
                  margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                >
                  <defs>
                    <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="colorRealEstate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  
                  <XAxis 
                    dataKey="year" 
                    stroke="#9CA3AF"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickFormatter={(value) => `'${String(value).slice(-2)}`}
                  />
                  
                  <YAxis 
                    stroke="#9CA3AF"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickFormatter={formatCompactCurrency}
                  />
                  
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Retirement line */}
                  {projections.find(p => p.age === retirementAge) && (
                    <ReferenceLine 
                      x={projections.find(p => p.age === retirementAge)?.year}
                      stroke="#F59E0B"
                      strokeDasharray="5 5"
                      label={{
                        value: "Retirement",
                        position: "top",
                        fill: "#F59E0B",
                        fontSize: 12
                      }}
                    />
                  )}
                  
                  {/* Stacked areas */}
                  <Area
                    type="monotone"
                    dataKey="savings"
                    stackId="1"
                    stroke="#10B981"
                    fill="url(#colorSavings)"
                    strokeWidth={2}
                    name="Investment Accounts"
                  />
                  <Area
                    type="monotone"
                    dataKey="realEstate"
                    stackId="1"
                    stroke="#3B82F6"
                    fill="url(#colorRealEstate)"
                    strokeWidth={2}
                    name="Real Estate"
                  />
                  <Area
                    type="monotone"
                    dataKey="otherAssets"
                    stackId="1"
                    stroke="#A855F7"
                    fill="url(#colorOther)"
                    strokeWidth={2}
                    name="Other Assets"
                  />
                  
                  <Legend 
                    content={<CustomLegend />}
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Expanded Details */}
            {isExpanded && metrics && (
              <div className="mt-6 space-y-4">
                {/* Milestone Timeline */}
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-400" />
                    Key Milestones
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Retirement (Age {retirementAge})</span>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">{formatCurrency(metrics.retirementNetWorth)}</p>
                        <p className="text-xs text-gray-500">Savings: {formatCurrency(metrics.retirementSavings)}</p>
                      </div>
                    </div>
                    
                    {projections.find(p => p.age === 75) && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Age 75</span>
                        <p className="text-sm font-medium text-white">
                          {formatCurrency(projections.find(p => p.age === 75)!.totalNetWorth)}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Life Expectancy (Age {metrics.finalAge})</span>
                      <p className="text-sm font-medium text-white">{formatCurrency(metrics.finalNetWorth)}</p>
                    </div>
                  </div>
                </div>

                {/* Success Indicators */}
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white mb-2">Projection Analysis</h4>
                      <ul className="space-y-1 text-xs text-gray-300">
                        <li>• Total growth of {formatCurrency(metrics.growthAmount)} over {projections.length - 1} years</li>
                        <li>• Average annual growth rate of {metrics.growthRate.toFixed(1)}%</li>
                        <li>• {metrics.yearsInRetirement} years of retirement funding needed</li>
                        {metrics.depletionAge ? (
                          <li className="text-yellow-400">⚠ Assets may deplete at age {metrics.depletionAge}</li>
                        ) : (
                          <li className="text-green-400">✓ Assets projected to last through life expectancy</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => window.location.href = '/financial-planning-center'}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    Optimize Strategy
                  </Button>
                  <Button
                    onClick={fetchProjections}
                    variant="outline"
                    className="border-gray-600 hover:bg-gray-800"
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}