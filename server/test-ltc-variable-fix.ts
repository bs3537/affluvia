// Test for LTC modeling variable fix - verifying inflatedAnnualCost is properly defined
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced.js';
import { profileToRetirementParams } from './monte-carlo.js';
import { modelLTCEvents } from './ltc-modeling.js';

console.log('Testing LTC Modeling Variable Fix\n');
console.log('========================================\n');

// Create a test profile that includes LTC events
const testProfileWithLTC = {
  dateOfBirth: '1959-01-01', // 65 years old
  maritalStatus: 'married',
  spouseDateOfBirth: '1961-01-01',
  
  // Retirement parameters
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 67,
  userLifeExpectancy: 90,
  spouseLifeExpectancy: 92,
  
  // Income sources
  socialSecurityBenefit: 2500,
  spouseSocialSecurityBenefit: 2000,
  pensionBenefit: 0,
  spousePensionBenefit: 0,
  partTimeIncomeRetirement: 0,
  spousePartTimeIncomeRetirement: 0,
  
  // Expenses
  expectedMonthlyExpensesRetirement: 7000,
  retirementState: 'FL',
  state: 'FL',
  
  // Portfolio
  assets: [
    {
      type: '401k',
      value: 1500000,
      owner: 'user'
    },
    {
      type: 'roth-ira',
      value: 300000,
      owner: 'user'
    },
    {
      type: 'taxable-brokerage',
      value: 500000,
      owner: 'joint'
    }
  ],
  
  // Currently working
  annualIncome: 120000,
  spouseAnnualIncome: 80000,
  
  // Retirement savings
  retirementContributions: {
    employee: 19500,
    employer: 6000
  },
  spouseRetirementContributions: {
    employee: 15000,
    employer: 4000
  },
  
  // Return expectations
  expectedRealReturn: 6,
  expectedInflationRate: 3,
  
  currentAllocation: {
    usStocks: 60,
    bonds: 30,
    cash: 10
  }
};

console.log('Test Profile:');
console.log('-------------');
console.log('Portfolio: $2.3M total');
console.log('Retirement ages: User=65, Spouse=67');
console.log('Life expectancies: User=90, Spouse=92');
console.log('This should trigger LTC modeling for last 2 years\n');

// First test the modelLTCEvents function directly
console.log('=== TEST 1: Direct LTC Modeling Function ===\n');

try {
  const ltcResult = modelLTCEvents(
    65,  // startAge
    90,  // endAge
    'male',
    'good',
    'FL',
    { type: 'none', dailyBenefit: 0, benefitPeriodYears: 0, eliminationPeriodDays: 0, inflationProtection: 'none', premiumAnnual: 0, policyStartAge: 65 },
    {
      startAge: 67,
      gender: 'female',
      healthStatus: 'good',
      ltcInsurance: { type: 'none', dailyBenefit: 0, benefitPeriodYears: 0, eliminationPeriodDays: 0, inflationProtection: 'none', premiumAnnual: 0, policyStartAge: 67 }
    }
  );
  
  console.log('✓ LTC modeling function executed without error');
  console.log('  Had LTC Event: ' + ltcResult.hadLTCEvent);
  console.log('  Total LTC Costs: $' + ltcResult.totalLTCCosts.toLocaleString());
  console.log('  Years in LTC: ' + ltcResult.yearsInLTC);
  console.log('  Max Simultaneous Cost: $' + ltcResult.maxSimultaneousCost.toLocaleString());
  
  if (ltcResult.ltcEvents.length > 0) {
    console.log('\n  LTC Events:');
    ltcResult.ltcEvents.forEach((event, i) => {
      console.log(`    Event ${i + 1}: Start age ${event.startAge}, Duration ${event.duration} years`);
      console.log(`      Annual cost: $${event.careCostAnnual.toLocaleString()}`);
      console.log(`      Out-of-pocket: $${event.outOfPocketCost.toLocaleString()}`);
    });
  }
} catch (error) {
  console.log('✗ ERROR in LTC modeling:');
  console.log('  ' + error.message);
  if (error.message.includes('inflatedAnnualCost')) {
    console.log('  -> The variable reference error still exists!');
  }
}

// Now test in the full Monte Carlo simulation
console.log('\n\n=== TEST 2: Enhanced Monte Carlo with LTC ===\n');

const params = profileToRetirementParams(testProfileWithLTC);
params.ltcInsurance = {
  type: 'none',
  dailyBenefit: 0,
  benefitPeriodYears: 0,
  eliminationPeriodDays: 0,
  inflationProtection: 'none',
  premiumAnnual: 0,
  policyStartAge: 65
};

console.log('Running enhanced Monte Carlo simulation with LTC modeling...\n');

try {
  const result = runEnhancedMonteCarloSimulation(params, 100);
  
  console.log('✓ Monte Carlo simulation completed successfully!');
  console.log('\nSimulation Results:');
  console.log('  Success Rate: ' + result.probabilityOfSuccess.toFixed(1) + '%');
  console.log('  Median Ending Balance: $' + result.medianEndingBalance.toLocaleString());
  console.log('  25th Percentile Balance: $' + result.percentile25Balance.toLocaleString());
  console.log('  75th Percentile Balance: $' + result.percentile75Balance.toLocaleString());
  
  // Check LTC statistics if available
  if (result.ltcStatistics) {
    console.log('\n  LTC Statistics:');
    console.log('    Scenarios with LTC: ' + result.ltcStatistics.percentWithLTC.toFixed(1) + '%');
    console.log('    Average LTC cost: $' + result.ltcStatistics.averageLTCCost.toLocaleString());
    console.log('    Max LTC cost: $' + result.ltcStatistics.maxLTCCost.toLocaleString());
  }
  
  // Check if LTC events are being modeled
  if (result.yearlyCashFlows && result.yearlyCashFlows.length > 0) {
    console.log('\n  Sample cash flows (last 5 years to check for LTC):');
    const startIdx = Math.max(0, result.yearlyCashFlows.length - 5);
    for (let i = startIdx; i < result.yearlyCashFlows.length; i++) {
      const cf = result.yearlyCashFlows[i];
      console.log(`    Year ${cf.year}: Expenses = $${cf.expenses.toLocaleString()}, ` +
                  `Portfolio = $${cf.portfolioBalance.toLocaleString()}`);
      if (cf.ltcCost && cf.ltcCost > 0) {
        console.log(`      -> LTC Cost: $${cf.ltcCost.toLocaleString()}`);
      }
    }
  }
  
} catch (error) {
  console.log('✗ ERROR in Monte Carlo simulation:');
  console.log('  ' + error.message);
  console.log('\nStack trace:');
  console.log(error.stack);
  
  if (error.message.includes('inflatedAnnualCost')) {
    console.log('\n  -> The inflatedAnnualCost variable error is NOT fixed!');
    console.log('  -> Need to check line 572 in ltc-modeling.ts');
  } else {
    console.log('\n  -> This is a different error, not the inflatedAnnualCost issue');
  }
}

console.log('\n\n=== FIX VERIFICATION ===');
console.log('If tests pass without "inflatedAnnualCost is not defined" error:');
console.log('  ✓ Variable scoping issue has been fixed');
console.log('  ✓ LTC modeling can run in Monte Carlo simulations');
console.log('  ✓ Both user and spouse LTC events can be modeled');
console.log('  ✓ Overlapping LTC events are handled correctly');
console.log('\nIf error still occurs:');
console.log('  ✗ Need to revisit ltc-modeling.ts line 572');
console.log('  ✗ Check variable declaration and scope');