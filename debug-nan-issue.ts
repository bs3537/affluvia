/**
 * Debug script to trace NaN propagation in Monte Carlo simulation
 */

import { runEnhancedRetirementScenario } from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';

// Minimal test params
function createMinimalParams(): RetirementMonteCarloParams {
  return {
    currentAge: 50,
    retirementAge: 65,
    lifeExpectancy: 85,
    currentRetirementAssets: 500000,
    annualRetirementExpenses: 60000,
    annualGuaranteedIncome: 0, // Start with 0 to simplify
    expectedReturn: 0.07,
    returnVolatility: 0.12,
    inflationRate: 0.025,
    stockAllocation: 0.6,
    bondAllocation: 0.3,
    cashAllocation: 0.1,
    withdrawalRate: 0.04,
    useGuardrails: false,
    taxRate: 0.22,
    filingStatus: 'single',
    retirementState: 'FL',
    assetBuckets: {
      taxDeferred: 500000,
      taxFree: 0,
      capitalGains: 0,
      cashEquivalents: 0,
      totalAssets: 500000
    }
  };
}

// Add tracing to key functions
function traceScenario() {
  console.log('=== NaN Debug Trace ===\n');
  
  const params = createMinimalParams();
  const seed = 12345;
  
  console.log('Initial Parameters:');
  console.log(`  Current Assets: ${params.currentRetirementAssets}`);
  console.log(`  Stock Allocation: ${params.stockAllocation}`);
  console.log(`  Bond Allocation: ${params.bondAllocation}`);
  console.log(`  Cash Allocation: ${params.cashAllocation}`);
  console.log(`  Expected Return: ${params.expectedReturn}`);
  console.log(`  Volatility: ${params.returnVolatility}\n`);
  
  // Monkey-patch console.warn to capture warnings
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => {
    warnings.push(msg);
    originalWarn(msg);
  };
  
  try {
    const result = runEnhancedRetirementScenario(params, undefined, [seed]);
    
    console.log('\nResult:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Ending Balance: ${result.endingBalance}`);
    console.log(`  Years Until Depletion: ${result.yearsUntilDepletion || 'Never'}`);
    
    // Check first few years cash flows
    console.log('\nFirst 5 Years Cash Flows:');
    for (let i = 0; i < Math.min(5, result.yearlyCashFlows.length); i++) {
      const cf = result.yearlyCashFlows[i];
      console.log(`  Year ${i + 1} (Age ${cf.age}): Balance = ${cf.portfolioBalance}, Return = ${cf.investmentReturn}`);
      
      // Check for NaN
      if (isNaN(cf.portfolioBalance)) {
        console.log(`    *** NaN DETECTED at year ${i + 1} ***`);
      }
    }
    
    if (warnings.length > 0) {
      console.log('\nWarnings captured:');
      warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    // Check for NaN in the result
    if (isNaN(result.endingBalance)) {
      console.log('\n*** ENDING BALANCE IS NaN ***');
      
      // Find first NaN occurrence
      for (let i = 0; i < result.yearlyCashFlows.length; i++) {
        const cf = result.yearlyCashFlows[i];
        if (isNaN(cf.portfolioBalance)) {
          console.log(`First NaN at year ${i + 1}, age ${cf.age}`);
          if (i > 0) {
            const prev = result.yearlyCashFlows[i - 1];
            console.log(`Previous year: Balance = ${prev.portfolioBalance}, Return = ${prev.investmentReturn}`);
          }
          break;
        }
      }
    }
    
  } catch (error) {
    console.log(`\nError during execution: ${error.message}`);
    console.log(error.stack);
  }
  
  // Restore console.warn
  console.warn = originalWarn;
}

// Test specific components
function testReturnGeneration() {
  console.log('\n=== Testing Return Generation ===\n');
  
  // Import the functions we need to test
  import('./server/rng').then(({ RNG }) => {
    import('./server/monte-carlo-enhanced').then((module) => {
      const rng = new RNG(12345);
      
      // Test the conversion functions
      const cagr = 0.07;
      const vol = 0.12;
      const aagr = module.cagr2aagr(cagr, vol);
      console.log(`CAGR to AAGR: ${cagr} -> ${aagr} (expected ~${cagr + vol*vol/2})`);
      
      const backToCagr = module.aagr2cagr(aagr, vol);
      console.log(`AAGR to CAGR: ${aagr} -> ${backToCagr} (should equal ${cagr})`);
      
      if (Math.abs(backToCagr - cagr) > 0.0001) {
        console.log('*** CONVERSION ERROR DETECTED ***');
      }
    });
  });
}

// Run the tests
console.log('Starting NaN Debug Investigation...\n');
traceScenario();
testReturnGeneration();