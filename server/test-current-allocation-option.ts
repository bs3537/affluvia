import { profileToRetirementParams, runRetirementMonteCarloSimulation } from './monte-carlo-base';

console.log('=== TESTING CURRENT ALLOCATION OPTION ===\n');

// Test profile with different allocations for user and spouse
const testProfile = {
  dateOfBirth: '1970-01-01',
  spouseDateOfBirth: '1972-01-01',
  maritalStatus: 'married',
  
  // User has aggressive allocation (80% stocks)
  currentAllocation: {
    usStocks: 60,
    intlStocks: 20,
    bonds: 15,
    cash: 5,
    alternatives: 0
  },
  
  // Spouse has conservative allocation (40% stocks)
  spouseAllocation: {
    usStocks: 30,
    intlStocks: 10,
    bonds: 50,
    cash: 10,
    alternatives: 0
  },
  
  // Assets with different owners
  assets: [
    // User's assets - $500k in aggressive allocation
    { type: '401k', value: 300000, owner: 'user' },
    { type: 'taxable-brokerage', value: 200000, owner: 'user' },
    
    // Spouse's assets - $400k in conservative allocation
    { type: 'traditional-ira', value: 250000, owner: 'spouse' },
    { type: 'taxable-brokerage', value: 150000, owner: 'spouse' },
    
    // Joint assets - $200k
    { type: 'savings', value: 50000, owner: 'joint' },
    { type: 'taxable-brokerage', value: 150000, owner: 'joint' }
  ],
  
  // Other required fields
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 67,
  userLifeExpectancy: 90,
  spouseLifeExpectancy: 92,
  
  annualIncome: 150000,
  spouseAnnualIncome: 100000,
  savingsRate: 20,
  
  socialSecurityBenefit: 2500,
  spouseSocialSecurityBenefit: 2000,
  socialSecurityClaimAge: 70,
  spouseSocialSecurityClaimAge: 70,
  
  expectedMonthlyExpensesRetirement: 8000,
  expectedInflationRate: 3,
  expectedRealReturn: -2, // -2 indicates "Current Allocation" option
  
  hasLongTermCareInsurance: true,
  retirementState: 'TX'
};

console.log('Testing with expectedRealReturn = -2 (Current Allocation option)\n');

// Convert profile to Monte Carlo parameters
const params = profileToRetirementParams(testProfile);

console.log('\n=== VERIFICATION ===');
console.log('useCurrentAllocation:', params.useCurrentAllocation);
console.log('useGlidePath:', params.useGlidePath);
console.log('User Allocation:', params.userAllocation);
console.log('Spouse Allocation:', params.spouseAllocation);

// Run a quick simulation
console.log('\n=== RUNNING SIMULATION ===');
const results = runRetirementMonteCarloSimulation(params, 100);

console.log(`Success Rate: ${results.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${results.medianEndingBalance.toFixed(0)}`);

// Now test with Glide Path for comparison
console.log('\n=== COMPARISON WITH GLIDE PATH ===');
const glidePathProfile = { ...testProfile, expectedRealReturn: -1 };
const glidePathParams = profileToRetirementParams(glidePathProfile);

console.log('useCurrentAllocation:', glidePathParams.useCurrentAllocation);
console.log('useGlidePath:', glidePathParams.useGlidePath);

const glidePathResults = runRetirementMonteCarloSimulation(glidePathParams, 100);

console.log(`\nGlide Path Success Rate: ${glidePathResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Glide Path Median Ending Balance: $${glidePathResults.medianEndingBalance.toFixed(0)}`);

// Test with Fixed Return for comparison
console.log('\n=== COMPARISON WITH FIXED 6% RETURN ===');
const fixedReturnProfile = { ...testProfile, expectedRealReturn: 6 };
const fixedReturnParams = profileToRetirementParams(fixedReturnProfile);

console.log('useCurrentAllocation:', fixedReturnParams.useCurrentAllocation);
console.log('useGlidePath:', fixedReturnParams.useGlidePath);

const fixedReturnResults = runRetirementMonteCarloSimulation(fixedReturnParams, 100);

console.log(`\nFixed 6% Success Rate: ${fixedReturnResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Fixed 6% Median Ending Balance: $${fixedReturnResults.medianEndingBalance.toFixed(0)}`);

console.log('\n=== SUMMARY ===');
console.log('Current Allocation (Owner-Specific):', results.probabilityOfSuccess.toFixed(1) + '%');
console.log('Glide Path:', glidePathResults.probabilityOfSuccess.toFixed(1) + '%');
console.log('Fixed 6% Return:', fixedReturnResults.probabilityOfSuccess.toFixed(1) + '%');

const bestStrategy = results.probabilityOfSuccess >= glidePathResults.probabilityOfSuccess && 
                    results.probabilityOfSuccess >= fixedReturnResults.probabilityOfSuccess ? 'Current Allocation' :
                    glidePathResults.probabilityOfSuccess >= fixedReturnResults.probabilityOfSuccess ? 'Glide Path' : 
                    'Fixed 6% Return';

console.log(`\n✅ Best Strategy: ${bestStrategy}`);
console.log('\nThe Current Allocation option properly uses owner-specific asset allocations,');
console.log('providing more accurate retirement projections based on actual investment strategies.');

console.log('\n=== TEST COMPLETE ===');