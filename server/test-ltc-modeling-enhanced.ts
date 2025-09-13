import { 
  modelLTCEvents, 
  calculateLTCTaxBenefit,
  LTCInsurancePolicy
} from './ltc-modeling';

// Test scenarios based on ASPE/Urban Institute data
const testScenarios = [
  {
    name: "65-year-old woman, no insurance",
    user: {
      age: 65,
      endAge: 95,
      gender: 'female' as const,
      healthStatus: 'good' as const,
      retirementState: 'CA'
    },
    ltcInsurance: {
      type: 'none' as const,
      dailyBenefit: 0,
      benefitPeriodYears: 0,
      eliminationPeriodDays: 0,
      inflationProtection: 'none' as const,
      premiumAnnual: 0,
      policyStartAge: 0,
      sharedCareBenefit: false
    } as LTCInsurancePolicy
  },
  {
    name: "65-year-old man with comprehensive insurance",
    user: {
      age: 65,
      endAge: 90,
      gender: 'male' as const,
      healthStatus: 'good' as const,
      retirementState: 'CA'
    },
    ltcInsurance: {
      type: 'traditional' as const,
      dailyBenefit: 250, // $250/day = $91,250/year
      benefitPeriodYears: 3,
      eliminationPeriodDays: 90,
      eliminationType: 'calendar' as const,
      inflationProtection: '3%_compound' as const,
      premiumAnnual: 3500,
      policyStartAge: 55,
      sharedCareBenefit: false,
      taxQualified: true
    } as LTCInsurancePolicy
  },
  {
    name: "Couple with shared care benefit",
    user: {
      age: 67,
      endAge: 92,
      gender: 'male' as const,
      healthStatus: 'fair' as const,
      retirementState: 'NY'
    },
    spouse: {
      startAge: 65,
      gender: 'female' as const,
      healthStatus: 'good' as const,
      ltcInsurance: {
        type: 'traditional' as const,
        dailyBenefit: 200,
        benefitPeriodYears: 5,
        eliminationPeriodDays: 60,
        eliminationType: 'service' as const,
        inflationProtection: '3%_compound' as const,
        premiumAnnual: 2800,
        policyStartAge: 55,
        sharedCareBenefit: true,
        taxQualified: true
      } as LTCInsurancePolicy
    },
    ltcInsurance: {
      type: 'traditional' as const,
      dailyBenefit: 200,
      benefitPeriodYears: 5,
      eliminationPeriodDays: 60,
      eliminationType: 'service' as const,
      inflationProtection: '3%_compound' as const,
      premiumAnnual: 2800,
      policyStartAge: 57,
      sharedCareBenefit: true,
      taxQualified: true
    } as LTCInsurancePolicy
  }
];

console.log("ENHANCED LTC MODELING TEST - ASPE/URBAN INSTITUTE CALIBRATION");
console.log("=" .repeat(80));
console.log("Expected outcomes based on industry data:");
console.log("- 48% lifetime risk of paid care (57% need LTSS, but 9% use only unpaid care)");
console.log("- Women average 3.7 years of care, Men 2.2 years");
console.log("- 22% need care >5 years, only 15% spend >2 years in nursing home");
console.log("");

// Run simulations
for (const scenario of testScenarios) {
  console.log(`\nScenario: ${scenario.name}`);
  console.log("-".repeat(60));
  
  // Run multiple simulations to get statistics
  const numSimulations = 100;
  let hadLTCCount = 0;
  let totalYearsInLTC = 0;
  let totalCosts = 0;
  let totalBenefits = 0;
  let medicaidCount = 0;
  
  for (let i = 0; i < numSimulations; i++) {
    const result = modelLTCEvents(
      scenario.user.age,
      scenario.user.endAge,
      scenario.user.gender,
      scenario.user.healthStatus,
      scenario.user.retirementState,
      scenario.ltcInsurance,
      scenario.spouse
    );
    
    if (result.hadLTCEvent) {
      hadLTCCount++;
      totalYearsInLTC += result.yearsInLTC;
      totalCosts += result.totalLTCCosts;
      totalBenefits += result.totalInsuranceBenefits;
      if (result.medicaidRequired) medicaidCount++;
    }
  }
  
  // Calculate statistics
  const ltcProbability = (hadLTCCount / numSimulations) * 100;
  const avgYearsIfNeeded = hadLTCCount > 0 ? totalYearsInLTC / hadLTCCount : 0;
  const avgCostIfNeeded = hadLTCCount > 0 ? totalCosts / hadLTCCount : 0;
  const avgBenefitIfNeeded = hadLTCCount > 0 ? totalBenefits / hadLTCCount : 0;
  const medicaidProbability = (medicaidCount / numSimulations) * 100;
  
  console.log(`LTC Probability: ${ltcProbability.toFixed(1)}%`);
  console.log(`Average Duration (if needed): ${avgYearsIfNeeded.toFixed(1)} years`);
  console.log(`Average Cost (if needed): $${Math.round(avgCostIfNeeded).toLocaleString()}`);
  if (scenario.ltcInsurance.type !== 'none') {
    console.log(`Average Benefits (if needed): $${Math.round(avgBenefitIfNeeded).toLocaleString()}`);
    console.log(`Average Out-of-Pocket (if needed): $${Math.round(avgCostIfNeeded - avgBenefitIfNeeded).toLocaleString()}`);
  }
  console.log(`Medicaid Required: ${medicaidProbability.toFixed(1)}%`);
  
  // Test tax benefits calculation
  if (scenario.ltcInsurance.type !== 'none') {
    const sampleAGI = 80000;
    const taxBenefit = calculateLTCTaxBenefit(
      avgCostIfNeeded,
      avgBenefitIfNeeded,
      scenario.ltcInsurance.premiumAnnual,
      sampleAGI,
      scenario.user.age,
      scenario.ltcInsurance
    );
    
    console.log(`\nTax Treatment (AGI: $${sampleAGI.toLocaleString()}):`);
    console.log(`  Deductible Expenses: $${Math.round(taxBenefit.deductibleExpenses).toLocaleString()}`);
    console.log(`  Taxable Benefits: $${Math.round(taxBenefit.taxableBenefits).toLocaleString()}`);
    console.log(`  Deductible Premiums: $${Math.round(taxBenefit.deductiblePremiums).toLocaleString()}`);
  }
}

console.log("\n" + "=".repeat(80));
console.log("KEY OBSERVATIONS:");
console.log("1. Gender differences: Women should show ~1.7x longer duration than men");
console.log("2. Insurance impact: Reduces out-of-pocket costs by 50-80% typically");
console.log("3. Health status: Fair/poor health increases probability significantly");
console.log("4. Tax benefits: Limited due to 7.5% AGI threshold for medical expenses");
console.log("5. Medicaid: Required for lengthy/expensive care without insurance");