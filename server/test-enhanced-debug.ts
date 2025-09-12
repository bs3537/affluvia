import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedRetirementScenario } from './monte-carlo-enhanced';

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

const params = profileToRetirementParams(testProfile);

console.log('Testing Enhanced Retirement Scenario');
console.log('Annual Savings from params:', params.annualSavings);

// Run a single scenario to debug
const result = runEnhancedRetirementScenario(params);

console.log('\nScenario Results:');
console.log('Success:', result.success);
console.log('Ending Balance:', result.endingBalance);
console.log('Years Until Depletion:', result.yearsUntilDepletion);

// Check accumulation phase
const retirementYearCashFlow = result.yearlyCashFlows.find(cf => cf.age === 65);
console.log('\nPortfolio at retirement (age 65):');
console.log('Portfolio Balance:', retirementYearCashFlow?.portfolioBalance);

// Check first few years
console.log('\nFirst 5 years of accumulation:');
result.yearlyCashFlows.slice(0, 5).forEach(cf => {
  console.log(`Age ${cf.age}: Portfolio = $${cf.portfolioBalance.toFixed(0)}, Withdrawal = $${cf.withdrawal.toFixed(0)}`);
});