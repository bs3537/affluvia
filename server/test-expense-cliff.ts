// Test to investigate the cliff effect in retirement success probability
// When changing expenses from $6900 to $6700 per month

import { runRetirementMonteCarloSimulation } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { AssetBuckets } from './asset-tax-classifier';

// Bhavneesh Sharma's financial data
const bhavneeshData = {
  currentAge: 50,
  spouseAge: 50,
  retirementAge: 65,
  spouseRetirementAge: 65,
  lifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  
  // Assets
  currentAssets: 572000, // 401k + brokerage + cash
  annualSavings: 102000, // $8,500/month total
  
  // Social Security (claiming at retirement age 65)
  userSSBenefit: 1300, // Reduced benefit at 65
  spouseSSBenefit: 3033, // Reduced benefit at 65
  socialSecurityClaimAge: 65,
  spouseSocialSecurityClaimAge: 65,
  
  // State
  retirementState: 'FL',
  
  // Asset allocation
  stockAllocation: 0.65,
  bondAllocation: 0.30,
  cashAllocation: 0.05
};

// Create asset buckets
function createAssetBuckets(): AssetBuckets {
  return {
    taxDeferred: 400000, // 401k
    taxFree: 0,
    capitalGains: 90000, // Brokerage
    cashEquivalents: 82000, // Cash
    totalAssets: 572000
  };
}

// Test function to check different expense levels
async function testExpenseCliff() {
  console.log('=== TESTING EXPENSE CLIFF EFFECT ===\n');
  console.log('Testing retirement success probability at different expense levels');
  console.log('Bhavneesh Sharma profile: Age 50, retiring at 65');
  console.log('Assets: $572k, Savings: $102k/year');
  console.log('Social Security: $52k/year starting at 65\n');
  
  const assetBuckets = createAssetBuckets();
  const annualSSBenefit = (bhavneeshData.userSSBenefit + bhavneeshData.spouseSSBenefit) * 12;
  
  // Test range from $6500 to $7100 per month
  const monthlyExpenses = [6500, 6600, 6700, 6800, 6850, 6900, 6950, 7000, 7100];
  const results: any[] = [];
  
  console.log('Running simulations for different expense levels...\n');
  console.log('Monthly Expenses | Annual Expenses | Success Rate | Median Balance');
  console.log('-----------------|-----------------|--------------|---------------');
  
  for (const monthly of monthlyExpenses) {
    const annual = monthly * 12;
    
    const params = {
      currentAge: bhavneeshData.currentAge,
      spouseAge: bhavneeshData.spouseAge,
      retirementAge: bhavneeshData.retirementAge,
      spouseRetirementAge: bhavneeshData.spouseRetirementAge,
      lifeExpectancy: bhavneeshData.lifeExpectancy,
      spouseLifeExpectancy: bhavneeshData.spouseLifeExpectancy,
      
      socialSecurityBenefit: bhavneeshData.userSSBenefit,
      socialSecurityClaimAge: bhavneeshData.socialSecurityClaimAge,
      spouseSocialSecurityBenefit: bhavneeshData.spouseSSBenefit,
      spouseSocialSecurityClaimAge: bhavneeshData.spouseSocialSecurityClaimAge,
      
      currentRetirementAssets: bhavneeshData.currentAssets,
      annualGuaranteedIncome: 0, // SS starts at retirement
      
      annualRetirementExpenses: annual,
      annualHealthcareCosts: 15000,
      healthcareInflationRate: 0.05,
      
      expectedReturn: 0.07,
      returnVolatility: 0.15,
      inflationRate: 0.03,
      
      stockAllocation: bhavneeshData.stockAllocation,
      bondAllocation: bhavneeshData.bondAllocation,
      cashAllocation: bhavneeshData.cashAllocation,
      
      withdrawalRate: 0.04,
      useGuardrails: false, // Test without guardrails first
      
      taxRate: 0.22,
      retirementState: bhavneeshData.retirementState,
      
      annualSavings: bhavneeshData.annualSavings,
      legacyGoal: 0,
      
      partTimeIncomeRetirement: 0,
      spousePartTimeIncomeRetirement: 0,
      
      assetBuckets
    };
    
    // Run simulation
    const result = runRetirementMonteCarloSimulation(params, 500);
    
    results.push({
      monthly,
      annual,
      successRate: result.probabilityOfSuccess,
      medianBalance: result.medianEndingBalance
    });
    
    console.log(
      `$${monthly.toString().padEnd(15)} | ` +
      `$${annual.toLocaleString().padEnd(15)} | ` +
      `${result.probabilityOfSuccess.toFixed(1).padStart(11)}% | ` +
      `$${result.medianEndingBalance.toLocaleString().padStart(13)}`
    );
  }
  
  // Analyze the cliff
  console.log('\n=== CLIFF ANALYSIS ===\n');
  
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];
    const diff = curr.successRate - prev.successRate;
    
    if (Math.abs(diff) > 20) {
      console.log(`🚨 CLIFF DETECTED!`);
      console.log(`   From $${prev.monthly}/month to $${curr.monthly}/month`);
      console.log(`   Success rate change: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
      console.log(`   That's a ${Math.abs(diff).toFixed(1)}% change for just $${curr.monthly - prev.monthly}/month!\n`);
    }
  }
  
  // Now test with enhanced Monte Carlo
  console.log('\n=== TESTING WITH ENHANCED MONTE CARLO ===\n');
  console.log('Monthly Expenses | Success Rate | Difference from Standard');
  console.log('-----------------|--------------|------------------------');
  
  for (let i = 0; i < monthlyExpenses.length; i++) {
    const monthly = monthlyExpenses[i];
    const annual = monthly * 12;
    
    const params = {
      currentAge: bhavneeshData.currentAge,
      spouseAge: bhavneeshData.spouseAge,
      retirementAge: bhavneeshData.retirementAge,
      spouseRetirementAge: bhavneeshData.spouseRetirementAge,
      lifeExpectancy: bhavneeshData.lifeExpectancy,
      spouseLifeExpectancy: bhavneeshData.spouseLifeExpectancy,
      
      socialSecurityBenefit: bhavneeshData.userSSBenefit,
      socialSecurityClaimAge: bhavneeshData.socialSecurityClaimAge,
      spouseSocialSecurityBenefit: bhavneeshData.spouseSSBenefit,
      spouseSocialSecurityClaimAge: bhavneeshData.spouseSocialSecurityClaimAge,
      
      currentRetirementAssets: bhavneeshData.currentAssets,
      annualGuaranteedIncome: 0,
      
      annualRetirementExpenses: annual,
      annualHealthcareCosts: 15000,
      healthcareInflationRate: 0.05,
      
      expectedReturn: 0.07,
      returnVolatility: 0.15,
      inflationRate: 0.03,
      
      stockAllocation: bhavneeshData.stockAllocation,
      bondAllocation: bhavneeshData.bondAllocation,
      cashAllocation: bhavneeshData.cashAllocation,
      
      withdrawalRate: 0.04,
      useGuardrails: false,
      
      taxRate: 0.22,
      retirementState: bhavneeshData.retirementState,
      
      annualSavings: bhavneeshData.annualSavings,
      legacyGoal: 0,
      
      assetBuckets
    };
    
    const enhancedResult = runEnhancedMonteCarloSimulation(params, 500);
    const diff = enhancedResult.probabilityOfSuccess - results[i].successRate;
    
    console.log(
      `$${monthly.toString().padEnd(15)} | ` +
      `${enhancedResult.probabilityOfSuccess.toFixed(1).padStart(11)}% | ` +
      `${diff > 0 ? '+' : ''}${diff.toFixed(1).padStart(22)}%`
    );
  }
  
  // Test specific case: $6900 vs $6700
  console.log('\n=== DETAILED ANALYSIS: $6900 vs $6700 ===\n');
  
  const params6900 = {
    currentAge: bhavneeshData.currentAge,
    spouseAge: bhavneeshData.spouseAge,
    retirementAge: bhavneeshData.retirementAge,
    spouseRetirementAge: bhavneeshData.spouseRetirementAge,
    lifeExpectancy: bhavneeshData.lifeExpectancy,
    spouseLifeExpectancy: bhavneeshData.spouseLifeExpectancy,
    
    socialSecurityBenefit: bhavneeshData.userSSBenefit,
    socialSecurityClaimAge: bhavneeshData.socialSecurityClaimAge,
    spouseSocialSecurityBenefit: bhavneeshData.spouseSSBenefit,
    spouseSocialSecurityClaimAge: bhavneeshData.spouseSocialSecurityClaimAge,
    
    currentRetirementAssets: bhavneeshData.currentAssets,
    annualGuaranteedIncome: 0,
    
    annualRetirementExpenses: 6900 * 12,
    annualHealthcareCosts: 15000,
    healthcareInflationRate: 0.05,
    
    expectedReturn: 0.07,
    returnVolatility: 0.15,
    inflationRate: 0.03,
    
    stockAllocation: bhavneeshData.stockAllocation,
    bondAllocation: bhavneeshData.bondAllocation,
    cashAllocation: bhavneeshData.cashAllocation,
    
    withdrawalRate: 0.04,
    useGuardrails: true, // Test with guardrails as in optimization
    
    taxRate: 0.22,
    retirementState: bhavneeshData.retirementState,
    
    annualSavings: bhavneeshData.annualSavings,
    legacyGoal: 0,
    
    assetBuckets
  };
  
  const params6700 = { ...params6900, annualRetirementExpenses: 6700 * 12 };
  
  console.log('Testing with guardrails enabled (as in optimization tab):\n');
  
  const result6900 = runRetirementMonteCarloSimulation(params6900, 1000);
  const result6700 = runRetirementMonteCarloSimulation(params6700, 1000);
  
  console.log('$6,900/month ($82,800/year):');
  console.log(`  Success Rate: ${result6900.probabilityOfSuccess.toFixed(1)}%`);
  console.log(`  Median Ending Balance: $${result6900.medianEndingBalance.toLocaleString()}`);
  console.log(`  Safe Withdrawal Rate: ${(result6900.safeWithdrawalRate * 100).toFixed(2)}%`);
  
  console.log('\n$6,700/month ($80,400/year):');
  console.log(`  Success Rate: ${result6700.probabilityOfSuccess.toFixed(1)}%`);
  console.log(`  Median Ending Balance: $${result6700.medianEndingBalance.toLocaleString()}`);
  console.log(`  Safe Withdrawal Rate: ${(result6700.safeWithdrawalRate * 100).toFixed(2)}%`);
  
  console.log('\nDifference:');
  console.log(`  Success Rate Change: ${(result6700.probabilityOfSuccess - result6900.probabilityOfSuccess).toFixed(1)}%`);
  console.log(`  For only $200/month ($2,400/year) reduction`);
  
  // Check a sample of cash flows to understand what's happening
  if (result6900.yearlyCashFlows && result6700.yearlyCashFlows) {
    console.log('\n=== CASH FLOW COMPARISON (First 5 Years) ===\n');
    console.log('Year | Age | $6900 Portfolio | $6700 Portfolio | Difference');
    console.log('-----|-----|-----------------|-----------------|------------');
    
    for (let i = 0; i < Math.min(5, result6900.yearlyCashFlows.length); i++) {
      const cf6900 = result6900.yearlyCashFlows[i];
      const cf6700 = result6700.yearlyCashFlows[i];
      const diff = cf6700.portfolioBalance - cf6900.portfolioBalance;
      
      console.log(
        `${cf6900.year.toString().padStart(4)} | ` +
        `${cf6900.age.toString().padStart(3)} | ` +
        `$${(cf6900.portfolioBalance / 1000).toFixed(0).padStart(7)}k`.padEnd(15) + ' | ' +
        `$${(cf6700.portfolioBalance / 1000).toFixed(0).padStart(7)}k`.padEnd(15) + ' | ' +
        `$${(diff / 1000).toFixed(0).padStart(6)}k`
      );
    }
  }
  
  console.log('\n=== HYPOTHESIS ===\n');
  console.log('Possible causes for the cliff effect:');
  console.log('1. Guardrails algorithm has a threshold that triggers at this level');
  console.log('2. Tax bracket threshold being crossed');
  console.log('3. RMD calculations creating a feedback loop');
  console.log('4. Rounding or calculation error in the algorithm');
  console.log('5. Portfolio depletion timing crosses a critical year');
}

// Run the test
testExpenseCliff().catch(console.error);