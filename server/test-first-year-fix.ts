// Test script to verify first year retirement fix
import { runRetirementMonteCarloSimulation } from './monte-carlo.js';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';

console.log('🧪 Testing First Year Retirement Fix\n');

// Test parameters matching the user's scenario
const testParams = {
  currentAge: 45,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentRetirementAssets: 500000,
  annualGuaranteedIncome: 30000,
  annualRetirementExpenses: 80000,
  annualHealthcareCosts: 15000,
  healthcareInflationRate: 0.0269,
  expectedReturn: 0.07,
  returnVolatility: 0.15,
  inflationRate: 0.025,
  stockAllocation: 0.6,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  withdrawalRate: 0.04,
  useGuardrails: false,
  taxRate: 0.22,
  annualSavings: 31000, // $2,583/month
  legacyGoal: 100000,
  hasLongTermCareInsurance: false,
  assetBuckets: {
    taxDeferred: 300000,
    taxFree: 100000,
    capitalGains: 80000,
    cashEquivalents: 20000,
    totalAssets: 500000
  }
};

console.log('Running Monte Carlo simulations with first year fix...\n');

// Run original implementation
console.log('Original Implementation (with first year fix):');
const originalStart = Date.now();
const originalResult = runRetirementMonteCarloSimulation(testParams, 1000);
const originalTime = Date.now() - originalStart;

console.log(`- Success Rate: ${originalResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Successful Scenarios: ${originalResult.scenarios.successful}/${originalResult.scenarios.total}`);
console.log(`- Failed Scenarios: ${originalResult.scenarios.failed}`);
console.log(`- Median Ending Balance: $${originalResult.medianEndingBalance.toLocaleString()}`);
console.log(`- 10th Percentile: $${originalResult.percentile10EndingBalance.toLocaleString()}`);
console.log(`- 90th Percentile: $${originalResult.percentile90EndingBalance.toLocaleString()}`);
console.log(`- Safe Withdrawal Rate: ${(originalResult.safeWithdrawalRate * 100).toFixed(2)}%`);
console.log(`- Time: ${originalTime}ms`);

console.log('\nEnhanced Implementation (with first year fix):');
const enhancedStart = Date.now();
const enhancedResult = runEnhancedMonteCarloSimulation(testParams, 1000);
const enhancedTime = Date.now() - enhancedStart;

console.log(`- Success Rate: ${enhancedResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Successful Scenarios: ${enhancedResult.scenarios.successful}/${enhancedResult.scenarios.total}`);
console.log(`- Failed Scenarios: ${enhancedResult.scenarios.failed}`);
console.log(`- Median Ending Balance: $${enhancedResult.medianEndingBalance.toLocaleString()}`);
console.log(`- 10th Percentile: $${enhancedResult.percentile10EndingBalance.toLocaleString()}`);
console.log(`- 90th Percentile: $${enhancedResult.percentile90EndingBalance.toLocaleString()}`);
console.log(`- Safe Withdrawal Rate: ${(enhancedResult.safeWithdrawalRate * 100).toFixed(2)}%`);
console.log(`- Time: ${enhancedTime}ms`);

// Test with higher expenses to ensure we get some failures
console.log('\n\nTesting with higher expenses ($100k/year):');
const highExpenseParams = {
  ...testParams,
  annualRetirementExpenses: 100000
};

const highExpenseResult = runRetirementMonteCarloSimulation(highExpenseParams, 1000);
console.log(`- Success Rate: ${highExpenseResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Failed Scenarios: ${highExpenseResult.scenarios.failed}/${highExpenseResult.scenarios.total}`);

// Test with lower savings to ensure realistic results
console.log('\nTesting with lower savings ($1,000/month):');
const lowSavingsParams = {
  ...testParams,
  annualSavings: 12000
};

const lowSavingsResult = runRetirementMonteCarloSimulation(lowSavingsParams, 1000);
console.log(`- Success Rate: ${lowSavingsResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Failed Scenarios: ${lowSavingsResult.scenarios.failed}/${lowSavingsResult.scenarios.total}`);

console.log('\n✅ Test completed!');