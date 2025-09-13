/**
 * Test Distribution Configuration for Fat Tails and Jump Diffusion
 * Verifies that Student-t and Jump-Diffusion distributions work correctly
 */

import { runEnhancedRetirementScenario } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';
import { 
  DEFAULT_DISTRIBUTION, 
  FAT_TAIL_DISTRIBUTION, 
  CRISIS_AWARE_DISTRIBUTION,
  DistributionConfig 
} from './server/monte-carlo-enhanced';

function createTestParams(): RetirementMonteCarloParams {
  return {
    currentAge: 50,
    retirementAge: 65,
    lifeExpectancy: 85,
    currentRetirementAssets: 1000000,
    annualRetirementExpenses: 50000,
    annualGuaranteedIncome: 20000,
    expectedReturn: 0.07,
    returnVolatility: 0.15, // Higher volatility to see distribution effects
    inflationRate: 0.025,
    stockAllocation: 0.7,
    bondAllocation: 0.2,
    cashAllocation: 0.1,
    withdrawalRate: 0.04,
    useGuardrails: false,
    taxRate: 0.22,
    filingStatus: 'single',
    retirementState: 'FL',
    assetBuckets: {
      taxDeferred: 700000,
      taxFree: 200000,
      capitalGains: 100000,
      cashEquivalents: 0,
      totalAssets: 1000000
    },
    socialSecurityBenefit: 2000,
    monthlyContribution401k: 1500,
    monthlyContributionIRA: 500,
    monthlyContributionRothIRA: 500,
    monthlyContributionBrokerage: 500,
    annualSavings: 36000
  };
}

console.log('=== Testing Distribution Configurations ===\n');

// Test different distributions
const distributions: { name: string; config: DistributionConfig }[] = [
  { name: 'Normal', config: DEFAULT_DISTRIBUTION },
  { name: 'Student-t (Fat Tails)', config: FAT_TAIL_DISTRIBUTION },
  { name: 'Jump-Diffusion (Crisis)', config: CRISIS_AWARE_DISTRIBUTION }
];

// Run multiple scenarios for each distribution
const numScenarios = 1000;
const results: Record<string, any> = {};

for (const dist of distributions) {
  console.log(`\nTesting ${dist.name} distribution...`);
  console.log(`  Type: ${dist.config.type}`);
  
  if (dist.config.type === 'student-t') {
    console.log(`  Degrees of Freedom: ${dist.config.studentTDegreesOfFreedom}`);
  } else if (dist.config.type === 'jump-diffusion') {
    console.log(`  Jump Probability: ${dist.config.jumpDiffusionParams?.jumpProbability}`);
    console.log(`  Jump Mean: ${dist.config.jumpDiffusionParams?.jumpMean}`);
    console.log(`  Jump Std: ${dist.config.jumpDiffusionParams?.jumpStd}`);
  }
  
  const distResults = {
    successCount: 0,
    endingBalances: [] as number[],
    extremeReturns: [] as number[],
    crashYears: 0,
    boomYears: 0
  };
  
  for (let i = 0; i < numScenarios; i++) {
    const params = createTestParams();
    const seed = 10000 + i;
    const result = runEnhancedRetirementScenario(params, undefined, [seed], dist.config);
    
    if (result.success) {
      distResults.successCount++;
    }
    
    distResults.endingBalances.push(result.endingBalance);
    
    // Check for extreme returns in the cash flows
    for (const flow of result.yearlyCashFlows) {
      if (flow.investmentReturn !== undefined) {
        const returnPct = flow.investmentReturn;
        
        // Track extreme returns (beyond 2 standard deviations)
        if (Math.abs(returnPct - 0.07) > 0.30) { // More than 30% away from mean
          distResults.extremeReturns.push(returnPct);
        }
        
        // Count crash years (< -20%) and boom years (> 30%)
        if (returnPct < -0.20) {
          distResults.crashYears++;
        } else if (returnPct > 0.30) {
          distResults.boomYears++;
        }
      }
    }
  }
  
  results[dist.name] = distResults;
  
  // Calculate statistics
  const successRate = (distResults.successCount / numScenarios * 100).toFixed(1);
  const avgEnding = distResults.endingBalances.reduce((a, b) => a + b, 0) / numScenarios;
  const sortedBalances = [...distResults.endingBalances].sort((a, b) => a - b);
  const p10 = sortedBalances[Math.floor(numScenarios * 0.10)];
  const p50 = sortedBalances[Math.floor(numScenarios * 0.50)];
  const p90 = sortedBalances[Math.floor(numScenarios * 0.90)];
  
  console.log(`\nResults for ${dist.name}:`);
  console.log(`  Success Rate: ${successRate}%`);
  console.log(`  Average Ending Balance: $${avgEnding.toFixed(0)}`);
  console.log(`  10th Percentile: $${p10.toFixed(0)}`);
  console.log(`  50th Percentile: $${p50.toFixed(0)}`);
  console.log(`  90th Percentile: $${p90.toFixed(0)}`);
  console.log(`  Extreme Returns: ${distResults.extremeReturns.length} occurrences`);
  console.log(`  Crash Years (< -20%): ${distResults.crashYears}`);
  console.log(`  Boom Years (> 30%): ${distResults.boomYears}`);
}

console.log('\n=== Comparative Analysis ===\n');

// Compare tail behavior
const normalExtremes = results['Normal'].extremeReturns.length;
const studentTExtremes = results['Student-t (Fat Tails)'].extremeReturns.length;
const jumpExtremes = results['Jump-Diffusion (Crisis)'].extremeReturns.length;

console.log('Extreme Event Frequency:');
console.log(`  Normal:         ${normalExtremes} events`);
console.log(`  Student-t:      ${studentTExtremes} events (${((studentTExtremes/normalExtremes - 1) * 100).toFixed(0)}% more than normal)`);
console.log(`  Jump-Diffusion: ${jumpExtremes} events (${((jumpExtremes/normalExtremes - 1) * 100).toFixed(0)}% more than normal)`);

console.log('\nCrash Events (< -20% returns):');
console.log(`  Normal:         ${results['Normal'].crashYears} years`);
console.log(`  Student-t:      ${results['Student-t (Fat Tails)'].crashYears} years`);
console.log(`  Jump-Diffusion: ${results['Jump-Diffusion (Crisis)'].crashYears} years`);

// Test antithetic variates with Student-t
console.log('\n=== Testing Antithetic Variates with Student-t ===\n');

const params = createTestParams();
const seed = 99999;

// Run with and without antithetic variates
const normalResult = runEnhancedRetirementScenario(params, undefined, [seed], FAT_TAIL_DISTRIBUTION, false);
const antitheticResult = runEnhancedRetirementScenario(params, undefined, [seed], FAT_TAIL_DISTRIBUTION, true);

console.log('Student-t Distribution:');
console.log(`  Normal sampling: Balance = $${normalResult.endingBalance.toFixed(0)}`);
console.log(`  Antithetic sampling: Balance = $${antitheticResult.endingBalance.toFixed(0)}`);

console.log('\n========================================');
console.log('Distribution Configuration Test Summary');
console.log('========================================');

if (studentTExtremes > normalExtremes) {
  console.log('✓ Student-t distribution shows more extreme events (fat tails working)');
} else {
  console.log('⚠ Student-t distribution not showing expected fat tail behavior');
}

if (jumpExtremes > normalExtremes) {
  console.log('✓ Jump-diffusion shows more extreme events (jumps working)');
} else {
  console.log('⚠ Jump-diffusion not showing expected jump behavior');
}

console.log('\nRecommendations:');
console.log('- Use Student-t (df=5) for realistic market behavior with fat tails');
console.log('- Use Jump-diffusion for stress testing with crisis events');
console.log('- Normal distribution tends to underestimate tail risks');