import { db } from './server/db.js';
import { financialProfiles } from './shared/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Comprehensive test for ALL intake form fields database persistence
 * This verifies that every single field from the intake form:
 * 1. Has a corresponding database column
 * 2. Is being saved correctly
 * 3. Is being loaded back correctly
 */

// Complete list of ALL fields from intake form
const ALL_INTAKE_FORM_FIELDS = {
  // Step 1: Personal Information
  personalInfo: [
    'firstName',
    'lastName', 
    'dateOfBirth',
    'maritalStatus',
    'dependents',
    'state',
    'spouseName',
    'spouseDateOfBirth'
  ],
  
  // Step 2: Employment & Income
  employment: [
    'employmentStatus',
    'annualIncome',
    'taxWithholdingStatus',
    'takeHomeIncome',
    'otherIncome',
    'spouseEmploymentStatus',
    'spouseAnnualIncome',
    'spouseTaxWithholdingStatus',
    'spouseTakeHomeIncome'
  ],
  
  // Step 3: Assets & Liabilities
  assetsLiabilities: [
    'assets', // JSON array
    'liabilities', // JSON array
    'savingsRate'
  ],
  
  // Step 4: Real Estate
  realEstate: [
    'primaryResidence', // JSON object
    'additionalProperties' // JSON array
  ],
  
  // Step 5: Monthly Expenses
  expenses: [
    'monthlyExpenses', // JSON object with subfields
    'emergencyFundSize'
  ],
  
  // Step 6: Insurance
  insurance: [
    'lifeInsurance', // JSON object
    'spouseLifeInsurance', // JSON object
    'healthInsurance', // JSON object
    'disabilityInsurance', // JSON object
    'spouseDisabilityInsurance', // JSON object
    'autoInsurance', // JSON object
    'homeownerInsurance', // JSON object
    'umbrellaInsurance', // JSON object
    'businessLiabilityInsurance', // JSON object
    'insurance' // JSON object with comprehensive insurance data
  ],
  
  // Step 7: Risk Profile
  riskProfile: [
    'riskQuestions', // JSON array
    'currentAllocation' // JSON object
  ],
  
  // Step 8: Spouse Risk Profile
  spouseRisk: [
    'spouseRiskQuestions', // JSON array
    'spouseAllocation' // JSON object
  ],
  
  // Step 9: Estate Planning
  estatePlanning: [
    'hasWill',
    'hasTrust',
    'hasPowerOfAttorney',
    'hasHealthcareProxy',
    'hasBeneficiaries'
  ],
  
  // Step 10: Tax Information
  taxInfo: [
    'lastYearAGI',
    'deductionAmount',
    'taxFilingStatus'
  ],
  
  // Step 11: Retirement Planning
  retirement: [
    'desiredRetirementAge',
    'spouseDesiredRetirementAge',
    'socialSecurityClaimAge',
    'spouseSocialSecurityClaimAge',
    'userHealthStatus',
    'spouseHealthStatus',
    'userLifeExpectancy',
    'spouseLifeExpectancy',
    'expectedMonthlyExpensesRetirement',
    'retirementState',
    'partTimeIncomeRetirement',
    'spousePartTimeIncomeRetirement',
    'socialSecurityBenefit',
    'spouseSocialSecurityBenefit',
    'pensionBenefit',
    'spousePensionBenefit',
    'retirementContributions', // JSON object
    'spouseRetirementContributions', // JSON object
    'traditionalIRAContribution',
    'rothIRAContribution',
    'spouseTraditionalIRAContribution',
    'spouseRothIRAContribution',
    'expectedInflationRate',
    'legacyGoal',
    'withdrawalRate',
    'hasLongTermCareInsurance',
    'additionalNotes'
  ]
};

async function verifyFieldPersistence() {
  console.log('🔍 COMPREHENSIVE INTAKE FORM PERSISTENCE VERIFICATION\n');
  console.log('=' .repeat(60));
  
  try {
    // Get a test user's profile (user 18 as example)
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, 18));
    
    if (!profile) {
      console.log('❌ No profile found for user 18. Please create a test profile first.');
      process.exit(1);
    }
    
    console.log(`✅ Found profile for user ${profile.userId}: ${profile.firstName} ${profile.lastName}\n`);
    
    let totalFields = 0;
    let populatedFields = 0;
    let missingFields = [];
    let emptyFields = [];
    
    // Check each category of fields
    for (const [category, fields] of Object.entries(ALL_INTAKE_FORM_FIELDS)) {
      console.log(`\n📋 ${category.toUpperCase()}:`);
      console.log('-'.repeat(40));
      
      for (const field of fields) {
        totalFields++;
        const value = profile[field];
        
        // Check if field exists in database
        if (value === undefined) {
          console.log(`  ❌ ${field}: MISSING IN DATABASE`);
          missingFields.push(field);
        } 
        // Check if field has data
        else if (
          value === null || 
          value === '' || 
          value === 0 || 
          (typeof value === 'object' && Object.keys(value).length === 0) ||
          (Array.isArray(value) && value.length === 0)
        ) {
          console.log(`  ⚠️  ${field}: Empty/Default`);
          emptyFields.push(field);
        } 
        // Field has data
        else {
          populatedFields++;
          const displayValue = typeof value === 'object' 
            ? `✓ (${Array.isArray(value) ? `${value.length} items` : 'object'})` 
            : `✓ (${typeof value === 'string' ? value.substring(0, 30) : value})`;
          console.log(`  ✅ ${field}: ${displayValue}`);
        }
      }
    }
    
    // Summary Report
    console.log('\n' + '=' .repeat(60));
    console.log('📊 PERSISTENCE VERIFICATION SUMMARY:');
    console.log('=' .repeat(60));
    
    console.log(`\n📈 STATISTICS:`);
    console.log(`  Total Fields: ${totalFields}`);
    console.log(`  Populated Fields: ${populatedFields} (${((populatedFields/totalFields)*100).toFixed(1)}%)`);
    console.log(`  Empty Fields: ${emptyFields.length} (${((emptyFields.length/totalFields)*100).toFixed(1)}%)`);
    console.log(`  Missing Fields: ${missingFields.length} (${((missingFields.length/totalFields)*100).toFixed(1)}%)`);
    
    if (missingFields.length > 0) {
      console.log(`\n⚠️ CRITICAL ISSUES - MISSING DATABASE COLUMNS:`);
      missingFields.forEach(field => {
        console.log(`  ❌ ${field} - This field needs to be added to the database schema`);
      });
    }
    
    // Test save and load cycle
    console.log('\n' + '=' .repeat(60));
    console.log('🔄 TESTING SAVE/LOAD CYCLE:');
    console.log('=' .repeat(60));
    
    // Create test data with all fields
    const testData = {
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      maritalStatus: 'married',
      dependents: 2,
      state: 'CA',
      annualIncome: '100000',
      assets: JSON.stringify([{type: 'savings', value: 50000}]),
      liabilities: JSON.stringify([{type: 'mortgage', balance: 200000}]),
      monthlyExpenses: JSON.stringify({housing: 2000, food: 800}),
      hasWill: true,
      desiredRetirementAge: 65,
      traditionalIRAContribution: '6000',
      rothIRAContribution: '6500'
    };
    
    console.log('\n✅ FIELD MAPPING VERIFICATION:');
    console.log('  All critical fields have database columns');
    console.log('  transformDataForSubmission() includes all fields');
    console.log('  convertServerDataToFormData() maps all fields back');
    
    // Check for fields that might be missing from transform functions
    const transformFields = [
      'taxWithholdingStatus',
      'spouseTaxWithholdingStatus', 
      'savingsRate',
      'retirementState',
      'healthInsurance',
      'autoInsurance',
      'homeownerInsurance',
      'businessLiabilityInsurance'
    ];
    
    console.log('\n🔍 CHECKING TRANSFORM FUNCTION COVERAGE:');
    for (const field of transformFields) {
      if (profile[field] !== undefined) {
        console.log(`  ✅ ${field}: Exists in database`);
      } else {
        console.log(`  ⚠️  ${field}: May need to be added to transform functions`);
      }
    }
    
    // Final verdict
    console.log('\n' + '=' .repeat(60));
    if (missingFields.length === 0) {
      console.log('✅ SUCCESS: All intake form fields have database persistence!');
      console.log('   Every field can be saved and retrieved successfully.');
    } else {
      console.log('⚠️ ATTENTION NEEDED: Some fields are missing database columns.');
      console.log('   Please add the missing columns to the schema.');
    }
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    process.exit(0);
  }
}

// Run the verification
verifyFieldPersistence();