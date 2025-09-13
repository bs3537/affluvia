interface LifetimeIncomeParams {
  pia: number; // Primary Insurance Amount
  currentAge: number;
  claimAge: number;
  lifeExpectancy: number;
  fra?: number; // Full Retirement Age (default 67)
  discountRate?: number; // For NPV calculation
  inflationRate?: number; // For nominal calculation
}

interface SpouseLifetimeIncomeParams extends LifetimeIncomeParams {
  spousePIA: number;
  spouseCurrentAge: number;
  spouseClaimAge: number;
  spouseLifeExpectancy: number;
}

interface LifetimeIncomeResult {
  claimAge: number;
  monthlyBenefit: number;
  annualBenefit: number;
  lifetimeNominalIncome: number;
  lifetimeNPV: number;
  yearsOfBenefits: number;
}

interface CombinedLifetimeIncomeResult {
  userResult: LifetimeIncomeResult;
  spouseResult?: LifetimeIncomeResult;
  totalLifetimeNominalIncome: number;
  totalLifetimeNPV: number;
  scenario: string;
}

/**
 * Calculate Social Security benefit adjustment based on claiming age
 */
function calculateBenefitAdjustment(claimAge: number, fra: number = 67): number {
  if (claimAge < 62) return 0; // Cannot claim before 62
  if (claimAge > 70) claimAge = 70; // No additional benefit after 70
  
  if (claimAge === fra) return 1.0;
  
  if (claimAge < fra) {
    // Early retirement reduction
    const monthsEarly = (fra - claimAge) * 12;
    let reduction = 0;
    
    if (monthsEarly <= 36) {
      // First 36 months: 5/9 of 1% per month
      reduction = monthsEarly * (5/9) * 0.01;
    } else {
      // Beyond 36 months: 5/12 of 1% per month
      reduction = 36 * (5/9) * 0.01 + (monthsEarly - 36) * (5/12) * 0.01;
    }
    
    return Math.max(0, 1 - reduction);
  } else {
    // Delayed retirement credits: 8% per year after FRA
    const yearsDelayed = claimAge - fra;
    return 1 + (yearsDelayed * 0.08);
  }
}

/**
 * Calculate lifetime Social Security income for a single person
 */
export function calculateLifetimeIncome(params: LifetimeIncomeParams): LifetimeIncomeResult {
  const {
    pia,
    currentAge,
    claimAge,
    lifeExpectancy = 93, // Default to 93 as per requirements
    fra = 67,
    discountRate = 0.03,
    inflationRate = 0.025
  } = params;
  
  // Calculate the benefit adjustment factor
  const adjustmentFactor = calculateBenefitAdjustment(claimAge, fra);
  
  // Calculate monthly and annual benefits
  const monthlyBenefit = pia * adjustmentFactor;
  const annualBenefit = monthlyBenefit * 12;
  
  // Years of benefits
  const yearsOfBenefits = Math.max(0, lifeExpectancy - claimAge);
  
  // Calculate lifetime nominal income with COLA adjustments
  let lifetimeNominalIncome = 0;
  for (let year = 0; year < yearsOfBenefits; year++) {
    const colaAdjustedBenefit = annualBenefit * Math.pow(1 + inflationRate, year);
    lifetimeNominalIncome += colaAdjustedBenefit;
  }
  
  // Calculate NPV (sum of discounted annual benefits from claim age to longevity)
  let lifetimeNPV = 0;
  for (let age = claimAge; age <= lifeExpectancy; age++) {
    const yearsFromClaim = age - claimAge;
    const yearsFromNow = age - currentAge;
    
    // Apply COLA adjustment (2.5% annual)
    const adjustedBenefit = annualBenefit * Math.pow(1 + inflationRate, yearsFromClaim);
    
    // Discount to present value
    const discountFactor = Math.pow(1 + discountRate, yearsFromNow);
    const presentValue = adjustedBenefit / discountFactor;
    
    lifetimeNPV += presentValue;
  }
  
  return {
    claimAge,
    monthlyBenefit,
    annualBenefit,
    lifetimeNominalIncome,
    lifetimeNPV,
    yearsOfBenefits
  };
}

/**
 * Calculate combined lifetime Social Security income for user and spouse
 */
export function calculateCombinedLifetimeIncome(
  userParams: LifetimeIncomeParams,
  spouseParams?: LifetimeIncomeParams
): CombinedLifetimeIncomeResult {
  const userResult = calculateLifetimeIncome(userParams);
  
  if (!spouseParams) {
    return {
      userResult,
      totalLifetimeNominalIncome: userResult.lifetimeNominalIncome,
      totalLifetimeNPV: userResult.lifetimeNPV,
      scenario: `User claims at ${userParams.claimAge}`
    };
  }
  
  const spouseResult = calculateLifetimeIncome(spouseParams);
  
  return {
    userResult,
    spouseResult,
    totalLifetimeNominalIncome: userResult.lifetimeNominalIncome + spouseResult.lifetimeNominalIncome,
    totalLifetimeNPV: userResult.lifetimeNPV + spouseResult.lifetimeNPV,
    scenario: `User at ${userParams.claimAge}, Spouse at ${spouseParams.claimAge}`
  };
}

/**
 * Calculate lifetime income for multiple claiming age scenarios
 */
export function calculateScenarios(
  userParams: Omit<LifetimeIncomeParams, 'claimAge'>,
  spouseParams?: Omit<LifetimeIncomeParams, 'claimAge'>,
  optimalUserAge?: number,
  optimalSpouseAge?: number
): CombinedLifetimeIncomeResult[] {
  const scenarios: CombinedLifetimeIncomeResult[] = [];
  const { currentAge: userCurrentAge } = userParams;
  const spouseCurrentAge = spouseParams?.currentAge;
  
  // Define claim age scenarios
  const claimAgeScenarios = [
    { 
      userAge: 62, 
      spouseAge: 62, 
      label: 'As Early as Possible' 
    },
    { 
      userAge: userParams.currentAge, 
      spouseAge: spouseCurrentAge || userParams.currentAge, 
      label: 'At Retirement Age' 
    },
    { 
      userAge: 67, 
      spouseAge: 67, 
      label: 'Full Retirement Age (67)' 
    }
  ];
  
  // Add optimal ages if provided and different from standard scenarios
  if (optimalUserAge && optimalSpouseAge) {
    const isUnique = !claimAgeScenarios.some(s => 
      s.userAge === optimalUserAge && s.spouseAge === optimalSpouseAge
    );
    
    if (isUnique) {
      claimAgeScenarios.push({
        userAge: optimalUserAge,
        spouseAge: optimalSpouseAge,
        label: 'Optimal Strategy'
      });
    }
  }
  
  // Add age 70 if not already included
  const hasAge70 = claimAgeScenarios.some(s => s.userAge === 70);
  if (!hasAge70) {
    claimAgeScenarios.push({
      userAge: 70,
      spouseAge: 70,
      label: 'Maximum Benefit (70)'
    });
  }
  
  // Calculate for each scenario
  for (const scenario of claimAgeScenarios) {
    const result = calculateCombinedLifetimeIncome(
      { ...userParams, claimAge: scenario.userAge },
      spouseParams ? { ...spouseParams, claimAge: scenario.spouseAge } : undefined
    );
    
    scenarios.push({
      ...result,
      scenario: scenario.label
    });
  }
  
  // Sort by total NPV (highest first) - this is the correct optimization metric
  scenarios.sort((a, b) => b.totalLifetimeNPV - a.totalLifetimeNPV);
  
  return scenarios;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `${value < 0 ? '-' : ''}$${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(0)}K`;
    }
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Calculate cumulative Social Security benefits over time for breakeven analysis
 */
export interface CumulativeBenefitPoint {
  age: number;
  year: number;
  earlyClaimCumulative: number;
  optimalClaimCumulative: number;
}

export interface BreakevenAnalysis {
  dataPoints: CumulativeBenefitPoint[];
  breakevenAge: number | null;
  breakevenYear: number | null;
  earlyClaimAge: number;
  optimalClaimAge: number;
  earlyMonthlyBenefit: number;
  optimalMonthlyBenefit: number;
}

export function calculateBreakevenAnalysis(
  userPIA: number,
  userCurrentAge: number,
  userLifeExpectancy: number,
  earlyClaimAge: number = 62,
  optimalClaimAge: number,
  spousePIA?: number,
  spouseCurrentAge?: number,
  spouseLifeExpectancy?: number,
  spouseEarlyClaimAge?: number,
  spouseOptimalClaimAge?: number,
  inflationRate: number = 0.025
): BreakevenAnalysis {
  const dataPoints: CumulativeBenefitPoint[] = [];
  let breakevenAge: number | null = null;
  let breakevenYear: number | null = null;
  
  // Calculate monthly benefits for early and optimal claiming
  const userEarlyAdjustment = calculateBenefitAdjustment(earlyClaimAge, 67);
  const userOptimalAdjustment = calculateBenefitAdjustment(optimalClaimAge, 67);
  const userEarlyMonthly = userPIA * userEarlyAdjustment;
  const userOptimalMonthly = userPIA * userOptimalAdjustment;
  
  let spouseEarlyMonthly = 0;
  let spouseOptimalMonthly = 0;
  
  if (spousePIA && spouseEarlyClaimAge && spouseOptimalClaimAge) {
    const spouseEarlyAdjustment = calculateBenefitAdjustment(spouseEarlyClaimAge, 67);
    const spouseOptimalAdjustment = calculateBenefitAdjustment(spouseOptimalClaimAge, 67);
    spouseEarlyMonthly = spousePIA * spouseEarlyAdjustment;
    spouseOptimalMonthly = spousePIA * spouseOptimalAdjustment;
  }
  
  // Calculate cumulative benefits from age 62 to life expectancy
  let earlyClaimCumulative = 0;
  let optimalClaimCumulative = 0;
  let currentYear = 0;
  
  const maxAge = Math.max(userLifeExpectancy, spouseLifeExpectancy || userLifeExpectancy);
  
  for (let age = 62; age <= maxAge; age++) {
    currentYear = age - userCurrentAge;
    const inflationFactor = Math.pow(1 + inflationRate, currentYear);
    
    // Early claim strategy
    let earlyAnnualBenefit = 0;
    if (age >= earlyClaimAge && age <= userLifeExpectancy) {
      earlyAnnualBenefit += userEarlyMonthly * 12 * inflationFactor;
    }
    if (spousePIA && spouseCurrentAge && spouseLifeExpectancy && spouseEarlyClaimAge) {
      const spouseAge = age - userCurrentAge + spouseCurrentAge;
      if (spouseAge >= spouseEarlyClaimAge && spouseAge <= spouseLifeExpectancy) {
        earlyAnnualBenefit += spouseEarlyMonthly * 12 * inflationFactor;
      }
    }
    earlyClaimCumulative += earlyAnnualBenefit;
    
    // Optimal claim strategy
    let optimalAnnualBenefit = 0;
    if (age >= optimalClaimAge && age <= userLifeExpectancy) {
      optimalAnnualBenefit += userOptimalMonthly * 12 * inflationFactor;
    }
    if (spousePIA && spouseCurrentAge && spouseLifeExpectancy && spouseOptimalClaimAge) {
      const spouseAge = age - userCurrentAge + spouseCurrentAge;
      if (spouseAge >= spouseOptimalClaimAge && spouseAge <= spouseLifeExpectancy) {
        optimalAnnualBenefit += spouseOptimalMonthly * 12 * inflationFactor;
      }
    }
    optimalClaimCumulative += optimalAnnualBenefit;
    
    // Record data point
    dataPoints.push({
      age,
      year: currentYear,
      earlyClaimCumulative,
      optimalClaimCumulative
    });
    
    // Check for breakeven
    if (breakevenAge === null && optimalClaimCumulative >= earlyClaimCumulative && age > optimalClaimAge) {
      breakevenAge = age;
      breakevenYear = currentYear;
    }
  }
  
  return {
    dataPoints,
    breakevenAge,
    breakevenYear,
    earlyClaimAge,
    optimalClaimAge,
    earlyMonthlyBenefit: userEarlyMonthly + spouseEarlyMonthly,
    optimalMonthlyBenefit: userOptimalMonthly + spouseOptimalMonthly
  };
}

/**
 * Find optimal claiming ages that maximize NPV of Social Security benefits
 */
export function findOptimalClaimingAges(
  userParams: Omit<LifetimeIncomeParams, 'claimAge'>,
  spouseParams?: Omit<LifetimeIncomeParams, 'claimAge'>
): { userAge: number; spouseAge?: number; totalNPV: number } {
  let optimalUserAge = 67;
  let optimalSpouseAge = spouseParams ? 67 : undefined;
  let maxNPV = -Infinity;
  
  // Test all age combinations from 62 to 70
  for (let userAge = 62; userAge <= 70; userAge++) {
    if (spouseParams) {
      for (let spouseAge = 62; spouseAge <= 70; spouseAge++) {
        const userResult = calculateLifetimeIncome({
          ...userParams,
          claimAge: userAge
        });
        
        const spouseResult = calculateLifetimeIncome({
          ...spouseParams,
          claimAge: spouseAge
        });
        
        const totalNPV = userResult.lifetimeNPV + spouseResult.lifetimeNPV;
        
        if (totalNPV > maxNPV) {
          maxNPV = totalNPV;
          optimalUserAge = userAge;
          optimalSpouseAge = spouseAge;
        }
      }
    } else {
      const userResult = calculateLifetimeIncome({
        ...userParams,
        claimAge: userAge
      });
      
      if (userResult.lifetimeNPV > maxNPV) {
        maxNPV = userResult.lifetimeNPV;
        optimalUserAge = userAge;
      }
    }
  }
  
  return {
    userAge: optimalUserAge,
    spouseAge: optimalSpouseAge,
    totalNPV: maxNPV
  };
}

// Export types
export type { 
  CombinedLifetimeIncomeResult,
  LifetimeIncomeResult,
  LifetimeIncomeParams
};