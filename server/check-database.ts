import { db } from './db';
import { financialProfiles, users } from '../shared/schema';

async function checkData() {
  try {
    console.log('Checking database connection...\n');
    
    const userCount = await db.select().from(users);
    const profileCount = await db.select().from(financialProfiles);
    
    console.log('Database Status:');
    console.log('================');
    console.log('Users in database:', userCount.length);
    console.log('Financial profiles in database:', profileCount.length);
    
    if (userCount.length > 0) {
      console.log('\nExisting users:');
      userCount.forEach(user => {
        console.log(`- ${user.email} (ID: ${user.id}, Created: ${user.createdAt})`);
      });
    } else {
      console.log('\n⚠️  No users found in database');
    }
    
    if (profileCount.length > 0) {
      console.log('\nExisting profiles:');
      profileCount.forEach(profile => {
        console.log(`- User ID: ${profile.userId} (Created: ${profile.createdAt})`);
      });
    } else {
      console.log('⚠️  No financial profiles found in database');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Database connection successful! ✓');
    
    if (userCount.length === 0 && profileCount.length === 0) {
      console.log('\n📝 Note: Database is empty. You need to:');
      console.log('1. Register a new user');
      console.log('2. Fill out the intake form');
      console.log('3. Then the dashboard will be populated');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
}

checkData();