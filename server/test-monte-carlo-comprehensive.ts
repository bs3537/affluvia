/**
 * Comprehensive Test Suite for Enhanced Monte Carlo Retirement Algorithm
 * Tests 5 diverse client profiles with different retirement scenarios
 */

import { runRightCapitalStyleMonteCarloSimulation } from './monte-carlo-enhanced';
import type { RetirementMonteCarloParams } from './monte-carlo-enhanced';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Helper function to calculate percentiles
const calculatePercentile = (values: number[], percentile: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

// Test Profile 1: Early Retiree Couple (FIRE Movement)
const profile1_EarlyRetiree: RetirementMonteCarloParams = {
  // Personal Information
  currentAge: 45,
  spouseAge: 43,
  retirementAge: 50,
  spouseRetirementAge: 48,
  lifeExpectancy: 90,
  spouseLifeExpectancy: 92,
  
  // Assets & Savings
  currentRetirementAssets: 1500000,
  annualSavings: 100000,
  userAnnualSavings: 60000,
  spouseAnnualSavings: 40000,
  
  // Asset Allocation
  currentAllocation: {
    stocks: 0.70,
    bonds: 0.25,
    cash: 0.05,
    alternatives: 0
  },
  recommendedAllocation: {
    stocks: 0.60,
    bonds: 0.35,
    cash: 0.05,
    alternatives: 0
  },
  
  // Expenses & Income
  annualRetirementExpenses: 80000,
  socialSecurityBenefit: 2000, // Monthly at 67
  spouseSocialSecurityBenefit: 1800,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  
  // Market Assumptions
  expectedReturn: 0.065,
  returnVolatility: 0.15,
  inflationRate: 0.025,
  
  // Tax & Location
  taxRate: 0.22,
  retirementState: 'TX', // No state tax
  
  // Profile Data with Assets
  profileData: {
    maritalStatus: 'married',
    state: 'CA', // Current state
    retirementState: 'TX', // Retirement state
    primaryResidence: {
      value: 800000,
      monthlyPayment: 3500,
      yearsToPayOffMortgage: 5,
      mortgageBalance: 150000
    },
    assets: [
      { type: '401k', value: 800000, owner: 'user' },
      { type: 'roth-ira', value: 200000, owner: 'user' },
      { type: '401k', value: 400000, owner: 'spouse' },
      { type: 'brokerage', value: 100000, owner: 'joint' }
    ]
  },
  
  // Options
  legacyGoal: 500000,
  ltcModeling: {
    enabled: true,
    hasInsurance: false,
    insuranceBenefit: 0,
    costInflationRate: 0.045,
    averageAnnualCost: 75000,
    lifetimeProbability: 0.30,
    onsetAgeRange: [75, 85] as [number, number],
    averageDuration: 2.5,
    gender: 'M' as const
  }
};

// Test Profile 2: High Earner Near Retirement
const profile2_HighEarner: RetirementMonteCarloParams = {
  // Personal Information
  currentAge: 58,
  spouseAge: 56,
  retirementAge: 62,
  spouseRetirementAge: 62,
  lifeExpectancy: 87,
  spouseLifeExpectancy: 89,
  
  // Assets & Savings
  currentRetirementAssets: 3500000,
  annualSavings: 150000,
  userAnnualSavings: 100000,
  spouseAnnualSavings: 50000,
  
  // Asset Allocation
  currentAllocation: {
    stocks: 0.65,
    bonds: 0.30,
    cash: 0.05,
    alternatives: 0
  },
  recommendedAllocation: {
    stocks: 0.50,
    bonds: 0.45,
    cash: 0.05,
    alternatives: 0
  },
  
  // Expenses & Income
  annualRetirementExpenses: 150000,
  socialSecurityBenefit: 3500, // Max benefit
  spouseSocialSecurityBenefit: 2500,
  socialSecurityClaimAge: 70, // Delayed claiming
  spouseSocialSecurityClaimAge: 67,
  pensionBenefit: 3000, // Monthly pension
  
  // Market Assumptions
  expectedReturn: 0.06,
  returnVolatility: 0.14,
  inflationRate: 0.025,
  
  // Tax & Location
  taxRate: 0.32,
  retirementState: 'CA', // High tax state
  
  // Profile Data with Assets
  profileData: {
    maritalStatus: 'married',
    state: 'CA',
    retirementState: 'CA',
    primaryResidence: {
      value: 1500000,
      monthlyPayment: 5000,
      yearsToPayOffMortgage: 8,
      mortgageBalance: 350000
    },
    assets: [
      { type: '401k', value: 1800000, owner: 'user' },
      { type: 'roth-401k', value: 400000, owner: 'user' },
      { type: 'ira', value: 600000, owner: 'spouse' },
      { type: 'brokerage', value: 500000, owner: 'joint' },
      { type: 'savings', value: 200000, owner: 'joint' }
    ]
  },
  
  // Options
  legacyGoal: 1000000,
  ltcModeling: {
    enabled: true,
    hasInsurance: true,
    insuranceBenefit: 5000, // Monthly LTC benefit
    costInflationRate: 0.045,
    averageAnnualCost: 90000,
    lifetimeProbability: 0.35,
    onsetAgeRange: [75, 85] as [number, number],
    averageDuration: 3.0,
    gender: 'M' as const
  }
};

// Test Profile 3: Single Late Starter
const profile3_LateStarter: RetirementMonteCarloParams = {
  // Personal Information
  currentAge: 55,
  spouseAge: undefined,
  retirementAge: 70,
  spouseRetirementAge: undefined,
  lifeExpectancy: 85,
  spouseLifeExpectancy: undefined,
  
  // Assets & Savings
  currentRetirementAssets: 250000,
  annualSavings: 30000,
  userAnnualSavings: 30000,
  spouseAnnualSavings: 0,
  
  // Asset Allocation
  currentAllocation: {
    stocks: 0.50,
    bonds: 0.40,
    cash: 0.10,
    alternatives: 0
  },
  recommendedAllocation: {
    stocks: 0.40,
    bonds: 0.50,
    cash: 0.10,
    alternatives: 0
  },
  
  // Expenses & Income
  annualRetirementExpenses: 45000,
  socialSecurityBenefit: 2200,
  socialSecurityClaimAge: 70,
  partTimeIncomeRetirement: 1500, // Part-time work in retirement
  
  // Market Assumptions
  expectedReturn: 0.055,
  returnVolatility: 0.12,
  inflationRate: 0.025,
  
  // Tax & Location
  taxRate: 0.22,
  retirementState: 'FL', // No state tax
  
  // Profile Data with Assets
  profileData: {
    maritalStatus: 'single',
    state: 'NY',
    retirementState: 'FL',
    primaryResidence: {
      value: 350000,
      monthlyPayment: 1800,
      yearsToPayOffMortgage: 15,
      mortgageBalance: 180000
    },
    assets: [
      { type: '401k', value: 180000, owner: 'user' },
      { type: 'ira', value: 50000, owner: 'user' },
      { type: 'savings', value: 20000, owner: 'user' }
    ]
  },
  
  // Options
  legacyGoal: 0,
  ltcModeling: {
    enabled: true,
    hasInsurance: false,
    insuranceBenefit: 0,
    costInflationRate: 0.045,
    averageAnnualCost: 70000,
    lifetimeProbability: 0.40,
    onsetAgeRange: [75, 85] as [number, number],
    averageDuration: 2.5,
    gender: 'M' as const
  }
};

// Test Profile 4: Young Professional Couple
const profile4_YoungProfessional: RetirementMonteCarloParams = {
  // Personal Information
  currentAge: 32,
  spouseAge: 30,
  retirementAge: 65,
  spouseRetirementAge: 65,
  lifeExpectancy: 92,
  spouseLifeExpectancy: 94,
  
  // Assets & Savings
  currentRetirementAssets: 150000,
  annualSavings: 40000,
  userAnnualSavings: 25000,
  spouseAnnualSavings: 15000,
  
  // Asset Allocation
  currentAllocation: {
    stocks: 0.85,
    bonds: 0.10,
    cash: 0.05,
    alternatives: 0
  },
  recommendedAllocation: {
    stocks: 0.80,
    bonds: 0.15,
    cash: 0.05,
    alternatives: 0
  },
  
  // Expenses & Income
  annualRetirementExpenses: 75000,
  socialSecurityBenefit: 2500,
  spouseSocialSecurityBenefit: 2000,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  
  // Market Assumptions
  expectedReturn: 0.07,
  returnVolatility: 0.16,
  inflationRate: 0.025,
  
  // Tax & Location
  taxRate: 0.24,
  retirementState: 'WA', // No state income tax but has capital gains tax
  
  // Profile Data with Assets
  profileData: {
    maritalStatus: 'married',
    state: 'WA',
    retirementState: 'WA',
    primaryResidence: {
      value: 600000,
      monthlyPayment: 3200,
      yearsToPayOffMortgage: 28,
      mortgageBalance: 480000
    },
    assets: [
      { type: '401k', value: 80000, owner: 'user' },
      { type: 'roth-401k', value: 30000, owner: 'user' },
      { type: '401k', value: 30000, owner: 'spouse' },
      { type: 'brokerage', value: 10000, owner: 'joint' }
    ]
  },
  
  // Options
  legacyGoal: 250000,
  ltcModeling: {
    enabled: true,
    hasInsurance: false,
    insuranceBenefit: 0,
    costInflationRate: 0.045,
    averageAnnualCost: 80000,
    lifetimeProbability: 0.25,
    onsetAgeRange: [75, 90] as [number, number],
    averageDuration: 2.0,
    gender: 'M' as const
  }
};

// Test Profile 5: Conservative Retiree
const profile5_ConservativeRetiree: RetirementMonteCarloParams = {
  // Personal Information
  currentAge: 68,
  spouseAge: 70,
  retirementAge: 65,
  spouseRetirementAge: 65,
  lifeExpectancy: 88,
  spouseLifeExpectancy: 86,
  
  // Assets & Savings
  currentRetirementAssets: 1200000,
  annualSavings: 0, // Already retired
  userAnnualSavings: 0,
  spouseAnnualSavings: 0,
  
  // Asset Allocation
  currentAllocation: {
    stocks: 0.30,
    bonds: 0.60,
    cash: 0.10,
    alternatives: 0
  },
  recommendedAllocation: {
    stocks: 0.35,
    bonds: 0.55,
    cash: 0.10,
    alternatives: 0
  },
  
  // Expenses & Income
  annualRetirementExpenses: 65000,
  socialSecurityBenefit: 2800,
  spouseSocialSecurityBenefit: 1400, // Spousal benefit
  socialSecurityClaimAge: 65,
  spouseSocialSecurityClaimAge: 65,
  pensionBenefit: 1500,
  
  // Market Assumptions
  expectedReturn: 0.045,
  returnVolatility: 0.10,
  inflationRate: 0.025,
  
  // Tax & Location
  taxRate: 0.22,
  retirementState: 'AZ', // Moderate tax, retirement friendly
  
  // Profile Data with Assets
  profileData: {
    maritalStatus: 'married',
    state: 'AZ',
    retirementState: 'AZ',
    primaryResidence: {
      value: 400000,
      monthlyPayment: 0, // Paid off
      yearsToPayOffMortgage: 0,
      mortgageBalance: 0
    },
    assets: [
      { type: 'ira', value: 600000, owner: 'user' },
      { type: 'ira', value: 300000, owner: 'spouse' },
      { type: 'savings', value: 100000, owner: 'joint' },
      { type: 'cd', value: 100000, owner: 'joint' },
      { type: 'brokerage', value: 100000, owner: 'joint' }
    ]
  },
  
  // Options
  legacyGoal: 200000,
  ltcModeling: {
    enabled: true,
    hasInsurance: true,
    insuranceBenefit: 4000,
    costInflationRate: 0.045,
    averageAnnualCost: 85000,
    lifetimeProbability: 0.50, // Higher probability due to age
    onsetAgeRange: [75, 85] as [number, number],
    averageDuration: 3.5,
    gender: 'M' as const
  }
};

// Test runner function
async function runComprehensiveTests() {
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}     MONTE CARLO RETIREMENT ALGORITHM - COMPREHENSIVE TEST SUITE      ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  const testProfiles = [
    { name: 'Early Retiree Couple (FIRE)', profile: profile1_EarlyRetiree },
    { name: 'High Earner Near Retirement', profile: profile2_HighEarner },
    { name: 'Single Late Starter', profile: profile3_LateStarter },
    { name: 'Young Professional Couple', profile: profile4_YoungProfessional },
    { name: 'Conservative Retiree', profile: profile5_ConservativeRetiree }
  ];

  const results: any[] = [];

  for (let i = 0; i < testProfiles.length; i++) {
    const { name, profile } = testProfiles[i];
    
    console.log(`${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}${colors.yellow}TEST PROFILE ${i + 1}: ${name}${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    
    // Profile Summary
    console.log(`${colors.cyan}Profile Summary:${colors.reset}`);
    console.log(`  • Current Age: ${profile.currentAge}${profile.spouseAge ? ` / Spouse: ${profile.spouseAge}` : ' (Single)'}`);
    console.log(`  • Retirement Age: ${profile.retirementAge}${profile.spouseRetirementAge ? ` / Spouse: ${profile.spouseRetirementAge}` : ''}`);
    console.log(`  • Current Assets: ${formatCurrency(profile.currentRetirementAssets)}`);
    console.log(`  • Annual Savings: ${formatCurrency(profile.annualSavings)}`);
    console.log(`  • Retirement Expenses: ${formatCurrency(profile.annualRetirementExpenses)}`);
    console.log(`  • Retirement State: ${profile.retirementState}`);
    console.log(`  • Asset Allocation: ${(profile.currentAllocation.stocks * 100).toFixed(0)}% Stocks / ${(profile.currentAllocation.bonds * 100).toFixed(0)}% Bonds`);
    
    // Run simulation
    console.log(`\n${colors.magenta}Running 1000 Monte Carlo simulations...${colors.reset}`);
    const startTime = Date.now();
    
    const result = runRightCapitalStyleMonteCarloSimulation(profile, 1000, false);
    
    const endTime = Date.now();
    const executionTime = ((endTime - startTime) / 1000).toFixed(2);
    
    // Extract key metrics
    const finalValues = result.results.map(r => r.finalPortfolioValue);
    const successRate = result.successProbability * 100;
    const medianFinalValue = calculatePercentile(finalValues, 50);
    const p10Value = calculatePercentile(finalValues, 10);
    const p25Value = calculatePercentile(finalValues, 25);
    const p75Value = calculatePercentile(finalValues, 75);
    const p90Value = calculatePercentile(finalValues, 90);
    
    // Calculate retirement asset projections by age
    const ageProjections: { [age: number]: number[] } = {};
    const startAge = profile.currentAge;
    const endAge = profile.lifeExpectancy;
    
    // Initialize age buckets
    for (let age = startAge; age <= endAge; age += 5) {
      ageProjections[age] = [];
    }
    
    // Collect portfolio values at each age
    result.results.forEach(iteration => {
      iteration.yearlyData?.forEach(yearData => {
        const age = Math.floor(yearData.age);
        if (age % 5 === 0 || age === startAge || age === endAge) {
          if (!ageProjections[age]) ageProjections[age] = [];
          ageProjections[age].push(yearData.portfolioValue);
        }
      });
    });
    
    // Display Results
    console.log(`\n${colors.green}═══ SIMULATION RESULTS ═══${colors.reset}`);
    console.log(`Execution Time: ${executionTime}s\n`);
    
    // Success Rate with color coding
    const successColor = successRate >= 80 ? colors.green : successRate >= 60 ? colors.yellow : colors.red;
    console.log(`${colors.bright}Success Probability: ${successColor}${successRate.toFixed(1)}%${colors.reset}`);
    
    // Portfolio Value Distribution
    console.log(`\n${colors.cyan}Final Portfolio Value Distribution:${colors.reset}`);
    console.log(`  • 10th Percentile:  ${formatCurrency(p10Value)}`);
    console.log(`  • 25th Percentile:  ${formatCurrency(p25Value)}`);
    console.log(`  • Median (50th):    ${formatCurrency(medianFinalValue)}`);
    console.log(`  • 75th Percentile:  ${formatCurrency(p75Value)}`);
    console.log(`  • 90th Percentile:  ${formatCurrency(p90Value)}`);
    
    // Age-based Projections
    console.log(`\n${colors.cyan}Portfolio Projections by Age (Median Values):${colors.reset}`);
    const sortedAges = Object.keys(ageProjections).map(Number).sort((a, b) => a - b);
    
    for (const age of sortedAges) {
      if (ageProjections[age].length > 0) {
        const median = calculatePercentile(ageProjections[age], 50);
        const p25 = calculatePercentile(ageProjections[age], 25);
        const p75 = calculatePercentile(ageProjections[age], 75);
        
        const ageLabel = age === profile.retirementAge ? ' (Retirement)' : '';
        console.log(`  Age ${age}${ageLabel}: ${formatCurrency(median)} [${formatCurrency(p25)} - ${formatCurrency(p75)}]`);
      }
    }
    
    // Key Risk Factors
    console.log(`\n${colors.cyan}Risk Analysis:${colors.reset}`);
    const failedIterations = result.results.filter(r => !r.success);
    const avgShortfall = failedIterations.length > 0 
      ? failedIterations.reduce((sum, r) => sum + (r.totalShortfall || 0), 0) / failedIterations.length 
      : 0;
    
    console.log(`  • Failure Rate: ${((1 - result.successProbability) * 100).toFixed(1)}%`);
    console.log(`  • Average Shortfall (if failed): ${formatCurrency(avgShortfall)}`);
    console.log(`  • Max Annual Shortfall: ${formatCurrency(result.summary.maxDeficit)}`);
    
    // LTC Impact
    const ltcIterations = result.results.filter(r => r.ltcData?.hasLTCEpisode);
    const ltcSuccessRate = ltcIterations.filter(r => r.success).length / Math.max(1, ltcIterations.length) * 100;
    console.log(`  • LTC Episodes: ${ltcIterations.length}/${result.results.length} (${(ltcIterations.length / result.results.length * 100).toFixed(1)}%)`);
    console.log(`  • Success Rate with LTC: ${ltcSuccessRate.toFixed(1)}%`);
    
    // Store results for summary
    results.push({
      name,
      successRate,
      medianFinalValue,
      p10Value,
      p90Value,
      executionTime
    });
    
    console.log(`\n`);
  }
  
  // Summary Report
  console.log(`${colors.bright}${colors.green}═══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.green}                          SUMMARY REPORT                           ${colors.reset}`);
  console.log(`${colors.bright}${colors.green}═══════════════════════════════════════════════════════════════════${colors.reset}\n`);
  
  console.log(`${colors.cyan}Success Rate Comparison:${colors.reset}`);
  results.forEach((r, i) => {
    const color = r.successRate >= 80 ? colors.green : r.successRate >= 60 ? colors.yellow : colors.red;
    console.log(`  ${i + 1}. ${r.name}: ${color}${r.successRate.toFixed(1)}%${colors.reset}`);
  });
  
  console.log(`\n${colors.cyan}Median Final Portfolio Values:${colors.reset}`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}: ${formatCurrency(r.medianFinalValue)}`);
  });
  
  console.log(`\n${colors.cyan}Range of Outcomes (10th - 90th Percentile):${colors.reset}`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}: ${formatCurrency(r.p10Value)} - ${formatCurrency(r.p90Value)}`);
  });
  
  // Validation Checks
  console.log(`\n${colors.bright}${colors.yellow}═══ VALIDATION CHECKS ═══${colors.reset}`);
  
  let allTestsPassed = true;
  
  // Check 1: Success rates should be reasonable (0-100%)
  const successRatesValid = results.every(r => r.successRate >= 0 && r.successRate <= 100);
  console.log(`  ✓ Success rates within valid range (0-100%): ${successRatesValid ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`}`);
  if (!successRatesValid) allTestsPassed = false;
  
  // Check 2: Median values should be positive or zero
  const medianValuesValid = results.every(r => r.medianFinalValue >= 0);
  console.log(`  ✓ Median final values non-negative: ${medianValuesValid ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`}`);
  if (!medianValuesValid) allTestsPassed = false;
  
  // Check 3: P10 should be less than P90
  const percentilesValid = results.every(r => r.p10Value <= r.p90Value);
  console.log(`  ✓ Percentile ordering correct (P10 < P90): ${percentilesValid ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`}`);
  if (!percentilesValid) allTestsPassed = false;
  
  // Check 4: Execution time should be reasonable
  const executionTimesValid = results.every(r => parseFloat(r.executionTime) < 30);
  console.log(`  ✓ Execution times under 30 seconds: ${executionTimesValid ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`}`);
  if (!executionTimesValid) allTestsPassed = false;
  
  // Check 5: Expected outcomes match profile characteristics
  const profile1Success = results[0].successRate > 70; // Early retiree should have good success
  const profile3Success = results[2].successRate < 60; // Late starter should struggle
  const profile5Success = results[4].successRate > 80; // Conservative retiree should be stable
  const logicalOutcomes = profile1Success && profile3Success && profile5Success;
  console.log(`  ✓ Logical outcomes based on profiles: ${logicalOutcomes ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`}`);
  if (!logicalOutcomes) allTestsPassed = false;
  
  console.log(`\n${colors.bright}${allTestsPassed ? colors.green : colors.red}═══ OVERALL TEST RESULT: ${allTestsPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'} ═══${colors.reset}\n`);
  
  return allTestsPassed;
}

// Run the tests
console.log(`${colors.cyan}Starting Monte Carlo Algorithm Test Suite...${colors.reset}`);
runComprehensiveTests()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error(`${colors.red}Test suite failed with error:${colors.reset}`, error);
    process.exit(1);
  });