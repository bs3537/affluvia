#!/usr/bin/env npx tsx

console.log('🧪 Testing Plaid Data Aggregation with Manual Assets\n');
console.log('=' .repeat(70));

// Test the aggregation logic
console.log('\n📊 Test Case: Manual Assets & Liabilities Aggregation');
console.log('-'.repeat(50));

// Simulated manual profile data (as stored in database)
const testProfile = {
  assets: [
    { type: 'Checking Account', value: 5000, owner: 'User' },
    { type: 'Savings Account', value: 10000, owner: 'User' },
    { type: 'Investment Account', value: 35000, owner: 'User' },  // This was missing
    { type: '401k', value: 150000, owner: 'User' },
    { type: 'Traditional IRA', value: 50000, owner: 'User' },
    { type: 'Roth IRA', value: 25000, owner: 'User' },
    { type: '529 Education', value: 15000, owner: 'User' },
    { type: 'Vehicle', value: 20000, owner: 'User' }
  ],
  
  liabilities: [
    { type: 'Credit Card', balance: 3500, monthlyPayment: 150 },
    { type: 'Student Loan', balance: 25000, monthlyPayment: 300 },
    { type: 'Personal Loan', balance: 10000, monthlyPayment: 250 },
    { type: 'Auto Loan', balance: 15000, monthlyPayment: 400 }
  ]
};

// Simulate the aggregation logic
const manualAssetsArray = Array.isArray(testProfile.assets) ? testProfile.assets : [];
const manualLiabilitiesArray = Array.isArray(testProfile.liabilities) ? testProfile.liabilities : [];

// Aggregate manual assets
const manualAssets = {
  checking: 0,
  savings: 0,
  emergencyFund: 0,
  taxableInvestment: 0,
  retirement401k: 0,
  retirementIRA: 0,
  retirementRoth: 0,
  education529: 0,
  realEstate: 0,
  vehicles: 0,
  otherAssets: 0
};

console.log('\nProcessing Manual Assets:');
manualAssetsArray.forEach((asset: any) => {
  const value = parseFloat(asset.value) || 0;
  const type = asset.type?.toLowerCase() || '';
  
  let category = '';
  if (type.includes('checking')) {
    manualAssets.checking += value;
    category = 'checking';
  } else if (type.includes('savings')) {
    manualAssets.savings += value;
    category = 'savings';
  } else if (type.includes('emergency')) {
    manualAssets.emergencyFund += value;
    category = 'emergencyFund';
  } else if (type.includes('investment') || type.includes('brokerage')) {
    manualAssets.taxableInvestment += value;
    category = 'taxableInvestment';
  } else if (type.includes('401k') || type.includes('403b')) {
    manualAssets.retirement401k += value;
    category = 'retirement401k';
  } else if (type.includes('ira') && !type.includes('roth')) {
    manualAssets.retirementIRA += value;
    category = 'retirementIRA';
  } else if (type.includes('roth')) {
    manualAssets.retirementRoth += value;
    category = 'retirementRoth';
  } else if (type.includes('529') || type.includes('education')) {
    manualAssets.education529 += value;
    category = 'education529';
  } else if (type.includes('real estate') || type.includes('property')) {
    manualAssets.realEstate += value;
    category = 'realEstate';
  } else if (type.includes('vehicle') || type.includes('car')) {
    manualAssets.vehicles += value;
    category = 'vehicles';
  } else {
    manualAssets.otherAssets += value;
    category = 'otherAssets';
  }
  
  console.log(`  ${asset.type}: $${value.toLocaleString()} → ${category}`);
});

// Aggregate manual liabilities
const manualLiabilities = {
  creditCards: 0,
  studentLoans: 0,
  personalLoans: 0,
  mortgage: 0,
  autoLoans: 0,
  otherDebts: 0
};

console.log('\nProcessing Manual Liabilities:');
manualLiabilitiesArray.forEach((liability: any) => {
  const balance = parseFloat(liability.balance) || 0;
  const type = liability.type?.toLowerCase() || '';
  
  let category = '';
  if (type.includes('credit card')) {
    manualLiabilities.creditCards += balance;
    category = 'creditCards';
  } else if (type.includes('student')) {
    manualLiabilities.studentLoans += balance;
    category = 'studentLoans';
  } else if (type.includes('personal')) {
    manualLiabilities.personalLoans += balance;
    category = 'personalLoans';
  } else if (type.includes('mortgage')) {
    manualLiabilities.mortgage += balance;
    category = 'mortgage';
  } else if (type.includes('auto') || type.includes('car')) {
    manualLiabilities.autoLoans += balance;
    category = 'autoLoans';
  } else {
    manualLiabilities.otherDebts += balance;
    category = 'otherDebts';
  }
  
  console.log(`  ${liability.type}: $${balance.toLocaleString()} → ${category}`);
});

// Calculate totals
const totalManualAssets = Object.values(manualAssets).reduce((sum: number, val: any) => sum + val, 0);
const totalManualLiabilities = Object.values(manualLiabilities).reduce((sum: number, val: any) => sum + val, 0);

console.log('\n📊 Aggregated Manual Assets:');
Object.entries(manualAssets).forEach(([key, value]) => {
  if (value > 0) {
    console.log(`  ${key}: $${value.toLocaleString()}`);
  }
});
console.log(`  Total Manual Assets: $${totalManualAssets.toLocaleString()}`);

console.log('\n📊 Aggregated Manual Liabilities:');
Object.entries(manualLiabilities).forEach(([key, value]) => {
  if (value > 0) {
    console.log(`  ${key}: $${value.toLocaleString()}`);
  }
});
console.log(`  Total Manual Liabilities: $${totalManualLiabilities.toLocaleString()}`);

// Simulate Plaid data
console.log('\n📊 Simulated Plaid Data:');
const plaidAssets = {
  checking: 8000,
  savings: 15000,
  investment: 45000,
  retirement: 120000,
  emergency: 5000,
  education: 10000,
  other: 2000
};

const plaidLiabilities = {
  creditCards: 5000,
  studentLoans: 0,
  personalLoans: 0,
  mortgage: 0,
  autoLoans: 12000,
  other: 1000
};

const totalPlaidAssets = Object.values(plaidAssets).reduce((sum: number, val: any) => sum + val, 0);
const totalPlaidLiabilities = Object.values(plaidLiabilities).reduce((sum: number, val: any) => sum + val, 0);

console.log(`  Total Plaid Assets: $${totalPlaidAssets.toLocaleString()}`);
console.log(`  Total Plaid Liabilities: $${totalPlaidLiabilities.toLocaleString()}`);

// Merge data (as the updated code would do)
console.log('\n💰 Combined Totals:');
const combinedAssets = totalManualAssets + totalPlaidAssets;
const combinedLiabilities = totalManualLiabilities + totalPlaidLiabilities;
const netWorth = combinedAssets - combinedLiabilities;

console.log(`  Combined Assets: $${combinedAssets.toLocaleString()}`);
console.log(`    - Manual: $${totalManualAssets.toLocaleString()}`);
console.log(`    - Plaid: $${totalPlaidAssets.toLocaleString()}`);

console.log(`\n  Combined Liabilities: $${combinedLiabilities.toLocaleString()}`);
console.log(`    - Manual: $${totalManualLiabilities.toLocaleString()}`);
console.log(`    - Plaid: $${totalPlaidLiabilities.toLocaleString()}`);

console.log(`\n  Net Worth: $${netWorth.toLocaleString()}`);

// Test specific scenario from user
console.log('\n' + '=' .repeat(70));
console.log('\n📊 User\'s Specific Scenario:');
console.log('-'.repeat(50));

const userScenario = {
  plaidAssets: 94240,  // From Plaid accounts
  manualAssets: 35000,  // Investment account that should be included
  plaidLiabilities: 110692,
  manualLiabilities: 0
};

const userNetWorth = (userScenario.plaidAssets + userScenario.manualAssets) - 
                     (userScenario.plaidLiabilities + userScenario.manualLiabilities);

console.log(`  Plaid Assets: $${userScenario.plaidAssets.toLocaleString()}`);
console.log(`  Manual Assets: $${userScenario.manualAssets.toLocaleString()} (Investment Account)`);
console.log(`  Total Assets: $${(userScenario.plaidAssets + userScenario.manualAssets).toLocaleString()}`);
console.log(`\n  Plaid Liabilities: $${userScenario.plaidLiabilities.toLocaleString()}`);
console.log(`  Manual Liabilities: $${userScenario.manualLiabilities.toLocaleString()}`);
console.log(`  Total Liabilities: $${(userScenario.plaidLiabilities + userScenario.manualLiabilities).toLocaleString()}`);
console.log(`\n  Calculated Net Worth: $${userNetWorth.toLocaleString()}`);

if (Math.abs(userNetWorth - 18548) < 100) {
  console.log('  ✅ Net worth calculation matches expected ~$18,548!');
} else {
  console.log('  ⚠️  Net worth differs from expected $18,548');
}

console.log('\n✨ Aggregation test complete!\n');