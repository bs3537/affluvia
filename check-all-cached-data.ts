/**
 * Check ALL cached data sources for plaid@gmail.com
 * Widget has multiple data loading paths that need to be cleared
 */

import { storage } from './server/storage';

console.log('🔍 COMPREHENSIVE CACHE CHECK: plaid@gmail.com');
console.log('=' .repeat(60));

async function checkAllCachedData() {
  try {
    // Get user
    const user = await storage.getUserByEmail('plaid@gmail.com');
    if (!user) {
      throw new Error('User not found');
    }
    
    console.log(`✅ Found user: ${user.id}`);
    
    // Get current profile
    const profile = await storage.getFinancialProfile(user.id);
    if (!profile) {
      throw new Error('Profile not found');
    }
    
    console.log('\n📊 DATA SOURCE 1: monteCarloSimulation');
    const mcSim = profile.monteCarloSimulation as any;
    if (mcSim) {
      console.log('❌ STILL EXISTS (should be null after clearing)');
      console.log(`  probabilityOfSuccess: ${mcSim.probabilityOfSuccess}`);
      console.log(`  medianEndingBalance: ${mcSim.medianEndingBalance}`);
      if (mcSim.retirementSimulation?.results) {
        console.log(`  results.successProbability: ${mcSim.retirementSimulation.results.successProbability}`);
        console.log(`  results.probabilityOfSuccess: ${mcSim.retirementSimulation.results.probabilityOfSuccess}`);
      }
    } else {
      console.log('✅ CLEARED (null as expected)');
    }
    
    console.log('\n📊 DATA SOURCE 2: calculations.retirementConfidenceScoreEnhanced');
    const calculations = profile.calculations as any;
    if (calculations?.retirementConfidenceScoreEnhanced) {
      console.log('🚨 FOUND CACHED DATA HERE! (This is likely the source of the 1%)');
      const cachedScore = calculations.retirementConfidenceScoreEnhanced;
      console.log(`  probabilityOfSuccess: ${cachedScore.probabilityOfSuccess}`);
      console.log(`  message: ${cachedScore.message}`);
      console.log(`  medianEndingBalance: ${cachedScore.medianEndingBalance}`);
      console.log(`  cached: ${cachedScore.cached}`);
      console.log(`  calculatedAt: ${cachedScore.calculatedAt}`);
      
      console.log('\n🎯 THIS IS THE PROBLEM!');
      console.log('  Widget loads this data first via /api/financial-profile');
      console.log('  This cached data contains the wrong probability value');
      console.log('  Need to clear this specific cache path too');
    } else {
      console.log('✅ No cached retirement confidence score found');
    }
    
    console.log('\n📊 DATA SOURCE 3: retirementReadinessScore');
    if (profile.retirementReadinessScore) {
      console.log(`❌ STILL EXISTS: ${profile.retirementReadinessScore} (should be null)`);
    } else {
      console.log('✅ CLEARED (null as expected)');
    }
    
    console.log('\n📊 DATA SOURCE 4: Other calculations cache');
    if (calculations) {
      const keys = Object.keys(calculations);
      console.log(`Found ${keys.length} cached calculations:`);
      keys.forEach(key => {
        console.log(`  - ${key}`);
      });
      
      // Look for any retirement-related caches
      const retirementKeys = keys.filter(k => 
        k.toLowerCase().includes('retirement') || 
        k.toLowerCase().includes('monte') || 
        k.toLowerCase().includes('confidence')
      );
      
      if (retirementKeys.length > 0) {
        console.log('🚨 Found retirement-related caches:');
        retirementKeys.forEach(key => {
          console.log(`  🎯 ${key}`);
          const data = calculations[key];
          if (data && typeof data === 'object' && data.probabilityOfSuccess !== undefined) {
            console.log(`    probabilityOfSuccess: ${data.probabilityOfSuccess}`);
          }
        });
      }
    } else {
      console.log('✅ No calculations cache found');
    }
    
  } catch (error) {
    console.error('❌ Cache check failed:', error);
  }
}

checkAllCachedData();