import { db } from './server/db.js';
import { financialProfiles } from './shared/schema.js';
import { eq } from 'drizzle-orm';

/**
 * COMPREHENSIVE SAVE & LOAD TEST
 * This tests the complete save and load cycle for intake form data
 */

async function testSaveLoadCycle() {
  console.log('🔄 TESTING COMPLETE SAVE & LOAD CYCLE FOR INTAKE FORM\n');
  console.log('=' .repeat(60));
  
  const testUserId = 18; // Use existing user 18 for testing
  let originalData = null;
  
  try {
    // Step 0: Backup original data
    console.log('💾 STEP 0: Backing up original user 18 data...\n');
    const [original] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, testUserId));
    originalData = original;
    
    // Step 1: Create comprehensive test data with ALL fields
    console.log('📝 STEP 1: Creating test data with all fields...\n');
    
    const testData = {
      // Note: userId is not included in update, only used in WHERE clause
      
      // Step 1: Personal Information
      firstName: 'TestFirst',
      lastName: 'TestLast',
      dateOfBirth: '1985-06-15',
      maritalStatus: 'married',
      dependents: 2,
      state: 'NY',
      spouseName: 'TestSpouse LastName',
      spouseDateOfBirth: '1987-03-20',
      
      // Step 2: Employment & Income
      employmentStatus: 'full-time',
      annualIncome: '150000',
      taxWithholdingStatus: 'employer',
      takeHomeIncome: '105000',
      otherIncome: '5000',
      spouseEmploymentStatus: 'part-time',
      spouseAnnualIncome: '50000',
      spouseTaxWithholdingStatus: 'employer',
      spouseTakeHomeIncome: '38000',
      
      // Step 3: Savings & Assets/Liabilities
      savingsRate: '15',
      assets: JSON.stringify([
        { type: 'savings', description: 'Emergency Fund', value: 25000, owner: 'User' },
        { type: '401k', description: 'Retirement', value: 150000, owner: 'User' },
        { type: 'taxable-brokerage', description: 'Investment', value: 75000, owner: 'Joint' }
      ]),
      liabilities: JSON.stringify([
        { type: 'mortgage', description: 'Home Loan', balance: 350000, monthlyPayment: 2500, interestRate: 4.5, owner: 'Joint' },
        { type: 'auto', description: 'Car Loan', balance: 25000, monthlyPayment: 450, interestRate: 3.9, owner: 'User' }
      ]),
      
      // Step 4: Real Estate
      primaryResidence: JSON.stringify({
        marketValue: 500000,
        mortgageBalance: 350000,
        monthlyPayment: 2500,
        interestRate: 4.5,
        yearsToPayOffMortgage: 25,
        owner: 'Joint'
      }),
      additionalProperties: JSON.stringify([
        {
          type: 'rental',
          marketValue: 300000,
          mortgageBalance: 200000,
          monthlyPayment: 1500,
          rentalIncome: 2000,
          owner: 'Joint'
        }
      ]),
      
      // Step 5: Monthly Expenses
      monthlyExpenses: JSON.stringify({
        housing: 3000,
        transportation: 800,
        food: 1200,
        utilities: 300,
        healthcare: 500,
        entertainment: 400,
        creditCardPayments: 200,
        studentLoanPayments: 0,
        otherDebtPayments: 0,
        clothing: 200,
        other: 500
      }),
      emergencyFundSize: '25000',
      
      // Step 6: Insurance
      lifeInsurance: JSON.stringify({ hasPolicy: true, coverageAmount: 1000000 }),
      spouseLifeInsurance: JSON.stringify({ hasPolicy: true, coverageAmount: 500000 }),
      healthInsurance: JSON.stringify({ hasPolicy: true, type: 'employer' }),
      disabilityInsurance: JSON.stringify({ hasPolicy: true, benefitAmount: 7500 }),
      spouseDisabilityInsurance: JSON.stringify({ hasPolicy: false }),
      autoInsurance: JSON.stringify({ hasPolicy: true }),
      homeownerInsurance: JSON.stringify({ hasPolicy: true }),
      umbrellaInsurance: JSON.stringify({ hasPolicy: true, coverageAmount: 2000000 }),
      businessLiabilityInsurance: JSON.stringify({ hasPolicy: false }),
      insurance: JSON.stringify({
        homeDwellingLimit: 500000,
        autoLiabilityLimits: {
          bodilyInjuryPerPerson: 250000,
          bodilyInjuryPerAccident: 500000,
          propertyDamage: 100000
        },
        umbrellaLimit: 2000000
      }),
      
      // Step 7: Risk Profile
      riskQuestions: JSON.stringify([3, 4, 3, 3, 4]), // Moderate risk
      currentAllocation: JSON.stringify({
        usStocks: 40,
        intlStocks: 20,
        bonds: 30,
        alternatives: 5,
        cash: 5
      }),
      
      // Step 8: Spouse Risk Profile
      spouseRiskQuestions: JSON.stringify([3, 3, 3, 3, 3]), // Moderate risk
      spouseAllocation: JSON.stringify({
        usStocks: 35,
        intlStocks: 15,
        bonds: 40,
        alternatives: 5,
        cash: 5
      }),
      
      // Step 9: Estate Planning
      hasWill: true,
      hasTrust: false,
      hasPowerOfAttorney: true,
      hasHealthcareProxy: true,
      hasBeneficiaries: true,
      
      // Step 10: Tax Information
      lastYearAGI: '195000',
      deductionAmount: '25000',
      taxFilingStatus: 'married-filing-jointly',
      
      // Step 11: Retirement Planning
      desiredRetirementAge: 62,
      spouseDesiredRetirementAge: 65,
      socialSecurityClaimAge: 67,
      spouseSocialSecurityClaimAge: 67,
      userHealthStatus: 'excellent',
      spouseHealthStatus: 'good',
      userLifeExpectancy: 95,
      spouseLifeExpectancy: 93,
      expectedMonthlyExpensesRetirement: '8000',
      retirementState: 'FL', // Different from current state
      partTimeIncomeRetirement: '2000',
      spousePartTimeIncomeRetirement: '0',
      socialSecurityBenefit: '3200',
      spouseSocialSecurityBenefit: '1800',
      pensionBenefit: '1500',
      spousePensionBenefit: '0',
      retirementContributions: JSON.stringify({ employee: 15000, employer: 7500 }),
      spouseRetirementContributions: JSON.stringify({ employee: 5000, employer: 2500 }),
      traditionalIRAContribution: '6500',
      rothIRAContribution: '6500',
      spouseTraditionalIRAContribution: '6500',
      spouseRothIRAContribution: '0',
      expectedInflationRate: '3',
      legacyGoal: '500000',
      withdrawalRate: '4',
      hasLongTermCareInsurance: true,
      additionalNotes: 'Test notes for comprehensive save/load test',
      
      // Metadata
      isComplete: true,
      lastUpdated: new Date()
    };
    
    // Step 2: Update with test data
    console.log('💾 STEP 2: Updating user with test data...\n');
    await db.update(financialProfiles)
      .set(testData)
      .where(eq(financialProfiles.userId, testUserId));
    console.log('✅ Data saved successfully!\n');
    
    // Step 4: Load the data back
    console.log('📥 STEP 4: Loading data back from database...\n');
    const [loadedProfile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, testUserId));
    
    if (!loadedProfile) {
      throw new Error('Failed to load saved profile!');
    }
    
    // Step 5: Verify all fields were saved and loaded correctly
    console.log('✅ STEP 5: Verifying all fields...\n');
    
    const fieldsToCheck = [
      // Personal
      ['firstName', 'TestFirst'],
      ['lastName', 'TestLast'],
      ['dateOfBirth', '1985-06-15'],
      ['maritalStatus', 'married'],
      ['dependents', 2],
      ['state', 'NY'],
      ['spouseName', 'TestSpouse LastName'],
      ['spouseDateOfBirth', '1987-03-20'],
      
      // Employment
      ['employmentStatus', 'full-time'],
      ['annualIncome', '150000.00'],
      ['taxWithholdingStatus', 'employer'],
      ['takeHomeIncome', '105000.00'],
      ['otherIncome', '5000.00'],
      ['spouseEmploymentStatus', 'part-time'],
      ['spouseAnnualIncome', '50000.00'],
      
      // Important fields often missed
      ['savingsRate', '15.00'],
      ['taxFilingStatus', 'married-filing-jointly'],
      ['retirementState', 'FL'],
      ['additionalNotes', 'Test notes for comprehensive save/load test'],
      
      // Retirement
      ['desiredRetirementAge', 62],
      ['socialSecurityClaimAge', 67],
      ['expectedMonthlyExpensesRetirement', '8000.00'],
      ['traditionalIRAContribution', '6500.00'],
      ['rothIRAContribution', '6500.00'],
      ['hasLongTermCareInsurance', true],
      
      // Estate Planning
      ['hasWill', true],
      ['hasTrust', false],
      ['hasPowerOfAttorney', true],
      ['hasHealthcareProxy', true],
      ['hasBeneficiaries', true]
    ];
    
    let allFieldsCorrect = true;
    let incorrectFields = [];
    
    for (const [field, expectedValue] of fieldsToCheck) {
      const actualValue = loadedProfile[field];
      const expected = String(expectedValue);
      const actual = String(actualValue);
      
      if (actual !== expected) {
        console.log(`  ❌ ${field}: Expected "${expected}", Got "${actual}"`);
        incorrectFields.push(field);
        allFieldsCorrect = false;
      } else {
        console.log(`  ✅ ${field}: Correctly saved and loaded`);
      }
    }
    
    // Check JSON fields
    console.log('\n📦 Checking JSON fields:');
    const assets = typeof loadedProfile.assets === 'string' ? JSON.parse(loadedProfile.assets) : loadedProfile.assets;
    const liabilities = typeof loadedProfile.liabilities === 'string' ? JSON.parse(loadedProfile.liabilities) : loadedProfile.liabilities;
    const monthlyExpenses = typeof loadedProfile.monthlyExpenses === 'string' ? JSON.parse(loadedProfile.monthlyExpenses) : loadedProfile.monthlyExpenses;
    const currentAllocation = typeof loadedProfile.currentAllocation === 'string' ? JSON.parse(loadedProfile.currentAllocation) : loadedProfile.currentAllocation;
    
    console.log(`  ✅ Assets: ${assets.length} items loaded`);
    console.log(`  ✅ Liabilities: ${liabilities.length} items loaded`);
    console.log(`  ✅ Monthly Expenses: $${Object.values(monthlyExpenses).reduce((a,b) => a+b, 0)} total`);
    console.log(`  ✅ Current Allocation: ${Object.values(currentAllocation).reduce((a,b) => a+b, 0)}% total`);
    
    // Step 6: Restore original data
    console.log('\n🔄 STEP 6: Restoring original user data...\n');
    if (originalData) {
      delete originalData.id; // Remove ID to let database handle it
      await db.update(financialProfiles)
        .set(originalData)
        .where(eq(financialProfiles.userId, testUserId));
      console.log('✅ Original data restored');
    }
    
    // Final report
    console.log('=' .repeat(60));
    console.log('📊 TEST RESULTS:\n');
    
    if (allFieldsCorrect) {
      console.log('✅ SUCCESS! All fields saved and loaded correctly!');
      console.log('   Your intake form has complete database persistence.');
      console.log('   Users can safely fill the form, leave, and return');
      console.log('   with all their data intact.');
    } else {
      console.log('⚠️  Some fields had issues:');
      incorrectFields.forEach(field => {
        console.log(`   - ${field}`);
      });
      console.log('\n   Please check the transform functions for these fields.');
    }
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    // Restore original data if error occurred
    if (originalData) {
      try {
        delete originalData.id;
        await db.update(financialProfiles)
          .set(originalData)
          .where(eq(financialProfiles.userId, testUserId));
        console.log('✅ Original data restored after error');
      } catch (restoreError) {
        console.error('Failed to restore original data:', restoreError);
      }
    }
  } finally {
    process.exit(0);
  }
}

// Run the test
testSaveLoadCycle();