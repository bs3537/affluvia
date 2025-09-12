import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

// Direct params without profileToRetirementParams conversion
const baseParams: any = {
  currentAge: 60,
  retirementAge: 65,
  lifeExpectancy: 90,
  spouseAge: 60,
  spouseLifeExpectancy: 90,
  
  currentRetirementAssets: 800000,  // Much less assets
  annualSavings: 20000,  // Lower savings
  annualRetirementExpenses: 100000,  // High expenses relative to assets
  annualHealthcareCosts: 0, // Already included in expenses
  
  annualGuaranteedIncome: 72000, // SS benefits
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  
  assetBuckets: {
    taxDeferred: 600000,
    taxFree: 0,
    capitalGains: 200000,
    cashEquivalents: 0
  },
  
  userAllocation: { stocks: 60, bonds: 35, cash: 5 },
  spouseAllocation: { stocks: 60, bonds: 35, cash: 5 },
  
  expectedInflationRate: 0.03,
  taxRate: 0.22,
  state: 'CA',
  
  hasLongTermCareInsurance: false
};

console.log('Testing LTC Insurance Impact with Direct Parameters\n');
console.log('Profile: Age 60, retiring at 65');
console.log('Assets: $800k, Annual expenses: $100k\n');

// Test without insurance
console.log('Running simulation WITHOUT LTC insurance...');
const resultNoLTC = runEnhancedMonteCarloSimulation(baseParams, 10); // Small number for debugging
console.log(`Success Rate: ${resultNoLTC.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Successful scenarios: ${resultNoLTC.scenarios.successful} / ${resultNoLTC.scenarios.total}`);
console.log(`Median Ending Balance: $${resultNoLTC.medianEndingBalance}`);
console.log(`Raw ending balances:`, resultNoLTC.endingBalances?.slice(0, 5));
console.log(`Percentiles:`, resultNoLTC.percentiles);

// Test with insurance
const paramsWithLTC = { ...baseParams, hasLongTermCareInsurance: true };
console.log('\nRunning simulation WITH LTC insurance...');
const resultWithLTC = runEnhancedMonteCarloSimulation(paramsWithLTC, 10);
console.log(`Success Rate: ${resultWithLTC.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Successful scenarios: ${resultWithLTC.scenarios.successful} / ${resultWithLTC.scenarios.total}`);
console.log(`Median Ending Balance: $${resultWithLTC.medianEndingBalance}`);
console.log(`Raw ending balances:`, resultWithLTC.endingBalances?.slice(0, 5));
console.log(`Percentiles:`, resultWithLTC.percentiles);

// Analysis
const diff = resultWithLTC.probabilityOfSuccess - resultNoLTC.probabilityOfSuccess;
console.log('\n=== ANALYSIS ===');
if (diff > 0) {
  console.log(`✅ LTC insurance IMPROVES success rate by ${diff.toFixed(1)}%`);
  console.log('   The fix is working - insurance provides net benefit.');
} else if (Math.abs(diff) < 1) {
  console.log('⚠️  LTC insurance has minimal impact');
  console.log('   Profile may be well-funded enough to handle LTC costs.');
} else {
  console.log(`❌ LTC insurance REDUCES success rate by ${Math.abs(diff).toFixed(1)}%`);
  console.log('   This suggests the old bug still exists.');
}