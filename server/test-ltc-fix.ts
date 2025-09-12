import 'dotenv/config';
import { db } from './db';
import { financialProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function testLTCFix() {
  console.log('=== Testing Long-Term Care Insurance Fix ===\n');

  try {
    // Get a sample user's profile
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, 1))
      .limit(1);

    if (!profile) {
      console.log('No profile found for userId 1');
      return;
    }

    console.log('Current profile LTC status:');
    console.log('- hasLongTermCareInsurance column:', profile.hasLongTermCareInsurance);
    console.log('- Type:', typeof profile.hasLongTermCareInsurance);
    console.log('- Boolean value:', Boolean(profile.hasLongTermCareInsurance));

    // Test updating the hasLongTermCareInsurance field
    console.log('\nTesting update to hasLongTermCareInsurance = true...');
    
    const [updatedProfile] = await db
      .update(financialProfiles)
      .set({ 
        hasLongTermCareInsurance: true,
        lastUpdated: new Date()
      })
      .where(eq(financialProfiles.userId, 1))
      .returning();

    console.log('\nAfter update:');
    console.log('- hasLongTermCareInsurance column:', updatedProfile.hasLongTermCareInsurance);
    console.log('- Type:', typeof updatedProfile.hasLongTermCareInsurance);
    console.log('- Boolean value:', Boolean(updatedProfile.hasLongTermCareInsurance));

    // Test setting it to false
    console.log('\nTesting update to hasLongTermCareInsurance = false...');
    
    const [updatedProfile2] = await db
      .update(financialProfiles)
      .set({ 
        hasLongTermCareInsurance: false,
        lastUpdated: new Date()
      })
      .where(eq(financialProfiles.userId, 1))
      .returning();

    console.log('\nAfter second update:');
    console.log('- hasLongTermCareInsurance column:', updatedProfile2.hasLongTermCareInsurance);
    console.log('- Type:', typeof updatedProfile2.hasLongTermCareInsurance);
    console.log('- Boolean value:', Boolean(updatedProfile2.hasLongTermCareInsurance));

    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  }

  process.exit(0);
}

testLTCFix();