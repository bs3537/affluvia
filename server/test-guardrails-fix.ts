// Test for Guyton-Klinger guardrails fix - ensuring spending cuts are actually applied
import { runRetirementMonteCarloSimulation } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';

console.log('Testing Guyton-Klinger Guardrails Fix\n');
console.log('========================================\n');

// Create a test profile for a retiree who needs guardrails
const testProfile = {
  dateOfBirth: '1959-01-01', // 65 years old
  maritalStatus: 'married',
  spouseDateOfBirth: '1961-01-01',
  
  // Already retired
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 67,
  userLifeExpectancy: 90,
  spouseLifeExpectancy: 92,
  
  // Moderate guaranteed income
  socialSecurityBenefit: 2000,  // $2,000/month
  spouseSocialSecurityBenefit: 1500,  // $1,500/month
  pensionBenefit: 0,
  spousePensionBenefit: 0,
  partTimeIncomeRetirement: 0,
  spousePartTimeIncomeRetirement: 0,
  
  // Expenses that require significant withdrawals
  expectedMonthlyExpensesRetirement: 8000, // $8,000/month = $96,000/year
  retirementState: 'FL',
  state: 'FL',
  
  // Portfolio that could be stressed in bad markets
  assets: [
    {
      type: '401k',
      value: 1200000,  // $1.2M in tax-deferred
      owner: 'user'
    },
    {
      type: 'roth-ira',
      value: 200000,   // $200k in Roth
      owner: 'user'
    },
    {
      type: 'taxable-brokerage',
      value: 400000,   // $400k in taxable
      owner: 'joint'
    }
  ],
  
  // Already retired
  annualIncome: 0,
  spouseAnnualIncome: 0,
  
  // No more savings
  retirementContributions: {
    employee: 0,
    employer: 0
  },
  spouseRetirementContributions: {
    employee: 0,
    employer: 0
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
console.log('Portfolio: $1.8M total');
console.log('Annual expenses: $96,000');
console.log('Annual guaranteed income: $42,000 (SS only)');
console.log('Annual withdrawal needed: ~$54,000 (before taxes)');
console.log('Initial withdrawal rate: ~3.0%\n');

// Test WITHOUT guardrails first
console.log('=== TEST 1: Without Guardrails ===\n');
const paramsNoGuardrails = profileToRetirementParams(testProfile);
paramsNoGuardrails.useGuardrails = false;

// Run a short simulation to see cash flows
const resultNoGuardrails = runRetirementMonteCarloSimulation(paramsNoGuardrails, 100);

console.log('Results WITHOUT guardrails:');
console.log('  Success Rate: ' + resultNoGuardrails.probabilityOfSuccess.toFixed(1) + '%');
console.log('  Median Ending Balance: $' + resultNoGuardrails.medianEndingBalance.toLocaleString());
console.log('  Safe Withdrawal Rate: ' + (resultNoGuardrails.safeWithdrawalRate * 100).toFixed(2) + '%');

// Look at first few years of cash flows from median scenario
if (resultNoGuardrails.yearlyCashFlows && resultNoGuardrails.yearlyCashFlows.length > 0) {
  console.log('\n  Sample withdrawals (first 5 years):');
  for (let i = 0; i < Math.min(5, resultNoGuardrails.yearlyCashFlows.length); i++) {
    const cf = resultNoGuardrails.yearlyCashFlows[i];
    console.log(`    Year ${cf.year}: Withdrawal = $${cf.withdrawal.toLocaleString()}, Portfolio = $${cf.portfolioBalance.toLocaleString()}`);
  }
}

// Test WITH guardrails
console.log('\n\n=== TEST 2: With Guardrails ===\n');
const paramsWithGuardrails = profileToRetirementParams(testProfile);
paramsWithGuardrails.useGuardrails = true;

const resultWithGuardrails = runRetirementMonteCarloSimulation(paramsWithGuardrails, 100);

console.log('Results WITH guardrails:');
console.log('  Success Rate: ' + resultWithGuardrails.probabilityOfSuccess.toFixed(1) + '%');
console.log('  Median Ending Balance: $' + resultWithGuardrails.medianEndingBalance.toLocaleString());
console.log('  Safe Withdrawal Rate: ' + (resultWithGuardrails.safeWithdrawalRate * 100).toFixed(2) + '%');

// Look at first few years of cash flows
if (resultWithGuardrails.yearlyCashFlows && resultWithGuardrails.yearlyCashFlows.length > 0) {
  console.log('\n  Sample withdrawals (first 5 years):');
  for (let i = 0; i < Math.min(5, resultWithGuardrails.yearlyCashFlows.length); i++) {
    const cf = resultWithGuardrails.yearlyCashFlows[i];
    console.log(`    Year ${cf.year}: Withdrawal = $${cf.withdrawal.toLocaleString()}, Portfolio = $${cf.portfolioBalance.toLocaleString()}`);
  }
}

// Test enhanced Monte Carlo with guardrails
console.log('\n\n=== TEST 3: Enhanced Monte Carlo with Guardrails ===\n');

const enhancedResult = runEnhancedMonteCarloSimulation(paramsWithGuardrails, 100);

console.log('Enhanced Results WITH guardrails:');
console.log('  Success Rate: ' + enhancedResult.probabilityOfSuccess.toFixed(1) + '%');
console.log('  Median Ending Balance: $' + enhancedResult.medianEndingBalance.toLocaleString());

// Check for Guyton-Klinger adjustments
if (enhancedResult.guytonKlingerStats) {
  console.log('\n  Guyton-Klinger Statistics:');
  console.log('    Average adjustments per scenario: ' + enhancedResult.guytonKlingerStats.averageAdjustmentsPerScenario.toFixed(2));
  console.log('    Adjustment breakdown:');
  for (const [type, count] of Object.entries(enhancedResult.guytonKlingerStats.adjustmentTypeBreakdown)) {
    console.log(`      ${type}: ${count}`);
  }
}

// Look at cash flows to see if adjustments are applied
if (enhancedResult.yearlyCashFlows && enhancedResult.yearlyCashFlows.length > 0) {
  console.log('\n  Sample withdrawals with adjustment reasons (first 10 years):');
  for (let i = 0; i < Math.min(10, enhancedResult.yearlyCashFlows.length); i++) {
    const cf = enhancedResult.yearlyCashFlows[i];
    const adjustment = cf.adjustmentType || 'none';
    const reason = cf.adjustmentReason || '';
    console.log(`    Year ${cf.year}: Withdrawal = $${cf.withdrawal.toLocaleString()}, ` +
                `Portfolio = $${cf.portfolioBalance.toLocaleString()}`);
    if (adjustment !== 'none' && adjustment !== 'inflation') {
      console.log(`      -> ${adjustment}: ${reason}`);
    }
  }
}

console.log('\n\n=== EXPECTED RESULTS ===');
console.log('• WITH guardrails should show HIGHER success rate than without');
console.log('• Guardrails should trigger spending CUTS when portfolio declines');
console.log('• Capital preservation rules should reduce withdrawals by 10%');
console.log('• Portfolio management rules should skip inflation adjustments in bad years');
console.log('• These adjustments should help the portfolio last longer');

console.log('\n=== FIX VERIFICATION ===');
const improvementRate = resultWithGuardrails.probabilityOfSuccess - resultNoGuardrails.probabilityOfSuccess;
if (improvementRate > 0) {
  console.log(`✓ SUCCESS: Guardrails improved success rate by ${improvementRate.toFixed(1)}%`);
} else {
  console.log(`✗ PROBLEM: Guardrails did not improve success rate (difference: ${improvementRate.toFixed(1)}%)`);
  console.log('  This suggests guardrail adjustments may not be properly applied');
}

if (enhancedResult.guytonKlingerStats && enhancedResult.guytonKlingerStats.averageAdjustmentsPerScenario > 0) {
  console.log('✓ Guyton-Klinger adjustments are being triggered');
} else {
  console.log('✗ No Guyton-Klinger adjustments detected');
}