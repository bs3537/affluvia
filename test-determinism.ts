/**
 * Test RNG determinism in isolation
 */

import { runEnhancedRetirementScenario } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

function createSimpleParams(): RetirementMonteCarloParams {
  return {
    currentAge: 50,
    retirementAge: 65,
    lifeExpectancy: 85,
    currentRetirementAssets: 500000,
    annualRetirementExpenses: 60000,
    annualGuaranteedIncome: 0,
    expectedReturn: 0.07,
    returnVolatility: 0.12,
    inflationRate: 0.025,
    stockAllocation: 0.6,
    bondAllocation: 0.3,
    cashAllocation: 0.1,
    withdrawalRate: 0.04,
    useGuardrails: false,
    taxRate: 0.22,
    filingStatus: 'single',
    retirementState: 'FL',
    assetBuckets: {
      taxDeferred: 500000,
      taxFree: 0,
      capitalGains: 0,
      cashEquivalents: 0,
      totalAssets: 500000
    },
    annualSavings: 10000,
    monthlyContribution401k: 500,
    monthlyContributionIRA: 0,
    monthlyContributionRothIRA: 0,
    monthlyContributionBrokerage: 0
  };
}

console.log('=== Testing Determinism ===\n');

const params = createSimpleParams();
const seed = 99999;

console.log('Running with seed:', seed);

// Run 3 times with same seed
const results = [];
for (let i = 0; i < 3; i++) {
  const result = runEnhancedRetirementScenario(params, undefined, [seed]);
  results.push({
    endingBalance: result.endingBalance,
    success: result.success,
    yearsUntilDepletion: result.yearsUntilDepletion,
    firstYearReturn: result.yearlyCashFlows[0]?.investmentReturn,
    firstYearBalance: result.yearlyCashFlows[0]?.portfolioBalance,
    fifthYearReturn: result.yearlyCashFlows[4]?.investmentReturn,
    fifthYearBalance: result.yearlyCashFlows[4]?.portfolioBalance
  });
}

console.log('\nResults:');
for (let i = 0; i < results.length; i++) {
  console.log(`\nRun ${i + 1}:`);
  console.log(`  Ending Balance: ${results[i].endingBalance}`);
  console.log(`  Success: ${results[i].success}`);
  console.log(`  Years Until Depletion: ${results[i].yearsUntilDepletion || 'Never'}`);
  console.log(`  First Year Return: ${results[i].firstYearReturn?.toFixed(6)}`);
  console.log(`  First Year Balance: ${results[i].firstYearBalance?.toFixed(2)}`);
  console.log(`  Fifth Year Return: ${results[i].fifthYearReturn?.toFixed(6)}`);
  console.log(`  Fifth Year Balance: ${results[i].fifthYearBalance?.toFixed(2)}`);
}

// Check if all are the same
const allSame = results.every(r => 
  r.endingBalance === results[0].endingBalance &&
  r.success === results[0].success &&
  r.yearsUntilDepletion === results[0].yearsUntilDepletion &&
  r.firstYearReturn === results[0].firstYearReturn &&
  r.firstYearBalance === results[0].firstYearBalance
);

console.log(`\nDeterminism Test: ${allSame ? 'PASS' : 'FAIL'}`);

if (!allSame) {
  console.log('\nDifferences detected:');
  
  // Check where divergence starts - check all years
  for (let year = 0; year < Math.min(40, results[0].yearlyCashFlows?.length || 0); year++) {
    const balances = results.map(r => r.yearlyCashFlows?.[year]?.portfolioBalance);
    const returns = results.map(r => r.yearlyCashFlows?.[year]?.investmentReturn);
    
    if (balances[0] !== balances[1] || balances[0] !== balances[2]) {
      console.log(`\n  Year ${year + 1} (Age ${50 + year + 1}): DIVERGENCE FOUND`);
      console.log(`    Balances: ${balances.map(b => b?.toFixed(2) || 'N/A').join(', ')}`);
      console.log(`    Returns: ${returns.map(r => r?.toFixed(6) || 'N/A').join(', ')}`);
      
      // Show a few years before and after
      for (let y = Math.max(0, year - 2); y <= Math.min(year + 2, results[0].yearlyCashFlows?.length - 1); y++) {
        if (y !== year) {
          const yBalances = results.map(r => r.yearlyCashFlows?.[y]?.portfolioBalance);
          const yReturns = results.map(r => r.yearlyCashFlows?.[y]?.investmentReturn);
          console.log(`  Year ${y + 1} (Age ${50 + y + 1}):`);
          console.log(`    Balances: ${yBalances.map(b => b?.toFixed(2) || 'N/A').join(', ')}`);
          console.log(`    Returns: ${yReturns.map(r => r?.toFixed(6) || 'N/A').join(', ')}`);
        }
      }
      break;
    }
  }
}