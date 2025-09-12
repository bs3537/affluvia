import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { LastCalculated } from './ui/last-calculated';
import { AlertTriangle, Info, Sparkles } from 'lucide-react';
import { Gauge } from './ui/gauge';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface MonteCarloResult {
  probabilityOfSuccess: number;
  medianEndingBalance: number;
  message?: string;
  requiresIntakeForm?: boolean;
  missingFields?: string[];
  calculatedAt?: string;
}

interface OptimizationVariables {
  retirementAge: number;
  spouseRetirementAge: number;
  socialSecurityAge: number;
  spouseSocialSecurityAge: number;
  socialSecurityBenefit?: number;
  spouseSocialSecurityBenefit?: number;
  pensionBenefit?: number;
  spousePensionBenefit?: number;
  assetAllocation: string;
  spouseAssetAllocation: string;
  monthlyEmployee401k: number;
  monthlyEmployer401k: number;
  annualTraditionalIRA: number;
  annualRothIRA: number;
  spouseMonthlyEmployee401k: number;
  spouseMonthlyEmployer401k: number;
  spouseAnnualTraditionalIRA: number;
  spouseAnnualRothIRA: number;
  monthlyExpenses: number;
  partTimeIncome: number;
  spousePartTimeIncome: number;
  hasLongTermCareInsurance: boolean;
}

interface RetirementOptimizationWidgetProps {
  className?: string;
  optimizationVariables: OptimizationVariables;
  profile?: any;
  onOptimize?: () => void;
}

export function RetirementOptimizationWidget({ 
  className = '', 
  optimizationVariables,
  profile,
  onOptimize
}: RetirementOptimizationWidgetProps) {
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef<string>(''); // Track last saved data to prevent redundant saves

  // Check for saved optimized retirement success probability on mount
  useEffect(() => {
    // Load saved optimization data if it exists (no lock check needed anymore)
    let savedProbability = profile?.optimizationVariables?.optimizedRetirementSuccessProbability;
    // Normalize if decimal (0-1) sneaks in from legacy saves
    if (typeof savedProbability === 'number' && savedProbability > 0 && savedProbability <= 1) {
      savedProbability = Math.round(savedProbability * 100);
    }
    const savedScore = profile?.optimizationVariables?.optimizedScore;

    if (savedProbability !== undefined) {
      console.log('Found saved optimized retirement success probability:', savedProbability);
      setMonteCarloResult({
        probabilityOfSuccess: savedProbability,
        medianEndingBalance: savedScore?.medianEndingBalance || 0,
        message: 'Showing saved optimization result'
      });
      return;
    }

    // Fallback: derive probability from saved optimizedScore if present
    if (savedScore) {
      let p = (savedScore.probabilityOfSuccess ?? savedScore.successProbability ?? 0) as number;
      // Normalize to percentage if value looks like a decimal
      if (p > 0 && p <= 1) p = Math.round(p * 100);

      if (p > 0) {
        console.log('Deriving probability from saved optimizedScore:', p);
        setMonteCarloResult({
          probabilityOfSuccess: p,
          medianEndingBalance: savedScore.medianEndingBalance || 0,
          message: 'Derived from saved optimized score'
        });
      }
    }
  }, [profile]);

  // Calculate optimization score using enhanced Monte Carlo algorithm with optimization variables
  const calculateOptimizationScore = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the same API endpoint as the optimization process
      const response = await fetch('/api/optimize-retirement-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          optimizationVariables,
          skipCache: true,
          runOptimization: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresStep === 11) {
          setMonteCarloResult({
            probabilityOfSuccess: 0,
            message: errorData.message || 'Please complete the retirement planning section in your intake form',
            requiresIntakeForm: true,
            missingFields: errorData.missingFields,
            medianEndingBalance: 0
          });
          setIsLoading(false);
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      // STANDARDIZED: Handle both decimal and percentage formats
      let probability = result.probabilityOfSuccess || result.probability || 0;
      if (result.probabilityDecimal) {
        probability = result.probabilityDecimal * 100; // Convert decimal to percentage for display
      }
      
      setMonteCarloResult({
        probabilityOfSuccess: probability,
        medianEndingBalance: result.medianEndingBalance || 0,
        message: result.message,
        calculatedAt: result.calculatedAt
      });
      
      // Persist the optimization variables and calculated score for page refresh restore
      try {
        // Create a key to track if we've already saved this exact data
        const saveKey = JSON.stringify({ 
          vars: optimizationVariables, 
          prob: Math.round(probability * 10) / 10 
        });
        
        // Only save if data has changed
        if (lastSavedRef.current !== saveKey) {
          console.log('💾 Saving widget optimization data to profile...');
          const saveResponse = await fetch('/api/financial-profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              optimizationVariables: {
                ...optimizationVariables,
                optimizedAt: new Date().toISOString(),
                optimizedScore: result,
                optimizedRetirementSuccessProbability: probability,
                hasOptimized: true
              },
              monteCarloSimulation: result,
              // Avoid triggering heavy server-side recalculations on this save
              skipCalculations: true,
              isPartialSave: true
            })
          });
          
          if (saveResponse.ok) {
            console.log('✅ Widget optimization data saved successfully');
            lastSavedRef.current = saveKey;
          }
        }
      } catch (saveErr) {
        console.warn('Failed to persist widget optimization data:', saveErr);
        // Not critical - widget still shows the calculated value
      }
      
    } catch (error) {
      console.error('Error calculating optimization score:', error);
      setError(`Failed to calculate optimization score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUsingSaved = async () => {
    try {
      const payload: any = { persist: true };
      const res = await fetch('/api/retirement/optimization-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const data = await res.json();
      setMonteCarloResult({
        probabilityOfSuccess: data.probability,
        medianEndingBalance: data.optimizedScore?.medianEndingBalance || 0,
        message: 'Refreshed using saved variables',
        calculatedAt: data.calculatedAt,
      });
      // Broadcast so other widgets refresh
      window.dispatchEvent(new CustomEvent('retirementOptimizationUpdated', { detail: { optimizedAt: data.calculatedAt } }));
    } catch (_) {}
  };

  // Helper function to compare optimization variables for equality
  const variablesMatch = (current: OptimizationVariables, saved: OptimizationVariables): boolean => {
    if (!current || !saved) return false;
    
    // Compare key variables that affect the calculation
    const keyFields = [
      'retirementAge', 'spouseRetirementAge', 'socialSecurityAge', 'spouseSocialSecurityAge',
      'socialSecurityBenefit', 'spouseSocialSecurityBenefit', 'pensionBenefit', 'spousePensionBenefit',
      'assetAllocation', 'spouseAssetAllocation', 'monthlyEmployee401k', 'monthlyEmployer401k',
      'annualTraditionalIRA', 'annualRothIRA', 'spouseMonthlyEmployee401k', 'spouseMonthlyEmployer401k',
      'spouseAnnualTraditionalIRA', 'spouseAnnualRothIRA', 'monthlyExpenses', 'partTimeIncome',
      'spousePartTimeIncome', 'hasLongTermCareInsurance'
    ];
    
    return keyFields.every(field => current[field as keyof OptimizationVariables] === saved[field as keyof OptimizationVariables]);
  };

  // Trigger calculation when optimization variables change, but prefer saved/specific logic
  useEffect(() => {
    if (!optimizationVariables) return;
    
    const savedVariables = profile?.optimizationVariables;

    // If user has not optimized yet, show BASELINE score and do not recalc
    if (!savedVariables?.hasOptimized) {
      let baselinePct: number | undefined;
      try {
        const mc = profile?.monteCarloSimulation?.retirementSimulation?.results;
        const raw = mc?.probabilityOfSuccess ?? mc?.successProbability;
        if (typeof raw === 'number') {
          baselinePct = raw > 0 && raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
        }
      } catch {}

      if (typeof baselinePct === 'number') {
        setMonteCarloResult({ probabilityOfSuccess: baselinePct, medianEndingBalance: profile?.monteCarloSimulation?.medianEndingBalance || 0 });
        return;
      }

      (async () => {
        try {
          const r = await fetch('/api/retirement-score', { credentials: 'include' });
          if (r.ok) {
            const j = await r.json();
            const pct = typeof j.probability === 'number' ? Math.round(j.probability) : 0;
            setMonteCarloResult({ probabilityOfSuccess: pct, medianEndingBalance: j.medianEndingBalance || 0 });
          }
        } catch {}
      })();
      return;
    }
    let savedProbability = savedVariables?.optimizedRetirementSuccessProbability as number | undefined;
    if (typeof savedProbability === 'number' && savedProbability > 0 && savedProbability <= 1) {
      savedProbability = Math.round(savedProbability * 100);
    }
    const savedScore = savedVariables?.optimizedScore;
    
    // If we have saved data and the variables match, prefer saved probability
    if (savedVariables && savedProbability !== undefined && variablesMatch(optimizationVariables, savedVariables)) {
      setMonteCarloResult({
        probabilityOfSuccess: savedProbability,
        medianEndingBalance: savedScore?.medianEndingBalance || 0,
        message: 'Using cached result (variables unchanged)'
      });
      return;
    }

    // If saved exists but variables differ (user changed form), keep showing saved
    // The main Optimize action will emit an event to update this widget instantly.
    if (savedVariables && savedProbability !== undefined && !variablesMatch(optimizationVariables, savedVariables)) {
      setMonteCarloResult({
        probabilityOfSuccess: savedProbability,
        medianEndingBalance: savedScore?.medianEndingBalance || 0,
        message: 'Showing saved optimized result'
      });
      return;
    }

    // No saved data -> await user clicking Optimize (event will update widget)
    return;
  }, [optimizationVariables, profile?.optimizationVariables]);

  // Update gauge immediately after external optimize completes (from parent form)
  useEffect(() => {
    const onCalculated = (e: any) => {
      try {
        const result = e?.detail?.result;
        if (!result) return;
        let probability = result.probabilityOfSuccess ?? result.probability ?? 0;
        if (result.probabilityDecimal) probability = result.probabilityDecimal * 100;
        setMonteCarloResult({
          probabilityOfSuccess: probability,
          medianEndingBalance: result.medianEndingBalance || 0,
          message: result.message,
          calculatedAt: result.calculatedAt
        });
      } catch (_) {}
    };
    window.addEventListener('retirementOptimizationCalculated', onCalculated as any);
    return () => window.removeEventListener('retirementOptimizationCalculated', onCalculated as any);
  }, []);

  // Clamp probability values to ensure they stay within 0-100 range
  const clampProbability = (probability: number | undefined): number => {
    return Math.min(100, Math.max(0, probability || 0));
  };

  const getSuccessColor = (probability: number) => {
    const clamped = clampProbability(probability);
    if (clamped >= 85) return { bg: 'bg-green-900/30', text: 'text-green-400', gradient: 'from-green-500/20 to-green-600/20', border: 'border-green-500/30' };
    if (clamped >= 75) return { bg: 'bg-blue-900/30', text: 'text-blue-400', gradient: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-500/30' };
    if (clamped >= 65) return { bg: 'bg-yellow-900/30', text: 'text-yellow-400', gradient: 'from-yellow-500/20 to-yellow-600/20', border: 'border-yellow-500/30' };
    return { bg: 'bg-red-900/30', text: 'text-red-400', gradient: 'from-red-500/20 to-red-600/20', border: 'border-red-500/30' };
  };

  const getSuccessLabel = (probability: number) => {
    const clamped = clampProbability(probability);
    if (clamped >= 85) return 'Highly Confident';
    if (clamped >= 75) return 'Good Outlook'; 
    if (clamped >= 65) return 'Fair Chance';
    return 'Needs Improvement';
  };

  return (
    <Card className={`card-gradient border-gray-700 bg-gradient-to-br from-gray-900/40 to-gray-800/40 backdrop-blur-sm min-h-[320px] ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-white">Optimization</CardTitle>
            {monteCarloResult && !monteCarloResult.requiresIntakeForm && (
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                getSuccessColor(monteCarloResult.probabilityOfSuccess).bg
              } ${getSuccessColor(monteCarloResult.probabilityOfSuccess).text}`}>
                {getSuccessLabel(monteCarloResult.probabilityOfSuccess)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-transparent">
                <Info className="w-4 h-4 text-gray-400 hover:text-white" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] bg-gray-800 border-gray-700" align="end">
              <div className="space-y-3">
                <h4 className="font-semibold text-white text-sm">Optimization Analysis</h4>
                <p className="text-xs text-gray-300">
                  This shows your retirement success probability using the enhanced Monte Carlo algorithm combined with your optimization variables.
                </p>
                <div className="space-y-2">
                  <h5 className="font-semibold text-white text-xs">Algorithm Features:</h5>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-gray-300">
                    <li><strong className="text-white">1,000 Scenarios:</strong> Comprehensive market simulation</li>
                    <li><strong className="text-white">Enhanced Variance Reduction:</strong> Institutional-grade precision</li>
                    <li><strong className="text-white">Stochastic Life Expectancy:</strong> Actuarial mortality modeling</li>
                    <li><strong className="text-white">Tax Optimization:</strong> Federal/state tax planning</li>
                    <li><strong className="text-white">Variable Integration:</strong> Combines intake data with optimization parameters</li>
                  </ul>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-purple-300 text-xs">
                    <strong>Optimization Impact:</strong> This calculation uses your adjusted retirement age, contribution amounts, 
                    investment strategy, expenses, and other optimization variables to show the potential impact on your retirement success.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <LastCalculated
          timestamp={monteCarloResult?.calculatedAt || profile?.optimizationVariables?.optimizedScore?.calculatedAt}
          onRefresh={refreshUsingSaved}
        />
        {error ? (
          <div className="text-center py-6">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <Button 
              onClick={calculateOptimizationScore} 
              size="sm"
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
            >
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
            <p className="text-gray-400 mt-2 text-sm">Calculating optimization...</p>
            <p className="text-gray-500 mt-1 text-xs">
              Using enhanced Monte Carlo algorithm
            </p>
          </div>
        ) : monteCarloResult ? (
          monteCarloResult.requiresIntakeForm ? (
            <div className="text-center py-6">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-400" />
              <p className="text-amber-400 font-medium mb-2 text-sm">Complete Retirement Planning</p>
              <p className="text-gray-400 text-xs mb-3">
                {monteCarloResult.message || 'Please complete your intake form to see optimization results'}
              </p>
              <Button 
                onClick={() => window.location.href = '/intake-form?step=11'} 
                size="sm"
                className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
              >
                Complete Intake
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Gauge
                value={clampProbability(monteCarloResult.probabilityOfSuccess)}
                max={100}
                size="md"
                showValue={true}
                valueLabel=""
                colors={{
                  low: '#EF4444',
                  medium: '#F59E0B', 
                  high: '#10B981'
                }}
                thresholds={{
                  medium: 65,
                  high: 85
                }}
              />
              
              <p className="text-xs text-gray-400 mt-2 text-center">
                Optimized retirement success probability
              </p>
              <p className="text-xs text-gray-500 text-center">
                Target: 80%+ recommended for confidence
              </p>
              
              {/* Note: Optimize button removed - users now use the main form button below */}
            </div>
          )
        ) : (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-3" />
            <p className="text-gray-300 text-sm mb-1">Ready to Optimize</p>
            <p className="text-gray-400 text-xs">
              Adjust variables to see optimization impact
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
