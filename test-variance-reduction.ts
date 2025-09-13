import { 
  runEnhancedMonteCarloSimulation,
  DEFAULT_VARIANCE_REDUCTION,
  VarianceReductionConfig,
  calculateControlVariate,
  DEFAULT_RETURN_CONFIG
} from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

console.log('=== Variance Reduction Techniques Test ===\n');

// Create a test retirement profile
const testParams: RetirementMonteCarloParams = {
  currentAge: 50,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentRetirementAssets: 500000,
  annualSavings: 20000,
  annualRetirementExpenses: 60000,
  annualGuaranteedIncome: 20000,
  expectedReturn: 0.07,  // 7% CAGR
  returnVolatility: 0.15, // 15% volatility (moderate)
  inflationRate: 0.025,
  withdrawalRate: 0.04,
  stockAllocation: 0.60,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  taxRate: 0.22,
  filingStatus: 'single' as const,
  useGuardrails: true,
  assetBuckets: {
    taxDeferred: 350000,
    taxFree: 100000,
    capitalGains: 50000,
    cashEquivalents: 0,
    totalAssets: 500000
  }
};

console.log('Test Profile:');
console.log(`  Current Age: ${testParams.currentAge}`);
console.log(`  Retirement Age: ${testParams.retirementAge}`);
console.log(`  Current Assets: $${testParams.currentRetirementAssets?.toLocaleString()}`);
console.log(`  Expected Return: ${((testParams.expectedReturn || 0) * 100).toFixed(1)}% (CAGR)`);
console.log(`  Volatility: ${((testParams.returnVolatility || 0) * 100).toFixed(1)}%`);
console.log('');

// Test configurations
const testConfigs: Array<{name: string, config: VarianceReductionConfig, iterations: number}> = [
  {
    name: 'Baseline (No Variance Reduction)',
    config: {
      useAntitheticVariates: false,
      useControlVariates: false,
      useStratifiedSampling: false
    },
    iterations: 500
  },
  {
    name: 'Antithetic Variates Only',
    config: {
      useAntitheticVariates: true,
      useControlVariates: false,
      useStratifiedSampling: false
    },
    iterations: 500
  },
  {
    name: 'Control Variates Only',
    config: {
      useAntitheticVariates: false,
      useControlVariates: true,
      useStratifiedSampling: false
    },
    iterations: 500
  },
  {
    name: 'Stratified Sampling Only',
    config: {
      useAntitheticVariates: false,
      useControlVariates: false,
      useStratifiedSampling: true,
      stratificationBins: 10
    },
    iterations: 500
  },
  {
    name: 'All Techniques Combined',
    config: DEFAULT_VARIANCE_REDUCTION,
    iterations: 500
  }
];

// Store results for comparison
const results: Array<{
  name: string;
  successRate: number;
  median: number;
  p10: number;
  p90: number;
  timeMs: number;
  variance: number;
}> = [];

// Calculate analytical control variate for reference
const analyticalEstimate = calculateControlVariate(testParams, DEFAULT_RETURN_CONFIG);
console.log(`Analytical Control Estimate: ${(analyticalEstimate * 100).toFixed(2)}%\n`);
console.log('='.repeat(70));

// Run tests
for (const test of testConfigs) {
  console.log(`\nTesting: ${test.name}`);
  console.log('-'.repeat(40));
  
  // Run multiple trials to estimate variance
  const trials = 10;
  const trialResults: number[] = [];
  let totalTime = 0;
  
  for (let trial = 0; trial < trials; trial++) {
    const startTime = Date.now();
    
    const result = runEnhancedMonteCarloSimulation(
      testParams,
      test.iterations,
      false, // verbose
      DEFAULT_RETURN_CONFIG,
      test.config
    );
    
    const elapsed = Date.now() - startTime;
    totalTime += elapsed;
    trialResults.push(result.successProbability);
    
    // Show first trial details
    if (trial === 0) {
      console.log(`  Success Rate: ${(result.successProbability * 100).toFixed(2)}%`);
      console.log(`  Median Balance: $${result.medianEndingBalance.toLocaleString()}`);
      console.log(`  10th Percentile: $${result.percentile10EndingBalance.toLocaleString()}`);
      console.log(`  90th Percentile: $${result.percentile90EndingBalance.toLocaleString()}`);
      console.log(`  Time: ${elapsed}ms`);
      
      // Store detailed results from first trial
      results.push({
        name: test.name,
        successRate: result.successProbability,
        median: result.medianEndingBalance,
        p10: result.percentile10EndingBalance,
        p90: result.percentile90EndingBalance,
        timeMs: elapsed,
        variance: 0 // Will calculate below
      });
    }
  }
  
  // Calculate variance across trials
  const meanSuccess = trialResults.reduce((a, b) => a + b, 0) / trials;
  const variance = trialResults.reduce((sum, x) => sum + Math.pow(x - meanSuccess, 2), 0) / trials;
  const stdDev = Math.sqrt(variance);
  
  // Update variance in results
  results[results.length - 1].variance = variance;
  
  console.log(`\n  Variance Analysis (${trials} trials):`);
  console.log(`    Mean Success: ${(meanSuccess * 100).toFixed(2)}%`);
  console.log(`    Std Dev: ${(stdDev * 100).toFixed(3)}%`);
  console.log(`    Variance: ${(variance * 10000).toFixed(4)} (x10^-4)`);
  console.log(`    Avg Time: ${(totalTime / trials).toFixed(0)}ms`);
}

// Comparison Summary
console.log('\n' + '='.repeat(70));
console.log('\n### VARIANCE REDUCTION EFFECTIVENESS SUMMARY ###\n');

// Calculate variance reduction percentages
const baselineResult = results.find(r => r.name.includes('Baseline'));
if (baselineResult) {
  console.log('Variance Reduction (vs Baseline):');
  console.log('-'.repeat(40));
  
  for (const result of results) {
    if (result !== baselineResult) {
      const varianceReduction = ((baselineResult.variance - result.variance) / baselineResult.variance) * 100;
      const timeIncrease = ((result.timeMs - baselineResult.timeMs) / baselineResult.timeMs) * 100;
      
      console.log(`\n${result.name}:`);
      console.log(`  Variance Reduction: ${varianceReduction.toFixed(1)}%`);
      console.log(`  Time Impact: ${timeIncrease > 0 ? '+' : ''}${timeIncrease.toFixed(1)}%`);
      console.log(`  Efficiency: ${(varianceReduction / Math.max(1, Math.abs(timeIncrease))).toFixed(2)} (var reduction per % time)`);
    }
  }
}

// Theoretical expectations
console.log('\n' + '='.repeat(70));
console.log('\n### THEORETICAL VS ACTUAL COMPARISON ###\n');
console.log('Expected Variance Reduction:');
console.log('  Antithetic Variates: ~40-50%');
console.log('  Control Variates: ~20-30%');
console.log('  Stratified Sampling: ~10-20%');
console.log('  Combined: ~60-70%');

// Calculate actual combined reduction
const combinedResult = results.find(r => r.name.includes('All Techniques'));
if (baselineResult && combinedResult) {
  const actualReduction = ((baselineResult.variance - combinedResult.variance) / baselineResult.variance) * 100;
  console.log(`\nActual Combined Reduction: ${actualReduction.toFixed(1)}%`);
  
  // Calculate equivalent iteration count
  const equivalentIterations = baselineResult.variance / combinedResult.variance * 500;
  console.log(`\nEquivalent Iterations:`);
  console.log(`  500 iterations with variance reduction ≈ ${Math.round(equivalentIterations)} baseline iterations`);
  console.log(`  Effective multiplier: ${(equivalentIterations / 500).toFixed(2)}x`);
}

console.log('\n=== Test Complete ===');