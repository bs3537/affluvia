import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './monte-carlo-base';

// Debug script to understand why success rate is only 8% with $7.8M ending balance

const debugParams: RetirementMonteCarloParams = {
  currentAge: 70,
  retirementAge: 65, // Already retired
  lifeExpectancy: 93,
  currentRetirementAssets: 3000000, // $3M current retirement assets
  annualSavings: 0, // Already retired
  annualRetirementExpenses: 96000, // $8k/month = $96k/year
  annualHealthcareCosts: 12000, // Additional healthcare costs
  healthcareInflationRate: 0.045,
  inflationRate: 0.025,
  expectedReturn: 0.06, // 6% return
  withdrawalRate: 0.04,
  socialSecurityBenefit: 3000, // $3k/month
  socialSecurityClaimAge: 67,
  partTimeIncomeRetirement: 7500, // $7.5k/month part-time income
  pensionBenefit: 0,
  initialGuaranteedIncome: 0, // Will be calculated
  useGuardrails: true,
  stockAllocation: 0.6,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  assetBuckets: {
    taxDeferred: 2000000,
    taxFree: 500000,
    capitalGains: 500000,
    cashEquivalents: 0,
    totalAssets: 3000000
  },
  hasLongTermCareInsurance: false,
  // Spouse info
  spouseAge: 68,
  spouseLifeExpectancy: 95,
  spouseSocialSecurityBenefit: 2500,
  spouseSocialSecurityClaimAge: 67,
  spousePartTimeIncomeRetirement: 7500,
  spousePensionBenefit: 0,
  spouseRetirementAge: 65,
  userAnnualSavings: 0,
  spouseAnnualSavings: 0
};

console.log('=== DEBUG: LOW SUCCESS RATE INVESTIGATION ===\n');

// Calculate annual guaranteed income
const userSS = debugParams.socialSecurityBenefit ? debugParams.socialSecurityBenefit * 12 : 0;
const spouseSS = debugParams.spouseSocialSecurityBenefit ? debugParams.spouseSocialSecurityBenefit * 12 : 0;
const userPartTime = debugParams.partTimeIncomeRetirement ? debugParams.partTimeIncomeRetirement * 12 : 0;
const spousePartTime = debugParams.spousePartTimeIncomeRetirement ? debugParams.spousePartTimeIncomeRetirement * 12 : 0;
const totalGuaranteedIncome = userSS + spouseSS + userPartTime + spousePartTime;

console.log('Financial Overview:');
console.log(`- Current Age: ${debugParams.currentAge}`);
console.log(`- Retirement Assets: $${debugParams.currentRetirementAssets.toLocaleString()}`);
console.log(`- Annual Expenses: $${debugParams.annualRetirementExpenses.toLocaleString()}`);
console.log(`- Annual Healthcare: $${debugParams.annualHealthcareCosts.toLocaleString()}`);
console.log(`- Total Annual Expenses: $${(debugParams.annualRetirementExpenses + debugParams.annualHealthcareCosts).toLocaleString()}`);

console.log('\nGuaranteed Income Sources:');
console.log(`- User SS: $${userSS.toLocaleString()}/year`);
console.log(`- Spouse SS: $${spouseSS.toLocaleString()}/year`);
console.log(`- User Part-time: $${userPartTime.toLocaleString()}/year`);
console.log(`- Spouse Part-time: $${spousePartTime.toLocaleString()}/year`);
console.log(`- TOTAL Guaranteed: $${totalGuaranteedIncome.toLocaleString()}/year`);

console.log('\nNet Withdrawal Need:');
const totalExpenses = debugParams.annualRetirementExpenses + debugParams.annualHealthcareCosts;
const netNeed = totalExpenses - totalGuaranteedIncome;
console.log(`- Total Expenses: $${totalExpenses.toLocaleString()}`);
console.log(`- Guaranteed Income: $${totalGuaranteedIncome.toLocaleString()}`);
console.log(`- Net Need from Portfolio: $${netNeed.toLocaleString()}`);
console.log(`- Withdrawal Rate: ${((netNeed / debugParams.currentRetirementAssets) * 100).toFixed(2)}%`);

// Update the initial guaranteed income
debugParams.initialGuaranteedIncome = totalGuaranteedIncome;

// Run just 100 simulations for debugging
console.log('\nRunning 100 Monte Carlo simulations...\n');
const result = runEnhancedMonteCarloSimulation(debugParams, 100);

console.log('RESULTS:');
console.log(`- Success Probability: ${result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Median Ending Balance: $${Math.round(result.medianEndingBalance).toLocaleString()}`);
console.log(`- 10th Percentile Balance: $${Math.round(result.percentile10EndingBalance).toLocaleString()}`);
console.log(`- 90th Percentile Balance: $${Math.round(result.percentile90EndingBalance).toLocaleString()}`);

// Analyze first year cash flow
if (result.yearlyCashFlows && result.yearlyCashFlows.length > 0) {
  console.log('\nFirst Year Cash Flow Analysis:');
  const firstYear = result.yearlyCashFlows[0];
  console.log(`- Age: ${firstYear.age}`);
  console.log(`- Portfolio Balance: $${Math.round(firstYear.portfolioBalance).toLocaleString()}`);
  console.log(`- Guaranteed Income: $${Math.round(firstYear.guaranteedIncome).toLocaleString()}`);
  console.log(`- Withdrawal: $${Math.round(firstYear.withdrawal).toLocaleString()}`);
  console.log(`- Net Cash Flow: $${Math.round(firstYear.netCashFlow).toLocaleString()}`);
}

console.log('\nPOSSIBLE ISSUES:');
console.log('1. Part-time income may decline over time (10% per year)');
console.log('2. Expenses include healthcare inflation (4.5% vs 2.5% general)');
console.log('3. Taxes may be reducing net income significantly');
console.log('4. Market volatility in Monte Carlo may cause early failures');

// Check if the issue is the NET need calculation
console.log('\nWITH CURRENT INCOME:');
console.log(`Net withdrawal rate = $${netNeed.toLocaleString()} / $${debugParams.currentRetirementAssets.toLocaleString()} = ${((netNeed / debugParams.currentRetirementAssets) * 100).toFixed(2)}%`);
console.log('This should be sustainable with a 6% return, so the issue is likely:');
console.log('- Income declining over time');
console.log('- Expenses growing faster than expected');
console.log('- Tax calculations reducing net income');