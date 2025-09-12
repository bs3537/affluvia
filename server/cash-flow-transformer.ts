// Server-side cash flow transformer for Monte Carlo simulation results
// Transform Monte Carlo simulation results into cash flow data for Sankey visualization

interface MonteCarloYearData {
  year: number;
  age: number;
  portfolioBalance: number;
  withdrawal?: number;
  guaranteedIncome?: number;
  netCashFlow?: number;
  socialSecurityIncome?: number;
  pensionIncome?: number;
  partTimeIncome?: number;
  taxableWithdrawal?: number;
  taxDeferredWithdrawal?: number;
  rothWithdrawal?: number;
  totalTax?: number;
  federalTax?: number;
  stateTax?: number;
  ficaTax?: number;
  healthcareCosts?: number;
  totalExpenses?: number;
}

interface OptimizationVariables {
  retirementAge: number;
  spouseRetirementAge: number;
  socialSecurityAge: number;
  spouseSocialSecurityAge: number;
  monthlyExpenses: number;
  partTimeIncome: number;
  spousePartTimeIncome: number;
}

interface Profile {
  socialSecurityBenefit?: number;
  spouseSocialSecurityBenefit?: number;
  pensionBenefit?: number;
  spousePensionBenefit?: number;
  expectedMonthlyExpensesRetirement?: number;
  dateOfBirth?: string;
  spouseDateOfBirth?: string;
  annualIncome?: number;
  spouseAnnualIncome?: number;
  primaryResidence?: {
    yearsToPayOffMortgage?: number;
    monthlyPayment?: number;
  };
}

export interface CashFlowData {
  year: number;
  age: number;
  spouseAge?: number;
  
  // Income sources
  socialSecurity: number;
  spouseSocialSecurity: number;
  pension: number;
  spousePension: number;
  partTimeIncome: number;
  spousePartTimeIncome: number;
  employmentIncome: number;
  spouseEmploymentIncome: number;
  
  // Portfolio withdrawals by account type
  taxableWithdrawal: number;
  taxDeferredWithdrawal: number;
  rothWithdrawal: number;
  
  // Expenses
  livingExpenses: number;
  healthcare: number;
  housing: number;
  insurance: number;
  discretionary: number;
  debt: number;
  
  // Taxes
  federalTax: number;
  stateTax: number;
  ficaTax: number;
  
  // Savings/Deficit
  netCashFlow: number;
  
  // Portfolio balance
  portfolioBalance: number;
}

export function transformMonteCarloToCashFlow(
  yearlyCashFlows: MonteCarloYearData[],
  variables: OptimizationVariables,
  profile: Profile,
  isOptimized: boolean = false
): CashFlowData[] {
  if (!yearlyCashFlows || yearlyCashFlows.length === 0) {
    return [];
  }
  
  // Calculate current ages
  const currentYear = new Date().getFullYear();
  const userBirthYear = profile.dateOfBirth ? new Date(profile.dateOfBirth).getFullYear() : currentYear - 45;
  const spouseBirthYear = profile.spouseDateOfBirth ? new Date(profile.spouseDateOfBirth).getFullYear() : currentYear - 43;
  const currentAge = currentYear - userBirthYear;
  const spouseCurrentAge = currentYear - spouseBirthYear;
  
  // Determine the earliest retirement age for the couple
  const earliestRetirementAge = Math.min(
    variables.retirementAge, 
    variables.spouseRetirementAge || variables.retirementAge
  );

  // Filter to only retirement years, starting from the earliest retirement date
  const retirementYears = yearlyCashFlows.filter(yearData => {
    const age = yearData.age || (currentAge + yearlyCashFlows.indexOf(yearData));
    // Include all years from when the first spouse retires (even if withdrawals are 0 or negative)
    return age >= earliestRetirementAge;
  });
  
  if (retirementYears.length === 0) {
    return [];
  }
  
  return retirementYears.map((yearData, index) => {
    const age = yearData.age || (earliestRetirementAge + index);
    const spouseAge = spouseCurrentAge + (age - currentAge);
    
    // Determine if receiving Social Security (based on claim age)
    const receivingSS = age >= variables.socialSecurityAge;
    const spouseReceivingSS = spouseAge >= variables.spouseSocialSecurityAge;
    
    // Determine if working (pre-retirement employment) or part-time (post-retirement)
    const userRetired = age >= variables.retirementAge;
    const spouseRetired = spouseAge >= variables.spouseRetirementAge;
    
    // Part-time income only after retirement and before age 75
    const hasPartTime = userRetired && age < 75;
    const spouseHasPartTime = spouseRetired && spouseAge < 75;
    
    // Calculate monthly values then annualize
    const userSS = receivingSS ? (profile.socialSecurityBenefit || 0) * 12 : 0;
    const spouseSS = spouseReceivingSS ? (profile.spouseSocialSecurityBenefit || 0) * 12 : 0;
    const userPension = userRetired ? (profile.pensionBenefit || 0) * 12 : 0;
    const spousePension = spouseRetired ? (profile.spousePensionBenefit || 0) * 12 : 0;
    
    // Separate employment income (pre-retirement) from part-time income (post-retirement)
    let userEmploymentIncome = 0;
    let spouseEmploymentIncome = 0;
    let userPartTimeIncome = 0;
    let spousePartTimeIncome = 0;
    
    if (!userRetired) {
      // Still working - use full employment income
      userEmploymentIncome = profile.annualIncome || 0;
    } else if (hasPartTime) {
      // Retired but working part-time
      userPartTimeIncome = (variables.partTimeIncome || 0) * 12;
    }
    
    if (!spouseRetired) {
      // Spouse still working - use full employment income  
      spouseEmploymentIncome = profile.spouseAnnualIncome || 0;
    } else if (spouseHasPartTime) {
      // Spouse retired but working part-time
      spousePartTimeIncome = (variables.spousePartTimeIncome || 0) * 12;
    }
    
    // Get withdrawal amounts from Monte Carlo data
    const totalWithdrawal = yearData.withdrawal || 0;
    
    // Estimate withdrawal distribution by account type
    // In reality, tax-efficient withdrawal follows: Cash → Taxable → Tax-Deferred → Roth
    // For visualization, we'll estimate based on typical patterns
    let taxableWithdrawal = 0;
    let taxDeferredWithdrawal = 0;
    let rothWithdrawal = 0;
    
    if (totalWithdrawal > 0) {
      // Simplified withdrawal strategy visualization
      // Early retirement: More from taxable
      // After 70.5: Required minimums from tax-deferred
      // Late retirement: May tap Roth
      
      if (age < 70) {
        // Before RMDs: Prioritize taxable accounts
        taxableWithdrawal = Math.min(totalWithdrawal * 0.6, totalWithdrawal);
        taxDeferredWithdrawal = Math.min(totalWithdrawal * 0.4, totalWithdrawal - taxableWithdrawal);
        rothWithdrawal = totalWithdrawal - taxableWithdrawal - taxDeferredWithdrawal;
      } else {
        // After RMDs: More from tax-deferred
        taxDeferredWithdrawal = Math.min(totalWithdrawal * 0.6, totalWithdrawal);
        taxableWithdrawal = Math.min(totalWithdrawal * 0.3, totalWithdrawal - taxDeferredWithdrawal);
        rothWithdrawal = totalWithdrawal - taxableWithdrawal - taxDeferredWithdrawal;
      }
    }
    
    // Get expense breakdown
    const baseMonthlyExpenses = variables.monthlyExpenses || 8000;
    let totalExpenses = baseMonthlyExpenses * 12;
    const healthcare = yearData.healthcareCosts || (totalExpenses * 0.15); // Estimate 15% for healthcare
    
    // Check if mortgage is paid off
    const currentYear = new Date().getFullYear() + (age - currentAge);
    // Convert years to payoff to actual year
    const mortgagePayoffYear = profile.primaryResidence?.yearsToPayOffMortgage 
      ? new Date().getFullYear() + profile.primaryResidence.yearsToPayOffMortgage
      : undefined;
    const mortgagePaidOff = mortgagePayoffYear && currentYear >= mortgagePayoffYear;
    
    // Estimate expense categories as percentages of total
    const livingExpenses = totalExpenses * 0.40; // 40% for basic living
    let housing = totalExpenses * 0.25; // 25% for housing
    
    // Adjust housing costs based on mortgage status
    if (mortgagePaidOff) {
      // After mortgage is paid off, only property tax, insurance, and maintenance remain
      // Typically these are about 30% of the original housing cost
      const mortgagePayment = profile.primaryResidence?.monthlyPayment ? profile.primaryResidence.monthlyPayment * 12 : housing * 0.70;
      housing = housing - mortgagePayment; // Remove mortgage payment from housing
      
      // If housing goes below a minimum (property tax + insurance), set a floor
      const minHousing = totalExpenses * 0.05; // At least 5% for property tax and insurance
      housing = Math.max(housing, minHousing);
      
      // Recalculate total expenses
      totalExpenses = totalExpenses - mortgagePayment;
    }
    
    const discretionary = totalExpenses * 0.15; // 15% discretionary
    const insurance = totalExpenses * 0.05; // 5% insurance
    const debt = 0; // Debt is already included in housing/mortgage
    
    // Get tax breakdown
    const totalTax = yearData.totalTax || 0;
    const federalTax = yearData.federalTax || (totalTax * 0.7); // Estimate 70% federal
    const stateTax = yearData.stateTax || (totalTax * 0.2); // Estimate 20% state
    const ficaTax = yearData.ficaTax || (totalTax * 0.1); // Estimate 10% FICA on part-time work
    
    // Calculate net cash flow
    const totalIncome = userSS + spouseSS + userPension + spousePension + 
                       userEmploymentIncome + spouseEmploymentIncome + 
                       userPartTimeIncome + spousePartTimeIncome + totalWithdrawal;
    const totalOutflow = livingExpenses + healthcare + housing + insurance + discretionary + debt + federalTax + stateTax + ficaTax;
    const netCashFlow = totalIncome - totalOutflow;
    
    return {
      year: yearData.year,
      age: age,
      spouseAge: spouseAge,
      
      // Income sources
      socialSecurity: userSS,
      spouseSocialSecurity: spouseSS,
      pension: userPension,
      spousePension: spousePension,
      partTimeIncome: userPartTimeIncome,
      spousePartTimeIncome: spousePartTimeIncome,
      employmentIncome: userEmploymentIncome,
      spouseEmploymentIncome: spouseEmploymentIncome,
      
      // Portfolio withdrawals
      taxableWithdrawal,
      taxDeferredWithdrawal,
      rothWithdrawal,
      
      // Expenses
      livingExpenses,
      healthcare,
      housing,
      insurance,
      discretionary,
      debt,
      
      // Taxes
      federalTax,
      stateTax,
      ficaTax,
      
      // Net flow
      netCashFlow,
      
      // Portfolio balance
      portfolioBalance: yearData.portfolioBalance
    };
  });
}

// Helper function to calculate more accurate withdrawal distributions based on asset buckets
export function calculateWithdrawalDistribution(
  totalWithdrawal: number,
  age: number,
  assetBuckets: {
    taxDeferred: number;
    taxFree: number;
    capitalGains: number;
    cashEquivalents: number;
  }
): {
  taxableWithdrawal: number;
  taxDeferredWithdrawal: number;
  rothWithdrawal: number;
} {
  // Tax-efficient withdrawal sequence
  let remaining = totalWithdrawal;
  let taxableWithdrawal = 0;
  let taxDeferredWithdrawal = 0;
  let rothWithdrawal = 0;
  
  // 1. First use cash equivalents (if any)
  if (remaining > 0 && assetBuckets.cashEquivalents > 0) {
    taxableWithdrawal = Math.min(remaining, assetBuckets.cashEquivalents);
    remaining -= taxableWithdrawal;
  }
  
  // 2. Then use taxable accounts (capital gains)
  if (remaining > 0 && assetBuckets.capitalGains > 0) {
    const additionalTaxable = Math.min(remaining, assetBuckets.capitalGains * 0.04); // ~4% withdrawal rate
    taxableWithdrawal += additionalTaxable;
    remaining -= additionalTaxable;
  }
  
  // 3. Then tax-deferred (especially after RMD age 73)
  if (remaining > 0 && assetBuckets.taxDeferred > 0) {
    const rmdRequired = age >= 73;
    const minWithdrawal = rmdRequired ? assetBuckets.taxDeferred * 0.04 : 0; // Simplified RMD
    taxDeferredWithdrawal = Math.max(Math.min(remaining, assetBuckets.taxDeferred * 0.04), minWithdrawal);
    remaining -= taxDeferredWithdrawal;
  }
  
  // 4. Finally Roth (preserve for last)
  if (remaining > 0 && assetBuckets.taxFree > 0) {
    rothWithdrawal = Math.min(remaining, assetBuckets.taxFree * 0.04);
  }
  
  return {
    taxableWithdrawal,
    taxDeferredWithdrawal,
    rothWithdrawal
  };
}