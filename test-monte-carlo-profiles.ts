/**
 * Comprehensive Monte Carlo Testing Suite
 * Tests retirement success probability with 3 different financial profiles
 * Generates confidence intervals for asset projections
 */

import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';
import * as fs from 'fs';
import * as path from 'path';

// Test Profile 1: Conservative Saver (Middle-class couple)
const conservativeProfile: RetirementMonteCarloParams = {
  currentAge: 45,
  retirementAge: 67,
  lifeExpectancy: 90,
  currentRetirementAssets: 350000,
  annualSavings: 25000,
  annualRetirementExpenses: 80000,
  annualHealthcareCosts: 15000,
  expectedReturn: 0.065, // 6.5% expected return
  returnVolatility: 0.12, // 12% volatility
  inflationRate: 0.025, // 2.5% inflation
  stockAllocation: 0.60, // 60% stocks
  bondAllocation: 0.35, // 35% bonds
  cashAllocation: 0.05, // 5% cash
  withdrawalRate: 0.04, // 4% withdrawal rate
  taxRate: 0.22, // 22% tax rate
  retirementState: 'FL',
  
  // Additional parameters
  userAnnualIncome: 85000,
  spouseAnnualIncome: 65000,
  spouseAge: 43,
  spouseRetirementAge: 65,
  spouseLifeExpectancy: 92,
  
  // Social Security
  socialSecurityBenefit: 2400, // $2,400/month
  spouseSocialSecurityBenefit: 1800, // $1,800/month
  socialSecurityStartAge: 67,
  spouseSocialSecurityStartAge: 67,
  
  // Account types
  taxableAssets: 150000,
  taxDeferredAssets: 180000,
  rothAssets: 20000,
  
  // Asset buckets
  assetBuckets: {
    taxDeferred: 180000,
    taxFree: 20000,  // Roth accounts
    capitalGains: 150000,  // Taxable accounts
    cashEquivalents: 0,
    totalAssets: 350000
  },
  
  // Profile data
  profileData: {
    name: 'Conservative Saver Family',
    primaryResidence: {
      value: 450000,
      yearsToPayOffMortgage: 15,
      monthlyPayment: 2200
    }
  }
};

// Test Profile 2: Aggressive Accumulator (High-income single)
const aggressiveProfile: RetirementMonteCarloParams = {
  currentAge: 35,
  retirementAge: 60,
  lifeExpectancy: 95,
  currentRetirementAssets: 500000,
  annualSavings: 50000,
  annualRetirementExpenses: 120000,
  annualHealthcareCosts: 20000,
  expectedReturn: 0.08, // 8% expected return
  returnVolatility: 0.18, // 18% volatility
  inflationRate: 0.03, // 3% inflation
  stockAllocation: 0.80, // 80% stocks
  bondAllocation: 0.15, // 15% bonds
  cashAllocation: 0.05, // 5% cash
  withdrawalRate: 0.035, // 3.5% withdrawal rate
  taxRate: 0.32, // 32% tax rate
  retirementState: 'CA',
  
  // Additional parameters
  userAnnualIncome: 250000,
  
  // Social Security
  socialSecurityBenefit: 3500, // $3,500/month (max benefit)
  socialSecurityStartAge: 70, // Delayed to 70
  
  // Account types
  taxableAssets: 200000,
  taxDeferredAssets: 250000,
  rothAssets: 50000,
  
  // Asset buckets
  assetBuckets: {
    taxDeferred: 250000,
    taxFree: 50000,  // Roth accounts
    capitalGains: 200000,  // Taxable accounts
    cashEquivalents: 0,
    totalAssets: 500000
  },
  
  // Profile data
  profileData: {
    name: 'Aggressive Accumulator',
    primaryResidence: {
      value: 1200000,
      yearsToPayOffMortgage: 20,
      monthlyPayment: 5500
    }
  }
};

// Test Profile 3: Late Starter (Near retirement with limited savings)
const lateStarterProfile: RetirementMonteCarloParams = {
  currentAge: 58,
  retirementAge: 70,
  lifeExpectancy: 85,
  currentRetirementAssets: 175000,
  annualSavings: 30000,
  annualRetirementExpenses: 60000,
  annualHealthcareCosts: 12000,
  expectedReturn: 0.055, // 5.5% expected return (conservative)
  returnVolatility: 0.10, // 10% volatility
  inflationRate: 0.025, // 2.5% inflation
  stockAllocation: 0.40, // 40% stocks
  bondAllocation: 0.50, // 50% bonds
  cashAllocation: 0.10, // 10% cash
  withdrawalRate: 0.045, // 4.5% withdrawal rate
  taxRate: 0.15, // 15% tax rate
  retirementState: 'TX',
  
  // Additional parameters
  userAnnualIncome: 75000,
  spouseAnnualIncome: 45000,
  spouseAge: 56,
  spouseRetirementAge: 68,
  spouseLifeExpectancy: 87,
  
  // Social Security
  socialSecurityBenefit: 1800, // $1,800/month
  spouseSocialSecurityBenefit: 1200, // $1,200/month
  socialSecurityStartAge: 70,
  spouseSocialSecurityStartAge: 68,
  
  // Part-time income in retirement
  partTimeIncomeRetirement: 1500, // $1,500/month
  spousePartTimeIncomeRetirement: 1000, // $1,000/month
  
  // Account types
  taxableAssets: 75000,
  taxDeferredAssets: 85000,
  rothAssets: 15000,
  
  // Asset buckets
  assetBuckets: {
    taxDeferred: 85000,
    taxFree: 15000,  // Roth accounts
    capitalGains: 75000,  // Taxable accounts
    cashEquivalents: 0,
    totalAssets: 175000
  },
  
  // Profile data
  profileData: {
    name: 'Late Starter Couple',
    primaryResidence: {
      value: 280000,
      yearsToPayOffMortgage: 8,
      monthlyPayment: 1800
    }
  }
};

interface ProfileTestResult {
  profileName: string;
  successProbability: number;
  medianEndingBalance: number;
  averageEndingBalance: number;
  percentile10Balance: number;
  percentile25Balance: number;
  percentile75Balance: number;
  percentile90Balance: number;
  yearlyProjections: YearlyProjection[];
  confidenceIntervals: ConfidenceInterval[];
  averageYearsUntilDepletion: number | null;
  probabilityOfRuinByAge: Map<number, number>;
}

interface YearlyProjection {
  year: number;
  age: number;
  median: number;
  mean: number;
  percentile10: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
  successRate: number;
}

interface ConfidenceInterval {
  age: number;
  lower95: number;
  lower80: number;
  median: number;
  upper80: number;
  upper95: number;
}

/**
 * Run comprehensive test for a single profile
 */
async function testProfile(
  profile: RetirementMonteCarloParams,
  iterations: number = 1000
): Promise<ProfileTestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Profile: ${profile.profileData?.name || 'Unknown'}`);
  console.log(`${'='.repeat(60)}`);
  
  // Run the simulation
  const startTime = Date.now();
  const result = await runEnhancedMonteCarloSimulation(profile, iterations, true);
  const endTime = Date.now();
  
  console.log(`Simulation completed in ${((endTime - startTime) / 1000).toFixed(1)} seconds`);
  
  // Extract yearly projections and confidence intervals
  const yearlyData = new Map<number, number[]>();
  const ruinByAge = new Map<number, number>();
  
  // Collect data from all scenarios
  if (result.yearlyData) {
    result.yearlyData.forEach(yearData => {
      const age = yearData.age;
      if (!yearlyData.has(age)) {
        yearlyData.set(age, []);
      }
      yearlyData.get(age)!.push(yearData.portfolioBalance);
    });
  }
  
  // Calculate projections for each year
  const yearlyProjections: YearlyProjection[] = [];
  const confidenceIntervals: ConfidenceInterval[] = [];
  
  for (const [age, balances] of yearlyData.entries()) {
    const sortedBalances = balances.sort((a, b) => a - b);
    const n = sortedBalances.length;
    
    if (n > 0) {
      const projection: YearlyProjection = {
        year: age - profile.currentAge,
        age,
        median: sortedBalances[Math.floor(n * 0.5)],
        mean: sortedBalances.reduce((a, b) => a + b, 0) / n,
        percentile10: sortedBalances[Math.floor(n * 0.1)],
        percentile25: sortedBalances[Math.floor(n * 0.25)],
        percentile75: sortedBalances[Math.floor(n * 0.75)],
        percentile90: sortedBalances[Math.floor(n * 0.9)],
        successRate: sortedBalances.filter(b => b > 0).length / n
      };
      yearlyProjections.push(projection);
      
      const interval: ConfidenceInterval = {
        age,
        lower95: sortedBalances[Math.floor(n * 0.025)],
        lower80: sortedBalances[Math.floor(n * 0.1)],
        median: projection.median,
        upper80: sortedBalances[Math.floor(n * 0.9)],
        upper95: sortedBalances[Math.floor(n * 0.975)]
      };
      confidenceIntervals.push(interval);
      
      ruinByAge.set(age, 1 - projection.successRate);
    }
  }
  
  // Sort ending balances for percentile calculations
  const endingBalances = result.allScenarios
    ?.map(s => s.endingBalance)
    .sort((a, b) => a - b) || [];
  
  const n = endingBalances.length;
  
  return {
    profileName: profile.profileData?.name || 'Unknown',
    successProbability: result.successProbability,
    medianEndingBalance: n > 0 ? endingBalances[Math.floor(n * 0.5)] : 0,
    averageEndingBalance: result.averageEndingBalance,
    percentile10Balance: n > 0 ? endingBalances[Math.floor(n * 0.1)] : 0,
    percentile25Balance: n > 0 ? endingBalances[Math.floor(n * 0.25)] : 0,
    percentile75Balance: n > 0 ? endingBalances[Math.floor(n * 0.75)] : 0,
    percentile90Balance: n > 0 ? endingBalances[Math.floor(n * 0.9)] : 0,
    yearlyProjections,
    confidenceIntervals,
    averageYearsUntilDepletion: result.averageYearsUntilDepletion,
    probabilityOfRuinByAge: ruinByAge
  };
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Generate detailed report for a profile
 */
function generateReport(result: ProfileTestResult): string {
  let report = `\n${'='.repeat(80)}\n`;
  report += `MONTE CARLO SIMULATION REPORT: ${result.profileName}\n`;
  report += `${'='.repeat(80)}\n\n`;
  
  // Executive Summary
  report += `EXECUTIVE SUMMARY\n`;
  report += `${'─'.repeat(40)}\n`;
  report += `Success Probability: ${(result.successProbability * 100).toFixed(1)}%\n`;
  report += `Median Ending Balance: ${formatCurrency(result.medianEndingBalance)}\n`;
  report += `Average Ending Balance: ${formatCurrency(result.averageEndingBalance)}\n`;
  
  if (result.averageYearsUntilDepletion !== null) {
    report += `Average Years Until Depletion (if failed): ${result.averageYearsUntilDepletion.toFixed(1)} years\n`;
  }
  
  // Ending Balance Distribution
  report += `\nENDING BALANCE DISTRIBUTION\n`;
  report += `${'─'.repeat(40)}\n`;
  report += `10th Percentile: ${formatCurrency(result.percentile10Balance)}\n`;
  report += `25th Percentile: ${formatCurrency(result.percentile25Balance)}\n`;
  report += `50th Percentile (Median): ${formatCurrency(result.medianEndingBalance)}\n`;
  report += `75th Percentile: ${formatCurrency(result.percentile75Balance)}\n`;
  report += `90th Percentile: ${formatCurrency(result.percentile90Balance)}\n`;
  
  // Key Ages Confidence Intervals
  report += `\nASSET PROJECTION CONFIDENCE INTERVALS\n`;
  report += `${'─'.repeat(40)}\n`;
  report += `Age    95% Lower    80% Lower    Median       80% Upper    95% Upper    Success%\n`;
  report += `${'─'.repeat(85)}\n`;
  
  // Show projections for key ages
  const keyAges = [65, 70, 75, 80, 85, 90];
  for (const targetAge of keyAges) {
    const interval = result.confidenceIntervals.find(ci => ci.age === targetAge);
    const projection = result.yearlyProjections.find(p => p.age === targetAge);
    
    if (interval && projection) {
      report += `${targetAge.toString().padEnd(6)}`;
      report += `${formatCurrency(interval.lower95).padEnd(13)}`;
      report += `${formatCurrency(interval.lower80).padEnd(13)}`;
      report += `${formatCurrency(interval.median).padEnd(13)}`;
      report += `${formatCurrency(interval.upper80).padEnd(13)}`;
      report += `${formatCurrency(interval.upper95).padEnd(13)}`;
      report += `${(projection.successRate * 100).toFixed(1)}%\n`;
    }
  }
  
  // Probability of Ruin by Age
  report += `\nPROBABILITY OF PORTFOLIO DEPLETION BY AGE\n`;
  report += `${'─'.repeat(40)}\n`;
  
  const ruinAges = [70, 75, 80, 85, 90];
  for (const age of ruinAges) {
    const prob = result.probabilityOfRuinByAge.get(age);
    if (prob !== undefined) {
      report += `Age ${age}: ${(prob * 100).toFixed(1)}%\n`;
    }
  }
  
  // Full Yearly Projections Table
  report += `\nDETAILED YEARLY PROJECTIONS\n`;
  report += `${'─'.repeat(80)}\n`;
  report += `Age    Year   10th %ile    25th %ile    Median       75th %ile    90th %ile    Success%\n`;
  report += `${'─'.repeat(90)}\n`;
  
  // Show every 5 years
  for (let i = 0; i < result.yearlyProjections.length; i += 5) {
    const proj = result.yearlyProjections[i];
    if (proj) {
      report += `${proj.age.toString().padEnd(7)}`;
      report += `${proj.year.toString().padEnd(7)}`;
      report += `${formatCurrency(proj.percentile10).padEnd(13)}`;
      report += `${formatCurrency(proj.percentile25).padEnd(13)}`;
      report += `${formatCurrency(proj.median).padEnd(13)}`;
      report += `${formatCurrency(proj.percentile75).padEnd(13)}`;
      report += `${formatCurrency(proj.percentile90).padEnd(13)}`;
      report += `${(proj.successRate * 100).toFixed(1)}%\n`;
    }
  }
  
  return report;
}

/**
 * Generate CSV data for further analysis
 */
function generateCSV(results: ProfileTestResult[]): string {
  let csv = 'Profile,Age,Year,Lower_95%,Lower_80%,25th_Percentile,Median,Mean,75th_Percentile,Upper_80%,Upper_95%,Success_Rate\n';
  
  for (const result of results) {
    for (let i = 0; i < result.yearlyProjections.length; i++) {
      const proj = result.yearlyProjections[i];
      const interval = result.confidenceIntervals[i];
      
      if (proj && interval) {
        csv += `"${result.profileName}",`;
        csv += `${proj.age},`;
        csv += `${proj.year},`;
        csv += `${interval.lower95.toFixed(0)},`;
        csv += `${interval.lower80.toFixed(0)},`;
        csv += `${proj.percentile25.toFixed(0)},`;
        csv += `${proj.median.toFixed(0)},`;
        csv += `${proj.mean.toFixed(0)},`;
        csv += `${proj.percentile75.toFixed(0)},`;
        csv += `${interval.upper80.toFixed(0)},`;
        csv += `${interval.upper95.toFixed(0)},`;
        csv += `${(proj.successRate * 100).toFixed(2)}\n`;
      }
    }
  }
  
  return csv;
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     MONTE CARLO RETIREMENT SIMULATION TEST SUITE            ║');
  console.log('║     Testing 3 Financial Profiles with 1,000 Iterations      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const profiles = [
    conservativeProfile,
    aggressiveProfile,
    lateStarterProfile
  ];
  
  const results: ProfileTestResult[] = [];
  
  // Run tests for each profile
  for (const profile of profiles) {
    try {
      const result = await testProfile(profile, 1000);
      results.push(result);
      
      // Generate and display report
      const report = generateReport(result);
      console.log(report);
      
      // Save individual report
      const filename = `monte-carlo-report-${profile.profileData?.name?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}.txt`;
      fs.writeFileSync(filename, report);
      console.log(`Report saved to: ${filename}`);
      
    } catch (error) {
      console.error(`Error testing profile ${profile.profileData?.name}:`, error);
    }
  }
  
  // Generate comparative summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                  COMPARATIVE SUMMARY                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('Profile Name                    Success%   Median End Balance   Avg End Balance');
  console.log('─'.repeat(80));
  
  for (const result of results) {
    console.log(
      `${result.profileName.padEnd(32)}` +
      `${(result.successProbability * 100).toFixed(1).padStart(8)}%  ` +
      `${formatCurrency(result.medianEndingBalance).padStart(18)}  ` +
      `${formatCurrency(result.averageEndingBalance).padStart(18)}`
    );
  }
  
  // Save CSV for further analysis
  const csvData = generateCSV(results);
  const csvFilename = 'monte-carlo-confidence-intervals.csv';
  fs.writeFileSync(csvFilename, csvData);
  console.log(`\nCSV data saved to: ${csvFilename}`);
  
  // Generate summary JSON
  const summaryData = {
    testDate: new Date().toISOString(),
    iterations: 1000,
    profiles: results.map(r => ({
      name: r.profileName,
      successProbability: r.successProbability,
      medianEndingBalance: r.medianEndingBalance,
      averageEndingBalance: r.averageEndingBalance,
      confidenceIntervals: r.confidenceIntervals.filter(ci => 
        [65, 70, 75, 80, 85, 90].includes(ci.age)
      )
    }))
  };
  
  const jsonFilename = 'monte-carlo-test-results.json';
  fs.writeFileSync(jsonFilename, JSON.stringify(summaryData, null, 2));
  console.log(`JSON results saved to: ${jsonFilename}`);
  
  console.log('\n✅ All tests completed successfully!');
}

// Run the tests
runAllTests().catch(console.error);