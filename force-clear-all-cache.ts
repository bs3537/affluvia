/**
 * Force clear ALL cached data for plaid@gmail.com
 * The previous cache clear didn't work - need to be more aggressive
 */

import { storage } from './server/storage';

console.log('🧹 FORCE CLEARING ALL CACHE: plaid@gmail.com');
console.log('=' .repeat(50));

async function forceClearAllCache() {
  try {
    // Get user
    const user = await storage.getUserByEmail('plaid@gmail.com');
    if (!user) {
      throw new Error('User not found');
    }
    
    console.log(`✅ Found user: ${user.id}`);
    
    console.log('\n🧹 AGGRESSIVE CACHE CLEARING:');
    
    // Clear ALL retirement-related caches with explicit null values
    const clearedData = {
      // Monte Carlo cache
      monteCarloSimulation: null,
      
      // Retirement readiness
      retirementReadinessScore: null,
      
      // All calculations cache
      calculations: null,
      
      // Any other retirement-related fields
      retirementOptimizationResults: null,
      retirementProjections: null,
    };
    
    console.log('Clearing the following fields:');
    Object.keys(clearedData).forEach(key => {
      console.log(`  - ${key} → null`);
    });
    
    // Update profile with cleared data
    await storage.updateFinancialProfile(user.id, clearedData);
    
    console.log('\n✅ ALL CACHES CLEARED');
    
    // Verify the clearing worked
    console.log('\n🔍 VERIFICATION:');
    const updatedProfile = await storage.getFinancialProfile(user.id);
    
    console.log(`monteCarloSimulation: ${updatedProfile?.monteCarloSimulation ? 'STILL EXISTS ❌' : 'CLEARED ✅'}`);
    console.log(`retirementReadinessScore: ${updatedProfile?.retirementReadinessScore ? 'STILL EXISTS ❌' : 'CLEARED ✅'}`);
    console.log(`calculations: ${updatedProfile?.calculations ? 'STILL EXISTS ❌' : 'CLEARED ✅'}`);
    
    // Double-check what the widget will now see
    console.log('\n🎯 WIDGET DATA LOADING TEST:');
    
    // Test path 1: checkSavedData (loads from /api/financial-profile)
    console.log('Path 1: /api/financial-profile → calculations.retirementConfidenceScoreEnhanced');
    const calc = (updatedProfile?.calculations as any);
    if (calc?.retirementConfidenceScoreEnhanced) {
      console.log(`❌ Widget will still find cached data: ${calc.retirementConfidenceScoreEnhanced.probabilityOfSuccess}`);
    } else {
      console.log('✅ Widget will NOT find cached data (good)');
    }
    
    // Test path 2: fetchSavedResult (loads from monteCarloSimulation)
    console.log('Path 2: /api/financial-profile → monteCarloSimulation.retirementSimulation');
    if (updatedProfile?.monteCarloSimulation) {
      console.log(`❌ Widget will still find cached Monte Carlo: ${(updatedProfile.monteCarloSimulation as any).probabilityOfSuccess}`);
    } else {
      console.log('✅ Widget will NOT find cached Monte Carlo (good)');
    }
    
    console.log('\n🎯 EXPECTED WIDGET BEHAVIOR:');
    console.log('1. Widget loads and finds NO cached data');
    console.log('2. Widget shows "Generate Retirement Analysis" button');
    console.log('3. User clicks button');
    console.log('4. Fresh calculation runs with our corrected algorithm');
    console.log('5. Result shows ~100% instead of 1%');
    
    console.log('\n✅ FORCE CACHE CLEARING COMPLETED');
    
  } catch (error) {
    console.error('❌ Force cache clearing failed:', error);
  }
}

forceClearAllCache();