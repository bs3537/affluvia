/**
 * Social Security benefit calculator using 2025 guidelines
 * Implements proper PIA calculation with bend points and COLA adjustments
 */

/**
 * 2025 Social Security parameters
 */
export const SS_PARAMS_2025 = {
  // Bend points for PIA calculation (2025 values - projected)
  bendPoint1: 1174,  // First bend point (2025 projected)
  bendPoint2: 7078,  // Second bend point (2025 projected)
  
  // Replacement rates at each tier
  rate1: 0.90,  // 90% up to first bend point
  rate2: 0.32,  // 32% between bend points  
  rate3: 0.15,  // 15% above second bend point
  
  // Maximum benefits  
  maxMonthlyBenefit: 4873,  // Maximum PIA at FRA in 2025 (projected)
  maxTaxableIncome: 176100,  // Social Security wage base for 2025
  
  // COLA for 2025
  colaRate: 0.025,  // 2.5% COLA for 2025
  
  // Full retirement age (for those born 1960 or later)
  fullRetirementAge: 67,
  
  // Early retirement reduction factors
  monthlyReductionBeforeFRA: 5/9 * 0.01,  // 5/9 of 1% for first 36 months
  monthlyReductionBeyond36: 5/12 * 0.01,  // 5/12 of 1% beyond 36 months
  
  // Delayed retirement credit (per year after FRA)
  delayedRetirementCredit: 0.08,  // 8% per year
  
  // Earnings test limits (2025)
  earningsLimitBeforeFRA: 23400,  // Annual limit before FRA
  earningsLimitYearOfFRA: 62160,  // Limit in year reaching FRA
  
  // Average wage index growth (for projections)
  avgWageGrowth: 0.0354,  // 3.54% annual (SSA Trustees Report assumption)
};

/**
 * Calculate Average Indexed Monthly Earnings (AIME)
 * This is simplified - actual calculation requires 35 years of indexed earnings
 * @param currentMonthlyIncome Current monthly income
 * @param yearsWorked Number of years worked (max 35 counted)
 * @param careerGrowthRate Average annual income growth over career
 */
export function calculateAIME(
  currentMonthlyIncome: number,
  yearsWorked: number,
  currentAge: number = 51,
  careerGrowthRate: number = 0.03
): number {
  // Cap at Social Security maximum taxable income
  const cappedMonthlyIncome = Math.min(
    currentMonthlyIncome,
    SS_PARAMS_2025.maxTaxableIncome / 12
  );
  
  const cappedAnnualIncome = cappedMonthlyIncome * 12;
  
  // More accurate AIME calculation based on SSA methodology
  // Key insight: AIME should be roughly proportional to career average earnings
  // indexed to age 60
  
  // For someone age 51 in 2025:
  // - Born in 1974
  // - Turns 60 in 2034
  // - Turns 62 in 2036 (eligibility year)
  
  const birthYear = 2025 - currentAge;
  const indexingYear = birthYear + 60; // Year they turn 60
  const yearsToIndexing = indexingYear - 2025;
  
  // Determine if this is a max earner
  const isMaxEarner = cappedAnnualIncome >= SS_PARAMS_2025.maxTaxableIncome;
  
  if (isMaxEarner) {
    // For maximum earners who hit the wage base
    // Their AIME will be close to the maximum possible
    // Project wage base back and forward appropriately
    
    // Calculate average wage base over 35-year career
    // Wage base grows with AWI
    let totalIndexedEarnings = 0;
    const careerYears = 35;
    
    for (let i = 0; i < careerYears; i++) {
      // Years from indexing year (age 60)
      const yearsFromIndexing = (careerYears - i) - (60 - currentAge + careerYears - yearsWorked);
      
      // Project wage base for that year
      let yearWageBase;
      if (yearsFromIndexing < 0) {
        // Historical years - project backward
        yearWageBase = SS_PARAMS_2025.maxTaxableIncome * 
          Math.pow(1 + SS_PARAMS_2025.avgWageGrowth, yearsFromIndexing + yearsToIndexing);
      } else {
        // Future years - no indexing past age 60
        yearWageBase = SS_PARAMS_2025.maxTaxableIncome * 
          Math.pow(1 + SS_PARAMS_2025.avgWageGrowth, yearsToIndexing);
      }
      
      // Index to age 60 (only for years before age 60)
      const indexingFactor = yearsFromIndexing < 0 ? 
        Math.pow(1 + SS_PARAMS_2025.avgWageGrowth, -yearsFromIndexing) : 1;
      
      totalIndexedEarnings += yearWageBase * indexingFactor;
    }
    
    // AIME is total indexed earnings divided by 420 months
    return Math.round(totalIndexedEarnings / 420);
  }
  
  // For non-max earners, use income-based calculation
  // Estimate career earnings pattern based on current income level
  
  const annualIncome = cappedAnnualIncome;
  let careerAverageRatio;
  
  // Determine career average as ratio of current income
  // Higher earners typically have steeper career growth
  if (annualIncome >= 150000) {
    careerAverageRatio = 0.70; // High earners: career avg is 70% of current
  } else if (annualIncome >= 100000) {
    careerAverageRatio = 0.75; // Upper middle: 75% of current
  } else if (annualIncome >= 75000) {
    careerAverageRatio = 0.80; // Middle: 80% of current
  } else if (annualIncome >= 50000) {
    careerAverageRatio = 0.85; // Lower middle: 85% of current
  } else {
    careerAverageRatio = 0.90; // Lower earners: flatter career trajectory
  }
  
  // Calculate base career average
  const careerAverageIncome = annualIncome * careerAverageRatio;
  
  // Account for years worked (if less than 35, zeros are included)
  const effectiveYears = Math.min(yearsWorked, 35);
  const yearsFactor = effectiveYears / 35;
  
  // Apply indexing growth to bring to age 60 equivalent
  const indexingGrowth = Math.pow(1 + SS_PARAMS_2025.avgWageGrowth, yearsToIndexing);
  
  // Calculate AIME
  const aime = (careerAverageIncome * yearsFactor * indexingGrowth) / 12;
  
  return Math.round(aime);
}

/**
 * Calculate Primary Insurance Amount (PIA) using 2025 bend points
 * @param aime Average Indexed Monthly Earnings
 * @param yearOf62 Year person turns/turned 62 (for bend point selection)
 */
export function calculatePIA(aime: number, yearOf62: number = 2025): number {
  // Project bend points for future years
  let bendPoint1 = SS_PARAMS_2025.bendPoint1;
  let bendPoint2 = SS_PARAMS_2025.bendPoint2;
  
  if (yearOf62 > 2025) {
    // Bend points grow with average wage index
    const yearsInFuture = yearOf62 - 2025;
    const growthFactor = Math.pow(1 + SS_PARAMS_2025.avgWageGrowth, yearsInFuture);
    
    // For someone turning 62 in 2036 (age 51 in 2025):
    // Growth factor = (1.0354)^11 = 1.46
    // Bend point 1: 1174 * 1.46 = ~1714 (close to expected $1,798)
    // Bend point 2: 7078 * 1.46 = ~10,334 (close to expected $10,837)
    
    bendPoint1 = Math.round(bendPoint1 * growthFactor);
    bendPoint2 = Math.round(bendPoint2 * growthFactor);
  }
  
  let pia = 0;
  
  // First tier: 90% up to first bend point
  if (aime <= bendPoint1) {
    pia = aime * SS_PARAMS_2025.rate1;
  } else {
    pia = bendPoint1 * SS_PARAMS_2025.rate1;
    
    // Second tier: 32% between bend points
    if (aime <= bendPoint2) {
      pia += (aime - bendPoint1) * SS_PARAMS_2025.rate2;
    } else {
      pia += (bendPoint2 - bendPoint1) * SS_PARAMS_2025.rate2;
      
      // Third tier: 15% above second bend point
      pia += (aime - bendPoint2) * SS_PARAMS_2025.rate3;
    }
  }
  
  // Round down to nearest dollar
  pia = Math.floor(pia);
  
  // Note: Not capping at max benefit here as it will grow with wage index
  return pia;
}

/**
 * Adjust PIA for early or delayed retirement
 * @param pia Primary Insurance Amount
 * @param claimAge Age when claiming benefits
 * @param fullRetirementAge Full retirement age (default 67)
 */
export function adjustPIAForClaimAge(
  pia: number,
  claimAge: number,
  fullRetirementAge: number = 67
): number {
  const monthsFromFRA = (claimAge - fullRetirementAge) * 12;
  
  if (monthsFromFRA < 0) {
    // Early retirement reduction
    const monthsEarly = Math.abs(monthsFromFRA);
    let reduction = 0;
    
    if (monthsEarly <= 36) {
      // First 36 months: 5/9 of 1% per month
      reduction = monthsEarly * SS_PARAMS_2025.monthlyReductionBeforeFRA;
    } else {
      // First 36 months + additional months at 5/12 of 1%
      reduction = 36 * SS_PARAMS_2025.monthlyReductionBeforeFRA +
                 (monthsEarly - 36) * SS_PARAMS_2025.monthlyReductionBeyond36;
    }
    
    return pia * (1 - reduction);
    
  } else if (monthsFromFRA > 0) {
    // Delayed retirement credit (8% per year, up to age 70)
    const yearsDelayed = Math.min(monthsFromFRA / 12, 3); // Max 3 years (to age 70)
    const credit = yearsDelayed * SS_PARAMS_2025.delayedRetirementCredit;
    
    return pia * (1 + credit);
  }
  
  // Claiming at FRA
  return pia;
}

/**
 * Calculate estimated Social Security benefit
 * @param monthlyIncome Current monthly income
 * @param currentAge Current age
 * @param claimAge Age when planning to claim (62-70)
 * @param yearsWorked Estimated years worked by claim age
 */
export function calculateSocialSecurityBenefit(
  monthlyIncome: number,
  currentAge: number,
  claimAge: number = 67,
  yearsWorked?: number
): number {
  // Estimate years worked if not provided
  // Professional workers typically start around 22-25
  const workStartAge = monthlyIncome > 8333 ? 25 : 22; // Higher earners often have more education
  const estimatedYearsWorked = yearsWorked || 
    Math.min(35, Math.max(10, claimAge - workStartAge));
  
  // For high earners (>$100k annually), assume continuous work history
  // For middle earners ($50k-$100k), assume mostly continuous
  // Only apply work history adjustments for lower earners
  const annualIncome = monthlyIncome * 12;
  let adjustedYearsWorked = estimatedYearsWorked;
  
  if (annualIncome < 40000) {
    // Lower earners may have gaps
    adjustedYearsWorked = estimatedYearsWorked * 0.85;
  } else if (annualIncome < 50000) {
    // Lower-middle earners: minimal gaps
    adjustedYearsWorked = estimatedYearsWorked * 0.92;
  }
  // For $50k+ earners, use full years (no adjustment)
  
  // Calculate AIME with current age for proper indexing
  const aime = calculateAIME(monthlyIncome, adjustedYearsWorked, currentAge);
  
  // Calculate PIA based on when they turn 62
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - currentAge;
  const yearOf62 = birthYear + 62;
  
  // For future retirees (turning 62 after 2025), project bend points
  let adjustedBendPoint1 = SS_PARAMS_2025.bendPoint1;
  let adjustedBendPoint2 = SS_PARAMS_2025.bendPoint2;
  
  if (yearOf62 > 2025) {
    const yearsInFuture = yearOf62 - 2025;
    const growthFactor = Math.pow(1 + SS_PARAMS_2025.avgWageGrowth, yearsInFuture);
    adjustedBendPoint1 = Math.round(adjustedBendPoint1 * growthFactor);
    adjustedBendPoint2 = Math.round(adjustedBendPoint2 * growthFactor);
  }
  
  // Calculate PIA using projected bend points
  let pia = 0;
  
  if (aime <= adjustedBendPoint1) {
    pia = aime * SS_PARAMS_2025.rate1;
  } else {
    pia = adjustedBendPoint1 * SS_PARAMS_2025.rate1;
    
    if (aime <= adjustedBendPoint2) {
      pia += (aime - adjustedBendPoint1) * SS_PARAMS_2025.rate2;
    } else {
      pia += (adjustedBendPoint2 - adjustedBendPoint1) * SS_PARAMS_2025.rate2;
      pia += (aime - adjustedBendPoint2) * SS_PARAMS_2025.rate3;
    }
  }
  
  // Round down to nearest dollar (SSA rounds to dime, but we'll round to dollar for simplicity)
  pia = Math.floor(pia);
  
  // Adjust for claim age
  const adjustedBenefit = adjustPIAForClaimAge(pia, claimAge);
  
  return Math.round(adjustedBenefit);
}

/**
 * Apply COLA adjustments to Social Security benefit
 * @param baseBenefit Base benefit amount
 * @param years Number of years to project
 * @param colaRate Annual COLA rate (default 2.5% based on historical average)
 */
export function applySocialSecurityCOLA(
  baseBenefit: number,
  years: number,
  colaRate: number = SS_PARAMS_2025.colaRate
): number {
  return baseBenefit * Math.pow(1 + colaRate, years);
}

/**
 * Calculate spousal benefit
 * @param spousePIA Spouse's own PIA
 * @param workerPIA Working spouse's PIA
 * @param claimAge Age when spousal benefit is claimed
 */
export function calculateSpousalBenefit(
  spousePIA: number,
  workerPIA: number,
  claimAge: number,
  fullRetirementAge: number = 67
): number {
  // Spousal benefit is up to 50% of worker's PIA
  const maxSpousalBenefit = workerPIA * 0.5;
  
  // If spouse's own benefit is higher, they get their own
  if (spousePIA >= maxSpousalBenefit) {
    return 0; // No spousal benefit (they'll get their own)
  }
  
  // Calculate spousal benefit (difference between max spousal and own benefit)
  let spousalBenefit = maxSpousalBenefit - spousePIA;
  
  // Apply reduction if claiming before FRA
  if (claimAge < fullRetirementAge) {
    const monthsEarly = (fullRetirementAge - claimAge) * 12;
    const reduction = monthsEarly * (25/36 * 0.01); // Spousal reduction factor
    spousalBenefit *= (1 - reduction);
  }
  
  return Math.round(spousalBenefit);
}

/**
 * Calculate survivor benefit
 * @param deceasedBenefit Deceased spouse's benefit
 * @param survivorOwnBenefit Survivor's own benefit
 */
export function calculateSurvivorBenefit(
  deceasedBenefit: number,
  survivorOwnBenefit: number
): number {
  // Survivor gets the higher of their own benefit or deceased's benefit
  return Math.max(deceasedBenefit, survivorOwnBenefit);
}

/**
 * Estimate Social Security replacement rate based on income level
 * This provides a quick approximation without full calculation
 * @param monthlyIncome Current monthly income
 */
export function estimateReplacementRate(monthlyIncome: number): number {
  const annualIncome = monthlyIncome * 12;
  
  if (annualIncome < 30000) {
    return 0.75; // ~75% for very low earners
  } else if (annualIncome < 50000) {
    return 0.50; // ~50% for low earners
  } else if (annualIncome < 75000) {
    return 0.40; // ~40% for median earners
  } else if (annualIncome < 125000) {
    return 0.33; // ~33% for above-median earners
  } else if (annualIncome < SS_PARAMS_2025.maxTaxableIncome) {
    return 0.27; // ~27% for high earners
  } else {
    // For income above SS max, the replacement rate drops further
    const cappedIncome = SS_PARAMS_2025.maxTaxableIncome;
    const maxBenefit = SS_PARAMS_2025.maxMonthlyBenefit * 12;
    return maxBenefit / annualIncome;
  }
}