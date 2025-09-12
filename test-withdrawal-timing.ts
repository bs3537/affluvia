/**
 * Test Withdrawal Timing Implementation
 * Verifies that start-of-year, mid-year, and end-of-year withdrawals work correctly
 */

import { runEnhancedRetirementScenario } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

function createTestParams(withdrawalTiming: 'start' | 'mid' | 'end'): RetirementMonteCarloParams {
  return {
    currentAge: 50,
    retirementAge: 65,
    lifeExpectancy: 85,
    currentRetirementAssets: 1000000,
    annualRetirementExpenses: 50000,
    annualGuaranteedIncome: 20000,
    expectedReturn: 0.07,
    returnVolatility: 0.12,
    inflationRate: 0.025,
    stockAllocation: 0.6,
    bondAllocation: 0.3,
    cashAllocation: 0.1,
    withdrawalRate: 0.04,
    withdrawalTiming, // Set the timing
    useGuardrails: false,
    taxRate: 0.22,
    filingStatus: 'single',
    retirementState: 'FL',
    assetBuckets: {
      taxDeferred: 700000,
      taxFree: 200000,
      capitalGains: 100000,
      cashEquivalents: 0,
      totalAssets: 1000000
    },
    socialSecurityBenefit: 2000,
    monthlyContribution401k: 1500,
    monthlyContributionIRA: 500,
    monthlyContributionRothIRA: 500,
    monthlyContributionBrokerage: 500,
    annualSavings: 36000
  };
}

console.log('=== Testing Withdrawal Timing Implementation ===\n');

// Use the same seed for all tests to compare results
const seed = 12345;

// Test all three timing options
const timingOptions: Array<'start' | 'mid' | 'end'> = ['start', 'mid', 'end'];
const results: Record<string, any> = {};

for (const timing of timingOptions) {
  const params = createTestParams(timing);
  const result = runEnhancedRetirementScenario(params, undefined, [seed]);
  results[timing] = result;
  
  console.log(`\n${timing.toUpperCase()}-of-year withdrawal results:`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Ending Balance: $${result.endingBalance.toFixed(0)}`);
  console.log(`  Years Until Depletion: ${result.yearsUntilDepletion || 'Never'}`);
  
  // Look at first few retirement years
  console.log('  First 3 retirement years:');
  for (let i = 15; i < Math.min(18, result.yearlyCashFlows.length); i++) {
    const flow = result.yearlyCashFlows[i];
    if (flow) {
      console.log(`    Year ${i - 14} (Age ${flow.age}): Balance = $${flow.portfolioBalance.toFixed(0)}`);
    }
  }
}

console.log('\n=== Comparative Analysis ===\n');

// Compare results
const endBalances = {
  start: results.start.endingBalance,
  mid: results.mid.endingBalance,
  end: results.end.endingBalance
};

console.log('Ending Balances:');
console.log(`  Start-of-year: $${endBalances.start.toFixed(0)}`);
console.log(`  Mid-year:      $${endBalances.mid.toFixed(0)}`);
console.log(`  End-of-year:   $${endBalances.end.toFixed(0)}`);

// Calculate differences
const startVsEnd = ((endBalances.end - endBalances.start) / endBalances.start * 100).toFixed(1);
const midVsEnd = ((endBalances.end - endBalances.mid) / endBalances.mid * 100).toFixed(1);

console.log('\nRelative Performance:');
console.log(`  End vs Start: ${startVsEnd}% difference`);
console.log(`  End vs Mid: ${midVsEnd}% difference`);

// Verify expected behavior
console.log('\n=== Validation ===\n');

const expectedBehavior = endBalances.end >= endBalances.mid && endBalances.mid >= endBalances.start;

if (expectedBehavior) {
  console.log('✓ Expected ordering confirmed: End >= Mid >= Start');
  console.log('  This is correct because:');
  console.log('  - End-of-year: Portfolio grows all year before withdrawal');
  console.log('  - Mid-year: Portfolio grows half year before and after');
  console.log('  - Start-of-year: Withdrawal happens before any growth');
} else {
  console.log('⚠ Unexpected ordering detected');
  console.log('  Check implementation for potential issues');
}

// Test impact on success rates with multiple scenarios
console.log('\n=== Success Rate Impact (100 scenarios) ===\n');

let successCounts = { start: 0, mid: 0, end: 0 };

for (let s = 0; s < 100; s++) {
  for (const timing of timingOptions) {
    const params = createTestParams(timing);
    const result = runEnhancedRetirementScenario(params, undefined, [1000 + s]);
    if (result.success) {
      successCounts[timing]++;
    }
  }
}

console.log('Success Rates:');
console.log(`  Start-of-year: ${successCounts.start}%`);
console.log(`  Mid-year:      ${successCounts.mid}%`);
console.log(`  End-of-year:   ${successCounts.end}%`);

console.log('\n========================================');
console.log('Withdrawal Timing Implementation Summary');
console.log('========================================');
console.log('✓ Start-of-year: Withdrawals before returns (most conservative)');
console.log('✓ Mid-year: Half returns before, half after (balanced)');
console.log('✓ End-of-year: Full returns before withdrawal (most optimistic)');
console.log('\nRecommendation: Use "mid" for balanced projections or "start" for conservative planning');