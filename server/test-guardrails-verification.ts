import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './monte-carlo-base';

// Test to verify guardrails are working correctly with the fix

console.log('=== GUARDRAILS VERIFICATION TEST ===\n');

const baseParams: RetirementMonteCarloParams = {
  currentAge: 60,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentRetirementAssets: 1000000,
  annualSavings: 25000,
  annualRetirementExpenses: 80000, // $80k needed
  annualHealthcareCosts: 15000,
  healthcareInflationRate: 0.045,
  inflationRate: 0.025,
  expectedReturn: 0.06,
  returnVolatility: 0.15,
  withdrawalRate: 0.04,
  socialSecurityBenefit: 2000,
  socialSecurityClaimAge: 67,
  partTimeIncomeRetirement: 0,
  pensionBenefit: 0,
  annualGuaranteedIncome: 24000, // $2k SS * 12 = $24k
  useGuardrails: true, // This is the key setting
  stockAllocation: 0.6,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  useGlidePath: false,
  taxRate: 0.22,
  legacyGoal: 0,
  assetBuckets: {
    taxDeferred: 700000,
    taxFree: 200000,
    capitalGains: 100000,
    cashEquivalents: 0,
    totalAssets: 1000000
  },
  hasLongTermCareInsurance: false,
  spouseAge: 58,
  spouseLifeExpectancy: 92,
  spouseSocialSecurityBenefit: 0,
  spouseSocialSecurityClaimAge: 67,
  spousePartTimeIncomeRetirement: 0,
  spousePensionBenefit: 0,
  spouseRetirementAge: 65,
  userAnnualSavings: 25000,
  spouseAnnualSavings: 0
};

console.log('BASE SCENARIO:');
console.log(`Annual Guaranteed Income: $${baseParams.annualGuaranteedIncome.toLocaleString()}`);
console.log(`Annual Retirement Expenses: $${baseParams.annualRetirementExpenses.toLocaleString()}`);
console.log(`Net Withdrawal Needed: $${(baseParams.annualRetirementExpenses - baseParams.annualGuaranteedIncome).toLocaleString()}`);
console.log(`Guardrails Enabled: ${baseParams.useGuardrails}`);

const baseResult = runEnhancedMonteCarloSimulation(baseParams, 200);
console.log(`Success Rate: ${baseResult.probabilityOfSuccess.toFixed(1)}%\n`);

// Test 1: Increase guaranteed income (should INCREASE success rate)
console.log('TEST 1: Increase Social Security benefit');
console.log('---------------------------------------');
const higherSSParams = {
  ...baseParams,
  socialSecurityBenefit: 3000, // +$1000/month
  annualGuaranteedIncome: 36000 // $3k * 12 = $36k
};

console.log(`New Annual Guaranteed Income: $${higherSSParams.annualGuaranteedIncome.toLocaleString()}`);
console.log(`New Net Withdrawal Needed: $${(higherSSParams.annualRetirementExpenses - higherSSParams.annualGuaranteedIncome).toLocaleString()}`);

const higherSSResult = runEnhancedMonteCarloSimulation(higherSSParams, 200);
console.log(`Success Rate: ${higherSSResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Change: ${(higherSSResult.probabilityOfSuccess - baseResult.probabilityOfSuccess).toFixed(1)} percentage points`);

if (higherSSResult.probabilityOfSuccess > baseResult.probabilityOfSuccess) {
  console.log('✅ PASS: Higher SS benefit increases success rate');
} else {
  console.log('❌ FAIL: Higher SS benefit should increase success rate');
}

// Test 2: Increase expenses (should DECREASE success rate)  
console.log('\nTEST 2: Increase retirement expenses');
console.log('-----------------------------------');
const higherExpensesParams = {
  ...baseParams,
  annualRetirementExpenses: 100000 // +$20k expenses
};

console.log(`New Annual Retirement Expenses: $${higherExpensesParams.annualRetirementExpenses.toLocaleString()}`);
console.log(`New Net Withdrawal Needed: $${(higherExpensesParams.annualRetirementExpenses - higherExpensesParams.annualGuaranteedIncome).toLocaleString()}`);

const higherExpensesResult = runEnhancedMonteCarloSimulation(higherExpensesParams, 200);
console.log(`Success Rate: ${higherExpensesResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Change: ${(higherExpensesResult.probabilityOfSuccess - baseResult.probabilityOfSuccess).toFixed(1)} percentage points`);

if (higherExpensesResult.probabilityOfSuccess < baseResult.probabilityOfSuccess) {
  console.log('✅ PASS: Higher expenses decrease success rate');
} else {
  console.log('❌ FAIL: Higher expenses should decrease success rate');
}

// Test 3: Add part-time income (should INCREASE success rate)
console.log('\nTEST 3: Add part-time income');
console.log('----------------------------');
const partTimeParams = {
  ...baseParams,
  partTimeIncomeRetirement: 2000, // $2k/month part-time
  annualGuaranteedIncome: 48000 // $24k SS + $24k part-time = $48k
};

console.log(`Part-time Income: $${partTimeParams.partTimeIncomeRetirement.toLocaleString()}/month`);
console.log(`New Annual Guaranteed Income: $${partTimeParams.annualGuaranteedIncome.toLocaleString()}`);
console.log(`New Net Withdrawal Needed: $${(partTimeParams.annualRetirementExpenses - partTimeParams.annualGuaranteedIncome).toLocaleString()}`);

const partTimeResult = runEnhancedMonteCarloSimulation(partTimeParams, 200);
console.log(`Success Rate: ${partTimeResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Change: ${(partTimeResult.probabilityOfSuccess - baseResult.probabilityOfSuccess).toFixed(1)} percentage points`);

if (partTimeResult.probabilityOfSuccess > baseResult.probabilityOfSuccess) {
  console.log('✅ PASS: Part-time income increases success rate');
} else {
  console.log('❌ FAIL: Part-time income should increase success rate');
}

console.log('\n=== SUMMARY ===');
console.log('These tests verify that the guardrails fix is working:');
console.log('1. Higher guaranteed income → Higher success rate');
console.log('2. Higher expenses → Lower success rate'); 
console.log('3. Part-time income → Higher success rate');
console.log('\nIf all tests pass, the optimization variables are working correctly.');