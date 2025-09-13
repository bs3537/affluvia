// Wage Growth Modeling - 4% Historical Average
// Based on 25-year historical data for wage growth in retirement planning

/**
 * Calculate future wage/salary with compound annual growth
 * Based on historical average wage growth of 4% per year over the last 25 years
 */
export function calculateFutureWage(
  currentWage: number,
  yearsInFuture: number,
  annualGrowthRate: number = 0.04 // 4% historical average
): number {
  if (yearsInFuture <= 0) {
    return currentWage;
  }
  
  // Apply compound annual growth
  return currentWage * Math.pow(1 + annualGrowthRate, yearsInFuture);
}

/**
 * Calculate progressive wage growth with career stage adjustments
 * Early career: Higher growth (5-6%)
 * Mid career: Moderate growth (4%)
 * Late career: Lower growth (2-3%)
 */
export function calculateProgressiveWageGrowth(
  currentWage: number,
  currentAge: number,
  targetAge: number,
  baseGrowthRate: number = 0.04
): number {
  if (targetAge <= currentAge) {
    return currentWage;
  }
  
  let projectedWage = currentWage;
  
  for (let age = currentAge; age < targetAge; age++) {
    let yearlyGrowthRate = baseGrowthRate;
    
    // Adjust growth rate based on career stage
    if (age < 30) {
      // Early career: Higher growth potential
      yearlyGrowthRate = baseGrowthRate * 1.25; // 5% for 4% base
    } else if (age < 45) {
      // Mid career: Standard growth
      yearlyGrowthRate = baseGrowthRate; // 4%
    } else if (age < 55) {
      // Late mid career: Slightly reduced growth
      yearlyGrowthRate = baseGrowthRate * 0.875; // 3.5% for 4% base
    } else {
      // Pre-retirement: Minimal growth
      yearlyGrowthRate = baseGrowthRate * 0.625; // 2.5% for 4% base
    }
    
    projectedWage *= (1 + yearlyGrowthRate);
  }
  
  return projectedWage;
}

/**
 * Calculate annual savings with wage growth
 * Maintains constant savings rate as wages grow
 */
export function calculateFutureSavings(
  currentSavings: number,
  currentWage: number,
  savingsRate: number, // As decimal (0.15 for 15%)
  yearsInFuture: number,
  wageGrowthRate: number = 0.04
): number {
  if (yearsInFuture <= 0 || currentWage <= 0) {
    return currentSavings;
  }
  
  const futureWage = calculateFutureWage(currentWage, yearsInFuture, wageGrowthRate);
  return futureWage * savingsRate;
}

/**
 * Calculate Social Security AIME with wage growth
 * Incorporates wage growth into career earnings for accurate SS benefit calculations
 */
export function calculateAIMEWithWageGrowth(
  currentAge: number,
  currentAnnualWage: number,
  projectedRetirementAge: number = 67,
  wageGrowthRate: number = 0.04,
  careersStartAge: number = 22
): number {
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - currentAge;
  const retirementYear = birthYear + projectedRetirementAge;
  
  // Calculate wage history with growth
  const wageHistory: { year: number; wage: number }[] = [];
  
  // Historical wages (approximate using current wage and reverse growth)
  for (let age = careersStartAge; age < currentAge; age++) {
    const yearsFromNow = currentAge - age;
    const historicalWage = currentAnnualWage / Math.pow(1 + wageGrowthRate, yearsFromNow);
    wageHistory.push({
      year: birthYear + age,
      wage: historicalWage
    });
  }
  
  // Current and future wages (until retirement)
  for (let age = currentAge; age < Math.min(projectedRetirementAge, 67); age++) {
    const yearsInFuture = age - currentAge;
    const futureWage = calculateFutureWage(currentAnnualWage, yearsInFuture, wageGrowthRate);
    wageHistory.push({
      year: birthYear + age,
      wage: futureWage
    });
  }
  
  // Apply Social Security wage base limits and calculate AIME
  // SS wage base for 2025: $168,600 (grows with National Average Wage Index)
  const ssWageBaseGrowthRate = 0.035; // Approximate historical growth
  let totalIndexedEarnings = 0;
  let yearsOfEarnings = 0;
  
  wageHistory.forEach((entry, index) => {
    const currentSSWageBase = 168600 * Math.pow(1 + ssWageBaseGrowthRate, entry.year - 2025);
    const cappedWage = Math.min(entry.wage, currentSSWageBase);
    
    // For AIME calculation, use the wage (simplified - real AIME uses indexing factors)
    if (cappedWage > 0) {
      totalIndexedEarnings += cappedWage;
      yearsOfEarnings++;
    }
  });
  
  // AIME uses highest 35 years of earnings
  const yearsForAIME = Math.min(35, yearsOfEarnings);
  const monthlyAIME = (totalIndexedEarnings / yearsForAIME) / 12;
  
  return monthlyAIME;
}

/**
 * Project household income with dual wage earners
 */
export function calculateHouseholdIncomeGrowth(
  userCurrentIncome: number,
  spouseCurrentIncome: number,
  userCurrentAge: number,
  spouseCurrentAge: number,
  yearsInFuture: number,
  wageGrowthRate: number = 0.04
): {
  userFutureIncome: number;
  spouseFutureIncome: number;
  totalHouseholdIncome: number;
  householdIncomeGrowth: number;
} {
  const userFutureIncome = calculateProgressiveWageGrowth(
    userCurrentIncome,
    userCurrentAge,
    userCurrentAge + yearsInFuture,
    wageGrowthRate
  );
  
  const spouseFutureIncome = spouseCurrentIncome > 0 ? calculateProgressiveWageGrowth(
    spouseCurrentIncome,
    spouseCurrentAge,
    spouseCurrentAge + yearsInFuture,
    wageGrowthRate
  ) : 0;
  
  const currentHouseholdIncome = userCurrentIncome + spouseCurrentIncome;
  const futureHouseholdIncome = userFutureIncome + spouseFutureIncome;
  const householdIncomeGrowth = futureHouseholdIncome / currentHouseholdIncome - 1;
  
  return {
    userFutureIncome,
    spouseFutureIncome,
    totalHouseholdIncome: futureHouseholdIncome,
    householdIncomeGrowth
  };
}

/**
 * Calculate maximum retirement contributions based on future wages
 * Combines wage growth with contribution limit growth
 */
export function calculateMaxRetirementContributions(
  currentIncome: number,
  currentAge: number,
  targetYear: number,
  currentYear: number = 2025,
  wageGrowthRate: number = 0.04,
  savingsRate: number = 0.15 // 15% of income
): {
  futureIncome: number;
  maxPossibleSavings: number;
  recommendedSavings: number;
} {
  const yearsInFuture = targetYear - currentYear;
  const futureIncome = calculateProgressiveWageGrowth(
    currentIncome,
    currentAge,
    currentAge + yearsInFuture,
    wageGrowthRate
  );
  
  const maxPossibleSavings = futureIncome * 0.30; // Theoretical max: 30% of income
  const recommendedSavings = futureIncome * savingsRate;
  
  return {
    futureIncome,
    maxPossibleSavings,
    recommendedSavings
  };
}