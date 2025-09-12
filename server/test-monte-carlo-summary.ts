// Summary comparison of Monte Carlo implementations

import { runRetirementMonteCarloSimulation } from './monte-carlo-base';
import { runFixedMonteCarloSimulation } from './monte-carlo-deprecated';
import { AssetBuckets } from './asset-tax-classifier';

// Test parameters based on Bhavneesh Sharma's data
const testParams = {
  currentAge: 50,
  spouseAge: 50,
  retirementAge: 65,
  spouseRetirementAge: 65,
  lifeExpectancy: 85,
  spouseLifeExpectancy: 85,
  currentRetirementAssets: 572000, // 401k + brokerage + cash
  annualGuaranteedIncome: 67393, // Calculated SS benefits
  annualRetirementExpenses: 96000,
  annualHealthcareCosts: 13000,
  healthcareInflationRate: 0.05,
  expectedReturn: 0.06,
  returnVolatility: 0.15,
  inflationRate: 0.03,
  stockAllocation: 0.60,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  useGlidePath: true,
  withdrawalRate: 0.04,
  useGuardrails: true,
  taxRate: 0.25,
  annualSavings: 31000,
  legacyGoal: 100000,
  hasLongTermCareInsurance: false,
  assetBuckets: {
    taxDeferred: 400000,
    taxFree: 0,
    capitalGains: 90000,
    cashEquivalents: 82000,
    totalAssets: 572000
  } as AssetBuckets
};

console.log('=== MONTE CARLO COMPARISON SUMMARY ===\n');
console.log('Test Profile: High-income couple, age 50, retiring at 65');
console.log('Assets: $572k | Annual Savings: $31k | SS Income: $67k');
console.log('Expenses: $96k/year | Healthcare: $13k/year\n');

// Suppress debug output
const originalLog = console.log;
console.log = () => {};

// Run original Monte Carlo
const originalResult = runRetirementMonteCarloSimulation(testParams, 1000);

// Run fixed Monte Carlo
const fixedResult = runFixedMonteCarloSimulation(testParams, 1000);

// Restore console.log
console.log = originalLog;

console.log('ORIGINAL MONTE CARLO:');
console.log(`Success Probability: ${originalResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${originalResult.medianEndingBalance.toLocaleString()}`);
console.log(`Safe Withdrawal Rate: ${(originalResult.safeWithdrawalRate * 100).toFixed(2)}%`);

console.log('\nFIXED MONTE CARLO (with proper tax modeling):');
console.log(`Success Probability: ${fixedResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${fixedResult.medianEndingBalance.toLocaleString()}`);
console.log(`Safe Withdrawal Rate: ${(fixedResult.safeWithdrawalRate * 100).toFixed(2)}%`);

console.log('\nTAX ANALYSIS:');
console.log(`Average Effective Tax Rate: ${(fixedResult.taxAnalysis.averageEffectiveTaxRate * 100).toFixed(1)}%`);
console.log(`Scenarios with IRMAA Surcharges: ${fixedResult.taxAnalysis.percentWithIRMAA.toFixed(1)}%`);

console.log('\nKEY DIFFERENCES:');
console.log(`Success Rate Delta: ${(originalResult.probabilityOfSuccess - fixedResult.probabilityOfSuccess).toFixed(1)} percentage points`);
console.log(`The fixed simulation accounts for:`);
console.log('- Social Security taxation (up to 85% taxable)');
console.log('- IRMAA Medicare surcharges');
console.log('- Required Minimum Distributions');
console.log('- Market regime switching');
console.log('- Higher healthcare inflation');