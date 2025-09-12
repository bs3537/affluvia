// Test file to verify dynamic withdrawal implementation
import { runRetirementMonteCarloSimulation } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

console.log('=== TESTING DYNAMIC WITHDRAWAL IMPLEMENTATION ===\n');

// Base profile for testing
const baseProfile = {
  dateOfBirth: '1960-01-01', // 64 years old
  retirementAge: 65,
  currentAge: 64,
  lifeExpectancy: 90,
  
  // Financial data
  currentRetirementAssets: 1500000,
  annualRetirementExpenses: 100000, // $8.3k/month total expenses
  annualHealthcareCosts: 15000,
  
  // Income sources
  socialSecurityBenefit: 2500,
  socialSecurityClaimAge: 67,
  pensionBenefit: 0,
  
  // Asset allocation
  currentAllocation: {
    usStocks: 60,
    intlStocks: 10,
    bonds: 25,
    cash: 5,
    alternatives: 0
  },
  
  expectedInflationRate: 3,
  expectedRealReturn: 0.07,
  withdrawalRate: 0.04,
  
  // Asset buckets
  assetBuckets: {
    taxDeferred: 900000,
    taxFree: 300000,
    capitalGains: 225000,
    cashEquivalents: 75000,
    totalAssets: 1500000
  },
  
  annualSavings: 50000,
  retirementState: 'TX'
};

// Test 1: With dynamic withdrawals enabled (default)
console.log('Test 1: Dynamic Withdrawals ENABLED');
console.log('Profile: $100k annual expenses ($85k non-healthcare)');
console.log('Default split: 75% essential ($63.75k), 25% discretionary ($21.25k min $24k => $24k)');

const dynamicResults = runRetirementMonteCarloSimulation(
  {
    ...baseProfile,
    currentRetirementAssets: baseProfile.currentRetirementAssets,
    annualGuaranteedIncome: baseProfile.socialSecurityBenefit * 12,
    stockAllocation: 0.7,
    bondAllocation: 0.25,
    cashAllocation: 0.05,
    inflationRate: 0.03,
    expectedReturn: 0.07,
    returnVolatility: 0.15,
    taxRate: 0.15,
    legacyGoal: 0,
    useGuardrails: false,
    enableDynamicWithdrawals: true, // Explicitly enable
    discretionaryExpenseRatio: 0.25,
    minDiscretionaryExpenses: 24000 // $2k/month minimum
  },
  500 // Run 500 simulations
);

console.log(`\nSuccess Rate: ${dynamicResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${dynamicResults.medianEndingBalance.toFixed(0)}`);

// Test 2: Without dynamic withdrawals (fixed expenses)
console.log('\n\nTest 2: Dynamic Withdrawals DISABLED (Fixed Expenses)');
console.log('Profile: Same $100k annual expenses, but no adjustments');

const fixedResults = runRetirementMonteCarloSimulation(
  {
    ...baseProfile,
    currentRetirementAssets: baseProfile.currentRetirementAssets,
    annualGuaranteedIncome: baseProfile.socialSecurityBenefit * 12,
    stockAllocation: 0.7,
    bondAllocation: 0.25,
    cashAllocation: 0.05,
    inflationRate: 0.03,
    expectedReturn: 0.07,
    returnVolatility: 0.15,
    taxRate: 0.15,
    legacyGoal: 0,
    useGuardrails: false,
    enableDynamicWithdrawals: false // Disable dynamic adjustments
  },
  500 // Run 500 simulations
);

console.log(`\nSuccess Rate: ${fixedResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${fixedResults.medianEndingBalance.toFixed(0)}`);

// Compare results
console.log('\n\n=== COMPARISON ===');
const successImprovement = dynamicResults.probabilityOfSuccess - fixedResults.probabilityOfSuccess;
const medianImprovement = dynamicResults.medianEndingBalance - fixedResults.medianEndingBalance;

console.log(`Success Rate Improvement: ${successImprovement > 0 ? '+' : ''}${successImprovement.toFixed(1)}%`);
console.log(`Median Balance Improvement: ${medianImprovement > 0 ? '+$' : '-$'}${Math.abs(medianImprovement).toFixed(0)}`);

if (successImprovement > 5) {
  console.log('\n✅ Dynamic withdrawals are significantly improving outcomes!');
  console.log('   Retirees who adjust discretionary spending in down markets');
  console.log('   have meaningfully better retirement success rates.');
} else if (successImprovement > 0) {
  console.log('\n✅ Dynamic withdrawals show modest improvement.');
  console.log('   The benefit exists but may be limited by:');
  console.log('   - Strong guaranteed income reducing withdrawal needs');
  console.log('   - Conservative base withdrawal rate');
  console.log('   - Limited discretionary portion of expenses');
} else {
  console.log('\n⚠️ Dynamic withdrawals show minimal impact.');
  console.log('   This could indicate issues with implementation or parameters.');
}

// Test 3: Test with higher discretionary ratio
console.log('\n\nTest 3: Higher Discretionary Ratio (40% discretionary)');

const highDiscretionaryResults = runRetirementMonteCarloSimulation(
  {
    ...baseProfile,
    currentRetirementAssets: baseProfile.currentRetirementAssets,
    annualGuaranteedIncome: baseProfile.socialSecurityBenefit * 12,
    stockAllocation: 0.7,
    bondAllocation: 0.25,
    cashAllocation: 0.05,
    inflationRate: 0.03,
    expectedReturn: 0.07,
    returnVolatility: 0.15,
    taxRate: 0.15,
    legacyGoal: 0,
    useGuardrails: false,
    enableDynamicWithdrawals: true,
    discretionaryExpenseRatio: 0.40, // 40% discretionary
    minDiscretionaryExpenses: 24000
  },
  500
);

console.log(`Success Rate: ${highDiscretionaryResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`vs Fixed: ${(highDiscretionaryResults.probabilityOfSuccess - fixedResults.probabilityOfSuccess).toFixed(1)}% improvement`);

// Test 4: Test dashboard widget implementation
console.log('\n\nTest 4: Dashboard Widget (monte-carlo-enhanced.ts)');

const dashboardDynamicResults = runEnhancedMonteCarloSimulation(
  {
    ...baseProfile,
    currentRetirementAssets: baseProfile.currentRetirementAssets,
    annualGuaranteedIncome: baseProfile.socialSecurityBenefit * 12,
    stockAllocation: 0.7,
    bondAllocation: 0.25,
    cashAllocation: 0.05,
    inflationRate: 0.03,
    expectedReturn: 0.07,
    returnVolatility: 0.15,
    taxRate: 0.15,
    legacyGoal: 0,
    useGuardrails: false,
    discretionaryExpenseRatio: 0.25,
    minDiscretionaryExpenses: 24000
  },
  500
);

console.log(`Success Rate with Dynamic Withdrawals: ${dashboardDynamicResults.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${dashboardDynamicResults.medianEndingBalance.toFixed(0)}`);

// Analyze spending patterns in a sample scenario
console.log('\n\n=== SPENDING ADJUSTMENT PATTERNS ===');
const sampleCashFlows = dynamicResults.yearlyCashFlows.slice(0, 10);

console.log('First 10 Years of Retirement (Sample Scenario):');
console.log('Year | Age | Market Regime | Portfolio     | Withdrawal');
console.log('-----|-----|---------------|---------------|------------');

sampleCashFlows.forEach(cf => {
  const regime = (cf.marketRegime || 'normal').padEnd(13);
  const portfolio = `$${(cf.portfolioBalance / 1000).toFixed(0)}k`.padEnd(13);
  const withdrawal = `$${(cf.withdrawal / 1000).toFixed(0)}k`;
  console.log(`  ${cf.year.toString().padEnd(2)} |  ${cf.age} | ${regime} | ${portfolio} | ${withdrawal}`);
});

console.log('\n=== SUMMARY ===');
console.log('Dynamic Withdrawal Benefits:');
console.log(`1. Base Case (25% discretionary): ${successImprovement.toFixed(1)}% improvement`);
console.log(`2. High Discretionary (40%): ${(highDiscretionaryResults.probabilityOfSuccess - fixedResults.probabilityOfSuccess).toFixed(1)}% improvement`);
console.log('\nKey Insights:');
console.log('- Retirees who can identify and adjust discretionary spending have better outcomes');
console.log('- The benefit increases with higher discretionary ratios');
console.log('- Market regime awareness enables proactive spending adjustments');
console.log('- Essential expenses remain protected while preserving portfolio longevity');

console.log('\n=== TEST COMPLETE ===');