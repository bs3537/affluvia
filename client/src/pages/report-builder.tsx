import { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { FileDown, GripVertical, Plus, Save, Trash2, Eye, RefreshCw, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Gauge } from '@/components/ui/gauge';
import { MetricDisplay } from '@/components/ui/metric-display';
import { useReportWidgets } from '@/hooks/use-report-widgets';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  'monthly_cash_flow',
  'net_worth',
  'optimized_retirement_confidence',  // Keep only the new widget with comparison
  'ending_portfolio_value_increase',   // Impact at longevity age
  'retirement_stress_test',
  'social_security_optimization_impact', // New Social Security widget - Row 3, Position 1 (left)
  'roth_conversion_impact',           // Roth conversion impact - Row 3, Position 2 (middle)
  'life_goals_progress',              // Life goals funding progress - Row 3, Position 3 (middle-right)
  'insurance_adequacy_score',         // Row 3, Position 4 (right)
  'emergency_readiness_score',        // Row 4, Position 1
];

type InsightItem = { id?: string; text: string; order: number; isCustom?: boolean };

// Independent component for Roth conversion impact
function RothConversionImpactWidget({ profileData }: { profileData: any }) {
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
        profileData?.calculations?.rothConversionAnalysis?.calculatedAt ||
        profileData?.calculations?.rothConversionAnalysis?.updatedAt ||
        profileData?.optimizationVariables?.lockedAt ||
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
    profileData?.calculations?.rothConversionAnalysis?.calculatedAt,
    profileData?.calculations?.rothConversionAnalysis?.updatedAt,
    profileData?.optimizationVariables?.lockedAt
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
function EndingPortfolioImpactWidget({ profileData }: { profileData: any }) {
  const [impactData, setImpactData] = useState<{
    finalDifference?: number;
    percentageImprovement?: number;
    finalBaseline?: number;
    finalOptimized?: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const calculatedForRef = useRef<string | null>(null);

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
  }, [profileData]); // Only depend on profileData changes

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

// Independent component for Retirement Stress Test
function RetirementStressTestWidget({ profileData }: { profileData: any }) {
  const [stressResults, setStressResults] = useState<any[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const calculatedForRef = useRef<string | null>(null);

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
  }, [profileData]); // Only depend on profileData changes

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
function LifeGoalsProgressWidget() {
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
    async function fetchGoals() {
      try {
        // Fetch all three types of goals in parallel
        const [lifeGoalsRes, profileRes, educationRes] = await Promise.all([
          fetch('/api/life-goals', { credentials: 'include' }),
          fetch('/api/financial-profile', { credentials: 'include' }),
          fetch('/api/education/goals', { credentials: 'include' })
        ]);
        
        const allGoals = [];
        
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
        
        // Process retirement goal from profile
        if (profileRes.ok) {
          const profile = await profileRes.json();
          
          // Add retirement goal if it exists
          const retirementAge = profile.desiredRetirementAge || profile.retirementAge || 65;
          const currentAge = profile.age || 30;
          const yearsToRetirement = Math.max(0, retirementAge - currentAge);
          const retirementTarget = profile.legacyGoal || profile.retirementIncome || 0;
          const currentRetirementSavings = profile.assets?.filter((a: any) => 
            a.type?.toLowerCase().includes('401k') || 
            a.type?.toLowerCase().includes('ira') || 
            a.type?.toLowerCase().includes('retirement')
          ).reduce((sum: number, a: any) => sum + Number(a.value || 0), 0) || 0;
          
          // Use Monte Carlo probabilityOfSuccess for retirement progress
          let retirementProgress = 0;
          
          // Extract probabilityOfSuccess from Monte Carlo simulation results
          const monteCarloResults = profile.monteCarloSimulation?.retirementSimulation?.results;
          if (monteCarloResults) {
            if (typeof monteCarloResults.probabilityOfSuccess === 'number' && monteCarloResults.probabilityOfSuccess > 1) {
              // Already a percentage (0-100)
              retirementProgress = Math.round(monteCarloResults.probabilityOfSuccess);
            } else if (typeof monteCarloResults.successProbability === 'number') {
              // Convert from 0-1 decimal to percentage
              retirementProgress = Math.round(monteCarloResults.successProbability * 100);
            } else if (typeof monteCarloResults.probabilityOfSuccess === 'number') {
              // Might be 0-1 decimal, convert to percentage
              retirementProgress = Math.round(monteCarloResults.probabilityOfSuccess * 100);
            }
          }
          
          // Fallback to calculations field if Monte Carlo not available
          if (retirementProgress === 0 && profile.calculations?.retirementScore) {
            retirementProgress = Math.round(profile.calculations.retirementScore);
          }
          
          // Final fallback to simple calculation if no Monte Carlo data
          if (retirementProgress === 0 && yearsToRetirement > 0 && retirementTarget > 0) {
            retirementProgress = Math.min(100, (currentRetirementSavings / (retirementTarget * 0.25)) * 100);
          }
            
          // Show retirement goal if we have either a target or Monte Carlo data
          if (retirementTarget > 0 || retirementProgress > 0) {
            allGoals.push({
              id: 'retirement',
              goalName: 'Retirement',
              description: `Retire at age ${retirementAge}`,
              type: 'retirement',
              progress: Math.round(retirementProgress)
            });
          }
        }
        
        // Process education goals
        if (educationRes.ok) {
          const educationGoals = await educationRes.json();
          
          educationGoals.forEach((goal: any) => {
            // Use comprehensiveFundingPercentage from projection if available, otherwise fall back to basic calculation
            let progress = 0;
            if (goal.projection && goal.projection.comprehensiveFundingPercentage != null) {
              progress = Number(goal.projection.comprehensiveFundingPercentage);
            } else if (goal.comprehensiveFundingPercentage != null) {
              progress = Number(goal.comprehensiveFundingPercentage);
            } else {
              // Fallback to basic calculation
              const targetAmount = Number(goal.totalCost || goal.estimatedCost || 0);
              const currentAmount = Number(goal.currentSavings || 0);
              progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
            }
            
            allGoals.push({
              ...goal,
              goalName: goal.studentName ? `${goal.studentName}'s Education` : goal.childName ? `${goal.childName}'s Education` : 'Education',
              type: 'education',
              progress: Math.round(progress)
            });
          });
        }
        
        // Sort by progress and take top 6
        const sortedGoals = allGoals
          .sort((a: any, b: any) => b.progress - a.progress)
          .slice(0, 6);
          
        setGoals(sortedGoals);
      } catch (error) {
        console.error('[LIFE-GOALS-WIDGET] Error fetching goals:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchGoals();
  }, []);

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
function SocialSecurityOptimizationWidget({ profileData }: { profileData: any }) {
  const [ssData, setSSData] = useState<{
    totalDifference?: number;
    percentageGain?: number;
    optimalUserAge?: number;
    optimalSpouseAge?: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const calculatedForRef = useRef<string | null>(null);

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
  }, [profileData]);

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
  const queryClient = useQueryClient();
  const isAdvisor = user?.role === 'advisor';

  // Branding
  const { data: branding } = useQuery<Branding | null>({
    queryKey: ['/api/advisor/branding'],
    queryFn: async () => {
      if (!isAdvisor) return null;
      const res = await fetch('/api/advisor/branding', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id && isAdvisor,
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
    staleTime: 60_000, // Cache for 1 minute
  });

  // Use the dedicated hook for the metrics to avoid Dashboard imports
  const { healthScore, monthlyCashFlow, netWorth, emergencyReadinessScore, optimizationImpact } = useReportWidgets();
  
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
    staleTime: 10_000,
  });

  // Currency formatter and calc alias for other metrics
  const formatCurrency = (v: number | null | undefined) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      .format(Number(v || 0));
  const calc = (profileData as any)?.calculations || {};

  // Layout
  const { data: layoutData } = useQuery<{ layout: string[]; insightsSectionTitle: string } | null>({
    queryKey: ['reportLayout', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/report/layout', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
  });

  const [widgets, setWidgets] = useState<string[]>(
    (layoutData?.layout || DEFAULT_WIDGETS)
      .filter(Boolean) // remove empty strings
      .filter((w) => w !== 'increase_in_portfolio_value') // drop removed widget
  );
  const [insightsTitle, setInsightsTitle] = useState<string>(layoutData?.insightsSectionTitle || (isAdvisor ? 'Recommendations' : 'Insights'));
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    if (layoutData?.layout) {
      // If saved layout doesn't have the new widget, add it
      const savedWidgets = layoutData.layout
        .filter(Boolean) // remove empty strings
        .filter((w) => w !== 'increase_in_portfolio_value'); // drop removed widget
      
      // Add new widget if it's not in the saved layout
      if (!savedWidgets.includes('ending_portfolio_value_increase')) {
        savedWidgets.splice(4, 0, 'ending_portfolio_value_increase'); // Insert after optimized_retirement_confidence
      }
      
      // Add Social Security widget if it's not in the saved layout
      if (!savedWidgets.includes('social_security_optimization_impact')) {
        // Insert at position 6 to be in row 3, position 1 (left)
        const insertPosition = Math.min(6, savedWidgets.length);
        savedWidgets.splice(insertPosition, 0, 'social_security_optimization_impact');
      }
      
      // Add Roth Conversion widget if it's not in the saved layout
      if (!savedWidgets.includes('roth_conversion_impact')) {
        // Insert at position 7 to be in row 3, position 2 (middle)
        const insertPosition = Math.min(7, savedWidgets.length);
        savedWidgets.splice(insertPosition, 0, 'roth_conversion_impact');
      }
      
      setWidgets(savedWidgets);
    } else if (layoutData === null) {
      // No saved layout, use defaults
      setWidgets(DEFAULT_WIDGETS);
    }
    if (layoutData?.insightsSectionTitle) setInsightsTitle(layoutData.insightsSectionTitle);
  }, [layoutData]);

  // Insights
  const { data: insightsResp, refetch: refetchInsights, isFetching: isFetchingInsights } = useQuery<{ insights: Array<{ id: string; title?: string; explanation?: string }> }>({
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
  const prefilledInsights = (insightsResp?.insights || []).slice(0, 10).map((i, idx) => ({ id: i.id, text: i.title || i.explanation || '', order: idx }));

  const [insights, setInsights] = useState<InsightItem[]>(prefilledInsights);
  useEffect(() => setInsights(prefilledInsights), [insightsResp?.insights?.length]);

  const [disclaimer, setDisclaimer] = useState<string>(branding?.defaultDisclaimer || 'This report is for informational purposes only and does not constitute personalized investment, tax, or legal advice. All projections are estimates and are not guarantees of future results. Assumptions, data inputs, and methodologies are subject to change. Please review with a qualified professional before making decisions.');
  useEffect(() => {
    if (branding?.defaultDisclaimer && isAdvisor) setDisclaimer(branding.defaultDisclaimer);
  }, [branding?.defaultDisclaimer, isAdvisor]);

  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/report/layout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: widgets, insightsSectionTitle: insightsTitle }),
      });
      if (!res.ok) throw new Error('Failed to save layout');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reportLayout', user?.id] }),
  });

  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/report/snapshot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: widgets, insights, insightsTitle, disclaimerText: disclaimer, force: false }),
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
      const next = (data?.insights || []).slice(0, 10).map((i: any, idx: number) => ({ text: i.title || i.explanation || '', order: idx }));
      setInsights(next);
      refetchInsights();
    }
  });

  const downloadReport = async () => {
    try {
      console.log('[PDF-EXPORT] Starting PDF export with client-side capture...');
      
      // Step 1: Switch to light theme
      setIsLightTheme(true);
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for re-render
      
      // Step 2: Capture advisor logo only (if present)
      let logoImage: string | null = null;
      if (branding?.logoUrl) {
        console.log('[PDF-EXPORT] Capturing advisor logo...');
        try {
          // Create a temporary image element to capture the logo
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = branding.logoUrl!;
          });
          
          // Create canvas to convert logo to base64
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          logoImage = canvas.toDataURL('image/png').split(',')[1];
        } catch (error) {
          console.error('[PDF-EXPORT] Failed to capture logo:', error);
        }
      }
      
      // Step 3: Capture each widget as image
      const widgetImages: { key: string; image: string; }[] = [];
      
      for (let i = 0; i < widgets.length; i++) {
        const widgetElement = document.getElementById(`widget-${i}`);
        if (widgetElement) {
          console.log(`[PDF-EXPORT] Capturing widget ${i}: ${widgets[i]}`);
          try {
            const canvas = await html2canvas(widgetElement, {
              backgroundColor: '#FFFFFF',
              scale: 2, // Higher resolution for print
              useCORS: true,
              allowTaint: true,
            });
            const base64Image = canvas.toDataURL('image/png').split(',')[1];
            widgetImages.push({ key: widgets[i], image: base64Image });
          } catch (error) {
            console.error(`[PDF-EXPORT] Failed to capture widget ${i}:`, error);
          }
        }
      }
      
      // Step 4: Reset theme
      setIsLightTheme(false);
      
      // Step 5: Create PDF using jsPDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;
      let currentY = margin;
      
      // Add professional blue header section (matching template)
      const headerBranding = branding || { firmName: 'Affluvia' };
      const headerHeight = 25; // mm
      
      // Draw blue header background
      pdf.setFillColor(52, 73, 115); // Dark blue color from template
      pdf.rect(0, 0, pageWidth, headerHeight, 'F');
      
      // Add firm name in white text
      pdf.setFontSize(24);
      pdf.setTextColor(255, 255, 255); // White text
      pdf.text(headerBranding.firmName || 'Affluvia', margin, 12, { baseline: 'middle' });
      
      // Add contact info in smaller white text
      if (branding) {
        pdf.setFontSize(10);
        const contactParts = [];
        if (branding.address) contactParts.push(branding.address);
        if (branding.phone) contactParts.push(branding.phone);
        if (branding.email) contactParts.push(branding.email);
        
        const contactInfo = contactParts.join(' • ');
        if (contactInfo) {
          pdf.text(contactInfo, margin, 18, { baseline: 'middle' });
        }
      }
      
      currentY = headerHeight + 10; // Start content after header
      
      // Reset text color to black for content
      pdf.setTextColor(0, 0, 0);
      
      // Add report title and date
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      
      // Create client name from profile data
      const clientName = profileData?.firstName && profileData?.lastName 
        ? `${profileData.firstName} ${profileData.lastName}`
        : profileData?.firstName || 'Client';
      
      const reportTitle = `Financial Planning Report for ${clientName}`;
      pdf.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });
      currentY += 8;
      
      pdf.setFontSize(12);
      pdf.text(`Report Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;
      
      // Add widgets section
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Financial Overview', margin, currentY);
      currentY += 15;
      
      // Add widget images (3 per row) with optimized sizing
      const widgetsPerRow = 3;
      const widgetWidth = contentWidth / widgetsPerRow - 5;
      const widgetHeight = widgetWidth * 0.7; // Optimized aspect ratio to prevent stretching
      
      for (let i = 0; i < widgetImages.length; i++) {
        const col = i % widgetsPerRow;
        const row = Math.floor(i / widgetsPerRow);
        
        const x = margin + col * (widgetWidth + 5);
        const y = currentY + row * (widgetHeight + 10);
        
        // Check if we need a new page
        if (y + widgetHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }
        
        try {
          pdf.addImage(`data:image/png;base64,${widgetImages[i].image}`, 'PNG', x, y, widgetWidth, widgetHeight);
        } catch (error) {
          console.error(`[PDF-EXPORT] Failed to add image for widget ${i}:`, error);
        }
      }
      
      // Calculate position after widgets
      const widgetRows = Math.ceil(widgetImages.length / widgetsPerRow);
      currentY += widgetRows * (widgetHeight + 10) + 20;
      
      // Check if we need a new page for insights
      if (currentY > pageHeight - 60) {
        pdf.addPage();
        currentY = margin;
      }
      
      // Add insights section
      if (insights.length > 0) {
        pdf.setFontSize(14);
        pdf.text(insightsTitle || 'Insights', margin, currentY);
        currentY += 10;
        
        pdf.setFontSize(11);
        insights.forEach((insight) => {
          if (insight.text && insight.text.trim()) {
            const lines = pdf.splitTextToSize(`• ${insight.text}`, contentWidth);
            
            // Check if we need a new page
            if (currentY + lines.length * 5 > pageHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }
            
            pdf.text(lines, margin, currentY);
            currentY += lines.length * 5 + 3;
          }
        });
        currentY += 10;
      }
      
      // Add disclaimer
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = margin;
      }
      
      pdf.setFontSize(12);
      pdf.text('Important Disclosures', margin, currentY);
      currentY += 8;
      
      pdf.setFontSize(10);
      const disclaimerText = disclaimer || 
        'This report is for informational purposes only and does not constitute personalized investment, tax, or legal advice. All projections are estimates and are not guarantees of future results.';
      
      const disclaimerLines = pdf.splitTextToSize(disclaimerText, contentWidth);
      pdf.text(disclaimerLines, margin, currentY);
      
      // Add professional footer (like template)
      const footerY = pageHeight - 15;
      pdf.setFontSize(9);
      pdf.setTextColor(128, 128, 128); // Gray color
      
      // Copyright on left
      const year = new Date().getFullYear();
      const copyrightText = `© ${year} ${headerBranding.firmName || 'Affluvia'} — Confidential Client Report`;
      pdf.text(copyrightText, margin, footerY);
      
      // Page number on right
      pdf.text('Page 1', pageWidth - margin, footerY, { align: 'right' });
      
      // Save the PDF
      const fileName = `${headerBranding.firmName || 'Affluvia'}_Report_${new Date().toISOString().slice(0,10)}.pdf`;
      pdf.save(fileName);
      
      console.log('[PDF-EXPORT] PDF generated and downloaded successfully');
      
    } catch (error) {
      console.error('[PDF-EXPORT] Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
      setIsLightTheme(false); // Ensure theme is reset on error
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
    const names: { [key: string]: string } = {
      'financial_health_score': 'Financial Health Score',
      'monthly_cash_flow': 'Monthly Cash Flow',
      'net_worth': 'Net Worth',
      'optimized_retirement_confidence': 'Retirement Confidence',
      'ending_portfolio_value_increase': 'Portfolio Impact',
      'retirement_stress_test': 'Retirement Stress Test',
      'social_security_optimization_impact': 'Social Security Optimization',
      'roth_conversion_impact': 'Roth Conversion Impact',
      'life_goals_progress': 'Life Goals Progress',
      'insurance_adequacy_score': 'Insurance Adequacy',
      'emergency_readiness_score': 'Emergency Readiness',
    };
    return names[widgetKey] || widgetKey.replace(/_/g, ' ');
  };

  const headerBranding = useMemo(() => {
    if (isAdvisor && branding) return branding;
    return { firmName: 'Affluvia', logoUrl: null } as Branding;
  }, [branding, isAdvisor]);

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
        .light-theme .h-4.w-4.text-gray-500,
        .light-theme .h-4.w-4.text-red-400 {
          display: none !important;
        }
        .light-theme .absolute.top-2.right-2 {
          display: none !important;
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header/Branding preview */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Report Header</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4" data-header-section>
          {headerBranding?.logoUrl && (
            <img src={headerBranding.logoUrl} alt="Logo" className="h-12 w-auto rounded bg-gray-900/40 p-2" />
          )}
          <div className="text-gray-200">
            <div className="text-lg font-semibold">{headerBranding?.firmName || 'Affluvia'}</div>
            <div className="text-xs text-gray-400">{headerBranding?.address}</div>
            <div className="text-xs text-gray-400">{headerBranding?.phone} {headerBranding?.email ? `• ${headerBranding.email}` : ''}</div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={downloadReport}>
              <FileDown className="h-4 w-4 mr-2" /> Download Report
            </Button>
            <Button 
              size="sm" 
              className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white"
              onClick={async () => {
                // Refresh all widget data sources
                console.log('[REPORT-BUILDER] Refreshing all widget data...');
                
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
                queryClient.invalidateQueries({ queryKey: ['/api/financial-profile'] });
                queryClient.invalidateQueries({ queryKey: ['centralInsights'] });
                queryClient.invalidateQueries({ queryKey: ['/api/retirement/impact-on-portfolio-balance-cache'] });
                
                console.log('[REPORT-BUILDER] All widget data refreshed');
              }}
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
              <CardTitle className="text-white">Page 1: Widgets</CardTitle>
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
                <div ref={provided.innerRef} {...provided.droppableProps} className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${isLightTheme ? 'light-theme' : ''}`}>
                  {widgets.map((w, idx) => (
                    <Draggable draggableId={w + '_' + idx} index={idx} key={w + '_' + idx}>
                      {(drag) => (
                        <div 
                          id={`widget-${idx}`}
                          ref={drag.innerRef} 
                          {...drag.draggableProps} 
                          className="bg-gray-900/50 border border-gray-700 rounded p-3 h-44 flex flex-col items-center justify-start text-gray-300 relative pt-8"
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
                              <div className="text-xs text-gray-400 uppercase tracking-wide text-center">Financial Health Score</div>
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
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Net Worth</div>
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
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Monthly Cash Flow</div>
                              <MetricDisplay
                                value={Math.round(monthlyCashFlow || 0)}
                                format="currency"
                                size="md"
                                color={(monthlyCashFlow ?? 0) >= 0 ? 'positive' : 'negative'}
                                showSign={true}
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
                              <div className="text-xs text-gray-400 uppercase tracking-wide text-center">Retirement Confidence Score</div>
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
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Optimization Impact on Portfolio Value (Ending Assets)</div>
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
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 text-center">Impact of Optimization on Ending Portfolio Value</div>
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
                              <div className="text-xs text-gray-400 uppercase tracking-wide text-center">Optimized Retirement Success Probability</div>
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
                          ) : w === 'ending_portfolio_value_increase' ? (
                            <div className="flex flex-col items-center w-full">
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 text-center">Optimization Impact on Portfolio Balance</div>
                              <EndingPortfolioImpactWidget profileData={profileData} />
                            </div>
                          ) : w === 'insurance_adequacy_score' ? (
                            <div className="flex flex-col items-center w-full space-y-2">
                              <div className="text-xs text-gray-400 uppercase tracking-wide text-center">Insurance Adequacy Score</div>
                              <div className="text-3xl font-bold text-white">
                                {Math.round(profileData?.calculations?.insuranceAdequacy?.score || profileData?.calculations?.riskManagementScore || calc?.insuranceScore || 0)}
                              </div>
                              <div className="text-xs text-gray-500 text-center">
                                {(() => {
                                  const score = profileData?.calculations?.insuranceAdequacy?.score || profileData?.calculations?.riskManagementScore || calc?.insuranceScore || 0;
                                  return score >= 75 ? 'Well Protected' : score >= 50 ? 'Adequate Coverage' : 'Needs Review';
                                })()}
                              </div>
                              <div className="w-full px-2">
                                <div className="w-full bg-gray-700 rounded-full h-3">
                                  <div 
                                    className={`h-3 rounded-full transition-all duration-500 ${(() => {
                                      const score = profileData?.calculations?.insuranceAdequacy?.score || profileData?.calculations?.riskManagementScore || calc?.insuranceScore || 0;
                                      return score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-blue-500' : 'bg-red-500';
                                    })()}`}
                                    style={{ 
                                      width: `${Math.min(100, Math.max(0, profileData?.calculations?.insuranceAdequacy?.score || profileData?.calculations?.riskManagementScore || calc?.insuranceScore || 0))}%` 
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : w === 'emergency_readiness_score' ? (
                            <div className="flex flex-col items-center w-full space-y-2">
                              <div className="text-xs text-gray-400 uppercase tracking-wide text-center">Emergency Readiness</div>
                              <div className="text-3xl font-bold text-white">{Math.round(emergencyReadinessScore ?? 0)}</div>
                              <div className="text-xs text-gray-500 text-center">
                                {(emergencyReadinessScore ?? 0) >= 80 ? 'Well Prepared' :
                                 (emergencyReadinessScore ?? 0) >= 60 ? 'Adequate' : 
                                 'Needs Attention'}
                              </div>
                              <div className="w-full px-2">
                                <div className="w-full bg-gray-700 rounded-full h-3">
                                  <div 
                                    className={`h-3 rounded-full transition-all duration-500 ${
                                      (emergencyReadinessScore ?? 0) >= 80 ? 'bg-green-500' :
                                      (emergencyReadinessScore ?? 0) >= 60 ? 'bg-blue-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, emergencyReadinessScore ?? 0))}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : w === 'retirement_stress_test' ? (
                            <div className="flex flex-col items-center w-full">
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Retirement Stress Test</div>
                              <RetirementStressTestWidget profileData={profileData} />
                            </div>
                          ) : w === 'social_security_optimization_impact' ? (
                            <div className="flex flex-col items-center w-full">
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 text-center">Social Security Optimization Impact</div>
                              <SocialSecurityOptimizationWidget profileData={profileData} />
                            </div>
                          ) : w === 'roth_conversion_impact' ? (
                            <div className="flex flex-col items-center w-full">
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 text-center">Roth Conversion Impact</div>
                              <RothConversionImpactWidget profileData={profileData} />
                            </div>
                          ) : w === 'life_goals_progress' ? (
                            <div className="flex flex-col items-center w-full">
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Life Goals Progress</div>
                              <LifeGoalsProgressWidget />
                            </div>
                          ) : (
                            <>
                              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">{w.replace(/_/g, ' ')}</div>
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
              <CardTitle className="text-white">Page 2: {insightsTitle}</CardTitle>
              <div className="flex items-center gap-2">
                <Input value={insightsTitle} onChange={(e) => setInsightsTitle(e.target.value)} className="max-w-xs bg-gray-900 border-gray-700 text-gray-200" />
                <Button size="sm" className="bg-[#8A00C4] hover:bg-[#7A00B4] text-white border-[#8A00C4] hover:border-[#7A00B4]" onClick={() => regenerateInsightsMutation.mutate()} disabled={regenerateInsightsMutation.isPending}>
                  {regenerateInsightsMutation.isPending ? 'Refreshing…' : 'Regenerate insights'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-gray-400">
              {Math.min(insights.length, 10)} insights fit on page 2. {Math.max(0, insights.length - 10)} overflow to page 3+.
            </div>
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
            <Button className="bg-[#8A00C4] hover:bg-[#7A00B4] text-white border-[#8A00C4] hover:border-[#7A00B4]" onClick={addCustomInsight}>
              <Plus className="h-4 w-4 mr-2" /> Add Insight
            </Button>
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
            <Textarea value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} className="bg-gray-900 border-gray-700 text-gray-200 min-h-[120px]" />
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
