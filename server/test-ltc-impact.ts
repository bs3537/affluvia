import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

const testProfile = {
  dateOfBirth: '1974-01-01',
  spouseDateOfBirth: '1974-01-01',
  gender: 'male',
  spouseGender: 'female',
  maritalStatus: 'married',
  state: 'CA',
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  assets: [
    { type: '401k', value: 400000 },
    { type: 'savings', value: 32000 },
    { type: 'checking', value: 50000 },
    { type: 'other', value: 120000 }
  ],
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  lifeExpectancy: 85,
  spouseLifeExpectancy: 88,
  socialSecurityBenefit: 2000,
  spouseSocialSecurityBenefit: 3200,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  expectedMonthlyExpensesRetirement: 8000,
  monthlyContribution401k: 1500,
  monthlyContributionIRA: 500,
  monthlyContributionRothIRA: 500,
  monthlyContributionBrokerage: 500,
  expectedRealReturn: 7
};

console.log('Testing LTC Impact on Success Rate\n');
console.log('='.repeat(50));

// Test WITHOUT LTC insurance
const paramsNoLTC = profileToRetirementParams(testProfile);
console.log('\nWITHOUT Long-Term Care Insurance:');
const resultNoLTC = runEnhancedMonteCarloSimulation(paramsNoLTC, 1000);
console.log('Success Rate:', resultNoLTC.probabilityOfSuccess.toFixed(1) + '%');

// Test WITH LTC insurance
const profileWithLTC = { ...testProfile, hasLongTermCareInsurance: true };
const paramsWithLTC = profileToRetirementParams(profileWithLTC);
console.log('\nWITH Long-Term Care Insurance:');
const resultWithLTC = runEnhancedMonteCarloSimulation(paramsWithLTC, 1000);
console.log('Success Rate:', resultWithLTC.probabilityOfSuccess.toFixed(1) + '%');

console.log('\n' + '='.repeat(50));
console.log('Difference:', (resultWithLTC.probabilityOfSuccess - resultNoLTC.probabilityOfSuccess).toFixed(1) + ' percentage points');