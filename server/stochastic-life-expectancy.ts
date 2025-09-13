/**
 * Stochastic Life Expectancy Modeling
 * 
 * This module implements stochastic (randomized) life expectancy for Monte Carlo simulations
 * to better capture longevity risk in retirement planning.
 * 
 * Distribution:
 * - 25% of simulations: End at age 85-90 (early mortality)
 * - 50% of simulations: End at age 91-95 (median range)
 * - 25% of simulations: End at age 96-100+ (longevity tail risk)
 */

import { type RandomSource, RNG, deriveRNG } from './rng.ts';

export interface StochasticLifeExpectancyParams {
  baseLifeExpectancy: number;  // The user's input or health-adjusted life expectancy
  currentAge: number;          // Current age of the person
  gender?: 'male' | 'female';  // Optional gender for more accurate modeling
  healthAdjustment?: number;   // Additional years based on health status
}

/**
 * Generates a stochastic life expectancy based on the input parameters
 * Uses a distribution that captures realistic mortality patterns
 */
export function generateStochasticLifeExpectancy(params: StochasticLifeExpectancyParams, rng?: RandomSource): number {
  const { baseLifeExpectancy, currentAge, gender, healthAdjustment = 0 } = params;
  
  // Generate a random number between 0 and 1
  const rrng = deriveRNG(rng, 'lifeexp-single', currentAge);
  const random = rrng.next();
  
  // Define the distribution ranges based on the base life expectancy
  // We'll use the base as the median and distribute around it
  let stochasticAge: number;
  
  if (random < 0.25) {
    // 25% chance: Early mortality (base - 8 to base - 3 years)
    // This represents the lower quartile who may face health challenges
    const minAge = Math.max(currentAge + 5, baseLifeExpectancy - 8); // At least 5 years from now
    const maxAge = baseLifeExpectancy - 3;
    stochasticAge = minAge + rrng.next() * (maxAge - minAge);
  } else if (random < 0.75) {
    // 50% chance: Median range (base - 2 to base + 2 years)
    // This represents the typical life expectancy range
    const minAge = baseLifeExpectancy - 2;
    const maxAge = baseLifeExpectancy + 2;
    stochasticAge = minAge + rrng.next() * (maxAge - minAge);
  } else {
    // 25% chance: Longevity tail risk (base + 3 to base + 7 years)
    // This represents those who live significantly longer than expected
    const minAge = baseLifeExpectancy + 3;
    const maxAge = Math.min(baseLifeExpectancy + 7, 105); // Cap at 105
    stochasticAge = minAge + rrng.next() * (maxAge - minAge);
  }
  
  // Apply gender adjustment if provided (women typically live ~3 years longer)
  if (gender === 'female') {
    stochasticAge += 1.5;
  } else if (gender === 'male') {
    stochasticAge -= 1.5;
  }
  
  // Apply health adjustment
  stochasticAge += healthAdjustment;
  
  // Ensure reasonable bounds
  const minLifeExpectancy = Math.max(currentAge + 1, 70); // At least 1 year from now, minimum 70
  const maxLifeExpectancy = 105; // Maximum human lifespan cap
  
  return Math.round(Math.max(minLifeExpectancy, Math.min(maxLifeExpectancy, stochasticAge)));
}

/**
 * For married couples, generates correlated life expectancies
 * Spouse lifespans are typically correlated (correlation ~0.3-0.5)
 */
export function generateCouplesStochasticLifeExpectancy(
  userParams: StochasticLifeExpectancyParams,
  spouseParams: StochasticLifeExpectancyParams,
  correlation: number = 0.4,
  rng?: RandomSource
): { userLifeExpectancy: number; spouseLifeExpectancy: number } {
  // Generate independent random values
  const rrng = deriveRNG(rng, 'lifeexp-couple', userParams.currentAge);
  const userRandom = rrng.next();
  const spouseIndependentRandom = rrng.next();
  
  // Create correlated random value for spouse
  const spouseRandom = correlation * userRandom + (1 - correlation) * spouseIndependentRandom;
  
  // Use the same logic but with correlated randoms
  const userLife = generateStochasticLifeExpectancyWithRandom(userParams, userRandom, rrng);
  const spouseLife = generateStochasticLifeExpectancyWithRandom(spouseParams, spouseRandom, rrng);
  
  return {
    userLifeExpectancy: userLife,
    spouseLifeExpectancy: spouseLife
  };
}

/**
 * Internal function that accepts a specific random value
 * Used for creating correlated life expectancies
 */
function generateStochasticLifeExpectancyWithRandom(
  params: StochasticLifeExpectancyParams,
  random: number,
  rng?: RandomSource
): number {
  const { baseLifeExpectancy, currentAge, gender, healthAdjustment = 0 } = params;
  const rrng = deriveRNG(rng, 'lifeexp-withrandom', params.currentAge);
  
  let stochasticAge: number;
  
  if (random < 0.25) {
    const minAge = Math.max(currentAge + 5, baseLifeExpectancy - 8);
    const maxAge = baseLifeExpectancy - 3;
    stochasticAge = minAge + rrng.next() * (maxAge - minAge);
  } else if (random < 0.75) {
    const minAge = baseLifeExpectancy - 2;
    const maxAge = baseLifeExpectancy + 2;
    stochasticAge = minAge + rrng.next() * (maxAge - minAge);
  } else {
    const minAge = baseLifeExpectancy + 3;
    const maxAge = Math.min(baseLifeExpectancy + 7, 105);
    stochasticAge = minAge + rrng.next() * (maxAge - minAge);
  }
  
  if (gender === 'female') {
    stochasticAge += 1.5;
  } else if (gender === 'male') {
    stochasticAge -= 1.5;
  }
  
  stochasticAge += healthAdjustment;
  
  const minLifeExpectancy = Math.max(currentAge + 1, 70);
  const maxLifeExpectancy = 105;
  
  return Math.round(Math.max(minLifeExpectancy, Math.min(maxLifeExpectancy, stochasticAge)));
}

/**
 * Utility function to analyze the distribution of life expectancies
 * Useful for testing and validation
 */
export function analyzeLifeExpectancyDistribution(
  params: StochasticLifeExpectancyParams,
  iterations: number = 1000
): {
  mean: number;
  median: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
  min: number;
  max: number;
} {
  const results: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    results.push(generateStochasticLifeExpectancy(params));
  }
  
  results.sort((a, b) => a - b);
  
  return {
    mean: results.reduce((a, b) => a + b, 0) / results.length,
    median: results[Math.floor(results.length / 2)],
    percentile25: results[Math.floor(results.length * 0.25)],
    percentile75: results[Math.floor(results.length * 0.75)],
    percentile90: results[Math.floor(results.length * 0.90)],
    min: results[0],
    max: results[results.length - 1]
  };
}
