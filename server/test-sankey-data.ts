import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';

// Test if Monte Carlo simulation returns proper cash flow data for Sankey visualization
const testProfile = {
  dateOfBirth: '1980-01-01',
  currentRetirementAssets: 500000,
  assets: [
    { type: '401k', value: 400000, owner: 'user' },
    { type: 'ira', value: 100000, owner: 'user' },
    { type: 'brokerage', value: 50000, owner: 'user' },
    { type: 'cash', value: 20000, owner: 'user' }
  ],
  retirementContributions: { employee: 1000, employer: 500 },
  desiredRetirementAge: 65,
  socialSecurityBenefit: 2500,
  socialSecurityClaimAge: 67,
  expectedMonthlyExpensesRetirement: 8000,
  expectedRealReturn: 0.05,
  maritalStatus: 'married',
  spouseDateOfBirth: '1982-01-01',
  spouseRetirementContributions: { employee: 800, employer: 400 },
  spouseDesiredRetirementAge: 65,
  spouseSocialSecurityBenefit: 2000,
  spouseSocialSecurityClaimAge: 67,
  hasLongTermCareInsurance: false,
  partTimeIncomeRetirement: 1000, // Add part-time income for testing
  spousePartTimeIncomeRetirement: 800,
  retirementState: 'FL',
  cashAndEquivalents: 50000,
  taxableInvestments: 200000,
  realEstate: 300000,
  otherAssets: 0,
  mortgage: 100000,
  otherDebts: 0,
  pensionBenefit: 500, // Add pension for testing
  spousePensionBenefit: 300
};

console.log('\n=== TESTING SANKEY DATA GENERATION ===\n');

// Test with current variables
const currentParams = profileToRetirementParams(testProfile);
console.log('Current Parameters:');
console.log('  Retirement Age:', currentParams.retirementAge);
console.log('  SS Claim Age:', currentParams.socialSecurityClaimAge);
console.log('  Monthly Expenses:', currentParams.monthlyExpenses);
console.log('  Part-time Income:', currentParams.partTimeIncomeRetirement);

const currentResult = runEnhancedMonteCarloSimulation(currentParams, 100);

console.log('\n=== CURRENT PLAN RESULT ===');
console.log('Probability of Success:', currentResult.probabilityOfSuccess + '%');
console.log('Has yearlyCashFlows:', !!currentResult.yearlyCashFlows);
console.log('YearlyCashFlows length:', currentResult.yearlyCashFlows?.length || 0);

if (currentResult.yearlyCashFlows && currentResult.yearlyCashFlows.length > 0) {
  console.log('\n=== CURRENT PLAN CASH FLOWS (Years 1, 5, 10, 20) ===');
  const years = [0, 4, 9, 19];
  years.forEach(i => {
    if (i < currentResult.yearlyCashFlows.length) {
      const cf = currentResult.yearlyCashFlows[i];
      console.log(`\nYear ${cf.year} (Age ${cf.age}):`);
      console.log('  Portfolio Balance: $' + cf.portfolioBalance.toLocaleString());
      console.log('  Guaranteed Income: $' + (cf.guaranteedIncome || 0).toLocaleString());
      console.log('  Part-time Income: $' + (cf.partTimeIncome || 0).toLocaleString());
      console.log('  SS Income: $' + (cf.socialSecurityIncome || 0).toLocaleString());
      console.log('  Pension Income: $' + (cf.pensionIncome || 0).toLocaleString());
      console.log('  Withdrawal: $' + (cf.withdrawal || 0).toLocaleString());
      console.log('  Total Expenses: $' + (cf.totalExpenses || 0).toLocaleString());
      console.log('  Total Tax: $' + (cf.totalTax || 0).toLocaleString());
      console.log('  Net Cash Flow: $' + (cf.netCashFlow || 0).toLocaleString());
      
      // Check withdrawal breakdown
      if (cf.taxableWithdrawal !== undefined || cf.taxDeferredWithdrawal !== undefined || cf.rothWithdrawal !== undefined) {
        console.log('  Withdrawal Breakdown:');
        console.log('    Taxable: $' + (cf.taxableWithdrawal || 0).toLocaleString());
        console.log('    Tax-Deferred: $' + (cf.taxDeferredWithdrawal || 0).toLocaleString());
        console.log('    Roth: $' + (cf.rothWithdrawal || 0).toLocaleString());
      }
    }
  });
}

// Test with optimized variables
console.log('\n\n=== TESTING OPTIMIZED PLAN ===\n');

const optimizedParams = {
  ...currentParams,
  retirementAge: 67, // Delay retirement
  socialSecurityClaimAge: 70, // Delay SS
  monthlyExpenses: 7500, // Reduce expenses
  partTimeIncomeRetirement: 2000, // Increase part-time income
  spousePartTimeIncomeRetirement: 1500
};

console.log('Optimized Parameters:');
console.log('  Retirement Age:', optimizedParams.retirementAge);
console.log('  SS Claim Age:', optimizedParams.socialSecurityClaimAge);
console.log('  Monthly Expenses:', optimizedParams.monthlyExpenses);
console.log('  Part-time Income:', optimizedParams.partTimeIncomeRetirement);

const optimizedResult = runEnhancedMonteCarloSimulation(optimizedParams, 100);

console.log('\n=== OPTIMIZED PLAN RESULT ===');
console.log('Probability of Success:', optimizedResult.probabilityOfSuccess + '%');
console.log('Has yearlyCashFlows:', !!optimizedResult.yearlyCashFlows);
console.log('YearlyCashFlows length:', optimizedResult.yearlyCashFlows?.length || 0);

if (optimizedResult.yearlyCashFlows && optimizedResult.yearlyCashFlows.length > 0) {
  console.log('\n=== OPTIMIZED PLAN CASH FLOWS (Years 1, 5, 10, 20) ===');
  const years = [0, 4, 9, 19];
  years.forEach(i => {
    if (i < optimizedResult.yearlyCashFlows.length) {
      const cf = optimizedResult.yearlyCashFlows[i];
      console.log(`\nYear ${cf.year} (Age ${cf.age}):`);
      console.log('  Portfolio Balance: $' + cf.portfolioBalance.toLocaleString());
      console.log('  Guaranteed Income: $' + (cf.guaranteedIncome || 0).toLocaleString());
      console.log('  Part-time Income: $' + (cf.partTimeIncome || 0).toLocaleString());
      console.log('  SS Income: $' + (cf.socialSecurityIncome || 0).toLocaleString());
      console.log('  Pension Income: $' + (cf.pensionIncome || 0).toLocaleString());
      console.log('  Withdrawal: $' + (cf.withdrawal || 0).toLocaleString());
      console.log('  Total Expenses: $' + (cf.totalExpenses || 0).toLocaleString());
      console.log('  Total Tax: $' + (cf.totalTax || 0).toLocaleString());
      console.log('  Net Cash Flow: $' + (cf.netCashFlow || 0).toLocaleString());
    }
  });
}

// Test transformation to Sankey format
console.log('\n\n=== TESTING CASH FLOW TRANSFORMATION ===\n');

// Import transformer inline since we're in a test script
function transformToSankeyFormat(yearData: any, variables: any, profile: any) {
  const age = yearData.age;
  const spouseAge = age - 2; // Assume 2 year age difference for testing
  
  // Determine if receiving Social Security
  const receivingSS = age >= variables.socialSecurityClaimAge;
  const spouseReceivingSS = spouseAge >= variables.spouseSocialSecurityClaimAge;
  
  // Calculate income sources
  const userSS = receivingSS ? (profile.socialSecurityBenefit || 0) * 12 : 0;
  const spouseSS = spouseReceivingSS ? (profile.spouseSocialSecurityBenefit || 0) * 12 : 0;
  const userPension = (profile.pensionBenefit || 0) * 12;
  const spousePension = (profile.spousePensionBenefit || 0) * 12;
  const userPartTime = age < 75 ? (variables.partTimeIncomeRetirement || 0) * 12 : 0;
  const spousePartTime = spouseAge < 75 ? (variables.spousePartTimeIncomeRetirement || 0) * 12 : 0;
  
  // Get withdrawals
  const totalWithdrawal = yearData.withdrawal || 0;
  
  return {
    age,
    socialSecurity: userSS,
    spouseSocialSecurity: spouseSS,
    pension: userPension,
    spousePension: spousePension,
    partTimeIncome: userPartTime,
    spousePartTimeIncome: spousePartTime,
    totalWithdrawal,
    totalIncome: userSS + spouseSS + userPension + spousePension + userPartTime + spousePartTime + totalWithdrawal,
    portfolioBalance: yearData.portfolioBalance
  };
}

if (currentResult.yearlyCashFlows && currentResult.yearlyCashFlows.length > 0) {
  console.log('Sample Transformed Data (Year 5):');
  const sampleYear = currentResult.yearlyCashFlows[4] || currentResult.yearlyCashFlows[0];
  const transformed = transformToSankeyFormat(sampleYear, currentParams, testProfile);
  console.log(JSON.stringify(transformed, null, 2));
}

console.log('\n=== COMPARISON ===');
console.log('Current Plan Success:', currentResult.probabilityOfSuccess + '%');
console.log('Optimized Plan Success:', optimizedResult.probabilityOfSuccess + '%');
console.log('Improvement:', (optimizedResult.probabilityOfSuccess - currentResult.probabilityOfSuccess) + ' percentage points');
console.log('\nCash flow data available for visualization:', 
  (currentResult.yearlyCashFlows?.length > 0 && optimizedResult.yearlyCashFlows?.length > 0) ? 'YES' : 'NO'
);