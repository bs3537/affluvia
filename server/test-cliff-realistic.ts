// Test cliff effect with a more realistic profile that shows varying success rates
import { profileToRetirementParams, runRetirementMonteCarloSimulation } from './monte-carlo-base';

// Create a profile with better parameters for testing
const createProfile = (monthlyExpenses: number) => ({
  dateOfBirth: '1964-01-01', // Age 60 - closer to retirement
  spouseDateOfBirth: '1964-01-01',
  maritalStatus: 'married',
  state: 'FL',
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  userLifeExpectancy: 90,
  spouseLifeExpectancy: 90,
  socialSecurityClaimAge: 67, // Claim at FRA
  spouseSocialSecurityClaimAge: 67,
  annualIncome: 100000,
  spouseAnnualIncome: 100000,
  socialSecurityBenefit: 2500, // $2500/month at FRA
  spouseSocialSecurityBenefit: 2500,
  expectedMonthlyExpensesRetirement: monthlyExpenses,
  retirementExpensesIncludeHealthcare: false, // Healthcare will be added
  assets: [
    { type: '401k', value: 1200000, owner: 'user' },
    { type: 'traditional-ira', value: 300000, owner: 'spouse' },
    { type: 'taxable-brokerage', value: 400000, owner: 'joint' },
    { type: 'savings', value: 100000, owner: 'joint' }
  ],
  retirementContributions: { 
    employee: 40000, // $40k/year combined
    employer: 10000  // $10k/year match
  },
  stockAllocation: 60,
  bondAllocation: 35,
  cashAllocation: 5,
  expectedRealReturn: 6,
  expectedInflationRate: 3,
  hasLongTermCareInsurance: false,
  legacyGoal: 0
});

console.log('=== CLIFF EFFECT TEST WITH REALISTIC PROFILE ===\n');
console.log('Profile: Age 60 couple, retiring at 65');
console.log('Assets: $2M total ($1.5M retirement accounts, $500K taxable)');
console.log('Social Security: $5,000/month combined at age 67');
console.log('Savings: $50k/year until retirement\n');

// Test range of expenses
const testExpenses = [5500, 5700, 5900, 6100, 6300, 6500, 6700, 6900, 7100, 7300, 7500];
const results: any[] = [];

// Suppress console logs
const originalLog = console.log;
const suppressLogs = () => { console.log = () => {}; };
const restoreLogs = () => { console.log = originalLog; };

console.log('Monthly | Annual   | +Healthcare | Total Annual | Success Rate | Change');
console.log('--------|----------|-------------|--------------|--------------|--------');

let previousSuccess = 0;

for (const monthly of testExpenses) {
  const profile = createProfile(monthly);
  
  suppressLogs();
  const params = profileToRetirementParams(profile);
  const result = runRetirementMonteCarloSimulation(params, 1000);
  restoreLogs();
  
  const healthcareAdded = params.annualRetirementExpenses - (monthly * 12);
  const change = result.probabilityOfSuccess - previousSuccess;
  
  results.push({
    monthly,
    annual: monthly * 12,
    totalAnnual: params.annualRetirementExpenses,
    successRate: result.probabilityOfSuccess,
    healthcareAdded,
    change
  });
  
  console.log(
    `$${monthly.toString().padEnd(6)} | ` +
    `$${(monthly * 12).toLocaleString().padEnd(8)} | ` +
    `$${healthcareAdded.toLocaleString().padEnd(11)} | ` +
    `$${params.annualRetirementExpenses.toLocaleString().padEnd(12)} | ` +
    `${result.probabilityOfSuccess.toFixed(1).padStart(11)}% | ` +
    `${change >= 0 ? '+' : ''}${change.toFixed(1).padStart(6)}%`
  );
  
  previousSuccess = result.probabilityOfSuccess;
}

console.log('\n=== ANALYSIS ===\n');

// Look for cliff effects (large jumps)
const cliffs: any[] = [];
for (let i = 1; i < results.length; i++) {
  const change = results[i].change;
  if (Math.abs(change) > 20) {
    cliffs.push({
      from: results[i - 1],
      to: results[i],
      change
    });
  }
}

if (cliffs.length > 0) {
  console.log('🚨 CLIFF EFFECTS DETECTED:\n');
  for (const cliff of cliffs) {
    console.log(`  $${cliff.from.monthly} → $${cliff.to.monthly}: ${cliff.change > 0 ? '+' : ''}${cliff.change.toFixed(1)}% jump`);
    console.log(`    That's a ${Math.abs(cliff.change).toFixed(1)}% change for $${cliff.to.monthly - cliff.from.monthly}/month!`);
    console.log(`    Total expenses: $${cliff.from.totalAnnual} → $${cliff.to.totalAnnual}\n`);
  }
} else {
  console.log('✅ No significant cliff effects detected (all changes < 20%)');
}

// Calculate smoothness metric
const changes = results.slice(1).map(r => Math.abs(r.change));
const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
const maxChange = Math.max(...changes);

console.log('\n=== SMOOTHNESS METRICS ===\n');
console.log(`Average change between steps: ${avgChange.toFixed(1)}%`);
console.log(`Maximum change between steps: ${maxChange.toFixed(1)}%`);
console.log(`Expense increment: $200/month`);

if (maxChange > 30) {
  console.log('\n⚠️ WARNING: Large jumps detected. The simulation may have discontinuities.');
} else if (maxChange > 20) {
  console.log('\n⚠️ CAUTION: Moderate jumps detected. Consider further smoothing.');
} else {
  console.log('\n✅ SUCCESS: Changes are reasonably smooth.');
}

// Test specific $6900 vs $6700 case
const idx6700 = results.findIndex(r => r.monthly === 6700);
const idx6900 = results.findIndex(r => r.monthly === 6900);

if (idx6700 >= 0 && idx6900 >= 0) {
  console.log('\n=== $6700 vs $6900 COMPARISON ===\n');
  const diff = results[idx6700].successRate - results[idx6900].successRate;
  console.log(`$6,700/month: ${results[idx6700].successRate.toFixed(1)}% success`);
  console.log(`$6,900/month: ${results[idx6900].successRate.toFixed(1)}% success`);
  console.log(`Difference: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
  
  if (Math.abs(diff) > 50) {
    console.log('\n🚨 This matches the user-reported cliff effect!');
  }
}