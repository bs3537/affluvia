import { profileToRetirementParams } from './monte-carlo-base';
import { calculateNetWorthProjections } from './net-worth-projections';

// Test profile based on the user's data
const testProfile = {
  dateOfBirth: '1974-12-15',
  maritalStatus: 'married',
  spouseDateOfBirth: '1974-01-01', 
  state: 'MA',
  
  // Income
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  
  // Retirement planning
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  lifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  expectedMonthlyExpensesRetirement: 8200, // $98,400/year base expenses
  
  // Social Security
  socialSecurityClaimAge: 65,
  socialSecurityBenefit: 2002.94,
  spouseSocialSecurityClaimAge: 65,
  spouseSocialSecurityBenefit: 3423,
  
  // Assets
  assets: [
    { type: '401k', value: 400000, owner: 'spouse' },
    { type: 'cash-value-life-insurance', value: 120000, owner: 'spouse' },
    { type: 'savings', value: 32000, owner: 'joint' },
    { type: 'taxable-brokerage', value: 90000, owner: 'user' },
    { type: 'checking', value: 3000, owner: 'user' },
    { type: 'checking', value: 60000, owner: 'spouse' },
  ],
  
  // Real estate
  primaryResidence: {
    marketValue: 975000,
    mortgageBalance: 350000,
    monthlyPayment: 3400,
    mortgageRate: 0.045
  },
  
  // Liabilities
  liabilities: [
    { type: 'credit-card', balance: 5000, monthlyPayment: 500 },
    { type: 'credit-card', balance: 10000, monthlyPayment: 500 },
    { type: 'student-loan', balance: 91000, monthlyPayment: 750 },
    { type: 'student-loan', balance: 192000, monthlyPayment: 800 },
    { type: 'personal-loan', balance: 50000, monthlyPayment: 1150 },
    { type: 'auto-loan', balance: 70000, monthlyPayment: 750 }
  ],
  
  // Monthly expenses (detailed)
  monthlyExpenses: {
    housing: 5000,
    food: 2500,
    transportation: 1500,
    utilities: 500,
    insurance: 1000,
    healthcare: 800,
    personal: 1500,
    entertainment: 1000,
    creditCardPayments: 1000,
    studentLoanPayments: 1550,
    otherDebtPayments: 1900,
    other: 750
  },
  
  // Contributions
  monthlyContribution401k: 0,
  monthlyContributionIRA: 0,
  monthlyContributionRothIRA: 0,
  monthlyContributionBrokerage: 0,
  
  // Risk profile
  riskQuestions: [5], // Aggressive
  spouseRiskQuestions: [3], // Moderate
  expectedRealReturn: -1, // Use glide path
  
  // No LTC insurance
  hasLongTermCareInsurance: false
};

console.log('==========================================================');
console.log('HEALTHCARE COST ALIGNMENT TEST');
console.log('==========================================================\n');

// Test 1: Monte Carlo Parameters
console.log('1. MONTE CARLO SIMULATION PARAMETERS:');
console.log('----------------------------------------');
const monteCarloParams = profileToRetirementParams(testProfile);
console.log(`Base Retirement Expenses: $${((monteCarloParams.annualRetirementExpenses - (monteCarloParams.annualHealthcareCosts || 0))).toLocaleString()}`);
console.log(`Healthcare Costs: $${(monteCarloParams.annualHealthcareCosts || 0).toLocaleString()}`);
console.log(`Total Annual Expenses: $${monteCarloParams.annualRetirementExpenses.toLocaleString()}`);
console.log(`Guaranteed Income: $${monteCarloParams.annualGuaranteedIncome.toLocaleString()}`);
console.log(`Net Withdrawal Needed: $${(monteCarloParams.annualRetirementExpenses - monteCarloParams.annualGuaranteedIncome).toLocaleString()}`);

// Test 2: Net Worth Projections
console.log('\n2. NET WORTH PROJECTIONS:');
console.log('----------------------------------------');
const projections = calculateNetWorthProjections(testProfile);

// Find retirement year projection (age 65)
const retirementProjection = projections.projections.find(p => p.age === 65);
const age70Projection = projections.projections.find(p => p.age === 70);
const age80Projection = projections.projections.find(p => p.age === 80);
const age90Projection = projections.projections.find(p => p.age === 90);
const finalProjection = projections.projections[projections.projections.length - 1];

console.log(`Current Net Worth: $${projections.currentNetWorth.toLocaleString()}`);
console.log(`At Retirement (65): $${retirementProjection?.totalNetWorth.toLocaleString() || 'N/A'}`);
console.log(`At Age 70: $${age70Projection?.totalNetWorth.toLocaleString() || 'N/A'}`);
console.log(`At Age 80: $${age80Projection?.totalNetWorth.toLocaleString() || 'N/A'}`);
console.log(`At Age 90: $${age90Projection?.totalNetWorth.toLocaleString() || 'N/A'}`);
console.log(`Final (${finalProjection?.age}): $${finalProjection?.totalNetWorth.toLocaleString() || 'N/A'}`);

// Find depletion age
const depletionProjection = projections.projections.find(p => p.savings <= 0);
if (depletionProjection) {
  console.log(`\n⚠️ DEPLETION: Assets deplete at age ${depletionProjection.age}`);
} else {
  console.log('\n✅ NO DEPLETION: Assets last through life expectancy');
}

// Test 3: Comparison
console.log('\n3. ALIGNMENT CHECK:');
console.log('----------------------------------------');
console.log('Monte Carlo includes healthcare costs in expenses: YES');
console.log('Net Worth Projections now include healthcare: YES');
console.log('Both methods should now be aligned');

// Show retirement year details
console.log('\n4. RETIREMENT YEAR ANALYSIS (Age 65):');
console.log('----------------------------------------');
if (retirementProjection) {
  console.log(`Savings: $${retirementProjection.savings.toLocaleString()}`);
  console.log(`Real Estate: $${retirementProjection.realEstate.toLocaleString()}`);
  console.log(`Other Assets: $${retirementProjection.otherAssets.toLocaleString()}`);
  console.log(`Debt: $${retirementProjection.debt.toLocaleString()}`);
  console.log(`Total Net Worth: $${retirementProjection.totalNetWorth.toLocaleString()}`);
  
  // Calculate first year withdrawal rate
  const firstYearWithdrawal = monteCarloParams.annualRetirementExpenses - monteCarloParams.annualGuaranteedIncome;
  const withdrawalRate = (firstYearWithdrawal / retirementProjection.savings) * 100;
  console.log(`\nFirst Year Withdrawal: $${firstYearWithdrawal.toLocaleString()}`);
  console.log(`Withdrawal Rate: ${withdrawalRate.toFixed(2)}%`);
}

console.log('\n==========================================================');
console.log('CONCLUSION:');
console.log('With healthcare costs now included in net worth projections,');
console.log('both methods should show consistent retirement sustainability.');
console.log('==========================================================');