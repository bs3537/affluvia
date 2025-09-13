#!/usr/bin/env tsx

// Test cash flow calculation

const testProfile = {
  // Employment and income
  employmentStatus: 'employed',
  annualIncome: 120000, // $120k gross
  takeHomeIncome: 7500, // $7.5k/month after tax
  
  spouseEmploymentStatus: 'self-employed', 
  spouseAnnualIncome: 180000, // $180k gross (self-employed, so $15k/month)
  spouseTakeHomeIncome: 0, // Not used for self-employed
  
  otherIncome: 500, // $500/month other income
  maritalStatus: 'married',
  
  // Monthly expenses from intake form
  monthlyExpenses: {
    housing: 5000,
    food: 2000,
    transportation: 1500,
    utilities: 500,
    healthcare: 800,
    clothing: 300,
    entertainment: 1000,
    creditCardPayments: 2000,
    studentLoanPayments: 1500,
    otherDebtPayments: 100,
    expectedAnnualTaxes: 48000, // $4k/month
    other: 0
  },
  
  // Liabilities (some already in expenses)
  liabilities: [
    { type: 'credit_card', balance: 10000, monthlyPayment: 2000 }, // Already in expenses
    { type: 'student_loan', balance: 50000, monthlyPayment: 1500 }, // Already in expenses
    { type: 'auto_loan', balance: 25000, monthlyPayment: 600 }, // NOT in expenses
    { type: 'personal_loan', balance: 15000, monthlyPayment: 650 } // NOT in expenses
  ],
  
  // Retirement contributions
  retirementContributions: { employee: 1500, employer: 1000 }, // Only employee affects cash flow
  spouseRetirementContributions: { employee: 1050, employer: 0 },
  traditionalIRAContribution: 0,
  rothIRAContribution: 0,
  spouseTraditionalIRAContribution: 0,
  spouseRothIRAContribution: 0
};

console.log('=== CASH FLOW TEST ===\n');

// Calculate expected income
const userMonthlyIncome = testProfile.takeHomeIncome; // $7,500 (employed, use take-home)
const spouseMonthlyIncome = testProfile.spouseAnnualIncome / 12; // $15,000 (self-employed, use gross)
const otherIncome = testProfile.otherIncome; // $500
const totalMonthlyIncome = userMonthlyIncome + spouseMonthlyIncome + otherIncome;

console.log('Income Calculation:');
console.log(`  User (employed, after-tax): $${userMonthlyIncome.toLocaleString()}`);
console.log(`  Spouse (self-employed, gross): $${spouseMonthlyIncome.toLocaleString()}`);
console.log(`  Other income: $${otherIncome.toLocaleString()}`);
console.log(`  Total Monthly Income: $${totalMonthlyIncome.toLocaleString()}`);
console.log('');

// Calculate expenses
const totalMonthlyExpenses = Object.values(testProfile.monthlyExpenses)
  .reduce((sum, expense) => {
    if (typeof expense === 'number') {
      // Handle expectedAnnualTaxes specially
      if (expense === 48000) {
        return sum + (expense / 12);
      }
      return sum + expense;
    }
    return sum;
  }, 0);

console.log('Expense Calculation:');
console.log(`  Housing: $${testProfile.monthlyExpenses.housing.toLocaleString()}`);
console.log(`  Food: $${testProfile.monthlyExpenses.food.toLocaleString()}`);
console.log(`  Transportation: $${testProfile.monthlyExpenses.transportation.toLocaleString()}`);
console.log(`  Utilities: $${testProfile.monthlyExpenses.utilities.toLocaleString()}`);
console.log(`  Healthcare: $${testProfile.monthlyExpenses.healthcare.toLocaleString()}`);
console.log(`  Clothing: $${testProfile.monthlyExpenses.clothing.toLocaleString()}`);
console.log(`  Entertainment: $${testProfile.monthlyExpenses.entertainment.toLocaleString()}`);
console.log(`  Credit Card Payments: $${testProfile.monthlyExpenses.creditCardPayments.toLocaleString()}`);
console.log(`  Student Loan Payments: $${testProfile.monthlyExpenses.studentLoanPayments.toLocaleString()}`);
console.log(`  Other Debt Payments: $${testProfile.monthlyExpenses.otherDebtPayments.toLocaleString()}`);
console.log(`  Taxes (annual/12): $${(testProfile.monthlyExpenses.expectedAnnualTaxes / 12).toLocaleString()}`);
console.log(`  Total Monthly Expenses: $${totalMonthlyExpenses.toLocaleString()}`);
console.log('');

// Calculate other debt payments (not in expenses)
const otherDebtPayments = testProfile.liabilities
  .filter(l => !l.type.includes('credit') && !l.type.includes('student'))
  .reduce((sum, l) => sum + l.monthlyPayment, 0);

console.log('Other Debt Payments (not in expenses):');
testProfile.liabilities.forEach(l => {
  const included = l.type.includes('credit') || l.type.includes('student');
  console.log(`  ${l.type}: $${l.monthlyPayment} ${included ? '(already in expenses)' : '(additional)'}`);
});
console.log(`  Total Additional Debt: $${otherDebtPayments.toLocaleString()}`);
console.log('');

// Calculate retirement contributions (employee only)
const retirementContributions = 
  testProfile.retirementContributions.employee +
  testProfile.spouseRetirementContributions.employee;

console.log('Retirement Contributions:');
console.log(`  User employee: $${testProfile.retirementContributions.employee.toLocaleString()}`);
console.log(`  User employer: $${testProfile.retirementContributions.employer.toLocaleString()} (not deducted)`);
console.log(`  Spouse employee: $${testProfile.spouseRetirementContributions.employee.toLocaleString()}`);
console.log(`  Total Deducted: $${retirementContributions.toLocaleString()}`);
console.log('');

// Calculate net cash flow
const netCashFlow = totalMonthlyIncome - totalMonthlyExpenses - otherDebtPayments - retirementContributions;

console.log('=== FINAL CALCULATION ===');
console.log(`Monthly Income: $${totalMonthlyIncome.toLocaleString()}`);
console.log(`Monthly Expenses: -$${totalMonthlyExpenses.toLocaleString()}`);
console.log(`Other Debt Payments: -$${otherDebtPayments.toLocaleString()}`);
console.log(`Retirement Contributions: -$${retirementContributions.toLocaleString()}`);
console.log(`-----------------------------------------`);
console.log(`NET CASH FLOW: $${netCashFlow.toLocaleString()}`);
console.log('');
console.log('Expected: ~$1,500 positive cash flow');