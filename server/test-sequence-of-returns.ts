// Test file to verify sequence of returns risk implementation
import { runRetirementMonteCarloSimulation } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

console.log('=== TESTING SEQUENCE OF RETURNS RISK IMPLEMENTATION ===\n');

// Test profile near retirement (high sequence risk)
const testProfile = {
  dateOfBirth: '1960-01-01', // 64 years old
  retirementAge: 65, // 1 year to retirement
  currentAge: 64,
  lifeExpectancy: 90,
  
  // Financial data
  currentRetirementAssets: 1000000,
  annualRetirementExpenses: 80000,
  annualHealthcareCosts: 10000,
  
  // Income sources
  socialSecurityBenefit: 2500,
  socialSecurityClaimAge: 67,
  pensionBenefit: 0,
  
  // Asset allocation
  currentAllocation: {
    usStocks: 60,
    intlStocks: 10,
    bonds: 25,
    cash: 5,
    alternatives: 0
  },
  
  expectedInflationRate: 3,
  expectedRealReturn: -1, // Use glide path
  withdrawalRate: 0.04,
  
  // Asset buckets
  assetBuckets: {
    taxDeferred: 600000,
    taxFree: 200000,
    capitalGains: 150000,
    cashEquivalents: 50000,
    totalAssets: 1000000
  },
  
  annualSavings: 50000,
  retirementState: 'TX'
};

// Run simulations with optimization tab algorithm
console.log('Testing Retirement Planning (monte-carlo.ts) with Sequence of Returns Risk:');
console.log('Profile: 1 year to retirement (high sequence risk)');

const optimizationResults = runRetirementMonteCarloSimulation(
  {
    ...testProfile,
    currentRetirementAssets: testProfile.currentRetirementAssets,
    annualGuaranteedIncome: testProfile.socialSecurityBenefit * 12,
    stockAllocation: 0.7,
    bondAllocation: 0.25,
    cashAllocation: 0.05,
    inflationRate: 0.03,
    expectedReturn: 0.07,
    returnVolatility: 0.15,
    taxRate: 0.15,
    legacyGoal: 0,
    useGuardrails: false,
    useGlidePath: true
  },
  100 // Run 100 simulations for testing
);

console.log(`Success Rate: ${optimizationResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${optimizationResults.medianEndingBalance.toFixed(0)}`);

// Check market regimes in cash flows
const marketRegimes = optimizationResults.yearlyCashFlows
  .filter(cf => cf.marketRegime)
  .map(cf => cf.marketRegime);

const regimeCounts = marketRegimes.reduce((acc, regime) => {
  acc[regime!] = (acc[regime!] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log('\nMarket Regime Distribution in Cash Flows:');
Object.entries(regimeCounts).forEach(([regime, count]) => {
  const percentage = ((count / marketRegimes.length) * 100).toFixed(1);
  console.log(`  ${regime}: ${count} years (${percentage}%)`);
});

// Count early retirement bear markets (first 5 years)
const earlyRetirementRegimes = optimizationResults.yearlyCashFlows
  .slice(0, 5)
  .filter(cf => cf.marketRegime)
  .map(cf => cf.marketRegime);

const earlyBearCrisis = earlyRetirementRegimes.filter(r => r === 'bear' || r === 'crisis').length;
console.log(`\nEarly Retirement (First 5 Years) Bear/Crisis Markets: ${earlyBearCrisis}/5`);

// Run with dashboard widget algorithm
console.log('\n\nTesting Dashboard Widget (monte-carlo-enhanced.ts) with Sequence of Returns Risk:');

const dashboardResults = runEnhancedMonteCarloSimulation(
  {
    ...testProfile,
    currentRetirementAssets: testProfile.currentRetirementAssets,
    annualGuaranteedIncome: testProfile.socialSecurityBenefit * 12,
    stockAllocation: 0.7,
    bondAllocation: 0.25,
    cashAllocation: 0.05,
    inflationRate: 0.03,
    expectedReturn: 0.07,
    returnVolatility: 0.15,
    taxRate: 0.15,
    legacyGoal: 0,
    useGuardrails: false,
    useGlidePath: true
  },
  100 // Run 100 simulations for testing
);

console.log(`Success Rate: ${dashboardResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${dashboardResults.medianEndingBalance.toFixed(0)}`);

// Check regime analysis in enhanced results
if (dashboardResults.regimeAnalysis) {
  console.log('\nRegime Analysis:');
  console.log(`  Average Bear Years: ${dashboardResults.regimeAnalysis.averageBearYears.toFixed(1)}`);
  console.log(`  Average Crisis Years: ${dashboardResults.regimeAnalysis.averageCrisisYears.toFixed(1)}`);
  console.log(`  Worst Case Ending Balance: $${dashboardResults.regimeAnalysis.worstCaseEndingBalance.toFixed(0)}`);
  
  if (dashboardResults.regimeAnalysis.sequenceRiskMetrics) {
    console.log('\nSequence Risk Metrics:');
    console.log(`  Bear Markets in First 5 Years: ${dashboardResults.regimeAnalysis.sequenceRiskMetrics.bearInFirst5Years}`);
    console.log(`  Crisis in First 5 Years: ${dashboardResults.regimeAnalysis.sequenceRiskMetrics.crisisInFirst5Years}`);
    console.log(`  Total Adverse Transitions: ${dashboardResults.regimeAnalysis.sequenceRiskMetrics.totalAdverseTransitions}`);
  }
}

// Compare with scenario 10+ years from retirement (low sequence risk)
console.log('\n\n=== COMPARISON: 10+ YEARS TO RETIREMENT (LOW SEQUENCE RISK) ===');

const lowRiskProfile = {
  ...testProfile,
  dateOfBirth: '1970-01-01', // 54 years old
  currentAge: 54,
  retirementAge: 65 // 11 years to retirement
};

const lowRiskResults = runRetirementMonteCarloSimulation(
  {
    ...lowRiskProfile,
    currentRetirementAssets: lowRiskProfile.currentRetirementAssets,
    annualGuaranteedIncome: lowRiskProfile.socialSecurityBenefit * 12,
    stockAllocation: 0.7,
    bondAllocation: 0.25,
    cashAllocation: 0.05,
    inflationRate: 0.03,
    expectedReturn: 0.07,
    returnVolatility: 0.15,
    taxRate: 0.15,
    legacyGoal: 0,
    useGuardrails: false,
    useGlidePath: true
  },
  100
);

console.log('Profile: 11 years to retirement (low sequence risk)');
console.log(`Success Rate: ${lowRiskResults.probabilityOfSuccess.toFixed(1)}%`);

// Check early bear/crisis probability
const lowRiskEarlyRegimes = lowRiskResults.yearlyCashFlows
  .slice(0, 5)
  .filter(cf => cf.marketRegime)
  .map(cf => cf.marketRegime);

const lowRiskEarlyBearCrisis = lowRiskEarlyRegimes.filter(r => r === 'bear' || r === 'crisis').length;
console.log(`Early Bear/Crisis Markets (First 5 Years): ${lowRiskEarlyBearCrisis}/5`);

console.log('\n=== SUMMARY ===');
console.log('Near Retirement (1 year):');
console.log(`  - Success Rate: ${optimizationResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`  - Early Bear/Crisis: ${earlyBearCrisis}/5 years`);

console.log('\nFar from Retirement (11 years):');
console.log(`  - Success Rate: ${lowRiskResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`  - Early Bear/Crisis: ${lowRiskEarlyBearCrisis}/5 years`);

const successDiff = lowRiskResults.probabilityOfSuccess - optimizationResults.probabilityOfSuccess;
if (successDiff > 5) {
  console.log('\n✅ Sequence of returns risk is properly implemented!');
  console.log(`   Success rate difference: ${successDiff.toFixed(1)}% (expected due to sequence risk)`);
} else {
  console.log('\n⚠️ Sequence of returns risk effect is minimal');
  console.log('   This could be due to:');
  console.log('   1. Small sample size (100 simulations)');
  console.log('   2. Strong guaranteed income offsetting market risk');
  console.log('   3. Conservative withdrawal rate');
}

console.log('\n=== TEST COMPLETE ===');