/**
 * Helper functions for converting Monte Carlo simulation to nominal dollars
 * This module provides functions to handle the conversion while maintaining backward compatibility
 */

import { 
  applyInflation, 
  realToNominalReturn,
  applySocialSecurityCOLA,
  inflateExpenses,
  discountToPresent,
  DEFAULT_INFLATION_RATES
} from './inflation-utils.ts';
import type { InflationRates } from './inflation-utils.ts';
import type { RetirementMonteCarloParams } from './monte-carlo-base.ts';

/**
 * Get inflation rates from params or use defaults
 */
export function getInflationRates(params: RetirementMonteCarloParams): InflationRates {
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
export function shouldUseNominalDollars(params: RetirementMonteCarloParams): boolean {
  // Baseline: run in real (today's) dollars by default.
  // Use nominal dollars only if explicitly requested by the caller.
  return params.useNominalDollars === true;
}

/**
 * Check if we should display in today's dollars (default: true)
 */
export function shouldDisplayInTodaysDollars(params: RetirementMonteCarloParams): boolean {
  // Default to today's dollars for display unless explicitly set to false
  return params.displayInTodaysDollars !== false;
}

/**
 * Convert real return to nominal if needed
 */
export function getAdjustedReturn(
  realReturn: number,
  inflationRate: number,
  useNominal: boolean
): number {
  if (useNominal) {
    return realToNominalReturn(realReturn, inflationRate);
  }
  return realReturn;
}

/**
 * Apply inflation to expenses based on year and category
 */
export function getInflatedExpenses(
  baseExpenses: number,
  healthcareExpenses: number,
  year: number,
  inflationRates: InflationRates,
  useNominal: boolean
): { total: number; general: number; healthcare: number } {
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
export function getInflatedSocialSecurity(
  baseBenefit: number,
  year: number,
  colaRate: number,
  useNominal: boolean
): number {
  if (!useNominal) {
    return baseBenefit;
  }
  return applySocialSecurityCOLA(baseBenefit, colaRate, year);
}

/**
 * Apply inflation to guaranteed income (pensions, annuities)
 */
export function getInflatedGuaranteedIncome(
  baseIncome: number,
  year: number,
  inflationRate: number,
  useNominal: boolean,
  hasCOLA: boolean = false
): number {
  if (!useNominal || !hasCOLA) {
    return baseIncome;
  }
  return applyInflation(baseIncome, inflationRate, year);
}

/**
 * Convert nominal results to today's dollars for display
 */
export function convertResultsForDisplay(
  nominalValue: number,
  year: number,
  inflationRate: number,
  displayInTodaysDollars: boolean
): number {
  if (!displayInTodaysDollars) {
    return nominalValue;
  }
  return discountToPresent(nominalValue, inflationRate, year);
}

/**
 * Convert entire cash flow projection for display
 */
export function convertCashFlowsForDisplay(
  cashFlows: Array<{
    year: number;
    portfolioBalance: number;
    withdrawal?: number;
    guaranteedIncome?: number;
    [key: string]: any;
  }>,
  inflationRate: number,
  displayInTodaysDollars: boolean
): typeof cashFlows {
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
export function getInflatedTaxBrackets(
  baseBrackets: number[],
  year: number,
  inflationRate: number,
  useNominal: boolean
): number[] {
  if (!useNominal) {
    return baseBrackets;
  }
  return baseBrackets.map(bracket => applyInflation(bracket, inflationRate, year));
}

/**
 * Calculate withdrawal amount considering inflation
 */
export function calculateNominalWithdrawal(
  realWithdrawalNeeded: number,
  year: number,
  inflationRate: number,
  useNominal: boolean
): number {
  if (!useNominal) {
    return realWithdrawalNeeded;
  }
  return applyInflation(realWithdrawalNeeded, inflationRate, year);
}
