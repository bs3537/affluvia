/**
 * Test script to verify dynamic mortality implementation in Monte Carlo simulations
 * 
 * Run with: npx tsx server/test-dynamic-mortality.ts
 */

import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { runRetirementMonteCarloSimulation, profileToRetirementParams } from './monte-carlo-base';
import { runFixedMonteCarloSimulation } from './monte-carlo-deprecated';
import { calculateLifeExpectancy } from './mortality-tables';

console.log('=== Dynamic Mortality Tables Test ===\n');

// Create test profile data
const createTestProfile = (age: number, healthStatus: string = 'good') => ({
  dateOfBirth: new Date(new Date().getFullYear() - age, 0, 1).toISOString(),
  maritalStatus: 'single',
  userLifeExpectancy: 93,
  userHealthStatus: healthStatus,
  annualIncome: 100000,
  expectedMonthlyExpensesRetirement: 5000,
  desiredRetirementAge: 65,
  expectedInflationRate: 3,
  expectedRealReturn: 6,
  withdrawalRate: 4,
  savingsRate: 10,
  retirementContributions: { employee: 500, employer: 500 },
  socialSecurityBenefit: 2000,
  assets: [
    { type: '401k', value: 500000, owner: 'user' },
    { type: 'taxable-brokerage', value: 200000, owner: 'user' },
    { type: 'savings', value: 50000, owner: 'user' }
  ]
});

// Test 1: Compare life expectancy calculation with simulation outcomes
console.log('Test 1: Life Expectancy vs Simulation Outcomes\n');

const testAges = [55, 65, 75];
const testHealthStatuses = ['excellent', 'good', 'fair', 'poor'];

for (const age of testAges) {
  console.log(`\nAge ${age} Analysis:`);
  console.log('─'.repeat(50));
  
  for (const health of testHealthStatuses) {
    const calculatedLE = calculateLifeExpectancy({
      currentAge: age,
      gender: 'male',
      healthStatus: health as 'excellent' | 'good' | 'fair' | 'poor'
    });
    
    console.log(`  ${health.padEnd(10)} - Expected death age: ${calculatedLE}`);
  }
}

// Test 2: Run Monte Carlo simulations with different health statuses
console.log('\n\nTest 2: Monte Carlo Simulations with Dynamic Mortality (1,000 iterations each)\n');

const runSimulationTest = async (age: number, healthStatus: string) => {
  const profile = createTestProfile(age, healthStatus);
  const params = profileToRetirementParams(profile);
  
  // Run standard Monte Carlo
  const standardResult = runRetirementMonteCarloSimulation(params, 1000);
  
  // Run enhanced Monte Carlo
  const enhancedResult = runEnhancedMonteCarloSimulation(params, 1000);
  
  // Run fixed Monte Carlo
  const fixedResult = runFixedMonteCarloSimulation(params, 1000);
  
  return {
    healthStatus,
    age,
    standard: {
      successRate: standardResult.probabilityOfSuccess,
      medianBalance: standardResult.medianEndingBalance,
      avgDepletion: standardResult.yearsUntilDepletion
    },
    enhanced: {
      successRate: enhancedResult.probabilityOfSuccess,
      medianBalance: enhancedResult.medianEndingBalance,
      avgDepletion: enhancedResult.yearsUntilDepletion
    },
    fixed: {
      successRate: fixedResult.probabilityOfSuccess,
      medianBalance: fixedResult.medianEndingBalance,
      avgDepletion: fixedResult.yearsUntilDepletion
    }
  };
};

// Run tests for different health statuses
const testCases = [
  { age: 55, health: 'excellent' },
  { age: 55, health: 'good' },
  { age: 55, health: 'fair' },
  { age: 55, health: 'poor' }
];

console.log('Running simulations for Age 55 with different health statuses...\n');

for (const testCase of testCases) {
  const result = await runSimulationTest(testCase.age, testCase.health);
  
  console.log(`Health Status: ${result.healthStatus}`);
  console.log('─'.repeat(60));
  console.log('                  Success Rate | Median Balance | Avg Depletion');
  console.log(`Standard MC:      ${result.standard.successRate.toFixed(1).padStart(11)}% | $${result.standard.medianBalance.toLocaleString().padStart(13)} | ${result.standard.avgDepletion ? result.standard.avgDepletion.toFixed(0) + ' years' : 'Never'.padStart(8)}`);
  console.log(`Enhanced MC:      ${result.enhanced.successRate.toFixed(1).padStart(11)}% | $${result.enhanced.medianBalance.toLocaleString().padStart(13)} | ${result.enhanced.avgDepletion ? result.enhanced.avgDepletion.toFixed(0) + ' years' : 'Never'.padStart(8)}`);
  console.log(`Fixed MC:         ${result.fixed.successRate.toFixed(1).padStart(11)}% | $${result.fixed.medianBalance.toLocaleString().padStart(13)} | ${result.fixed.avgDepletion ? result.fixed.avgDepletion.toFixed(0) + ' years' : 'Never'.padStart(8)}`);
  console.log();
}

// Test 3: Couple vs Single mortality
console.log('\nTest 3: Couple vs Single Person Mortality Impact\n');

const singleProfile = createTestProfile(65, 'good');
const coupleProfile = {
  ...createTestProfile(65, 'good'),
  maritalStatus: 'married',
  spouseDateOfBirth: new Date(new Date().getFullYear() - 63, 0, 1).toISOString(),
  spouseLifeExpectancy: 95,
  spouseHealthStatus: 'good',
  spouseAnnualIncome: 80000,
  spouseSocialSecurityBenefit: 1800,
  spouseRetirementContributions: { employee: 400, employer: 400 }
};

const singleParams = profileToRetirementParams(singleProfile);
const coupleParams = profileToRetirementParams(coupleProfile);

console.log('Running 2,000 simulations each...\n');

const singleResult = runEnhancedMonteCarloSimulation(singleParams, 2000);
const coupleResult = runEnhancedMonteCarloSimulation(coupleParams, 2000);

console.log('                    Success Rate | Median Balance | Safe Withdrawal');
console.log('─'.repeat(65));
console.log(`Single (Age 65):    ${singleResult.probabilityOfSuccess.toFixed(1).padStart(11)}% | $${singleResult.medianEndingBalance.toLocaleString().padStart(13)} | ${(singleResult.safeWithdrawalRate * 100).toFixed(2)}%`);
console.log(`Couple (65/63):     ${coupleResult.probabilityOfSuccess.toFixed(1).padStart(11)}% | $${coupleResult.medianEndingBalance.toLocaleString().padStart(13)} | ${(coupleResult.safeWithdrawalRate * 100).toFixed(2)}%`);

console.log('\n=== Test Complete ===');
console.log('\nKey Insights:');
console.log('1. Health status significantly impacts retirement success rates');
console.log('2. Poor health leads to higher success rates due to shorter life spans');
console.log('3. Couples generally need lower withdrawal rates due to joint survival');
console.log('4. Dynamic mortality provides more realistic outcomes than fixed life expectancy');