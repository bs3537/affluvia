import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

// Test user: Couple, both age 50
// Income: $60k man, $450k woman  
// Savings: $400k in 401k, $120k cash life insurance, $32k savings, $50k checking
// Monthly contributions: $3000/month ($36k/year)

const testProfile = {
  // Basic info
  dateOfBirth: '1974-01-01',
  spouseDateOfBirth: '1974-01-01',
  gender: 'male',
  spouseGender: 'female',
  maritalStatus: 'married',
  state: 'CA',
  
  // Income
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  
  // Assets
  assets: [
    { type: '401k', value: 400000 },
    { type: 'savings', value: 32000 },
    { type: 'checking', value: 50000 },
    { type: 'other', value: 120000 } // Cash life insurance
  ],
  
  // Retirement plans
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  lifeExpectancy: 85,
  spouseLifeExpectancy: 88,
  
  // Social Security
  socialSecurityBenefit: 2000,
  spouseSocialSecurityBenefit: 3200,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  
  // Expenses
  expectedMonthlyExpensesRetirement: 8000,
  
  // Savings contributions - THIS IS THE KEY PART
  monthlyContribution401k: 1500,
  monthlyContributionIRA: 500,
  monthlyContributionRothIRA: 500,
  monthlyContributionBrokerage: 500,
  
  // Investment strategy
  expectedRealReturn: 7, // 7% return
  
  // Housing
  primaryResidence: {
    marketValue: 800000,
    mortgageBalance: 300000,
    monthlyPayment: 3500,
    yearsToPayOffMortgage: 17
  },
  
  // Other liabilities
  liabilities: []
};

console.log('\n' + '='.repeat(80));
console.log('TESTING ENHANCED MONTE CARLO WITH FIX');
console.log('='.repeat(80));

// Convert profile to parameters using the FIXED function
const params = profileToRetirementParams(testProfile);

console.log('\nKey Parameters:');
console.log('- Annual Savings:', params.annualSavings);
console.log('- Monthly Contributions Total:', 
  (testProfile.monthlyContribution401k + 
   testProfile.monthlyContributionIRA + 
   testProfile.monthlyContributionRothIRA + 
   testProfile.monthlyContributionBrokerage) + '/month');
console.log('- Expected Annual Savings: $36,000');

// Run ENHANCED Monte Carlo simulation (what the dashboard uses)
console.log('\nRunning Enhanced Monte Carlo Simulation...');
const result = runEnhancedMonteCarloSimulation(params, 1000);

console.log('\n' + '='.repeat(80));
console.log('RESULTS:');
console.log('='.repeat(80));
console.log('Retirement Confidence Score:', result.probabilityOfSuccess.toFixed(1) + '%');
console.log('Median Ending Balance:', '$' + (result.medianEndingBalance / 1000000).toFixed(2) + 'M');
console.log('10th Percentile:', '$' + (result.percentile10EndingBalance / 1000000).toFixed(2) + 'M');
console.log('90th Percentile:', '$' + (result.percentile90EndingBalance / 1000000).toFixed(2) + 'M');

console.log('\n' + '='.repeat(80));
console.log('VERIFICATION:');
console.log('='.repeat(80));
if (params.annualSavings === 36000) {
  console.log('✅ SUCCESS: Annual savings correctly calculated as $36,000');
  console.log('✅ The fix is working for the Enhanced Monte Carlo simulation');
} else {
  console.log('❌ FAILURE: Annual savings is', params.annualSavings, 'instead of $36,000');
  console.log('❌ The fix needs to be applied');
}

console.log('\nExpected retirement confidence: ~80% (with $36k annual savings)');
console.log('Actual retirement confidence:', result.probabilityOfSuccess.toFixed(1) + '%');