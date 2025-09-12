import { runEnhancedMonteCarloSimulation, DEFAULT_RETURN_CONFIG, DEFAULT_VARIANCE_REDUCTION } from '../monte-carlo-enhanced';

type Work =
  | { kind: 'score'; params: any; runs: number; variance?: any; seed?: number }
  | { kind: 'bands'; params: any; runs: number; variance?: any; seed?: number }
  | { type: 'score'; params: any; simulationCount: number; variance?: any; seed?: number }
  | { type: 'bands'; params: any; simulationCount: number; variance?: any; seed?: number };

type ScoreResult = {
  kind: 'score';
  successes: number;
  total: number;
  medianEndingBalance: number;
  percentile10: number;
  percentile90: number;
  fullResult?: any; // Include full Monte Carlo result for stress tests
};

type BandsResult = {
  kind: 'bands';
  perYear: { [yearIndex: number]: { p05: number; p25: number; p50: number; p75: number; p95: number; count: number; age: number } };
  scenarios: any[];
  probabilityOfSuccess?: number; // Include success probability for optimization endpoint
  medianEndingBalance?: number; // Include for optimization endpoint
};

// Main worker message handler
const handleMessage = async (msg: Work): Promise<ScoreResult | BandsResult> => {
  // Support both old format (kind/runs) and new format (type/simulationCount)
  const kind = ('kind' in msg) ? msg.kind : msg.type;
  const runs = ('runs' in msg) ? msg.runs : msg.simulationCount;
  const { params, variance = DEFAULT_VARIANCE_REDUCTION, seed } = msg;
  // Ensure deterministic seeding across workers if seed provided
  const seededParams = { ...params, randomSeed: (seed ?? (params as any)?.randomSeed) };
  
  try {
    if (kind === 'score') {
      // Run Monte Carlo simulation for success probability and key metrics
      const result = await runEnhancedMonteCarloSimulation(
        seededParams, 
        runs, 
        true, // trackAllScenarios - needed for accurate percentiles
        DEFAULT_RETURN_CONFIG,
        variance,
        false // useParallel - already parallelized at pool level
      );
      
      const probabilityOfSuccess = result.probabilityOfSuccess || 0;
      const successes = (probabilityOfSuccess * runs);
      
      return {
        kind: 'score',
        successes,
        total: runs,
        medianEndingBalance: result.medianEndingBalance || 0,
        percentile10: result.confidenceIntervals?.percentile10 || 0,
        percentile90: result.confidenceIntervals?.percentile90 || 0,
        fullResult: result // Include full result for stress tests
      };
    } else if (kind === 'bands') {
      // Run Monte Carlo simulation for confidence bands
      const result = await runEnhancedMonteCarloSimulation(
        seededParams,
        runs,
        true, // trackAllScenarios - required for bands
        DEFAULT_RETURN_CONFIG,
        variance,
        false // useParallel - already parallelized at pool level
      );
      
      // Extract per-year percentiles from scenarios
      const scenarios = (result as any).allScenarios || [];
      const validScenarios = scenarios.filter((s: any) => Array.isArray(s.yearlyCashFlows) && s.yearlyCashFlows.length > 0);
      
      if (validScenarios.length === 0) {
        return {
          kind: 'bands',
          perYear: {},
          scenarios: []
        };
      }
      
      const yearsCount = Math.min(...validScenarios.map((s: any) => s.yearlyCashFlows.length));
      const perYear: { [yearIndex: number]: { p05: number; p25: number; p50: number; p75: number; p95: number; count: number; age: number } } = {};
      
      for (let yearIdx = 0; yearIdx < yearsCount; yearIdx++) {
        const portfolioValues = validScenarios
          .map((s: any) => s.yearlyCashFlows[yearIdx]?.portfolioBalance || 0)
          .filter((v: number) => v >= 0)
          .sort((a: number, b: number) => a - b);
          
        if (portfolioValues.length > 0) {
          const currentAge = params.currentAge || 30;
          const age = currentAge + yearIdx;
          
          perYear[yearIdx] = {
            p05: calculatePercentile(portfolioValues, 5),
            p25: calculatePercentile(portfolioValues, 25),
            p50: calculatePercentile(portfolioValues, 50),
            p75: calculatePercentile(portfolioValues, 75),
            p95: calculatePercentile(portfolioValues, 95),
            count: portfolioValues.length,
            age
          };
        }
      }
      
      return {
        kind: 'bands',
        perYear,
        scenarios: validScenarios.slice(0, 10), // Return small sample for debugging
        probabilityOfSuccess: result.probabilityOfSuccess || 0,
        medianEndingBalance: result.medianEndingBalance || 0
      };
    }
  } catch (error) {
    console.error('[MC Worker] Error processing task:', error);
    throw error;
  }
  
  // If we reach here, the kind wasn't recognized
  throw new Error(`[MC Worker] Unknown task kind: ${String(kind)}`);
};

// Helper function to calculate percentiles
const calculatePercentile = (sortedArray: number[], percentile: number): number => {
  if (sortedArray.length === 0) return 0;
  
  const index = (percentile / 100) * (sortedArray.length - 1);
  
  if (index % 1 === 0) {
    return sortedArray[index];
  } else {
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }
};

// Piscina expects a default-exported function that processes the task
export default async function (msg: Work): Promise<ScoreResult | BandsResult> {
  return handleMessage(msg);
}
