/**
 * Test Advanced Risk Metrics Implementation
 * Validates CVaR, drawdown metrics, utility-based success, and path-dependent analytics
 */

import {
  runEnhancedMonteCarloSimulation,
  calculateCVaR,
  calculateDrawdownMetrics,
  calculateUtilityAdjustedSuccess,
  identifyDangerZones,
  calculateSequenceRiskScore,
  calculateRetirementFlexibility,
  DEFAULT_RETURN_CONFIG,
  DEFAULT_VARIANCE_REDUCTION
} from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

console.log('=== Advanced Risk Metrics Test ===\n');

// Test profiles covering different risk scenarios
const testProfiles: Array<{ name: string, params: RetirementMonteCarloParams }> = [
  {
    name: 'Conservative Retiree',
    params: {
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 90,
      currentRetirementAssets: 1500000,
      annualSavings: 0,
      annualRetirementExpenses: 60000,
      annualGuaranteedIncome: 30000,
      expectedReturn: 0.05,
      returnVolatility: 0.08,
      inflationRate: 0.025,
      withdrawalRate: 0.03,
      stockAllocation: 0.30,
      bondAllocation: 0.60,
      cashAllocation: 0.10,
      taxRate: 0.15,
      filingStatus: 'married_filing_jointly' as const,
      useGuardrails: true,
      assetBuckets: {
        taxDeferred: 1000000,
        taxFree: 300000,
        capitalGains: 200000,
        cashEquivalents: 0,
        totalAssets: 1500000
      }
    }
  },
  {
    name: 'Aggressive Early Retiree',
    params: {
      currentAge: 50,
      retirementAge: 50,
      lifeExpectancy: 95,
      currentRetirementAssets: 2000000,
      annualSavings: 0,
      annualRetirementExpenses: 80000,
      annualGuaranteedIncome: 0,
      expectedReturn: 0.08,
      returnVolatility: 0.20,
      inflationRate: 0.03,
      withdrawalRate: 0.04,
      stockAllocation: 0.80,
      bondAllocation: 0.15,
      cashAllocation: 0.05,
      taxRate: 0.24,
      filingStatus: 'single' as const,
      useGuardrails: true,
      assetBuckets: {
        taxDeferred: 800000,
        taxFree: 600000,
        capitalGains: 600000,
        cashEquivalents: 0,
        totalAssets: 2000000
      }
    }
  },
  {
    name: 'Borderline Case',
    params: {
      currentAge: 60,
      retirementAge: 67,
      lifeExpectancy: 85,
      currentRetirementAssets: 500000,
      annualSavings: 15000,
      annualRetirementExpenses: 50000,
      annualGuaranteedIncome: 20000,
      expectedReturn: 0.06,
      returnVolatility: 0.12,
      inflationRate: 0.025,
      withdrawalRate: 0.045,
      stockAllocation: 0.50,
      bondAllocation: 0.40,
      cashAllocation: 0.10,
      taxRate: 0.12,
      filingStatus: 'married_filing_jointly' as const,
      useGuardrails: false,
      assetBuckets: {
        taxDeferred: 300000,
        taxFree: 100000,
        capitalGains: 100000,
        cashEquivalents: 0,
        totalAssets: 500000
      }
    }
  }
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

// Run tests for each profile
for (const profile of testProfiles) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${profile.name}`);
  console.log(`${'='.repeat(70)}`);
  
  console.log('\nProfile Summary:');
  console.log(`  Age: ${profile.params.currentAge} → ${profile.params.retirementAge} → ${profile.params.lifeExpectancy}`);
  console.log(`  Assets: ${formatCurrency(profile.params.currentRetirementAssets || 0)}`);
  console.log(`  Annual Expenses: ${formatCurrency(profile.params.annualRetirementExpenses || 0)}`);
  console.log(`  Expected Return: ${formatPercent(profile.params.expectedReturn || 0)}`);
  console.log(`  Volatility: ${formatPercent(profile.params.returnVolatility || 0)}`);
  console.log(`  Stock/Bond/Cash: ${(profile.params.stockAllocation || 0) * 100}%/${(profile.params.bondAllocation || 0) * 100}%/${(profile.params.cashAllocation || 0) * 100}%`);
  
  // Run simulation
  const startTime = Date.now();
  const result = runEnhancedMonteCarloSimulation(
    profile.params,
    500, // Fewer iterations for testing
    false,
    DEFAULT_RETURN_CONFIG,
    DEFAULT_VARIANCE_REDUCTION
  );
  const elapsed = Date.now() - startTime;
  
  console.log(`\nSimulation completed in ${elapsed}ms`);
  
  // Display standard metrics
  console.log('\n📊 Standard Metrics:');
  console.log(`  Success Rate: ${formatPercent(result.successProbability)}`);
  console.log(`  Median Ending Balance: ${formatCurrency(result.medianEndingBalance)}`);
  console.log(`  10th Percentile: ${formatCurrency(result.percentile10EndingBalance)}`);
  console.log(`  90th Percentile: ${formatCurrency(result.percentile90EndingBalance)}`);
  
  // Display advanced risk metrics if available
  if (result.advancedRiskMetrics) {
    const metrics = result.advancedRiskMetrics;
    
    console.log('\n⚠️ Tail Risk Metrics:');
    console.log(`  CVaR 95% (Expected Shortfall): ${formatCurrency(metrics.cvar95)}`);
    console.log(`  CVaR 99% (Extreme Tail Risk): ${formatCurrency(metrics.cvar99)}`);
    console.log(`  Max Drawdown: ${formatPercent(metrics.maxDrawdown)}`);
    console.log(`  Ulcer Index: ${metrics.ulcerIndex.toFixed(2)}`);
    
    console.log('\n✅ Success Variations:');
    console.log(`  Standard Success: ${formatPercent(metrics.successVariants.standard)}`);
    console.log(`  Utility-Adjusted: ${formatPercent(metrics.successVariants.utilityAdjusted)}`);
    console.log(`  With Inflation Adj: ${formatPercent(metrics.successVariants.withInflationAdjustment)}`);
    console.log(`  With Health Costs: ${formatPercent(metrics.successVariants.withHealthCosts)}`);
    
    console.log('\n🎯 Path-Dependent Analytics:');
    console.log(`  Sequence Risk Score: ${metrics.sequenceRiskScore.toFixed(2)}`);
    console.log(`  Danger Zones: ${metrics.dangerZones.map(z => `Age ${z.age} (${formatPercent(z.riskLevel)})`).join(', ') || 'None identified'}`);
    
    if (metrics.retirementFlexibility) {
      console.log('\n🔄 Retirement Flexibility:');
      console.log(`  Optimal Retirement Age: ${metrics.retirementFlexibility.optimalAge}`);
      console.log(`  Success Range: ${metrics.retirementFlexibility.successRange.join(' - ')}`);
      console.log(`  Flexibility Score: ${metrics.retirementFlexibility.flexibilityScore.toFixed(2)}`);
    }
  } else {
    console.log('\n⚠️ Advanced risk metrics not available in results');
  }
  
  // Analyze risk characteristics
  console.log('\n📈 Risk Characterization:');
  
  // Tail risk assessment
  if (result.advancedRiskMetrics) {
    const tailRatio = result.advancedRiskMetrics.cvar95 / result.medianEndingBalance;
    if (tailRatio < -0.5) {
      console.log('  Tail Risk: HIGH - Significant downside in worst 5% of scenarios');
    } else if (tailRatio < 0) {
      console.log('  Tail Risk: MODERATE - Some downside risk present');
    } else {
      console.log('  Tail Risk: LOW - Even tail scenarios remain positive');
    }
    
    // Drawdown risk assessment
    if (result.advancedRiskMetrics.maxDrawdown > 0.4) {
      console.log('  Drawdown Risk: HIGH - Portfolio may experience severe declines');
    } else if (result.advancedRiskMetrics.maxDrawdown > 0.2) {
      console.log('  Drawdown Risk: MODERATE - Expect meaningful volatility');
    } else {
      console.log('  Drawdown Risk: LOW - Portfolio relatively stable');
    }
    
    // Sequence risk assessment
    if (result.advancedRiskMetrics.sequenceRiskScore > 0.7) {
      console.log('  Sequence Risk: HIGH - Early returns critically important');
    } else if (result.advancedRiskMetrics.sequenceRiskScore > 0.4) {
      console.log('  Sequence Risk: MODERATE - Some timing sensitivity');
    } else {
      console.log('  Sequence Risk: LOW - Robust to return timing');
    }
  }
}

// Comparative analysis
console.log('\n' + '='.repeat(70));
console.log('\n### COMPARATIVE RISK ANALYSIS ###\n');

console.log('Profile Comparison Matrix:');
console.log('-'.repeat(100));
console.log('Profile'.padEnd(25) + 
           'Success%'.padEnd(12) + 
           'CVaR 95%'.padEnd(15) + 
           'Max DD'.padEnd(12) + 
           'Ulcer'.padEnd(10) + 
           'Seq Risk'.padEnd(12) + 
           'Flexibility');
console.log('-'.repeat(100));

// Re-run simulations for comparison (cached results would be better in production)
for (const profile of testProfiles) {
  const result = runEnhancedMonteCarloSimulation(
    profile.params,
    200, // Even fewer for comparison table
    false,
    DEFAULT_RETURN_CONFIG,
    DEFAULT_VARIANCE_REDUCTION
  );
  
  if (result.advancedRiskMetrics) {
    const metrics = result.advancedRiskMetrics;
    console.log(
      profile.name.padEnd(25) +
      formatPercent(result.successProbability).padEnd(12) +
      formatCurrency(metrics.cvar95).padEnd(15) +
      formatPercent(metrics.maxDrawdown).padEnd(12) +
      metrics.ulcerIndex.toFixed(1).padEnd(10) +
      metrics.sequenceRiskScore.toFixed(2).padEnd(12) +
      (metrics.retirementFlexibility?.flexibilityScore.toFixed(1) || 'N/A')
    );
  }
}

console.log('\n### KEY INSIGHTS ###\n');
console.log('1. CVaR (Conditional Value at Risk) measures expected loss in worst 5% of scenarios');
console.log('2. Ulcer Index penalizes both depth and duration of drawdowns');
console.log('3. Sequence Risk Score indicates sensitivity to early retirement returns');
console.log('4. Utility-adjusted success accounts for diminishing marginal utility of wealth');
console.log('5. Flexibility Score shows ability to adjust retirement timing');

console.log('\n=== Test Complete ===');