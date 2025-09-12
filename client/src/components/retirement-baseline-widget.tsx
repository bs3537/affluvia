import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertTriangle, Info, Shield } from 'lucide-react';
import { Gauge } from './ui/gauge';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useDashboardSnapshot, pickWidget } from '@/hooks/useDashboardSnapshot';
import { LastCalculated } from './ui/last-calculated';

interface MonteCarloResult {
  probabilityOfSuccess: number;
  medianEndingBalance: number;
  message?: string;
  requiresIntakeForm?: boolean;
  missingFields?: string[];
}

interface RetirementBaselineWidgetProps {
  className?: string;
}

export function RetirementBaselineWidget({ className = '' }: RetirementBaselineWidgetProps) {
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const { data: snapshot } = useDashboardSnapshot();

  // Hydrate from snapshot instantly if available
  useEffect(() => {
    if (hasLoaded) return;
    try {
      const snap = pickWidget<any>(snapshot, 'retirement_success');
      if (snap && (typeof snap.probability === 'number' || typeof snap.probabilityDecimal === 'number')) {
        const probability = typeof snap.probability === 'number' ? snap.probability : Math.round((snap.probabilityDecimal || 0) * 100);
        setMonteCarloResult({ probabilityOfSuccess: probability, medianEndingBalance: snap.medianEndingBalance || 0, message: snap.message });
        setHasLoaded(true);
        if (controllerRef.current) controllerRef.current.abort();
        if (isLoading) setIsLoading(false);
      }
    } catch {}
  }, [snapshot, hasLoaded, isLoading]);

  // Load baseline retirement success probability using same algorithm as dashboard
  const loadBaselineScore = async () => {
    if (hasLoaded) return; // Prevent multiple calls
    
    setIsLoading(true);
    setError(null);
    
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      // Check saved data only (no heavy auto-calc here)
      const savedResponse = await fetch('/api/retirement-score', { credentials: 'include', signal: controller.signal });

      if (savedResponse.ok) {
        const savedData = await savedResponse.json();
        // STANDARDIZED: Handle both old percentage and new decimal formats
        let probability = typeof savedData.probabilityDecimal === 'number'
          ? savedData.probabilityDecimal * 100
          : (typeof savedData.probability === 'number' ? savedData.probability : 0);
        probability = Math.round(probability * 10) / 10; // one decimal for consistency

        setMonteCarloResult({
          probabilityOfSuccess: probability,
          medianEndingBalance: savedData.medianEndingBalance || 0,
          message: savedData.message
        });
        setHasLoaded(true);
        return;
      }

      if (savedResponse.status === 404) {
        // No saved baseline yet — do NOT trigger heavy calc here
        setHasLoaded(true);
        return;
      }

      throw new Error(`API error: ${savedResponse.status}`);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Error loading baseline retirement score:', error);
      setError(`Failed to load baseline retirement score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger fetch only if snapshot didn't hydrate us
  useEffect(() => {
    if (!hasLoaded && !isLoading) {
      loadBaselineScore();
    }
  }, [snapshot, hasLoaded]);

  // Seconds timer while loading
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (isLoading) {
      setLoadingSeconds(0);
      timer = setInterval(() => setLoadingSeconds((s) => s + 1), 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isLoading]);

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
            <CardTitle className="text-lg font-semibold text-white">Current Baseline</CardTitle>
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
                <h4 className="font-semibold text-white text-sm">Baseline Retirement Success</h4>
                <p className="text-xs text-gray-300">
                  This shows your current retirement success probability using the same enhanced Monte Carlo algorithm as the Dashboard widget.
                </p>
                <div className="space-y-2">
                  <h5 className="font-semibold text-white text-xs">Algorithm Features:</h5>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-gray-300">
                    <li><strong className="text-white">1,000 Scenarios:</strong> Comprehensive market simulation</li>
                    <li><strong className="text-white">Enhanced Variance Reduction:</strong> Institutional-grade precision</li>
                    <li><strong className="text-white">Stochastic Life Expectancy:</strong> Actuarial mortality modeling</li>
                    <li><strong className="text-white">Tax Optimization:</strong> Federal/state tax planning</li>
                  </ul>
                </div>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-300 text-xs">
                    <strong>Consistent Results:</strong> This baseline uses the exact same calculation methodology as your Dashboard retirement success widget, ensuring identical results for comparison with optimization scenarios.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <LastCalculated timestamp={(monteCarloResult as any)?.calculatedAt} />
        {error ? (
          <div className="text-center py-6">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <Button 
              onClick={() => { setHasLoaded(false); loadBaselineScore(); }} 
              size="sm"
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
            >
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
            <p className="text-gray-400 mt-2 text-sm">Loading baseline score...</p>
            <p className="text-gray-500 mt-1 text-xs">Using saved dashboard result</p>
            <p className="text-gray-500 mt-1 text-xs">{loadingSeconds > 0 && `${loadingSeconds}s`}</p>
          </div>
        ) : monteCarloResult ? (
          monteCarloResult.requiresIntakeForm ? (
            <div className="text-center py-6">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-400" />
              <p className="text-amber-400 font-medium mb-2 text-sm">Complete Retirement Planning</p>
              <p className="text-gray-400 text-xs mb-3">
                {monteCarloResult.message || 'Please complete your intake form to see baseline score'}
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
                Current retirement success probability
              </p>
              <p className="text-xs text-gray-500 text-center">
                Target: 80%+ recommended for confidence
              </p>
            </div>
          )
        ) : (
          <div className="text-center py-6">
            <Shield className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <p className="text-gray-300 text-sm mb-1">Ready to Calculate</p>
            <p className="text-gray-400 text-xs">
              Baseline will load automatically
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
