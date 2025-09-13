import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

// Test script to verify the optimization endpoint calculations

// Mock profile data similar to what the API would return
const mockProfile = {
  // Basic info
  dateOfBirth: '1975-01-01',
  maritalStatus: 'married',
  spouseDateOfBirth: '1977-01-01',
  
  // Income
  annualIncome: 150000,
  spouseAnnualIncome: 100000,
  
  // Retirement settings
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  
  // Social Security benefits (monthly)
  socialSecurityBenefit: 2500,
  spouseSocialSecurityBenefit: 2000,
  
  // Part-time income
  partTimeIncomeRetirement: 1000,
  spousePartTimeIncomeRetirement: 800,
  
  // Assets
  assets: [
    { type: '401k', value: 500000, owner: 'user' },
    { type: 'roth-ira', value: 200000, owner: 'user' },
    { type: 'taxable-brokerage', value: 300000, owner: 'joint' },
    { type: 'savings', value: 50000, owner: 'joint' }
  ],
  
  // Contributions
  retirementContributions: { employee: 19500, employer: 10000 },
  spouseRetirementContributions: { employee: 15000, employer: 7500 },
  
  // Expenses
  expectedMonthlyExpensesRetirement: 8000,
  
  // Investment settings
  expectedRealReturn: 6, // 6% (stored as percentage, not decimal)
  currentAllocation: { usStocks: 60, bonds: 35, cash: 5 },
  
  // Other settings
  expectedInflationRate: 3,
  userLifeExpectancy: 90,
  spouseLifeExpectancy: 92,
  hasLongTermCareInsurance: false
};

console.log('=== TESTING RETIREMENT OPTIMIZATION ENDPOINT ===\n');

// Test 1: Baseline calculation (no optimization)
console.log('TEST 1: Baseline Monte Carlo calculation');
const baselineParams = profileToRetirementParams(mockProfile);
const baselineResult = runEnhancedMonteCarloSimulation(baselineParams, 1000);
console.log(`Baseline success probability: ${baselineResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Annual guaranteed income: $${baselineParams.annualGuaranteedIncome.toLocaleString()}`);
console.log(`Annual expenses: $${baselineParams.annualRetirementExpenses.toLocaleString()}`);
console.log(`Annual savings: $${baselineParams.annualSavings.toLocaleString()}\n`);

// Test 2: Apply optimization variables (simulating what the endpoint does)
console.log('TEST 2: Optimized calculation with adjusted variables');

const optimizationVariables = {
  retirementAge: 67, // Delay by 2 years
  spouseRetirementAge: 67,
  socialSecurityAge: 70, // Delay SS claim
  spouseSocialSecurityAge: 70,
  assetAllocation: '7', // 7% return
  monthlyContributions: 3000, // Increase contributions
  monthlyExpenses: 7000, // Reduce expenses
  partTimeIncome: 2000, // Add part-time income
  spousePartTimeIncome: 1500
};

// Create optimized profile (mimicking the endpoint logic)
const optimizedProfile = { ...mockProfile };

// Apply retirement ages
optimizedProfile.desiredRetirementAge = optimizationVariables.retirementAge;
optimizedProfile.spouseDesiredRetirementAge = optimizationVariables.spouseRetirementAge;

// Apply Social Security claim ages and recalculate benefits
optimizedProfile.socialSecurityClaimAge = optimizationVariables.socialSecurityAge;
optimizedProfile.spouseSocialSecurityClaimAge = optimizationVariables.spouseSocialSecurityAge;

// Simulate benefit increase from delayed claiming (8% per year after FRA)
const ssDelayYears = optimizationVariables.socialSecurityAge - 67;
const spouseSSDelayYears = optimizationVariables.spouseSocialSecurityAge - 67;
optimizedProfile.socialSecurityBenefit = mockProfile.socialSecurityBenefit * (1 + 0.08 * ssDelayYears);
optimizedProfile.spouseSocialSecurityBenefit = mockProfile.spouseSocialSecurityBenefit * (1 + 0.08 * spouseSSDelayYears);

// Apply asset allocation
optimizedProfile.expectedRealReturn = parseFloat(optimizationVariables.assetAllocation); // Keep as percentage

// Apply monthly contributions (convert to annual)
const annualContributions = optimizationVariables.monthlyContributions * 12;
optimizedProfile.retirementContributions = { employee: annualContributions, employer: 0 };
optimizedProfile.spouseRetirementContributions = { employee: annualContributions, employer: 0 };

// Apply monthly expenses
optimizedProfile.expectedMonthlyExpensesRetirement = optimizationVariables.monthlyExpenses;

// Apply part-time income
optimizedProfile.partTimeIncomeRetirement = optimizationVariables.partTimeIncome;
optimizedProfile.spousePartTimeIncomeRetirement = optimizationVariables.spousePartTimeIncome;

// Calculate optimized parameters
const optimizedParams = profileToRetirementParams(optimizedProfile);
const optimizedResult = runEnhancedMonteCarloSimulation(optimizedParams, 1000);

console.log(`Optimized success probability: ${optimizedResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Annual guaranteed income: $${optimizedParams.annualGuaranteedIncome.toLocaleString()}`);
console.log(`Annual expenses: $${optimizedParams.annualRetirementExpenses.toLocaleString()}`);
console.log(`Annual savings: $${optimizedParams.annualSavings.toLocaleString()}`);

// Show improvements
const improvementPercent = optimizedResult.probabilityOfSuccess - baselineResult.probabilityOfSuccess;
console.log(`\nImprovement: +${improvementPercent.toFixed(1)}% probability of success`);

// Test 3: Verify specific variable impacts
console.log('\nTEST 3: Individual variable impacts:');

// Test retirement age delay
const retirementDelayProfile = { ...mockProfile };
retirementDelayProfile.desiredRetirementAge = 67;
retirementDelayProfile.spouseDesiredRetirementAge = 67;
const retirementDelayParams = profileToRetirementParams(retirementDelayProfile);
const retirementDelayResult = runEnhancedMonteCarloSimulation(retirementDelayParams, 1000);
console.log(`- Delaying retirement to 67: ${retirementDelayResult.probabilityOfSuccess.toFixed(1)}% (+${(retirementDelayResult.probabilityOfSuccess - baselineResult.probabilityOfSuccess).toFixed(1)}%)`);

// Test SS claim delay
const ssDelayProfile = { ...mockProfile };
ssDelayProfile.socialSecurityClaimAge = 70;
ssDelayProfile.spouseSocialSecurityClaimAge = 70;
ssDelayProfile.socialSecurityBenefit = mockProfile.socialSecurityBenefit * 1.24; // 8% per year for 3 years
ssDelayProfile.spouseSocialSecurityBenefit = mockProfile.spouseSocialSecurityBenefit * 1.24;
const ssDelayParams = profileToRetirementParams(ssDelayProfile);
const ssDelayResult = runEnhancedMonteCarloSimulation(ssDelayParams, 1000);
console.log(`- Delaying SS to 70: ${ssDelayResult.probabilityOfSuccess.toFixed(1)}% (+${(ssDelayResult.probabilityOfSuccess - baselineResult.probabilityOfSuccess).toFixed(1)}%)`);

// Test expense reduction
const expenseReductionProfile = { ...mockProfile };
expenseReductionProfile.expectedMonthlyExpensesRetirement = 7000;
const expenseReductionParams = profileToRetirementParams(expenseReductionProfile);
const expenseReductionResult = runEnhancedMonteCarloSimulation(expenseReductionParams, 1000);
console.log(`- Reducing expenses to $7,000/month: ${expenseReductionResult.probabilityOfSuccess.toFixed(1)}% (+${(expenseReductionResult.probabilityOfSuccess - baselineResult.probabilityOfSuccess).toFixed(1)}%)`);

console.log('\n=== END OF OPTIMIZATION TESTING ===');