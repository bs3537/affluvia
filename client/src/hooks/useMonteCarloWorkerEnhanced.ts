import { useState, useCallback, useRef, useEffect } from 'react';
import { seedFromParams } from '@/lib/seed';

// Configuration constants
const WORKER_TIMEOUT_MS = 30000; // 30 seconds timeout per worker
const MAX_WORKERS = 8;
const DEFAULT_WORKER_COUNT = 4;
const BATCH_SIZE = 100;

interface MonteCarloParams {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentRetirementAssets: number;
  annualGuaranteedIncome: number;
  annualRetirementExpenses: number;
  annualHealthcareCosts: number;
  expectedReturn: number;
  returnVolatility: number;
  inflationRate: number;
  stockAllocation: number;
  bondAllocation: number;
  cashAllocation: number;
  withdrawalRate: number;
  useGuardrails: boolean;
  taxRate: number;
  annualSavings: number;
  legacyGoal: number;
  assetBuckets: {
    taxDeferred: number;
    taxFree: number;
    capitalGains: number;
    cashEquivalents: number;
    totalAssets: number;
  };
}

interface MonteCarloResult {
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

interface UseMonteCarloWorkerReturn {
  runSimulation: (params: MonteCarloParams, iterations?: number) => Promise<MonteCarloResult>;
  progress: number;
  isRunning: boolean;
  cancel: () => void;
  isWorkerSupported: boolean;
}

// Check if Web Workers are supported
const checkWorkerSupport = (): boolean => {
  return typeof Worker !== 'undefined' && typeof URL !== 'undefined';
};

// Fallback server-side simulation
async function runServerSimulation(params: MonteCarloParams): Promise<MonteCarloResult> {
  const response = await fetch('/api/calculate-retirement-monte-carlo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      skipCache: false,
      params, 
      seed: seedFromParams(params, 'worker-enhanced-fallback')
    })
  });
  
  if (!response.ok) {
    throw new Error('Server simulation failed');
  }
  
  return response.json();
}

export function useMonteCarloWorkerEnhanced(): UseMonteCarloWorkerReturn {
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const workersRef = useRef<Worker[]>([]);
  const currentSimulationId = useRef<string>('');
  const cleanupFunctionsRef = useRef<Map<string, () => void>>(new Map());
  const isWorkerSupported = checkWorkerSupport();
  
  // Initialize workers with feature detection
  useEffect(() => {
    if (!isWorkerSupported) {
      console.warn('Web Workers not supported, will use server-side calculations');
      return;
    }
    
    const workerCount = Math.min(
      navigator.hardwareConcurrency || DEFAULT_WORKER_COUNT, 
      MAX_WORKERS
    );
    console.log(`Initializing ${workerCount} Monte Carlo workers`);
    
    const workers: Worker[] = [];
    
    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = new Worker(
          new URL('../workers/monte-carlo.worker.ts', import.meta.url),
          { type: 'module' }
        );
        workers.push(worker);
        
        // Add error handler for worker
        worker.onerror = (error) => {
          console.error(`Worker ${i} error:`, error);
        };
        
      } catch (error) {
        console.error('Failed to create worker:', error);
        // Continue with fewer workers if some fail
      }
    }
    
    workersRef.current = workers;
    
    // Cleanup workers on unmount
    return () => {
      workersRef.current.forEach(worker => {
        try {
          worker.terminate();
        } catch (e) {
          console.error('Error terminating worker:', e);
        }
      });
      workersRef.current = [];
      
      // Clean up any pending event listeners
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current.clear();
    };
  }, [isWorkerSupported]);
  
  const cancel = useCallback(() => {
    currentSimulationId.current = '';
    setIsRunning(false);
    setProgress(0);
    
    // Clean up all pending listeners
    cleanupFunctionsRef.current.forEach(cleanup => cleanup());
    cleanupFunctionsRef.current.clear();
  }, []);
  
  const runSimulation = useCallback(async (
    params: MonteCarloParams,
    iterations: number = 1000
  ): Promise<MonteCarloResult> => {
    // Use server simulation if workers not supported
    if (!isWorkerSupported || workersRef.current.length === 0) {
      console.log('Using server-side simulation (no workers available)');
      setIsRunning(true);
      try {
        const result = await runServerSimulation(params);
        setIsRunning(false);
        return result;
      } catch (error) {
        setIsRunning(false);
        throw error;
      }
    }
    
    setIsRunning(true);
    setProgress(0);
    
    const simulationId = Date.now().toString();
    currentSimulationId.current = simulationId;
    
    const workers = workersRef.current;
    const workerCount = workers.length;
    const iterationsPerWorker = Math.floor(iterations / workerCount);
    const remainder = iterations % workerCount;
    
    console.log(`Running ${iterations} simulations across ${workerCount} workers`);
    
    const workerPromises = workers.map((worker, index) => {
      return new Promise<MonteCarloResult>((resolve, reject) => {
        const workerIterations = iterationsPerWorker + (index < remainder ? 1 : 0);
        const workerId = `${simulationId}-${index}`;
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Worker ${index} timed out after ${WORKER_TIMEOUT_MS}ms`));
        }, WORKER_TIMEOUT_MS);
        
        const handleMessage = (e: MessageEvent) => {
          if (e.data.id !== workerId) return;
          
          if (e.data.type === 'PROGRESS') {
            // Update overall progress
            setProgress(prevProgress => {
              const workerProgress = e.data.progress / workerCount;
              const baseProgress = (index / workerCount) * 100;
              return Math.min(100, baseProgress + workerProgress);
            });
          } else if (e.data.type === 'COMPLETE') {
            cleanup();
            resolve(e.data.result);
          } else if (e.data.type === 'ERROR') {
            cleanup();
            reject(new Error(e.data.error));
          }
        };
        
        const handleError = (error: ErrorEvent) => {
          cleanup();
          reject(new Error(`Worker ${index} error: ${error.message}`));
        };
        
        const cleanup = () => {
          clearTimeout(timeoutId);
          worker.removeEventListener('message', handleMessage);
          worker.removeEventListener('error', handleError);
          cleanupFunctionsRef.current.delete(workerId);
        };
        
        // Store cleanup function for this worker
        cleanupFunctionsRef.current.set(workerId, cleanup);
        
        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);
        
        // Send simulation request to worker
        worker.postMessage({
          type: 'RUN_SIMULATION',
          id: workerId,
          params,
          iterations: workerIterations,
          batchSize: Math.min(BATCH_SIZE, workerIterations)
        });
      });
    });
    
    try {
      // Wait for all workers to complete
      const workerResults = await Promise.all(workerPromises);
      
      // Check if simulation was cancelled
      if (currentSimulationId.current !== simulationId) {
        throw new Error('Simulation cancelled');
      }
      
      // Aggregate results from all workers
      const aggregatedResult = aggregateWorkerResults(workerResults, iterations, params);
      
      setIsRunning(false);
      setProgress(100);
      
      return aggregatedResult;
      
    } catch (error) {
      setIsRunning(false);
      setProgress(0);
      
      // Clean up any remaining listeners
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current.clear();
      
      throw error;
    }
  }, [isWorkerSupported]);
  
  return {
    runSimulation,
    progress,
    isRunning,
    cancel,
    isWorkerSupported
  };
}

// Optimized aggregation function
function aggregateWorkerResults(
  workerResults: MonteCarloResult[],
  totalIterations: number,
  params: MonteCarloParams
): MonteCarloResult {
  // Collect all ending balances
  const allEndingBalances: number[] = [];
  let totalSuccessful = 0;
  let totalFailed = 0;
  const depletionYears: number[] = [];
  
  // Use first worker's yearly cash flows
  const yearlyCashFlows = (workerResults[0] as any)?.yearlyData || 
                          workerResults[0]?.yearlyCashFlows || [];
  
  // Aggregate data from all workers
  workerResults.forEach(result => {
    totalSuccessful += result.scenarios.successful;
    totalFailed += result.scenarios.failed;
    
    // Estimate individual ending balances from percentiles
    const workerIterations = result.scenarios.total;
    const distribution = generateDistributionSafe(
      result.percentile10EndingBalance,
      result.medianEndingBalance * 0.75, // Approximate percentile 25
      result.medianEndingBalance,
      result.medianEndingBalance * 1.25, // Approximate percentile 75
      result.percentile90EndingBalance,
      workerIterations
    );
    allEndingBalances.push(...distribution);
    
    if (result.yearsUntilDepletion !== null) {
      // Estimate number of depletion scenarios
      const depletionCount = Math.round(result.scenarios.failed * 0.8);
      for (let i = 0; i < depletionCount; i++) {
        depletionYears.push(result.yearsUntilDepletion);
      }
    }
  });
  
  // Sort once for all percentiles (optimization)
  allEndingBalances.sort((a, b) => a - b);
  
  const getPercentile = (p: number): number => {
    if (allEndingBalances.length === 0) return 0;
    const index = Math.floor((p / 100) * (allEndingBalances.length - 1));
    return allEndingBalances[Math.min(index, allEndingBalances.length - 1)];
  };
  
  const probabilityOfSuccess = (totalSuccessful / totalIterations) * 100;
  
  // Calculate safe withdrawal rate if needed
  let safeWithdrawalRate = params.withdrawalRate;
  if (probabilityOfSuccess < 80) {
    const adjustment = (80 - probabilityOfSuccess) / 100;
    safeWithdrawalRate = params.withdrawalRate * (1 - adjustment * 0.5);
  }
  
  const avgDepletion = depletionYears.length > 0
    ? depletionYears.reduce((sum, y) => sum + y, 0) / depletionYears.length
    : null;
  
  return {
    probabilityOfSuccess,
    medianEndingBalance: getPercentile(50),
    percentile10EndingBalance: getPercentile(10),
    percentile90EndingBalance: getPercentile(90),
    yearsUntilDepletion: avgDepletion,
    confidenceIntervals: {
      percentile10: getPercentile(10),
      percentile25: getPercentile(25),
      percentile50: getPercentile(50),
      percentile75: getPercentile(75),
      percentile90: getPercentile(90)
    },
    scenarios: {
      successful: totalSuccessful,
      failed: totalFailed,
      total: totalIterations
    },
    yearlyCashFlows,
    safeWithdrawalRate,
    currentRetirementAssets: params.currentRetirementAssets,
    projectedRetirementPortfolio: calculateProjectedPortfolio(params)
  };
}

// Safe distribution generation with null check
function generateDistributionSafe(
  p10: number,
  p25: number,
  p50: number,
  p75: number,
  p90: number,
  count: number
): number[] {
  const distribution: number[] = [];
  
  // Define segments for interpolation
  const segments = [
    { start: 0, end: 0.1, startVal: p10 * 0.5, endVal: p10 },
    { start: 0.1, end: 0.25, startVal: p10, endVal: p25 },
    { start: 0.25, end: 0.5, startVal: p25, endVal: p50 },
    { start: 0.5, end: 0.75, startVal: p50, endVal: p75 },
    { start: 0.75, end: 0.9, startVal: p75, endVal: p90 },
    { start: 0.9, end: 1.0, startVal: p90, endVal: p90 * 1.5 }
  ];
  
  for (let i = 0; i < count; i++) {
    const percentile = i / Math.max(1, count - 1); // Avoid division by zero
    
    // Find which segment this percentile falls into (with safety check)
    let segment = segments.find(s => percentile >= s.start && percentile <= s.end);
    
    // Fallback to last segment if not found (edge case protection)
    if (!segment) {
      segment = segments[segments.length - 1];
    }
    
    // Linear interpolation within segment
    const segmentRange = segment.end - segment.start;
    const segmentProgress = segmentRange > 0 
      ? (percentile - segment.start) / segmentRange 
      : 0;
    const value = segment.startVal + (segment.endVal - segment.startVal) * segmentProgress;
    
    distribution.push(Math.max(0, value));
  }
  
  return distribution;
}

// Calculate projected portfolio at retirement
function calculateProjectedPortfolio(params: MonteCarloParams): number {
  const yearsToRetirement = Math.max(0, params.retirementAge - params.currentAge);
  let projected = params.currentRetirementAssets;
  
  for (let year = 0; year < yearsToRetirement; year++) {
    projected += params.annualSavings;
    projected *= (1 + params.expectedReturn);
  }
  
  return Math.round(projected);
}
