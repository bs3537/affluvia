import { db } from './db';
import { users, financialProfiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function verifyDashboardData() {
  try {
    console.log('Verifying dashboard data...\n');
    
    // Get the test user
    const [user] = await db.select().from(users).where(eq(users.email, 'test@example.com'));
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    console.log('✅ User found:', user.email);
    
    // Get the financial profile
    const [profile] = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, user.id));
    
    if (!profile) {
      console.log('❌ Financial profile not found');
      process.exit(1);
    }
    
    console.log('✅ Financial profile found');
    console.log('\nProfile Details:');
    console.log('================');
    console.log('Name:', profile.firstName, profile.lastName);
    console.log('Age:', new Date().getFullYear() - new Date(profile.dateOfBirth!).getFullYear());
    console.log('Marital Status:', profile.maritalStatus);
    console.log('State:', profile.state);
    
    // Parse and display assets
    const assets = typeof profile.assets === 'string' ? JSON.parse(profile.assets) : profile.assets;
    console.log('\nAssets:');
    let totalAssets = 0;
    assets.forEach((asset: any) => {
      console.log(`- ${asset.type}: $${asset.value.toLocaleString()}`);
      totalAssets += asset.value;
    });
    console.log('Total Assets: $' + totalAssets.toLocaleString());
    
    console.log('\nRetirement Planning:');
    console.log('- Desired Retirement Age:', profile.desiredRetirementAge);
    console.log('- Life Expectancy:', profile.userLifeExpectancy);
    console.log('- Social Security Benefit: $' + profile.socialSecurityBenefit);
    console.log('- Monthly Expenses in Retirement: $' + profile.expectedMonthlyExpensesRetirement);
    
    console.log('\nMonthly Contributions:');
    console.log('- 401k: $' + profile.monthlyContribution401k);
    console.log('- IRA: $' + profile.monthlyContributionIRA);
    console.log('- Roth IRA: $' + profile.monthlyContributionRothIRA);
    console.log('- Brokerage: $' + profile.monthlyContributionBrokerage);
    
    const totalMonthlyContributions = 
      Number(profile.monthlyContribution401k || 0) +
      Number(profile.monthlyContributionIRA || 0) +
      Number(profile.monthlyContributionRothIRA || 0) +
      Number(profile.monthlyContributionBrokerage || 0);
    
    console.log('Total Monthly: $' + totalMonthlyContributions.toLocaleString());
    console.log('Total Annual: $' + (totalMonthlyContributions * 12).toLocaleString());
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All data verified successfully!');
    console.log('\nThe dashboard should now show:');
    console.log('- Financial Health Score');
    console.log('- Net Worth: ~$602,000');
    console.log('- Retirement Confidence Score');
    console.log('- Monthly Cash Flow');
    console.log('- Asset Allocation');
    console.log('- Personalized Recommendations');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying data:', error);
    process.exit(1);
  }
}

verifyDashboardData();