import { runRightCapitalStyleMonteCarloSimulation } from './server/monte-carlo-enhanced';
import type { RetirementMonteCarloParams } from './server/monte-carlo-base';

const baseParams: RetirementMonteCarloParams = {
  currentAge: 55,
  retirementAge: 65,
  lifeExpectancy: 92,
  currentRetirementAssets: 800000,
  annualRetirementExpenses: 70000,
  annualGuaranteedIncome: 30000,
  expectedReturn: 0.06,
  returnVolatility: 0.12,
  inflationRate: 0.025,
  stockAllocation: 0.6,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  withdrawalRate: 0.04,
  taxRate: 0.22,
  filingStatus: 'single',
  retirementState: 'CA',
  assetBuckets: {
    taxDeferred: 500000,
    taxFree: 200000,
    capitalGains: 100000,
    cashEquivalents: 0,
    totalAssets: 800000
  }
} as any;

function main() {
  const iterations = 500;
  const seed = 11223344;
  const paramsA: any = { ...baseParams, randomSeed: seed };
  const paramsB: any = { ...baseParams, randomSeed: seed };
  const paramsC: any = { ...baseParams, randomSeed: seed + 1 };

  const A = runRightCapitalStyleMonteCarloSimulation(paramsA, iterations);
  const B = runRightCapitalStyleMonteCarloSimulation(paramsB, iterations);
  const C = runRightCapitalStyleMonteCarloSimulation(paramsC, iterations);

  const fields = ['successProbability', 'medianEndingBalance', 'summary.percentile10', 'summary.percentile90'] as const;
  function get(obj: any, path: string) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  }
  let okSame = true;
  for (const f of fields) {
    const a = Number(get(A, f) ?? 0);
    const b = Number(get(B, f) ?? 0);
    if (Math.abs(a - b) > 1e-8) okSame = false;
    console.log(`same-seed ${f}: ${a} vs ${b} => ${Math.abs(a - b) <= 1e-8 ? 'OK' : 'DIFF'}`);
  }
  let diffAny = false;
  for (const f of fields) {
    const a = Number(get(A, f) ?? 0);
    const c = Number(get(C, f) ?? 0);
    if (Math.abs(a - c) > 1e-8) diffAny = true;
  }
  console.log(`different-seed difference: ${diffAny ? 'OK' : 'NO-DIFF'}`);
  if (okSame && diffAny) console.log('✅ RC-style determinism test passed.');
  else console.log('❌ RC-style determinism test failed.');
}

main();

