import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';

// Test if Monte Carlo simulation returns yearly cash flows
const testProfile = {
  dateOfBirth: '1980-01-01',
  currentRetirementAssets: 500000,
  assets: [
    { type: '401k', value: 400000, owner: 'user' },
    { type: 'ira', value: 100000, owner: 'user' },
    { type: 'brokerage', value: 50000, owner: 'user' },
    { type: 'cash', value: 20000, owner: 'user' }
  ],
  retirementContributions: { employee: 1000, employer: 500 },
  desiredRetirementAge: 65,
  socialSecurityBenefit: 2500,
  socialSecurityClaimAge: 67,
  expectedMonthlyExpensesRetirement: 8000,
  expectedRealReturn: 0.05,
  maritalStatus: 'married',
  spouseDateOfBirth: '1982-01-01',
  spouseRetirementContributions: { employee: 800, employer: 400 },
  spouseDesiredRetirementAge: 65,
  spouseSocialSecurityBenefit: 2000,
  spouseSocialSecurityClaimAge: 67,
  hasLongTermCareInsurance: false,
  partTimeIncomeRetirement: 0,
  spousePartTimeIncomeRetirement: 0,
  retirementState: 'FL',
  cashAndEquivalents: 50000,
  taxableInvestments: 200000,
  realEstate: 300000,
  otherAssets: 0,
  mortgage: 100000,
  otherDebts: 0
};

const params = profileToRetirementParams(testProfile);
console.log('Test Parameters:', params);

const result = runEnhancedMonteCarloSimulation(params, 100); // Run with fewer iterations for testing

console.log('\n=== MONTE CARLO RESULT ===');
console.log('Probability of Success:', result.probabilityOfSuccess + '%');
console.log('Has yearlyCashFlows:', !!result.yearlyCashFlows);
console.log('YearlyCashFlows length:', result.yearlyCashFlows?.length || 0);

if (result.yearlyCashFlows && result.yearlyCashFlows.length > 0) {
  console.log('\n=== SAMPLE CASH FLOWS (First 3 years) ===');
  result.yearlyCashFlows.slice(0, 3).forEach(cf => {
    console.log(`Year ${cf.year}:`);
    console.log('  Age:', cf.age);
    console.log('  Portfolio Balance:', cf.portfolioBalance);
    console.log('  Guaranteed Income:', cf.guaranteedIncome);
    console.log('  Withdrawal:', cf.withdrawal);
    console.log('  Net Cash Flow:', cf.netCashFlow);
    console.log('---');
  });
} else {
  console.log('NO YEARLY CASH FLOWS RETURNED!');
}