// Test script to verify optimal Social Security ages calculation and display
import { calculateOptimalSSClaimAges } from './optimal-ss-claim';

// Test data for a typical user
const testUser = {
  dateOfBirth: '1965-06-15', // 59 years old
  annualIncome: 100000,
  socialSecurityBenefit: 2500, // Monthly PIA at FRA
  userLifeExpectancy: 85,
  maritalStatus: 'married',
  spouseDateOfBirth: '1967-03-20', // 57 years old
  spouseAnnualIncome: 60000,
  spouseSocialSecurityBenefit: 1800, // Monthly PIA at FRA
  spouseLifeExpectancy: 88
};

console.log('=== Testing Optimal Social Security Claiming Ages ===\n');
console.log('Test User Profile:');
console.log('- User birth year:', new Date(testUser.dateOfBirth).getFullYear());
console.log('- User monthly benefit at FRA: $' + testUser.socialSecurityBenefit);
console.log('- User life expectancy:', testUser.userLifeExpectancy);
console.log('- Spouse birth year:', new Date(testUser.spouseDateOfBirth).getFullYear());
console.log('- Spouse monthly benefit at FRA: $' + testUser.spouseSocialSecurityBenefit);
console.log('- Spouse life expectancy:', testUser.spouseLifeExpectancy);
console.log('\n');

const result = calculateOptimalSSClaimAges(testUser);

console.log('=== OPTIMIZATION RESULTS ===\n');
console.log('User Optimal Strategy:');
console.log('- Optimal claiming age:', result.user.optimalAge);
console.log('- Lifetime benefit (NPV): $' + result.user.maxLifetimeBenefit.toLocaleString());
console.log('- Per month (avg): $' + Math.round(result.user.maxLifetimeBenefit / ((testUser.userLifeExpectancy - result.user.optimalAge) * 12)).toLocaleString());

if (result.spouse) {
  console.log('\nSpouse Optimal Strategy:');
  console.log('- Optimal claiming age:', result.spouse.optimalAge);
  console.log('- Lifetime benefit (NPV): $' + result.spouse.maxLifetimeBenefit.toLocaleString());
  console.log('- Per month (avg): $' + Math.round(result.spouse.maxLifetimeBenefit / ((testUser.spouseLifeExpectancy - result.spouse.optimalAge) * 12)).toLocaleString());
  
  console.log('\nHousehold Combined:');
  console.log('- Total lifetime benefit: $' + (result.user.maxLifetimeBenefit + result.spouse.maxLifetimeBenefit).toLocaleString());
}

// Test different scenarios
console.log('\n=== SCENARIO ANALYSIS ===\n');

// Early retirement scenario
const earlyRetiree = { ...testUser, userLifeExpectancy: 78, spouseLifeExpectancy: 80 };
const earlyResult = calculateOptimalSSClaimAges(earlyRetiree);
console.log('Early Retirement (shorter life expectancy):');
console.log('- User optimal age:', earlyResult.user.optimalAge, '(benefit: $' + earlyResult.user.maxLifetimeBenefit.toLocaleString() + ')');
console.log('- Spouse optimal age:', earlyResult.spouse?.optimalAge, '(benefit: $' + earlyResult.spouse?.maxLifetimeBenefit.toLocaleString() + ')');

// Longevity scenario
const longevity = { ...testUser, userLifeExpectancy: 95, spouseLifeExpectancy: 98 };
const longevityResult = calculateOptimalSSClaimAges(longevity);
console.log('\nLongevity (longer life expectancy):');
console.log('- User optimal age:', longevityResult.user.optimalAge, '(benefit: $' + longevityResult.user.maxLifetimeBenefit.toLocaleString() + ')');
console.log('- Spouse optimal age:', longevityResult.spouse?.optimalAge, '(benefit: $' + longevityResult.spouse?.maxLifetimeBenefit.toLocaleString() + ')');

console.log('\n=== TEST COMPLETED ===');