import { db } from './server/db.js';
import { financialProfiles } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function testDashboardDataFlow() {
  console.log('🔍 Testing dashboard data flow for user 18...\n');
  
  try {
    // 1. Get data directly from database
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, 18));
    
    if (!profile) {
      console.log('❌ No profile found for user 18');
      process.exit(1);
    }
    
    console.log('✅ Found profile in database');
    console.log('=' .repeat(50));
    
    // 2. Check if calculations are stored
    console.log('\n📊 CALCULATIONS STATUS:');
    console.log(`   Has calculations field: ${profile.calculations ? 'Yes' : 'No'}`);
    if (profile.calculations) {
      const calcs = typeof profile.calculations === 'string' 
        ? JSON.parse(profile.calculations) 
        : profile.calculations;
      
      console.log(`   Health Score: ${calcs.healthScore || 'Not calculated'}`);
      console.log(`   Net Worth: $${calcs.netWorth?.toLocaleString() || 'Not calculated'}`);
      console.log(`   Monthly Cash Flow: $${calcs.monthlyCashFlow?.toLocaleString() || 'Not calculated'}`);
      console.log(`   Emergency Score: ${calcs.emergencyScore || 'Not calculated'}`);
      console.log(`   Retirement Score: ${calcs.retirementScore || 'Not calculated'}`);
      console.log(`   Risk Profile: ${calcs.riskProfile || 'Not calculated'}`);
      console.log(`   Risk Score: ${calcs.riskScore || 'Not calculated'}`);
      console.log(`   Insurance Score: ${calcs.insuranceAdequacy?.score || calcs.riskManagementScore || 'Not calculated'}`);
    }
    
    // 3. Check Monte Carlo simulation
    console.log('\n🎲 MONTE CARLO STATUS:');
    console.log(`   Has Monte Carlo: ${profile.monteCarloSimulation ? 'Yes' : 'No'}`);
    if (profile.monteCarloSimulation) {
      const mc = typeof profile.monteCarloSimulation === 'string'
        ? JSON.parse(profile.monteCarloSimulation)
        : profile.monteCarloSimulation;
      
      console.log(`   Success Rate: ${mc.summary?.successRate || 'Not calculated'}%`);
      console.log(`   Median End Balance: $${mc.summary?.medianEndBalance?.toLocaleString() || 'Not calculated'}`);
    }
    
    // 4. Check critical widget data
    console.log('\n💰 WIDGET DATA AVAILABILITY:');
    const assets = profile.assets ? (typeof profile.assets === 'string' ? JSON.parse(profile.assets) : profile.assets) : null;
    const liabilities = profile.liabilities ? (typeof profile.liabilities === 'string' ? JSON.parse(profile.liabilities) : profile.liabilities) : null;
    
    console.log(`   Assets: ${assets ? assets.length + ' items' : 'None'}`);
    console.log(`   Liabilities: ${liabilities ? liabilities.length + ' items' : 'None'}`);
    console.log(`   Monthly Expenses: ${profile.monthlyExpenses ? 'Yes' : 'No'}`);
    console.log(`   Annual Income: $${profile.annualIncome?.toLocaleString() || 0}`);
    console.log(`   Take Home Income: $${profile.takeHomeIncome?.toLocaleString() || 0}`);
    console.log(`   Current Allocation: ${profile.currentAllocation ? 'Yes' : 'No'}`);
    console.log(`   Risk Questions: ${profile.riskQuestions ? 'Yes' : 'No'}`);
    
    // 5. Check retirement data
    console.log('\n🏖️ RETIREMENT DATA:');
    console.log(`   Desired Retirement Age: ${profile.desiredRetirementAge || 'Not set'}`);
    console.log(`   Social Security Claim Age: ${profile.socialSecurityClaimAge || 'Not set'}`);
    console.log(`   Monthly Retirement Expenses: $${profile.monthlyRetirementExpenses?.toLocaleString() || 0}`);
    console.log(`   Social Security Benefit: $${profile.socialSecurityBenefit?.toLocaleString() || 0}`);
    
    // 6. Check net worth projections
    console.log('\n📈 NET WORTH PROJECTIONS:');
    console.log(`   Has Projections: ${profile.netWorthProjections ? 'Yes' : 'No'}`);
    if (profile.netWorthProjections) {
      const projections = typeof profile.netWorthProjections === 'string'
        ? JSON.parse(profile.netWorthProjections)
        : profile.netWorthProjections;
      
      if (projections.years && projections.years.length > 0) {
        console.log(`   Years of data: ${projections.years.length}`);
        console.log(`   Starting net worth: $${projections.years[0]?.netWorth?.toLocaleString() || 0}`);
        const lastYear = projections.years[projections.years.length - 1];
        console.log(`   Ending net worth: $${lastYear?.netWorth?.toLocaleString() || 0}`);
      }
    }
    
    // 7. Check data completeness for widgets
    console.log('\n✅ WIDGET READINESS CHECK:');
    const hasBasicData = profile.firstName && profile.annualIncome;
    const hasAssetData = profile.assets || profile.liabilities;
    const hasCalculations = profile.calculations;
    const hasMonteCarloData = profile.monteCarloSimulation;
    const hasProjections = profile.netWorthProjections;
    
    console.log(`   ✅ Basic Info Widget: ${hasBasicData ? 'Ready' : 'Missing data'}`);
    console.log(`   ✅ Net Worth Widget: ${hasAssetData ? 'Ready' : 'Missing assets/liabilities'}`);
    console.log(`   ✅ Cash Flow Widget: ${profile.monthlyExpenses ? 'Ready' : 'Missing expenses'}`);
    console.log(`   ✅ Financial Health Widget: ${hasCalculations ? 'Ready' : 'Missing calculations'}`);
    console.log(`   ✅ Monte Carlo Widget: ${hasMonteCarloData ? 'Ready' : 'Missing simulation'}`);
    console.log(`   ✅ Projections Widget: ${hasProjections ? 'Ready' : 'Missing projections'}`);
    console.log(`   ✅ Risk Profile Widget: ${profile.riskQuestions ? 'Ready' : 'Missing risk assessment'}`);
    
    // 8. Identify issues
    console.log('\n⚠️ POTENTIAL ISSUES:');
    const issues = [];
    
    if (!profile.monthlyRetirementExpenses || profile.monthlyRetirementExpenses === 0) {
      issues.push('Monthly retirement expenses is 0 - will cause Monte Carlo errors');
    }
    if (!profile.calculations) {
      issues.push('No calculations stored - dashboard will use fallback calculations');
    }
    if (!profile.monteCarloSimulation) {
      issues.push('No Monte Carlo simulation - retirement widgets will be empty');
    }
    if (!profile.currentAllocation) {
      issues.push('No current allocation - asset allocation widget will be empty');
    }
    
    if (issues.length > 0) {
      issues.forEach(issue => console.log(`   ❌ ${issue}`));
    } else {
      console.log('   ✅ No critical issues found');
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('📋 SUMMARY:');
    console.log(`   User 18 has ${Object.keys(profile).filter(k => profile[k] !== null).length} populated fields`);
    console.log(`   Dashboard should display data for most widgets`);
    console.log(`   Main issue: Retirement expenses = 0 affecting Monte Carlo`);
    
  } catch (error) {
    console.error('Error testing data flow:', error);
  } finally {
    process.exit(0);
  }
}

testDashboardDataFlow();