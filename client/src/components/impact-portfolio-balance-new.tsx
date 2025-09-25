import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { BarChart3, RefreshCw, TrendingUp, Calculator, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LastCalculated } from '@/components/ui/last-calculated';

type BandsResponse = {
  ages: number[];
  percentiles: {
    p05: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
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

interface ProjectionData {
  age: number;
  baseline: number;
  optimized: number;
  difference: number;
}

interface Comparison {
  finalBaseline: number;
  finalOptimized: number;
  finalDifference: number;
  percentageImprovement: number;
}

interface ImpactPortfolioBalanceNewProps {
  variables: any;
  isLocked?: boolean; // Made optional since we're not using it anymore
  profile: any;
  active?: boolean;
  autoStartOnActive?: boolean;
}

const isProjectionDataValid = (rows: any): boolean => {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  let hasFiniteRow = false;
  let hasBaselinePositive = false;
  let hasOptimizedPositive = false;

  for (const row of rows) {
    const baseline = Number(row?.baseline ?? 0);
    const optimized = Number(row?.optimized ?? 0);

    if (Number.isFinite(baseline) || Number.isFinite(optimized)) {
      hasFiniteRow = true;
    }
    if (Number.isFinite(baseline) && baseline > 0) {
      hasBaselinePositive = true;
    }
    if (Number.isFinite(optimized) && optimized > 0) {
      hasOptimizedPositive = true;
    }
  }

  if (!hasFiniteRow) return false;
  if (hasBaselinePositive && !hasOptimizedPositive) return false;
  return true;
};

const currency = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
      <p className="text-gray-200 font-medium mb-2">{`Age ${label}`}</p>
      {payload.map((entry: any, index: number) => {
        const isBaseline = entry.dataKey === 'baseline';
        const isOptimized = entry.dataKey === 'optimized';
        
        if (isBaseline || isOptimized) {
          return (
            <div key={entry.dataKey} className="flex justify-between items-center">
              <span className="text-sm text-gray-300">
                {isBaseline ? 'Baseline Plan:' : 'Optimized Plan:'}
              </span>
              <span className="ml-2 text-gray-200">
                {currency(entry.value)}
              </span>
            </div>
          );
        }
        return null;
      })}
      {payload.length > 0 && payload[0].payload?.difference && (
        <div className="flex justify-between items-center border-t border-gray-600 mt-2 pt-2">
          <span className="text-sm text-gray-300">Difference:</span>
          <span className={`ml-2 font-semibold ${payload[0].payload.difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {payload[0].payload.difference >= 0 ? '+' : ''}{currency(payload[0].payload.difference)}
          </span>
        </div>
      )}
    </div>
  );
};

export function ImpactPortfolioBalanceNew({ variables, isLocked, profile, active = false, autoStartOnActive = false }: ImpactPortfolioBalanceNewProps) {
  const [baselineData, setBaselineData] = useState<BandsResponse | null>(null);
  const [optimizedData, setOptimizedData] = useState<BandsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStart, setLoadingStart] = useState<number | null>(null);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needsCalculation, setNeedsCalculation] = useState(true);
  const [savedProjectionData, setSavedProjectionData] = useState<ProjectionData[] | null>(null);
  const [savedComparison, setSavedComparison] = useState<Comparison | null>(null);
  const persistedFingerprintRef = useRef<string | null>(null);

  // Check for saved Impact on Portfolio Balance data from profile first
  useEffect(() => {
    const variablesMatch = (current: any, saved: any): boolean => {
      if (!current || !saved) return false;
      const keys = [
        'retirementAge','spouseRetirementAge','socialSecurityAge','spouseSocialSecurityAge',
        'socialSecurityBenefit','spouseSocialSecurityBenefit','pensionBenefit','spousePensionBenefit',
        'assetAllocation','spouseAssetAllocation','monthlyEmployee401k','monthlyEmployer401k',
        'annualTraditionalIRA','annualRothIRA','spouseMonthlyEmployee401k','spouseMonthlyEmployer401k',
        'spouseAnnualTraditionalIRA','spouseAnnualRothIRA','monthlyExpenses','partTimeIncome',
        'spousePartTimeIncome','hasLongTermCareInsurance'
      ];
      // Normalize values to handle undefined/null/0 differences
      const normalize = (v: any) => (v === undefined || v === null) ? 0 : v;
      return keys.every(k => {
        const currentVal = normalize(current[k]);
        const savedVal = normalize(saved[k]);
        // For string values, don't normalize to 0
        if (k === 'assetAllocation' || k === 'spouseAssetAllocation') {
          return current[k] === saved[k];
        }
        return currentVal === savedVal;
      });
    };

    let cancelled = false;
    (async () => {
      // If UI variables differ from saved ones in profile, skip saved cache
      if (profile?.optimizationVariables && !variablesMatch(variables, profile.optimizationVariables)) {
        if (!cancelled) {
          setSavedProjectionData(null);
          setSavedComparison(null);
          setNeedsCalculation(true);
        }
        return;
      }

      // 0) Instant render from profile snapshot if available
      try {
        const impact = profile?.retirementPlanningData?.impactOnPortfolioBalance;
        if (!cancelled && impact && isProjectionDataValid(impact.projectionData)) {
          setSavedProjectionData(impact.projectionData);
          setSavedComparison(impact.comparison || null);
          setNeedsCalculation(false);
          // No return on purpose: allow background cache fetch to validate freshness
        } else if (!cancelled) {
          setSavedProjectionData(null);
          setSavedComparison(null);
          setNeedsCalculation(true);
        }
      } catch (_) { /* ignore */ }

      // Use validated server cache (hash-checked)
      try {
        const res = await fetch('/api/retirement/impact-on-portfolio-balance-cache', { credentials: 'include' });
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data?.cached && isProjectionDataValid(data?.data?.projectionData)) {
            setSavedProjectionData(data.data.projectionData);
            setSavedComparison(data.data.comparison || null);
            setNeedsCalculation(false);
            return;
          }
        }
      } catch (_) { /* ignore */ }

      if (!cancelled) {
        setSavedProjectionData(null);
        setSavedComparison(null);
        setNeedsCalculation(true);
      }
    })();

    return () => { cancelled = true; };
  }, [profile, variables]);

  // Check for saved baseline data on mount only (no auto-generation, no fallbacks)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/retirement-bands', { credentials: 'include' });
        if (!cancelled && response.ok) {
          const savedData = await response.json();
          if (!savedData.needsCalculation) setBaselineData(savedData);
        }
      } catch (_) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // No auto-calculation; user can trigger calculation via button. We prefer saved DB snapshots.

  const calculateOptimizedData = async () => {
    // No need to check isLocked anymore - just use variables if available

    setLoading(true);
    setLoadingStart(Date.now());
    setError(null);
    
    try {
      // If we don't have baseline data, generate it first
      if (!baselineData) {
        try {
          const baselineResponse = await fetch('/api/retirement-bands', {
            credentials: 'include'
          });
          
          if (baselineResponse.ok) {
            const baselineResult = await baselineResponse.json();
            if (!baselineResult.needsCalculation) {
              setBaselineData(baselineResult);
            } else {
              // Generate baseline if needed
              const generateResp = await fetch('/api/calculate-retirement-bands', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skipCache: false })
              });
              
              if (generateResp.ok) {
                const generated = await generateResp.json();
                setBaselineData(generated);
              } else {
                throw new Error('Failed to generate baseline retirement bands');
              }
            }
          } else {
            // Handle auth error explicitly
            if (baselineResponse.status === 401) {
              throw new Error('Not signed in. Please log in to calculate portfolio impact.');
            }
            // Handle 404 with needsCalculation response, otherwise fallback to direct generation
            if (baselineResponse.status === 404) {
              try {
                const errorData = await baselineResponse.json();
                if (errorData.needsCalculation) {
                  // Generate baseline when 404 indicates calculation is needed
                  const generateResp = await fetch('/api/calculate-retirement-bands', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ skipCache: false })
                  });
                  
                  if (generateResp.ok) {
                    const generated = await generateResp.json();
                    setBaselineData(generated);
                  } else {
                    throw new Error('Failed to generate baseline retirement bands');
                  }
                } else {
                  throw new Error('Retirement bands not available');
                }
              } catch (parseError) {
                // If we can't parse the 404 response, fallback to direct generation
                const generateResp = await fetch('/api/calculate-retirement-bands', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ skipCache: false })
                });
                
                if (generateResp.ok) {
                  const generated = await generateResp.json();
                  setBaselineData(generated);
                } else {
                  throw new Error('Failed to generate baseline retirement bands');
                }
              }
            } else {
              // Other error, try to generate baseline directly
              const generateResp = await fetch('/api/calculate-retirement-bands', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skipCache: false })
              });
              
              if (generateResp.ok) {
                const generated = await generateResp.json();
                setBaselineData(generated);
              } else {
                throw new Error('Failed to generate baseline retirement bands');
              }
            }
          }
        } catch (baselineError) {
          console.error('Baseline generation failed:', baselineError);
          throw new Error('Failed to generate baseline retirement projections. Please ensure you have completed your financial profile.');
        }
      }

      // Fetch optimized data using locked variables
      const optimizedResponse = await fetch('/api/calculate-retirement-bands-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(variables)
      });
      
      if (!optimizedResponse.ok) {
        if (optimizedResponse.status === 401) {
          throw new Error('Not signed in. Please log in to calculate optimized projections.');
        }
        const errorData = await optimizedResponse.json();
        throw new Error(errorData.error || 'Failed to generate optimized projections');
      }
      
      const optimizedResult = await optimizedResponse.json();
      setOptimizedData(optimizedResult);
      setNeedsCalculation(false);
    } catch (e: any) {
      console.error('Optimized projection generation error', e);
      setError(e.message || 'Failed to generate optimized projections');
    } finally {
      setLoading(false);
      setLoadingStart(null);
      setLoadingSeconds(0);
    }
  };

  // Auto-refresh when optimization finishes (global event)
  useEffect(() => {
    const onUpdated = () => {
      setSavedProjectionData(null);
      setSavedComparison(null);
      setOptimizedData(null);
      setNeedsCalculation(true);
      calculateOptimizedData();
    };
    window.addEventListener('retirementOptimizationUpdated', onUpdated as any);
    return () => window.removeEventListener('retirementOptimizationUpdated', onUpdated as any);
  }, [baselineData, variables]);

  // Bypass cache and recalculate everything when dashboard triggers a global refresh
  useEffect(() => {
    const onDashboardRefresh = () => {
      handleRefresh();
    };
    window.addEventListener('refreshDashboard', onDashboardRefresh);
    return () => window.removeEventListener('refreshDashboard', onDashboardRefresh);
  }, [variables]);

  // Auto-refresh when profile reflects a new optimized result
  useEffect(() => {
    const ts =
      profile?.optimizationVariables?.optimizedAt ||
      profile?.optimizationVariables?.optimizedScore?.calculatedAt;
    if (!ts) return;
    setSavedProjectionData(null);
    setSavedComparison(null);
    setOptimizedData(null);
    setNeedsCalculation(true);
    calculateOptimizedData();
  }, [
    profile?.optimizationVariables?.optimizedAt,
    profile?.optimizationVariables?.optimizedScore?.calculatedAt
  ]);

  // Auto-start calculation when tab becomes active for the first time
  const [autoTriggered, setAutoTriggered] = useState(false);
  useEffect(() => {
    if (!active || autoTriggered) return;
    if (autoStartOnActive) {
      setAutoTriggered(true);
      calculateOptimizedData();
    }
  }, [active, autoStartOnActive, autoTriggered]);

  const handleRefresh = async () => {
    // force re-calc and bypass any saved data
    setSavedProjectionData(null);
    setSavedComparison(null);
    setNeedsCalculation(true);

    setLoading(true);
    setLoadingStart(Date.now());
    setError(null);
    try {
      const baselineResponse = await fetch('/api/calculate-retirement-bands', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipCache: false })
      });
      if (!baselineResponse.ok) {
        if (baselineResponse.status === 401) throw new Error('Not signed in. Please log in to refresh projections.');
        throw new Error('Failed to refresh baseline retirement bands');
      }
      const baselineResult = await baselineResponse.json();
      setBaselineData(baselineResult);
      await calculateOptimizedData();
    } catch (e: any) {
      console.error('Refresh error', e);
      setError(e.message || 'Failed to refresh projections');
    } finally {
      setLoading(false);
      setLoadingStart(null);
      setLoadingSeconds(0);
    }
  };

  // Loading timer
  React.useEffect(() => {
    let t: any;
    if (loading && loadingStart) {
      t = setInterval(() => {
        setLoadingSeconds(Math.max(0, Math.round((Date.now() - loadingStart) / 1000)));
      }, 1000);
    }
    return () => {
      if (t) clearInterval(t);
    };
  }, [loading, loadingStart]);

  const { projectionData, comparison, source } = useMemo(() => {
    // Use saved data if available (from database persistence)
    const hasBaseline = Array.isArray(baselineData?.percentiles?.p50) && (baselineData?.percentiles?.p50?.length || 0) > 0;
    const hasOptimized = Array.isArray(optimizedData?.percentiles?.p50) && (optimizedData?.percentiles?.p50?.length || 0) > 0;

    if (hasBaseline && hasOptimized) {
      const baselineAges = baselineData?.ages || [];
      const optimizedAges = optimizedData?.ages || [];
      const baselineMedian = baselineData?.percentiles?.p50 || [];
      const optimizedMedian = optimizedData?.percentiles?.p50 || [];

      const calculatedProjectionData: ProjectionData[] = [];

      const minLength = Math.min(baselineAges.length, optimizedAges.length, baselineMedian.length, optimizedMedian.length);

      for (let i = 0; i < minLength; i++) {
        const age = baselineAges[i] || optimizedAges[i];
        const baselineValue = Math.round(baselineMedian[i] || 0);
        const optimizedValue = Math.round(optimizedMedian[i] || 0);

        calculatedProjectionData.push({
          age,
          baseline: baselineValue,
          optimized: optimizedValue,
          difference: optimizedValue - baselineValue
        });
      }

      const last = calculatedProjectionData[calculatedProjectionData.length - 1];
      const calculatedComparison: Comparison | null = last ? {
        finalBaseline: last.baseline,
        finalOptimized: last.optimized,
        finalDifference: last.difference,
        percentageImprovement: last.baseline > 0 ? Math.round(((last.optimized - last.baseline) / last.baseline) * 100) : 0
      } : null;

      return {
        projectionData: calculatedProjectionData,
        comparison: calculatedComparison,
        source: 'calculated' as const,
      };
    }

    if (savedProjectionData && isProjectionDataValid(savedProjectionData)) {
      console.log('Using saved projection data from database');
      return { 
        projectionData: savedProjectionData, 
        comparison: savedComparison,
        source: 'saved' as const,
      };
    }

    // Otherwise calculate from retirement bands data
    if (!baselineData || !optimizedData) {
      return { projectionData: [] as ProjectionData[], comparison: null as Comparison | null, source: 'empty' as const };
    }
    return { projectionData: [] as ProjectionData[], comparison: null as Comparison | null, source: 'empty' as const };
  }, [baselineData, optimizedData, savedProjectionData, savedComparison]);

  const usingCalculated = useMemo(() => source === 'calculated', [source]);

  // After computing from baseline/optimized (not from saved), persist to server
  useEffect(() => {
    if (!usingCalculated || projectionData.length === 0) return;

    const fingerprint = JSON.stringify({ projectionData, comparison });
    if (persistedFingerprintRef.current === fingerprint) return;
    persistedFingerprintRef.current = fingerprint;

    (async () => {
      try {
        await fetch('/api/retirement/impact-on-portfolio-balance-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ projectionData, comparison })
        });
      } catch (err) {
        console.warn('Failed to save Impact on Portfolio Balance cache:', err);
      }
    })();
  }, [usingCalculated, projectionData, comparison]);

  const retirementAge = baselineData?.meta?.retirementAge || optimizedData?.meta?.retirementAge;

  // Determine component state based on data availability
  const hasSaved = !!(savedProjectionData && savedProjectionData.length > 0);
  const hasBaselineData = !!baselineData;
  const hasOptimizedData = !!optimizedData;
  
  // Show "Ready to Calculate" state when no data (and not loading)
  if (!hasSaved && !hasBaselineData && !hasOptimizedData && !loading) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Optimization Impact on Portfolio Balance
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                Compare median projections (50th percentile) using retirement bands algorithm
              </p>
            </div>
            <Button
              onClick={calculateOptimizedData}
              disabled={loading}
              size="sm"
              variant="outline"
              className="bg-purple-800 border-purple-700 hover:bg-purple-700 text-white"
              title="Calculate impact on portfolio balance"
            >
              <Calculator className="w-4 h-4" />
              <span className="ml-2">Calculate Impact</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <Calculator className="w-12 h-12 mx-auto mb-4 text-purple-400 opacity-70" />
            <p className="text-lg font-medium mb-2">Ready to Analyze</p>
            <p className="text-sm">
              Click "Calculate Impact" to generate baseline and optimized portfolio projections
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Optimization Impact on Portfolio Balance
          </CardTitle>
          <p className="text-sm text-gray-400 mt-1">
            Compare median projections (50th percentile) using retirement bands algorithm
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
            <p>Calculating portfolio impact analysis...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Optimization Impact on Portfolio Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-400">
            <p className="text-lg font-medium mb-2">Error</p>
            <p className="text-sm">{error}</p>
            <Button
              onClick={calculateOptimizedData}
              className="mt-4"
              size="sm"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show intermediate state when baseline data exists but optimized data is being calculated
  if (baselineData && !optimizedData && !loading && !savedProjectionData) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Optimization Impact on Portfolio Balance
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                Compare median projections (50th percentile) using retirement bands algorithm
              </p>
            </div>
            <Button
              onClick={calculateOptimizedData}
              disabled={loading}
              size="sm"
              variant="outline"
              className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
              title="Calculate optimized projection"
            >
              <Calculator className="w-4 h-4" />
              <span className="ml-2">Calculate</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Ready to Calculate Impact</p>
            <p className="text-sm">
              Baseline data is ready. Click "Calculate" to generate the optimized scenario and compare portfolio projections.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show main chart with data (either calculated or saved)
  // Also verify that the data contains valid numbers, not NaN
  const hasValidData = projectionData.length > 0 && 
    projectionData.some(d => !isNaN(d.baseline) && !isNaN(d.optimized));
  
  if (hasValidData) {
    return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Optimization Impact on Portfolio Balance
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              Compare median projections (50th percentile) using retirement bands algorithm
            </p>
          </div>
          {/* Removed header refresh to avoid duplicate with LastCalculated */}
        </div>
      </CardHeader>
      <div className="px-6 -mt-2">
        <LastCalculated
          timestamp={optimizedData?.meta?.calculatedAt || baselineData?.meta?.calculatedAt}
          onRefresh={handleRefresh}
          refreshing={loading}
        />
      </div>
      <CardContent className="space-y-6">
        {loading && (
          <div className="text-center text-sm text-gray-300">
            Calculating portfolio impact analysis... {loadingSeconds}s
          </div>
        )}
        {/* Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projectionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="age" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                tickFormatter={currency}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Reference line for retirement age */}
              {retirementAge && (
                <ReferenceLine 
                  x={retirementAge} 
                  stroke="#60A5FA" 
                  strokeDasharray="5 5" 
                  label={{ 
                    value: 'Retirement', 
                    position: 'top', 
                    fill: '#60A5FA' 
                  }} 
                />
              )}

              {/* Baseline Plan Line */}
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#6366f1"
                strokeWidth={3}
                dot={false}
                strokeOpacity={0.8}
              />

              {/* Optimized Plan Line */}
              <Line
                type="monotone"
                dataKey="optimized"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                strokeOpacity={0.8}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-indigo-500 rounded"></div>
            <span className="text-sm text-gray-300">Baseline Plan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-300">Optimized Plan</span>
          </div>
        </div>
        
        {/* Comparison Summary */}
        {comparison && (
          <div className={`border rounded-lg p-4 mt-4 ${
            comparison.finalDifference >= 0 
              ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-700/30'
              : 'bg-gradient-to-r from-red-900/20 to-rose-900/20 border-red-700/30'
          }`}>
            <div className="text-center">
              <div className="text-lg font-semibold text-white">
                Optimized plan has{' '}
                <span className={`text-2xl font-bold ${
                  comparison.finalDifference >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {currency(Math.abs(comparison.finalDifference))}
                </span>{' '}
                {comparison.finalDifference >= 0 ? 'more' : 'less'} ending assets
              </div>
              {comparison.percentageImprovement !== 0 && (
                <div className={`text-sm mt-2 ${
                  comparison.percentageImprovement >= 0 ? 'text-green-300' : 'text-red-300'
                }`}>
                  ({comparison.percentageImprovement >= 0 ? '+' : ''}{comparison.percentageImprovement}% change)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Source Info */}
        {baselineData?.calculationTime && optimizedData?.calculationTime && (
          <div className="text-xs text-gray-500 text-center">
            Baseline calculated in {(baselineData.calculationTime / 1000).toFixed(1)}s, 
            Optimized in {(optimizedData.calculationTime / 1000).toFixed(1)}s
          </div>
        )}
      </CardContent>
    </Card>
    );
  }

  // Fallback: show ready to calculate state
  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-6">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Optimization Impact on Portfolio Balance
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              Compare median projections (50th percentile) using retirement bands algorithm
            </p>
          </div>
          <Button
            onClick={calculateOptimizedData}
            disabled={loading}
            size="sm"
            variant="outline"
            className="bg-purple-800 border-purple-700 hover:bg-purple-700 text-white"
            title="Calculate impact on portfolio balance"
          >
            <Calculator className="w-4 h-4" />
            <span className="ml-2">Calculate Impact</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-gray-400">
          <Calculator className="w-12 h-12 mx-auto mb-4 text-purple-400 opacity-70" />
          <p className="text-lg font-medium mb-2">Ready to Analyze</p>
          <p className="text-sm">
            Click "Calculate Impact" to generate baseline and optimized portfolio projections
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
