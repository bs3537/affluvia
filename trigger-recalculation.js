import { db } from './server/db.js';
import { financialProfiles } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { calculateFinancialMetrics } from './server/financial-calculations.js';
import { calculateNetWorthProjections } from './server/net-worth-projections.js';
import { RetirementMonteCarloEnhanced } from './server/monte-carlo-enhanced.js';

async function triggerRecalculation() {
  console.log('🔄 Triggering full recalculation for user 18...\n');
  
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
    
    console.log('📊 Current profile status:');
    console.log(`  Name: ${profile.firstName} ${profile.lastName}`);
    console.log(`  Retirement Expenses: $${profile.expectedMonthlyExpensesRetirement || 0}`);
    console.log(`  Has Calculations: ${profile.calculations ? 'Yes' : 'No'}`);
    console.log(`  Has Monte Carlo: ${profile.monteCarloSimulation ? 'Yes' : 'No'}`);
    console.log(`  Has Net Worth Projections: ${profile.netWorthProjections ? 'Yes' : 'No'}`);
    
    // 1. Run calculation engine
    console.log('\n🔧 Running calculation engine...');
    const calculations = await calculateFinancialMetrics(profile);
    console.log(`  ✅ Health Score: ${calculations.healthScore}`);
    console.log(`  ✅ Retirement Score: ${calculations.retirementScore}`);
    console.log(`  ✅ Net Worth: $${calculations.netWorth.toLocaleString()}`);
    
    // 2. Run Monte Carlo simulation if we have retirement expenses
    let monteCarloResults = null;
    const retirementExpenses = Number(profile.expectedMonthlyExpensesRetirement) || 0;
    if (retirementExpenses > 0) {
      console.log('\n🎲 Running Monte Carlo simulation...');
      const monteCarlo = new RetirementMonteCarloEnhanced();
      monteCarloResults = await monteCarlo.runSimulation(profile);
      console.log(`  ✅ Success Rate: ${monteCarloResults.summary.successRate}%`);
      console.log(`  ✅ Median End Balance: $${monteCarloResults.summary.medianEndBalance.toLocaleString()}`);
    } else {
      console.log('\n⚠️ Skipping Monte Carlo - retirement expenses still 0');
    }
    
    // 3. Generate net worth projections
    console.log('\n📈 Generating net worth projections...');
    const projections = calculateNetWorthProjections(profile);
    if (projections && projections.years && projections.years.length > 0) {
      console.log(`  ✅ Generated ${projections.years.length} years of projections`);
      console.log(`  ✅ Starting net worth: $${projections.years[0].netWorth.toLocaleString()}`);
      const lastYear = projections.years[projections.years.length - 1];
      console.log(`  ✅ Ending net worth: $${lastYear.netWorth.toLocaleString()}`);
    }
    
    // 4. Save everything back to database
    console.log('\n💾 Saving results to database...');
    await db
      .update(financialProfiles)
      .set({
        calculations: calculations,
        monteCarloSimulation: monteCarloResults,
        netWorthProjections: projections,
        
        // Also update top-level scores for backward compatibility
        financialHealthScore: calculations.healthScore,
        retirementReadinessScore: calculations.retirementScore,
        emergencyReadinessScore: calculations.emergencyScore,
        netWorth: calculations.netWorth,
        monthlyCashFlow: calculations.monthlyCashFlow,
        
        updatedAt: new Date()
      })
      .where(eq(financialProfiles.userId, 18));
    
    console.log('✅ All calculations saved to database');
    
    // 5. Verify the update
    const [updatedProfile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, 18));
    
    console.log('\n✅ VERIFICATION:');
    console.log(`  Calculations saved: ${updatedProfile.calculations ? 'Yes' : 'No'}`);
    console.log(`  Monte Carlo saved: ${updatedProfile.monteCarloSimulation ? 'Yes' : 'No'}`);
    console.log(`  Projections saved: ${updatedProfile.netWorthProjections ? 'Yes' : 'No'}`);
    
    console.log('\n🎉 SUCCESS! Dashboard widgets should now display all data properly.');
    console.log('   Please refresh the dashboard to see the updated data.');
    
  } catch (error) {
    console.error('Error during recalculation:', error);
  } finally {
    process.exit(0);
  }
}

triggerRecalculation();