/**
 * Test zero assets edge case
 */

import { runEnhancedRetirementScenario } from './server/monte-carlo-enhanced';
import { DeterministicRandom } from './server/deterministic-random';

const params = {
  currentAge: 65,
  retirementAge: 65,
  lifeExpectancy: 85,
  currentRetirementAssets: 0,
  annualRetirementExpenses: 50000,
  annualGuaranteedIncome: 50000, // Fully covered by guaranteed income
  expectedReturn: 0.07,
  returnVolatility: 0.12,
  inflationRate: 0.025,
  stockAllocation: 0.6,
  bondAllocation: 0.3,
  cashAllocation: 0.1,
  withdrawalRate: 0.04,
  taxRate: 0.22,
  filingStatus: 'single' as const,
  retirementState: 'FL',
  assetBuckets: {
    taxDeferred: 0,
    taxFree: 0,
    capitalGains: 0,
    cashEquivalents: 0,
    totalAssets: 0
  },
  annualSavings: 0
};

console.log('=== Testing Zero Assets Edge Case ===\n');
console.log('Scenario: $0 assets but $50K guaranteed income covering $50K expenses');
console.log('Expected: Should succeed (income covers expenses)\n');

DeterministicRandom.enable(111);
const result = runEnhancedRetirementScenario(params, undefined, [111]);
DeterministicRandom.disable();

console.log('Results:');
console.log(`  Success: ${result.success ? '✅' : '❌'}`);
console.log(`  Ending Balance: $${result.endingBalance.toFixed(2)}`);
console.log(`  Years Until Depletion: ${result.yearsUntilDepletion || 'N/A'}`);
console.log(`  Has Shortfall: ${result.hasShortfall}`);

// Analyze yearly cash flows
console.log('\nFirst 5 Years Cash Flow:');
for (let i = 0; i < Math.min(5, result.yearlyCashFlows.length); i++) {
  const flow = result.yearlyCashFlows[i];
  console.log(`  Year ${i+1} (Age ${flow.age}):`);
  console.log(`    Balance: $${(flow.balance || 0).toFixed(0)}`);
  console.log(`    Guaranteed Income: $${(flow.guaranteedIncome || 0).toFixed(0)}`);
  console.log(`    Withdrawal: $${(flow.withdrawal || 0).toFixed(0)}`);
  console.log(`    Expenses: $${(flow.expenses || 0).toFixed(0)}`);
}

// Check if the issue is with taxes on guaranteed income
console.log('\nAnalysis:');
if (!result.success) {
  console.log('  ❌ Test failed - guaranteed income should cover expenses');
  console.log('  Possible issues:');
  console.log('    - Taxes on guaranteed income not properly handled');
  console.log('    - Inflation adjustment mismatch');
  console.log('    - Withdrawal logic not accounting for guaranteed income');
} else {
  console.log('  ✅ Test passed - guaranteed income properly covers expenses');
}