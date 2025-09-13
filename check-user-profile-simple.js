import { db } from './server/db.js';
import { financialProfiles } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkUserProfile() {
  console.log('🔍 Checking financial profile for user 18...\n');
  
  try {
    // Simple select all query
    const profiles = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, 18));
    
    if (!profiles || profiles.length === 0) {
      console.log('❌ No financial profile found for user 18');
      process.exit(0);
    }
    
    const profile = profiles[0];
    
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
    console.log(`   Has Assets: ${profile.assets ? 'Yes' : 'No'}`);
    console.log(`   Has Liabilities: ${profile.liabilities ? 'Yes' : 'No'}`);
    console.log(`   Has Monthly Expenses: ${profile.monthlyExpenses ? 'Yes' : 'No'}`);
    console.log(`   Has Primary Residence: ${profile.primaryResidence ? 'Yes' : 'No'}`);
    
    // Scores
    console.log('\n📊 SCORES:');
    console.log(`   Financial Health Score: ${profile.financialHealthScore || 0}`);
    console.log(`   Retirement Readiness Score: ${profile.retirementReadinessScore || 0}`);
    console.log(`   Emergency Readiness Score: ${profile.emergencyReadinessScore || 0}`);
    console.log(`   Net Worth: $${profile.netWorth?.toLocaleString() || 0}`);
    console.log(`   Monthly Cash Flow: $${profile.monthlyCashFlow?.toLocaleString() || 0}`);
    
    // Status
    console.log('\n📈 STATUS:');
    console.log(`   Profile Complete: ${profile.isComplete ? 'Yes' : 'No'}`);
    console.log(`   Created: ${profile.createdAt ? new Date(profile.createdAt).toLocaleString() : 'Unknown'}`);
    console.log(`   Updated: ${profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'Unknown'}`);
    
    // Check for detailed data
    if (profile.assets) {
      const assets = typeof profile.assets === 'string' 
        ? JSON.parse(profile.assets) 
        : profile.assets;
      console.log(`\n   📦 Assets Count: ${Array.isArray(assets) ? assets.length : 0}`);
      if (Array.isArray(assets) && assets.length > 0) {
        console.log('   Asset Types:', assets.map(a => a.type).join(', '));
      }
    }
    
    if (profile.liabilities) {
      const liabilities = typeof profile.liabilities === 'string'
        ? JSON.parse(profile.liabilities)
        : profile.liabilities;
      console.log(`   💳 Liabilities Count: ${Array.isArray(liabilities) ? liabilities.length : 0}`);
      if (Array.isArray(liabilities) && liabilities.length > 0) {
        console.log('   Liability Types:', liabilities.map(l => l.type).join(', '));
      }
    }
    
    // Check for Monte Carlo data
    console.log('\n🎲 MONTE CARLO & CALCULATIONS:');
    console.log(`   Has Monte Carlo Simulation: ${profile.monteCarloSimulation ? 'Yes' : 'No'}`);
    console.log(`   Has Calculations: ${profile.calculations ? 'Yes' : 'No'}`);
    console.log(`   Has Net Worth Projections: ${profile.netWorthProjections ? 'Yes' : 'No'}`);
    
    // Check for risk profile
    console.log('\n⚖️ RISK PROFILE:');
    console.log(`   Has Risk Questions: ${profile.riskQuestions ? 'Yes' : 'No'}`);
    console.log(`   Has Current Allocation: ${profile.currentAllocation ? 'Yes' : 'No'}`);
    if (profile.maritalStatus === 'married') {
      console.log(`   Has Spouse Risk Questions: ${profile.spouseRiskQuestions ? 'Yes' : 'No'}`);
      console.log(`   Has Spouse Allocation: ${profile.spouseAllocation ? 'Yes' : 'No'}`);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Summary: User 18 HAS saved intake form data in the database!');
    console.log(`   Total fields populated: ${Object.keys(profile).filter(k => profile[k] !== null && profile[k] !== undefined).length}`);
    
  } catch (error) {
    console.error('Error checking profile:', error);
  } finally {
    process.exit(0);
  }
}

checkUserProfile();