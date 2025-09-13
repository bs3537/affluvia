import { useState, useCallback, useRef, useEffect } from 'react';
import { hash32 } from '../workers/rng';

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
}

export function useMonteCarloWorker(): UseMonteCarloWorkerReturn {
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const workersRef = useRef<Worker[]>([]);
  const currentSimulationId = useRef<string>('');
  
  // Initialize workers
  useEffect(() => {
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 8); // Cap at 8 workers
    console.log(`Initializing ${workerCount} Monte Carlo workers`);
    
    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = new Worker(
          new URL('../workers/monte-carlo.worker.ts', import.meta.url),
          { type: 'module' }
        );
        workersRef.current.push(worker);
      } catch (error) {
        console.error('Failed to create worker:', error);
      }
    }
    
    // Cleanup workers on unmount
    return () => {
      workersRef.current.forEach(worker => worker.terminate());
      workersRef.current = [];
    };
  }, []);
  
  const cancel = useCallback(() => {
    currentSimulationId.current = '';
    setIsRunning(false);
    setProgress(0);
  }, []);
  
  const runSimulation = useCallback(async (
    params: MonteCarloParams,
    iterations: number = 1000
  ): Promise<MonteCarloResult> => {
    if (workersRef.current.length === 0) {
      throw new Error('No workers available');
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
            worker.removeEventListener('message', handleMessage);
            resolve(e.data.result);
          } else if (e.data.type === 'ERROR') {
            worker.removeEventListener('message', handleMessage);
            reject(new Error(e.data.error));
          }
        };
        
        worker.addEventListener('message', handleMessage);
        
        // Send simulation request to worker
        // Deterministic seed per worker derived from params
        const baseSeed = hash32(JSON.stringify(params));
        worker.postMessage({
          type: 'RUN_SIMULATION',
          id: workerId,
          params,
          iterations: workerIterations,
          batchSize: Math.min(100, workerIterations),
          startSeed: (baseSeed + index * 1000003) >>> 0
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
      throw error;
    }
  }, []);
  
  return {
    runSimulation,
    progress,
    isRunning,
    cancel
  };
}

// Helper function to aggregate results from multiple workers
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
  const yearlyCashFlows = (workerResults[0] as any)?.yearlyData || [];
  
  // Aggregate data from all workers
  workerResults.forEach(result => {
    totalSuccessful += result.scenarios.successful;
    totalFailed += result.scenarios.failed;
    
    // Estimate individual ending balances from percentiles
    // This is approximate but good enough for aggregation
    const workerIterations = result.scenarios.total;
    const distribution = generateDistribution(
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
      const depletionCount = Math.round(result.scenarios.failed * 0.8); // Rough estimate
      for (let i = 0; i < depletionCount; i++) {
        depletionYears.push(result.yearsUntilDepletion);
      }
    }
  });
  
  // Sort for percentile calculations
  allEndingBalances.sort((a, b) => a - b);
  
  const getPercentile = (p: number): number => {
    const index = Math.floor((p / 100) * (allEndingBalances.length - 1));
    return allEndingBalances[Math.min(index, allEndingBalances.length - 1)];
  };
  
  const probabilityOfSuccess = (totalSuccessful / totalIterations) * 100;
  
  // Calculate safe withdrawal rate if needed
  let safeWithdrawalRate = params.withdrawalRate;
  if (probabilityOfSuccess < 80) {
    // Estimate based on success probability
    // This is a simplified calculation - the server does a more accurate binary search
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
    // Provide both names for compatibility
    yearlyCashFlows,
    // @deprecated
    yearlyData: yearlyCashFlows,
    safeWithdrawalRate,
    currentRetirementAssets: params.currentRetirementAssets,
    projectedRetirementPortfolio: calculateProjectedPortfolio(params)
  };
}

// Helper to generate approximate distribution from percentiles
function generateDistribution(
  p10: number,
  p25: number,
  p50: number,
  p75: number,
  p90: number,
  count: number
): number[] {
  const distribution: number[] = [];
  
  // Simple interpolation between percentiles
  const segments = [
    { start: 0, end: 0.1, startVal: p10 * 0.5, endVal: p10 },
    { start: 0.1, end: 0.25, startVal: p10, endVal: p25 },
    { start: 0.25, end: 0.5, startVal: p25, endVal: p50 },
    { start: 0.5, end: 0.75, startVal: p50, endVal: p75 },
    { start: 0.75, end: 0.9, startVal: p75, endVal: p90 },
    { start: 0.9, end: 1.0, startVal: p90, endVal: p90 * 1.5 }
  ];
  
  for (let i = 0; i < count; i++) {
    const percentile = i / (count - 1);
    
    // Find which segment this percentile falls into
    const segment = segments.find(s => percentile >= s.start && percentile <= s.end)!;
    
    // Linear interpolation within segment
    const segmentProgress = (percentile - segment.start) / (segment.end - segment.start);
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
