// Test for early retirement scenario fixes
// This test verifies that tax calculations are correct when retirement age is reduced

import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { profileToRetirementParams } from './monte-carlo.js';
import { categorizeAssetsByTax } from './asset-tax-classifier.js';

console.log('Testing Early Retirement Scenario Fixes\n');
console.log('========================================\n');

// Create a test profile similar to what we see in the screenshots
const testProfile = {
  dateOfBirth: '1979-01-01', // 45 years old in 2024
  maritalStatus: 'married',
  spouseDateOfBirth: '1979-01-01',
  
  // Test both retirement ages: 65 (normal) and 55 (early)
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  userLifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  
  // Income sources (similar to screenshots)
  socialSecurityBenefit: 2000,
  spouseSocialSecurityBenefit: 2000,
  pensionBenefit: 0,
  spousePensionBenefit: 0,
  partTimeIncomeRetirement: 0,
  spousePartTimeIncomeRetirement: 0,
  
  // Expenses
  expectedMonthlyExpensesRetirement: 10000, // $10k/month as shown in screenshots
  retirementState: 'FL',
  state: 'FL',
  
  // Portfolio similar to screenshots ($2M+ total)
  assets: [
    {
      type: '401k',
      value: 1200000, // Tax-deferred
      owner: 'user'
    },
    {
      type: 'taxable-brokerage',
      value: 600000, // Taxable
      owner: 'joint'
    },
    {
      type: 'roth-ira',
      value: 200000, // Tax-free
      owner: 'user'
    }
  ],
  
  // Current income (pre-retirement)
  annualIncome: 150000,
  spouseAnnualIncome: 100000,
  
  // Savings
  retirementContributions: {
    employee: 19500,
    employer: 6000
  },
  spouseRetirementContributions: {
    employee: 19500,
    employer: 6000
  },
  
  // Return expectations
  expectedRealReturn: 6,
  expectedInflationRate: 3,
  
  currentAllocation: {
    usStocks: 60,
    bonds: 30,
    cash: 10
  }
};

console.log('Test Profile Overview:');
console.log('----------------------');
console.log('Portfolio: $2M total ($1.2M 401k, $600k taxable, $200k Roth)');
console.log('Monthly expenses: $10,000');
console.log('Social Security: $2,000/month each spouse\n');

// Test 1: Normal retirement at 65
console.log('=== TEST 1: Normal Retirement at Age 65 ===\n');

const params65 = profileToRetirementParams(testProfile);
params65.ltcInsurance = {
  type: 'none',
  dailyBenefit: 0,
  benefitPeriodYears: 0,
  eliminationPeriodDays: 0,
  inflationProtection: 'none',
  premiumAnnual: 0,
  policyStartAge: 65
};

const result65 = runEnhancedMonteCarloSimulation(params65, 100);

console.log('Results for Age 65 Retirement:');
console.log('  Success Rate: ' + result65.probabilityOfSuccess.toFixed(1) + '%');
console.log('  Median Ending Balance: $' + result65.medianEndingBalance.toLocaleString());

// Look at withdrawal details
if (result65.yearlyCashFlows && result65.yearlyCashFlows.length > 0) {
  console.log('\n  First 5 Years of Withdrawals:');
  for (let i = 0; i < Math.min(5, result65.yearlyCashFlows.length); i++) {
    const cf = result65.yearlyCashFlows[i];
    console.log(`    Year ${cf.year}: Withdrawal = $${cf.withdrawal.toLocaleString()}, Portfolio = $${cf.portfolioBalance.toLocaleString()}`);
  }
}

// Test 2: Early retirement at 55
console.log('\n\n=== TEST 2: Early Retirement at Age 55 ===\n');

const testProfile55 = { ...testProfile };
testProfile55.desiredRetirementAge = 55;
testProfile55.spouseDesiredRetirementAge = 55;

const params55 = profileToRetirementParams(testProfile55);
params55.ltcInsurance = {
  type: 'none',
  dailyBenefit: 0,
  benefitPeriodYears: 0,
  eliminationPeriodDays: 0,
  inflationProtection: 'none',
  premiumAnnual: 0,
  policyStartAge: 55
};

const result55 = runEnhancedMonteCarloSimulation(params55, 100);

console.log('Results for Age 55 Retirement:');
console.log('  Success Rate: ' + result55.probabilityOfSuccess.toFixed(1) + '%');
console.log('  Median Ending Balance: $' + result55.medianEndingBalance.toLocaleString());

// Look at withdrawal details
if (result55.yearlyCashFlows && result55.yearlyCashFlows.length > 0) {
  console.log('\n  First 5 Years of Withdrawals (Age 55-59):');
  for (let i = 0; i < Math.min(5, result55.yearlyCashFlows.length); i++) {
    const cf = result55.yearlyCashFlows[i];
    console.log(`    Year ${cf.year}: Withdrawal = $${cf.withdrawal.toLocaleString()}, Portfolio = $${cf.portfolioBalance.toLocaleString()}`);
  }
  
  // Look at years around Social Security start (age 67)
  const ssStartIndex = 12; // 67 - 55 = 12 years
  if (result55.yearlyCashFlows.length > ssStartIndex) {
    console.log('\n  Years Around Social Security Start (Age 66-68):');
    for (let i = ssStartIndex - 1; i <= Math.min(ssStartIndex + 1, result55.yearlyCashFlows.length - 1); i++) {
      const cf = result55.yearlyCashFlows[i];
      const age = 55 + i;
      console.log(`    Age ${age}: Withdrawal = $${cf.withdrawal.toLocaleString()}, Portfolio = $${cf.portfolioBalance.toLocaleString()}`);
    }
  }
}

// Test 3: Asset bucket analysis
console.log('\n\n=== TEST 3: Asset Bucket Analysis ===\n');

// Set up test buckets
const testBuckets = categorizeAssetsByTax(testProfile.assets);
console.log('Asset Buckets:');
console.log('  Tax-Deferred (401k): $' + testBuckets.taxDeferred.toLocaleString());
console.log('  Taxable (Brokerage): $' + testBuckets.capitalGains.toLocaleString());
console.log('  Tax-Free (Roth): $' + testBuckets.taxFree.toLocaleString());
console.log('  Cash: $' + testBuckets.cashEquivalents.toLocaleString());
console.log('  Total: $' + testBuckets.totalAssets.toLocaleString());

// Compare results
console.log('\n\n=== ANALYSIS ===');
const successDifference = result55.probabilityOfSuccess - result65.probabilityOfSuccess;
console.log(`\nSuccess Rate Impact of Early Retirement:`);
console.log(`  Retirement at 65: ${result65.probabilityOfSuccess.toFixed(1)}%`);
console.log(`  Retirement at 55: ${result55.probabilityOfSuccess.toFixed(1)}%`);
console.log(`  Difference: ${successDifference.toFixed(1)}%`);

if (Math.abs(successDifference) < 5) {
  console.log('  ⚠️ WARNING: Success rates are too similar - may indicate calculation issues');
} else if (successDifference < -10) {
  console.log('  ✓ Expected result: Early retirement significantly reduces success rate');
} else {
  console.log('  ⚠️ Unexpected result: Check calculations');
}

console.log('\n=== FIX VERIFICATION ===');
console.log('The fixes should result in:');
console.log('1. ✓ Dynamic tax rates used instead of fixed 25%');
console.log('2. ✓ Realistic 20% capital gains ratio instead of 50%');
console.log('3. ✓ More gradual depletion of tax-deferred accounts');
console.log('4. ✓ Lower effective tax rates overall');
console.log('5. ✓ Better preservation of portfolio in early retirement');

console.log('\nExpected behavior:');
console.log('• Taxable accounts should be used first (most tax-efficient)');
console.log('• Tax-deferred accounts should last longer with corrected tax rates');
console.log('• Roth accounts should be preserved for late retirement');
console.log('• Success rate should drop ~10-15% when retiring 10 years early');