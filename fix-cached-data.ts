/**
 * Fix Cached Data for plaid@gmail.com
 * Clear the incorrect cached Monte Carlo results
 */

import { storage } from './server/storage';

console.log('🔧 FIXING CACHED DATA: plaid@gmail.com');
console.log('=' .repeat(50));

async function fixCachedData() {
  try {
    // Get user
    const user = await storage.getUserByEmail('plaid@gmail.com');
    if (!user) {
      throw new Error('User not found');
    }
    
    console.log(`✅ Found user: ${user.id}`);
    
    // Get current profile to see cached data
    const currentProfile = await storage.getFinancialProfile(user.id);
    if (!currentProfile) {
      throw new Error('Profile not found');
    }
    
    console.log('\n📊 CURRENT CACHED DATA:');
    const cachedMC = currentProfile?.monteCarloSimulation;
    if (cachedMC) {
      console.log('  Monte Carlo Simulation:');
      console.log('    retirementSimulation:', cachedMC.retirementSimulation ? 'EXISTS' : 'NULL');
      if (cachedMC.retirementSimulation?.results) {
        console.log(`    successProbability: ${cachedMC.retirementSimulation.results.successProbability}`);
        console.log(`    probabilityOfSuccess: ${cachedMC.retirementSimulation.results.probabilityOfSuccess}`);
      }
      console.log(`    probabilityOfSuccess (root): ${cachedMC.probabilityOfSuccess}`);
      console.log(`    medianEndingBalance: ${cachedMC.medianEndingBalance}`);
    } else {
      console.log('  No cached Monte Carlo data found');
    }
    
    console.log('\n🧹 CLEARING CACHED DATA:');
    
    // Clear the cached Monte Carlo data
    await storage.updateFinancialProfile(user.id, {
      monteCarloSimulation: null,
      retirementReadinessScore: null,
      // Also clear any related calculation cache
      calculations: null
    });
    
    console.log('✅ Cleared cached Monte Carlo data');
    console.log('✅ Cleared retirement readiness score');
    console.log('✅ Cleared calculations cache');
    
    // Verify it's cleared
    const updatedProfile = await storage.getFinancialProfile(user.id);
    console.log('\n✅ VERIFICATION:');
    console.log(`  Monte Carlo cleared: ${!updatedProfile?.monteCarloSimulation ? 'YES' : 'NO'}`);
    console.log(`  Retirement score cleared: ${!updatedProfile?.retirementReadinessScore ? 'YES' : 'NO'}`);
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Dashboard widget will no longer find cached data');
    console.log('2. User will see "Ready to Calculate" button');
    console.log('3. Clicking button will run fresh calculation');
    console.log('4. Fresh calculation should show ~100% success rate');
    console.log('5. Result will be cached with correct format');
    
    console.log('\n✅ Cache clearing completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to fix cached data:', error);
  }
}

fixCachedData();