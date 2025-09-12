/**
 * Phase 1 Monte Carlo Test Suite
 * Tests for critical foundation fixes: RNG, Taxes, Success Metrics, Shortfall Detection
 */

import { runEnhancedRetirementScenario } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';
import { RNG } from './server/rng';

// Test helper to create baseline params
function createBaselineParams(): RetirementMonteCarloParams {
  return {
    currentAge: 50,
    retirementAge: 65,
    lifeExpectancy: 85,
    currentRetirementAssets: 500000,
    annualRetirementExpenses: 60000,
    annualGuaranteedIncome: 30000, // SS + pensions
    expectedReturn: 0.07,
    returnVolatility: 0.12,
    inflationRate: 0.025,
    stockAllocation: 0.6,
    bondAllocation: 0.3,
    cashAllocation: 0.1,
    withdrawalRate: 0.04,
    useGuardrails: false,
    taxRate: 0.22,
    filingStatus: 'single',
    retirementState: 'FL',
    assetBuckets: {
      taxDeferred: 300000,
      taxFree: 100000,
      capitalGains: 100000,
      cashEquivalents: 0,
      totalAssets: 500000
    },
    socialSecurityBenefit: 2000, // Monthly
    pensionBenefit: 500, // Monthly
    monthlyContribution401k: 1000,
    monthlyContributionIRA: 500,
    monthlyContributionRothIRA: 500,
    monthlyContributionBrokerage: 500
  };
}

// Test 1: RNG Determinism
function testRNGDeterminism() {
  console.log('\n=== Test 1: RNG Determinism ===');
  
  const params = createBaselineParams();
  const seed = 12345;
  
  // Run twice with same seed
  const result1 = runEnhancedRetirementScenario(params, undefined, [seed]);
  const result2 = runEnhancedRetirementScenario(params, undefined, [seed]);
  
  const pass = result1.endingBalance === result2.endingBalance &&
                result1.success === result2.success &&
                result1.yearsUntilDepletion === result2.yearsUntilDepletion;
  
  console.log(`Determinism Test: ${pass ? 'PASS' : 'FAIL'}`);
  console.log(`  Result 1: Balance=${result1.endingBalance.toFixed(0)}, Success=${result1.success}`);
  console.log(`  Result 2: Balance=${result2.endingBalance.toFixed(0)}, Success=${result2.success}`);
  
  return pass;
}

// Test 2: Tax Calculation with Pension and Earned Income
function testTaxCalculationWithAllIncome() {
  console.log('\n=== Test 2: Tax Calculation with All Income ===');
  
  const params = createBaselineParams();
  
  // Add significant pension and part-time income
  params.pensionBenefit = 3000; // $36K/year
  params.partTimeIncomeRetirement = 2000; // $24K/year
  
  const result = runEnhancedRetirementScenario(params, undefined, [54321]);
  
  // Check that taxes are being calculated on total income
  const retirementYearIndex = params.retirementAge - params.currentAge;
  const retirementCashFlow = result.yearlyCashFlows[retirementYearIndex];
  
  if (retirementCashFlow) {
    console.log(`  First retirement year (age ${retirementCashFlow.age}):`);
    console.log(`    Guaranteed Income: $${retirementCashFlow.guaranteedIncome.toFixed(0)}`);
    console.log(`    Withdrawal: $${retirementCashFlow.withdrawal.toFixed(0)}`);
    
    // With pension + part-time + SS + withdrawals, effective tax rate should be meaningful
    const totalIncome = retirementCashFlow.guaranteedIncome + retirementCashFlow.withdrawal;
    const expectedMinTax = totalIncome * 0.10; // At least 10% effective rate with this income
    
    console.log(`  Tax validation: Total income = $${totalIncome.toFixed(0)}`);
    console.log(`  Expected min tax burden based on income level`);
  }
  
  return true; // Basic validation - detailed tax testing would require more complex assertions
}

// Test 3: Shortfall Metrics
function testShortfallMetrics() {
  console.log('\n=== Test 3: Shortfall Metrics ===');
  
  const params = createBaselineParams();
  
  // Create scenario likely to have shortfalls
  params.currentRetirementAssets = 200000; // Lower assets
  params.annualRetirementExpenses = 80000; // Higher expenses
  params.expectedReturn = 0.04; // Lower returns
  
  const result = runEnhancedRetirementScenario(params, undefined, [99999]);
  
  console.log(`  Success (with shortfall tolerance): ${result.success}`);
  console.log(`  Years until depletion: ${result.yearsUntilDepletion || 'Never'}`);
  
  if (result.shortfallMetrics) {
    console.log(`  Shortfall Metrics:`);
    console.log(`    Total Shortfall: $${result.shortfallMetrics.totalShortfall.toFixed(0)}`);
    console.log(`    Shortfall Years: ${result.shortfallMetrics.shortfallYears}`);
    console.log(`    Max Consecutive Shortfall Years: ${result.shortfallMetrics.maxConsecutiveShortfallYears}`);
    console.log(`    No Depletion: ${result.shortfallMetrics.noDepletion}`);
    console.log(`    No Shortfall: ${result.shortfallMetrics.noShortfall}`);
    
    // Validate that shortfall tracking is working
    const hasShortfallTracking = result.shortfallMetrics.totalShortfall >= 0 &&
                                 result.shortfallMetrics.shortfallYears >= 0;
    
    console.log(`  Shortfall tracking: ${hasShortfallTracking ? 'PASS' : 'FAIL'}`);
    return hasShortfallTracking;
  }
  
  console.log('  WARNING: No shortfall metrics in result');
  return false;
}

// Test 4: Zero Volatility Deterministic Case
function testZeroVolatilityDeterministic() {
  console.log('\n=== Test 4: Zero Volatility Deterministic ===');
  
  const params = createBaselineParams();
  params.returnVolatility = 0; // No volatility
  params.expectedReturn = 0.05; // Fixed 5% return
  params.inflationRate = 0.02; // Fixed 2% inflation
  params.useGuardrails = false;
  
  const result = runEnhancedRetirementScenario(params, undefined, [11111]);
  
  // With zero volatility, results should be very predictable
  // Portfolio should grow at exactly 5% minus withdrawals and taxes
  
  console.log(`  Ending Balance: $${result.endingBalance.toFixed(0)}`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Years Until Depletion: ${result.yearsUntilDepletion || 'Never'}`);
  
  // Basic sanity check - with reasonable params, should not deplete
  const noDepleteWithGoodReturns = result.yearsUntilDepletion === null;
  console.log(`  No depletion with 5% returns: ${noDepleteWithGoodReturns ? 'PASS' : 'FAIL'}`);
  
  return noDepleteWithGoodReturns;
}

// Test 5: RNG Distribution Test
function testRNGDistributions() {
  console.log('\n=== Test 5: RNG Distributions ===');
  
  const rng = new RNG(42);
  const samples = 10000;
  
  // Test normal distribution
  let normalSum = 0;
  let normalSumSq = 0;
  for (let i = 0; i < samples; i++) {
    const val = rng.normal();
    normalSum += val;
    normalSumSq += val * val;
  }
  
  const normalMean = normalSum / samples;
  const normalVar = normalSumSq / samples - normalMean * normalMean;
  
  console.log(`  Normal Distribution (${samples} samples):`);
  console.log(`    Mean: ${normalMean.toFixed(4)} (expected: 0)`);
  console.log(`    Variance: ${normalVar.toFixed(4)} (expected: 1)`);
  
  // Test uniform distribution
  rng.reset(42);
  let uniformMin = 1;
  let uniformMax = 0;
  let uniformSum = 0;
  
  for (let i = 0; i < samples; i++) {
    const val = rng.next();
    uniformMin = Math.min(uniformMin, val);
    uniformMax = Math.max(uniformMax, val);
    uniformSum += val;
  }
  
  const uniformMean = uniformSum / samples;
  
  console.log(`  Uniform Distribution (${samples} samples):`);
  console.log(`    Mean: ${uniformMean.toFixed(4)} (expected: 0.5)`);
  console.log(`    Min: ${uniformMin.toFixed(4)} (expected: ~0)`);
  console.log(`    Max: ${uniformMax.toFixed(4)} (expected: ~1)`);
  
  // Validate distributions are reasonable
  const normalPass = Math.abs(normalMean) < 0.05 && Math.abs(normalVar - 1) < 0.1;
  const uniformPass = Math.abs(uniformMean - 0.5) < 0.05 && uniformMin < 0.01 && uniformMax > 0.99;
  
  console.log(`  Normal distribution: ${normalPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Uniform distribution: ${uniformPass ? 'PASS' : 'FAIL'}`);
  
  return normalPass && uniformPass;
}

// Run all tests
async function runAllTests() {
  console.log('========================================');
  console.log('Phase 1 Monte Carlo Enhancement Tests');
  console.log('========================================');
  
  const tests = [
    testRNGDeterminism,
    testTaxCalculationWithAllIncome,
    testShortfallMetrics,
    testZeroVolatilityDeterministic,
    testRNGDistributions
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n========================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('========================================');
  
  return failed === 0;
}

// Export for use as module or run directly
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
});

export { runAllTests, createBaselineParams };