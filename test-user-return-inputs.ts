/**
 * Test User Return Input Connection
 * Verifies that user-specified returns and volatility are properly incorporated
 */

import { runEnhancedRetirementScenario } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

function createTestParams(
  expectedReturn?: number,
  returnVolatility?: number,
  userExpectedReturn?: number
): RetirementMonteCarloParams {
  return {
    currentAge: 50,
    retirementAge: 65,
    lifeExpectancy: 85,
    currentRetirementAssets: 1000000,
    annualRetirementExpenses: 50000,
    annualGuaranteedIncome: 20000,
    expectedReturn: expectedReturn || 0.07,  // Portfolio-level expected return
    userExpectedReturn,  // User-specific override
    returnVolatility: returnVolatility || 0.12,
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

console.log('=== Testing User Return Input Connection ===\n');

// Test scenarios with different return assumptions
const scenarios = [
  { 
    name: 'Conservative (4% return, 8% volatility)',
    expectedReturn: 0.04,
    returnVolatility: 0.08,
    userExpectedReturn: undefined
  },
  { 
    name: 'Moderate (7% return, 12% volatility)',
    expectedReturn: 0.07,
    returnVolatility: 0.12,
    userExpectedReturn: undefined
  },
  { 
    name: 'Aggressive (10% return, 18% volatility)',
    expectedReturn: 0.10,
    returnVolatility: 0.18,
    userExpectedReturn: undefined
  },
  { 
    name: 'User Override (12% expected)',
    expectedReturn: 0.07,  // Base expectation
    returnVolatility: 0.15,
    userExpectedReturn: 0.12  // User believes in higher returns
  }
];

// Run multiple simulations for each scenario
const numSimulations = 100;
const results: Record<string, any> = {};

for (const scenario of scenarios) {
  console.log(`\nTesting: ${scenario.name}`);
  console.log(`  Expected Return: ${(scenario.expectedReturn * 100).toFixed(1)}%`);
  console.log(`  Volatility: ${(scenario.returnVolatility * 100).toFixed(1)}%`);
  if (scenario.userExpectedReturn) {
    console.log(`  User Override: ${(scenario.userExpectedReturn * 100).toFixed(1)}%`);
  }
  
  const scenarioResults = {
    successCount: 0,
    endingBalances: [] as number[],
    avgReturnRealized: 0,
    returnSamples: [] as number[]
  };
  
  for (let i = 0; i < numSimulations; i++) {
    const params = createTestParams(
      scenario.expectedReturn,
      scenario.returnVolatility,
      scenario.userExpectedReturn
    );
    
    const seed = 5000 + i;
    const result = runEnhancedRetirementScenario(params, undefined, [seed]);
    
    if (result.success) {
      scenarioResults.successCount++;
    }
    
    scenarioResults.endingBalances.push(result.endingBalance);
    
    // Sample returns from the first 10 years to check if they align with expectations
    for (let j = 0; j < Math.min(10, result.yearlyCashFlows.length); j++) {
      const flow = result.yearlyCashFlows[j];
      if (flow.investmentReturn !== undefined) {
        scenarioResults.returnSamples.push(flow.investmentReturn);
      }
    }
  }
  
  // Calculate average realized return
  if (scenarioResults.returnSamples.length > 0) {
    scenarioResults.avgReturnRealized = 
      scenarioResults.returnSamples.reduce((a, b) => a + b, 0) / scenarioResults.returnSamples.length;
  }
  
  results[scenario.name] = scenarioResults;
  
  // Calculate statistics
  const successRate = (scenarioResults.successCount / numSimulations * 100).toFixed(1);
  const avgEnding = scenarioResults.endingBalances.reduce((a, b) => a + b, 0) / numSimulations;
  const sortedBalances = [...scenarioResults.endingBalances].sort((a, b) => a - b);
  const p50 = sortedBalances[Math.floor(numSimulations * 0.50)];
  
  console.log(`\nResults:`);
  console.log(`  Success Rate: ${successRate}%`);
  console.log(`  Median Ending Balance: $${p50.toFixed(0)}`);
  console.log(`  Average Ending Balance: $${avgEnding.toFixed(0)}`);
  console.log(`  Average Realized Return: ${(scenarioResults.avgReturnRealized * 100).toFixed(2)}%`);
  
  // Check if realized returns are in the expected range
  const expectedMean = scenario.userExpectedReturn ? 
    (scenario.userExpectedReturn * 0.5 + scenario.expectedReturn * 0.5) : // 50/50 blend
    scenario.expectedReturn;
  
  const returnDiff = Math.abs(scenarioResults.avgReturnRealized - expectedMean);
  const withinExpectedRange = returnDiff < scenario.returnVolatility * 0.5; // Within half volatility
  
  console.log(`  Return Alignment: ${withinExpectedRange ? '✓ Within expected range' : '⚠ Outside expected range'}`);
}

console.log('\n=== Comparative Analysis ===\n');

// Compare success rates across scenarios
console.log('Success Rates by Scenario:');
for (const scenario of scenarios) {
  const successRate = (results[scenario.name].successCount / numSimulations * 100).toFixed(1);
  console.log(`  ${scenario.name}: ${successRate}%`);
}

// Verify that higher returns lead to better outcomes
const conservativeMedian = [...results['Conservative (4% return, 8% volatility)'].endingBalances]
  .sort((a, b) => a - b)[Math.floor(numSimulations * 0.5)];
const aggressiveMedian = [...results['Aggressive (10% return, 18% volatility)'].endingBalances]
  .sort((a, b) => a - b)[Math.floor(numSimulations * 0.5)];

console.log('\nReturn Impact Validation:');
console.log(`  Conservative Median: $${conservativeMedian.toFixed(0)}`);
console.log(`  Aggressive Median: $${aggressiveMedian.toFixed(0)}`);

if (aggressiveMedian > conservativeMedian) {
  console.log('  ✓ Higher expected returns produce higher median outcomes');
} else {
  console.log('  ⚠ Unexpected: Higher returns not producing better outcomes');
}

// Check user override impact
const baseResults = results['Moderate (7% return, 12% volatility)'];
const overrideResults = results['User Override (12% expected)'];

console.log('\nUser Override Impact:');
console.log(`  Base (7%) Success Rate: ${(baseResults.successCount / numSimulations * 100).toFixed(1)}%`);
console.log(`  Override (12%) Success Rate: ${(overrideResults.successCount / numSimulations * 100).toFixed(1)}%`);

const baseMedian = [...baseResults.endingBalances].sort((a, b) => a - b)[Math.floor(numSimulations * 0.5)];
const overrideMedian = [...overrideResults.endingBalances].sort((a, b) => a - b)[Math.floor(numSimulations * 0.5)];

console.log(`  Base Median Balance: $${baseMedian.toFixed(0)}`);
console.log(`  Override Median Balance: $${overrideMedian.toFixed(0)}`);

if (overrideMedian > baseMedian) {
  console.log('  ✓ User override is being incorporated (higher returns → better outcomes)');
} else {
  console.log('  ⚠ User override may not be properly incorporated');
}

console.log('\n========================================');
console.log('User Return Input Test Summary');
console.log('========================================');
console.log('Implementation uses a 50/50 blend between:');
console.log('  - Model-based returns (regime-aware, asset-specific)');
console.log('  - User-specified returns (when provided)');
console.log('\nThis approach balances:');
console.log('  - User preferences and beliefs');
console.log('  - Systematic market modeling');
console.log('  - Risk-adjusted expectations');