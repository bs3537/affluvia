#!/usr/bin/env tsx
/**
 * Test script to verify Plaid sync to financial_profiles
 * Run with: npx tsx test-plaid-sync.ts
 */

import { db } from './server/db';
import { financialProfiles, plaidAccounts, plaidItems } from './shared/schema';
import { eq, and } from 'drizzle-orm';

async function testPlaidSync() {
  console.log('🧪 Testing Plaid Data Flow...\n');
  
  try {
    const userId = 17; // Change to your test user ID
    
    console.log(`📊 Step 1: Checking plaid_accounts table (from Connections page)...`);
    
    // Check if there are accounts in plaid_accounts table
    const plaidAccountsData = await db.select()
      .from(plaidAccounts)
      .innerJoin(plaidItems, eq(plaidAccounts.plaidItemId, plaidItems.id))
      .where(and(
        eq(plaidAccounts.userId, userId),
        eq(plaidAccounts.isActive, true)
      ));
    
    console.log(`   Found ${plaidAccountsData.length} accounts in plaid_accounts table`);
    
    if (plaidAccountsData.length > 0) {
      console.log('\n   Sample accounts:');
      plaidAccountsData.slice(0, 3).forEach((row, i) => {
        const account = row.plaid_accounts;
        const item = row.plaid_items;
        console.log(`   ${i + 1}. ${account.accountName || 'Account'} at ${item.institutionName}`);
        console.log(`      Type: ${account.accountType}/${account.accountSubtype}`);
        console.log(`      Balance: $${account.currentBalance}`);
        console.log(`      Last synced: ${account.lastSynced}`);
      });
    }
    
    console.log(`\n📊 Step 2: Checking financial_profiles table (for intake form)...`);
    
    // Check financial_profiles
    const [profile] = await db.select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    
    if (!profile) {
      console.log('   ❌ No financial profile found for user');
      console.log('   Creating one now...');
      await db.insert(financialProfiles).values({
        userId,
        assets: JSON.stringify([]),
        liabilities: JSON.stringify([]),
      });
      console.log('   ✅ Profile created');
    } else {
      const assets = (profile.assets as any[]) || [];
      const liabilities = (profile.liabilities as any[]) || [];
      
      console.log(`   Financial profile exists:`);
      console.log(`   - Total assets: ${assets.length}`);
      console.log(`     • Plaid imported: ${assets.filter(a => a._source?.isImported).length}`);
      console.log(`     • Manual entries: ${assets.filter(a => !a._source?.isImported).length}`);
      console.log(`   - Total liabilities: ${liabilities.length}`);
      console.log(`     • Plaid imported: ${liabilities.filter(l => l._source?.isImported).length}`);
      console.log(`     • Manual entries: ${liabilities.filter(l => !l._source?.isImported).length}`);
      
      // Show Plaid imported items
      const plaidAssets = assets.filter(a => a._source?.isImported);
      if (plaidAssets.length > 0) {
        console.log('\n   Plaid-imported assets in profile:');
        plaidAssets.forEach((asset, i) => {
          console.log(`   ${i + 1}. ${asset.type}: ${asset.description}`);
          console.log(`      Value: $${asset.value}, Owner: ${asset.owner}`);
          console.log(`      From: ${asset._source.institutionName}`);
        });
      }
      
      const plaidLiabilities = liabilities.filter(l => l._source?.isImported);
      if (plaidLiabilities.length > 0) {
        console.log('\n   Plaid-imported liabilities in profile:');
        plaidLiabilities.forEach((liability, i) => {
          console.log(`   ${i + 1}. ${liability.type}: ${liability.description}`);
          console.log(`      Balance: $${liability.balance}, Owner: ${liability.owner}`);
          console.log(`      From: ${liability._source.institutionName}`);
        });
      }
    }
    
    console.log('\n📊 Step 3: Diagnosis...\n');
    
    if (plaidAccountsData.length === 0) {
      console.log('⚠️  No accounts in plaid_accounts table');
      console.log('   → Solution: Connect accounts via regular Connections page first');
      console.log('   → Then sync them in Connections2');
    } else {
      const profileAssets = ((profile?.assets as any[]) || []).filter(a => a._source?.isImported);
      const profileLiabilities = ((profile?.liabilities as any[]) || []).filter(l => l._source?.isImported);
      
      if (profileAssets.length === 0 && profileLiabilities.length === 0) {
        console.log('⚠️  Accounts exist in plaid_accounts but not in financial_profiles');
        console.log('   → Solution: Go to Connections2 and click "Sync All to Profile"');
        console.log('   → This will copy the data to financial_profiles for intake form');
      } else {
        console.log('✅ Data flow is working correctly!');
        console.log('   - Accounts synced from Plaid → plaid_accounts (Connections)');
        console.log('   - Data copied to financial_profiles (Connections2)');
        console.log('   - Intake form will auto-populate from financial_profiles');
      }
    }
    
    console.log('\n✨ Test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testPlaidSync().catch(console.error);