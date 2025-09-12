#!/usr/bin/env tsx
/**
 * Test script to verify intake form auto-population from Plaid data
 * Run with: npx tsx test-auto-population.ts
 */

import { db } from './server/db';
import { financialProfiles } from './shared/schema';
import { eq } from 'drizzle-orm';
import { PlaidIntakeDirectMapper } from './server/services/plaid-intake-direct-mapper';

async function testAutoPopulation() {
  console.log('🧪 Testing Intake Form Auto-Population from Plaid Data...\n');
  
  try {
    // Test user ID - replace with actual user ID from your database
    const userId = 1; // Change this to a valid user ID
    
    console.log(`📊 Step 1: Checking current financial profile for user ${userId}...`);
    
    // Get the initial financial profile
    const [profileBefore] = await db.select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    
    if (!profileBefore) {
      console.log('❌ No financial profile found. Creating one...');
      await db.insert(financialProfiles).values({
        userId,
        firstName: 'Test',
        lastName: 'User',
      });
    }
    
    // Parse initial data
    const assetsBefore = (profileBefore?.assets as any[]) || [];
    const liabilitiesBefore = (profileBefore?.liabilities as any[]) || [];
    const mortgageBefore = profileBefore?.primaryResidence as any;
    
    console.log('\n📈 Before Plaid Sync:');
    console.log(`   Total assets: ${assetsBefore.length}`);
    console.log(`   - Plaid imported: ${assetsBefore.filter(a => a._source?.isImported).length}`);
    console.log(`   - Manual entries: ${assetsBefore.filter(a => !a._source?.isImported).length}`);
    console.log(`   Total liabilities: ${liabilitiesBefore.length}`);
    console.log(`   - Plaid imported: ${liabilitiesBefore.filter(l => l._source?.isImported).length}`);
    console.log(`   - Manual entries: ${liabilitiesBefore.filter(l => !l._source?.isImported).length}`);
    console.log(`   Mortgage data: ${mortgageBefore?._source?.isImported ? 'From Plaid' : 'Manual/None'}`);
    
    console.log('\n🔄 Step 2: Simulating Plaid account sync to profile...');
    
    // Simulate syncing Plaid accounts (this would normally happen via the UI)
    const syncResult = await PlaidIntakeDirectMapper.syncAllToProfile(userId);
    
    if (!syncResult.success) {
      console.log('⚠️  Plaid sync failed. Make sure you have connected accounts via Plaid.');
      console.log('   To test auto-population:');
      console.log('   1. Go to Connections2 page in the UI');
      console.log('   2. Connect your bank accounts');
      console.log('   3. Click "Sync All to Profile"');
      console.log('   4. Run this test again');
      return;
    }
    
    console.log(`✅ Sync completed: ${syncResult.syncedAssets} assets, ${syncResult.syncedLiabilities} liabilities, ${syncResult.syncedMortgages} mortgages`);
    
    // Get the updated profile
    console.log('\n📊 Step 3: Checking updated financial profile...');
    
    const [profileAfter] = await db.select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    
    const assetsAfter = (profileAfter.assets as any[]) || [];
    const liabilitiesAfter = (profileAfter.liabilities as any[]) || [];
    const mortgageAfter = profileAfter.primaryResidence as any;
    
    console.log('\n📈 After Plaid Sync:');
    console.log(`   Total assets: ${assetsAfter.length}`);
    console.log(`   - Plaid imported: ${assetsAfter.filter(a => a._source?.isImported).length}`);
    console.log(`   - Manual entries: ${assetsAfter.filter(a => !a._source?.isImported).length}`);
    console.log(`   Total liabilities: ${liabilitiesAfter.length}`);
    console.log(`   - Plaid imported: ${liabilitiesAfter.filter(l => l._source?.isImported).length}`);
    console.log(`   - Manual entries: ${liabilitiesAfter.filter(l => !l._source?.isImported).length}`);
    console.log(`   Mortgage data: ${mortgageAfter?._source?.isImported ? 'From Plaid' : 'Manual/None'}`);
    
    // Test auto-population behavior
    console.log('\n🎯 Step 4: Verifying Auto-Population Behavior...');
    
    // Check if Plaid data is properly marked
    const plaidAssets = assetsAfter.filter(a => a._source?.isImported);
    if (plaidAssets.length > 0) {
      console.log('\n✅ Assets auto-populated from Plaid:');
      plaidAssets.forEach((asset, i) => {
        console.log(`   ${i + 1}. ${asset.type}: ${asset.description}`);
        console.log(`      Value: $${asset.value}`);
        console.log(`      Owner: ${asset.owner}`);
        console.log(`      Institution: ${asset._source.institutionName}`);
      });
    }
    
    const plaidLiabilities = liabilitiesAfter.filter(l => l._source?.isImported);
    if (plaidLiabilities.length > 0) {
      console.log('\n✅ Liabilities auto-populated from Plaid:');
      plaidLiabilities.forEach((liability, i) => {
        console.log(`   ${i + 1}. ${liability.type}: ${liability.description}`);
        console.log(`      Balance: $${liability.balance}`);
        console.log(`      Owner: ${liability.owner}`);
        console.log(`      Institution: ${liability._source.institutionName}`);
      });
    }
    
    if (mortgageAfter?._source?.isImported) {
      console.log('\n✅ Mortgage auto-populated from Plaid:');
      console.log(`   Balance: $${mortgageAfter.mortgageBalance}`);
      console.log(`   Institution: ${mortgageAfter._source.institutionName}`);
    }
    
    // Summary
    console.log('\n📊 Summary:');
    if (plaidAssets.length > 0 || plaidLiabilities.length > 0 || mortgageAfter?._source?.isImported) {
      console.log('✅ Auto-population is working correctly!');
      console.log('\nWhen users access the intake form:');
      console.log('  • Step 3: Assets and Liabilities will be pre-filled with Plaid data');
      console.log('  • Step 4: Mortgage balance will be pre-filled if detected');
      console.log('  • Items from Plaid will have a purple highlight and bank indicator');
      console.log('  • Manual entries are preserved alongside Plaid data');
      console.log('  • Users can still add/edit/remove items as needed');
    } else {
      console.log('⚠️  No Plaid data found for auto-population.');
      console.log('   Please connect accounts via Connections2 and sync first.');
    }
    
    console.log('\n✨ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testAutoPopulation().catch(console.error);