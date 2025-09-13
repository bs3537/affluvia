import { calculateNetWorthProjections } from './net-worth-projections';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';
import { extractMonteCarloProjections } from './monte-carlo-to-projections';

/**
 * Validation test comparing our projections to Boldin/RightCapital benchmarks
 * Based on the audit report, these tools show:
 * - 98.5% success rate
 * - $6.1M net worth by 2067 (age 93)
 * - Assets lasting throughout retirement
 */

const testProfile = {
  // Demographics
  dateOfBirth: '1974-12-15', // Age 51 in 2025
  spouseDateOfBirth: '1974-01-01', // Also age 51
  lifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  maritalStatus: 'married',
  
  // Income & Expenses
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  monthlyExpenses: 8500, // $102k/year current expenses
  expectedMonthlyExpensesRetirement: 11000, // $132k/year retirement
  
  // Retirement Planning
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  socialSecurityBenefit: 2003,
  spouseSocialSecurityBenefit: 3423,
  socialSecurityClaimAge: 65,
  spouseSocialSecurityClaimAge: 65,
  
  // Savings & Contributions
  monthlyContribution401k: 2500, // $30k/year
  monthlyContributionIRA: 0,
  monthlyContributionRothIRA: 0,
  monthlyContributionBrokerage: 0,
  
  // Investment Strategy
  expectedRealReturn: -1, // Glide path
  
  // Assets
  assets: [
    { type: '401k', value: 400000, owner: 'spouse' },
    { type: 'cash-value-life-insurance', value: 120000, owner: 'spouse' },
    { type: 'savings', value: 32000, owner: 'joint' },
    { type: 'taxable-brokerage', value: 90000, owner: 'user' }
  ],
  
  // Real Estate & Debt
  primaryResidence: { 
    marketValue: 975000, 
    mortgageBalance: 350000,
    monthlyPayment: 3400,
    mortgageRate: 0.045
  },
  liabilities: [],
  
  // Location
  state: 'MA',
  retirementState: 'FL'
};

async function runValidation() {
  console.log('=== RETIREMENT PROJECTION VALIDATION TEST ===\n');
  console.log('Comparing to Boldin/RightCapital Benchmarks:');
  console.log('- Expected Success Rate: 98.5%');
  console.log('- Expected 2067 Net Worth: $6.1M');
  console.log('- Expected Outcome: Assets last throughout retirement\n');
  
  // Test 1: Deterministic Net Worth Projections
  console.log('TEST 1: Deterministic Net Worth Projections');
  console.log('=' . repeat(50));
  
  const deterministicResult = calculateNetWorthProjections(testProfile);
  
  // Key milestones
  const age65 = deterministicResult.projections.find(p => p.age === 65);
  const age72 = deterministicResult.projections.find(p => p.age === 72);
  const age80 = deterministicResult.projections.find(p => p.age === 80);
  const age93 = deterministicResult.projections.find(p => p.age === 93);
  
  console.log('Current Net Worth:', formatCurrency(deterministicResult.currentNetWorth));
  console.log('\nMilestones:');
  console.log(`Age 65 (Retirement): NW = ${formatCurrency(age65?.totalNetWorth || 0)}, Savings = ${formatCurrency(age65?.savings || 0)}`);
  console.log(`Age 72: NW = ${formatCurrency(age72?.totalNetWorth || 0)}, Savings = ${formatCurrency(age72?.savings || 0)}`);
  console.log(`Age 80: NW = ${formatCurrency(age80?.totalNetWorth || 0)}, Savings = ${formatCurrency(age80?.savings || 0)}`);
  console.log(`Age 93 (Life Exp): NW = ${formatCurrency(age93?.totalNetWorth || 0)}, Savings = ${formatCurrency(age93?.savings || 0)}`);
  
  // Check for depletion
  const depletionPoint = deterministicResult.projections.find(p => p.savings <= 0 && p.age >= 65);
  if (depletionPoint) {
    console.log(`\n⚠️  WARNING: Assets deplete at age ${depletionPoint.age}`);
  } else {
    console.log('\n✅ Assets last throughout retirement');
  }
  
  // Validate against benchmarks
  const nw2067 = age93?.totalNetWorth || 0;
  const nwDifference = ((nw2067 - 6100000) / 6100000 * 100).toFixed(1);
  console.log(`\n2067 Net Worth: ${formatCurrency(nw2067)} (${nwDifference}% vs benchmark)`);
  
  // Test 2: Monte Carlo Simulation
  console.log('\n\nTEST 2: Monte Carlo Simulation');
  console.log('=' . repeat(50));
  
  const monteCarloParams = profileToRetirementParams(testProfile);
  const monteCarloResult = await runEnhancedMonteCarloSimulation(monteCarloParams);
  
  console.log('Success Probability:', (monteCarloResult.successProbability * 100).toFixed(1) + '%');
  console.log('Expected vs Benchmark: 98.5%');
  
  const successDiff = ((monteCarloResult.successProbability - 0.985) * 100).toFixed(1);
  console.log(`Difference: ${successDiff}% points`);
  
  // Test 3: Monte Carlo Median Projections
  console.log('\n\nTEST 3: Monte Carlo Median Projections');
  console.log('=' . repeat(50));
  
  const medianProjections = extractMonteCarloProjections(monteCarloResult, testProfile);
  
  const mcAge65 = medianProjections.projections.find(p => p.age === 65);
  const mcAge93 = medianProjections.projections.find(p => p.age === 93);
  
  console.log('Median Scenario:');
  console.log(`Age 65: NW = ${formatCurrency(mcAge65?.totalNetWorth || 0)}`);
  console.log(`Age 93: NW = ${formatCurrency(mcAge93?.totalNetWorth || 0)}`);
  
  // Calculate surplus income that should be invested
  console.log('\n\nCASH FLOW ANALYSIS');
  console.log('=' . repeat(50));
  
  const grossIncome = testProfile.annualIncome + testProfile.spouseAnnualIncome;
  const afterTaxIncome = grossIncome * 0.7; // Rough 30% tax estimate
  const annualExpenses = testProfile.monthlyExpenses * 12;
  const annualDebt = testProfile.primaryResidence.monthlyPayment * 12;
  const explicit401k = testProfile.monthlyContribution401k * 12;
  
  console.log('Gross Income:', formatCurrency(grossIncome));
  console.log('After-Tax Income:', formatCurrency(afterTaxIncome));
  console.log('Annual Expenses:', formatCurrency(annualExpenses));
  console.log('Annual Debt Payments:', formatCurrency(annualDebt));
  console.log('Explicit 401k Contributions:', formatCurrency(explicit401k));
  
  const surplus = afterTaxIncome - annualExpenses - annualDebt - explicit401k;
  console.log('Annual Surplus Available for Investment:', formatCurrency(surplus));
  
  // Summary
  console.log('\n\n' + '=' . repeat(50));
  console.log('VALIDATION SUMMARY');
  console.log('=' . repeat(50));
  
  const passes: string[] = [];
  const failures: string[] = [];
  
  // Check success rate
  if (Math.abs(monteCarloResult.successProbability - 0.985) < 0.05) {
    passes.push('Monte Carlo success rate within 5% of benchmark');
  } else {
    failures.push(`Monte Carlo success rate off by ${Math.abs(monteCarloResult.successProbability - 0.985) * 100}%`);
  }
  
  // Check 2067 net worth
  if (Math.abs(nw2067 - 6100000) / 6100000 < 0.20) {
    passes.push('2067 net worth within 20% of benchmark');
  } else {
    failures.push(`2067 net worth off by ${Math.abs((nw2067 - 6100000) / 6100000 * 100).toFixed(0)}%`);
  }
  
  // Check asset depletion
  if (!depletionPoint) {
    passes.push('Assets last throughout retirement');
  } else {
    failures.push(`Assets deplete at age ${depletionPoint.age}`);
  }
  
  // Check surplus investing
  if (surplus > 50000) {
    passes.push(`Surplus income of ${formatCurrency(surplus)} being captured`);
  } else {
    failures.push(`Low surplus income: only ${formatCurrency(surplus)}`);
  }
  
  console.log('\n✅ PASSES:');
  passes.forEach(p => console.log(`  - ${p}`));
  
  if (failures.length > 0) {
    console.log('\n❌ FAILURES:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  
  const overallPass = failures.length === 0;
  console.log(`\n${overallPass ? '✅' : '❌'} Overall Validation: ${overallPass ? 'PASSED' : 'FAILED'}`);
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}k`;
  }
  return `$${amount.toFixed(0)}`;
}

// Run validation if this file is executed directly
runValidation().catch(console.error);

export { runValidation };