import { runEnhancedMonteCarloSimulation, DEFAULT_RETURN_CONFIG, DEFAULT_VARIANCE_REDUCTION } from './server/monte-carlo-enhanced';
import type { RetirementMonteCarloParams } from './server/monte-carlo-base';

function makeParams(): RetirementMonteCarloParams {
  return {
    currentAge: 55,
    retirementAge: 65,
    lifeExpectancy: 90,
    currentRetirementAssets: 800000,
    annualRetirementExpenses: 72000,
    annualGuaranteedIncome: 24000,
    expectedReturn: 0.06,
    returnVolatility: 0.12,
    inflationRate: 0.025,
    stockAllocation: 0.6,
    bondAllocation: 0.3,
    cashAllocation: 0.1,
    withdrawalRate: 0.04,
    taxRate: 0.22,
    filingStatus: 'single',
    retirementState: 'FL',
    assetBuckets: {
      taxDeferred: 500000,
      taxFree: 200000,
      capitalGains: 100000,
      cashEquivalents: 0,
      totalAssets: 800000
    }
  };
}

const iterations = 500;
const seed = 1234567;

const params1 = { ...makeParams(), randomSeed: seed } as any;
const params2 = { ...makeParams(), randomSeed: seed } as any;

const varCfg = { ...DEFAULT_VARIANCE_REDUCTION, useStratifiedSampling: false };

const r1 = await runEnhancedMonteCarloSimulation(params1, iterations, false, DEFAULT_RETURN_CONFIG, varCfg);
const r2 = await runEnhancedMonteCarloSimulation(params2, iterations, false, DEFAULT_RETURN_CONFIG, varCfg);

const fields = [
  'successProbability',
  'medianEndingBalance',
  'percentile10EndingBalance',
  'percentile90EndingBalance'
] as const;

let allEqual = true;
for (const f of fields) {
  const v1 = (r1 as any)[f];
  const v2 = (r2 as any)[f];
  if (Math.abs(v1 - v2) > 1e-8) {
    allEqual = false;
    console.log(`Mismatch ${f}:`, v1, v2);
  }
}

if (allEqual) {
  console.log('✅ Determinism OK: identical results for same seed.');
} else {
  console.log('❌ Determinism FAILED: values differ for same seed.');
}
