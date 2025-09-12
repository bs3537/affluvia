#!/usr/bin/env npx tsx

import { InvestmentCategorizer } from './services/investment-categorizer';
import type { Security } from 'plaid';

console.log('🎯 Testing CFP/RIA Asset Categorization Standards\n');
console.log('=' .repeat(70));

// Test securities covering all CFP/RIA categories
const testSecurities: Array<{ security: Security; expectedCategory: string; cfpRationale: string }> = [
  // === STOCKS (Core U.S. and International Equity) ===
  {
    security: { security_id: '1', ticker_symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf' } as Security,
    expectedCategory: 'stocks',
    cfpRationale: 'US large-cap equity ETF'
  },
  {
    security: { security_id: '2', ticker_symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', type: 'etf' } as Security,
    expectedCategory: 'stocks',
    cfpRationale: 'International equity ETF'
  },
  {
    security: { security_id: '3', ticker_symbol: 'AAPL', name: 'Apple Inc', type: 'equity' } as Security,
    expectedCategory: 'stocks',
    cfpRationale: 'Individual US equity'
  },
  {
    security: { security_id: '4', ticker_symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF', type: 'etf' } as Security,
    expectedCategory: 'stocks',
    cfpRationale: 'Emerging markets equity'
  },
  {
    security: { security_id: '5', ticker_symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf' } as Security,
    expectedCategory: 'stocks',
    cfpRationale: 'US technology sector equity ETF'
  },
  
  // === BONDS (Fixed Income Securities) ===
  {
    security: { security_id: '6', ticker_symbol: 'BND', name: 'Vanguard Total Bond Market ETF', type: 'etf' } as Security,
    expectedCategory: 'bonds',
    cfpRationale: 'Aggregate bond ETF'
  },
  {
    security: { security_id: '7', ticker_symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', type: 'fixed_income' } as Security,
    expectedCategory: 'bonds',
    cfpRationale: 'US Treasury bonds'
  },
  {
    security: { security_id: '8', ticker_symbol: 'HYG', name: 'iShares iBoxx High Yield Corporate Bond ETF', type: 'etf' } as Security,
    expectedCategory: 'bonds',
    cfpRationale: 'High yield corporate bonds'
  },
  {
    security: { security_id: '9', ticker_symbol: 'MUB', name: 'iShares National Municipal Bond ETF', type: 'etf' } as Security,
    expectedCategory: 'bonds',
    cfpRationale: 'Municipal bonds'
  },
  {
    security: { security_id: '10', ticker_symbol: 'BNDX', name: 'Vanguard Total International Bond ETF', type: 'etf' } as Security,
    expectedCategory: 'bonds',
    cfpRationale: 'International bonds'
  },
  
  // === CASH (Money Market and Bank Deposits) ===
  {
    security: { security_id: '11', ticker_symbol: 'VMFXX', name: 'Vanguard Federal Money Market Fund', type: 'cash' } as Security,
    expectedCategory: 'cash',
    cfpRationale: 'Money market fund'
  },
  {
    security: { security_id: '12', ticker_symbol: null, name: 'Cash', type: 'cash' } as Security,
    expectedCategory: 'cash',
    cfpRationale: 'Bank deposit/cash'
  },
  {
    security: { security_id: '13', ticker_symbol: 'SPAXX', name: 'Fidelity Government Money Market Fund', type: 'cash' } as Security,
    expectedCategory: 'cash',
    cfpRationale: 'Government money market'
  },
  {
    security: { security_id: '14', ticker_symbol: null, name: 'Bank Savings Account', type: 'cash' } as Security,
    expectedCategory: 'cash',
    cfpRationale: 'Bank savings account'
  },
  
  // === ALTERNATIVES (REITs, Commodities, Crypto, etc.) ===
  {
    security: { security_id: '15', ticker_symbol: 'VNQ', name: 'Vanguard Real Estate ETF', type: 'etf' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'REIT - Real estate investment trust'
  },
  {
    security: { security_id: '16', ticker_symbol: 'GLD', name: 'SPDR Gold Shares', type: 'etf' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'Commodity - Gold'
  },
  {
    security: { security_id: '17', ticker_symbol: 'BTC', name: 'Bitcoin', type: 'cryptocurrency' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'Cryptocurrency'
  },
  {
    security: { security_id: '18', ticker_symbol: 'DBC', name: 'Invesco DB Commodity Index Tracking Fund', type: 'etf' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'Diversified commodities'
  },
  {
    security: { security_id: '19', ticker_symbol: 'XLRE', name: 'Real Estate Select Sector SPDR Fund', type: 'etf' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'REIT sector fund'
  },
  {
    security: { security_id: '20', ticker_symbol: 'USO', name: 'United States Oil Fund', type: 'etf' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'Commodity - Oil'
  },
  {
    security: { security_id: '21', ticker_symbol: 'DBMF', name: 'iM DBi Managed Futures Strategy ETF', type: 'etf' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'Managed futures/hedge fund strategy'
  },
  {
    security: { security_id: '22', ticker_symbol: null, name: 'Private Equity Fund', type: 'derivative' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'Private equity'
  },
  {
    security: { security_id: '23', ticker_symbol: 'PAVE', name: 'Global X US Infrastructure Development ETF', type: 'etf' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'Infrastructure fund'
  },
  
  // === Edge Cases ===
  {
    security: { security_id: '24', ticker_symbol: 'VBIAX', name: 'Vanguard Balanced Index Fund', type: 'mutual fund' } as Security,
    expectedCategory: 'stocks',
    cfpRationale: 'Balanced fund (defaults to stocks per CFP convention)'
  },
  {
    security: { security_id: '25', ticker_symbol: null, name: 'Unknown Security', type: 'unknown' } as Security,
    expectedCategory: 'alternatives',
    cfpRationale: 'Unknown type defaults to alternatives (conservative approach)'
  }
];

let passedTests = 0;
let failedTests = 0;

console.log('\n📋 CFP/RIA Categorization Test Results:\n');

testSecurities.forEach((test, index) => {
  const actualCategory = (InvestmentCategorizer as any).categorizeSecurity(test.security);
  const passed = actualCategory === test.expectedCategory;
  
  if (passed) {
    passedTests++;
  } else {
    failedTests++;
  }
  
  const symbol = test.security.ticker_symbol || 'N/A';
  const name = test.security.name || 'Unknown';
  const status = passed ? '✅' : '❌';
  
  console.log(`${(index + 1).toString().padStart(2)}. ${status} ${symbol.padEnd(8)} | ${name.padEnd(50)}`);
  console.log(`    Expected: ${test.expectedCategory.padEnd(12)} | Actual: ${actualCategory.padEnd(12)} | CFP: ${test.cfpRationale}`);
  
  if (!passed) {
    console.log(`    ⚠️  MISMATCH - Review categorization logic`);
  }
  console.log('');
});

console.log('=' .repeat(70));
console.log(`\n📊 Summary: ${passedTests} passed, ${failedTests} failed out of ${testSecurities.length} tests\n`);

if (failedTests === 0) {
  console.log('✅ All securities correctly categorized according to CFP/RIA standards!\n');
} else {
  console.log(`❌ ${failedTests} securities incorrectly categorized. Please review the categorization logic.\n`);
}

// Test category distribution
console.log('📈 Category Distribution Test:\n');
console.log('=' .repeat(70));

const distribution = {
  stocks: testSecurities.filter(t => t.expectedCategory === 'stocks').length,
  bonds: testSecurities.filter(t => t.expectedCategory === 'bonds').length,
  cash: testSecurities.filter(t => t.expectedCategory === 'cash').length,
  alternatives: testSecurities.filter(t => t.expectedCategory === 'alternatives').length
};

console.log('Expected Distribution:');
console.log(`  Stocks:       ${distribution.stocks} securities`);
console.log(`  Bonds:        ${distribution.bonds} securities`);
console.log(`  Cash:         ${distribution.cash} securities`);
console.log(`  Alternatives: ${distribution.alternatives} securities`);

console.log('\n✨ CFP/RIA categorization test complete!\n');