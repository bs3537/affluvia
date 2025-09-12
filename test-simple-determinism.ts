/**
 * Simple determinism test for Monte Carlo simulation
 * Tests if the same seed produces the same result
 */

import { runEnhancedRetirementScenario } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';
import { DeterministicRandom } from './server/deterministic-random';

function createTestParams(): RetirementMonteCarloParams {
  return {
    currentAge: 50,
    retirementAge: 65,
    lifeExpectancy: 85,
    currentRetirementAssets: 1000000,
    annualRetirementExpenses: 60000,
    annualGuaranteedIncome: 20000,
    expectedReturn: 0.07,
    returnVolatility: 0.12,
    inflationRate: 0.025,
    stockAllocation: 0.6,
    bondAllocation: 0.3,
    cashAllocation: 0.1,
    withdrawalRate: 0.04,
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

console.log('=== Simple Determinism Test ===\n');

// Run the same scenario multiple times with the same seed
const runs = 5;
const seed = 12345;
const results: any[] = [];

for (let i = 0; i < runs; i++) {
  const params = createTestParams();
  
  // Enable deterministic mode for this run
  DeterministicRandom.enable(seed);
  const result = runEnhancedRetirementScenario(params, undefined, [seed]);
  DeterministicRandom.disable();
  
  results.push({
    run: i + 1,
    endingBalance: result.endingBalance,
    success: result.success,
    yearsUntilDepletion: result.yearsUntilDepletion
  });
  
  console.log(`Run ${i + 1}:`);
  console.log(`  Ending Balance: $${result.endingBalance.toFixed(2)}`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Years Until Depletion: ${result.yearsUntilDepletion || 'N/A'}`);
}

// Check if all runs produced the same result
console.log('\n=== Determinism Check ===');
const firstBalance = results[0].endingBalance;
const allSame = results.every(r => Math.abs(r.endingBalance - firstBalance) < 0.01);

if (allSame) {
  console.log('✅ DETERMINISTIC: All runs produced the same result');
} else {
  console.log('❌ NOT DETERMINISTIC: Results vary between runs');
  console.log('\nBalances:');
  results.forEach(r => {
    console.log(`  Run ${r.run}: $${r.endingBalance.toFixed(2)}`);
  });
  
  // Calculate variance
  const mean = results.reduce((sum, r) => sum + r.endingBalance, 0) / results.length;
  const variance = results.reduce((sum, r) => sum + Math.pow(r.endingBalance - mean, 2), 0) / results.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  
  console.log(`\n  Mean: $${mean.toFixed(2)}`);
  console.log(`  Std Dev: $${stdDev.toFixed(2)}`);
  console.log(`  Coefficient of Variation: ${(cv * 100).toFixed(2)}%`);
}

// Test with different seeds to ensure they produce different results
console.log('\n=== Different Seeds Test ===');
const seeds = [12345, 67890, 11111, 99999];
const seedResults: any[] = [];

for (const testSeed of seeds) {
  const params = createTestParams();
  
  DeterministicRandom.enable(testSeed);
  const result = runEnhancedRetirementScenario(params, undefined, [testSeed]);
  DeterministicRandom.disable();
  
  seedResults.push({
    seed: testSeed,
    endingBalance: result.endingBalance
  });
  console.log(`Seed ${testSeed}: $${result.endingBalance.toFixed(2)}`);
}

// Check that different seeds produce different results
const uniqueBalances = new Set(seedResults.map(r => r.endingBalance.toFixed(2)));
if (uniqueBalances.size > 1) {
  console.log('✅ Different seeds produce different results');
} else {
  console.log('⚠️  All seeds produced the same result (unexpected)');
}