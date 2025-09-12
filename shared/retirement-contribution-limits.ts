// 2025 Retirement Account Contribution Limits
// Source: IRS guidelines for 2025

export interface ContributionLimits {
  baseLimit: number;
  catchUpLimit: number;
  enhancedCatchUpLimit: number;
  totalAnnualAdditionsLimit: number;
}

export interface AgeCatchUpEligibility {
  isEligibleForCatchUp: boolean;
  isEligibleForEnhancedCatchUp: boolean;
  catchUpAmount: number;
}

// 2025 Contribution Limits
export const CONTRIBUTION_LIMITS_2025 = {
  // Standard 401(k), 403(b), and governmental 457(b) plans
  standard: {
    baseLimit: 23500, // Employee elective deferral limit (under 50)
    catchUpLimit: 7500, // Additional for ages 50-59 and 64+
    enhancedCatchUpLimit: 11250, // Additional for ages 60-63
    totalAnnualAdditionsLimit: 70000, // Total employee + employer contributions
    totalWithCatchUp: 77500, // Total with standard catch-up
    totalWithEnhancedCatchUp: 81250 // Total with enhanced catch-up
  },
  
  // SIMPLE 401(k) plans
  simple: {
    baseLimit: 16500,
    catchUpLimit: 3500,
    enhancedCatchUpLimit: 5250,
    totalAnnualAdditionsLimit: 35000 // Estimated, varies by compensation
  },
  
  // Traditional and Roth IRA
  ira: {
    baseLimit: 7000,
    catchUpLimit: 1000, // Ages 50+
    enhancedCatchUpLimit: 1000, // Same as regular catch-up for IRAs
    totalAnnualAdditionsLimit: 7000 // No employer contributions for IRAs
  },
  
  // SEP IRA
  sepIra: {
    baseLimit: 70000, // Lesser of 25% of compensation or $70,000
    catchUpLimit: 0, // No catch-up for SEP IRAs
    enhancedCatchUpLimit: 0,
    totalAnnualAdditionsLimit: 70000
  },
  
  // Solo 401(k) for self-employed
  solo401k: {
    employeeDeferralLimit: 23500,
    catchUpLimit: 7500,
    enhancedCatchUpLimit: 11250,
    totalAnnualAdditionsLimit: 70000 // Employee deferrals + employer contributions
  }
};

// Other important limits for 2025
export const OTHER_LIMITS_2025 = {
  compensationLimit: 350000, // Maximum compensation that can be considered
  highlyCompensatedEmployee: 160000, // HCE threshold
  keyEmployee: 230000, // Key employee threshold for top-heavy testing
};

// Calculate age-based catch-up eligibility
export function getAgeCatchUpEligibility(birthDate: string | Date): AgeCatchUpEligibility {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  // Adjust age if birthday hasn't occurred this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  // Determine catch-up eligibility based on age
  if (age >= 60 && age <= 63) {
    return {
      isEligibleForCatchUp: true,
      isEligibleForEnhancedCatchUp: true,
      catchUpAmount: CONTRIBUTION_LIMITS_2025.standard.enhancedCatchUpLimit
    };
  } else if (age >= 50) {
    return {
      isEligibleForCatchUp: true,
      isEligibleForEnhancedCatchUp: false,
      catchUpAmount: CONTRIBUTION_LIMITS_2025.standard.catchUpLimit
    };
  } else {
    return {
      isEligibleForCatchUp: false,
      isEligibleForEnhancedCatchUp: false,
      catchUpAmount: 0
    };
  }
}

// Get contribution limit for a specific account type
export function getContributionLimit(
  accountType: string,
  birthDate: string | Date,
  includeEmployerContributions: boolean = false
): number {
  const catchUpEligibility = getAgeCatchUpEligibility(birthDate);
  
  let baseLimit = 0;
  let catchUpAmount = catchUpEligibility.catchUpAmount;
  
  switch (accountType.toLowerCase()) {
    case '401k':
    case '403b':
    case '457b':
    case 'governmental-457b':
      baseLimit = CONTRIBUTION_LIMITS_2025.standard.baseLimit;
      if (includeEmployerContributions) {
        return catchUpEligibility.isEligibleForEnhancedCatchUp
          ? CONTRIBUTION_LIMITS_2025.standard.totalWithEnhancedCatchUp
          : catchUpEligibility.isEligibleForCatchUp
          ? CONTRIBUTION_LIMITS_2025.standard.totalWithCatchUp
          : CONTRIBUTION_LIMITS_2025.standard.totalAnnualAdditionsLimit;
      }
      break;
      
    case 'simple-401k':
    case 'simple-ira':
      baseLimit = CONTRIBUTION_LIMITS_2025.simple.baseLimit;
      catchUpAmount = catchUpEligibility.isEligibleForEnhancedCatchUp
        ? CONTRIBUTION_LIMITS_2025.simple.enhancedCatchUpLimit
        : catchUpEligibility.isEligibleForCatchUp
        ? CONTRIBUTION_LIMITS_2025.simple.catchUpLimit
        : 0;
      break;
      
    case 'traditional-ira':
    case 'roth-ira':
      baseLimit = CONTRIBUTION_LIMITS_2025.ira.baseLimit;
      catchUpAmount = catchUpEligibility.isEligibleForCatchUp
        ? CONTRIBUTION_LIMITS_2025.ira.catchUpLimit
        : 0;
      break;
      
    case 'sep-ira':
      return CONTRIBUTION_LIMITS_2025.sepIra.baseLimit;
      
    default:
      return 0;
  }
  
  return baseLimit + catchUpAmount;
}

/**
 * Calculate contribution limits for a future year with annual growth
 * Based on historical average CAGR of 2% for 401(k) limits over the last 25 years
 */
export function getFutureContributionLimit(
  accountType: string,
  birthDate: string | Date,
  targetYear: number,
  includeEmployerContributions: boolean = false,
  annualGrowthRate: number = 0.02 // 2% historical average
): number {
  const baseYear = 2025;
  const yearsInFuture = Math.max(0, targetYear - baseYear);
  
  const currentLimit = getContributionLimit(accountType, birthDate, includeEmployerContributions);
  
  if (yearsInFuture === 0) {
    return currentLimit;
  }
  
  // Apply compound annual growth to the limit
  const futureLimit = currentLimit * Math.pow(1 + annualGrowthRate, yearsInFuture);
  
  // Round to nearest $500 (typical IRS rounding for contribution limits)
  return Math.round(futureLimit / 500) * 500;
}

/**
 * Calculate total annual contributions with limits applied for a given year
 * Useful for Monte Carlo simulations that span multiple years
 */
export function calculateAnnualContributionsWithLimits(
  contributions: {
    monthlyContribution401k?: number;
    monthlyContributionIRA?: number;
    monthlyContributionRothIRA?: number;
    spouseMonthlyContribution401k?: number;
    spouseMonthlyContributionIRA?: number; 
    spouseMonthlyContributionRothIRA?: number;
  },
  userBirthDate: string | Date,
  spouseBirthDate: string | Date | undefined,
  year: number
): {
  userTotal: number;
  spouseTotal: number;
  totalHouseholdContributions: number;
  limitedContributions: {
    user401k: number;
    userIRA: number;
    userRothIRA: number;
    spouse401k: number;
    spouseIRA: number;
    spouseRothIRA: number;
  };
} {
  // Get annual contribution limits for the target year
  const user401kLimit = getFutureContributionLimit('401k', userBirthDate, year, false);
  const userIRALimit = getFutureContributionLimit('traditional-ira', userBirthDate, year, false);
  const userRothIRALimit = getFutureContributionLimit('roth-ira', userBirthDate, year, false);
  
  // Calculate user contributions with limits applied
  const user401kDesired = (contributions.monthlyContribution401k || 0) * 12;
  const userIRADesired = (contributions.monthlyContributionIRA || 0) * 12;
  const userRothIRADesired = (contributions.monthlyContributionRothIRA || 0) * 12;
  
  const user401kLimited = Math.min(user401kDesired, user401kLimit);
  const userIRALimited = Math.min(userIRADesired, userIRALimit);
  const userRothIRALimited = Math.min(userRothIRADesired, userRothIRALimit);
  
  const userTotal = user401kLimited + userIRALimited + userRothIRALimited;
  
  // Calculate spouse contributions if spouse exists
  let spouseTotal = 0;
  let spouse401kLimited = 0;
  let spouseIRALimited = 0;
  let spouseRothIRALimited = 0;
  
  if (spouseBirthDate) {
    const spouse401kLimit = getFutureContributionLimit('401k', spouseBirthDate, year, false);
    const spouseIRALimit = getFutureContributionLimit('traditional-ira', spouseBirthDate, year, false);
    const spouseRothIRALimit = getFutureContributionLimit('roth-ira', spouseBirthDate, year, false);
    
    const spouse401kDesired = (contributions.spouseMonthlyContribution401k || 0) * 12;
    const spouseIRADesired = (contributions.spouseMonthlyContributionIRA || 0) * 12;
    const spouseRothIRADesired = (contributions.spouseMonthlyContributionRothIRA || 0) * 12;
    
    spouse401kLimited = Math.min(spouse401kDesired, spouse401kLimit);
    spouseIRALimited = Math.min(spouseIRADesired, spouseIRALimit);
    spouseRothIRALimited = Math.min(spouseRothIRADesired, spouseRothIRALimit);
    
    spouseTotal = spouse401kLimited + spouseIRALimited + spouseRothIRALimited;
  }
  
  return {
    userTotal,
    spouseTotal,
    totalHouseholdContributions: userTotal + spouseTotal,
    limitedContributions: {
      user401k: user401kLimited,
      userIRA: userIRALimited,
      userRothIRA: userRothIRALimited,
      spouse401k: spouse401kLimited,
      spouseIRA: spouseIRALimited,
      spouseRothIRA: spouseRothIRALimited
    }
  };
}

// Validate contribution amount
export function validateContribution(
  amount: number,
  accountType: string,
  birthDate: string | Date,
  isAnnual: boolean = true
): { isValid: boolean; limit: number; message?: string } {
  const annualAmount = isAnnual ? amount : amount * 12;
  const limit = getContributionLimit(accountType, birthDate);
  
  if (annualAmount > limit) {
    const catchUpEligibility = getAgeCatchUpEligibility(birthDate);
    let message = `Annual contribution of $${annualAmount.toLocaleString()} exceeds the ${new Date().getFullYear()} limit of $${limit.toLocaleString()} for ${accountType}.`;
    
    if (!catchUpEligibility.isEligibleForCatchUp) {
      const age = new Date().getFullYear() - new Date(birthDate).getFullYear();
      message += ` You'll be eligible for catch-up contributions at age 50 (in ${50 - age} years).`;
    } else if (catchUpEligibility.isEligibleForEnhancedCatchUp) {
      message += ` This includes the enhanced catch-up contribution of $${CONTRIBUTION_LIMITS_2025.standard.enhancedCatchUpLimit.toLocaleString()} for ages 60-63.`;
    } else {
      message += ` This includes the catch-up contribution of $${CONTRIBUTION_LIMITS_2025.standard.catchUpLimit.toLocaleString()} for ages 50+.`;
    }
    
    return { isValid: false, limit, message };
  }
  
  return { isValid: true, limit };
}

// Calculate total contributions across all retirement accounts
export function calculateTotalContributions(
  assets: Array<{ type: string; value?: number }>,
  monthlyContribution: number,
  employerContribution: number = 0
): number {
  // Convert monthly to annual
  const annualEmployeeContribution = monthlyContribution * 12;
  const annualEmployerContribution = employerContribution * 12;
  
  return annualEmployeeContribution + annualEmployerContribution;
}

// Check if combined contributions across similar account types exceed limits
export function validateCombinedContributions(
  accounts: Array<{ type: string; employeeContribution: number; employerContribution?: number }>,
  birthDate: string | Date
): { isValid: boolean; violations: Array<{ accountTypes: string[]; total: number; limit: number; message: string }> } {
  const violations: Array<{ accountTypes: string[]; total: number; limit: number; message: string }> = [];
  
  // Group accounts by contribution limit category
  const standardAccounts = accounts.filter(a => 
    ['401k', '403b', '457b', 'governmental-457b'].includes(a.type.toLowerCase())
  );
  
  const simpleAccounts = accounts.filter(a => 
    ['simple-401k', 'simple-ira'].includes(a.type.toLowerCase())
  );
  
  const iraAccounts = accounts.filter(a => 
    ['traditional-ira', 'roth-ira'].includes(a.type.toLowerCase())
  );
  
  // Check standard 401(k)/403(b)/457(b) combined limit
  if (standardAccounts.length > 0) {
    const totalEmployee = standardAccounts.reduce((sum, a) => sum + (a.employeeContribution * 12), 0);
    const limit = getContributionLimit('401k', birthDate);
    
    if (totalEmployee > limit) {
      violations.push({
        accountTypes: standardAccounts.map(a => a.type),
        total: totalEmployee,
        limit,
        message: `Combined annual employee contributions to 401(k), 403(b), and 457(b) accounts ($${totalEmployee.toLocaleString()}) exceed the ${new Date().getFullYear()} limit of $${limit.toLocaleString()}.`
      });
    }
  }
  
  // Check IRA combined limit
  if (iraAccounts.length > 0) {
    const totalEmployee = iraAccounts.reduce((sum, a) => sum + (a.employeeContribution * 12), 0);
    const limit = getContributionLimit('traditional-ira', birthDate);
    
    if (totalEmployee > limit) {
      violations.push({
        accountTypes: iraAccounts.map(a => a.type),
        total: totalEmployee,
        limit,
        message: `Combined annual contributions to Traditional and Roth IRAs ($${totalEmployee.toLocaleString()}) exceed the ${new Date().getFullYear()} limit of $${limit.toLocaleString()}.`
      });
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations
  };
}