import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './monte-carlo-enhanced';
import { AssetBuckets } from './asset-tax-classifier';
import { calculateSocialSecurityBenefit } from './social-security-calculator';

// Test different inflation scenarios
const inflationScenarios = [
  { name: "Low Inflation", rate: 0.02, healthcare: 0.035 },
  { name: "Normal Inflation", rate: 0.025, healthcare: 0.045 },
  { name: "Moderate Inflation", rate: 0.035, healthcare: 0.055 },
  { name: "High Inflation", rate: 0.05, healthcare: 0.07 },
  { name: "Very High Inflation", rate: 0.07, healthcare: 0.09 }
];

// Test profile: Mid-career professional
const testProfile = {
  name: "Test Professional",
  age: 45,
  monthlyIncome: 8000,
  retirementAge: 65,
  currentSavings: 250000,
  monthlyExpenses: 6000,
  retirementExpenses: 4200, // 70% of current
  monthlyContributions: 1000
};

async function runInflationStressTest() {
  console.log("INFLATION STRESS TEST");
  console.log("=".repeat(80));
  console.log(`Profile: ${testProfile.name}, Age ${testProfile.age}, Retiring at ${testProfile.retirementAge}`);
  console.log(`Current Savings: $${testProfile.currentSavings.toLocaleString()}`);
  console.log(`Monthly Contribution: $${testProfile.monthlyContributions.toLocaleString()}`);
  console.log("");

  const results: any[] = [];

  for (const scenario of inflationScenarios) {
    // Calculate Social Security
    const ssBenefit = calculateSocialSecurityBenefit(
      testProfile.monthlyIncome,
      testProfile.age,
      testProfile.retirementAge,
      testProfile.retirementAge - 22
    );

    // Create asset buckets
    const assetBuckets: AssetBuckets = {
      taxDeferred: testProfile.currentSavings * 0.7,
      taxFree: testProfile.currentSavings * 0.1,
      capitalGains: testProfile.currentSavings * 0.15,
      cashEquivalents: testProfile.currentSavings * 0.05,
      totalAssets: testProfile.currentSavings
    };

    // Create params with scenario inflation
    const params: RetirementMonteCarloParams = {
      currentAge: testProfile.age,
      retirementAge: testProfile.retirementAge,
      lifeExpectancy: 90,
      currentRetirementAssets: testProfile.currentSavings,
      annualGuaranteedIncome: 0, // Will kick in at retirement
      socialSecurityClaimAge: testProfile.retirementAge,
      socialSecurityBenefit: ssBenefit,
      annualRetirementExpenses: testProfile.retirementExpenses * 12,
      annualHealthcareCosts: 8000, // Estimate
      
      // Use NOMINAL returns for all scenarios
      expectedReturn: 0.07 + scenario.rate, // Nominal = real + inflation
      returnVolatility: 0.15,
      inflationRate: scenario.rate,
      
      // Asset allocation (moderate)
      stockAllocation: 0.6,
      bondAllocation: 0.32,
      cashAllocation: 0.08,
      
      withdrawalRate: 0.04,
      useGuardrails: true,
      taxRate: 0.22,
      annualSavings: testProfile.monthlyContributions * 12,
      userAnnualIncome: testProfile.monthlyIncome * 12,
      hasLongTermCareInsurance: false,
      legacyGoal: 0,
      assetBuckets: assetBuckets,
      retirementState: 'CA',
      
      // Nominal dollar parameters
      useNominalDollars: true,
      displayInTodaysDollars: true,
      generalInflationRate: scenario.rate,
      healthcareInflationRate: scenario.healthcare,
      socialSecurityCOLARate: scenario.rate
    };

    // Run simulation
    console.log(`\nTesting: ${scenario.name} (${(scenario.rate * 100).toFixed(1)}% general, ${(scenario.healthcare * 100).toFixed(1)}% healthcare)`);
    console.log("-".repeat(40));
    
    const result = runEnhancedMonteCarloSimulation(params, 500); // 500 iterations for speed
    
    console.log(`Success Rate: ${result.probabilityOfSuccess.toFixed(1)}%`);
    console.log(`Median Ending Balance: $${Math.round(result.medianEndingBalance).toLocaleString()}`);
    
    results.push({
      scenario: scenario.name,
      inflationRate: scenario.rate,
      successRate: result.probabilityOfSuccess
    });
  }

  // Summary table
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY: Impact of Inflation on Retirement Success");
  console.log("=".repeat(80));
  console.log("Inflation Rate | Success Rate | Impact vs Normal");
  console.log("-".repeat(50));
  
  const normalSuccess = results.find(r => r.scenario === "Normal Inflation")?.successRate || 0;
  
  for (const result of results) {
    const impact = result.successRate - normalSuccess;
    const impactStr = impact >= 0 ? `+${impact.toFixed(1)}%` : `${impact.toFixed(1)}%`;
    console.log(
      `${(result.inflationRate * 100).toFixed(1)}%`.padEnd(14) + " | " +
      `${result.successRate.toFixed(1)}%`.padEnd(12) + " | " +
      impactStr
    );
  }
  
  console.log("\nKey Findings:");
  console.log("- Higher inflation significantly reduces retirement success probability");
  console.log("- Healthcare inflation has compounding effect on overall retirement costs");
  console.log("- Social Security COLA provides partial but incomplete protection");
}

// Run the test
runInflationStressTest().catch(console.error);