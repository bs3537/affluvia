// Test script to verify Monte Carlo fixes
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { runRetirementMonteCarloSimulation } from './monte-carlo.js';

async function runTests() {
console.log('🧪 Testing Monte Carlo Fix - Withdrawal Rate Bug\n');

// Test parameters matching the user's scenario
const testParams = {
  currentAge: 45,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentRetirementAssets: 500000,
  annualGuaranteedIncome: 30000, // Social Security estimate
  annualRetirementExpenses: 80000,
  annualHealthcareCosts: 15000,
  healthcareInflationRate: 0.0269,
  expectedReturn: 0.07,
  returnVolatility: 0.15,
  inflationRate: 0.025,
  stockAllocation: 0.6,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  useGlidePath: false,
  withdrawalRate: 0.04, // 4% withdrawal rate
  useGuardrails: false, // Test without guardrails first
  taxRate: 0.22,
  annualSavings: 31000, // $2,583/month * 12
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

console.log('Test Parameters:');
console.log(`- Current Age: ${testParams.currentAge}`);
console.log(`- Retirement Age: ${testParams.retirementAge}`);
console.log(`- Current Assets: $${testParams.currentRetirementAssets.toLocaleString()}`);
console.log(`- Annual Savings: $${testParams.annualSavings.toLocaleString()} ($${(testParams.annualSavings/12).toFixed(0)}/month)`);
console.log(`- Annual Expenses: $${testParams.annualRetirementExpenses.toLocaleString()}`);
console.log(`- Withdrawal Rate: ${(testParams.withdrawalRate * 100).toFixed(1)}%`);
console.log(`- Guaranteed Income: $${testParams.annualGuaranteedIncome.toLocaleString()}`);
console.log('');

// Run single scenario to check withdrawal logic
console.log('=== Single Scenario Test (No Guardrails) ===\n');
const { runEnhancedRetirementScenario } = await import('./monte-carlo-enhanced.js');
const singleResult = runEnhancedRetirementScenario(testParams);

console.log(`Success: ${singleResult.success ? 'Yes' : 'No'}`);
console.log(`Ending Balance: $${singleResult.endingBalance.toLocaleString()}`);
if (singleResult.yearsUntilDepletion) {
  console.log(`Years Until Depletion: ${singleResult.yearsUntilDepletion}`);
}

// Check first few years of retirement
console.log('\nFirst 5 Years of Retirement:');
const retirementStartIndex = testParams.retirementAge - testParams.currentAge;
for (let i = 0; i < 5 && i + retirementStartIndex < singleResult.yearlyCashFlows.length; i++) {
  const year = singleResult.yearlyCashFlows[retirementStartIndex + i];
  console.log(`Year ${i + 1} (Age ${year.age}):`);
  console.log(`  Portfolio: $${year.portfolioBalance.toLocaleString()}`);
  console.log(`  Withdrawal: $${year.withdrawal.toLocaleString()}`);
  console.log(`  Guaranteed Income: $${year.guaranteedIncome.toLocaleString()}`);
  console.log(`  Net Cash Flow: $${year.netCashFlow.toLocaleString()}`);
  if (year.adjustmentType) {
    console.log(`  Adjustment: ${year.adjustmentType} - ${year.adjustmentReason}`);
  }
}

// Test with guardrails enabled
console.log('\n\n=== Single Scenario Test (With Guardrails) ===\n');
const guardrailParams = { ...testParams, useGuardrails: true };
const guardrailResult = runEnhancedRetirementScenario(guardrailParams);

console.log(`Success: ${guardrailResult.success ? 'Yes' : 'No'}`);
console.log(`Ending Balance: $${guardrailResult.endingBalance.toLocaleString()}`);
console.log(`Guyton-Klinger Adjustments: ${guardrailResult.guytonKlingerAdjustments}`);

// Run full Monte Carlo simulations
console.log('\n\n=== Full Monte Carlo Comparison (1000 iterations) ===\n');

console.log('Enhanced Implementation:');
const enhancedStart = Date.now();
const enhancedResult = runEnhancedMonteCarloSimulation(testParams, 1000);
const enhancedTime = Date.now() - enhancedStart;

console.log(`- Success Rate: ${enhancedResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Median Ending Balance: $${enhancedResult.medianEndingBalance.toLocaleString()}`);
console.log(`- Safe Withdrawal Rate: ${(enhancedResult.safeWithdrawalRate * 100).toFixed(2)}%`);
console.log(`- Time: ${enhancedTime}ms`);

console.log('\nOriginal Implementation:');
const originalStart = Date.now();
const originalResult = runRetirementMonteCarloSimulation(testParams, 1000);
const originalTime = Date.now() - originalStart;

console.log(`- Success Rate: ${originalResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Median Ending Balance: $${originalResult.medianEndingBalance.toLocaleString()}`);
console.log(`- Safe Withdrawal Rate: ${(originalResult.safeWithdrawalRate * 100).toFixed(2)}%`);
console.log(`- Time: ${originalTime}ms`);

console.log('\nDifference:');
console.log(`- Success Rate: ${(enhancedResult.probabilityOfSuccess - originalResult.probabilityOfSuccess).toFixed(1)}%`);
console.log(`- Median Balance: $${(enhancedResult.medianEndingBalance - originalResult.medianEndingBalance).toLocaleString()}`);

// Verify withdrawal rate is being applied correctly
console.log('\n\n=== Withdrawal Rate Verification ===\n');
const firstRetirementYear = singleResult.yearlyCashFlows[retirementStartIndex];
const portfolioAtRetirement = singleResult.yearlyCashFlows[retirementStartIndex - 1]?.portfolioBalance || testParams.currentRetirementAssets;
const expectedFirstWithdrawal = portfolioAtRetirement * testParams.withdrawalRate;
const actualFirstWithdrawal = firstRetirementYear.withdrawal;

console.log(`Portfolio at Retirement: $${portfolioAtRetirement.toLocaleString()}`);
console.log(`Expected First Year Withdrawal (4%): $${expectedFirstWithdrawal.toLocaleString()}`);
console.log(`Actual First Year Withdrawal: $${actualFirstWithdrawal.toLocaleString()}`);
console.log(`Difference: $${Math.abs(expectedFirstWithdrawal - actualFirstWithdrawal).toLocaleString()}`);

if (Math.abs(expectedFirstWithdrawal - actualFirstWithdrawal) < 1000) {
  console.log('✅ Withdrawal rate is being applied correctly!');
} else {
  console.log('❌ Withdrawal rate calculation appears incorrect!');
}

console.log('\n✅ Test completed!');
}

runTests().catch(console.error);