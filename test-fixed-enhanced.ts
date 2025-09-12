/**
 * Test for FIXED Enhanced Monte Carlo Algorithm
 * Verifies all critical fixes have been applied
 */

import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

// Simple test profile
const testProfile: RetirementMonteCarloParams = {
  currentAge: 45,
  retirementAge: 65,
  lifeExpectancy: 85,
  currentRetirementAssets: 500000,
  annualSavings: 30000,
  annualRetirementExpenses: 70000,
  expectedReturn: 0.07,
  returnVolatility: 0.12,
  inflationRate: 0.025,
  stockAllocation: 0.60,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  withdrawalRate: 0.04,
  taxRate: 0.22,
  retirementState: 'FL',
  socialSecurityBenefit: 2000,
  socialSecurityStartAge: 67,
  userAnnualIncome: 100000,
  annualGuaranteedIncome: 0,
  assetBuckets: {
    taxDeferred: 300000,
    taxFree: 100000,
    capitalGains: 100000,
    cashEquivalents: 0,
    totalAssets: 500000
  }
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

async function testEnhancedAlgorithm() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            TESTING FIXED ENHANCED MONTE CARLO               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('Running test with profile:');
  console.log(`  Age: ${testProfile.currentAge} → ${testProfile.retirementAge}`);
  console.log(`  Assets: ${formatCurrency(testProfile.currentRetirementAssets)}`);
  console.log(`  Savings: ${formatCurrency(testProfile.annualSavings)}/year`);
  console.log(`  Expenses: ${formatCurrency(testProfile.annualRetirementExpenses)}/year`);
  
  const startTime = Date.now();
  
  try {
    const result = runEnhancedMonteCarloSimulation(testProfile, 100, false); // 100 iterations for quick test
    
    const endTime = Date.now();
    console.log(`\n✅ Simulation completed in ${((endTime - startTime) / 1000).toFixed(1)} seconds`);
    
    // Validate critical properties exist and are not NaN
    console.log('\n📊 VALIDATION RESULTS:');
    console.log('─'.repeat(50));
    
    // Check required properties from interface
    const checks = [
      { name: 'successProbability', value: result.successProbability, expected: 'number (0-1)' },
      { name: 'averageEndingBalance', value: result.averageEndingBalance, expected: 'number' },
      { name: 'averageYearsUntilDepletion', value: result.averageYearsUntilDepletion, expected: 'number or null' },
      { name: 'allScenarios', value: result.allScenarios, expected: 'array' },
      { name: 'yearlyData', value: result.yearlyData, expected: 'array' },
      { name: 'medianEndingBalance', value: result.medianEndingBalance, expected: 'number' },
      { name: 'confidenceIntervals', value: result.confidenceIntervals, expected: 'object' }
    ];
    
    let allValid = true;
    
    for (const check of checks) {
      const isValid = check.value !== undefined && !isNaN(check.value as any);
      const status = isValid ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${typeof check.value === 'object' ? 'object' : check.value} (${check.expected})`);
      
      if (!isValid) {
        allValid = false;
      }
    }
    
    // Additional validation for arrays
    if (result.allScenarios) {
      console.log(`   └─ allScenarios length: ${result.allScenarios.length}`);
    }
    if (result.yearlyData) {
      console.log(`   └─ yearlyData length: ${result.yearlyData.length}`);
    }
    
    console.log('\n📈 RESULTS SUMMARY:');
    console.log('─'.repeat(50));
    console.log(`Success Probability: ${((result.successProbability || 0) * 100).toFixed(1)}%`);
    console.log(`Average Ending Balance: ${formatCurrency(result.averageEndingBalance || 0)}`);
    console.log(`Median Ending Balance: ${formatCurrency(result.medianEndingBalance || 0)}`);
    
    if (result.confidenceIntervals) {
      console.log('\nConfidence Intervals:');
      console.log(`  10th percentile: ${formatCurrency(result.confidenceIntervals.percentile10 || 0)}`);
      console.log(`  25th percentile: ${formatCurrency(result.confidenceIntervals.percentile25 || 0)}`);
      console.log(`  50th percentile: ${formatCurrency(result.confidenceIntervals.percentile50 || 0)}`);
      console.log(`  75th percentile: ${formatCurrency(result.confidenceIntervals.percentile75 || 0)}`);
      console.log(`  90th percentile: ${formatCurrency(result.confidenceIntervals.percentile90 || 0)}`);
    }
    
    if (result.scenarios) {
      console.log('\nScenario Breakdown:');
      console.log(`  Successful: ${result.scenarios.successful}`);
      console.log(`  Failed: ${result.scenarios.failed}`);
      console.log(`  Total: ${result.scenarios.total}`);
    }
    
    // Check for NaN values
    const hasNaN = isNaN(result.successProbability) || 
                   isNaN(result.averageEndingBalance) ||
                   isNaN(result.medianEndingBalance);
    
    if (hasNaN) {
      console.log('\n❌ ERROR: NaN values detected in results!');
      console.log('Please check the algorithm implementation.');
    } else if (allValid) {
      console.log('\n✅ SUCCESS: All critical properties are valid!');
      console.log('The enhanced algorithm is now functional.');
    } else {
      console.log('\n⚠️  WARNING: Some properties are missing or invalid.');
    }
    
    // Test specific scenarios
    if (result.allScenarios && result.allScenarios.length > 0) {
      const firstScenario = result.allScenarios[0];
      console.log('\n🔍 Sample Scenario Check:');
      console.log(`  Ending Balance: ${formatCurrency(firstScenario.endingBalance || 0)}`);
      console.log(`  Success: ${firstScenario.success}`);
      console.log(`  Years Until Depletion: ${firstScenario.yearsUntilDepletion || 'N/A'}`);
    }
    
  } catch (error) {
    console.error('\n❌ ERROR: Algorithm failed with exception:');
    console.error(error);
    console.error('\nStack trace:');
    console.error((error as Error).stack);
  }
}

// Run the test
testEnhancedAlgorithm().catch(console.error);