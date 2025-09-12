import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { StressScenario } from '@/../../shared/stress-test-types';
import { debounce } from 'lodash';

interface StressTestLivePreviewProps {
  baselineScore: number;
  scenarios: StressScenario[];
  selectedPlan: 'baseline' | 'optimized';
  optimizationVariables?: any;
}

export const StressTestLivePreview: React.FC<StressTestLivePreviewProps> = ({
  baselineScore,
  scenarios,
  selectedPlan,
  optimizationVariables
}) => {
  const [stressedScore, setStressedScore] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get enabled scenarios
  const enabledScenarios = scenarios.filter(s => s.enabled);
  const hasEnabledScenarios = enabledScenarios.length > 0;

  // Debounced calculation function
  const calculateStressPreview = useCallback(
    debounce(async (scenariosToCalc: StressScenario[]) => {
      if (scenariosToCalc.length === 0) {
        setStressedScore(null);
        setError(null);
        return;
      }

      setIsCalculating(true);
      setError(null);

      try {
        const response = await fetch('/api/stress-test-preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            scenarios: scenariosToCalc,
            useOptimizedVariables: selectedPlan === 'optimized',
            baselineVariables: optimizationVariables
          })
        });

        if (!response.ok) {
          throw new Error('Failed to calculate stress preview');
        }

        const data = await response.json();
        setStressedScore(data.successProbability * 100);
      } catch (err) {
        console.error('Error calculating stress preview:', err);
        setError('Unable to calculate preview');
        setStressedScore(null);
      } finally {
        setIsCalculating(false);
      }
    }, 500), // 500ms debounce
    [selectedPlan, optimizationVariables]
  );

  // Recalculate when scenarios change
  useEffect(() => {
    calculateStressPreview(enabledScenarios);
  }, [scenarios, selectedPlan]);

  const getBarColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Target Met';
    if (score >= 70) return 'Acceptable';
    return 'Below Target';
  };

  // Don't show if no scenarios are enabled
  if (!hasEnabledScenarios) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 mb-4">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-gray-400">
            Live Preview - Success Probability
          </span>
        </div>

        {/* Baseline Success Rate Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">
              {selectedPlan === 'optimized' ? 'Optimized Plan (No Stress)' : 'Baseline Plan (No Stress)'}
            </span>
            <span className="text-sm font-bold text-white">{baselineScore.toFixed(1)}%</span>
          </div>
          <div className="relative">
            <div className="h-8 bg-gray-700 rounded-md overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${baselineScore}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full rounded-md flex items-center justify-end pr-2"
                style={{ backgroundColor: getBarColor(baselineScore) }}
              >
                <span className="text-xs font-medium text-white drop-shadow">
                  {getScoreLabel(baselineScore)}
                </span>
              </motion.div>
            </div>
            {/* Reference lines */}
            <div className="absolute top-0 h-8 w-px bg-green-500 opacity-50" style={{ left: '80%' }} />
            <div className="absolute top-0 h-8 w-px bg-yellow-500 opacity-50" style={{ left: '70%' }} />
          </div>
        </div>

        {/* Stressed Success Rate Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">
              With Selected Stress Scenario{enabledScenarios.length > 1 ? 's' : ''}
            </span>
            {isCalculating ? (
              <Skeleton className="h-4 w-12 bg-gray-700" />
            ) : stressedScore !== null ? (
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${
                  stressedScore < baselineScore ? 'text-red-400' : 'text-green-400'
                }`}>
                  {stressedScore < baselineScore ? '' : '+'}
                  {(stressedScore - baselineScore).toFixed(1)}%
                </span>
                <span className="text-sm font-bold text-white">
                  {stressedScore.toFixed(1)}%
                </span>
              </div>
            ) : error ? (
              <span className="text-xs text-red-400">{error}</span>
            ) : null}
          </div>
          <div className="relative">
            <div className="h-8 bg-gray-700 rounded-md overflow-hidden">
              {stressedScore !== null && !isCalculating ? (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stressedScore}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-md flex items-center justify-end pr-2"
                  style={{ backgroundColor: getBarColor(stressedScore) }}
                >
                  <span className="text-xs font-medium text-white drop-shadow">
                    {getScoreLabel(stressedScore)}
                  </span>
                </motion.div>
              ) : isCalculating ? (
                <div className="h-full bg-gray-600 animate-pulse" />
              ) : null}
            </div>
            {/* Reference lines */}
            <div className="absolute top-0 h-8 w-px bg-green-500 opacity-50" style={{ left: '80%' }} />
            <div className="absolute top-0 h-8 w-px bg-yellow-500 opacity-50" style={{ left: '70%' }} />
            {/* Baseline reference line */}
            {stressedScore !== null && (
              <div 
                className="absolute top-0 h-8 w-0.5 bg-white opacity-30"
                style={{ left: `${baselineScore}%` }}
              />
            )}
          </div>
        </div>

        {/* Impact Summary */}
        {stressedScore !== null && !isCalculating && (
          <div className="pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-400">
              {enabledScenarios.length} scenario{enabledScenarios.length !== 1 ? 's' : ''} selected • 
              Impact: <span className={`font-medium ${
                stressedScore < baselineScore ? 'text-red-400' : 'text-green-400'
              }`}>
                {Math.abs(stressedScore - baselineScore).toFixed(1)}% 
                {stressedScore < baselineScore ? ' reduction' : ' improvement'}
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};