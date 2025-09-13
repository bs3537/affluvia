import { db } from "./server/db";
import { financialProfiles, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { runEnhancedMonteCarloSimulation } from "./server/monte-carlo-enhanced";
import { profileToRetirementParams } from "./server/monte-carlo-base";

async function testPlaidUserMonteCarlo() {
  try {
    // Get the user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, "plaid@gmail.com"))
      .limit(1);
    
    if (!user.length) {
      console.log("User plaid@gmail.com not found");
      return;
    }
    
    const userId = user[0].id;
    console.log("Found user with ID:", userId);
    
    // Get the financial profile
    const profiles = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    
    if (!profiles.length) {
      console.log("Financial profile not found for user");
      return;
    }
    
    const profile = profiles[0];
    console.log("\n=== USER FINANCIAL PROFILE ===");
    console.log("Name:", profile.personalInfo?.fullName || "N/A");
    console.log("Age:", profile.dateOfBirth ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : "N/A");
    console.log("Retirement Age:", profile.desiredRetirementAge);
    console.log("Monthly Expenses in Retirement:", profile.expectedMonthlyExpensesRetirement);
    console.log("Social Security Claim Age:", profile.socialSecurityClaimAge);
    console.log("Social Security Benefit:", profile.socialSecurityBenefit);
    
    // Show assets
    console.log("\n=== ASSETS ===");
    const assets = profile.assets || [];
    let totalAssets = 0;
    assets.forEach((asset: any) => {
      console.log(`${asset.type}: $${asset.value?.toLocaleString() || 0} (Owner: ${asset.owner || 'user'})`);
      totalAssets += asset.value || 0;
    });
    console.log("Total Assets:", `$${totalAssets.toLocaleString()}`);
    
    // Show retirement contributions
    console.log("\n=== RETIREMENT CONTRIBUTIONS ===");
    console.log("User 401k/403b:", profile.retirementContributions);
    console.log("Spouse 401k/403b:", profile.spouseRetirementContributions);
    
    // Show income
    console.log("\n=== INCOME ===");
    console.log("Annual Income:", profile.annualIncome);
    console.log("Spouse Annual Income:", profile.spouseAnnualIncome);
    
    // Check required fields
    const requiredFields = [
      'desiredRetirementAge',
      'expectedMonthlyExpensesRetirement', 
      'socialSecurityClaimAge',
      'socialSecurityBenefit'
    ];
    
    const missingFields = requiredFields.filter(field => !profile[field]);
    if (missingFields.length > 0) {
      console.log("\n⚠️ MISSING REQUIRED FIELDS:", missingFields);
    }
    
    // Run enhanced Monte Carlo simulation
    console.log("\n=== RUNNING ENHANCED MONTE CARLO SIMULATION ===");
    console.log("Using baseline algorithm with LTC modeling");
    
    // Convert profile to Monte Carlo params
    const params = profileToRetirementParams(profile);
    (params as any).useNominalDollars = true;
    (params as any).useEnhancedEngine = true;
    (params as any).enableLTC = true;
    (params as any).enableGuardrails = true;
    
    const result = await runEnhancedMonteCarloSimulation(
      params,
      1000,     // iterations
      true,     // verbose
      undefined, // returnConfig (use default)
      undefined, // varianceReduction (use default)
      false     // useStreaming - disabled to get full results
    );
    
    console.log("\n=== MONTE CARLO RESULTS ===");
    console.log("Probability of Success:", result.probabilityOfSuccess.toFixed(1) + "%");
    console.log("Median Ending Balance:", "$" + (result.medianEndingBalance || 0).toLocaleString());
    console.log("Scenarios:", result.scenarios);
    console.log("Years Until Depletion:", result.yearsUntilDepletion || "Never");
    
    if (result.ltcAnalysis) {
      console.log("\n=== LTC ANALYSIS ===");
      console.log("Has Insurance:", result.ltcAnalysis.hasInsurance);
      console.log("Lifetime LTC Probability:", (result.ltcAnalysis.probabilityOfLTC * 100).toFixed(0) + "%");
      console.log("Average Cost if Occurs:", "$" + result.ltcAnalysis.avgCostIfOccurs.toLocaleString());
      console.log("Average Duration:", result.ltcAnalysis.avgDurationIfOccurs.toFixed(1) + " years");
    }
    
    if (result.optimalRetirementAge) {
      console.log("\n=== RETIREMENT AGE ANALYSIS ===");
      console.log("Current Age:", result.optimalRetirementAge.currentAge);
      console.log("Desired Age:", result.optimalRetirementAge.desiredAge);
      console.log("Can Retire Earlier:", result.optimalRetirementAge.canRetireEarlier);
      if (result.optimalRetirementAge.earliestAge) {
        console.log("Earliest Age:", result.optimalRetirementAge.earliestAge);
      }
    }
    
    // Check why score might be 0
    if (result.probabilityOfSuccess === 0) {
      console.log("\n⚠️ WARNING: Probability of success is 0%");
      console.log("Possible reasons:");
      console.log("1. Insufficient assets for retirement");
      console.log("2. Expenses too high relative to income/assets");
      console.log("3. Missing critical data fields");
      console.log("4. Calculation error in Monte Carlo engine");
      
      // Additional debugging
      console.log("\n=== DEBUGGING INFO ===");
      console.log("Current age calculation:", profile.dateOfBirth ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : "No DOB");
      console.log("Years to retirement:", profile.desiredRetirementAge - (profile.dateOfBirth ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : 30));
      console.log("Initial withdrawal rate check:");
      const annualExpenses = (profile.expectedMonthlyExpensesRetirement || 0) * 12;
      const withdrawalRate = totalAssets > 0 ? (annualExpenses / totalAssets) * 100 : 0;
      console.log("  Annual expenses needed:", "$" + annualExpenses.toLocaleString());
      console.log("  Current total assets:", "$" + totalAssets.toLocaleString());
      console.log("  Initial withdrawal rate:", withdrawalRate.toFixed(2) + "%");
      if (withdrawalRate > 10) {
        console.log("  ⚠️ Very high withdrawal rate - likely to fail");
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error running test:", error);
    process.exit(1);
  }
}

testPlaidUserMonteCarlo();