/**
 * Debug bucket calculations
 */

import { runEnhancedRetirementScenario } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

function createTestParams(): RetirementMonteCarloParams {
  const params: RetirementMonteCarloParams = {
    currentAge: 50,
    retirementAge: 65,
    lifeExpectancy: 85,
    currentRetirementAssets: 500000,
    annualRetirementExpenses: 60000,
    annualGuaranteedIncome: 0,
    expectedReturn: 0.07,
    returnVolatility: 0,  // Zero volatility for deterministic test
    inflationRate: 0,     // Zero inflation for simplicity
    stockAllocation: 0.6,
    bondAllocation: 0.3,
    cashAllocation: 0.1,
    withdrawalRate: 0.04,
    useGuardrails: false,
    taxRate: 0.22,
    filingStatus: 'single',
    retirementState: 'FL',
    assetBuckets: {
      taxDeferred: 300000,
      taxFree: 100000,
      capitalGains: 100000,
      cashEquivalents: 0,
      totalAssets: 500000
    },
    annualSavings: 10000,  // Add some savings
    monthlyContribution401k: 0,
    monthlyContributionIRA: 0,
    monthlyContributionRothIRA: 0,
    monthlyContributionBrokerage: 0
  };
  
  return params;
}

console.log('=== Testing Bucket Calculations ===\n');

const params = createTestParams();
console.log('Initial Buckets:');
console.log('  Tax Deferred:', params.assetBuckets.taxDeferred);
console.log('  Tax Free:', params.assetBuckets.taxFree);
console.log('  Capital Gains:', params.assetBuckets.capitalGains);
console.log('  Cash:', params.assetBuckets.cashEquivalents);
console.log('  Total:', params.assetBuckets.totalAssets);
console.log();

// Simple calculation test
const testReturn = 0.07;
console.log('Test Return:', testReturn);
console.log('Expected Values After Return:');
console.log('  Tax Deferred:', 300000 * (1 + testReturn));
console.log('  Tax Free:', 100000 * (1 + testReturn));
console.log('  Capital Gains:', 100000 * (1 + testReturn));
console.log('  Total:', 500000 * (1 + testReturn));
console.log();

// Run scenario with fixed seed
const result = runEnhancedRetirementScenario(params, undefined, [12345]);

console.log('Actual Result:');
console.log('  Success:', result.success);
console.log('  Ending Balance:', result.endingBalance);

if (result.yearlyCashFlows.length > 0) {
  const firstYear = result.yearlyCashFlows[0];
  console.log('\nFirst Year Cash Flow:');
  console.log('  Portfolio Balance:', firstYear.portfolioBalance);
  console.log('  Investment Return:', firstYear.investmentReturn);
  
  // Calculate what the balance should be
  const expectedBalance = 500000 * (1 + (firstYear.investmentReturn || 0)) + 10000;
  console.log('  Expected Balance (simple calc):', expectedBalance);
}

// Check for undefined values
console.log('\nChecking for undefined values in params:');
const checkUndefined = (obj: any, path: string = '') => {
  for (const key in obj) {
    const fullPath = path ? `${path}.${key}` : key;
    if (obj[key] === undefined) {
      console.log(`  UNDEFINED: ${fullPath}`);
    } else if (obj[key] === null) {
      console.log(`  NULL: ${fullPath}`);
    } else if (typeof obj[key] === 'number' && isNaN(obj[key])) {
      console.log(`  NaN: ${fullPath} = ${obj[key]}`);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      checkUndefined(obj[key], fullPath);
    }
  }
};

checkUndefined(params);