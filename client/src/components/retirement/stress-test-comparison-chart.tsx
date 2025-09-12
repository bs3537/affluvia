import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import { StressTestResponse } from '@/../../shared/stress-test-types';

interface StressTestComparisonChartProps {
  results: StressTestResponse;
  baselineScore: number;
  isLoading?: boolean;
  isCached?: boolean;
  cacheAge?: number;
}

export const StressTestComparisonChart: React.FC<StressTestComparisonChartProps> = ({ 
  results,
  baselineScore,
  isLoading = false,
  isCached = false,
  cacheAge = 0
}) => {
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

  // Prepare data for horizontal bars
  const scenarios = [
    {
      name: 'Optimized Plan (No Stress)',
      score: baselineScore,  // baselineScore is already in percentage format (e.g., 99.5)
      impact: 0,
      isBaseline: true
    },
    ...results.individualResults.map(result => ({
      name: result.scenarioName,
      score: result.successProbability * 100,
      impact: result.successProbability * 100 - baselineScore,
      isBaseline: false
    })),
    ...(results.combinedResult ? [{
      name: 'Combined Stress',
      score: results.combinedResult.successProbability * 100,
      impact: results.combinedResult.successProbability * 100 - baselineScore,
      isBaseline: false,
      isCombined: true
    }] : [])
  ];

  // Show loading skeleton
  if (isLoading && !results) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Retirement Success Probability Comparison</CardTitle>
          <CardDescription className="text-gray-400">
            Loading stress test results...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-12 w-full bg-gray-700" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg text-white flex items-center justify-between">
          <span>Retirement Success Probability Comparison</span>
          {isCached && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Cached {cacheAge < 60 ? `${cacheAge}s` : `${Math.floor(cacheAge / 60)}m`} ago
              {isLoading && ' • Updating...'}
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-gray-400">
          Comparing retirement success probability before and after stress scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horizontal Bars */}
        {scenarios.map((scenario, index) => (
          <div key={index} className={(scenario as any).isCombined ? 'pt-3 border-t border-gray-700' : ''}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${
                scenario.isBaseline ? 'text-white' : 
                (scenario as any).isCombined ? 'text-purple-300' : 'text-gray-300'
              }`}>
                {scenario.name}
              </span>
              <div className="flex items-center gap-3">
                {!scenario.isBaseline && (
                  <span className={`text-xs font-medium ${
                    scenario.impact < 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {scenario.impact > 0 ? '+' : ''}{scenario.impact.toFixed(1)} pts
                  </span>
                )}
                <span className="text-sm font-bold text-white">
                  {scenario.score.toFixed(1)}
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="h-8 bg-gray-700 rounded-md overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${scenario.score}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
                  className="h-full rounded-md flex items-center justify-end pr-2"
                  style={{ backgroundColor: getBarColor(scenario.score) }}
                >
                  {scenario.score >= 70 && (
                    <span className="text-xs font-medium text-white drop-shadow">
                      {getScoreLabel(scenario.score)}
                    </span>
                  )}
                </motion.div>
              </div>
              {/* Reference lines */}
              <div className="absolute top-0 h-8 w-px bg-green-500 opacity-50" style={{ left: '80%' }} />
              <div className="absolute top-0 h-8 w-px bg-yellow-500 opacity-50" style={{ left: '70%' }} />
              {/* Baseline reference for non-baseline scenarios */}
              {!scenario.isBaseline && (
                <div 
                  className="absolute top-0 h-8 w-0.5 bg-white opacity-30"
                  style={{ left: `${baselineScore}%` }}
                />
              )}
            </div>
          </div>
        ))}

        {/* Quick Summary - Only show combined stress results */}
        {results.combinedResult && (
          <div className="mt-6 pt-4 border-t border-gray-700 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400">Combined Stress Result</p>
              <p className="text-lg font-bold text-red-400">
                {(results.combinedResult.successProbability * 100).toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Impact</p>
              <p className="text-lg font-bold text-orange-400">
                {results.combinedResult.impactPercentage.toFixed(1)} pts
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};