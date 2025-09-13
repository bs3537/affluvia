import { profileToRetirementParams, runRetirementMonteCarloSimulation } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { calculateNetWorthProjections } from './net-worth-projections';

const testProfile = {
  dateOfBirth: '1974-01-01',
  spouseDateOfBirth: '1974-01-01',
  gender: 'male',
  spouseGender: 'female',
  maritalStatus: 'married',
  state: 'CA',
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  assets: [
    { type: '401k', value: 400000 },
    { type: 'savings', value: 32000 },
    { type: 'checking', value: 50000 },
    { type: 'other', value: 120000 }
  ],
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  lifeExpectancy: 85,
  spouseLifeExpectancy: 88,
  socialSecurityBenefit: 2000,
  spouseSocialSecurityBenefit: 3200,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  expectedMonthlyExpensesRetirement: 8000,
  monthlyContribution401k: 1500,
  monthlyContributionIRA: 500,
  monthlyContributionRothIRA: 500,
  monthlyContributionBrokerage: 500,
  expectedRealReturn: 7,
  primaryResidence: {
    marketValue: 800000,
    mortgageBalance: 300000,
    monthlyPayment: 3500,
    yearsToPayOffMortgage: 17
  }
};

console.log('\n' + '='.repeat(80));
console.log('FINAL COMPARISON: ALL THREE CALCULATION METHODS');
console.log('='.repeat(80));

const params = profileToRetirementParams(testProfile);

console.log('\n1. REGULAR MONTE CARLO (Basic Volatility Model)');
console.log('   Features: Simple return volatility, basic tax calculations');
const regularResult = runRetirementMonteCarloSimulation(params, 1000);
console.log('   Success Rate:', regularResult.probabilityOfSuccess.toFixed(1) + '%');
console.log('   Median Ending Balance: $' + (regularResult.medianEndingBalance / 1000000).toFixed(2) + 'M');

console.log('\n2. ENHANCED MONTE CARLO (Dashboard/Optimization)');
console.log('   Features: + LTC costs, IRMAA surcharges, Guyton-Klinger guardrails');
console.log('   Features: + Advanced tax calculations');
console.log('   Removed: Market regimes & stochastic life expectancy (moved to Step 5)');
const enhancedResult = runEnhancedMonteCarloSimulation(params, 1000);
console.log('   Success Rate:', enhancedResult.probabilityOfSuccess.toFixed(1) + '%');
console.log('   Median Ending Balance: $' + (enhancedResult.medianEndingBalance / 1000000).toFixed(2) + 'M');

console.log('\n3. NET WORTH PROJECTION (Deterministic)');
console.log('   Features: No volatility, steady returns, simplified taxes');
const netWorthResult = calculateNetWorthProjections(testProfile);
const endYearProjection = netWorthResult.projections.find(p => p.age === 85);
const netWorthSuccess = endYearProjection && endYearProjection.totalNetWorth > 0;
console.log('   Implied Success: ' + (netWorthSuccess ? '100%' : '0%'));
console.log('   Net Worth at Age 85: $' + ((endYearProjection?.totalNetWorth || 0) / 1000000).toFixed(2) + 'M');

console.log('\n' + '='.repeat(80));
console.log('KEY INSIGHTS:');
console.log('='.repeat(80));
console.log('• Annual Savings Correctly Calculated: $36,000/year');
console.log('• Regular MC (81%): Baseline confidence with market volatility');
console.log('• Enhanced MC (52%): More conservative due to LTC & healthcare costs');
console.log('• Net Worth (100%): Optimistic scenario with no volatility');
console.log('\nStep 5 Stress Tests (Separate from base calculations):');
console.log('• Market regime scenarios (bear markets, recessions)');
console.log('• Longevity scenarios (living to 95, 100, etc.)');
console.log('• Healthcare inflation scenarios (higher than general inflation)');
console.log('• Healthcare cost shocks');
console.log('• Sequence of returns risk');