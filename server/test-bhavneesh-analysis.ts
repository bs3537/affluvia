// Analyze why Bhavneesh and Manisha have only 54% success rate
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { RetirementMonteCarloParams } from './monte-carlo.js';

const coupleParams: RetirementMonteCarloParams = {
  currentAge: 51,
  spouseAge: 51, // Assuming similar age
  retirementAge: 75,
  lifeExpectancy: 90,
  currentRetirementAssets: 695000,
  annualGuaranteedIncome: 160249,  // Exceeds expenses!
  annualRetirementExpenses: 125983,
  annualHealthcareCosts: 29983,
  healthcareInflationRate: 0.025,
  expectedReturn: 0.07,  // 100% stocks
  returnVolatility: 0.20, // High volatility for 100% stocks
  inflationRate: 0.03,
  stockAllocation: 1.0,   // 100% stocks!
  bondAllocation: 0,
  cashAllocation: 0,
  withdrawalRate: 0.04,
  useGuardrails: false,
  taxRate: 0.114,
  annualSavings: 30996,
  legacyGoal: 100000,    // The potential issue
  hasLongTermCareInsurance: false,
  assetBuckets: {
    taxDeferred: 400000,
    taxFree: 0,
    capitalGains: 210000,
    cashEquivalents: 85000,
    totalAssets: 695000
  }
};

console.log('=== BHAVNEESH & MANISHA ANALYSIS ===\n');

// Test 1: With current parameters
console.log('Test 1: Current Parameters (100% stocks, $100k legacy)');
const result1 = runEnhancedMonteCarloSimulation(coupleParams, 1000);
console.log(`Success Rate: ${result1.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(result1.medianEndingBalance).toLocaleString()}`);

// Test 2: Without legacy goal
console.log('\nTest 2: No Legacy Goal');
const noLegacyParams = { ...coupleParams, legacyGoal: 0 };
const result2 = runEnhancedMonteCarloSimulation(noLegacyParams, 1000);
console.log(`Success Rate: ${result2.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(result2.medianEndingBalance).toLocaleString()}`);

// Test 3: Balanced allocation (60/35/5)
console.log('\nTest 3: Balanced Allocation (60% stocks, 35% bonds, 5% cash)');
const balancedParams = { 
  ...coupleParams, 
  stockAllocation: 0.60,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  expectedReturn: 0.055,
  returnVolatility: 0.12
};
const result3 = runEnhancedMonteCarloSimulation(balancedParams, 1000);
console.log(`Success Rate: ${result3.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(result3.medianEndingBalance).toLocaleString()}`);

// Test 4: Conservative allocation for retirees
console.log('\nTest 4: Conservative Allocation (40% stocks, 50% bonds, 10% cash)');
const conservativeParams = { 
  ...coupleParams, 
  stockAllocation: 0.40,
  bondAllocation: 0.50,
  cashAllocation: 0.10,
  expectedReturn: 0.045,
  returnVolatility: 0.08
};
const result4 = runEnhancedMonteCarloSimulation(conservativeParams, 1000);
console.log(`Success Rate: ${result4.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(result4.medianEndingBalance).toLocaleString()}`);

console.log('\n=== ANALYSIS ===');
console.log('The low success rate is likely due to:');
console.log('1. 100% stock allocation at age 75 (extremely risky!)');
console.log('2. High volatility causing portfolio depletion in bad scenarios');
console.log('3. Legacy goal requirement ($100k must remain)');
console.log('4. Even though income > expenses, portfolio can crash in market downturns');
console.log('\nRECOMMENDATIONS:');
console.log('1. Reduce stock allocation to 40-60% at retirement age');
console.log('2. Add bonds for stability');
console.log('3. Consider removing/reducing legacy goal');
console.log('4. Their guaranteed income exceeds expenses - they\'re actually in great shape!');