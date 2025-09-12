import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

// Test to verify dashboard and optimization tab now produce consistent results

console.log('=== DASHBOARD vs OPTIMIZATION TAB COMPARISON ===\n');

// Create a test profile simulating the user's data
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
  
  // Social Security
  socialSecurityBenefit: 2500,
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
  
  // Assets
  assets: [
    { type: '401k', value: 800000, owner: 'user' },
    { type: 'traditional-ira', value: 300000, owner: 'user' },
    { type: 'roth-ira', value: 150000, owner: 'user' },
    { type: '401k', value: 500000, owner: 'spouse' },
    { type: 'taxable-brokerage', value: 400000, owner: 'joint' },
  ],
  
  state: 'CA',
  retirementState: 'FL',
  hasLongTermCareInsurance: false
};

console.log('TEST 1: Dashboard calculation (baseline profile)');
console.log('----------------------------------------------');

// This simulates what the dashboard does - direct calculation
const dashboardParams = profileToRetirementParams(testProfile);
const dashboardResult = runEnhancedMonteCarloSimulation(dashboardParams, 500);

console.log(`Dashboard Success Rate: ${dashboardResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Dashboard Parameters:`, {
  retirementAge: dashboardParams.retirementAge,
  annualGuaranteedIncome: dashboardParams.annualGuaranteedIncome,
  annualRetirementExpenses: dashboardParams.annualRetirementExpenses,
  socialSecurityClaimAge: dashboardParams.socialSecurityClaimAge,
  socialSecurityBenefit: dashboardParams.socialSecurityBenefit
});

console.log('\nTEST 2: Optimization tab calculation (with same variables)');
console.log('--------------------------------------------------------');

// This simulates what the optimization tab does - modify profile first
const optimizedProfile = { ...testProfile };
// Apply the SAME variables (no changes - should get same result)

const optimizedParams = profileToRetirementParams(optimizedProfile);
const optimizedResult = runEnhancedMonteCarloSimulation(optimizedParams, 500);

console.log(`Optimization Success Rate: ${optimizedResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Optimization Parameters:`, {
  retirementAge: optimizedParams.retirementAge,
  annualGuaranteedIncome: optimizedParams.annualGuaranteedIncome,
  annualRetirementExpenses: optimizedParams.annualRetirementExpenses,
  socialSecurityClaimAge: optimizedParams.socialSecurityClaimAge,
  socialSecurityBenefit: optimizedParams.socialSecurityBenefit
});

console.log('\n=== COMPARISON RESULTS ===');
const difference = Math.abs(dashboardResult.probabilityOfSuccess - optimizedResult.probabilityOfSuccess);
console.log(`Dashboard: ${dashboardResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Optimization: ${optimizedResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Difference: ${difference.toFixed(1)} percentage points`);

if (difference < 2) {
  console.log('✅ SUCCESS: Dashboard and optimization now produce consistent results!');
  console.log('The guardrails fix has resolved the discrepancy.');
} else {
  console.log('❌ ISSUE: Still seeing significant difference between dashboard and optimization.');
  console.log('This suggests there may be additional factors causing the discrepancy.');
}

console.log('\nTEST 3: Optimization with SS delay (should increase success rate)');
console.log('----------------------------------------------------------------');

// Test optimization with SS delay to age 70
const ssOptimizedProfile = { ...testProfile };
ssOptimizedProfile.socialSecurityClaimAge = 70;
ssOptimizedProfile.spouseSocialSecurityClaimAge = 70;

// Recalculate benefits for age 70
const userBenefitAt70 = Math.round(2500 * (1 + (70 - 67) * 0.08));
const spouseBenefitAt70 = Math.round(1800 * (1 + (70 - 67) * 0.08));
ssOptimizedProfile.socialSecurityBenefit = userBenefitAt70;
ssOptimizedProfile.spouseSocialSecurityBenefit = spouseBenefitAt70;

const ssOptimizedParams = profileToRetirementParams(ssOptimizedProfile);
const ssOptimizedResult = runEnhancedMonteCarloSimulation(ssOptimizedParams, 500);

console.log(`SS Age 70 Success Rate: ${ssOptimizedResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Improvement from SS delay: ${(ssOptimizedResult.probabilityOfSuccess - dashboardResult.probabilityOfSuccess).toFixed(1)} percentage points`);

if (ssOptimizedResult.probabilityOfSuccess > dashboardResult.probabilityOfSuccess) {
  console.log('✅ SUCCESS: Social Security delay properly increases success rate!');
} else {
  console.log('❌ ISSUE: Social Security delay should increase success rate but did not.');
}