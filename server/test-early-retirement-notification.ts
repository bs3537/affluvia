import { findOptimalRetirementAge } from './routes';
import { profileToRetirementParams } from './monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';

// Test early retirement notification feature
console.log("TESTING EARLY RETIREMENT NOTIFICATION FEATURE");
console.log("=" .repeat(80));

// Test scenarios
const testScenarios = [
  {
    name: "Well-funded - Can retire 2 years earlier",
    profile: {
      firstName: "Test",
      lastName: "User",
      dateOfBirth: "1970-01-01", // 55 years old
      maritalStatus: "married",
      annualIncome: 200000,
      spouseAnnualIncome: 100000,
      monthlyExpenses: 8000,
      emergencySavings: 100000,
      retirementSavings: 1500000,
      monthlyContribution401k: 3000,
      desiredRetirementAge: 67, // Wants to retire at 67
      lifeExpectancy: 95,
      socialSecurityBenefit: 3500,
      spouseSocialSecurityBenefit: 2000,
      hasLongTermCareInsurance: true,
      userHealthStatus: 'good',
      userGender: 'male',
      state: 'CA',
      retirementState: 'FL',
      assets: [
        { type: '401k', value: 1200000, owner: 'user' },
        { type: 'IRA', value: 300000, owner: 'spouse' },
        { type: 'Brokerage', value: 200000, owner: 'joint' }
      ]
    }
  },
  {
    name: "Just meets target - Cannot retire earlier",
    profile: {
      firstName: "Test",
      lastName: "User2",
      dateOfBirth: "1970-01-01",
      maritalStatus: "single",
      annualIncome: 100000,
      monthlyExpenses: 5000,
      emergencySavings: 30000,
      retirementSavings: 400000,
      monthlyContribution401k: 1000,
      desiredRetirementAge: 67,
      lifeExpectancy: 90,
      socialSecurityBenefit: 2500,
      hasLongTermCareInsurance: false,
      userHealthStatus: 'good',
      userGender: 'male',
      state: 'CA',
      retirementState: 'CA',
      assets: [
        { type: '401k', value: 350000, owner: 'user' },
        { type: 'Savings', value: 50000, owner: 'user' }
      ]
    }
  },
  {
    name: "Under-funded - Needs to retire later",
    profile: {
      firstName: "Test",
      lastName: "User3",
      dateOfBirth: "1970-01-01",
      maritalStatus: "single",
      annualIncome: 80000,
      monthlyExpenses: 4500,
      emergencySavings: 10000,
      retirementSavings: 150000,
      monthlyContribution401k: 500,
      desiredRetirementAge: 65, // Wants to retire at 65
      lifeExpectancy: 90,
      socialSecurityBenefit: 2000,
      hasLongTermCareInsurance: false,
      userHealthStatus: 'fair',
      userGender: 'female',
      state: 'CA',
      retirementState: 'CA',
      assets: [
        { type: '401k', value: 130000, owner: 'user' },
        { type: 'Savings', value: 20000, owner: 'user' }
      ]
    }
  }
];

// Helper function to simulate findOptimalRetirementAge
async function testOptimalAge(profile: any) {
  const baseParams = profileToRetirementParams(profile);
  const currentAge = baseParams.currentAge;
  const desiredAge = baseParams.retirementAge;
  
  // Run simulation for desired retirement age
  const desiredResult = runEnhancedMonteCarloSimulation(baseParams, 100);
  const currentProbability = desiredResult?.probabilityOfSuccess || 0;
  
  // If already meeting 80% target, check if can retire earlier
  if (currentProbability >= 80) {
    let earliestAge = desiredAge;
    
    // Check earlier retirement ages (go back up to 5 years)
    for (let age = desiredAge - 1; age >= Math.max(currentAge + 1, desiredAge - 5); age--) {
      const testParams = { ...baseParams, retirementAge: age };
      const testResult = runEnhancedMonteCarloSimulation(testParams, 100);
      
      if (testResult.probabilityOfSuccess >= 80) {
        earliestAge = age;
      } else {
        break;
      }
    }
    
    return {
      currentAge,
      desiredAge,
      optimalAge: earliestAge,
      canRetireEarlier: earliestAge < desiredAge,
      earliestAge: earliestAge < desiredAge ? earliestAge : null,
      currentProbability: currentProbability,
      optimalProbability: currentProbability,
      message: earliestAge < desiredAge 
        ? `Can retire ${desiredAge - earliestAge} year(s) earlier at age ${earliestAge}`
        : 'Already optimized'
    };
  } else {
    // Need to find later retirement age to meet target
    let optimalAge = null;
    
    for (let age = desiredAge + 1; age <= Math.min(75, desiredAge + 10); age++) {
      const testParams = { ...baseParams, retirementAge: age };
      const testResult = runEnhancedMonteCarloSimulation(testParams, 100);
      
      if (testResult.probabilityOfSuccess >= 80) {
        optimalAge = age;
        break;
      }
    }
    
    return {
      currentAge,
      desiredAge,
      optimalAge,
      canRetireEarlier: false,
      earliestAge: null,
      currentProbability: currentProbability,
      optimalProbability: optimalAge ? 80 : null,
      message: optimalAge 
        ? `Need to delay retirement to age ${optimalAge}`
        : 'Cannot achieve 80% target within reasonable timeframe'
    };
  }
}

// Test each scenario
async function runTests() {
  for (const scenario of testScenarios) {
    console.log(`\n${scenario.name}`);
    console.log("-".repeat(60));
    
    const result = await testOptimalAge(scenario.profile);
    
    console.log(`Desired Retirement Age: ${result.desiredAge}`);
    console.log(`Current Success Rate: ${result.currentProbability.toFixed(1)}%`);
    console.log(`Can Retire Earlier: ${result.canRetireEarlier ? 'YES' : 'NO'}`);
    
    if (result.canRetireEarlier && result.earliestAge) {
      const yearsDiff = result.desiredAge - result.earliestAge;
      console.log(`\n✅ EARLY RETIREMENT NOTIFICATION SHOULD SHOW:`);
      console.log(`   "Good news! You could retire ${yearsDiff} year${yearsDiff > 1 ? 's' : ''} earlier"`);
      console.log(`   "Retire at age ${result.earliestAge} with ${result.currentProbability.toFixed(0)}% confidence"`);
    } else if (!result.canRetireEarlier && result.currentProbability < 80) {
      console.log(`\n⚠️  OPTIMIZATION NEEDED:`);
      console.log(`   Current plan only achieves ${result.currentProbability.toFixed(1)}% success`);
      if (result.optimalAge) {
        console.log(`   Recommendation: Delay retirement to age ${result.optimalAge}`);
      }
    } else {
      console.log(`\n✓ On track - no early retirement possible`);
    }
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("NOTIFICATION LOGIC SUMMARY:");
  console.log("• Show early retirement notification when:");
  console.log("  - canRetireEarlier = true");
  console.log("  - earliestAge is at least 1 year before desiredAge");
  console.log("  - Current success rate >= 80%");
  console.log("• Notification appears below the retirement confidence gauge");
  console.log("• Green background with checkmark icon for positive news");
}

runTests().catch(console.error);