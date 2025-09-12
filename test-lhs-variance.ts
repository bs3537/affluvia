import { runEnhancedMonteCarloSimulation, DEFAULT_RETURN_CONFIG, DEFAULT_VARIANCE_REDUCTION } from './server/monte-carlo-enhanced';
import type { RetirementMonteCarloParams } from './server/monte-carlo-base';

function makeParams(seed: number): RetirementMonteCarloParams & { randomSeed: number } {
  return {
    currentAge: 52,
    retirementAge: 65,
    lifeExpectancy: 92,
    currentRetirementAssets: 950000,
    annualRetirementExpenses: 68000,
    annualGuaranteedIncome: 30000,
    expectedReturn: 0.06,
    returnVolatility: 0.15,
    inflationRate: 0.025,
    stockAllocation: 0.65,
    bondAllocation: 0.3,
    cashAllocation: 0.05,
    withdrawalRate: 0.04,
    taxRate: 0.22,
    filingStatus: 'married',
    retirementState: 'TX',
    assetBuckets: {
      taxDeferred: 600000,
      taxFree: 250000,
      capitalGains: 100000,
      cashEquivalents: 0,
      totalAssets: 950000
    },
    randomSeed: seed
  } as any;
}

const iterations = 400;
const trials = 12;

async function runSeries(useLHS: boolean): Promise<number[]> {
  const vals: number[] = [];
  for (let t = 0; t < trials; t++) {
    const seed = 100001 + t * 9973;
    const params = makeParams(seed);
    const varCfg = useLHS
      ? { ...DEFAULT_VARIANCE_REDUCTION, useStratifiedSampling: true, useAntitheticVariates: false }
      : { ...DEFAULT_VARIANCE_REDUCTION, useStratifiedSampling: false, useAntitheticVariates: false };
    const res = await runEnhancedMonteCarloSimulation(params, iterations, false, DEFAULT_RETURN_CONFIG, varCfg);
    vals.push(res.successProbability);
  }
  return vals;
}

function variance(xs: number[]): number {
  const m = xs.reduce((a,b)=>a+b,0)/xs.length;
  return xs.reduce((s,x)=>s+(x-m)*(x-m),0)/xs.length;
}

const baseVals = await runSeries(false);
const lhsVals = await runSeries(true);

const varBase = variance(baseVals);
const varLHS = variance(lhsVals);

console.log('Baseline variance:', varBase);
console.log('LHS variance     :', varLHS);
console.log('Reduction factor :', varBase > 0 ? (varLHS/varBase).toFixed(3) : 'n/a');

if (varLHS < varBase) {
  console.log('✅ LHS reduced variance vs baseline.');
} else {
  console.log('⚠️  LHS did not reduce variance in this run.');
}
