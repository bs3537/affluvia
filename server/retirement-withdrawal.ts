interface WithdrawalSequenceParams {
  currentAge: number;
  retirementAge: number;
  spouseCurrentAge?: number;
  spouseRetirementAge?: number;
  lifeExpectancy: number;
  socialSecurityAge: number;
  spouseSocialSecurityAge?: number;
  socialSecurityBenefit: number;
  spouseSocialSecurityBenefit?: number;
  pensionBenefit: number;
  spousePensionBenefit?: number;
  partTimeIncomeRetirement: number;
  spousePartTimeIncomeRetirement?: number;
  annualIncome: number; // User's working income
  spouseAnnualIncome?: number; // Spouse's working income
  monthlyExpenses: number;
  assets: {
    taxable: number; // Brokerage accounts
    taxDeferred: number; // 401k, 403b, Traditional IRA, etc.
    taxFree: number; // Roth IRA, Roth 401k, etc.
    hsa: number; // Health Savings Account
  };
  investmentReturns: {
    taxable: number;
    taxDeferred: number;
    taxFree: number;
    hsa: number;
  };
  inflationRate: number;
  taxRate: number;
}

interface YearlyWithdrawal {
  year: number;
  age: number;
  spouseAge?: number;
  monthlyExpenses: number;
  
  // Income sources
  workingIncome: number; // User's salary if still working
  spouseWorkingIncome?: number; // Spouse's salary if still working
  socialSecurity: number;
  spouseSocialSecurity?: number;
  pension: number;
  spousePension?: number;
  partTimeIncome: number;
  spousePartTimeIncome?: number;
  
  // Withdrawals by account type
  taxableWithdrawal: number;
  taxDeferredWithdrawal: number;
  taxFreeWithdrawal: number;
  hsaWithdrawal: number;
  
  // Remaining balances
  taxableBalance: number;
  taxDeferredBalance: number;
  taxFreeBalance: number;
  hsaBalance: number;
  
  // Summary
  totalIncome: number;
  totalWithdrawals: number;
  totalBalance: number;
  withdrawalTax: number;
  netIncome: number;
  rmdAmount?: number; // Required Minimum Distribution
}

export function calculateWithdrawalSequence(params: WithdrawalSequenceParams): YearlyWithdrawal[] {
  const results: YearlyWithdrawal[] = [];
  const currentYear = new Date().getFullYear();
  
  // Initialize balances
  let taxableBalance = params.assets.taxable;
  let taxDeferredBalance = params.assets.taxDeferred;
  let taxFreeBalance = params.assets.taxFree;
  let hsaBalance = params.assets.hsa;
  
  // Determine the earliest retirement age (when either spouse retires)
  const userRetirementYear = currentYear + (params.retirementAge - params.currentAge);
  const spouseRetirementYear = params.spouseRetirementAge && params.spouseCurrentAge ? 
    currentYear + (params.spouseRetirementAge - params.spouseCurrentAge) : userRetirementYear;
  const earliestRetirementYear = Math.min(userRetirementYear, spouseRetirementYear);
  
  // Calculate years from earliest retirement to life expectancy
  const startAge = params.currentAge + (earliestRetirementYear - currentYear);
  const yearsToProject = params.lifeExpectancy - startAge;
  
  for (let yearIndex = 0; yearIndex < yearsToProject; yearIndex++) {
    const year = earliestRetirementYear + yearIndex;
    const age = startAge + yearIndex;
    const spouseAge = params.spouseCurrentAge ? 
      params.spouseCurrentAge + (year - currentYear) : undefined;
    
    // Adjust expenses for inflation
    const monthlyExpenses = params.monthlyExpenses * Math.pow(1 + params.inflationRate, yearIndex);
    const annualExpenses = monthlyExpenses * 12;
    
    // Calculate working income (if either spouse is still working)
    const userRetired = age >= params.retirementAge;
    const spouseRetired = spouseAge ? spouseAge >= (params.spouseRetirementAge || params.retirementAge) : true;
    
    const workingIncome = !userRetired ? params.annualIncome : 0;
    const spouseWorkingIncome = !spouseRetired && params.spouseAnnualIncome ? params.spouseAnnualIncome : 0;
    
    // Calculate retirement income sources
    const socialSecurity = age >= params.socialSecurityAge ? params.socialSecurityBenefit * 12 : 0;
    const spouseSocialSecurity = spouseAge && spouseAge >= params.spouseSocialSecurityAge ? 
      (params.spouseSocialSecurityBenefit || 0) * 12 : 0;
    
    // Pension only starts when retired
    const pension = userRetired ? params.pensionBenefit * 12 : 0;
    const spousePension = spouseRetired ? (params.spousePensionBenefit || 0) * 12 : 0;
    
    // Part-time income continues until death (no decay, realistic model)
    const partTimeIncome = userRetired ? 
      params.partTimeIncomeRetirement * 12 : 0;
    const spousePartTimeIncome = spouseRetired && spouseAge ? 
      (params.spousePartTimeIncomeRetirement || 0) * 12 : 0;
    
    // Calculate total guaranteed income (including working income)
    const totalGuaranteedIncome = workingIncome + spouseWorkingIncome + socialSecurity + spouseSocialSecurity + pension + spousePension + partTimeIncome + spousePartTimeIncome;
    
    // Calculate withdrawal need
    let withdrawalNeed = Math.max(0, annualExpenses - totalGuaranteedIncome);
    
    // Calculate RMD if applicable (starts at age 73)
    let rmdAmount = 0;
    if (age >= 73) {
      const rmdDivisor = getRMDDivisor(age);
      rmdAmount = taxDeferredBalance / rmdDivisor;
    }
    
    // Withdrawal sequence
    let taxableWithdrawal = 0;
    let taxDeferredWithdrawal = 0;
    let taxFreeWithdrawal = 0;
    let hsaWithdrawal = 0;
    
    // 1. Use HSA for healthcare expenses first (estimate 15% of total expenses)
    const healthcareExpenses = annualExpenses * 0.15;
    if (hsaBalance > 0 && healthcareExpenses > 0) {
      hsaWithdrawal = Math.min(healthcareExpenses, hsaBalance);
      hsaBalance -= hsaWithdrawal;
      withdrawalNeed = Math.max(0, withdrawalNeed - hsaWithdrawal);
    }
    
    // 2. Withdraw from taxable accounts first
    if (withdrawalNeed > 0 && taxableBalance > 0) {
      taxableWithdrawal = Math.min(withdrawalNeed, taxableBalance);
      taxableBalance -= taxableWithdrawal;
      withdrawalNeed -= taxableWithdrawal;
    }
    
    // 3. Withdraw from tax-deferred accounts (considering RMD)
    if (withdrawalNeed > 0 || rmdAmount > 0) {
      taxDeferredWithdrawal = Math.max(Math.min(withdrawalNeed, taxDeferredBalance), rmdAmount);
      taxDeferredBalance -= taxDeferredWithdrawal;
      withdrawalNeed = Math.max(0, withdrawalNeed - taxDeferredWithdrawal);
    }
    
    // 4. Finally, withdraw from tax-free accounts (Roth)
    if (withdrawalNeed > 0 && taxFreeBalance > 0) {
      taxFreeWithdrawal = Math.min(withdrawalNeed, taxFreeBalance);
      taxFreeBalance -= taxFreeWithdrawal;
      withdrawalNeed -= taxFreeWithdrawal;
    }
    
    // Apply investment returns to remaining balances
    taxableBalance *= (1 + params.investmentReturns.taxable);
    taxDeferredBalance *= (1 + params.investmentReturns.taxDeferred);
    taxFreeBalance *= (1 + params.investmentReturns.taxFree);
    hsaBalance *= (1 + params.investmentReturns.hsa);
    
    // Calculate taxes on withdrawals
    const taxableIncome = taxDeferredWithdrawal + (taxableWithdrawal * 0.15); // Assume 15% of taxable is capital gains
    const withdrawalTax = taxableIncome * params.taxRate;
    
    // Calculate totals
    const totalIncome = totalGuaranteedIncome;
    const totalWithdrawals = taxableWithdrawal + taxDeferredWithdrawal + taxFreeWithdrawal + hsaWithdrawal;
    const totalBalance = taxableBalance + taxDeferredBalance + taxFreeBalance + hsaBalance;
    const netIncome = totalIncome + totalWithdrawals - withdrawalTax;
    
    results.push({
      year,
      age,
      spouseAge,
      monthlyExpenses,
      workingIncome,
      spouseWorkingIncome,
      socialSecurity,
      spouseSocialSecurity,
      pension,
      spousePension,
      partTimeIncome,
      spousePartTimeIncome,
      taxableWithdrawal,
      taxDeferredWithdrawal,
      taxFreeWithdrawal,
      hsaWithdrawal,
      taxableBalance,
      taxDeferredBalance,
      taxFreeBalance,
      hsaBalance,
      totalIncome,
      totalWithdrawals,
      totalBalance,
      withdrawalTax,
      netIncome,
      rmdAmount: rmdAmount > 0 ? rmdAmount : undefined
    });
  }
  
  return results;
}

// RMD divisors based on IRS Uniform Lifetime Table
function getRMDDivisor(age: number): number {
  const rmdTable: { [key: number]: number } = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4
  };
  
  if (age > 100) return 6.4;
  return rmdTable[age] || 27.4;
}

// Helper function to aggregate assets by type from financial profile
export function aggregateAssetsByType(profile: any): WithdrawalSequenceParams['assets'] {
  const assets = {
    taxable: 0,
    taxDeferred: 0,
    taxFree: 0,
    hsa: 0
  };
  
  if (!profile.assets || !Array.isArray(profile.assets)) {
    return assets;
  }
  
  profile.assets.forEach((asset: any) => {
    const value = asset.value || 0;
    const type = asset.type?.toLowerCase() || '';
    
    // Categorize assets by tax treatment
    if (type.includes('hsa')) {
      assets.hsa += value;
    } else if (type.includes('roth')) {
      assets.taxFree += value;
    } else if (type.includes('401k') || type.includes('403b') || 
               type.includes('ira') || type.includes('sep') || 
               type.includes('simple') || type.includes('457') ||
               type.includes('annuity')) {
      // Traditional retirement accounts are tax-deferred
      if (!type.includes('roth')) {
        assets.taxDeferred += value;
      } else {
        assets.taxFree += value;
      }
    } else if (type.includes('brokerage') || type.includes('stock') || 
               type.includes('bond') || type.includes('mutual') || 
               type.includes('etf') || type.includes('taxable')) {
      assets.taxable += value;
    } else if (type.includes('savings') || type.includes('checking') || 
               type.includes('money market') || type.includes('cd')) {
      // Cash and cash equivalents are taxable
      assets.taxable += value;
    } else {
      // Default to taxable if unclear
      assets.taxable += value;
    }
  });
  
  return assets;
}