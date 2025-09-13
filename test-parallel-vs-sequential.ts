import { runEnhancedMonteCarloSimulation, runParallelMonteCarloSimulation, DEFAULT_RETURN_CONFIG, DEFAULT_VARIANCE_REDUCTION } from './server/monte-carlo-enhanced';
import type { RetirementMonteCarloParams } from './server/monte-carlo-base';

function makeParams(seed: number): RetirementMonteCarloParams & { randomSeed: number } {
  return {
    currentAge: 54,
    retirementAge: 65,
    lifeExpectancy: 90,
    currentRetirementAssets: 900000,
    annualRetirementExpenses: 65000,
    annualGuaranteedIncome: 28000,
    expectedReturn: 0.06,
    returnVolatility: 0.13,
    inflationRate: 0.025,
    stockAllocation: 0.6,
    bondAllocation: 0.35,
    cashAllocation: 0.05,
    withdrawalRate: 0.04,
    taxRate: 0.22,
    filingStatus: 'single',
    retirementState: 'TX',
    assetBuckets: {
      taxDeferred: 550000,
      taxFree: 250000,
      capitalGains: 100000,
      cashEquivalents: 0,
      totalAssets: 900000
    },
    randomSeed: seed
  } as any;
}

async function main() {
  const iterations = 600;
  const seed = 444444;
  const params = makeParams(seed);
  const varCfg = { ...DEFAULT_VARIANCE_REDUCTION, useStratifiedSampling: false, useAntitheticVariates: false };
  process.env.MC_FORCE_INLINE = '1';

  const seq = await runEnhancedMonteCarloSimulation(params, iterations, false, DEFAULT_RETURN_CONFIG, varCfg);
  const par = await runParallelMonteCarloSimulation(params, iterations, 3, false, DEFAULT_RETURN_CONFIG, varCfg);

  function eq(a: number, b: number, tol = 1e-8) { return Math.abs(a - b) <= tol; }

  const checks: Array<[string, number, number]> = [
    ['successProbability', seq.successProbability, par.successProbability],
    ['medianEndingBalance', seq.medianEndingBalance, par.medianEndingBalance],
    ['percentile10EndingBalance', seq.percentile10EndingBalance, par.percentile10EndingBalance],
    ['percentile90EndingBalance', seq.percentile90EndingBalance, par.percentile90EndingBalance],
  ];

  let ok = true;
  for (const [name, a, b] of checks) {
    const same = eq(a, b, name.includes('Balance') ? 1e-2 : 1e-6);
    console.log(`${name}: seq=${a} par=${b} ${same ? 'OK' : 'DIFF'}`);
    if (!same) ok = false;
  }

  if (ok) console.log('✅ Parallel equals sequential under fixed seed.');
  else console.log('❌ Parallel differs from sequential.');
}

main();
process.env.MC_FORCE_INLINE = '1';
