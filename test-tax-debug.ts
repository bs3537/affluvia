/**
 * Debug tax calculation issue
 */

import { calculateEnhancedWithdrawal } from './server/monte-carlo-enhanced';
import { DeterministicRandom } from './server/deterministic-random';

console.log('=== Debugging Tax Calculation ===\n');

// Simple test case - Florida resident needing $100K after tax
const targetAfterTax = 100000;
const filingStatus = 'single';
const retirementState = 'FL';

const assetBuckets = {
  taxDeferred: 5000000,
  taxFree: 0,
  capitalGains: 0,
  cashEquivalents: 0,
  totalAssets: 5000000
};

console.log('Input:');
console.log(`  Target After Tax: $${targetAfterTax}`);
console.log(`  State: ${retirementState} (no state income tax)`);
console.log(`  Filing Status: ${filingStatus}`);

DeterministicRandom.enable(999);

const result = calculateEnhancedWithdrawal(
  targetAfterTax,
  assetBuckets,
  0, // totalSSBenefit
  70, // age
  undefined, // spouseAge
  retirementState,
  filingStatus,
  0, // taxablePensionIncome
  0, // earnedIncome
  undefined, // magiFor2YearLookback
  1954, // birthYear
  undefined, // spouseBirthYear
  false // useCache
);

DeterministicRandom.disable();

console.log('\nOutput:');
console.log(`  Gross Withdrawal: $${result.grossWithdrawal.toFixed(0)}`);
console.log(`  Federal Tax: $${result.federalTax.toFixed(0)}`);
console.log(`  State Tax: $${result.stateTax.toFixed(0)} (should be $0 for FL)`);
console.log(`  Capital Gains Tax: $${result.capitalGainsTax.toFixed(0)}`);
console.log(`  Total Tax: $${result.totalTaxes.toFixed(0)}`);
console.log(`  Net After Tax: $${result.netAfterTaxes.toFixed(0)}`);
console.log(`  Effective Tax Rate: ${(result.effectiveTaxRate * 100).toFixed(2)}%`);

// Verify federal tax calculation
const standardDeduction = 14600; // 2024 single filer
const taxableIncome = result.grossWithdrawal - standardDeduction;

console.log('\nFederal Tax Verification:');
console.log(`  Gross: $${result.grossWithdrawal.toFixed(0)}`);
console.log(`  - Standard Deduction: $${standardDeduction}`);
console.log(`  = Taxable Income: $${taxableIncome.toFixed(0)}`);

// Calculate expected federal tax
let expectedFederalTax = 0;
if (taxableIncome > 0) {
  // 2024 brackets for single
  expectedFederalTax += Math.min(taxableIncome, 11600) * 0.10;
  if (taxableIncome > 11600) {
    expectedFederalTax += Math.min(taxableIncome - 11600, 47150 - 11600) * 0.12;
  }
  if (taxableIncome > 47150) {
    expectedFederalTax += Math.min(taxableIncome - 47150, 100525 - 47150) * 0.22;
  }
  if (taxableIncome > 100525) {
    expectedFederalTax += Math.min(taxableIncome - 100525, 191950 - 100525) * 0.24;
  }
  if (taxableIncome > 191950) {
    expectedFederalTax += Math.min(taxableIncome - 191950, 243725 - 191950) * 0.32;
  }
}

console.log(`  Expected Federal Tax: $${expectedFederalTax.toFixed(0)}`);
console.log(`  Actual Federal Tax: $${result.federalTax.toFixed(0)}`);
console.log(`  Difference: $${Math.abs(expectedFederalTax - result.federalTax).toFixed(0)}`);

if (result.stateTax > 0) {
  console.log('\n❌ ERROR: Florida should have $0 state tax!');
} else {
  console.log('\n✅ State tax correctly calculated as $0 for Florida');
}