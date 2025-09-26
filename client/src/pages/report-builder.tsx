import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { FileDown, GripVertical, Plus, Save, Trash2, Eye, RefreshCw, X, TrendingUp, Presentation, Loader2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Gauge } from '@/components/ui/gauge';
import { MetricDisplay } from '@/components/ui/metric-display';
import { useReportWidgets } from '@/hooks/use-report-widgets';
import { useDashboardSnapshot, pickWidget } from '@/hooks/useDashboardSnapshot';
import { computeEmergencyReadinessMetrics } from '@/utils/emergency-readiness';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Area, Line, ReferenceLine, ReferenceDot } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PptxGenJS from 'pptxgenjs';

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestArgs: Parameters<T> | null = null;

  const invoke = () => {
    if (!latestArgs) return;
    const args = latestArgs;
    latestArgs = null;
    fn(...args);
  };

  const debounced = (...args: Parameters<T>) => {
    latestArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      invoke();
    }, delay);
  };

  const extended = debounced as typeof debounced & { cancel: () => void; flush: () => void };

  extended.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    latestArgs = null;
  };

  extended.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    invoke();
  };

  return extended;
}

type Branding = {
  firmName?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  defaultDisclaimer?: string | null;
};

const DEFAULT_WIDGETS: string[] = [
  'financial_health_score',
  'net_worth',
  'monthly_cash_flow',
  'emergency_readiness_score_new',
  'optimized_retirement_confidence',
  'insurance_adequacy_score',
  'optimized_portfolio_projection',
  'ending_portfolio_value_increase',
  'retirement_stress_test',
  'social_security_optimization_impact',
  'roth_conversion_impact',
];

const WIDGET_ORDER = [...DEFAULT_WIDGETS];

const LEGACY_WIDGET_MAP: Record<string, string | null> = {
  'retirement_confidence_gauge': 'optimized_retirement_confidence',
  'retirement_confidence_score': 'optimized_retirement_confidence',
  'net_worth_projection_optimized': 'optimized_portfolio_projection',
  'net_worth_projection': 'optimized_portfolio_projection',
  'increase_in_portfolio_value': 'ending_portfolio_value_increase',
  'optimization_impact_on_balance': 'ending_portfolio_value_increase',
  'optimization_impact_ending_portfolio': 'ending_portfolio_value_increase',
  'emergency_readiness_score': 'emergency_readiness_score_new',
};

const normalizeWidgetKey = (key: string | null | undefined): string | null => {
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(LEGACY_WIDGET_MAP, key)) {
    return LEGACY_WIDGET_MAP[key] ?? null;
  }
  return key;
};

const sanitizeWidgetLayout = (layout?: string[]): string[] => {
  const source = Array.isArray(layout) && layout.length > 0 ? layout : WIDGET_ORDER;
  const canonical: string[] = [];
  const seenCanonical = new Set<string>();
  const extras: string[] = [];
  const seenExtras = new Set<string>();

  for (const rawKey of source) {
    const normalized = normalizeWidgetKey(rawKey);
    if (!normalized) continue;
    if (WIDGET_ORDER.includes(normalized)) {
      if (!seenCanonical.has(normalized)) {
        canonical.push(normalized);
        seenCanonical.add(normalized);
      }
    } else if (!seenExtras.has(normalized)) {
      extras.push(normalized);
      seenExtras.add(normalized);
    }
  }

  const ordered: string[] = [];
  const seen = new Set<string>();

  WIDGET_ORDER.forEach((key) => {
    if (canonical.includes(key) && !seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  });

  canonical.forEach((key) => {
    if (!seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  });

  extras.forEach((key) => {
    if (!seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  });

  return ordered;
};

type InsightItem = { id?: string; text: string; order: number; isCustom?: boolean };
type CapturedWidgetImage = { key: string; base64: string; dataUrl: string; aspect: number };
type CapturedLogo = { dataUrl: string; width: number; height: number } | null;
type CaptureAssetsResult = { logo: CapturedLogo; widgetImages: CapturedWidgetImage[] };

const MAX_INSIGHT_SENTENCES = 2;

const sanitizePrintable = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/\u00A0/g, ' ');

const normalizeWhitespace = (value?: string | null) =>
  typeof value === 'string' ? sanitizePrintable(value).replace(/\s+/g, ' ').trim() : '';

const takeFirstSentences = (text: string, maxSentences = MAX_INSIGHT_SENTENCES) => {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  return sentences.slice(0, maxSentences).join(' ').trim();
};

const formatInsightText = (insight: { title?: string | null; explanation?: string | null }) => {
  const title = normalizeWhitespace(insight.title) || 'Insight';
  const explanation = takeFirstSentences(normalizeWhitespace(insight.explanation));
  return explanation ? `${title}: ${explanation}` : title;
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const formatWidgetTitle = (key: string) => {
  const canonical = normalizeWidgetKey(key) ?? key;
  if (!canonical) return 'Widget';
  return canonical
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const WIDGET_TITLE_CLASS = "text-lg font-semibold uppercase tracking-wide text-gray-200";

// Independent component for Roth conversion impact
function RothConversionImpactWidget({ profileData, refreshSignal }: { profileData: any; refreshSignal: number }) {
  const [rothData, setRothData] = useState<{
    estateValueIncrease?: number;
    hasAnalysis?: boolean;
    calculatedAt?: string;
    message?: string;
    baselineEstateValue?: number | null;
    optimizedEstateValue?: number | null;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const calculatedForRef = useRef<string | null>(null);
  const prevRefreshRef = useRef<number | null>(null);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCalculating) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCalculating]);

  useEffect(() => {
    if (prevRefreshRef.current !== refreshSignal) {
      prevRefreshRef.current = refreshSignal;
      calculatedForRef.current = null;
      setRothData(null);
    }

    let isMounted = true;

    const resolveEstateSummary = (payload: any): {
      delta: number | null;
      baseline?: number | null;
      optimized?: number | null;
    } | null => {
      if (!payload) return null;

      const baseline = Number(payload?.results?.baselineScenario?.projections?.afterTaxEstateValueAt85);
      const strategies = Array.isArray(payload?.results?.strategies) ? payload.results.strategies : [];
      const firstStrategy = strategies.length ? strategies[0] : null;
      const strategyValue = Number(firstStrategy?.projections?.afterTaxEstateValueAt85);

      if (Number.isFinite(baseline) && Number.isFinite(strategyValue)) {
        return {
          delta: strategyValue - baseline,
          baseline,
          optimized: strategyValue,
        };
      }

      const summaryValue = Number(payload?.summary?.estateValueIncrease);
      if (Number.isFinite(summaryValue) && !Number.isNaN(summaryValue)) {
        return {
          delta: summaryValue,
          baseline: Number.isFinite(baseline) ? baseline : null,
          optimized: Number.isFinite(strategyValue) ? strategyValue : Number.isFinite(baseline) ? baseline + summaryValue : null,
        };
      }

      return null;
    };

    async function fetchRothAnalysis() {
      const analysisKey =
        profileData?.rothConversionAnalysisMeta?.updatedAt ||
        profileData?.rothConversionAnalysisMeta?.calculatedAt ||
        profileData?.optimizationVariables?.lockedAt ||
        profileData?.lastUpdated ||
        (profileData ? "profile-present" : "no-profile");

      if (calculatedForRef.current === analysisKey) {
        return;
      }

      setIsCalculating(true);
      try {
        console.log("[ROTH-CONVERSION-WIDGET] Fetching stored Roth conversion analysis");

        const response = await fetch('/api/roth-conversion/analysis', {
          credentials: 'include',
        });

        if (!isMounted) return;

        if (response.ok) {
          const data = await response.json();
          if (data.hasAnalysis) {
            const summary = resolveEstateSummary(data);

            setRothData({
              estateValueIncrease: summary?.delta ?? 0,
              hasAnalysis: true,
              calculatedAt: data.calculatedAt,
              baselineEstateValue: summary?.baseline ?? null,
              optimizedEstateValue: summary?.optimized ?? (summary?.baseline != null && summary?.delta != null ? summary.baseline + summary.delta : null)
            });
            calculatedForRef.current = analysisKey;
            console.log("[ROTH-CONVERSION-WIDGET] Successfully loaded Roth analysis:", { summary });
          } else {
            setRothData({
              hasAnalysis: false,
              message: "Run a Roth conversion analysis to populate this widget."
            });
            calculatedForRef.current = analysisKey;
            console.log("[ROTH-CONVERSION-WIDGET] No Roth conversion analysis found");
          }
        } else if (response.status === 404) {
          setRothData({
            hasAnalysis: false,
            message: "Run a Roth conversion analysis to populate this widget."
          });
          calculatedForRef.current = analysisKey;
          console.log("[ROTH-CONVERSION-WIDGET] No Roth conversion analysis found (404)");
        } else {
          throw new Error("Failed to fetch Roth conversion analysis");
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("[ROTH-CONVERSION-WIDGET] Error fetching Roth analysis:", error);
        setRothData({
          hasAnalysis: false,
          message: "Unable to load Roth conversion impact right now."
        });
        calculatedForRef.current = null;
      } finally {
        if (isMounted) {
          setIsCalculating(false);
        }
      }
    }

    fetchRothAnalysis();

    return () => {
      isMounted = false;
    };
  }, [
    profileData?.id,
    profileData?.rothConversionAnalysisMeta?.calculatedAt,
    profileData?.rothConversionAnalysisMeta?.updatedAt,
    profileData?.optimizationVariables?.lockedAt,
    profileData?.lastUpdated,
    refreshSignal
  ]);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    []
  );

  const formatCurrency = (value: number) => currencyFormatter.format(value);

  const formatCurrencyMagnitude = (value: number) => currencyFormatter.format(Math.abs(value));

  const formatWithSign = (value: number) => {
    const formatted = formatCurrencyMagnitude(value);
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
  };

  if (isCalculating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80px]">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-2"></div>
        <div className="text-xs text-gray-400">
          Loading analysis... {elapsedSeconds}s
        </div>
      </div>
    );
  }

  if (!rothData?.hasAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80px]">
        <div className="text-lg font-semibold text-white mb-1">—</div>
        <div className="text-xs text-gray-400 text-center">
          {rothData?.message || 'No analysis available'}
        </div>
      </div>
    );
  }
  
  // Handle case where estate value increase is 0 or negative
  const delta = rothData.estateValueIncrease ?? 0;
  const baseline = rothData.baselineEstateValue ?? null;
  const optimized = rothData.optimizedEstateValue ?? (baseline != null ? baseline + delta : null);
  const percentChange = baseline && baseline !== 0 ? (delta / baseline) * 100 : null;
  const isNeutral = delta === 0;
  const isPositive = delta > 0;

  const percentText = percentChange != null
    ? `${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}% ${isPositive ? "increase" : isNeutral ? "change" : "decrease"}`
    : "—% change";

  const amountColor = isNeutral ? "text-gray-300" : isPositive ? "text-green-400" : "text-orange-400";
  const percentColor = percentChange != null
    ? (percentChange === 0 ? "text-gray-400" : percentChange > 0 ? "text-green-400" : "text-orange-400")
    : "text-gray-400";

  return (
    <div className="flex flex-col items-center justify-center min-h-[80px]">
      <div className={`text-3xl font-bold ${amountColor} mb-1`}>
        {formatWithSign(delta)}
      </div>
      <div className={`text-sm mt-2 ${percentColor}`}>
        {percentText}
      </div>
      <div className="text-xs text-gray-400 text-center mt-1">
        Net to heirs (age 93)
      </div>
      {baseline != null && optimized != null && (
        <div className="text-xs text-gray-500 text-center mt-1">
          {`${formatCurrency(baseline)} → ${formatCurrency(optimized)}`}
        </div>
      )}
    </div>
  );
}

// Independent component for calculating portfolio impact
function EndingPortfolioImpactWidget({ profileData, refreshSignal }: { profileData: any; refreshSignal: number }) {
  const [impactData, setImpactData] = useState<{
    finalDifference?: number;
    percentageImprovement?: number;
    finalBaseline?: number;
    finalOptimized?: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const calculatedForRef = useRef<string | null>(null);
  const prevRefreshRef = useRef<number | null>(null);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCalculating) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCalculating]);

  useEffect(() => {
    if (prevRefreshRef.current !== refreshSignal) {
      prevRefreshRef.current = refreshSignal;
      calculatedForRef.current = null;
      setImpactData(null);
    }

    async function calculateImpact() {
      // Check if optimization variables are locked
      const optimizationVariables = profileData?.optimizationVariables;
      const currentLockedAt = optimizationVariables?.lockedAt;
      
      if (!currentLockedAt) {
        console.log('[PORTFOLIO-IMPACT-WIDGET] Variables not locked');
        setImpactData(null);
        calculatedForRef.current = null;
        return;
      }

      // Skip if we already calculated for this lock timestamp
      if (calculatedForRef.current === currentLockedAt) {
        console.log('[PORTFOLIO-IMPACT-WIDGET] Already calculated for this lock timestamp');
        return;
      }

      setIsCalculating(true);
      try {
        console.log('[PORTFOLIO-IMPACT-WIDGET] Calculating impact with locked variables:', optimizationVariables);
        
        // Run both baseline and optimized calculations in parallel
        const [baselineResponse, optimizedResponse] = await Promise.all([
          // Baseline: use profile as-is
          fetch('/api/calculate-monte-carlo-withdrawal-sequence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ startFromCurrentAge: true })
          }),
          // Optimized: use locked optimization variables
          fetch('/api/calculate-monte-carlo-withdrawal-sequence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              ...optimizationVariables,
              startFromCurrentAge: true
            })
          })
        ]);

        if (baselineResponse.ok && optimizedResponse.ok) {
          const baselineData = await baselineResponse.json();
          const optimizedData = await optimizedResponse.json();
          
          const baselineFlows = baselineData.yearlyCashFlows || baselineData.projections || [];
          const optimizedFlows = optimizedData.yearlyCashFlows || optimizedData.projections || [];
          
          if (baselineFlows.length && optimizedFlows.length) {
            // Get the last year's data (longevity age)
            const lastBaseline = baselineFlows[baselineFlows.length - 1];
            const lastOptimized = optimizedFlows[optimizedFlows.length - 1];
            
            const baselineBalance = lastBaseline?.totalBalance || lastBaseline?.portfolioValue || lastBaseline?.totalPortfolioValue || 0;
            const optimizedBalance = lastOptimized?.totalBalance || lastOptimized?.portfolioValue || lastOptimized?.totalPortfolioValue || 0;
            const difference = optimizedBalance - baselineBalance;
            const percentImprovement = baselineBalance > 0 
              ? ((optimizedBalance - baselineBalance) / baselineBalance) * 100
              : 0;
            
            console.log('[PORTFOLIO-IMPACT-WIDGET] Calculated impact:', {
              baselineBalance,
              optimizedBalance,
              difference,
              percentImprovement
            });
            
            setImpactData({
              finalDifference: difference,
              percentageImprovement: percentImprovement,
              finalBaseline: baselineBalance,
              finalOptimized: optimizedBalance
            });
            // Mark as calculated for this lock timestamp
            calculatedForRef.current = currentLockedAt;
          } else {
            console.log('[PORTFOLIO-IMPACT-WIDGET] No cash flow data available');
            setImpactData(null);
          }
        } else {
          console.error('[PORTFOLIO-IMPACT-WIDGET] Failed to fetch cash flow data');
          setImpactData(null);
        }
      } catch (error) {
        console.error('[PORTFOLIO-IMPACT-WIDGET] Error calculating impact:', error);
        setImpactData(null);
      } finally {
        setIsCalculating(false);
      }
    }

    if (profileData) {
      calculateImpact();
    }
  }, [profileData, refreshSignal]); // Depend on profileData changes and manual refresh

  const formatCurrency = (v: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      .format(Number(v || 0));

  if (isCalculating) {
    return (
      <div className="text-center">
        <div className="text-gray-500 text-sm">Calculating impact...</div>
        <div className="text-xs text-gray-600 mt-2">{elapsedSeconds}s elapsed</div>
      </div>
    );
  }

  if (!profileData?.optimizationVariables?.lockedAt) {
    return (
      <div className="text-center">
        <div className="text-gray-500 text-sm">Variables not locked</div>
        <div className="text-xs text-gray-600 mt-2">Lock optimization variables first</div>
      </div>
    );
  }

  if (impactData?.finalDifference !== undefined) {
    const difference = impactData.finalDifference;
    const percent = impactData.percentageImprovement || 0;
    const finalBaseline = impactData.finalBaseline || 0;
    const finalOptimized = impactData.finalOptimized || 0;
    
    return (
      <>
        <div className={`text-3xl font-bold ${difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
        </div>
        <div className={`text-sm mt-2 ${difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {percent.toFixed(1)}% increase
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Portfolio value at longevity age
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Baseline: {formatCurrency(finalBaseline)} → Optimized: {formatCurrency(finalOptimized)}
        </div>
      </>
    );
  }

  return (
    <div className="text-center">
      <div className="text-gray-500 text-sm">No impact data</div>
      <div className="text-xs text-gray-600 mt-2">Unable to calculate</div>
    </div>
  );
}

type OptimizedBandsResponse = {
  ages: number[];
  percentiles: {
    p05?: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95?: number[];
  };
  meta?: {
    currentAge?: number;
    retirementAge?: number;
    longevityAge?: number;
    runs?: number;
    calculatedAt?: string;
  };
  cached?: boolean;
  calculationTime?: number;
};

const portfolioCurrency = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
};

const OptimizedPortfolioTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const entries = payload.filter((entry: any) => ['p75', 'p50', 'p25'].includes(entry.dataKey));
  if (!entries.length) return null;

  const labelMap: Record<string, string> = {
    p75: '75th Percentile',
    p50: 'Median',
    p25: '25th Percentile',
  };

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-white">Age {label}</p>
      <div className="mt-1 space-y-1">
        {entries.map((entry: any) => {
          const isMedian = entry.dataKey === 'p50';
          return (
            <div key={entry.dataKey} className="flex items-center justify-between text-xs">
              <span className={isMedian ? 'font-semibold text-white' : 'text-gray-300'}>
                {labelMap[entry.dataKey]}
              </span>
              <span className={isMedian ? 'font-semibold text-white' : 'text-gray-200'}>
                {portfolioCurrency(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function OptimizedPortfolioProjectionWidget({ profileData, refreshSignal }: { profileData: any; refreshSignal: number }) {
  const { data: dashboardSnapshot } = useDashboardSnapshot();
  const [bands, setBands] = useState<OptimizedBandsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<number>(refreshSignal);

  const loadBands = useCallback(async () => {
    setLoading(true);
    setError(null);

    let hasLocalData = false;

    try {
      const snapshotBands = dashboardSnapshot ? pickWidget<OptimizedBandsResponse>(dashboardSnapshot, 'retirement_bands_optimized') : null;
      if (snapshotBands?.percentiles?.p50?.length) {
        setBands(snapshotBands);
        hasLocalData = true;
      }

      const savedBands = profileData?.optimizationVariables?.optimizedRetirementBands as OptimizedBandsResponse | undefined;
      if (!hasLocalData && savedBands?.percentiles?.p50?.length) {
        setBands(savedBands);
        hasLocalData = true;
      }

      const response = await fetch('/api/financial-profile', { credentials: 'include' });
      if (response.ok) {
        const freshProfile = await response.json();
        const freshBands = freshProfile?.optimizationVariables?.optimizedRetirementBands as OptimizedBandsResponse | undefined;
        if (freshBands?.percentiles?.p50?.length) {
          setBands(freshBands);
          hasLocalData = true;
        } else if (!hasLocalData) {
          setBands(null);
          setError('Run the optimized plan in Retirement Planning to populate this chart.');
        }
      } else if (!hasLocalData) {
        setBands(null);
        setError('Unable to load optimized portfolio projections.');
      }
    } catch (err) {
      console.error('[REPORT-BUILDER] Failed to load optimized portfolio projections', err);
      if (!hasLocalData) {
        setBands(null);
        setError('Unable to load optimized portfolio projections right now.');
      }
    } finally {
      setLoading(false);
    }
  }, [dashboardSnapshot, profileData?.optimizationVariables?.optimizedRetirementBands]);

  useEffect(() => {
    loadBands();
  }, [loadBands]);

  useEffect(() => {
    if (refreshRef.current !== refreshSignal) {
      refreshRef.current = refreshSignal;
      loadBands();
    }
  }, [refreshSignal, loadBands]);

  const chartData = useMemo(() => {
    if (!bands?.ages?.length || !bands.percentiles?.p50?.length) return [] as Array<Record<string, number>>;
    return bands.ages.map((age, idx) => {
      const p25 = bands.percentiles.p25?.[idx] ?? 0;
      const p50 = bands.percentiles.p50?.[idx] ?? 0;
      const p75 = bands.percentiles.p75?.[idx] ?? p50;
      const p95 = bands.percentiles.p95?.[idx] ?? p75;
      const p05 = bands.percentiles.p05?.[idx] ?? p25;
      return {
        age,
        p25,
        p50,
        p75,
        midBase: p25,
        midFill: Math.max(0, p75 - p25),
        upperBase: p75,
        upperFill: Math.max(0, p95 - p75),
        lowerBase: p05,
        lowerFill: Math.max(0, p25 - p05),
      };
    });
  }, [bands]);

  const retirementAge = bands?.meta?.retirementAge || profileData?.optimizationVariables?.retirementAge;
  const longevityAge = bands?.meta?.longevityAge || 93;

  const medianTargetPoint = useMemo(() => {
    if (!chartData.length) return null;
    const point = chartData.find((entry) => entry.age === longevityAge) ||
      chartData.slice().reverse().find((entry) => entry.age < longevityAge) ||
      chartData[chartData.length - 1];
    if (!point || typeof point.p50 !== 'number') return null;
    return { age: point.age, value: point.p50 };
  }, [chartData, longevityAge]);

  if (!bands && loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center text-sm text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin text-sky-300 mb-3" />
        <span>Loading optimized projections…</span>
      </div>
    );
  }

  if (!bands) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center text-sm text-gray-400 px-4">
        <TrendingUp className="h-6 w-6 text-gray-500 mb-2" />
        <span>Run the optimized plan in Retirement Planning to view projections.</span>
        {error && <span className="mt-2 text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch w-full h-full">
      <div className="flex-1 w-full min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="age" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={portfolioCurrency} width={64} />
            <RechartsTooltip content={<OptimizedPortfolioTooltip />} />

            {retirementAge && (
              <ReferenceLine
                x={retirementAge}
                stroke="#60A5FA"
                strokeDasharray="5 5"
                label={{ value: 'Retirement', position: 'top', fill: '#60A5FA', fontSize: 11 }}
              />
            )}

            {medianTargetPoint && (
              <>
                <ReferenceLine
                  x={medianTargetPoint.age}
                  stroke="#F59E0B"
                  strokeDasharray="3 3"
                  label={{
                    value: `Median @ ${medianTargetPoint.age}`,
                    position: 'top',
                    fill: '#F59E0B',
                    fontSize: 11,
                  }}
                />
                <ReferenceDot x={medianTargetPoint.age} y={medianTargetPoint.value} r={4} fill="#F59E0B" stroke="#FDE68A" />
              </>
            )}

            <Area type="monotone" dataKey="midBase" stackId="mid" stroke="none" fill="transparent" />
            <Area type="monotone" dataKey="midFill" stackId="mid" stroke="none" fill="#7DB4CC" fillOpacity={0.6} />
            <Line type="monotone" dataKey="p75" stroke="#7DB4CC" strokeWidth={1} strokeOpacity={0.8} dot={false} />
            <Line type="monotone" dataKey="p25" stroke="#7DB4CC" strokeWidth={1} strokeOpacity={0.8} dot={false} />
            <Line type="monotone" dataKey="p50" stroke="#F59E0B" strokeWidth={3} strokeOpacity={1} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 w-full text-[11px] text-gray-400 flex items-center justify-between gap-2">
        <span>{bands?.meta?.runs ? `${bands.meta.runs.toLocaleString()} scenarios` : bands?.cached ? 'Cached result' : 'Optimized plan bands'}</span>
        {bands?.meta?.calculatedAt && (
          <span className="text-gray-500">As of {new Date(bands.meta.calculatedAt).toLocaleDateString()}</span>
        )}
      </div>
      {medianTargetPoint && (
        <div className="mt-2 text-sm text-gray-300">
          Median portfolio at age {medianTargetPoint.age}:{' '}
          <span className="font-semibold text-white">{portfolioCurrency(medianTargetPoint.value)}</span>
        </div>
      )}
      {loading && (
        <div className="mt-2 flex items-center justify-center text-[11px] text-sky-300 gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Refreshing data…</span>
        </div>
      )}
      {error && !loading && (
        <div className="mt-2 text-[10px] text-red-400 text-center">{error}</div>
      )}
    </div>
  );
}

// Independent component for Retirement Stress Test
function RetirementStressTestWidget({ profileData, refreshSignal }: { profileData: any; refreshSignal: number }) {
  const [stressResults, setStressResults] = useState<any[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const calculatedForRef = useRef<string | null>(null);
  const prevRefreshRef = useRef<number | null>(null);

  // Define stress scenarios matching the backend format
  const stressScenarios = [
    {
      id: 'bear-market-immediate',
      name: 'Bear Market',
      description: 'Market drops 30% immediately',
      category: 'market',
      enabled: true,
      parameters: {
        value: -30,
        unit: 'percentage',
        timing: 'immediate'
      },
      color: 'bg-red-500'
    },
    {
      id: 'high-inflation',
      name: 'High Inflation',
      description: '5% annual inflation throughout retirement',
      category: 'inflation',
      enabled: true,
      parameters: {
        value: 5,
        unit: 'percentage',
        timing: 'ongoing'
      },
      color: 'bg-orange-500'
    },
    {
      id: 'longevity-risk',
      name: 'Live to 100',
      description: 'Live 10 years longer than expected',
      category: 'longevity',
      enabled: true,
      parameters: {
        value: 10,
        unit: 'years',
        timing: 'ongoing'
      },
      color: 'bg-purple-500'
    },
    {
      id: 'ltc-costs',
      name: 'LTC Costs',
      description: '$100,000 annual long-term care costs',
      category: 'costs',
      enabled: true,
      parameters: {
        value: 100000,
        unit: 'amount',
        timing: 'ongoing'
      },
      color: 'bg-pink-500'
    }
  ];

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCalculating) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCalculating]);

  useEffect(() => {
    if (prevRefreshRef.current !== refreshSignal) {
      prevRefreshRef.current = refreshSignal;
      calculatedForRef.current = null;
      setStressResults([]);
    }

    async function calculateStressTests() {
      const optimizationVariables = profileData?.optimizationVariables;
      const currentLockedAt = optimizationVariables?.lockedAt;
      
      if (!currentLockedAt) {
        console.log('[STRESS-TEST-WIDGET] Variables not locked');
        setStressResults([]);
        calculatedForRef.current = null;
        return;
      }

      // Skip if already calculated for this lock timestamp
      if (calculatedForRef.current === currentLockedAt) {
        console.log('[STRESS-TEST-WIDGET] Already calculated for this lock timestamp');
        return;
      }

      // Skip if already calculating
      if (isCalculating) {
        console.log('[STRESS-TEST-WIDGET] Already calculating, skipping');
        return;
      }

      setIsCalculating(true);
      try {
        console.log('[STRESS-TEST-WIDGET] Running stress tests with optimized variables');
        
        // Call the stress test API with all scenarios
        const response = await fetch('/api/stress-test-scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            scenarios: stressScenarios,
            runCombined: false,
            saveToProfile: false,
            // Use optimization variables as baseline for stress tests
            baselineVariables: optimizationVariables
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[STRESS-TEST-WIDGET] Stress test response:', data);
          
          // Format results for display
          const formattedResults = [];
          
          // Add baseline
          formattedResults.push({
            id: 'baseline',
            name: 'Baseline',
            color: 'bg-blue-500',
            successRate: Math.round((data.baseline?.successProbability || 0) * 100)
          });
          
          // Add individual stress test results
          data.individualResults?.forEach((result: any) => {
            const scenario = stressScenarios.find(s => s.id === result.scenarioId);
            if (scenario) {
              formattedResults.push({
                id: result.scenarioId,
                name: scenario.name,
                color: scenario.color,
                successRate: Math.round((result.successProbability || 0) * 100)
              });
            }
          });
          
          console.log('[STRESS-TEST-WIDGET] Formatted results:', formattedResults);
          setStressResults(formattedResults);
          calculatedForRef.current = currentLockedAt;
        } else {
          console.error('[STRESS-TEST-WIDGET] Failed to run stress tests');
          setStressResults([]);
        }
      } catch (error) {
        console.error('[STRESS-TEST-WIDGET] Error running stress tests:', error);
        setStressResults([]);
      } finally {
        setIsCalculating(false);
      }
    }

    if (profileData) {
      calculateStressTests();
    }
  }, [profileData, refreshSignal]); // Depend on profileData changes and manual refresh

  if (isCalculating) {
    return (
      <div className="text-center w-full">
        <div className="text-gray-500 text-sm">Running stress tests...</div>
        <div className="text-xs text-gray-600 mt-1">{elapsedSeconds}s elapsed</div>
      </div>
    );
  }

  if (!profileData?.optimizationVariables?.lockedAt) {
    return (
      <div className="text-center">
        <div className="text-gray-500 text-sm">Variables not locked</div>
        <div className="text-xs text-gray-600 mt-1">Lock optimization first</div>
      </div>
    );
  }

  if (stressResults.length === 0) {
    return (
      <div className="text-center">
        <div className="text-gray-500 text-sm">No test results</div>
        <div className="text-xs text-gray-600 mt-1">Unable to calculate</div>
      </div>
    );
  }

  // Display results as horizontal bars
  return (
    <div className="w-3/4 mx-auto space-y-1.5">
      {stressResults.map((result) => (
        <div key={result.id} className="flex items-center gap-2">
          <div className="text-xs text-gray-400 w-24 text-right">{result.name}</div>
          <div className="flex-1 bg-gray-700 rounded-full h-3 relative overflow-hidden">
            <div 
              className={`absolute left-0 top-0 h-full ${result.color} transition-all duration-500`}
              style={{ width: `${result.successRate}%` }}
            />
          </div>
          <div className="text-xs text-gray-300 w-8 text-left">{result.successRate}</div>
        </div>
      ))}
    </div>
  );
}

// Life Goals Progress Widget
function LifeGoalsProgressWidget({ refreshSignal }: { refreshSignal: number }) {
  const [goals, setGoals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  useEffect(() => {
    let cancelled = false;

    async function fetchGoals() {
      try {
        setIsLoading(true);
        setElapsedSeconds(0);
        // Fetch all three types of goals in parallel
        const [lifeGoalsRes, profileRes, educationRes] = await Promise.all([
          fetch('/api/life-goals', { credentials: 'include' }),
          fetch('/api/financial-profile', { credentials: 'include' }),
          fetch('/api/education/goals', { credentials: 'include' })
        ]);
        
        const allGoals: any[] = [];
        
        // Process life goals (custom goals)
        if (lifeGoalsRes.ok) {
          const lifeGoalsData = await lifeGoalsRes.json();
          
          lifeGoalsData.forEach((goal: any) => {
            // Use fundingPercentage if available
            let progress = 0;
            if (goal.fundingPercentage != null) {
              progress = Number(goal.fundingPercentage);
            } else {
              // Calculate it
              const targetAmount = Number(goal.targetAmount || goal.targetAmountToday || 0);
              const currentAmount = Number(goal.currentAmount || goal.currentSavings || 0);
              let totalFunding = currentAmount;
              
              // Add funding sources
              const sources = goal.metadata?.fundingSources || goal.fundingSources || [];
              if (Array.isArray(sources)) {
                const monthsToGoal = goal.targetDate
                  ? Math.max(0, Math.floor((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
                  : 0;
                  
                sources.forEach((source: any) => {
                  const type = String(source.type || '').toLowerCase();
                  if (type === 'asset' || type === 'loan') {
                    totalFunding += Number(source.amount || 0);
                  } else if (type === 'monthly_savings') {
                    totalFunding += Number(source.monthlyAmount || 0) * monthsToGoal;
                  }
                });
              }
              
              progress = targetAmount > 0 ? (totalFunding / targetAmount) * 100 : 0;
            }
            
            allGoals.push({
              ...goal,
              type: 'life_goal',
              progress: Math.round(progress)
            });
          });
        }
        
        // Process education goals
        if (educationRes.ok) {
          const educationPayload = await educationRes.json().catch(() => null);
          const educationGoalsArray: any[] = Array.isArray(educationPayload)
            ? educationPayload
            : Array.isArray(educationPayload?.goals)
              ? educationPayload.goals
              : [];

          if (educationPayload && !Array.isArray(educationPayload) && !Array.isArray(educationPayload?.goals)) {
            console.warn('[LIFE-GOALS-WIDGET] Unexpected education goals payload shape:', educationPayload);
          }

          educationGoalsArray.forEach((goal: any) => {
            const projection = goal.projection || {};
            const successProbability = Number(
              projection.probabilityOfSuccess ??
              projection.monteCarloAnalysis?.probabilityOfSuccess ??
              (projection.monteCarloAnalysis?.probabilityOfComprehensiveCoverage ?? null)
            );

            let progress: number;
            if (Number.isFinite(successProbability) && successProbability > 0) {
              progress = successProbability;
            } else if (projection.comprehensiveFundingPercentage != null) {
              progress = Number(projection.comprehensiveFundingPercentage);
            } else if (goal.comprehensiveFundingPercentage != null) {
              progress = Number(goal.comprehensiveFundingPercentage);
            } else {
              const targetAmount = Number(goal.totalCost || goal.estimatedCost || projection.totalCost || 0);
              const currentAmount = Number(goal.currentSavings || projection.totalFunded || 0);
              progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
            }

            const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));

            const savedOptimization = goal.savedOptimization || goal.savedOptimizationResult;
            const hasOptimizedEducation = Boolean(
              savedOptimization?.result?.optimizedProbabilityOfSuccess != null ||
                savedOptimization?.optimizedProbabilityOfSuccess != null
            );

            const baseEducationName = goal.studentName
              ? `${goal.studentName}'s Education`
              : goal.childName
                ? `${goal.childName}'s Education`
                : 'Education';

            const educationLabel = hasOptimizedEducation
              ? `${baseEducationName} (optimized)`
              : baseEducationName;

            allGoals.push({
              ...goal,
              goalName: educationLabel,
              type: 'education',
              progress: normalizedProgress,
              successProbability: Number.isFinite(successProbability) ? successProbability : null,
            });
          });
        }

        // Sort by progress and take top 6
        const educationGoals = allGoals.filter((goal: any) => goal.type === 'education');
        const nonEducationGoals = allGoals.filter((goal: any) => goal.type !== 'education');

        const educationByPriority = educationGoals.sort(
          (a: any, b: any) => (b.successProbability ?? b.progress) - (a.successProbability ?? a.progress)
        );
        const primaryEducationGoal = educationByPriority[0] ?? null;

        const remainingGoals = nonEducationGoals
          .sort((a: any, b: any) => (b.successProbability ?? b.progress) - (a.successProbability ?? a.progress))
          .slice(0, primaryEducationGoal ? 2 : 3);

        const finalGoals = primaryEducationGoal
          ? [primaryEducationGoal, ...remainingGoals]
          : remainingGoals;

        if (!cancelled) setGoals(finalGoals);
      } catch (error) {
        console.error('[LIFE-GOALS-WIDGET] Error fetching goals:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    
    fetchGoals();

    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  if (isLoading) {
    return (
      <div className="text-center w-full">
        <div className="text-gray-500 text-sm">Loading goals...</div>
        <div className="text-xs text-gray-600 mt-1">{elapsedSeconds}s elapsed</div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="text-center w-full">
        <div className="text-gray-500 text-sm">No goals set</div>
        <div className="text-xs text-gray-600 mt-1">Add life goals to track progress</div>
      </div>
    );
  }

  // Display goals with progress bars
  return (
    <div className="w-full space-y-1.5">
      {goals.map((goal) => {
        const progress = Math.min(100, goal.progress); // Cap display at 100%
        const progressColor = progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-blue-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-orange-500';
        
        return (
          <div key={goal.id} className="flex items-center gap-2">
            <div className="text-xs text-gray-400 w-32 text-right" title={goal.goalName || goal.description}>
              {goal.goalName || goal.description || goal.goalType || 'Goal'}
            </div>
            <div className="w-3/4 bg-gray-700 rounded-full h-3 relative overflow-hidden">
              <div 
                className={`absolute left-0 top-0 h-full ${progressColor} transition-all duration-500`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-300 w-10 text-left">{goal.progress}%</div>
          </div>
        );
      })}
    </div>
  );
}

// Independent component for Social Security Optimization Impact
function SocialSecurityOptimizationWidget({ profileData, refreshSignal }: { profileData: any; refreshSignal: number }) {
  const [ssData, setSSData] = useState<{
    totalDifference?: number;
    percentageGain?: number;
    optimalUserAge?: number;
    optimalSpouseAge?: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const calculatedForRef = useRef<string | null>(null);
  const prevRefreshRef = useRef<number | null>(null);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCalculating) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCalculating]);

  useEffect(() => {
    if (prevRefreshRef.current !== refreshSignal) {
      prevRefreshRef.current = refreshSignal;
      calculatedForRef.current = null;
      setSSData(null);
    }

    async function calculateSSOptimization() {
      // Check if we have basic profile data
      if (!profileData?.dateOfBirth || !profileData?.annualIncome) {
        console.log('[SS-OPTIMIZATION-WIDGET] Missing basic profile data');
        setSSData(null);
        calculatedForRef.current = null;
        return;
      }

      // Create a cache key based on relevant profile fields
      const profileCacheKey = JSON.stringify({
        dateOfBirth: profileData.dateOfBirth,
        spouseDateOfBirth: profileData.spouseDateOfBirth,
        annualIncome: profileData.annualIncome,
        spouseAnnualIncome: profileData.spouseAnnualIncome,
        retirementAge: profileData.retirementAge || profileData.desiredRetirementAge,
        spouseRetirementAge: profileData.spouseRetirementAge || profileData.spouseDesiredRetirementAge,
        maritalStatus: profileData.maritalStatus
      });

      // Skip if we already calculated for this profile data
      if (calculatedForRef.current === profileCacheKey) {
        console.log('[SS-OPTIMIZATION-WIDGET] Already calculated for this profile');
        return;
      }

      setIsCalculating(true);
      try {
        console.log('[SS-OPTIMIZATION-WIDGET] Calculating Social Security optimization...');
        
        const response = await fetch('/api/calculate-cumulative-ss-optimization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[SS-OPTIMIZATION-WIDGET] SS optimization response:', data);
          
          if (data.combined) {
            setSSData({
              totalDifference: data.combined.totalDifference,
              percentageGain: data.combined.percentageGain,
              optimalUserAge: data.combined.optimalUserAge,
              optimalSpouseAge: data.combined.optimalSpouseAge
            });
            calculatedForRef.current = profileCacheKey;
          } else {
            console.log('[SS-OPTIMIZATION-WIDGET] No combined data in response');
            setSSData(null);
          }
        } else {
          console.error('[SS-OPTIMIZATION-WIDGET] API response not ok:', response.status);
          setSSData(null);
        }
      } catch (error) {
        console.error('[SS-OPTIMIZATION-WIDGET] Error calculating SS optimization:', error);
        setSSData(null);
      } finally {
        setIsCalculating(false);
      }
    }

    if (profileData) {
      calculateSSOptimization();
    }
  }, [profileData, refreshSignal]);

  const formatCurrency = (v: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      .format(Number(v || 0));

  if (isCalculating) {
    return (
      <div className="text-center">
        <div className="text-gray-500 text-sm">Optimizing Social Security...</div>
        <div className="text-xs text-gray-600 mt-2">{elapsedSeconds}s elapsed</div>
      </div>
    );
  }

  if (!ssData || ssData.totalDifference === undefined) {
    return (
      <div className="text-center">
        <div className="text-gray-500 text-sm">No optimization data</div>
        <div className="text-xs text-gray-600 mt-2">Missing profile information</div>
      </div>
    );
  }

  const isMarried = profileData?.maritalStatus === 'married' || profileData?.maritalStatus === 'partnered';
  const difference = ssData.totalDifference;
  const percentGain = ssData.percentageGain || 0;
  
  return (
    <>
      <div className={`text-3xl font-bold ${difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
      </div>
      <div className={`text-sm mt-2 ${difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {percentGain >= 0 ? '+' : ''}{percentGain.toFixed(1)}% increase
      </div>
      <div className="text-xs text-gray-400 mt-1">
        Lifetime Social Security income
      </div>
      <div className="text-xs text-gray-500 mt-2">
        {isMarried && ssData.optimalSpouseAge !== ssData.optimalUserAge
          ? `Optimal claiming: ${ssData.optimalUserAge}/${ssData.optimalSpouseAge}`
          : `Optimal claiming age: ${ssData.optimalUserAge}`
        }
      </div>
    </>
  );
}

function ReportBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdvisor = user?.role === 'advisor';
  const [refreshSignal, setRefreshSignal] = useState(0);
  const refreshInFlightRef = useRef(false);
  const initialRefreshTriggeredRef = useRef(false);

  // Branding
  const { data: branding } = useQuery<Branding | null>({
    queryKey: ['/api/report/branding', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/report/branding', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Fetch profile with calculations for widget previews (other than the 3 main metrics)
  const { data: profileData, refetch: refetchProfile } = useQuery({
    queryKey: ['/api/financial-profile', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/financial-profile', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: 'always',
  });

  // Use the dedicated hook for the metrics to avoid Dashboard imports
  const { healthScore, monthlyCashFlow, netWorth, optimizationImpact } = useReportWidgets();
  
  // Fetch cached Impact on Portfolio Balance data
  const { data: impactOnPortfolioData } = useQuery({
    queryKey: ['/api/retirement/impact-on-portfolio-balance-cache'],
    queryFn: async () => {
      console.log('[REPORT-BUILDER] Step 1: Fetching Impact on Portfolio Balance cache...');
      const res = await fetch('/api/retirement/impact-on-portfolio-balance-cache', { credentials: 'include' });
      console.log('[REPORT-BUILDER] Step 2: Cache API response status:', res.status);
      if (!res.ok) {
        console.error('[REPORT-BUILDER] Step 2a: Cache API failed with status:', res.status);
        return null;
      }
      const data = await res.json();
      console.log('[REPORT-BUILDER] Step 3: Cache data received:', {
        hasData: !!data,
        hasCached: data?.cached,
        hasComparison: !!data?.comparison,
        hasProjectionData: !!data?.projectionData,
        comparison: data?.comparison,
        projectionDataLength: data?.projectionData?.length
      });
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: 'always',
  });

  const refreshAllWidgets = useCallback(async () => {
    if (refreshInFlightRef.current) {
      console.log('[REPORT-BUILDER] Refresh already in progress, skipping duplicate trigger.');
      return;
    }

    refreshInFlightRef.current = true;
    console.log('[REPORT-BUILDER] Refreshing all widget data...');
    try {
      // 1. Refetch profile data (includes calculations, monte carlo, optimization variables)
      await refetchProfile();

      // 2. Force recalculation of key financial metrics 
      try {
        const recalcResponse = await fetch('/api/financial-profile/recalculate', {
          method: 'POST',
          credentials: 'include'
        });
        if (recalcResponse.ok) {
          console.log('[REPORT-BUILDER] Financial metrics recalculated');
        }
      } catch (error) {
        console.error('[REPORT-BUILDER] Error recalculating metrics:', error);
      }

      // 3. Force refresh Social Security optimization cache
      try {
        const ssResponse = await fetch('/api/calculate-cumulative-ss-optimization?force=true', {
          method: 'POST',
          credentials: 'include'
        });
        if (ssResponse.ok) {
          console.log('[REPORT-BUILDER] Social Security optimization cache refreshed');
        }
      } catch (error) {
        console.error('[REPORT-BUILDER] Error refreshing SS optimization:', error);
      }

      // 4. Invalidate widget caches on the server
      try {
        const cacheResponse = await fetch('/api/widget-cache/invalidate-all', {
          method: 'POST',
          credentials: 'include'
        });
        if (cacheResponse.ok) {
          console.log('[REPORT-BUILDER] Server widget caches invalidated');
        }
      } catch (error) {
        console.error('[REPORT-BUILDER] Error invalidating server caches:', error);
      }

      // 5. Invalidate all report-related queries for fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/financial-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['centralInsights'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/retirement/impact-on-portfolio-balance-cache'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/life-goals'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/education/goals'] }),
        queryClient.invalidateQueries({ queryKey: ['api/dashboard-snapshot'] }),
      ]);
    } catch (error) {
      console.error('[REPORT-BUILDER] Unexpected error during refresh:', error);
    } finally {
      setRefreshSignal(prev => prev + 1);
      refreshInFlightRef.current = false;
      console.log('[REPORT-BUILDER] Widget refresh signal dispatched');
    }
  }, [refetchProfile, queryClient]);

  useEffect(() => {
    if (!user?.id) return;
    if (initialRefreshTriggeredRef.current) return;
    initialRefreshTriggeredRef.current = true;
    void refreshAllWidgets();
  }, [user?.id, refreshAllWidgets]);

  // Currency formatter and calc alias for other metrics
  const formatCurrency = (v: number | null | undefined) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      .format(Number(v || 0));
  const calc = (profileData as any)?.calculations || {};

  // Align insurance score with dashboard snapshot methodology
  const { data: dashboardSnapshot } = useDashboardSnapshot();
  const snapInsurance = pickWidget<any>(dashboardSnapshot, 'insurance_adequacy');
  const snapEmergency = pickWidget<any>(dashboardSnapshot, 'emergency_readiness');
  const emergencySnapshotScore =
    typeof snapEmergency?.score === 'number' && !Number.isNaN(snapEmergency.score)
      ? snapEmergency.score
      : null;
  const emergencyMetrics = useMemo(
    () => computeEmergencyReadinessMetrics(profileData, {
      snapshot: dashboardSnapshot,
      snapshotScore: emergencySnapshotScore,
    }),
    [profileData, dashboardSnapshot, emergencySnapshotScore, refreshSignal]
  );
  const emergencyReadinessScoreDashboard = emergencyMetrics.score;
  const insuranceScore = useMemo(() => {
    const snapshotScore = snapInsurance?.score;
    if (typeof snapshotScore === 'number' && !Number.isNaN(snapshotScore)) {
      return Math.round(snapshotScore);
    }

    const candidates = [
      profileData?.calculations?.insuranceAdequacy?.score,
      profileData?.calculations?.riskManagementScore,
      (profileData?.calculations as any)?.breakdown?.insuranceScore,
      profileData?.riskManagementScore,
      calc?.insuranceScore,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'number' && !Number.isNaN(candidate)) {
        return Math.round(candidate);
      }
    }

    return 0;
  }, [snapInsurance?.score, profileData?.calculations, profileData?.riskManagementScore, calc?.insuranceScore]);

  // Layout
  const { data: layoutData } = useQuery<{ layout: string[]; insightsSectionTitle: string; draftInsights?: InsightItem[] } | null>({
    queryKey: ['reportLayout', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/report/layout', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
  });

  const [widgets, setWidgets] = useState<string[]>(() => sanitizeWidgetLayout());
  const [insightsTitle, setInsightsTitle] = useState<string>(layoutData?.insightsSectionTitle || (isAdvisor ? 'Recommendations' : 'Insights'));
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    if (layoutData === undefined) return;
    const nextLayout = sanitizeWidgetLayout(layoutData?.layout);
    setWidgets((prev) => {
      if (prev.length === nextLayout.length && prev.every((key, idx) => key === nextLayout[idx])) {
        return prev;
      }
      return nextLayout;
    });
    if (layoutData?.insightsSectionTitle) setInsightsTitle(layoutData.insightsSectionTitle);
  }, [layoutData]);

  // Insights
  const { data: insightsResp, refetch: refetchInsights, isFetching: isFetchingInsights } = useQuery<{ insights: Array<{ id: string; title?: string; explanation?: string; actionItems?: string[] }> }>({
    queryKey: ['centralInsights', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/central-insights', { credentials: 'include' });
      if (!res.ok) return { insights: [] } as any;
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 5_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const prefilledInsights = useMemo(
    () => (insightsResp?.insights || [])
      .slice(0, 10)
      .map((i, idx) => ({ id: i.id, text: formatInsightText(i), order: idx })),
    [insightsResp?.insights]
  );

  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [hasLoadedInitialInsights, setHasLoadedInitialInsights] = useState(false);

  const saveDraftInsightsMutation = useMutation({
    mutationFn: async (payload: InsightItem[]) => {
      const res = await fetch('/api/report/draft-insights', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insights: payload }),
      });
      if (!res.ok) throw new Error('Failed to save draft insights');
      return res.json();
    },
  });

  const { mutate: manualSaveInsights, isPending: isManualSavePending } = useMutation({
    mutationFn: async (payload: InsightItem[]) => {
      const res = await fetch('/api/report/draft-insights', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insights: payload }),
      });
      if (!res.ok) throw new Error('Failed to save insights');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Insights saved',
        description: 'Your recommendations were saved successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Save failed',
        description: 'We could not save insights right now. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleManualSaveInsights = useCallback(() => {
    const prepared = insights.map((ins, idx) => ({ ...ins, order: idx }));
    const serialized = JSON.stringify(prepared);
    lastSentInsightsRef.current = serialized;
    manualSaveInsights(prepared);
  }, [insights, manualSaveInsights]);

  const debouncedSaveInsights = useMemo(
    () =>
      debounce((payload: InsightItem[]) => {
        saveDraftInsightsMutation.mutate(payload);
      }, 1000),
    [saveDraftInsightsMutation]
  );

  const debouncedSaveInsightsRef = useRef(debouncedSaveInsights);
  const lastSentInsightsRef = useRef<string>('');
  useEffect(() => {
    debouncedSaveInsightsRef.current = debouncedSaveInsights;
  }, [debouncedSaveInsights]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      debouncedSaveInsightsRef.current.flush();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        debouncedSaveInsightsRef.current.flush();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      debouncedSaveInsightsRef.current.flush();
      debouncedSaveInsightsRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    if (layoutData === undefined) return;
    if (layoutData?.draftInsights && layoutData.draftInsights.length > 0) {
      lastSentInsightsRef.current = JSON.stringify(
        layoutData.draftInsights.map((ins, idx) => ({ ...ins, order: idx }))
      );
      setInsights(layoutData.draftInsights);
      setHasLoadedInitialInsights(true);
    } else if (!hasLoadedInitialInsights) {
      lastSentInsightsRef.current = '';
      setInsights(prefilledInsights);
      setHasLoadedInitialInsights(true);
    }
  }, [layoutData, prefilledInsights, hasLoadedInitialInsights]);

  useEffect(() => {
    if (!hasLoadedInitialInsights) return;
    const prepared = insights.map((ins, idx) => ({ ...ins, order: idx }));
    const serialized = JSON.stringify(prepared);
    if (serialized === lastSentInsightsRef.current) return;
    lastSentInsightsRef.current = serialized;
    debouncedSaveInsightsRef.current(prepared);
  }, [insights, hasLoadedInitialInsights]);

  useEffect(() => {
    if (!hasLoadedInitialInsights) return;
    if ((layoutData?.draftInsights?.length || 0) > 0) return;
    if (prefilledInsights.length === 0) return;
    if (insights.length === 0) {
      setInsights(prefilledInsights);
    }
  }, [prefilledInsights, hasLoadedInitialInsights, layoutData?.draftInsights, insights.length]);

  const DEFAULT_DISCLAIMER = sanitizePrintable(`IMPORTANT DISCLOSURES

For Informational Purposes Only — The information provided through this platform is for educational and informational purposes only and does not constitute personalized investment advice, legal advice, tax advice, or a recommendation to buy or sell any security. Any investment decisions you make are your sole responsibility.

No Guarantee of Outcomes — Financial projections (including Monte Carlo analyses and scenario modeling) are based on assumptions believed to be reasonable as of the date produced but are not guarantees of future performance or outcomes. Investment returns, inflation, tax laws, and market conditions are uncertain and may differ materially from assumptions.

Past Performance — Past performance is not indicative of future results. All investing involves risk, including the possible loss of principal.

Fiduciary Standard & Conflicts — Integrity Advisors (“Firm”) seeks to act in the best interest of clients at all times. The Firm may receive compensation as disclosed in its Form ADV and other documents. Clients should review the Firm’s disclosures for details on services, fees, and potential conflicts of interest.

Registration & Jurisdiction — Advisory services are offered only to residents of jurisdictions where the Firm is appropriately registered, exempt, or excluded from registration. This material is not an offer to provide advisory services in any jurisdiction where such offer would be unlawful.

Third-Party Data & Assumptions — Certain data, benchmarks, or estimates may be obtained from third-party sources believed to be reliable but are not guaranteed for accuracy or completeness. The Firm is not responsible for errors or omissions from such sources.

Tax & Legal — The Firm does not provide tax or legal advice. Clients should consult their tax advisor or attorney regarding their specific situation. Any tax estimates are for planning purposes only and may not reflect current or future law.

Suitability & Client Responsibility — Recommendations depend on the completeness and accuracy of information you provide. Please promptly notify the Firm of any material changes to your financial situation, goals, or constraints.

Rebalancing, Trading, and Fees — Portfolio rebalancing and trading may have tax consequences and incur costs. Advisory fees reduce returns over time. Refer to your advisory agreement and the Firm’s Form ADV 2A for fee schedules and disclosures.

Cybersecurity & Electronic Communications — While the Firm employs commercially reasonable safeguards, electronic communications may be subject to interception or loss. Do not transmit sensitive personal information unless instructed to do so via a secure channel.

Privacy — The Firm’s Privacy Policy describes how client information is collected, used, and safeguarded. A copy is available upon request.

Contact — Bhavneesh Sharma, bsharma@integrityadvisors.org`);

  const [disclaimer, setDisclaimer] = useState<string>(sanitizePrintable(branding?.defaultDisclaimer || DEFAULT_DISCLAIMER));
  useEffect(() => {
    if (branding?.defaultDisclaimer && isAdvisor) setDisclaimer(sanitizePrintable(branding.defaultDisclaimer));
    if (!branding?.defaultDisclaimer && !isAdvisor) setDisclaimer(DEFAULT_DISCLAIMER);
  }, [branding?.defaultDisclaimer, isAdvisor]);
  const [isDeckGenerating, setIsDeckGenerating] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfElapsedSeconds, setPdfElapsedSeconds] = useState(0);
  const [deckElapsedSeconds, setDeckElapsedSeconds] = useState(0);
  const pdfTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const captureReportAssets = useCallback(async (): Promise<CaptureAssetsResult> => {
    console.log('[EXPORT] Capturing report assets...');
    setIsLightTheme(true);
    await new Promise((resolve) => setTimeout(resolve, 320));

    try {
      let logo: CapturedLogo = null;

      if (branding?.logoUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = branding.logoUrl;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          logo = {
            dataUrl: canvas.toDataURL('image/png'),
            width: img.width || canvas.width || 1,
            height: img.height || canvas.height || 1,
          };
        } catch (error) {
          console.error('[EXPORT] Failed to capture logo:', error);
        }
      }

      const widgetImages: CapturedWidgetImage[] = [];

      for (let i = 0; i < widgets.length; i++) {
        const widgetElement = document.getElementById(`widget-${i}`);
        if (!widgetElement) continue;

        console.log(`[EXPORT] Capturing widget ${i}: ${widgets[i]}`);
        try {
          const canvas = await html2canvas(widgetElement, {
            backgroundColor: '#FFFFFF',
            scale: 2,
            useCORS: true,
            allowTaint: true,
          });
          const dataUrl = canvas.toDataURL('image/png');
          const base64 = dataUrl.split(',')[1] || '';
          const aspect = canvas.width === 0 ? 0.6 : canvas.height / canvas.width;
          widgetImages.push({ key: widgets[i], dataUrl, base64, aspect });
        } catch (error) {
          console.error(`[EXPORT] Failed to capture widget ${i}:`, error);
        }
      }

      return { logo, widgetImages };
    } finally {
      setIsLightTheme(false);
    }
  }, [branding?.logoUrl, widgets]);

  useEffect(() => {
    return () => {
      if (pdfTimerRef.current) clearInterval(pdfTimerRef.current);
      if (deckTimerRef.current) clearInterval(deckTimerRef.current);
    };
  }, []);

  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/report/layout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: sanitizeWidgetLayout(widgets), insightsSectionTitle: insightsTitle }),
      });
      if (!res.ok) throw new Error('Failed to save layout');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reportLayout', user?.id] }),
  });

  const exportStatuses = useMemo(() => {
    const statuses: Array<{ label: string; seconds: number }> = [];
    if (isPdfGenerating) {
      statuses.push({ label: 'Generating report (PDF)', seconds: pdfElapsedSeconds });
    }
    if (isDeckGenerating) {
      statuses.push({ label: 'Generating report (slide deck)', seconds: deckElapsedSeconds });
    }
    return statuses;
  }, [isPdfGenerating, pdfElapsedSeconds, isDeckGenerating, deckElapsedSeconds]);

  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/report/snapshot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: sanitizeWidgetLayout(widgets), insights, insightsTitle, disclaimerText: disclaimer, force: false }),
      });
      if (!res.ok) throw new Error('Failed to create snapshot');
      return res.json();
    },
    onSuccess: (data) => setSnapshotId(data?.id || null),
  });

  const regenerateInsightsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/generate-central-insights', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to regenerate insights');
      return res.json();
    },
    onSuccess: (data) => {
      // Reset to freshly generated insights (top 10)
      const next = (data?.insights || [])
        .slice(0, 10)
        .map((i: any, idx: number) => ({ id: i.id, text: formatInsightText(i), order: idx }));
      setInsights(next);
      refetchInsights();
    }
  });

  const downloadReport = async () => {
    if (isPdfGenerating || isDeckGenerating) return;
    setIsPdfGenerating(true);
    setPdfElapsedSeconds(0);
    if (pdfTimerRef.current) clearInterval(pdfTimerRef.current);
    pdfTimerRef.current = setInterval(() => setPdfElapsedSeconds((prev) => prev + 1), 1000);

    try {
      console.log('[PDF-EXPORT] Starting PDF export with client-side capture...');

      const { widgetImages, logo } = await captureReportAssets();
      const headerBranding = branding || { firmName: 'Affluvia' };

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const contentWidth = pageWidth - 2 * margin;
      let currentY = margin;

      const headerHeight = 22;
      pdf.setFillColor(52, 73, 115);
      pdf.rect(0, 0, pageWidth, headerHeight, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(255, 255, 255);
      pdf.text(headerBranding.firmName || 'Affluvia', margin, 12, { baseline: 'middle' });

      if (logo?.dataUrl) {
        try {
          const maxWidth = 30;
          const maxHeight = 14;
          const imgWidth = Math.max(1, logo.width || maxWidth);
          const imgHeight = Math.max(1, logo.height || maxHeight);
          let logoWidth = imgWidth;
          let logoHeight = imgHeight;

          if (logoWidth > maxWidth) {
            const scale = maxWidth / logoWidth;
            logoWidth *= scale;
            logoHeight *= scale;
          }
          if (logoHeight > maxHeight) {
            const scale = maxHeight / logoHeight;
            logoWidth *= scale;
            logoHeight *= scale;
          }

          const logoX = pageWidth - margin - logoWidth;
          const logoY = Math.max(4, headerHeight / 2 - logoHeight / 2);
          pdf.addImage(logo.dataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight, undefined, 'FAST');
        } catch (logoError) {
          console.error('[PDF-EXPORT] Failed to place logo in header:', logoError);
        }
      }

      if (branding) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const contactParts: string[] = [];
        if (branding.address) contactParts.push(branding.address);
        if (branding.phone) contactParts.push(branding.phone);
        if (branding.email) contactParts.push(branding.email);
        const contactInfo = contactParts.join(' • ');
        if (contactInfo) {
          pdf.text(contactInfo, margin, 18, { baseline: 'middle' });
        }
      }

      currentY = headerHeight + 8;
      pdf.setTextColor(0, 0, 0);

      pdf.setFontSize(16);
      const clientName = profileData?.firstName && profileData?.lastName
        ? `${profileData.firstName} ${profileData.lastName}`
        : profileData?.firstName || 'Client';
      pdf.text(`Financial Planning Report for ${clientName}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 7;

      pdf.setFontSize(12);
      pdf.text(`Report Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 12;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('Financial Overview', margin, currentY);
      currentY += 12;

      const widgetsPerRow = 2;
      const gutterX = 10;
      const gutterY = 8;
      const columnWidth = (contentWidth - (widgetsPerRow - 1) * gutterX) / widgetsPerRow;

      let col = 0;
      let rowY = currentY;
      let maxRowHeight = 0;

      for (let i = 0; i < widgetImages.length; i++) {
        const img = widgetImages[i];
        const width = columnWidth;
        const height = Math.max(1, width * (img.aspect || 0.6));

        if (col === 0 && rowY + height > pageHeight - margin) {
          pdf.addPage();
          rowY = margin;
        }

        const x = margin + col * (width + gutterX);
        const y = rowY;

        try {
          const imageData = img.base64 ? `data:image/png;base64,${img.base64}` : img.dataUrl;
          pdf.addImage(imageData, 'PNG', x, y, width, height);
        } catch (error) {
          console.error(`[PDF-EXPORT] Failed to add image for widget ${i}:`, error);
        }

        maxRowHeight = Math.max(maxRowHeight, height);
        col++;

        if (col === widgetsPerRow) {
          col = 0;
          rowY += maxRowHeight + gutterY;
          maxRowHeight = 0;
        }
      }

      if (col !== 0) {
        rowY += maxRowHeight + gutterY;
      }

      currentY = rowY + 10;

      if (currentY > pageHeight - 60) {
        pdf.addPage();
        currentY = margin;
      }

      if (insights.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text(insightsTitle || 'Insights', margin, currentY);
        currentY += 9;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        insights.forEach((insight) => {
          if (!insight.text?.trim()) return;
          const lines = pdf.splitTextToSize(`• ${insight.text}`, contentWidth);
          const lineHeight = 5;
          const needed = lines.length * lineHeight + 3;

          if (currentY + needed > pageHeight - margin) {
            pdf.addPage();
            currentY = margin;
          }

          pdf.text(lines, margin, currentY);
          currentY += needed;
        });
        currentY += 6;
      }

      const disclaimerTextRaw = disclaimer || 'This report is for informational purposes only and does not constitute personalized investment, tax, or legal advice. All projections are estimates and are not guarantees of future results.';
      const disclaimerText = sanitizePrintable(disclaimerTextRaw);
      const disclaimerLines = pdf.splitTextToSize(disclaimerText, contentWidth);
      const disclaimerHeight = disclaimerLines.length * 5.6 + 10;

      if (currentY + disclaimerHeight > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Important Disclosures', margin, currentY);
      currentY += 7;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const previousLineHeightFactor = typeof (pdf as any).getLineHeightFactor === 'function'
        ? (pdf as any).getLineHeightFactor()
        : 1.15;
      pdf.setLineHeightFactor(1.4);
      pdf.text(disclaimerLines, margin, currentY, { baseline: 'top' });
      pdf.setLineHeightFactor(previousLineHeightFactor);
      currentY += disclaimerLines.length * 5.6;

      const pageCount = pdf.getNumberOfPages();
      const year = new Date().getFullYear();
      const footerText = `© ${year} ${headerBranding.firmName || 'Affluvia'} — Confidential Client Report`;

      for (let p = 1; p <= pageCount; p++) {
        pdf.setPage(p);
        const footerY = pdf.internal.pageSize.getHeight() - 10;
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        pdf.text(footerText, margin, footerY);
        pdf.text(`Page ${p} of ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
      }
      pdf.setTextColor(0, 0, 0);

      const fileName = `${headerBranding.firmName || 'Affluvia'}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      console.log('[PDF-EXPORT] PDF generated and downloaded successfully');

    } catch (error) {
      console.error('[PDF-EXPORT] Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    }
    finally {
      if (pdfTimerRef.current) {
        clearInterval(pdfTimerRef.current);
        pdfTimerRef.current = null;
      }
      setIsPdfGenerating(false);
      setPdfElapsedSeconds(0);
    }
  };

  const downloadSlideDeck = async () => {
    if (isDeckGenerating || isPdfGenerating) return;
    setIsDeckGenerating(true);
    setDeckElapsedSeconds(0);
    if (deckTimerRef.current) clearInterval(deckTimerRef.current);
    deckTimerRef.current = setInterval(() => setDeckElapsedSeconds((prev) => prev + 1), 1000);

    try {
      console.log('[PPTX-EXPORT] Starting slide deck export...');

      const { logo, widgetImages } = await captureReportAssets();
      const headerBranding = branding || { firmName: 'Affluvia' };
      const clientName = profileData?.firstName && profileData?.lastName
        ? `${profileData.firstName} ${profileData.lastName}`
        : profileData?.firstName || 'Client';

      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';

      const slides: ReturnType<PptxGenJS['addSlide']>[] = [];
      const darkBg = '111827';
      const accent = '38BDF8';
      const textPrimary = 'F9FAFB';
      const textSecondary = 'E5E7EB';
      const footerColor = '94A3B8';
      const slideWidth = 10;
      const slideHeight = 5.625;

      const titleSlide = pptx.addSlide({ background: { color: darkBg } });
      slides.push(titleSlide);

      if (logo?.dataUrl) {
        titleSlide.addImage({ data: logo.dataUrl, x: 8.6, y: 0.4, w: 1.2, h: 1.2, sizing: { type: 'contain', w: 1.2, h: 1.2 } });
      }

      titleSlide.addText(headerBranding.firmName || 'Affluvia', {
        x: 0.7,
        y: 1.0,
        w: 8.6,
        fontSize: 36,
        color: textPrimary,
        bold: true,
      });

      titleSlide.addText(`Prepared for ${clientName}`, {
        x: 0.7,
        y: 1.9,
        w: 8.6,
        fontSize: 24,
        color: textSecondary,
      });

      titleSlide.addText(new Date().toLocaleDateString(), {
        x: 0.7,
        y: 2.4,
        w: 8.6,
        fontSize: 18,
        color: textSecondary,
      });

      const contactParts: string[] = [];
      if (branding?.address) contactParts.push(branding.address);
      if (branding?.phone) contactParts.push(branding.phone);
      if (branding?.email) contactParts.push(branding.email);
      if (contactParts.length > 0) {
        titleSlide.addText(contactParts.join(' • '), {
          x: 0.7,
          y: 2.9,
          w: 8.6,
          fontSize: 16,
          color: textSecondary,
        });
      }

      const maxWidgetWidth = slideWidth - 1.0;
      const maxWidgetHeight = slideHeight - 2.4;

      widgetImages.forEach((img, index) => {
        const slide = pptx.addSlide({ background: { color: darkBg } });
        slides.push(slide);

        slide.addText(formatWidgetTitle(img.key), {
          x: 0.6,
          y: 0.5,
          w: slideWidth - 1.2,
          fontSize: 30,
          color: textPrimary,
          bold: true,
        });

        const aspect = img.aspect || 0.6;
        let imgWidth = maxWidgetWidth;
        let imgHeight = imgWidth * aspect;
        if (imgHeight > maxWidgetHeight) {
          imgHeight = maxWidgetHeight;
          imgWidth = imgHeight / aspect;
        }

        const imgX = (slideWidth - imgWidth) / 2;
        const imgY = 1.1 + Math.max(0, (maxWidgetHeight - imgHeight) / 2);

        slide.addImage({
          data: img.dataUrl,
          x: imgX,
          y: imgY,
          w: imgWidth,
          h: imgHeight,
        });
      });

      const sortedInsights = insights
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((i) => i.text?.trim())
        .filter((text): text is string => Boolean(text));

      const insightChunks = chunkArray(sortedInsights, 2);
      insightChunks.forEach((chunk, idx) => {
        const slide = pptx.addSlide({ background: { color: darkBg } });
        slides.push(slide);

        slide.addText(`${insightsTitle || 'Insights'} — Slide ${idx + 1}`, {
          x: 0.6,
          y: 0.5,
          w: slideWidth - 1.2,
          fontSize: 28,
          color: textPrimary,
          bold: true,
        });

        chunk.forEach((text, insightIdx) => {
          slide.addText(`• ${text}`, {
            x: 0.8,
            y: 1.2 + insightIdx * 2.0,
            w: slideWidth - 1.6,
            h: 1.8,
            fontSize: 22,
            color: textSecondary,
          });
        });
      });

      const disclaimerSlide = pptx.addSlide({ background: { color: darkBg } });
      slides.push(disclaimerSlide);

      disclaimerSlide.addText('Important Disclosures', {
        x: 0.6,
        y: 0.6,
        w: slideWidth - 1.2,
        fontSize: 30,
        color: accent,
        bold: true,
      });

      const disclaimerText = sanitizePrintable(disclaimer || 'This report is for informational purposes only and does not constitute personalized investment, tax, or legal advice. All projections are estimates and are not guarantees of future results. Assumptions, data inputs, and methodologies are subject to change. Please review with a qualified professional before making decisions.');

      disclaimerSlide.addText(disclaimerText, {
        x: 0.8,
        y: 1.4,
        w: slideWidth - 1.6,
        h: slideHeight - 2.2,
        fontSize: 20,
        color: textSecondary,
      });

      slides.forEach((slide, idx) => {
        slide.addText(headerBranding.firmName || 'Affluvia', {
          x: 0.6,
          y: slideHeight - 0.6,
          w: slideWidth / 2,
          fontSize: 12,
          color: footerColor,
        });
        slide.addText(`Slide ${idx + 1} of ${slides.length}`, {
          x: slideWidth - 2.1,
          y: slideHeight - 0.6,
          w: 1.5,
          fontSize: 12,
          color: footerColor,
          align: 'right',
        });
      });

      const fileName = `${headerBranding.firmName || 'Affluvia'}_Deck_${new Date().toISOString().slice(0, 10)}.pptx`;
      await pptx.writeFile({ fileName });

      console.log('[PPTX-EXPORT] Slide deck generated successfully');
    } catch (error) {
      console.error('[PPTX-EXPORT] Error generating slide deck:', error);
      alert('Failed to generate slide deck. Please try again.');
    } finally {
      if (deckTimerRef.current) {
        clearInterval(deckTimerRef.current);
        deckTimerRef.current = null;
      }
      setIsDeckGenerating(false);
      setDeckElapsedSeconds(0);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.droppableId === 'widgets' && result.destination.droppableId === 'widgets') {
      const items = Array.from(widgets);
      const [removed] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, removed);
      setWidgets(items);
    }
    if (result.source.droppableId === 'insights' && result.destination.droppableId === 'insights') {
      const list = Array.from(insights);
      const [removed] = list.splice(result.source.index, 1);
      list.splice(result.destination.index, 0, removed);
      setInsights(list.map((i, idx) => ({ ...i, order: idx })));
    }
  };

  const addCustomInsight = () => {
    setInsights((prev) => [...prev, { text: 'New insight', order: prev.length, isCustom: true }]);
  };

  const updateInsight = (idx: number, text: string) => {
    setInsights((prev) => prev.map((i, iIdx) => (iIdx === idx ? { ...i, text } : i)));
  };

  const removeInsight = (idx: number) => {
    setInsights((prev) => prev.filter((_, iIdx) => iIdx !== idx).map((i, newIdx) => ({ ...i, order: newIdx })));
  };

  const removeWidget = (widgetIndex: number) => {
    setWidgets((prev) => prev.filter((_, idx) => idx !== widgetIndex));
  };

  const getWidgetDisplayName = (widgetKey: string) => {
    const canonical = normalizeWidgetKey(widgetKey) ?? widgetKey;
    const names: { [key: string]: string } = {
      'financial_health_score': 'Financial Health Score',
      'monthly_cash_flow': 'Monthly Cash Flow',
      'net_worth': 'Net Worth',
      'optimized_retirement_confidence': 'Retirement Confidence',
      'optimized_portfolio_projection': 'Optimized Portfolio Projection',
      'ending_portfolio_value_increase': 'Portfolio Impact',
      'retirement_stress_test': 'Retirement Stress Test',
      'social_security_optimization_impact': 'Social Security Optimization',
      'roth_conversion_impact': 'Roth Conversion Impact',
      'life_goals_progress': 'Life Goals Progress',
      'insurance_adequacy_score': 'Insurance Adequacy',
      'emergency_readiness_score_new': 'Emergency Readiness (New)',
    };
    return names[canonical] || canonical.replace(/_/g, ' ');
  };

  const headerBranding = useMemo(() => {
    if (branding) return branding;
    return { firmName: 'Affluvia', logoUrl: null, address: null, phone: null, email: null } as Branding;
  }, [branding]);

  return (
    <>
      {/* Light theme styles for PDF export */}
      <style>{`
        .light-theme {
          background-color: white !important;
          color: black !important;
        }
        .light-theme .bg-gray-900\\/50,
        .light-theme .bg-gray-800,
        .light-theme .bg-gray-700,
        .light-theme .bg-gray-900\\/40 {
          background-color: white !important;
          border: 2px solid #e5e7eb !important;
          border-radius: 8px !important;
        }
        .light-theme .text-white,
        .light-theme .text-gray-300,
        .light-theme .text-gray-400,
        .light-theme .text-gray-500,
        .light-theme .text-gray-200 {
          color: #374151 !important;
        }
        .light-theme .border-gray-700,
        .light-theme .border-gray-600 {
          border-color: #d1d5db !important;
        }
        .light-theme .bg-green-500,
        .light-theme .bg-blue-500,
        .light-theme .bg-yellow-500,
        .light-theme .bg-orange-500,
        .light-theme .bg-red-500 {
          filter: brightness(0.9) !important;
        }
        .light-theme .text-green-500,
        .light-theme .text-blue-500,
        .light-theme .text-yellow-500,
        .light-theme .text-orange-500 {
          color: #1f2937 !important;
        }
        .light-theme .text-green-400,
        .light-theme .text-blue-400 {
          color: #065f46 !important;
        }
        .light-theme .bg-green-900\\/30,
        .light-theme .bg-blue-900\\/30,
        .light-theme .bg-yellow-900\\/30,
        .light-theme .bg-red-900\\/30 {
          background-color: #f3f4f6 !important;
          border: 1px solid #d1d5db !important;
          color: #374151 !important;
        }
        .light-theme .text-green-400.font-medium,
        .light-theme .text-blue-400.font-medium,
        .light-theme .text-yellow-400.font-medium,
        .light-theme .text-red-400.font-medium {
          color: #1f2937 !important;
          font-weight: 600 !important;
        }
        .light-theme .bg-gray-700 {
          background-color: #e5e7eb !important;
        }
        .light-theme .text-white {
          color: #111827 !important;
        }
        .light-theme .text-gray-200 {
          color: #111827 !important;
        }
        .light-theme .h-4.w-4.text-gray-500,
        .light-theme .h-4.w-4.text-red-400 {
          display: none !important;
        }
        .light-theme .absolute.top-2.right-2 {
          display: none !important;
        }
      `}</style>

      {exportStatuses.length > 0 && (
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-100">
            {exportStatuses.map((status) => (
              <div key={status.label} className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                <span>
                  {status.label}…{' '}
                  <span className="font-semibold text-sky-300">{status.seconds}s</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header/Branding preview */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Report Header</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4" data-header-section>
          {headerBranding?.logoUrl ? (
            <img src={headerBranding.logoUrl} alt="Logo" className="h-12 w-auto rounded bg-gray-900/40 p-2" />
          ) : (
            <div className="h-12 flex items-center">
              <div className="flex items-center gap-2 rounded bg-gray-900/60 border border-gray-700 px-3 py-2">
                <TrendingUp className="h-5 w-5 text-white" />
                <span className="text-lg font-semibold text-white">{headerBranding?.firmName || 'Affluvia'}</span>
              </div>
            </div>
          )}
          <div className="text-gray-200">
            <div className="text-lg font-semibold">{headerBranding?.firmName || 'Affluvia'}</div>
            <div className="text-xs text-gray-400">{headerBranding?.address}</div>
            <div className="text-xs text-gray-400">{headerBranding?.phone} {headerBranding?.email ? `• ${headerBranding.email}` : ''}</div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              onClick={downloadReport}
              disabled={isPdfGenerating || isDeckGenerating}
              className="disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPdfGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {isPdfGenerating ? 'Generating…' : 'Download Report'}
            </Button>
            <Button
              size="sm"
              onClick={downloadSlideDeck}
              disabled={isDeckGenerating || isPdfGenerating}
              className="bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDeckGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Presentation className="h-4 w-4 mr-2" />
              )}
              {isDeckGenerating ? 'Building Deck…' : 'Download Slide Deck'}
            </Button>
            <Button 
              size="sm" 
              className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white"
              onClick={() => { void refreshAllWidgets(); }}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Wrap ALL droppables in a single DragDropContext */}
      <DragDropContext onDragEnd={onDragEnd}>
        {/* Widgets grid (3 columns, flexible rows) */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Widgets</CardTitle>
              <Button 
                size="sm" 
                onClick={() => saveLayoutMutation.mutate()}
                disabled={saveLayoutMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveLayoutMutation.isPending ? 'Saving...' : 'Save Layout'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Droppable droppableId="widgets" direction="horizontal">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isLightTheme ? 'light-theme' : ''}`}>
                  {widgets.map((w, idx) => (
                    <Draggable draggableId={w + '_' + idx} index={idx} key={w + '_' + idx}>
                      {(drag) => (
                        <div 
                          id={`widget-${idx}`}
                          ref={drag.innerRef} 
                          {...drag.draggableProps} 
                          className="bg-gray-900/50 border border-gray-700 rounded p-3 min-h-[200px] flex flex-col items-center justify-start text-gray-300 relative pt-8"
                        >
                          <div {...drag.dragHandleProps} className="absolute top-2 left-2">
                            <GripVertical className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="absolute top-2 right-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                                  disabled={widgets.length <= 1}
                                  title={widgets.length <= 1 ? "Cannot remove the last widget" : "Remove widget"}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-white">Remove Widget</AlertDialogTitle>
                                  <AlertDialogDescription className="text-gray-400">
                                    Are you sure you want to remove "{getWidgetDisplayName(w)}" from the report? 
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => removeWidget(idx)}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Remove Widget
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                          {w === 'financial_health_score' ? (
                            <div className="flex flex-col items-center w-full space-y-2">
                          <div className={`${WIDGET_TITLE_CLASS} text-center`}>Financial Health Score</div>
                              <div className="text-3xl font-bold text-white">{Math.round(healthScore ?? 0)}</div>
                              <div className="text-xs text-gray-500 text-center">
                                {(healthScore ?? 0) >= 75 ? 'Excellent' :
                                 (healthScore ?? 0) >= 50 ? 'Good' :
                                 'Needs Improvement'}
                              </div>
                              <div className="w-full px-2">
                                <div className="w-full bg-gray-700 rounded-full h-3">
                                  <div 
                                    className={`h-3 rounded-full transition-all duration-500 ${
                                      (healthScore ?? 0) >= 75 ? 'bg-green-500' :
                                      (healthScore ?? 0) >= 50 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, healthScore ?? 0))}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : w === 'net_worth' ? (
                            <div className="flex flex-col items-center w-full">
                          <div className={`${WIDGET_TITLE_CLASS} mb-1`}>Net Worth</div>
                              <MetricDisplay
                                value={netWorth || 0}
                                format="currency"
                                size="md"
                                color={(netWorth ?? 0) >= 0 ? 'positive' : 'negative'}
                                showSign={false}
                              />
                              <div className={`mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                                (netWorth ?? 0) >= 500000 ? 'bg-green-900/30 text-green-400' :
                                (netWorth ?? 0) >= 100000 ? 'bg-blue-900/30 text-blue-400' :
                                (netWorth ?? 0) >= 0 ? 'bg-yellow-900/30 text-yellow-400' :
                                'bg-red-900/30 text-red-400'
                              }`}>
                                {(netWorth ?? 0) >= 500000 ? 'Strong' :
                                 (netWorth ?? 0) >= 100000 ? 'Building' :
                                 (netWorth ?? 0) >= 0 ? 'Positive' : 'Negative'}
                              </div>
                            </div>
                          ) : w === 'monthly_cash_flow' ? (
                            <div className="flex flex-col items-center w-full">
                          <div className={`${WIDGET_TITLE_CLASS} mb-1`}>Monthly Cash Flow</div>
                              <MetricDisplay
                                value={Math.round(monthlyCashFlow || 0)}
                                format="currency"
                                size="md"
                                color={(monthlyCashFlow ?? 0) >= 0 ? 'positive' : 'negative'}
                                showSign={false}
                              />
                              <div className={`mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                                (monthlyCashFlow ?? 0) >= 1000 ? 'bg-green-900/30 text-green-400' :
                                (monthlyCashFlow ?? 0) >= 0 ? 'bg-blue-900/30 text-blue-400' :
                                (monthlyCashFlow ?? 0) >= -500 ? 'bg-yellow-900/30 text-yellow-400' :
                                'bg-red-900/30 text-red-400'
                              }`}>
                                {(monthlyCashFlow ?? 0) >= 1000 ? 'Strong' :
                                 (monthlyCashFlow ?? 0) >= 0 ? 'Positive' :
                                 (monthlyCashFlow ?? 0) >= -500 ? 'Tight' : 'Critical'}
                              </div>
                            </div>
                          ) : w === 'retirement_confidence_gauge' ? (
                            <div className="flex flex-col items-center w-full space-y-3">
                          <div className={`${WIDGET_TITLE_CLASS} text-center`}>Retirement Confidence Score</div>
                              <div className="text-3xl font-bold text-white">
                                {Math.round(profileData?.optimizationVariables?.optimizedScore?.probabilityOfSuccess ?? 
                                           ((calc?.retirementReadinessScore ?? 0) * 100))}
                              </div>
                              <div className="text-xs text-gray-500 text-center">
                                Status: {(() => {
                                  const score = profileData?.optimizationVariables?.optimizedScore?.probabilityOfSuccess ?? 
                                               ((calc?.retirementReadinessScore ?? 0) * 100);
                                  return score >= 80 ? 'Optimized' : score >= 60 ? 'On Track' : 'Needs Attention';
                                })()}
                              </div>
                              <div className="w-full px-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                  <span>0</span>
                                  <span>{Math.round(profileData?.optimizationVariables?.optimizedScore?.probabilityOfSuccess ?? 
                                                   ((calc?.retirementReadinessScore ?? 0) * 100))}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-3">
                                  <div 
                                    className={`h-3 rounded-full transition-all duration-500 ${(() => {
                                      const score = profileData?.optimizationVariables?.optimizedScore?.probabilityOfSuccess ?? 
                                                   ((calc?.retirementReadinessScore ?? 0) * 100);
                                      return score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : 'bg-red-500';
                                    })()}`}
                                    style={{ 
                                      width: `${Math.min(100, Math.max(0, 
                                        profileData?.optimizationVariables?.optimizedScore?.probabilityOfSuccess ?? 
                                        ((calc?.retirementReadinessScore ?? 0) * 100)))}%` 
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : w === 'optimization_impact_on_balance' ? (
                            <div className="flex flex-col items-center w-full">
                          <div className={`${WIDGET_TITLE_CLASS} mb-2`}>Optimization Impact on Portfolio Value (Ending Assets)</div>
                              {optimizationImpact !== null ? (
                                <>
                                  <div className={`text-2xl font-bold ${optimizationImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {optimizationImpact >= 0 ? '+' : ''}{formatCurrency(optimizationImpact)}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-2">Ending portfolio value</div>
                                  <div className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                                    optimizationImpact >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                                  }`}>
                                    {optimizationImpact >= 0 ? 'Increase' : 'Decrease'}
                                  </div>
                                </>
                              ) : (
                                <div className="text-gray-500 text-sm">No optimization data</div>
                              )}
                            </div>
                          ) : w === 'optimization_impact_ending_portfolio' ? (
                            <div className="flex flex-col items-center w-full">
                          <div className={`${WIDGET_TITLE_CLASS} mb-2 text-center`}>Impact of Optimization on Ending Portfolio Value</div>
                              {optimizationImpact !== null && optimizationImpact !== 0 ? (
                                <>
                                  <div className="text-center">
                                    <div className="text-sm text-gray-300 mb-1">Optimized plan has</div>
                                    <div className={`text-3xl font-bold ${optimizationImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {formatCurrency(Math.abs(optimizationImpact))}
                                    </div>
                                    <div className="text-sm text-gray-300 mt-1">
                                      {optimizationImpact >= 0 ? 'more' : 'less'} ending assets
                                    </div>
                                  </div>
                                  <div className={`mt-3 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                                    optimizationImpact >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                                  }`}>
                                    {optimizationImpact >= 0 ? '↑ Improved' : '↓ Decreased'}
                                  </div>
                                </>
                              ) : optimizationImpact === 0 ? (
                                <div className="text-center">
                                  <div className="text-gray-500 text-sm">No change in ending portfolio</div>
                                  <div className="text-xs text-gray-600 mt-2">Optimization variables may need adjustment</div>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <div className="text-gray-500 text-sm">Calculating optimization impact...</div>
                                  <div className="text-xs text-gray-600 mt-2">Run optimization to see impact</div>
                                </div>
                              )}
                            </div>
                          ) : w === 'optimized_retirement_confidence' ? (
                            // New widget for optimized retirement confidence score
                            <div className="flex flex-col items-center w-full space-y-2">
                              <div className={`${WIDGET_TITLE_CLASS} text-center`}>Optimized Retirement Success Probability</div>
                              {(() => {
                                const rp = (profileData as any)?.retirementPlanningData || {};
                                const optVars = (profileData as any)?.optimizationVariables || {};
                                const calcBaselineRaw = calc?.retirementReadinessScore ?? calc?.retirementScore ?? null;
                                const normalize = (value: any) => {
                                  if (typeof value !== 'number' || Number.isNaN(value)) return null;
                                  return value > 1 ? value / 100 : value;
                                };

                                let optimizedScore = normalize(rp.optimizedScore);
                                if (optimizedScore === null) {
                                  optimizedScore = normalize(optVars.optimizedRetirementSuccessProbability);
                                  if (optimizedScore === null) optimizedScore = normalize(optVars.optimizedScore?.probabilityOfSuccess);
                                }

                                let baselineScore = normalize(rp.baselineScore);
                                if (baselineScore === null) baselineScore = normalize(optVars.optimizedScore?.sensitivityAnalysis?.baselineSuccess);
                                if (baselineScore === null) baselineScore = normalize(optVars.baselineSuccessProbability);
                                if (baselineScore === null) baselineScore = normalize(calcBaselineRaw);

                                let improvement = normalize(rp.improvement);
                                if (improvement === null) improvement = normalize(optVars.optimizedScore?.sensitivityAnalysis?.absoluteChange);
                                if (improvement === null && optimizedScore !== null && baselineScore !== null) {
                                  improvement = optimizedScore - baselineScore;
                                }
                                if (improvement === null && optimizedScore !== null) {
                                  improvement = optimizedScore - normalize(calcBaselineRaw ?? optimizedScore);
                                }

                                console.log('[REPORT-BUILDER] Optimized Retirement Confidence data:', {
                                  optimizedScore,
                                  baselineScore,
                                  improvement
                                });

                                if (optimizedScore !== null) {
                                  const optimizedValue = Math.round(optimizedScore * 100);
                                  const baselineValue = Math.round((baselineScore || 0) * 100);
                                  const improvementValue = Math.round((improvement || 0) * 100);
                                  const improvementClass = improvementValue >= 0 ? 'text-green-400' : 'text-red-400';

                                  return (
                                    <>
                                      <div className="text-3xl font-bold text-white flex items-center gap-2">
                                        <span>{optimizedValue}%</span>
                                        {baselineScore !== null && (
                                          <span className={`text-base font-semibold ${improvementClass}`}>
                                            ({improvementValue >= 0 ? '+' : ''}{improvementValue}% )
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 text-center">
                                        {optimizedValue >= 80 ? 'High Confidence' :
                                         optimizedValue >= 65 ? 'Good Confidence' : 'Needs Improvement'}
                                      </div>
                                      <div className="w-full px-2">
                                        <div className="w-full bg-gray-700 rounded-full h-3">
                                          <div 
                                            className={`h-3 rounded-full transition-all duration-500 ${
                                              optimizedValue >= 80 ? 'bg-green-500' :
                                              optimizedValue >= 65 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${Math.min(100, Math.max(0, optimizedValue))}%` }}
                                          />
                                        </div>
                                      </div>
                                      {baselineScore !== null && (
                                        <div className="text-xs text-gray-400 mt-1">
                                          Baseline: {baselineValue}%
                                        </div>
                                      )}
                                    </>
                                  );
                                }

                                return (
                                  <div className="text-center">
                                    <div className="text-gray-500 text-sm">No optimization data</div>
                                    <div className="text-xs text-gray-600 mt-2">Save retirement optimization to view results</div>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : w === 'optimized_portfolio_projection' ? (
                            <div className="flex flex-col items-stretch w-full">
                              <div className={`${WIDGET_TITLE_CLASS} text-center mb-2`}>Optimized Portfolio Projection</div>
                              <OptimizedPortfolioProjectionWidget profileData={profileData} refreshSignal={refreshSignal} />
                            </div>
                          ) : w === 'ending_portfolio_value_increase' ? (
                            <div className="flex flex-col items-center w-full">
                              <div className={`${WIDGET_TITLE_CLASS} mb-2 text-center`}>Optimization Impact on Portfolio Balance</div>
                              <EndingPortfolioImpactWidget profileData={profileData} refreshSignal={refreshSignal} />
                            </div>
                          ) : w === 'insurance_adequacy_score' ? (
                            <div className="flex flex-col items-center w-full space-y-2">
                          <div className={`${WIDGET_TITLE_CLASS} text-center`}>Insurance Adequacy Score</div>
                              <div className="text-3xl font-bold text-white">
                                {insuranceScore}
                              </div>
                              <div className="text-xs text-gray-500 text-center">
                                {insuranceScore >= 75 ? 'Well Protected' : insuranceScore >= 50 ? 'Adequate Coverage' : 'Needs Review'}
                              </div>
                              <div className="w-full px-2">
                                <div className="w-full bg-gray-700 rounded-full h-3">
                                  <div 
                                    className={`h-3 rounded-full transition-all duration-500 ${insuranceScore >= 75 ? 'bg-green-500' : insuranceScore >= 50 ? 'bg-blue-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(100, Math.max(0, insuranceScore))}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : w === 'emergency_readiness_score_new' ? (
                            <div className="flex flex-col items-center w-full space-y-2">
                          <div className={`${WIDGET_TITLE_CLASS} text-center`}>Emergency Readiness (New)</div>
                              <div className="text-3xl font-bold text-white">{Math.round(emergencyReadinessScoreDashboard)}</div>
                              <div className="text-xs text-gray-500 text-center">
                                {emergencyReadinessScoreDashboard >= 80 ? 'Well Prepared' :
                                 emergencyReadinessScoreDashboard >= 60 ? 'Adequate' :
                                 'Needs Attention'}
                              </div>
                              <div className="w-full px-2">
                                <div className="w-full bg-gray-700 rounded-full h-3">
                                  <div
                                    className={`h-3 rounded-full transition-all duration-500 ${
                                      emergencyReadinessScoreDashboard >= 80 ? 'bg-green-500' :
                                      emergencyReadinessScoreDashboard >= 60 ? 'bg-blue-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, emergencyReadinessScoreDashboard))}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : w === 'retirement_stress_test' ? (
                            <div className="flex flex-col items-center w-full">
                          <div className={`${WIDGET_TITLE_CLASS} mb-2`}>Retirement Stress Test</div>
                              <RetirementStressTestWidget profileData={profileData} refreshSignal={refreshSignal} />
                            </div>
                          ) : w === 'social_security_optimization_impact' ? (
                            <div className="flex flex-col items-center w-full">
                          <div className={`${WIDGET_TITLE_CLASS} mb-2 text-center`}>Social Security Optimization Impact</div>
                              <SocialSecurityOptimizationWidget profileData={profileData} refreshSignal={refreshSignal} />
                            </div>
                          ) : w === 'roth_conversion_impact' ? (
                            <div className="flex flex-col items-center w-full">
                          <div className={`${WIDGET_TITLE_CLASS} mb-2 text-center`}>Roth Conversion Impact</div>
                              <RothConversionImpactWidget profileData={profileData} refreshSignal={refreshSignal} />
                            </div>
                          ) : w === 'life_goals_progress' ? (
                            <div className="flex flex-col items-center w-full">
                          <div className={`${WIDGET_TITLE_CLASS} mb-2`}>Life Goals Progress</div>
                              <LifeGoalsProgressWidget refreshSignal={refreshSignal} />
                            </div>
                          ) : (
                            <>
                          <div className={`${WIDGET_TITLE_CLASS} mb-2`}>{w.replace(/_/g, ' ')}</div>
                              <div className="text-2xl font-bold text-white">—</div>
                            </>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </CardContent>
        </Card>

        {/* Insights editor */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-white">{insightsTitle}</CardTitle>
              <div className="flex items-center gap-2">
                <Input value={insightsTitle} onChange={(e) => setInsightsTitle(e.target.value)} className="max-w-xs bg-gray-900 border-gray-700 text-gray-200" />
                <Button size="sm" className="bg-[#8A00C4] hover:bg-[#7A00B4] text-white border-[#8A00C4] hover:border-[#7A00B4]" onClick={() => regenerateInsightsMutation.mutate()} disabled={regenerateInsightsMutation.isPending}>
                  {regenerateInsightsMutation.isPending ? 'Refreshing…' : 'Regenerate insights'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Droppable droppableId="insights">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                  {insights.map((ins, idx) => (
                    <Draggable draggableId={`ins_${idx}`} index={idx} key={`ins_${idx}`}>
                      {(drag) => (
                        <div ref={drag.innerRef} {...drag.draggableProps} className="flex items-start gap-2">
                          <div {...drag.dragHandleProps} className="pt-2"><GripVertical className="h-4 w-4 text-gray-500" /></div>
                          <Textarea value={ins.text} onChange={(e) => updateInsight(idx, e.target.value)} className="bg-gray-900 border-gray-700 text-gray-200" />
                          <Button variant="ghost" onClick={() => removeInsight(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            <div className="flex gap-2">
              <Button className="bg-[#8A00C4] hover:bg-[#7A00B4] text-white border-[#8A00C4] hover:border-[#7A00B4]" onClick={addCustomInsight}>
                <Plus className="h-4 w-4 mr-2" /> Add Insight
              </Button>
              <Button
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={handleManualSaveInsights}
                disabled={isManualSavePending}
              >
                {isManualSavePending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Insights
              </Button>
            </div>
          </CardContent>
        </Card>
      </DragDropContext>

      {/* Disclaimer editor (advisors can customize; individuals read-only) */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Disclaimer / Disclosures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAdvisor ? (
            <Textarea value={disclaimer} onChange={(e) => setDisclaimer(sanitizePrintable(e.target.value))} className="bg-gray-900 border-gray-700 text-gray-200 min-h-[120px]" />
          ) : (
            <Alert className="bg-gray-900 border-gray-700">
              <AlertDescription className="text-gray-300 whitespace-pre-line">{disclaimer}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}

export default ReportBuilder;
