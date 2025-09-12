// Test script for Bhavneesh/Manisha Monte Carlo discrepancy fixes
import { profileToRetirementParams } from './monte-carlo-base.js';
import { runRightCapitalStyleMonteCarloSimulation } from './monte-carlo-enhanced.js';

// Bhavneesh/Manisha scenario data (based on previous analysis)
const bhavneeshManishaProfile = {
  // Basic demographics
  dateOfBirth: '1973-01-01', // Age ~51
  spouseDateOfBirth: '1975-01-01', // Age ~49
  maritalStatus: 'married',
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  userLifeExpectancy: 90,
  spouseLifeExpectancy: 92,
  
  // Current financial situation
  annualIncome: 180000,
  spouseAnnualIncome: 120000, // Total household: $300k
  expectedMonthlyExpensesRetirement: 8200, // $98,400/year
  
  // Assets (approximated from scenario)
  assets: [
    { type: '401k', value: 350000, owner: 'user', description: 'User 401k' },
    { type: '401k', value: 250000, owner: 'spouse', description: 'Spouse 401k' },
    { type: 'taxable-brokerage', value: 200000, owner: 'joint', description: 'Joint brokerage' },
    { type: 'roth-ira', value: 75000, owner: 'user', description: 'User Roth IRA' },
    { type: 'roth-ira', value: 50000, owner: 'spouse', description: 'Spouse Roth IRA' },
    { type: 'savings', value: 25000, owner: 'joint', description: 'Emergency savings' },
    { type: 'checking', value: 15000, owner: 'joint', description: 'Checking account' }, // Should be excluded now
    { type: 'cash-value-life-insurance', value: 45000, owner: 'user', description: 'Life insurance cash value' }
  ],
  
  // Retirement contributions
  retirementContributions: {
    employee: 2000, // $24k/year combined employee
    employer: 1000   // $12k/year combined employer
  },
  
  // Social Security and benefits
  socialSecurityBenefit: 2800, // Monthly at full retirement age
  spouseSocialSecurityBenefit: 2200, // Monthly at full retirement age
  socialSecurityClaimAge: 67,
  spouseSocialSecurityClaimAge: 67,
  
  // Investment parameters
  expectedRealReturn: 6, // 6% real return
  stockAllocation: 70,   // 70% stocks
  expectedInflationRate: 2.5, // 2.5% inflation
  
  // Other parameters
  state: 'TX', // No state income tax
  retirementState: 'TX',
  hasLongTermCareInsurance: false,
  legacyGoal: 0
};

async function testMonteCarloFixes() {
  console.log('=== TESTING BHAVNEESH/MANISHA MONTE CARLO FIXES ===');
  console.log('Profile Summary:');
  console.log('  - Ages: 51 (user), 49 (spouse)');
  console.log('  - Household Income: $300,000');
  console.log('  - Retirement Expenses: $8,200/month ($98,400/year)');
  console.log('  - Expected: Closer to RightCapital\'s 73% vs our previous 27%');
  console.log('');

  try {
    // Transform profile to retirement parameters (includes all our fixes)
    const params = profileToRetirementParams(bhavneeshManishaProfile);
    
    console.log('=== PARAMETER TRANSFORMATION RESULTS ===');
    console.log('Current Retirement Assets:', params.currentRetirementAssets.toLocaleString());
    console.log('Annual Retirement Expenses:', params.annualRetirementExpenses.toLocaleString());
    console.log('Annual Healthcare Costs:', params.annualHealthcareCosts.toFixed(0));
    console.log('Annual Guaranteed Income:', params.annualGuaranteedIncome.toLocaleString());
    console.log('Annual Savings:', params.annualSavings.toLocaleString());
    console.log('Tax Rate:', (params.taxRate * 100).toFixed(1) + '%');
    console.log('');

    // Run RightCapital-style Monte Carlo simulation (our new approach)
    console.log('=== RUNNING RIGHTCAPITAL-STYLE MONTE CARLO ===');
    const monteCarloResult = runRightCapitalStyleMonteCarloSimulation(params, 1000); // Reduced iterations for faster testing
    
    console.log('');
    console.log('=== FINAL RESULTS ===');
    console.log('SUCCESS PROBABILITY:', (monteCarloResult.successProbability * 100).toFixed(1) + '%');
    console.log('Previous Result: 27% (with complex regime modeling + healthcare double-counting)');
    console.log('RightCapital Result: 73%');
    console.log('');
    
    const improvement = (monteCarloResult.successProbability * 100) - 27;
    console.log('IMPROVEMENT:', improvement > 0 ? '+' + improvement.toFixed(1) : improvement.toFixed(1), 'percentage points');
    
    if (monteCarloResult.successProbability * 100 > 60) {
      console.log('✅ SUCCESS: Much closer to RightCapital\'s 73% result!');
    } else if (monteCarloResult.successProbability * 100 > 45) {
      console.log('🔶 PARTIAL SUCCESS: Significant improvement, may need minor tweaks');
    } else {
      console.log('❌ NEEDS MORE WORK: Still significant gap with RightCapital');
    }
    
    console.log('');
    console.log('Key Fixes Applied:');
    console.log('✅ 1. RightCapital healthcare costs ($12,794 vs automatic calculator)');
    console.log('✅ 2. Eliminated healthcare double-counting');
    console.log('✅ 3. Excluded checking accounts from retirement assets');
    console.log('✅ 4. Asset-specific returns (savings 0.5%, life insurance 3%)');
    console.log('✅ 5. Simple log-normal distribution vs complex regime modeling');
    console.log('✅ 6. Reduced psychological bias in warnings');
    
  } catch (error) {
    console.error('Error running Monte Carlo test:', error);
  }
}

// Run the test
testMonteCarloFixes().catch(console.error);