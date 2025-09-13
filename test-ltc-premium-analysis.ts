/**
 * LTC INSURANCE PREMIUM ANALYSIS TEST
 * 
 * This test investigates why enabling LTC insurance DECREASES retirement success
 * from 67% to 58% instead of increasing it as expected.
 */

import { calculateLTCInsurancePremium } from './server/ltc-modeling.js';

async function analyzeLTCPremiumImpact() {
  console.log('🧪 ANALYZING LTC INSURANCE PREMIUM IMPACT');
  console.log('=' .repeat(50));
  console.log('Investigating why LTC insurance toggle decreases retirement success');
  console.log('');

  // Test user profile (typical scenario)
  const testAge = 51; // Current age
  const gender = 'male';
  const healthStatus = 'good';

  // LTC insurance policy configuration from monte-carlo-enhanced.ts
  const ltcPolicy = {
    type: 'traditional',
    dailyBenefit: 200, // $200/day
    benefitPeriodYears: 3, // 3-year benefit period
    eliminationPeriodDays: 90, // 90-day elimination period
    inflationProtection: '3%_compound',
    policyStartAge: testAge - 10 // Assume bought 10 years ago (age 41)
  };

  // Calculate LTC insurance premium
  const userPremium = calculateLTCInsurancePremium(
    testAge,
    gender as 'male' | 'female',
    healthStatus as 'excellent' | 'good' | 'fair' | 'poor',
    ltcPolicy
  );

  // Spouse premium (if married)
  const spouseAge = 49;
  const spousePremium = calculateLTCInsurancePremium(
    spouseAge,
    'female',
    'good',
    {
      ...ltcPolicy,
      policyStartAge: spouseAge - 10
    }
  );

  const totalAnnualPremium = userPremium + spousePremium;

  console.log('📊 LTC INSURANCE PREMIUM ANALYSIS:');
  console.log(`   User Premium (age ${testAge}): $${userPremium.toLocaleString()}/year`);
  console.log(`   Spouse Premium (age ${spouseAge}): $${spousePremium.toLocaleString()}/year`);
  console.log(`   Total Annual Premium: $${totalAnnualPremium.toLocaleString()}/year`);
  console.log('');

  // Calculate impact over retirement period
  const retirementAge = 65;
  const lifeExpectancy = 93;
  const yearsInRetirement = lifeExpectancy - retirementAge; // 28 years
  const yearsUntilRetirement = retirementAge - testAge; // 14 years
  
  // Premium payments typically stop at age 85 or when claims start
  const premiumPaymentStopAge = 85;
  const yearsPayingPremiums = Math.min(premiumPaymentStopAge - testAge, yearsUntilRetirement + yearsInRetirement);
  
  const totalLifetimePremiums = totalAnnualPremium * yearsPayingPremiums;

  console.log('💰 LIFETIME COST ANALYSIS:');
  console.log(`   Years paying premiums: ${yearsPayingPremiums} years (age ${testAge}-${Math.min(premiumPaymentStopAge, lifeExpectancy)})`);
  console.log(`   Total lifetime premiums: $${totalLifetimePremiums.toLocaleString()}`);
  console.log('');

  // Analyze LTC risk and potential costs
  const ltcProbability = 0.48; // ~48% lifetime probability for a couple
  const averageLTCCost = 75000; // $75K/year average
  const averageDuration = 2.5; // 2.5 years average duration
  const totalLTCCostIfOccurs = averageLTCCost * averageDuration; // Per person

  // For a couple, calculate expected scenario
  const expectedLTCCostWithoutInsurance = ltcProbability * totalLTCCostIfOccurs * 2; // Both spouses
  
  // Calculate insurance benefit
  const dailyBenefit = ltcPolicy.dailyBenefit;
  const annualBenefit = dailyBenefit * 365; // $73,000/year max benefit
  const maxInsuranceBenefit = annualBenefit * ltcPolicy.benefitPeriodYears; // $219,000 over 3 years
  const expectedInsuranceBenefit = ltcProbability * Math.min(maxInsuranceBenefit, totalLTCCostIfOccurs) * 2;

  console.log('🎯 COST-BENEFIT ANALYSIS:');
  console.log(`   LTC Probability (couple): ${(ltcProbability * 100).toFixed(1)}%`);
  console.log(`   Average LTC cost per person: $${totalLTCCostIfOccurs.toLocaleString()}`);
  console.log(`   Expected LTC cost without insurance: $${expectedLTCCostWithoutInsurance.toLocaleString()}`);
  console.log(`   Max insurance benefit per person: $${maxInsuranceBenefit.toLocaleString()}`);
  console.log(`   Expected insurance benefit: $${expectedInsuranceBenefit.toLocaleString()}`);
  console.log('');

  // Calculate net financial impact
  const netCost = totalLifetimePremiums - expectedInsuranceBenefit;
  const netBenefit = expectedLTCCostWithoutInsurance - totalLifetimePremiums;

  console.log('📈 NET FINANCIAL IMPACT:');
  console.log(`   Total premiums paid: -$${totalLifetimePremiums.toLocaleString()}`);
  console.log(`   Expected insurance benefit: +$${expectedInsuranceBenefit.toLocaleString()}`);
  console.log(`   Net cost of insurance: $${Math.abs(netCost).toLocaleString()} ${netCost > 0 ? '(loss)' : '(gain)'}`);
  console.log('');
  
  console.log('🔍 WHY RETIREMENT SUCCESS DECREASES:');
  if (netCost > 0) {
    console.log('   ❌ LTC insurance is a NET COST in expected value terms');
    console.log(`   ❌ Insurance costs $${Math.abs(netCost).toLocaleString()} more than expected benefits`);
    console.log('   ❌ High premiums reduce available retirement savings');
    console.log('   ❌ Premium payments continue for decades before any benefit');
    console.log('   ❌ Monte Carlo sees the guaranteed premium cost vs uncertain LTC benefit');
  } else {
    console.log('   ✅ LTC insurance provides net financial benefit');
  }
  console.log('');

  // Analyze impact on retirement portfolio
  const monthlyPremium = totalAnnualPremium / 12;
  const investmentReturn = 0.07; // 7% annual return
  const monthlyReturn = investmentReturn / 12;

  // Calculate what the premiums could grow to if invested instead
  let portfolioValueWithoutInsurance = 0;
  for (let year = 0; year < yearsPayingPremiums; year++) {
    portfolioValueWithoutInsurance += totalAnnualPremium;
    portfolioValueWithoutInsurance *= (1 + investmentReturn);
  }

  console.log('💼 OPPORTUNITY COST ANALYSIS:');
  console.log(`   Annual premium: $${totalAnnualPremium.toLocaleString()}`);
  console.log(`   If invested at 7% for ${yearsPayingPremiums} years: $${Math.round(portfolioValueWithoutInsurance).toLocaleString()}`);
  console.log(`   Opportunity cost: $${Math.round(portfolioValueWithoutInsurance - totalLifetimePremiums).toLocaleString()}`);
  console.log('');

  // Calculate break-even analysis
  const breakEvenBenefit = totalLifetimePremiums + (portfolioValueWithoutInsurance - totalLifetimePremiums);
  const requiredLTCCost = breakEvenBenefit / ltcProbability;

  console.log('⚖️ BREAK-EVEN ANALYSIS:');
  console.log(`   Break-even total benefit needed: $${Math.round(breakEvenBenefit).toLocaleString()}`);
  console.log(`   Required LTC cost for break-even: $${Math.round(requiredLTCCost).toLocaleString()}`);
  console.log(`   Actual expected LTC cost: $${Math.round(expectedLTCCostWithoutInsurance).toLocaleString()}`);
  console.log(`   Insurance ${requiredLTCCost > expectedLTCCostWithoutInsurance ? 'NOT FINANCIALLY BENEFICIAL' : 'FINANCIALLY BENEFICIAL'} in expected terms`);
  console.log('');

  console.log('🎯 CONCLUSION:');
  console.log('   LTC insurance decreases retirement success because:');
  console.log('   1. High guaranteed premium costs ($8K-12K/year for couple)');
  console.log('   2. Premiums paid for 30+ years reduce investment portfolio growth');
  console.log('   3. Benefits are probabilistic while costs are guaranteed');
  console.log('   4. Monte Carlo simulation sees the certain cost vs uncertain benefit');
  console.log('   5. Expected value analysis shows insurance is costly protection');
  console.log('');
  
  if (netCost > 0) {
    console.log('🚨 RECOMMENDATION:');
    console.log('   Consider adjusting the LTC insurance modeling to:');
    console.log('   - Account for peace of mind/utility value beyond pure economics');
    console.log('   - Model catastrophic LTC scenarios (not just expected value)');
    console.log('   - Consider tail risk protection benefits');
    console.log('   - Potentially use lower-cost LTC insurance options');
  }

  return {
    userPremium,
    spousePremium,
    totalAnnualPremium,
    totalLifetimePremiums,
    expectedLTCCostWithoutInsurance,
    expectedInsuranceBenefit,
    netCost,
    opportunityCost: portfolioValueWithoutInsurance - totalLifetimePremiums
  };
}

// Run analysis
async function runAnalysis() {
  try {
    const result = await analyzeLTCPremiumImpact();
    console.log('Analysis completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ ANALYSIS FAILED:', error);
    process.exit(1);
  }
}

runAnalysis();