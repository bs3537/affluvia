import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  ComposedChart,
  ReferenceLine,
  Tooltip as RechartsTooltip
} from 'recharts';
import { 
  Info, 
  TrendingUp, 
  DollarSign,
  Lightbulb,
  FileText,
  Image
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface CashFlowData {
  year: number;
  inflows: {
    grossIncome: number;
    portfolioWithdrawals: number;
    socialSecurity: number;
  };
  outflows: {
    fixed: number;
    discretionary: number;
    insurance: number;
    goalOutflows: number;
    taxesTotal: number;
  };
  effectiveTaxRate: number;
  bracketThresholds: Record<string, number>;
  taxableIncome: number;
  marginalRate: number;
  flags: {
    rothConversionSuggested?: boolean;
    qcdSuggested?: boolean;
    dafBunchingSuggested?: boolean;
  };
}

interface CashFlowMapProps {
  profile: any;
  scenario: {
    retirementAge: number;
    monthlyContribution: number;
    stockAllocation: number;
    inflationRate: number;
    socialSecurityAge: number;
    healthcareCosts: number;
    lifestyleAdjustment: number;
  };
  onScenarioChange?: (scenario: any) => void;
}

// Scenario presets
const SCENARIOS = {
  base: { label: 'Base Case', id: 'base' },
  bear5yr: { label: 'Bear Market (5yr)', id: 'bear5yr' },
  rothConversion: { label: 'Roth Conversion', id: 'rothConversion' },
  delaySS: { label: 'Delay Social Security', id: 'delaySS' }
};

// Custom tooltip for the chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const inflowData = payload.filter((p: any) => ['grossIncome', 'portfolioWithdrawals', 'socialSecurity'].includes(p.dataKey));
  const outflowData = payload.filter((p: any) => ['fixed', 'discretionary', 'insurance', 'goalOutflows', 'taxesTotal'].includes(p.dataKey));
  const taxRateData = payload.find((p: any) => p.dataKey === 'effectiveTaxRate');

  const totalInflows = inflowData.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
  const totalOutflows = outflowData.reduce((sum: number, p: any) => sum + (p.value || 0), 0);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-lg">
      <p className="text-white font-semibold mb-2">Year {label}</p>
      
      <div className="space-y-2">
        <div>
          <p className="text-green-400 font-medium">Inflows: ${totalInflows.toLocaleString()}</p>
          {inflowData.map((entry: any) => (
            <p key={entry.dataKey} className="text-sm text-gray-300 ml-2">
              {entry.name}: ${entry.value.toLocaleString()} ({((entry.value / totalInflows) * 100).toFixed(1)}%)
            </p>
          ))}
        </div>
        
        <div>
          <p className="text-red-400 font-medium">Outflows: ${totalOutflows.toLocaleString()}</p>
          {outflowData.map((entry: any) => (
            <p key={entry.dataKey} className="text-sm text-gray-300 ml-2">
              {entry.name}: ${entry.value.toLocaleString()} ({((entry.value / totalOutflows) * 100).toFixed(1)}%)
            </p>
          ))}
        </div>
        
        {taxRateData && (
          <div className="pt-2 border-t border-gray-700">
            <p className="text-yellow-400">Effective Tax Rate: {taxRateData.value.toFixed(1)}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

export function CashFlowMap({ profile, scenario, onScenarioChange }: CashFlowMapProps) {
  const [selectedScenario, setSelectedScenario] = useState('base');
  const [selectedPercentile, setSelectedPercentile] = useState(50);
  const [showOptimizationBadges, setShowOptimizationBadges] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);

  // Fetch cash flow data
  const { data: cashFlowData, isLoading, refetch } = useQuery<CashFlowData[]>({
    queryKey: ['/api/v2/rpc/cashflow-map', profile?.id, selectedScenario, selectedPercentile, scenario],
    queryFn: async () => {
      console.log('Fetching cash flow data from API with:', { selectedScenario, selectedPercentile, scenario });
      
      const response = await fetch(`/api/v2/rpc/cashflow-map?scenarioId=${selectedScenario}&percentile=${selectedPercentile}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Cash flow data received from API:', data);
      return data;

    },
    enabled: !!profile
  });

  // Trigger refetch when scenario prop or internal state changes
  useEffect(() => {
    if (refetch) {
      refetch();
    }
  }, [scenario, selectedScenario, selectedPercentile, refetch]);

  // Transform data for the chart
  const chartData = useMemo(() => {
    if (!cashFlowData) return [];

    return cashFlowData.map(year => ({
      year: year.year,
      ...year.inflows,
      ...year.outflows,
      effectiveTaxRate: year.effectiveTaxRate,
      flags: year.flags,
      bracketThresholds: year.bracketThresholds,
      taxableIncome: year.taxableIncome,
      marginalRate: year.marginalRate
    }));
  }, [cashFlowData]);

  // Handle year click for drill-down
  const handleYearClick = useCallback((data: any) => {
    if (data && data.activeLabel) {
      setSelectedYear(data.activeLabel);
      setShowMonthlyModal(true);
    }
  }, []);

  // Export functions
  const exportToPNG = useCallback(() => {
    // Implementation would use html2canvas or similar
    console.log('Exporting to PNG...');
  }, []);

  const exportToCSV = useCallback(() => {
    if (!cashFlowData) return;

    const headers = ['Year', 'Gross Income', 'Portfolio Withdrawals', 'Social Security', 
                     'Fixed Expenses', 'Discretionary', 'Insurance', 'Goal Outflows', 
                     'Taxes', 'Effective Tax Rate'];
    
    const rows = cashFlowData.map(year => [
      year.year,
      year.inflows.grossIncome,
      year.inflows.portfolioWithdrawals,
      year.inflows.socialSecurity,
      year.outflows.fixed,
      year.outflows.discretionary,
      year.outflows.insurance,
      year.outflows.goalOutflows,
      year.outflows.taxesTotal,
      year.effectiveTaxRate
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-map-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }, [cashFlowData]);

  if (isLoading || !cashFlowData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-green-400" />
                Interactive Cash-Flow & Tax Map
              </CardTitle>
              <p className="text-gray-400 text-sm mt-2">
                Visualize your annual cash flows, tax rates, and optimization opportunities
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToPNG}
                className="bg-white text-black border-2 border-[#8A00C4] hover:bg-[#8A00C4] hover:text-white transition-all"
              >
                <Image className="h-4 w-4 mr-1" />
                PNG
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToCSV}
                className="bg-white text-black border-2 border-[#8A00C4] hover:bg-[#8A00C4] hover:text-white transition-all"
              >
                <FileText className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-900 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="scenario" className="text-white">Scenario</Label>
              <Select value={selectedScenario} onValueChange={(value) => {
                setSelectedScenario(value);
              }}>
                <SelectTrigger id="scenario" className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SCENARIOS).map(([key, value]) => (
                    <SelectItem key={key} value={value.id}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="percentile" className="text-white">
                Percentile: {selectedPercentile}th
              </Label>
              <Slider
                id="percentile"
                min={10}
                max={90}
                step={10}
                value={[selectedPercentile]}
                onValueChange={([value]) => {
                  setSelectedPercentile(value);
                }}
                className="w-full"
              />
            </div>
            
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOptimizationBadges(!showOptimizationBadges)}
                className="w-3/4 bg-white text-black border-2 border-[#8A00C4] hover:bg-[#8A00C4] hover:text-white transition-all"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                {showOptimizationBadges ? 'Hide' : 'Show'} Tips
              </Button>
            </div>
          </div>

          {/* Key Question */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-white text-center">
              <span className="font-semibold">Key questions answered:</span> "What are my cash flows?" & "When am I most tax-efficient?"
            </p>
          </div>

          {/* Main Chart */}
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={chartData} 
                onClick={handleYearClick}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="year" 
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                  tickFormatter={(value) => `${value}%`}
                />
                
                <RechartsTooltip content={<CustomTooltip />} />
                
                {/* Stacked bars for inflows */}
                <Bar yAxisId="left" dataKey="grossIncome" stackId="inflow" fill="#10b981" name="Gross Income" />
                <Bar yAxisId="left" dataKey="portfolioWithdrawals" stackId="inflow" fill="#14b8a6" name="Portfolio Withdrawals" />
                <Bar yAxisId="left" dataKey="socialSecurity" stackId="inflow" fill="#3b82f6" name="Social Security" />
                
                {/* Stacked bars for outflows */}
                <Bar yAxisId="left" dataKey="fixed" stackId="outflow" fill="#6b7280" name="Fixed Expenses" />
                <Bar yAxisId="left" dataKey="discretionary" stackId="outflow" fill="#f59e0b" name="Discretionary" />
                <Bar yAxisId="left" dataKey="insurance" stackId="outflow" fill="#8b5cf6" name="Insurance" />
                <Bar yAxisId="left" dataKey="goalOutflows" stackId="outflow" fill="#ec4899" name="Goal Outflows" />
                <Bar yAxisId="left" dataKey="taxesTotal" stackId="outflow" fill="#ef4444" name="Taxes" />
                
                {/* Tax rate line */}
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="effectiveTaxRate" 
                  stroke="#fbbf24" 
                  strokeWidth={3}
                  dot={{ fill: '#fbbf24', r: 4 }}
                  name="Effective Tax Rate"
                />
                
                {/* Optimization badges */}
                {showOptimizationBadges && chartData.map((entry, index) => {
                  const badges = [];
                  if (entry.flags?.rothConversionSuggested) {
                    badges.push({ type: 'roth', y: 20 });
                  }
                  if (entry.flags?.qcdSuggested) {
                    badges.push({ type: 'qcd', y: 40 });
                  }
                  if (entry.flags?.dafBunchingSuggested) {
                    badges.push({ type: 'daf', y: 60 });
                  }
                  
                  return badges.map((badge, badgeIndex) => (
                    <ReferenceLine
                      key={`badge-${index}-${badgeIndex}`}
                      x={entry.year}
                      yAxisId="left"
                      stroke="none"
                      label={
                        <g transform={`translate(0, ${badge.y})`}>
                          <circle r="8" fill="#fbbf24" />
                          <text 
                            fill="#000" 
                            fontSize="10" 
                            textAnchor="middle" 
                            dominantBaseline="middle"
                          >
                            {badge.type[0].toUpperCase()}
                          </text>
                        </g>
                      }
                    />
                  ));
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend and Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/50 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Chart Legend
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-gray-300">Income</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-teal-500 rounded"></div>
                  <span className="text-gray-300">Withdrawals</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-gray-300">Social Security</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-gray-300">Taxes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
                  <span className="text-gray-300">Tax Rate</span>
                </div>
              </div>
            </div>
            
            {showOptimizationBadges && (
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-400" />
                  Optimization Opportunities
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500 text-black">R</Badge>
                    <span className="text-gray-300">Roth Conversion opportunity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500 text-black">Q</Badge>
                    <span className="text-gray-300">Qualified Charitable Distribution</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500 text-black">D</Badge>
                    <span className="text-gray-300">Donor-Advised Fund bunching</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Insights */}
          {cashFlowData && (
            <Alert className="bg-blue-900/20 border-blue-800">
              <TrendingUp className="h-4 w-4 text-blue-300" />
              <AlertDescription className="text-gray-300">
                <strong>Insight:</strong> Your effective tax rate peaks at {
                  Math.max(...cashFlowData.map(d => d.effectiveTaxRate)).toFixed(1)
                }% in year {
                  cashFlowData.find(d => d.effectiveTaxRate === Math.max(...cashFlowData.map(d => d.effectiveTaxRate)))?.year
                }. Consider tax-loss harvesting or charitable giving strategies in high-income years.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Monthly Detail Modal */}
      <Dialog open={showMonthlyModal} onOpenChange={setShowMonthlyModal}>
        <DialogContent className="max-w-4xl bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle>Monthly Cash Flow Detail - Year {selectedYear}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <p className="text-gray-400">Monthly breakdown coming soon...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}