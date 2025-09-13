import { runRightCapitalStyleMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';
import { calculateMonteCarloWithdrawalSequence } from './monte-carlo-withdrawal-sequence';

// Test to verify that Monte Carlo calculations are consistent between baseline and optimization
async function testMonteCarloConsistency() {
  console.log('=== TESTING MONTE CARLO CONSISTENCY ===\n');
  
  // Create a test profile with typical values
  const testProfile = {
    maritalStatus: 'single',
    dateOfBirth: '1965-01-01',
    annualIncome: 120000,
    desiredRetirementAge: 65,
    socialSecurityClaimAge: 67,
    socialSecurityBenefit: 2500, // Monthly
    pensionBenefit: 1000, // Monthly
    partTimeIncomeRetirement: 500, // Monthly
    expectedMonthlyExpensesRetirement: 7000,
    retirementContributions: { employee: 1000, employer: 500 }, // Monthly
    traditionalIRAContribution: 7000, // Annual
    rothIRAContribution: 0,
    hasLongTermCareInsurance: false,
    expectedRealReturn: 0.061, // 6.1% (Moderate risk profile)
    assets: [
      { type: '401k', value: 800000, owner: 'user' },
      { type: 'traditional-ira', value: 200000, owner: 'user' },
      { type: 'taxable-brokerage', value: 150000, owner: 'user' }
    ],
    state: 'TX',
    retirementState: 'TX'
  };
  
  // Define optimization variables that should NOT change the result
  // when they match the baseline values
  const matchingOptimizationVariables = {
    retirementAge: 65,
    socialSecurityAge: 67,
    socialSecurityBenefit: 2500,
    pensionBenefit: 1000,
    assetAllocation: '6.1', // Same as expectedRealReturn
    monthlyEmployee401k: 1000,
    monthlyEmployer401k: 500,
    annualTraditionalIRA: 7000,
    annualRothIRA: 0,
    monthlyExpenses: 7000,
    partTimeIncome: 500,
    hasLongTermCareInsurance: false
  };
  
  // Define optimization variables that SHOULD change the result
  const differentOptimizationVariables = {
    retirementAge: 67, // Delay retirement
    socialSecurityAge: 70, // Delay SS claim
    assetAllocation: '7', // More aggressive (7% vs 6.1%)
    monthlyEmployee401k: 1500, // Increase contributions
    monthlyEmployer401k: 750,
    annualTraditionalIRA: 8000,
    annualRothIRA: 0,
    monthlyExpenses: 6500, // Reduce expenses
    partTimeIncome: 1000, // Increase part-time income
    hasLongTermCareInsurance: true // Add LTC insurance
  };
  
  console.log('Test Profile Summary:');
  console.log('  Current Age: 59');
  console.log('  Retirement Age: 65');
  console.log('  Social Security Claim Age: 67');
  console.log('  Current Assets: $1,150,000');
  console.log('  Monthly Expenses: $7,000');
  console.log('  Expected Return: 6.1%\n');
  
  // TEST 1: Baseline calculation (no optimization variables)
  console.log('--- TEST 1: BASELINE CALCULATION ---');
  const baselineParams = profileToRetirementParams(testProfile);
  console.log('Baseline Parameters:');
  console.log('  Annual Guaranteed Income: $', baselineParams.annualGuaranteedIncome.toLocaleString());
  console.log('  Annual Expenses: $', baselineParams.annualRetirementExpenses.toLocaleString());
  console.log('  Annual Savings: $', baselineParams.annualSavings.toLocaleString());
  console.log('  Expected Return:', (baselineParams.expectedReturn * 100).toFixed(1) + '%');
  
  const baselineResult = runRightCapitalStyleMonteCarloSimulation(baselineParams, 100);
  console.log('Baseline Result: Success Probability =', (baselineResult.successProbability * 100).toFixed(1) + '%\n');
  
  // TEST 2: Optimization with MATCHING variables (should be same as baseline)
  console.log('--- TEST 2: OPTIMIZATION WITH MATCHING VARIABLES ---');
  console.log('(Variables match baseline - should get same result)');
  
  const matchingResult = await calculateMonteCarloWithdrawalSequence(testProfile, matchingOptimizationVariables);
  const matchingProbability = matchingResult.monteCarloSummary.probabilityOfSuccess;
  console.log('Matching Variables Result: Success Probability =', (matchingProbability * 100).toFixed(1) + '%');
  
  const matchingDifference = Math.abs(matchingProbability - baselineResult.successProbability);
  if (matchingDifference < 0.02) { // Allow 2% tolerance for Monte Carlo randomness
    console.log('✅ PASS: Probabilities match within tolerance (difference:', (matchingDifference * 100).toFixed(1) + '%)\n');
  } else {
    console.log('❌ FAIL: Probabilities differ significantly (difference:', (matchingDifference * 100).toFixed(1) + '%)\n');
  }
  
  // TEST 3: Optimization with DIFFERENT variables (should be different from baseline)
  console.log('--- TEST 3: OPTIMIZATION WITH DIFFERENT VARIABLES ---');
  console.log('Changes: Retire at 67, SS at 70, 7% return, increase contributions, reduce expenses');
  
  const differentResult = await calculateMonteCarloWithdrawalSequence(testProfile, differentOptimizationVariables);
  const differentProbability = differentResult.monteCarloSummary.probabilityOfSuccess;
  console.log('Different Variables Result: Success Probability =', (differentProbability * 100).toFixed(1) + '%');
  
  const improvementFromBaseline = (differentProbability - baselineResult.successProbability) * 100;
  console.log('Improvement from baseline: ' + (improvementFromBaseline >= 0 ? '+' : '') + improvementFromBaseline.toFixed(1) + '%');
  
  if (differentProbability > baselineResult.successProbability) {
    console.log('✅ PASS: Optimization improved success probability as expected\n');
  } else {
    console.log('⚠️  WARNING: Optimization did not improve success probability\n');
  }
  
  // SUMMARY
  console.log('=== SUMMARY ===');
  console.log('Baseline:                ', (baselineResult.successProbability * 100).toFixed(1) + '%');
  console.log('With matching variables: ', (matchingProbability * 100).toFixed(1) + '%', 
    matchingDifference < 0.02 ? '✅' : '❌');
  console.log('With optimized variables:', (differentProbability * 100).toFixed(1) + '%',
    differentProbability > baselineResult.successProbability ? '✅' : '⚠️');
  
  // TEST 4: Verify asset allocation is being applied
  console.log('\n--- TEST 4: ASSET ALLOCATION TEST ---');
  const conservativeVariables = { ...matchingOptimizationVariables, assetAllocation: '5' }; // 5% return
  const aggressiveVariables = { ...matchingOptimizationVariables, assetAllocation: '8' }; // 8% return
  
  const conservativeResult = await calculateMonteCarloWithdrawalSequence(testProfile, conservativeVariables);
  const aggressiveResult = await calculateMonteCarloWithdrawalSequence(testProfile, aggressiveVariables);
  
  console.log('Conservative (5% return):', (conservativeResult.monteCarloSummary.probabilityOfSuccess * 100).toFixed(1) + '%');
  console.log('Baseline (6.1% return):  ', (baselineResult.successProbability * 100).toFixed(1) + '%');
  console.log('Aggressive (8% return):  ', (aggressiveResult.monteCarloSummary.probabilityOfSuccess * 100).toFixed(1) + '%');
  
  if (conservativeResult.monteCarloSummary.probabilityOfSuccess < baselineResult.successProbability &&
      aggressiveResult.monteCarloSummary.probabilityOfSuccess > baselineResult.successProbability) {
    console.log('✅ PASS: Asset allocation is correctly affecting success probability');
  } else {
    console.log('❌ FAIL: Asset allocation is not being applied correctly');
  }
  
  console.log('\n=== TEST COMPLETE ===\n');
}

// Run the test
testMonteCarloConsistency().catch(console.error);