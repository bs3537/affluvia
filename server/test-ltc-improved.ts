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

console.log('IMPROVED LTC MODELING TEST\n');
console.log('='.repeat(60));

// Test WITHOUT LTC insurance (LTC costs will be modeled)
console.log('SCENARIO 1: NO LTC Insurance (LTC costs modeled)');
const paramsNoInsurance = profileToRetirementParams(testProfile);
console.log('Has LTC Insurance:', paramsNoInsurance.hasLongTermCareInsurance || false);
const resultNoInsurance = runEnhancedMonteCarloSimulation(paramsNoInsurance, 1000);
console.log('Success Rate:', resultNoInsurance.probabilityOfSuccess.toFixed(1) + '%');
console.log('Median Ending Balance: $' + (resultNoInsurance.medianEndingBalance / 1000000).toFixed(2) + 'M\n');

// Test WITH LTC insurance (no LTC costs modeled)
console.log('SCENARIO 2: WITH LTC Insurance (no LTC costs)');
const profileWithInsurance = { ...testProfile, hasLongTermCareInsurance: true };
const paramsWithInsurance = profileToRetirementParams(profileWithInsurance);
console.log('Has LTC Insurance:', paramsWithInsurance.hasLongTermCareInsurance);
const resultWithInsurance = runEnhancedMonteCarloSimulation(paramsWithInsurance, 1000);
console.log('Success Rate:', resultWithInsurance.probabilityOfSuccess.toFixed(1) + '%');
console.log('Median Ending Balance: $' + (resultWithInsurance.medianEndingBalance / 1000000).toFixed(2) + 'M\n');

console.log('='.repeat(60));
console.log('KEY CHANGES:');
console.log('1. LTC only modeled if NO insurance (Step 11 of intake)');
console.log('2. Reduced probability: 50% base (was 70%)');
console.log('3. Variable duration: 0.5-3 years (was fixed 2 years)');
console.log('4. Variable onset: After age 75 (was always last 2 years)');
console.log('\nIMPACT:');
const improvement = resultWithInsurance.probabilityOfSuccess - resultNoInsurance.probabilityOfSuccess;
console.log('Success rate difference: ' + improvement.toFixed(1) + ' percentage points');
console.log('Having LTC insurance improves success by avoiding cost modeling');