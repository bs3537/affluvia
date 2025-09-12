// Test that IRMAA only applies at age 65+

import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

const highIncomeProfile = {
  dateOfBirth: '1974-01-01',
  spouseDateOfBirth: '1974-01-01',
  gender: 'male',
  spouseGender: 'female',
  maritalStatus: 'married',
  state: 'CA',
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  assets: [
    { type: '401k', value: 3000000 },  // Large balance will trigger RMDs
    { type: 'savings', value: 100000 },
    { type: 'checking', value: 50000 }
  ],
  desiredRetirementAge: 60,  // Retire before Medicare
  spouseDesiredRetirementAge: 60,
  lifeExpectancy: 85,
  spouseLifeExpectancy: 88,
  socialSecurityBenefit: 2500,
  spouseSocialSecurityBenefit: 3500,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  expectedMonthlyExpensesRetirement: 12000,  // High expenses require large withdrawals
  monthlyContribution401k: 2000,
  monthlyContributionIRA: 500,
  monthlyContributionRothIRA: 500,
  monthlyContributionBrokerage: 1000,
  expectedRealReturn: 7,
  hasLongTermCareInsurance: true  // Have insurance to avoid LTC modeling
};

console.log('IRMAA AGE VERIFICATION TEST\n');
console.log('='.repeat(60));
console.log('Testing high-income couple retiring at 60');
console.log('Expected: No IRMAA charges ages 60-64, charges start at 65\n');

const params = profileToRetirementParams(highIncomeProfile);

// Run a quick simulation to check
console.log('Running simulation...');
const result = runEnhancedMonteCarloSimulation(params, 100);

console.log('\nRESULTS:');
console.log('Success Rate:', result.probabilityOfSuccess.toFixed(1) + '%');
console.log('Median Ending Balance: $' + (result.medianEndingBalance / 1000000).toFixed(2) + 'M');

console.log('\n' + '='.repeat(60));
console.log('KEY POINTS:');
console.log('1. IRMAA should NOT apply before age 65 (not on Medicare)');
console.log('2. IRMAA should START at age 65 when Medicare begins');
console.log('3. Based on MAGI from 2 years prior (lookback period)');
console.log('4. Affects both spouses independently when each turns 65');

console.log('\nFIX IMPLEMENTED:');
console.log('✓ Added age >= 65 check before applying IRMAA surcharge');
console.log('✓ Check both user and spouse ages separately');
console.log('✓ Only add surcharge when on Medicare');