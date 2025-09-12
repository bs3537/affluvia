// Test script to verify inflation adjustment for retirement expenses
const { profileToRetirementParams } = require('./monte-carlo');
const { runEnhancedMonteCarloSimulation } = require('./monte-carlo-enhanced');
// Test case: User enters $8,000/month expenses with 15 years to retirement
const testProfile = {
    // Personal info
    dateOfBirth: new Date('1974-01-01'), // Age 51 (15 years to retirement at 66)
    maritalStatus: 'married',
    spouseDateOfBirth: new Date('1974-01-01'),
    // Retirement goals
    desiredRetirementAge: 66,
    spouseDesiredRetirementAge: 66,
    userLifeExpectancy: 90,
    spouseLifeExpectancy: 90,
    // User enters $8,000/month in today's dollars
    expectedMonthlyExpensesRetirement: 8000,
    expectedInflationRate: 3, // 3% inflation
    // Income and assets (simplified for test)
    annualIncome: 100000,
    spouseAnnualIncome: 100000,
    assets: [
        { type: '401k', value: 500000, owner: 'user' },
        { type: 'taxable-brokerage', value: 200000, owner: 'joint' }
    ],
    // Retirement contributions
    retirementContributions: { employee: 2000, employer: 0 },
    // Social Security
    socialSecurityBenefit: 2500,
    spouseSocialSecurityBenefit: 2500,
    // Other parameters
    expectedRealReturn: 6,
    withdrawalRate: 4,
    stockAllocation: 60,
    currentAllocation: { usStocks: 60, bonds: 35, cash: 5 }
};
console.log('=== TESTING INFLATION ADJUSTMENT FOR RETIREMENT EXPENSES ===\n');
// Convert profile to Monte Carlo parameters
const params = profileToRetirementParams(testProfile);
console.log('\nKEY RESULTS:');
console.log('User Input: $8,000/month in today\'s dollars');
console.log('Annual Amount (today): $' + (8000 * 12).toLocaleString());
console.log('Years to Retirement: 15');
console.log('Inflation Rate: 3%');
console.log('');
console.log('CALCULATED VALUES:');
console.log('Inflation Factor: ' + Math.pow(1.03, 15).toFixed(2) + 'x');
console.log('Expected Monthly Expenses at Retirement: $' + (8000 * Math.pow(1.03, 15)).toLocaleString());
console.log('Annual Retirement Expenses (from params): $' + params.annualRetirementExpenses.toLocaleString());
console.log('');
// Run a quick Monte Carlo simulation to see the impact
console.log('Running Monte Carlo simulation with inflation-adjusted expenses...');
const result = runEnhancedMonteCarloSimulation(params, 1000);
console.log('\nMONTE CARLO RESULTS:');
console.log('Success Probability: ' + result.probabilityOfSuccess.toFixed(1) + '%');
console.log('Safe Withdrawal Rate: ' + (result.safeWithdrawalRate * 100).toFixed(2) + '%');
console.log('');
// Compare with non-inflation-adjusted scenario
const paramsNoInflation = {
    ...params,
    annualRetirementExpenses: 8000 * 12 // Use today's dollars directly (WRONG!)
};
console.log('COMPARISON - Without Inflation Adjustment (INCORRECT):');
const resultNoInflation = runEnhancedMonteCarloSimulation(paramsNoInflation, 1000);
console.log('Success Probability: ' + resultNoInflation.probabilityOfSuccess.toFixed(1) + '%');
console.log('Safe Withdrawal Rate: ' + (resultNoInflation.safeWithdrawalRate * 100).toFixed(2) + '%');
console.log('');
console.log('IMPACT OF INFLATION ADJUSTMENT:');
console.log('Difference in Success Probability: ' +
    (resultNoInflation.probabilityOfSuccess - result.probabilityOfSuccess).toFixed(1) +
    ' percentage points overstated without adjustment');
console.log('');
console.log('CONCLUSION: Not adjusting for inflation makes the simulation overly optimistic!');
