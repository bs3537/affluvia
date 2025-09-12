/**
 * Debug script to check financial profiles in the database
 * Run with: npx tsx server/debug-profiles.ts
 */

import { db } from './db';
import { users, financialProfiles } from '@shared/schema';
import dotenv from 'dotenv';

dotenv.config();

async function debugProfiles() {
  console.log('=== Debug Financial Profiles ===\n');
  
  try {
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`Total users in database: ${allUsers.length}`);
    
    if (allUsers.length === 0) {
      console.log('No users found in database');
      return;
    }
    
    console.log('\nUsers:');
    for (const user of allUsers) {
      console.log(`  ID: ${user.id}, Email: ${user.email}, Created: ${user.createdAt}`);
    }
    
    // Get all financial profiles
    const allProfiles = await db.select().from(financialProfiles);
    console.log(`\nTotal financial profiles: ${allProfiles.length}`);
    
    if (allProfiles.length === 0) {
      console.log('No financial profiles found in database');
      return;
    }
    
    console.log('\nFinancial Profiles:');
    for (const profile of allProfiles) {
      console.log(`\n  Profile ID: ${profile.id}`);
      console.log(`  User ID: ${profile.userId}`);
      console.log(`  Name: ${profile.firstName} ${profile.lastName}`);
      console.log(`  Marital Status: ${profile.maritalStatus}`);
      console.log(`  State: ${profile.state}`);
      console.log(`  Annual Income: ${profile.annualIncome}`);
      console.log(`  Is Complete: ${profile.isComplete}`);
      console.log(`  Last Updated: ${profile.lastUpdated}`);
      
      // Check for key data
      console.log(`  Has Assets: ${!!profile.assets}`);
      console.log(`  Has Calculations: ${!!profile.calculations}`);
      console.log(`  Has Risk Questions: ${!!profile.riskQuestions}`);
      console.log(`  Has Current Allocation: ${!!profile.currentAllocation}`);
      
      // Check which user this profile belongs to
      const matchingUser = allUsers.find(u => u.id === profile.userId);
      if (matchingUser) {
        console.log(`  ✓ Belongs to user: ${matchingUser.email}`);
      } else {
        console.log(`  ✗ WARNING: No matching user found for userId ${profile.userId}`);
      }
    }
    
    // Check for orphaned profiles
    console.log('\n=== Data Integrity Check ===');
    const userIds = new Set(allUsers.map(u => u.id));
    const orphanedProfiles = allProfiles.filter(p => !userIds.has(p.userId));
    
    if (orphanedProfiles.length > 0) {
      console.log(`\n⚠️  Found ${orphanedProfiles.length} orphaned profiles:`);
      for (const profile of orphanedProfiles) {
        console.log(`  Profile ID ${profile.id} references non-existent user ID ${profile.userId}`);
      }
    } else {
      console.log('\n✓ All profiles have valid user references');
    }
    
    // Check for users without profiles
    const profileUserIds = new Set(allProfiles.map(p => p.userId));
    const usersWithoutProfiles = allUsers.filter(u => !profileUserIds.has(u.id));
    
    if (usersWithoutProfiles.length > 0) {
      console.log(`\n⚠️  Found ${usersWithoutProfiles.length} users without profiles:`);
      for (const user of usersWithoutProfiles) {
        console.log(`  User ID ${user.id} (${user.email}) has no financial profile`);
      }
    } else {
      console.log('✓ All users have financial profiles');
    }
    
  } catch (error) {
    console.error('Error debugging profiles:', error);
  } finally {
    process.exit(0);
  }
}

debugProfiles();