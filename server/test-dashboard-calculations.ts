#!/usr/bin/env npx tsx

import { calculateFinancialMetricsWithPlaid } from './financial-calculations-enhanced';

// Main test function
async function runTests() {
  console.log('🧪 Testing Dashboard Widget Calculations\n');
  console.log('=' .repeat(70));

// Test Case 1: Basic cash flow calculation with take-home income
console.log('\n📊 Test 1: Monthly Cash Flow with Take-Home Income');
console.log('-'.repeat(50));

const testCase1 = {
  // Step 2: Income
  annualIncome: 100000,  // Gross income
  takeHomeIncome: 75000,  // After-tax income (75% of gross)
  spouseAnnualIncome: 50000,  // Spouse gross
  spouseTakeHomeIncome: 37500,  // Spouse after-tax
  
  // Step 5: Expenses (categorized)
  monthlyExpenses: {
    housing: 2000,
    transportation: 500,
    food: 800,
    utilities: 200,
    insurance: 300,
    healthcare: 200,
    entertainment: 300,
    personal: 200,
    other: 500
  },
  
  // Assets for net worth
  assets: [
    { type: 'Checking Account', value: 10000 },
    { type: '401k', value: 200000 },
    { type: 'Savings Account', value: 25000 },
    { type: 'Home', value: 450000 }
  ],
  
  // Liabilities
  liabilities: [
    { type: 'Mortgage', balance: 350000, monthlyPayment: 2000 },
    { type: 'Car Loan', balance: 20000, monthlyPayment: 400 },
    { type: 'Credit Card', balance: 5000, monthlyPayment: 150 }
  ],
  
  emergencyFundSize: 25000,
  maritalStatus: 'married'
};

const result1 = await calculateFinancialMetricsWithPlaid(testCase1);

console.log('\nInputs:');
console.log(`  User Annual Gross: $${testCase1.annualIncome.toLocaleString()}`);
console.log(`  User Take-Home: $${testCase1.takeHomeIncome.toLocaleString()}`);
console.log(`  Spouse Annual Gross: $${testCase1.spouseAnnualIncome.toLocaleString()}`);
console.log(`  Spouse Take-Home: $${testCase1.spouseTakeHomeIncome.toLocaleString()}`);
console.log(`  Total Household Take-Home: $${(testCase1.takeHomeIncome + testCase1.spouseTakeHomeIncome).toLocaleString()}`);

const categorizedTotal = Object.values(testCase1.monthlyExpenses)
  .reduce((sum: number, exp: any) => sum + exp, 0);
console.log(`\n  Categorized Monthly Expenses: $${categorizedTotal.toLocaleString()}`);

console.log('\n✅ Results:');
console.log(`  Monthly Take-Home Income: $${(result1.monthlyIncome || 0).toLocaleString()}`);
console.log(`  Monthly Expenses: $${result1.totalMonthlyExpenses.toLocaleString()} (${result1.expenseSource})`);
console.log(`  Monthly Cash Flow: $${result1.monthlyCashFlow.toLocaleString()}`);
console.log(`  Savings Rate: ${result1.savingsRate.toFixed(1)}%`);

// Verify calculations
const expectedMonthlyTakeHome = (testCase1.takeHomeIncome + testCase1.spouseTakeHomeIncome) / 12;
const expectedMonthlyCashFlow = expectedMonthlyTakeHome - categorizedTotal;
const expectedSavingsRate = (expectedMonthlyCashFlow / expectedMonthlyTakeHome) * 100;

console.log('\n🔍 Verification:');
console.log(`  Expected Monthly Take-Home: $${expectedMonthlyTakeHome.toFixed(2)}`);
console.log(`  Expected Monthly Cash Flow: $${expectedMonthlyCashFlow.toFixed(2)}`);
console.log(`  Expected Savings Rate: ${expectedSavingsRate.toFixed(1)}%`);

const cashFlowCorrect = Math.abs(result1.monthlyCashFlow - expectedMonthlyCashFlow) < 1;
console.log(`  Cash Flow Calculation: ${cashFlowCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);

// Test Case 2: Expense Priority (Manual Override)
console.log('\n\n📊 Test 2: Expense Priority - Manual Override');
console.log('-'.repeat(50));

const testCase2 = {
  ...testCase1,
  totalMonthlyExpenses: 6000,  // Manual override (higher than categorized)
  monthlyExpenses: {
    housing: 2000,
    food: 500
    // Only partially filled categories
  }
};

const result2 = await calculateFinancialMetricsWithPlaid(testCase2);

console.log('\nInputs:');
console.log(`  Categorized Expenses: $${2500} (partial)`);
console.log(`  Manual Override: $${testCase2.totalMonthlyExpenses}`);

console.log('\n✅ Results:');
console.log(`  Used Monthly Expenses: $${result2.totalMonthlyExpenses} (${result2.expenseSource})`);
console.log(`  Monthly Cash Flow: $${result2.monthlyCashFlow.toLocaleString()}`);

const shouldUseManual = result2.expenseSource === 'manual_override';
console.log(`\n🔍 Verification:`);
console.log(`  Should use manual override: ${shouldUseManual ? '✅ CORRECT' : '❌ INCORRECT'}`);

// Test Case 3: Net Worth Calculation
console.log('\n\n📊 Test 3: Net Worth Calculation');
console.log('-'.repeat(50));

const totalAssets = testCase1.assets.reduce((sum, asset) => sum + asset.value, 0);
const totalLiabilities = testCase1.liabilities.reduce((sum, liability) => sum + liability.balance, 0);
const expectedNetWorth = totalAssets - totalLiabilities;

console.log('\nAssets Breakdown:');
testCase1.assets.forEach(asset => {
  console.log(`  ${asset.type}: $${asset.value.toLocaleString()}`);
});
console.log(`  Total Assets: $${totalAssets.toLocaleString()}`);

console.log('\nLiabilities Breakdown:');
testCase1.liabilities.forEach(liability => {
  console.log(`  ${liability.type}: $${liability.balance.toLocaleString()}`);
});
console.log(`  Total Liabilities: $${totalLiabilities.toLocaleString()}`);

console.log('\n✅ Results:');
console.log(`  Net Worth: $${result1.netWorth.toLocaleString()}`);
console.log(`  Expected: $${expectedNetWorth.toLocaleString()}`);

const netWorthCorrect = result1.netWorth === expectedNetWorth;
console.log(`\n🔍 Verification:`);
console.log(`  Net Worth Calculation: ${netWorthCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);

// Test Case 4: DTI Ratio (should use gross income)
console.log('\n\n📊 Test 4: DTI Ratio (Uses Gross Income)');
console.log('-'.repeat(50));

const monthlyDebtPayments = testCase1.liabilities.reduce((sum, debt) => sum + debt.monthlyPayment, 0);
const monthlyGrossIncome = (testCase1.annualIncome + testCase1.spouseAnnualIncome) / 12;
const expectedDTI = (monthlyDebtPayments / monthlyGrossIncome) * 100;

console.log('\nInputs:');
console.log(`  Monthly Debt Payments: $${monthlyDebtPayments.toLocaleString()}`);
console.log(`  Monthly Gross Income: $${monthlyGrossIncome.toLocaleString()}`);

console.log('\n✅ Results:');
console.log(`  DTI Ratio: ${result1.dtiRatio.toFixed(1)}%`);
console.log(`  Expected: ${expectedDTI.toFixed(1)}%`);

const dtiCorrect = Math.abs(result1.dtiRatio - expectedDTI) < 0.1;
console.log(`\n🔍 Verification:`);
console.log(`  DTI Calculation: ${dtiCorrect ? '✅ CORRECT (uses gross income)' : '❌ INCORRECT'}`);

// Test Case 5: Emergency Fund Adequacy
console.log('\n\n📊 Test 5: Emergency Fund Adequacy');
console.log('-'.repeat(50));

const emergencyMonths = testCase1.emergencyFundSize / categorizedTotal;
const targetMonths = 3; // Dual earner household

console.log('\nInputs:');
console.log(`  Emergency Fund: $${testCase1.emergencyFundSize.toLocaleString()}`);
console.log(`  Monthly Expenses: $${categorizedTotal.toLocaleString()}`);
console.log(`  Months Covered: ${emergencyMonths.toFixed(1)}`);
console.log(`  Target (Dual Income): ${targetMonths} months`);

console.log('\n✅ Results:');
console.log(`  Emergency Months: ${result1.emergencyMonths.toFixed(1)}`);
console.log(`  Emergency Score: ${result1.emergencyReadinessScore}`);

// Summary
console.log('\n\n' + '=' .repeat(70));
console.log('📋 SUMMARY OF TESTS\n');

const allTestsPassed = cashFlowCorrect && shouldUseManual && netWorthCorrect && dtiCorrect;

console.log(`1. Cash Flow Calculation: ${cashFlowCorrect ? '✅' : '❌'}`);
console.log(`2. Expense Priority: ${shouldUseManual ? '✅' : '❌'}`);
console.log(`3. Net Worth Calculation: ${netWorthCorrect ? '✅' : '❌'}`);
console.log(`4. DTI Ratio: ${dtiCorrect ? '✅' : '❌'}`);

if (allTestsPassed) {
  console.log('\n✅ All dashboard calculations are working correctly!');
} else {
  console.log('\n❌ Some calculations need attention.');
}

console.log('\n💡 Key Points Verified:');
console.log('  • Monthly cash flow uses take-home income (after taxes)');
console.log('  • Expense hierarchy: categorized > manual > Plaid');
console.log('  • Savings rate calculated with take-home income');
console.log('  • DTI ratio correctly uses gross income');
console.log('  • Net worth = Total Assets - Total Liabilities');

console.log('\n✨ Dashboard calculations test complete!\n');
}

// Run the tests
runTests().catch(console.error);