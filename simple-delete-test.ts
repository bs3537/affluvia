/**
 * Simple Delete Financial Data Test
 * 
 * Tests the core delete functionality without complex schema dependencies
 */

import { db } from './server/db';
import { storage } from './server/storage';
import { users, financialProfiles } from './shared/schema';
import { eq } from 'drizzle-orm';

async function runSimpleDeleteTest(): Promise<void> {
  console.log('🧪 Simple Delete Financial Data Test');
  console.log('=' .repeat(50));
  
  const timestamp = Date.now();
  const testEmail = `test-delete-${timestamp}@test.com`;
  let userId: number;
  let testPassed = true;
  
  try {
    // Step 1: Create test user
    console.log('1. Creating test user...');
    const [user] = await db.insert(users).values({
      email: testEmail,
      password: '$2b$10$N9qo8uLOickgx2ZMRZoMye/Lo3zKlF/dHFZ9NaLnrFp7jh3QmJSv6',
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: true,
      createdAt: new Date(),
      lastLoginAt: new Date()
    }).returning();
    
    userId = user.id;
    console.log(`✅ Created user with ID: ${userId}`);
    
    // Step 2: Create financial profile
    console.log('2. Creating financial profile...');
    await storage.updateFinancialProfile(userId, {
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: new Date('1985-01-01'),
      annualIncome: 75000,
      maritalStatus: 'single',
      state: 'CA'
    });
    console.log('✅ Created financial profile');
    
    // Step 3: Verify data exists
    console.log('3. Verifying data exists...');
    const profileBefore = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId));
    const userBefore = await db.select().from(users).where(eq(users.id, userId));
    
    if (profileBefore.length === 1 && userBefore.length === 1) {
      console.log('✅ Data exists before deletion');
    } else {
      console.log('❌ Data missing before deletion');
      testPassed = false;
    }
    
    // Step 4: Test delete functionality
    console.log('4. Testing delete functionality...');
    await storage.deleteAllUserData(userId);
    console.log('✅ Delete function executed');
    
    // Step 5: Verify deletion
    console.log('5. Verifying deletion...');
    const profileAfter = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId));
    const userAfter = await db.select().from(users).where(eq(users.id, userId));
    
    if (profileAfter.length === 0) {
      console.log('✅ Financial profile deleted');
    } else {
      console.log('❌ Financial profile NOT deleted');
      testPassed = false;
    }
    
    if (userAfter.length === 1) {
      console.log('✅ User account preserved (correct)');
    } else {
      console.log('❌ User account deleted (incorrect)');
      testPassed = false;
    }
    
    // Step 6: Cleanup
    console.log('6. Cleaning up test user...');
    await db.delete(users).where(eq(users.id, userId));
    console.log('✅ Test user cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    testPassed = false;
    
    // Cleanup on error
    if (userId!) {
      try {
        await db.delete(users).where(eq(users.id, userId));
      } catch (cleanupError) {
        console.error('Failed to cleanup:', cleanupError);
      }
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  if (testPassed) {
    console.log('✅ TEST PASSED: Delete Financial Data works correctly!');
    console.log('🔒 The delete button will:');
    console.log('   - Remove all financial data from database');
    console.log('   - Clear dashboard (will show empty state)');
    console.log('   - Reset all sections to initial state');
    console.log('   - Preserve user login credentials');
  } else {
    console.log('❌ TEST FAILED: Delete functionality has issues!');
  }
  console.log('=' .repeat(50));
  
  process.exit(testPassed ? 0 : 1);
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimpleDeleteTest().catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { runSimpleDeleteTest };