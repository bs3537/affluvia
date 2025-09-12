import { db } from './db';
import { financialProfiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testCompletePersistence() {
  console.log('COMPREHENSIVE PERSISTENCE TEST\n');
  console.log('='.repeat(70));
  
  try {
    // Get the test user's profile
    const [profile] = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, 1));
    
    if (!profile) {
      console.log('❌ No financial profile found for user ID 1');
      process.exit(1);
    }
    
    console.log('📊 DATA PERSISTENCE STATUS REPORT\n');
    
    // 1. Check Optimization Variables
    console.log('1️⃣ OPTIMIZATION VARIABLES:');
    if (profile.optimizationVariables) {
      const vars = typeof profile.optimizationVariables === 'string' 
        ? JSON.parse(profile.optimizationVariables) 
        : profile.optimizationVariables;
      console.log('✅ PERSISTED - Last saved:', vars.savedAt || vars.lockedAt || 'Unknown');
      console.log('   • Retirement Age:', vars.retirementAge);
      console.log('   • Social Security Age:', vars.socialSecurityAge);
      console.log('   • Monthly Contributions:', vars.monthlyContributions);
      console.log('   • Monthly Expenses:', vars.monthlyExpenses);
    } else {
      console.log('❌ NOT PERSISTED');
    }
    
    // 2. Check Monte Carlo Results
    console.log('\n2️⃣ MONTE CARLO SIMULATION:');
    if (profile.monteCarloSimulation) {
      const mc = typeof profile.monteCarloSimulation === 'string'
        ? JSON.parse(profile.monteCarloSimulation)
        : profile.monteCarloSimulation;
      console.log('✅ PERSISTED - Last calculated:', mc.calculatedAt || 'Unknown');
      console.log('   • Success Probability:', mc.probabilityOfSuccess, '%');
      console.log('   • Median Ending Balance: $', (mc.medianEndingBalance / 1000000).toFixed(2), 'M');
      console.log('   • Has Yearly Cash Flows:', mc.yearlyCashFlows ? 'Yes' : 'No');
      console.log('   • Has Percentile Data:', mc.percentileData ? 'Yes' : 'No');
    } else {
      console.log('❌ NOT PERSISTED');
    }
    
    // 3. Check Net Worth Projections
    console.log('\n3️⃣ NET WORTH PROJECTIONS:');
    const rpData = profile.retirementPlanningData 
      ? (typeof profile.retirementPlanningData === 'string' 
          ? JSON.parse(profile.retirementPlanningData) 
          : profile.retirementPlanningData)
      : null;
    
    if (rpData?.netWorthProjections) {
      console.log('✅ PERSISTED - Last updated:', rpData.netWorthProjectionsUpdatedAt || 'Unknown');
      const nw = rpData.netWorthProjections;
      if (nw.years && nw.values) {
        console.log('   • Years covered:', nw.years[0], '-', nw.years[nw.years.length - 1]);
        console.log('   • Starting value: $', (nw.values[0] / 1000000).toFixed(2), 'M');
        console.log('   • Ending value: $', (nw.values[nw.values.length - 1] / 1000000).toFixed(2), 'M');
      }
    } else {
      console.log('❌ NOT PERSISTED');
    }
    
    // 4. Check Cash Flow Data
    console.log('\n4️⃣ CASH FLOW DATA:');
    const cashFlowData = profile.optimizationVariables 
      ? (typeof profile.optimizationVariables === 'string' 
          ? JSON.parse(profile.optimizationVariables) 
          : profile.optimizationVariables).cashFlowData
      : null;
    
    if (cashFlowData) {
      console.log('✅ PERSISTED');
      console.log('   • Has Inflows:', cashFlowData.inflows ? 'Yes' : 'No');
      console.log('   • Has Outflows:', cashFlowData.outflows ? 'Yes' : 'No');
    } else {
      console.log('❌ NOT PERSISTED');
    }
    
    // 5. Check Account Balances
    console.log('\n5️⃣ ACCOUNT BALANCE PROJECTIONS:');
    const accountBalances = profile.optimizationVariables 
      ? (typeof profile.optimizationVariables === 'string' 
          ? JSON.parse(profile.optimizationVariables) 
          : profile.optimizationVariables).accountBalances
      : null;
    
    if (accountBalances) {
      console.log('✅ PERSISTED');
    } else {
      console.log('⚠️  NOT YET PERSISTED - Account balances need to be added');
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('\n📈 OPTIMIZATION TAB DATA PERSISTENCE SUMMARY:\n');
    
    const items = [
      { name: 'Optimization Variables', persisted: !!profile.optimizationVariables },
      { name: 'Monte Carlo Results', persisted: !!profile.monteCarloSimulation },
      { name: 'Net Worth Projections', persisted: !!rpData?.netWorthProjections },
      { name: 'Cash Flow Data', persisted: !!cashFlowData },
      { name: 'Account Balances', persisted: !!accountBalances }
    ];
    
    const persistedCount = items.filter(i => i.persisted).length;
    const totalCount = items.length;
    const persistenceRate = (persistedCount / totalCount * 100).toFixed(0);
    
    console.log(`Persistence Score: ${persistedCount}/${totalCount} (${persistenceRate}%)\n`);
    
    items.forEach(item => {
      console.log(`${item.persisted ? '✅' : '❌'} ${item.name}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('\n💡 RECOMMENDATIONS:\n');
    
    if (persistedCount < totalCount) {
      console.log('To achieve 100% persistence:');
      if (!accountBalances) {
        console.log('• Add account balance projections to optimization results');
      }
      console.log('• Ensure all visualizations are saved after generation');
      console.log('• Consider adding cache expiration for stale data');
    } else {
      console.log('✨ All optimization data is properly persisted!');
      console.log('• Data will be loaded from cache on page refresh');
      console.log('• Expensive calculations are avoided');
      console.log('• User experience is optimized');
    }
    
    console.log('\n🔄 DATA REGENERATION BEHAVIOR:\n');
    console.log('On page load:');
    console.log('• IF data exists in DB → Load from cache (fast)');
    console.log('• IF data missing → Regenerate on demand (slower)');
    console.log('• IF variables change → Recalculate and save new results');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing persistence:', error);
    process.exit(1);
  }
}

testCompletePersistence();