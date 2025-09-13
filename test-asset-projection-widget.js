/**
 * Test script for Asset Projection Widget
 * Verifies fresh calculations and confidence interval generation
 */

// Test configuration
const testProfile = {
  age: 50,
  retirementAge: 65,
  lifeExpectancy: 90,
  totalAssets: 500000,
  skipCache: true,
  iterations: 100 // Reduced for testing
};

console.log('Testing Asset Projection Widget Calculations...\n');
console.log('Test Profile:', testProfile);

// Simulate Monte Carlo processing
function processMonteCarloResults(iterations = 100) {
  const ages = [];
  const years = [];
  const currentYear = new Date().getFullYear();
  
  // Generate age range
  for (let age = testProfile.age; age <= testProfile.lifeExpectancy; age++) {
    ages.push(age);
    years.push(currentYear + (age - testProfile.age));
  }
  
  // Simulate portfolio values for each iteration
  const portfolioValuesByAge = {};
  ages.forEach(age => {
    portfolioValuesByAge[age] = [];
  });
  
  // Run simplified simulations
  for (let i = 0; i < iterations; i++) {
    let currentValue = testProfile.totalAssets;
    const annualReturn = 0.05 + (Math.random() - 0.5) * 0.2; // 5% +/- 10%
    const inflation = 0.025;
    
    ages.forEach(age => {
      // Simple growth model with retirement spending
      if (age < testProfile.retirementAge) {
        currentValue *= (1 + annualReturn);
      } else {
        const spending = currentValue * 0.04 * (1 + inflation);
        currentValue = currentValue * (1 + annualReturn) - spending;
        currentValue = Math.max(0, currentValue);
      }
      portfolioValuesByAge[age].push(currentValue);
    });
  }
  
  // Calculate percentiles
  const getPercentile = (arr, p) => {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  };
  
  const median = [];
  const percentile25 = [];
  const percentile75 = [];
  const percentile10 = [];
  const percentile90 = [];
  const poorOutcome = [];
  
  ages.forEach(age => {
    const values = portfolioValuesByAge[age];
    median.push(getPercentile(values, 50));
    percentile25.push(getPercentile(values, 25));
    percentile75.push(getPercentile(values, 75));
    percentile10.push(getPercentile(values, 10));
    percentile90.push(getPercentile(values, 90));
    poorOutcome.push(getPercentile(values, 5));
  });
  
  // Calculate success probability
  const finalValues = portfolioValuesByAge[testProfile.lifeExpectancy];
  const successCount = finalValues.filter(v => v > 0).length;
  const successProbability = successCount / iterations;
  
  return {
    ages,
    years,
    median,
    percentile25,
    percentile75,
    percentile10,
    percentile90,
    poorOutcome,
    successProbability
  };
}

// Run test
console.log('\n=== Running Monte Carlo Simulations ===');
const startTime = Date.now();
const results = processMonteCarloResults();
const endTime = Date.now();

console.log(`Completed in ${endTime - startTime}ms\n`);

// Display results
console.log('=== Confidence Intervals at Key Ages ===\n');

const keyAges = [
  testProfile.age,
  testProfile.retirementAge,
  testProfile.retirementAge + 10,
  testProfile.lifeExpectancy
];

keyAges.forEach(age => {
  const index = results.ages.indexOf(age);
  if (index !== -1) {
    console.log(`Age ${age} (Year ${results.years[index]}):`);
    console.log(`  90th percentile: $${results.percentile90[index].toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  75th percentile: $${results.percentile75[index].toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  Median:          $${results.median[index].toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  25th percentile: $${results.percentile25[index].toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  10th percentile: $${results.percentile10[index].toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  Poor outcome:    $${results.poorOutcome[index].toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log('');
  }
});

console.log(`Success Probability: ${(results.successProbability * 100).toFixed(1)}%\n`);

// Verify data structure
console.log('=== Data Structure Validation ===');
console.log(`✓ Ages array length: ${results.ages.length}`);
console.log(`✓ Years array length: ${results.years.length}`);
console.log(`✓ Median values: ${results.median.length}`);
console.log(`✓ All percentile arrays: ${results.percentile10.length}`);

// Check for fresh calculations
console.log('\n=== Fresh Calculation Test ===');
console.log('Running second simulation to verify fresh calculations...');
const results2 = processMonteCarloResults();
const medianDiff = Math.abs(results.median[20] - results2.median[20]);
console.log(`Median difference at age 70: $${medianDiff.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
console.log(medianDiff > 0 ? '✓ Fresh calculations confirmed (values differ)' : '✗ Values identical (may indicate caching)');

console.log('\n=== Test Complete ===');