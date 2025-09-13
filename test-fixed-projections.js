// Test the fixed net worth projections
import('./server/net-worth-projections.js').then(async module => {
  const { calculateNetWorthProjections } = module;
  
  // Test profile matching the user's scenario
  const testProfile = {
    dateOfBirth: '1974-12-15', // Age 51 in 2025
    spouseDateOfBirth: '1974-01-01', // Also age 51
    lifeExpectancy: 93,
    spouseLifeExpectancy: 93,
    desiredRetirementAge: 65,
    spouseDesiredRetirementAge: 65,
    
    // Income
    annualIncome: 60000,
    spouseAnnualIncome: 450000,
    monthlyExpenses: 8500, // For surplus calculation
    
    // Retirement expenses and income
    expectedMonthlyExpensesRetirement: 11000,
    socialSecurityBenefit: 2003,
    spouseSocialSecurityBenefit: 3423,
    socialSecurityClaimAge: 65,
    spouseSocialSecurityClaimAge: 65,
    
    // Contributions
    monthlyContribution401k: 2500,  // $30k/year
    monthlyContributionIRA: 0,
    monthlyContributionRothIRA: 0,
    monthlyContributionBrokerage: 0,
    
    // Investment strategy
    expectedRealReturn: -1, // Glide path
    
    // Assets
    assets: [
      { type: '401k', value: 400000 },
      { type: 'cash-value-life-insurance', value: 120000 },
      { type: 'savings', value: 32000 },
      { type: 'taxable-brokerage', value: 90000 }
    ],
    
    // Real estate and debt
    primaryResidence: { 
      marketValue: 975000, 
      mortgageBalance: 350000,
      monthlyPayment: 3400,
      mortgageRate: 0.045 // 4.5% rate
    },
    liabilities: [],
    
    // State info
    state: 'MA',
    retirementState: 'FL',
    maritalStatus: 'married'
  };
  
  console.log("=== FIXED NET WORTH PROJECTION TEST ===\n");
  console.log("Profile Summary:");
  console.log("- Combined Income: $" + (testProfile.annualIncome + testProfile.spouseAnnualIncome).toLocaleString());
  console.log("- Monthly Expenses: $" + testProfile.monthlyExpenses.toLocaleString());
  console.log("- Annual 401k Contribution: $" + (testProfile.monthlyContribution401k * 12).toLocaleString());
  console.log("- Retirement Assets: $642,000");
  console.log("- Home Equity: $625,000");
  console.log("- Retirement Expenses: $" + (testProfile.expectedMonthlyExpensesRetirement * 12).toLocaleString() + "/year");
  console.log("- Social Security: $" + ((testProfile.socialSecurityBenefit + testProfile.spouseSocialSecurityBenefit) * 12).toLocaleString() + "/year");
  
  const result = calculateNetWorthProjections(testProfile);
  
  console.log("\n=== PROJECTION RESULTS ===");
  console.log("Current Net Worth: $" + result.currentNetWorth.toLocaleString());
  console.log("Target Year: " + result.targetYear);
  console.log("Target Net Worth: $" + result.targetNetWorth.toLocaleString());
  
  // Find key milestone years
  const projections = result.projections;
  const age65 = projections.find(p => p.age === 65);
  const age66 = projections.find(p => p.age === 66);
  const age67 = projections.find(p => p.age === 67);
  const age72 = projections.find(p => p.age === 72);
  const age80 = projections.find(p => p.age === 80);
  const age93 = projections.find(p => p.age === 93);
  
  console.log("\n=== KEY MILESTONES ===");
  if (age65) {
    console.log(`Age 65 (Retirement):`);
    console.log(`  Savings: $${age65.savings.toLocaleString()}`);
    console.log(`  Real Estate: $${age65.realEstate.toLocaleString()}`);
    console.log(`  Other Assets: $${age65.otherAssets.toLocaleString()}`);
    console.log(`  Debt: $${age65.debt.toLocaleString()}`);
    console.log(`  Net Worth: $${age65.totalNetWorth.toLocaleString()}`);
  }
  
  if (age67) {
    console.log(`\nAge 67 (Full SS):`);
    console.log(`  Savings: $${age67.savings.toLocaleString()}`);
    console.log(`  Net Worth: $${age67.totalNetWorth.toLocaleString()}`);
  }
  
  if (age72) {
    console.log(`\nAge 72 (7 years retirement):`);
    console.log(`  Savings: $${age72.savings.toLocaleString()}`);
    console.log(`  Net Worth: $${age72.totalNetWorth.toLocaleString()}`);
  }
  
  if (age80) {
    console.log(`\nAge 80:`);
    console.log(`  Savings: $${age80.savings.toLocaleString()}`);
    console.log(`  Net Worth: $${age80.totalNetWorth.toLocaleString()}`);
  }
  
  if (age93) {
    console.log(`\nAge 93 (Life Expectancy):`);
    console.log(`  Savings: $${age93.savings.toLocaleString()}`);
    console.log(`  Net Worth: $${age93.totalNetWorth.toLocaleString()}`);
  }
  
  // Check for depletion
  const depleted = projections.find(p => p.savings <= 0 && p.age >= 65);
  if (depleted) {
    console.log(`\n*** WARNING: Assets deplete at age ${depleted.age} ***`);
    const idx = projections.indexOf(depleted);
    console.log("\nYears around depletion:");
    for (let i = Math.max(0, idx - 2); i <= Math.min(projections.length - 1, idx + 2); i++) {
      const p = projections[i];
      console.log(`  Age ${p.age}: Savings=$${p.savings.toLocaleString()}, NW=$${p.totalNetWorth.toLocaleString()}`);
    }
  } else {
    console.log("\n✓ Assets last throughout retirement!");
  }
  
  // Calculate surplus cash flow at start
  const monthlyIncome = (testProfile.annualIncome + testProfile.spouseAnnualIncome) / 12;
  const monthlyExpenses = testProfile.monthlyExpenses;
  const monthlyContributions = testProfile.monthlyContribution401k;
  const monthlyDebt = testProfile.primaryResidence.monthlyPayment;
  const monthlySurplus = monthlyIncome - monthlyExpenses - monthlyContributions - monthlyDebt;
  
  console.log("\n=== CASH FLOW ANALYSIS ===");
  console.log("Monthly Income: $" + monthlyIncome.toLocaleString());
  console.log("Monthly Expenses: $" + monthlyExpenses.toLocaleString());
  console.log("Monthly 401k: $" + monthlyContributions.toLocaleString());
  console.log("Monthly Mortgage: $" + monthlyDebt.toLocaleString());
  console.log("Monthly Surplus: $" + monthlySurplus.toLocaleString());
  console.log("Annual Surplus for Investment: $" + (monthlySurplus * 12).toLocaleString());
  
  // Compare with external tools
  console.log("\n=== COMPARISON WITH EXTERNAL TOOLS ===");
  console.log("Boldin/RightCapital Success Rate: 98.5%");
  console.log("Boldin/RightCapital 2067 Net Worth: $6.1M");
  console.log("Our Projection 2067 Net Worth: $" + (age93 ? age93.totalNetWorth.toLocaleString() : "N/A"));
  
  const successIndicator = !depleted && age93 && age93.savings > 0;
  console.log("Our Success Indicator: " + (successIndicator ? "✓ Success" : "✗ Failure"));
  
}).catch(err => {
  console.error("Error running test:", err);
});