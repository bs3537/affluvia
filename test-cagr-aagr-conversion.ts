import { 
  cagr2aagr, 
  aagr2cagr, 
  DEFAULT_RETURN_CONFIG,
  runEnhancedMonteCarloSimulation 
} from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

console.log('=== CAGR vs AAGR Conversion Test ===\n');

// Test 1: Conversion Functions
console.log('1. Testing Conversion Functions:');
console.log('================================');

const testCases = [
  { cagr: 0.10, volatility: 0.18, asset: 'US Stocks' },
  { cagr: 0.09, volatility: 0.20, asset: 'International Stocks' },
  { cagr: 0.05, volatility: 0.05, asset: 'Bonds' },
  { cagr: 0.08, volatility: 0.19, asset: 'REITs' },
  { cagr: 0.02, volatility: 0.01, asset: 'Cash' }
];

testCases.forEach(({ cagr, volatility, asset }) => {
  const aagr = cagr2aagr(cagr, volatility);
  const volatilityDrag = (volatility * volatility) / 2;
  const backToCagr = aagr2cagr(aagr, volatility);
  
  console.log(`\n${asset}:`);
  console.log(`  CAGR (Geometric): ${(cagr * 100).toFixed(2)}%`);
  console.log(`  Volatility: ${(volatility * 100).toFixed(2)}%`);
  console.log(`  Volatility Drag: ${(volatilityDrag * 100).toFixed(2)}%`);
  console.log(`  AAGR (Arithmetic): ${(aagr * 100).toFixed(2)}%`);
  console.log(`  Conversion Check: ${(backToCagr * 100).toFixed(2)}% (should match CAGR)`);
  console.log(`  ✓ Conversion accurate: ${Math.abs(backToCagr - cagr) < 0.0001}`);
});

// Test 2: Impact on Monte Carlo Simulation
console.log('\n\n2. Testing Impact on Monte Carlo Results:');
console.log('==========================================');

// Create a test retirement profile
const testParams: RetirementMonteCarloParams = {
  currentAge: 50,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentRetirementAssets: 500000,
  annualSavings: 20000,
  annualRetirementExpenses: 60000,
  annualGuaranteedIncome: 20000,
  expectedReturn: 0.07,  // 7% CAGR
  returnVolatility: 0.12, // 12% volatility
  inflationRate: 0.025,
  withdrawalRate: 0.04,
  stockAllocation: 0.60,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  taxRate: 0.22,
  filingStatus: 'single' as const,
  useGuardrails: true,
  // Add required assetBuckets
  assetBuckets: {
    taxDeferred: 350000,   // 70% in 401k/IRA
    taxFree: 100000,       // 20% in Roth IRA
    capitalGains: 50000,   // 10% in taxable accounts
    cashEquivalents: 0,
    totalAssets: 500000
  }
};

console.log('\nTest Profile:');
console.log(`  Current Age: ${testParams.currentAge}`);
console.log(`  Retirement Age: ${testParams.retirementAge}`);
console.log(`  Current Assets: $${testParams.currentRetirementAssets?.toLocaleString()}`);
console.log(`  Annual Savings: $${testParams.annualSavings?.toLocaleString()}`);
console.log(`  Expected Return: ${((testParams.expectedReturn || 0) * 100).toFixed(1)}% (CAGR)`);
console.log(`  Volatility: ${((testParams.returnVolatility || 0) * 100).toFixed(1)}%`);

// Run with CAGR input (default)
console.log('\n\nRunning Monte Carlo with CAGR input (100 iterations for speed)...');
const resultCAGR = runEnhancedMonteCarloSimulation(
  testParams, 
  100, 
  false,
  { 
    inputReturnType: 'CAGR',
    useArithmeticForMonteCarlo: true,
    useGeometricForProjections: true
  }
);

console.log('\nResults with CAGR input:');
console.log(`  Success Probability: ${(resultCAGR.successProbability * 100).toFixed(1)}%`);
console.log(`  Median Ending Balance: $${resultCAGR.medianEndingBalance.toLocaleString()}`);
console.log(`  10th Percentile: $${resultCAGR.percentile10EndingBalance.toLocaleString()}`);
console.log(`  90th Percentile: $${resultCAGR.percentile90EndingBalance.toLocaleString()}`);

// Run with AAGR input (for comparison)
const aagrReturn = cagr2aagr(testParams.expectedReturn || 0.07, testParams.returnVolatility || 0.12);
const testParamsAAGR = { ...testParams, expectedReturn: aagrReturn };

console.log('\n\nRunning Monte Carlo with AAGR input (100 iterations for speed)...');
console.log(`  Adjusted Expected Return: ${(aagrReturn * 100).toFixed(2)}% (AAGR)`);

const resultAAGR = runEnhancedMonteCarloSimulation(
  testParamsAAGR,
  100,
  false,
  {
    inputReturnType: 'AAGR',
    useArithmeticForMonteCarlo: true,
    useGeometricForProjections: true
  }
);

console.log('\nResults with AAGR input:');
console.log(`  Success Probability: ${(resultAAGR.successProbability * 100).toFixed(1)}%`);
console.log(`  Median Ending Balance: $${resultAAGR.medianEndingBalance.toLocaleString()}`);
console.log(`  10th Percentile: $${resultAAGR.percentile10EndingBalance.toLocaleString()}`);
console.log(`  90th Percentile: $${resultAAGR.percentile90EndingBalance.toLocaleString()}`);

// Test 3: Verify Volatility Drag Impact
console.log('\n\n3. Volatility Drag Impact Analysis:');
console.log('====================================');

const volatilityDrag = (testParams.returnVolatility! * testParams.returnVolatility!) / 2;
console.log(`\nFor a portfolio with:`);
console.log(`  CAGR: ${((testParams.expectedReturn || 0) * 100).toFixed(1)}%`);
console.log(`  Volatility: ${((testParams.returnVolatility || 0) * 100).toFixed(1)}%`);
console.log(`\nVolatility Drag: ${(volatilityDrag * 100).toFixed(2)}%`);
console.log(`AAGR for Monte Carlo: ${(aagrReturn * 100).toFixed(2)}%`);
console.log(`\nThis ${(volatilityDrag * 100).toFixed(2)}% adjustment ensures Monte Carlo`);
console.log('simulations properly account for the impact of volatility on compound returns.');

console.log('\n=== Test Complete ===');