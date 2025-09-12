/**
 * Quick test to verify retirement calculation API works after fixing import
 */

import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';

console.log('🧪 TESTING RETIREMENT CALCULATION AFTER IMPORT FIX');

async function testRetirementCalculation() {
  try {
    // Get user
    const user = await storage.getUserByEmail('plaid@gmail.com');
    if (!user) {
      throw new Error('User not found');
    }
    
    const profile = await storage.getFinancialProfile(user.id);
    if (!profile) {
      throw new Error('Profile not found');
    }

    console.log('✅ User and profile loaded');
    
    // Test parameter conversion (this was failing before)
    const params = profileToRetirementParams(profile);
    
    console.log('✅ Parameter conversion successful');
    console.log(`  Current Age: ${params.currentAge}`);
    console.log(`  Retirement Assets: $${params.currentRetirementAssets.toLocaleString()}`);
    console.log(`  Tax Rate: ${(params.taxRate * 100).toFixed(2)}%`);
    
    console.log('\n🎯 IMPORT FIX SUCCESSFUL');
    console.log('API endpoint should now work properly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      console.log('\n🔍 Still have module import issues...');
      console.log('Error details:', error.message);
    }
  }
}

testRetirementCalculation();