// Test script to verify state capture for Monte Carlo calculations
import { profileToRetirementParams } from './monte-carlo.js';
import { calculateCombinedTaxRate } from './tax-calculator.js';

// Test profile with different states
const testProfile = {
  // Basic info
  dateOfBirth: '1969-01-01', // 55 years old
  maritalStatus: 'married',
  annualIncome: 100000,
  spouseAnnualIncome: 50000,
  
  // State information
  state: 'CA',              // Current residence - high tax state
  retirementState: 'FL',    // Retirement state - no tax state
  
  // Retirement info
  expectedMonthlyExpensesRetirement: 6000,
  socialSecurityBenefit: 2000,
  spouseSocialSecurityBenefit: 1500,
  desiredRetirementAge: 65,
  userLifeExpectancy: 90,
  
  // Assets
  assets: [
    { type: '401k', value: 500000, owner: 'user' },
    { type: 'taxable-brokerage', value: 200000, owner: 'joint' }
  ]
};

console.log('=== STATE CAPTURE TEST ===\n');
console.log('Profile States:');
console.log(`- Current Residence: ${testProfile.state}`);
console.log(`- Retirement State: ${testProfile.retirementState}\n`);

// Test tax calculation with current state
const currentStateTax = calculateCombinedTaxRate(
  150000, // Combined income
  testProfile.state,
  'married',
  false, // Not retired
  55
);

console.log('\nCurrent State Tax (California):');
console.log(`- Combined Tax Rate: ${(currentStateTax * 100).toFixed(1)}%`);
console.log(`- Annual Tax: $${(150000 * currentStateTax).toFixed(0)}`);

// Test tax calculation with retirement state
const retirementStateTax = calculateCombinedTaxRate(
  72000, // Retirement income (expenses)
  testProfile.retirementState,
  'married',
  true, // Retired
  65
);

console.log('\nRetirement State Tax (Florida):');
console.log(`- Combined Tax Rate: ${(retirementStateTax * 100).toFixed(1)}%`);
console.log(`- Annual Tax: $${(72000 * retirementStateTax).toFixed(0)}`);

// Convert to Monte Carlo params
console.log('\n=== MONTE CARLO PARAMETERS ===');
const mcParams = profileToRetirementParams(testProfile);

console.log('\nKey Parameters:');
console.log(`- Tax Rate Used: ${(mcParams.taxRate * 100).toFixed(1)}%`);
console.log(`- Retirement State: ${mcParams.retirementState || 'Not captured'}`);
console.log(`- Annual Retirement Expenses: $${mcParams.annualRetirementExpenses.toFixed(0)}`);
console.log(`- Annual Guaranteed Income: $${mcParams.annualGuaranteedIncome.toFixed(0)}`);

console.log('\n=== ANALYSIS ===');
console.log('The Monte Carlo simulation should use:');
console.log(`1. Retirement state (${testProfile.retirementState}) for tax calculations`);
console.log(`2. Lower tax rate (${(retirementStateTax * 100).toFixed(1)}%) vs current (${(currentStateTax * 100).toFixed(1)}%)`);
console.log('3. This affects the net amount available for spending');

const taxSavings = (currentStateTax - retirementStateTax) * 72000;
console.log(`\nAnnual tax savings by retiring to ${testProfile.retirementState}: $${taxSavings.toFixed(0)}`);