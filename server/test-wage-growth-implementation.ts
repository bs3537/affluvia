// Test script for 4% annual wage growth implementation
import {
  calculateFutureWage,
  calculateProgressiveWageGrowth,
  calculateHouseholdIncomeGrowth,
  calculateFutureSavings
} from '../shared/wage-growth-modeling.ts';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.ts';
import { RetirementMonteCarloParams } from './monte-carlo-base.ts';

console.log('🚀 Testing 4% Annual Wage Growth Implementation\n');

// Test basic wage growth calculations
console.log('=== Basic Wage Growth Testing ===');
const currentWage = 100000;
const testYears = [1, 5, 10, 15, 20, 25, 30];

console.log(`Current wage: $${currentWage.toLocaleString()}`);
console.log('Future wages with 4% annual growth:');
testYears.forEach(years => {
  const futureWage = calculateFutureWage(currentWage, years);
  const totalGrowth = ((futureWage / currentWage - 1) * 100).toFixed(1);
  console.log(`  ${years} years: $${futureWage.toLocaleString()} (+${totalGrowth}%)`);
});

// Test progressive wage growth (age-based)
console.log('\n=== Progressive Wage Growth (Age-Based) ===');
const currentAge = 30;
const scenarios = [
  { startAge: 25, endAge: 30, description: 'Early career (25→30)' },
  { startAge: 30, endAge: 40, description: 'Mid career (30→40)' },
  { startAge: 40, endAge: 50, description: 'Late mid career (40→50)' },
  { startAge: 50, endAge: 60, description: 'Pre-retirement (50→60)' }
];

scenarios.forEach(scenario => {
  const progressiveWage = calculateProgressiveWageGrowth(currentWage, scenario.startAge, scenario.endAge);
  const years = scenario.endAge - scenario.startAge;
  const annualGrowthRate = Math.pow(progressiveWage / currentWage, 1/years) - 1;
  console.log(`  ${scenario.description}: $${progressiveWage.toLocaleString()} (${(annualGrowthRate * 100).toFixed(1)}% annually)`);
});

// Test household income growth
console.log('\n=== Household Income Growth ===');
const userIncome = 80000;
const spouseIncome = 60000;
const userAge = 35;
const spouseAge = 33;

[5, 10, 20, 30].forEach(years => {
  const householdGrowth = calculateHouseholdIncomeGrowth(
    userIncome, spouseIncome, userAge, spouseAge, years
  );
  
  console.log(`\n${years} years from now:`);
  console.log(`  User: $${userIncome.toLocaleString()} → $${householdGrowth.userFutureIncome.toLocaleString()}`);
  console.log(`  Spouse: $${spouseIncome.toLocaleString()} → $${householdGrowth.spouseFutureIncome.toLocaleString()}`);
  console.log(`  Household: $${(userIncome + spouseIncome).toLocaleString()} → $${householdGrowth.totalHouseholdIncome.toLocaleString()}`);
  console.log(`  Total growth: +${(householdGrowth.householdIncomeGrowth * 100).toFixed(1)}%`);
});

// Test savings growth with wage growth
console.log('\n=== Savings Growth with Wage Growth ===');
const currentSavings = 15000; // $15k annual savings
const savingsRate = 0.15; // 15% savings rate

console.log(`Current savings: $${currentSavings.toLocaleString()} (${(savingsRate * 100)}% of income)`);
testYears.slice(0, 5).forEach(years => {
  const futureSavings = calculateFutureSavings(currentSavings, currentWage, savingsRate, years);
  const savingsGrowth = ((futureSavings / currentSavings - 1) * 100).toFixed(1);
  console.log(`  ${years} years: $${futureSavings.toLocaleString()} (+${savingsGrowth}%)`);
});

// Test Monte Carlo simulation with wage growth
console.log('\n=== Monte Carlo Simulation with Wage Growth ===');
const testParams: RetirementMonteCarloParams = {
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  spouseAge: 33,
  spouseRetirementAge: 65,
  spouseLifeExpectancy: 92,
  
  currentRetirementAssets: 200000,
  annualGuaranteedIncome: 0,
  
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  socialSecurityBenefit: 2500,
  spouseSocialSecurityBenefit: 2000,
  
  annualRetirementExpenses: 100000,
  annualHealthcareCosts: 12000,
  
  expectedReturn: 0.06,
  returnVolatility: 0.15,
  inflationRate: 0.03,
  
  stockAllocation: 0.70,
  bondAllocation: 0.25,
  cashAllocation: 0.05,
  
  withdrawalRate: 0.04,
  useGuardrails: true,
  taxRate: 0.22,
  
  // Individual incomes for wage growth modeling
  userAnnualIncome: 80000,
  spouseAnnualIncome: 60000,
  
  annualSavings: 21000, // $21k total household savings
  userAnnualSavings: 12000, // User saves $12k (15% of $80k)
  spouseAnnualSavings: 9000, // Spouse saves $9k (15% of $60k)
  
  legacyGoal: 500000,
  hasLongTermCareInsurance: false,
  useGlidePath: false,
  
  assetBuckets: {
    taxDeferred: 150000,
    taxFree: 30000,
    capitalGains: 15000,
    cashEquivalents: 5000,
    totalAssets: 200000
  }
};

console.log('\nRunning Monte Carlo simulation with wage growth modeling...');
console.log(`User income: $${testParams.userAnnualIncome!.toLocaleString()}`);
console.log(`Spouse income: $${testParams.spouseAnnualIncome!.toLocaleString()}`);
console.log(`Total annual savings: $${testParams.annualSavings.toLocaleString()}`);

const startTime = Date.now();
const result = runEnhancedMonteCarloSimulation(testParams, 100);
const endTime = Date.now();

console.log('\n=== Monte Carlo Results with Wage Growth ===');
console.log(`Success Probability: ${result.probabilityOfSuccess.toFixed(1)}%`);
console.log(`Projected Portfolio at Retirement: $${result.projectedRetirementPortfolio.toLocaleString()}`);
console.log(`Simulation Time: ${endTime - startTime}ms`);

// Analyze cash flow growth in early years
console.log('\n=== Cash Flow Growth Analysis ===');
if (result.yearlyCashFlows && result.yearlyCashFlows.length > 0) {
  const accumulationYears = result.yearlyCashFlows.filter(cf => cf.withdrawal < 0).slice(0, 10);
  
  if (accumulationYears.length >= 2) {
    const firstYearSavings = -accumulationYears[0].withdrawal;
    const lastYearSavings = -accumulationYears[accumulationYears.length - 1].withdrawal;
    
    if (firstYearSavings > 0) {
      const savingsGrowth = (lastYearSavings / firstYearSavings) - 1;
      const annualSavingsGrowthRate = Math.pow(lastYearSavings / firstYearSavings, 1 / (accumulationYears.length - 1)) - 1;
      
      console.log(`First year savings: $${firstYearSavings.toLocaleString()}`);
      console.log(`Year ${accumulationYears.length} savings: $${lastYearSavings.toLocaleString()}`);
      console.log(`Savings growth: +${(savingsGrowth * 100).toFixed(1)}% total`);
      console.log(`Annual savings growth rate: ${(annualSavingsGrowthRate * 100).toFixed(1)}%`);
      console.log(`Expected with 4% wage growth: ~4.0%`);
    }
  }
}

console.log('\n✅ 4% Annual Wage Growth Implementation Testing Complete!');