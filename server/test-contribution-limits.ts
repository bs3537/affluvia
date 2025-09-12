// Manual test script for retirement contribution limits
import {
  getAgeCatchUpEligibility,
  getContributionLimit,
  validateContribution,
  CONTRIBUTION_LIMITS_2025
} from '../shared/retirement-contribution-limits.ts';

console.log('🧪 Testing Retirement Contribution Limits (2025)\n');

// Test cases for different ages
const testCases = [
  { name: 'Young Professional (Age 35)', birthDate: '1990-01-15' },
  { name: 'Mid-Career (Age 45)', birthDate: '1980-06-20' },
  { name: 'Catch-Up Eligible (Age 55)', birthDate: '1970-03-10' },
  { name: 'Enhanced Catch-Up (Age 61)', birthDate: '1964-09-05' },
  { name: 'Senior (Age 70)', birthDate: '1955-12-25' }
];

console.log('=== Age-Based Catch-Up Eligibility ===\n');

for (const testCase of testCases) {
  const eligibility = getAgeCatchUpEligibility(testCase.birthDate);
  const age = new Date().getFullYear() - new Date(testCase.birthDate).getFullYear();
  
  console.log(`${testCase.name}:`);
  console.log(`  Current Age: ${age}`);
  console.log(`  Catch-Up Eligible: ${eligibility.isEligibleForCatchUp ? 'Yes' : 'No'}`);
  console.log(`  Enhanced Catch-Up: ${eligibility.isEligibleForEnhancedCatchUp ? 'Yes' : 'No'}`);
  console.log(`  Additional Amount: $${eligibility.catchUpAmount.toLocaleString()}`);
  console.log('');
}

console.log('\n=== Contribution Limits by Account Type ===\n');

const accountTypes = ['401k', '403b', 'traditional-ira', 'roth-ira', 'simple-401k'];

for (const accountType of accountTypes) {
  console.log(`${accountType.toUpperCase()} Limits:`);
  
  for (const testCase of testCases) {
    const limit = getContributionLimit(accountType, testCase.birthDate);
    const age = new Date().getFullYear() - new Date(testCase.birthDate).getFullYear();
    console.log(`  Age ${age}: $${limit.toLocaleString()}/year`);
  }
  console.log('');
}

console.log('\n=== Validation Examples ===\n');

// Example 1: Within limits
console.log('Example 1: Monthly contribution of $1,500 (Age 35)');
const validation1 = validateContribution(1500, '401k', '1990-01-15', false);
console.log(`  Annual: $${(1500 * 12).toLocaleString()}`);
console.log(`  Valid: ${validation1.isValid ? '✅ Yes' : '❌ No'}`);
console.log(`  Limit: $${validation1.limit.toLocaleString()}`);
if (!validation1.isValid) console.log(`  Message: ${validation1.message}`);
console.log('');

// Example 2: Exceeding limits
console.log('Example 2: Monthly contribution of $2,500 (Age 45)');
const validation2 = validateContribution(2500, '401k', '1980-06-20', false);
console.log(`  Annual: $${(2500 * 12).toLocaleString()}`);
console.log(`  Valid: ${validation2.isValid ? '✅ Yes' : '❌ No'}`);
console.log(`  Limit: $${validation2.limit.toLocaleString()}`);
if (!validation2.isValid) console.log(`  Message: ${validation2.message}`);
console.log('');

// Example 3: With catch-up
console.log('Example 3: Monthly contribution of $2,500 (Age 55 - with catch-up)');
const validation3 = validateContribution(2500, '401k', '1970-03-10', false);
console.log(`  Annual: $${(2500 * 12).toLocaleString()}`);
console.log(`  Valid: ${validation3.isValid ? '✅ Yes' : '❌ No'}`);
console.log(`  Limit: $${validation3.limit.toLocaleString()}`);
if (!validation3.isValid) console.log(`  Message: ${validation3.message}`);
console.log('');

// Example 4: Enhanced catch-up
console.log('Example 4: Monthly contribution of $2,895 (Age 61 - enhanced catch-up)');
const validation4 = validateContribution(2895, '401k', '1964-09-05', false);
console.log(`  Annual: $${(2895 * 12).toLocaleString()}`);
console.log(`  Valid: ${validation4.isValid ? '✅ Yes' : '❌ No'}`);
console.log(`  Limit: $${validation4.limit.toLocaleString()}`);
if (!validation4.isValid) console.log(`  Message: ${validation4.message}`);
console.log('');

console.log('\n=== 2025 Contribution Limits Summary ===\n');
console.log('Standard 401(k)/403(b)/457(b):');
console.log(`  Base Limit: $${CONTRIBUTION_LIMITS_2025.standard.baseLimit.toLocaleString()}`);
console.log(`  Catch-Up (50+): +$${CONTRIBUTION_LIMITS_2025.standard.catchUpLimit.toLocaleString()}`);
console.log(`  Enhanced Catch-Up (60-63): +$${CONTRIBUTION_LIMITS_2025.standard.enhancedCatchUpLimit.toLocaleString()}`);
console.log(`  Total Annual Additions: $${CONTRIBUTION_LIMITS_2025.standard.totalAnnualAdditionsLimit.toLocaleString()}`);
console.log('');

console.log('IRA (Traditional/Roth):');
console.log(`  Base Limit: $${CONTRIBUTION_LIMITS_2025.ira.baseLimit.toLocaleString()}`);
console.log(`  Catch-Up (50+): +$${CONTRIBUTION_LIMITS_2025.ira.catchUpLimit.toLocaleString()}`);
console.log('');

console.log('SIMPLE 401(k):');
console.log(`  Base Limit: $${CONTRIBUTION_LIMITS_2025.simple.baseLimit.toLocaleString()}`);
console.log(`  Catch-Up (50+): +$${CONTRIBUTION_LIMITS_2025.simple.catchUpLimit.toLocaleString()}`);
console.log(`  Enhanced Catch-Up (60-63): +$${CONTRIBUTION_LIMITS_2025.simple.enhancedCatchUpLimit.toLocaleString()}`);

console.log('\n✅ All tests completed!');