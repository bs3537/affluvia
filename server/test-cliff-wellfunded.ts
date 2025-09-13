// Test cliff effect with a well-funded profile
import { profileToRetirementParams, runRetirementMonteCarloSimulation } from './monte-carlo-base';

// Create a well-funded profile
const createProfile = (monthlyExpenses: number) => ({
  dateOfBirth: '1969-01-01', // Age 55
  spouseDateOfBirth: '1969-01-01',
  maritalStatus: 'married',
  state: 'FL',
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  userLifeExpectancy: 95,
  spouseLifeExpectancy: 95,
  socialSecurityClaimAge: 67, 
  spouseSocialSecurityClaimAge: 67,
  annualIncome: 150000,
  spouseAnnualIncome: 150000,
  socialSecurityBenefit: 3000,
  spouseSocialSecurityBenefit: 3000,
  expectedMonthlyExpensesRetirement: monthlyExpenses,
  retirementExpensesIncludeHealthcare: false,
  assets: [
    { type: '401k', value: 2000000, owner: 'user' },
    { type: 'traditional-ira', value: 500000, owner: 'spouse' },
    { type: 'roth-ira', value: 300000, owner: 'user' },
    { type: 'taxable-brokerage', value: 800000, owner: 'joint' },
    { type: 'savings', value: 200000, owner: 'joint' }
  ],
  retirementContributions: { 
    employee: 50000,
    employer: 15000
  },
  stockAllocation: 60,
  bondAllocation: 35,
  cashAllocation: 5,
  expectedRealReturn: 6,
  expectedInflationRate: 3,
  hasLongTermCareInsurance: false,
  legacyGoal: 0
});

console.log('=== CLIFF EFFECT TEST WITH WELL-FUNDED PROFILE ===\n');
console.log('Profile: Age 55 couple, retiring at 65');
console.log('Assets: $3.8M total ($2.8M retirement, $1M taxable)');
console.log('Income: $300k/year combined');
console.log('Social Security: $6,000/month combined at age 67');
console.log('Savings: $65k/year until retirement\n');

// Test around the user's reported cliff point
const testExpenses = [6000, 6200, 6400, 6500, 6600, 6700, 6800, 6900, 7000, 7100, 7200, 7400];
const results: any[] = [];

// Suppress console logs
const originalLog = console.log;
const suppressLogs = () => { console.log = () => {}; };
const restoreLogs = () => { console.log = originalLog; };

console.log('Testing expense levels (this may take a minute)...\n');
console.log('Monthly | Annual   | +Healthcare | Total       | Success | Change');
console.log('--------|----------|-------------|-------------|---------|--------');

let previousSuccess = null;

for (const monthly of testExpenses) {
  const profile = createProfile(monthly);
  
  suppressLogs();
  const params = profileToRetirementParams(profile);
  const result = runRetirementMonteCarloSimulation(params, 500); // 500 simulations for speed
  restoreLogs();
  
  const healthcareAdded = params.annualRetirementExpenses - (monthly * 12);
  const change = previousSuccess !== null ? result.probabilityOfSuccess - previousSuccess : 0;
  
  results.push({
    monthly,
    annual: monthly * 12,
    totalAnnual: params.annualRetirementExpenses,
    successRate: result.probabilityOfSuccess,
    healthcareAdded,
    change
  });
  
  // Highlight large changes
  const changeStr = previousSuccess !== null ? 
    `${change >= 0 ? '+' : ''}${change.toFixed(1).padStart(6)}%` : 
    '      -';
  
  const highlight = Math.abs(change) > 20 ? ' ⚠️' : '';
  
  console.log(
    `$${monthly.toString().padEnd(6)} | ` +
    `$${(monthly * 12).toLocaleString().padEnd(8)} | ` +
    `$${healthcareAdded.toLocaleString().padEnd(11)} | ` +
    `$${params.annualRetirementExpenses.toLocaleString().padEnd(11)} | ` +
    `${result.probabilityOfSuccess.toFixed(1).padStart(6)}% | ` +
    changeStr + highlight
  );
  
  previousSuccess = result.probabilityOfSuccess;
}

console.log('\n=== CLIFF ANALYSIS ===\n');

// Find the largest jump
let maxJump = { change: 0, from: null, to: null };
for (let i = 1; i < results.length; i++) {
  if (Math.abs(results[i].change) > Math.abs(maxJump.change)) {
    maxJump = {
      change: results[i].change,
      from: results[i - 1],
      to: results[i]
    };
  }
}

if (Math.abs(maxJump.change) > 20) {
  console.log('🚨 CLIFF EFFECT DETECTED!\n');
  console.log(`Largest jump: $${maxJump.from.monthly} → $${maxJump.to.monthly}`);
  console.log(`Success rate: ${maxJump.from.successRate.toFixed(1)}% → ${maxJump.to.successRate.toFixed(1)}%`);
  console.log(`Change: ${maxJump.change > 0 ? '+' : ''}${maxJump.change.toFixed(1)}%`);
  console.log(`\nThis is a ${Math.abs(maxJump.change).toFixed(1)}% change for just $${maxJump.to.monthly - maxJump.from.monthly}/month!`);
} else {
  console.log('✅ No significant cliff effects detected');
  console.log(`Largest change: ${maxJump.change.toFixed(1)}% (from $${maxJump.from?.monthly || 0} to $${maxJump.to?.monthly || 0})`);
}

// Check the specific $6700 vs $6900 case
const idx6700 = results.findIndex(r => r.monthly === 6700);
const idx6900 = results.findIndex(r => r.monthly === 6900);

if (idx6700 >= 0 && idx6900 >= 0) {
  console.log('\n=== USER-REPORTED CASE: $6700 vs $6900 ===\n');
  const r6700 = results[idx6700];
  const r6900 = results[idx6900];
  const diff = r6700.successRate - r6900.successRate;
  
  console.log(`$6,700/month: ${r6700.successRate.toFixed(1)}% success`);
  console.log(`  Total annual expenses: $${r6700.totalAnnual.toLocaleString()}`);
  console.log(`$6,900/month: ${r6900.successRate.toFixed(1)}% success`);
  console.log(`  Total annual expenses: $${r6900.totalAnnual.toLocaleString()}`);
  console.log(`\nDifference: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
  
  if (Math.abs(diff) > 50) {
    console.log('\n🚨 This matches the user-reported cliff of ~53%!');
    console.log('The guardrails fix should smooth this out.');
  } else if (Math.abs(diff) > 20) {
    console.log('\n⚠️ Still shows a significant jump, but less than reported.');
  } else {
    console.log('\n✅ The difference is now within reasonable bounds.');
  }
}

// Calculate overall smoothness
const changes = results.slice(1).map(r => Math.abs(r.change));
const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
const volatility = Math.sqrt(changes.reduce((a, b) => a + b * b, 0) / changes.length - avgChange * avgChange);

console.log('\n=== SMOOTHNESS METRICS ===\n');
console.log(`Average absolute change: ${avgChange.toFixed(1)}%`);
console.log(`Volatility of changes: ${volatility.toFixed(1)}%`);
console.log(`Maximum change: ${Math.max(...changes).toFixed(1)}%`);

if (Math.max(...changes) > 30) {
  console.log('\n⚠️ The simulation still shows significant discontinuities.');
  console.log('Consider further adjustments to the guardrails algorithm.');
} else if (Math.max(...changes) > 15) {
  console.log('\n⚠️ Some moderate jumps remain, but within acceptable bounds.');
} else {
  console.log('\n✅ SUCCESS: The simulation is now reasonably smooth.');
}