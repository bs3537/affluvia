// Debug script to understand the discrepancy between dashboard (100%) and AI insights (58.6%)

import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';
import { AssetBuckets } from './asset-tax-classifier';

// Simulate the profile data that would come from the dashboard
const mockProfile = {
  // Personal info
  dateOfBirth: new Date('1975-01-01'), // Age 50
  maritalStatus: 'married',
  spouseDateOfBirth: new Date('1975-01-01'), // Spouse age 50
  
  // Income
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  
  // Retirement goals
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  userLifeExpectancy: 85,
  spouseLifeExpectancy: 85,
  
  // Expenses
  expectedMonthlyExpensesRetirement: 8000,
  
  // Assets
  assets: [
    { type: '401k', value: 400000, owner: 'user' },
    { type: 'taxable-brokerage', value: 90000, owner: 'joint' },
    { type: 'checking', value: 50000, owner: 'joint' },
    { type: 'savings', value: 32000, owner: 'joint' },
    { type: 'cash-value-life-insurance', value: 120000, owner: 'user' }
  ],
  
  // Retirement contributions
  retirementContributions: { employee: 2583, employer: 0 },
  
  // Social Security
  socialSecurityBenefit: 2003, // Calculated based on $60k income
  spouseSocialSecurityBenefit: 3613, // Calculated based on $450k income
  
  // Other parameters
  expectedInflationRate: 3,
  expectedRealReturn: 6,
  withdrawalRate: 4,
  legacyGoal: 100000,
  
  // State
  retirementState: 'TX',
  
  // Stock allocation
  stockAllocation: 60,
  
  // Current allocation (for asset categorization)
  currentAllocation: { usStocks: 60, bonds: 35, cash: 5 }
};

console.log('=== DEBUGGING MONTE CARLO DISCREPANCY ===\n');

// Convert to Monte Carlo parameters (simulating what the dashboard does)
const params = profileToRetirementParams(mockProfile);

console.log('Monte Carlo Parameters:');
console.log('- Current Age:', params.currentAge);
console.log('- Retirement Age:', params.retirementAge);
console.log('- Current Retirement Assets:', params.currentRetirementAssets.toLocaleString());
console.log('- Annual Guaranteed Income:', params.annualGuaranteedIncome.toLocaleString());
console.log('- Annual Retirement Expenses:', params.annualRetirementExpenses.toLocaleString());
console.log('- Annual Savings:', params.annualSavings.toLocaleString());
console.log('- Tax Rate:', (params.taxRate * 100).toFixed(1) + '%');
console.log('');

// Run the enhanced Monte Carlo simulation (what both dashboard and AI use)
console.log('Running Enhanced Monte Carlo Simulation (5000 iterations)...');
const result = runEnhancedMonteCarloSimulation(params, 5000);

console.log('\nRESULTS:');
console.log('Success Probability:', result.probabilityOfSuccess.toFixed(1) + '%');
console.log('Median Ending Balance:', '$' + result.medianEndingBalance.toLocaleString());
console.log('Safe Withdrawal Rate:', (result.safeWithdrawalRate * 100).toFixed(2) + '%');
console.log('10th Percentile:', '$' + result.percentile10EndingBalance.toLocaleString());
console.log('90th Percentile:', '$' + result.percentile90EndingBalance.toLocaleString());

if (result.guytonKlingerStats) {
  console.log('\nGuyton-Klinger Statistics:');
  console.log('Average Adjustments per Scenario:', result.guytonKlingerStats.averageAdjustmentsPerScenario.toFixed(2));
  console.log('Adjustment Types:', result.guytonKlingerStats.adjustmentTypeBreakdown);
}

console.log('\n=== ANALYSIS ===');
if (result.probabilityOfSuccess > 90) {
  console.log('The enhanced simulation is showing HIGH success probability.');
  console.log('This suggests the AI might be using different parameters or calculations.');
  console.log('\nPossible reasons for discrepancy:');
  console.log('1. AI might be considering additional factors not in the Monte Carlo');
  console.log('2. AI might be using different expense assumptions');
  console.log('3. AI might be calculating taxes differently');
  console.log('4. The 58.6% might be a different metric (not Monte Carlo success rate)');
} else {
  console.log('The enhanced simulation shows moderate/low success probability.');
  console.log('The dashboard might be caching old results or using different parameters.');
}

// Let's also check what happens with more conservative assumptions
console.log('\n\n=== TESTING WITH MORE CONSERVATIVE ASSUMPTIONS ===');

const conservativeParams = {
  ...params,
  annualHealthcareCosts: 20000, // Higher healthcare costs
  healthcareInflationRate: 0.06, // 6% healthcare inflation
  expectedReturn: 0.05, // Lower returns
  returnVolatility: 0.20, // Higher volatility
  taxRate: 0.30 // Higher taxes
};

const conservativeResult = runEnhancedMonteCarloSimulation(conservativeParams, 1000);

console.log('\nCONSERVATIVE SCENARIO RESULTS:');
console.log('Success Probability:', conservativeResult.probabilityOfSuccess.toFixed(1) + '%');
console.log('Median Ending Balance:', '$' + conservativeResult.medianEndingBalance.toLocaleString());

console.log('\n=== CONCLUSION ===');
console.log('The discrepancy between 100% (dashboard) and 58.6% (AI) suggests:');
console.log('1. The AI is likely calculating a different metric or using different assumptions');
console.log('2. The "Critical Retirement Shortfall" might refer to a funding gap, not success probability');
console.log('3. The AI might be using more sophisticated analysis beyond Monte Carlo');