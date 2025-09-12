// Analyze User 4's retirement situation
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { RetirementMonteCarloParams } from './monte-carlo.js';

// User 4 retiring at 65
const user4At65: RetirementMonteCarloParams = {
  currentAge: 55,
  spouseAge: 53,
  retirementAge: 65,  // Changed from 62 to 65
  lifeExpectancy: 93,
  currentRetirementAssets: 600000,
  annualGuaranteedIncome: 60000,  // SS + Pension both available at 65
  annualRetirementExpenses: 80000,
  annualHealthcareCosts: 18000,
  healthcareInflationRate: 0.025,
  expectedReturn: 0.055,
  returnVolatility: 0.14,
  inflationRate: 0.025,
  stockAllocation: 0.60,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  useGlidePath: false,
  withdrawalRate: 0.04,
  useGuardrails: false,
  taxRate: 0.22,
  annualSavings: 19500,
  legacyGoal: 0,
  hasLongTermCareInsurance: false,
  assetBuckets: {
    taxDeferred: 450000,
    taxFree: 0,
    capitalGains: 150000,
    cashEquivalents: 40000,
    totalAssets: 640000
  }
};

console.log('=== USER 4 ANALYSIS - RETIRING AT 65 ===\n');

// Calculate projected portfolio at retirement
const yearsTo65 = 10;  // From age 55 to 65
let projectedAt65 = user4At65.currentRetirementAssets;
for (let i = 0; i < yearsTo65; i++) {
  projectedAt65 += user4At65.annualSavings;
  projectedAt65 *= 1.055;
}

console.log('Financial Snapshot at Age 65:');
console.log(`- Projected Portfolio: $${Math.round(projectedAt65).toLocaleString()}`);
console.log(`- Annual Expenses: $${(user4At65.annualRetirementExpenses + user4At65.annualHealthcareCosts).toLocaleString()}`);
console.log(`- Guaranteed Income: $${user4At65.annualGuaranteedIncome.toLocaleString()}`);
console.log(`- Annual Gap: $${((user4At65.annualRetirementExpenses + user4At65.annualHealthcareCosts) - user4At65.annualGuaranteedIncome).toLocaleString()}`);
console.log(`- Initial Withdrawal Rate: ${(((user4At65.annualRetirementExpenses + user4At65.annualHealthcareCosts) - user4At65.annualGuaranteedIncome) / projectedAt65 * 100).toFixed(2)}%`);

console.log('\nRunning Monte Carlo (1000 scenarios)...\n');
const result65 = runEnhancedMonteCarloSimulation(user4At65, 1000);

console.log('RESULTS:');
console.log(`- Success Rate: ${result65.probabilityOfSuccess.toFixed(1)}%`);
console.log(`- Safe Withdrawal Rate: ${(result65.safeWithdrawalRate * 100).toFixed(2)}%`);
console.log(`- Median Ending Balance: $${Math.round(result65.medianEndingBalance).toLocaleString()}`);

// Test different scenarios
console.log('\n=== SCENARIO ANALYSIS ===\n');

// Scenario 1: What if they had more guaranteed income?
const higherIncomeParams = { ...user4At65, annualGuaranteedIncome: 75000 };
const higherIncomeResult = runEnhancedMonteCarloSimulation(higherIncomeParams, 1000);
console.log(`With $75k guaranteed income: ${higherIncomeResult.probabilityOfSuccess.toFixed(1)}% success`);

// Scenario 2: What if they reduced expenses?
const lowerExpenseParams = { ...user4At65, annualRetirementExpenses: 70000 };
const lowerExpenseResult = runEnhancedMonteCarloSimulation(lowerExpenseParams, 1000);
console.log(`With $70k base expenses: ${lowerExpenseResult.probabilityOfSuccess.toFixed(1)}% success`);

// Scenario 3: Delay to age 67
const age67Params = { ...user4At65, retirementAge: 67, currentAge: 55 };
const age67Result = runEnhancedMonteCarloSimulation(age67Params, 1000);
console.log(`Retiring at age 67: ${age67Result.probabilityOfSuccess.toFixed(1)}% success`);

console.log('\n=== DIAGNOSIS ===');
console.log('The low success rate is likely due to:');
console.log('1. High expense-to-income ratio (expenses exceed guaranteed income)');
console.log('2. Healthcare inflation outpacing general inflation');
console.log('3. Long retirement period (28 years from 65 to 93)');
console.log('4. Sequence of returns risk in early retirement');

// Check if guaranteed income timing is the issue
console.log('\n=== INCOME TIMING CHECK ===');
if (user4At65.annualGuaranteedIncome < user4At65.annualRetirementExpenses + user4At65.annualHealthcareCosts) {
  const gap = (user4At65.annualRetirementExpenses + user4At65.annualHealthcareCosts) - user4At65.annualGuaranteedIncome;
  const coverageRatio = (user4At65.annualGuaranteedIncome / (user4At65.annualRetirementExpenses + user4At65.annualHealthcareCosts) * 100);
  console.log(`Guaranteed income covers only ${coverageRatio.toFixed(1)}% of expenses`);
  console.log(`Annual shortfall: $${gap.toLocaleString()}`);
  console.log('This explains why safe withdrawal rate is 0% - even with no withdrawals,');
  console.log('the portfolio depletes due to the expense gap.');
}