// Test script for 401(k) contribution limits with annual growth
import {
  getFutureContributionLimit,
  calculateAnnualContributionsWithLimits,
  CONTRIBUTION_LIMITS_2025
} from '../shared/retirement-contribution-limits.ts';

console.log('🚀 Testing 401(k) Contribution Limits with 2% Annual Growth\n');

// Test future contribution limits
console.log('=== Future Contribution Limits (2% CAGR) ===');
const testYears = [2025, 2030, 2035, 2040, 2045, 2050];
const userBirthDate = new Date('1985-06-15'); // 40 years old in 2025
const spouseBirthDate = new Date('1987-03-20'); // 38 years old in 2025

console.log('User (born 1985) 401(k) limits:');
testYears.forEach(year => {
  const limit = getFutureContributionLimit('401k', userBirthDate, year);
  const yearsDifference = year - 2025;
  const growthFactor = Math.pow(1.02, yearsDifference);
  const expectedLimit = Math.round((CONTRIBUTION_LIMITS_2025.standard.baseLimit * growthFactor) / 500) * 500;
  
  console.log(`  ${year}: $${limit.toLocaleString()} (expected ~$${expectedLimit.toLocaleString()})`);
});

console.log('\nSpouse (born 1987) 401(k) limits:');
testYears.forEach(year => {
  const limit = getFutureContributionLimit('401k', spouseBirthDate, year);
  console.log(`  ${year}: $${limit.toLocaleString()}`);
});

// Test with catch-up eligible person (born 1970, will be 55 in 2025)
const catchUpBirthDate = new Date('1970-01-01');
console.log('\nCatch-up eligible (born 1970) 401(k) limits:');
testYears.forEach(year => {
  const limit = getFutureContributionLimit('401k', catchUpBirthDate, year);
  console.log(`  ${year}: $${limit.toLocaleString()}`);
});

// Test annual contributions with limits applied
console.log('\n=== Annual Contributions with Limits Applied ===');
const testContributions = {
  monthlyContribution401k: 2500, // $30k/year desired (will hit limits)
  monthlyContributionIRA: 700,    // $8.4k/year desired (will hit limits)
  monthlyContributionRothIRA: 600, // $7.2k/year desired (will hit limits)
  spouseMonthlyContribution401k: 2200, // $26.4k/year desired
  spouseMonthlyContributionIRA: 600,   // $7.2k/year desired
  spouseMonthlyContributionRothIRA: 500 // $6k/year desired
};

[2025, 2030, 2040].forEach(year => {
  console.log(`\n${year} Contribution Analysis:`);
  const result = calculateAnnualContributionsWithLimits(
    testContributions,
    userBirthDate,
    spouseBirthDate,
    year
  );
  
  console.log(`  Desired Total: $${((testContributions.monthlyContribution401k! + 
                                   testContributions.monthlyContributionIRA! + 
                                   testContributions.monthlyContributionRothIRA! +
                                   testContributions.spouseMonthlyContribution401k! +
                                   testContributions.spouseMonthlyContributionIRA! +
                                   testContributions.spouseMonthlyContributionRothIRA!) * 12).toLocaleString()}`);
  
  console.log(`  Actual Limited: $${result.totalHouseholdContributions.toLocaleString()}`);
  console.log(`  User 401(k): $${result.limitedContributions.user401k.toLocaleString()}`);
  console.log(`  User IRA: $${result.limitedContributions.userIRA.toLocaleString()}`);
  console.log(`  User Roth IRA: $${result.limitedContributions.userRothIRA.toLocaleString()}`);
  console.log(`  Spouse 401(k): $${result.limitedContributions.spouse401k.toLocaleString()}`);
  console.log(`  Spouse IRA: $${result.limitedContributions.spouseIRA.toLocaleString()}`);
  console.log(`  Spouse Roth IRA: $${result.limitedContributions.spouseRothIRA.toLocaleString()}`);
});

// Test growth calculation accuracy
console.log('\n=== Growth Rate Validation ===');
const baseLimit2025 = CONTRIBUTION_LIMITS_2025.standard.baseLimit;
const futureLimit2045 = getFutureContributionLimit('401k', new Date('1990-01-01'), 2045);
const actualGrowthRate = Math.pow(futureLimit2045 / baseLimit2025, 1/20) - 1;
console.log(`Base 2025 limit: $${baseLimit2025.toLocaleString()}`);
console.log(`Calculated 2045 limit: $${futureLimit2045.toLocaleString()}`);
console.log(`Implied annual growth rate: ${(actualGrowthRate * 100).toFixed(2)}%`);
console.log(`Target growth rate: 2.00%`);

console.log('\n✅ Contribution limits with annual growth testing complete!');