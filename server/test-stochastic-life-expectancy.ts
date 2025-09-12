/**
 * Test script to verify stochastic life expectancy distribution
 * 
 * Run with: npx tsx server/test-stochastic-life-expectancy.ts
 */

import { 
  analyzeLifeExpectancyDistribution, 
  generateStochasticLifeExpectancy,
  generateCouplesStochasticLifeExpectancy 
} from './stochastic-life-expectancy';

console.log('=== Stochastic Life Expectancy Distribution Test ===\n');

// Test 1: Single person with default life expectancy of 93
console.log('Test 1: Single person (Age 65, Base Life Expectancy 93)');
const singlePersonAnalysis = analyzeLifeExpectancyDistribution({
  baseLifeExpectancy: 93,
  currentAge: 65,
  gender: undefined,
  healthAdjustment: 0
}, 10000);

console.log('Distribution Statistics:');
console.log(`  Mean: ${singlePersonAnalysis.mean.toFixed(1)} years`);
console.log(`  Median: ${singlePersonAnalysis.median} years`);
console.log(`  25th Percentile: ${singlePersonAnalysis.percentile25} years`);
console.log(`  75th Percentile: ${singlePersonAnalysis.percentile75} years`);
console.log(`  90th Percentile: ${singlePersonAnalysis.percentile90} years`);
console.log(`  Min: ${singlePersonAnalysis.min} years`);
console.log(`  Max: ${singlePersonAnalysis.max} years`);

// Test 2: Health-adjusted scenarios
console.log('\n\nTest 2: Health-Adjusted Life Expectancies (10,000 simulations each)');
const healthScenarios = [
  { status: 'Excellent', adjustment: 3, base: 96 },
  { status: 'Good', adjustment: 0, base: 93 },
  { status: 'Fair', adjustment: -3, base: 90 },
  { status: 'Poor', adjustment: -5, base: 88 }
];

for (const scenario of healthScenarios) {
  const analysis = analyzeLifeExpectancyDistribution({
    baseLifeExpectancy: scenario.base,
    currentAge: 65,
    gender: undefined,
    healthAdjustment: 0
  }, 10000);
  
  console.log(`\n${scenario.status} Health (Base ${scenario.base}):`);
  console.log(`  Mean: ${analysis.mean.toFixed(1)} years`);
  console.log(`  Median: ${analysis.median} years`);
  console.log(`  25%-75% Range: ${analysis.percentile25}-${analysis.percentile75} years`);
}

// Test 3: Distribution verification
console.log('\n\nTest 3: Distribution Verification (100,000 simulations)');
const distributionTest: number[] = [];
for (let i = 0; i < 100000; i++) {
  distributionTest.push(generateStochasticLifeExpectancy({
    baseLifeExpectancy: 93,
    currentAge: 65,
    gender: undefined,
    healthAdjustment: 0
  }));
}

// Count by ranges
const ranges = {
  'Early (85-90)': 0,
  'Median (91-95)': 0,
  'Longevity (96-100+)': 0,
  'Other': 0
};

distributionTest.forEach(age => {
  if (age >= 85 && age <= 90) ranges['Early (85-90)']++;
  else if (age >= 91 && age <= 95) ranges['Median (91-95)']++;
  else if (age >= 96 && age <= 100) ranges['Longevity (96-100+)']++;
  else ranges['Other']++;
});

console.log('Distribution by ranges:');
Object.entries(ranges).forEach(([range, count]) => {
  const percentage = (count / distributionTest.length * 100).toFixed(1);
  console.log(`  ${range}: ${count} (${percentage}%)`);
});

// Test 4: Couples correlation
console.log('\n\nTest 4: Couples Life Expectancy Correlation (1,000 simulations)');
const couplesResults: Array<{ user: number; spouse: number }> = [];

for (let i = 0; i < 1000; i++) {
  const result = generateCouplesStochasticLifeExpectancy(
    { baseLifeExpectancy: 93, currentAge: 65, gender: 'male', healthAdjustment: 0 },
    { baseLifeExpectancy: 96, currentAge: 63, gender: 'female', healthAdjustment: 0 },
    0.4
  );
  couplesResults.push({ user: result.userLifeExpectancy, spouse: result.spouseLifeExpectancy });
}

// Calculate correlation
const userMean = couplesResults.reduce((sum, r) => sum + r.user, 0) / couplesResults.length;
const spouseMean = couplesResults.reduce((sum, r) => sum + r.spouse, 0) / couplesResults.length;

let numerator = 0;
let userDenominator = 0;
let spouseDenominator = 0;

couplesResults.forEach(r => {
  const userDiff = r.user - userMean;
  const spouseDiff = r.spouse - spouseMean;
  numerator += userDiff * spouseDiff;
  userDenominator += userDiff * userDiff;
  spouseDenominator += spouseDiff * spouseDiff;
});

const correlation = numerator / Math.sqrt(userDenominator * spouseDenominator);

console.log(`User Mean Life Expectancy: ${userMean.toFixed(1)} years`);
console.log(`Spouse Mean Life Expectancy: ${spouseMean.toFixed(1)} years`);
console.log(`Observed Correlation: ${correlation.toFixed(3)} (Target: 0.4)`);

console.log('\n=== Test Complete ===');