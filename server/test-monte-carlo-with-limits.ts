// Test Monte Carlo simulation with growing contribution limits
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { RetirementMonteCarloParams } from './monte-carlo-base.js';

console.log('🎯 Testing Monte Carlo with Growing 401(k) Contribution Limits\n');

// Create test parameters for someone who will max out their 401(k)
const testParams: RetirementMonteCarloParams = {
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  spouseAge: 33,
  spouseRetirementAge: 65,
  spouseLifeExpectancy: 92,
  
  currentRetirementAssets: 250000,
  annualGuaranteedIncome: 0, // Will be calculated with SS
  
  // Social Security
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  socialSecurityBenefit: 2800, // Monthly
  spouseSocialSecurityBenefit: 2200, // Monthly
  
  annualRetirementExpenses: 120000,
  annualHealthcareCosts: 15000,
  
  expectedReturn: 0.06,
  returnVolatility: 0.15,
  inflationRate: 0.03,
  
  stockAllocation: 0.70,
  bondAllocation: 0.25,
  cashAllocation: 0.05,
  
  withdrawalRate: 0.04,
  useGuardrails: true,
  taxRate: 0.22,
  
  // High earners who max out their 401(k) contributions
  annualSavings: 65000, // Total household retirement savings
  userAnnualSavings: 35000,
  spouseAnnualSavings: 30000,
  
  // Specific contribution amounts (will hit limits in early years)
  monthlyContribution401k: 2500, // $30k/year (will be limited to $23.5k in 2025)
  monthlyContributionIRA: 700,   // $8.4k/year (will be limited to $7k in 2025)
  monthlyContributionRothIRA: 0,
  spouseMonthlyContribution401k: 2200, // $26.4k/year (will be limited to $23.5k in 2025)
  spouseMonthlyContributionIRA: 600,   // $7.2k/year (will be limited to $7k in 2025)
  spouseMonthlyContributionRothIRA: 0,
  
  legacyGoal: 500000,
  hasLongTermCareInsurance: true,
  
  useGlidePath: false,
  
  assetBuckets: {
    taxDeferred: 180000,  // 401(k), traditional IRA
    taxFree: 50000,       // Roth accounts
    capitalGains: 15000,  // Taxable brokerage
    cashEquivalents: 5000,
    totalAssets: 250000
  }
};

console.log('Running Monte Carlo simulation with contribution limits...');
console.log(`User desired 401(k): $30,000/year`);
console.log(`Spouse desired 401(k): $26,400/year`);
console.log(`User desired IRA: $8,400/year`);
console.log(`Spouse desired IRA: $7,200/year`);
console.log(`Total desired retirement contributions: $72,000/year\n`);

const startTime = Date.now();
const result = runEnhancedMonteCarloSimulation(testParams, 100); // Small sample for testing
const endTime = Date.now();

console.log('=== Monte Carlo Results ===');
console.log(`Success Probability: ${result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Simulation Time: ${endTime - startTime}ms`);
console.log(`Scenarios: ${result.scenarios.total}`);

console.log('\n=== Projected Assets at Retirement ===');
console.log(`Current Assets: $${testParams.currentRetirementAssets.toLocaleString()}`);
console.log(`Projected at Retirement: $${result.projectedRetirementPortfolio.toLocaleString()}`);

console.log('\n=== Sample Cash Flow Years (showing contribution growth) ===');
// Show first few years of accumulation to verify contribution limits are being applied
if (result.yearlyCashFlows && result.yearlyCashFlows.length > 0) {
  const accumulationYears = result.yearlyCashFlows.filter(cf => cf.withdrawal < 0).slice(0, 10);
  
  console.log('Year | Age | Net Contribution | Portfolio Balance');
  console.log('-----|-----|------------------|------------------');
  
  accumulationYears.forEach((cf, index) => {
    const netContribution = -cf.withdrawal; // Negative withdrawal = positive contribution
    console.log(`${cf.year.toString().padStart(4)} | ${cf.age.toString().padStart(3)} | $${netContribution.toLocaleString().padStart(14)} | $${cf.portfolioBalance.toLocaleString().padStart(15)}`);
  });
  
  if (accumulationYears.length > 0) {
    const firstYear = accumulationYears[0];
    const lastYear = accumulationYears[accumulationYears.length - 1];
    const contributionGrowth = (-lastYear.withdrawal) / (-firstYear.withdrawal) - 1;
    
    console.log(`\nContribution Growth: ${(contributionGrowth * 100).toFixed(1)}% over ${accumulationYears.length} years`);
    console.log(`Expected with 2% limits growth + regular increases: ~${((Math.pow(1.02, accumulationYears.length) - 1) * 100).toFixed(1)}%`);
  }
}

console.log('\n✅ Monte Carlo simulation with growing contribution limits complete!');