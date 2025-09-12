// Simple test script to verify Monte Carlo implementation
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { runRetirementMonteCarloSimulation, profileToRetirementParams } from './monte-carlo.js';

console.log('🧪 Testing Monte Carlo Enhanced Implementation\n');

// Test parameters
const testParams = {
  currentAge: 45,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentRetirementAssets: 500000,
  annualGuaranteedIncome: 30000,
  annualRetirementExpenses: 80000,
  annualHealthcareCosts: 15000,
  healthcareInflationRate: 0.0269,
  expectedReturn: 0.07,
  returnVolatility: 0.15,
  inflationRate: 0.025,
  stockAllocation: 0.6,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  useGlidePath: false,
  withdrawalRate: 0.04,
  useGuardrails: true,
  taxRate: 0.22,
  annualSavings: 24000,
  legacyGoal: 100000,
  hasLongTermCareInsurance: false,
  assetBuckets: {
    taxDeferred: 300000,
    taxFree: 100000,
    capitalGains: 80000,
    cashEquivalents: 20000,
    totalAssets: 500000
  }
};

// Test 1: Basic functionality
console.log('Test 1: Basic Enhanced Monte Carlo Simulation');
console.log('===========================================');
const startTime = Date.now();
const result = runEnhancedMonteCarloSimulation(testParams, 1000);
const endTime = Date.now();

console.log(`✅ Simulation completed in ${endTime - startTime}ms`);
console.log(`📊 Success Rate: ${result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`💰 Median Ending Balance: $${result.medianEndingBalance.toLocaleString()}`);
console.log(`📉 Safe Withdrawal Rate: ${(result.safeWithdrawalRate * 100).toFixed(2)}%`);
console.log(`📈 Scenarios: ${result.scenarios.successful}/${result.scenarios.total} successful`);

if (result.guytonKlingerStats) {
  console.log(`\n🎯 Guyton-Klinger Statistics:`);
  console.log(`   Average adjustments: ${result.guytonKlingerStats.averageAdjustmentsPerScenario.toFixed(1)}`);
  console.log(`   Adjustment breakdown:`, result.guytonKlingerStats.adjustmentTypeBreakdown);
}

// Test 2: Compare with original implementation
console.log('\n\nTest 2: Comparison with Original Implementation');
console.log('==============================================');
const originalStart = Date.now();
const originalResult = runRetirementMonteCarloSimulation(testParams, 1000);
const originalEnd = Date.now();

console.log(`Original: ${originalEnd - originalStart}ms | Enhanced: ${endTime - startTime}ms`);
console.log(`Speed improvement: ${((originalEnd - originalStart) / (endTime - startTime)).toFixed(1)}x`);
console.log(`\nSuccess Rate Difference: ${Math.abs(result.probabilityOfSuccess - originalResult.probabilityOfSuccess).toFixed(1)}%`);

// Test 3: Correlation impact
console.log('\n\nTest 3: Asset Correlation Impact');
console.log('================================');
const stockHeavyParams = { ...testParams, stockAllocation: 0.9, bondAllocation: 0.05, cashAllocation: 0.05 };
const bondHeavyParams = { ...testParams, stockAllocation: 0.2, bondAllocation: 0.75, cashAllocation: 0.05 };

const stockResult = runEnhancedMonteCarloSimulation(stockHeavyParams, 500);
const bondResult = runEnhancedMonteCarloSimulation(bondHeavyParams, 500);

console.log(`Stock-heavy portfolio: ${stockResult.probabilityOfSuccess.toFixed(1)}% success`);
console.log(`Bond-heavy portfolio: ${bondResult.probabilityOfSuccess.toFixed(1)}% success`);
console.log(`Volatility difference: Stock range = $${(stockResult.percentile90EndingBalance - stockResult.percentile10EndingBalance).toLocaleString()}`);
console.log(`                      Bond range = $${(bondResult.percentile90EndingBalance - bondResult.percentile10EndingBalance).toLocaleString()}`);

// Test 4: Guardrails effectiveness
console.log('\n\nTest 4: Guyton-Klinger Guardrails Effectiveness');
console.log('===============================================');
const withGuardrails = runEnhancedMonteCarloSimulation({ ...testParams, useGuardrails: true }, 500);
const withoutGuardrails = runEnhancedMonteCarloSimulation({ ...testParams, useGuardrails: false }, 500);

console.log(`With Guardrails: ${withGuardrails.probabilityOfSuccess.toFixed(1)}% success`);
console.log(`Without Guardrails: ${withoutGuardrails.probabilityOfSuccess.toFixed(1)}% success`);
console.log(`Success improvement: ${(withGuardrails.probabilityOfSuccess - withoutGuardrails.probabilityOfSuccess).toFixed(1)}%`);

// Test 5: Performance scaling
console.log('\n\nTest 5: Performance Scaling');
console.log('===========================');
const iterations = [100, 1000, 5000];
for (const iter of iterations) {
  const start = Date.now();
  runEnhancedMonteCarloSimulation(testParams, iter);
  const duration = Date.now() - start;
  console.log(`${iter} iterations: ${duration}ms (${(duration/iter).toFixed(2)}ms per iteration)`);
}

console.log('\n✅ All tests completed successfully!');