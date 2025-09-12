import { storage } from './storage';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testDatabaseConnection() {
  console.log('=== Testing Database Connection ===');
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  try {
    
    // Test 1: Get all users
    console.log('\nTest 1: Getting all users...');
    const users = await storage.getUsers();
    console.log(`Found ${users.length} users`);
    
    if (users.length > 0) {
      const firstUser = users[0];
      console.log(`First user: ${firstUser.email} (ID: ${firstUser.id})`);
      
      // Test 2: Get financial profile for first user
      console.log(`\nTest 2: Getting financial profile for user ${firstUser.id}...`);
      const profile = await storage.getFinancialProfile(firstUser.id);
      
      if (profile) {
        console.log('Profile found!');
        console.log('Profile data exists:', {
          hasFirstName: !!profile.firstName,
          hasLastName: !!profile.lastName,
          hasDateOfBirth: !!profile.dateOfBirth,
          hasAnnualIncome: !!profile.annualIncome,
          hasAssets: !!profile.assets && profile.assets.length > 0,
          hasLiabilities: !!profile.liabilities && profile.liabilities.length > 0,
          hasOptimizationVariables: !!profile.optimizationVariables,
          lastUpdated: profile.lastUpdated
        });
        
        // Show first few assets if any
        if (profile.assets && profile.assets.length > 0) {
          console.log(`\nFound ${profile.assets.length} assets`);
          console.log('First asset:', profile.assets[0]);
        }
      } else {
        console.log('No profile found for this user');
      }
    }
    
    console.log('\n=== Database connection test completed successfully ===');
  } catch (error) {
    console.error('Database connection test failed:', error);
  }
  
  process.exit(0);
}

testDatabaseConnection();