import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

// Create test profile simulating the optimization endpoint issue
const baseProfile = {
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
  savingsRate: 15,
  retirementContributions: { employee: 1000, employer: 500 },
  spouseRetirementContributions: { employee: 700, employer: 350 },
  
  // Social Security (NUMBERS as they come from database)
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
  expectedRealReturn: 6, // 6% return for meaningful results
  expectedInflationRate: 3,
  
  // Assets
  assets: [
    { type: '401k', value: 800000, owner: 'user' },
    { type: 'traditional-ira', value: 300000, owner: 'user' },
    { type: 'roth-ira', value: 150000, owner: 'user' },
    { type: '401k', value: 500000, owner: 'spouse' },
    { type: 'taxable-brokerage', value: 400000, owner: 'joint' },
    { type: 'savings', value: 50000, owner: 'joint' },
    { type: 'checking', value: 25000, owner: 'joint' }
  ],
  
  state: 'CA',
  retirementState: 'FL',
  hasLongTermCareInsurance: false
};

console.log('=== TESTING SOCIAL SECURITY OPPOSITE EFFECT ISSUE ===\n');

// Test 1: Baseline with SS benefit as NUMBER (simulating database)
console.log('1. BASELINE WITH SS BENEFIT AS NUMBER');
console.log('------------------------------------');
console.log('SS Benefit type:', typeof baseProfile.socialSecurityBenefit, 'Value:', baseProfile.socialSecurityBenefit);
console.log('Spouse SS Benefit type:', typeof baseProfile.spouseSocialSecurityBenefit, 'Value:', baseProfile.spouseSocialSecurityBenefit);

const baselineParams = profileToRetirementParams(baseProfile);
const baselineResult = runEnhancedMonteCarloSimulation(baselineParams, 500);
console.log('Baseline Success Rate:', baselineResult.probabilityOfSuccess.toFixed(1) + '%');
console.log('Baseline Annual Guaranteed Income:', baselineParams.annualGuaranteedIncome);

// Test 2: Optimization endpoint simulation - SS benefit as STRING
console.log('\n2. OPTIMIZATION ENDPOINT SIMULATION - SS BENEFIT AS STRING');
console.log('----------------------------------------------------------');

// Simulate what the optimization endpoint does:
// 1. Calculate new benefit (returns number)
// 2. Convert to string (LINE 576 in routes.ts)
const optimizedProfile = { ...baseProfile };

// This simulates the optimization endpoint calculation for SS age 70
// calculateBenefitAtAge returns a number, then it's converted to string
const adjustedBenefit = Math.round(2500 * (1 + (70 - 67) * 0.08)); // 8% per year delayed credit
const adjustedSpouseBenefit = Math.round(1800 * (1 + (70 - 67) * 0.08));

// BUG REPRODUCTION: Convert to string (as done in optimization endpoint)
optimizedProfile.socialSecurityBenefit = adjustedBenefit.toString() as any;
optimizedProfile.spouseSocialSecurityBenefit = adjustedSpouseBenefit.toString() as any;
optimizedProfile.socialSecurityClaimAge = 70;
optimizedProfile.spouseSocialSecurityClaimAge = 70;

console.log('Adjusted SS Benefit type:', typeof optimizedProfile.socialSecurityBenefit, 'Value:', optimizedProfile.socialSecurityBenefit);
console.log('Adjusted Spouse SS Benefit type:', typeof optimizedProfile.spouseSocialSecurityBenefit, 'Value:', optimizedProfile.spouseSocialSecurityBenefit);

const optimizedParams = profileToRetirementParams(optimizedProfile);
const optimizedResult = runEnhancedMonteCarloSimulation(optimizedParams, 500);
console.log('Optimized Success Rate:', optimizedResult.probabilityOfSuccess.toFixed(1) + '%');
console.log('Optimized Annual Guaranteed Income:', optimizedParams.annualGuaranteedIncome);

// Test 3: Correct version - SS benefit as NUMBER
console.log('\n3. CORRECT VERSION - SS BENEFIT AS NUMBER');
console.log('------------------------------------------');
const correctProfile = { ...baseProfile };
correctProfile.socialSecurityBenefit = adjustedBenefit; // Keep as number
correctProfile.spouseSocialSecurityBenefit = adjustedSpouseBenefit; // Keep as number
correctProfile.socialSecurityClaimAge = 70;
correctProfile.spouseSocialSecurityClaimAge = 70;

console.log('Correct SS Benefit type:', typeof correctProfile.socialSecurityBenefit, 'Value:', correctProfile.socialSecurityBenefit);
console.log('Correct Spouse SS Benefit type:', typeof correctProfile.spouseSocialSecurityBenefit, 'Value:', correctProfile.spouseSocialSecurityBenefit);

const correctParams = profileToRetirementParams(correctProfile);
const correctResult = runEnhancedMonteCarloSimulation(correctParams, 500);
console.log('Correct Success Rate:', correctResult.probabilityOfSuccess.toFixed(1) + '%');
console.log('Correct Annual Guaranteed Income:', correctParams.annualGuaranteedIncome);

// Analysis
console.log('\n=== ANALYSIS ===');
console.log('Baseline -> Optimized (STRING): ' + 
  (optimizedResult.probabilityOfSuccess - baselineResult.probabilityOfSuccess).toFixed(1) + '% change');
console.log('Baseline -> Correct (NUMBER): ' + 
  (correctResult.probabilityOfSuccess - baselineResult.probabilityOfSuccess).toFixed(1) + '% change');

console.log('\nExpected from SS delay 67->70: +24% (8% per year × 3 years)');
console.log('Expected from higher benefits: $' + 
  ((adjustedBenefit - 2500) + (adjustedSpouseBenefit - 1800)).toLocaleString() + '/month more guaranteed income');

if (optimizedResult.probabilityOfSuccess < baselineResult.probabilityOfSuccess) {
  console.log('\n🚨 BUG CONFIRMED: Optimization shows DECREASE when it should INCREASE!');
  console.log('This confirms the string conversion issue is causing opposite effects.');
} else {
  console.log('\n✅ String conversion is not the issue. Need to investigate further.');
}