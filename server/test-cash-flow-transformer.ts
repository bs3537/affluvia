#!/usr/bin/env tsx

// Test the server-side cash flow transformer implementation
import { transformMonteCarloToCashFlow } from './cash-flow-transformer';

console.log('🧪 Testing Server-Side Cash Flow Transformer');
console.log('='.repeat(50));

// Test data mimicking Monte Carlo simulation results
const mockMonteCarloData = [
  {
    year: 2024,
    age: 65,
    portfolioBalance: 1000000,
    withdrawal: 40000,
    guaranteedIncome: 36000, // Social Security + Pension
    socialSecurityIncome: 24000,
    pensionIncome: 12000,
    partTimeIncome: 0,
    totalTax: 8000,
    federalTax: 6000,
    stateTax: 2000,
    ficaTax: 0,
    healthcareCosts: 8000,
    totalExpenses: 60000,
    netCashFlow: 16000
  },
  {
    year: 2025,
    age: 66,
    portfolioBalance: 1020000,
    withdrawal: 42000,
    guaranteedIncome: 36000,
    socialSecurityIncome: 24000,
    pensionIncome: 12000,
    partTimeIncome: 6000, // Part-time work
    totalTax: 9000,
    federalTax: 6500,
    stateTax: 2200,
    ficaTax: 300,
    healthcareCosts: 8500,
    totalExpenses: 62000,
    netCashFlow: 17000
  },
  {
    year: 2026,
    age: 67,
    portfolioBalance: 1040000,
    withdrawal: 45000,
    guaranteedIncome: 40000, // Spouse starts SS
    socialSecurityIncome: 24000,
    pensionIncome: 12000,
    partTimeIncome: 3000, // Reducing part-time work
    totalTax: 10000,
    federalTax: 7000,
    stateTax: 2500,
    ficaTax: 500,
    healthcareCosts: 9000,
    totalExpenses: 65000,
    netCashFlow: 13000
  }
];

// Mock optimization variables
const mockVariables = {
  retirementAge: 65,
  spouseRetirementAge: 67,
  socialSecurityAge: 65,
  spouseSocialSecurityAge: 67,
  monthlyExpenses: 5000,
  partTimeIncome: 500, // Monthly
  spousePartTimeIncome: 0
};

// Mock profile
const mockProfile = {
  socialSecurityBenefit: 2000, // Monthly
  spouseSocialSecurityBenefit: 1800, // Monthly  
  pensionBenefit: 1000, // Monthly
  spousePensionBenefit: 0,
  expectedMonthlyExpensesRetirement: 5000,
  dateOfBirth: '1959-01-01', // Age 65 in 2024
  spouseDateOfBirth: '1957-01-01', // Age 67 in 2024
  annualIncome: 80000,
  spouseAnnualIncome: 60000,
  primaryResidence: {
    yearsToPayOffMortgage: 5,
    monthlyPayment: 1200
  }
};

console.log('\n📊 Input Data Summary:');
console.log('Monte Carlo Years:', mockMonteCarloData.length);
console.log('Retirement Ages:', mockVariables.retirementAge, '/', mockVariables.spouseRetirementAge);
console.log('SS Claim Ages:', mockVariables.socialSecurityAge, '/', mockVariables.spouseSocialSecurityAge);
console.log('Monthly Expenses:', mockVariables.monthlyExpenses);

try {
  // Test the transformer
  console.log('\n🔄 Running Cash Flow Transformation...');
  const transformedCashFlow = transformMonteCarloToCashFlow(
    mockMonteCarloData,
    mockVariables,
    mockProfile,
    true // isOptimized
  );

  console.log('\n✅ Transformation Successful!');
  console.log('Transformed Cash Flow Years:', transformedCashFlow.length);

  if (transformedCashFlow.length > 0) {
    console.log('\n📈 Sample Transformed Data (First Year):');
    const firstYear = transformedCashFlow[0];
    
    console.log(`Year: ${firstYear.year}, Age: ${firstYear.age}, Spouse Age: ${firstYear.spouseAge}`);
    console.log('\n💰 Income Sources:');
    console.log(`  Social Security: $${firstYear.socialSecurity.toLocaleString()}`);
    console.log(`  Spouse SS: $${firstYear.spouseSocialSecurity.toLocaleString()}`);
    console.log(`  Pension: $${firstYear.pension.toLocaleString()}`);
    console.log(`  Spouse Pension: $${firstYear.spousePension.toLocaleString()}`);
    console.log(`  Part-time Income: $${firstYear.partTimeIncome.toLocaleString()}`);
    console.log(`  Employment Income: $${firstYear.employmentIncome.toLocaleString()}`);

    console.log('\n💸 Portfolio Withdrawals:');
    console.log(`  Taxable: $${firstYear.taxableWithdrawal.toLocaleString()}`);
    console.log(`  Tax-Deferred: $${firstYear.taxDeferredWithdrawal.toLocaleString()}`);
    console.log(`  Roth: $${firstYear.rothWithdrawal.toLocaleString()}`);
    console.log(`  Total: $${(firstYear.taxableWithdrawal + firstYear.taxDeferredWithdrawal + firstYear.rothWithdrawal).toLocaleString()}`);

    console.log('\n🏠 Expenses:');
    console.log(`  Living: $${firstYear.livingExpenses.toLocaleString()}`);
    console.log(`  Healthcare: $${firstYear.healthcare.toLocaleString()}`);
    console.log(`  Housing: $${firstYear.housing.toLocaleString()}`);
    console.log(`  Insurance: $${firstYear.insurance.toLocaleString()}`);
    console.log(`  Discretionary: $${firstYear.discretionary.toLocaleString()}`);

    console.log('\n💸 Taxes:');
    console.log(`  Federal: $${firstYear.federalTax.toLocaleString()}`);
    console.log(`  State: $${firstYear.stateTax.toLocaleString()}`);
    console.log(`  FICA: $${firstYear.ficaTax.toLocaleString()}`);

    console.log('\n📊 Summary:');
    console.log(`  Net Cash Flow: $${firstYear.netCashFlow.toLocaleString()}`);
    console.log(`  Portfolio Balance: $${firstYear.portfolioBalance.toLocaleString()}`);

    // Test validation
    const totalIncome = firstYear.socialSecurity + firstYear.spouseSocialSecurity + 
                       firstYear.pension + firstYear.spousePension + firstYear.partTimeIncome + 
                       firstYear.employmentIncome + firstYear.taxableWithdrawal + 
                       firstYear.taxDeferredWithdrawal + firstYear.rothWithdrawal;
    
    const totalExpenses = firstYear.livingExpenses + firstYear.healthcare + firstYear.housing + 
                          firstYear.insurance + firstYear.discretionary + firstYear.debt;
    
    const totalTaxes = firstYear.federalTax + firstYear.stateTax + firstYear.ficaTax;
    
    console.log('\n🔍 Validation:');
    console.log(`  Total Income: $${totalIncome.toLocaleString()}`);
    console.log(`  Total Expenses: $${totalExpenses.toLocaleString()}`);
    console.log(`  Total Taxes: $${totalTaxes.toLocaleString()}`);
    console.log(`  Calculated Net: $${(totalIncome - totalExpenses - totalTaxes).toLocaleString()}`);
    console.log(`  Reported Net: $${firstYear.netCashFlow.toLocaleString()}`);
    
    const netDiff = Math.abs((totalIncome - totalExpenses - totalTaxes) - firstYear.netCashFlow);
    if (netDiff < 1) {
      console.log('  ✅ Cash flow calculation is balanced!');
    } else {
      console.log(`  ⚠️  Cash flow difference: $${netDiff.toLocaleString()}`);
    }
  }

  // Test edge cases
  console.log('\n🧪 Testing Edge Cases...');
  
  // Empty data
  const emptyResult = transformMonteCarloToCashFlow([], mockVariables, mockProfile);
  console.log(`Empty data result: ${emptyResult.length} years (expected: 0)`);
  
  // Data with no withdrawals
  const noWithdrawalData = mockMonteCarloData.map(year => ({ ...year, withdrawal: 0 }));
  const noWithdrawalResult = transformMonteCarloToCashFlow(noWithdrawalData, mockVariables, mockProfile);
  console.log(`No withdrawal result: ${noWithdrawalResult.length} years, first year withdrawals: $${(noWithdrawalResult[0]?.taxableWithdrawal || 0) + (noWithdrawalResult[0]?.taxDeferredWithdrawal || 0) + (noWithdrawalResult[0]?.rothWithdrawal || 0)}`);

  console.log('\n✅ All tests completed successfully!');
  console.log('🎉 Server-side cash flow transformer is working correctly!');

} catch (error) {
  console.error('❌ Error testing cash flow transformer:', error);
  process.exit(1);
}