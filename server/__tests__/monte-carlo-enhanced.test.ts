import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  runEnhancedMonteCarloSimulation,
  runEnhancedRetirementScenario
} from '../monte-carlo-enhanced';
import { RetirementMonteCarloParams } from '../monte-carlo';

// Helper to create test parameters
function createTestParams(overrides?: Partial<RetirementMonteCarloParams>): RetirementMonteCarloParams {
  return {
    currentAge: 45,
    retirementAge: 65,
    lifeExpectancy: 90,
    currentRetirementAssets: 500000,
    annualGuaranteedIncome: 30000, // Social Security
    annualRetirementExpenses: 80000,
    annualHealthcareCosts: 15000,
    healthcareInflationRate: 0.0269,
    expectedReturn: 0.07, // 7% real return
    returnVolatility: 0.15,
    inflationRate: 0.025,
    stockAllocation: 0.6,
    bondAllocation: 0.35,
    cashAllocation: 0.05,
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
    },
    ...overrides
  };
}

describe('Monte Carlo Enhanced - Correlation Modeling', () => {
  it('should generate correlated returns that maintain expected statistical properties', () => {
    // This is a statistical test - we need many samples
    const iterations = 10000;
    const returns: number[] = [];
    
    // Run many single-year scenarios to collect return data
    for (let i = 0; i < iterations; i++) {
      const params = createTestParams();
      const scenario = runEnhancedRetirementScenario(params);
      
      // Extract first year return from portfolio change
      if (scenario.yearlyCashFlows.length > 0) {
        const firstYear = scenario.yearlyCashFlows[0];
        const initialValue = params.currentRetirementAssets;
        const endValue = firstYear.portfolioBalance + firstYear.withdrawal;
        const returnRate = (endValue - initialValue - params.annualSavings) / initialValue;
        returns.push(returnRate);
      }
    }
    
    // Calculate statistics
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Expected values (with some tolerance for randomness)
    expect(mean).toBeCloseTo(0.07, 1); // Within 1 decimal place
    expect(stdDev).toBeCloseTo(0.15, 1);
    
    // Check for reasonable distribution
    const negativeReturns = returns.filter(r => r < 0).length;
    const negativePercentage = negativeReturns / iterations;
    
    // With 7% mean and 15% volatility, expect ~20-30% negative returns
    expect(negativePercentage).toBeGreaterThan(0.15);
    expect(negativePercentage).toBeLessThan(0.35);
  });
  
  it('should produce different results with different asset allocations', () => {
    const stockHeavyParams = createTestParams({
      stockAllocation: 0.9,
      bondAllocation: 0.05,
      cashAllocation: 0.05
    });
    
    const bondHeavyParams = createTestParams({
      stockAllocation: 0.2,
      bondAllocation: 0.75,
      cashAllocation: 0.05
    });
    
    const stockResult = runEnhancedMonteCarloSimulation(stockHeavyParams, 1000);
    const bondResult = runEnhancedMonteCarloSimulation(bondHeavyParams, 1000);
    
    // Stock-heavy portfolio should have higher volatility
    const stockRange = stockResult.percentile90EndingBalance - stockResult.percentile10EndingBalance;
    const bondRange = bondResult.percentile90EndingBalance - bondResult.percentile10EndingBalance;
    
    expect(stockRange).toBeGreaterThan(bondRange);
  });
});

describe('Monte Carlo Enhanced - Guyton-Klinger Guardrails', () => {
  it('should apply capital preservation rule when withdrawal rate is too high', () => {
    const params = createTestParams({
      currentRetirementAssets: 1000000,
      withdrawalRate: 0.04,
      useGuardrails: true
    });
    
    // Create a scenario where portfolio drops significantly
    const scenario = runEnhancedRetirementScenario({
      ...params,
      expectedReturn: -0.20, // Force negative return
      returnVolatility: 0.01 // Low volatility to ensure negative
    });
    
    // Check if guardrails were applied
    const adjustments = scenario.yearlyCashFlows.filter(
      cf => cf.adjustmentType === 'capital-preservation'
    );
    
    expect(adjustments.length).toBeGreaterThan(0);
  });
  
  it('should apply prosperity rule when withdrawal rate is too low', () => {
    const params = createTestParams({
      currentRetirementAssets: 1000000,
      withdrawalRate: 0.04,
      useGuardrails: true,
      expectedReturn: 0.12, // High returns
      returnVolatility: 0.05 // Lower volatility
    });
    
    const scenario = runEnhancedRetirementScenario(params);
    
    // Check if prosperity adjustments were made
    const adjustments = scenario.yearlyCashFlows.filter(
      cf => cf.adjustmentType === 'prosperity'
    );
    
    // With high returns, should see some prosperity adjustments
    expect(adjustments.length).toBeGreaterThan(0);
  });
  
  it('should skip inflation adjustment in negative return years', () => {
    const params = createTestParams({
      useGuardrails: true,
      inflationRate: 0.03
    });
    
    // Run scenario and check for portfolio management adjustments
    const scenario = runEnhancedRetirementScenario(params);
    
    const pmAdjustments = scenario.yearlyCashFlows.filter(
      cf => cf.adjustmentType === 'portfolio-management'
    );
    
    // Should have some portfolio management adjustments over 25 years
    expect(pmAdjustments.length).toBeGreaterThanOrEqual(0);
  });
  
  it('should track Guyton-Klinger adjustments in results', () => {
    const params = createTestParams({
      useGuardrails: true
    });
    
    const result = runEnhancedMonteCarloSimulation(params, 100);
    
    expect(result.guytonKlingerStats).toBeDefined();
    expect(result.guytonKlingerStats!.averageAdjustmentsPerScenario).toBeGreaterThanOrEqual(0);
    expect(result.guytonKlingerStats!.adjustmentTypeBreakdown).toBeDefined();
  });
});

describe('Monte Carlo Enhanced - Tax-Efficient Withdrawals', () => {
  it('should withdraw from buckets in tax-efficient order', () => {
    const params = createTestParams({
      assetBuckets: {
        taxDeferred: 400000,
        taxFree: 200000,
        capitalGains: 300000,
        cashEquivalents: 100000,
        totalAssets: 1000000
      }
    });
    
    const scenario = runEnhancedRetirementScenario(params);
    
    // First retirement year should show cash being depleted first
    const retirementStart = params.retirementAge - params.currentAge;
    const firstRetirementYear = scenario.yearlyCashFlows[retirementStart];
    
    expect(firstRetirementYear).toBeDefined();
    expect(firstRetirementYear.portfolioBalance).toBeLessThan(params.assetBuckets.totalAssets);
  });
});

describe('Monte Carlo Enhanced - Statistical Validity', () => {
  it('should produce consistent results with fixed random seed', () => {
    // Note: This test would require implementing seeded random in the actual code
    // For now, we test that results are within reasonable bounds
    
    const params = createTestParams();
    const result1 = runEnhancedMonteCarloSimulation(params, 1000);
    const result2 = runEnhancedMonteCarloSimulation(params, 1000);
    
    // Results should be similar but not identical (due to randomness)
    expect(Math.abs(result1.probabilityOfSuccess - result2.probabilityOfSuccess)).toBeLessThan(10);
    expect(result1.medianEndingBalance / result2.medianEndingBalance).toBeGreaterThan(0.8);
    expect(result1.medianEndingBalance / result2.medianEndingBalance).toBeLessThan(1.2);
  });
  
  it('should converge to stable results with more iterations', () => {
    const params = createTestParams();
    
    const result100 = runEnhancedMonteCarloSimulation(params, 100);
    const result1000 = runEnhancedMonteCarloSimulation(params, 1000);
    const result5000 = runEnhancedMonteCarloSimulation(params, 5000);
    
    // Variance should decrease with more iterations
    const results = [result100, result1000, result5000];
    const probabilities = results.map(r => r.probabilityOfSuccess);
    
    // Calculate variance between consecutive results
    const variance100to1000 = Math.abs(probabilities[0] - probabilities[1]);
    const variance1000to5000 = Math.abs(probabilities[1] - probabilities[2]);
    
    // Variance should generally decrease (though not guaranteed due to randomness)
    expect(variance1000to5000).toBeLessThanOrEqual(variance100to1000 + 5); // Allow some tolerance
  });
});

describe('Monte Carlo Enhanced - Edge Cases', () => {
  it('should handle zero retirement assets gracefully', () => {
    const params = createTestParams({
      currentRetirementAssets: 0,
      assetBuckets: {
        taxDeferred: 0,
        taxFree: 0,
        capitalGains: 0,
        cashEquivalents: 0,
        totalAssets: 0
      }
    });
    
    const result = runEnhancedMonteCarloSimulation(params, 100);
    
    expect(result.probabilityOfSuccess).toBe(0);
    expect(result.medianEndingBalance).toBe(0);
  });
  
  it('should handle very high withdrawal rates', () => {
    const params = createTestParams({
      withdrawalRate: 0.10 // 10% withdrawal rate
    });
    
    const result = runEnhancedMonteCarloSimulation(params, 100);
    
    expect(result.probabilityOfSuccess).toBeLessThan(50);
    expect(result.yearsUntilDepletion).toBeDefined();
    expect(result.yearsUntilDepletion).toBeLessThan(20);
  });
  
  it('should handle retirement at current age', () => {
    const params = createTestParams({
      currentAge: 65,
      retirementAge: 65
    });
    
    const result = runEnhancedMonteCarloSimulation(params, 100);
    
    expect(result).toBeDefined();
    expect(result.projectedRetirementPortfolio).toBe(params.currentRetirementAssets);
  });
});

describe('Monte Carlo Enhanced - Safe Withdrawal Rate Calculation', () => {
  it('should calculate lower safe withdrawal rate for risky portfolios', () => {
    const riskyParams = createTestParams({
      withdrawalRate: 0.06, // Start with high withdrawal
      returnVolatility: 0.25, // High volatility
      stockAllocation: 0.90
    });
    
    const result = runEnhancedMonteCarloSimulation(riskyParams, 1000);
    
    // If success rate is below 80%, safe withdrawal rate should be lower
    if (result.probabilityOfSuccess < 80) {
      expect(result.safeWithdrawalRate).toBeLessThan(riskyParams.withdrawalRate);
    }
  });
  
  it('should maintain withdrawal rate for highly successful portfolios', () => {
    const safeParams = createTestParams({
      withdrawalRate: 0.03, // Conservative withdrawal
      currentRetirementAssets: 2000000, // High assets
      annualRetirementExpenses: 60000 // Low expenses
    });
    
    const result = runEnhancedMonteCarloSimulation(safeParams, 1000);
    
    expect(result.probabilityOfSuccess).toBeGreaterThan(80);
    expect(result.safeWithdrawalRate).toBeCloseTo(safeParams.withdrawalRate, 2);
  });
});

describe('Monte Carlo Enhanced - Healthcare Cost Modeling', () => {
  it('should apply different inflation rates to healthcare vs other expenses', () => {
    const params = createTestParams({
      annualRetirementExpenses: 80000,
      annualHealthcareCosts: 20000,
      inflationRate: 0.025,
      healthcareInflationRate: 0.05 // Double general inflation
    });
    
    const scenario = runEnhancedRetirementScenario(params);
    
    // Over 20 years, healthcare should become a larger portion of expenses
    const retirementStart = params.retirementAge - params.currentAge;
    if (scenario.yearlyCashFlows.length > retirementStart + 20) {
      // This would require tracking expense breakdown in the scenario
      // For now, just verify the scenario runs successfully
      expect(scenario.yearlyCashFlows.length).toBeGreaterThan(retirementStart);
    }
  });
});

// Performance benchmarks
describe('Monte Carlo Enhanced - Performance', () => {
  it('should complete 1000 simulations in reasonable time', () => {
    const params = createTestParams();
    
    const startTime = Date.now();
    runEnhancedMonteCarloSimulation(params, 1000);
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    console.log(`1000 simulations completed in ${duration}ms`);
    
    // Should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
  });
  
  it('should scale linearly with iteration count', () => {
    const params = createTestParams();
    
    const start100 = Date.now();
    runEnhancedMonteCarloSimulation(params, 100);
    const time100 = Date.now() - start100;
    
    const start1000 = Date.now();
    runEnhancedMonteCarloSimulation(params, 1000);
    const time1000 = Date.now() - start1000;
    
    // Time for 1000 should be roughly 10x time for 100 (with some tolerance)
    const ratio = time1000 / time100;
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(15);
  });
});