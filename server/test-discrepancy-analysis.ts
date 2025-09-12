import { runRetirementMonteCarloSimulation, profileToRetirementParams } from './monte-carlo-base';
import { calculateNetWorthProjections } from './net-worth-projections';

// Test user: Couple, both age 50
// Income: $60k man, $450k woman  
// Savings: $400k in 401k, $120k cash life insurance, $32k savings, $50k checking
// Total liquid assets: ~$602k

const testProfile = {
  // Basic info
  dateOfBirth: '1974-01-01',
  spouseDateOfBirth: '1974-01-01',
  gender: 'male',
  spouseGender: 'female',
  maritalStatus: 'married',
  state: 'CA',
  
  // Income
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  
  // Assets
  assets: [
    { type: '401k', value: 400000 },
    { type: 'savings', value: 32000 },
    { type: 'checking', value: 50000 },
    { type: 'other', value: 120000 } // Cash life insurance
  ],
  
  // Retirement plans
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  lifeExpectancy: 85,
  spouseLifeExpectancy: 88,
  
  // Social Security
  socialSecurityBenefit: 2000,
  spouseSocialSecurityBenefit: 3200,
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  
  // Expenses
  expectedMonthlyExpensesRetirement: 8000,
  
  // Savings contributions
  monthlyContribution401k: 1500,
  monthlyContributionIRA: 500,
  monthlyContributionRothIRA: 500,
  monthlyContributionBrokerage: 500,
  
  // Investment strategy
  expectedRealReturn: 7, // 7% return
  
  // Housing
  primaryResidence: {
    marketValue: 800000,
    mortgageBalance: 300000,
    monthlyPayment: 3500,
    yearsToPayOffMortgage: 17
  },
  
  // Other liabilities
  liabilities: []
};

console.log('\n' + '='.repeat(80));
console.log('RETIREMENT CONFIDENCE vs NET WORTH PROJECTION DISCREPANCY ANALYSIS');
console.log('='.repeat(80));

// Run Monte Carlo simulation
console.log('\n--- MONTE CARLO SIMULATION ---');
const monteCarloParams = profileToRetirementParams(testProfile);
console.log('Monte Carlo Input Parameters:');
console.log('- Current Age:', 50);
console.log('- Retirement Age:', monteCarloParams.retirementAge);
console.log('- Current Retirement Assets:', monteCarloParams.currentRetirementAssets);
console.log('- Annual Savings:', monteCarloParams.annualSavings);
console.log('- Annual Retirement Expenses:', monteCarloParams.annualRetirementExpenses);
console.log('- Expected Return:', monteCarloParams.expectedReturn);

const monteCarloResult = runRetirementMonteCarloSimulation(monteCarloParams, 1000);
console.log('\nMonte Carlo Results:');
console.log('- Probability of Success:', monteCarloResult.probabilityOfSuccess.toFixed(1) + '%');
console.log('- Median Ending Balance:', '$' + (monteCarloResult.medianEndingBalance / 1000000).toFixed(2) + 'M');
console.log('- 10th Percentile:', '$' + (monteCarloResult.percentile10EndingBalance / 1000000).toFixed(2) + 'M');
console.log('- 90th Percentile:', '$' + (monteCarloResult.percentile90EndingBalance / 1000000).toFixed(2) + 'M');

// Run net worth projection
console.log('\n--- NET WORTH PROJECTION ---');
const netWorthResult = calculateNetWorthProjections(testProfile);
console.log('Net Worth Projection Input:');
console.log('- Current Net Worth:', '$' + (netWorthResult.currentNetWorth / 1000000).toFixed(2) + 'M');
console.log('- Target Year:', netWorthResult.targetYear);

// Find retirement year and end year projections
const retirementYearProjection = netWorthResult.projections.find(p => p.age === 65);
const endYearProjection = netWorthResult.projections.find(p => p.age === 85);

console.log('\nNet Worth Projections:');
console.log('- At Retirement (Age 65):', '$' + ((retirementYearProjection?.totalNetWorth || 0) / 1000000).toFixed(2) + 'M');
console.log('- At Life Expectancy (Age 85):', '$' + ((endYearProjection?.totalNetWorth || 0) / 1000000).toFixed(2) + 'M');

// Analyze the discrepancy
console.log('\n' + '='.repeat(80));
console.log('DISCREPANCY ANALYSIS');
console.log('='.repeat(80));

console.log('\nKey Differences in Calculation Methods:');
console.log('\n1. VOLATILITY:');
console.log('   - Monte Carlo: Uses return volatility (15-20%), simulates market downturns');
console.log('   - Net Worth: Uses steady expected return without volatility');

console.log('\n2. TAX TREATMENT:');
console.log('   - Monte Carlo: Calculates detailed tax-efficient withdrawals, RMDs, capital gains');
console.log('   - Net Worth: Uses simplified effective tax rate');

console.log('\n3. WITHDRAWAL STRATEGY:');
console.log('   - Monte Carlo: Dynamic withdrawal based on 4% rule with guardrails');
console.log('   - Net Worth: Withdraws only what\'s needed for expenses');

console.log('\n4. INFLATION:');
console.log('   - Monte Carlo: Variable inflation with volatility, healthcare inflation separate');
console.log('   - Net Worth: Fixed inflation rate');

console.log('\n5. LIFE EXPECTANCY:');
console.log('   - Monte Carlo: Stochastic life expectancy with mortality tables');
console.log('   - Net Worth: Fixed life expectancy');

console.log('\n6. SEQUENCE OF RETURNS RISK:');
console.log('   - Monte Carlo: Models early retirement market crashes');
console.log('   - Net Worth: No sequence risk modeling');

// Calculate what success rate the net worth projection implies
const netWorthImpliedSuccess = endYearProjection && endYearProjection.totalNetWorth > 0 ? 100 : 0;
console.log('\n--- SUMMARY ---');
console.log('Monte Carlo Success Rate: ' + monteCarloResult.probabilityOfSuccess.toFixed(1) + '%');
console.log('Net Worth Implied Success: ' + netWorthImpliedSuccess + '%');
console.log('Gap: ' + (netWorthImpliedSuccess - monteCarloResult.probabilityOfSuccess).toFixed(1) + ' percentage points');

console.log('\nWHY THE DISCREPANCY?');
console.log('The Net Worth projection shows $' + ((endYearProjection?.totalNetWorth || 0) / 1000000).toFixed(1) + 
            'M at age 85 because it assumes:');
console.log('- Perfect steady returns every year');
console.log('- No market crashes or volatility');
console.log('- Simplified tax calculations');
console.log('- Fixed life expectancy');
console.log('\nThe Monte Carlo simulation shows only ' + monteCarloResult.probabilityOfSuccess.toFixed(1) + 
            '% success because it accounts for:');
console.log('- Market volatility and crashes');
console.log('- Sequence of returns risk');
console.log('- Detailed tax calculations');
console.log('- Variable life expectancy');
console.log('- Healthcare inflation outpacing general inflation');

console.log('\nRECOMMENDATION:');
console.log('The Monte Carlo simulation provides a more realistic assessment of retirement readiness.');
console.log('The net worth projection is useful for understanding the "average" scenario but');
console.log('doesn\'t capture the risk of running out of money in adverse conditions.');