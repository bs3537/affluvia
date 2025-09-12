/**
 * Helper functions for converting Monte Carlo simulation to nominal dollars
 * This module provides functions to handle the conversion while maintaining backward compatibility
 */
import { applyInflation, realToNominalReturn, applySocialSecurityCOLA, discountToPresent, DEFAULT_INFLATION_RATES } from './inflation-utils.ts';
/**
 * Get inflation rates from params or use defaults
 */
export function getInflationRates(params) {
    return {
        general: params.generalInflationRate ?? params.inflationRate ?? DEFAULT_INFLATION_RATES.general,
        healthcare: params.healthcareInflationRate ?? DEFAULT_INFLATION_RATES.healthcare,
        education: params.educationInflationRate ?? DEFAULT_INFLATION_RATES.education,
        socialSecurity: params.socialSecurityCOLARate ?? params.inflationRate ?? DEFAULT_INFLATION_RATES.socialSecurity
    };
}
/**
 * Check if we should use nominal dollars (default: true for new implementation)
 */
export function shouldUseNominalDollars(params) {
    // Baseline: run in real (today's) dollars by default.
    // Use nominal dollars only if explicitly requested by the caller.
    return params.useNominalDollars === true;
}
/**
 * Check if we should display in today's dollars (default: true)
 */
export function shouldDisplayInTodaysDollars(params) {
    // Default to today's dollars for display unless explicitly set to false
    return params.displayInTodaysDollars !== false;
}
/**
 * Convert real return to nominal if needed
 */
export function getAdjustedReturn(realReturn, inflationRate, useNominal) {
    if (useNominal) {
        return realToNominalReturn(realReturn, inflationRate);
    }
    return realReturn;
}
/**
 * Apply inflation to expenses based on year and category
 */
export function getInflatedExpenses(baseExpenses, healthcareExpenses, year, inflationRates, useNominal) {
    if (!useNominal) {
        // Real dollar mode - no inflation adjustment
        return {
            total: baseExpenses + healthcareExpenses,
            general: baseExpenses,
            healthcare: healthcareExpenses
        };
    }
    // Nominal dollar mode - apply inflation
    const inflatedGeneral = applyInflation(baseExpenses, inflationRates.general, year);
    const inflatedHealthcare = applyInflation(healthcareExpenses, inflationRates.healthcare, year);
    return {
        total: inflatedGeneral + inflatedHealthcare,
        general: inflatedGeneral,
        healthcare: inflatedHealthcare
    };
}
/**
 * Apply COLA to Social Security benefits
 */
export function getInflatedSocialSecurity(baseBenefit, year, colaRate, useNominal) {
    if (!useNominal) {
        return baseBenefit;
    }
    return applySocialSecurityCOLA(baseBenefit, colaRate, year);
}
/**
 * Apply inflation to guaranteed income (pensions, annuities)
 */
export function getInflatedGuaranteedIncome(baseIncome, year, inflationRate, useNominal, hasCOLA = false) {
    if (!useNominal || !hasCOLA) {
        return baseIncome;
    }
    return applyInflation(baseIncome, inflationRate, year);
}
/**
 * Convert nominal results to today's dollars for display
 */
export function convertResultsForDisplay(nominalValue, year, inflationRate, displayInTodaysDollars) {
    if (!displayInTodaysDollars) {
        return nominalValue;
    }
    return discountToPresent(nominalValue, inflationRate, year);
}
/**
 * Convert entire cash flow projection for display
 */
export function convertCashFlowsForDisplay(cashFlows, inflationRate, displayInTodaysDollars) {
    if (!displayInTodaysDollars) {
        return cashFlows;
    }
    return cashFlows.map(cf => ({
        ...cf,
        portfolioBalance: discountToPresent(cf.portfolioBalance, inflationRate, cf.year - 1),
        withdrawal: cf.withdrawal ? discountToPresent(cf.withdrawal, inflationRate, cf.year - 1) : cf.withdrawal,
        guaranteedIncome: cf.guaranteedIncome ? discountToPresent(cf.guaranteedIncome, inflationRate, cf.year - 1) : cf.guaranteedIncome
    }));
}
/**
 * Adjust tax brackets for inflation
 */
export function getInflatedTaxBrackets(baseBrackets, year, inflationRate, useNominal) {
    if (!useNominal) {
        return baseBrackets;
    }
    return baseBrackets.map(bracket => applyInflation(bracket, inflationRate, year));
}
/**
 * Calculate withdrawal amount considering inflation
 */
export function calculateNominalWithdrawal(realWithdrawalNeeded, year, inflationRate, useNominal) {
    if (!useNominal) {
        return realWithdrawalNeeded;
    }
    return applyInflation(realWithdrawalNeeded, inflationRate, year);
}
