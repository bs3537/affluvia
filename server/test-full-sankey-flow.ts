import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';

// Import transformer inline for testing
interface MonteCarloYearData {
  year: number;
  age: number;
  portfolioBalance: number;
  withdrawal?: number;
  guaranteedIncome?: number;
  netCashFlow?: number;
  socialSecurityIncome?: number;
  pensionIncome?: number;
  partTimeIncome?: number;
  totalExpenses?: number;
}

function transformToSankeyData(
  yearlyCashFlows: MonteCarloYearData[],
  retirementAge: number,
  socialSecurityAge: number,
  monthlyExpenses: number
) {
  if (!yearlyCashFlows || yearlyCashFlows.length === 0) {
    return [];
  }
  
  // Filter to only retirement years (when withdrawals are positive)
  const retirementYears = yearlyCashFlows.filter(yearData => {
    return yearData.age >= retirementAge && yearData.withdrawal !== undefined && yearData.withdrawal >= 0;
  });
  
  console.log(`\nFiltered ${yearlyCashFlows.length} years to ${retirementYears.length} retirement years`);
  console.log(`Retirement starts at age ${retirementAge}`);
  
  return retirementYears;
}

// Test profile with realistic retirement scenario
const testProfile = {
  dateOfBirth: '1978-01-01', // Age 47 in 2025
  currentRetirementAssets: 800000,
  assets: [
    { type: '401k', value: 600000, owner: 'user' },
    { type: 'ira', value: 200000, owner: 'user' },
    { type: 'brokerage', value: 100000, owner: 'user' },
    { type: 'cash', value: 30000, owner: 'user' }
  ],
  retirementContributions: { employee: 1500, employer: 750 },
  desiredRetirementAge: 65,
  socialSecurityBenefit: 3000,
  socialSecurityClaimAge: 67,
  expectedMonthlyExpensesRetirement: 10000,
  expectedRealReturn: 0.05,
  maritalStatus: 'married',
  spouseDateOfBirth: '1980-01-01', // Age 45 in 2025
  spouseRetirementContributions: { employee: 1200, employer: 600 },
  spouseDesiredRetirementAge: 65,
  spouseSocialSecurityBenefit: 2500,
  spouseSocialSecurityClaimAge: 67,
  hasLongTermCareInsurance: false,
  partTimeIncomeRetirement: 2000,
  spousePartTimeIncomeRetirement: 1500,
  retirementState: 'FL',
  cashAndEquivalents: 50000,
  taxableInvestments: 200000,
  realEstate: 400000,
  otherAssets: 0,
  mortgage: 150000,
  otherDebts: 10000,
  pensionBenefit: 1000,
  spousePensionBenefit: 500
};

console.log('\n=== FULL SANKEY FLOW TEST ===\n');

// Test with current variables
const currentParams = profileToRetirementParams(testProfile);
console.log('Current Variables:');
console.log('  Current Age:', 2025 - 1978);
console.log('  Retirement Age:', currentParams.retirementAge);
console.log('  Years to Retirement:', currentParams.retirementAge - (2025 - 1978));
console.log('  SS Claim Age:', currentParams.socialSecurityClaimAge);
console.log('  Monthly Expenses:', currentParams.monthlyExpenses || 10000);
console.log('  Part-time Income:', currentParams.partTimeIncomeRetirement);

console.log('\n=== RUNNING SIMULATION ===');
const currentResult = runEnhancedMonteCarloSimulation(currentParams, 100);

console.log('\nSimulation Result:');
console.log('  Probability of Success:', currentResult.probabilityOfSuccess + '%');
console.log('  Yearly Cash Flows Available:', !!currentResult.yearlyCashFlows);
console.log('  Total Years Simulated:', currentResult.yearlyCashFlows?.length || 0);

if (currentResult.yearlyCashFlows && currentResult.yearlyCashFlows.length > 0) {
  // Check the transition from accumulation to retirement
  console.log('\n=== ACCUMULATION TO RETIREMENT TRANSITION ===');
  
  const retirementAge = currentParams.retirementAge;
  const transitionYears = currentResult.yearlyCashFlows.filter(cf => 
    cf.age >= retirementAge - 2 && cf.age <= retirementAge + 2
  );
  
  transitionYears.forEach(cf => {
    console.log(`\nAge ${cf.age} (Year ${cf.year}):`);
    console.log('  Portfolio: $' + cf.portfolioBalance.toLocaleString());
    console.log('  Withdrawal: $' + (cf.withdrawal || 0).toLocaleString());
    console.log('  Status:', cf.age < retirementAge ? 'ACCUMULATION' : 'RETIREMENT');
    
    if (cf.age >= retirementAge) {
      console.log('  Guaranteed Income: $' + (cf.guaranteedIncome || 0).toLocaleString());
      console.log('  SS Income: $' + (cf.socialSecurityIncome || 0).toLocaleString());
      console.log('  Part-time: $' + (cf.partTimeIncome || 0).toLocaleString());
      console.log('  Pension: $' + (cf.pensionIncome || 0).toLocaleString());
      console.log('  Total Expenses: $' + (cf.totalExpenses || 0).toLocaleString());
    }
  });
  
  // Transform for Sankey visualization
  console.log('\n=== TRANSFORMING FOR SANKEY ===');
  const sankeyData = transformToSankeyData(
    currentResult.yearlyCashFlows,
    currentParams.retirementAge,
    currentParams.socialSecurityClaimAge,
    10000
  );
  
  console.log('Sankey-ready data points:', sankeyData.length);
  
  if (sankeyData.length > 0) {
    console.log('\n=== SAMPLE SANKEY DATA ===');
    const sampleYears = [0, Math.floor(sankeyData.length / 2), sankeyData.length - 1];
    
    sampleYears.forEach(idx => {
      if (idx < sankeyData.length) {
        const year = sankeyData[idx];
        console.log(`\nRetirement Year ${idx + 1} (Age ${year.age}):`);
        console.log('  Portfolio Balance: $' + year.portfolioBalance.toLocaleString());
        console.log('  Total Withdrawal: $' + (year.withdrawal || 0).toLocaleString());
        console.log('  Guaranteed Income: $' + (year.guaranteedIncome || 0).toLocaleString());
        
        // Calculate total income
        const totalIncome = (year.withdrawal || 0) + (year.guaranteedIncome || 0);
        console.log('  TOTAL INCOME: $' + totalIncome.toLocaleString());
        
        // Show expenses
        const totalExpenses = year.totalExpenses || (10000 * 12);
        console.log('  TOTAL EXPENSES: $' + totalExpenses.toLocaleString());
        
        // Net flow
        const netFlow = totalIncome - totalExpenses;
        console.log('  NET FLOW:', netFlow > 0 ? '+$' + netFlow.toLocaleString() : '-$' + Math.abs(netFlow).toLocaleString());
      }
    });
    
    console.log('\n✅ SANKEY DATA READY FOR VISUALIZATION');
    console.log(`   ${sankeyData.length} years of retirement cash flows available`);
  } else {
    console.log('\n❌ NO RETIREMENT YEARS FOUND');
    console.log('   This may happen if:');
    console.log('   1. Simulation covers only accumulation phase');
    console.log('   2. Portfolio depletes immediately at retirement');
    console.log('   3. Data transformation filters out all years');
  }
}

// Test with optimized variables
console.log('\n\n=== TESTING OPTIMIZED SCENARIO ===');

const optimizedParams = {
  ...currentParams,
  retirementAge: 67,
  socialSecurityClaimAge: 70,
  monthlyExpenses: 9000,
  partTimeIncomeRetirement: 3000,
  spousePartTimeIncomeRetirement: 2000
};

console.log('Optimized Variables:');
console.log('  Retirement Age:', optimizedParams.retirementAge);
console.log('  SS Claim Age:', optimizedParams.socialSecurityClaimAge);
console.log('  Monthly Expenses:', optimizedParams.monthlyExpenses);
console.log('  Part-time Income:', optimizedParams.partTimeIncomeRetirement);

const optimizedResult = runEnhancedMonteCarloSimulation(optimizedParams, 100);

console.log('\nOptimized Result:');
console.log('  Probability of Success:', optimizedResult.probabilityOfSuccess + '%');
console.log('  Improvement:', (optimizedResult.probabilityOfSuccess - currentResult.probabilityOfSuccess) + ' percentage points');

const optimizedSankeyData = transformToSankeyData(
  optimizedResult.yearlyCashFlows,
  optimizedParams.retirementAge,
  optimizedParams.socialSecurityClaimAge,
  9000
);

console.log('\n=== FINAL SUMMARY ===');
const currentSankeyData = transformToSankeyData(
  currentResult.yearlyCashFlows,
  currentParams.retirementAge,
  currentParams.socialSecurityClaimAge,
  10000
);

console.log('Current Plan:');
console.log('  Success Rate:', currentResult.probabilityOfSuccess + '%');
console.log('  Retirement Years with Data:', currentSankeyData.length);

console.log('\nOptimized Plan:');
console.log('  Success Rate:', optimizedResult.probabilityOfSuccess + '%');
console.log('  Retirement Years with Data:', optimizedSankeyData.length);

console.log('\nSankey Visualization Status:');
if (currentSankeyData.length > 0 && optimizedSankeyData.length > 0) {
  console.log('✅ Both plans have data - Sankey should display with toggle');
} else if (currentSankeyData.length > 0 || optimizedSankeyData.length > 0) {
  console.log('⚠️  Only one plan has data - Sankey should display without toggle');
} else {
  console.log('❌ No data available for Sankey visualization');
}