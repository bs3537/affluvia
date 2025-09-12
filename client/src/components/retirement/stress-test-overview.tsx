import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingDown, Shield, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface StressScenarioResult {
  scenarioId: string;
  scenarioName: string;
  baselineScore: number;
  stressedScore: number;
  impact: number;
  description: string;
}

interface StressTestOverviewProps {
  selectedScenarios: string[];
  onScenarioToggle?: (scenarioId: string) => void;
  useOptimizedPlan: boolean;
  baselineScore?: number;
}

export const StressTestOverview: React.FC<StressTestOverviewProps> = ({
  selectedScenarios,
  onScenarioToggle,
  useOptimizedPlan,
  baselineScore: passedBaselineScore
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baselineScore, setBaselineScore] = useState<number>(passedBaselineScore || 0);
  const [scenarios, setScenarios] = useState<StressScenarioResult[]>([]);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    // Update baseline score when passed prop changes
    if (passedBaselineScore !== undefined) {
      setBaselineScore(passedBaselineScore);
    }
  }, [passedBaselineScore]);
  
  useEffect(() => {
    fetchBatchStressTests();
  }, [useOptimizedPlan]);

  // Timer for loading state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setLoadingSeconds(0);
      interval = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const fetchBatchStressTests = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/batch-stress-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          useOptimizedVariables: useOptimizedPlan,
          // Pass the baseline to the API for proper calculation
          baselineScore: passedBaselineScore 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stress test overview');
      }

      const data = await response.json();
      // Only use API baseline if not passed from parent
      if (passedBaselineScore === undefined) {
        setBaselineScore(data.baseline * 100);
      }
      setScenarios(data.scenarios);
      setIsCached(data.isCached || false);
      
      // If results are cached, show them immediately
      if (data.isCached && data.cacheAge < 60) {
        console.log(`[STRESS-TEST-UI] Using cached results (${data.cacheAge}s old)`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stress tests');
    } finally {
      setLoading(false);
    }
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getImpactColor = (impact: number) => {
    const absImpact = Math.abs(impact);
    if (absImpact <= 5) return 'text-green-400';
    if (absImpact <= 10) return 'text-yellow-400';
    if (absImpact <= 15) return 'text-orange-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Stress Test Impact Overview
          </CardTitle>
          <CardDescription className="text-gray-400">
            Analyzing impact of each stress scenario... ({loadingSeconds}s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-12 w-full bg-gray-700" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert className="bg-red-900/20 border-red-700">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <AlertDescription className="text-red-200">
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  // Sort scenarios by impact (most negative first)
  const sortedScenarios = [...scenarios].sort((a, b) => a.impact - b.impact);

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          Retirement Success Probability Impact - {useOptimizedPlan ? 'Optimized' : 'Baseline'} Plan
        </CardTitle>
        <CardDescription className="text-gray-400">
          Individual impact of each stress scenario on your retirement success probability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Baseline Score Bar */}
        <div className="pb-3 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">
              {useOptimizedPlan ? 'Optimized Plan (No Stress)' : 'Baseline Plan (No Stress)'}
            </span>
            <span className="text-sm font-bold text-white">{baselineScore.toFixed(1)}</span>
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
                  {baselineScore >= 80 ? 'Target Met' : baselineScore >= 70 ? 'Acceptable' : 'Below Target'}
                </span>
              </motion.div>
            </div>
            {/* Reference lines */}
            <div className="absolute top-0 h-8 w-px bg-green-500 opacity-50" style={{ left: '80%' }} />
            <div className="absolute top-0 h-8 w-px bg-yellow-500 opacity-50" style={{ left: '70%' }} />
          </div>
        </div>

        {/* Individual Scenario Bars */}
        <div className="space-y-3">
          {sortedScenarios.map((scenario, index) => {
            const stressedScore = scenario.stressedScore * 100;
            const isSelected = selectedScenarios.includes(scenario.scenarioId);
            
            return (
              <motion.div
                key={scenario.scenarioId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`relative ${isSelected ? 'ring-2 ring-purple-500 rounded-lg p-2' : ''}`}
                onClick={() => onScenarioToggle?.(scenario.scenarioId)}
                style={{ cursor: onScenarioToggle ? 'pointer' : 'default' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${isSelected ? 'text-purple-300 font-medium' : 'text-gray-300'}`}>
                      {scenario.scenarioName}
                    </span>
                    {isSelected && (
                      <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${getImpactColor(scenario.impact)}`}>
                      {scenario.impact > 0 ? '+' : ''}{scenario.impact.toFixed(1)} pts
                    </span>
                    <span className="text-sm font-bold text-white">
                      {stressedScore.toFixed(1)}
                    </span>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="h-6 bg-gray-700 rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stressedScore}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
                      className="h-full flex items-center justify-end pr-2"
                      style={{ backgroundColor: getBarColor(stressedScore) }}
                    >
                      {stressedScore >= 80 && (
                        <span className="text-xs font-medium text-white drop-shadow">
                          Target Met
                        </span>
                      )}
                    </motion.div>
                  </div>
                  {/* Impact indicator */}
                  <div 
                    className="absolute top-0 h-6 w-0.5 bg-white opacity-30"
                    style={{ left: `${baselineScore}%` }}
                  />
                </div>
                
                <p className="text-xs text-gray-500 mt-1">{scenario.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Summary Alert */}
        <Alert className="bg-blue-900/20 border-blue-700 mt-4">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200 text-sm">
            <strong>How to use:</strong> Click on any scenario above to select it for detailed testing. 
            Selected scenarios will be highlighted and can be tested together using the "Run Stress Test" button below.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};