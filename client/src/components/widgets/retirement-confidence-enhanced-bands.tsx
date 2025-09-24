import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ReferenceLine, ComposedChart } from 'recharts';
import { Info, TrendingUp, Calculator, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LastCalculated } from '@/components/ui/last-calculated';
import { useDashboardSnapshot, pickWidget } from '@/hooks/useDashboardSnapshot';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

export function RetirementConfidenceEnhancedBands() {
  const [data, setData] = useState<BandsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStart, setLoadingStart] = useState<number | null>(null);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const loadingTimerRef = useRef<number | null>(null);
  const [needsCalculation, setNeedsCalculation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: snapshot } = useDashboardSnapshot();
  const [autoTriggered, setAutoTriggered] = useState(false);
  
  // First try snapshot/DB saved bands for instant paint; allow regenerate via button
  useEffect(() => {
    if (snapshot && !data) {
      const snapBands = pickWidget<BandsResponse>(snapshot, 'retirement_bands');
      if (snapBands && snapBands.ages && snapBands.percentiles) {
        setData(snapBands);
        setNeedsCalculation(false);
        return;
      }
    }
    // If no snapshot, attempt to load saved bands without recomputation
    (async () => {
      try {
        const res = await fetch('/api/retirement-bands', { credentials: 'include' });
        if (res.ok) {
          const saved = await res.json();
          if (saved && saved.ages && saved.percentiles) {
            setData(saved);
            setNeedsCalculation(false);
            return;
          }
        } else if (res.status === 404 && !autoTriggered) {
          // Try to parse response for needsCalculation hint
          let info: any = {};
          try { info = await res.json(); } catch {}
          if (info?.needsCalculation) {
            setAutoTriggered(true);
            await generateBands();
            return;
          }
        }
      } catch {}
    })();
  }, [snapshot, autoTriggered]);

  // Listen for profile updates or dashboard refresh to regenerate bands
  useEffect(() => {
    const handleProfileUpdated = () => {
      // Regenerate on profile update to reflect latest inputs
      generateBands();
    };
    const handleRefresh = () => {
      generateBands();
    };
    window.addEventListener('profileUpdated', handleProfileUpdated);
    window.addEventListener('refreshDashboard', handleRefresh);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdated);
      window.removeEventListener('refreshDashboard', handleRefresh);
    };
  }, []);

  const generateBands = async () => {
    setLoading(true);
    setLoadingStart(Date.now());
    setLoadingSeconds(0);
    setError(null);
    try {
      const response = await fetch('/api/calculate-retirement-bands', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipCache: false })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate confidence bands');
      }
      
      const result = await response.json();
      setData(result);
      setNeedsCalculation(false);
    } catch (e: any) {
      console.error('Bands generation error', e);
      setError(e.message || 'Failed to generate confidence bands');
    } finally {
      setLoading(false);
      setLoadingStart(null);
      setLoadingSeconds(0);
    }
  };

  // Update the visible loading seconds while generating
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

  const chartData = useMemo(() => {
    if (!data) return [] as any[];
    const { ages, percentiles } = data;
    const rows = ages.map((age, i) => {
      const p75 = percentiles.p75?.[i] ?? 0;
      const p50 = percentiles.p50?.[i] ?? 0;
      const p25 = percentiles.p25?.[i] ?? 0;
      // Server intentionally slims payload to p25/p50/p75.
      // Fall back to p75/p25 for missing tails to avoid runtime errors.
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

  const retirementAge = data?.meta?.retirementAge;

  return (
    <Card className="card-gradient border-gray-700 hover-lift widget-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold text-white">Retirement Portfolio Projections (Baseline)</CardTitle>
        {!needsCalculation && (
          <Button
            size="sm"
            variant="ghost"
            onClick={generateBands}
            disabled={loading}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </CardHeader>
      {!needsCalculation && (
        <div className="px-6 -mt-2">
          <LastCalculated timestamp={data?.meta?.calculatedAt} />
        </div>
      )}
      <CardContent className="space-y-4">
        {needsCalculation ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <TrendingUp className="w-12 h-12 text-gray-400" />
            <p className="text-gray-400 text-center">
              Generate detailed retirement confidence bands
            </p>
          <Button
              onClick={generateBands}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Calculator className="w-4 h-4" />
              {loading ? `Generating... ${loadingSeconds.toFixed(1)}s` : 'Generate Confidence Bands'}
            </Button>
            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
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
                      <h4 className="font-semibold text-white mb-2">Methodology</h4>
                      <p><strong>Monte Carlo Simulation:</strong> Runs 1,000+ scenarios using historical market volatility patterns to project portfolio growth through retirement.</p>
                      <p><strong>Real Returns:</strong> Uses inflation-adjusted returns (μ=5.0%, σ=12.0%) to show purchasing power in today's dollars.</p>
                      <p><strong>Percentiles Explained:</strong></p>
                      <ul className="ml-4 space-y-1 text-xs">
                        <li>• <strong>75th:</strong> Good case - 25% of scenarios exceed this</li>
                        <li>• <strong>50th (Median):</strong> Most likely outcome</li>
                        <li>• <strong>25th:</strong> Conservative case - 75% of scenarios exceed this</li>
                      </ul>
                      <p className="text-xs text-gray-400 mt-2">This helps you understand the range of possible portfolio outcomes and plan accordingly.</p>
                    </div>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
              <span>Portfolio value percentiles (75/50/25) in today's dollars</span>
            </div>
            {data?.calculationTime && (
              <div className="text-xs text-gray-500">
                Calculated in {(data.calculationTime / 1000).toFixed(1)}s
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
                    <ReferenceLine x={retirementAge} stroke="#60A5FA" strokeDasharray="5 5" label={{ value: 'Retirement', position: 'top', fill: '#60A5FA' }} />
                  )}

                  {/* Middle band (25-75): light blue matching reference */}
                  <Area type="monotone" dataKey="midBase" stackId="mid" stroke="none" fill="transparent" />
                  <Area type="monotone" dataKey="midFill" stackId="mid" stroke="none" fill="#7DB4CC" fillOpacity={0.6} />

                  {/* Boundary lines (subtle, matching area colors) */}
                  <Line type="monotone" dataKey="p75" stroke="#7DB4CC" strokeWidth={1} strokeOpacity={0.8} dot={false} />
                  <Line type="monotone" dataKey="p25" stroke="#7DB4CC" strokeWidth={1} strokeOpacity={0.8} dot={false} />

                  {/* Median line: thick orange/gold line matching reference - render last to appear on top */}
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
