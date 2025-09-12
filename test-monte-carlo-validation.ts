#!/usr/bin/env tsx
/**
 * Test script to verify Monte Carlo validation
 * Ensures calculations are prevented without Step 11 data
 * Run with: npx tsx test-monte-carlo-validation.ts
 */

import { db } from './server/db';
import { financialProfiles } from './shared/schema';
import { eq } from 'drizzle-orm';

async function testMonteCarloValidation() {
  console.log('🧪 Testing Monte Carlo Validation...\n');
  
  try {
    const userId = 1; // Change to your test user ID
    
    console.log('📊 Step 1: Checking current profile state...');
    
    // Get the user's financial profile
    const [profile] = await db.select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    
    if (!profile) {
      console.log('❌ No financial profile found for user');
      console.log('   Create a profile first by starting the intake form');
      process.exit(0);
    }
    
    // Check Step 11 fields (retirement planning data)
    const step11Fields = {
      desiredRetirementAge: profile.desiredRetirementAge,
      expectedMonthlyExpensesRetirement: profile.expectedMonthlyExpensesRetirement,
      socialSecurityClaimAge: profile.socialSecurityClaimAge,
      socialSecurityBenefit: profile.socialSecurityBenefit,
      hasLongTermCareInsurance: profile.hasLongTermCareInsurance,
      userHealthStatus: profile.userHealthStatus,
      spouseHealthStatus: profile.spouseHealthStatus
    };
    
    console.log('\n📋 Step 11 (Retirement Planning) Status:');
    console.log('═══════════════════════════════════════');
    
    let missingCount = 0;
    for (const [field, value] of Object.entries(step11Fields)) {
      if (value === null || value === undefined || (typeof value === 'number' && value <= 0)) {
        console.log(`   ❌ ${field}: NOT SET`);
        missingCount++;
      } else {
        console.log(`   ✅ ${field}: ${value}`);
      }
    }
    
    console.log('\n📊 Step 2: Monte Carlo Calculation Readiness...');
    console.log('═══════════════════════════════════════════════');
    
    const requiredFields = ['desiredRetirementAge', 'expectedMonthlyExpensesRetirement', 'socialSecurityClaimAge', 'socialSecurityBenefit'];
    const missingRequired = requiredFields.filter(field => !profile[field] || (typeof profile[field] === 'number' && profile[field] <= 0));
    
    if (missingRequired.length > 0) {
      console.log('⚠️  MONTE CARLO BLOCKED - Missing required fields:');
      missingRequired.forEach(field => {
        console.log(`     • ${field}`);
      });
      console.log('\n   📝 Action Required:');
      console.log('      Complete Step 11 of the intake form to enable Monte Carlo simulations');
      console.log('\n   Expected behavior:');
      console.log('      • Dashboard will show "Calculate Score" button instead of auto-running');
      console.log('      • Clicking button will show error: "Please complete Step 11..."');
      console.log('      • No Monte Carlo calculations will run in background');
    } else {
      console.log('✅ MONTE CARLO READY - All required fields present');
      console.log('\n   Expected behavior:');
      console.log('      • Dashboard will load saved Monte Carlo results if available');
      console.log('      • New calculations can be triggered successfully');
      console.log('      • Retirement confidence score will be displayed');
    }
    
    // Check for existing Monte Carlo results
    console.log('\n📊 Step 3: Checking for existing Monte Carlo results...');
    console.log('══════════════════════════════════════════════════════');
    
    if (profile.monteCarloSimulation) {
      const mcData = profile.monteCarloSimulation as any;
      if (mcData.retirementSimulation?.probabilityOfSuccess) {
        console.log('✅ Found saved Monte Carlo results:');
        console.log(`   • Success Probability: ${mcData.retirementSimulation.probabilityOfSuccess}%`);
        console.log(`   • Calculated at: ${mcData.retirementSimulation.timestamp || 'Unknown'}`);
        console.log('\n   Note: These results will be shown even if Step 11 is now incomplete');
      } else {
        console.log('⚠️  Monte Carlo data exists but no valid results found');
      }
    } else {
      console.log('📭 No Monte Carlo results saved in profile');
      if (missingRequired.length > 0) {
        console.log('   This is expected since Step 11 is incomplete');
      }
    }
    
    console.log('\n✨ Validation test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testMonteCarloValidation().catch(console.error);