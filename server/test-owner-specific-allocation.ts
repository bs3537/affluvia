import { profileToRetirementParams, runRetirementMonteCarloSimulation } from './monte-carlo-base';

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
  expectedRealReturn: -1, // Use allocation-based returns
  
  hasLongTermCareInsurance: true,
  retirementState: 'TX'
};

console.log('=== TESTING OWNER-SPECIFIC ASSET ALLOCATION ===\n');

// Convert profile to Monte Carlo parameters
const params = profileToRetirementParams(testProfile);

console.log('\n=== MONTE CARLO PARAMETERS ===');
console.log('User Allocation:', params.userAllocation);
console.log('Spouse Allocation:', params.spouseAllocation);
console.log('\nUser Asset Buckets:', {
  taxDeferred: params.userAssetBuckets?.taxDeferred?.toFixed(0),
  taxFree: params.userAssetBuckets?.taxFree?.toFixed(0),
  capitalGains: params.userAssetBuckets?.capitalGains?.toFixed(0),
  cash: params.userAssetBuckets?.cashEquivalents?.toFixed(0),
  total: params.userAssetBuckets?.totalAssets?.toFixed(0)
});
console.log('\nSpouse Asset Buckets:', {
  taxDeferred: params.spouseAssetBuckets?.taxDeferred?.toFixed(0),
  taxFree: params.spouseAssetBuckets?.taxFree?.toFixed(0),
  capitalGains: params.spouseAssetBuckets?.capitalGains?.toFixed(0),
  cash: params.spouseAssetBuckets?.cashEquivalents?.toFixed(0),
  total: params.spouseAssetBuckets?.totalAssets?.toFixed(0)
});
console.log('\nJoint Asset Buckets:', {
  taxDeferred: params.jointAssetBuckets?.taxDeferred?.toFixed(0),
  taxFree: params.jointAssetBuckets?.taxFree?.toFixed(0),
  capitalGains: params.jointAssetBuckets?.capitalGains?.toFixed(0),
  cash: params.jointAssetBuckets?.cashEquivalents?.toFixed(0),
  total: params.jointAssetBuckets?.totalAssets?.toFixed(0)
});

// Run a small Monte Carlo simulation
console.log('\n=== RUNNING MONTE CARLO SIMULATION ===');
console.log('Running 100 simulations with owner-specific allocations...\n');

const results = runRetirementMonteCarloSimulation(params, 100);

console.log('=== SIMULATION RESULTS ===');
console.log(`Success Rate: ${results.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${results.medianEndingBalance.toFixed(0)}`);
console.log(`25th Percentile: $${results.confidenceIntervals.percentile25.toFixed(0)}`);
console.log(`75th Percentile: $${results.confidenceIntervals.percentile75.toFixed(0)}`);

// Compare with household-wide allocation approach
console.log('\n=== COMPARISON WITH HOUSEHOLD-WIDE ALLOCATION ===');

// Create a profile with single household allocation (weighted average)
const householdProfile = { ...testProfile };
// Calculate weighted average allocation based on asset values
const userTotal = 500000; // 300k + 200k
const spouseTotal = 400000; // 250k + 150k
const jointTotal = 200000; // 50k + 150k
const totalAssets = userTotal + spouseTotal + jointTotal;

const weightedStocks = (userTotal * 80 + spouseTotal * 40 + jointTotal * 60) / totalAssets;
const weightedBonds = (userTotal * 15 + spouseTotal * 50 + jointTotal * 32.5) / totalAssets;
const weightedCash = (userTotal * 5 + spouseTotal * 10 + jointTotal * 7.5) / totalAssets;

console.log(`\nWeighted Household Allocation:`);
console.log(`  Stocks: ${weightedStocks.toFixed(1)}%`);
console.log(`  Bonds: ${weightedBonds.toFixed(1)}%`);
console.log(`  Cash: ${weightedCash.toFixed(1)}%`);

// Clear owner-specific allocations to force household-wide approach
const householdParams = { ...params };
delete householdParams.userAllocation;
delete householdParams.spouseAllocation;
delete householdParams.userAssetBuckets;
delete householdParams.spouseAssetBuckets;
delete householdParams.jointAssetBuckets;

const householdResults = runRetirementMonteCarloSimulation(householdParams, 100);

console.log('\nHousehold-Wide Allocation Results:');
console.log(`Success Rate: ${householdResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${householdResults.medianEndingBalance.toFixed(0)}`);

console.log('\n=== ANALYSIS ===');
const successDiff = results.probabilityOfSuccess - householdResults.probabilityOfSuccess;
const medianDiff = results.medianEndingBalance - householdResults.medianEndingBalance;

console.log(`Success Rate Difference: ${successDiff > 0 ? '+' : ''}${successDiff.toFixed(1)}%`);
console.log(`Median Balance Difference: ${medianDiff > 0 ? '+' : ''}$${medianDiff.toFixed(0)}`);

if (Math.abs(successDiff) > 1) {
  console.log('\n✅ Owner-specific allocation is making a meaningful difference!');
  console.log('The different risk profiles of each spouse are being properly modeled.');
} else {
  console.log('\n⚠️ The difference is minimal - this could be due to:');
  console.log('1. Small sample size (100 simulations)');
  console.log('2. Similar overall portfolio performance despite different allocations');
  console.log('3. Other factors dominating the retirement outcome');
}

console.log('\n=== TEST COMPLETE ===');