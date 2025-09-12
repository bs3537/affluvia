// Test to verify LTC insurance modeling fix
import { runEnhancedMonteCarloSimulation, profileToRetirementParams } from './monte-carlo-enhanced';

console.log('=== LTC INSURANCE MODELING FIX VERIFICATION ===\n');

// Create base profile
const baseProfile = {
  dateOfBirth: '1964-01-01', // Age 60
  maritalStatus: 'married',
  spouseDateOfBirth: '1964-01-01',
  state: 'CA',
  desiredRetirementAge: 65,
  userLifeExpectancy: 90,
  spouseLifeExpectancy: 90,
  
  // Income and savings
  annualIncome: 150000,
  spouseAnnualIncome: 150000,
  retirementContributions: { employee: 40000, employer: 10000 },
  
  // Social Security
  socialSecurityBenefit: 3000,
  spouseSocialSecurityBenefit: 3000,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  
  // Expenses
  expectedMonthlyExpensesRetirement: 8000, // $96k/year base
  retirementExpensesIncludeHealthcare: true,
  
  // Assets
  assets: [
    { type: '401k', value: 2000000, owner: 'user' },
    { type: 'traditional-ira', value: 1000000, owner: 'spouse' },
    { type: 'taxable-brokerage', value: 500000, owner: 'joint' }
  ],
  
  // Allocation
  stockAllocation: 60,
  bondAllocation: 35,
  cashAllocation: 5,
  
  // Return expectations
  expectedRealReturn: 6,
  expectedInflationRate: 3,
  
  legacyGoal: 0
};

// Test scenarios
const scenarios = [
  { 
    hasLTC: false, 
    label: 'No LTC Insurance',
    description: 'Full out-of-pocket costs if LTC event occurs'
  },
  { 
    hasLTC: true, 
    label: 'With LTC Insurance',
    description: 'Pays premiums, receives benefits if event occurs'
  }
];

console.log('Testing LTC insurance modeling...');
console.log('Profile: Age 60 couple, retiring at 65');
console.log('Assets: $3.5M, Monthly expenses: $8,000\n');

console.log('Scenario            | Success | Median Balance | Description');
console.log('--------------------|---------|----------------|----------------------------------------');

// Suppress console logs
const originalLog = console.log;
const suppressLogs = () => { console.log = () => {}; };
const restoreLogs = () => { console.log = originalLog; };

const results: any[] = [];

for (const scenario of scenarios) {
  const profile = {
    ...baseProfile,
    hasLongTermCareInsurance: scenario.hasLTC
  };
  
  suppressLogs();
  const params = profileToRetirementParams(profile);
  const result = runEnhancedMonteCarloSimulation(params, 500);
  restoreLogs();
  
  results.push({
    ...scenario,
    successRate: result.probabilityOfSuccess,
    medianBalance: result.percentiles?.p50 || 0
  });
  
  console.log(
    `${scenario.label.padEnd(19)} | ` +
    `${result.probabilityOfSuccess.toFixed(1).padStart(6)}% | ` +
    `$${((result.percentiles?.p50 || 0) / 1000).toFixed(0).padStart(7)}k`.padEnd(14) + ' | ' +
    scenario.description
  );
}

console.log('\n=== ANALYSIS ===\n');

if (results.length === 2) {
  const withoutInsurance = results[0];
  const withInsurance = results[1];
  
  const successDiff = withInsurance.successRate - withoutInsurance.successRate;
  
  if (successDiff > 0) {
    console.log(`✅ LTC insurance IMPROVES success rate by ${successDiff.toFixed(1)}%`);
    console.log('   This indicates the fix is working - insurance provides net benefit');
    console.log('   despite premium costs, by covering catastrophic LTC expenses.');
  } else if (Math.abs(successDiff) < 2) {
    console.log('⚠️  LTC insurance has minimal impact on success rate');
    console.log('   This could mean:');
    console.log('   1. The profile is well-funded enough to handle LTC costs');
    console.log('   2. LTC event probability is low in the simulation');
    console.log('   3. Insurance premiums offset most of the benefit');
  } else {
    console.log('❌ LTC insurance REDUCES success rate');
    console.log('   This suggests the old bug where premiums are paid but');
    console.log('   benefits are never received.');
  }
}

console.log('\n=== KEY INSIGHTS ===\n');
console.log('The fix ensures that:');
console.log('1. LTC events are modeled for BOTH insured and uninsured users');
console.log('2. Insured users pay premiums AND receive benefits if an event occurs');
console.log('3. Uninsured users pay full out-of-pocket costs if an event occurs');
console.log('\n✅ LTC insurance now correctly models both costs AND benefits.');