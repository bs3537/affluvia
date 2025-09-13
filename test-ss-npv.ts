// Test Social Security NPV calculations
import { LifetimeCashFlowOptimizer } from './server/lifetime-cashflow-optimizer';

// Test profile matching the screenshot
const testProfile = {
  dateOfBirth: new Date('1960-01-01'), // Age 65 in 2025
  socialSecurityBenefit: 30000, // $30k annual benefit at FRA
  desiredRetirementAge: 65,
  userLifeExpectancy: 92,
  maritalStatus: 'single' as const,
  currentAge: 65
};

// Helper to calculate NPV for a claiming age
function calculateNPVForAge(
  claimAge: number, 
  annualBenefit: number,
  currentAge: number,
  longevityAge: number,
  discountRate: number = 0.03,
  colaRate: number = 0.025
): number {
  const optimizer = new LifetimeCashFlowOptimizer(testProfile);
  
  // Calculate benefit at claiming age
  const benefitAtClaim = optimizer.calculateSSBenefit(annualBenefit, claimAge);
  
  let totalNPV = 0;
  
  // Calculate NPV from claiming age to longevity
  for (let yearAge = claimAge; yearAge <= longevityAge; yearAge++) {
    const yearsFromClaim = yearAge - claimAge;
    const yearsFromNow = yearAge - currentAge;
    
    // Apply COLA adjustment
    const adjustedBenefit = benefitAtClaim * Math.pow(1 + colaRate, yearsFromClaim);
    
    // Discount to present value
    const discountFactor = Math.pow(1 + discountRate, yearsFromNow);
    const presentValue = adjustedBenefit / discountFactor;
    
    totalNPV += presentValue;
  }
  
  return totalNPV;
}

console.log('Testing Social Security NPV Calculations');
console.log('=========================================');
console.log('Test Profile:', {
  currentAge: 65,
  retirementAge: 65,
  benefit: '$30,000/year',
  lifeExpectancy: 92,
  longevityForOptimization: 93
});
console.log('');

// Test with user's life expectancy (92)
console.log('NPV using Life Expectancy (92):');
for (let age = 62; age <= 70; age++) {
  const npv = calculateNPVForAge(age, 30000, 65, 92);
  console.log(`  Age ${age}: $${Math.round(npv).toLocaleString()}`);
}
console.log('');

// Test with longevity age (93) used for optimization
console.log('NPV using Longevity Age (93):');
for (let age = 62; age <= 70; age++) {
  const npv = calculateNPVForAge(age, 30000, 65, 93);
  console.log(`  Age ${age}: $${Math.round(npv).toLocaleString()}`);
}
console.log('');

// Find optimal age for each scenario
const npvAt92 = [];
const npvAt93 = [];

for (let age = 62; age <= 70; age++) {
  npvAt92.push({ age, npv: calculateNPVForAge(age, 30000, 65, 92) });
  npvAt93.push({ age, npv: calculateNPVForAge(age, 30000, 65, 93) });
}

const optimalAt92 = npvAt92.reduce((max, curr) => curr.npv > max.npv ? curr : max);
const optimalAt93 = npvAt93.reduce((max, curr) => curr.npv > max.npv ? curr : max);

console.log('Optimal claiming ages:');
console.log(`  Using life expectancy (92): Age ${optimalAt92.age} with NPV $${Math.round(optimalAt92.npv).toLocaleString()}`);
console.log(`  Using longevity (93): Age ${optimalAt93.age} with NPV $${Math.round(optimalAt93.npv).toLocaleString()}`);
console.log('');

// Check what the optimizer actually returns
const optimizer = new LifetimeCashFlowOptimizer(testProfile);
const result = optimizer.findOptimalClaimingAges();
console.log('Optimizer result:', {
  optimalAge: result.optimalUserAge,
  lifetimeCashFlow: Math.round(result.totalLifetimeCashFlow)
});

// Compare retirement age (65) vs optimal age
const npvAtRetirement = calculateNPVForAge(65, 30000, 65, 93);
const npvAtOptimal = calculateNPVForAge(result.optimalUserAge, 30000, 65, 93);
const difference = npvAtOptimal - npvAtRetirement;

console.log('');
console.log('Comparison (using longevity 93):');
console.log(`  NPV at retirement (65): $${Math.round(npvAtRetirement).toLocaleString()}`);
console.log(`  NPV at optimal (${result.optimalUserAge}): $${Math.round(npvAtOptimal).toLocaleString()}`);
console.log(`  Difference: $${Math.round(difference).toLocaleString()} (${difference > 0 ? 'POSITIVE' : 'NEGATIVE'})`);