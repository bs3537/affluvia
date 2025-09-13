import { db } from './server/db.js';
import { financialProfiles } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkRetirementField() {
  const [profile] = await db
    .select({
      userId: financialProfiles.userId,
      expectedMonthlyExpensesRetirement: financialProfiles.expectedMonthlyExpensesRetirement,
      desiredRetirementAge: financialProfiles.desiredRetirementAge,
      socialSecurityBenefit: financialProfiles.socialSecurityBenefit
    })
    .from(financialProfiles)
    .where(eq(financialProfiles.userId, 18));
  
  console.log('User 18 Retirement Data:');
  console.log('  Expected Monthly Expenses Retirement:', profile?.expectedMonthlyExpensesRetirement || 'NULL');
  console.log('  Desired Retirement Age:', profile?.desiredRetirementAge || 'NULL');
  console.log('  Social Security Benefit:', profile?.socialSecurityBenefit || 'NULL');
  
  process.exit(0);
}

checkRetirementField();