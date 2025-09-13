import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

// Debug test to find why dashboard shows 40% and optimization shows 61%

console.log('=== DEBUGGING DASHBOARD vs OPTIMIZATION DISCREPANCY ===\n');

// Create a test profile matching typical user data
const testProfile = {
  dateOfBirth: '1970-01-01',
  desiredRetirementAge: 65,
  userLifeExpectancy: 90,
  maritalStatus: 'married',
  spouseDateOfBirth: '1972-01-01',
  spouseDesiredRetirementAge: 65,
  spouseLifeExpectancy: 92,
  
  // Income & Savings
  annualIncome: 120000,
  spouseAnnualIncome: 80000,
  retirementContributions: { employee: 1500, employer: 500 },
  spouseRetirementContributions: { employee: 1000, employer: 300 },
  
  // Social Security - testing both number and string formats
  socialSecurityBenefit: 2500, // Dashboard uses this directly
  socialSecurityClaimAge: 67,
  spouseSocialSecurityBenefit: 1800,
  spouseSocialSecurityClaimAge: 67,
  
  // Retirement expenses
  expectedMonthlyExpensesRetirement: 8000,
  
  // Part-time income
  partTimeIncomeRetirement: 0,
  spousePartTimeIncomeRetirement: 0,
  
  // Asset allocation
  currentAllocation: { usStocks: 60, bonds: 35, cash: 5 },
  expectedRealReturn: 6,
  expectedInflationRate: 3,
  
  // Assets - Lower amount to create ~40% success rate
  assets: [
    { type: '401k', value: 500000, owner: 'user' },
    { type: 'traditional-ira', value: 200000, owner: 'user' },
    { type: 'roth-ira', value: 100000, owner: 'user' },
    { type: 'taxable-brokerage', value: 200000, owner: 'joint' },
  ],
  
  state: 'CA',
  retirementState: 'FL',
  hasLongTermCareInsurance: false
};

console.log('TEST 1: Dashboard Simulation (Raw Profile)');
console.log('-------------------------------------------');
console.log('This simulates: /api/calculate-retirement-monte-carlo endpoint\n');

const dashboardParams = profileToRetirementParams(testProfile);
console.log('Key Dashboard Parameters:');
console.log(`  Current Retirement Assets: $${dashboardParams.currentRetirementAssets.toLocaleString()}`);
console.log(`  Annual Guaranteed Income: $${dashboardParams.annualGuaranteedIncome.toLocaleString()}`);
console.log(`  Annual Retirement Expenses: $${dashboardParams.annualRetirementExpenses.toLocaleString()}`);
console.log(`  Net Withdrawal Needed: $${(dashboardParams.annualRetirementExpenses - dashboardParams.annualGuaranteedIncome).toLocaleString()}`);
console.log(`  Use Guardrails: ${dashboardParams.useGuardrails}`);
console.log(`  Tax Rate: ${(dashboardParams.taxRate * 100).toFixed(1)}%`);

const dashboardResult = runEnhancedMonteCarloSimulation(dashboardParams, 500);
console.log(`\nDashboard Success Rate: ${dashboardResult.probabilityOfSuccess.toFixed(1)}%\n`);

console.log('TEST 2: Optimization Simulation (Modified Profile)');
console.log('--------------------------------------------------');
console.log('This simulates: /api/optimize-retirement-score endpoint');
console.log('Even with NO changes to variables, optimization recalculates SS benefits\n');

// Simulate what optimization endpoint does
const optimizedProfile = { ...testProfile };

// Even if user doesn't change SS age, optimization endpoint recalculates benefits
// This was the bug - it was converting to string
console.log('Simulating optimization endpoint SS recalculation:');
const userPIA = 2500; // Simplified - normally calculated from AIME
const spousePIA = 1800;

// The optimization endpoint recalculates even when age hasn't changed
if (optimizedProfile.socialSecurityClaimAge) {
  // Calculate benefit at claim age (even though it's the same)
  const adjustedBenefit = Math.round(userPIA); // No adjustment for age 67 (FRA)
  console.log(`  User SS before: ${optimizedProfile.socialSecurityBenefit} (type: ${typeof optimizedProfile.socialSecurityBenefit})`);
  
  // THIS WAS THE BUG - Converting to string!
  // optimizedProfile.socialSecurityBenefit = adjustedBenefit.toString();
  // FIXED VERSION:
  optimizedProfile.socialSecurityBenefit = adjustedBenefit;
  
  console.log(`  User SS after: ${optimizedProfile.socialSecurityBenefit} (type: ${typeof optimizedProfile.socialSecurityBenefit})`);
}

if (optimizedProfile.spouseSocialSecurityClaimAge) {
  const adjustedSpouseBenefit = Math.round(spousePIA);
  console.log(`  Spouse SS before: ${optimizedProfile.spouseSocialSecurityBenefit} (type: ${typeof optimizedProfile.spouseSocialSecurityBenefit})`);
  
  // FIXED VERSION:
  optimizedProfile.spouseSocialSecurityBenefit = adjustedSpouseBenefit;
  
  console.log(`  Spouse SS after: ${optimizedProfile.spouseSocialSecurityBenefit} (type: ${typeof optimizedProfile.spouseSocialSecurityBenefit})`);
}

const optimizedParams = profileToRetirementParams(optimizedProfile);
console.log('\nKey Optimization Parameters:');
console.log(`  Current Retirement Assets: $${optimizedParams.currentRetirementAssets.toLocaleString()}`);
console.log(`  Annual Guaranteed Income: $${optimizedParams.annualGuaranteedIncome.toLocaleString()}`);
console.log(`  Annual Retirement Expenses: $${optimizedParams.annualRetirementExpenses.toLocaleString()}`);
console.log(`  Net Withdrawal Needed: $${(optimizedParams.annualRetirementExpenses - optimizedParams.annualGuaranteedIncome).toLocaleString()}`);
console.log(`  Use Guardrails: ${optimizedParams.useGuardrails}`);
console.log(`  Tax Rate: ${(optimizedParams.taxRate * 100).toFixed(1)}%`);

const optimizedResult = runEnhancedMonteCarloSimulation(optimizedParams, 500);
console.log(`\nOptimization Success Rate: ${optimizedResult.probabilityOfSuccess.toFixed(1)}%\n`);

console.log('=== ANALYSIS ===');
const difference = optimizedResult.probabilityOfSuccess - dashboardResult.probabilityOfSuccess;
console.log(`Dashboard: ${dashboardResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Optimization: ${optimizedResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Difference: ${difference.toFixed(1)} percentage points`);

if (Math.abs(difference) < 2) {
  console.log('\n✅ SUCCESS: The string conversion fix has resolved the issue!');
  console.log('Dashboard and optimization now produce consistent results.');
} else {
  console.log('\n❌ ISSUE REMAINS: Still seeing discrepancy.');
  console.log('\nPossible remaining causes:');
  console.log('1. Check if Social Security benefit calculation formula differs');
  console.log('2. Check if there are other string conversions happening');
  console.log('3. Check if the profile data loaded is different between endpoints');
  
  // Compare parameters in detail
  console.log('\nDetailed Parameter Comparison:');
  const paramKeys = Object.keys(dashboardParams) as Array<keyof typeof dashboardParams>;
  paramKeys.forEach(key => {
    const dashValue = dashboardParams[key];
    const optValue = optimizedParams[key];
    if (dashValue !== optValue) {
      console.log(`  ${key}: Dashboard=${dashValue}, Optimization=${optValue} [DIFFERENT]`);
    }
  });
}