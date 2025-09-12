// Wage Growth Modeling - 4% Historical Average
// Based on 25-year historical data for wage growth in retirement planning
/**
 * Calculate future wage/salary with compound annual growth
 * Based on historical average wage growth of 4% per year over the last 25 years
 */
export function calculateFutureWage(currentWage, yearsInFuture, annualGrowthRate = 0.04 // 4% historical average
) {
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
export function calculateProgressiveWageGrowth(currentWage, currentAge, targetAge, baseGrowthRate = 0.04) {
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
        }
        else if (age < 45) {
            // Mid career: Standard growth
            yearlyGrowthRate = baseGrowthRate; // 4%
        }
        else if (age < 55) {
            // Late mid career: Slightly reduced growth
            yearlyGrowthRate = baseGrowthRate * 0.875; // 3.5% for 4% base
        }
        else {
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
export function calculateFutureSavings(currentSavings, currentWage, savingsRate, // As decimal (0.15 for 15%)
yearsInFuture, wageGrowthRate = 0.04) {
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
export function calculateAIMEWithWageGrowth(currentAge, currentAnnualWage, projectedRetirementAge = 67, wageGrowthRate = 0.04, careersStartAge = 22) {
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - currentAge;
    const retirementYear = birthYear + projectedRetirementAge;
    // Calculate wage history with growth
    const wageHistory = [];
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
export function calculateHouseholdIncomeGrowth(userCurrentIncome, spouseCurrentIncome, userCurrentAge, spouseCurrentAge, yearsInFuture, wageGrowthRate = 0.04) {
    const userFutureIncome = calculateProgressiveWageGrowth(userCurrentIncome, userCurrentAge, userCurrentAge + yearsInFuture, wageGrowthRate);
    const spouseFutureIncome = spouseCurrentIncome > 0 ? calculateProgressiveWageGrowth(spouseCurrentIncome, spouseCurrentAge, spouseCurrentAge + yearsInFuture, wageGrowthRate) : 0;
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
export function calculateMaxRetirementContributions(currentIncome, currentAge, targetYear, currentYear = 2025, wageGrowthRate = 0.04, savingsRate = 0.15 // 15% of income
) {
    const yearsInFuture = targetYear - currentYear;
    const futureIncome = calculateProgressiveWageGrowth(currentIncome, currentAge, currentAge + yearsInFuture, wageGrowthRate);
    const maxPossibleSavings = futureIncome * 0.30; // Theoretical max: 30% of income
    const recommendedSavings = futureIncome * savingsRate;
    return {
        futureIncome,
        maxPossibleSavings,
        recommendedSavings
    };
}
