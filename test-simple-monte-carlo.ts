/**
 * Simple Monte Carlo Test with Hardcoded Profiles
 * Tests the fixed algorithm with direct parameters
 */

import { runRightCapitalStyleMonteCarloSimulation } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

// Profile 1: Conservative Saver (Middle-class couple)
const conservativeProfile: RetirementMonteCarloParams = {
  currentAge: 45,
  retirementAge: 67,
  lifeExpectancy: 90,
  currentRetirementAssets: 350000,
  annualSavings: 25000,
  annualRetirementExpenses: 80000,
  expectedReturn: 0.065,
  returnVolatility: 0.12,
  inflationRate: 0.025,
  stockAllocation: 0.60,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  withdrawalRate: 0.04,
  taxRate: 0.22,
  retirementState: 'FL',
  socialSecurityBenefit: 2400,
  socialSecurityStartAge: 67,
  spouseAge: 43,
  spouseRetirementAge: 65,
  spouseSocialSecurityBenefit: 1800,
  spouseSocialSecurityStartAge: 67,
  userAnnualIncome: 85000,
  spouseAnnualIncome: 65000,
  annualGuaranteedIncome: 0,
  assetBuckets: {
    taxDeferred: 180000,
    taxFree: 20000,
    capitalGains: 150000,
    cashEquivalents: 0,
    totalAssets: 350000
  }
};

// Profile 2: Aggressive Accumulator (High-income single)
const aggressiveProfile: RetirementMonteCarloParams = {
  currentAge: 35,
  retirementAge: 60,
  lifeExpectancy: 95,
  currentRetirementAssets: 500000,
  annualSavings: 50000,
  annualRetirementExpenses: 120000,
  expectedReturn: 0.08,
  returnVolatility: 0.18,
  inflationRate: 0.03,
  stockAllocation: 0.80,
  bondAllocation: 0.15,
  cashAllocation: 0.05,
  withdrawalRate: 0.035,
  taxRate: 0.32,
  retirementState: 'CA',
  socialSecurityBenefit: 3500,
  socialSecurityStartAge: 70,
  userAnnualIncome: 250000,
  annualGuaranteedIncome: 0,
  assetBuckets: {
    taxDeferred: 250000,
    taxFree: 50000,
    capitalGains: 200000,
    cashEquivalents: 0,
    totalAssets: 500000
  }
};

// Profile 3: Late Starter (Near retirement with limited savings)
const lateStarterProfile: RetirementMonteCarloParams = {
  currentAge: 58,
  retirementAge: 70,
  lifeExpectancy: 85,
  currentRetirementAssets: 175000,
  annualSavings: 30000,
  annualRetirementExpenses: 60000,
  expectedReturn: 0.055,
  returnVolatility: 0.10,
  inflationRate: 0.025,
  stockAllocation: 0.40,
  bondAllocation: 0.50,
  cashAllocation: 0.10,
  withdrawalRate: 0.045,
  taxRate: 0.15,
  retirementState: 'TX',
  socialSecurityBenefit: 1800,
  socialSecurityStartAge: 70,
  spouseAge: 56,
  spouseRetirementAge: 68,
  spouseSocialSecurityBenefit: 1200,
  spouseSocialSecurityStartAge: 68,
  userAnnualIncome: 75000,
  spouseAnnualIncome: 45000,
  partTimeIncomeRetirement: 1500,
  spousePartTimeIncomeRetirement: 1000,
  annualGuaranteedIncome: 0,
  assetBuckets: {
    taxDeferred: 85000,
    taxFree: 15000,
    capitalGains: 75000,
    cashEquivalents: 0,
    totalAssets: 175000
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

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.floor(sorted.length * percentile);
  return sorted[index] || 0;
}

function runTest(profile: RetirementMonteCarloParams, name: string, iterations: number = 1000) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${name}`);
  console.log(`${'='.repeat(70)}`);
  
  const startTime = Date.now();
  const result = runRightCapitalStyleMonteCarloSimulation(profile, iterations, false);
  const endTime = Date.now();
  
  console.log(`Simulation completed in ${((endTime - startTime) / 1000).toFixed(1)} seconds`);
  console.log(`Success Rate: ${(result.successProbability * 100).toFixed(1)}%`);
  console.log(`Average Surplus: ${formatCurrency(result.summary.averageSurplus)}`);
  console.log(`Average Deficit: ${formatCurrency(result.summary.averageDeficit)}`);
  console.log(`Median Final Value: ${formatCurrency(result.summary.medianFinalValue)}`);
  
  // Calculate percentiles from results
  const endingBalances = result.results.map(iter => iter.finalPortfolioValue).sort((a, b) => a - b);
  
  console.log(`\nEnding Balance Distribution:`);
  console.log(`  10th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.10))}`);
  console.log(`  25th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.25))}`);
  console.log(`  50th percentile (median): ${formatCurrency(calculatePercentile(endingBalances, 0.50))}`);
  console.log(`  75th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.75))}`);
  console.log(`  90th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.90))}`);
  
  // Age-based portfolio projections (confidence intervals)
  const ageProjections = new Map<number, number[]>();
  
  result.results.forEach(iter => {
    iter.yearlyData.forEach(yearData => {
      const age = yearData.age;
      if (!ageProjections.has(age)) {
        ageProjections.set(age, []);
      }
      ageProjections.get(age)!.push(yearData.portfolioBalance);
    });
  });
  
  console.log(`\nPortfolio Balance Confidence Intervals by Age:`);
  console.log(`Age    5%         25%        Median     75%        95%        Success%`);
  console.log(`${'─'.repeat(75)}`);
  
  const keyAges = [65, 70, 75, 80, 85, 90];
  for (const age of keyAges) {
    const balances = ageProjections.get(age);
    if (balances && balances.length > 0) {
      const sorted = balances.sort((a, b) => a - b);
      const successRate = balances.filter(b => b > 0).length / balances.length;
      
      console.log(
        `${age.toString().padEnd(6)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.05)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.25)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.50)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.75)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.95)).padEnd(11)}` +
        `${(successRate * 100).toFixed(1)}%`
      );
    }
  }
  
  // Calculate years until depletion distribution
  const depletionYears = result.results
    .filter(iter => iter.yearsUntilDepletion !== null)
    .map(iter => iter.yearsUntilDepletion as number)
    .sort((a, b) => a - b);
  
  if (depletionYears.length > 0) {
    console.log(`\nYears Until Depletion (for failed scenarios):`);
    console.log(`  Median: ${calculatePercentile(depletionYears, 0.50).toFixed(1)} years`);
    console.log(`  25th percentile: ${calculatePercentile(depletionYears, 0.25).toFixed(1)} years`);
    console.log(`  75th percentile: ${calculatePercentile(depletionYears, 0.75).toFixed(1)} years`);
  }
  
  return result;
}

// Run all tests
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║           MONTE CARLO SIMULATION TEST - FIXED ALGORITHM             ║');
console.log('║                    Testing 3 Financial Profiles                     ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

const conservativeResult = runTest(conservativeProfile, 'Conservative Saver Family', 1000);
const aggressiveResult = runTest(aggressiveProfile, 'Aggressive Accumulator', 1000);
const lateStarterResult = runTest(lateStarterProfile, 'Late Starter Couple', 1000);

// Summary comparison
console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║                        COMPARATIVE SUMMARY                          ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('\nProfile                         Success%   Median End     Avg End');
console.log('─'.repeat(70));

const profiles = [
  { name: 'Conservative Saver Family', result: conservativeResult },
  { name: 'Aggressive Accumulator', result: aggressiveResult },
  { name: 'Late Starter Couple', result: lateStarterResult }
];

for (const { name, result } of profiles) {
  const endingBalances = result.results.map(iter => iter.finalPortfolioValue).sort((a, b) => a - b);
  const median = calculatePercentile(endingBalances, 0.50);
  
  console.log(
    `${name.padEnd(32)}` +
    `${(result.successProbability * 100).toFixed(1).padStart(8)}%  ` +
    `${formatCurrency(median).padStart(12)}  ` +
    `${formatCurrency(result.summary.averageSurplus).padStart(12)}`
  );
}

console.log('\n✅ All tests completed!');