// Simple test to identify the cliff effect at $6900 vs $6700
import { profileToRetirementParams, runRetirementMonteCarloSimulation } from './monte-carlo-base';

// Silence console logs for cleaner output
const originalLog = console.log;
console.log = (...args: any[]) => {
  // Only show our custom output
  if (args[0]?.startsWith('===') || args[0]?.startsWith('$') || args[0]?.startsWith('  ') || args[0]?.startsWith('🚨')) {
    originalLog(...args);
  }
};

// Create base profile
const createProfile = (monthlyExpenses: number) => ({
  dateOfBirth: '1974-01-01', // Age 50
  spouseDateOfBirth: '1974-01-01',
  maritalStatus: 'married',
  state: 'FL',
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  userLifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  socialSecurityClaimAge: 65,
  spouseSocialSecurityClaimAge: 65,
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  socialSecurityBenefit: 1300,
  spouseSocialSecurityBenefit: 3033,
  expectedMonthlyExpensesRetirement: monthlyExpenses,
  retirementExpensesIncludeHealthcare: false, // Healthcare will be added
  assets: [
    { type: '401k', value: 400000, owner: 'user' },
    { type: 'taxable-brokerage', value: 90000, owner: 'user' },
    { type: 'savings', value: 32000, owner: 'user' },
    { type: 'checking', value: 50000, owner: 'user' }
  ],
  retirementContributions: { employee: 30000, employer: 0 },
  stockAllocation: 65,
  bondAllocation: 30,
  cashAllocation: 5,
  expectedRealReturn: 7,
  expectedInflationRate: 3,
  hasLongTermCareInsurance: false,
  legacyGoal: 0
});

// Restore console.log for our output
console.log = originalLog;

console.log('=== CLIFF EFFECT INVESTIGATION: $6900 vs $6700 ===\n');

// Test range around the cliff
const testExpenses = [6600, 6650, 6700, 6750, 6800, 6850, 6900, 6950, 7000];
const results: any[] = [];

console.log('Monthly | Annual   | +Healthcare | Total Annual | Success Rate');
console.log('--------|----------|-------------|--------------|-------------');

for (const monthly of testExpenses) {
  const profile = createProfile(monthly);
  
  // Temporarily suppress logs
  console.log = () => {};
  const params = profileToRetirementParams(profile);
  const result = runRetirementMonteCarloSimulation(params, 1000);
  console.log = originalLog;
  
  const healthcareAdded = params.annualRetirementExpenses - (monthly * 12);
  
  results.push({
    monthly,
    annual: monthly * 12,
    totalAnnual: params.annualRetirementExpenses,
    successRate: result.probabilityOfSuccess,
    healthcareAdded
  });
  
  console.log(
    `$${monthly.toString().padEnd(6)} | ` +
    `$${(monthly * 12).toLocaleString().padEnd(8)} | ` +
    `$${healthcareAdded.toLocaleString().padEnd(11)} | ` +
    `$${params.annualRetirementExpenses.toLocaleString().padEnd(12)} | ` +
    `${result.probabilityOfSuccess.toFixed(1).padStart(10)}%`
  );
}

console.log('\n=== ANALYSIS ===\n');

// Look for large jumps
for (let i = 1; i < results.length; i++) {
  const prev = results[i - 1];
  const curr = results[i];
  const change = curr.successRate - prev.successRate;
  
  if (Math.abs(change) > 10) {
    console.log(`🚨 Large jump detected:`);
    console.log(`  From $${prev.monthly}/month (${prev.successRate.toFixed(1)}%) to $${curr.monthly}/month (${curr.successRate.toFixed(1)}%)`);
    console.log(`  Change: ${change > 0 ? '+' : ''}${change.toFixed(1)}% for just $${curr.monthly - prev.monthly}/month difference`);
    console.log(`  Total expenses: $${prev.totalAnnual} → $${curr.totalAnnual}\n`);
  }
}

// Focus on the specific case user mentioned
const idx6700 = results.findIndex(r => r.monthly === 6700);
const idx6900 = results.findIndex(r => r.monthly === 6900);

if (idx6700 >= 0 && idx6900 >= 0) {
  const result6700 = results[idx6700];
  const result6900 = results[idx6900];
  const change = result6700.successRate - result6900.successRate;
  
  console.log('=== USER\'S SPECIFIC CASE ===\n');
  console.log(`$6,900/month: ${result6900.successRate.toFixed(1)}% success`);
  console.log(`  Annual expenses: $${result6900.annual}`);
  console.log(`  Healthcare added: $${result6900.healthcareAdded}`);
  console.log(`  Total simulated: $${result6900.totalAnnual}\n`);
  
  console.log(`$6,700/month: ${result6700.successRate.toFixed(1)}% success`);
  console.log(`  Annual expenses: $${result6700.annual}`);
  console.log(`  Healthcare added: $${result6700.healthcareAdded}`);
  console.log(`  Total simulated: $${result6700.totalAnnual}\n`);
  
  console.log(`Change: ${change > 0 ? '+' : ''}${change.toFixed(1)}%`);
  
  if (Math.abs(change) > 50) {
    console.log('\n🚨 CONFIRMED: Extreme cliff effect detected!');
    console.log('This is NOT normal behavior and indicates a bug in the simulation.');
  } else if (Math.abs(change) > 20) {
    console.log('\n⚠️ Significant change detected, but not as extreme as reported.');
  } else {
    console.log('\n✓ Change is within reasonable bounds.');
  }
}

console.log('\n=== CONCLUSION ===\n');
console.log('Healthcare costs are automatically added to user-entered expenses.');
console.log('For a married couple, this adds approximately $22,390/year.');
console.log('This means the actual simulated expenses are much higher than displayed.');
console.log('\nThe cliff effect may be caused by:');
console.log('1. Crossing a critical withdrawal rate threshold');
console.log('2. Tax bracket changes at different withdrawal levels');
console.log('3. Portfolio depletion timing');
console.log('4. Numerical instability in the simulation');