import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './monte-carlo-base';

// Test script to verify LTC model changes and percentile paths

const testParams: RetirementMonteCarloParams = {
  currentAge: 70,
  retirementAge: 65,
  lifeExpectancy: 93,
  currentRetirementAssets: 3000000,
  annualSavings: 0, // Already retired
  annualRetirementExpenses: 120000,  // Increased to be more than guaranteed income
  annualHealthcareCosts: 15000,
  healthcareInflationRate: 0.045,
  inflationRate: 0.025,
  expectedReturn: 0.06,
  returnVolatility: 0.15,
  withdrawalRate: 0.04,
  socialSecurityBenefit: 3000,
  socialSecurityClaimAge: 67,
  partTimeIncomeRetirement: 2000,  // More realistic part-time income
  useGlidePath: false,
  taxRate: 0.22,
  legacyGoal: 0,
  pensionBenefit: 0,
  annualGuaranteedIncome: 0,
  useGuardrails: true,
  stockAllocation: 0.6,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  assetBuckets: {
    taxDeferred: 2000000,
    taxFree: 500000,
    capitalGains: 500000,
    cashEquivalents: 0,
    totalAssets: 3000000
  },
  hasLongTermCareInsurance: false,
  // Spouse info
  spouseAge: 68,
  spouseLifeExpectancy: 95,
  spouseSocialSecurityBenefit: 2500,
  spouseSocialSecurityClaimAge: 67,
  spousePartTimeIncomeRetirement: 1500,  // More realistic spouse part-time income
  spousePensionBenefit: 0,
  spouseRetirementAge: 65,
  userAnnualSavings: 0,
  spouseAnnualSavings: 0
};

console.log('=== TESTING LTC MODEL AND PERCENTILE PATHS ===\n');

// Calculate guaranteed income
const userSS = (testParams.socialSecurityBenefit || 0) * 12;
const spouseSS = (testParams.spouseSocialSecurityBenefit || 0) * 12;
const userPartTime = (testParams.partTimeIncomeRetirement || 0) * 12;
const spousePartTime = (testParams.spousePartTimeIncomeRetirement || 0) * 12;
testParams.annualGuaranteedIncome = userSS + spouseSS + userPartTime + spousePartTime;

console.log('Test Parameters:');
console.log(`- Current Age: ${testParams.currentAge}`);
console.log(`- Retirement Assets: $${testParams.currentRetirementAssets.toLocaleString()}`);
console.log(`- Annual Expenses: $${(testParams.annualRetirementExpenses + (testParams.annualHealthcareCosts || 0)).toLocaleString()}`);
console.log(`- Guaranteed Income: $${testParams.annualGuaranteedIncome.toLocaleString()}`);
console.log(`- Net Annual Need: $${((testParams.annualRetirementExpenses + (testParams.annualHealthcareCosts || 0)) - testParams.annualGuaranteedIncome).toLocaleString()}\n`);

// Run 500 simulations for testing
console.log('Running 500 Monte Carlo simulations...\n');
const result = runEnhancedMonteCarloSimulation(testParams, 500);

console.log('RESULTS:');
console.log(`Success Probability: ${result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Median Ending Balance: $${Math.round(result.medianEndingBalance).toLocaleString()}`);
console.log(`10th Percentile Balance: $${Math.round(result.percentile10EndingBalance).toLocaleString()}`);
console.log(`90th Percentile Balance: $${Math.round(result.percentile90EndingBalance).toLocaleString()}`);

// Check LTC Analysis
if (result.ltcAnalysis) {
  console.log('\nLTC ANALYSIS:');
  console.log(`- Lifetime LTC Probability: ${(result.ltcAnalysis.probabilityOfLTC * 100).toFixed(1)}%`);
  console.log(`- Average Cost if Occurs: $${Math.round(result.ltcAnalysis.avgCostIfOccurs).toLocaleString()}`);
  console.log(`- Average Duration: ${result.ltcAnalysis.avgDurationIfOccurs.toFixed(1)} years`);
  console.log(`- Success Rate Impact: ${result.ltcAnalysis.impactOnSuccess.successDelta.toFixed(1)} percentage points`);
  console.log(`- Failures due to LTC: ${result.ltcAnalysis.impactOnSuccess.failuresDueToLTC}`);
}

// Check Percentile Paths
console.log('\nPERCENTILE PATHS:');
console.log(`- Median cash flows: ${result.yearlyCashFlows ? result.yearlyCashFlows.length : 0} years`);
console.log(`- 10th percentile cash flows: ${result.percentile10CashFlows ? result.percentile10CashFlows.length : 0} years`);
console.log(`- 90th percentile cash flows: ${result.percentile90CashFlows ? result.percentile90CashFlows.length : 0} years`);

// Show portfolio balances at key ages
if (result.yearlyCashFlows && result.percentile10CashFlows && result.percentile90CashFlows) {
  console.log('\nPORTFOLIO BALANCES AT KEY AGES:');
  const keyYears = [5, 10, 15, 20]; // Years into retirement
  
  keyYears.forEach(yearOffset => {
    if (yearOffset < result.yearlyCashFlows.length) {
      const median = result.yearlyCashFlows[yearOffset];
      const p10 = result.percentile10CashFlows ? result.percentile10CashFlows[yearOffset] : null;
      const p90 = result.percentile90CashFlows ? result.percentile90CashFlows[yearOffset] : null;
      
      console.log(`\nAge ${median.age}:`);
      console.log(`  10th percentile: $${Math.round(p10.portfolioBalance).toLocaleString()}`);
      console.log(`  Median:          $${Math.round(median.portfolioBalance).toLocaleString()}`);
      console.log(`  90th percentile: $${Math.round(p90.portfolioBalance).toLocaleString()}`);
    }
  });
}

console.log('\n=== TEST COMPLETE ===');
console.log('\nKEY FINDINGS:');
console.log('1. LTC probability should be around 50% lifetime (not 80%+)');
console.log('2. Average LTC cost should be around $85K/year');
console.log('3. Average LTC duration should be around 2.5 years');
console.log('4. Percentile paths should show wide range of outcomes');
console.log('5. Success rate should be more reasonable than the previous 13%');