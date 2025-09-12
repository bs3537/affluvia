// Tax Conformance Tests for Year-Aware Tax Calculations
// Validates tax calculations against known IRS examples and edge cases

import { 
  getTaxConfig, 
  calculateFederalTaxWithYear,
  calculateCapitalGainsTaxWithYear,
  calculateIRMAAWithYear 
} from './tax-year-config.js';

interface TestCase {
  name: string;
  input: any;
  expected: number;
  tolerance?: number;
}

// Test cases for 2024 federal tax calculations
const FEDERAL_TAX_TESTS_2024: TestCase[] = [
  // Single filers
  {
    name: "Single - Standard deduction only",
    input: { income: 10000, status: 'single', year: 2024 },
    expected: 0, // Below standard deduction
    tolerance: 0.01
  },
  {
    name: "Single - First bracket",
    input: { income: 25000, status: 'single', year: 2024 },
    expected: 1040, // (25000-14600)*0.10 = 1040
    tolerance: 1
  },
  {
    name: "Single - Multiple brackets",
    input: { income: 100000, status: 'single', year: 2024 },
    expected: 17400, // Complex calculation across brackets
    tolerance: 10
  },
  
  // Married filing jointly
  {
    name: "MFJ - Standard deduction only", 
    input: { income: 25000, status: 'married', year: 2024 },
    expected: 0, // Below standard deduction of 29200
    tolerance: 0.01
  },
  {
    name: "MFJ - First bracket",
    input: { income: 50000, status: 'married', year: 2024 },
    expected: 2080, // (50000-29200)*0.10 = 2080
    tolerance: 1
  },
  {
    name: "MFJ - Multiple brackets",
    input: { income: 200000, status: 'married', year: 2024 },
    expected: 32580, // Complex calculation across brackets
    tolerance: 20
  }
];

// Test cases for capital gains tax
const LTCG_TAX_TESTS_2024: TestCase[] = [
  // Single filers - 0% bracket
  {
    name: "Single - 0% LTCG bracket",
    input: { gains: 20000, ordinary: 25000, status: 'single', year: 2024 },
    expected: 0, // Total income 45000 < 47025 threshold
    tolerance: 0.01
  },
  
  // Single filers - 15% bracket
  {
    name: "Single - 15% LTCG bracket",
    input: { gains: 50000, ordinary: 60000, status: 'single', year: 2024 },
    expected: 7500, // All gains at 15%
    tolerance: 10
  },
  
  // With NIIT
  {
    name: "Single - LTCG with NIIT",
    input: { gains: 100000, ordinary: 150000, status: 'single', year: 2024 },
    expected: 23800, // 20000*0.20 + 80000*0.15 + 50000*0.038 (NIIT)
    tolerance: 50
  },
  
  // MFJ cases
  {
    name: "MFJ - 0% LTCG bracket",
    input: { gains: 40000, ordinary: 50000, status: 'married', year: 2024 },
    expected: 0, // Total income 90000 < 94050 threshold
    tolerance: 0.01
  }
];

// Test cases for IRMAA calculations
const IRMAA_TESTS_2024: TestCase[] = [
  // Standard (no surcharge)
  {
    name: "Single - Standard IRMAA",
    input: { magi: 90000, status: 'single', year: 2024 },
    expected: 174.70, // Base Part B premium
    tolerance: 0.01
  },
  
  // First tier surcharge
  {
    name: "Single - Tier 1 IRMAA",
    input: { magi: 115000, status: 'single', year: 2024 },
    expected: 244.60, // Tier 1 surcharge
    tolerance: 0.01
  },
  
  // MFJ cases
  {
    name: "MFJ - Standard IRMAA", 
    input: { magi: 150000, status: 'married', year: 2024 },
    expected: 174.70, // Below MFJ threshold of 206000
    tolerance: 0.01
  },
  
  {
    name: "MFJ - Tier 1 IRMAA",
    input: { magi: 230000, status: 'married', year: 2024 },
    expected: 244.60, // First MFJ tier
    tolerance: 0.01
  }
];

// Test inflation indexing for future years
const INFLATION_INDEXING_TESTS: TestCase[] = [
  {
    name: "2025 tax with 3% inflation",
    input: { income: 50000, status: 'single', year: 2025 },
    expected: 3665, // Should be higher than 2024 due to indexed brackets
    tolerance: 50
  },
  
  {
    name: "2030 LTCG with cumulative inflation", 
    input: { gains: 50000, ordinary: 60000, status: 'single', year: 2030 },
    expected: 7000, // Indexed thresholds should reduce effective rate
    tolerance: 200
  }
];

// Test runner function
function runTaxConformanceTests(): void {
  console.log('🧪 Running Tax Conformance Tests...\n');
  
  let totalTests = 0;
  let passedTests = 0;
  
  // Federal tax tests
  console.log('📊 Federal Tax Tests (2024):');
  for (const test of FEDERAL_TAX_TESTS_2024) {
    totalTests++;
    const { income, status, year } = test.input;
    const result = calculateFederalTaxWithYear(income, status, year);
    const tolerance = test.tolerance || 1;
    const passed = Math.abs(result - test.expected) <= tolerance;
    
    console.log(`  ${passed ? '✅' : '❌'} ${test.name}`);
    if (!passed) {
      console.log(`     Expected: $${test.expected.toFixed(2)}, Got: $${result.toFixed(2)}, Diff: $${Math.abs(result - test.expected).toFixed(2)}`);
    }
    
    if (passed) passedTests++;
  }
  
  // Capital gains tax tests
  console.log('\n📈 Capital Gains Tax Tests (2024):');
  for (const test of LTCG_TAX_TESTS_2024) {
    totalTests++;
    const { gains, ordinary, status, year } = test.input;
    const result = calculateCapitalGainsTaxWithYear(gains, ordinary, status, year);
    const tolerance = test.tolerance || 1;
    const passed = Math.abs(result - test.expected) <= tolerance;
    
    console.log(`  ${passed ? '✅' : '❌'} ${test.name}`);
    if (!passed) {
      console.log(`     Expected: $${test.expected.toFixed(2)}, Got: $${result.toFixed(2)}, Diff: $${Math.abs(result - test.expected).toFixed(2)}`);
    }
    
    if (passed) passedTests++;
  }
  
  // IRMAA tests
  console.log('\n🏥 IRMAA Tests (2024):');
  for (const test of IRMAA_TESTS_2024) {
    totalTests++;
    const { magi, status, year } = test.input;
    const result = calculateIRMAAWithYear(magi, status, year);
    const tolerance = test.tolerance || 0.01;
    const passed = Math.abs(result.partBPremium - test.expected) <= tolerance;
    
    console.log(`  ${passed ? '✅' : '❌'} ${test.name}`);
    if (!passed) {
      console.log(`     Expected: $${test.expected.toFixed(2)}, Got: $${result.partBPremium.toFixed(2)}, Diff: $${Math.abs(result.partBPremium - test.expected).toFixed(2)}`);
    }
    
    if (passed) passedTests++;
  }
  
  // Inflation indexing tests
  console.log('\n📊 Inflation Indexing Tests:');
  for (const test of INFLATION_INDEXING_TESTS) {
    totalTests++;
    const { income, gains, ordinary, status, year } = test.input;
    
    let result: number;
    if (gains !== undefined) {
      result = calculateCapitalGainsTaxWithYear(gains, ordinary, status, year);
    } else {
      result = calculateFederalTaxWithYear(income, status, year);
    }
    
    const tolerance = test.tolerance || 10;
    const passed = Math.abs(result - test.expected) <= tolerance;
    
    console.log(`  ${passed ? '✅' : '❌'} ${test.name}`);
    if (!passed) {
      console.log(`     Expected: $${test.expected.toFixed(2)}, Got: $${result.toFixed(2)}, Diff: $${Math.abs(result - test.expected).toFixed(2)}`);
    }
    
    if (passed) passedTests++;
  }
  
  // Summary
  const passRate = (passedTests / totalTests * 100).toFixed(1);
  console.log(`\n📋 Test Summary:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} (${passRate}%)`);
  console.log(`   Failed: ${totalTests - passedTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tax conformance tests passed!');
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} tests failed. Review tax calculation logic.`);
  }
}

// Configuration validation tests
function validateTaxConfigStructure(): void {
  console.log('\n🔧 Validating Tax Configuration Structure...');
  
  const config2024 = getTaxConfig(2024);
  const config2025 = getTaxConfig(2025);
  const config2030 = getTaxConfig(2030);
  
  // Check required fields exist
  const requiredFields = ['federalBrackets', 'standardDeduction', 'ltcgBrackets', 'irmaaBrackets', 'irmaaBasePremium', 'niitThreshold'];
  
  for (const config of [config2024, config2025, config2030]) {
    for (const field of requiredFields) {
      if (!(field in config)) {
        console.log(`❌ Missing field: ${field} in year ${config.year}`);
        return;
      }
    }
  }
  
  // Check inflation indexing works
  const std2024 = config2024.standardDeduction.single;
  const std2025 = config2025.standardDeduction.single;
  const std2030 = config2030.standardDeduction.single;
  
  if (std2025 <= std2024 || std2030 <= std2025) {
    console.log('❌ Standard deduction not properly indexed for inflation');
    return;
  }
  
  console.log('✅ Tax configuration structure validation passed');
  console.log(`   2024 Standard Deduction (Single): $${std2024.toLocaleString()}`);
  console.log(`   2025 Standard Deduction (Single): $${std2025.toLocaleString()}`);
  console.log(`   2030 Standard Deduction (Single): $${std2030.toLocaleString()}`);
}

// Main test execution
function runAllTests() {
  validateTaxConfigStructure();
  runTaxConformanceTests();
}

// Auto-run if this is the main module
runAllTests();

export { runTaxConformanceTests, validateTaxConfigStructure };