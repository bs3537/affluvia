// Debug script to test User 5's Monte Carlo simulation
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { RetirementMonteCarloParams } from './monte-carlo.js';

// User 5: Late-Career Worker with Limited Resources
const user5Params: RetirementMonteCarloParams = {
  currentAge: 62,
  retirementAge: 67,
  lifeExpectancy: 88,
  currentRetirementAssets: 120000,  // Only $120k saved
  annualGuaranteedIncome: 22000,    // Social Security only
  annualRetirementExpenses: 35000,   // Expected retirement expenses
  annualHealthcareCosts: 14000,      // Healthcare costs in retirement
  healthcareInflationRate: 0.025,
  expectedReturn: 0.05,              // 5% return (50% stocks, 40% bonds, 10% cash)
  returnVolatility: 0.12,            // Lower volatility due to conservative allocation
  inflationRate: 0.025,
  stockAllocation: 0.50,
  bondAllocation: 0.40,
  cashAllocation: 0.10,
  withdrawalRate: 0.04,
  useGuardrails: false,
  taxRate: 0.15,                     // Lower tax bracket
  annualSavings: 4800,               // $4,800/year until retirement
  legacyGoal: 0,                     // No legacy goal
  hasLongTermCareInsurance: false,
  assetBuckets: {
    taxDeferred: 100000,             // Most in 401k/IRA
    taxFree: 0,
    capitalGains: 10000,             // Small taxable savings
    cashEquivalents: 10000,          // Emergency fund
    totalAssets: 120000
  }
};

console.log('=== USER 5 MONTE CARLO DEBUG ===\n');
console.log('Profile Summary:');
console.log('- Age: 62 (retiring at 67)');
console.log('- Current savings: $120,000');
console.log('- Annual savings: $4,800');
console.log('- Social Security: $22,000/year');
console.log('- Retirement expenses: $35,000/year');
console.log('- Healthcare costs: $14,000/year');
console.log('- Total retirement need: $49,000/year');
console.log('- Gap after SS: $27,000/year\n');

// Calculate projected portfolio at retirement
const yearsToRetirement = 5;
let projectedPortfolio = user5Params.currentRetirementAssets;
for (let i = 0; i < yearsToRetirement; i++) {
  projectedPortfolio += user5Params.annualSavings;
  projectedPortfolio *= 1.05; // 5% growth
}
console.log(`Projected portfolio at retirement: $${Math.round(projectedPortfolio).toLocaleString()}`);
console.log(`Initial withdrawal rate: ${((27000 / projectedPortfolio) * 100).toFixed(2)}%\n`);

// Run simulation
console.log('Running Monte Carlo simulation with 1000 scenarios...\n');
const result = runEnhancedMonteCarloSimulation(user5Params, 1000);

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
if (result.probabilityOfSuccess === 100) {
  console.log('❌ ERROR: 100% success rate is unrealistic for this profile!');
  console.log('This user has limited resources and should have a much lower success rate.');
} else if (result.probabilityOfSuccess > 50) {
  console.log('⚠️  WARNING: Success rate seems too high for this profile.');
} else {
  console.log('✅ Success rate appears realistic for this constrained profile.');
}