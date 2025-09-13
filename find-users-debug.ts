#!/usr/bin/env tsx

/**
 * Find valid user IDs with profiles for debugging
 */

import { db } from './server/db';
import { financialProfiles } from '@shared/schema';

async function findUsersWithProfiles() {
  try {
    console.log('=== Finding Users with Financial Profiles ===');
    
    // Get all profiles with basic info
    const profiles = await db
      .select({
        userId: financialProfiles.userId,
        firstName: financialProfiles.firstName,
        lastName: financialProfiles.lastName,
        expectedMonthlyExpensesRetirement: financialProfiles.expectedMonthlyExpensesRetirement,
        lastUpdated: financialProfiles.lastUpdated,
        isComplete: financialProfiles.isComplete
      })
      .from(financialProfiles)
      .orderBy(financialProfiles.lastUpdated)
      .limit(10);
    
    console.log(`Found ${profiles.length} profiles:`);
    
    profiles.forEach((profile, index) => {
      console.log(`\n${index + 1}. User ID: ${profile.userId}`);
      console.log(`   Name: ${profile.firstName || 'Unknown'} ${profile.lastName || ''}`.trim());
      console.log(`   Expected Monthly Expenses: $${profile.expectedMonthlyExpensesRetirement || 'Not Set'}`);
      console.log(`   Is Complete: ${profile.isComplete || 'No'}`);
      console.log(`   Last Updated: ${profile.lastUpdated}`);
    });
    
    // Find profiles with completed retirement data
    const completedProfiles = profiles.filter(p => 
      p.expectedMonthlyExpensesRetirement && 
      Number(p.expectedMonthlyExpensesRetirement) > 0
    );
    
    console.log(`\n📊 Profiles with retirement expenses set: ${completedProfiles.length}`);
    
    if (completedProfiles.length > 0) {
      const testUser = completedProfiles[0];
      console.log(`\n🎯 Recommend testing with User ID: ${testUser.userId}`);
      console.log(`   Monthly Expenses: $${testUser.expectedMonthlyExpensesRetirement}`);
    }
    
  } catch (error) {
    console.error('❌ Error finding users:', error);
  }
}

findUsersWithProfiles().then(() => {
  console.log('\n✅ User search complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});