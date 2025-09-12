// Test net worth projection calculation
const profile = {
  dateOfBirth: '1974-12-15', // Age 51
  spouseDateOfBirth: '1974-01-01', // Also age 51
  lifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  expectedMonthlyExpensesRetirement: 11000,
  socialSecurityClaimAge: 65,
  spouseSocialSecurityClaimAge: 65,
  socialSecurityBenefit: 2003,
  spouseSocialSecurityBenefit: 3423,
  expectedRealReturn: -1, // Glide path
  annualIncome: 60000,
  spouseAnnualIncome: 450000,
  monthlyContribution401k: 2500, // $30k annual
  assets: [
    { type: '401k', value: 400000, owner: 'spouse' },
    { type: 'cash-value-life-insurance', value: 120000, owner: 'spouse' },
    { type: 'savings', value: 32000, owner: 'joint' },
    { type: 'taxable-brokerage', value: 90000, owner: 'user' },
    { type: 'checking', value: 3000, owner: 'user' },
    { type: 'checking', value: 60000, owner: 'spouse' }
  ],
  primaryResidence: { marketValue: 975000, mortgageBalance: 350000 },
  state: 'MA',
  retirementState: 'FL'
};

// Simplified projection calculation
const currentYear = 2025;
const currentAge = 51;
const retirementAge = 65;
const lifeExpectancy = 93;
const yearsToProject = lifeExpectancy - currentAge;

// Starting assets (excluding checking and vehicles)
let retirementAssets = 642000; // 401k + CVLI + savings + brokerage
let realEstate = 975000;
let debt = 350000;

console.log("Initial State:");
console.log("Retirement Assets:", retirementAssets);
console.log("Real Estate:", realEstate);
console.log("Debt:", debt);
console.log("Net Worth:", retirementAssets + realEstate - debt);
console.log("\n=== PROJECTION ===");

// Annual contributions with wage growth
const baseContribution = 30000;

for (let year = 0; year <= yearsToProject; year++) {
  const age = currentAge + year;
  const projectionYear = currentYear + year;
  
  // Determine investment return based on glide path
  let expectedReturn;
  const yearsToRetirement = Math.max(0, retirementAge - age);
  if (yearsToRetirement > 20) {
    expectedReturn = 0.106; // 10.6% nominal
  } else if (yearsToRetirement > 10) {
    expectedReturn = 0.096; // 9.6% nominal
  } else if (yearsToRetirement > 5) {
    expectedReturn = 0.086; // 8.6% nominal
  } else {
    expectedReturn = 0.076; // 7.6% nominal
  }
  
  // Apply returns
  if (year > 0) {
    retirementAssets *= (1 + expectedReturn);
    realEstate *= 1.042; // 4.2% appreciation
    debt = Math.max(0, debt - 41000); // Annual mortgage payment
  }
  
  // Pre-retirement: Add contributions with wage growth
  if (age < retirementAge) {
    const wageGrowthFactor = Math.pow(1.04, year);
    const annualContribution = baseContribution * wageGrowthFactor;
    retirementAssets += annualContribution;
  } 
  // Post-retirement: Withdrawals
  else {
    const annualExpenses = 11000 * 12; // $132k/year
    const socialSecurity = (2003 + 3423) * 12; // $65k/year
    const netWithdrawalNeeded = annualExpenses - socialSecurity; // $67k/year
    
    // Account for taxes (rough estimate 20% effective rate)
    const grossWithdrawal = netWithdrawalNeeded / 0.8; // ~$84k/year
    retirementAssets -= grossWithdrawal;
  }
  
  const netWorth = retirementAssets + realEstate - debt;
  
  // Log key years
  if (year === 0 || age === 65 || age === 72 || age === 80 || age === 93 || 
      (age > 65 && retirementAssets <= 0)) {
    console.log(`Year ${projectionYear} (Age ${age}):`);
    console.log(`  Retirement Assets: $${Math.round(retirementAssets).toLocaleString()}`);
    console.log(`  Real Estate: $${Math.round(realEstate).toLocaleString()}`);
    console.log(`  Debt: $${Math.round(debt).toLocaleString()}`);
    console.log(`  Net Worth: $${Math.round(netWorth).toLocaleString()}`);
    if (retirementAssets <= 0) {
      console.log("  *** ASSETS DEPLETED ***");
      break;
    }
  }
}
