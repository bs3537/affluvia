import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useMonteCarloWorker } from '@/hooks/useMonteCarloWorker';
import { seedFromParams } from '@/lib/seed';
import { buildMonteCarloParams } from '@/lib/montecarlo-params';

type SimulationIteration = {
  yearlyData: Array<{ age: number; year?: number; portfolioValue: number }>
};

export function RetirementAssetsProjectionWidget() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { runSimulation } = useMonteCarloWorker();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Client-first
        const profileRes = await fetch('/api/financial-profile', { credentials: 'include' });
        if (!profileRes.ok) throw new Error('Failed to fetch profile');
        const profile = await profileRes.json();
        const params = buildMonteCarloParams(profile);
        const result = await runSimulation(params, 1000);
        setData(result);
      } catch (e) {
        // Fallback to server
        try {
          const res = await fetch('/api/calculate-retirement-monte-carlo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skipCache: false, seed: seedFromParams(undefined, 'retirement-assets-projection') })
          });
          if (!res.ok) throw new Error('Failed to fetch Monte Carlo');
          const result = await res.json();
          setData(result);
        } catch (serverErr) {
          console.error('RetirementAssetsProjectionWidget error:', serverErr);
          setData(null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [runSimulation]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const hasServer = data.results && data.results.length > 0;
    let currentAge = 50;
    const targetAge = 93;
    const currentYear = new Date().getFullYear();
    const valuesByAge: Record<number, number[]> = {};
    for (let age = currentAge; age <= targetAge; age++) valuesByAge[age] = [];

    if (hasServer) {
      const trials: SimulationIteration[] = data.results;
      const first = trials[0];
      currentAge = Math.floor(first.yearlyData?.[0]?.age || 50);
      trials.forEach(trial => {
        trial.yearlyData?.forEach(y => {
          const age = Math.floor(y.age);
          if (age >= currentAge && age <= targetAge) {
            valuesByAge[age].push(Number(y.portfolioValue || 0));
          }
        });
      });
    } else if (data.yearlyCashFlows && data.yearlyCashFlows.length) {
      currentAge = Math.floor(data.yearlyCashFlows?.[0]?.age || 50);
      data.yearlyCashFlows.forEach((y: any, idx: number) => {
        const age = Math.floor(y.age || (currentAge + idx));
        if (age >= currentAge && age <= targetAge) {
          valuesByAge[age].push(Number(y.portfolioBalance || y.portfolioValue || 0));
        }
      });
    } else {
      return [];
    }

    const percentile = (arr: number[], p: number) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = (p / 100) * (sorted.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (hi === lo) return sorted[lo];
      const w = idx - lo;
      return sorted[lo] * (1 - w) + sorted[hi] * w;
    };

    // Build rows for Recharts
    const rows: Array<any> = [];
    for (let age = currentAge; age <= targetAge; age++) {
      const vals = valuesByAge[age];
      let p5 = 0, p25 = 0, p50 = 0, p75 = 0, p95 = 0;
      if (vals.length) {
        p5 = Math.max(0, percentile(vals, 5));
        p25 = Math.max(0, percentile(vals, 25));
        p50 = Math.max(0, percentile(vals, 50));
        p75 = Math.max(0, percentile(vals, 75));
        p95 = Math.max(0, percentile(vals, 95));
      } else if (rows.length) {
        // Use last known values if no data for this age
        const prev = rows[rows.length - 1];
        p5 = prev.p5; p25 = prev.p25; p50 = prev.p50; p75 = prev.p75; p95 = prev.p95;
      }
      rows.push({
        age,
        year: currentYear + (age - currentAge),
        p5, p25, p50, p75, p95,
        // Ranges for bands
        range5to95: [p5, p95],
        range25to75: [p25, p75]
      });
    }

    return rows;
  }, [data]);

  const formatCurrency = (value: number): string => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${(value || 0).toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-2 text-xs min-w-[180px]">
          <div className="text-gray-300 font-semibold mb-1">Age {label} ({d.year})</div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-gray-400"><span>95th</span><span className="text-gray-200">{formatCurrency(d.p95)}</span></div>
            <div className="flex justify-between text-gray-400"><span>75th</span><span className="text-gray-200">{formatCurrency(d.p75)}</span></div>
            <div className="flex justify-between text-blue-400 font-medium"><span>Median</span><span>{formatCurrency(d.p50)}</span></div>
            <div className="flex justify-between text-gray-400"><span>25th</span><span className="text-gray-200">{formatCurrency(d.p25)}</span></div>
            <div className="flex justify-between text-gray-400"><span>5th</span><span className="text-gray-200">{formatCurrency(d.p5)}</span></div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="card-gradient border-gray-700 hover-lift widget-card">
      <CardHeader className="flex items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#60A5FA]" />
          <CardTitle className="text-lg font-semibold text-white">Retirement Assets Projection</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !chartData.length ? (
          <div className="h-[300px] flex items-center justify-center text-gray-400">Loading projections…</div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {/* Light outer band (5-95) */}
                  <linearGradient id="bandOuter" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.06} />
                  </linearGradient>
                  {/* Dark inner band (25-75) */}
                  <linearGradient id="bandInner" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.14} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="age"
                  stroke="#9CA3AF"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => (v % 5 === 0 ? v : '')}
                />
                <YAxis
                  stroke="#9CA3AF"
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatCurrency}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Outer band 5-95 */}
                <Area type="monotone" dataKey="range5to95" stroke="none" fill="url(#bandOuter)" fillOpacity={1} />
                {/* Inner band 25-75 */}
                <Area type="monotone" dataKey="range25to75" stroke="none" fill="url(#bandInner)" fillOpacity={1} />
                {/* Median line */}
                <Area type="monotone" dataKey="p50" stroke="#3B82F6" strokeWidth={3} fill="none" dot={false} />

                {/* Retirement marker if available */}
                {data?.retirementAge && (
                  <ReferenceLine x={data.retirementAge} stroke="#6B7280" strokeDasharray="5 5" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
