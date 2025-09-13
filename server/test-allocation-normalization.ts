#!/usr/bin/env npx tsx

import { InvestmentCategorizer } from './services/investment-categorizer';

// Test data with various rounding scenarios
const testCases = [
  {
    name: 'Rounding causes total > 100',
    input: {
      stocks: 33.333,
      bonds: 33.333,
      cash: 33.334,
      alternatives: 0
    },
    expected: 'Total should be exactly 100%'
  },
  {
    name: 'Heavy stocks allocation',
    input: {
      stocks: 85.4,
      bonds: 10.3,
      cash: 4.3,
      alternatives: 0
    },
    expected: 'Total should be exactly 100%'
  },
  {
    name: 'All categories with rounding issues',
    input: {
      stocks: 40.7,
      bonds: 30.2,
      cash: 19.8,
      alternatives: 9.3
    },
    expected: 'Total should be exactly 100%'
  },
  {
    name: 'Edge case: 99% total before rounding',
    input: {
      stocks: 49.4,
      bonds: 49.4,
      cash: 0.2,
      alternatives: 0
    },
    expected: 'Total should be exactly 100%'
  },
  {
    name: 'Edge case: 101% total after rounding',
    input: {
      stocks: 33.6,
      bonds: 33.6,
      cash: 33.8,
      alternatives: 0
    },
    expected: 'Total should be exactly 100%'
  }
];

// Access private method through any type cast for testing
const normalizeAllocation = (allocation: any) => {
  // Since normalizeAllocation is private, we'll test through the public calculateAllocation method
  // by creating mock holdings data
  const totalValue = 100000; // $100k total for easy percentage calculation
  
  const mockHoldings = [];
  
  // Create mock holdings based on input percentages
  if (allocation.stocks > 0) {
    mockHoldings.push({
      accountId: 'test1',
      securityId: 'stock1',
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF',
      quantity: 100,
      value: (allocation.stocks / 100) * totalValue,
      category: 'stocks' as const,
      owner: 'User' as const,
      accountName: 'Test Account',
      accountType: 'investment',
      accountSubtype: 'brokerage'
    });
  }
  
  if (allocation.bonds > 0) {
    mockHoldings.push({
      accountId: 'test1',
      securityId: 'bond1',
      symbol: 'BND',
      name: 'Vanguard Total Bond Market ETF',
      quantity: 100,
      value: (allocation.bonds / 100) * totalValue,
      category: 'bonds' as const,
      owner: 'User' as const,
      accountName: 'Test Account',
      accountType: 'investment',
      accountSubtype: 'brokerage'
    });
  }
  
  if (allocation.cash > 0) {
    mockHoldings.push({
      accountId: 'test1',
      securityId: 'cash1',
      symbol: 'CASH',
      name: 'Cash',
      quantity: 1,
      value: (allocation.cash / 100) * totalValue,
      category: 'cash' as const,
      owner: 'User' as const,
      accountName: 'Test Account',
      accountType: 'investment',
      accountSubtype: 'brokerage'
    });
  }
  
  if (allocation.alternatives > 0) {
    mockHoldings.push({
      accountId: 'test1',
      securityId: 'alt1',
      symbol: 'REIT',
      name: 'Real Estate Investment Trust',
      quantity: 100,
      value: (allocation.alternatives / 100) * totalValue,
      category: 'alternatives' as const,
      owner: 'User' as const,
      accountName: 'Test Account',
      accountType: 'investment',
      accountSubtype: 'brokerage'
    });
  }
  
  // Use the public method to test normalization
  const result = (InvestmentCategorizer as any).calculateAllocation(mockHoldings);
  return result.User;
};

console.log('🧪 Testing Allocation Normalization\n');
console.log('=' .repeat(60));

let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.name}`);
  console.log('Input:', testCase.input);
  
  // First show what rounding would give us
  const rounded = {
    stocks: Math.round(testCase.input.stocks),
    bonds: Math.round(testCase.input.bonds),
    cash: Math.round(testCase.input.cash),
    alternatives: Math.round(testCase.input.alternatives)
  };
  
  const roundedTotal = rounded.stocks + rounded.bonds + rounded.cash + rounded.alternatives;
  console.log('After Math.round():', rounded);
  console.log('Rounded total:', roundedTotal, roundedTotal === 100 ? '✅' : `❌ (off by ${roundedTotal - 100})`);
  
  // Now test our normalization
  const normalized = normalizeAllocation(testCase.input);
  const normalizedTotal = normalized.stocks + normalized.bonds + normalized.cash + normalized.alternatives;
  
  console.log('After normalization:', normalized);
  console.log('Normalized total:', normalizedTotal);
  
  if (normalizedTotal === 100) {
    console.log('✅ PASS:', testCase.expected);
    passedTests++;
  } else {
    console.log('❌ FAIL: Total is', normalizedTotal, 'instead of 100');
    failedTests++;
  }
  
  // Show what was adjusted
  const adjustments = {
    stocks: normalized.stocks - rounded.stocks,
    bonds: normalized.bonds - rounded.bonds,
    cash: normalized.cash - rounded.cash,
    alternatives: normalized.alternatives - rounded.alternatives
  };
  
  const adjusted = Object.entries(adjustments)
    .filter(([_, value]) => value !== 0)
    .map(([key, value]) => `${key}: ${value > 0 ? '+' : ''}${value}`)
    .join(', ');
  
  if (adjusted) {
    console.log('Adjustments made:', adjusted);
  }
});

console.log('\n' + '=' .repeat(60));
console.log(`\n📊 Test Results: ${passedTests} passed, ${failedTests} failed\n`);

// Test real-world scenario with actual Plaid data structure
console.log('\n🌟 Real-World Test: Multiple Accounts with Different Owners\n');
console.log('=' .repeat(60));

const realWorldHoldings = [
  // User's 401k - heavy stocks
  { value: 150000, category: 'stocks' as const, owner: 'User' as const },
  { value: 50000, category: 'bonds' as const, owner: 'User' as const },
  
  // Spouse's IRA - balanced
  { value: 40000, category: 'stocks' as const, owner: 'Spouse' as const },
  { value: 30000, category: 'bonds' as const, owner: 'Spouse' as const },
  { value: 10000, category: 'cash' as const, owner: 'Spouse' as const },
  
  // Joint brokerage - conservative
  { value: 25000, category: 'stocks' as const, owner: 'Joint' as const },
  { value: 25000, category: 'bonds' as const, owner: 'Joint' as const },
  { value: 20000, category: 'cash' as const, owner: 'Joint' as const },
  { value: 5000, category: 'alternatives' as const, owner: 'Joint' as const }
].map((h, i) => ({
  ...h,
  accountId: `acc${i}`,
  securityId: `sec${i}`,
  symbol: `SYM${i}`,
  name: `Security ${i}`,
  quantity: 100,
  accountName: `Account ${i}`,
  accountType: 'investment',
  accountSubtype: 'brokerage'
}));

const realWorldResult = (InvestmentCategorizer as any).calculateAllocation(realWorldHoldings);

console.log('\nPortfolio Totals:');
console.log('User: $200,000');
console.log('Spouse: $80,000');
console.log('Joint: $75,000');
console.log('Total: $355,000');

console.log('\nCalculated Allocations:');
['User', 'Spouse', 'Joint', 'Total'].forEach(owner => {
  const alloc = realWorldResult[owner];
  const total = alloc.stocks + alloc.bonds + alloc.cash + alloc.alternatives;
  console.log(`\n${owner}:`);
  console.log(`  Stocks: ${alloc.stocks}%`);
  console.log(`  Bonds: ${alloc.bonds}%`);
  console.log(`  Cash: ${alloc.cash}%`);
  console.log(`  Alternatives: ${alloc.alternatives}%`);
  console.log(`  Total: ${total}% ${total === 100 ? '✅' : '❌'}`);
});

if (realWorldResult.User.stocks + realWorldResult.User.bonds + realWorldResult.User.cash + realWorldResult.User.alternatives === 100 &&
    realWorldResult.Spouse.stocks + realWorldResult.Spouse.bonds + realWorldResult.Spouse.cash + realWorldResult.Spouse.alternatives === 100 &&
    realWorldResult.Joint.stocks + realWorldResult.Joint.bonds + realWorldResult.Joint.cash + realWorldResult.Joint.alternatives === 100 &&
    realWorldResult.Total.stocks + realWorldResult.Total.bonds + realWorldResult.Total.cash + realWorldResult.Total.alternatives === 100) {
  console.log('\n✅ All allocations sum to exactly 100%!');
} else {
  console.log('\n❌ Some allocations do not sum to 100%');
}

console.log('\n✨ Test completed successfully!\n');