import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './monte-carlo-base';

// Test script to verify part-time income increases retirement success probability

const baseParams: RetirementMonteCarloParams = {
  currentAge: 62,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentRetirementAssets: 1200000, // $1.2M - more challenging
  annualSavings: 30000,
  annualRetirementExpenses: 120000, // $120k/year - higher expenses
  annualHealthcareCosts: 18000,
  healthcareInflationRate: 0.045,
  inflationRate: 0.025,
  expectedReturn: 0.06,
  returnVolatility: 0.15,
  withdrawalRate: 0.045, // Higher withdrawal rate
  socialSecurityBenefit: 2200, // $2.2k/month
  socialSecurityClaimAge: 67,
  partTimeIncomeRetirement: 0, // Start with no part-time income
  pensionBenefit: 0,
  annualGuaranteedIncome: 0,
  useGuardrails: true,
  stockAllocation: 0.5,  // More conservative
  bondAllocation: 0.4,
  cashAllocation: 0.1,
  useGlidePath: false,
  taxRate: 0.22,
  legacyGoal: 0,
  assetBuckets: {
    taxDeferred: 840000,     // 70%
    taxFree: 240000,         // 20%
    capitalGains: 120000,    // 10%
    cashEquivalents: 0,
    totalAssets: 1200000
  },
  hasLongTermCareInsurance: false,
  // Spouse info
  spouseAge: 60,
  spouseLifeExpectancy: 92,
  spouseSocialSecurityBenefit: 1800,
  spouseSocialSecurityClaimAge: 67,
  spousePartTimeIncomeRetirement: 0,
  spousePensionBenefit: 0,
  spouseRetirementAge: 65,
  userAnnualSavings: 30000,
  spouseAnnualSavings: 0
};

console.log('=== Testing Part-Time Income Fix ===\n');

// Calculate initial guaranteed income for base case
const userSS = baseParams.socialSecurityBenefit ? baseParams.socialSecurityBenefit * 12 : 0;
const spouseSS = baseParams.spouseSocialSecurityBenefit ? baseParams.spouseSocialSecurityBenefit * 12 : 0;
const userPension = baseParams.pensionBenefit ? baseParams.pensionBenefit * 12 : 0;
const spousePension = baseParams.spousePensionBenefit ? baseParams.spousePensionBenefit * 12 : 0;

// Test 1: No part-time income
console.log('Test 1: No part-time income');
const params1 = {
  ...baseParams,
  initialGuaranteedIncome: userSS + spouseSS + userPension + spousePension
};
const result1 = runEnhancedMonteCarloSimulation(params1, 500); // More iterations
console.log(`Success Rate: ${result1.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(result1.medianEndingBalance).toLocaleString()}\n`);

// Test 2: With user part-time income ($3k/month)
console.log('Test 2: With $3k/month user part-time income');
const userPartTime2 = 3000 * 12;
const paramsWithUserPartTime = {
  ...baseParams,
  partTimeIncomeRetirement: 3000,
  initialGuaranteedIncome: userSS + spouseSS + userPension + spousePension + userPartTime2
};
const result2 = runEnhancedMonteCarloSimulation(paramsWithUserPartTime, 500);
console.log(`Success Rate: ${result2.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(result2.medianEndingBalance).toLocaleString()}`);
console.log(`Change: ${(result2.probabilityOfSuccess - result1.probabilityOfSuccess).toFixed(1)} percentage points\n`);

// Test 3: With both user and spouse part-time income
console.log('Test 3: With $3k/month user + $2k/month spouse part-time income');
const spousePartTime3 = 2000 * 12;
const paramsWithBothPartTime = {
  ...baseParams,
  partTimeIncomeRetirement: 3000,
  spousePartTimeIncomeRetirement: 2000,
  initialGuaranteedIncome: userSS + spouseSS + userPension + spousePension + userPartTime2 + spousePartTime3
};
const result3 = runEnhancedMonteCarloSimulation(paramsWithBothPartTime, 500);
console.log(`Success Rate: ${result3.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(result3.medianEndingBalance).toLocaleString()}`);
console.log(`Change: ${(result3.probabilityOfSuccess - result1.probabilityOfSuccess).toFixed(1)} percentage points\n`);

// Analyze first year cash flow to understand the impact
console.log('First Year Cash Flow Analysis (Test 3):');
if (result3.yearlyCashFlows && result3.yearlyCashFlows.length > 0) {
  const retirementYearIndex = 5; // Year when they retire
  if (result3.yearlyCashFlows[retirementYearIndex]) {
    const cf = result3.yearlyCashFlows[retirementYearIndex];
    console.log(`- Age: ${cf.age}`);
    console.log(`- Guaranteed Income: $${Math.round(cf.guaranteedIncome).toLocaleString()}`);
    console.log(`- Withdrawal: $${Math.round(cf.withdrawal).toLocaleString()}`);
    console.log(`- Portfolio Balance: $${Math.round(cf.portfolioBalance).toLocaleString()}`);
  }
}

console.log('\n=== RESULTS SUMMARY ===');
console.log('Adding part-time income should INCREASE success probability.');
console.log(`No part-time: ${result1.probabilityOfSuccess.toFixed(1)}%`);
console.log(`With user part-time: ${result2.probabilityOfSuccess.toFixed(1)}% (${result2.probabilityOfSuccess > result1.probabilityOfSuccess ? '✅ PASS' : '❌ FAIL'})`);
console.log(`With both part-time: ${result3.probabilityOfSuccess.toFixed(1)}% (${result3.probabilityOfSuccess > result2.probabilityOfSuccess ? '✅ PASS' : '❌ FAIL'})`);