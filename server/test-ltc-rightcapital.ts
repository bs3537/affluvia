// Test file for RightCapital-style LTC modeling
import { modelLTCEvents, calculateDeterministicLTCCosts } from './ltc-modeling';

console.log('Testing RightCapital-style LTC Modeling\n');
console.log('========================================\n');

// Test Case 1: Single person, no insurance
console.log('Test Case 1: Single Person, No Insurance');
console.log('-----------------------------------------');
const result1 = modelLTCEvents(
  65, // retirement age
  90, // end age (life expectancy)
  'male',
  'good',
  'FL', // Florida
  {
    type: 'none',
    dailyBenefit: 0,
    benefitPeriodYears: 0,
    eliminationPeriodDays: 0,
    inflationProtection: 'none',
    premiumAnnual: 0,
    policyStartAge: 65
  }
);

console.log('Had LTC Event:', result1.hadLTCEvent);
console.log('Total LTC Costs:', result1.totalLTCCosts.toLocaleString());
console.log('Out of Pocket:', result1.totalOutOfPocketCosts.toLocaleString());
console.log('Years in LTC:', result1.yearsInLTC);
console.log('Events:', result1.ltcEvents.length);
if (result1.ltcEvents.length > 0) {
  console.log('Event Details:', result1.ltcEvents.map(e => ({
    startAge: e.startAge,
    duration: e.duration,
    annualCost: e.careCostAnnual.toLocaleString()
  })));
}

console.log('\n');

// Test Case 2: Married couple, both with same costs
console.log('Test Case 2: Married Couple, No Insurance');
console.log('------------------------------------------');
const result2 = modelLTCEvents(
  65, // retirement age
  90, // end age
  'male',
  'good',
  'FL',
  {
    type: 'none',
    dailyBenefit: 0,
    benefitPeriodYears: 0,
    eliminationPeriodDays: 0,
    inflationProtection: 'none',
    premiumAnnual: 0,
    policyStartAge: 65
  },
  {
    startAge: 63, // spouse is 2 years younger
    gender: 'female',
    healthStatus: 'good',
    ltcInsurance: {
      type: 'none',
      dailyBenefit: 0,
      benefitPeriodYears: 0,
      eliminationPeriodDays: 0,
      inflationProtection: 'none',
      premiumAnnual: 0,
      policyStartAge: 63
    }
  }
);

console.log('Had LTC Event:', result2.hadLTCEvent);
console.log('Total LTC Costs:', result2.totalLTCCosts.toLocaleString());
console.log('Out of Pocket:', result2.totalOutOfPocketCosts.toLocaleString());
console.log('Years in LTC:', result2.yearsInLTC);
console.log('Events:', result2.ltcEvents.length);
if (result2.ltcEvents.length > 0) {
  console.log('Event Details:', result2.ltcEvents.map(e => ({
    startAge: e.startAge,
    duration: e.duration,
    annualCost: e.careCostAnnual.toLocaleString()
  })));
}

console.log('\n');

// Test Case 3: Deterministic costs (for projections)
console.log('Test Case 3: Deterministic LTC Costs');
console.log('-------------------------------------');
const detResult = calculateDeterministicLTCCosts(
  65, // retirement age
  90, // end age
  'male',
  'good',
  {
    type: 'none',
    dailyBenefit: 0,
    benefitPeriodYears: 0,
    eliminationPeriodDays: 0,
    inflationProtection: 'none',
    premiumAnnual: 0,
    policyStartAge: 65
  },
  {
    startAge: 63,
    gender: 'female',
    healthStatus: 'good',
    ltcInsurance: {
      type: 'none',
      dailyBenefit: 0,
      benefitPeriodYears: 0,
      eliminationPeriodDays: 0,
      inflationProtection: 'none',
      premiumAnnual: 0,
      policyStartAge: 63
    }
  }
);

console.log('Total Expected Cost:', detResult.totalExpectedCost.toLocaleString());
console.log('Total Expected Benefit:', detResult.totalExpectedBenefit.toLocaleString());
console.log('\nYearly LTC Costs (last 5 years):');
for (let age = 86; age <= 90; age++) {
  const cost = detResult.yearlyLTCCosts.get(age) || 0;
  if (cost > 0) {
    console.log(`Age ${age}: $${cost.toLocaleString()}`);
  }
}

console.log('\n');

// Test Case 4: With LTC Insurance
console.log('Test Case 4: With LTC Insurance');
console.log('--------------------------------');
const result4 = modelLTCEvents(
  65,
  90,
  'male',
  'good',
  'FL',
  {
    type: 'traditional',
    dailyBenefit: 250, // $250/day benefit
    benefitPeriodYears: 3,
    eliminationPeriodDays: 90,
    inflationProtection: '3%_compound',
    premiumAnnual: 3000,
    policyStartAge: 65
  }
);

console.log('Had LTC Event:', result4.hadLTCEvent);
console.log('Total LTC Costs:', result4.totalLTCCosts.toLocaleString());
console.log('Insurance Benefits:', result4.totalInsuranceBenefits.toLocaleString());
console.log('Out of Pocket:', result4.totalOutOfPocketCosts.toLocaleString());
console.log('Years in LTC:', result4.yearsInLTC);

console.log('\n========================================');
console.log('Testing Complete');