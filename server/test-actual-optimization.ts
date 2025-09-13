// Test using the actual profileToRetirementParams function
// This replicates what happens in the optimization tab

import { profileToRetirementParams, runRetirementMonteCarloSimulation } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

// Create a profile similar to what the optimization endpoint receives
const testProfile = {
  // Personal info
  dateOfBirth: '1974-01-01', // Age 50
  spouseDateOfBirth: '1974-01-01', // Age 50
  maritalStatus: 'married',
  state: 'FL',
  
  // Retirement planning
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  userLifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  socialSecurityClaimAge: 65,
  spouseSocialSecurityClaimAge: 65,
  
  // Income
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  
  // Social Security benefits (calculated for claiming at 65)
  socialSecurityBenefit: 1300,
  spouseSocialSecurityBenefit: 3033,
  
  // Retirement accounts and assets
  assets: [
    { type: '401k', value: 400000, owner: 'user' },
    { type: 'taxable-brokerage', value: 90000, owner: 'user' },
    { type: 'savings', value: 32000, owner: 'user' },
    { type: 'checking', value: 50000, owner: 'user' }
  ],
  
  // Contributions
  retirementContributions: {
    employee: 30000, // $2,500/month from spouse
    employer: 0
  },
  
  // Investment strategy
  currentAllocation: {
    usStocks: 45,
    intlStocks: 20,
    bonds: 30,
    cash: 5
  },
  
  // Calculate stock, bond, cash allocations
  stockAllocation: 65, // 45% US + 20% Intl
  bondAllocation: 30,
  cashAllocation: 5,
  
  // Expected returns
  expectedRealReturn: 7, // 7% real return
  expectedInflationRate: 3,
  
  // This flag determines if healthcare is included
  retirementExpensesIncludeHealthcare: false, // KEY: Set to false means healthcare will be ADDED
  
  // Part time income
  partTimeIncomeRetirement: 0,
  spousePartTimeIncomeRetirement: 0,
  
  // Other settings
  hasLongTermCareInsurance: false,
  legacyGoal: 0,
  
  // Monthly expenses - THIS IS THE KEY VARIABLE WE'LL TEST
  expectedMonthlyExpensesRetirement: 6900,
  
  // Additional fields for monthly cash flow
  takeHomeIncome: 3500,
  spouseTakeHomeIncome: 26250,
  monthlyExpenses: {
    housing: 3000,
    transportation: 800,
    food: 1200,
    healthcare: 500,
    insurance: 600,
    utilities: 400,
    entertainment: 500,
    other: 1000,
    debtPayments: 0,
    savings: 8500
  }
};

console.log('=== TESTING ACTUAL OPTIMIZATION TAB BEHAVIOR ===\n');
console.log('This test replicates the exact flow of the optimization tab\n');

// Test different expense levels
const expenseLevels = [6500, 6600, 6700, 6800, 6850, 6900, 6950, 7000, 7100];
const results: any[] = [];

console.log('Testing retirement success probability at different expense levels...\n');
console.log('Monthly | Annual  | Healthcare | Total Annual | Success Rate | Success Rate');
console.log('Expense | Expense | Added      | w/ Healthcare| (Standard)   | (Enhanced)');
console.log('--------|---------|------------|--------------|--------------|-------------');

for (const monthlyExpense of expenseLevels) {
  // Create modified profile with new expense level
  const modifiedProfile = {
    ...testProfile,
    expectedMonthlyExpensesRetirement: monthlyExpense
  };
  
  // Convert to Monte Carlo parameters (this is what the optimization endpoint does)
  const params = profileToRetirementParams(modifiedProfile);
  
  // Run both simulations
  const standardResult = runRetirementMonteCarloSimulation(params, 500);
  const enhancedResult = runEnhancedMonteCarloSimulation(params, 500);
  
  results.push({
    monthly: monthlyExpense,
    annual: monthlyExpense * 12,
    totalAnnual: params.annualRetirementExpenses,
    standardSuccess: standardResult.probabilityOfSuccess,
    enhancedSuccess: enhancedResult.probabilityOfSuccess
  });
  
  const healthcareAdded = params.annualRetirementExpenses - (monthlyExpense * 12);
  
  console.log(
    `$${monthlyExpense.toString().padEnd(6)} | ` +
    `$${(monthlyExpense * 12).toLocaleString().padEnd(7)} | ` +
    `$${healthcareAdded.toLocaleString().padEnd(10)} | ` +
    `$${params.annualRetirementExpenses.toLocaleString().padEnd(12)} | ` +
    `${standardResult.probabilityOfSuccess.toFixed(1).padStart(11)}% | ` +
    `${enhancedResult.probabilityOfSuccess.toFixed(1).padStart(11)}%`
  );
}

// Analyze for cliff effects
console.log('\n=== CLIFF ANALYSIS ===\n');

for (let i = 1; i < results.length; i++) {
  const prev = results[i - 1];
  const curr = results[i];
  const standardDiff = curr.standardSuccess - prev.standardSuccess;
  const enhancedDiff = curr.enhancedSuccess - prev.enhancedSuccess;
  
  if (Math.abs(standardDiff) > 20 || Math.abs(enhancedDiff) > 20) {
    console.log(`🚨 CLIFF DETECTED!`);
    console.log(`   From $${prev.monthly}/month to $${curr.monthly}/month`);
    console.log(`   Standard MC: ${standardDiff > 0 ? '+' : ''}${standardDiff.toFixed(1)}%`);
    console.log(`   Enhanced MC: ${enhancedDiff > 0 ? '+' : ''}${enhancedDiff.toFixed(1)}%`);
    console.log(`   For only $${curr.monthly - prev.monthly}/month difference!\n`);
  }
}

// Test specific case: $6900 vs $6700
console.log('=== FOCUSED TEST: $6900 vs $6700 ===\n');

// $6900 case
testProfile.expectedMonthlyExpensesRetirement = 6900;
const params6900 = profileToRetirementParams(testProfile);
console.log('$6,900/month:');
console.log(`  User enters: $${6900 * 12}/year`);
console.log(`  Healthcare added: $${params6900.annualHealthcareCosts}/year`);
console.log(`  Total expenses in simulation: $${params6900.annualRetirementExpenses}/year`);

const result6900Standard = runRetirementMonteCarloSimulation(params6900, 1000);
const result6900Enhanced = runEnhancedMonteCarloSimulation(params6900, 1000);
console.log(`  Standard MC Success Rate: ${result6900Standard.probabilityOfSuccess.toFixed(1)}%`);
console.log(`  Enhanced MC Success Rate: ${result6900Enhanced.probabilityOfSuccess.toFixed(1)}%`);

// $6700 case
testProfile.expectedMonthlyExpensesRetirement = 6700;
const params6700 = profileToRetirementParams(testProfile);
console.log('\n$6,700/month:');
console.log(`  User enters: $${6700 * 12}/year`);
console.log(`  Healthcare added: $${params6700.annualHealthcareCosts}/year`);
console.log(`  Total expenses in simulation: $${params6700.annualRetirementExpenses}/year`);

const result6700Standard = runRetirementMonteCarloSimulation(params6700, 1000);
const result6700Enhanced = runEnhancedMonteCarloSimulation(params6700, 1000);
console.log(`  Standard MC Success Rate: ${result6700Standard.probabilityOfSuccess.toFixed(1)}%`);
console.log(`  Enhanced MC Success Rate: ${result6700Enhanced.probabilityOfSuccess.toFixed(1)}%`);

console.log('\n=== SUMMARY ===\n');
const standardChange = result6700Standard.probabilityOfSuccess - result6900Standard.probabilityOfSuccess;
const enhancedChange = result6700Enhanced.probabilityOfSuccess - result6900Enhanced.probabilityOfSuccess;

console.log(`Standard Monte Carlo change: ${standardChange > 0 ? '+' : ''}${standardChange.toFixed(1)}%`);
console.log(`Enhanced Monte Carlo change: ${enhancedChange > 0 ? '+' : ''}${enhancedChange.toFixed(1)}%`);

if (Math.abs(standardChange) > 20 || Math.abs(enhancedChange) > 20) {
  console.log('\n🚨 SIGNIFICANT CLIFF EFFECT DETECTED!');
  console.log('The jump is likely due to one of:');
  console.log('1. Healthcare costs pushing total expenses over a critical threshold');
  console.log('2. Tax bracket changes at different withdrawal rates');
  console.log('3. Portfolio depletion timing crossing a critical year');
  console.log('4. Guardrails algorithm having a discontinuity');
} else {
  console.log('\nNo significant cliff effect detected in this test.');
  console.log('The issue might be specific to the user\'s exact profile data.');
}

// Test with healthcare already included
console.log('\n=== TEST WITH HEALTHCARE ALREADY INCLUDED ===\n');
testProfile.retirementExpensesIncludeHealthcare = true;

testProfile.expectedMonthlyExpensesRetirement = 6900;
const params6900NoAdd = profileToRetirementParams(testProfile);
const result6900NoAdd = runRetirementMonteCarloSimulation(params6900NoAdd, 500);
console.log(`$6,900/month (healthcare included): ${result6900NoAdd.probabilityOfSuccess.toFixed(1)}%`);

testProfile.expectedMonthlyExpensesRetirement = 6700;
const params6700NoAdd = profileToRetirementParams(testProfile);
const result6700NoAdd = runRetirementMonteCarloSimulation(params6700NoAdd, 500);
console.log(`$6,700/month (healthcare included): ${result6700NoAdd.probabilityOfSuccess.toFixed(1)}%`);

const noAddChange = result6700NoAdd.probabilityOfSuccess - result6900NoAdd.probabilityOfSuccess;
console.log(`Change when healthcare already included: ${noAddChange > 0 ? '+' : ''}${noAddChange.toFixed(1)}%`);

console.log('\n=== KEY INSIGHT ===\n');
console.log('The optimization tab adds healthcare costs automatically.');
console.log('This means the displayed expenses don\'t match what\'s being simulated.');
console.log('A $200/month change becomes a much larger change in the simulation.');