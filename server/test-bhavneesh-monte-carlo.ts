// Test Monte Carlo simulation with Bhavneesh Sharma's data
// Compare original vs fixed implementation

import { runRetirementMonteCarloSimulation } from './monte-carlo-base';
import { runFixedMonteCarloSimulation } from './monte-carlo-deprecated';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { AssetBuckets } from './asset-tax-classifier';
import { calculateAIME, calculatePrimaryInsuranceAmount } from '../client/src/utils/socialSecurityOptimizer';

// Bhavneesh Sharma's financial data
const bhavneeshData = {
  // Personal info
  currentAge: 50,
  spouseAge: 50,
  retirementAge: 65,
  spouseRetirementAge: 65,
  lifeExpectancy: 85,
  spouseLifeExpectancy: 85,
  
  // Income data
  userIncome: 60000,
  spouseIncome: 450000,
  totalIncome: 510000,
  
  // Assets
  retirement401k: 400000,
  cashValueLifeInsurance: 120000,
  taxableBrokerage: 90000,
  checking: 50000,
  savings: 32000,
  totalAssets: 692000,
  
  // Monthly contributions
  monthlyContribution: 2583,
  annualContribution: 31000,
  
  // Retirement expenses
  monthlyExpenses: 8000,
  annualExpenses: 96000,
  
  // Legacy goal
  legacyGoal: 100000,
  
  // Investment strategy
  strategy: 'glide', // Glide path option
  
  // Location
  retirementState: 'TX' // Assuming Texas (no state income tax)
};

// Calculate Social Security benefits
function calculateSocialSecurityBenefits() {
  // User (lower earner): $60k annual
  const userAIME = calculateAIME(bhavneeshData.userIncome, bhavneeshData.currentAge);
  const userPIA = calculatePrimaryInsuranceAmount(userAIME);
  // Claiming at 65 (2 years early) = 13.33% reduction
  const userMonthlyBenefit = userPIA * (1 - 0.1333);
  
  // Spouse (higher earner): $450k annual  
  const spouseAIME = calculateAIME(bhavneeshData.spouseIncome, bhavneeshData.spouseAge);
  const spousePIA = calculatePrimaryInsuranceAmount(spouseAIME);
  // Claiming at 65 (2 years early) = 13.33% reduction
  const spouseMonthlyBenefit = spousePIA * (1 - 0.1333);
  
  const totalMonthlyBenefit = userMonthlyBenefit + spouseMonthlyBenefit;
  const totalAnnualBenefit = totalMonthlyBenefit * 12;
  
  console.log('Social Security Calculation:');
  console.log(`User AIME: $${userAIME.toFixed(0)}/month`);
  console.log(`User PIA: $${userPIA.toFixed(0)}/month`);
  console.log(`User Benefit at 65: $${userMonthlyBenefit.toFixed(0)}/month`);
  console.log(`Spouse AIME: $${spouseAIME.toFixed(0)}/month`);
  console.log(`Spouse PIA: $${spousePIA.toFixed(0)}/month`);
  console.log(`Spouse Benefit at 65: $${spouseMonthlyBenefit.toFixed(0)}/month`);
  console.log(`Total Annual SS Benefit: $${totalAnnualBenefit.toFixed(0)}`);
  console.log('');
  
  return totalAnnualBenefit;
}

// Categorize assets by tax treatment
function categorizeAssets(): AssetBuckets {
  // Based on typical allocations
  const taxDeferred = bhavneeshData.retirement401k; // 401k
  const taxFree = 0; // No Roth mentioned
  const capitalGains = bhavneeshData.taxableBrokerage; // Brokerage
  const cashEquivalents = bhavneeshData.checking + bhavneeshData.savings; // Cash
  // Note: Cash value life insurance could be considered but keeping it separate for now
  
  return {
    taxDeferred,
    taxFree,
    capitalGains,
    cashEquivalents,
    totalAssets: taxDeferred + taxFree + capitalGains + cashEquivalents
  };
}

// Create Monte Carlo parameters
function createMonteCarloParams(annualSSBenefit: number, assetBuckets: AssetBuckets) {
  return {
    // Ages
    currentAge: bhavneeshData.currentAge,
    spouseAge: bhavneeshData.spouseAge,
    retirementAge: bhavneeshData.retirementAge,
    spouseRetirementAge: bhavneeshData.spouseRetirementAge,
    lifeExpectancy: bhavneeshData.lifeExpectancy,
    spouseLifeExpectancy: bhavneeshData.spouseLifeExpectancy,
    
    // Assets and income
    currentRetirementAssets: assetBuckets.totalAssets,
    annualGuaranteedIncome: annualSSBenefit,
    
    // Expenses
    annualRetirementExpenses: bhavneeshData.annualExpenses,
    annualHealthcareCosts: 13000, // Average for 65-year-old couple
    healthcareInflationRate: 0.05, // 5% medical inflation
    
    // Market assumptions
    expectedReturn: 0.06, // 6% real return
    returnVolatility: 0.15, // 15% volatility
    inflationRate: 0.03, // 3% inflation
    
    // Asset allocation (glide path)
    stockAllocation: 0.60, // 60% stocks at age 50
    bondAllocation: 0.35, // 35% bonds
    cashAllocation: 0.05, // 5% cash
    useGlidePath: true, // Use glide path strategy
    
    // Withdrawal strategy
    withdrawalRate: 0.04, // 4% initial withdrawal rate
    useGuardrails: true, // Use dynamic withdrawals
    
    // Tax rate (will be calculated more accurately in fixed version)
    taxRate: 0.25, // Estimated 25% effective rate
    
    // Savings
    annualSavings: bhavneeshData.annualContribution,
    
    // Legacy goal
    legacyGoal: bhavneeshData.legacyGoal,
    
    // Other
    hasLongTermCareInsurance: false,
    
    // Asset buckets
    assetBuckets
  };
}

// Run comparison test
async function runComparisonTest() {
  console.log('=== MONTE CARLO COMPARISON TEST ===');
  console.log('Testing with Bhavneesh Sharma\'s financial data\n');
  
  // Calculate Social Security benefits
  const annualSSBenefit = calculateSocialSecurityBenefits();
  
  // Categorize assets
  const assetBuckets = categorizeAssets();
  console.log('Asset Categorization:');
  console.log(`Tax-Deferred (401k): $${assetBuckets.taxDeferred.toLocaleString()}`);
  console.log(`Tax-Free (Roth): $${assetBuckets.taxFree.toLocaleString()}`);
  console.log(`Capital Gains (Brokerage): $${assetBuckets.capitalGains.toLocaleString()}`);
  console.log(`Cash Equivalents: $${assetBuckets.cashEquivalents.toLocaleString()}`);
  console.log(`Total Retirement Assets: $${assetBuckets.totalAssets.toLocaleString()}`);
  console.log('');
  
  // Create parameters
  const params = createMonteCarloParams(annualSSBenefit, assetBuckets);
  
  console.log('Simulation Parameters:');
  console.log(`Current Age: ${params.currentAge}`);
  console.log(`Retirement Age: ${params.retirementAge}`);
  console.log(`Life Expectancy: ${params.lifeExpectancy}`);
  console.log(`Current Retirement Assets: $${params.currentRetirementAssets.toLocaleString()}`);
  console.log(`Annual Savings: $${params.annualSavings.toLocaleString()}`);
  console.log(`Annual SS Income: $${params.annualGuaranteedIncome.toLocaleString()}`);
  console.log(`Annual Expenses: $${params.annualRetirementExpenses.toLocaleString()}`);
  console.log(`Healthcare Costs: $${params.annualHealthcareCosts.toLocaleString()}`);
  console.log(`Legacy Goal: $${params.legacyGoal.toLocaleString()}`);
  console.log('');
  
  // Run original Monte Carlo
  console.log('Running ORIGINAL Monte Carlo (1000 simulations)...');
  const originalResult = runRetirementMonteCarloSimulation(params, 1000);
  
  console.log('\nOriginal Monte Carlo Results:');
  console.log(`Probability of Success: ${originalResult.probabilityOfSuccess.toFixed(1)}%`);
  console.log(`Median Ending Balance: $${originalResult.medianEndingBalance.toLocaleString()}`);
  console.log(`10th Percentile: $${originalResult.percentile10EndingBalance.toLocaleString()}`);
  console.log(`90th Percentile: $${originalResult.percentile90EndingBalance.toLocaleString()}`);
  console.log(`Safe Withdrawal Rate: ${(originalResult.safeWithdrawalRate * 100).toFixed(2)}%`);
  console.log(`Projected Retirement Portfolio: $${originalResult.projectedRetirementPortfolio.toLocaleString()}`);
  
  // Run enhanced Monte Carlo
  console.log('\n\nRunning ENHANCED Monte Carlo (1000 simulations)...');
  const enhancedResult = runEnhancedMonteCarloSimulation(params, 1000);
  
  console.log('\nEnhanced Monte Carlo Results:');
  console.log(`Probability of Success: ${enhancedResult.probabilityOfSuccess.toFixed(1)}%`);
  console.log(`Median Ending Balance: $${enhancedResult.medianEndingBalance.toLocaleString()}`);
  console.log(`10th Percentile: $${enhancedResult.percentile10EndingBalance.toLocaleString()}`);
  console.log(`90th Percentile: $${enhancedResult.percentile90EndingBalance.toLocaleString()}`);
  console.log(`Safe Withdrawal Rate: ${(enhancedResult.safeWithdrawalRate * 100).toFixed(2)}%`);
  
  // Run fixed Monte Carlo with all corrections
  console.log('\n\nRunning FIXED Monte Carlo with all corrections (1000 simulations)...');
  const fixedResult = runFixedMonteCarloSimulation(params, 1000);
  
  console.log('\nFixed Monte Carlo Results:');
  console.log(`Probability of Success: ${fixedResult.probabilityOfSuccess.toFixed(1)}%`);
  console.log(`Median Ending Balance: $${fixedResult.medianEndingBalance.toLocaleString()}`);
  console.log(`10th Percentile: $${fixedResult.percentile10EndingBalance.toLocaleString()}`);
  console.log(`90th Percentile: $${fixedResult.percentile90EndingBalance.toLocaleString()}`);
  console.log(`Safe Withdrawal Rate: ${(fixedResult.safeWithdrawalRate * 100).toFixed(2)}%`);
  console.log(`Projected Retirement Portfolio: $${fixedResult.projectedRetirementPortfolio.toLocaleString()}`);
  
  console.log('\nTax Analysis:');
  console.log(`Average Effective Tax Rate: ${(fixedResult.taxAnalysis.averageEffectiveTaxRate * 100).toFixed(1)}%`);
  console.log(`Average Total Taxes Paid: $${fixedResult.taxAnalysis.totalTaxesPaid.toLocaleString()}`);
  console.log(`Average IRMAA Surcharges: $${fixedResult.taxAnalysis.totalIRMAASurcharges.toLocaleString()}`);
  console.log(`Scenarios with IRMAA: ${fixedResult.taxAnalysis.percentWithIRMAA.toFixed(1)}%`);
  
  console.log('\nMarket Regime Analysis:');
  console.log(`Average Bear Market Years: ${fixedResult.regimeAnalysis.averageBearMarkets.toFixed(1)}`);
  console.log(`Average Crisis Years: ${fixedResult.regimeAnalysis.averageCrises.toFixed(1)}`);
  console.log(`Worst Case Ending Balance: $${fixedResult.regimeAnalysis.worstCaseScenario.toLocaleString()}`);
  
  // Compare results
  console.log('\n\n=== COMPARISON SUMMARY ===');
  console.log('Success Probability:');
  console.log(`  Original: ${originalResult.probabilityOfSuccess.toFixed(1)}%`);
  console.log(`  Enhanced: ${enhancedResult.probabilityOfSuccess.toFixed(1)}%`);
  console.log(`  Fixed: ${fixedResult.probabilityOfSuccess.toFixed(1)}%`);
  console.log(`  Difference: ${(originalResult.probabilityOfSuccess - fixedResult.probabilityOfSuccess).toFixed(1)} percentage points`);
  
  console.log('\nMedian Ending Balance:');
  console.log(`  Original: $${originalResult.medianEndingBalance.toLocaleString()}`);
  console.log(`  Enhanced: $${enhancedResult.medianEndingBalance.toLocaleString()}`);
  console.log(`  Fixed: $${fixedResult.medianEndingBalance.toLocaleString()}`);
  
  console.log('\nSafe Withdrawal Rate:');
  console.log(`  Original: ${(originalResult.safeWithdrawalRate * 100).toFixed(2)}%`);
  console.log(`  Enhanced: ${(enhancedResult.safeWithdrawalRate * 100).toFixed(2)}%`);
  console.log(`  Fixed: ${(fixedResult.safeWithdrawalRate * 100).toFixed(2)}%`);
  
  console.log('\n\nCONCLUSION:');
  console.log('The fixed Monte Carlo simulation shows a more realistic success probability');
  console.log('by properly accounting for:');
  console.log('- Social Security taxation (up to 85% taxable for high earners)');
  console.log('- IRMAA Medicare surcharges based on income');
  console.log('- Required Minimum Distributions forcing taxable withdrawals');
  console.log('- Market regime switching and sequence of returns risk');
  console.log('- Higher healthcare inflation rates');
  console.log('- Progressive tax brackets instead of flat rates');
}

// Run the test
runComparisonTest().catch(console.error);