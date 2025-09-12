#!/usr/bin/env tsx
/**
 * Test script to verify Connections2 functionality
 * Run with: npx tsx test-connections2.ts
 */

import { db } from './server/db';
import { financialProfiles } from './shared/schema';
import { eq } from 'drizzle-orm';

async function testConnections2() {
  console.log('🧪 Testing Connections2 Direct Database Mapping...\n');
  
  try {
    // Test user ID - replace with actual user ID from your database
    const userId = 1; // Change this to a valid user ID
    
    console.log(`📊 Checking financial profile for user ${userId}...`);
    
    // Get the financial profile
    const [profile] = await db.select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    
    if (!profile) {
      console.log('❌ No financial profile found for this user.');
      console.log('   Please ensure the user exists and has a financial profile.');
      return;
    }
    
    console.log('✅ Financial profile found\n');
    
    // Check for Plaid-imported data in assets
    const assets = (profile.assets as any[]) || [];
    const importedAssets = assets.filter(a => a._source?.isImported);
    
    console.log('📈 Assets Analysis:');
    console.log(`   Total assets: ${assets.length}`);
    console.log(`   Imported from Plaid: ${importedAssets.length}`);
    
    if (importedAssets.length > 0) {
      console.log('\n   Imported Assets:');
      importedAssets.forEach((asset, i) => {
        console.log(`   ${i + 1}. ${asset.type}: ${asset.description}`);
        console.log(`      Value: $${asset.value}`);
        console.log(`      Owner: ${asset.owner}`);
        console.log(`      Institution: ${asset._source.institutionName}`);
        console.log(`      Last Synced: ${asset._source.lastSynced}`);
      });
    }
    
    // Check for Plaid-imported data in liabilities
    const liabilities = (profile.liabilities as any[]) || [];
    const importedLiabilities = liabilities.filter(l => l._source?.isImported);
    
    console.log('\n📉 Liabilities Analysis:');
    console.log(`   Total liabilities: ${liabilities.length}`);
    console.log(`   Imported from Plaid: ${importedLiabilities.length}`);
    
    if (importedLiabilities.length > 0) {
      console.log('\n   Imported Liabilities:');
      importedLiabilities.forEach((liability, i) => {
        console.log(`   ${i + 1}. ${liability.type}: ${liability.description}`);
        console.log(`      Balance: $${liability.balance}`);
        console.log(`      Owner: ${liability.owner}`);
        console.log(`      Institution: ${liability._source.institutionName}`);
        console.log(`      Last Synced: ${liability._source.lastSynced}`);
      });
    }
    
    // Check for mortgages in primary residence
    const primaryResidence = profile.primaryResidence as any;
    if (primaryResidence?._source?.isImported) {
      console.log('\n🏠 Primary Mortgage:');
      console.log(`   Balance: $${primaryResidence.mortgageBalance}`);
      console.log(`   Institution: ${primaryResidence._source.institutionName}`);
      console.log(`   Last Synced: ${primaryResidence._source.lastSynced}`);
    }
    
    // Summary
    console.log('\n📊 Summary:');
    if (importedAssets.length > 0 || importedLiabilities.length > 0) {
      console.log('✅ Plaid data is being successfully mapped to financial_profiles!');
      console.log(`   - ${importedAssets.length} assets imported`);
      console.log(`   - ${importedLiabilities.length} liabilities imported`);
      
      // Calculate totals
      const totalAssetValue = importedAssets.reduce((sum, a) => sum + (a.value || 0), 0);
      const totalLiabilityBalance = importedLiabilities.reduce((sum, l) => sum + (l.balance || 0), 0);
      
      console.log(`\n💰 Total imported asset value: $${totalAssetValue.toLocaleString()}`);
      console.log(`💳 Total imported liability balance: $${totalLiabilityBalance.toLocaleString()}`);
      console.log(`📈 Net worth from imported accounts: $${(totalAssetValue - totalLiabilityBalance).toLocaleString()}`);
    } else {
      console.log('⚠️  No Plaid-imported data found in financial_profiles.');
      console.log('   To test the functionality:');
      console.log('   1. Navigate to Connections2 in the UI');
      console.log('   2. Connect your bank accounts via Plaid');
      console.log('   3. Click "Sync All to Profile"');
      console.log('   4. Run this test again to verify the data is stored correctly');
    }
    
    console.log('\n✨ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testConnections2().catch(console.error);