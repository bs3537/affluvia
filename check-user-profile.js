import { db } from './server/db.js';
import { financialProfiles } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkUserProfile() {
  console.log('🔍 Checking financial profile for user 18...\n');
  
  try {
    const [profile] = await db
      .select({
        id: financialProfiles.id,
        userId: financialProfiles.userId,
        firstName: financialProfiles.firstName,
        lastName: financialProfiles.lastName,
        email: financialProfiles.email,
        dateOfBirth: financialProfiles.dateOfBirth,
        maritalStatus: financialProfiles.maritalStatus,
        state: financialProfiles.state,
        
        // Employment & Income
        employmentStatus: financialProfiles.employmentStatus,
        annualIncome: financialProfiles.annualIncome,
        takeHomeIncome: financialProfiles.takeHomeIncome,
        otherIncome: financialProfiles.otherIncome,
        
        // Retirement fields
        desiredRetirementAge: financialProfiles.desiredRetirementAge,
        hasLongTermCareInsurance: financialProfiles.hasLongTermCareInsurance,
        
        // Check if has assets/liabilities (JSON fields)
        hasAssets: financialProfiles.assets,
        hasLiabilities: financialProfiles.liabilities,
        hasMonthlyExpenses: financialProfiles.monthlyExpenses,
        
        // Scores
        financialHealthScore: financialProfiles.financialHealthScore,
        retirementReadinessScore: financialProfiles.retirementReadinessScore,
        netWorth: financialProfiles.netWorth,
        
        // Completion status
        isComplete: financialProfiles.isComplete,
        createdAt: financialProfiles.createdAt,
        updatedAt: financialProfiles.updatedAt
      })
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, 18))
      .limit(1);
    
    if (!profile) {
      console.log('❌ No financial profile found for user 18');
      process.exit(0);
    }
    
    console.log('✅ Found financial profile for user 18:\n');
    console.log('=' .repeat(50));
    
    // Basic Info
    console.log('📋 BASIC INFO:');
    console.log(`   ID: ${profile.id}`);
    console.log(`   User ID: ${profile.userId}`);
    console.log(`   Name: ${profile.firstName} ${profile.lastName}`);
    console.log(`   Marital Status: ${profile.maritalStatus || 'Not set'}`);
    console.log(`   State: ${profile.state || 'Not set'}`);
    console.log(`   Date of Birth: ${profile.dateOfBirth || 'Not set'}`);
    
    // Employment & Income
    console.log('\n💼 EMPLOYMENT & INCOME:');
    console.log(`   Employment Status: ${profile.employmentStatus || 'Not set'}`);
    console.log(`   Annual Income: $${profile.annualIncome?.toLocaleString() || 0}`);
    console.log(`   Take Home Income: $${profile.takeHomeIncome?.toLocaleString() || 0}`);
    console.log(`   Other Income: $${profile.otherIncome?.toLocaleString() || 0}`);
    
    // Retirement
    console.log('\n🏖️ RETIREMENT:');
    console.log(`   Desired Retirement Age: ${profile.desiredRetirementAge || 'Not set'}`);
    console.log(`   Has Long-term Care Insurance: ${profile.hasLongTermCareInsurance}`);
    
    // Financial Data
    console.log('\n💰 FINANCIAL DATA:');
    console.log(`   Has Assets: ${profile.hasAssets ? 'Yes' : 'No'}`);
    console.log(`   Has Liabilities: ${profile.hasLiabilities ? 'Yes' : 'No'}`);
    console.log(`   Has Monthly Expenses: ${profile.hasMonthlyExpenses ? 'Yes' : 'No'}`);
    
    // Scores
    console.log('\n📊 SCORES:');
    console.log(`   Financial Health Score: ${profile.financialHealthScore || 0}`);
    console.log(`   Retirement Readiness Score: ${profile.retirementReadinessScore || 0}`);
    console.log(`   Net Worth: $${profile.netWorth?.toLocaleString() || 0}`);
    
    // Status
    console.log('\n📈 STATUS:');
    console.log(`   Profile Complete: ${profile.isComplete ? 'Yes' : 'No'}`);
    console.log(`   Created: ${profile.createdAt ? new Date(profile.createdAt).toLocaleString() : 'Unknown'}`);
    console.log(`   Last Updated: ${profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'Unknown'}`);
    
    // Check for detailed data
    if (profile.hasAssets) {
      const assets = typeof profile.hasAssets === 'string' 
        ? JSON.parse(profile.hasAssets) 
        : profile.hasAssets;
      console.log(`\n   📦 Assets Count: ${Array.isArray(assets) ? assets.length : 0}`);
    }
    
    if (profile.hasLiabilities) {
      const liabilities = typeof profile.hasLiabilities === 'string'
        ? JSON.parse(profile.hasLiabilities)
        : profile.hasLiabilities;
      console.log(`   💳 Liabilities Count: ${Array.isArray(liabilities) ? liabilities.length : 0}`);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ User 18 HAS saved intake form data in the database!');
    
  } catch (error) {
    console.error('Error checking profile:', error);
  } finally {
    process.exit(0);
  }
}

checkUserProfile();