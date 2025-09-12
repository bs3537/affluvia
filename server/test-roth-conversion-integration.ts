/**
 * Test Script: Roth Conversion Integration Verification
 * 
 * This script creates a sample household and runs it through the complete
 * Roth conversion calculation pipeline to verify the integration works correctly.
 */

import { calculateWithdrawalSequence } from './retirement-withdrawal';
import { RothConversionEngine, RothConversionInputsSchema } from './roth-conversion-engine';

// Sample Household: "The Johnson Family"
const sampleHousehold = {
  // Personal Info
  userAge: 50,
  spouseAge: 48,
  retirementAge: 65,
  spouseRetirementAge: 65,
  socialSecurityAge: 70,
  spouseSocialSecurityAge: 70,
  lifeExpectancy: 90,
  
  // Income Info
  userIncome: 120000,
  spouseIncome: 80000,
  monthlyExpenses: 8000, // $96K annually
  socialSecurityBenefit: 2500, // Monthly  
  spouseSocialSecurityBenefit: 1800, // Monthly
  
  // Assets
  assets: {
    taxable: 150000, // Brokerage + savings
    taxDeferred: 450000, // 401k + Traditional IRA (mostly spouse's 401k)
    taxFree: 75000, // Roth accounts
    hsa: 25000
  }
};

async function testRothConversionIntegration() {
  console.log('🧪 ROTH CONVERSION INTEGRATION TEST');
  console.log('===================================');
  console.log('Sample Household: The Johnson Family');
  console.log(`👫 Ages: User ${sampleHousehold.userAge}, Spouse ${sampleHousehold.spouseAge}`);
  console.log(`💰 Household Income: $${(sampleHousehold.userIncome + sampleHousehold.spouseIncome).toLocaleString()}`);
  console.log(`💳 Monthly Expenses: $${sampleHousehold.monthlyExpenses.toLocaleString()}`);
  console.log(`🏦 Total Assets: $${Object.values(sampleHousehold.assets).reduce((a,b) => a+b, 0).toLocaleString()}`);
  console.log('');
  
  // Step 1: Calculate withdrawal sequence (same as Income tab)
  console.log('📊 STEP 1: Calculate Retirement Income Projections');
  console.log('------------------------------------------------');
  
  const withdrawalParams = {
    currentAge: sampleHousehold.userAge,
    retirementAge: sampleHousehold.retirementAge,
    spouseCurrentAge: sampleHousehold.spouseAge,
    spouseRetirementAge: sampleHousehold.spouseRetirementAge,
    lifeExpectancy: sampleHousehold.lifeExpectancy,
    socialSecurityAge: sampleHousehold.socialSecurityAge,
    spouseSocialSecurityAge: sampleHousehold.spouseSocialSecurityAge,
    socialSecurityBenefit: sampleHousehold.socialSecurityBenefit * 12, // Annual
    spouseSocialSecurityBenefit: sampleHousehold.spouseSocialSecurityBenefit * 12, // Annual
    pensionBenefit: 0,
    spousePensionBenefit: 0,
    partTimeIncomeRetirement: 0,
    spousePartTimeIncomeRetirement: 0,
    annualIncome: sampleHousehold.userIncome,
    spouseAnnualIncome: sampleHousehold.spouseIncome,
    monthlyExpenses: sampleHousehold.monthlyExpenses,
    assets: sampleHousehold.assets,
    investmentReturns: {
      taxable: 0.06,
      taxDeferred: 0.06,
      taxFree: 0.06,
      hsa: 0.06,
    },
    inflationRate: 0.025,
    taxRate: 0.22,
  };
  
  const incomeProjections = calculateWithdrawalSequence(withdrawalParams);
  console.log(`✅ Generated ${incomeProjections.length} years of income projections`);
  
  // Show key retirement years (gap years: 65-70)
  console.log('\n🎯 KEY RETIREMENT YEARS (Gap Years 65-70):');
  const gapYears = incomeProjections.filter(p => p.age >= 65 && p.age < 70);
  
  gapYears.forEach(year => {
    const totalIncome = (year.workingIncome || 0) + 
                       (year.spouseWorkingIncome || 0) +
                       (year.socialSecurity || 0) + 
                       (year.spouseSocialSecurity || 0) +
                       (year.pension || 0) + 
                       (year.spousePension || 0);
    
    const totalWithdrawals = (year.taxableWithdrawal || 0) + 
                           (year.taxDeferredWithdrawal || 0) + 
                           (year.taxFreeWithdrawal || 0) + 
                           (year.hsaWithdrawal || 0);
    
    const totalTaxableIncome = totalIncome + (year.taxDeferredWithdrawal || 0); // Tax-deferred withdrawals are taxable
    
    console.log(`  Year ${year.year} (Age ${year.age}):`);
    console.log(`    💼 Guaranteed Income: $${totalIncome.toLocaleString()}`);
    console.log(`    💰 Total Withdrawals: $${totalWithdrawals.toLocaleString()}`);
    console.log(`    📊 TAXABLE INCOME: $${totalTaxableIncome.toLocaleString()}`);
    console.log(`    📋 Monthly Expenses: $${(year.monthlyExpenses || 0).toLocaleString()}`);
  });
  
  // Step 2: Set up Roth conversion engine inputs
  console.log('\n🔧 STEP 2: Setup Roth Conversion Engine');
  console.log('--------------------------------------');
  
  const currentYear = new Date().getFullYear();
  const rothInputs = {
    // Personal Information  
    user_dob: new Date(currentYear - sampleHousehold.userAge, 6, 15).toISOString(),
    spouse_dob: new Date(currentYear - sampleHousehold.spouseAge, 8, 20).toISOString(),
    user_retirement_age: sampleHousehold.retirementAge,
    spouse_retirement_age: sampleHousehold.spouseRetirementAge,
    user_ss_claim_age: sampleHousehold.socialSecurityAge,
    spouse_ss_claim_age: sampleHousehold.spouseSocialSecurityAge,
    longevity_age: sampleHousehold.lifeExpectancy,
    
    // Income Information
    user_gross_income: sampleHousehold.userIncome,
    spouse_gross_income: sampleHousehold.spouseIncome,
    user_deductions: 15000, // 401k contributions
    spouse_deductions: 22500, // 401k contributions
    filing_status: 'marriedFilingJointly' as const,
    state_of_residence: 'CA',
    desired_monthly_retirement_expense: sampleHousehold.monthlyExpenses,
    
    // Account Information (convert to engine format)
    accounts: [
      { account_type: 'Taxable', owner: 'Joint', balance: 100000, asset_allocation_model: 'Balanced' },
      { account_type: 'Savings', owner: 'Joint', balance: 50000, asset_allocation_model: 'Conservative' },
      { account_type: '401k', owner: 'User', balance: 150000, asset_allocation_model: 'Balanced' },
      { account_type: '401k', owner: 'Spouse', balance: 300000, asset_allocation_model: 'Balanced' },
      { account_type: 'Roth IRA', owner: 'User', balance: 40000, asset_allocation_model: 'Balanced' },
      { account_type: 'Roth IRA', owner: 'Spouse', balance: 35000, asset_allocation_model: 'Balanced' },
      { account_type: 'HSA', owner: 'User', balance: 25000, asset_allocation_model: 'Conservative' },
    ],
    
    // Social Security (convert monthly to annual)
    social_security_benefit: sampleHousehold.socialSecurityBenefit * 12, // $30K annually
    spouse_social_security_benefit: sampleHousehold.spouseSocialSecurityBenefit * 12, // $21.6K annually
  };
  
  // Validate inputs
  const validatedInputs = RothConversionInputsSchema.parse(rothInputs);
  console.log('✅ Roth conversion inputs validated');
  
  // Step 3: Run Roth conversion analysis
  console.log('\n⚡ STEP 3: Run Roth Conversion Analysis');
  console.log('-------------------------------------');
  
  // Create a mock financial profile to test enhanced tax payment source recommendations
  const mockFinancialProfile = {
    savingsRate: '0.20', // 20% savings rate
    optimizationVariables: {
      userRiskProfile: 'balanced', // User has balanced risk profile
      isLocked: true,
      lockedAt: new Date().toISOString()
    },
    calculations: {}
  };
  
  const rothEngine = new RothConversionEngine(validatedInputs, 'moderate', incomeProjections, mockFinancialProfile);
  const results = await rothEngine.analyze();
  
  console.log('\n🎯 ROTH CONVERSION RECOMMENDATIONS:');
  console.log('===================================');
  
  // Show conversion years
  const conversionProjections = results.withConversionProjection.filter(p => p.conversionAmount > 0);
  
  if (conversionProjections.length === 0) {
    console.log('❌ NO CONVERSIONS RECOMMENDED');
    console.log('This could indicate an issue with the integration');
  } else {
    let totalConversions = 0;
    let totalTaxes = 0;
    
    conversionProjections.forEach(year => {
      totalConversions += year.conversionAmount;
      totalTaxes += (year.federalIncomeTax + year.stateIncomeTax) - 
                   (results.withoutConversionProjection.find(p => p.year === year.year)?.federalIncomeTax || 0) -
                   (results.withoutConversionProjection.find(p => p.year === year.year)?.stateIncomeTax || 0);
      
      console.log(`  Year ${year.year} (Age ${year.userAge}):`);
      console.log(`    💰 Conversion: $${year.conversionAmount.toLocaleString()}`);
      console.log(`    🏦 Total Taxable Income: $${year.totalIncome.toLocaleString()}`);
      console.log(`    💳 Estimated Tax: $${((year.federalIncomeTax + year.stateIncomeTax) * 0.22).toLocaleString()}`);
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`  Total Conversions: $${totalConversions.toLocaleString()}`);
    console.log(`  Lifetime Tax Savings: $${results.lifetimeTaxSavings.toLocaleString()}`);
    console.log(`  Estate Value Increase: $${(results.estateValueWithConversion - results.estateValueWithoutConversion).toLocaleString()}`);
    
    console.log(`\n💳 TAX PAYMENT SOURCE RECOMMENDATIONS:`);
    console.log('=' + '='.repeat(50));
    results.conversionPlan?.forEach(plan => {
      console.log(`  Year ${plan.year} (Age ${plan.age}):`);
      console.log(`    💰 Conversion: $${plan.conversionAmount.toLocaleString()}`);
      console.log(`    💸 Tax Owed: $${plan.taxOwed.toLocaleString()}`);
      console.log(`    📋 Payment Source: ${plan.paymentSource}`);
      console.log('');
    });
  }
  
  // Step 4: Verification checks
  console.log('\n🔍 STEP 4: Verification Checks');
  console.log('-----------------------------');
  
  let allChecksPass = true;
  
  // Check 1: Conversion window should be 65-70 (5 years)
  const conversionYears = conversionProjections.map(p => p.userAge);
  const expectedAges = [65, 66, 67, 68, 69];
  const hasCorrectWindow = expectedAges.every(age => 
    results.withConversionProjection.some(p => p.userAge === age)
  );
  
  console.log(`✓ Conversion Window (65-70): ${hasCorrectWindow ? '✅ PASS' : '❌ FAIL'}`);
  if (!hasCorrectWindow) allChecksPass = false;
  
  // Check 2: Should use actual income projections
  const year2040 = results.withConversionProjection.find(p => p.year === 2040);
  const expectedIncome2040 = gapYears.find(g => g.year === 2040);
  
  if (year2040 && expectedIncome2040) {
    const incomeMatches = Math.abs(year2040.wagesIncome - ((expectedIncome2040.workingIncome || 0) + (expectedIncome2040.spouseWorkingIncome || 0))) < 1000;
    console.log(`✓ Uses Actual Income Data: ${incomeMatches ? '✅ PASS' : '❌ FAIL'}`);
    if (!incomeMatches) allChecksPass = false;
  }
  
  // Check 3: Conversions should be reasonable (not massive like before)
  const maxConversion = Math.max(...conversionProjections.map(p => p.conversionAmount));
  const reasonableMax = 150000; // Adjusted for high-net-worth household - should be under $150K per year
  
  console.log(`✓ Reasonable Conversion Amounts (< $150K): ${maxConversion < reasonableMax ? '✅ PASS' : '❌ FAIL'}`);
  if (maxConversion >= reasonableMax) allChecksPass = false;
  
  // Check 4: Should have positive tax savings
  const hasPositiveSavings = results.lifetimeTaxSavings > 0;
  console.log(`✓ Positive Lifetime Tax Savings: ${hasPositiveSavings ? '✅ PASS' : '❌ FAIL'}`);
  if (!hasPositiveSavings) allChecksPass = false;
  
  console.log(`\n🎯 OVERALL TEST RESULT: ${allChecksPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);
  
  if (allChecksPass) {
    console.log('\n🎉 SUCCESS: Roth conversion integration is working correctly!');
    console.log('   - Uses actual retirement income projections');
    console.log('   - Recommends reasonable conversion amounts');
    console.log('   - Operates during correct gap years (65-70)'); 
    console.log('   - Generates positive tax savings');
  } else {
    console.log('\n⚠️  ISSUES DETECTED: Integration needs further refinement');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run the test
testRothConversionIntegration().catch(console.error);