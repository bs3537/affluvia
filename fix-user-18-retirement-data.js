import { db } from './server/db.js';
import { financialProfiles } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function fixRetirementData() {
  console.log('🔧 Fixing retirement data for user 18...\n');
  
  try {
    // Get current profile
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, 18));
    
    if (!profile) {
      console.log('❌ No profile found');
      process.exit(1);
    }
    
    console.log('Current retirement data:');
    console.log(`  Monthly Retirement Expenses: $${profile.expectedMonthlyExpensesRetirement || 0}`);
    console.log(`  Social Security Benefit: $${profile.socialSecurityBenefit || 0}`);
    console.log(`  Desired Retirement Age: ${profile.desiredRetirementAge || 'Not set'}`);
    
    // Calculate reasonable retirement expenses based on current expenses
    const monthlyExpenses = profile.monthlyExpenses || {};
    const currentTotalExpenses = Object.values(monthlyExpenses)
      .reduce((sum, val) => sum + (Number(val) || 0), 0);
    
    // Use 80% of current expenses as retirement expenses (common planning assumption)
    const estimatedRetirementExpenses = Math.round(currentTotalExpenses * 0.8);
    
    console.log(`\n📊 Calculating retirement expenses:`);
    console.log(`  Current monthly expenses: $${currentTotalExpenses.toLocaleString()}`);
    console.log(`  Estimated retirement expenses (80%): $${estimatedRetirementExpenses.toLocaleString()}`);
    
    if (estimatedRetirementExpenses === 0) {
      // If still 0, use a reasonable default based on income
      const annualIncome = Number(profile.annualIncome) || 100000;
      const monthlyRetirementExpenses = Math.round((annualIncome * 0.7) / 12); // 70% income replacement
      
      console.log(`  Using income-based estimate: $${monthlyRetirementExpenses.toLocaleString()}/month`);
      
      // Update the profile
      await db
        .update(financialProfiles)
        .set({
          expectedMonthlyExpensesRetirement: monthlyRetirementExpenses.toString(),
          updatedAt: new Date()
        })
        .where(eq(financialProfiles.userId, 18));
      
      console.log(`\n✅ Updated retirement expenses to $${monthlyRetirementExpenses.toLocaleString()}/month`);
    } else {
      // Update with calculated value
      await db
        .update(financialProfiles)
        .set({
          expectedMonthlyExpensesRetirement: estimatedRetirementExpenses.toString(),
          updatedAt: new Date()
        })
        .where(eq(financialProfiles.userId, 18));
      
      console.log(`\n✅ Updated retirement expenses to $${estimatedRetirementExpenses.toLocaleString()}/month`);
    }
    
    console.log('\n🎯 Next step: Triggering profile recalculation...');
    
    // Trigger recalculation via API
    const response = await fetch('http://localhost:3004/api/financial-profile/recalculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real scenario, you'd need proper authentication
      },
      body: JSON.stringify({ userId: 18 })
    });
    
    if (response.ok) {
      console.log('✅ Profile recalculation triggered successfully');
      const result = await response.json();
      
      console.log('\n📈 Recalculation Results:');
      console.log(`  Health Score: ${result.calculations?.healthScore || 'N/A'}`);
      console.log(`  Retirement Score: ${result.calculations?.retirementScore || 'N/A'}`);
      console.log(`  Monte Carlo Success Rate: ${result.monteCarloSimulation?.summary?.successRate || 'N/A'}%`);
      console.log(`  Net Worth Projections: ${result.netWorthProjections ? 'Generated' : 'Not generated'}`);
    } else {
      console.log('⚠️ Recalculation request failed - you may need to trigger it manually from the UI');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixRetirementData();