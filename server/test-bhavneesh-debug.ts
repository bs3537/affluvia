// Debug test for Bhavneesh Sharma's 0% retirement confidence score
import { runEnhancedMonteCarloSimulation } from './monte-carlo-enhanced';
import { AssetBuckets } from './asset-tax-classifier';
import { calculateBenefitAtAge } from '../client/src/utils/socialSecurityOptimizer';

// Actual data from user description
const bhavneeshActualData = {
  // Personal info - BOTH AGE 50
  currentAge: 50,
  spouseAge: 50,
  retirementAge: 65,  // PLANNED RETIREMENT AGE 65 FOR BOTH
  spouseRetirementAge: 65,
  lifeExpectancy: 93,  // LIFE EXPECTANCY 93 FOR BOTH
  spouseLifeExpectancy: 93,
  
  // Income - SPOUSE INCOME 450K, USER INCOME 60K
  userIncome: 60000,
  spouseIncome: 450000,
  totalIncome: 510000,
  
  // Assets
  retirement401k: 400000,  // 401k = 400k (moderate risk profile)
  cashValueLifeInsurance: 120000,  // 120k in cash value life insurance
  taxableBrokerage: 90000,  // 90k in taxable brokerage (aggressive risk profile)
  checking: 50000,  // 50k in checking
  savings: 32000,  // 32k in savings
  
  // Monthly cash flow and contributions
  monthlyCashFlow: 6000,  // monthly cash flow $6k
  monthlySpouseContribution401k: 2500,  // ADDITIONAL CONTRIBUTION PER MONTH 2500 FOR SPOUSE IN 401K
  
  // Retirement
  monthlyRetirementExpenses: 8000,  // MONTHLY RETIREMENT EXPENSES 8000
  socialSecurityClaimAge: 70,  // SOCIAL SECURITY CLAIM AGE OF 70 FOR BOTH
  spouseSocialSecurityClaimAge: 70,
  
  // Location
  retirementState: 'FL',  // RETIREMENT STATE FLORIDA
  
  // NO PART-TIME INCOME FOR BOTH
  partTimeIncomeRetirement: 0,
  spousePartTimeIncomeRetirement: 0,
};

// Calculate Social Security benefits claiming at 70
function calculateSocialSecurityBenefits() {
  // Maximum Social Security wage base is capped (around $160k in 2023)
  // So high earner won't get proportionally higher benefits
  
  // User (lower earner): $60k annual
  // Rough estimate: PIA would be around $1,500/month at FRA (67)
  // Claiming at 70 = 24% increase = $1,860/month
  const userMonthlyBenefit = 1860;
  
  // Spouse (higher earner): $450k annual (but capped at wage base)
  // Rough estimate: PIA would be around $3,500/month at FRA (67) 
  // Claiming at 70 = 24% increase = $4,340/month
  const spouseMonthlyBenefit = 4340;
  
  const totalMonthlyBenefit = userMonthlyBenefit + spouseMonthlyBenefit;
  const totalAnnualBenefit = totalMonthlyBenefit * 12;
  
  console.log('Social Security Calculation (claiming at age 70):');
  console.log(`User Benefit at 70: $${userMonthlyBenefit}/month`);
  console.log(`Spouse Benefit at 70: $${spouseMonthlyBenefit}/month`);
  console.log(`Total Monthly SS Benefit: $${totalMonthlyBenefit}`);
  console.log(`Total Annual SS Benefit: $${totalAnnualBenefit}`);
  console.log('');
  
  return {
    userMonthlyBenefit,
    spouseMonthlyBenefit,
    totalAnnualBenefit
  };
}

// Calculate total retirement assets
function calculateTotalAssets(): AssetBuckets {
  const taxDeferred = bhavneeshActualData.retirement401k; // 401k
  const taxFree = 0; // No Roth mentioned
  const capitalGains = bhavneeshActualData.taxableBrokerage; // Brokerage
  const cashEquivalents = bhavneeshActualData.checking + bhavneeshActualData.savings; // Cash
  // Note: Cash value life insurance typically not counted as retirement asset unless surrendered
  
  const totalAssets = taxDeferred + taxFree + capitalGains + cashEquivalents;
  
  console.log('Asset Breakdown:');
  console.log(`401k (Tax-Deferred): $${taxDeferred.toLocaleString()}`);
  console.log(`Brokerage (Capital Gains): $${capitalGains.toLocaleString()}`);
  console.log(`Cash (Checking + Savings): $${cashEquivalents.toLocaleString()}`);
  console.log(`Cash Value Life Insurance: $${bhavneeshActualData.cashValueLifeInsurance.toLocaleString()} (not included in retirement assets)`);
  console.log(`Total Retirement Assets: $${totalAssets.toLocaleString()}`);
  console.log('');
  
  return {
    taxDeferred,
    taxFree,
    capitalGains,
    cashEquivalents,
    totalAssets
  };
}

// Calculate annual savings until retirement
function calculateAnnualSavings() {
  // Monthly cash flow of $6k
  // Plus spouse 401k contribution of $2,500/month
  // Total monthly savings = $6,000 + $2,500 = $8,500
  const monthlySavings = bhavneeshActualData.monthlyCashFlow + bhavneeshActualData.monthlySpouseContribution401k;
  const annualSavings = monthlySavings * 12;
  
  console.log('Savings Calculation:');
  console.log(`Monthly Cash Flow: $${bhavneeshActualData.monthlyCashFlow.toLocaleString()}`);
  console.log(`Monthly 401k Contribution (Spouse): $${bhavneeshActualData.monthlySpouseContribution401k.toLocaleString()}`);
  console.log(`Total Monthly Savings: $${monthlySavings.toLocaleString()}`);
  console.log(`Total Annual Savings: $${annualSavings.toLocaleString()}`);
  console.log('');
  
  return annualSavings;
}

// Run the debug test
async function debugRetirementScore() {
  console.log('=== DEBUGGING BHAVNEESH SHARMA\'S 0% RETIREMENT CONFIDENCE SCORE ===\n');
  
  // Calculate components
  const ssBenefits = calculateSocialSecurityBenefits();
  const assetBuckets = calculateTotalAssets();
  const annualSavings = calculateAnnualSavings();
  
  // Annual expenses in retirement
  const annualRetirementExpenses = bhavneeshActualData.monthlyRetirementExpenses * 12;
  
  console.log('Retirement Planning Summary:');
  console.log(`Current Ages: User ${bhavneeshActualData.currentAge}, Spouse ${bhavneeshActualData.spouseAge}`);
  console.log(`Retirement Ages: Both at ${bhavneeshActualData.retirementAge}`);
  console.log(`Years Until Retirement: ${bhavneeshActualData.retirementAge - bhavneeshActualData.currentAge}`);
  console.log(`Life Expectancy: Both to age ${bhavneeshActualData.lifeExpectancy}`);
  console.log(`Years in Retirement: ${bhavneeshActualData.lifeExpectancy - bhavneeshActualData.retirementAge}`);
  console.log(`Annual Retirement Expenses: $${annualRetirementExpenses.toLocaleString()}`);
  console.log(`Retirement State: ${bhavneeshActualData.retirementState} (no state income tax)`);
  console.log('');
  
  // Create parameters for Monte Carlo simulation
  const params = {
    // Ages
    currentAge: bhavneeshActualData.currentAge,
    spouseAge: bhavneeshActualData.spouseAge,
    retirementAge: bhavneeshActualData.retirementAge,
    spouseRetirementAge: bhavneeshActualData.spouseRetirementAge,
    lifeExpectancy: bhavneeshActualData.lifeExpectancy,
    spouseLifeExpectancy: bhavneeshActualData.spouseLifeExpectancy,
    
    // Social Security
    socialSecurityBenefit: ssBenefits.userMonthlyBenefit,
    socialSecurityClaimAge: bhavneeshActualData.socialSecurityClaimAge,
    spouseSocialSecurityBenefit: ssBenefits.spouseMonthlyBenefit,
    spouseSocialSecurityClaimAge: bhavneeshActualData.spouseSocialSecurityClaimAge,
    
    // Assets and income
    currentRetirementAssets: assetBuckets.totalAssets,
    annualGuaranteedIncome: 0, // SS starts at 70, not at retirement
    
    // Expenses
    annualRetirementExpenses: annualRetirementExpenses,
    annualHealthcareCosts: 15000, // Estimate for 65-year-old couple
    healthcareInflationRate: 0.05,
    
    // Market assumptions
    expectedReturn: 0.07, // 7% nominal return
    returnVolatility: 0.15,
    inflationRate: 0.03,
    
    // Asset allocation (moderate to aggressive)
    stockAllocation: 0.65, // 65% stocks
    bondAllocation: 0.30, // 30% bonds
    cashAllocation: 0.05, // 5% cash
    
    // Withdrawal strategy
    withdrawalRate: 0.04,
    useGuardrails: true,
    
    // Tax rate (Florida has no state tax)
    taxRate: 0.22, // Federal only
    retirementState: 'FL',
    
    // Savings
    annualSavings: annualSavings,
    
    // Legacy goal
    legacyGoal: 0, // Not mentioned
    
    // Part-time income
    partTimeIncomeRetirement: 0,
    spousePartTimeIncomeRetirement: 0,
    
    // Asset buckets
    assetBuckets
  };
  
  console.log('Monte Carlo Parameters:');
  console.log(`Current Retirement Assets: $${params.currentRetirementAssets.toLocaleString()}`);
  console.log(`Annual Savings: $${params.annualSavings.toLocaleString()}`);
  console.log(`Expected Portfolio at Retirement (rough): $${(params.currentRetirementAssets + params.annualSavings * 15).toLocaleString()}`);
  console.log(`Annual Expenses in Retirement: $${params.annualRetirementExpenses.toLocaleString()}`);
  console.log(`Annual Healthcare Costs: $${params.annualHealthcareCosts.toLocaleString()}`);
  console.log(`Social Security (starting at 70): $${ssBenefits.totalAnnualBenefit.toLocaleString()}/year`);
  console.log('');
  
  // Check for obvious issues
  console.log('=== CHECKING FOR POTENTIAL ISSUES ===\n');
  
  // Issue 1: Gap between retirement (65) and SS claim (70)
  const gapYears = params.socialSecurityClaimAge - params.retirementAge;
  const totalExpensesDuringGap = (params.annualRetirementExpenses + params.annualHealthcareCosts) * gapYears;
  console.log(`1. Social Security Gap:`);
  console.log(`   - Retire at ${params.retirementAge}, claim SS at ${params.socialSecurityClaimAge}`);
  console.log(`   - ${gapYears} years with no SS income`);
  console.log(`   - Total expenses during gap: $${totalExpensesDuringGap.toLocaleString()}`);
  console.log(`   - Must fund entirely from portfolio withdrawals\n`);
  
  // Issue 2: High expenses relative to assets
  const initialWithdrawalRate = (params.annualRetirementExpenses + params.annualHealthcareCosts) / params.currentRetirementAssets;
  console.log(`2. Initial Withdrawal Rate (if retired today):`);
  console.log(`   - Annual expenses: $${(params.annualRetirementExpenses + params.annualHealthcareCosts).toLocaleString()}`);
  console.log(`   - Current assets: $${params.currentRetirementAssets.toLocaleString()}`);
  console.log(`   - Withdrawal rate: ${(initialWithdrawalRate * 100).toFixed(1)}%`);
  console.log(`   - ${initialWithdrawalRate > 0.04 ? '⚠️ Above 4% safe withdrawal rate!' : '✓ Within safe range'}\n`);
  
  // Run Monte Carlo simulation
  console.log('=== RUNNING MONTE CARLO SIMULATION ===\n');
  console.log('Running 1000 simulations...');
  
  const result = runEnhancedMonteCarloSimulation(params, 1000);
  
  console.log('\nMonte Carlo Results:');
  console.log(`Probability of Success: ${result.probabilityOfSuccess.toFixed(1)}%`);
  console.log(`Median Ending Balance: $${result.medianEndingBalance.toLocaleString()}`);
  console.log(`10th Percentile: $${result.percentile10EndingBalance.toLocaleString()}`);
  console.log(`90th Percentile: $${result.percentile90EndingBalance.toLocaleString()}`);
  console.log(`Safe Withdrawal Rate: ${(result.safeWithdrawalRate * 100).toFixed(2)}%`);
  
  if (result.yearlyCashFlows && result.yearlyCashFlows.length > 0) {
    console.log('\nSample Cash Flow (First 10 Years of Retirement):');
    console.log('Age | Portfolio Balance | Withdrawal | Income | Net Cash Flow');
    console.log('----+------------------+------------+--------+--------------');
    
    const retirementStartIndex = result.yearlyCashFlows.findIndex(cf => cf.age >= params.retirementAge);
    if (retirementStartIndex >= 0) {
      for (let i = 0; i < Math.min(10, result.yearlyCashFlows.length - retirementStartIndex); i++) {
        const cf = result.yearlyCashFlows[retirementStartIndex + i];
        console.log(
          `${cf.age.toString().padStart(3)} | ` +
          `$${(cf.portfolioBalance / 1000).toFixed(0).padStart(5)}k | ` +
          `$${((cf.withdrawal || 0) / 1000).toFixed(0).padStart(5)}k | ` +
          `$${((cf.guaranteedIncome || 0) / 1000).toFixed(0).padStart(5)}k | ` +
          `$${((cf.netCashFlow || 0) / 1000).toFixed(0).padStart(6)}k`
        );
      }
    }
  }
  
  console.log('\n=== DIAGNOSIS ===\n');
  
  if (result.probabilityOfSuccess === 0) {
    console.log('❌ CRITICAL ISSUE: 0% Success Rate\n');
    console.log('Possible causes:');
    console.log('1. Portfolio depletes before Social Security starts at age 70');
    console.log('2. Annual expenses ($96k + healthcare) too high for current assets ($572k)');
    console.log('3. 5-year gap with no income requires ~$550k in withdrawals');
    console.log('4. Even with $102k annual savings for 15 years, may not build enough');
    
    // Calculate required portfolio
    const requiredForGap = totalExpensesDuringGap;
    const annualExpensesAfterSS = params.annualRetirementExpenses + params.annualHealthcareCosts * 1.5 - ssBenefits.totalAnnualBenefit;
    const yearsAfterSS = params.lifeExpectancy - params.socialSecurityClaimAge;
    const requiredForPostSS = annualExpensesAfterSS * yearsAfterSS;
    const totalRequired = requiredForGap + Math.max(0, requiredForPostSS);
    
    console.log('\nRough calculation:');
    console.log(`- Need for age 65-70 gap: $${requiredForGap.toLocaleString()}`);
    console.log(`- Annual shortfall after SS: $${Math.max(0, annualExpensesAfterSS).toLocaleString()}`);
    console.log(`- Years after SS (70-93): ${yearsAfterSS}`);
    console.log(`- Estimated total needed: $${totalRequired.toLocaleString()}`);
    console.log(`- Projected assets at 65: ~$${(params.currentRetirementAssets * Math.pow(1.07, 15) + params.annualSavings * 15).toLocaleString()}`);
  } else if (result.probabilityOfSuccess < 50) {
    console.log(`⚠️ LOW SUCCESS RATE: ${result.probabilityOfSuccess.toFixed(1)}%\n`);
    console.log('The retirement plan has significant risk.');
  } else {
    console.log(`✓ Success Rate: ${result.probabilityOfSuccess.toFixed(1)}%\n`);
  }
  
  console.log('\nRECOMMENDATIONS:');
  console.log('1. Consider claiming Social Security earlier (e.g., at 67 or even 65)');
  console.log('2. Increase retirement savings if possible');
  console.log('3. Consider reducing retirement expenses');
  console.log('4. Work part-time in early retirement to bridge the gap');
  console.log('5. Consider delaying retirement by a few years');
}

// Run the debug test
debugRetirementScore().catch(console.error);