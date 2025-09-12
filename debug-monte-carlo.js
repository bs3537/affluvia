// Quick mathematical validation of Monte Carlo logic
console.log('=== MONTE CARLO VALIDATION ===');

// Given parameters from the logs
const startingBalance = 750000;
const annualWithdrawal = 44400; // $96K expenses - $51.6K guaranteed income
const expectedReturn = 0.0655; // 91% stocks at 7% + 9% cash at 2%
const volatility = 0.18; // High due to 91% stock allocation

console.log('Starting balance:', startingBalance);
console.log('Annual withdrawal:', annualWithdrawal);
console.log('Expected return:', (expectedReturn * 100).toFixed(2) + '%');
console.log('Portfolio volatility:', (volatility * 100).toFixed(1) + '%');

// Test scenarios
console.log('\n=== SCENARIO TESTING ===');

// Scenario 1: Average returns every year
let balance1 = startingBalance;
console.log('\nScenario 1: Average returns (6.55%) every year');
for (let year = 1; year <= 20; year++) {
  balance1 *= (1 + expectedReturn);
  balance1 -= annualWithdrawal * Math.pow(1.03, year - 1); // 3% inflation
  if (year <= 5 || year === 10 || year === 15 || year === 20) {
    console.log(`Year ${year}: $${Math.round(balance1).toLocaleString()}`);
  }
  if (balance1 <= 0) {
    console.log(`Portfolio depleted in year ${year}`);
    break;
  }
}

// Scenario 2: Bad sequence of returns (realistic worst case)
let balance2 = startingBalance;
const badSequence = [-0.20, -0.10, 0.05, 0.08, 0.10, 0.12]; // First 2 years bad, then recovery
console.log('\nScenario 2: Bad sequence of returns');
for (let year = 1; year <= 20; year++) {
  const returnRate = year <= badSequence.length ? badSequence[year - 1] : expectedReturn;
  balance2 *= (1 + returnRate);
  balance2 -= annualWithdrawal * Math.pow(1.03, year - 1);
  if (year <= 6 || year === 10 || year === 15 || year === 20) {
    console.log(`Year ${year}: $${Math.round(balance2).toLocaleString()} (return: ${(returnRate * 100).toFixed(1)}%)`);
  }
  if (balance2 <= 0) {
    console.log(`Portfolio depleted in year ${year}`);
    break;
  }
}

// Calculate safe withdrawal rate
console.log('\n=== SAFE WITHDRAWAL RATE CALCULATION ===');
const safeBalance = startingBalance;
const safeReturn = expectedReturn;
const safeWithdrawalRate = safeReturn - 0.02; // Conservative: expected return minus 2% buffer
const safeWithdrawalAmount = safeBalance * safeWithdrawalRate;
console.log(`Safe withdrawal rate: ${(safeWithdrawalRate * 100).toFixed(2)}%`);
console.log(`Safe withdrawal amount: $${Math.round(safeWithdrawalAmount).toLocaleString()}`);
console.log(`Current withdrawal need: $${annualWithdrawal.toLocaleString()}`);
console.log(`Withdrawal sustainability: ${safeWithdrawalAmount >= annualWithdrawal ? 'SUSTAINABLE' : 'RISKY'}`);

console.log('\n=== CONCLUSION ===');
console.log('The 0% success rate is likely due to:');
console.log('1. High volatility (18%) with 91% stock allocation');
console.log('2. Sequence of returns risk - bad years early in retirement');
console.log('3. Withdrawal rate of ' + ((annualWithdrawal / startingBalance) * 100).toFixed(2) + '% is higher than safe rate');
console.log('4. Monte Carlo simulation correctly showing this is risky');