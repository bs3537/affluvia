import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ReferenceLine, ComposedChart } from 'recharts';
import { Info, TrendingUp, Calculator, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LastCalculated } from '@/components/ui/last-calculated';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDashboardSnapshot, pickWidget } from '@/hooks/useDashboardSnapshot';

type BandsResponse = {
  ages: number[];
  percentiles: {
    p05?: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95?: number[];
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

interface RetirementPortfolioProjectionsOptimizedProps {
  variables?: any;
  profile?: any;
  className?: string;
  active?: boolean;
  autoGenerateOnActive?: boolean;
}

const currency = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  // Filter to only show individual percentiles
  const relevantData = payload.filter((entry: any) => 
    ['p75', 'p50', 'p25'].includes(entry.dataKey)
  );

  if (relevantData.length === 0) return null;

  const labelMap: { [key: string]: string } = {
    'p75': '75th Percentile', 
    'p50': 'Median',
    'p25': '25th Percentile',
  };

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
      <p className="text-gray-200 font-medium mb-2">{`Age ${label}`}</p>
      {relevantData.map((entry: any) => {
        const isMedian = entry.dataKey === 'p50';
        return (
          <div key={entry.dataKey} className="flex justify-between items-center">
            <span className={`text-sm ${isMedian ? 'font-bold text-white' : 'text-gray-300'}`}>
              {labelMap[entry.dataKey]}:
            </span>
            <span className={`ml-2 ${isMedian ? 'font-bold text-white' : 'text-gray-200'}`}>
              {currency(entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export function RetirementPortfolioProjectionsOptimized({ 
  variables,
  profile,
  className = '',
  active = false,
  autoGenerateOnActive = false,
}: RetirementPortfolioProjectionsOptimizedProps) {
  const [data, setData] = useState<BandsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStart, setLoadingStart] = useState<number | null>(null);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const loadingTimerRef = useRef<number | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: snapshot } = useDashboardSnapshot();
  
  // Use provided variables or fall back to saved optimization variables from profile
  const optimizationVariables = variables || profile?.optimizationVariables || {};
  const hasOptimizationData = optimizationVariables && 
    (optimizationVariables.retirementAge || optimizationVariables.socialSecurityAge);
  
  // Prefer snapshot/DB data; do not auto-generate. Poll briefly for presence.
  useEffect(() => {
    // First try snapshot for instant paint
    if (snapshot && !data) {
      const snapBands = pickWidget<BandsResponse>(snapshot, 'retirement_bands_optimized');
      if (snapBands && snapBands.ages && snapBands.percentiles) {
        setData(snapBands);
        setHasCalculated(true);
        return;
      }
    }
    const varsMatch = (a: any, b: any) => {
      const keys = ['retirementAge','spouseRetirementAge','socialSecurityAge','spouseSocialSecurityAge',
        'assetAllocation','spouseAssetAllocation','monthlyEmployee401k','monthlyEmployer401k',
        'annualTraditionalIRA','annualRothIRA','spouseMonthlyEmployee401k','spouseMonthlyEmployer401k',
        'spouseAnnualTraditionalIRA','spouseAnnualRothIRA','monthlyExpenses','partTimeIncome',
        'spousePartTimeIncome','hasLongTermCareInsurance'];
      if (!a || !b) return false;
      // Normalize values to handle undefined/null/0 differences
      const normalize = (v: any) => (v === undefined || v === null) ? 0 : v;
      return keys.every(k => {
        // For string values, don't normalize to 0
        if (k === 'assetAllocation' || k === 'spouseAssetAllocation') {
          return a[k] === b[k];
        }
        return normalize(a[k]) === normalize(b[k]);
      });
    };

    const cachedBands = profile?.optimizationVariables?.optimizedRetirementBands;
    const savedVars = profile?.optimizationVariables;

    if (cachedBands && varsMatch(optimizationVariables, savedVars)) {
      setData(cachedBands);
      setHasCalculated(true);
      return;
    }

    // Poll for a short window to load saved bands (no fallback generation here)
    let attempts = 0;
    const maxAttempts = 10; // ~20s at 2s interval
    const timer = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/financial-profile', { credentials: 'include' });
        if (res.ok) {
          const p = await res.json();
          const bands = p?.optimizationVariables?.optimizedRetirementBands;
          const sVars = p?.optimizationVariables;
          if (bands && varsMatch(optimizationVariables, sVars)) {
            setData(bands);
            setHasCalculated(true);
            clearInterval(timer);
          }
        }
      } catch (_) {}
      if (attempts >= maxAttempts) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [profile, snapshot, hasOptimizationData, optimizationVariables]);

  // Auto-generate when this tab becomes active for the first time and we don't have data yet
  const [autoKicked, setAutoKicked] = useState(false);
  useEffect(() => {
    if (!active || autoKicked) return;
    const hasData = !!(data && data.ages && data.percentiles);
    if (!hasData && autoGenerateOnActive) {
      setAutoKicked(true);
      generateBands();
    }
  }, [active, autoGenerateOnActive, data, autoKicked]);

  const generateBands = async () => {
    if (!hasOptimizationData) {
      setError('Please save optimization variables first');
      return;
    }
    
    setLoading(true);
    setLoadingStart(Date.now());
    setLoadingSeconds(0);
    setError(null);
    
    try {
      console.log('Calculating optimized retirement bands with variables:', optimizationVariables);
      
      const response = await fetch('/api/calculate-retirement-bands-optimization', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimizationVariables)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate optimized confidence bands');
      }
      
      const result = await response.json();
      console.log('Optimized retirement bands calculated:', result);
      setData(result);
      setHasCalculated(true);
      
      // Save to cache for future use (minimal payload only)
      try {
        const cacheResponse = await fetch('/api/financial-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            // Avoid overwriting saved optimization variables with defaults
            optimizationVariables: { optimizedRetirementBands: result }
          })
        });
        if (cacheResponse.ok) {
          console.log('Optimized retirement bands cached successfully');
        }
      } catch (cacheErr) {
        console.warn('Failed to cache optimized retirement bands:', cacheErr);
      }
    } catch (e: any) {
      console.error('Bands generation error:', e);
      setError(e.message || 'Failed to generate optimized confidence bands');
    } finally {
      setLoading(false);
      setLoadingStart(null);
      setLoadingSeconds(0);
    }
  };

  // Update loading seconds while generating
  useEffect(() => {
    if (loading && loadingStart) {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
      }
      loadingTimerRef.current = window.setInterval(() => {
        setLoadingSeconds((Date.now() - loadingStart) / 1000);
      }, 100);
    }
    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [loading, loadingStart]);

  // Auto-refresh on optimization completion (mirrors the other widget)
  useEffect(() => {
    const onUpdated = () => {
      setData(null);
      setHasCalculated(false);
      generateBands();
    };
    window.addEventListener('retirementOptimizationUpdated', onUpdated as any);
    return () => window.removeEventListener('retirementOptimizationUpdated', onUpdated as any);
  }, [optimizationVariables]);

  const chartData = useMemo(() => {
    if (!data) return [] as any[];
    const { ages, percentiles } = data;
    const rows = ages.map((age, i) => {
      const p75 = percentiles.p75?.[i] ?? 0;
      const p50 = percentiles.p50?.[i] ?? 0;
      const p25 = percentiles.p25?.[i] ?? 0;
      const p95 = percentiles.p95?.[i] ?? p75;
      const p05 = percentiles.p05?.[i] ?? p25;
      return { age, p95, p75, p50, p25, p05 };
    });
    // Derive stacked areas for band fills
    return rows.map(r => ({
      ...r,
      // middle band (25-75)
      midBase: r.p25,
      midFill: Math.max(0, r.p75 - r.p25),
      // upper tail (75-95)
      upperBase: r.p75,
      upperFill: Math.max(0, r.p95 - r.p75),
      // lower tail (5-25)
      lowerBase: r.p05,
      lowerFill: Math.max(0, r.p25 - r.p05),
    }));
  }, [data]);

  const retirementAge = data?.meta?.retirementAge || optimizationVariables?.retirementAge;

  return (
    <Card className={`card-gradient border-gray-700 bg-gradient-to-br from-gray-900 to-gray-800 ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-semibold text-white">
            Retirement Portfolio Projections (Optimized Plan)
          </CardTitle>
          <p className="text-sm text-gray-400 mt-1">
            Portfolio projections using your optimized retirement variables
          </p>
        </div>
        {hasCalculated && (
          <Button
            size="sm"
            variant="ghost"
            onClick={generateBands}
            disabled={loading || !hasOptimizationData}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
            title={!hasOptimizationData ? 'Save optimization variables first' : 'Refresh projections'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </CardHeader>
      <div className="px-6 -mt-2">
        <LastCalculated timestamp={data?.meta?.calculatedAt} onRefresh={generateBands} refreshing={loading} />
      </div>
      <CardContent className="space-y-4">
        {!hasCalculated ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <TrendingUp className="w-12 h-12 text-gray-400" />
            <p className="text-gray-400 text-center">
              {!hasOptimizationData 
                ? 'Save optimization variables to enable projections' 
                : 'Generate detailed retirement confidence bands'}
            </p>
            <Button
              onClick={generateBands}
              disabled={loading || !hasOptimizationData}
              className="flex items-center gap-2"
            >
              <Calculator className="w-4 h-4" />
              {loading ? `Generating... ${loadingSeconds.toFixed(1)}s` : 'Generate Confidence Bands'}
            </Button>
            {error && (
              <p className="text-red-400 text-sm text-center max-w-sm">{error}</p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-md p-4 !bg-gray-900 !border-gray-600 !text-gray-200 shadow-2xl">
                    <div className="space-y-2 text-sm text-gray-200">
                      <h4 className="font-semibold text-white mb-2">Optimized Projections</h4>
                      <p><strong>Uses Optimization Variables:</strong> These projections use your optimized retirement age, contribution amounts, Social Security timing, and other variables from the optimization form.</p>
                      <p><strong>Monte Carlo Simulation:</strong> Runs 1,000+ scenarios using historical market volatility patterns to project portfolio growth through retirement.</p>
                      <p><strong>Real Returns:</strong> Uses inflation-adjusted returns to show purchasing power in today's dollars.</p>
                      <p><strong>Percentiles Explained:</strong></p>
                      <ul className="ml-4 space-y-1 text-xs">
                        <li>• <strong>75th:</strong> Good case - 25% of scenarios exceed this</li>
                        <li>• <strong>50th (Median):</strong> Most likely outcome with optimization</li>
                        <li>• <strong>25th:</strong> Conservative case - 75% of scenarios exceed this</li>
                      </ul>
                      <p className="text-xs text-gray-400 mt-2">This helps you understand the range of possible portfolio outcomes with your optimized plan.</p>
                    </div>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
              <span>Optimized portfolio value percentiles (75/50/25) in today's dollars</span>
            </div>
            {data?.calculationTime && (
              <div className="text-xs text-gray-500">
                Calculated in {(data.calculationTime / 1000).toFixed(1)}s
                {data?.cached && ' (cached)'}
              </div>
            )}
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <ComposedChart data={chartData} margin={{ top: 30, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="age" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                  <YAxis stroke="#9CA3AF" tickFormatter={currency} tick={{ fill: '#9CA3AF' }} />
                  <Tooltip content={<CustomTooltip />} />

                  {/* Reference line for retirement age */}
                  {retirementAge && (
                    <ReferenceLine 
                      x={retirementAge} 
                      stroke="#60A5FA" 
                      strokeDasharray="5 5" 
                      label={{ value: 'Retirement', position: 'top', fill: '#60A5FA' }} 
                    />
                  )}

                  {/* Middle band (25-75): light blue matching dashboard */}
                  <Area type="monotone" dataKey="midBase" stackId="mid" stroke="none" fill="transparent" />
                  <Area type="monotone" dataKey="midFill" stackId="mid" stroke="none" fill="#7DB4CC" fillOpacity={0.6} />

                  {/* Boundary lines (subtle, matching area colors) */}
                  <Line type="monotone" dataKey="p75" stroke="#7DB4CC" strokeWidth={1} strokeOpacity={0.8} dot={false} />
                  <Line type="monotone" dataKey="p25" stroke="#7DB4CC" strokeWidth={1} strokeOpacity={0.8} dot={false} />

                  {/* Median line: thick orange/gold line matching dashboard - render last to appear on top */}
                  <Line type="monotone" dataKey="p50" stroke="#F59E0B" strokeWidth={4} strokeOpacity={1} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
