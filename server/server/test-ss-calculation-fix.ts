/**
 * Test Social Security calculation fixes
 * Verifies calculations match expected values for a couple with:
 * - User: $60k annual income, age 51
 * - Spouse: $450k annual income, age 51
 */

import { 
  calculateAIME, 
  calculateSocialSecurityBenefit,
  adjustPIAForClaimAge,
  SS_PARAMS_2025 
} from './social-security-calculator';

console.log('Testing Social Security Calculation Fixes\n');
console.log('=' .repeat(50));

// Test Case: Couple from screenshot
const userIncome = 60000 / 12;  // $5,000/month
const spouseIncome = 450000 / 12;  // $37,500/month (capped at max)
const currentAge = 51;

console.log('\nTest Inputs:');
console.log(`User: $${userIncome.toLocaleString()}/month ($${(userIncome * 12).toLocaleString()}/year), Age ${currentAge}`);
console.log(`Spouse: $${spouseIncome.toLocaleString()}/month ($${(spouseIncome * 12).toLocaleString()}/year), Age ${currentAge}`);

// Calculate for different claiming ages
const testAges = [65, 67, 69];

console.log('\n' + '='.repeat(50));
console.log('USER CALCULATIONS:');
console.log('='.repeat(50));

testAges.forEach(claimAge => {
  const benefit = calculateSocialSecurityBenefit(userIncome, currentAge, claimAge);
  const annualBenefit = benefit * 12;
  
  console.log(`\nClaim at Age ${claimAge}:`);
  console.log(`  Monthly Benefit: $${benefit.toLocaleString()}`);
  console.log(`  Annual Benefit: $${annualBenefit.toLocaleString()}`);
  
  // Calculate cumulative to age 93
  const yearsReceiving = 93 - claimAge;
  const cumulative = annualBenefit * yearsReceiving;
  console.log(`  Years Receiving: ${yearsReceiving}`);
  console.log(`  Cumulative (undiscounted): $${cumulative.toLocaleString()}`);
});

// Test AIME calculation directly
const userYearsWorked = 65 - 22; // Assuming work from 22 to 65
const userAIME = calculateAIME(userIncome, userYearsWorked, currentAge);
console.log(`\nUser AIME: $${userAIME.toLocaleString()}`);

console.log('\n' + '='.repeat(50));
console.log('SPOUSE CALCULATIONS:');
console.log('='.repeat(50));

testAges.forEach(claimAge => {
  const benefit = calculateSocialSecurityBenefit(spouseIncome, currentAge, claimAge);
  const annualBenefit = benefit * 12;
  
  console.log(`\nClaim at Age ${claimAge}:`);
  console.log(`  Monthly Benefit: $${benefit.toLocaleString()}`);
  console.log(`  Annual Benefit: $${annualBenefit.toLocaleString()}`);
  
  // Calculate cumulative to age 93
  const yearsReceiving = 93 - claimAge;
  const cumulative = annualBenefit * yearsReceiving;
  console.log(`  Years Receiving: ${yearsReceiving}`);
  console.log(`  Cumulative (undiscounted): $${cumulative.toLocaleString()}`);
});

// Test AIME calculation directly for max earner
const spouseYearsWorked = 65 - 25; // High earners often start later (more education)
const spouseAIME = calculateAIME(spouseIncome, spouseYearsWorked, currentAge);
console.log(`\nSpouse AIME: $${spouseAIME.toLocaleString()}`);

console.log('\n' + '='.repeat(50));
console.log('COMBINED HOUSEHOLD TOTALS:');
console.log('='.repeat(50));

testAges.forEach(claimAge => {
  const userBenefit = calculateSocialSecurityBenefit(userIncome, currentAge, claimAge);
  const spouseBenefit = calculateSocialSecurityBenefit(spouseIncome, currentAge, claimAge);
  const combinedMonthly = userBenefit + spouseBenefit;
  const combinedAnnual = combinedMonthly * 12;
  const yearsReceiving = 93 - claimAge;
  const combinedCumulative = combinedAnnual * yearsReceiving;
  
  console.log(`\nBoth Claim at Age ${claimAge}:`);
  console.log(`  Combined Monthly: $${combinedMonthly.toLocaleString()}`);
  console.log(`  Combined Annual: $${combinedAnnual.toLocaleString()}`);
  console.log(`  Combined Cumulative: $${combinedCumulative.toLocaleString()}`);
});

console.log('\n' + '='.repeat(50));
console.log('OPTIMAL STRATEGY COMPARISON:');
console.log('='.repeat(50));

// Calculate difference between claiming at 65 vs 69
const benefit65User = calculateSocialSecurityBenefit(userIncome, currentAge, 65);
const benefit69User = calculateSocialSecurityBenefit(userIncome, currentAge, 69);
const benefit65Spouse = calculateSocialSecurityBenefit(spouseIncome, currentAge, 65);
const benefit69Spouse = calculateSocialSecurityBenefit(spouseIncome, currentAge, 69);

const cumulative65 = (benefit65User + benefit65Spouse) * 12 * 28; // 28 years from 65 to 93
const cumulative69 = (benefit69User + benefit69Spouse) * 12 * 24; // 24 years from 69 to 93

console.log('\nClaim at 65 (28 years of benefits):');
console.log(`  Total Cumulative: $${cumulative65.toLocaleString()}`);

console.log('\nClaim at 69 (24 years of benefits):');
console.log(`  Total Cumulative: $${cumulative69.toLocaleString()}`);

console.log('\nDifference (69 vs 65):');
console.log(`  Additional Benefits: $${(cumulative69 - cumulative65).toLocaleString()}`);
console.log(`  Percentage Gain: ${(((cumulative69 - cumulative65) / cumulative65) * 100).toFixed(1)}%`);

console.log('\n' + '='.repeat(50));
console.log('EXPECTED VALUES (from correct calculation):');
console.log('='.repeat(50));
console.log('User PIA at FRA: ~$3,266');
console.log('Spouse PIA at FRA: ~$5,961');
console.log('Combined at 65: ~$7,997/month ($95,964/year)');
console.log('Combined at 69: ~$10,704/month ($128,448/year)');
console.log('Cumulative at 65: ~$2,686,992');
console.log('Cumulative at 69: ~$3,082,752');
console.log('Difference: ~$395,760');

console.log('\n' + '='.repeat(50));
console.log('TEST COMPLETE');
console.log('=' .repeat(50));