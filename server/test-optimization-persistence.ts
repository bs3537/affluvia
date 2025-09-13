import { db } from './db';
import { financialProfiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testOptimizationPersistence() {
  console.log('TESTING OPTIMIZATION DATA PERSISTENCE\n');
  console.log('='.repeat(60));
  
  try {
    // Get the test user's profile
    const [profile] = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, 1));
    
    if (!profile) {
      console.log('❌ No financial profile found for user ID 1');
      process.exit(1);
    }
    
    console.log('Current Profile Status:');
    console.log('=======================');
    
    // Check optimization variables
    console.log('\n1. OPTIMIZATION VARIABLES:');
    if (profile.optimizationVariables) {
      const vars = typeof profile.optimizationVariables === 'string' 
        ? JSON.parse(profile.optimizationVariables) 
        : profile.optimizationVariables;
      console.log('✅ Saved optimization variables found:');
      console.log(JSON.stringify(vars, null, 2));
    } else {
      console.log('⚠️  No optimization variables saved');
    }
    
    // Check Monte Carlo simulation data
    console.log('\n2. MONTE CARLO SIMULATION DATA:');
    if (profile.monteCarloSimulation) {
      const mcData = typeof profile.monteCarloSimulation === 'string'
        ? JSON.parse(profile.monteCarloSimulation)
        : profile.monteCarloSimulation;
      console.log('✅ Monte Carlo data found:');
      console.log('- Success probability:', mcData.probabilityOfSuccess || 'Not found');
      console.log('- Median ending balance:', mcData.medianEndingBalance || 'Not found');
      console.log('- Has yearly cash flows:', mcData.yearlyCashFlows ? 'Yes' : 'No');
      console.log('- Has percentile data:', mcData.percentileData ? 'Yes' : 'No');
    } else {
      console.log('⚠️  No Monte Carlo simulation data saved');
    }
    
    // Check retirement planning data
    console.log('\n3. RETIREMENT PLANNING DATA:');
    if (profile.retirementPlanningData) {
      const rpData = typeof profile.retirementPlanningData === 'string'
        ? JSON.parse(profile.retirementPlanningData)
        : profile.retirementPlanningData;
      console.log('✅ Retirement planning data found:');
      console.log('- Keys:', Object.keys(rpData).join(', '));
    } else {
      console.log('⚠️  No retirement planning data saved');
    }
    
    // Check calculations field
    console.log('\n4. CALCULATIONS FIELD:');
    if (profile.calculations) {
      const calcs = typeof profile.calculations === 'string'
        ? JSON.parse(profile.calculations)
        : profile.calculations;
      console.log('✅ Calculations data found:');
      console.log('- Has net worth projections:', calcs.netWorthProjections ? 'Yes' : 'No');
      console.log('- Has cash flow data:', calcs.cashFlowData ? 'Yes' : 'No');
      console.log('- Has account balances:', calcs.accountBalances ? 'Yes' : 'No');
    } else {
      console.log('⚠️  No calculations data saved');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\nSUMMARY OF DATA PERSISTENCE:\n');
    
    // What SHOULD be persisted after optimization
    console.log('EXPECTED PERSISTENCE (after optimization):');
    console.log('✓ Optimization variables (retirement age, SS age, etc.)');
    console.log('✓ Monte Carlo simulation results');
    console.log('✓ Net worth projections');
    console.log('✓ Cash flow data');
    console.log('✓ Account balance projections');
    
    console.log('\nCURRENT IMPLEMENTATION STATUS:');
    console.log('• Optimization variables: ' + (profile.optimizationVariables ? '✅ Persisted' : '❌ Not persisted'));
    console.log('• Monte Carlo results: ' + (profile.monteCarloSimulation ? '✅ Persisted' : '❌ Not persisted'));
    console.log('• Retirement planning data: ' + (profile.retirementPlanningData ? '✅ Persisted' : '❌ Not persisted'));
    console.log('• Calculations: ' + (profile.calculations ? '✅ Persisted' : '❌ Not persisted'));
    
    console.log('\n' + '='.repeat(60));
    console.log('\nRECOMMENDATIONS:');
    console.log('1. Save optimization results after running optimization');
    console.log('2. Include all visualizations data (charts) in persistence');
    console.log('3. Cache results to avoid re-running expensive calculations');
    console.log('4. Consider versioning optimization scenarios');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing persistence:', error);
    process.exit(1);
  }
}

testOptimizationPersistence();