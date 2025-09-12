import { modelLTCEvents } from './ltc-modeling';

console.log('LTC MODELING ANALYSIS\n');
console.log('='.repeat(50));

// Test parameters
const testCases = [
  { gender: 'male' as const, healthStatus: 'excellent' as const },
  { gender: 'male' as const, healthStatus: 'good' as const },
  { gender: 'male' as const, healthStatus: 'fair' as const },
  { gender: 'female' as const, healthStatus: 'good' as const },
];

console.log('BASE ASSUMPTIONS:');
console.log('- Base annual LTC cost: $75,504');
console.log('- Duration: 2 years (last 2 years of plan)');
console.log('- Healthcare inflation: 4.5%');
console.log('- Base lifetime risk: 70%\n');

console.log('HEALTH STATUS MULTIPLIERS:');
console.log('- Excellent: 0.7x (49% lifetime risk)');
console.log('- Good: 1.0x (70% lifetime risk)');
console.log('- Fair: 1.3x (91% lifetime risk)');
console.log('- Poor: 1.6x (95% capped)\n');

// Run simulations
console.log('SIMULATION RESULTS (1000 runs each):\n');

for (const testCase of testCases) {
  let eventCount = 0;
  let totalCosts = 0;
  
  for (let i = 0; i < 1000; i++) {
    const result = modelLTCEvents(
      65, // retirement age
      85, // life expectancy
      testCase.gender,
      testCase.healthStatus,
      'CA',
      { type: 'none', dailyBenefit: 0, benefitPeriodYears: 0, eliminationPeriodDays: 0, inflationProtection: 'none', premiumAnnual: 0, policyStartAge: 65 }
    );
    
    if (result.hadLTCEvent) {
      eventCount++;
      totalCosts += result.totalOutOfPocketCosts;
    }
  }
  
  const probability = (eventCount / 1000 * 100).toFixed(1);
  const avgCost = eventCount > 0 ? Math.round(totalCosts / eventCount) : 0;
  
  console.log(`${testCase.gender}, ${testCase.healthStatus}:`);
  console.log(`  Probability: ${probability}%`);
  console.log(`  Avg cost when occurs: $${avgCost.toLocaleString()}`);
  console.log(`  Expected value: $${Math.round(avgCost * eventCount / 1000).toLocaleString()}\n`);
}

console.log('='.repeat(50));
console.log('\nKEY INSIGHTS:');
console.log('1. LTC is modeled as occurring in LAST 2 years of life');
console.log('2. 70% base probability is HIGH (industry average ~50-60%)');
console.log('3. Cost of $75,504/year is reasonable (national average)');
console.log('4. Using simplified model vs complex state transitions');
console.log('\nPOTENTIAL ISSUES:');
console.log('- 70% probability may be too high');
console.log('- Always assuming 2-year duration is rigid');
console.log('- No variation in care type (all assisted living)');
console.log('- Random probability in each simulation adds volatility');