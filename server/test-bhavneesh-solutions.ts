// Test solutions to improve Bhavneesh Sharma's 0% retirement confidence score
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { AssetBuckets } from './asset-tax-classifier';

// Base data
const baseData = {
  currentAge: 50,
  spouseAge: 50,
  retirementAge: 65,
  spouseRetirementAge: 65,
  lifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  currentAssets: 572000, // 401k + brokerage + cash
  annualSavings: 102000, // $8,500/month
  monthlyRetirementExpenses: 8000,
  userSSBenefit: 1860, // at age 70
  spouseSSBenefit: 4340, // at age 70
  retirementState: 'FL'
};

// Helper to create asset buckets
function createAssetBuckets(totalAssets: number): AssetBuckets {
  return {
    taxDeferred: totalAssets * 0.7, // Assume 70% in 401k
    taxFree: 0,
    capitalGains: totalAssets * 0.16, // 16% in brokerage
    cashEquivalents: totalAssets * 0.14, // 14% in cash
    totalAssets
  };
}

// Base parameters
function createBaseParams(overrides: any = {}) {
  const annualExpenses = (baseData.monthlyRetirementExpenses * 12);
  
  return {
    currentAge: baseData.currentAge,
    spouseAge: baseData.spouseAge,
    retirementAge: baseData.retirementAge,
    spouseRetirementAge: baseData.spouseRetirementAge,
    lifeExpectancy: baseData.lifeExpectancy,
    spouseLifeExpectancy: baseData.spouseLifeExpectancy,
    
    socialSecurityBenefit: baseData.userSSBenefit,
    socialSecurityClaimAge: 70,
    spouseSocialSecurityBenefit: baseData.spouseSSBenefit,
    spouseSocialSecurityClaimAge: 70,
    
    currentRetirementAssets: baseData.currentAssets,
    annualGuaranteedIncome: 0,
    
    annualRetirementExpenses: annualExpenses,
    annualHealthcareCosts: 15000,
    healthcareInflationRate: 0.05,
    
    expectedReturn: 0.07,
    returnVolatility: 0.15,
    inflationRate: 0.03,
    
    stockAllocation: 0.65,
    bondAllocation: 0.30,
    cashAllocation: 0.05,
    
    withdrawalRate: 0.04,
    useGuardrails: true,
    
    taxRate: 0.22,
    retirementState: 'FL',
    
    annualSavings: baseData.annualSavings,
    legacyGoal: 0,
    
    partTimeIncomeRetirement: 0,
    spousePartTimeIncomeRetirement: 0,
    
    assetBuckets: createAssetBuckets(baseData.currentAssets),
    
    ...overrides
  };
}

console.log('=== SOLUTIONS TO IMPROVE BHAVNEESH\'S RETIREMENT SUCCESS ===\n');

// Solution 1: Current Plan (Baseline)
console.log('BASELINE: Current Plan');
console.log('- Retire at 65, claim SS at 70');
console.log('- Monthly expenses: $8,000');
console.log('- No changes');

const baselineParams = createBaseParams();
const baselineResult = runEnhancedMonteCarloSimulation(baselineParams, 500);
console.log(`Success Rate: ${baselineResult.probabilityOfSuccess.toFixed(1)}%\n`);

// Solution 2: Claim Social Security at 67 (Full Retirement Age)
console.log('SOLUTION 1: Claim Social Security at 67');
console.log('- Reduces gap from 5 years to 2 years');
console.log('- SS benefits: ~$1,500 (user) + $3,500 (spouse) = $5,000/month');

const solution1Params = createBaseParams({
  socialSecurityBenefit: 1500, // reduced from 1860
  spouseSocialSecurityBenefit: 3500, // reduced from 4340
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67
});
const solution1Result = runEnhancedMonteCarloSimulation(solution1Params, 500);
console.log(`Success Rate: ${solution1Result.probabilityOfSuccess.toFixed(1)}%\n`);

// Solution 3: Claim Social Security at 65 (Same as retirement)
console.log('SOLUTION 2: Claim Social Security at 65');
console.log('- No gap period - SS starts immediately at retirement');
console.log('- SS benefits: ~$1,300 (user) + $3,033 (spouse) = $4,333/month');

const solution2Params = createBaseParams({
  socialSecurityBenefit: 1300, // 13.33% reduction
  spouseSocialSecurityBenefit: 3033, // 13.33% reduction
  socialSecurityClaimAge: 65,
  spouseSocialSecurityClaimAge: 65
});
const solution2Result = runEnhancedMonteCarloSimulation(solution2Params, 500);
console.log(`Success Rate: ${solution2Result.probabilityOfSuccess.toFixed(1)}%\n`);

// Solution 4: Reduce expenses to $7,000/month
console.log('SOLUTION 3: Reduce Monthly Expenses to $7,000');
console.log('- Lower annual expenses by $12,000');
console.log('- Keep SS claim at 70 for maximum benefit');

const solution3Params = createBaseParams({
  annualRetirementExpenses: 84000 // $7,000 * 12
});
const solution3Result = runEnhancedMonteCarloSimulation(solution3Params, 500);
console.log(`Success Rate: ${solution3Result.probabilityOfSuccess.toFixed(1)}%\n`);

// Solution 5: Work part-time for 5 years (65-70)
console.log('SOLUTION 4: Part-time Income During Gap Years');
console.log('- Work part-time earning $50,000/year combined (65-70)');
console.log('- Bridges the Social Security gap');

const solution4Params = createBaseParams({
  partTimeIncomeRetirement: 25000, // User earns $25k
  spousePartTimeIncomeRetirement: 25000 // Spouse earns $25k
});
const solution4Result = runEnhancedMonteCarloSimulation(solution4Params, 500);
console.log(`Success Rate: ${solution4Result.probabilityOfSuccess.toFixed(1)}%\n`);

// Solution 6: Delay retirement to 67
console.log('SOLUTION 5: Delay Retirement to 67');
console.log('- Work 2 more years (more savings, less retirement years)');
console.log('- Claim SS at 70 (only 3-year gap)');

const solution5Params = createBaseParams({
  retirementAge: 67,
  spouseRetirementAge: 67
});
const solution5Result = runEnhancedMonteCarloSimulation(solution5Params, 500);
console.log(`Success Rate: ${solution5Result.probabilityOfSuccess.toFixed(1)}%\n`);

// Solution 7: Combined approach
console.log('SOLUTION 6: Combined Optimization');
console.log('- Claim SS at 67 (FRA)');
console.log('- Reduce expenses to $7,500/month');
console.log('- Part-time income $30k/year for first 2 years');

const solution6Params = createBaseParams({
  socialSecurityBenefit: 1500,
  spouseSocialSecurityBenefit: 3500,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  annualRetirementExpenses: 90000, // $7,500 * 12
  partTimeIncomeRetirement: 15000,
  spousePartTimeIncomeRetirement: 15000
});
const solution6Result = runEnhancedMonteCarloSimulation(solution6Params, 500);
console.log(`Success Rate: ${solution6Result.probabilityOfSuccess.toFixed(1)}%\n`);

// Summary
console.log('=== SUMMARY OF SOLUTIONS ===\n');
console.log(`Baseline (current plan):                ${baselineResult.probabilityOfSuccess.toFixed(1)}%`);
console.log(`1. Claim SS at 67:                      ${solution1Result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`2. Claim SS at 65:                      ${solution2Result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`3. Reduce expenses to $7k/month:        ${solution3Result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`4. Part-time income during gap:         ${solution4Result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`5. Delay retirement to 67:              ${solution5Result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`6. Combined optimization:               ${solution6Result.probabilityOfSuccess.toFixed(1)}%`);

console.log('\n=== KEY INSIGHTS ===\n');
console.log('The 0% success rate is primarily caused by:');
console.log('1. The 5-year gap between retirement (65) and SS claims (70)');
console.log('2. High expenses ($96k/year) relative to portfolio size');
console.log('3. No income during the critical early retirement years');
console.log('\nMost effective solutions:');
console.log('- Claiming Social Security earlier dramatically improves success');
console.log('- Part-time income during the gap years helps significantly');
console.log('- Combining multiple modest adjustments works best');

console.log('\n=== RECOMMENDATION ===\n');
console.log('The current plan with retiring at 65 and waiting until 70 for SS is not viable.');
console.log('Consider claiming SS at Full Retirement Age (67) and working part-time');
console.log('for the first few years of retirement to bridge the income gap.');