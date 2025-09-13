// Complete test of net worth projections
const PROFILE = {
  dateOfBirth: '1974-12-15', 
  spouseDateOfBirth: '1974-01-01',
  lifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  desiredRetirementAge: 65,
  expectedMonthlyExpensesRetirement: 11000,
  socialSecurityBenefit: 2003,
  spouseSocialSecurityBenefit: 3423,
  socialSecurityClaimAge: 65,
  spouseSocialSecurityClaimAge: 65,
  expectedRealReturn: -1, // Glide path
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  monthlyContribution401k: 2500,
  assets: [
    { type: '401k', value: 400000 },
    { type: 'cash-value-life-insurance', value: 120000 },
    { type: 'savings', value: 32000 },
    { type: 'taxable-brokerage', value: 90000 },
  ],
  primaryResidence: { 
    marketValue: 975000, 
    mortgageBalance: 350000,
    monthlyPayment: 3400
  },
  liabilities: []
};

// Import the projection function
import('./server/net-worth-projections.js').then(module => {
  const result = module.calculateNetWorthProjections(PROFILE);
  
  console.log("\n=== NET WORTH PROJECTION RESULTS ===");
  console.log("Current Net Worth:", result.currentNetWorth.toLocaleString());
  console.log("Target Year:", result.targetYear);
  console.log("Target Net Worth:", result.targetNetWorth.toLocaleString());
  
  // Find key milestone years
  const projections = result.projections;
  const age65 = projections.find(p => p.age === 65);
  const age66 = projections.find(p => p.age === 66);
  const age67 = projections.find(p => p.age === 67);
  const age72 = projections.find(p => p.age === 72);
  const age80 = projections.find(p => p.age === 80);
  const age93 = projections.find(p => p.age === 93);
  
  console.log("\n=== KEY MILESTONES ===");
  if (age65) console.log(`Age 65 (Retirement): Savings=$${age65.savings.toLocaleString()}, NW=$${age65.totalNetWorth.toLocaleString()}`);
  if (age66) console.log(`Age 66: Savings=$${age66.savings.toLocaleString()}, NW=$${age66.totalNetWorth.toLocaleString()}`);
  if (age67) console.log(`Age 67: Savings=$${age67.savings.toLocaleString()}, NW=$${age67.totalNetWorth.toLocaleString()}`);
  if (age72) console.log(`Age 72: Savings=$${age72.savings.toLocaleString()}, NW=$${age72.totalNetWorth.toLocaleString()}`);
  if (age80) console.log(`Age 80: Savings=$${age80.savings.toLocaleString()}, NW=$${age80.totalNetWorth.toLocaleString()}`);
  if (age93) console.log(`Age 93 (Life Exp): Savings=$${age93.savings.toLocaleString()}, NW=$${age93.totalNetWorth.toLocaleString()}`);
  
  // Check for depletion
  const depleted = projections.find(p => p.savings <= 0 && p.age >= 65);
  if (depleted) {
    console.log(`\n*** WARNING: Assets deplete at age ${depleted.age} ***`);
    const idx = projections.indexOf(depleted);
    for (let i = Math.max(0, idx - 2); i <= Math.min(projections.length - 1, idx + 2); i++) {
      const p = projections[i];
      console.log(`  Age ${p.age}: Savings=$${p.savings.toLocaleString()}, NW=$${p.totalNetWorth.toLocaleString()}`);
    }
  } else {
    console.log("\n✓ Assets last throughout retirement\!");
  }
  
  // Calculate withdrawal analysis
  const annualExpenses = 11000 * 12; // $132k
  const ssBenefit = (2003 + 3423) * 12; // $65k
  const netWithdrawal = annualExpenses - ssBenefit; // $67k
  const grossWithdrawal = netWithdrawal / 0.8; // ~$84k with 20% taxes
  
  console.log("\n=== RETIREMENT INCOME ANALYSIS ===");
  console.log("Annual Expenses:", annualExpenses.toLocaleString());
  console.log("Social Security:", ssBenefit.toLocaleString());
  console.log("Net Withdrawal Needed:", netWithdrawal.toLocaleString());
  console.log("Gross Withdrawal (w/taxes):", grossWithdrawal.toLocaleString());
  console.log("Portfolio at Retirement:", age65 ? age65.savings.toLocaleString() : "N/A");
  console.log("Initial Withdrawal Rate:", age65 ? ((grossWithdrawal / age65.savings * 100).toFixed(2) + "%") : "N/A");
  
}).catch(err => {
  console.error("Error:", err);
});
