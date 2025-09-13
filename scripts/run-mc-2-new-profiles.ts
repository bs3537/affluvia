import { runEnhancedMonteCarloSimulation, DEFAULT_DISTRIBUTION } from '../server/monte-carlo-enhanced';
import type { VarianceReductionConfig } from '../server/monte-carlo-enhanced';
import type { RetirementMonteCarloParams } from '../server/monte-carlo-base';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

async function main() {
  const iterations = Number(process.env.MC_ITERATIONS || 1000);

  // Baseline runs use real dollars, IID log-normal, no crash overlay, guardrails on by default
  delete process.env.STRESS_MODE;
  delete process.env.ENABLE_SPENDING_SHOCKS;
  delete process.env.ENABLE_REBAL_COSTS;
  delete process.env.ENABLE_IRMAA;

  const profiles: Array<{ label: string; params: RetirementMonteCarloParams }> = [
    {
      label: 'Profile D - Married, strong saver, near retirement',
      params: {
        currentAge: 60,
        spouseAge: 58,
        retirementAge: 67,
        spouseRetirementAge: 65,
        lifeExpectancy: 93,
        spouseLifeExpectancy: 93,
        currentRetirementAssets: 2_000_000,
        expensesIncludeHealthcare: false,
        annualGuaranteedIncome: 20_000, // pension baseline
        annualRetirementExpenses: 110_000,
        expectedReturn: 0.065,
        returnVolatility: 0.11,
        inflationRate: 0.025,
        stockAllocation: 0.60,
        bondAllocation: 0.35,
        cashAllocation: 0.05,
        withdrawalRate: 0.04,
        taxRate: 0.20,
        filingStatus: 'married',
        retirementState: 'TX',
        annualSavings: 30_000,
        assetBuckets: {
          taxDeferred: 1_200_000,
          taxFree: 400_000,
          capitalGains: 380_000,
          cashEquivalents: 20_000,
          totalAssets: 2_000_000,
        },
        socialSecurityBenefit: 3000, // monthly
        spouseSocialSecurityBenefit: 2200,
        socialSecurityClaimAge: 67,
        spouseSocialSecurityClaimAge: 65,
      },
    },
    {
      label: 'Profile E - Single, mid-50s, earlier retirement with modest expenses',
      params: {
        currentAge: 55,
        retirementAge: 62,
        lifeExpectancy: 93,
        currentRetirementAssets: 800_000,
        expensesIncludeHealthcare: false,
        annualGuaranteedIncome: 18_000, // small annuity/part-time
        annualRetirementExpenses: 50_000,
        expectedReturn: 0.062,
        returnVolatility: 0.12,
        inflationRate: 0.025,
        stockAllocation: 0.55,
        bondAllocation: 0.40,
        cashAllocation: 0.05,
        withdrawalRate: 0.04,
        taxRate: 0.22,
        filingStatus: 'single',
        retirementState: 'FL',
        annualSavings: 20_000,
        assetBuckets: {
          taxDeferred: 480_000,
          taxFree: 160_000,
          capitalGains: 150_000,
          cashEquivalents: 10_000,
          totalAssets: 800_000,
        },
        socialSecurityBenefit: 2000,
        socialSecurityClaimAge: 67,
      },
    },
  ];

  // Disable antithetic variates per request; keep other VR aids on
  const vr: VarianceReductionConfig = {
    useAntitheticVariates: false,
    useControlVariates: true,
    useStratifiedSampling: true,
    stratificationBins: 10,
    lhsDims: 30,
  };

  for (const { label, params } of profiles) {
    const t0 = Date.now();
    const res = await runEnhancedMonteCarloSimulation(
      params,
      iterations,
      false,
      undefined,      // use default returnConfig
      vr,              // antithetic off
      false,
      DEFAULT_DISTRIBUTION
    );
    const ms = Date.now() - t0;
    console.log(`\n${label}`);
    console.log(`Iterations: ${iterations} | Time: ${(ms / 1000).toFixed(2)}s`);
    console.log(`Retirement Success Probability: ${(Number(res.successProbability) * 100).toFixed(1)}%`);
    console.log(`Median Ending Balance: ${fmt(Number(res.medianEndingBalance))}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
