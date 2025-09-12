import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

// Test profile based on typical user
const baseProfile = {
  dateOfBirth: '1970-01-01', // 54 years old
  desiredRetirementAge: 65,
  userLifeExpectancy: 90,
  maritalStatus: 'married',
  spouseDateOfBirth: '1972-01-01', // 52 years old
  spouseDesiredRetirementAge: 65,
  spouseLifeExpectancy: 92,
  
  // Income & Savings
  annualIncome: 120000,
  spouseAnnualIncome: 80000,
  savingsRate: 15,
  retirementContributions: { employee: 1000, employer: 500 }, // Monthly
  spouseRetirementContributions: { employee: 700, employer: 350 }, // Monthly
  
  // Social Security
  socialSecurityBenefit: 2500, // Monthly
  socialSecurityClaimAge: 67,
  spouseSocialSecurityBenefit: 1800, // Monthly
  spouseSocialSecurityClaimAge: 67,
  
  // Retirement Expenses
  expectedMonthlyExpensesRetirement: 8000,
  
  // Part-time income
  partTimeIncomeRetirement: 0,
  spousePartTimeIncomeRetirement: 0,
  
  // Asset Allocation
  currentAllocation: { usStocks: 60, bonds: 35, cash: 5 },
  expectedRealReturn: 0.06, // 6%
  expectedInflationRate: 3,
  
  // Assets
  assets: [
    { type: '401k', value: 800000, owner: 'user' },
    { type: 'traditional-ira', value: 300000, owner: 'user' },
    { type: 'roth-ira', value: 150000, owner: 'user' },
    { type: '401k', value: 500000, owner: 'spouse' },
    { type: 'taxable-brokerage', value: 400000, owner: 'joint' },
    { type: 'savings', value: 50000, owner: 'joint' },
    { type: 'checking', value: 25000, owner: 'joint' }
  ],
  
  // Other
  state: 'CA',
  retirementState: 'FL',
  hasLongTermCareInsurance: false
};

console.log('=== OPTIMIZATION VARIABLE SENSITIVITY TEST ===\n');

// 1. Run baseline simulation
console.log('1. BASELINE SIMULATION');
console.log('------------------------');
const baselineParams = profileToRetirementParams(baseProfile);
const baselineResult = runEnhancedMonteCarloSimulation(baselineParams, 1000);
console.log(`Baseline Success Rate: ${baselineResult.probabilityOfSuccess.toFixed(1)}%\n`);

// 2. Test Retirement Age Sensitivity (should be ~5% per year)
console.log('2. RETIREMENT AGE SENSITIVITY');
console.log('-----------------------------');
const retirementAges = [62, 63, 64, 65, 66, 67, 68, 70];
const retirementAgeResults: any[] = [];

for (const age of retirementAges) {
  const modifiedProfile = { ...baseProfile, desiredRetirementAge: age };
  const params = profileToRetirementParams(modifiedProfile);
  const result = runEnhancedMonteCarloSimulation(params, 1000);
  const change = result.probabilityOfSuccess - baselineResult.probabilityOfSuccess;
  const changePerYear = change / (age - 65);
  
  retirementAgeResults.push({
    age,
    successRate: result.probabilityOfSuccess,
    change,
    changePerYear
  });
  
  console.log(`Age ${age}: ${result.probabilityOfSuccess.toFixed(1)}% (${change > 0 ? '+' : ''}${change.toFixed(1)}%, ${changePerYear.toFixed(1)}%/year)`);
}

const avgChangePerYear = retirementAgeResults
  .filter(r => r.age !== 65)
  .reduce((sum, r) => sum + Math.abs(r.changePerYear), 0) / (retirementAgeResults.length - 1);
console.log(`Average impact per year: ${avgChangePerYear.toFixed(1)}%`);
console.log(`Expected: 3-7% per year`);
console.log(`Status: ${avgChangePerYear >= 3 && avgChangePerYear <= 7 ? '✅ PASS' : '❌ FAIL'}\n`);

// 3. Test Social Security Claim Age Sensitivity (should be ~8% per year)
console.log('3. SOCIAL SECURITY CLAIM AGE SENSITIVITY');
console.log('-----------------------------------------');
const ssAges = [62, 63, 64, 65, 66, 67, 68, 69, 70];
const ssAgeResults: any[] = [];

for (const age of ssAges) {
  const modifiedProfile = { 
    ...baseProfile, 
    socialSecurityClaimAge: age,
    // Adjust benefit for early/late claiming (roughly 7% per year)
    socialSecurityBenefit: 2500 * (1 + (age - 67) * 0.08)
  };
  const params = profileToRetirementParams(modifiedProfile);
  const result = runEnhancedMonteCarloSimulation(params, 1000);
  const change = result.probabilityOfSuccess - baselineResult.probabilityOfSuccess;
  const changePerYear = change / (age - 67);
  
  ssAgeResults.push({
    age,
    successRate: result.probabilityOfSuccess,
    change,
    changePerYear
  });
  
  console.log(`Age ${age}: ${result.probabilityOfSuccess.toFixed(1)}% (${change > 0 ? '+' : ''}${change.toFixed(1)}%, ${changePerYear.toFixed(1)}%/year)`);
}

const avgSSChangePerYear = ssAgeResults
  .filter(r => r.age !== 67)
  .reduce((sum, r) => sum + Math.abs(r.changePerYear), 0) / (ssAgeResults.length - 1);
console.log(`Average impact per year: ${avgSSChangePerYear.toFixed(1)}%`);
console.log(`Expected: ~8% per year`);
console.log(`Status: ${avgSSChangePerYear >= 6 && avgSSChangePerYear <= 10 ? '✅ PASS' : '❌ FAIL'}\n`);

// 4. Test Monthly Expense Sensitivity
console.log('4. MONTHLY EXPENSE SENSITIVITY');
console.log('-------------------------------');
const expenseAmounts = [6000, 7000, 8000, 9000, 10000, 12000];
const expenseResults: any[] = [];

for (const amount of expenseAmounts) {
  const modifiedProfile = { ...baseProfile, expectedMonthlyExpensesRetirement: amount };
  const params = profileToRetirementParams(modifiedProfile);
  const result = runEnhancedMonteCarloSimulation(params, 1000);
  const change = result.probabilityOfSuccess - baselineResult.probabilityOfSuccess;
  const percentChange = ((amount - 8000) / 8000) * 100;
  const impactPerPercent = percentChange !== 0 ? change / percentChange : 0;
  
  expenseResults.push({
    amount,
    successRate: result.probabilityOfSuccess,
    change,
    percentChange,
    impactPerPercent
  });
  
  console.log(`$${amount}/mo: ${result.probabilityOfSuccess.toFixed(1)}% (${change > 0 ? '+' : ''}${change.toFixed(1)}%, ${impactPerPercent.toFixed(2)}% per 1% expense change)`);
}

const avgExpenseImpact = expenseResults
  .filter(r => r.amount !== 8000)
  .reduce((sum, r) => sum + Math.abs(r.impactPerPercent), 0) / (expenseResults.length - 1);
console.log(`Average impact per 1% expense change: ${avgExpenseImpact.toFixed(2)}%`);
console.log(`Expected: 0.3-0.7% per 1% expense change`);
console.log(`Status: ${avgExpenseImpact >= 0.3 && avgExpenseImpact <= 0.7 ? '✅ PASS' : '❌ FAIL'}\n`);

// 5. Test Monthly Contribution Sensitivity
console.log('5. MONTHLY CONTRIBUTION SENSITIVITY');
console.log('------------------------------------');
const contributionAmounts = [0, 500, 1000, 1500, 2000, 2500, 3000, 4000];
const contributionResults: any[] = [];

for (const amount of contributionAmounts) {
  const modifiedProfile = { 
    ...baseProfile,
    retirementContributions: { employee: amount/2, employer: amount/4 },
    spouseRetirementContributions: { employee: amount/3, employer: amount/6 }
  };
  const params = profileToRetirementParams(modifiedProfile);
  const result = runEnhancedMonteCarloSimulation(params, 1000);
  const change = result.probabilityOfSuccess - baselineResult.probabilityOfSuccess;
  const changePerThousand = (amount - 2550) !== 0 ? change / ((amount - 2550) / 1000) : 0;
  
  contributionResults.push({
    amount,
    successRate: result.probabilityOfSuccess,
    change,
    changePerThousand
  });
  
  console.log(`$${amount}/mo: ${result.probabilityOfSuccess.toFixed(1)}% (${change > 0 ? '+' : ''}${change.toFixed(1)}%, ${changePerThousand.toFixed(1)}% per $1000/mo)`);
}

const avgContribImpact = contributionResults
  .filter(r => Math.abs(r.amount - 2550) > 500)
  .reduce((sum, r) => sum + Math.abs(r.changePerThousand), 0) / 
  contributionResults.filter(r => Math.abs(r.amount - 2550) > 500).length;
console.log(`Average impact per $1000/mo contribution: ${avgContribImpact.toFixed(1)}%`);
console.log(`Expected: 5-15% per $1000/mo`);
console.log(`Status: ${avgContribImpact >= 5 && avgContribImpact <= 15 ? '✅ PASS' : '❌ FAIL'}\n`);

// 6. Test Part-Time Income Sensitivity
console.log('6. PART-TIME INCOME SENSITIVITY');
console.log('--------------------------------');
const partTimeAmounts = [0, 1000, 2000, 3000, 4000, 5000];
const partTimeResults: any[] = [];

for (const amount of partTimeAmounts) {
  const modifiedProfile = { 
    ...baseProfile,
    partTimeIncomeRetirement: amount/2,
    spousePartTimeIncomeRetirement: amount/2
  };
  const params = profileToRetirementParams(modifiedProfile);
  const result = runEnhancedMonteCarloSimulation(params, 1000);
  const change = result.probabilityOfSuccess - baselineResult.probabilityOfSuccess;
  const changePerThousand = amount !== 0 ? change / (amount / 1000) : 0;
  
  partTimeResults.push({
    amount,
    successRate: result.probabilityOfSuccess,
    change,
    changePerThousand
  });
  
  console.log(`$${amount}/mo: ${result.probabilityOfSuccess.toFixed(1)}% (${change > 0 ? '+' : ''}${change.toFixed(1)}%, ${changePerThousand.toFixed(1)}% per $1000/mo)`);
}

const avgPartTimeImpact = partTimeResults
  .filter(r => r.amount > 0)
  .reduce((sum, r) => sum + r.changePerThousand, 0) / partTimeResults.filter(r => r.amount > 0).length;
console.log(`Average impact per $1000/mo part-time income: ${avgPartTimeImpact.toFixed(1)}%`);
console.log(`Expected: 3-8% per $1000/mo`);
console.log(`Status: ${avgPartTimeImpact >= 3 && avgPartTimeImpact <= 8 ? '✅ PASS' : '❌ FAIL'}\n`);

// Summary
console.log('=== SENSITIVITY TEST SUMMARY ===');
console.log('Variable                        | Status');
console.log('--------------------------------------|--------');
console.log(`Retirement Age (${avgChangePerYear.toFixed(1)}%/yr)          | ${avgChangePerYear >= 3 && avgChangePerYear <= 7 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Social Security Age (${avgSSChangePerYear.toFixed(1)}%/yr)    | ${avgSSChangePerYear >= 6 && avgSSChangePerYear <= 10 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Expenses (${avgExpenseImpact.toFixed(2)}%/1%)            | ${avgExpenseImpact >= 0.3 && avgExpenseImpact <= 0.7 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Contributions (${avgContribImpact.toFixed(1)}%/$1k)      | ${avgContribImpact >= 5 && avgContribImpact <= 15 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Part-Time Income (${avgPartTimeImpact.toFixed(1)}%/$1k)  | ${avgPartTimeImpact >= 3 && avgPartTimeImpact <= 8 ? '✅ PASS' : '❌ FAIL'}`);

console.log('\nNote: These are expected ranges based on financial planning best practices.');
console.log('Actual impacts may vary based on individual circumstances.');