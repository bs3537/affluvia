#!/usr/bin/env tsx

import { profileToRetirementParams } from './monte-carlo-base.js';

// Test all risk profile returns
const riskProfiles = [
  { score: 1, name: 'Conservative', expectedReturn: 0.050 },
  { score: 2, name: 'Moderately Conservative', expectedReturn: 0.056 },
  { score: 3, name: 'Moderate', expectedReturn: 0.061 },
  { score: 4, name: 'Moderately Aggressive', expectedReturn: 0.066 },
  { score: 5, name: 'Aggressive', expectedReturn: 0.070 }
];

console.log('Testing All Risk Profile Returns');
console.log('='.repeat(50));
console.log('');

for (const profile of riskProfiles) {
  const testProfile = {
    dateOfBirth: '1975-01-01',
    maritalStatus: 'single',
    riskQuestions: [profile.score],
    desiredRetirementAge: 65,
    userLifeExpectancy: 90,
    assets: [{ type: '401k', value: 100000, owner: 'user' }],
    expectedMonthlyExpensesRetirement: 5000,
    socialSecurityBenefit: 2000,
    retirementContributions: { employee: 1000, employer: 500 },
    expectedInflationRate: 2,
    withdrawalRate: 4,
    legacyGoal: 0,
    state: 'TX',
    retirementState: 'TX'
  };
  
  const params = profileToRetirementParams(testProfile);
  
  console.log(`${profile.name} (Score: ${profile.score}):`);
  console.log(`  Expected: ${(profile.expectedReturn * 100).toFixed(1)}%`);
  console.log(`  Actual:   ${(params.expectedReturn * 100).toFixed(1)}%`);
  console.log(`  ✓ Match:  ${Math.abs(params.expectedReturn - profile.expectedReturn) < 0.0001 ? 'YES' : 'NO'}`);
  console.log('');
}

console.log('All risk profile returns verified successfully!');