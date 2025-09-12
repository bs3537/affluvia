import { runRetirementMonteCarloSimulation } from './monte-carlo-base';

// Test with the user's parameters that showed the bug
const params = {
  currentAge: 26,
  retirementAge: 65,
  lifeExpectancy: 90,
  spouseAge: undefined,
  spouseRetirementAge: undefined,
  spouseLifeExpectancy: undefined,
  currentRetirementAssets: 80000,
  projectedRetirementPortfolio: 7765885.45,
  monthlyRetirementContributions: 2000,
  yearsToRetirement: 39,
  preTaxRetirement: 30000,
  rothRetirement: 45000,
  brokerageAssets: 5000,
  stockAllocation: 0.3,
  bondAllocation: 0.5,
  cashAllocation: 0.2,
  expectedReturn: 0.06,
  returnVolatility: 0.12,
  annualRetirementExpenses: 90000,
  annualHealthcareCosts: 10000,
  inflationRate: 0.025,
  healthcareInflationRate: 0.05,
  taxRate: 0.25,
  withdrawalRate: 0.04,
  annualGuaranteedIncome: 25000,
  annualSavings: 24000, // $2,000/month * 12
  userHealthStatus: 'good',
  spouseHealthStatus: undefined,
  legacyGoal: 0,
  useGuardrails: true,
  useGlidePath: false,
  retirementState: 'moderate',
  userGender: 'male',
  spouseGender: undefined,
  assetBuckets: {
    taxDeferred: 30000,
    taxFree: 45000,
    capitalGains: 5000,
    cashEquivalents: 0,
    totalAssets: 80000
  }
};

console.log('=== TESTING MONTE CARLO BUG FIX ===\n');
console.log('Testing with user parameters that showed 100% success with 2.88 year depletion...\n');

// Run simulation with fixed success criteria
const result = runRetirementMonteCarloSimulation(params, 1000);

console.log('Results with FIXED success criteria:');
console.log(`- Probability of Success: ${result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Years Until Depletion: ${result.yearsUntilDepletion ? result.yearsUntilDepletion.toFixed(1) : 'Never'}`);
console.log(`- Median Ending Balance: $${result.medianEndingBalance.toLocaleString()}`);
console.log(`- 10th Percentile: $${result.percentile10EndingBalance.toLocaleString()}`);
console.log(`- 90th Percentile: $${result.percentile90EndingBalance.toLocaleString()}`);
console.log(`- Safe Withdrawal Rate: ${(result.safeWithdrawalRate * 100).toFixed(2)}%`);

console.log('\nScenario breakdown:');
console.log(`- Successful: ${result.scenarios.successful}`);
console.log(`- Failed: ${result.scenarios.failed}`);
console.log(`- Total: ${result.scenarios.total}`);

// Analysis
console.log('\n=== ANALYSIS ===');
if (result.probabilityOfSuccess === 100 && result.yearsUntilDepletion && result.yearsUntilDepletion < 5) {
  console.log('❌ BUG STILL PRESENT: 100% success with early depletion');
} else if (result.probabilityOfSuccess < 100 && result.yearsUntilDepletion) {
  console.log('✅ BUG FIXED: Success rate now properly reflects depletion risk');
} else if (result.probabilityOfSuccess === 100 && !result.yearsUntilDepletion) {
  console.log('✅ Genuinely successful retirement plan');
}

// Check the scenario details
console.log('\nChecking why depletion happens so early...');
console.log(`- Annual expenses: $${params.annualRetirementExpenses + params.annualHealthcareCosts}`);
console.log(`- Annual guaranteed income: $${params.annualGuaranteedIncome}`);
console.log(`- Net withdrawal needed: $${(params.annualRetirementExpenses + params.annualHealthcareCosts - params.annualGuaranteedIncome)}`);
console.log(`- Starting portfolio: $${params.currentRetirementAssets}`);
console.log(`- Withdrawal rate on $80k: ${((params.annualRetirementExpenses + params.annualHealthcareCosts - params.annualGuaranteedIncome) / params.currentRetirementAssets * 100).toFixed(1)}%`);

console.log('\n❗ The issue is that currentRetirementAssets ($80k) is being used instead of projectedRetirementPortfolio ($7.7M)!');