// Test User 1 with corrected parameters
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { RetirementMonteCarloParams } from './monte-carlo.js';

// Test with TODAY'S dollars (no pre-inflation)
const user1ParamsToday: RetirementMonteCarloParams = {
  currentAge: 28,
  retirementAge: 67,  // Changed from 65 to 67 per profile
  lifeExpectancy: 95,
  currentRetirementAssets: 40000,  // $25k retirement + $5k brokerage + $10k emergency
  annualGuaranteedIncome: 25000,   // Social Security
  annualRetirementExpenses: 55000,  // $45k base + $10k healthcare in TODAY's dollars
  annualHealthcareCosts: 10000,
  healthcareInflationRate: 0.025,
  expectedReturn: 0.07,
  returnVolatility: 0.18,
  inflationRate: 0.025,
  stockAllocation: 0.90,
  bondAllocation: 0.05,
  cashAllocation: 0.05,
  useGlidePath: false,
  withdrawalRate: 0.04,
  useGuardrails: false,
  taxRate: 0.22,
  annualSavings: 6200,
  legacyGoal: 0,
  hasLongTermCareInsurance: false,
  assetBuckets: {
    taxDeferred: 25000,
    taxFree: 0,
    capitalGains: 5000,
    cashEquivalents: 10000,
    totalAssets: 40000
  }
};

console.log('=== USER 1 TEST - TODAY\'S DOLLARS ===\n');
console.log('Testing with expenses in TODAY\'s dollars (simulation handles inflation):');
console.log('- Retirement expenses: $45,000/year');
console.log('- Healthcare costs: $10,000/year');
console.log('- Total: $55,000/year in today\'s dollars\n');

const resultToday = runEnhancedMonteCarloSimulation(user1ParamsToday, 1000);
console.log(`Success Rate: ${resultToday.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(resultToday.medianEndingBalance).toLocaleString()}`);

// Test with INFLATED dollars (pre-inflated by system)
const inflationFactor = Math.pow(1.025, 39); // 39 years from age 28 to 67
const user1ParamsInflated: RetirementMonteCarloParams = {
  ...user1ParamsToday,
  annualRetirementExpenses: 55000 * inflationFactor,  // Pre-inflated
  annualHealthcareCosts: 10000 * inflationFactor,      // Pre-inflated
};

console.log('\n=== USER 1 TEST - PRE-INFLATED DOLLARS ===\n');
console.log('Testing with expenses PRE-INFLATED to retirement year:');
console.log(`- Inflation factor over 39 years: ${inflationFactor.toFixed(2)}x`);
console.log(`- Retirement expenses: $${Math.round(45000 * inflationFactor).toLocaleString()}/year`);
console.log(`- Healthcare costs: $${Math.round(10000 * inflationFactor).toLocaleString()}/year`);
console.log(`- Total: $${Math.round(55000 * inflationFactor).toLocaleString()}/year in future dollars\n`);

const resultInflated = runEnhancedMonteCarloSimulation(user1ParamsInflated, 1000);
console.log(`Success Rate: ${resultInflated.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(resultInflated.medianEndingBalance).toLocaleString()}`);

console.log('\n=== ANALYSIS ===');
console.log('The discrepancy is likely due to:');
console.log('1. Double-inflation: System inflates expenses, then simulation inflates again');
console.log('2. Healthcare costs being added on top of base expenses');
console.log('3. Retirement age difference (65 vs 67)');
console.log('\nThe simulation should use TODAY\'s dollars and handle inflation internally.');