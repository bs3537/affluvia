// Debug a single scenario for Bhavneesh
import { runEnhancedRetirementScenario } from './monte-carlo-enhanced.js';
import { RetirementMonteCarloParams } from './monte-carlo.js';

const params: RetirementMonteCarloParams = {
  currentAge: 51,
  spouseAge: 51,
  retirementAge: 75,
  lifeExpectancy: 90,
  currentRetirementAssets: 695000,
  annualGuaranteedIncome: 160249,
  annualRetirementExpenses: 125983,
  annualHealthcareCosts: 29983,
  healthcareInflationRate: 0.025,
  expectedReturn: 0.07,
  returnVolatility: 0.20,
  inflationRate: 0.03,
  stockAllocation: 1.0,
  bondAllocation: 0,
  cashAllocation: 0,
  withdrawalRate: 0.04,
  useGuardrails: false,
  taxRate: 0.114,
  annualSavings: 30996,
  legacyGoal: 100000,
  hasLongTermCareInsurance: false,
  assetBuckets: {
    taxDeferred: 400000,
    taxFree: 0,
    capitalGains: 210000,
    cashEquivalents: 85000,
    totalAssets: 695000
  }
};

console.log('=== SINGLE SCENARIO DEBUG ===\n');
console.log('Initial Parameters:');
console.log(`- Retirement Age: ${params.retirementAge}`);
console.log(`- Life Expectancy: ${params.lifeExpectancy}`);
console.log(`- Years in Retirement: ${params.lifeExpectancy - params.retirementAge}`);
console.log(`- Current Assets: $${params.currentRetirementAssets.toLocaleString()}`);
console.log(`- Annual Savings: $${params.annualSavings.toLocaleString()}`);
console.log(`- Years to Save: ${params.retirementAge - params.currentAge}`);

// Calculate projected portfolio
let projectedPortfolio = params.currentRetirementAssets;
for (let i = 0; i < params.retirementAge - params.currentAge; i++) {
  projectedPortfolio += params.annualSavings;
  projectedPortfolio *= 1.07; // Average return
}
console.log(`- Projected Portfolio at 75: $${Math.round(projectedPortfolio).toLocaleString()}`);

console.log('\nRetirement Cash Flow:');
console.log(`- Annual Expenses: $${params.annualRetirementExpenses.toLocaleString()}`);
console.log(`- Healthcare Costs: $${params.annualHealthcareCosts.toLocaleString()}`);
console.log(`- Total Annual Need: $${(params.annualRetirementExpenses).toLocaleString()}`);
console.log(`- Guaranteed Income: $${params.annualGuaranteedIncome.toLocaleString()}`);
console.log(`- Annual Surplus: $${(params.annualGuaranteedIncome - params.annualRetirementExpenses).toLocaleString()}`);

// Run one scenario
console.log('\n=== RUNNING SINGLE SCENARIO ===');
const result = runEnhancedRetirementScenario(params);

console.log(`\nScenario Result:`);
console.log(`- Success: ${result.success}`);
console.log(`- Ending Balance: $${Math.round(result.endingBalance).toLocaleString()}`);
console.log(`- Years Until Depletion: ${result.yearsUntilDepletion || 'Never'}`);

// Check first few years
console.log('\nFirst 5 Years of Retirement:');
const retirementStartIdx = params.retirementAge - params.currentAge;
for (let i = 0; i < 5 && i + retirementStartIdx < result.yearlyCashFlows.length; i++) {
  const year = result.yearlyCashFlows[retirementStartIdx + i];
  if (year) {
    console.log(`Year ${i + 1} (Age ${params.retirementAge + i}):`);
    console.log(`  Balance: $${Math.round(year.portfolioBalance).toLocaleString()}`);
    console.log(`  Withdrawal: $${Math.round(year.withdrawal).toLocaleString()}`);
    console.log(`  Return: ${(year.investmentReturn * 100).toFixed(1)}%`);
  }
}

console.log('\n=== DIAGNOSIS ===');
if (params.annualGuaranteedIncome > params.annualRetirementExpenses) {
  console.log('✅ Guaranteed income exceeds expenses');
  console.log('❌ But something is causing portfolio depletion');
  console.log('🔍 Check if healthcare costs are being double-counted');
  console.log('🔍 Check if there\'s a bug in withdrawal logic when income > expenses');
}