#!/usr/bin/env npx tsx

import { InvestmentCategorizer } from './services/investment-categorizer';
import type { Security, Holding } from 'plaid';

// Mock Plaid securities data (real-world examples)
const mockSecurities: Security[] = [
  // Stocks/ETFs
  {
    security_id: 'sec_spy',
    ticker_symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    type: 'etf',
    close_price: 450.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  {
    security_id: 'sec_vti',
    ticker_symbol: 'VTI',
    name: 'Vanguard Total Stock Market ETF',
    type: 'etf',
    close_price: 220.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  {
    security_id: 'sec_aapl',
    ticker_symbol: 'AAPL',
    name: 'Apple Inc',
    type: 'equity',
    close_price: 185.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  {
    security_id: 'sec_vxus',
    ticker_symbol: 'VXUS',
    name: 'Vanguard Total International Stock ETF',
    type: 'etf',
    close_price: 58.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  
  // Bonds
  {
    security_id: 'sec_bnd',
    ticker_symbol: 'BND',
    name: 'Vanguard Total Bond Market ETF',
    type: 'etf',
    close_price: 72.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  {
    security_id: 'sec_agg',
    ticker_symbol: 'AGG',
    name: 'iShares Core US Aggregate Bond ETF',
    type: 'etf',
    close_price: 98.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  {
    security_id: 'sec_tlt',
    ticker_symbol: 'TLT',
    name: 'iShares 20+ Year Treasury Bond ETF',
    type: 'fixed_income',
    close_price: 92.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  
  // Cash/Money Market
  {
    security_id: 'sec_vmfxx',
    ticker_symbol: 'VMFXX',
    name: 'Vanguard Federal Money Market Fund',
    type: 'cash',
    close_price: 1.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  {
    security_id: 'sec_cash',
    ticker_symbol: null,
    name: 'Cash',
    type: 'cash',
    close_price: 1.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  
  // Alternatives
  {
    security_id: 'sec_vnq',
    ticker_symbol: 'VNQ',
    name: 'Vanguard Real Estate ETF',
    type: 'etf',
    close_price: 85.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  {
    security_id: 'sec_gld',
    ticker_symbol: 'GLD',
    name: 'SPDR Gold Shares',
    type: 'etf',
    close_price: 188.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  },
  {
    security_id: 'sec_btc',
    ticker_symbol: 'BTC',
    name: 'Bitcoin',
    type: 'cryptocurrency',
    close_price: 42000.00,
    close_price_as_of: '2024-01-15',
    iso_currency_code: 'USD'
  }
];

// Test scenarios with different portfolio compositions
const testScenarios = [
  {
    name: 'Balanced Portfolio (60/40)',
    holdings: [
      { security_id: 'sec_spy', quantity: 100, value: 45000 },    // Stocks: 45%
      { security_id: 'sec_vti', quantity: 68, value: 15000 },     // Stocks: 15%
      { security_id: 'sec_bnd', quantity: 556, value: 40000 },    // Bonds: 40%
    ]
  },
  {
    name: 'Aggressive Growth Portfolio',
    holdings: [
      { security_id: 'sec_spy', quantity: 111, value: 50000 },    // Stocks
      { security_id: 'sec_vti', quantity: 136, value: 30000 },    // Stocks
      { security_id: 'sec_aapl', quantity: 54, value: 10000 },    // Stocks
      { security_id: 'sec_bnd', quantity: 70, value: 5000 },      // Bonds
      { security_id: 'sec_vmfxx', quantity: 5000, value: 5000 },  // Cash
    ]
  },
  {
    name: 'Conservative Portfolio',
    holdings: [
      { security_id: 'sec_spy', quantity: 44, value: 20000 },     // Stocks: 20%
      { security_id: 'sec_bnd', quantity: 417, value: 30000 },    // Bonds: 30%
      { security_id: 'sec_agg', quantity: 306, value: 30000 },    // Bonds: 30%
      { security_id: 'sec_vmfxx', quantity: 20000, value: 20000 },// Cash: 20%
    ]
  },
  {
    name: 'Complex Multi-Asset Portfolio',
    holdings: [
      { security_id: 'sec_spy', quantity: 67, value: 30000 },     // Stocks
      { security_id: 'sec_vxus', quantity: 259, value: 15000 },   // Stocks (intl)
      { security_id: 'sec_aapl', quantity: 27, value: 5000 },     // Stocks
      { security_id: 'sec_bnd', quantity: 278, value: 20000 },    // Bonds
      { security_id: 'sec_tlt', quantity: 109, value: 10000 },    // Bonds
      { security_id: 'sec_cash', quantity: 8000, value: 8000 },   // Cash
      { security_id: 'sec_vnq', quantity: 94, value: 8000 },      // Alternatives (REIT)
      { security_id: 'sec_gld', quantity: 21, value: 4000 },      // Alternatives (Gold)
    ]
  },
  {
    name: 'Crypto-Inclusive Portfolio',
    holdings: [
      { security_id: 'sec_spy', quantity: 133, value: 60000 },    // Stocks
      { security_id: 'sec_bnd', quantity: 347, value: 25000 },    // Bonds
      { security_id: 'sec_cash', quantity: 5000, value: 5000 },   // Cash
      { security_id: 'sec_btc', quantity: 0.238, value: 10000 },  // Crypto (Alternatives)
    ]
  }
];

// Helper to create mock categorized holdings
function createMockHoldings(testHoldings: any[], securities: Security[]): any[] {
  const securityMap = new Map(securities.map(s => [s.security_id, s]));
  
  return testHoldings.map(h => {
    const security = securityMap.get(h.security_id)!;
    const category = (InvestmentCategorizer as any).categorizeSecurity(security);
    
    return {
      accountId: 'test_account',
      securityId: h.security_id,
      symbol: security.ticker_symbol,
      name: security.name,
      quantity: h.quantity,
      value: h.value,
      category,
      owner: 'User',
      accountName: 'Test Investment Account',
      accountType: 'investment',
      accountSubtype: 'brokerage'
    };
  });
}

console.log('🔍 Testing Plaid Allocation Accuracy\n');
console.log('=' .repeat(70));

let allTestsPassed = true;

testScenarios.forEach((scenario, index) => {
  console.log(`\n📊 Test ${index + 1}: ${scenario.name}`);
  console.log('-'.repeat(50));
  
  // Calculate expected percentages manually
  const totalValue = scenario.holdings.reduce((sum, h) => sum + h.value, 0);
  console.log(`Total Portfolio Value: $${totalValue.toLocaleString()}\n`);
  
  // Group by category manually to calculate expected
  const securityMap = new Map(mockSecurities.map(s => [s.security_id, s]));
  const categoryTotals = {
    stocks: 0,
    bonds: 0,
    cash: 0,
    alternatives: 0
  };
  
  console.log('Holdings Breakdown:');
  scenario.holdings.forEach(holding => {
    const security = securityMap.get(holding.security_id)!;
    const type = security.type?.toLowerCase() || '';
    const name = security.name?.toLowerCase() || '';
    const symbol = security.ticker_symbol?.toLowerCase() || '';
    
    let category: string;
    // Match the exact categorization logic from InvestmentCategorizer
    if (type === 'cash' || name.includes('money market')) {
      category = 'cash';
      categoryTotals.cash += holding.value;
    } else if (type === 'fixed_income' || symbol === 'bnd' || symbol === 'agg' || symbol === 'tlt') {
      category = 'bonds';
      categoryTotals.bonds += holding.value;
    } else if (type === 'cryptocurrency') {
      category = 'alternatives';
      categoryTotals.alternatives += holding.value;
    } else if (name.includes('reit') || name.includes('real estate')) {
      // REITs are correctly categorized as alternatives
      category = 'alternatives';
      categoryTotals.alternatives += holding.value;
    } else if (name.includes('gold') || symbol === 'gld') {
      // Gold/commodities are alternatives
      category = 'alternatives';
      categoryTotals.alternatives += holding.value;
    } else {
      // Everything else (ETFs, equities, mutual funds) defaults to stocks
      category = 'stocks';
      categoryTotals.stocks += holding.value;
    }
    
    console.log(`  ${security.ticker_symbol || 'CASH'}: $${holding.value.toLocaleString()} (${category}) - ${(holding.value / totalValue * 100).toFixed(1)}%`);
  });
  
  // Calculate expected percentages
  const expectedPercentages = {
    stocks: (categoryTotals.stocks / totalValue * 100),
    bonds: (categoryTotals.bonds / totalValue * 100),
    cash: (categoryTotals.cash / totalValue * 100),
    alternatives: (categoryTotals.alternatives / totalValue * 100)
  };
  
  console.log('\nExpected Allocation (precise):');
  console.log(`  Stocks: ${expectedPercentages.stocks.toFixed(2)}% ($${categoryTotals.stocks.toLocaleString()})`);
  console.log(`  Bonds: ${expectedPercentages.bonds.toFixed(2)}% ($${categoryTotals.bonds.toLocaleString()})`);
  console.log(`  Cash: ${expectedPercentages.cash.toFixed(2)}% ($${categoryTotals.cash.toLocaleString()})`);
  console.log(`  Alternatives: ${expectedPercentages.alternatives.toFixed(2)}% ($${categoryTotals.alternatives.toLocaleString()})`);
  
  // Now test with InvestmentCategorizer
  const mockHoldings = createMockHoldings(scenario.holdings, mockSecurities);
  const result = (InvestmentCategorizer as any).calculateAllocation(mockHoldings);
  const calculatedAllocation = result.User;
  
  console.log('\nCalculated Allocation (after normalization):');
  console.log(`  Stocks: ${calculatedAllocation.stocks}%`);
  console.log(`  Bonds: ${calculatedAllocation.bonds}%`);
  console.log(`  Cash: ${calculatedAllocation.cash}%`);
  console.log(`  Alternatives: ${calculatedAllocation.alternatives}%`);
  console.log(`  Total: ${calculatedAllocation.stocks + calculatedAllocation.bonds + calculatedAllocation.cash + calculatedAllocation.alternatives}%`);
  
  // Verify accuracy (within 1% due to rounding)
  const tolerance = 1; // Allow 1% difference due to rounding
  const errors: string[] = [];
  
  Object.keys(expectedPercentages).forEach(category => {
    const expected = Math.round(expectedPercentages[category as keyof typeof expectedPercentages]);
    const actual = calculatedAllocation[category as keyof typeof calculatedAllocation];
    const diff = Math.abs(expected - actual);
    
    if (diff > tolerance) {
      errors.push(`${category}: expected ${expected}%, got ${actual}% (diff: ${diff}%)`);
    }
  });
  
  if (errors.length > 0) {
    console.log('\n❌ ACCURACY ISSUES:');
    errors.forEach(e => console.log(`  - ${e}`));
    allTestsPassed = false;
  } else {
    console.log('\n✅ Allocation matches expected values (within rounding tolerance)');
  }
  
  // Verify total is exactly 100%
  const total = calculatedAllocation.stocks + calculatedAllocation.bonds + calculatedAllocation.cash + calculatedAllocation.alternatives;
  if (total !== 100) {
    console.log(`❌ Total is ${total}% instead of 100%`);
    allTestsPassed = false;
  }
});

// Test intake form data flow
console.log('\n' + '=' .repeat(70));
console.log('\n🔄 Testing Intake Form Data Flow\n');

const intakeFormTest = {
  holdings: [
    { security_id: 'sec_spy', quantity: 222, value: 100000 },   // 50% stocks
    { security_id: 'sec_bnd', quantity: 694, value: 50000 },    // 25% bonds
    { security_id: 'sec_agg', quantity: 255, value: 25000 },    // 12.5% bonds
    { security_id: 'sec_cash', quantity: 25000, value: 25000 }, // 12.5% cash
  ]
};

const mockHoldings = createMockHoldings(intakeFormTest.holdings, mockSecurities);
const result = (InvestmentCategorizer as any).calculateAllocation(mockHoldings);

console.log('Mock API Response Structure:');
console.log(JSON.stringify({
  success: true,
  allocation: result,
  totalValue: 200000,
  accountCount: 1,
  holdingsCount: intakeFormTest.holdings.length
}, null, 2));

console.log('\nIntake Form Would Receive:');
console.log('User Allocation:', result.User);
console.log('\nIntake Form Fields Would Be Set To:');
console.log(`  setValue('currentAllocation.usStocks', ${result.User.stocks});  // All stocks treated as US`);
console.log(`  setValue('currentAllocation.intlStocks', 0);`);
console.log(`  setValue('currentAllocation.bonds', ${result.User.bonds});`);
console.log(`  setValue('currentAllocation.alternatives', ${result.User.alternatives});`);
console.log(`  setValue('currentAllocation.cash', ${result.User.cash});`);

const intakeTotal = result.User.stocks + 0 + result.User.bonds + result.User.alternatives + result.User.cash;
console.log(`\nIntake Form Total: ${intakeTotal}% ${intakeTotal === 100 ? '✅' : '❌'}`);

// Summary
console.log('\n' + '=' .repeat(70));
if (allTestsPassed) {
  console.log('\n✅ All tests passed! Allocation import is accurate and totals exactly 100%.\n');
} else {
  console.log('\n❌ Some tests failed. Please review the accuracy issues above.\n');
}

// Additional validation test
console.log('🧮 Edge Case Testing: Extreme Allocations\n');
console.log('=' .repeat(70));

const edgeCases = [
  {
    name: '100% Stocks',
    holdings: [{ security_id: 'sec_spy', quantity: 222, value: 100000 }]
  },
  {
    name: '100% Cash',
    holdings: [{ security_id: 'sec_cash', quantity: 100000, value: 100000 }]
  },
  {
    name: 'Equal 25% Split',
    holdings: [
      { security_id: 'sec_spy', quantity: 56, value: 25000 },
      { security_id: 'sec_bnd', quantity: 347, value: 25000 },
      { security_id: 'sec_cash', quantity: 25000, value: 25000 },
      { security_id: 'sec_vnq', quantity: 294, value: 25000 }
    ]
  }
];

edgeCases.forEach(testCase => {
  console.log(`\n${testCase.name}:`);
  const holdings = createMockHoldings(testCase.holdings, mockSecurities);
  const allocation = (InvestmentCategorizer as any).calculateAllocation(holdings).User;
  const total = allocation.stocks + allocation.bonds + allocation.cash + allocation.alternatives;
  
  console.log(`  Stocks: ${allocation.stocks}%, Bonds: ${allocation.bonds}%, Cash: ${allocation.cash}%, Alternatives: ${allocation.alternatives}%`);
  console.log(`  Total: ${total}% ${total === 100 ? '✅' : '❌'}`);
});

console.log('\n✨ Allocation accuracy test complete!\n');