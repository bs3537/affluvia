// Modern Monte Carlo Simulation Hook
// Uses worker pool singleton for efficient resource management

import { useState, useCallback, useEffect } from 'react';
import { getWorkerPool } from '../workers/workerPool';
import { buildMonteCarloParams } from '../lib/montecarlo-params';
import { seedFromParams } from '@/lib/seed';

interface SimulationResult {
  probabilityOfSuccess: number;
  medianEndingBalance: number;
  percentile10EndingBalance: number;
  percentile90EndingBalance: number;
  yearsUntilDepletion: number | null;
  confidenceIntervals: {
    percentile10: number;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    percentile90: number;
  };
  scenarios: {
    successful: number;
    failed: number;
    total: number;
  };
  yearlyCashFlows: any[];
  safeWithdrawalRate?: number;
  currentRetirementAssets?: number;
  projectedRetirementPortfolio?: number;
}

interface UseMonteCarloSimulationReturn {
  runSimulation: (profile?: any, iterations?: number) => Promise<SimulationResult>;
  result: SimulationResult | null;
  isLoading: boolean;
  error: string | null;
  progress: number;
  cancel: () => void;
  poolStatus: {
    initialized: boolean;
    totalWorkers: number;
    availableWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
  };
}

export function useMonteCarloSimulation(): UseMonteCarloSimulationReturn {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [poolStatus, setPoolStatus] = useState({
    initialized: false,
    totalWorkers: 0,
    availableWorkers: 0,
    busyWorkers: 0,
    queuedTasks: 0
  });
  
  const workerPool = getWorkerPool();
  
  // Initialize worker pool on mount
  useEffect(() => {
    workerPool.initialize().then(() => {
      updatePoolStatus();
    });
    
    // Update pool status periodically
    const interval = setInterval(updatePoolStatus, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  const updatePoolStatus = useCallback(() => {
    setPoolStatus(workerPool.getStatus());
  }, [workerPool]);
  
  const cancel = useCallback(() => {
    setIsLoading(false);
    setProgress(0);
    // Note: Current implementation doesn't support cancelling in-progress simulations
    // This would need to be added to the worker pool
  }, []);
  
  const runSimulation = useCallback(async (
    profile?: any,
    iterations: number = 1000
  ): Promise<SimulationResult> => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      // Get profile if not provided
      let financialProfile = profile;
      if (!financialProfile) {
        const response = await fetch('/api/financial-profile', { 
          credentials: 'include' 
        });
        if (!response.ok) {
          throw new Error('Failed to fetch financial profile');
        }
        financialProfile = await response.json();
      }
      
      // Build parameters
      const params = buildMonteCarloParams(financialProfile);
      
      // Run simulation using worker pool
      const simulationResult = await workerPool.runSimulation(params, iterations);
      
      // Update state
      setResult(simulationResult);
      setProgress(100);
      setIsLoading(false);
      updatePoolStatus();
      
      return simulationResult;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Simulation failed';
      setError(errorMessage);
      setIsLoading(false);
      setProgress(0);
      
      // Fallback to server-side simulation
      try {
        console.log('Falling back to server-side simulation');
        const response = await fetch('/api/calculate-retirement-monte-carlo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            skipCache: false,
            iterations,
            seed: seedFromParams({ iterations }, 'useMonteCarloSimulation-fallback')
          })
        });
        
        if (!response.ok) {
          throw new Error('Server simulation also failed');
        }
        
        const serverResult = await response.json();
        setResult(serverResult);
        return serverResult;
        
      } catch (serverError) {
        console.error('Both client and server simulations failed:', serverError);
        throw serverError;
      }
    }
  }, [workerPool]);
  
  return {
    runSimulation,
    result,
    isLoading,
    error,
    progress,
    cancel,
    poolStatus
  };
}
