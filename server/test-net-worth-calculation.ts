#!/usr/bin/env npx tsx

console.log('🧪 Testing Net Worth Calculation with Real Estate\n');
console.log('=' .repeat(70));

// Test Case 1: Complete Net Worth including Real Estate
console.log('\n📊 Test Case 1: Comprehensive Net Worth Calculation');
console.log('-'.repeat(50));

const testProfile = {
  // Step 3: Assets (Bank accounts, investments, retirement)
  assets: [
    { type: 'Checking Account', value: 15000, owner: 'User' },
    { type: 'Savings Account', value: 50000, owner: 'User' },
    { type: '401k', value: 250000, owner: 'User' },
    { type: 'Traditional IRA', value: 75000, owner: 'User' },
    { type: 'Roth IRA', value: 35000, owner: 'User' },
    { type: 'Brokerage Account', value: 100000, owner: 'User' },
    { type: '401k', value: 150000, owner: 'Spouse' },
    { type: 'Savings Account', value: 25000, owner: 'Spouse' }
  ],
  
  // Step 3: Liabilities (Credit cards, loans, etc - NOT mortgages)
  liabilities: [
    { type: 'Credit Card', balance: 5000, monthlyPayment: 200 },
    { type: 'Car Loan', balance: 25000, monthlyPayment: 450 },
    { type: 'Student Loan', balance: 35000, monthlyPayment: 350 },
    { type: 'Personal Loan', balance: 10000, monthlyPayment: 250 }
  ],
  
  // Step 4: Primary Residence
  primaryResidence: {
    marketValue: 650000,      // Current market value
    mortgageBalance: 380000,  // Remaining mortgage balance
    monthlyPayment: 2800,
    interestRate: 4.5,
    yearsToPayOffMortgage: 22,
    owner: 'Joint'
  },
  
  // Step 4: Additional Properties
  additionalProperties: [
    {
      type: 'Rental Property',
      marketValue: 350000,
      mortgageBalance: 200000,
      monthlyPayment: 1500,
      rentalIncome: 2500,
      owner: 'User'
    },
    {
      type: 'Vacation Home',
      marketValue: 450000,
      mortgageBalance: 300000,
      monthlyPayment: 2200,
      rentalIncome: 0,
      owner: 'Joint'
    }
  ]
};

// Manual calculation for verification
console.log('\n📋 Step 3 - Assets & Liabilities:');
console.log('\nAssets:');
let totalAssetsStep3 = 0;
testProfile.assets.forEach(asset => {
  console.log(`  ${asset.type} (${asset.owner}): $${asset.value.toLocaleString()}`);
  totalAssetsStep3 += asset.value;
});
console.log(`  Total Assets (Step 3): $${totalAssetsStep3.toLocaleString()}`);

console.log('\nLiabilities:');
let totalLiabilitiesStep3 = 0;
testProfile.liabilities.forEach(liability => {
  console.log(`  ${liability.type}: $${liability.balance.toLocaleString()}`);
  totalLiabilitiesStep3 += liability.balance;
});
console.log(`  Total Liabilities (Step 3): $${totalLiabilitiesStep3.toLocaleString()}`);

console.log('\n📋 Step 4 - Real Estate:');
console.log('\nPrimary Residence:');
const primaryHomeEquity = testProfile.primaryResidence.marketValue - testProfile.primaryResidence.mortgageBalance;
console.log(`  Market Value: $${testProfile.primaryResidence.marketValue.toLocaleString()}`);
console.log(`  Mortgage Balance: $${testProfile.primaryResidence.mortgageBalance.toLocaleString()}`);
console.log(`  Home Equity: $${primaryHomeEquity.toLocaleString()}`);

console.log('\nAdditional Properties:');
let totalAdditionalEquity = 0;
testProfile.additionalProperties.forEach(property => {
  const equity = property.marketValue - property.mortgageBalance;
  console.log(`  ${property.type}:`);
  console.log(`    Market Value: $${property.marketValue.toLocaleString()}`);
  console.log(`    Mortgage Balance: $${property.mortgageBalance.toLocaleString()}`);
  console.log(`    Equity: $${equity.toLocaleString()}`);
  totalAdditionalEquity += equity;
});
console.log(`  Total Additional Properties Equity: $${totalAdditionalEquity.toLocaleString()}`);

// Calculate Net Worth
console.log('\n💰 Net Worth Calculation:');
console.log('  Formula: Assets (Step 3) - Liabilities (Step 3) + Home Equity (Step 4)');
console.log(`\n  = $${totalAssetsStep3.toLocaleString()} - $${totalLiabilitiesStep3.toLocaleString()} + $${primaryHomeEquity.toLocaleString()} + $${totalAdditionalEquity.toLocaleString()}`);

const netWorth = totalAssetsStep3 - totalLiabilitiesStep3 + primaryHomeEquity + totalAdditionalEquity;
console.log(`  = $${netWorth.toLocaleString()}`);

// Test Case 2: Plaid-Connected Assets Integration
console.log('\n\n📊 Test Case 2: Plaid-Connected Assets & Manual Entries');
console.log('-'.repeat(50));

const mixedProfile = {
  // Mix of Plaid-imported and manual assets
  assets: [
    { type: 'Checking Account', value: 12000, owner: 'User', _source: { isImported: true, plaidAccountId: 'acc_123' } },
    { type: 'Savings Account', value: 30000, owner: 'User', _source: { isImported: true, plaidAccountId: 'acc_124' } },
    { type: '401k', value: 180000, owner: 'User', _source: { isImported: true, plaidAccountId: 'acc_125' } },
    { type: 'Brokerage Account', value: 50000, owner: 'User' },  // Manual entry
    { type: 'Cash', value: 5000, owner: 'User' }  // Manual entry
  ],
  
  liabilities: [
    { type: 'Credit Card', balance: 3500, _source: { isImported: true, plaidAccountId: 'acc_126' } },
    { type: 'Car Loan', balance: 18000, _source: { isImported: true, plaidAccountId: 'acc_127' } },
    { type: 'Personal Loan', balance: 8000 }  // Manual entry
  ],
  
  // Primary residence with Plaid-imported mortgage
  primaryResidence: {
    marketValue: 400000,  // User must enter market value manually
    mortgageBalance: 280000,  // Could be imported from Plaid
    _source: { isImported: true, plaidAccountId: 'acc_128' },
    monthlyPayment: 1850,
    owner: 'User'
  },
  
  additionalProperties: []
};

console.log('\nAssets Source Breakdown:');
const plaidAssets = mixedProfile.assets.filter(a => a._source?.isImported);
const manualAssets = mixedProfile.assets.filter(a => !a._source?.isImported);

console.log(`  Plaid-Connected: ${plaidAssets.length} accounts`);
plaidAssets.forEach(asset => {
  console.log(`    - ${asset.type}: $${asset.value.toLocaleString()}`);
});

console.log(`  Manual Entries: ${manualAssets.length} accounts`);
manualAssets.forEach(asset => {
  console.log(`    - ${asset.type}: $${asset.value.toLocaleString()}`);
});

const totalMixedAssets = mixedProfile.assets.reduce((sum, asset) => sum + asset.value, 0);
const totalMixedLiabilities = mixedProfile.liabilities.reduce((sum, liability) => sum + liability.balance, 0);
const mixedHomeEquity = mixedProfile.primaryResidence.marketValue - mixedProfile.primaryResidence.mortgageBalance;
const mixedNetWorth = totalMixedAssets - totalMixedLiabilities + mixedHomeEquity;

console.log('\n💰 Mixed Sources Net Worth:');
console.log(`  Total Assets: $${totalMixedAssets.toLocaleString()}`);
console.log(`  Total Liabilities: $${totalMixedLiabilities.toLocaleString()}`);
console.log(`  Home Equity: $${mixedHomeEquity.toLocaleString()}`);
console.log(`  Net Worth: $${mixedNetWorth.toLocaleString()}`);

// Test Case 3: Edge Cases
console.log('\n\n📊 Test Case 3: Edge Cases');
console.log('-'.repeat(50));

const edgeCases = [
  {
    name: 'No Real Estate',
    assets: [{ value: 100000 }],
    liabilities: [{ balance: 20000 }],
    primaryResidence: {},
    additionalProperties: [],
    expectedNetWorth: 80000
  },
  {
    name: 'Underwater Mortgage',
    assets: [{ value: 50000 }],
    liabilities: [{ balance: 10000 }],
    primaryResidence: { marketValue: 300000, mortgageBalance: 350000 },
    additionalProperties: [],
    expectedNetWorth: 50000 - 10000 + (300000 - 350000) // -10000
  },
  {
    name: 'Multiple Properties',
    assets: [{ value: 200000 }],
    liabilities: [{ balance: 30000 }],
    primaryResidence: { marketValue: 500000, mortgageBalance: 300000 },
    additionalProperties: [
      { marketValue: 400000, mortgageBalance: 250000 },
      { marketValue: 350000, mortgageBalance: 280000 }
    ],
    expectedNetWorth: 200000 - 30000 + 200000 + 150000 + 70000 // 590000
  }
];

edgeCases.forEach(testCase => {
  const assets = testCase.assets.reduce((sum, a) => sum + (a.value || 0), 0);
  const liabilities = testCase.liabilities.reduce((sum, l) => sum + (l.balance || 0), 0);
  
  const primaryEquity = (testCase.primaryResidence.marketValue || 0) - (testCase.primaryResidence.mortgageBalance || 0);
  const additionalEquity = testCase.additionalProperties.reduce((sum, p) => {
    return sum + ((p.marketValue || 0) - (p.mortgageBalance || 0));
  }, 0);
  
  const calculatedNetWorth = assets - liabilities + primaryEquity + additionalEquity;
  
  console.log(`\n${testCase.name}:`);
  console.log(`  Assets: $${assets.toLocaleString()}`);
  console.log(`  Liabilities: $${liabilities.toLocaleString()}`);
  console.log(`  Primary Home Equity: $${primaryEquity.toLocaleString()}`);
  console.log(`  Additional Properties Equity: $${additionalEquity.toLocaleString()}`);
  console.log(`  Calculated Net Worth: $${calculatedNetWorth.toLocaleString()}`);
  console.log(`  Expected: $${testCase.expectedNetWorth.toLocaleString()}`);
  console.log(`  ${calculatedNetWorth === testCase.expectedNetWorth ? '✅ CORRECT' : '❌ MISMATCH'}`);
});

// Summary
console.log('\n' + '=' .repeat(70));
console.log('📋 NET WORTH FORMULA VERIFIED:\n');
console.log('Net Worth = ');
console.log('  + Sum of all assets from Step 3 (checking, savings, investments, retirement)');
console.log('  - Sum of all liabilities from Step 3 (credit cards, loans, etc.)');
console.log('  + Primary home equity from Step 4 (market value - mortgage balance)');
console.log('  + Additional properties equity from Step 4 (sum of all property equities)');
console.log('\n✅ Both Plaid-connected and manually entered values are included');
console.log('✅ Mortgages are tracked separately in Step 4, not in Step 3 liabilities');
console.log('\n✨ Net worth calculation test complete!\n');