import { parentPort } from 'worker_threads';
import { runEnhancedMonteCarloSimulation, DEFAULT_RETURN_CONFIG, DEFAULT_VARIANCE_REDUCTION } from '../monte-carlo-enhanced';
// Main worker message handler
const handleMessage = async (msg) => {
    // Support both old format (kind/runs) and new format (type/simulationCount)
    const kind = ('kind' in msg) ? msg.kind : msg.type;
    const runs = ('runs' in msg) ? msg.runs : msg.simulationCount;
    const { params, variance = DEFAULT_VARIANCE_REDUCTION, seed } = msg;
    try {
        if (kind === 'score') {
            // Run Monte Carlo simulation for success probability and key metrics
            const result = await runEnhancedMonteCarloSimulation(params, runs, true, // trackAllScenarios - needed for accurate percentiles
            DEFAULT_RETURN_CONFIG, variance, false // useParallel - already parallelized at pool level
            );
            const probabilityOfSuccess = result.probabilityOfSuccess || 0;
            const successes = Math.round(probabilityOfSuccess * runs);
            return {
                kind: 'score',
                successes,
                total: runs,
                medianEndingBalance: result.medianEndingBalance || 0,
                percentile10: result.confidenceIntervals?.percentile10 || 0,
                percentile90: result.confidenceIntervals?.percentile90 || 0,
                fullResult: result // Include full result for stress tests
            };
        }
        else if (kind === 'bands') {
            // Run Monte Carlo simulation for confidence bands
            const result = await runEnhancedMonteCarloSimulation(params, runs, true, // trackAllScenarios - required for bands
            DEFAULT_RETURN_CONFIG, variance, false // useParallel - already parallelized at pool level
            );
            // Extract per-year percentiles from scenarios
            const scenarios = result.allScenarios || [];
            const validScenarios = scenarios.filter((s) => Array.isArray(s.yearlyCashFlows) && s.yearlyCashFlows.length > 0);
            if (validScenarios.length === 0) {
                return {
                    kind: 'bands',
                    perYear: {},
                    scenarios: []
                };
            }
            const yearsCount = Math.min(...validScenarios.map((s) => s.yearlyCashFlows.length));
            const perYear = {};
            for (let yearIdx = 0; yearIdx < yearsCount; yearIdx++) {
                const portfolioValues = validScenarios
                    .map((s) => s.yearlyCashFlows[yearIdx]?.portfolioBalance || 0)
                    .filter((v) => v >= 0)
                    .sort((a, b) => a - b);
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
    }
    catch (error) {
        console.error('[MC Worker] Error processing task:', error);
        throw error;
    }
};
// Helper function to calculate percentiles
const calculatePercentile = (sortedArray, percentile) => {
    if (sortedArray.length === 0)
        return 0;
    const index = (percentile / 100) * (sortedArray.length - 1);
    if (index % 1 === 0) {
        return sortedArray[index];
    }
    else {
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
    }
};
// Set up message handler
if (parentPort) {
    parentPort.on('message', async (msg) => {
        try {
            const result = await handleMessage(msg);
            parentPort.postMessage(result);
        }
        catch (error) {
            parentPort.postMessage({
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    });
}
else {
    console.error('[MC Worker] No parentPort available - not running in worker context');
}
