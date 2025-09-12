/**
 * Dynamic Mortality Tables for Monte Carlo Simulations
 * 
 * Implements age-specific mortality probabilities based on:
 * - Social Security Administration Period Life Table 2021
 * - Health status adjustments
 * - Gender differences
 */

import { type RandomSource, RNG, deriveRNG } from './rng.ts';

export interface MortalityParams {
  currentAge: number;
  gender?: 'male' | 'female';
  healthStatus?: 'excellent' | 'good' | 'fair' | 'poor';
}

// SSA 2021 Period Life Table - Probability of dying within 1 year (qx)
// Source: https://www.ssa.gov/oact/STATS/table4c6.html
const BASE_MORTALITY_RATES: { [age: number]: { male: number; female: number } } = {
  50: { male: 0.004186, female: 0.002634 },
  51: { male: 0.004530, female: 0.002838 },
  52: { male: 0.004912, female: 0.003071 },
  53: { male: 0.005346, female: 0.003344 },
  54: { male: 0.005838, female: 0.003658 },
  55: { male: 0.006390, female: 0.004005 },
  56: { male: 0.006993, female: 0.004379 },
  57: { male: 0.007646, female: 0.004780 },
  58: { male: 0.008359, female: 0.005217 },
  59: { male: 0.009147, female: 0.005710 },
  60: { male: 0.010028, female: 0.006283 },
  61: { male: 0.010998, female: 0.006920 },
  62: { male: 0.012047, female: 0.007610 },
  63: { male: 0.013168, female: 0.008351 },
  64: { male: 0.014366, female: 0.009154 },
  65: { male: 0.015651, female: 0.010035 },
  66: { male: 0.017030, female: 0.010998 },
  67: { male: 0.018506, female: 0.012049 },
  68: { male: 0.020088, female: 0.013201 },
  69: { male: 0.021791, female: 0.014477 },
  70: { male: 0.023640, female: 0.015901 },
  71: { male: 0.025660, female: 0.017483 },
  72: { male: 0.027872, female: 0.019230 },
  73: { male: 0.030275, female: 0.021139 },
  74: { male: 0.032884, female: 0.023216 },
  75: { male: 0.035746, female: 0.025490 },
  76: { male: 0.038921, female: 0.027998 },
  77: { male: 0.042465, female: 0.030774 },
  78: { male: 0.046414, female: 0.033834 },
  79: { male: 0.050799, female: 0.037189 },
  80: { male: 0.055651, female: 0.040853 },
  81: { male: 0.061000, female: 0.044842 },
  82: { male: 0.066875, female: 0.049174 },
  83: { male: 0.073305, female: 0.053870 },
  84: { male: 0.080319, female: 0.058954 },
  85: { male: 0.087945, female: 0.064449 },
  86: { male: 0.096211, female: 0.070379 },
  87: { male: 0.105145, female: 0.076770 },
  88: { male: 0.114772, female: 0.083647 },
  89: { male: 0.125116, female: 0.091037 },
  90: { male: 0.136200, female: 0.098966 },
  91: { male: 0.148046, female: 0.107461 },
  92: { male: 0.160674, female: 0.116549 },
  93: { male: 0.174102, female: 0.126257 },
  94: { male: 0.188348, female: 0.136613 },
  95: { male: 0.203426, female: 0.147644 },
  96: { male: 0.219352, female: 0.159378 },
  97: { male: 0.236136, female: 0.171842 },
  98: { male: 0.253789, female: 0.185064 },
  99: { male: 0.272320, female: 0.199071 },
  100: { male: 0.291735, female: 0.213890 },
  101: { male: 0.312043, female: 0.229548 },
  102: { male: 0.333249, female: 0.246073 },
  103: { male: 0.355359, female: 0.263492 },
  104: { male: 0.378378, female: 0.281832 },
  105: { male: 0.402310, female: 0.301122 },
  106: { male: 0.427159, female: 0.321389 },
  107: { male: 0.452928, female: 0.342661 },
  108: { male: 0.479619, female: 0.364966 },
  109: { male: 0.507236, female: 0.388332 },
  110: { male: 0.535782, female: 0.412788 },
  111: { male: 0.565256, female: 0.438361 },
  112: { male: 0.595662, female: 0.465082 },
  113: { male: 0.627001, female: 0.492978 },
  114: { male: 0.659274, female: 0.522080 },
  115: { male: 0.692482, female: 0.552418 },
  116: { male: 0.726625, female: 0.584022 },
  117: { male: 0.761705, female: 0.616923 },
  118: { male: 0.797720, female: 0.651152 },
  119: { male: 0.834672, female: 0.686741 },
  120: { male: 1.000000, female: 1.000000 }
};

// Health adjustment factors (multiplicative)
const HEALTH_ADJUSTMENTS = {
  excellent: 0.7,  // 30% lower mortality
  good: 1.0,       // baseline
  fair: 1.5,       // 50% higher mortality
  poor: 2.2        // 120% higher mortality
};

/**
 * Get the annual mortality rate (qx) for a given age, gender, and health status
 */
export function getAnnualMortalityRate(params: MortalityParams): number {
  const { currentAge, gender = 'male', healthStatus = 'good' } = params;
  
  // Find the appropriate age in the table
  let age = Math.round(currentAge);
  if (age < 50) age = 50;
  if (age > 120) return 1.0; // Certain death beyond 120
  
  // Get base mortality rate
  const baseMortality = BASE_MORTALITY_RATES[age]?.[gender] || 
    BASE_MORTALITY_RATES[120][gender];
  
  // Apply health adjustment
  const adjustedMortality = baseMortality * HEALTH_ADJUSTMENTS[healthStatus];
  
  // Cap at 1.0 (certain death)
  return Math.min(1.0, adjustedMortality);
}

/**
 * Calculate the probability of surviving from current age to target age
 */
export function getSurvivalProbability(
  currentAge: number,
  targetAge: number,
  gender?: 'male' | 'female',
  healthStatus?: 'excellent' | 'good' | 'fair' | 'poor'
): number {
  if (targetAge <= currentAge) return 1.0;
  
  let survivalProb = 1.0;
  
  for (let age = Math.round(currentAge); age < Math.round(targetAge); age++) {
    const mortalityRate = getAnnualMortalityRate({ 
      currentAge: age, 
      gender, 
      healthStatus 
    });
    survivalProb *= (1 - mortalityRate);
  }
  
  return survivalProb;
}

/**
 * Calculate life expectancy using dynamic mortality tables
 */
export function calculateLifeExpectancy(params: MortalityParams): number {
  const { currentAge, gender, healthStatus } = params;
  
  let totalYears = 0;
  let cumulativeSurvival = 1.0;
  
  // Calculate expected years of life remaining
  for (let futureAge = currentAge + 1; futureAge <= 120; futureAge++) {
    const survivalToAge = getSurvivalProbability(
      currentAge,
      futureAge,
      gender,
      healthStatus
    );
    
    // Probability of dying in this specific year
    const mortalityThisYear = cumulativeSurvival - survivalToAge;
    
    // Add fractional year (0.5 for dying mid-year)
    totalYears += mortalityThisYear * 0.5;
    
    // Update cumulative survival
    cumulativeSurvival = survivalToAge;
    
    // Add full year if surviving
    if (futureAge < 120) {
      totalYears += survivalToAge;
    }
  }
  
  return Math.round(currentAge + totalYears);
}

/**
 * Simulate whether a person survives one year based on mortality rate
 * Returns true if survives, false if dies
 */
export function simulateSurvival(params: MortalityParams, rng?: RandomSource): boolean {
  const mortalityRate = getAnnualMortalityRate(params);
  const rrng = deriveRNG(rng, 'mortality', Math.round(params.currentAge || 0));
  const rand = rrng.next();
  return rand > mortalityRate;
}

/**
 * For couples, simulate joint survival
 */
export function simulateCouplesSurvival(
  userParams: MortalityParams,
  spouseParams: MortalityParams,
  rng?: RandomSource
): { userSurvives: boolean; spouseSurvives: boolean; eitherSurvives: boolean } {
  const userSurvives = simulateSurvival(userParams, rng);
  const spouseSurvives = simulateSurvival(spouseParams, rng);
  
  return {
    userSurvives,
    spouseSurvives,
    eitherSurvives: userSurvives || spouseSurvives
  };
}

/**
 * Get percentile life expectancy (e.g., 10% chance of living to this age)
 */
export function getPercentileLifeExpectancy(
  params: MortalityParams,
  percentile: number
): number {
  const { currentAge, gender, healthStatus } = params;
  
  for (let age = currentAge + 1; age <= 120; age++) {
    const survivalProb = getSurvivalProbability(
      currentAge,
      age,
      gender,
      healthStatus
    );
    
    if (survivalProb <= percentile / 100) {
      return age - 1;
    }
  }
  
  return 120;
}
