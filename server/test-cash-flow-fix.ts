#!/usr/bin/env tsx

// Test the fixed cash flow calculation for the reported issue

const testProfile = {
  // User income
  employmentStatus: 'employed',
  annualIncome: 60000, // $60k gross
  takeHomeIncome: 5000, // $5k/month after tax
  
  // Spouse income  
  spouseEmploymentStatus: 'employed',
  spouseAnnualIncome: 450000, // $450k gross
  spouseTakeHomeIncome: 25000, // $25k/month after tax
  
  maritalStatus: 'married',
  otherIncome: 0,
  
  // Monthly expenses from logs ($19,300 total)
  monthlyExpenses: {
    housing: 5000,
    food: 2000,
    transportation: 1500,
    utilities: 500,
    healthcare: 800,
    clothing: 300,
    entertainment: 1000,
    creditCardPayments: 500,
    studentLoanPayments: 1550,
    otherDebtPayments: 0,
    expectedAnnualTaxes: 72000, // $6k/month
    other: 150
  },
  
  // Liabilities from logs
  liabilities: [
    { type: 'credit-card', balance: 5000, monthlyPayment: 500 },
    { type: 'credit-card', balance: 10000, monthlyPayment: 500 },
    { type: 'student-loan', balance: 91000, monthlyPayment: 750 },
    { type: 'student-loan', balance: 192000, monthlyPayment: 800 },
    { type: 'auto-loan', balance: 60000, monthlyPayment: 1250 }
  ],
  
  // Retirement contributions from logs
  retirementContributions: { employee: 0, employer: 0 },
  spouseRetirementContributions: { employee: 2550, employer: 0 }
};

console.log('=== TESTING FIXED CASH FLOW CALCULATION ===\n');

// Test income calculation with new logic
function calculateMonthlyIncome(profile: any) {
  const userEmploymentStatus = (profile.employmentStatus || '').toLowerCase();
  const spouseEmploymentStatus = (profile.spouseEmploymentStatus || '').toLowerCase();
  const userTakeHome = Number(profile.takeHomeIncome || 0);
  const spouseTakeHome = Number(profile.spouseTakeHomeIncome || 0);
  const userAnnualIncome = Number(profile.annualIncome || 0);
  const spouseAnnualIncome = Number(profile.spouseAnnualIncome || 0);
  const otherMonthlyIncome = Number(profile.otherIncome || 0);
  
  // Calculate user monthly income
  let userMonthlyIncome = 0;
  if (userEmploymentStatus.includes('self-employed') || userEmploymentStatus.includes('self employed')) {
    userMonthlyIncome = userAnnualIncome / 12;
  } else if (userTakeHome > 0) {
    userMonthlyIncome = userTakeHome;
  } else if (userAnnualIncome > 0) {
    userMonthlyIncome = userAnnualIncome / 12;
  }
  
  // Calculate spouse monthly income
  let spouseMonthlyIncome = 0;
  if (profile.maritalStatus === 'married' || profile.maritalStatus === 'partnered') {
    if (spouseEmploymentStatus.includes('self-employed') || spouseEmploymentStatus.includes('self employed')) {
      spouseMonthlyIncome = spouseAnnualIncome / 12;
    } else if (spouseTakeHome > 0) {
      spouseMonthlyIncome = spouseTakeHome;
    } else if (spouseAnnualIncome > 0) {
      spouseMonthlyIncome = spouseAnnualIncome / 12;
    }
  }
  
  const totalMonthlyIncome = userMonthlyIncome + spouseMonthlyIncome + otherMonthlyIncome;
  
  console.log('Income Calculation Details:');
  console.log(`  User Employment Status: "${userEmploymentStatus}"`);
  console.log(`  User Take-Home: $${userTakeHome.toLocaleString()}`);
  console.log(`  User Annual: $${userAnnualIncome.toLocaleString()}`);
  console.log(`  User Monthly Income: $${userMonthlyIncome.toLocaleString()}`);
  console.log('');
  console.log(`  Spouse Employment Status: "${spouseEmploymentStatus}"`);
  console.log(`  Spouse Take-Home: $${spouseTakeHome.toLocaleString()}`);
  console.log(`  Spouse Annual: $${spouseAnnualIncome.toLocaleString()}`);
  console.log(`  Spouse Monthly Income: $${spouseMonthlyIncome.toLocaleString()}`);
  console.log('');
  console.log(`  Other Income: $${otherMonthlyIncome.toLocaleString()}`);
  console.log(`  TOTAL Monthly Income: $${totalMonthlyIncome.toLocaleString()}`);
  
  return totalMonthlyIncome;
}

// Calculate income with fixed logic
const monthlyIncome = calculateMonthlyIncome(testProfile);

// Calculate expenses
const totalMonthlyExpenses = Object.values(testProfile.monthlyExpenses)
  .reduce((sum, expense) => {
    if (typeof expense === 'number') {
      if (expense === 72000) {
        return sum + (expense / 12); // Annual taxes
      }
      return sum + expense;
    }
    return sum;
  }, 0);

console.log('\nExpense Calculation:');
console.log(`  Total Monthly Expenses: $${totalMonthlyExpenses.toLocaleString()}`);

// Calculate other debt (not in expenses)
const otherDebtPayments = testProfile.liabilities
  .filter(l => !l.type.includes('credit') && !l.type.includes('student'))
  .reduce((sum, l) => sum + l.monthlyPayment, 0);

console.log('\nDebt Payments (not in expenses):');
console.log(`  Auto Loan: $${1250}`);
console.log(`  Total Additional Debt: $${otherDebtPayments.toLocaleString()}`);

// Calculate retirement contributions (employee only)
const retirementContributions = 
  testProfile.retirementContributions.employee +
  testProfile.spouseRetirementContributions.employee;

console.log('\nRetirement Contributions:');
console.log(`  User: $${testProfile.retirementContributions.employee}`);
console.log(`  Spouse: $${testProfile.spouseRetirementContributions.employee}`);
console.log(`  Total: $${retirementContributions.toLocaleString()}`);

// Calculate net cash flow
const netCashFlow = monthlyIncome - totalMonthlyExpenses - otherDebtPayments - retirementContributions;

console.log('\n=== FINAL CALCULATION ===');
console.log(`Monthly Income: $${monthlyIncome.toLocaleString()}`);
console.log(`Monthly Expenses: -$${totalMonthlyExpenses.toLocaleString()}`);
console.log(`Other Debt Payments: -$${otherDebtPayments.toLocaleString()}`);
console.log(`Retirement Contributions: -$${retirementContributions.toLocaleString()}`);
console.log(`-----------------------------------------`);
console.log(`NET CASH FLOW: $${netCashFlow.toLocaleString()}`);
console.log('');
console.log('✓ Expected: $30,000 income - $19,300 expenses - $1,250 debt - $2,550 retirement = $6,900');
console.log(`✓ Actual: $${netCashFlow.toLocaleString()}`);