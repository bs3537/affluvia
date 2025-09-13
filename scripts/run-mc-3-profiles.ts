import { runEnhancedMonteCarloSimulation, FAT_TAIL_DISTRIBUTION, DEFAULT_DISTRIBUTION } from '../server/monte-carlo-enhanced';
import type { RetirementMonteCarloParams } from '../server/monte-carlo-base';

type Check = { name: string; ok: boolean; details?: string };

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function percentileFromSorted(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function validateResult(label: string, result: any, iterations: number): { checks: Check[]; pass: boolean } {
  const checks: Check[] = [];

  // Basic success probability checks
  const sp = Number(result.successProbability);
  const pct = Number(result.probabilityOfSuccess);
  checks.push({ name: 'successProbability in [0,1]', ok: sp >= 0 && sp <= 1, details: `${sp}` });
  if (!Number.isNaN(pct)) {
    const diff = Math.abs(pct - sp * 100);
    checks.push({ name: 'probabilityOfSuccess ≈ successProbability*100', ok: diff <= 0.5, details: `diff=${diff.toFixed(3)}` });
  }

  // Scenario accounting checks
  const sc = result.scenarios || {};
  const total = Number(sc.total);
  const succ = Number(sc.successful);
  const failed = Number(sc.failed);
  checks.push({ name: 'scenarios.total == iterations', ok: total === iterations, details: `${total} vs ${iterations}` });
  checks.push({ name: 'successful + failed == total', ok: succ + failed === total, details: `${succ}+${failed}=${succ + failed} vs ${total}` });

  // Confidence interval structure checks
  const ci = result.confidenceIntervals || {};
  const ciVals = ['percentile10', 'percentile25', 'percentile50', 'percentile75', 'percentile90']
    .map((k) => Number(ci[k as keyof typeof ci] ?? NaN));
  const monotonic = ciVals.every((v, i) => (i === 0 ? true : v >= ciVals[i - 1]));
  checks.push({ name: 'CI monotonic p10<=p25<=p50<=p75<=p90', ok: monotonic, details: `${ciVals.map((v) => Math.round(v)).join(' <= ')}` });

  // Median consistency
  if (!Number.isNaN(Number(result.medianEndingBalance)) && !Number.isNaN(ci.percentile50)) {
    const diffMedian = Math.abs(Number(result.medianEndingBalance) - Number(ci.percentile50));
    checks.push({ name: 'median equals CI p50', ok: diffMedian <= 1, details: `diff=${diffMedian.toFixed(3)}` });
  }

  // Cross-check CI against raw scenario ending balances, if available
  if (Array.isArray(result.allScenarios) && result.allScenarios.length > 0) {
    const ends: number[] = result.allScenarios.map((s: any) => Number(s.endingBalance || 0));
    const sorted = [...ends].sort((a, b) => a - b);
    const p10 = percentileFromSorted(sorted, 10);
    const p25 = percentileFromSorted(sorted, 25);
    const p50 = percentileFromSorted(sorted, 50);
    const p75 = percentileFromSorted(sorted, 75);
    const p90 = percentileFromSorted(sorted, 90);
    const tol = 1; // dollars tolerance
    checks.push({ name: 'p10 matches raw percentiles', ok: Math.abs(p10 - Number(ci.percentile10)) <= tol, details: `${Math.round(p10)} vs ${Math.round(Number(ci.percentile10))}` });
    checks.push({ name: 'p25 matches raw percentiles', ok: Math.abs(p25 - Number(ci.percentile25)) <= tol, details: `${Math.round(p25)} vs ${Math.round(Number(ci.percentile25))}` });
    checks.push({ name: 'p50 matches raw percentiles', ok: Math.abs(p50 - Number(ci.percentile50)) <= tol, details: `${Math.round(p50)} vs ${Math.round(Number(ci.percentile50))}` });
    checks.push({ name: 'p75 matches raw percentiles', ok: Math.abs(p75 - Number(ci.percentile75)) <= tol, details: `${Math.round(p75)} vs ${Math.round(Number(ci.percentile75))}` });
    checks.push({ name: 'p90 matches raw percentiles', ok: Math.abs(p90 - Number(ci.percentile90)) <= tol, details: `${Math.round(p90)} vs ${Math.round(Number(ci.percentile90))}` });
  } else {
    checks.push({ name: 'allScenarios present', ok: false, details: 'missing allScenarios for raw CI validation' });
  }

  const pass = checks.every((c) => c.ok);
  return { checks, pass };
}

async function main() {
  process.env.CMA_VERSION = process.env.CMA_VERSION || '2025-US';
  const iterations = Number(process.env.MC_ITERATIONS || 1000);

  const profiles: Array<{ label: string; params: RetirementMonteCarloParams }> = [
    {
      label: 'Profile A - Single, mid-career, moderate assets',
      params: {
        currentAge: 45,
        retirementAge: 65,
        lifeExpectancy: 90,
        currentRetirementAssets: 500_000,
        expensesIncludeHealthcare: false,
        annualGuaranteedIncome: 0,
        annualRetirementExpenses: 70_000,
        expectedReturn: 0.07,
        returnVolatility: 0.12,
        inflationRate: 0.025,
        stockAllocation: 0.60,
        bondAllocation: 0.35,
        cashAllocation: 0.05,
        useGlidePath: false,
        withdrawalRate: 0.04,
        useGuardrails: false,
        taxRate: 0.22,
        filingStatus: 'single',
        retirementState: 'FL',
        annualSavings: 30_000,
        assetBuckets: {
          taxDeferred: 300_000,
          taxFree: 100_000,
          capitalGains: 100_000,
          cashEquivalents: 0,
          totalAssets: 500_000,
        },
        // Optional SS to add realism
        socialSecurityBenefit: 2000, // monthly
        socialSecurityClaimAge: 67,
      },
    },
    {
      label: 'Profile B - Married couple nearing retirement with pension',
      params: {
        currentAge: 58,
        spouseAge: 56,
        retirementAge: 65,
        spouseRetirementAge: 63,
        lifeExpectancy: 92,
        spouseLifeExpectancy: 90,
        currentRetirementAssets: 1_200_000,
        expensesIncludeHealthcare: false,
        annualGuaranteedIncome: 30_000, // pension
        annualRetirementExpenses: 90_000,
        expectedReturn: 0.065,
        returnVolatility: 0.11,
        inflationRate: 0.025,
        stockAllocation: 0.55,
        bondAllocation: 0.35,
        cashAllocation: 0.10,
        useGlidePath: false,
        withdrawalRate: 0.04,
        useGuardrails: true,
        taxRate: 0.20,
        filingStatus: 'married',
        retirementState: 'TX',
        annualSavings: 40_000,
        assetBuckets: {
          taxDeferred: 800_000,
          taxFree: 200_000,
          capitalGains: 180_000,
          cashEquivalents: 20_000,
          totalAssets: 1_200_000,
        },
        socialSecurityBenefit: 2500,
        spouseSocialSecurityBenefit: 1800,
        socialSecurityClaimAge: 67,
        spouseSocialSecurityClaimAge: 65,
      },
    },
    {
      label: 'Profile C - Immediate retiree, lean FIRE-style',
      params: {
        currentAge: 62,
        retirementAge: 62,
        lifeExpectancy: 90,
        currentRetirementAssets: 800_000,
        expensesIncludeHealthcare: false,
        annualGuaranteedIncome: 12_000, // part-time or small annuity
        annualRetirementExpenses: 80_000,
        expectedReturn: 0.065,
        returnVolatility: 0.13,
        inflationRate: 0.025,
        stockAllocation: 0.65,
        bondAllocation: 0.30,
        cashAllocation: 0.05,
        useGlidePath: false,
        withdrawalRate: 0.045,
        useGuardrails: true,
        taxRate: 0.22,
        filingStatus: 'single',
        retirementState: 'CA',
        annualSavings: 0,
        assetBuckets: {
          taxDeferred: 500_000,
          taxFree: 150_000,
          capitalGains: 150_000,
          cashEquivalents: 0,
          totalAssets: 800_000,
        },
        socialSecurityBenefit: 2200,
        socialSecurityClaimAge: 67,
      },
    },
  ];

  let overallPass = true;

  async function runBatch(batchLabel: string, dist: any, crashProbs?: { black: number; severe: number; moderate: number }) {
    if (crashProbs) {
      process.env.FAT_TAIL_BLACK_SWAN_PROB = String(crashProbs.black);
      process.env.FAT_TAIL_SEVERE_PROB = String(crashProbs.severe);
      process.env.FAT_TAIL_MODERATE_PROB = String(crashProbs.moderate);
    }
    console.log(`\n=== ${batchLabel} ===`);
    for (const { label, params } of profiles) {
      console.log(`\n----- ${label} -----`);
      const t0 = Date.now();
      const res = await runEnhancedMonteCarloSimulation(params, iterations, false, undefined, undefined, false, dist);
      const ms = Date.now() - t0;

      console.log(`Iterations: ${iterations} | Time: ${(ms / 1000).toFixed(2)}s`);
      console.log(`Success Probability: ${(Number(res.successProbability) * 100).toFixed(1)}%`);
      console.log(`Median Ending Balance: ${fmt(Number(res.medianEndingBalance))}`);
      if (res.confidenceIntervals) {
        console.log(`CI [p10..p90]: ${fmt(Number(res.confidenceIntervals.percentile10))} .. ${fmt(Number(res.confidenceIntervals.percentile90))}`);
      }
      if ((res as any).ltcAnalysis) {
        const la = (res as any).ltcAnalysis;
        console.log(`LTC: P(event)=${(la.probabilityOfLTC*100).toFixed(1)}% | success w/ LTC=${la.impactOnSuccess.successWithLTC.toFixed(1)}% | success w/o LTC=${la.impactOnSuccess.successWithoutLTC.toFixed(1)}% | delta=${la.impactOnSuccess.successDelta.toFixed(1)}%`);
      }

      const { checks, pass } = validateResult(label, res, iterations);
      for (const c of checks) {
        console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.details ? ` — ${c.details}` : ''}`);
      }
      overallPass = overallPass && pass;
    }
  }

  await runBatch('BEFORE: Student-t + original crash frequency', FAT_TAIL_DISTRIBUTION, { black: 0.002, severe: 0.01, moderate: 0.03 });
  // Disable overlay entirely for strict normal baseline
  process.env.DISABLE_CRASH_OVERLAY = '1';
  process.env.IID_LOGNORMAL_BASELINE = '1';
  await runBatch('AFTER: Normal + NO crash overlay (strict baseline)', DEFAULT_DISTRIBUTION, { black: 0, severe: 0, moderate: 0 });

  if (!overallPass) {
    console.error('\nValidation failed for one or more profiles.');
    process.exit(1);
  } else {
    console.log('\nAll profiles validated successfully.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
