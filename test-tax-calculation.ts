/**
 * Test tax calculation at 24% bracket boundary
 */

import { calculateEnhancedWithdrawal } from './server/monte-carlo-enhanced';
import { DeterministicRandom } from './server/deterministic-random';

console.log('=== Testing Tax Calculation at 24% Bracket ===\n');

// 2024 tax brackets for single filer
const brackets = {
  '10%': { min: 0, max: 11600 },
  '12%': { min: 11600, max: 47150 },
  '22%': { min: 47150, max: 100525 },
  '24%': { min: 100525, max: 191950 },
  '32%': { min: 191950, max: 243725 },
  '35%': { min: 243725, max: 609350 },
  '37%': { min: 609350, max: Infinity }
};

// Test case: Need $182,975 after-tax (at 24% bracket boundary)
const targetAfterTax = 182975;
const filingStatus = 'single';
const retirementState = 'FL';

// Standard deduction for 2024
const standardDeduction = 14600;

// Calculate expected gross income needed
// At 24% bracket boundary ($191,950 taxable income)
const taxableIncome = 191950;
const grossIncome = taxableIncome + standardDeduction; // $206,550

// Calculate expected tax
let expectedTax = 0;
expectedTax += (11600 - 0) * 0.10;           // $1,160
expectedTax += (47150 - 11600) * 0.12;       // $4,266
expectedTax += (100525 - 47150) * 0.22;      // $11,742.50
expectedTax += (191950 - 100525) * 0.24;     // $21,942

const totalExpectedTax = expectedTax;
const expectedNetIncome = grossIncome - totalExpectedTax;

console.log('Expected Calculation:');
console.log(`  Gross Income Needed: $${grossIncome.toFixed(0)}`);
console.log(`  - Standard Deduction: $${standardDeduction.toFixed(0)}`);
console.log(`  = Taxable Income: $${taxableIncome.toFixed(0)}`);
console.log(`  Expected Tax: $${totalExpectedTax.toFixed(0)}`);
console.log(`  Expected Net: $${expectedNetIncome.toFixed(0)}`);
console.log(`  Target After-Tax: $${targetAfterTax.toFixed(0)}`);

// Now test the actual calculation
const assetBuckets = {
  taxDeferred: 5000000, // Large balance to support withdrawal
  taxFree: 0,
  capitalGains: 0,
  cashEquivalents: 0,
  totalAssets: 5000000
};

DeterministicRandom.enable(999);

// Call the function
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

console.log('\nActual Calculation:');
console.log(`  Net Needed: $${targetAfterTax.toFixed(0)}`);
console.log(`  Gross Withdrawal: $${result.grossWithdrawal.toFixed(0)}`);
console.log(`  Federal Tax: $${result.federalTax.toFixed(0)}`);
console.log(`  State Tax: $${result.stateTax.toFixed(0)}`);
console.log(`  Total Tax: $${result.totalTaxes.toFixed(0)}`);
console.log(`  Net After Tax: $${result.netAfterTaxes.toFixed(0)}`);

// Check if it matches
const actualNet = result.netAfterTaxes;
const difference = Math.abs(actualNet - targetAfterTax);
const percentError = (difference / targetAfterTax) * 100;

console.log('\nValidation:');
console.log(`  Difference: $${difference.toFixed(0)} (${percentError.toFixed(2)}% error)`);

if (percentError > 1) {
  console.log('  ❌ Tax calculation is inaccurate at 24% bracket');
  console.log('\nDetailed Analysis:');
  console.log(`  Gross withdrawal of $${result.grossWithdrawal.toFixed(0)} suggests:`);
  const impliedTaxableIncome = result.grossWithdrawal - standardDeduction;
  console.log(`  Implied taxable income: $${impliedTaxableIncome.toFixed(0)}`);
  
  // Recalculate what the tax should be
  let recalcTax = 0;
  let remaining = impliedTaxableIncome;
  
  if (remaining > 0) {
    const in10 = Math.min(remaining, 11600);
    recalcTax += in10 * 0.10;
    remaining -= in10;
  }
  
  if (remaining > 0) {
    const in12 = Math.min(remaining, 47150 - 11600);
    recalcTax += in12 * 0.12;
    remaining -= in12;
  }
  
  if (remaining > 0) {
    const in22 = Math.min(remaining, 100525 - 47150);
    recalcTax += in22 * 0.22;
    remaining -= in22;
  }
  
  if (remaining > 0) {
    const in24 = Math.min(remaining, 191950 - 100525);
    recalcTax += in24 * 0.24;
    remaining -= in24;
  }
  
  if (remaining > 0) {
    const in32 = Math.min(remaining, 243725 - 191950);
    recalcTax += in32 * 0.32;
    remaining -= in32;
  }
  
  console.log(`  Recalculated tax should be: $${recalcTax.toFixed(0)}`);
  console.log(`  Function returned tax: $${result.federalTax.toFixed(0)}`);
  console.log(`  Tax calculation error: $${Math.abs(recalcTax - result.federalTax).toFixed(0)}`);
} else {
  console.log('  ✅ Tax calculation is accurate at 24% bracket');
}