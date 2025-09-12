// Debug script to test User 4's Monte Carlo simulation
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { RetirementMonteCarloParams } from './monte-carlo.js';

// User 4: Pre-Retirement Couple with Strong Savings
const user4Params: RetirementMonteCarloParams = {
  currentAge: 55,
  spouseAge: 53,
  retirementAge: 62,
  lifeExpectancy: 93,
  currentRetirementAssets: 450000,  // $450k saved
  annualGuaranteedIncome: 45000 + 15000,  // SS + Pension starting at 65/67
  annualRetirementExpenses: 80000,   // Expected retirement expenses
  annualHealthcareCosts: 18000,      // Healthcare costs in retirement
  healthcareInflationRate: 0.025,
  expectedReturn: 0.055,             // 5.5% return (60% stocks, 35% bonds, 5% cash)
  returnVolatility: 0.14,
  inflationRate: 0.025,
  stockAllocation: 0.60,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  withdrawalRate: 0.04,
  useGuardrails: false,
  taxRate: 0.22,
  annualSavings: 19500,              // $19,500/year (maxing catch-up)
  legacyGoal: 100000,                // $100k legacy goal
  hasLongTermCareInsurance: false,
  assetBuckets: {
    taxDeferred: 400000,
    taxFree: 50000,
    capitalGains: 150000,
    cashEquivalents: 40000,
    totalAssets: 600000  // Including other investments
  }
};

console.log('=== USER 4 MONTE CARLO DEBUG ===\n');
console.log('Profile Summary:');
console.log('- Ages: 55 & 53 (retiring at 62)');
console.log('- Current retirement savings: $450,000');
console.log('- Total assets: $600,000');
console.log('- Annual savings: $19,500');
console.log('- SS + Pension: $60,000/year');
console.log('- Retirement expenses: $80,000/year');
console.log('- Healthcare costs: $18,000/year');
console.log('- Total retirement need: $98,000/year');
console.log('- Gap after guaranteed income: $38,000/year\n');

// Calculate projected portfolio at retirement
const yearsToRetirement = 7;
let projectedPortfolio = user4Params.currentRetirementAssets;
for (let i = 0; i < yearsToRetirement; i++) {
  projectedPortfolio += user4Params.annualSavings;
  projectedPortfolio *= 1.055; // 5.5% growth
}
console.log(`Projected portfolio at retirement: $${Math.round(projectedPortfolio).toLocaleString()}`);
console.log(`Initial withdrawal rate: ${((38000 / projectedPortfolio) * 100).toFixed(2)}%\n`);

// Run simulation
console.log('Running Monte Carlo simulation with 1000 scenarios...\n');
const result = runEnhancedMonteCarloSimulation(user4Params, 1000);

console.log('RESULTS:');
console.log(`- Probability of Success: ${result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Median Ending Balance: $${Math.round(result.medianEndingBalance).toLocaleString()}`);
console.log(`- 10th Percentile: $${Math.round(result.percentile10EndingBalance).toLocaleString()}`);
console.log(`- 90th Percentile: $${Math.round(result.percentile90EndingBalance).toLocaleString()}`);
console.log(`- Safe Withdrawal Rate: ${(result.safeWithdrawalRate * 100).toFixed(2)}%`);
if (result.yearsUntilDepletion) {
  console.log(`- Average Years Until Depletion: ${result.yearsUntilDepletion.toFixed(1)}`);
}

console.log('\nANALYSIS:');
if (result.probabilityOfSuccess >= 90) {
  console.log('✅ Excellent retirement readiness - well-funded plan.');
} else if (result.probabilityOfSuccess >= 75) {
  console.log('✅ Good retirement readiness - solid plan with reasonable success rate.');
} else if (result.probabilityOfSuccess >= 60) {
  console.log('⚠️  Fair retirement readiness - consider adjustments to improve success rate.');
} else {
  console.log('❌ Poor retirement readiness - significant changes needed.')
}