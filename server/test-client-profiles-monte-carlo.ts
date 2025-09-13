import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './monte-carlo-enhanced';
import { AssetBuckets } from './asset-tax-classifier';
import { calculateSocialSecurityBenefit } from './social-security-calculator';

// Test profiles for Monte Carlo simulation
const clientProfiles = [
  {
    profileNumber: 1,
    name: "Alex Rivera",
    description: "Young Tech Enthusiast",
    age: 28,
    monthlyIncome: 6500,
    monthlyExpenses: 4200,
    plannedMonthlyRetirementExpenses: 2940,
    plannedRetirementAge: 65,
    currentRetirementSavings: 25000,
    additionalMonthlyContributions: 600
  },
  {
    profileNumber: 2,
    name: "Jordan Lee",
    description: "Mid-Career Family Provider",
    age: 42,
    monthlyIncome: 8200,
    monthlyExpenses: 6500,
    plannedMonthlyRetirementExpenses: 4550,
    plannedRetirementAge: 62,
    currentRetirementSavings: 180000,
    additionalMonthlyContributions: 900
  },
  {
    profileNumber: 3,
    name: "Pat Nguyen",
    description: "Near-Retiree Corporate Executive",
    age: 55,
    monthlyIncome: 12000,
    monthlyExpenses: 8000,
    plannedMonthlyRetirementExpenses: 5600,
    plannedRetirementAge: 67,
    currentRetirementSavings: 650000,
    additionalMonthlyContributions: 1200
  },
  {
    profileNumber: 4,
    name: "Chris Patel",
    description: "Struggling Freelance Artist",
    age: 35,
    monthlyIncome: 3200,
    monthlyExpenses: 2800,
    plannedMonthlyRetirementExpenses: 1960,
    plannedRetirementAge: 70,
    currentRetirementSavings: 10000,
    additionalMonthlyContributions: 150
  },
  {
    profileNumber: 5,
    name: "Taylor Kim",
    description: "High-Risk Entrepreneur",
    age: 48,
    monthlyIncome: 14000,
    monthlyExpenses: 9500,
    plannedMonthlyRetirementExpenses: 6650,
    plannedRetirementAge: 60,
    currentRetirementSavings: 400000,
    additionalMonthlyContributions: 1800
  }
];

function createMonteCarloParams(profile: typeof clientProfiles[0], useNominalDollars: boolean = true): RetirementMonteCarloParams {
  // Calculate annual values
  const annualIncome = profile.monthlyIncome * 12;
  const annualExpenses = profile.monthlyExpenses * 12;
  const annualRetirementExpenses = profile.plannedMonthlyRetirementExpenses * 12;
  const annualContributions = profile.additionalMonthlyContributions * 12;
  
  // Calculate Social Security benefit using proper 2025 formula with bend points
  const estimatedMonthlySS = calculateSocialSecurityBenefit(
    profile.monthlyIncome,
    profile.age,
    profile.plannedRetirementAge, // Claim at retirement age
    profile.plannedRetirementAge - 22 // Years worked (assume started at 22)
  );
  const annualSSBenefit = estimatedMonthlySS * 12;
  
  // Determine risk profile based on age and profile description
  let stockAllocation = 0.6; // Default moderate
  let expectedReturn: number;
  
  // Set REAL returns for real mode, NOMINAL returns for nominal mode
  if (useNominalDollars) {
    // NOMINAL returns (real + inflation of ~2.5%)
    if (profile.age < 35) {
      stockAllocation = 0.8; // Aggressive for young investors
      expectedReturn = 0.080; // 8% nominal (5.5% real + 2.5% inflation)
    } else if (profile.age < 50) {
      stockAllocation = 0.7; // Moderately aggressive
      expectedReturn = 0.075; // 7.5% nominal (5% real + 2.5% inflation)
    } else if (profile.age < 60) {
      stockAllocation = 0.6; // Moderate
      expectedReturn = 0.070; // 7% nominal (4.5% real + 2.5% inflation)
    } else {
      stockAllocation = 0.4; // Conservative
      expectedReturn = 0.060; // 6% nominal (3.5% real + 2.5% inflation)
    }
    
    // Special adjustments for specific profiles
    if (profile.name === "Taylor Kim") {
      stockAllocation = 0.85;
      expectedReturn = 0.085; // 8.5% nominal for very aggressive
    } else if (profile.name === "Chris Patel") {
      stockAllocation = 0.5;
      expectedReturn = 0.065; // 6.5% nominal
    }
  } else {
    // REAL returns (inflation-adjusted)
    if (profile.age < 35) {
      stockAllocation = 0.8;
      expectedReturn = 0.055; // 5.5% real return
    } else if (profile.age < 50) {
      stockAllocation = 0.7;
      expectedReturn = 0.050; // 5.0% real return
    } else if (profile.age < 60) {
      stockAllocation = 0.6;
      expectedReturn = 0.045; // 4.5% real return
    } else {
      stockAllocation = 0.4;
      expectedReturn = 0.035; // 3.5% real return
    }
    
    if (profile.name === "Taylor Kim") {
      stockAllocation = 0.85;
      expectedReturn = 0.060; // 6% real return
    } else if (profile.name === "Chris Patel") {
      stockAllocation = 0.5;
      expectedReturn = 0.040; // 4% real return
    }
  }
  
  const bondAllocation = (1 - stockAllocation) * 0.8; // Most of non-stock in bonds
  const cashAllocation = (1 - stockAllocation) * 0.2; // Small cash allocation
  
  // Create asset buckets based on current retirement savings
  // Assume typical allocation: 70% tax-deferred, 20% taxable, 10% tax-free
  const assetBuckets: AssetBuckets = {
    taxDeferred: profile.currentRetirementSavings * 0.7,  // 401k, IRA
    taxFree: profile.currentRetirementSavings * 0.1,      // Roth IRA
    capitalGains: profile.currentRetirementSavings * 0.15, // Taxable brokerage
    cashEquivalents: profile.currentRetirementSavings * 0.05, // Cash/savings
    totalAssets: profile.currentRetirementSavings
  };
  
  return {
    currentAge: profile.age,
    retirementAge: profile.plannedRetirementAge,
    lifeExpectancy: 90, // Standard assumption
    currentRetirementAssets: profile.currentRetirementSavings,
    annualGuaranteedIncome: annualSSBenefit,
    socialSecurityClaimAge: Math.max(profile.plannedRetirementAge, 62),
    socialSecurityBenefit: estimatedMonthlySS,
    annualRetirementExpenses: annualRetirementExpenses,
    annualHealthcareCosts: 12000, // Standard healthcare cost estimate
    expectedReturn: expectedReturn,
    returnVolatility: 0.15, // Standard 15% volatility
    inflationRate: 0.025, // 2.5% inflation
    stockAllocation: stockAllocation,
    bondAllocation: bondAllocation,
    cashAllocation: cashAllocation,
    withdrawalRate: 0.04, // 4% rule
    useGuardrails: true, // Enable dynamic withdrawals
    useGlidePath: false, // Use fixed allocation for clarity
    annualSavings: annualContributions, // Total annual savings
    userAnnualSavings: annualContributions, // User-specific savings for staggered retirement
    userAnnualIncome: annualIncome,
    hasLongTermCareInsurance: false,
    taxRate: 0.22, // Estimate 22% effective tax rate
    retirementState: 'CA', // Default to California
    legacyGoal: 0, // No specific legacy goal
    assetBuckets: assetBuckets, // Add the asset buckets
    // Nominal dollar parameters
    useNominalDollars: useNominalDollars,
    displayInTodaysDollars: true,
    generalInflationRate: 0.025,
    healthcareInflationRate: 0.045,
    socialSecurityCOLARate: 0.025
  };
}

async function runTestForProfile(profile: typeof clientProfiles[0], mode: 'real' | 'nominal' | 'both' = 'both') {
  console.log('\n' + '='.repeat(80));
  console.log(`PROFILE ${profile.profileNumber}: ${profile.description.toUpperCase()}`);
  console.log('='.repeat(80));
  
  // Display profile details
  console.log('\nCLIENT PROFILE:');
  console.log(`  Name: ${profile.name}`);
  console.log(`  Age: ${profile.age}`);
  console.log(`  Monthly Income: $${profile.monthlyIncome.toLocaleString()}`);
  console.log(`  Monthly Expenses: $${profile.monthlyExpenses.toLocaleString()}`);
  console.log(`  Planned Monthly Retirement Expenses: $${profile.plannedMonthlyRetirementExpenses.toLocaleString()} (${Math.round(profile.plannedMonthlyRetirementExpenses / profile.monthlyExpenses * 100)}% of current)`);
  console.log(`  Planned Retirement Age: ${profile.plannedRetirementAge}`);
  console.log(`  Current Retirement Savings: $${profile.currentRetirementSavings.toLocaleString()}`);
  console.log(`  Additional Monthly Contributions: $${profile.additionalMonthlyContributions.toLocaleString()}`);
  
  // Calculate derived metrics
  const yearsToRetirement = profile.plannedRetirementAge - profile.age;
  const monthlyNetSavings = profile.monthlyIncome - profile.monthlyExpenses;
  const savingsRate = (profile.additionalMonthlyContributions / profile.monthlyIncome * 100).toFixed(1);
  
  console.log('\nDERIVED METRICS:');
  console.log(`  Years to Retirement: ${yearsToRetirement}`);
  console.log(`  Monthly Net Cash Flow: $${monthlyNetSavings.toLocaleString()}`);
  console.log(`  Retirement Savings Rate: ${savingsRate}%`);
  console.log(`  Current Savings per Year of Work: $${Math.round(profile.currentRetirementSavings / (profile.age - 22)).toLocaleString()}`);
  
  const results: { real?: any; nominal?: any } = {};
  
  // Run REAL DOLLAR simulation if requested
  if (mode === 'real' || mode === 'both') {
    const realParams = createMonteCarloParams(profile, false);
    
    console.log('\n--- REAL DOLLAR MODE ---');
    console.log('SIMULATION PARAMETERS:');
    console.log(`  Stock Allocation: ${(realParams.stockAllocation * 100).toFixed(0)}%`);
    console.log(`  Bond Allocation: ${(realParams.bondAllocation * 100).toFixed(0)}%`);
    console.log(`  Cash Allocation: ${(realParams.cashAllocation * 100).toFixed(0)}%`);
    console.log(`  Expected Return (Real): ${(realParams.expectedReturn * 100).toFixed(1)}%`);
    console.log(`  Estimated Social Security: $${Math.round(realParams.socialSecurityBenefit!).toLocaleString()}/month`);
    
    try {
      console.log('Running Monte Carlo simulation (1000 iterations)...');
      results.real = runEnhancedMonteCarloSimulation(realParams, 1000);
      
      console.log('\n' + '─'.repeat(50));
      console.log('REAL DOLLAR RESULTS:');
      console.log('─'.repeat(50));
      console.log(`  SUCCESS RATE: ${results.real.probabilityOfSuccess.toFixed(1)}%`);
      console.log(`  Successful Scenarios: ${results.real.scenarios?.successful || 'N/A'} / ${results.real.scenarios?.total || 'N/A'}`);
      
      if (results.real.medianFinalValue) {
        console.log(`  Median Final Portfolio Value: $${Math.round(results.real.medianFinalValue).toLocaleString()}`);
      }
    } catch (error) {
      console.error('\n❌ ERROR running real dollar simulation:', error);
    }
  }
  
  // Run NOMINAL DOLLAR simulation if requested
  if (mode === 'nominal' || mode === 'both') {
    const nominalParams = createMonteCarloParams(profile, true);
    
    console.log('\n--- NOMINAL DOLLAR MODE ---');
    console.log('SIMULATION PARAMETERS:');
    console.log(`  Stock Allocation: ${(nominalParams.stockAllocation * 100).toFixed(0)}%`);
    console.log(`  Bond Allocation: ${(nominalParams.bondAllocation * 100).toFixed(0)}%`);
    console.log(`  Cash Allocation: ${(nominalParams.cashAllocation * 100).toFixed(0)}%`);
    console.log(`  Expected Return (Real): ${(nominalParams.expectedReturn * 100).toFixed(1)}%`);
    console.log(`  General Inflation: ${(nominalParams.generalInflationRate! * 100).toFixed(1)}%`);
    console.log(`  Healthcare Inflation: ${(nominalParams.healthcareInflationRate! * 100).toFixed(1)}%`);
    console.log(`  Estimated Social Security: $${Math.round(nominalParams.socialSecurityBenefit!).toLocaleString()}/month`);
    
    try {
      console.log('Running Monte Carlo simulation (1000 iterations)...');
      results.nominal = runEnhancedMonteCarloSimulation(nominalParams, 1000);
      
      console.log('\n' + '─'.repeat(50));
      console.log('NOMINAL DOLLAR RESULTS (displayed in today\'s dollars):');
      console.log('─'.repeat(50));
      console.log(`  SUCCESS RATE: ${results.nominal.probabilityOfSuccess.toFixed(1)}%`);
      console.log(`  Successful Scenarios: ${results.nominal.scenarios?.successful || 'N/A'} / ${results.nominal.scenarios?.total || 'N/A'}`);
      
      if (results.nominal.medianFinalValue) {
        console.log(`  Median Final Portfolio Value: $${Math.round(results.nominal.medianFinalValue).toLocaleString()}`);
      }
    } catch (error) {
      console.error('\n❌ ERROR running nominal dollar simulation:', error);
    }
  }
  
  // Compare results if both were run
  if (results.real && results.nominal) {
    console.log('\n' + '═'.repeat(50));
    console.log('COMPARISON:');
    console.log('═'.repeat(50));
    console.log(`  Real Dollar Success Rate:    ${results.real.probabilityOfSuccess.toFixed(1)}%`);
    console.log(`  Nominal Dollar Success Rate: ${results.nominal.probabilityOfSuccess.toFixed(1)}%`);
    const diff = results.nominal.probabilityOfSuccess - results.real.probabilityOfSuccess;
    console.log(`  Difference: ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`);
  }
  
  // Provide interpretation for the best result
  const bestResult = results.nominal || results.real;
  if (bestResult) {
    console.log('\nINTERPRETATION:');
    if (bestResult.probabilityOfSuccess >= 90) {
      console.log('  ✅ EXCELLENT: Very high confidence in retirement plan');
    } else if (bestResult.probabilityOfSuccess >= 80) {
      console.log('  ✅ GOOD: High confidence, minor adjustments may help');
    } else if (bestResult.probabilityOfSuccess >= 70) {
      console.log('  ⚠️  FAIR: Moderate confidence, consider increasing savings or delaying retirement');
    } else if (bestResult.probabilityOfSuccess >= 50) {
      console.log('  ⚠️  CONCERNING: Low confidence, significant changes needed');
    } else {
      console.log('  ❌ CRITICAL: Very low confidence, major restructuring required');
    }
  }
  
  return results;
}

async function runAllTests() {
  console.log('MONTE CARLO RETIREMENT SIMULATION TEST SUITE');
  console.log('Testing Enhanced Monte Carlo: Real vs Nominal Dollar Comparison');
  console.log('Date:', new Date().toISOString());
  
  const comparisonResults: Array<{
    profile: typeof clientProfiles[0];
    realSuccess?: number;
    nominalSuccess?: number;
  }> = [];
  
  for (const profile of clientProfiles) {
    const results = await runTestForProfile(profile, 'both');
    comparisonResults.push({
      profile,
      realSuccess: results.real?.probabilityOfSuccess,
      nominalSuccess: results.nominal?.probabilityOfSuccess
    });
    // Small delay between tests to avoid overwhelming console
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('ALL TESTS COMPLETED - COMPARISON SUMMARY');
  console.log('='.repeat(100));
  
  // Summary comparison table
  console.log('\nREAL vs NOMINAL DOLLAR SUCCESS RATES:');
  console.log('┌───┬──────────────────────────────┬─────┬──────────┬──────────────┬────────────┬──────────────┬────────────┐');
  console.log('│ # │ Profile                      │ Age │ Ret. Age │ Current Sav. │ Real $    │ Nominal $    │ Difference │');
  console.log('├───┼──────────────────────────────┼─────┼──────────┼──────────────┼────────────┼──────────────┼────────────┤');
  
  for (const result of comparisonResults) {
    const { profile, realSuccess, nominalSuccess } = result;
    const realStr = realSuccess !== undefined ? `${realSuccess.toFixed(1)}%` : 'ERROR';
    const nominalStr = nominalSuccess !== undefined ? `${nominalSuccess.toFixed(1)}%` : 'ERROR';
    const diff = (realSuccess !== undefined && nominalSuccess !== undefined) ? 
      `${nominalSuccess >= realSuccess ? '+' : ''}${(nominalSuccess - realSuccess).toFixed(1)}%` : 'N/A';
    
    console.log(
      `│ ${profile.profileNumber} │ ${profile.description.padEnd(28)} │ ${String(profile.age).padStart(3)} │ ${String(profile.plannedRetirementAge).padStart(8)} │ $${profile.currentRetirementSavings.toLocaleString().padStart(11)} │ ${realStr.padStart(10)} │ ${nominalStr.padStart(12)} │ ${diff.padStart(10)} │`
    );
  }
  console.log('└───┴──────────────────────────────┴─────┴──────────┴──────────────┴────────────┴──────────────┴────────────┘');
  
  // Analysis summary
  console.log('\nKEY FINDINGS:');
  console.log('- Nominal dollar modeling accounts for inflation in both returns and expenses');
  console.log('- Real dollar modeling uses inflation-adjusted returns with constant expenses');
  console.log('- Success rates may differ due to sequence of returns risk and inflation volatility');
  console.log('- Results are displayed in today\'s dollars for consistent comparison');
}

// Run the tests
runAllTests().catch(console.error);