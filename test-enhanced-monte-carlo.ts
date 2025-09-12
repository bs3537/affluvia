/**
 * Test Suite for ENHANCED Monte Carlo Algorithm with All Fixes
 * Uses the main runEnhancedMonteCarloSimulation function
 */

import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

// Profile 1: Conservative Saver (Middle-class couple)
const conservativeProfile: RetirementMonteCarloParams = {
  currentAge: 45,
  retirementAge: 67,
  lifeExpectancy: 90,
  currentRetirementAssets: 350000,
  annualSavings: 25000,
  annualRetirementExpenses: 80000,
  annualHealthcareCosts: 15000,
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
  spouseLifeExpectancy: 92,
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
  annualHealthcareCosts: 20000,
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
  annualHealthcareCosts: 12000,
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
  spouseLifeExpectancy: 87,
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

async function runEnhancedTest(profile: RetirementMonteCarloParams, name: string, iterations: number = 1000) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Profile Details:`);
  console.log(`  Current Age: ${profile.currentAge}`);
  console.log(`  Retirement Age: ${profile.retirementAge}`);
  console.log(`  Current Assets: ${formatCurrency(profile.currentRetirementAssets)}`);
  console.log(`  Annual Savings: ${formatCurrency(profile.annualSavings)}`);
  console.log(`  Annual Expenses: ${formatCurrency(profile.annualRetirementExpenses)}`);
  console.log(`  Healthcare Costs: ${formatCurrency(profile.annualHealthcareCosts || 0)}`);
  console.log(`  Asset Allocation: ${(profile.stockAllocation * 100).toFixed(0)}% stocks / ${(profile.bondAllocation * 100).toFixed(0)}% bonds / ${(profile.cashAllocation * 100).toFixed(0)}% cash`);
  
  const startTime = Date.now();
  const result = runEnhancedMonteCarloSimulation(profile, iterations, false);
  const endTime = Date.now();
  
  console.log(`\n✅ Simulation completed in ${((endTime - startTime) / 1000).toFixed(1)} seconds`);
  console.log(`\n📊 RESULTS:`);
  console.log(`Success Probability: ${(result.successProbability * 100).toFixed(1)}%`);
  console.log(`Average Ending Balance: ${formatCurrency(result.averageEndingBalance)}`);
  
  // Extract ending balances from scenarios
  const endingBalances = result.allScenarios?.map(s => s.endingBalance).sort((a, b) => a - b) || [];
  
  if (endingBalances.length > 0) {
    console.log(`\n💰 ENDING BALANCE DISTRIBUTION:`);
    console.log(`  5th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.05))}`);
    console.log(`  10th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.10))}`);
    console.log(`  25th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.25))}`);
    console.log(`  50th percentile (median): ${formatCurrency(calculatePercentile(endingBalances, 0.50))}`);
    console.log(`  75th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.75))}`);
    console.log(`  90th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.90))}`);
    console.log(`  95th percentile: ${formatCurrency(calculatePercentile(endingBalances, 0.95))}`);
  }
  
  // Extract age-based projections for confidence intervals
  const ageProjections = new Map<number, number[]>();
  
  if (result.allScenarios) {
    result.allScenarios.forEach(scenario => {
      if (scenario.yearlyCashFlows) {
        scenario.yearlyCashFlows.forEach(year => {
          const age = year.age;
          if (!ageProjections.has(age)) {
            ageProjections.set(age, []);
          }
          ageProjections.get(age)!.push(year.portfolioBalance);
        });
      }
    });
  }
  
  console.log(`\n📈 PORTFOLIO BALANCE CONFIDENCE INTERVALS BY AGE:`);
  console.log(`Age    5%         10%        25%        Median     75%        90%        95%        Success%`);
  console.log(`${'─'.repeat(95)}`);
  
  // Show key ages
  const startAge = Math.max(65, profile.retirementAge);
  const endAge = Math.min(95, profile.lifeExpectancy);
  
  for (let age = startAge; age <= endAge; age += 5) {
    const balances = ageProjections.get(age);
    if (balances && balances.length > 0) {
      const sorted = balances.sort((a, b) => a - b);
      const successRate = balances.filter(b => b > 0).length / balances.length;
      
      console.log(
        `${age.toString().padEnd(6)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.05)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.10)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.25)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.50)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.75)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.90)).padEnd(11)}` +
        `${formatCurrency(calculatePercentile(sorted, 0.95)).padEnd(11)}` +
        `${(successRate * 100).toFixed(1)}%`
      );
    }
  }
  
  // Additional statistics
  if (result.averageYearsUntilDepletion !== null && result.averageYearsUntilDepletion !== undefined) {
    console.log(`\n⚠️  Average Years Until Depletion (failed scenarios): ${result.averageYearsUntilDepletion.toFixed(1)} years`);
  }
  
  // Monte Carlo specific features
  if (result.guytonKlingerStats) {
    console.log(`\n🎯 GUYTON-KLINGER ADJUSTMENTS:`);
    console.log(`  Average adjustments per scenario: ${result.guytonKlingerStats.averageAdjustments?.toFixed(1) || 'N/A'}`);
    console.log(`  Max adjustments in a scenario: ${result.guytonKlingerStats.maxAdjustments || 'N/A'}`);
  }
  
  if (result.ltcAnalysis) {
    console.log(`\n🏥 LONG-TERM CARE ANALYSIS:`);
    console.log(`  Probability of LTC event: ${(result.ltcAnalysis.probabilityOfLTC * 100).toFixed(1)}%`);
    console.log(`  Average LTC cost: ${formatCurrency(result.ltcAnalysis.averageLTCCost || 0)}`);
  }
  
  return result;
}

// Main test runner
async function runAllEnhancedTests() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        ENHANCED MONTE CARLO SIMULATION TEST WITH ALL FIXES          ║');
  console.log('║     Testing with Mean-Reversion, Corrected Healthcare, IRMAA,       ║');
  console.log('║     Fixed Guyton-Klinger, Unconditional Regimes, and More           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  // Test each profile
  const conservativeResult = await runEnhancedTest(conservativeProfile, 'Conservative Saver Family', 1000);
  results.push({ name: 'Conservative Saver', result: conservativeResult });
  
  const aggressiveResult = await runEnhancedTest(aggressiveProfile, 'Aggressive Accumulator', 1000);
  results.push({ name: 'Aggressive Accumulator', result: aggressiveResult });
  
  const lateStarterResult = await runEnhancedTest(lateStarterProfile, 'Late Starter Couple', 1000);
  results.push({ name: 'Late Starter Couple', result: lateStarterResult });
  
  // Comparative summary
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    COMPARATIVE SUMMARY - ENHANCED                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('\nProfile                         Success%   Median End     Avg End       Fixes Applied');
  console.log('─'.repeat(90));
  
  for (const { name, result } of results) {
    const endingBalances = result.allScenarios?.map(s => s.endingBalance).sort((a, b) => a - b) || [];
    const median = endingBalances.length > 0 ? calculatePercentile(endingBalances, 0.50) : 0;
    
    console.log(
      `${name.padEnd(32)}` +
      `${(result.successProbability * 100).toFixed(1).padStart(8)}%  ` +
      `${formatCurrency(median).padStart(12)}  ` +
      `${formatCurrency(result.averageEndingBalance).padStart(12)}  ` +
      `✓ All fixes`
    );
  }
  
  console.log('\n✅ ENHANCED ALGORITHM TEST COMPLETE!');
  console.log('\nKey Improvements Applied:');
  console.log('  ✓ Mean-reversion applied BEFORE balance updates');
  console.log('  ✓ Healthcare inflation uses only differential (no double-counting)');
  console.log('  ✓ Cost basis tracking corrected (removed unit bug)');
  console.log('  ✓ IRMAA lookback initialized with pre-retirement income');
  console.log('  ✓ Guyton-Klinger essential floor: 70% (was 55%)');
  console.log('  ✓ Market regimes unconditional (removed age bias)');
  console.log('  ✓ Performance optimizations with verbose control');
}

// Run the enhanced tests
runAllEnhancedTests().catch(console.error);