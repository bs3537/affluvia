/**
 * Inflation utilities for converting between real and nominal dollars
 * Used in Monte Carlo simulations and financial projections
 */

export interface InflationRates {
  general: number;          // General CPI inflation (default 2.5%)
  healthcare: number;        // Healthcare inflation (default 4.5%)
  education: number;         // Education inflation (default 5%)
  socialSecurity: number;    // Social Security COLA (typically matches CPI)
}

export interface NominalDollarParams {
  inflationRates: InflationRates;
  useNominalDollars: boolean;  // Toggle for nominal vs real dollar calculations
  displayInTodaysDollars: boolean;  // Toggle for display purposes only
}

/**
 * Apply inflation to a value over a number of years
 * @param value - Initial value
 * @param inflationRate - Annual inflation rate (e.g., 0.025 for 2.5%)
 * @param years - Number of years to compound
 * @returns Inflated value
 */
export function applyInflation(value: number, inflationRate: number, years: number): number {
  return value * Math.pow(1 + inflationRate, years);
}

/**
 * Discount future nominal dollars to present value
 * @param futureValue - Future nominal dollar amount
 * @param discountRate - Discount rate (typically inflation rate)
 * @param years - Number of years in the future
 * @returns Present value in today's dollars
 */
export function discountToPresent(futureValue: number, discountRate: number, years: number): number {
  return futureValue / Math.pow(1 + discountRate, years);
}

/**
 * Convert real return to nominal return
 * Fisher equation: (1 + nominal) = (1 + real) × (1 + inflation)
 * @param realReturn - Real return rate
 * @param inflationRate - Inflation rate
 * @returns Nominal return rate
 */
export function realToNominalReturn(realReturn: number, inflationRate: number): number {
  return (1 + realReturn) * (1 + inflationRate) - 1;
}

/**
 * Convert nominal return to real return
 * @param nominalReturn - Nominal return rate
 * @param inflationRate - Inflation rate
 * @returns Real return rate
 */
export function nominalToRealReturn(nominalReturn: number, inflationRate: number): number {
  return (1 + nominalReturn) / (1 + inflationRate) - 1;
}

/**
 * Apply category-specific inflation to expenses
 * @param expenses - Base expenses object
 * @param inflationRates - Inflation rates by category
 * @param years - Number of years to project
 * @returns Inflated expenses
 */
export function inflateExpenses(
  expenses: {
    general: number;
    healthcare: number;
    other?: number;
  },
  inflationRates: InflationRates,
  years: number
): {
  general: number;
  healthcare: number;
  other: number;
  total: number;
} {
  const inflatedGeneral = applyInflation(expenses.general, inflationRates.general, years);
  const inflatedHealthcare = applyInflation(expenses.healthcare, inflationRates.healthcare, years);
  const inflatedOther = applyInflation(expenses.other || 0, inflationRates.general, years);
  
  return {
    general: inflatedGeneral,
    healthcare: inflatedHealthcare,
    other: inflatedOther,
    total: inflatedGeneral + inflatedHealthcare + inflatedOther
  };
}

/**
 * Apply COLA adjustment to Social Security benefits
 * @param baseBenefit - Base Social Security benefit
 * @param colaRate - COLA adjustment rate (typically matches CPI)
 * @param years - Number of years to project
 * @returns Adjusted benefit
 */
export function applySocialSecurityCOLA(
  baseBenefit: number,
  colaRate: number,
  years: number
): number {
  return applyInflation(baseBenefit, colaRate, years);
}

/**
 * Index tax brackets for inflation
 * @param brackets - Tax bracket thresholds
 * @param inflationRate - Inflation rate for indexing
 * @param years - Number of years to project
 * @returns Indexed tax brackets
 */
export function indexTaxBrackets(
  brackets: number[],
  inflationRate: number,
  years: number
): number[] {
  return brackets.map(threshold => applyInflation(threshold, inflationRate, years));
}

/**
 * Convert an entire projection from nominal to today's dollars for display
 * @param nominalProjection - Array of nominal dollar values by year
 * @param inflationRate - Inflation rate for discounting
 * @returns Array of present value amounts
 */
export function convertProjectionToTodaysDollars(
  nominalProjection: number[],
  inflationRate: number
): number[] {
  return nominalProjection.map((value, yearIndex) => 
    discountToPresent(value, inflationRate, yearIndex)
  );
}

/**
 * Default inflation rates based on historical averages
 */
export const DEFAULT_INFLATION_RATES: InflationRates = {
  general: 0.025,        // 2.5% CPI
  healthcare: 0.045,     // 4.5% healthcare inflation
  education: 0.05,       // 5% education inflation
  socialSecurity: 0.025  // Typically matches CPI
};

/**
 * Get inflation rate for a specific expense category
 */
export function getCategoryInflationRate(
  category: 'general' | 'healthcare' | 'education' | 'socialSecurity',
  rates: InflationRates = DEFAULT_INFLATION_RATES
): number {
  return rates[category];
}