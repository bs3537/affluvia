import { parentPort, workerData } from 'worker_threads';
import { RNG, OverlayRNG } from './rng.ts';
import { runEnhancedRetirementScenario, DEFAULT_DISTRIBUTION, type ReturnTypeConfig, type VarianceReductionConfig } from './monte-carlo-enhanced.ts';
import type { RetirementMonteCarloParams } from './monte-carlo-base.ts';

interface WorkerInput {
  params: RetirementMonteCarloParams;
  iterations: number;
  workerId: number;
  returnConfig: ReturnTypeConfig;
  varianceReduction: VarianceReductionConfig;
  startSeed: number;
}

type WorkerResult = {
  type: 'complete';
  workerId: number;
  result: {
    results: number[];
    successCount: number;
    legacySuccessCount: number;
    ltcEvents: number;
    depletionYears: number[];
    scenarios: any[];
  };
};

try {
  const {
    params,
    iterations,
    workerId,
    returnConfig,
    varianceReduction,
    startSeed,
  } = workerData as WorkerInput;

  const results: number[] = [];
  const depletionYears: number[] = [];
  let successCount = 0;
  let legacySuccessCount = 0;
  let ltcEvents = 0;

  for (let i = 0; i < iterations; i++) {
    const baseSeed = startSeed + i * 100007;
    const baseRng = new RNG(baseSeed);
    // Optional: support LHS overlay in the future by passing OverlayRNG with prepared normals
    const rng = baseRng as unknown as OverlayRNG | RNG;
    const scenario = runEnhancedRetirementScenario(
      params,
      returnConfig,
      undefined,
      DEFAULT_DISTRIBUTION,
      false,
      baseRng
    );
    results.push(scenario.endingBalance);
    if (scenario.success) successCount++;
    if (scenario.enhancedSuccessMetrics?.legacySuccess) legacySuccessCount++;
    if (scenario.ltcEvent?.occurred) ltcEvents++;
    if (scenario.yearsUntilDepletion !== null) depletionYears.push(scenario.yearsUntilDepletion);

    if (parentPort && i % 100 === 0) {
      parentPort.postMessage({ type: 'progress', workerId, completed: i, total: iterations });
    }
  }

  const message: WorkerResult = {
    type: 'complete',
    workerId,
    result: {
      results,
      successCount,
      legacySuccessCount,
      ltcEvents,
      depletionYears,
      scenarios: [],
    },
  };

  if (parentPort) parentPort.postMessage(message);
} catch (err: any) {
  if (parentPort) parentPort.postMessage({ type: 'error', error: err?.stack || String(err) });
}

