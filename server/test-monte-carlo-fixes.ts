// Test script to verify Monte Carlo fixes
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';
import { FinancialProfile } from '../db/schema';

// Create a test profile for age 55 retirement scenario
const testProfile: any = {
  // Basic info
  userId: 'test-user',
  dateOfBirth: new Date(new Date().getFullYear() - 45, 0, 1).toISOString(),
  desiredRetirementAge: 55, // Early retirement
  userLifeExpectancy: 93,
  
  // Spouse info
  maritalStatus: 'married',
  spouseDateOfBirth: new Date(new Date().getFullYear() - 43, 0, 1).toISOString(),
  spouseDesiredRetirementAge: 55,
  spouseLifeExpectancy: 95,
  
  // Assets array (required format for profileToRetirementParams)
  assets: [
    { type: 'taxable-brokerage', value: 500000, ownership: 'joint' },
    { type: '401k', value: 400000, ownership: 'user' },
    { type: 'traditional-ira', value: 400000, ownership: 'spouse' },
    { type: 'roth-ira', value: 100000, ownership: 'user' },
    { type: 'roth-ira', value: 100000, ownership: 'spouse' },
    { type: 'savings', value: 50000, ownership: 'joint' }
  ],
  
  // Income & Benefits
  userAnnualIncome: 150000,
  spouseAnnualIncome: 100000,
  userSocialSecurityBenefit: 3500, // Monthly
  spouseSocialSecurityBenefit: 2500, // Monthly
  socialSecurityClaimAge: 67, // Delay SS
  spouseSocialSecurityClaimAge: 67,
  
  // Expenses (monthly)
  housingCosts: 3000,
  foodGroceries: 800,
  transportation: 500,
  healthcareInsurance: 1200,
  entertainmentTravel: 600,
  otherExpenses: 900,
  // Total monthly: ~$7,000, Annual: $84,000
  
  // Retirement details
  pensionBenefit: 0, // No pension monthly
  partTimeIncomeRetirement: 2000, // Monthly part-time for a few years
  spousePartTimeIncomeRetirement: 1500,
  
  // Risk & Investment
  investorRiskProfile: 'moderate',
  spouseInvestorRiskProfile: 'moderate',
  retirementContributions: 50000, // Annual until retirement
  spouseRetirementContributions: 30000,
  
  // Goals
  desiredRetirementAge: 55,
  retirementMonthlySpending: 7000,
  inflationRate: 3, // As percentage
  expectedRateOfReturn: 7, // As percentage
  
  // State & Healthcare
  retirementState: 'FL', // No state tax
  healthcareInflationRate: 5, // As percentage
  userHealthStatus: 'good',
  spouseHealthStatus: 'good',
  
  // LTC Insurance (testing with insurance)
  ltcInsuranceType: 'traditional',
  ltcDailyBenefit: 200,
  ltcBenefitPeriodYears: 3,
  ltcEliminationPeriodDays: 90,
  ltcInflationProtection: '3%_compound',
  ltcPremiumAnnual: 3500,
  
  spouseLtcInsuranceType: 'traditional',
  spouseLtcDailyBenefit: 200,
  spouseLtcBenefitPeriodYears: 3,
  spouseLtcEliminationPeriodDays: 90,
  spouseLtcInflationProtection: '3%_compound',
  spouseLtcPremiumAnnual: 3000,
};

async function runTests() {
  console.log('Testing Monte Carlo fixes with early retirement scenario (age 55)...\n');
  console.log('Profile Summary:');
  console.log('- Current Age: 45, Retirement Age: 55');
  console.log('- Total Assets: $1.55M');
  console.log('- Monthly Expenses: $7,000 ($84k/year)');
  console.log('- SS Benefits: $3,500 + $2,500 = $6,000/month (starting at 67)');
  console.log('- Part-time income: $3,500/month (declining over time)\n');

  // Convert profile to retirement params
  const params = profileToRetirementParams(testProfile as FinancialProfile);
  
  // Run baseline simulation
  console.log('Running baseline simulation (100 iterations for debugging)...');
  const startBaseline = Date.now();
  const baselineResult = runEnhancedMonteCarloSimulation(params, 100); // Reduced for debugging
  const baselineTime = Date.now() - startBaseline;
  
  // Debug: log the raw result structure
  console.log('\nDebug - Result structure:');
  console.log('- Has successRate:', baselineResult.successRate !== undefined);
  console.log('- Has percentiles:', baselineResult.percentiles !== undefined);
  console.log('- Success rate value:', baselineResult.successRate);
  
  console.log('\nBaseline Results:');
  console.log(`- Success Rate: ${isNaN(baselineResult.successRate) ? 'N/A' : (baselineResult.successRate * 100).toFixed(1) + '%'}`);
  
  if (baselineResult.percentiles) {
    console.log(`- Median Ending Balance: $${baselineResult.percentiles.p50?.toLocaleString() || 'N/A'}`);
    console.log(`- 25th Percentile: $${baselineResult.percentiles.p25?.toLocaleString() || 'N/A'}`);
    console.log(`- 75th Percentile: $${baselineResult.percentiles.p75?.toLocaleString() || 'N/A'}`);
  } else {
    console.log('- Percentiles not available');
  }
  console.log(`- Execution Time: ${(baselineTime / 1000).toFixed(2)}s`);
  
  if (baselineResult.ltcAnalysis) {
    console.log(`\nLTC Analysis:`);
    console.log(`- Probability of LTC: ${(baselineResult.ltcAnalysis.probabilityOfLTC * 100).toFixed(1)}%`);
    console.log(`- Avg Cost if Occurs: $${baselineResult.ltcAnalysis.avgCostIfOccurs?.toLocaleString() || 'N/A'}`);
    if (baselineResult.ltcAnalysis.impactOnSuccess) {
      console.log(`- Impact on Success: ${baselineResult.ltcAnalysis.impactOnSuccess.withLTC?.toFixed(1) || 'N/A'}% with LTC vs ${baselineResult.ltcAnalysis.impactOnSuccess.withoutLTC?.toFixed(1) || 'N/A'}% without`);
    }
  }
  
  // Test optimized scenario (delaying retirement to 60)
  console.log('\n---\nTesting optimized scenario (retirement at age 60)...');
  const optimizedParams = {
    ...params,
    retirementAge: 60,
    spouseRetirementAge: 60,
    socialSecurityClaimAge: 70, // Delay SS even more
    spouseSocialSecurityClaimAge: 70
  };
  
  const startOptimized = Date.now();
  const optimizedResult = runEnhancedMonteCarloSimulation(optimizedParams, 100); // Reduced for debugging
  const optimizedTime = Date.now() - startOptimized;
  
  console.log('\nOptimized Results (Age 60 retirement):');
  console.log(`- Success Rate: ${(optimizedResult.successRate * 100).toFixed(1)}%`);
  
  if (optimizedResult.percentiles) {
    console.log(`- Median Ending Balance: $${optimizedResult.percentiles.p50?.toLocaleString() || 'N/A'}`);
    console.log(`- 25th Percentile: $${optimizedResult.percentiles.p25?.toLocaleString() || 'N/A'}`);
    console.log(`- 75th Percentile: $${optimizedResult.percentiles.p75?.toLocaleString() || 'N/A'}`);
  } else {
    console.log('- Percentiles not available');
  }
  console.log(`- Execution Time: ${(optimizedTime / 1000).toFixed(2)}s`);
  
  // Calculate improvement
  const improvementPct = ((optimizedResult.successRate - baselineResult.successRate) / baselineResult.successRate * 100);
  console.log(`\nImprovement: ${improvementPct > 0 ? '+' : ''}${improvementPct.toFixed(1)}% success rate`);
  console.log(`Expected realistic improvement should be 10-20% for 5-year delay`);
  
  // Verify fixes are working
  console.log('\n---\nVerification Checks:');
  
  // Check 1: Success rate should be reasonable for early retirement
  const baselineReasonable = baselineResult.successRate >= 0.50 && baselineResult.successRate <= 0.75;
  console.log(`✓ Baseline success rate reasonable (50-75%): ${baselineReasonable ? 'PASS' : 'FAIL'} (${(baselineResult.successRate * 100).toFixed(1)}%)`);
  
  // Check 2: Delaying retirement should significantly improve success
  const significantImprovement = improvementPct >= 10;
  console.log(`✓ Significant improvement with delay (>10%): ${significantImprovement ? 'PASS' : 'FAIL'} (${improvementPct.toFixed(1)}%)`);
  
  // Check 3: Percentiles should be ordered correctly
  const percentilesOrdered = baselineResult.percentiles ? 
    (baselineResult.percentiles.p10 <= baselineResult.percentiles.p25 &&
     baselineResult.percentiles.p25 <= baselineResult.percentiles.p50 &&
     baselineResult.percentiles.p50 <= baselineResult.percentiles.p75 &&
     baselineResult.percentiles.p75 <= baselineResult.percentiles.p90) : false;
  console.log(`✓ Percentiles ordered correctly: ${percentilesOrdered ? 'PASS' : 'FAIL'}`);
  
  // Check 4: Execution time reasonable for 2000 iterations
  const timeReasonable = baselineTime < 10000; // Should complete in under 10 seconds
  console.log(`✓ Execution time reasonable (<10s): ${timeReasonable ? 'PASS' : 'FAIL'} (${(baselineTime / 1000).toFixed(2)}s)`);
  
  const allTestsPassed = baselineReasonable && significantImprovement && percentilesOrdered && timeReasonable;
  console.log(`\n${allTestsPassed ? '✅ All tests PASSED' : '❌ Some tests FAILED'}`);
  
  if (!allTestsPassed) {
    console.log('\nDiagnostics:');
    console.log('- Tax calculation fixes should reduce over-taxation');
    console.log('- Roth conversions should improve long-term tax efficiency');
    console.log('- Improved withdrawal order should preserve growth assets');
    console.log('- Expense modeling should be more realistic with age adjustments');
  }
}

// Run the tests
runTests().catch(console.error);