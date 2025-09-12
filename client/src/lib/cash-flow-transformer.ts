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

  // For cash flow visualization, we want to show all years from current age
  // This gives a complete picture of the financial journey
  const yearsToShow = yearlyCashFlows;
  
  if (yearsToShow.length === 0) {
    return [];
  }
  
  return yearsToShow.map((yearData, index) => {
    const age = yearData.age || (currentAge + index);
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
    // The API now returns individual withdrawal amounts directly
    let taxableWithdrawal = yearData.taxableWithdrawal || 0;
    let taxDeferredWithdrawal = yearData.taxDeferredWithdrawal || 0;
    let rothWithdrawal = yearData.taxFreeWithdrawal || yearData.rothWithdrawal || 0;
    
    // Calculate total withdrawal from components
    const totalWithdrawal = taxableWithdrawal + taxDeferredWithdrawal + rothWithdrawal;
    
    // If we have a total withdrawal but no breakdown (older API format), estimate distribution
    if (yearData.withdrawal && !taxableWithdrawal && !taxDeferredWithdrawal && !rothWithdrawal) {
      const fallbackTotal = yearData.withdrawal;
      if (age < 73) {
        // Before RMDs: Prioritize taxable accounts
        taxableWithdrawal = Math.min(fallbackTotal * 0.6, fallbackTotal);
        taxDeferredWithdrawal = Math.min(fallbackTotal * 0.3, fallbackTotal - taxableWithdrawal);
        rothWithdrawal = fallbackTotal - taxableWithdrawal - taxDeferredWithdrawal;
      } else {
        // After RMDs (age 73+): More from tax-deferred due to Required Minimum Distributions
        taxDeferredWithdrawal = Math.min(fallbackTotal * 0.7, fallbackTotal);
        taxableWithdrawal = Math.min(fallbackTotal * 0.2, fallbackTotal - taxDeferredWithdrawal);
        rothWithdrawal = fallbackTotal - taxableWithdrawal - taxDeferredWithdrawal;
      }
    }
    
    // Ensure withdrawals are sufficient to cover expenses after guaranteed income
    const guaranteedIncome = userSS + spouseSS + userPension + spousePension + 
                           userEmploymentIncome + spouseEmploymentIncome + 
                           userPartTimeIncome + spousePartTimeIncome;
    
    // Calculate total expenses including taxes
    const baseMonthlyExpenses = variables.monthlyExpenses ?? yearData.monthlyExpenses ?? 8000;
    let totalExpenses = baseMonthlyExpenses * 12;
    
    // If we don't have enough withdrawals to cover the gap, show what's needed
    const expenseGap = totalExpenses - guaranteedIncome;
    if (expenseGap > 0 && totalWithdrawal < expenseGap) {
      // Need more withdrawals - follow tax-efficient sequence
      const additionalNeeded = expenseGap - totalWithdrawal;
      
      // First try taxable
      if (yearData.taxableBalance && yearData.taxableBalance > 0) {
        const additionalTaxable = Math.min(additionalNeeded, yearData.taxableBalance);
        taxableWithdrawal += additionalTaxable;
      }
      
      // Then tax-deferred (especially important for RMDs at 73+)
      if (age >= 73 && yearData.taxDeferredBalance && yearData.taxDeferredBalance > 0) {
        // Calculate RMD if not already included
        const rmdDivisor = getRMDDivisor(age);
        const rmdAmount = yearData.taxDeferredBalance / rmdDivisor;
        if (taxDeferredWithdrawal < rmdAmount) {
          taxDeferredWithdrawal = rmdAmount;
        }
      }
      
      // Finally Roth if needed
      const stillNeeded = expenseGap - (taxableWithdrawal + taxDeferredWithdrawal);
      if (stillNeeded > 0 && yearData.taxFreeBalance && yearData.taxFreeBalance > 0) {
        rothWithdrawal = Math.min(stillNeeded, yearData.taxFreeBalance);
      }
    }
    
    // Get expense breakdown (already calculated above)
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
    
    // Calculate taxes properly
    let federalTax = 0;
    let stateTax = 0;
    let ficaTax = 0;
    
    // If tax data is provided by API, use it
    if (yearData.totalTax || yearData.federalTax || yearData.withdrawalTax) {
      const totalTax = yearData.totalTax || yearData.withdrawalTax || 0;
      federalTax = yearData.federalTax || (totalTax * 0.7);
      stateTax = yearData.stateTax || (totalTax * 0.2);
      ficaTax = yearData.ficaTax || (totalTax * 0.1);
    } else {
      // Calculate taxes ourselves if not provided
      
      // Get state-specific tax rates
      const retirementState = profile.retirementState || profile.state || '';
      const stateTaxRates = getStateTaxRates(retirementState);
      
      // 1. Federal tax on tax-deferred withdrawals (100% taxable as ordinary income)
      // Use marginal tax brackets for more accuracy
      const ordinaryIncome = taxDeferredWithdrawal + userEmploymentIncome + spouseEmploymentIncome + 
                            userPartTimeIncome + spousePartTimeIncome + userPension + spousePension;
      
      // Simplified federal tax calculation (2024 married filing jointly brackets)
      let federalOrdinaryTax = 0;
      if (ordinaryIncome > 693750) {
        federalOrdinaryTax = ordinaryIncome * 0.37; // Top bracket
      } else if (ordinaryIncome > 462500) {
        federalOrdinaryTax = ordinaryIncome * 0.35;
      } else if (ordinaryIncome > 364200) {
        federalOrdinaryTax = ordinaryIncome * 0.32;
      } else if (ordinaryIncome > 190750) {
        federalOrdinaryTax = ordinaryIncome * 0.24;
      } else if (ordinaryIncome > 89075) {
        federalOrdinaryTax = ordinaryIncome * 0.22;
      } else if (ordinaryIncome > 22000) {
        federalOrdinaryTax = ordinaryIncome * 0.12;
      } else {
        federalOrdinaryTax = ordinaryIncome * 0.10;
      }
      
      // 2. Federal capital gains tax on taxable withdrawals
      const capitalGainsPortion = taxableWithdrawal * 0.5; // Assume 50% of withdrawal is gains
      // Federal long-term capital gains rates (based on total income)
      let federalCapitalGainsRate = 0;
      const totalIncomeForCG = ordinaryIncome + capitalGainsPortion;
      if (totalIncomeForCG > 553850) {
        federalCapitalGainsRate = 0.20; // 20% for high income
      } else if (totalIncomeForCG > 89250) {
        federalCapitalGainsRate = 0.15; // 15% for middle income
      } else {
        federalCapitalGainsRate = 0; // 0% for low income
      }
      const federalCapitalGainsTax = capitalGainsPortion * federalCapitalGainsRate;
      
      // 3. Tax on Social Security benefits (up to 85% taxable)
      const totalSS = userSS + spouseSS;
      const provisionalIncome = ordinaryIncome + (capitalGainsPortion) + (totalSS * 0.5);
      
      let taxableSS = 0;
      if (provisionalIncome > 44000) { // Married filing jointly threshold
        taxableSS = totalSS * 0.85; // 85% taxable
      } else if (provisionalIncome > 32000) {
        taxableSS = totalSS * 0.50; // 50% taxable
      }
      const federalSSTax = taxableSS * 0.12; // Estimate 12% rate on taxable portion
      
      // 4. FICA tax on employment and part-time income (if below FRA)
      const ficaIncome = userEmploymentIncome + spouseEmploymentIncome + 
                        (age < 67 ? userPartTimeIncome : 0) + 
                        (spouseAge && spouseAge < 67 ? spousePartTimeIncome : 0);
      ficaTax = ficaIncome * 0.0765; // 7.65% for employee portion
      
      // Total federal tax
      federalTax = federalOrdinaryTax + federalCapitalGainsTax + federalSSTax;
      
      // State tax based on actual retirement state
      if (stateTaxRates.retirementFriendly && ['IL', 'MS', 'PA'].includes(retirementState.toUpperCase())) {
        // These states don't tax retirement income at all
        stateTax = 0;
      } else {
        // State tax on ordinary income (including tax-deferred withdrawals)
        const stateOrdinaryTax = (taxDeferredWithdrawal + taxableSS) * stateTaxRates.incomeRate;
        
        // State capital gains tax
        const stateCapitalGainsTax = capitalGainsPortion * stateTaxRates.capitalGainsRate;
        
        // Some states exempt Social Security and/or pensions
        let statePensionTax = 0;
        if (!stateTaxRates.retirementFriendly) {
          statePensionTax = (userPension + spousePension) * stateTaxRates.incomeRate;
        }
        
        stateTax = stateOrdinaryTax + stateCapitalGainsTax + statePensionTax;
      }
    }
    
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

// RMD divisor table for ages 73+
function getRMDDivisor(age: number): number {
  const rmdTable: { [key: number]: number } = {
    73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4
  };
  
  if (age < 73) return 0; // No RMD before 73
  if (age > 100) return 6.4;
  return rmdTable[age] || 26.5;
}

// State tax rates for retirement income and capital gains
function getStateTaxRates(state: string): { incomeRate: number; capitalGainsRate: number; retirementFriendly: boolean } {
  const stateUpper = (state || '').toUpperCase();
  
  // State tax data for retirement income and capital gains
  const stateTaxData: { [key: string]: { incomeRate: number; capitalGainsRate: number; retirementFriendly: boolean } } = {
    // No income tax states
    'AK': { incomeRate: 0, capitalGainsRate: 0, retirementFriendly: true },
    'FL': { incomeRate: 0, capitalGainsRate: 0, retirementFriendly: true },
    'NV': { incomeRate: 0, capitalGainsRate: 0, retirementFriendly: true },
    'NH': { incomeRate: 0, capitalGainsRate: 0, retirementFriendly: true }, // No tax on earned income
    'SD': { incomeRate: 0, capitalGainsRate: 0, retirementFriendly: true },
    'TN': { incomeRate: 0, capitalGainsRate: 0, retirementFriendly: true },
    'TX': { incomeRate: 0, capitalGainsRate: 0, retirementFriendly: true },
    'WA': { incomeRate: 0, capitalGainsRate: 0, retirementFriendly: true },
    'WY': { incomeRate: 0, capitalGainsRate: 0, retirementFriendly: true },
    
    // Retirement-friendly states (no tax on SS, pensions often exempt)
    'IL': { incomeRate: 0.0495, capitalGainsRate: 0.0495, retirementFriendly: true }, // No tax on retirement income
    'MS': { incomeRate: 0.05, capitalGainsRate: 0.05, retirementFriendly: true }, // No tax on retirement income
    'PA': { incomeRate: 0.0307, capitalGainsRate: 0.0307, retirementFriendly: true }, // No tax on retirement income
    
    // High-tax states
    'CA': { incomeRate: 0.093, capitalGainsRate: 0.133, retirementFriendly: false }, // High rates, taxes everything
    'NY': { incomeRate: 0.0685, capitalGainsRate: 0.0685, retirementFriendly: false },
    'NJ': { incomeRate: 0.0637, capitalGainsRate: 0.0637, retirementFriendly: false },
    'OR': { incomeRate: 0.099, capitalGainsRate: 0.099, retirementFriendly: false },
    'MN': { incomeRate: 0.0785, capitalGainsRate: 0.0785, retirementFriendly: false },
    'VT': { incomeRate: 0.0875, capitalGainsRate: 0.0875, retirementFriendly: false },
    
    // Moderate tax states
    'AZ': { incomeRate: 0.025, capitalGainsRate: 0.025, retirementFriendly: true }, // Low flat tax
    'CO': { incomeRate: 0.044, capitalGainsRate: 0.044, retirementFriendly: true }, // Flat tax
    'GA': { incomeRate: 0.0575, capitalGainsRate: 0.0575, retirementFriendly: false },
    'NC': { incomeRate: 0.0475, capitalGainsRate: 0.0475, retirementFriendly: false },
    'MI': { incomeRate: 0.0425, capitalGainsRate: 0.0425, retirementFriendly: false },
    'IN': { incomeRate: 0.0323, capitalGainsRate: 0.0323, retirementFriendly: true },
    'UT': { incomeRate: 0.0485, capitalGainsRate: 0.0485, retirementFriendly: true },
    'MA': { incomeRate: 0.05, capitalGainsRate: 0.05, retirementFriendly: false },
    'VA': { incomeRate: 0.0575, capitalGainsRate: 0.0575, retirementFriendly: false },
    'OH': { incomeRate: 0.0399, capitalGainsRate: 0.0399, retirementFriendly: false },
    'WI': { incomeRate: 0.0653, capitalGainsRate: 0.0653, retirementFriendly: false },
    'MD': { incomeRate: 0.0575, capitalGainsRate: 0.0575, retirementFriendly: false },
    'CT': { incomeRate: 0.0699, capitalGainsRate: 0.0699, retirementFriendly: false },
    'ME': { incomeRate: 0.0715, capitalGainsRate: 0.0715, retirementFriendly: false },
    'RI': { incomeRate: 0.0599, capitalGainsRate: 0.0599, retirementFriendly: false },
    'IA': { incomeRate: 0.0853, capitalGainsRate: 0.0853, retirementFriendly: false },
    'KY': { incomeRate: 0.045, capitalGainsRate: 0.045, retirementFriendly: true }, // Flat tax
    'AL': { incomeRate: 0.05, capitalGainsRate: 0.05, retirementFriendly: false },
    'SC': { incomeRate: 0.065, capitalGainsRate: 0.065, retirementFriendly: true }, // Retirement deductions available
    'OK': { incomeRate: 0.0475, capitalGainsRate: 0.0475, retirementFriendly: false },
    'AR': { incomeRate: 0.047, capitalGainsRate: 0.047, retirementFriendly: false },
    'ID': { incomeRate: 0.058, capitalGainsRate: 0.058, retirementFriendly: false },
    'NE': { incomeRate: 0.0664, capitalGainsRate: 0.0664, retirementFriendly: false },
    'KS': { incomeRate: 0.057, capitalGainsRate: 0.057, retirementFriendly: false },
    'LA': { incomeRate: 0.0425, capitalGainsRate: 0.0425, retirementFriendly: false },
    'MO': { incomeRate: 0.0495, capitalGainsRate: 0.0495, retirementFriendly: false },
    'MT': { incomeRate: 0.0675, capitalGainsRate: 0.0675, retirementFriendly: false },
    'NM': { incomeRate: 0.049, capitalGainsRate: 0.049, retirementFriendly: false },
    'ND': { incomeRate: 0.0204, capitalGainsRate: 0.0204, retirementFriendly: true }, // Low rate
    'HI': { incomeRate: 0.0825, capitalGainsRate: 0.0725, retirementFriendly: false },
    'DE': { incomeRate: 0.066, capitalGainsRate: 0.066, retirementFriendly: false },
    'WV': { incomeRate: 0.054, capitalGainsRate: 0.054, retirementFriendly: false },
    'DC': { incomeRate: 0.0895, capitalGainsRate: 0.0895, retirementFriendly: false }
  };
  
  // Return the state data or default moderate rates
  return stateTaxData[stateUpper] || { incomeRate: 0.05, capitalGainsRate: 0.05, retirementFriendly: false };
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