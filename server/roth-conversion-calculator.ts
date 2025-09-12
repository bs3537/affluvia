// Roth Conversion Calculator for Tax Planning
import { calculateCombinedTaxRate } from './tax-calculator';
import { calculateOptimalRothConversion } from './asset-tax-classifier';

export interface RothConversionScenario {
  year: number;
  age: number;
  conversionAmount: number;
  taxableIncomeBeforeConversion: number;
  taxableIncomeAfterConversion: number;
  marginalRateBefore: number;
  marginalRateAfter: number;
  taxOnConversion: number;
  effectiveTaxRate: number;
  remainingTaxDeferred: number;
  rothBalance: number;
  totalPortfolioValue: number;
}

export interface RothConversionComparison {
  withConversion: {
    totalTaxesPaid: number;
    finalRothBalance: number;
    finalTaxDeferredBalance: number;
    totalPortfolioValue: number;
    rmdTaxes: number[];
    yearlyTaxes: number[];
  };
  withoutConversion: {
    totalTaxesPaid: number;
    finalRothBalance: number;
    finalTaxDeferredBalance: number;
    totalPortfolioValue: number;
    rmdTaxes: number[];
    yearlyTaxes: number[];
  };
  netBenefit: number;
  breakEvenYear: number;
  optimalConversionAmount: number;
  recommendedYears: number;
}

// Calculate detailed Roth conversion scenario
export function calculateRothConversionScenario(
  profile: any,
  conversionAmount: number,
  yearsToConvert: number,
  startYear: number = 0
): RothConversionScenario[] {
  const scenarios: RothConversionScenario[] = [];
  
  const currentAge = profile.userAge || 45;
  const retirementAge = profile.retirementAge || 65;
  const retirementState = profile.retirementState || 'FL';
  const filingStatus = profile.maritalStatus === 'married' ? 'married' : 'single';
  
  let taxDeferredBalance = profile.taxDeferredRetirementAccounts || 0;
  let rothBalance = profile.taxFreeRetirementAccounts || 0;
  const growthRate = 0.07; // 7% annual growth assumption
  
  for (let yearIndex = 0; yearIndex < 30; yearIndex++) {
    const year = new Date().getFullYear() + yearIndex;
    const age = currentAge + yearIndex;
    const isRetired = age >= retirementAge;
    
    // Calculate base taxable income
    let baseIncome = 0;
    if (!isRetired) {
      baseIncome = profile.userAnnualIncome || 0;
      if (profile.maritalStatus === 'married') {
        baseIncome += profile.spouseAnnualIncome || 0;
      }
    } else {
      // Retirement income sources
      if (age >= 67) {
        const ssBenefit = (profile.userSocialSecurityBenefit || 0) * 12;
        const spouseSS = profile.maritalStatus === 'married' ? 
          (profile.spouseSocialSecurityBenefit || 0) * 12 : 0;
        // 85% of SS is typically taxable
        baseIncome += (ssBenefit + spouseSS) * 0.85;
      }
      
      // Pension income
      baseIncome += (profile.pensionBenefit || 0) * 12;
      
      // Required Minimum Distributions (start at age 73)
      if (age >= 73) {
        const rmdFactor = getRMDFactor(age);
        const rmd = taxDeferredBalance / rmdFactor;
        baseIncome += rmd;
      }
    }
    
    // Determine if we should convert this year
    const shouldConvert = yearIndex >= startYear && 
                          yearIndex < startYear + yearsToConvert && 
                          age < 73 && // Don't convert after RMDs start
                          taxDeferredBalance > 0;
    
    const actualConversion = shouldConvert ? 
      Math.min(conversionAmount, taxDeferredBalance) : 0;
    
    // Calculate tax rates before and after conversion
    const marginalRateBefore = calculateMarginalRate(baseIncome, filingStatus);
    const marginalRateAfter = calculateMarginalRate(baseIncome + actualConversion, filingStatus);
    
    // Calculate actual tax on the conversion
    const taxOnConversion = calculateIncrementalTax(
      baseIncome,
      actualConversion,
      filingStatus,
      retirementState
    );
    
    const effectiveTaxRate = actualConversion > 0 ? 
      taxOnConversion / actualConversion : 0;
    
    // Update balances
    if (actualConversion > 0) {
      taxDeferredBalance -= actualConversion;
      rothBalance += (actualConversion - taxOnConversion);
    }
    
    // Apply growth
    taxDeferredBalance *= (1 + growthRate);
    rothBalance *= (1 + growthRate);
    
    scenarios.push({
      year,
      age,
      conversionAmount: actualConversion,
      taxableIncomeBeforeConversion: baseIncome,
      taxableIncomeAfterConversion: baseIncome + actualConversion,
      marginalRateBefore,
      marginalRateAfter,
      taxOnConversion,
      effectiveTaxRate,
      remainingTaxDeferred: taxDeferredBalance,
      rothBalance,
      totalPortfolioValue: taxDeferredBalance + rothBalance
    });
  }
  
  return scenarios;
}

// Compare scenarios with and without Roth conversions
export function compareRothConversionStrategies(
  profile: any,
  conversionAmount: number,
  yearsToConvert: number
): RothConversionComparison {
  // Run scenario WITH conversions
  const withConversionScenarios = calculateRothConversionScenario(
    profile,
    conversionAmount,
    yearsToConvert,
    0
  );
  
  // Run scenario WITHOUT conversions
  const withoutConversionScenarios = calculateRothConversionScenario(
    profile,
    0, // No conversions
    0,
    0
  );
  
  // Calculate total taxes paid in each scenario
  const withConversionTaxes = withConversionScenarios.reduce(
    (sum, s) => sum + s.taxOnConversion,
    0
  );
  
  // Estimate RMD taxes for each scenario
  const calculateRMDTaxes = (scenarios: RothConversionScenario[]) => {
    return scenarios
      .filter(s => s.age >= 73)
      .map(s => {
        const rmdFactor = getRMDFactor(s.age);
        const rmd = s.remainingTaxDeferred / rmdFactor;
        // Estimate 22% tax rate on RMDs
        return rmd * 0.22;
      });
  };
  
  const withConversionRMDTaxes = calculateRMDTaxes(withConversionScenarios);
  const withoutConversionRMDTaxes = calculateRMDTaxes(withoutConversionScenarios);
  
  const totalWithConversionTaxes = withConversionTaxes + 
    withConversionRMDTaxes.reduce((sum, t) => sum + t, 0);
  
  const totalWithoutConversionTaxes = 
    withoutConversionRMDTaxes.reduce((sum, t) => sum + t, 0);
  
  // Find break-even year
  let breakEvenYear = -1;
  let cumulativeBenefit = 0;
  
  for (let i = 0; i < withConversionScenarios.length; i++) {
    const yearlyBenefit = withoutConversionRMDTaxes[i] || 0;
    const yearlyCost = withConversionScenarios[i].taxOnConversion;
    cumulativeBenefit += yearlyBenefit - yearlyCost;
    
    if (cumulativeBenefit > 0 && breakEvenYear === -1) {
      breakEvenYear = withConversionScenarios[i].age;
    }
  }
  
  // Calculate optimal conversion amount
  const filingStatus = profile.maritalStatus === 'married' ? 'married' : 'single';
  const currentTaxableIncome = profile.userAnnualIncome || 0;
  const optimalAmount = calculateOptimalRothConversion(
    {
      taxDeferred: profile.taxDeferredRetirementAccounts || 0,
      taxFree: profile.taxFreeRetirementAccounts || 0,
      capitalGains: profile.taxableInvestmentAccounts || 0,
      cashEquivalents: profile.cashSavings || 0,
      totalAssets: 0 // Will be calculated
    },
    profile.userAge || 45,
    currentTaxableIncome,
    filingStatus as 'single' | 'married'
  );
  
  // Determine recommended years (until age 73 or RMDs start)
  const currentAge = profile.userAge || 45;
  const recommendedYears = Math.min(
    Math.max(73 - currentAge, 0),
    Math.ceil((profile.taxDeferredRetirementAccounts || 0) / conversionAmount)
  );
  
  const lastScenarioWith = withConversionScenarios[withConversionScenarios.length - 1];
  const lastScenarioWithout = withoutConversionScenarios[withoutConversionScenarios.length - 1];
  
  return {
    withConversion: {
      totalTaxesPaid: totalWithConversionTaxes,
      finalRothBalance: lastScenarioWith.rothBalance,
      finalTaxDeferredBalance: lastScenarioWith.remainingTaxDeferred,
      totalPortfolioValue: lastScenarioWith.totalPortfolioValue,
      rmdTaxes: withConversionRMDTaxes,
      yearlyTaxes: withConversionScenarios.map(s => s.taxOnConversion)
    },
    withoutConversion: {
      totalTaxesPaid: totalWithoutConversionTaxes,
      finalRothBalance: lastScenarioWithout.rothBalance,
      finalTaxDeferredBalance: lastScenarioWithout.remainingTaxDeferred,
      totalPortfolioValue: lastScenarioWithout.totalPortfolioValue,
      rmdTaxes: withoutConversionRMDTaxes,
      yearlyTaxes: withoutConversionScenarios.map(s => s.taxOnConversion)
    },
    netBenefit: totalWithoutConversionTaxes - totalWithConversionTaxes,
    breakEvenYear,
    optimalConversionAmount: optimalAmount,
    recommendedYears
  };
}

// Helper function to calculate marginal tax rate
function calculateMarginalRate(income: number, filingStatus: string): number {
  const brackets = filingStatus === 'married' ? {
    0.10: 23200,
    0.12: 94300,
    0.22: 201050,
    0.24: 383900,
    0.32: 487450,
    0.35: 731200,
    0.37: Infinity
  } : {
    0.10: 11600,
    0.12: 47150,
    0.22: 100525,
    0.24: 191950,
    0.32: 243725,
    0.35: 609350,
    0.37: Infinity
  };
  
  let marginalRate = 0.10;
  for (const [rate, limit] of Object.entries(brackets)) {
    if (income > limit) {
      marginalRate = parseFloat(rate);
    } else {
      break;
    }
  }
  
  return marginalRate;
}

// Calculate incremental tax on conversion
function calculateIncrementalTax(
  baseIncome: number,
  conversionAmount: number,
  filingStatus: string,
  state: string
): number {
  // Calculate federal tax
  const taxBefore = calculateFederalTax(baseIncome, filingStatus);
  const taxAfter = calculateFederalTax(baseIncome + conversionAmount, filingStatus);
  const federalTax = taxAfter - taxBefore;
  
  // Add state tax if applicable
  const stateTax = calculateStateTax(conversionAmount, state);
  
  return federalTax + stateTax;
}

// Simplified federal tax calculation
function calculateFederalTax(income: number, filingStatus: string): number {
  const brackets = filingStatus === 'married' ? [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 }
  ] : [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 }
  ];
  
  let tax = 0;
  let remainingIncome = income;
  
  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;
    
    const taxableInBracket = Math.min(
      remainingIncome,
      bracket.max - bracket.min
    );
    
    tax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }
  
  return tax;
}

// Simplified state tax calculation
function calculateStateTax(income: number, state: string): number {
  // State tax rates (simplified)
  const stateTaxRates: { [key: string]: number } = {
    'CA': 0.093,  // California
    'NY': 0.0685, // New York
    'FL': 0,      // Florida (no state tax)
    'TX': 0,      // Texas (no state tax)
    'WA': 0,      // Washington (no state tax)
    'NV': 0,      // Nevada (no state tax)
    'IL': 0.0495, // Illinois
    'PA': 0.0307, // Pennsylvania
    'MA': 0.05,   // Massachusetts
    'NJ': 0.0897, // New Jersey
    // Add more states as needed
  };
  
  const rate = stateTaxRates[state] || 0.05; // Default 5% if state not found
  return income * rate;
}

// Get RMD factor based on age
function getRMDFactor(age: number): number {
  const rmdFactors: { [key: number]: number } = {
    73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
    83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
    88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
    93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8,
    98: 7.3, 99: 6.8, 100: 6.4
  };
  
  return rmdFactors[Math.min(age, 100)] || 6.4;
}

// Calculate the optimal number of years to spread conversions
export function calculateOptimalConversionPeriod(
  profile: any
): { years: number; reasoning: string } {
  const currentAge = profile.userAge || 45;
  const retirementAge = profile.retirementAge || 65;
  const taxDeferredBalance = profile.taxDeferredRetirementAccounts || 0;
  
  // Key decision points
  const yearsUntilRetirement = Math.max(0, retirementAge - currentAge);
  const yearsUntilRMD = Math.max(0, 73 - currentAge);
  const retirementToRMDWindow = Math.max(0, 73 - retirementAge);
  
  let optimalYears = 5; // Default
  let reasoning = '';
  
  if (currentAge >= 73) {
    optimalYears = 0;
    reasoning = 'Already subject to RMDs - conversions less beneficial';
  } else if (currentAge >= retirementAge) {
    // Already retired - use the window before RMDs
    optimalYears = Math.min(yearsUntilRMD, 10);
    reasoning = `Convert over ${optimalYears} years before RMDs begin at age 73`;
  } else if (yearsUntilRetirement <= 5) {
    // Close to retirement - wait
    optimalYears = retirementToRMDWindow;
    reasoning = `Wait until retirement in ${yearsUntilRetirement} years, then convert over ${optimalYears} years`;
  } else {
    // Far from retirement - depends on current tax rate
    if (profile.userAnnualIncome > 200000) {
      optimalYears = retirementToRMDWindow;
      reasoning = 'High current income - wait until retirement for lower tax rates';
    } else {
      optimalYears = Math.min(yearsUntilRMD, 15);
      reasoning = `Moderate income - can start conversions now over ${optimalYears} years`;
    }
  }
  
  return { years: optimalYears, reasoning };
}