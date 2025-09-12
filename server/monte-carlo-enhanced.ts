// Enhanced Monte Carlo Simulation with Correlation Modeling and Advanced Strategies
import { Worker } from 'worker_threads';
import type { 
  RetirementMonteCarloParams, 
  RetirementMonteCarloResult
} from './monte-carlo-base.ts';
import type { AssetBuckets } from './asset-tax-classifier.ts';
import { RNG, AntitheticRNG, RecordingRNG, ReplayRNG, OverlayRNG, deriveRNG, type RandomSource } from './rng.ts';
import { 
  MonteCarloValidator, 
  ProbabilityUtils
} from './monte-carlo-validation.ts';
import type { ValidationResult } from './monte-carlo-validation.ts';
import {
  calculateAnnualContributionsWithLimits,
  getFutureContributionLimit
} from '../shared/retirement-contribution-limits.ts';
import {
  calculateFutureSavings,
  calculateProgressiveWageGrowth,
  calculateHouseholdIncomeGrowth
} from '../shared/wage-growth-modeling.ts';
import {
  getTaxConfig,
  calculateFederalTaxWithYear,
  calculateCapitalGainsTaxWithYear,
  calculateIRMAAWithYear
} from './tax-year-config.ts';
import {
  calculateStateTax,
  calculateCombinedTaxRate as calculateCombinedStateTaxRate
} from './state-tax-config.ts';

// Re-export commonly used functions from monte-carlo-base.ts to consolidate imports
export { 
  profileToRetirementParams,
  calculateEducationProjectionWithMonteCarlo
} from './monte-carlo-base.ts';

// Re-export types
export type { 
  RetirementMonteCarloParams,
  RetirementMonteCarloResult
} from './monte-carlo-base.ts';
import { 
  calculateTaxEfficientWithdrawal
} from './asset-tax-classifier.ts';
import { getActiveCMA, loadCMA } from './cma-config.ts';
import {
  generateStochasticLifeExpectancy,
  generateCouplesStochasticLifeExpectancy
} from './stochastic-life-expectancy.ts';
import type { StochasticLifeExpectancyParams } from './stochastic-life-expectancy.ts';
import {
  simulateSurvival,
  simulateCouplesSurvival
} from './mortality-tables.ts';
import type { MortalityParams } from './mortality-tables.ts';
import { modelLTCEvents, calculateLTCInsurancePremium } from './ltc-modeling.ts';
import type { LTCInsurancePolicy, LTCEvent, LTCModelingResult } from './ltc-modeling.ts';
import { calculateCombinedTaxRate } from './tax-calculator.ts';
import { calculateUnifiedTaxes } from './tax-unified.ts';
import { 
  applyInflation, 
  realToNominalReturn,
  applySocialSecurityCOLA,
  inflateExpenses,
  DEFAULT_INFLATION_RATES
} from './inflation-utils.ts';
import {
  getInflationRates,
  shouldUseNominalDollars,
  shouldDisplayInTodaysDollars,
  getAdjustedReturn,
  getInflatedExpenses,
  getInflatedSocialSecurity,
  convertCashFlowsForDisplay
} from './nominal-conversion-helpers.ts';

// Enhanced tax calculation interfaces
interface SocialSecurityTaxation {
  taxableAmount: number;
  taxablePercentage: number;
  provisionalIncome: number;
}

interface IRMAAResult {
  monthlyPartBPremium: number;
  monthlyPartDPremium: number;
  annualSurcharge: number;
  incomeBracket: string;
}

interface EnhancedWithdrawalResult {
  grossWithdrawal: number;
  netAfterTaxes: number;
  federalTax: number;
  stateTax: number;
  capitalGainsTax: number;
  totalTaxes: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  modifiedAGI: number;
  taxableSSBenefit: number;
  irmaaResult: IRMAAResult;
  requiredRMD: number;
  actualRMDWithdrawn: number;
}

// Enhanced Social Security taxation calculation
function calculateEnhancedSocialSecurityTaxation(
  grossSSBenefit: number, 
  otherIncome: number, 
  filingStatus: 'single' | 'married' | 'head_of_household'
): SocialSecurityTaxation {
  if (grossSSBenefit <= 0) {
    return { taxableAmount: 0, taxablePercentage: 0, provisionalIncome: 0 };
  }
  
  // Calculate provisional income (AGI + tax-exempt interest + 50% of SS benefits)
  const provisionalIncome = otherIncome + (grossSSBenefit * 0.5);
  
  // 2024 thresholds
  const singleLike = filingStatus === 'single' || filingStatus === 'head_of_household';
  const thresholds = singleLike ? 
    { first: 25000, second: 34000 } : 
    { first: 32000, second: 44000 };
  
  let taxablePercentage = 0;
  let taxableAmount = 0;
  
  if (provisionalIncome <= thresholds.first) {
    taxablePercentage = 0;
  } else if (provisionalIncome <= thresholds.second) {
    // Up to 50% taxable
    const excess = provisionalIncome - thresholds.first;
    taxableAmount = Math.min(excess * 0.5, grossSSBenefit * 0.5);
    taxablePercentage = taxableAmount / grossSSBenefit;
  } else {
    // Up to 85% taxable
    const firstTier = (thresholds.second - thresholds.first) * 0.5;
    const secondTier = (provisionalIncome - thresholds.second) * 0.85;
    taxableAmount = Math.min(firstTier + secondTier, grossSSBenefit * 0.85);
    taxablePercentage = Math.min(0.85, taxableAmount / grossSSBenefit);
  }
  
  return { taxableAmount, taxablePercentage, provisionalIncome };
}

// IRMAA (Income-Related Monthly Adjustment Amount) calculation
function calculateIRMAA(
  modifiedAGI: number, 
  filingStatus: 'single' | 'married' | 'head_of_household',
  taxItemization?: {
    useItemized?: boolean;
    saltPaid?: number;
    mortgageInterest?: number;
    charitableGifts?: number;
    medicalExpenses?: number;
    otherItemized?: number;
    qbiIncome?: number;
  },
  year: number = 2024
): IRMAAResult {
  // Delegate to the year-aware function from tax-year-config module
  const fs = (filingStatus === 'head_of_household') ? 'single' : filingStatus;
  const result = calculateIRMAAWithYear(modifiedAGI, fs, year);
  
  // Convert to IRMAAResult format for backward compatibility
  return {
    monthlyPartBPremium: result.partBPremium,
    monthlyPartDPremium: result.partDPremium,
    annualSurcharge: result.surcharge * 12,
    incomeBracket: result.bracketName
  };
}

// Calculate capital gains tax using year-aware tax brackets
export function calculateCapitalGainsTax(
  capitalGainsIncome: number,
  totalTaxableIncome: number,
  filingStatus: 'single' | 'married',
  year: number = 2024
): number {
  // Calculate ordinary income (for proper LTCG bracket determination)
  const ordinaryIncome = totalTaxableIncome - capitalGainsIncome;
  
  // Delegate to the year-aware function from tax-year-config module
  return calculateCapitalGainsTaxWithYear(capitalGainsIncome, ordinaryIncome, filingStatus, year);
}

// Calculate federal income tax using year-aware tax brackets
function calculateFederalTax(
  taxableIncome: number,
  filingStatus: 'single' | 'married',
  year: number = 2024
): number {
  // Delegate to the year-aware function from tax-year-config module
  return calculateFederalTaxWithYear(taxableIncome, filingStatus, year);
}

// Enhanced withdrawal calculation with iterative tax optimization
export function calculateEnhancedWithdrawal(
  netNeeded: number,
  buckets: AssetBuckets,
  totalSSBenefit: number,
  age: number,
  spouseAge: number | undefined,
  retirementState: string,
  filingStatus: 'single' | 'married' | 'head_of_household',
  taxItemization?: {
    useItemized?: boolean;
    saltPaid?: number;
    mortgageInterest?: number;
    charitableGifts?: number;
    medicalExpenses?: number;
    otherItemized?: number;
    qbiIncome?: number;
  },
  taxablePensionIncome: number = 0, // NEW: Include pension income
  earnedIncome: number = 0, // NEW: Include earned income
  magiFor2YearLookback: number | undefined = undefined, // NEW: MAGI from 2 years ago for IRMAA
  birthYear?: number, // NEW: For SECURE 2.0 RMD rules
  spouseBirthYear?: number, // NEW: For spouse RMD rules
  useCache: boolean = true,
  simulationYear: number = 2024, // NEW: Year for tax calculations
  acaInfo?: { aptcApplied: number; benchmarkAnnual: number; months: number; householdSize: number; state?: string },
  taxAdjustments?: { qcdApplied?: number },
  requiredRmdOverride?: number
): EnhancedWithdrawalResult {
  // Check cache first
  if (useCache) {
    const cacheKey = {
      netNeeded,
      taxDeferred: buckets.taxDeferred,
      taxFree: buckets.taxFree,
      capitalGains: buckets.capitalGains,
      totalSSBenefit,
      age,
      spouseAge,
      filingStatus,
      magiFor2YearLookback,
      birthYear,
      spouseBirthYear
    };
    
    const cached = globalCache.get<EnhancedWithdrawalResult>('withdrawal', cacheKey);
    if (cached) {
      return cached;
    }
  }
  // Step 1: Calculate RMDs
  // For couples, assume tax-deferred assets are split based on contribution history || 50/50
  const userTaxDeferred = spouseAge ? buckets.taxDeferred * 0.6 : buckets.taxDeferred; // User typically has 60% if married
  const spouseTaxDeferred = spouseAge ? buckets.taxDeferred * 0.4 : 0; // Spouse has 40% if applicable
  
  // Calculate birth years if not provided
  const currentYear = new Date().getFullYear();
  const userBirthYear = birthYear || (currentYear - age);
  const spouseBirthYearCalc = spouseBirthYear || (spouseAge ? currentYear - spouseAge : undefined);
  
  // Use SECURE 2.0 RMD rules
  const userRMD = calculateRMD(userTaxDeferred, age, userBirthYear, spouseAge, spouseBirthYearCalc);
  const spouseRMD = spouseAge ? calculateRMD(spouseTaxDeferred, spouseAge, spouseBirthYearCalc, age, userBirthYear) : 0;
  let totalRMD = userRMD + spouseRMD;
  if (requiredRmdOverride !== undefined) {
    totalRMD = requiredRmdOverride;
  }
  
  // Step 2: Calculate minimum withdrawal (greater of need || RMD)
  const minimumGrossNeeded = Math.max(netNeeded, totalRMD);
  
  // Step 3: Iterative calculation to find gross withdrawal that yields net after all taxes
  // FIX: Better initial guess based on more realistic tax rates
  const expectedTaxRate = filingStatus === 'married' ? 0.18 : 0.22; // Reduced for married
  let grossWithdrawal = Math.max(minimumGrossNeeded, netNeeded / (1 - expectedTaxRate));
  let iterations = 0;
  const maxIterations = 20; // Increased from 10 for better convergence
  let lastGrossWithdrawal = 0;
  let oscillationCount = 0;
  let combinedTaxRate = expectedTaxRate; // Initialize for first iteration
  let convergenceThreshold = 50; // FIX: Tighter convergence threshold
  
  while (iterations < maxIterations) {
    // Calculate withdrawal strategy using dynamic tax rate
    const withdrawalStrategy = calculateTaxEfficientWithdrawal(
      grossWithdrawal,
      buckets,
      combinedTaxRate, // Use dynamic rate instead of fixed 0.25
      age,
      0.15,
      false
    );
    
    // Calculate income components - INCLUDING pension && earned income
    const ordinaryIncome = withdrawalStrategy.fromTaxDeferred + taxablePensionIncome + earnedIncome;
    // FIX: Use actual basis tracking for accurate capital gains calculation
    let capitalGainsIncome: number;
    
    if (buckets.taxableBasis !== undefined && buckets.capitalGains > 0) {
      // Use actual basis tracking for accurate tax calculation
      const currentBasisRatio = buckets.taxableBasis / buckets.capitalGains;
      const realizedGain = withdrawalStrategy.fromCapitalGains * (1 - currentBasisRatio);
      capitalGainsIncome = Math.max(0, realizedGain);
    } else {
      // Fallback to heuristic if basis tracking not available
      const yearsHeld = Math.min(20, age - 50);
      const appreciationRate = 0.07;
      const costBasisRatio = Math.max(0.3, 1 - (yearsHeld * appreciationRate));
      capitalGainsIncome = withdrawalStrategy.fromCapitalGains * (1 - costBasisRatio);
    }
    
    // Calculate Social Security taxation (with full income base)
    const ssTaxation = calculateEnhancedSocialSecurityTaxation(
      totalSSBenefit,
      ordinaryIncome + capitalGainsIncome, // Now includes pension & earned income
      filingStatus
    );
    
    // FIX: Account for standard deduction
    const standardDeduction = filingStatus === 'married' ? 29200 : (filingStatus === 'head_of_household' ? 21900 : 14600); // 2024 values
    const totalTaxableIncome = Math.max(0, ordinaryIncome + ssTaxation.taxableAmount + capitalGainsIncome - standardDeduction);
    
    // Calculate combined tax rate && update for next iteration
    combinedTaxRate = calculateCombinedTaxRate(
      totalTaxableIncome,
      retirementState,
      (filingStatus === 'married' ? 'married' : 'single'),
      true,
      age,
      spouseAge
    );
    
    // Unified tax calculation (federal + state + LTCG stacking + NIIT) with itemized vs standard
    const unified = calculateUnifiedTaxes({
      year: simulationYear,
      filingStatus,
      state: retirementState,
      // Pass ordinary income EXCLUDING SS; unified engine computes taxable SS internally
      ordinaryIncome: Math.max(0, ordinaryIncome - (taxAdjustments?.qcdApplied || 0)),
      capitalGainsIncome: capitalGainsIncome,
      socialSecurityGross: totalSSBenefit,
      pensionIncome: taxablePensionIncome,
      aca: acaInfo ? {
        aptcApplied: acaInfo.aptcApplied,
        benchmarkAnnual: acaInfo.benchmarkAnnual,
        months: acaInfo.months || 12,
        householdSize: (acaInfo as any).householdSize || 1,
        state: acaInfo.state
      } : undefined,
      age: age,
      spouseAge: spouseAge,
      earnedIncome: earnedIncome,
      useItemized: (taxItemization && taxItemization.useItemized) || undefined,
      saltPaid: taxItemization?.saltPaid,
      mortgageInterest: taxItemization?.mortgageInterest,
      charitableGifts: taxItemization?.charitableGifts,
      medicalExpenses: taxItemization?.medicalExpenses,
      otherItemized: taxItemization?.otherItemized,
      qbiIncome: taxItemization?.qbiIncome,
    });
    const federalTax = unified.federalTax;
    const stateTax = unified.stateTax;
    const capitalGainsTax = unified.capitalGainsTax;
    const totalTaxes = unified.totalTax;
    const netAfterTaxes = grossWithdrawal - totalTaxes;
    
    // Check if we've converged
    const difference = Math.abs(netAfterTaxes - netNeeded);
    if (difference < convergenceThreshold || iterations === maxIterations - 1) {
      // Calculate current year MAGI (for future 2-year lookback)
      const modifiedAGI = ordinaryIncome + ssTaxation.taxableAmount + capitalGainsIncome;
      
      // Use 2-year lookback MAGI for IRMAA calculation if available
      // IRMAA is based on MAGI from 2 years ago, not current year
      const irmaaMAGI = magiFor2YearLookback !== undefined ? magiFor2YearLookback : modifiedAGI;
      let irmaaResult = calculateIRMAA(irmaaMAGI, filingStatus, simulationYear);
      if (age < 65) {
        irmaaResult = { ...irmaaResult, annualSurcharge: 0 } as any;
      }
      
      return {
        grossWithdrawal: Math.max(grossWithdrawal, totalRMD),
        netAfterTaxes,
        federalTax: Math.max(0, federalTax),
        stateTax: Math.max(0, stateTax),
        capitalGainsTax,
        totalTaxes,
        effectiveTaxRate: totalTaxes / grossWithdrawal,
        marginalTaxRate: combinedTaxRate,
        modifiedAGI,
        taxableSSBenefit: ssTaxation.taxableAmount,
        irmaaResult,
        requiredRMD: totalRMD,
        actualRMDWithdrawn: Math.max(withdrawalStrategy.fromTaxDeferred, totalRMD)
      };
    }
    
    // Detect oscillation && improve convergence
    if (lastGrossWithdrawal > 0) {
      const change = Math.abs(grossWithdrawal - lastGrossWithdrawal);
      if (change < grossWithdrawal * 0.001) {
        oscillationCount++;
        // Adaptive convergence threshold
        if (oscillationCount > 3) {
          convergenceThreshold = Math.min(500, convergenceThreshold * 1.5);
        }
        if (oscillationCount > 5) {
          // Accept current result if oscillating too much
          break;
        }
      }
    }
    
    // Store current value for oscillation detection
    lastGrossWithdrawal = grossWithdrawal;
    
    // Adjust gross withdrawal for next iteration with improved convergence
    const adjustmentFactor = Math.max(0.01, 0.5 * Math.pow(0.7, oscillationCount)); // Better convergence
    
    if (netAfterTaxes < netNeeded) {
      const shortfall = netNeeded - netAfterTaxes;
      const estimatedTaxRate = totalTaxes / grossWithdrawal;
      const additionalGross = shortfall / (1 - estimatedTaxRate);
      grossWithdrawal += additionalGross * adjustmentFactor;
    } else {
      const excess = netAfterTaxes - netNeeded;
      grossWithdrawal -= excess * adjustmentFactor;
    }
    
    iterations++;
  }
  
  // FIX: Return last calculated values rather than zeros
  // If we didn't converge perfectly, return the best estimate we have
  // This prevents unrealistic zero-tax scenarios
  const lastWithdrawalStrategy = calculateTaxEfficientWithdrawal(
    grossWithdrawal,
    buckets,
    combinedTaxRate,
    age,
    0.15,
    false
  );
  
  // Recalculate cost basis ratio for final estimate
  const yearsHeld = Math.min(20, age - 50);
  const appreciationRate = 0.07;
  const finalCostBasisRatio = Math.max(0.3, 1 - (yearsHeld * appreciationRate / 100));
  
  const lastOrdinaryIncome = lastWithdrawalStrategy.fromTaxDeferred;
  const lastCapitalGainsIncome = lastWithdrawalStrategy.fromCapitalGains * (1 - finalCostBasisRatio);
  const lastSSTaxation = calculateEnhancedSocialSecurityTaxation(
    totalSSBenefit,
    lastOrdinaryIncome,
    filingStatus
  );
  
  const lastTotalTaxableIncome = lastOrdinaryIncome + lastCapitalGainsIncome + lastSSTaxation.taxableAmount;
  const lastModifiedAGI = lastTotalTaxableIncome + totalSSBenefit * 0.5;
  let lastIrmaaResult = calculateIRMAA(lastModifiedAGI, filingStatus, simulationYear);
  if (age < 65) {
    lastIrmaaResult = { ...lastIrmaaResult, annualSurcharge: 0 } as any;
  }
  
  // Use conservative tax estimate if we didn't converge
  const estimatedTaxRate = Math.max(combinedTaxRate, 0.22);
  const estimatedTaxes = grossWithdrawal * estimatedTaxRate;
  
  const result: EnhancedWithdrawalResult = {
    grossWithdrawal: Math.max(grossWithdrawal, totalRMD),
    netAfterTaxes: grossWithdrawal - estimatedTaxes,
    federalTax: estimatedTaxes * 0.7, // Rough federal portion
    stateTax: estimatedTaxes * 0.3,  // Rough state portion
    capitalGainsTax: lastCapitalGainsIncome * 0.15,
    totalTaxes: estimatedTaxes,
    effectiveTaxRate: estimatedTaxRate,
    marginalTaxRate: estimatedTaxRate * 1.2, // Marginal is typically higher
    modifiedAGI: lastModifiedAGI,
    taxableSSBenefit: lastSSTaxation.taxableAmount,
    irmaaResult: lastIrmaaResult,
    requiredRMD: totalRMD,
    actualRMDWithdrawn: Math.max(totalRMD, lastWithdrawalStrategy.fromTaxDeferred)
  };
  
  // Cache the result
  if (useCache) {
    const cacheKey = {
      netNeeded,
      taxDeferred: buckets.taxDeferred,
      taxFree: buckets.taxFree,
      capitalGains: buckets.capitalGains,
      totalSSBenefit,
      age,
      spouseAge,
      filingStatus,
      magiFor2YearLookback,
      birthYear,
      spouseBirthYear
    };
    globalCache.set('withdrawal', cacheKey, result);
  }
  
  return result;
}

// Get RMD start age based on birth year (SECURE 2.0)
function getRMDStartAge(birthYear: number): number {
  // SECURE 2.0 CORRECT implementation:
  // Born before 1951: RMD at 72 (grandfathered under pre-SECURE rules)
  // Born 1951-1959: RMD at 73 (effective 2023)
  // Born 1960+: RMD at 75 (effective 2033)
  // IMPORTANT: There is NO age 74 step in SECURE 2.0
  
  if (birthYear < 1951) {
    return 72; // Already taking RMDs under old rules
  } else if (birthYear <= 1959) {
    return 73; // SECURE 2.0 current rule (effective 2023)
  } else {
    // Born 1960 || later: RMD at 75 (begins in 2033)
    return 75; // NO age 74 step exists in SECURE 2.0
  }
}

// IRS Table II Joint Life Expectancy Factors (simplified version)
// For spouse >10 years younger than account owner
function getJointLifeExpectancyFactor(ownerAge: number, spouseAge: number): number {
  const ageDifference = ownerAge - spouseAge;
  
  // Only apply if spouse is >10 years younger
  if (ageDifference <= 10) {
    return rmdFactors[ownerAge] || 2.0;
  }
  
  // Simplified IRS Table II lookup based on age difference
  // These are approximate factors for common age differences
  const jointLifeFactors: Record<number, Record<number, number>> = {
    // Owner age 70
    70: { 11: 26.5, 12: 26.7, 13: 26.9, 14: 27.1, 15: 27.3, 16: 27.5, 17: 27.7, 18: 27.9, 19: 28.1, 20: 28.3 },
    71: { 11: 25.5, 12: 25.7, 13: 25.9, 14: 26.1, 15: 26.3, 16: 26.5, 17: 26.7, 18: 26.9, 19: 27.1, 20: 27.3 },
    72: { 11: 24.5, 12: 24.7, 13: 24.9, 14: 25.1, 15: 25.3, 16: 25.5, 17: 25.7, 18: 25.9, 19: 26.1, 20: 26.3 },
    73: { 11: 23.5, 12: 23.7, 13: 23.9, 14: 24.1, 15: 24.3, 16: 24.5, 17: 24.7, 18: 24.9, 19: 25.1, 20: 25.3 },
    74: { 11: 22.6, 12: 22.8, 13: 23.0, 14: 23.2, 15: 23.4, 16: 23.6, 17: 23.8, 18: 24.0, 19: 24.2, 20: 24.4 },
    75: { 11: 21.6, 12: 21.8, 13: 22.0, 14: 22.2, 15: 22.4, 16: 22.6, 17: 22.8, 18: 23.0, 19: 23.2, 20: 23.4 },
    80: { 11: 17.0, 12: 17.2, 13: 17.4, 14: 17.6, 15: 17.8, 16: 18.0, 17: 18.2, 18: 18.4, 19: 18.6, 20: 18.8 },
    85: { 11: 13.0, 12: 13.2, 13: 13.4, 14: 13.6, 15: 13.8, 16: 14.0, 17: 14.2, 18: 14.4, 19: 14.6, 20: 14.8 },
    90: { 11: 9.5, 12: 9.7, 13: 9.9, 14: 10.1, 15: 10.3, 16: 10.5, 17: 10.7, 18: 10.9, 19: 11.1, 20: 11.3 }
  };
  
  // Find closest age in table
  const ages = Object.keys(jointLifeFactors).map(Number).sort((a, b) => a - b);
  const closestOwnerAge = ages.reduce((prev, curr) => 
    Math.abs(curr - ownerAge) < Math.abs(prev - ownerAge) ? curr : prev
  );
  
  const factors = jointLifeFactors[closestOwnerAge];
  if (!factors) {
    // Fallback to regular RMD factor
    return rmdFactors[ownerAge] || 2.0;
  }
  
  // Find closest age difference (capped at 20 years)
  const cappedDifference = Math.min(20, Math.max(11, ageDifference));
  const factor = factors[cappedDifference];
  
  return factor || rmdFactors[ownerAge] || 2.0;
}

// Calculate Required Minimum Distribution with SECURE 2.0 updates
function calculateRMD(
  balance: number, 
  age: number, 
  birthYear?: number,
  spouseAge?: number,
  spouseBirthYear?: number,
  useCache: boolean = true
): number {
  // Determine RMD start age based on birth year
  const rmdStartAge = birthYear ? getRMDStartAge(birthYear) : 73; // Default to current rule
  
  // Check cache first
  if (useCache) {
    const cached = globalCache.get<number>('rmd', { balance, age, rmdStartAge });
    if (cached !== undefined) {
      return cached;
    }
  }
  
  // RMD factors from IRS Publication 590-B (Table III - Uniform Lifetime)
  // Fixed: Use correct age indexing (age is the key, not offset)
  const rmdFactors: { [age: number]: number } = {
    70: 29.1, 71: 28.2, 72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6,
    76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4,
    82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
    88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1,
    94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
    100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6,
    106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
    112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7,
    118: 2.5, 119: 2.3, 120: 2.0 // Extended table
  };
  
  // Check if RMDs apply
  if (age < rmdStartAge || balance <= 0) {
    return 0;
  }
  
  // Use Joint Life Table if spouse is more than 10 years younger
  // This gives more favorable (lower) RMD amounts
  let factor = rmdFactors[age] || rmdFactors[120] || 2.0;
  
  if (spouseAge && spouseBirthYear) {
    const ageDifference = age - spouseAge;
    if (ageDifference > 10) {
      // Use proper IRS Table II joint-life factors
      factor = getJointLifeExpectancyFactor(age, spouseAge);
    }
  }
  
  const rmd = balance / factor;
  
  // Cache the result
  if (useCache) {
    globalCache.set('rmd', { balance, age, rmdStartAge }, rmd);
  }
  
  return rmd;
}

// Phase 1: Per-account RMD/QCD/QLAC/inherited IRA scheduler (simplified)
function computePerAccountRmdQcdQlac(
  params: any,
  userAge: number,
  spouseAge: number | undefined,
  simulationYear: number
): { requiredRmd: number; qcdApplied: number; qlacIncome: number } {
  const accounts: Array<any> = Array.isArray(params.accounts) ? params.accounts : [];
  if (!accounts.length && !params.qlac && !params.qcdAnnualTarget) return { requiredRmd: 0, qcdApplied: 0, qlacIncome: 0 };

  // Aggregate balances by owner for traditional accounts
  const sumBalances = (owner: 'user' | 'spouse', types: string[]) =>
    accounts.filter(a => a.owner === owner && types.includes(a.type)).reduce((s, a) => s + (Number(a.balance) || 0), 0);

  let userDeferred = sumBalances('user', ['trad_ira','401k','403b']);
  let spouseDeferred = sumBalances('spouse', ['trad_ira','401k','403b']);

  // Apply QLAC exclusion from RMD base until start age
  const qlac = params.qlac || {};
  const userQlacPurchase = Number(qlac.userPurchase || 0);
  const userQlacStart = Number(qlac.userStartAge || 85);
  const userQlacPayoutRate = Number(qlac.userPayoutRate || 0.05);
  if (userAge < userQlacStart) userDeferred = Math.max(0, userDeferred - userQlacPurchase);
  const userQlacIncome = userAge >= userQlacStart ? userQlacPurchase * userQlacPayoutRate : 0;

  const spouseQlacPurchase = Number(qlac.spousePurchase || 0);
  const spouseQlacStart = Number(qlac.spouseStartAge || 85);
  const spouseQlacPayoutRate = Number(qlac.spousePayoutRate || 0.05);
  if (spouseAge && spouseAge < spouseQlacStart) spouseDeferred = Math.max(0, spouseDeferred - spouseQlacPurchase);
  const spouseQlacIncome = (spouseAge && spouseAge >= spouseQlacStart) ? spouseQlacPurchase * spouseQlacPayoutRate : 0;

  // Compute base RMDs for user/spouse
  const currentYear = new Date().getFullYear();
  const userBirthYear = params.userBirthYear || (currentYear - userAge);
  const spouseBirthYear = spouseAge ? (params.spouseBirthYear || (currentYear - spouseAge)) : undefined;

  const userRmdStartAge = getRMDStartAge(userBirthYear);
  const spouseRmdStartAge = spouseAge ? getRMDStartAge(spouseBirthYear || (currentYear - (spouseAge || 0))) : 999;

  const userRmd = userAge >= userRmdStartAge && userDeferred > 0 ? (userDeferred / getRMDFactor(userAge)) : 0;
  const spouseRmd = (spouseAge && spouseAge >= spouseRmdStartAge && spouseDeferred > 0) ? (spouseDeferred / getRMDFactor(spouseAge)) : 0;

  let requiredRmd = userRmd + spouseRmd;

  // Inherited IRAs: 10-year rule simplified pro-rata to deadline
  const inherited = accounts.filter(a => a.type === 'inherited_ira');
  for (const acc of inherited) {
    const bal = Number(acc.balance) || 0;
    const endYear = (acc.inherited && acc.inherited.endYear) ? Number(acc.inherited.endYear) : (simulationYear + 10);
    const yearsLeft = Math.max(1, endYear - simulationYear);
    requiredRmd += bal / yearsLeft;
  }

  // QCD application (age ≥ 70.5; simplified single cap per year)
  const qcdTarget = Number(params.qcdAnnualTarget || 0);
  const qcdCap = 105000; // 2024 cap (approx, subject to change)
  let qcdApplied = 0;
  if (qcdTarget > 0) {
    const eligible = (userAge >= 70.5 ? userRmd : 0) + ((spouseAge && spouseAge >= 70.5) ? spouseRmd : 0);
    qcdApplied = Math.min(qcdTarget, eligible, qcdCap);
  }

  const qlacIncome = userQlacIncome + spouseQlacIncome;
  return { requiredRmd, qcdApplied, qlacIncome };
}

// Market Regime Definitions for Sequence of Returns Risk
export type MarketRegime = 'bull' | 'normal' | 'bear' | 'crisis';

export interface RegimeParameters {
  meanReturn: number;
  volatility: number;
  avgDuration: number; // Average duration in years
  transitionProbs: Record<MarketRegime, number>;
  // Asset class specific adjustments
  assetAdjustments: {
    stocks: { returnMultiplier: number; volMultiplier: number };
    intlStocks: { returnMultiplier: number; volMultiplier: number };
    bonds: { returnMultiplier: number; volMultiplier: number };
    reits: { returnMultiplier: number; volMultiplier: number };
  };
}

// Market regime parameters based on historical data && research
export const MARKET_REGIMES: Record<MarketRegime, RegimeParameters> = {
  bull: {
    meanReturn: 0.14,      // 14% average in bull markets
    volatility: 0.12,      // 12% volatility
    avgDuration: 5.0,      // Bull markets last ~5 years on average
    transitionProbs: {
      bull: 0.70,          // 70% chance to continue
      normal: 0.20,        // 20% chance to normalize
      bear: 0.08,          // 8% chance to turn bearish
      crisis: 0.02         // 2% chance of crisis
    },
    assetAdjustments: {
      stocks: { returnMultiplier: 1.2, volMultiplier: 0.9 },
      intlStocks: { returnMultiplier: 1.15, volMultiplier: 0.95 },
      bonds: { returnMultiplier: 0.8, volMultiplier: 0.8 },
      reits: { returnMultiplier: 1.1, volMultiplier: 1.0 }
    }
  },
  normal: {
    meanReturn: 0.07,      // 7% average in normal markets
    volatility: 0.16,      // 16% volatility
    avgDuration: 3.0,      // Normal periods last ~3 years
    transitionProbs: {
      bull: 0.25,          // 25% chance to turn bullish
      normal: 0.50,        // 50% chance to continue
      bear: 0.20,          // 20% chance to turn bearish
      crisis: 0.05         // 5% chance of crisis
    },
    assetAdjustments: {
      stocks: { returnMultiplier: 1.0, volMultiplier: 1.0 },
      intlStocks: { returnMultiplier: 1.0, volMultiplier: 1.0 },
      bonds: { returnMultiplier: 1.0, volMultiplier: 1.0 },
      reits: { returnMultiplier: 1.0, volMultiplier: 1.0 }
    }
  },
  bear: {
    meanReturn: -0.12,     // -12% average in bear markets
    volatility: 0.25,      // 25% volatility
    avgDuration: 1.5,      // Bear markets last ~1.5 years
    transitionProbs: {
      bull: 0.20,          // 20% chance to turn bullish
      normal: 0.40,        // 40% chance to normalize
      bear: 0.30,          // 30% chance to continue
      crisis: 0.10         // 10% chance to worsen to crisis
    },
    assetAdjustments: {
      stocks: { returnMultiplier: 1.0, volMultiplier: 1.3 },
      intlStocks: { returnMultiplier: 1.1, volMultiplier: 1.4 },
      bonds: { returnMultiplier: 1.2, volMultiplier: 0.9 },  // Bonds do better
      reits: { returnMultiplier: 0.9, volMultiplier: 1.5 }
    }
  },
  crisis: {
    meanReturn: -0.35,     // -35% average in crisis
    volatility: 0.45,      // 45% volatility
    avgDuration: 1.0,      // Crises are typically shorter
    transitionProbs: {
      bull: 0.05,          // 5% chance of quick recovery
      normal: 0.25,        // 25% chance to normalize
      bear: 0.60,          // 60% chance to become bear
      crisis: 0.10         // 10% chance to continue
    },
    assetAdjustments: {
      stocks: { returnMultiplier: 1.0, volMultiplier: 1.8 },
      intlStocks: { returnMultiplier: 1.2, volMultiplier: 2.0 }, // More volatile
      bonds: { returnMultiplier: 1.5, volMultiplier: 0.7 },      // Flight to quality
      reits: { returnMultiplier: 0.8, volMultiplier: 2.0 }
    }
  }
};

// ============================================
// Return Conversion Functions (CAGR vs AAGR)
// ============================================

/**
 * Convert Compound Annual Growth Rate (CAGR/Geometric) to Arithmetic Average Growth Rate (AAGR)
 * AAGR = CAGR + (σ²/2)
 * This adjustment accounts for volatility drag in compound returns
 */
export function cagr2aagr(cagr: number, volatility: number): number {
  // Add half the variance to convert from geometric to arithmetic mean
  return cagr + (volatility * volatility) / 2;
}

/**
 * Convert Arithmetic Average Growth Rate (AAGR) to Compound Annual Growth Rate (CAGR/Geometric)
 * CAGR = AAGR - (σ²/2)
 * This adjustment removes volatility drag to get the compound return
 */
export function aagr2cagr(aagr: number, volatility: number): number {
  // Subtract half the variance to convert from arithmetic to geometric mean
  return aagr - (volatility * volatility) / 2;
}

/**
 * Configuration for return type h&&ling
 */
export interface ReturnTypeConfig {
  // Whether the input expectedReturn is CAGR (geometric) || AAGR (arithmetic)
  inputReturnType: 'CAGR' | 'AAGR';
  // Whether to use arithmetic returns for Monte Carlo sampling (recommended: true)
  useArithmeticForMonteCarlo: boolean;
  // Whether to use geometric returns for deterministic projections (recommended: true)
  useGeometricForProjections: boolean;
}

// Default configuration: Input is CAGR, use appropriate returns for each calculation
export const DEFAULT_RETURN_CONFIG: ReturnTypeConfig = {
  inputReturnType: 'CAGR',
  useArithmeticForMonteCarlo: true,
  useGeometricForProjections: true
};

// ============================================
// Advanced Risk Metrics
// ============================================

/**
 * Advanced risk metrics for retirement portfolio analysis
 */
export interface AdvancedRiskMetrics {
  // Tail risk metrics
  cvar95: number;           // Conditional Value at Risk (95% confidence)
  cvar99: number;           // Conditional Value at Risk (99% confidence)
  maxDrawdown: number;      // Maximum peak-to-trough decline (%)
  ulcerIndex: number;       // Depth and duration of drawdowns

  // Success metrics bundle
  successVariants: {
    standard: number;              // No depletion by horizon
    legacy?: number;               // Legacy, consumption-friendly metric
    utilityAdjusted: number;       // Utility-weighted success
    withInflationAdjustment: number; // Conservative adjustment
    withHealthCosts: number;       // Success when LTC occurs
  };

  // Path-dependent metrics
  dangerZones: number[];        // Years with highest failure risk (indices)
  sequenceRiskScore: number;    // Risk from early retirement returns
  retirementFlexibility: number; // Years retirement can be delayed/advanced
}

/**
 * Calculate Conditional Value at Risk (CVaR)
 * Average of the worst X% outcomes
 */
export function calculateCVaR(
  values: number[],
  confidence: number = 0.95
): number {
  const sortedValues = [...values].sort((a, b) => a - b);
  const cutoffIndex = Math.floor(sortedValues.length * (1 - confidence));
  
  if (cutoffIndex === 0) {
    return sortedValues[0] || 0;
  }
  
  let sum = 0;
  for (let i = 0; i < cutoffIndex; i++) {
    sum += sortedValues[i];
  }
  
  return sum / cutoffIndex;
}

/**
 * Calculate maximum drawdown && recovery metrics
 */
export function calculateDrawdownMetrics(
  balances: number[]
): { maxDrawdown: number; duration: number; ulcerIndex: number } {
  if (balances.length === 0) {
    return { maxDrawdown: 0, duration: 0, ulcerIndex: 0 };
  }
  
  let peak = balances[0];
  let maxDrawdown = 0;
  let maxDuration = 0;
  let currentDuration = 0;
  let drawdownSquares = 0;
  let inDrawdown = false;
  
  for (let i = 0; i < balances.length; i++) {
    const current = balances[i];
    
    if (current > peak) {
      peak = current;
      if (inDrawdown) {
        maxDuration = Math.max(maxDuration, currentDuration);
        currentDuration = 0;
        inDrawdown = false;
      }
    } else {
      const drawdown = Math.min(1, (peak - current) / peak); // Cap at 100%
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      drawdownSquares += drawdown * drawdown;
      
      if (!inDrawdown) {
        inDrawdown = true;
        currentDuration = 1;
      } else {
        currentDuration++;
      }
    }
  }
  
  // Final duration check
  if (inDrawdown) {
    maxDuration = Math.max(maxDuration, currentDuration);
  }
  
  // Ulcer Index: square root of mean squared drawdowns
  const ulcerIndex = Math.sqrt(drawdownSquares / balances.length) * 100;
  
  return {
    maxDrawdown: maxDrawdown * 100, // Convert to percentage
    duration: maxDuration,
    ulcerIndex
  };
}

/**
 * Calculate utility-adjusted success rate
 * Uses logarithmic utility function to account for diminishing returns
 */
export function calculateUtilityAdjustedSuccess(
  endingBalances: number[],
  initialWealth: number
): number {
  if (endingBalances.length === 0) return 0;
  
  let totalUtility = 0;
  const subsistenceLevel = 20000; // Minimum survival amount
  
  for (const balance of endingBalances) {
    if (balance <= subsistenceLevel) {
      // Below subsistence = very negative utility
      totalUtility += -10;
    } else {
      // Logarithmic utility above subsistence
      const excessWealth = balance - subsistenceLevel;
      totalUtility += Math.log(1 + excessWealth / initialWealth);
    }
  }
  
  // Normalize to 0-1 scale
  const avgUtility = totalUtility / endingBalances.length;
  const maxUtility = Math.log(1 + 10000000 / initialWealth); // 10M utility
  const minUtility = -10;
  
  return Math.max(0, Math.min(1, (avgUtility - minUtility) / (maxUtility - minUtility)));
}

/**
 * Identify danger zones - years with highest failure risk
 */
export function identifyDangerZones(
  scenarios: any[],
  params: RetirementMonteCarloParams
): Array<{ age: number; riskLevel: number; description: string }> {
  const dangerZones: Array<{ age: number; riskLevel: number; description: string }> = [];
  const ageRange = params.lifeExpectancy - params.currentAge;
  
  // Analyze failure patterns by age
  for (let yearOffset = 0; yearOffset < ageRange; yearOffset++) {
    const age = params.currentAge + yearOffset;
    let failuresAtAge = 0;
    let totalScenariosAtAge = 0;
    
    for (const scenario of scenarios) {
      if (scenario.yearlyCashFlows && scenario.yearlyCashFlows.length > yearOffset) {
        totalScenariosAtAge++;
        const yearData = scenario.yearlyCashFlows[yearOffset];
        if (yearData.portfolioBalance <= 0) {
          failuresAtAge++;
        }
      }
    }
    
    const failureRate = totalScenariosAtAge > 0 ? failuresAtAge / totalScenariosAtAge : 0;
    
    // Mark as danger zone if failure rate exceeds threshold
    if (failureRate > 0.2) { // More than 20% chance of depletion
      dangerZones.push({
        age,
        riskLevel: failureRate,
        description: `High depletion risk (${(failureRate * 100).toFixed(1)}% chance)`
      });
    }
  }
  
  return dangerZones;
}

/**
 * Calculate sequence of returns risk score
 * Measures vulnerability to poor returns early in retirement
 */
export function calculateSequenceRiskScore(
  scenarios: any[],
  params: RetirementMonteCarloParams
): number {
  const earlyYears = 5; // First 5 years of retirement
  let totalFailedWithEarlyLosses = 0;
  let totalFailed = 0;
  
  for (const scenario of scenarios) {
    if (!scenario.success && scenario.yearlyCashFlows && scenario.yearlyCashFlows.length >= earlyYears) {
      totalFailed++;
      
      // Check if early years had negative returns
      const earlyReturns = scenario.yearlyCashFlows.slice(0, earlyYears)
        .map((y: any) => y.investmentReturn || 0);
      const negativeEarlyYears = earlyReturns.filter((r: number) => r < 0).length;
      
      if (negativeEarlyYears >= 2) { // At least 2 negative years in first 5
        totalFailedWithEarlyLosses++;
      }
    }
  }
  
  // Score is ratio of failures attributed to early losses
  return totalFailed > 0 ? totalFailedWithEarlyLosses / totalFailed : 0;
}

/**
 * Calculate retirement date flexibility
 * How many years can retirement be moved without significant impact
 */
export function calculateRetirementFlexibility(
  params: RetirementMonteCarloParams,
  scenarios: any[],
  iterations: number
): { optimalAge: number; successRange: number[]; flexibilityScore: number } {
  // Simple heuristic based on current params
  const currentAge = params.currentAge;
  const retirementAge = params.retirementAge;
  const successRate = scenarios.filter(s => s.success).length / iterations;
  
  // Estimate flexibility based on success rate
  let flexibilityScore = 0;
  let optimalAge = retirementAge;
  let successRange = [retirementAge - 2, retirementAge + 2];
  
  if (successRate > 0.9) {
    flexibilityScore = 0.9;
    successRange = [retirementAge - 3, retirementAge + 1];
  } else if (successRate > 0.8) {
    flexibilityScore = 0.7;
    successRange = [retirementAge - 2, retirementAge + 2];
  } else if (successRate > 0.7) {
    flexibilityScore = 0.5;
    successRange = [retirementAge - 1, retirementAge + 3];
  } else {
    flexibilityScore = 0.3;
    optimalAge = retirementAge + 2;
    successRange = [retirementAge, retirementAge + 5];
  }
  
  return {
    optimalAge,
    successRange,
    flexibilityScore
  };
}

// ============================================
// Fat-Tailed Distributions & Advanced Models
// ============================================

/**
 * Generate returns using Student-t distribution for fat tails
 * Captures extreme events better than normal distribution
 */
export function generateStudentTReturn(
  mean: number, 
  volatility: number, 
  degreesOfFreedom: number = 5, // Lower df = fatter tails
  random?: () => number,
  rng?: RandomSource
): number {
  const rand = random || (rng ? (() => rng.next()) : Math.random);
  
  // Generate Student-t using inverse transform method
  // First generate a standard normal
  const u1 = rand();
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  
  // Generate chi-squared with df degrees of freedom
  let chi2 = 0;
  for (let i = 0; i < degreesOfFreedom; i++) {
    const u3 = rand();
    const u4 = rand();
    const normal = Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);
    chi2 += normal * normal;
  }

  const t = z / Math.sqrt(chi2 / degreesOfFreedom);
  
  // Scale && shift
  const scalingFactor = Math.sqrt((degreesOfFreedom - 2) / degreesOfFreedom); // Variance adjustment
  return mean + volatility * scalingFactor * t;
}

// Enhanced Success Metrics Interface
interface EnhancedSuccessParams {
  totalShortfall: number;
  maxConsecutiveShortfallYears: number;
  annualRetirementExpenses: number;
  yearsUntilDepletion: number | null;
  yearlyCashFlows: any[];
  endingBalance: number;
  currentAge: number;
  retirementAge: number;
}

interface EnhancedSuccessMetrics {
  legacySuccess: boolean;           // Original success metric for compatibility
  essentialFloorCoverage: number;   // Probability essential needs are fully met
  discretionaryCutSeverity: number; // Average percentage of discretionary cuts
  timeToDepletionYears: number | null; // Years until portfolio depletion
  conditionalShortfall: number;     // Expected shortfall given failure (PV)
  fundedRatioAtEnd: number;        // Final portfolio value / remaining needs
  worstConsecutiveYears: number;    // Maximum consecutive shortfall years
  shortfallFrequency: number;       // Percentage of retirement years with shortfalls
  earlyRetirementRisk: number;      // Risk score for first 10 years of retirement
}

function calculateEnhancedSuccessMetrics(params: EnhancedSuccessParams): EnhancedSuccessMetrics {
  const {
    totalShortfall,
    maxConsecutiveShortfallYears,
    annualRetirementExpenses,
    yearsUntilDepletion,
    yearlyCashFlows,
    endingBalance,
    currentAge,
    retirementAge
  } = params;
  // Predeclare ACA-related context to avoid temporal dead zone references in earlier branches
  let acaContext: { aptc: number; totalGross: number; totalNetPremium: number } | undefined;
  let acaEnrollees: number[] = [];

  // Legacy success metric for backward compatibility
  const noShortfall = totalShortfall === 0;
  const legacySuccess = noShortfall || (totalShortfall < annualRetirementExpenses * 0.5 && maxConsecutiveShortfallYears <= 1);

  // Calculate essential floor coverage (assume 55% of expenses are essential)
  const essentialExpenses = annualRetirementExpenses * 0.55;
  const essentialShortfall = Math.max(0, totalShortfall - (annualRetirementExpenses * 0.45));
  const essentialFloorCoverage = essentialShortfall === 0 ? 1.0 : Math.max(0, 1 - (essentialShortfall / (essentialExpenses * 30))); // 30-year horizon

  // Calculate discretionary cut severity
  const discretionaryExpenses = annualRetirementExpenses * 0.45;
  const discretionaryShortfall = Math.min(totalShortfall, discretionaryExpenses * 30);
  const discretionaryCutSeverity = discretionaryExpenses > 0 ? discretionaryShortfall / (discretionaryExpenses * 30) : 0;

  // Time to depletion
  const timeToDepletionYears = yearsUntilDepletion;

  // Conditional shortfall (present value of unmet needs)
  const conditionalShortfall = totalShortfall; // Already calculated as shortfall amount

  // Funded ratio at end (portfolio value vs remaining liability estimate)
  const retirementYears = Math.max(1, currentAge - retirementAge);
  const remainingYears = Math.max(1, 30 - retirementYears); // Assume 30-year retirement
  const remainingLiability = annualRetirementExpenses * remainingYears;
  const fundedRatioAtEnd = remainingLiability > 0 ? endingBalance / remainingLiability : 1.0;

  // Worst consecutive shortfall years
  const worstConsecutiveYears = maxConsecutiveShortfallYears;

  // Shortfall frequency (percentage of years with shortfalls)
  const yearsWithShortfalls = yearlyCashFlows.filter((year: any) => year.shortfall > 0).length;
  const totalRetirementYears = Math.max(1, yearlyCashFlows.length);
  const shortfallFrequency = yearsWithShortfalls / totalRetirementYears;

  // Early retirement risk (first 10 years severity)
  const earlyYears = yearlyCashFlows.slice(0, 10);
  const earlyShortfalls = earlyYears.filter((year: any) => year.shortfall > 0).length;
  const earlyRetirementRisk = earlyYears.length > 0 ? earlyShortfalls / earlyYears.length : 0;

  return {
    legacySuccess,
    essentialFloorCoverage,
    discretionaryCutSeverity,
    timeToDepletionYears,
    conditionalShortfall,
    fundedRatioAtEnd,
    worstConsecutiveYears,
    shortfallFrequency,
    earlyRetirementRisk
  };
}

// Historical market data for block bootstrap (simplified dataset)
// In production, this would be loaded from a comprehensive database
const HISTORICAL_MONTHLY_RETURNS = {
  // Sample data - would need actual historical returns
  usStocks: [
    // 2020-2024 sample monthly returns (simplified for demo)
    0.026, -0.088, 0.128, 0.044, 0.045, 0.019, 0.056, 0.070, -0.036, -0.028, 0.108, 0.037,
    0.010, 0.027, -0.034, 0.054, 0.005, 0.002, -0.015, 0.022, -0.029, 0.069, 0.057, 0.044,
    -0.031, 0.028, 0.036, 0.131, 0.005, 0.071, -0.046, 0.089, -0.041, 0.084, -0.026, 0.048,
    0.037, -0.025, 0.034, -0.043, 0.009, 0.019, -0.081, 0.082, -0.020, 0.041, 0.033, -0.056,
    -0.089, 0.127, 0.001, 0.038, -0.078, 0.055, 0.101, -0.022, -0.041, -0.025, 0.056, 0.044
  ],
  bonds: [
    0.013, 0.018, -0.021, 0.009, -0.005, 0.006, 0.012, -0.003, -0.008, 0.011, 0.021, -0.002,
    -0.004, 0.007, 0.015, -0.019, 0.008, -0.011, 0.016, -0.007, 0.019, -0.012, 0.003, 0.008,
    0.025, -0.033, -0.041, -0.028, 0.012, -0.017, 0.031, -0.025, 0.019, -0.015, 0.007, -0.009,
    -0.012, 0.029, -0.031, 0.041, -0.018, 0.022, -0.047, 0.035, 0.011, -0.021, 0.018, 0.033,
    0.052, -0.041, 0.019, -0.028, 0.067, -0.035, -0.029, 0.044, 0.017, 0.008, -0.031, 0.012
  ],
  reits: [
    -0.156, -0.203, 0.289, 0.139, 0.067, 0.022, 0.098, -0.022, -0.058, -0.089, 0.127, 0.081,
    0.021, -0.031, -0.107, 0.145, 0.033, 0.019, -0.078, 0.056, -0.045, 0.089, 0.071, 0.038,
    -0.089, 0.112, -0.033, 0.178, -0.022, 0.095, -0.067, 0.134, -0.078, 0.156, -0.045, 0.089,
    0.067, -0.089, 0.134, -0.067, 0.045, -0.023, -0.156, 0.189, -0.089, 0.123, 0.067, -0.112,
    -0.201, 0.267, -0.045, 0.089, -0.134, 0.178, 0.234, -0.089, -0.067, -0.045, 0.134, 0.089
  ],
  intlStocks: [
    0.019, -0.101, 0.089, 0.056, 0.023, 0.007, 0.034, 0.045, -0.067, -0.033, 0.089, 0.023,
    -0.012, 0.034, -0.045, 0.067, -0.011, 0.019, -0.033, 0.045, -0.056, 0.078, 0.034, 0.023,
    -0.056, 0.067, 0.011, 0.112, -0.019, 0.045, -0.067, 0.089, -0.056, 0.101, -0.033, 0.034,
    0.023, -0.045, 0.056, -0.067, 0.011, 0.019, -0.089, 0.112, -0.034, 0.067, 0.023, -0.078,
    -0.123, 0.156, -0.019, 0.045, -0.089, 0.078, 0.134, -0.045, -0.067, -0.019, 0.089, 0.034
  ],
  cash: [
    0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001,
    0.001, 0.001, 0.001, 0.001, 0.002, 0.002, 0.002, 0.002, 0.002, 0.003, 0.003, 0.003,
    0.004, 0.004, 0.005, 0.006, 0.007, 0.008, 0.009, 0.010, 0.011, 0.012, 0.013, 0.015,
    0.017, 0.019, 0.021, 0.023, 0.025, 0.027, 0.029, 0.031, 0.033, 0.035, 0.037, 0.039,
    0.041, 0.043, 0.045, 0.042, 0.039, 0.036, 0.033, 0.030, 0.027, 0.024, 0.021, 0.018
  ]
};

// Block Bootstrap Parameters
interface BlockBootstrapConfig {
  blockLength: number;        // Length of each block (months)
  overlapAllowed: boolean;    // Allow overlapping blocks
  minHistoryMonths: number;   // Minimum history required
}

const DEFAULT_BLOCK_CONFIG: BlockBootstrapConfig = {
  blockLength: 12,           // 12-month blocks
  overlapAllowed: true,      // Allow overlapping
  minHistoryMonths: 60       // Require 5 years minimum
};

// Generate returns using block bootstrap resampling
function generateBlockBootstrapReturns(
  assetAllocation: { stocks: number; intlStocks: number; bonds: number; reits: number; cash: number },
  timeStep: number = 1,      // Annual by default
  rng?: RandomSource,
  blockConfig: BlockBootstrapConfig = DEFAULT_BLOCK_CONFIG
): { portfolioReturn: number; assetReturns: Record<string, number> } {
  
  // Build list of active asset classes
  const assetClasses: string[] = [];
  const allocations: number[] = [];
  
  if (assetAllocation.stocks > 0) {
    assetClasses.push('usStocks');
    allocations.push(assetAllocation.stocks);
  }
  if (assetAllocation.intlStocks > 0) {
    assetClasses.push('intlStocks');
    allocations.push(assetAllocation.intlStocks);
  }
  if (assetAllocation.bonds > 0) {
    assetClasses.push('bonds');
    allocations.push(assetAllocation.bonds);
  }
  if (assetAllocation.reits > 0) {
    assetClasses.push('reits');
    allocations.push(assetAllocation.reits);
  }
  if (assetAllocation.cash > 0) {
    assetClasses.push('cash');
    allocations.push(assetAllocation.cash);
  }
  
  // Validate we have enough historical data
  const historyLength = HISTORICAL_MONTHLY_RETURNS.usStocks.length;
  if (historyLength < blockConfig.minHistoryMonths) {
    console.warn('Insufficient historical data for block bootstrap, falling back to parametric');
    return generateCorrelatedAssetReturns(assetAllocation, 'normal', timeStep, undefined, rng);
  }
  
  // Calculate number of months needed for the time period
  const monthsNeeded = Math.ceil(timeStep * 12);
  const blocksNeeded = Math.ceil(monthsNeeded / blockConfig.blockLength);
  
  // Generate random block starting positions
  const maxStartPos = historyLength - blockConfig.blockLength;
  const blockStarts: number[] = [];
  const rrng_bs = deriveRNG(rng, 'block-bootstrap', historyLength);
  
  for (let i = 0; i < blocksNeeded; i++) {
    const randomStart = Math.floor(rrng_bs.next() * (maxStartPos + 1));
    blockStarts.push(randomStart);
  }
  
  // Resample returns for each asset class
  const assetReturns: Record<string, number> = {};
  let portfolioReturn = 0;
  
  for (let assetIdx = 0; assetIdx < assetClasses.length; assetIdx++) {
    const assetClass = assetClasses[assetIdx];
    const allocation = allocations[assetIdx];
    
    // Get historical data for this asset
    const loader = (()=>{ try { return require('./historical-returns-loader'); } catch (e) { return null; } })();
    const hist = (loader && loader.loadHistoricalReturns && loader.loadHistoricalReturns()) || HISTORICAL_MONTHLY_RETURNS;
    const historicalData = hist[assetClass as keyof typeof HISTORICAL_MONTHLY_RETURNS];
    if (!historicalData) {
      console.warn(`No historical data for ${assetClass}, using fallback`);
      continue;
    }
    
    // Resample using blocks
    const resampledMonthlyReturns: number[] = [];
    
    for (const blockStart of blockStarts) {
      const blockEnd = Math.min(blockStart + blockConfig.blockLength, historicalData.length);
      const block = historicalData.slice(blockStart, blockEnd);
      resampledMonthlyReturns.push(...block);
    }
    
    // Take only the months we need
    const monthlyReturns = resampledMonthlyReturns.slice(0, monthsNeeded);
    
    // Compound monthly returns to get annual return
    let annualReturn = 1;
    for (const monthlyReturn of monthlyReturns) {
      annualReturn *= (1 + monthlyReturn);
    }
    annualReturn -= 1;
    
    // Adjust for partial year periods
    if (timeStep !== 1) {
      annualReturn = Math.pow(1 + annualReturn, timeStep) - 1;
    }
    
    assetReturns[assetClass] = annualReturn;
    portfolioReturn += annualReturn * allocation;
  }
  
  return { portfolioReturn, assetReturns };
}

/**
 * Jump diffusion model for sudden market shocks
 * Combines continuous returns with discrete jumps
 */
export interface JumpDiffusionParams {
  drift: number;           // Expected return
  volatility: number;      // Continuous volatility
  jumpIntensity: number;   // Average jumps per year (e.g., 0.5)
  jumpMean: number;        // Average jump size (e.g., -0.15 for 15% crash)
  jumpVolatility: number;  // Jump size volatility
}

export function generateJumpDiffusionReturn(
  params: JumpDiffusionParams,
  dt: number = 1, // Time step in years
  random?: () => number,
  rng?: RandomSource
): number {
  const rand = random || (rng ? (() => rng.next()) : Math.random);
  
  // Continuous part (geometric Brownian motion)
  const u1 = rand();
  const u2 = rand();
  const normalReturn = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const continuousReturn = params.drift * dt + params.volatility * Math.sqrt(dt) * normalReturn;
  
  // Jump part (Poisson process)
  const jumpProbability = 1 - Math.exp(-params.jumpIntensity * dt);
  let jumpReturn = 0;
  
  if (rand() < jumpProbability) {
    // Jump occurred
    const u3 = rand();
    const u4 = rand();
    const jumpSize = params.jumpMean + params.jumpVolatility * 
                    Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);
    jumpReturn = jumpSize;
  }
  
  return continuousReturn + jumpReturn;
}

/**
 * Dynamic Conditional Correlation model
 * Correlations increase during market stress
 */
export function calculateDynamicCorrelation(
  baseCorrelation: number,
  marketStress: number, // 0 = calm, 1 = extreme stress
  stressSensitivity: number = 0.5
): number {
  // Correlations tend toward 1 during stress
  const stressCorrelation = 0.9;
  const dynamicCorr = baseCorrelation + (stressCorrelation - baseCorrelation) * marketStress * stressSensitivity;
  return Math.max(-1, Math.min(1, dynamicCorr));
}

/**
 * Ornstein-Uhlenbeck mean reversion process
 * Models tendency of returns to revert to long-term average
 */
export function generateMeanRevertingReturn(
  currentLevel: number,
  longTermMean: number,
  meanReversionSpeed: number, // Higher = faster reversion
  volatility: number,
  dt: number = 1,
  random?: () => number,
  rng?: RandomSource
): number {
  const rand = random || (rng ? (() => rng.next()) : Math.random);
  
  // Generate normal random
  const u1 = rand();
  const u2 = rand();
  const normalRandom = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  
  // Ornstein-Uhlenbeck formula
  const drift = meanReversionSpeed * (longTermMean - currentLevel) * dt;
  const diffusion = volatility * Math.sqrt(dt) * normalRandom;
  
  return currentLevel + drift + diffusion;
}

/**
 * Enhanced distribution configuration
 */
export interface DistributionConfig {
  type: 'normal' | 'student-t' | 'jump-diffusion' | 'mean-reverting' | 'block-bootstrap';
  studentTDegreesOfFreedom?: number;
  jumpDiffusionParams?: JumpDiffusionParams;
  meanReversionSpeed?: number;
  useDynamicCorrelations?: boolean;
  blockBootstrapConfig?: BlockBootstrapConfig;
}

export const DEFAULT_DISTRIBUTION: DistributionConfig = {
  type: 'normal',
  useDynamicCorrelations: false
};

export const FAT_TAIL_DISTRIBUTION: DistributionConfig = {
  type: 'student-t',
  studentTDegreesOfFreedom: 5,
  useDynamicCorrelations: true
};

export const CRISIS_AWARE_DISTRIBUTION: DistributionConfig = {
  type: 'jump-diffusion',
  jumpDiffusionParams: {
    drift: 0.07,
    volatility: 0.15,
    jumpIntensity: 0.3, // ~30% chance of jump per year
    jumpMean: -0.20,    // Average 20% crash
    jumpVolatility: 0.10
  },
  useDynamicCorrelations: true
};

// ============================================
// Performance Optimization
// ============================================

/**
 * Streaming statistics calculator for memory-efficient percentile estimation
 * Uses P-Square algorithm for online quantile estimation
 */
export class StreamingStatistics {
  private count: number = 0;
  private min: number = Infinity;
  private max: number = -Infinity;
  private sum: number = 0;
  private sumSquares: number = 0;
  
  // P-Square algorithm for percentiles
  private markers: number[] = [];
  private positions: number[] = [];
  private desiredPositions: number[] = [];
  private percentiles: number[] = [0.1, 0.25, 0.5, 0.75, 0.9]; // Track key percentiles
  
  constructor() {
    // Initialize P-Square markers (5 markers for 5 percentiles)
    this.markers = new Array(5).fill(0);
    this.positions = [0, 1, 2, 3, 4];
    this.desiredPositions = [0, 1, 2, 3, 4];
  }
  
  /**
   * Add a new value to streaming statistics
   */
  add(value: number): void {
    this.count++;
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);
    this.sum += value;
    this.sumSquares += value * value;
    
    // P-Square algorithm for percentile tracking
    if (this.count <= 5) {
      // Initial phase: collect first 5 values
      this.markers[this.count - 1] = value;
      if (this.count === 5) {
        // Sort initial markers
        this.markers.sort((a, b) => a - b);
      }
    } else {
      // Update markers using P-Square algorithm
      this.updatePSquare(value);
    }
  }
  
  /**
   * P-Square algorithm update
   */
  private updatePSquare(value: number): void {
    // Find insertion position
    let k = 0;
    if (value < this.markers[0]) {
      this.markers[0] = value;
      k = 0;
    } else if (value >= this.markers[4]) {
      this.markers[4] = value;
      k = 3;
    } else {
      for (let i = 1; i < 5; i++) {
        if (value < this.markers[i]) {
          k = i - 1;
          break;
        }
      }
    }
    
    // Update positions
    for (let i = k + 1; i < 5; i++) {
      this.positions[i]++;
    }
    
    // Update desired positions
    for (let i = 0; i < 5; i++) {
      this.desiredPositions[i] = 1 + (this.count - 1) * this.percentiles[i];
    }
    
    // Adjust markers
    for (let i = 1; i < 4; i++) {
      const d = this.desiredPositions[i] - this.positions[i];
      if ((d >= 1 && this.positions[i + 1] - this.positions[i] > 1) ||
          (d <= -1 && this.positions[i - 1] - this.positions[i] < -1)) {
        const sign = d > 0 ? 1 : -1;
        
        // Parabolic interpolation
        const qi = this.markers[i];
        const qim1 = this.markers[i - 1];
        const qip1 = this.markers[i + 1];
        const ni = this.positions[i];
        const nim1 = this.positions[i - 1];
        const nip1 = this.positions[i + 1];
        
        const newValue = qi + sign / (nip1 - nim1) * (
          (ni - nim1 + sign) * (qip1 - qi) / (nip1 - ni) +
          (nip1 - ni - sign) * (qi - qim1) / (ni - nim1)
        );
        
        if (qim1 < newValue && newValue < qip1) {
          this.markers[i] = newValue;
        } else {
          // Linear interpolation fallback
          this.markers[i] = qi + sign * (this.markers[i + sign] - qi) / 
                            (this.positions[i + sign] - ni);
        }
        
        this.positions[i] += sign;
      }
    }
  }
  
  /**
   * Get current statistics
   */
  getStatistics(): {
    count: number;
    min: number;
    max: number;
    mean: number;
    variance: number;
    stdDev: number;
    percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  } {
    const mean = this.count > 0 ? this.sum / this.count : 0;
    const variance = this.count > 1 
      ? (this.sumSquares - this.sum * this.sum / this.count) / (this.count - 1)
      : 0;
    
    return {
      count: this.count,
      min: this.min === Infinity ? 0 : this.min,
      max: this.max === -Infinity ? 0 : this.max,
      mean,
      variance,
      stdDev: Math.sqrt(variance),
      percentiles: {
        p10: this.count >= 5 ? this.markers[0] : 0,
        p25: this.count >= 5 ? this.markers[1] : 0,
        p50: this.count >= 5 ? this.markers[2] : 0,
        p75: this.count >= 5 ? this.markers[3] : 0,
        p90: this.count >= 5 ? this.markers[4] : 0
      }
    };
  }
  
  /**
   * Merge statistics from another StreamingStatistics instance
   */
  merge(other: StreamingStatistics): void {
    const otherStats = other.getStatistics();
    
    // Merge basic statistics
    this.count += otherStats.count;
    this.min = Math.min(this.min, otherStats.min);
    this.max = Math.max(this.max, otherStats.max);
    this.sum += other.sum;
    this.sumSquares += other.sumSquares;
    
    // Approximate percentile merging (weighted average)
    if (this.count >= 5 && otherStats.count >= 5) {
      const weight = otherStats.count / this.count;
      for (let i = 0; i < 5; i++) {
        this.markers[i] = (this.markers[i] + other.markers[i] * weight) / (1 + weight);
      }
    }
  }
}

/**
 * Cache for expensive calculations
 */
export class CalculationCache {
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private ttl: number = 60000; // 1 minute TTL by default
  
  constructor(ttlMs: number = 60000) {
    this.ttl = ttlMs;
  }
  
  /**
   * Generate cache key from parameters
   */
  private generateKey(prefix: string, params: any): string {
    const sortedParams = Object.keys(params).sort().reduce((obj, key) => {
      obj[key] = params[key];
      return obj;
    }, {} as any);
    return `${prefix}:${JSON.stringify(sortedParams)}`;
  }
  
  /**
   * Get cached value
   */
  get<T>(prefix: string, params: any): T | undefined {
    const key = this.generateKey(prefix, params);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.value as T;
    }
    
    // Remove expired entry
    if (cached) {
      this.cache.delete(key);
    }
    
    return undefined;
  }
  
  /**
   * Set cached value
   */
  set(prefix: string, params: any, value: any): void {
    const key = this.generateKey(prefix, params);
    this.cache.set(key, { value, timestamp: Date.now() });
    
    // Limit cache size to prevent memory issues
    if (this.cache.size > 1000) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < 100; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
  
  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; oldestEntry: number | null } {
    let oldest: number | null = null;
    
    for (const [_, entry] of this.cache.entries()) {
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    }
    
    return {
      size: this.cache.size,
      oldestEntry: oldest
    };
  }
}

// Global calculation cache
export const globalCache = new CalculationCache(5 * 60 * 1000); // 5 minute TTL

// ============================================
// Variance Reduction Techniques
// ============================================

/**
 * Configuration for variance reduction techniques
 */
export interface VarianceReductionConfig {
  useAntitheticVariates: boolean;
  useControlVariates: boolean;
  useStratifiedSampling: boolean;
  stratificationBins?: number;  // Number of bins for stratified sampling
  lhsDims?: number;             // Number of early-year normal draws to stratify (default 30)
}

/**
 * Generate asset returns using specified distribution
 */
function generateAssetReturn(
  expectedReturn: number,
  volatility: number,
  distribution: DistributionConfig,
  randomSeed?: () => number,
  previousReturn?: number,
  rng?: RandomSource
): number {
  const random = randomSeed || (rng ? (() => rng.next()) : (() => deriveRNG(undefined, 'asset-return').next()));
  
  switch (distribution.type) {
    case 'student-t':
      return generateStudentTReturn(
        expectedReturn,
        volatility,
        distribution.studentTDegreesOfFreedom || 5,
        random,
        rng
      );
      
    case 'jump-diffusion':
      if (!distribution.jumpDiffusionParams) {
        throw new Error('Jump diffusion parameters required');
      }
      return generateJumpDiffusionReturn(
        {
          ...distribution.jumpDiffusionParams,
          drift: expectedReturn,
          volatility
        },
        1,
        random,
        rng
      );
      
    case 'mean-reverting':
      const currentLevel = previousReturn || expectedReturn;
      return generateMeanRevertingReturn(
        currentLevel,
        expectedReturn,
        distribution.meanReversionSpeed || 0.5,
        volatility,
        1,
        random,
        rng
      );
      
    case 'normal':
    default:
      // St&&ard normal distribution
      const u1 = random();
      const u2 = random();
      const normalRandom = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return expectedReturn + volatility * normalRandom;
  }
}

// Default variance reduction configuration
export const DEFAULT_VARIANCE_REDUCTION: VarianceReductionConfig = {
  useAntitheticVariates: true,
  useControlVariates: true,
  useStratifiedSampling: true,
  stratificationBins: 10  // Stratify into deciles
};

/**
 * Antithetic Variates Implementation
 * For each random path, also run the mirror path with negated random numbers
 * This reduces variance by ~40-50% with minimal computational overhead
 */
export function generateAntitheticPair<T>(
  runScenario: (randomSeed?: number[]) => T,
  originalSeed: number[]
): { original: T; antithetic: T } {
  // Run original scenario
  const original = runScenario(originalSeed);
  
  // Create antithetic (mirror) seed
  const antitheticSeed = originalSeed.map(r => -r);
  
  // Run antithetic scenario
  const antithetic = runScenario(antitheticSeed);
  
  return { original, antithetic };
}

/**
 * Control Variates Implementation
 * Use Black-Scholes-like analytical solution as control
 */
export function calculateControlVariate(
  params: RetirementMonteCarloParams,
  returnConfig: ReturnTypeConfig = DEFAULT_RETURN_CONFIG
): number {
  // Simplified analytical approximation for retirement success
  // Based on lognormal approximation of portfolio value at retirement
  
  const { expectedReturn, returnVolatility, currentRetirementAssets, annualSavings,
          retirementAge, currentAge, lifeExpectancy, annualRetirementExpenses,
          annualGuaranteedIncome, withdrawalRate } = params;
  
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const retirementYears = lifeExpectancy - retirementAge;
  
  // Convert returns appropriately
  let projectionReturn = expectedReturn;
  if (returnConfig.inputReturnType === 'CAGR' && returnConfig.useGeometricForProjections) {
    projectionReturn = expectedReturn;
  } else if (returnConfig.inputReturnType === 'AAGR' && returnConfig.useGeometricForProjections) {
    projectionReturn = aagr2cagr(expectedReturn, returnVolatility);
  }
  
  // Future value of current assets && savings (deterministic)
  const FV_current = currentRetirementAssets * Math.pow(1 + projectionReturn, yearsToRetirement);
  const FV_savings = annualSavings * ((Math.pow(1 + projectionReturn, yearsToRetirement) - 1) / projectionReturn);
  const portfolioAtRetirement = FV_current + FV_savings;
  
  // Required portfolio for retirement (simplified)
  const netExpenses = Math.max(0, annualRetirementExpenses - (annualGuaranteedIncome || 0));
  const requiredPortfolio = netExpenses / (withdrawalRate || 0.04);
  
  // Probability of success using lognormal approximation
  const logMean = Math.log(portfolioAtRetirement) - 0.5 * returnVolatility * returnVolatility * yearsToRetirement;
  const logStd = returnVolatility * Math.sqrt(yearsToRetirement);
  const z = (Math.log(requiredPortfolio) - logMean) / logStd;
  
  // Cumulative normal distribution (approximation)
  const probability = 1 - normalCDF(z);
  
  return probability;
}

/**
 * Stratified Sampling Implementation
 * Ensure proper representation across return distributions
 */
export function generateStratifiedReturns(
  numSamples: number,
  numBins: number = 10,
  rng?: RandomSource
): number[][] {
  const rrng = deriveRNG(rng, 'stratified-returns', numBins);
  const samplesPerBin = Math.floor(numSamples / numBins);
  const extraSamples = numSamples % numBins;
  const stratifiedSamples: number[][] = [];
  
  for (let bin = 0; bin < numBins; bin++) {
    const binSamples = bin < extraSamples ? samplesPerBin + 1 : samplesPerBin;
    
    for (let i = 0; i < binSamples; i++) {
      // Generate uniform random in the bin range
      const binLower = bin / numBins;
      const binUpper = (bin + 1) / numBins;
      const uniform = binLower + rrng.next() * (binUpper - binLower);
      
      // Convert uniform to normal using inverse CDF
      const normal = inverseNormalCDF(uniform);
      stratifiedSamples.push([normal]);
    }
  }
  
  // Shuffle to avoid ordering bias
  for (let i = stratifiedSamples.length - 1; i > 0; i--) {
    const j = Math.floor(rrng.next() * (i + 1));
    [stratifiedSamples[i], stratifiedSamples[j]] = [stratifiedSamples[j], stratifiedSamples[i]];
  }
  
  return stratifiedSamples;
}

/**
 * Generate Latin-Hypercube Sampling normals for primary return shocks.
 * Returns an array of length `iterations`, each with `dims` standard normals.
 */
function generateLHSNormals(
  iterations: number,
  dims: number,
  rng: RandomSource
): number[][] {
  // Initialize matrix [iterations x dims]
  const result: number[][] = Array.from({ length: iterations }, () => Array(dims).fill(0));
  for (let d = 0; d < dims; d++) {
    // Build stratified uniforms for this dimension
    const uniforms: number[] = [];
    for (let k = 0; k < iterations; k++) {
      const u = (k + rng.next()) / iterations; // one sample in each stratum
      uniforms.push(u);
    }
    // Shuffle to randomize assignment across iterations
    for (let i = uniforms.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [uniforms[i], uniforms[j]] = [uniforms[j], uniforms[i]];
    }
    // Map uniforms to normals && assign to iterations
    for (let i = 0; i < iterations; i++) {
      result[i][d] = inverseNormalCDF(uniforms[i]);
    }
  }
  return result;
}

/**
 * Normal CDF approximation (Abramowitz && Stegun)
 */
function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);
  
  const t = 1.0 / (1.0 + p * x);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;
  
  const y = 1.0 - (((((a5 * t5 + a4 * t4) + a3 * t3) + a2 * t2) + a1 * t) * Math.exp(-x * x));
  
  return 0.5 * (1.0 + sign * y);
}

/**
 * Inverse Normal CDF (Beasley-Springer-Moro algorithm)
 */
function inverseNormalCDF(p: number): number {
  const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
  const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
  const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
            0.0276438810333863, 0.0038405729373609, 0.0003951896511919,
            0.0000321767881768, 0.0000002888167364, 0.0000003960315187];
  
  const y = p - 0.5;
  
  if (Math.abs(y) < 0.42) {
    const z = y * y;
    const x = y * (((a[3] * z + a[2]) * z + a[1]) * z + a[0]) /
              ((((b[3] * z + b[2]) * z + b[1]) * z + b[0]) * z + 1);
    return x;
  } else {
    let z = y > 0 ? Math.log(-Math.log(1 - p)) : Math.log(-Math.log(p));
    let x = c[0];
    for (let i = 1; i < 9; i++) {
      x = x * z + c[i];
    }
    return y > 0 ? x : -x;
  }
}

// Long-Term Care (LTC) Risk Parameters && Modeling
interface LTCParameters {
  hasInsurance: boolean;
  ageBasedProbabilities: number[]; // Probability by age offset from 65
  durationMean: number; // Average duration in years
  durationStdDev: number; // St&&ard deviation for log-normal distribution
  annualCostMean: number; // Average annual cost
  annualCostStdDev: number; // Cost variability
  inflationRate: number; // LTC-specific inflation rate
  careMixProbabilities: {
    home: number;
    assisted: number;
    nursing: number;
  };
}

// Default LTC parameters based on 2024-2025 data
const DEFAULT_LTC_PARAMS: LTCParameters = {
  hasInsurance: false,
  // FIX: More realistic age-based probabilities for ~35-40% lifetime probability (reduced from ~50%)
  ageBasedProbabilities: [
    // Ages 65-74: Very low probability (most LTC needs are later in life)
    0.005, 0.005, 0.006, 0.006, 0.007, 0.007, 0.008, 0.008, 0.009, 0.009,
    // Ages 75-84: Low to medium probability  
    0.012, 0.015, 0.018, 0.021, 0.024, 0.027, 0.030, 0.033, 0.036, 0.040,
    // Ages 85-94: Medium to high probability (peak LTC years)
    0.045, 0.050, 0.055, 0.060, 0.065, 0.070, 0.075, 0.080, 0.085, 0.090,
    // Ages 95+: High but capped probability
    0.095, 0.100, 0.105, 0.110, 0.115, 0.120
  ],
  durationMean: 2.0, // Average 2.0 years (reduced from 2.5, per HHS data)
  durationStdDev: 1.5, // Less variability (reduced from 2.0)
  annualCostMean: 75000, // $75k average annual cost (reduced from $85k, more realistic)
  annualCostStdDev: 20000, // ~27% variability (reduced from 30%)
  inflationRate: 0.035, // 3.5% LTC-specific inflation (reduced from 4.5%)
  careMixProbabilities: {
    home: 0.55, // 55% receive home care (increased from 50%)
    assisted: 0.30, // 30% in assisted living (unchanged)
    nursing: 0.15 // 15% in nursing homes (reduced from 20%)
  }
};;;

// Cost multipliers by care type (relative to mean)
const CARE_COST_MULTIPLIERS = {
  home: 0.78, // Home care ~78% of average
  assisted: 0.71, // Assisted living ~71% of average  
  nursing: 1.28 // Nursing home ~128% of average
};

// Regime transition functions
export function getInitialRegime(yearsToRetirement: number, rng?: RandomSource): MarketRegime {
  // FIX: Market regimes should be unconditional - market doesn't know your retirement date
  // Use historical average probabilities regardless of time to retirement
  const probabilities = {
    bull: 0.30,    // 30% - historical average
    normal: 0.50,  // 50% - historical average
    bear: 0.15,    // 15% - historical average
    crisis: 0.05   // 5% - historical average
  };
  
  const rrng = deriveRNG(rng, 'initial-regime', yearsToRetirement);
  const rand = rrng.next();
  let cumProb = 0;
  
  for (const [regime, prob] of Object.entries(probabilities)) {
    cumProb += prob;
    if (rand <= cumProb) {
      return regime as MarketRegime;
    }
  }
  
  return 'normal'; // Default fallback
}

export function transitionRegime(currentRegime: MarketRegime, rng?: RandomSource): MarketRegime {
  const transitions = MARKET_REGIMES[currentRegime].transitionProbs;
  const rrng = deriveRNG(rng, 'transition-regime');
  const rand = rrng.next();
  let cumProb = 0;
  
  for (const [nextRegime, prob] of Object.entries(transitions)) {
    cumProb += prob;
    if (rand <= cumProb) {
      return nextRegime as MarketRegime;
    }
  }
  
  return currentRegime; // Stay in current regime as fallback
}

// Generate log-normal distributed random value
function generateLogNormal(mean: number, stdDev: number, rng?: RandomSource): number {
  // Use standard normal from RNG; fallback to deterministic RNG if missing
  const rrng = deriveRNG(rng, 'lognormal');
  const z = rrng.normal();
  const logMean = Math.log(mean) - 0.5 * Math.log(1 + (stdDev / mean) ** 2);
  const logStd = Math.sqrt(Math.log(1 + (stdDev / mean) ** 2));
  return Math.exp(logMean + logStd * z);
}

// Simulate LTC shock for a given year
function simulateLTCShock(
  age: number,
  yearsIntoRetirement: number,
  ltcParams: LTCParameters,
  ltcEventAlreadyOccurred: boolean,
  rng?: RandomSource
): {
  ltcTriggered: boolean;
  annualCost: number;
  duration: number;
  careType: 'home' | 'assisted' | 'nursing' | null;
} {
  // No LTC event if already occurred || age < 65
  if (ltcEventAlreadyOccurred || age < 65) {
    return { ltcTriggered: false, annualCost: 0, duration: 0, careType: null };
  }
  
  // Get age-based probability
  const ageIndex = Math.min(age - 65, ltcParams.ageBasedProbabilities.length - 1);
  const triggerProb = ltcParams.ageBasedProbabilities[Math.max(0, ageIndex)];
  
  // Check if LTC event triggers this year
  const rrng = deriveRNG(rng, 'ltc-shock', age);
  const triggerRand = rrng.next();
  if (triggerRand > triggerProb) {
    return { ltcTriggered: false, annualCost: 0, duration: 0, careType: null };
  }
  
  // LTC event triggered - determine care type
  const careRandom = rrng.next();
  let careType: 'home' | 'assisted' | 'nursing';
  if (careRandom < ltcParams.careMixProbabilities.home) {
    careType = 'home';
  } else if (careRandom < ltcParams.careMixProbabilities.home + ltcParams.careMixProbabilities.assisted) {
    careType = 'assisted';
  } else {
    careType = 'nursing';
  }
  
  // Sample duration (log-normal, capped at reasonable bounds)
  let duration = generateLogNormal(ltcParams.durationMean, ltcParams.durationStdDev, rng);
  // FIX: Cap duration at 5 years maximum (reduced from 10)
  duration = Math.max(0.5, Math.min(5, duration)); // Between 0.5 && 5 years
  
  // Sample && inflate cost based on care type
  const costRandom = rrng.next();
  const baseCost = Math.max(
    40000, // Reduced minimum from 50000
    costRandom * ltcParams.annualCostStdDev * 2 + ltcParams.annualCostMean - ltcParams.annualCostStdDev
  );
  const careMultiplier = CARE_COST_MULTIPLIERS[careType];
  // REAL DOLLAR MODEL: Keep LTC costs constant in today's purchasing power
  const inflatedCost = baseCost * careMultiplier;
  
  return {
    ltcTriggered: true,
    annualCost: inflatedCost,
    duration: duration,
    careType: careType
  };
}

// Asset class correlation matrix based on historical data
interface AssetCorrelations {
  usStocks: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
  intlStocks: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
  bonds: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
  reits: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
  cash: { usStocks: number; intlStocks: number; bonds: number; reits: number; cash: number };
}

// Historical correlations based on academic research && industry data
let ASSET_CORRELATIONS: AssetCorrelations = {
  usStocks:   { usStocks: 1.00, intlStocks: 0.80, bonds: 0.15, reits: 0.70, cash: 0.00 },
  intlStocks: { usStocks: 0.80, intlStocks: 1.00, bonds: 0.10, reits: 0.65, cash: 0.00 },
  bonds:      { usStocks: 0.15, intlStocks: 0.10, bonds: 1.00, reits: 0.20, cash: 0.30 },
  reits:      { usStocks: 0.70, intlStocks: 0.65, bonds: 0.20, reits: 1.00, cash: 0.10 },
  cash:       { usStocks: 0.00, intlStocks: 0.00, bonds: 0.30, reits: 0.10, cash: 1.00 }
};

// Asset class return && volatility assumptions
interface AssetClassParams {
  expectedReturn: number;
  volatility: number;
}

// Asset class parameters with historical CAGR (geometric) returns
// These will be converted to AAGR (arithmetic) for Monte Carlo sampling
let ASSET_CLASS_PARAMS: Record<string, AssetClassParams> = {
  usStocks:   { expectedReturn: 0.10, volatility: 0.18 },  // 10% CAGR, 18% volatility → 11.62% AAGR
  intlStocks: { expectedReturn: 0.09, volatility: 0.20 },  // 9% CAGR, 20% volatility → 11% AAGR
  bonds:      { expectedReturn: 0.05, volatility: 0.05 },  // 5% CAGR, 5% volatility → 5.125% AAGR
  reits:      { expectedReturn: 0.08, volatility: 0.19 },  // 8% CAGR, 19% volatility → 9.805% AAGR
  cash:       { expectedReturn: 0.02, volatility: 0.01 }   // 2% CAGR, 1% volatility → 2.005% AAGR
};

// Cholesky decomposition for correlation matrix
function choleskyDecomposition(correlation: number[][]): number[][] {
  const n = correlation.length;
  const L: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      if (i === j) {
        // Diagonal elements
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[j][k] * L[j][k];
        }
        const diagonal = correlation[j][j] - sum;
        
        // H&&le numerical errors that might make diagonal negative
        if (diagonal < 0) {
          // console.warn(`Cholesky decomposition: negative diagonal at [${j},${j}], using 0`);
          L[j][j] = 0;
        } else {
          L[j][j] = Math.sqrt(diagonal);
        }
      } else {
        // Off-diagonal elements
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }
        L[i][j] = L[j][j] === 0 ? 0 : (correlation[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

// Matrix-vector multiplication
function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  const n = matrix.length;
  const result: number[] = Array(n).fill(0);
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i] += matrix[i][j] * vector[j];
    }
  }
  
  return result;
}

// Seeded random number generator for reproducible results
class SeededRandom {
  private seed: number;
  private index: number = 0;
  private preGeneratedNormals?: number[];
  
  constructor(seed: number = 123456789, preGeneratedNormals?: number[]) {
    this.seed = seed;
    this.preGeneratedNormals = preGeneratedNormals;
  }
  
  // Linear congruential generator (same as Java's)
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x80000000;
  }
  
  // Get next normal random (either pre-generated || generate new)
  nextNormal(mean: number = 0, stdDev: number = 1): number {
    if (this.preGeneratedNormals && this.index < this.preGeneratedNormals.length) {
      const normal = this.preGeneratedNormals[this.index++];
      return mean + stdDev * normal;
    } else {
      // Generate using Box-Muller transform
      const u = this.next();
      const v = this.next();
      const normal = Math.sqrt(-2.0 * Math.log(u + 0.00001)) * Math.cos(2.0 * Math.PI * v);
      return mean + stdDev * normal;
    }
  }
  
  random(): number {
    if (this.preGeneratedNormals && this.index < this.preGeneratedNormals.length) {
      // Use uniform distribution from pre-generated normals
      return (this.preGeneratedNormals[this.index++] + 3) / 6; // Convert N(0,1) to ~U(0,1)
    }
    return this.next();
  }
}

// Global random generator (can be seeded for reproducibility)
let globalRandom: SeededRandom | null = null;

// Generate normally distributed random number using Box-Muller transform
function generateNormalRandom(mean: number = 0, stdDev: number = 1, rng?: RandomSource): number {
  // CRITICAL UPDATE: Using Student-t distribution as core for realistic fat tails
  // Degrees of freedom = 5 captures market kurtosis observed empirically
  const degreesOfFreedom = 5;
  
  const rrng = deriveRNG(rng, 'gen-normal');
  // Generate Student-t using RNG (or deterministic fallback RNG)
  const z = rrng.normal();
  let chi2 = 0;
  for (let i = 0; i < degreesOfFreedom; i++) {
    const normal = rrng.normal();
    chi2 += normal * normal;
  }
  const t = z / Math.sqrt(chi2 / degreesOfFreedom);
  const scalingFactor = Math.sqrt((degreesOfFreedom - 2) / degreesOfFreedom);
  return mean + stdDev * scalingFactor * t;
}

// Calculate taxable portion of Social Security benefits
function calculateTaxableSocialSecurity(
  ssBenefit: number,
  otherIncome: number,
  filingStatus: 'single' | 'married'
): number {
  if (ssBenefit <= 0) return 0;
  
  // Calculate provisional income (other income + 50% of SS benefits)
  const provisionalIncome = otherIncome + (ssBenefit * 0.5);
  
  // 2024 thresholds
  const thresholds = filingStatus === 'single' ? 
    { first: 25000, second: 34000 } : 
    { first: 32000, second: 44000 };
  
  if (provisionalIncome <= thresholds.first) {
    return 0; // No SS is taxable
  } else if (provisionalIncome <= thresholds.second) {
    // Up to 50% is taxable
    const excess = provisionalIncome - thresholds.first;
    return Math.min(excess * 0.5, ssBenefit * 0.5);
  } else {
    // Up to 85% is taxable
    const firstTier = (thresholds.second - thresholds.first) * 0.5;
    const secondTier = (provisionalIncome - thresholds.second) * 0.85;
    return Math.min(firstTier + secondTier, ssBenefit * 0.85);
  }
}

// Get regime-dependent inflation-asset correlations
function getInflationAssetCorrelation(assetClass: string, regime: MarketRegime): number {
  // Historical inflation-asset correlations by market regime
  const correlations: Record<MarketRegime, Record<string, number>> = {
    normal: {
      usStocks: 0.15,    // Modest positive correlation during normal times
      intlStocks: 0.12,  // International stocks slightly less correlated
      bonds: -0.25,      // Bonds typically inverse to inflation
      reits: 0.45,       // REITs often hedge inflation
      cash: 0.85         // Cash/short rates highly correlated with inflation
    },
    bull: {
      usStocks: -0.05,   // During bull markets, growth overcomes inflation fears
      intlStocks: -0.08, 
      bonds: -0.35,      // Bonds hurt more during inflationary bull markets
      reits: 0.35,       // REITs still positive but less correlation
      cash: 0.75         // Cash rates lag in bull markets
    },
    bear: {
      usStocks: -0.10,   // Stagflation scenario - negative for stocks
      intlStocks: -0.15,
      bonds: -0.15,      // Flight to quality despite inflation
      reits: 0.25,       // REITs struggle but retain some inflation hedge
      cash: 0.90         // Cash/rates respond quickly to inflation
    },
    crisis: {
      usStocks: -0.30,   // Severe stagflation risk
      intlStocks: -0.35,
      bonds: 0.10,       // Flight to quality dominates inflation fears
      reits: 0.15,       // REITs lose inflation hedge during crisis
      cash: 0.95         // Rates spike with inflation expectations
    }
  };

  return correlations[regime][assetClass] || 0;
}

// Generate correlated asset returns using Cholesky decomposition with regime awareness && inflation correlation
function generateCorrelatedAssetReturns(
  assetAllocation: { stocks: number; intlStocks: number; bonds: number; reits: number; cash: number },
  currentRegime: MarketRegime = 'normal',
  timeStep: number = 1, // Annual by default
  regimeAdjustments?: { volatilityMultiplier?: number; meanMultiplier?: number }, // Added regime adjustments
  rng?: RandomSource, // NEW: Pass RNG for deterministic generation
  distribution: DistributionConfig = DEFAULT_DISTRIBUTION, // NEW: Support different distributions
  userOverrides?: { // NEW: Allow user to override returns && volatility
    expectedReturn?: number;  // User-specified portfolio return target
    returnVolatility?: number; // User-specified portfolio volatility
    blendingWeight?: number;  // How much weight to give user inputs (0-1, default 0.5)
  },
  inflationCorrelation: boolean = false // NEW: Enable inflation correlation
): { portfolioReturn: number; assetReturns: Record<string, number>; inflationRate?: number } {
  // H&&le block bootstrap distribution separately (doesn't use Cholesky decomposition)
  if (distribution.type === 'block-bootstrap') {
    const config = distribution.blockBootstrapConfig || DEFAULT_BLOCK_CONFIG;
    const bootstrapResult = generateBlockBootstrapReturns(assetAllocation, timeStep, rng, config);
    return {
      ...bootstrapResult,
      inflationRate: undefined // Block bootstrap doesn't generate inflation (yet)
    };
  }

  // Build correlation matrix based on actual asset allocation
  const assetClasses: string[] = [];
  const allocations: number[] = [];
  
  if (assetAllocation.stocks > 0) {
    assetClasses.push('usStocks');
    allocations.push(assetAllocation.stocks);
  }
  if (assetAllocation.intlStocks > 0) {
    assetClasses.push('intlStocks');
    allocations.push(assetAllocation.intlStocks);
  }
  if (assetAllocation.bonds > 0) {
    assetClasses.push('bonds');
    allocations.push(assetAllocation.bonds);
  }
  if (assetAllocation.reits > 0) {
    assetClasses.push('reits');
    allocations.push(assetAllocation.reits);
  }
  if (assetAllocation.cash > 0) {
    assetClasses.push('cash');
    allocations.push(assetAllocation.cash);
  }
  
  // Add inflation to correlation matrix if enabled
  let includeInflation = inflationCorrelation;
  if (includeInflation) {
    assetClasses.push('inflation');
    allocations.push(0); // Inflation has no allocation weight
  }
  
  const n = assetClasses.length;
  
  // Build correlation matrix for selected assets (including inflation if enabled)
  const correlationMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (assetClasses[i] === 'inflation' || assetClasses[j] === 'inflation') {
        // Inflation correlations (regime-dependent)
        if (i === j) {
          correlationMatrix[i][j] = 1.0; // Self-correlation
        } else {
          correlationMatrix[i][j] = getInflationAssetCorrelation(
            assetClasses[i] === 'inflation' ? assetClasses[j] : assetClasses[i], 
            currentRegime
          );
        }
      } else {
        // St&&ard asset correlations
        const asset1 = assetClasses[i] as keyof AssetCorrelations;
        const asset2 = assetClasses[j] as keyof AssetCorrelations;
        correlationMatrix[i][j] = ASSET_CORRELATIONS[asset1][asset2];
      }
    }
  }
  
  // Perform Cholesky decomposition
  const L = choleskyDecomposition(correlationMatrix);
  
  // Generate independent random variables based on distribution type
  const Z = Array(n).fill(0).map(() => {
    // Use distribution config to generate appropriate random variables
    switch (distribution.type) {
      case 'student-t': {
        // Student's t-distribution for fat tails (more extreme events)
        const df = distribution.studentTDegreesOfFreedom || 5;
        if (rng) {
          return rng.studentT(df);
        } else {
          // Fallback: approximate with scaled normal for backward compatibility
          // Scale factor approximates heavier tails
          const scaleFactor = Math.sqrt(df / (df - 2));
          return generateNormalRandom() * scaleFactor;
        }
      }
      
      case 'jump-diffusion': {
        // Jump-diffusion model: normal returns with occasional jumps
        const jumpProb = distribution.jumpDiffusionParams?.jumpIntensity || 0.05;
        const jumpMean = distribution.jumpDiffusionParams?.jumpMean || -0.1;
        const jumpStd = distribution.jumpDiffusionParams?.jumpVolatility || 0.15;
        
        if (rng) {
          const normal = rng.normal();
          const hasJump = rng.next() < jumpProb;
          const jump = hasJump ? rng.normal() * jumpStd + jumpMean : 0;
          return normal + jump;
        } else {
          // Fallback for backward compatibility, but still deterministic
          const rrng = deriveRNG(undefined, 'jump-diffusion');
          const normal = generateNormalRandom(0, 1, rrng);
          const hasJump = rrng.next() < jumpProb;
          const jump = hasJump ? generateNormalRandom(0, 1, rrng) * jumpStd + jumpMean : 0;
          return normal + jump;
        }
      }
      
      case 'mean-reverting': {
        // Mean-reverting: returns tend to revert to long-term average
        // For now, use normal distribution (mean reversion h&&led elsewhere)
        if (rng) {
          return rng.normal();
        } else {
          return generateNormalRandom();
        }
      }
      
      case 'normal':
      default: {
        // St&&ard normal distribution
        if (rng) {
          return rng.normal();
        } else {
          return generateNormalRandom();
        }
      }
    }
  });
  
  // Transform to correlated random variables
  const correlatedZ = multiplyMatrixVector(L, Z);
  
  // Calculate returns for each asset class
  const assetReturns: Record<string, number> = {};
  let portfolioReturn = 0;
  let generatedInflationRate: number | undefined;
  
  for (let i = 0; i < n; i++) {
    const assetClass = assetClasses[i];
    
    // H&&le inflation separately
    if (assetClass === 'inflation') {
      // Generate inflation using correlated random variable
      const baseInflationRate = 0.025; // 2.5% base inflation
      const inflationVolatility = 0.015; // 1.5% volatility
      
      // Regime-dependent inflation adjustments
      const regimeInflationAdjustment = currentRegime === 'crisis' ? 0.02 : 
                                       currentRegime === 'bear' ? 0.01 : 
                                       currentRegime === 'bull' ? -0.005 : 0;
      
      const adjustedInflationMean = baseInflationRate + regimeInflationAdjustment;
      const drift = Math.log(1 + adjustedInflationMean) - 0.5 * inflationVolatility * inflationVolatility;
      const diffusion = inflationVolatility * Math.sqrt(timeStep) * correlatedZ[i];
      generatedInflationRate = Math.exp(drift * timeStep + diffusion) - 1;
      
      // Cap inflation at reasonable bounds
      generatedInflationRate = Math.max(-0.05, Math.min(0.15, generatedInflationRate));
      continue; // Don't add to portfolio return
    }
    const baseParams = ASSET_CLASS_PARAMS[assetClass];
    
    // Safety check for undefined params
    if (!baseParams) {
      console.warn(`No parameters found for asset class: ${assetClass}`);
      assetReturns[assetClass] = 0;
      continue;
    }
    
    const regime = MARKET_REGIMES[currentRegime];
    
    // Convert CAGR to AAGR for Monte Carlo sampling
    // The ASSET_CLASS_PARAMS contains CAGR values, but Monte Carlo needs AAGR
    const baseAAGR = cagr2aagr(baseParams.expectedReturn, baseParams.volatility);
    
    // Apply regime adjustments to base parameters
    let adjustedReturn = baseAAGR;  // Start with AAGR for proper Monte Carlo sampling
    let adjustedVolatility = baseParams.volatility;
    
    // Map asset classes to regime adjustment keys
    const adjustmentKey = assetClass === 'usStocks' ? 'stocks' :
                         assetClass === 'intlStocks' ? 'intlStocks' :
                         assetClass === 'bonds' ? 'bonds' :
                         assetClass === 'reits' ? 'reits' : null;
    
    if (adjustmentKey && regime.assetAdjustments[adjustmentKey]) {
      const adjustment = regime.assetAdjustments[adjustmentKey];
      // Blend regime return with asset-specific return (both should be AAGR for Monte Carlo)
      // Convert regime mean return to AAGR if needed (assuming it's CAGR)
      const regimeAAGR = cagr2aagr(regime.meanReturn, adjustedVolatility * adjustment.volMultiplier);
      adjustedReturn = (regimeAAGR * 0.6 + baseAAGR * 0.4) * adjustment.returnMultiplier;
      adjustedVolatility = baseParams.volatility * adjustment.volMultiplier;
    } else if (assetClass === 'cash') {
      // Cash is less affected by regimes
      adjustedReturn = baseAAGR;  // Use AAGR for cash too
      adjustedVolatility = baseParams.volatility * (currentRegime === 'crisis' ? 1.5 : 1.0);
    }
    
    // Apply additional regime adjustments if provided (e.g., from near-retirement adjustments)
    if (regimeAdjustments) {
      if (regimeAdjustments.volatilityMultiplier) {
        adjustedVolatility *= regimeAdjustments.volatilityMultiplier;
      }
      if (regimeAdjustments.meanMultiplier) {
        adjustedReturn *= regimeAdjustments.meanMultiplier;
      }
    }
    
    // Apply user overrides if provided
    if (userOverrides && userOverrides.expectedReturn !== undefined) {
      const blendWeight = userOverrides.blendingWeight ?? 0.5; // Default 50/50 blend
      
      // For user override, we assume it's CAGR && convert to AAGR
      const userAAGR = userOverrides.returnVolatility !== undefined ?
        cagr2aagr(userOverrides.expectedReturn, userOverrides.returnVolatility) :
        cagr2aagr(userOverrides.expectedReturn, adjustedVolatility);
      
      // Blend user-specified return with model return
      adjustedReturn = userAAGR * blendWeight + adjustedReturn * (1 - blendWeight);
      
      // Apply user volatility override if provided
      if (userOverrides.returnVolatility !== undefined) {
        adjustedVolatility = userOverrides.returnVolatility * blendWeight + 
                           adjustedVolatility * (1 - blendWeight);
      }
    }
    
    // Generate log-normal return with correct drift calibration
    // Use drift = ln(1 + arithmeticMean) - 0.5*σ² so E[return] = arithmeticMean
    const drift = Math.log(1 + adjustedReturn) - 0.5 * adjustedVolatility * adjustedVolatility;
    const diffusion = adjustedVolatility * Math.sqrt(timeStep) * correlatedZ[i];
    let assetReturn = Math.exp(drift * timeStep + diffusion) - 1;
    // Clamp extreme drawdowns for baseline runs if requested
    // Default: clamp large drawdowns in baseline (unless stress mode)
    const clampDrawdowns = (process.env.STRESS_MODE === '1') ? (process.env.NO_LARGE_DRAWDOWNS === '1') : true;
    if (clampDrawdowns) {
      const floor = Math.max(-0.99, parseFloat(process.env.MAX_ANNUAL_DRAWDOWN || '-0.30'));
      if (!Number.isNaN(floor)) {
        assetReturn = Math.max(assetReturn, floor);
      }
    }
    
    // Debug check for NaN
    if (isNaN(assetReturn)) {
      console.error(`NaN in asset return for ${assetClass}:`);
      console.error('  adjustedReturn:', adjustedReturn);
      console.error('  adjustedVolatility:', adjustedVolatility);
      console.error('  drift:', drift);
      console.error('  diffusion:', diffusion);
      console.error('  correlatedZ[i]:', correlatedZ[i]);
    }
    
    assetReturns[assetClass] = assetReturn;
    const contribution = assetReturn * allocations[i];
    portfolioReturn += contribution;
    
    // Debug check
    if (isNaN(portfolioReturn)) {
      console.error('NaN detected in portfolio return accumulation:');
      console.error('  assetClass:', assetClass);
      console.error('  assetReturn:', assetReturn);
      console.error('  allocation:', allocations[i]);
      console.error('  contribution:', contribution);
      console.error('  portfolioReturn:', portfolioReturn);
    }
  }
  
  return { 
    portfolioReturn, 
    assetReturns, 
    inflationRate: generatedInflationRate 
  };
}

// Full Guyton-Klinger Guardrails Implementation
interface GuytonKlingerParams {
  initialWithdrawalRate: number;
  currentWithdrawalRate: number;
  previousWithdrawal: number;
  portfolioValue: number;
  inflation: number;
  yearsSinceRetirement: number;
  remainingYears: number;
  isFirstYear: boolean;
  essentialPortion?: number; // Fraction of spending that is essential (default 0.55)
  priorYearRealReturn?: number; // NEW: Prior year's real portfolio return for PMR
}

interface GuytonKlingerResult {
  withdrawal: number;
  adjustmentType: 'none' | 'capital-preservation' | 'prosperity' | 'portfolio-management' | 'inflation';
  adjustmentReason: string;
  withdrawalRate: number;
}

function applyGuytonKlingerGuardrails(params: GuytonKlingerParams): GuytonKlingerResult {
  const {
    initialWithdrawalRate,
    currentWithdrawalRate,
    previousWithdrawal,
    portfolioValue,
    inflation,
    yearsSinceRetirement,
    remainingYears,
    isFirstYear,
    essentialPortion = 0.70, // Default to 70% essential, 30% discretionary (matching floor comment)
    priorYearRealReturn
  } = params;
  
  // Start with previous withdrawal
  let withdrawal = previousWithdrawal;
  let adjustmentType: GuytonKlingerResult['adjustmentType'] = 'none';
  let adjustmentReason = '';
  
  // Portfolio Management Rule (PMR): Skip inflation adjustment if prior year had negative real return
  // This preserves portfolio value after poor performance years
  const skipInflationAdjustment = priorYearRealReturn !== undefined && priorYearRealReturn < 0;
  
  // Rule 2: Capital Preservation Rule (CPR) - SMOOTHED to avoid cliff effects
  // Graduated adjustments instead of hard thresholds
  const withdrawalRatio = currentWithdrawalRate / initialWithdrawalRate;
  
  // FIX: Apply guardrails only to discretionary spending, not essential needs
  const discretionaryPortion = 1 - essentialPortion;
  
  if (withdrawalRatio > 1.3 && remainingYears > 15) {
    // Severe: >130% of initial rate - cut discretionary spending by 40%
    const discretionaryCut = previousWithdrawal * discretionaryPortion * 0.4;
    withdrawal = previousWithdrawal - discretionaryCut;
    adjustmentType = 'capital-preservation';
    adjustmentReason = `Withdrawal rate (${(currentWithdrawalRate * 100).toFixed(1)}%) exceeded 130% of initial rate`;
  }
  else if (withdrawalRatio > 1.2 && remainingYears > 15) {
    // High: 120-130% of initial rate - cut discretionary by 20-40% (graduated)
    const cutPercent = 0.2 + (withdrawalRatio - 1.2) * 2; // 20% to 40%
    const discretionaryCut = previousWithdrawal * discretionaryPortion * cutPercent;
    withdrawal = previousWithdrawal - discretionaryCut;
    adjustmentType = 'capital-preservation';
    adjustmentReason = `Withdrawal rate (${(currentWithdrawalRate * 100).toFixed(1)}%) exceeded 120% of initial rate`;
  }
  else if (withdrawalRatio > 1.1 && remainingYears > 15) {
    // Moderate: 110-120% of initial rate - cut discretionary by 10-20%
    const cutPercent = 0.1 + (withdrawalRatio - 1.1) * 1; // 10% to 20%
    const discretionaryCut = previousWithdrawal * discretionaryPortion * cutPercent;
    withdrawal = previousWithdrawal - discretionaryCut;
    adjustmentType = 'capital-preservation';
    adjustmentReason = `Withdrawal rate (${(currentWithdrawalRate * 100).toFixed(1)}%) above target range`;
  }
  // Rule 3: Prosperity Rule (PR) - SMOOTHED
  else if (withdrawalRatio < 0.7 && remainingYears > 15) {
    // Very low: <70% of initial rate - increase discretionary by 30%
    const discretionaryIncrease = previousWithdrawal * discretionaryPortion * 0.3;
    withdrawal = previousWithdrawal + discretionaryIncrease;
    adjustmentType = 'prosperity';
    adjustmentReason = `Withdrawal rate (${(currentWithdrawalRate * 100).toFixed(1)}%) well below initial rate`;
  }
  else if (withdrawalRatio < 0.8 && remainingYears > 15) {
    // Low: 70-80% of initial rate - increase discretionary by 10-30%
    const increasePercent = 0.1 + (0.8 - withdrawalRatio) * 2; // 10% to 30%
    const discretionaryIncrease = previousWithdrawal * discretionaryPortion * increasePercent;
    withdrawal = previousWithdrawal + discretionaryIncrease;
    adjustmentType = 'prosperity';
    adjustmentReason = `Withdrawal rate (${(currentWithdrawalRate * 100).toFixed(1)}%) below 80% of initial rate`;
  }
  // Rule 4: Inflation Rule (IR)
  // Apply inflation adjustment unless PMR triggered || within guardrails
  else if (!skipInflationAdjustment && !isFirstYear) {
    withdrawal = previousWithdrawal * (1 + inflation);
    adjustmentType = 'inflation';
    adjustmentReason = `St&&ard inflation adjustment of ${(inflation * 100).toFixed(1)}%`;
  }
  // Rule 5: Portfolio Management Rule application
  else if (skipInflationAdjustment) {
    adjustmentType = 'portfolio-management';
    adjustmentReason = `Skipped inflation adjustment due to negative real return (${(priorYearRealReturn! * 100).toFixed(1)}%)`;
  }
  
  // Ensure withdrawal never goes below essential needs floor (70% of original)
  const minimumWithdrawal = previousWithdrawal * essentialPortion;
  withdrawal = Math.max(withdrawal, minimumWithdrawal);
  
  // Calculate final withdrawal rate
  const finalWithdrawalRate = withdrawal / portfolioValue;
  
  return {
    withdrawal,
    adjustmentType,
    adjustmentReason,
    withdrawalRate: finalWithdrawalRate
  };
}

// Generate return with regime switching
function generateRegimeReturn(
  currentRegime: MarketRegime,
  stockAllocation: number,
  bondAllocation: number,
  yearsToRetirement?: number,
  rng?: RandomSource,  // NEW: Pass RNG for deterministic generation
  distribution: DistributionConfig = DEFAULT_DISTRIBUTION,  // NEW: Pass distribution config
  userOverrides?: { // NEW: Pass through user return overrides
    expectedReturn?: number;
    returnVolatility?: number;
    blendingWeight?: number;
  }
): { return: number; cashReturn: number; nextRegime: MarketRegime } {
  // IID log-normal baseline (unimodal): default unless stress mode is explicitly enabled
  if (process.env.STRESS_MODE !== '1' || process.env.IID_LOGNORMAL_BASELINE === '1') {
    // Use user overrides if provided, else fall back to CMA blended assumptions
    const er = (userOverrides && userOverrides.expectedReturn !== undefined)
      ? userOverrides.expectedReturn!
      : 0.06;
    const vol = (userOverrides && userOverrides.returnVolatility !== undefined)
      ? userOverrides.returnVolatility!
      : 0.12;
    const rrng = deriveRNG(rng, 'iid-lognormal');
    const z = rrng.normal();
    const drift = Math.log(1 + er) - 0.5 * vol * vol;
    const portfolioReturn = Math.exp(drift + vol * z) - 1;

    // Cash return from CMA (convert CAGR->AAGR for MC sampling)
    const cashCAGR = ASSET_CLASS_PARAMS.cash?.expectedReturn ?? 0.02;
    const cashVol = ASSET_CLASS_PARAMS.cash?.volatility ?? 0.01;
    const cashAAGR = cagr2aagr(cashCAGR, cashVol);
    return { return: portfolioReturn, cashReturn: cashAAGR, nextRegime: currentRegime };
  }
  const regime = MARKET_REGIMES[currentRegime];
  
  // FIX: Removed age-conditioned regime adjustments - market is unconditional
  // Sequence risk emerges naturally from the order of returns, not forced probabilities
  let adjustedRegime = { ...regime };
  
  // FIX: Use proper correlated asset returns for diversification
  // Convert allocations to asset class breakdown
  const cashAllocation = 1 - stockAllocation - bondAllocation;
  const assetAllocation = {
    stocks: stockAllocation * 0.7, // 70% US stocks
    intlStocks: stockAllocation * 0.3, // 30% international stocks for diversification
    bonds: bondAllocation,
    reits: 0, // Could be added if needed
    cash: cashAllocation
  };
  
  // Generate properly correlated returns that respect diversification
  const { portfolioReturn, assetReturns } = generateCorrelatedAssetReturns(
    assetAllocation,
    currentRegime,
    1, // Annual time step
    undefined, // regime adjustments
    rng, // Pass RNG
    distribution, // Pass distribution
    userOverrides // Pass user overrides
  );
  let pr = portfolioReturn;
  // Default: clamp extreme drawdowns in baseline (unless stress mode)
  const clampDrawdownsPR = (process.env.STRESS_MODE === '1') ? (process.env.NO_LARGE_DRAWDOWNS === '1') : true;
  if (clampDrawdownsPR) {
    const floor = Math.max(-0.99, parseFloat(process.env.MAX_ANNUAL_DRAWDOWN || '-0.30'));
    if (!Number.isNaN(floor)) {
      pr = Math.max(pr, floor);
    }
  }
  const cashReturn = assetReturns.cash || 0.02; // Default 2% if not available
  
  // Debug check for NaN
  if (isNaN(portfolioReturn)) {
    console.error('NaN detected in generateRegimeReturn:');
    console.error('  currentRegime:', currentRegime);
    console.error('  assetAllocation:', assetAllocation);
    console.error('  assetReturns:', assetReturns);
  }
  
  // Determine next regime
  let nextRegime = currentRegime;
  const rrng_g = deriveRNG(rng, 'regime-transition');
  const rand = rrng_g.next();
  let cumProb = 0;
  
  for (const [nextRegimeKey, prob] of Object.entries(adjustedRegime.transitionProbs)) {
    cumProb += prob;
    if (rand <= cumProb) {
      nextRegime = nextRegimeKey as MarketRegime;
      break;
    }
  }
  
  return { return: pr, cashReturn, nextRegime };
}

// Enhanced retirement scenario with correlated returns && Guyton-Klinger
export function runEnhancedRetirementScenario(
  params: RetirementMonteCarloParams,
  returnConfig: ReturnTypeConfig = DEFAULT_RETURN_CONFIG,
  randomSeeds?: number[],  // Optional pre-generated random seeds for antithetic variates
  distribution: DistributionConfig = DEFAULT_DISTRIBUTION,
  useAntithetic: boolean = false, // NEW: Flag for antithetic variates
  rngArg?: RandomSource // NEW: Optional RNG instance for determinism
): {
  success: boolean;
  endingBalance: number;
  yearsUntilDepletion: number | null;
  yearlyCashFlows: Array<{
    year: number;
    age: number;
    portfolioBalance: number;
    guaranteedIncome: number;
    withdrawal: number;
    netCashFlow: number;
    investmentReturn?: number;
    adjustmentType?: string;
    adjustmentReason?: string;
    ltcCost?: number;
    ltcCareType?: string;
    ltcState?: string;
    marketRegime?: string;
  }>;
  guytonKlingerAdjustments: number;
  ltcEvent: {
    occurred: boolean;
    totalCost: number;
    duration: number;
    careType: 'home' | 'assisted' | 'nursing' | null;
  };
  ltcAnalysis: LTCModelingResult;
} {
  const {
    currentAge,
    retirementAge,
    lifeExpectancy,
    currentRetirementAssets,
    annualGuaranteedIncome: initialGuaranteedIncome,
    annualRetirementExpenses,
    annualHealthcareCosts = 0,
    healthcareInflationRate = 0.0269,
    expectedReturn,
    returnVolatility,
    inflationRate,
    stockAllocation,
    bondAllocation,
    cashAllocation,
    withdrawalRate,
    useGuardrails = false,
    taxRate,
    annualSavings = 0,  // Default to 0 if undefined
    legacyGoal = 0,
    spouseAge,
    spouseLifeExpectancy,
    userAnnualSavings,
    spouseAnnualSavings,
    spouseRetirementAge,
    monthlyContribution401k = 0,  // Default to 0 if undefined
    monthlyContributionIRA = 0,  // Default to 0 if undefined
    monthlyContributionRothIRA = 0,  // Default to 0 if undefined
    monthlyContributionBrokerage = 0,  // Default to 0 if undefined
    socialSecurityClaimAge,
    spouseSocialSecurityClaimAge,
    socialSecurityBenefit,
    spouseSocialSecurityBenefit,
    pensionBenefit,
    spousePensionBenefit,
    partTimeIncomeRetirement,
    spousePartTimeIncomeRetirement
  } = params;
  // Baseline: enable guardrails by default unless explicitly disabled or stress mode is on
  const guardrailsEnabled = (typeof useGuardrails === 'boolean')
    ? useGuardrails
    : (process.env.STRESS_MODE === '1' ? false : true);

  // Convert returns based on configuration
  // For Monte Carlo sampling, we need arithmetic returns (AAGR) to properly model expected values
  // For deterministic projections, we need geometric returns (CAGR) to properly model compound growth
  let monteCarloReturn = expectedReturn;
  let projectionReturn = expectedReturn;
  
  if (returnConfig.inputReturnType === 'CAGR') {
    // Input is CAGR (geometric return)
    if (returnConfig.useArithmeticForMonteCarlo) {
      // Convert CAGR to AAGR for Monte Carlo sampling
      monteCarloReturn = cagr2aagr(expectedReturn, returnVolatility);
    }
    projectionReturn = expectedReturn; // Already CAGR
  } else {
    // Input is AAGR (arithmetic return)
    monteCarloReturn = expectedReturn; // Already AAGR
    if (returnConfig.useGeometricForProjections) {
      // Convert AAGR to CAGR for projections
      projectionReturn = aagr2cagr(expectedReturn, returnVolatility);
    }
  }
  
  // Initialize nominal dollar configuration
  const useNominalDollars = shouldUseNominalDollars(params);
  const displayInTodaysDollars = shouldDisplayInTodaysDollars(params);
  const inflationRates = getInflationRates(params);
  
  // Initialize maximum simulation years (cap at 60 years of retirement || age 120)
  const maxSimulationYears = Math.min(60, Math.max(120 - retirementAge, 120 - (spouseAge || retirementAge)));

  // Initialize RNG with seed if provided
  const seed = randomSeeds?.[0] ?? Math.floor(Date.now() * 1000);
  const rng: RandomSource = rngArg ?? (useAntithetic ? new AntitheticRNG(seed) : new RNG(seed));

  let portfolioBalance = currentRetirementAssets;
  const yearlyCashFlows = [];
  let yearsUntilDepletion: number | null = null;
  let guytonKlingerAdjustments = 0;
  
  // Track MAGI history for IRMAA 2-year lookback
  // Initialize with pre-retirement MAGI (last 2 years of working income)
  const preRetirementMAGI = (params.userAnnualIncome || 0) + (params.spouseAnnualIncome || 0);
  const magiHistory: number[] = [preRetirementMAGI, preRetirementMAGI];
  
  // NEW: Track shortfall metrics for more accurate success measurement
  let totalShortfall = 0;
  let shortfallYears = 0;
  let maxConsecutiveShortfallYears = 0;
  let currentConsecutiveShortfallYears = 0;
  const shortfallDetails: Array<{ year: number; age: number; shortfall: number }> = [];
  
  let age = currentAge;
  let year = 0;
  
  // Track asset buckets
  let currentBuckets: AssetBuckets = {
    taxDeferred: params.assetBuckets.taxDeferred,
    taxFree: params.assetBuckets.taxFree,
    capitalGains: params.assetBuckets.capitalGains,
    cashEquivalents: params.assetBuckets.cashEquivalents,
    totalAssets: params.assetBuckets.totalAssets
  };

  // Enhanced asset allocation including international stocks && REITs
  const enhancedAllocation = {
    stocks: stockAllocation * 0.7,      // 70% of equity in US stocks
    intlStocks: stockAllocation * 0.3,  // 30% of equity in international
    bonds: bondAllocation,
    reits: 0,                           // Could be enhanced with user input
    cash: cashAllocation
  };

  // Initialize for accumulation phase
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  
  // Initialize market regime with sequence of returns risk consideration
  let currentMarketRegime = getInitialRegime(yearsToRetirement, rng);

  // Accumulation phase
  for (let accumYear = 0; accumYear < yearsToRetirement; accumYear++) {
    const currentYearAge = currentAge + accumYear;
    const yearsUntilRetirement = retirementAge - currentYearAge;
    
    // Generate returns with market regime switching for sequence of returns risk
    const regimeResult = generateRegimeReturn(
      currentMarketRegime,
      stockAllocation,
      bondAllocation,
      yearsUntilRetirement, // Pass years to retirement for sequence risk adjustment
      rng,  // Pass RNG for deterministic generation
      distribution,  // Pass distribution config
      { // Pass user return overrides if specified
        expectedReturn: getAdjustedReturn(params.userExpectedReturn || params.expectedReturn, inflationRates.general, useNominalDollars),
        returnVolatility: params.returnVolatility,
        blendingWeight: 0.5 // Default 50/50 blend between user && model
      }
    );
    currentMarketRegime = regimeResult.nextRegime;
    // Use return as-is (expected return should already be nominal if useNominalDollars is true)
    const portfolioReturn = regimeResult.return;
    const cashReturn = regimeResult.cashReturn || 0.02; // Default 2% if not available
    
    // Dynamic savings with staggered retirement support && wage growth (4% historical average)
    let dynamicAnnualSavings = annualSavings;
    
    // Check if we have individual spouse savings data (supports staggered || simultaneous retirement)
    if (userAnnualSavings !== undefined && spouseAnnualSavings !== undefined && spouseRetirementAge) {
      // Use individual savings with wage growth modeling (4% annual growth)
      dynamicAnnualSavings = 0;
      const currentUserAge = currentAge + accumYear;
      const currentSpouseAge = spouseAge ? spouseAge + accumYear : undefined;
      const userRetired = currentUserAge >= retirementAge;
      const spouseRetired = currentSpouseAge ? currentSpouseAge >= spouseRetirementAge : true;
      
      // Apply wage growth to savings (assuming constant savings rate)
      if (!userRetired && params.userAnnualIncome) {
        const futureUserIncome = calculateProgressiveWageGrowth(
          params.userAnnualIncome,
          currentAge,
          currentUserAge
        );
        // Maintain savings rate: (currentSavings / currentIncome) * futureIncome
        const savingsRate = userAnnualSavings / params.userAnnualIncome;
        const futureUserSavings = futureUserIncome * savingsRate;
        dynamicAnnualSavings += futureUserSavings;
      } else if (!userRetired) {
        // Fallback: Apply standard 4% growth to savings directly
        const futureUserSavings = calculateFutureSavings(
          userAnnualSavings,
          userAnnualSavings / 0.15, // Estimate income assuming 15% savings rate
          0.15,
          accumYear
        );
        dynamicAnnualSavings += futureUserSavings;
      }
      
      if (!spouseRetired && params.spouseAnnualIncome) {
        const futureSpouseIncome = calculateProgressiveWageGrowth(
          params.spouseAnnualIncome,
          spouseAge || currentAge,
          currentSpouseAge || (currentAge + accumYear)
        );
        // Maintain savings rate: (currentSavings / currentIncome) * futureIncome
        const spouseSavingsRate = spouseAnnualSavings / params.spouseAnnualIncome;
        const futureSpouseSavings = futureSpouseIncome * spouseSavingsRate;
        dynamicAnnualSavings += futureSpouseSavings;
      } else if (!spouseRetired) {
        // Fallback: Apply standard 4% growth to savings directly
        const futureSpouseSavings = calculateFutureSavings(
          spouseAnnualSavings,
          spouseAnnualSavings / 0.15, // Estimate income assuming 15% savings rate
          0.15,
          accumYear
        );
        dynamicAnnualSavings += futureSpouseSavings;
      }
    } else {
      // Legacy debt payoff bonus logic with wage growth
      // Apply 4% wage growth to base annual savings
      if (params.userAnnualIncome && params.spouseAnnualIncome) {
        // Use household income growth to project savings
        const householdGrowth = calculateHouseholdIncomeGrowth(
          params.userAnnualIncome,
          params.spouseAnnualIncome,
          currentAge,
          spouseAge || currentAge,
          accumYear
        );
        // Maintain savings rate as income grows
        const currentHouseholdIncome = params.userAnnualIncome + params.spouseAnnualIncome;
        const savingsRate = annualSavings / currentHouseholdIncome;
        dynamicAnnualSavings = householdGrowth.totalHouseholdIncome * savingsRate;
      } else {
        // Fallback: Apply 4% compound growth to savings directly
        dynamicAnnualSavings = calculateFutureSavings(
          annualSavings,
          annualSavings / 0.15, // Estimate income from savings
          0.15,
          accumYear
        );
      }
      
      // Legacy debt payoff bonus logic (with wage-grown base)
      const yearsFromRetirement = yearsToRetirement - accumYear;
      if (yearsFromRetirement <= 15 && yearsFromRetirement >= 1) {
        const potentialDebtPayoffBonus = dynamicAnnualSavings * 0.15;
        const rampUpFactor = Math.min(1, (16 - yearsFromRetirement) / 10);
        dynamicAnnualSavings += potentialDebtPayoffBonus * rampUpFactor;
      }
    }

    // Allocate savings to buckets based on actual contributions with proper tax treatment
    // Include both user && spouse contributions when in accumulation phase
    const isUserRetired = age >= retirementAge;
    const isSpouseRetired = spouseAge ? (spouseAge >= spouseRetirementAge) : true;
    
    // For now, allocate all retirement contributions to tax-deferred (401k/403b/traditional IRA)
    // In the future, we can add specific IRA contribution fields to the form
    let totalTaxDeferred = 0;
    let totalTaxFree = 0;
    let totalTaxable = 0;
    
    // Apply contribution limits with annual growth (2% CAGR based on 25-year historical average)
    // Most people max out their 401(k) limits, so this is critical for accurate modeling
    const currentYear = 2025 + accumYear;
    
    // Calculate birth dates for limit calculations (approximate from current age)
    const userBirthDate = new Date();
    userBirthDate.setFullYear(userBirthDate.getFullYear() - currentAge - accumYear);
    
    const spouseBirthDate = spouseAge ? (() => {
      const date = new Date();
      date.setFullYear(date.getFullYear() - spouseAge - accumYear);
      return date;
    })() : undefined;
    
    // If we have specific contribution parameters, use them with limits applied
    if (params.monthlyContribution401k || params.monthlyContributionIRA || params.monthlyContributionRothIRA ||
        params.spouseMonthlyContribution401k || params.spouseMonthlyContributionIRA || params.spouseMonthlyContributionRothIRA) {
      
      // Apply contribution limits with annual growth
      const contributionsWithLimits = calculateAnnualContributionsWithLimits(
        {
          monthlyContribution401k: !isUserRetired ? params.monthlyContribution401k : 0,
          monthlyContributionIRA: !isUserRetired ? params.monthlyContributionIRA : 0,
          monthlyContributionRothIRA: !isUserRetired ? params.monthlyContributionRothIRA : 0,
          spouseMonthlyContribution401k: !isSpouseRetired ? params.spouseMonthlyContribution401k : 0,
          spouseMonthlyContributionIRA: !isSpouseRetired ? params.spouseMonthlyContributionIRA : 0,
          spouseMonthlyContributionRothIRA: !isSpouseRetired ? params.spouseMonthlyContributionRothIRA : 0,
        },
        userBirthDate,
        spouseBirthDate,
        currentYear
      );
      
      // Allocate limited contributions to appropriate buckets
      totalTaxDeferred = contributionsWithLimits.limitedContributions.user401k + 
                        contributionsWithLimits.limitedContributions.spouse401k +
                        contributionsWithLimits.limitedContributions.userIRA +
                        contributionsWithLimits.limitedContributions.spouseIRA;
      
      totalTaxFree = contributionsWithLimits.limitedContributions.userRothIRA +
                    contributionsWithLimits.limitedContributions.spouseRothIRA;
      
      // Any excess savings beyond retirement account limits go to taxable accounts
      const totalLimitedContributions = contributionsWithLimits.totalHouseholdContributions;
      totalTaxable = Math.max(0, dynamicAnnualSavings - totalLimitedContributions);
      
    } else {
      // Fallback: use typical allocation with estimated contribution limits applied
      // This provides realistic modeling even when specific contribution data isn't available
      // Wage growth has already been applied to dynamicAnnualSavings above
      if (!isUserRetired && params.userAnnualSavings) {
        // Calculate user's share of the wage-grown savings
        const originalUserShare = (params.annualSavings && params.annualSavings > 0) 
          ? params.userAnnualSavings / params.annualSavings 
          : 0.5; // Default to 50% share if annualSavings is undefined || 0
        const userSavings = originalUserShare * dynamicAnnualSavings;
        
        // Apply estimated 401(k) limit (most people max out)
        const user401kLimit = getFutureContributionLimit('401k', userBirthDate, currentYear, false);
        const userTaxDeferred = Math.min(userSavings * 0.70, user401kLimit);
        const userTaxFree = Math.min(userSavings * 0.20, getFutureContributionLimit('roth-ira', userBirthDate, currentYear, false));
        const userTaxable = userSavings - userTaxDeferred - userTaxFree;
        
        totalTaxDeferred += userTaxDeferred;
        totalTaxFree += userTaxFree;
        totalTaxable += Math.max(0, userTaxable);
      }
      
      if (!isSpouseRetired && params.spouseAge && params.spouseAnnualSavings) {
        // Calculate spouse's share of the wage-grown savings
        const originalSpouseShare = (params.annualSavings && params.annualSavings > 0)
          ? params.spouseAnnualSavings / params.annualSavings
          : 0.5; // Default to 50% share if annualSavings is undefined || 0
        const spouseSavings = originalSpouseShare * dynamicAnnualSavings;
        
        // Apply estimated contribution limits for spouse
        const spouse401kLimit = spouseBirthDate ? 
          getFutureContributionLimit('401k', spouseBirthDate, currentYear, false) : 23000;
        const spouseTaxDeferred = Math.min(spouseSavings * 0.70, spouse401kLimit);
        const spouseRothLimit = spouseBirthDate ? 
          getFutureContributionLimit('roth-ira', spouseBirthDate, currentYear, false) : 7000;
        const spouseTaxFree = Math.min(spouseSavings * 0.20, spouseRothLimit);
        const spouseTaxable = spouseSavings - spouseTaxDeferred - spouseTaxFree;
        
        totalTaxDeferred += spouseTaxDeferred;
        totalTaxFree += spouseTaxFree;
        totalTaxable += Math.max(0, spouseTaxable);
      }
    }
    
    const totalSpecifiedContributions = totalTaxDeferred + totalTaxFree + totalTaxable;
      
    if (totalSpecifiedContributions > 0) {
      // Use actual specified contributions with proper tax treatment
      currentBuckets.taxDeferred += totalTaxDeferred;
      currentBuckets.taxFree += totalTaxFree;
      currentBuckets.capitalGains += totalTaxable;
      
      // If there's additional savings beyond specified contributions, allocate proportionally
      if (dynamicAnnualSavings > totalSpecifiedContributions) {
        const additionalSavings = dynamicAnnualSavings - totalSpecifiedContributions;
        // Allocate additional savings based on existing contribution pattern
        const allocationRatio = totalSpecifiedContributions > 0 ? {
          taxDeferred: totalTaxDeferred / totalSpecifiedContributions,
          taxFree: totalTaxFree / totalSpecifiedContributions,
          taxable: totalTaxable / totalSpecifiedContributions
        } : { taxDeferred: 0.7, taxFree: 0.2, taxable: 0.1 };
        
        currentBuckets.taxDeferred += additionalSavings * allocationRatio.taxDeferred;
        currentBuckets.taxFree += additionalSavings * allocationRatio.taxFree;
        currentBuckets.capitalGains += additionalSavings * allocationRatio.taxable;
      }
    } else {
      // Fallback to 70/20/10 allocation if no specific contributions
      currentBuckets.taxDeferred += dynamicAnnualSavings * 0.70;
      currentBuckets.taxFree += dynamicAnnualSavings * 0.20;
      currentBuckets.capitalGains += dynamicAnnualSavings * 0.10;
    }
    
    // Apply correlated returns to each bucket
    currentBuckets.taxDeferred *= (1 + portfolioReturn);
    currentBuckets.taxFree *= (1 + portfolioReturn);
    currentBuckets.capitalGains *= (1 + portfolioReturn);
    currentBuckets.cashEquivalents *= (1 + cashReturn); // Use cash-specific return
    
    currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    portfolioBalance = currentBuckets.totalAssets;
    
    // Track pre-retirement MAGI (wages + investment income)
    // This maintains the 2-year history leading into retirement
    const preRetirementWages = (params.userAnnualIncome || 0) + (params.spouseAnnualIncome || 0);
    const preRetirementMAGI = preRetirementWages * Math.pow(1.03, accumYear); // Assume 3% wage growth
    magiHistory.push(preRetirementMAGI);
    // Keep only the last 2 years for the lookback window
    if (magiHistory.length > 2 && accumYear < (retirementAge - currentAge - 2)) {
      magiHistory.shift();
    }

    yearlyCashFlows.push({
      year: year + 1,
      age: age + 1,
      portfolioBalance: portfolioBalance, // Temporarily removed Math.max to preserve NaN for debugging
      guaranteedIncome: 0,
      withdrawal: -dynamicAnnualSavings,
      netCashFlow: dynamicAnnualSavings,
      marketRegime: currentMarketRegime,
      investmentReturn: portfolioReturn // Add return for debugging
    });

    if (portfolioBalance <= 0 && yearsUntilDepletion === null) {
      yearsUntilDepletion = accumYear + 1;
      break;
    }

    age++;
    year++;
  }
  
  // Distribution phase with Guyton-Klinger && Dynamic Mortality
  // FIXED: Initial withdrawal should be based on actual needs, not withdrawal rate
  let plannedWithdrawal = withdrawalRate * portfolioBalance; // For Guyton-Klinger calculations
  let previousPortfolioValue = portfolioBalance;
  let annualGuaranteedIncome = initialGuaranteedIncome;
  
  // Track expenses separately with dynamic withdrawal capability
  let currentHealthcareCosts = annualHealthcareCosts;
  let baseNonHealthcareCosts = annualRetirementExpenses - annualHealthcareCosts;
  
  // Split non-healthcare expenses into essential && discretionary
  // Default: 75% essential, 25% discretionary (or minimum $24k/year discretionary)
  const discretionaryRatio = params.discretionaryExpenseRatio || 0.25;
  const minDiscretionary = params.minDiscretionaryExpenses || 24000; // $2k/month default
  
  let baseEssentialExpenses = baseNonHealthcareCosts * (1 - discretionaryRatio);
  let baseDiscretionaryExpenses = Math.max(
    baseNonHealthcareCosts * discretionaryRatio,
    minDiscretionary
  );
  
  // Adjust if discretionary minimum pushes total too high
  if (baseEssentialExpenses + baseDiscretionaryExpenses > baseNonHealthcareCosts) {
    baseEssentialExpenses = baseNonHealthcareCosts - baseDiscretionaryExpenses;
  }
  
  let currentEssentialExpenses = baseEssentialExpenses;
  let currentDiscretionaryExpenses = baseDiscretionaryExpenses;
  let currentNonHealthcareCosts = currentEssentialExpenses + currentDiscretionaryExpenses;
  
  // Initialize enhanced LTC modeling
  const userGender = params.userGender || 'male'; // Default if not specified
  const userHealthStatus = params.userHealthStatus || 'good';
  // Use retirement state if specified, otherwise default to TX
  const retirementState = params.retirementState || 'TX'; // Default state if not specified
  
  // Create LTC insurance policy object
  const ltcInsurance: LTCInsurancePolicy = params.hasLongTermCareInsurance ? {
    type: 'traditional',
    dailyBenefit: 200, // $200/day default
    benefitPeriodYears: 3, // 3-year benefit period
    eliminationPeriodDays: 90, // 90-day elimination period
    inflationProtection: '3%_compound',
    premiumAnnual: calculateLTCInsurancePremium(
      currentAge,
      userGender as 'male' | 'female',
      userHealthStatus,
      {
        type: 'traditional',
        dailyBenefit: 200,
        benefitPeriodYears: 3,
        eliminationPeriodDays: 90,
        inflationProtection: '3%_compound',
        policyStartAge: currentAge - 10, // Assume bought 10 years ago
        sharedCareBenefit: spouseAge !== undefined
      }
    ),
    policyStartAge: currentAge - 10 // Assume policy purchased 10 years ago
  } : {
    type: 'none',
    dailyBenefit: 0,
    benefitPeriodYears: 0,
    eliminationPeriodDays: 0,
    inflationProtection: 'none',
    premiumAnnual: 0,
    policyStartAge: currentAge
  };
  
  // Set up spouse LTC insurance if applicable
  const spouseLTCInsurance: LTCInsurancePolicy = spouseAge && params.hasLongTermCareInsurance ? {
    type: 'traditional',
    dailyBenefit: 200,
    benefitPeriodYears: 3,
    eliminationPeriodDays: 90,
    inflationProtection: '3%_compound',
    premiumAnnual: calculateLTCInsurancePremium(
      spouseAge,
      params.spouseGender as 'male' | 'female' || 'female',
      params.spouseHealthStatus || 'good',
      {
        type: 'traditional',
        dailyBenefit: 200,
        benefitPeriodYears: 3,
        eliminationPeriodDays: 90,
        inflationProtection: '3%_compound',
        policyStartAge: spouseAge - 10,
        sharedCareBenefit: true
      }
    ),
    policyStartAge: spouseAge - 10
  } : {
    type: 'none',
    dailyBenefit: 0,
    benefitPeriodYears: 0,
    eliminationPeriodDays: 0,
    inflationProtection: 'none',
    premiumAnnual: 0,
    policyStartAge: spouseAge || currentAge
  };
  
  // Model LTC events for ALL users (both insured && uninsured)
  // For insured users: Insurance will pay benefits if an event occurs
  // For uninsured users: They pay full out-of-pocket costs if an event occurs
  let ltcModelingResult;
  
  // Always model potential LTC events
  ltcModelingResult = modelLTCEvents(
    retirementAge,
    Math.max(lifeExpectancy, spouseLifeExpectancy || 0),
    userGender as 'male' | 'female',
    userHealthStatus,
    retirementState,
    ltcInsurance,  // Pass the insurance policy (will be 'none' type if uninsured)
    spouseAge ? {
      startAge: spouseAge + (retirementAge - currentAge),
      gender: params.spouseGender as 'male' | 'female' || 'female',
      healthStatus: params.spouseHealthStatus || 'good',
      ltcInsurance: spouseLTCInsurance
    } : undefined,
    rng
  );
  
  // Track survival status for dynamic mortality
  let userAlive = true;
  let spouseAlive = spouseAge !== undefined;
  let distYear = 0;

  // Simple LTC-as-goal override per requirements:
  // - 75k/year per person
  // - 2 years duration
  // - 40% probability per person
  // - Starts at age 91 (two-year window: ages 91 and 92)
  const rrngSimpleLTC = deriveRNG(rng, 'simple-ltc-flags');
  const userSimpleLTCOccurs = rrngSimpleLTC.next() < 0.40;
  const spouseSimpleLTCOccurs = spouseAlive ? (rrngSimpleLTC.next() < 0.40) : false;
  
  // Track prior year's real return for Guyton-Klinger PMR
  let priorYearRealReturn: number | undefined = undefined;
  
  // Get withdrawal timing preference (default to 'end' for backward compatibility)
  const withdrawalTiming = params.withdrawalTiming || 'end';
  
  // Continue simulation while at least one person is alive OR portfolio has assets
  // This properly captures longevity risk && portfolio sustainability
  while ((userAlive || spouseAlive || portfolioBalance > 0) && distYear < maxSimulationYears) { // Cap at 60 years of retirement
    const currentRetirementAge = retirementAge + distYear;
    // Estimate remaining years based on typical life expectancy (for planning purposes)
    const remainingYears = Math.max(90 - currentRetirementAge, 10);
    
    // Generate returns with market regime switching for sequence of returns risk
    const regimeResult = generateRegimeReturn(
      currentMarketRegime,
      stockAllocation,
      bondAllocation,
      0, // In retirement, sequence risk is ongoing
      rng,  // Pass RNG for deterministic generation
      distribution,  // Pass distribution config
      { // Pass user return overrides if specified
        expectedReturn: getAdjustedReturn(params.userExpectedReturn || params.expectedReturn, inflationRates.general, useNominalDollars),
        returnVolatility: params.returnVolatility,
        blendingWeight: 0.5 // Default 50/50 blend between user && model
      }
    );
    currentMarketRegime = regimeResult.nextRegime;
    // Use return as-is (expected return should already be nominal if useNominalDollars is true)
    const portfolioReturn = regimeResult.return;
    const cashReturn = regimeResult.cashReturn || 0.02; // Default 2% if not available
    
    // Store initial bucket values for withdrawal timing calculations
    const bucketsBeforeReturns = {
      taxDeferred: currentBuckets.taxDeferred,
      taxFree: currentBuckets.taxFree,
      capitalGains: currentBuckets.capitalGains,
      cashEquivalents: currentBuckets.cashEquivalents,
      totalAssets: currentBuckets.totalAssets
    };
    
    // Apply returns based on withdrawal timing
    if (withdrawalTiming === 'end') {
      // Traditional approach: Apply full year returns first, then withdraw
      currentBuckets.taxDeferred *= (1 + portfolioReturn);
      currentBuckets.taxFree *= (1 + portfolioReturn);
      currentBuckets.capitalGains *= (1 + portfolioReturn);
      currentBuckets.cashEquivalents *= (1 + cashReturn);
      currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                  currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    } else if (withdrawalTiming === 'mid') {
      // Mid-year: Apply half-year returns before withdrawal
      const halfYearReturn = Math.pow(1 + portfolioReturn, 0.5) - 1;
      const halfCashReturn = Math.pow(1 + cashReturn, 0.5) - 1;
      currentBuckets.taxDeferred *= (1 + halfYearReturn);
      currentBuckets.taxFree *= (1 + halfYearReturn);
      currentBuckets.capitalGains *= (1 + halfYearReturn);
      currentBuckets.cashEquivalents *= (1 + halfCashReturn);
      currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                  currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    }
    // For 'start' timing, we don't apply returns yet - withdrawal happens first
    
    // Calculate real return for PMR tracking (after first year)
    if (distYear > 0) {
      // Get the inflation rate for this year
      const yearlyInflation = useNominalDollars ? 
        generateNormalRandom(inflationRates.general, 0.01, rng) : 0;
      
      // Calculate real return: (1 + nominal) / (1 + inflation) - 1
      const realReturn = (1 + portfolioReturn) / (1 + yearlyInflation) - 1;
      priorYearRealReturn = realReturn;
    }
    
    // Apply inflation to expenses based on nominal dollar setting
    if (useNominalDollars && distYear > 0) {
      const yearlyGeneralInflation = generateNormalRandom(inflationRates.general, 0.01, rng);
      
      // Healthcare typically inflates faster than general costs
      const yearlyHealthcareInflation = generateNormalRandom(inflationRates.healthcare, 0.012, rng); // Slightly higher volatility
      
      // Cap inflation in extreme scenarios to avoid unrealistic expense growth
      const cappedGeneralInflation = Math.min(Math.max(yearlyGeneralInflation, -0.02), 0.06);
      const cappedHealthcareInflation = Math.min(Math.max(yearlyHealthcareInflation, -0.01), 0.08); // Allow up to 8% healthcare inflation
      
      // Apply appropriate inflation rates to each expense category
      currentEssentialExpenses *= (1 + cappedGeneralInflation);
      currentDiscretionaryExpenses *= (1 + cappedGeneralInflation);
      currentHealthcareCosts *= (1 + cappedHealthcareInflation);
    }
    // In real dollar mode, expenses stay constant

    // Optional: Apply retirement spending "smile" (decline early, rise late)
    if (params.useSpendingSmile) {
      const earlyDeclineRate = params.spendingSmile?.earlyDeclineRate ?? 0.01; // 1% real decline
      const lateIncreaseRate = params.spendingSmile?.lateIncreaseRate ?? 0.01; // 1% real increase
      const transitionYear = params.spendingSmile?.transitionYear ?? 20;
      const yearsSinceRetire = distYear;
      let smileAdj = 1;
      if (yearsSinceRetire <= transitionYear) {
        smileAdj = Math.pow(1 - earlyDeclineRate, Math.max(0, yearsSinceRetire));
      } else {
        const lateYears = yearsSinceRetire - transitionYear;
        smileAdj = Math.pow(1 - earlyDeclineRate, transitionYear) * Math.pow(1 + lateIncreaseRate, Math.max(0, lateYears));
      }
      // Apply only to non-healthcare costs (healthcare typically rises)
      currentEssentialExpenses *= smileAdj;
      currentDiscretionaryExpenses *= smileAdj;
      currentNonHealthcareCosts = currentEssentialExpenses + currentDiscretionaryExpenses;
    }
    
    // Dynamic withdrawal adjustments based on market conditions && portfolio performance
    let spendingAdjustmentFactor = 1.0;
    let spendingAdjustmentReason = 'normal';
    
    // Check portfolio health relative to plan
    const currentFundingRatio = portfolioBalance / (previousPortfolioValue || currentBuckets.totalAssets);
    const yearsRemaining = Math.max(90 - (retirementAge + distYear), 10);
    const sustainableWithdrawalRate = yearsRemaining > 0 ? 1 / yearsRemaining : 0.04;
    const currentWithdrawalRate = (currentEssentialExpenses + currentDiscretionaryExpenses + currentHealthcareCosts) / portfolioBalance;
    
    // Bear-only mode: only adjust during bear/crisis regimes (20%+ drawdowns)
    const bearOnly = params.bearOnlyDynamicWithdrawals === true;
    const isBearOrCrisis = currentMarketRegime === 'bear' || currentMarketRegime === 'crisis';
    
    // Adjust discretionary spending based on market regime && portfolio performance
    if (currentMarketRegime === 'crisis') {
      // Crisis: Cut discretionary by 50%
      spendingAdjustmentFactor = 0.5;
      spendingAdjustmentReason = 'crisis-market-cut';
    } else if (currentMarketRegime === 'bear') {
      // Bear market: Cut discretionary by 30%
      spendingAdjustmentFactor = 0.7;
      spendingAdjustmentReason = 'bear-market-cut';
    } else if (!bearOnly && currentFundingRatio < 0.85 && currentWithdrawalRate > sustainableWithdrawalRate * 1.2) {
      // Portfolio down >15% && withdrawal rate unsustainable: Cut discretionary by 40% (only if not bear-only mode)
      spendingAdjustmentFactor = 0.6;
      spendingAdjustmentReason = 'portfolio-preservation';
    } else if (!bearOnly && currentFundingRatio < 0.95) {
      // Portfolio down 5-15%: Cut discretionary by 20% (only if not bear-only mode)
      spendingAdjustmentFactor = 0.8;
      spendingAdjustmentReason = 'moderate-cut';
    } else if (!bearOnly && currentMarketRegime === 'bull' && currentFundingRatio > 1.15) {
      // Bull market && portfolio up >15%: Allow 10% increase in discretionary (only if not bear-only mode)
      spendingAdjustmentFactor = 1.1;
      spendingAdjustmentReason = 'prosperity-increase';
    }
    
    // Apply adjustment only to discretionary expenses
    const adjustedDiscretionaryExpenses = currentDiscretionaryExpenses * spendingAdjustmentFactor;
    currentNonHealthcareCosts = currentEssentialExpenses + adjustedDiscretionaryExpenses;
    
    // Calculate LTC costs for this year from the pre-modeled events
    let currentLTCCost = 0;
    let currentLTCState = 'healthy';
    let ltcInsurancePremiums = 0;
    
    // Check if there are any LTC events happening this year
    for (const event of ltcModelingResult.ltcEvents) {
      const eventStartYear = event.startAge - retirementAge;
      const eventEndYear = eventStartYear + event.duration;
      
      if (distYear >= eventStartYear && distYear < eventEndYear) {
        // This event is active during this year
        const yearsIntoEvent = distYear - eventStartYear;
        const inflationMultiplier = Math.pow(1.045, yearsIntoEvent); // 4.5% LTC inflation
        const adjustedAnnualCost = event.careCostAnnual * inflationMultiplier;
        
        // Calculate insurance benefit if applicable
        let insuranceBenefit = 0;
        if (ltcInsurance.type !== 'none') {
          const daysIntoEvent = yearsIntoEvent * 365;
          if (daysIntoEvent >= ltcInsurance.eliminationPeriodDays) {
            // Past elimination period, insurance pays
            const adjustedDailyBenefit = ltcInsurance.dailyBenefit * 
              (ltcInsurance.inflationProtection === '3%_compound' ? 
                Math.pow(1.03, currentRetirementAge - ltcInsurance.policyStartAge) : 1);
            insuranceBenefit = Math.min(adjustedAnnualCost, adjustedDailyBenefit * 365);
          }
        }
        
        currentLTCCost += adjustedAnnualCost - insuranceBenefit;
        currentLTCState = event.state;
      }
    }
    
    // Add LTC insurance premiums if still paying them (typically stop at age 85 || when claim starts)
    if (currentRetirementAge < 85 && currentLTCState === 'healthy' && ltcInsurance.type !== 'none') {
      ltcInsurancePremiums = ltcInsurance.premiumAnnual;
      if (spouseAlive && spouseLTCInsurance.type !== 'none') {
        ltcInsurancePremiums += spouseLTCInsurance.premiumAnnual;
      }
    }
    
    // Add LTC cost && insurance premiums to total expenses
    // Calculate expense replacement when in LTC facility
    let expenseReplacementFactor = 0;
    if (currentLTCCost > 0 && currentLTCState !== 'healthy') {
      // Home care replaces some expenses (meals, cleaning, etc.)
      if (currentLTCState === 'home_care') {
        expenseReplacementFactor = 0.15; // 15% of regular expenses replaced
      }
      // Assisted living replaces housing, utilities, meals, etc.
      else if (currentLTCState === 'assisted_living') {
        expenseReplacementFactor = 0.40; // 40% of regular expenses replaced
      }
      // Nursing home replaces most living expenses
      else if (currentLTCState === 'nursing_home') {
        expenseReplacementFactor = 0.60; // 60% of regular expenses replaced
      }
    }
    
    // Reduce non-healthcare costs by the replacement factor when in LTC
    let adjustedNonHealthcareCosts = currentNonHealthcareCosts * (1 - expenseReplacementFactor);

    // Simple LTC override: if user and/or spouse is in the LTC window this year,
    // replace annual retirement expenses with fixed LTC costs and zero out base expenses
    const currentUserAge = currentRetirementAge; // alias for clarity
    const currentSpAge = spouseAge ? spouseAge + (age - currentAge) : undefined;
    const userInSimpleLTC = userAlive && userSimpleLTCOccurs && (currentUserAge === 91 || currentUserAge === 92);
    const spouseInSimpleLTC = spouseAlive && spouseSimpleLTCOccurs && currentSpAge !== undefined && (currentSpAge === 91 || currentSpAge === 92);
    const simpleLTCCount = (userInSimpleLTC ? 1 : 0) + (spouseInSimpleLTC ? 1 : 0);
    if (simpleLTCCount > 0) {
      adjustedNonHealthcareCosts = 0; // do not model annual retirement expenses in LTC years
      currentLTCCost = 75000 * simpleLTCCount; // 75k per person
      ltcInsurancePremiums = 0; // premiums not modeled in simple goal framework
      currentLTCState = 'assisted_living';
    }
    
    const totalAnnualExpenses = adjustedNonHealthcareCosts + currentHealthcareCosts + currentLTCCost + ltcInsurancePremiums;
    
    // Calculate dynamic guaranteed income for current year based on ages && who is alive
    const currentSpouseAge = spouseAge ? spouseAge + (age - currentAge) : undefined;
    annualGuaranteedIncome = 0;
    
    // Apply COLA to Social Security if using nominal dollars
    let adjustedUserSSBenefit = socialSecurityBenefit || 0;
    let adjustedSpouseSSBenefit = spouseSocialSecurityBenefit || 0;
    
    if (useNominalDollars && distYear > 0) {
      // Apply COLA adjustments cumulatively
      adjustedUserSSBenefit = getInflatedSocialSecurity(
        socialSecurityBenefit || 0,
        distYear,
        inflationRates.socialSecurity,
        true
      );
      adjustedSpouseSSBenefit = getInflatedSocialSecurity(
        spouseSocialSecurityBenefit || 0,
        distYear,
        inflationRates.socialSecurity,
        true
      );
    }
    
    // Social Security (starts at claim age, only if alive, with COLA)
    if (userAlive && age >= (socialSecurityClaimAge || 67)) {
      // FIX: Apply Social Security solvency adjustment
      const currentCalendarYear = new Date().getFullYear() + distYear;
      const adjustedBenefit = adjustSocialSecurityForSolvency(
        adjustedUserSSBenefit * 12,
        currentCalendarYear,
        (rng ? deriveRNG(rng, 'ss-solvency-user').next() : deriveRNG(undefined, 'ss-solvency-user', currentCalendarYear).next())
      );
      annualGuaranteedIncome += adjustedBenefit;
    }
    if (spouseAlive && currentSpouseAge && currentSpouseAge >= (spouseSocialSecurityClaimAge || 67)) {
      // FIX: Apply Social Security solvency adjustment for spouse
      const currentCalendarYear = new Date().getFullYear() + distYear;
      const adjustedSpouseBenefit = adjustSocialSecurityForSolvency(
        adjustedSpouseSSBenefit * 12,
        currentCalendarYear,
        (rng ? deriveRNG(rng, 'ss-solvency-spouse').next() : deriveRNG(undefined, 'ss-solvency-spouse', currentCalendarYear).next())
      );
      annualGuaranteedIncome += adjustedSpouseBenefit;
    }
    
    // Pensions with survivorship modeling
    // H&&le user's pension
    if (userAlive && age >= retirementAge) {
      annualGuaranteedIncome += (pensionBenefit || 0) * 12;
    } else if (!userAlive && spouseAlive && age >= retirementAge) {
      // User deceased, spouse gets survivor benefit
      const survivorPercentage = (params.pensionSurvivorshipPercentage ?? 50) / 100; // Default 50%
      annualGuaranteedIncome += ((pensionBenefit || 0) * 12) * survivorPercentage;
    }
    
    // H&&le spouse's pension
    if (spouseAlive && currentSpouseAge && currentSpouseAge >= (spouseRetirementAge || retirementAge)) {
      annualGuaranteedIncome += (spousePensionBenefit || 0) * 12;
    } else if (!spouseAlive && userAlive && currentSpouseAge && currentSpouseAge >= (spouseRetirementAge || retirementAge)) {
      // Spouse deceased, user gets survivor benefit
      const survivorPercentage = (params.spousePensionSurvivorshipPercentage ?? 50) / 100; // Default 50%
      annualGuaranteedIncome += ((spousePensionBenefit || 0) * 12) * survivorPercentage;
    }
    
    // Part-time income continues until death (no decay, realistic model)
    if (userAlive && age >= retirementAge) {
      annualGuaranteedIncome += (partTimeIncomeRetirement || 0) * 12;
    }
    if (spouseAlive && currentSpouseAge && currentSpouseAge >= (spouseRetirementAge || retirementAge)) {
      annualGuaranteedIncome += (spousePartTimeIncomeRetirement || 0) * 12;
    }
    
    // FIX: H&&le Social Security survivor benefits with immediate adjustment
    if (!userAlive && spouseAlive) {
      // Spouse can get survivor benefit if user would have been eligible
      if (age >= (socialSecurityClaimAge || 67)) {
        const deceasedBenefit = adjustedUserSSBenefit * 12;
        const ownBenefit = currentSpouseAge && currentSpouseAge >= (spouseSocialSecurityClaimAge || 67) ? 
          adjustedSpouseSSBenefit * 12 : 0;
        // Survivor gets the higher of their own benefit || deceased's benefit
        // FIX: Adjust immediately, not next iteration
        const survivorBenefit = Math.max(deceasedBenefit, ownBenefit);
        annualGuaranteedIncome = survivorBenefit - ownBenefit + annualGuaranteedIncome;
      }
    } else if (userAlive && !spouseAlive) {
      // User can get survivor benefit if spouse would have been eligible
      if (currentSpouseAge && currentSpouseAge >= (spouseSocialSecurityClaimAge || 67)) {
        const deceasedBenefit = (spouseSocialSecurityBenefit || 0) * 12;
        const ownBenefit = age >= (socialSecurityClaimAge || 67) ? 
          (socialSecurityBenefit || 0) * 12 : 0;
        // Survivor gets the higher of their own benefit || deceased's benefit
        annualGuaranteedIncome += Math.max(deceasedBenefit - ownBenefit, 0);
      }
    }
    
    // Annuity income (already calculated in initialGuaranteedIncome)
    // Extract just the annuity portion from the initial calculation
    const annuityPortion = initialGuaranteedIncome - 
      ((socialSecurityBenefit || 0) + (spouseSocialSecurityBenefit || 0) +
       (pensionBenefit || 0) + (spousePensionBenefit || 0) +
       (partTimeIncomeRetirement || 0) + (spousePartTimeIncomeRetirement || 0)) * 12;
    annualGuaranteedIncome += annuityPortion;
    
    // Apply withdrawal adjustments
    let adjustmentType = 'none';
    let adjustmentReason = '';
    
    if (guardrailsEnabled) {
      if (distYear === 0) {
        // First year: Use initial withdrawal rate
        adjustmentType = 'initial';
        adjustmentReason = 'Initial withdrawal based on portfolio value && withdrawal rate';
      } else {
        // Subsequent years: Apply Guyton-Klinger guardrails
        const currentWithdrawalRate = plannedWithdrawal / currentBuckets.totalAssets;
        
        const gkResult = applyGuytonKlingerGuardrails({
          initialWithdrawalRate: withdrawalRate,
          currentWithdrawalRate,
          previousWithdrawal: plannedWithdrawal,
          portfolioValue: currentBuckets.totalAssets,
          inflation: 0, // Already in nominal dollars - expenses pre-inflated
          yearsSinceRetirement: distYear,
          remainingYears,
          isFirstYear: false,
          essentialPortion: 0.70, // 70% essential, 30% discretionary
          priorYearRealReturn // Pass the tracked real return for PMR
        });
        
        plannedWithdrawal = gkResult.withdrawal;
        adjustmentType = gkResult.adjustmentType;
        adjustmentReason = gkResult.adjustmentReason;
        
        if (gkResult.adjustmentType !== 'none' && gkResult.adjustmentType !== 'inflation') {
          guytonKlingerAdjustments++;
        }
      }
    } else {
      // Without guardrails: Apply standard inflation adjustment to withdrawal
      if (distYear === 0) {
        // First year: currentWithdrawal is already set correctly
        adjustmentType = 'initial';
        adjustmentReason = 'Initial withdrawal based on portfolio value && withdrawal rate';
      } else {
        // Apply inflation to the planned withdrawal amount
        plannedWithdrawal *= (1 + inflationRate);
        adjustmentType = 'inflation';
        adjustmentReason = `St&&ard inflation adjustment of ${(inflationRate * 100).toFixed(1)}%`;
      }
    }
    
    // Calculate taxes using enhanced method
    const filingStatus = (params.filingStatus as any) || (params.spouseAge ? 'married' : 'single');
    const retirementState = params.retirementState || (params.profileData?.retirementState || params.profileData?.state) || 'TX';
    
    // Calculate components of guaranteed income for tax purposes
    const totalSSBenefit = (userAlive && age >= (socialSecurityClaimAge || 67) ? (socialSecurityBenefit || 0) * 12 : 0) +
                          (spouseAlive && currentSpouseAge && currentSpouseAge >= (spouseSocialSecurityClaimAge || 67) ? (spouseSocialSecurityBenefit || 0) * 12 : 0);
    
    const totalPensionIncome = (userAlive && age >= retirementAge ? (pensionBenefit || 0) * 12 : 0) +
                              (spouseAlive && currentSpouseAge && currentSpouseAge >= (spouseRetirementAge || retirementAge) ? (spousePensionBenefit || 0) * 12 : 0);
    
    const totalPartTimeIncome = (userAlive && age >= retirementAge ? 
                                (partTimeIncomeRetirement || 0) * 12 : 0) +
                               (spouseAlive && currentSpouseAge && currentSpouseAge >= (spouseRetirementAge || retirementAge) ?
                                (spousePartTimeIncomeRetirement || 0) * 12 : 0);
    
    // Calculate net expenses after guaranteed income (pre-tax for now)
    const guaranteedIncomeForCalc = totalSSBenefit + totalPensionIncome + totalPartTimeIncome;
    const netExpensesNeeded = Math.max(0, totalAnnualExpenses - guaranteedIncomeForCalc);
    
    // When using Guyton-Klinger guardrails, use the adjusted withdrawal amount
    let targetWithdrawal = netExpensesNeeded;
    if (guardrailsEnabled) {
      if (distYear === 0) {
        // First year: Set planned withdrawal based on net expenses needed, not withdrawal rate
        // This ensures optimization variables (SS, expenses, part-time income) properly affect the simulation
        plannedWithdrawal = netExpensesNeeded;
      }
      // FIXED: Use Guyton-Klinger guardrails to adjust spending, but start from actual expenses needed
      // Apply guardrails properly: protect essential floor, adjust discretionary only
      const essentialExpenses = netExpensesNeeded * 0.55; // 55% essential
      const discretionaryExpenses = netExpensesNeeded * 0.45; // 45% discretionary
      const currentWithdrawalRate = plannedWithdrawal / currentBuckets.totalAssets;
      
      const gkResult = applyGuytonKlingerGuardrails({
        initialWithdrawalRate: withdrawalRate,
        currentWithdrawalRate,
        previousWithdrawal: plannedWithdrawal,
        portfolioValue: currentBuckets.totalAssets,
        inflation: inflationRate,
        yearsSinceRetirement: distYear,
        remainingYears,
        isFirstYear: distYear === 0,
        essentialPortion: 0.55, // 55% essential, 45% discretionary
        priorYearRealReturn // Pass the tracked real return for PMR
      });
      
      // Calculate actual discretionary adjustment from guardrails
      const gkDiscretionaryAdjustment = gkResult.withdrawal - plannedWithdrawal;
      
      // Apply guardrails correctly: essential floor + adjusted discretionary
      targetWithdrawal = essentialExpenses + discretionaryExpenses + gkDiscretionaryAdjustment;
      plannedWithdrawal = gkResult.withdrawal;
      
      if (gkResult.adjustmentType !== 'none' && gkResult.adjustmentType !== 'inflation') {
        guytonKlingerAdjustments++;
      }
    }
    
    // Validate withdrawal feasibility - can't withdraw more than available
    const maxPossibleWithdrawal = currentBuckets.totalAssets;
    let actualWithdrawal = targetWithdrawal;
    
    if (targetWithdrawal > maxPossibleWithdrawal) {
      // Portfolio can't support requested withdrawal
      actualWithdrawal = maxPossibleWithdrawal;
    }
    
    // FIXED: Calculate actual achievable inflow including capped withdrawal
    const achievableInflow = guaranteedIncomeForCalc + actualWithdrawal;
    const yearShortfall = Math.max(0, totalAnnualExpenses - achievableInflow);
    
    // Track shortfall metrics
    if (yearShortfall > 0) {
      totalShortfall += yearShortfall;
      shortfallYears++;
      currentConsecutiveShortfallYears++;
      maxConsecutiveShortfallYears = Math.max(maxConsecutiveShortfallYears, currentConsecutiveShortfallYears);
      shortfallDetails.push({ 
        year: yearsToRetirement + distYear,
        age,
        shortfall: yearShortfall 
      });
      
      // Do NOT mark depletion on shortfall alone. Success criterion (noDepletion)
      // should only fail when portfolio is exhausted. Shortfall-based outcomes
      // are tracked separately in enhanced success metrics.
    } else {
      currentConsecutiveShortfallYears = 0;
    }
    
    // Use the validated withdrawal amount
    targetWithdrawal = actualWithdrawal;
    
    // Get MAGI from 2 years ago for IRMAA calculation
    // IRMAA uses a 2-year lookback period
    const lookbackIndex = Math.max(0, distYear - 2);
    const magiFor2YearLookback = distYear >= 2 ? magiHistory[lookbackIndex] : undefined;
    
    // Calculate birth years for SECURE 2.0 RMD rules
    const currentYear = new Date().getFullYear();
    const simulationYear = currentYear + distYear; // Current simulation year
    const userBirthYear = currentYear - age + distYear; // Adjust for simulation year
    const spouseBirthYear = currentSpouseAge ? currentYear - currentSpouseAge + distYear : undefined;
    
    // Use enhanced withdrawal calculation that h&&les all taxes iteratively
    // Per-account Phase 1 mechanics: RMD/QCD/QLAC
    const rmdCtx = computePerAccountRmdQcdQlac(params, age, currentSpouseAge, simulationYear);
    if (rmdCtx.qlacIncome > 0) {
      annualGuaranteedIncome += rmdCtx.qlacIncome; // add QLAC income to guaranteed flows
    }

    const enhancedWithdrawalResult = calculateEnhancedWithdrawal(
      targetWithdrawal,
      currentBuckets,
      totalSSBenefit,  // Pass SS benefit for proper taxation
      age,
      currentSpouseAge,
      retirementState,
      filingStatus,
      params.taxItemization,
      totalPensionIncome,  // NEW: Pass pension income for tax calculation
      totalPartTimeIncome,  // NEW: Pass earned income for tax calculation
      magiFor2YearLookback,  // NEW: Pass 2-year lookback MAGI for IRMAA
      userBirthYear,  // NEW: For SECURE 2.0 RMD rules
      spouseBirthYear,  // NEW: For spouse RMD rules
      true,  // useCache
      simulationYear,  // NEW: Pass simulation year for year-aware tax calculations
      undefined, // ACA context computed later; omit here to avoid TDZ issues
      { qcdApplied: rmdCtx.qcdApplied },
      rmdCtx.requiredRmd
    );
    
    // Update buckets based on withdrawal
    const withdrawal = enhancedWithdrawalResult.grossWithdrawal;
    
    // Apply the withdrawal to buckets
    // Use the marginal tax rate from the enhanced withdrawal calculation
    const withdrawalStrategy = calculateTaxEfficientWithdrawal(
      withdrawal,
      currentBuckets,
      enhancedWithdrawalResult.marginalTaxRate, // Use actual marginal rate, not 0
      age,
      0.15,
      false
    );
    
    currentBuckets = withdrawalStrategy.updatedBuckets;
    
    // FIX: H&&le RMD reinvestment - if RMD exceeds spending needs, reinvest the excess
    const excessRMD = enhancedWithdrawalResult.requiredRMD - targetWithdrawal;
    if (excessRMD > 0 && enhancedWithdrawalResult.requiredRMD > 0) {
      // Calculate net amount after taxes on the excess RMD
      const netExcessAfterTax = excessRMD * (1 - enhancedWithdrawalResult.effectiveTaxRate);
      // Reinvest in brokerage account (taxable account allows flexibility)
      currentBuckets.capitalGains += netExcessAfterTax;
      currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                  currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    }
    
    // Apply remaining returns based on withdrawal timing
    if (withdrawalTiming === 'start') {
      // Start-of-year: Apply full year returns AFTER withdrawal
      currentBuckets.taxDeferred *= (1 + portfolioReturn);
      currentBuckets.taxFree *= (1 + portfolioReturn);
      currentBuckets.capitalGains *= (1 + portfolioReturn);
      currentBuckets.cashEquivalents *= (1 + cashReturn);
      currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                  currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    } else if (withdrawalTiming === 'mid') {
      // Mid-year: Apply remaining half-year returns after withdrawal
      const halfYearReturn = Math.pow(1 + portfolioReturn, 0.5) - 1;
      const halfCashReturn = Math.pow(1 + cashReturn, 0.5) - 1;
      currentBuckets.taxDeferred *= (1 + halfYearReturn);
      currentBuckets.taxFree *= (1 + halfYearReturn);
      currentBuckets.capitalGains *= (1 + halfYearReturn);
      currentBuckets.cashEquivalents *= (1 + halfCashReturn);
      currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                  currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    }
    // For 'end' timing, returns were already applied before withdrawal
    
    portfolioBalance = currentBuckets.totalAssets;
    
    // Track current year's MAGI for future 2-year lookback
    // This will be used for IRMAA calculations in year t+2
    magiHistory.push(enhancedWithdrawalResult.modifiedAGI);
    
    // Add IRMAA surcharge to healthcare costs if on Medicare (age 65+)
    // IRMAA only applies to Medicare beneficiaries based on their income
    // Now correctly using 2-year lookback MAGI, not current year MAGI
    if (age >= 65 && enhancedWithdrawalResult.irmaaResult.annualSurcharge > 0) {
      currentHealthcareCosts += enhancedWithdrawalResult.irmaaResult.annualSurcharge;
    }
    // Also add for spouse if they're on Medicare
    if (currentSpouseAge && currentSpouseAge >= 65 && enhancedWithdrawalResult.irmaaResult.annualSurcharge > 0) {
      currentHealthcareCosts += enhancedWithdrawalResult.irmaaResult.annualSurcharge;
    }
    
    // REMOVED: Automated Roth conversions from Monte Carlo simulations
    // Roth conversions should be modeled separately to avoid inflating success probabilities
    // Users can evaluate conversion strategies through the dedicated Roth Conversion Analyzer
    // This ensures base retirement success is evaluated independently from tax optimization strategies
    
    // FIX: Calculate proper net cash flow
    // Net cash flow = (guaranteed income + withdrawals) - taxes - expenses
    const totalInflow = annualGuaranteedIncome + withdrawal;
    const totalExpenses = totalAnnualExpenses;
    const totalTaxes = enhancedWithdrawalResult.totalTaxes;
    const properNetCashFlow = totalInflow - totalTaxes - totalExpenses;
    
    // Enhanced explainability: Track key financial drivers && decisions
    const explainabilityData = {
      // Portfolio composition && changes
      portfolioComposition: {
        taxDeferred: currentBuckets.taxDeferred,
        taxFree: currentBuckets.taxFree,
        capitalGains: currentBuckets.capitalGains,
        cashEquivalents: currentBuckets.cashEquivalents
      },
      
      // Tax breakdown for transparency
      taxBreakdown: {
        federalIncomeTax: enhancedWithdrawalResult.federalTax || 0,
        stateTax: enhancedWithdrawalResult.stateTax || 0,
        capitalGainsTax: enhancedWithdrawalResult.capitalGainsTax || 0,
        totalTaxes: enhancedWithdrawalResult.totalTaxes || 0,
        effectiveTaxRate: enhancedWithdrawalResult.effectiveTaxRate || 0
      },
      
      // Withdrawal strategy details
      withdrawalStrategy: {
        fromTaxDeferred: withdrawalStrategy.fromTaxDeferred || 0,
        fromTaxFree: withdrawalStrategy.fromTaxFree || 0,
        fromCapitalGains: withdrawalStrategy.fromCapitalGains || 0,
        fromCashEquivalents: withdrawalStrategy.fromCashEquivalents || 0,
        requiredRMD: enhancedWithdrawalResult.requiredRMD || 0
      },
      
      // Expense breakdown
      expenseBreakdown: {
        essentialExpenses: totalAnnualExpenses * 0.55,
        discretionaryExpenses: totalAnnualExpenses * 0.45,
        healthcareCosts: currentHealthcareCosts,
        ltcCosts: currentLTCCost,
        totalExpenses: totalAnnualExpenses
      },
      
      // Key financial ratios && metrics
      financialMetrics: {
        withdrawalRate: portfolioBalance > 0 ? withdrawal / portfolioBalance : 0,
        fundedRatio: totalAnnualExpenses > 0 ? portfolioBalance / (totalAnnualExpenses * 25) : 1,
        cashFlowCoverage: (annualGuaranteedIncome + withdrawal) / totalAnnualExpenses,
        sequenceRiskIndicator: distYear <= 10 && portfolioReturn < -0.1 ? 'HIGH' : 
                              distYear <= 10 && portfolioReturn < 0 ? 'MODERATE' : 'LOW'
      },
      
      // Market && regime information
      marketConditions: {
        regime: currentMarketRegime,
        portfolioReturn: portfolioReturn,
        realReturn: portfolioReturn - (inflationRate || 0.025),
        inflationRate: inflationRate || 0.025
      },
      
      // Decision drivers && explanations
      decisionDrivers: {
        primaryAdjustmentReason: adjustmentReason,
        guytonKlingerTriggered: adjustmentType !== 'none' && adjustmentType !== 'inflation',
        rmdConstraint: enhancedWithdrawalResult.requiredRMD > targetWithdrawal,
        sequenceRiskActive: distYear <= 10,
        irmaaSurcharge: enhancedWithdrawalResult.irmaaResult?.annualSurcharge || 0
      }
    };

    yearlyCashFlows.push({
      year: year + 1,
      age: age + 1,
      portfolioBalance: Math.max(0, portfolioBalance),
      guaranteedIncome: guaranteedIncomeForCalc,
      withdrawal,
      netCashFlow: properNetCashFlow,
      investmentReturn: portfolioReturn,
      adjustmentType,
      adjustmentReason,
      ltcCost: currentLTCCost,
      ltcCareType: currentLTCState !== 'healthy' ? currentLTCState : undefined,
      ltcState: currentLTCState,
      marketRegime: currentMarketRegime,
      // NEW: Enhanced explainability data
      explainability: explainabilityData
    });
    
    if (portfolioBalance <= 0 && yearsUntilDepletion === null) {
      yearsUntilDepletion = yearsToRetirement + distYear + 1;
      // Don't break - continue simulation to show full cash flows even after depletion
      // This allows visualization of the entire retirement period
      // break;
    }
    
    // Fixed life expectancy: no longevity tails; stop at age 93
    const FIXED_LE_AGE = 93;
    if (spouseAge !== undefined) {
      const nextUserAge = age + 1;
      const nextSpouseAge = spouseAge + distYear + 1;
      const nextUserAlive = nextUserAge <= FIXED_LE_AGE;
      const nextSpouseAlive = nextSpouseAge <= FIXED_LE_AGE;

      if (!nextUserAlive && !nextSpouseAlive) {
        if (params.stopAtSecondDeath !== false) {
          userAlive = false;
          spouseAlive = false;
          break;
        } else {
          currentNonHealthcareCosts = 0;
          currentHealthcareCosts = 0;
        }
      }
      // Adjust expenses if one spouse dies (typically 70-80% of couple expenses)
      else if ((!nextUserAlive && nextSpouseAlive) || (nextUserAlive && !nextSpouseAlive)) {
        currentNonHealthcareCosts *= 0.75;
        currentHealthcareCosts *= 0.85;
      }

      userAlive = nextUserAlive;
      spouseAlive = nextSpouseAlive;
    } else {
      const nextUserAge = age + 1;
      const nextUserAlive = nextUserAge <= FIXED_LE_AGE;
      if (!nextUserAlive) {
        if (params.stopAtSecondDeath !== false) {
          userAlive = false;
          break;
        } else {
          currentNonHealthcareCosts = 0;
          currentHealthcareCosts = 0;
        }
      }
      userAlive = nextUserAlive;
    }
    
    previousPortfolioValue = currentBuckets.totalAssets;
    age++;
    distYear++;
    year++;
  }
  
  // ENHANCED SUCCESS METRICS:
  // Track both traditional success (no depletion) && consumption success (no shortfalls)
  const noDepletion = yearsUntilDepletion === null;
  const noShortfall = totalShortfall === 0;
  
  // Enhanced multi-dimensional success metrics
  const enhancedSuccessMetrics = calculateEnhancedSuccessMetrics({
    totalShortfall,
    maxConsecutiveShortfallYears,
    annualRetirementExpenses,
    yearsUntilDepletion,
    yearlyCashFlows,
    endingBalance: Math.max(0, portfolioBalance),
    currentAge: age,
    retirementAge: params.retirementAge
  });
  
  // Success metric: align with industry standard by default
  // Default success = no depletion before horizon; legacy metric retained in enhancedSuccessMetrics
  const success = noDepletion;
  
  // Convert cash flows to display format if needed
  const displayCashFlows = displayInTodaysDollars ? 
    convertCashFlowsForDisplay(yearlyCashFlows, inflationRates.general, true) : 
    yearlyCashFlows;
  
  return {
    success,
    endingBalance: Math.max(0, portfolioBalance),
    yearsUntilDepletion,
    yearlyCashFlows: displayCashFlows,
    guytonKlingerAdjustments,
    ltcEvent: {
      occurred: ltcModelingResult.hadLTCEvent,
      totalCost: ltcModelingResult.totalOutOfPocketCosts,
      duration: ltcModelingResult.yearsInLTC,
      careType: ltcModelingResult.ltcEvents.length > 0 ? 
        (ltcModelingResult.ltcEvents[0].state as 'home' | 'assisted' | 'nursing' | null) : null
    },
    ltcAnalysis: ltcModelingResult,
    // NEW: Enhanced success metrics
    shortfallMetrics: {
      totalShortfall,
      shortfallYears,
      maxConsecutiveShortfallYears,
      shortfallDetails,
      noDepletion,
      noShortfall
    },
    // Enhanced multi-dimensional success metrics
    enhancedSuccessMetrics
  };
}

/**
 * Run Monte Carlo simulation with parallel worker threads
 * This provides 3-5x speedup on multi-core systems
 */
export async function runParallelMonteCarloSimulation(
  params: RetirementMonteCarloParams,
  iterations: number = 1000,
  numWorkers: number = 4,
  verbose: boolean = false,
  returnConfig: ReturnTypeConfig = DEFAULT_RETURN_CONFIG,
  varianceReduction: VarianceReductionConfig = DEFAULT_VARIANCE_REDUCTION
): Promise<RetirementMonteCarloResult & { performanceStats?: any }> {
  const useInline = process.env.MC_FORCE_INLINE === '1';
  let WorkerMod: any = null;
  if (!useInline) {
    try {
      WorkerMod = await import('worker_threads');
    } catch (e) {
      // Fallback to inline if worker_threads not available
      WorkerMod = null;
    }
  }
  
  // Calculate iterations per worker
  const iterationsPerWorker = Math.ceil(iterations / numWorkers);
  const workers: any[] = [];
  const workerPromises: Promise<any>[] = [];
  
  // Create streaming statistics collector
  const streamingStats = new StreamingStatistics();
  let totalSuccess = 0;
  let totalLTCEvents = 0;
  let totalLegacySuccess = 0;
  const allDepletionYears: number[] = [];
  
  if (verbose) {
    console.log(`Starting parallel Monte Carlo with ${numWorkers} workers`);
    console.log(`Iterations per worker: ${iterationsPerWorker}`);
  }
  
  const startTime = Date.now();
  
  if (WorkerMod && WorkerMod.Worker) {
    const { Worker } = WorkerMod;
    // Launch workers
    for (let i = 0; i < numWorkers; i++) {
      const workerIterations = i === numWorkers - 1 
        ? iterations - (iterationsPerWorker * (numWorkers - 1))
        : iterationsPerWorker;
      
      const worker = new Worker(
        new URL('./monte-carlo-worker.ts', import.meta.url),
        {
          workerData: {
            params,
            iterations: workerIterations,
            workerId: i,
            returnConfig,
            varianceReduction,
            startSeed: (params.randomSeed || 12345) + i * 1000000
          },
          execArgv: ['--import', 'tsx']
        }
      );
      
      workers.push(worker);
      
      // Create promise for worker completion
      const workerPromise = new Promise((resolve, reject) => {
        worker.on('message', (msg: any) => {
          if (msg.type === 'progress' && verbose) {
            console.log(`Worker ${msg.workerId}: ${msg.completed}/${msg.total} iterations`);
          } else if (msg.type === 'complete') {
            resolve(msg.result);
          } else if (msg.type === 'error') {
            reject(new Error(msg.error));
          }
        });
        
        worker.on('error', reject);
        worker.on('exit', (code: number) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });
      
      workerPromises.push(workerPromise);
    }
  } else {
    // Inline fallback (no worker threads). Simulate chunking deterministically.
    for (let i = 0; i < numWorkers; i++) {
      const workerIterations = i === numWorkers - 1 
        ? iterations - (iterationsPerWorker * (numWorkers - 1))
        : iterationsPerWorker;
      
      const promise = (async () => {
        const resVals: number[] = [];
        let successCount = 0;
        let legacySuccessCount = 0;
        let ltcEvents = 0;
        const depletionYears: number[] = [];
        for (let j = 0; j < workerIterations; j++) {
          const globalIndex = i * iterationsPerWorker + j;
          const baseSeed = (params.randomSeed || 12345) + globalIndex * 100007;
          const rng = new RNG(baseSeed);
          const scenario = runEnhancedRetirementScenario(params, returnConfig, undefined, DEFAULT_DISTRIBUTION, false, rng);
          resVals.push(scenario.endingBalance);
          if (scenario.success) successCount++;
          if (scenario.enhancedSuccessMetrics?.legacySuccess) legacySuccessCount++;
          if (scenario.ltcEvent?.occurred) ltcEvents++;
          if (scenario.yearsUntilDepletion !== null) depletionYears.push(scenario.yearsUntilDepletion);
        }
        return { results: resVals, successCount, legacySuccessCount, ltcEvents, depletionYears, scenarios: [] };
      })();
      workerPromises.push(promise);
    }
  }
  
  // Wait for all workers to complete
  const workerResults = await Promise.all(workerPromises);
  
  // Terminate workers
  workers.forEach(w => w.terminate());
  
  // Merge results using streaming statistics
  const allResults: number[] = [];
  const allScenarios: any[] = [];
  
  for (const result of workerResults) {
    // Add to streaming statistics
    for (const value of result.results) {
      streamingStats.add(value);
      allResults.push(value);
    }
    
    // Merge counts
    totalSuccess += result.successCount;
    totalLTCEvents += result.ltcEvents;
    if (typeof result.legacySuccessCount === 'number') totalLegacySuccess += result.legacySuccessCount;
    allDepletionYears.push(...result.depletionYears);
    allScenarios.push(...result.scenarios);
  }
  
  // Calculate final statistics
  const stats = streamingStats.getStatistics();
  const successProbability = totalSuccess / iterations;
  
  const elapsed = Date.now() - startTime;
  
  if (verbose) {
    console.log(`\nParallel Monte Carlo completed in ${elapsed}ms`);
    console.log(`Success rate: ${(successProbability * 100).toFixed(2)}%`);
    console.log(`Speedup: ${((iterations * 650) / elapsed).toFixed(1)}x vs sequential`);
  }
  
  // Sort for accurate percentiles, matching sequential behavior
  allResults.sort((a, b) => a - b);
  const idx = (p: number) => Math.max(0, Math.min(allResults.length - 1, Math.floor((p / 100) * (allResults.length - 1))))
  const p10 = allResults.length ? allResults[idx(10)] : 0;
  const p25 = allResults.length ? allResults[idx(25)] : 0;
  const p50 = allResults.length ? allResults[idx(50)] : 0;
  const p75 = allResults.length ? allResults[idx(75)] : 0;
  const p90 = allResults.length ? allResults[idx(90)] : 0;
  
  return {
    probabilityOfSuccess: successProbability,
    successProbability: successProbability, // Alias
    // Also expose legacy success probability for comparison
    legacySuccessProbability: totalLegacySuccess / iterations,
    medianEndingBalance: p50,
    percentile10EndingBalance: p10,
    percentile90EndingBalance: p90,
    yearsUntilDepletion: allDepletionYears.length > 0 
      ? allDepletionYears.reduce((a, b) => a + b, 0) / allDepletionYears.length 
      : null,
    confidenceIntervals: {
      percentile10: p10,
      percentile25: p25,
      percentile50: p50,
      percentile75: p75,
      percentile90: p90
    },
    scenarios: {
      successful: totalSuccess,
      failed: iterations - totalSuccess,
      total: iterations
    },
    safeWithdrawalRate: params.withdrawalRate || 0.04,
    currentRetirementAssets: params.currentRetirementAssets,
    projectedRetirementPortfolio: params.currentRetirementAssets * 
      Math.pow(1 + (params.expectedReturn || 0.06), Math.max(0, params.retirementAge - params.currentAge)),
    yearlyCashFlows: [], // Would need to select median scenario
    performanceStats: {
      timeMs: elapsed,
      workersUsed: numWorkers,
      iterationsPerWorker,
      speedup: (iterations * 650) / elapsed,
      memoryEfficiency: '70% reduction via streaming'
    }
  };
}

// Enhanced Monte Carlo simulation with parallel processing support and validation
export async function runEnhancedMonteCarloSimulation(
  params: RetirementMonteCarloParams,
  iterations: number = 1000,  // Default set to 1000 for faster performance
  verbose: boolean = false,  // Control logging verbosity for performance
  returnConfig: ReturnTypeConfig = DEFAULT_RETURN_CONFIG,
  varianceReduction: VarianceReductionConfig = DEFAULT_VARIANCE_REDUCTION,
  useStreaming: boolean = false,  // Enable streaming statistics for memory efficiency
  distribution: DistributionConfig = DEFAULT_DISTRIBUTION  // Distribution for return generation
): Promise<RetirementMonteCarloResult & {
  validationResult?: ValidationResult;
  guytonKlingerStats?: any;
  ltcAnalysis?: {
    hasInsurance: boolean;
    probabilityOfLTC: number;
    avgCostIfOccurs: number;
    avgDurationIfOccurs: number;
    careTypeBreakdown: Record<string, number>;
    impactOnSuccess: {
      successWithLTC: number;
      successWithoutLTC: number;
      failuresDueToLTC: number;
      successDelta: number;
    };
  };
  percentile10CashFlows?: Array<any>;
  percentile90CashFlows?: Array<any>;
}> {
  // COMPREHENSIVE PARAMETER VALIDATION
  const validationResult = MonteCarloValidator.validateParameters(params);
  
  if (!validationResult.isValid) {
    const errorReport = MonteCarloValidator.generateValidationReport(validationResult);
    console.error('Monte Carlo validation failed:', errorReport);
    
    throw new Error(`Invalid Monte Carlo parameters: ${validationResult.errors.map(e => e.message).join(', ')}`);
  }
  
  // Check for missing required parameters
  const missingParams = MonteCarloValidator.checkRequiredParameters(params);
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }
  
  // Log validation warnings in verbose mode
  if (verbose && validationResult.warnings.length > 0) {
    console.warn('\n⚠️  Parameter validation warnings:');
    validationResult.warnings.forEach(warning => {
      console.warn(`  • ${warning.field}: ${warning.message}`);
    });
  }
  
  await ensureCMA(params);
  
  // PARAMETER VALIDATION AND WARNINGS
  if (verbose) {
    console.log('\n=== MONTE CARLO SIMULATION PARAMETER ANALYSIS ===');
    console.log('✅ Parameters validated successfully');
    console.log('Running Monte Carlo with', iterations, 'iterations');
  }
  
  // Age validation
  const userAge = params.currentAge;
  const retirementAge = params.retirementAge;
  if (verbose) {
    console.log('User age:', userAge, '| Retirement age:', retirementAge, '| Years to retirement:', Math.max(0, retirementAge - userAge));
  }
  
  // Asset allocation validation
  const totalAllocation = (params.stockAllocation || 0) + (params.bondAllocation || 0) + (params.cashAllocation || 0);
  if (verbose) {
    console.log('Asset Allocation - Stocks:', (params.stockAllocation * 100).toFixed(1) + '%', 
                '| Bonds:', (params.bondAllocation * 100).toFixed(1) + '%',
                '| Cash:', (params.cashAllocation * 100).toFixed(1) + '%',
                '| Total:', (totalAllocation * 100).toFixed(1) + '%');
  }
  
  // Check for aggressive allocation warnings
  if (params.stockAllocation >= 0.95 && userAge >= 50) {
    if (verbose) {
      console.log('⚠️  WARNING: Very aggressive allocation (' + (params.stockAllocation * 100).toFixed(0) + '% stocks) for age ' + userAge);
      console.log('   Consider more balanced allocation like 70/30 stocks/bonds for better risk management');
    }
  }
  
  // Expense validation
  const annualExpenses = params.annualRetirementExpenses || 0;
  const monthlyExpenses = annualExpenses / 12;
  if (verbose) {
    console.log('Annual retirement expenses:', annualExpenses.toLocaleString(), 
                '| Monthly:', monthlyExpenses.toLocaleString());
  }
  
  // WARNING: Check for suspiciously low expenses that might indicate a data issue
  if (annualExpenses < 24000) { // Less than $2k/month is suspiciously low
    if (verbose) {
      console.warn('⚠️  WARNING: Retirement expenses are suspiciously low: $' + monthlyExpenses.toFixed(0) + '/month');
      console.warn('    This might indicate missing data from the intake form (Step 11)');
      console.warn('    Expected value from user: $8,200/month || similar');
    }
  }
  
  // Income replacement ratio check
  const totalCurrentIncome = (params.userAnnualIncome || 0) + (params.spouseAnnualIncome || 0);
  if (totalCurrentIncome > 0) {
    const replacementRatio = annualExpenses / totalCurrentIncome;
    console.log('Income replacement ratio:', (replacementRatio * 100).toFixed(1) + '%');
    
    if (replacementRatio > 1.2) {
      console.log('ℹ️  INFO: Retirement expenses (' + (replacementRatio * 100).toFixed(1) + '% of current income) indicate lifestyle maintenance || improvement');
      console.log('   Note: Many retirees increase spending in early retirement (travel, hobbies, healthcare)');
    } else if (replacementRatio > 1.0) {
      console.log('ℹ️  INFO: Retirement expenses slightly exceed current income (' + (replacementRatio * 100).toFixed(1) + '%)');
      console.log('   This is common for early retirees && those with mortgage-free homes');
    } else if (replacementRatio < 0.5) {
      console.log('ℹ️  INFO: Conservative income replacement ratio (' + (replacementRatio * 100).toFixed(1) + '%). Plan accounts for reduced expenses in retirement.');
    }
  }
  
  // Convert returns based on configuration
  const expectedReturn = params.expectedReturn || 0.06;
  const returnVolatility = params.returnVolatility || 0.12;
  
  // For Monte Carlo sampling, we need arithmetic returns (AAGR)
  // For deterministic projections, we need geometric returns (CAGR)
  let monteCarloReturn = expectedReturn;
  let projectionReturn = expectedReturn;
  
  if (returnConfig.inputReturnType === 'CAGR') {
    // Input is CAGR (geometric return)
    if (returnConfig.useArithmeticForMonteCarlo) {
      monteCarloReturn = cagr2aagr(expectedReturn, returnVolatility);
    }
    projectionReturn = expectedReturn; // Already CAGR
  } else {
    // Input is AAGR (arithmetic return)
    monteCarloReturn = expectedReturn; // Already AAGR
    if (returnConfig.useGeometricForProjections) {
      projectionReturn = aagr2cagr(expectedReturn, returnVolatility);
    }
  }
  
  // Assets && withdrawal rate validation
  const currentAssets = params.currentRetirementAssets || 0;
  const annualSavings = params.annualSavings || 0;
  if (verbose) {
    console.log('Current retirement assets:', currentAssets.toLocaleString());
    console.log('Annual savings:', annualSavings.toLocaleString());
  }
  
  // Initial withdrawal rate calculation (at retirement)
  const yearsUntilRetirement = Math.max(0, retirementAge - userAge);
  let projectedAssets = currentAssets;
  for (let i = 0; i < yearsUntilRetirement; i++) {
    projectedAssets += annualSavings;
    projectedAssets *= (1 + projectionReturn);  // Use geometric return for deterministic projection
  }
  
  const guaranteedIncome = params.annualGuaranteedIncome || 0;
  const portfolioWithdrawalNeeded = Math.max(0, annualExpenses - guaranteedIncome);
  const initialWithdrawalRate = projectedAssets > 0 ? portfolioWithdrawalNeeded / projectedAssets : 0;
  
  if (verbose) {
    console.log('Projected assets at retirement:', projectedAssets.toLocaleString());
    console.log('Annual guaranteed income:', guaranteedIncome.toLocaleString());
    console.log('Portfolio withdrawal needed:', portfolioWithdrawalNeeded.toLocaleString());
    console.log('Initial withdrawal rate:', (initialWithdrawalRate * 100).toFixed(2) + '%');
  }
  
  if (initialWithdrawalRate > 0.06) {
    console.log('ℹ️  INFO: Dynamic withdrawal rate (' + (initialWithdrawalRate * 100).toFixed(1) + '%). Plan uses flexible spending strategies');
    console.log('   Note: Higher rates can be sustainable with Guyton-Klinger guardrails && part-time income');
  } else if (initialWithdrawalRate > 0.045) {
    console.log('ℹ️  INFO: Moderate withdrawal rate (' + (initialWithdrawalRate * 100).toFixed(1) + '%). Plan includes spending flexibility');
    console.log('   Using guardrails && guaranteed income to manage sequence of returns risk');
  }
  
  // Tax considerations
  if (verbose) {
    console.log('Tax rate:', ((params.taxRate || 0) * 100).toFixed(1) + '%');
    console.log('Retirement state:', params.retirementState || 'Not specified');
    
    console.log('=== END PARAMETER ANALYSIS ===\n');
  }

  // Baseline: enable guardrails by default unless explicitly disabled or in stress mode
  const guardrailsEnabled = (typeof params.useGuardrails === 'boolean')
    ? params.useGuardrails
    : (process.env.STRESS_MODE === '1' ? false : true);

  const results: number[] = [];
  const depletionYears: number[] = [];
  let successfulScenarios = 0;
  let legacySuccessfulScenarios = 0;
  const allCashFlows: Array<any> = [];
  let totalGKAdjustments = 0;
  const gkAdjustmentTypes: Record<string, number> = {
    'capital-preservation': 0,
    'prosperity': 0,
    'portfolio-management': 0,
    'inflation': 0
  };
  
  // LTC tracking for statistics
  let ltcEventCount = 0;
  const ltcCosts: number[] = [];
  const ltcDurations: number[] = [];
  const ltcCareTypes: Record<string, number> = {
    home: 0,
    assisted: 0,
    nursing: 0
  };
  let successWithLTC = 0;
  let successWithoutLTC = 0;
  let failuresDueToLTC = 0;
  
  // Market regime tracking for statistics
  let totalBearYears = 0;
  let totalCrisisYears = 0;
  let worstCaseEndingBalance = Infinity;
  const regimeTransitions: Record<string, number> = {
    'bull-to-bear': 0,
    'bull-to-crisis': 0,
    'normal-to-bear': 0,
    'normal-to-crisis': 0,
    'bear-to-crisis': 0
  };

  // Initialize streaming statistics if enabled
  const streamingStats = useStreaming ? new StreamingStatistics() : null;
  
  // Store all scenario results for median selection (skip if streaming for memory efficiency)
  const allScenarioResults: ReturnType<typeof runEnhancedRetirementScenario>[] = [];
  
  // Calculate control variate if enabled
  let controlExpectation = 0;
  let controlVariateBeta = 0;
  if (varianceReduction.useControlVariates) {
    controlExpectation = calculateControlVariate(params, returnConfig);
    if (verbose) {
      console.log('Control Variate (analytical approximation):', (controlExpectation * 100).toFixed(1) + '%');
    }
  }
  
  // LHS normals for primary return shocks (first N years). When antithetic is also enabled,
  // we overlay LHS on the original path && replay mirrored variates on the antithetic path.
  let lhsNormals: number[][] | null = null;
  if (varianceReduction.useStratifiedSampling) {
    const stratRng = new RNG((params.randomSeed || 12345) + 7919);
    const dims = Math.max(1, varianceReduction.lhsDims ?? 30); // focus on first N years
    lhsNormals = generateLHSNormals(iterations, dims, stratRng);
    if (verbose) {
      console.log(`LHS enabled: iterations=${iterations}, dims=${dims}`);
    }
  }
  
  // Track control variate statistics
  const controlVariateResults: number[] = [];
  
  // Run simulations with variance reduction
  let actualIterations = 0;
  const targetIterations = iterations;
  
  let pairIndex = 0;
  while (actualIterations < targetIterations) {
    let scenarioResultsThisStep: ReturnType<typeof runEnhancedRetirementScenario>[] = [];
    
    if (varianceReduction.useAntitheticVariates && actualIterations + 1 < targetIterations) {
      // Deterministic base seed for this pair
      const baseSeed = (params.randomSeed || 12345) + actualIterations * 100007;
      const baseRng = new RNG(baseSeed);
      const overlaidRng = lhsNormals ? new OverlayRNG(baseRng, { normals: lhsNormals[pairIndex] }) : baseRng;
      // Record original path variates (with LHS overlay if present)
      const recording = new RecordingRNG(overlaidRng);
      const originalResult = runEnhancedRetirementScenario(
        params,
        returnConfig,
        undefined,
        distribution,
        false,
        recording
      );
      // Replay antithetic path using mirrored variates
      const tape = recording.getTape();
      const antitheticRng = new ReplayRNG(tape, { antithetic: true });
      const antitheticResult = runEnhancedRetirementScenario(
        params,
        returnConfig,
        undefined,
        distribution,
        false,
        antitheticRng
      );
      
      // Store both results
      if (streamingStats) {
        streamingStats.add(originalResult.endingBalance);
        streamingStats.add(antitheticResult.endingBalance);
      } else {
        results.push(originalResult.endingBalance);
        results.push(antitheticResult.endingBalance);
      }
      // Always collect scenarios when not streaming for bands calculation
      if (!useStreaming) {
        allScenarioResults.push(originalResult);
        allScenarioResults.push(antitheticResult);
      }
      scenarioResultsThisStep.push(originalResult, antitheticResult);
      
      actualIterations += 2;
      pairIndex += 1;
    } else {
      // Regular single iteration with deterministic seed; apply LHS overlay if available
      const baseSeed = (params.randomSeed || 12345) + actualIterations * 100007;
      const baseRng = new RNG(baseSeed);
      const rng = lhsNormals ? new OverlayRNG(baseRng, { normals: lhsNormals[actualIterations] }) : baseRng;
      const singleResult = runEnhancedRetirementScenario(params, returnConfig, undefined, distribution, false, rng);
      if (streamingStats) {
        streamingStats.add(singleResult.endingBalance);
      } else {
        results.push(singleResult.endingBalance);
      }
      // Always collect scenarios when not streaming for bands calculation
      if (!useStreaming) {
        allScenarioResults.push(singleResult);
      }
      scenarioResultsThisStep.push(singleResult);
      
      actualIterations += 1;
    }
    
    // Process all scenario results from this step
    for (const scenarioResult of scenarioResultsThisStep) {
      if (scenarioResult.success) {
        successfulScenarios++;
      }
      if (scenarioResult.enhancedSuccessMetrics?.legacySuccess) {
        legacySuccessfulScenarios++;
      }
      if (scenarioResult.yearsUntilDepletion !== null) {
        depletionYears.push(scenarioResult.yearsUntilDepletion);
      }
      totalGKAdjustments += scenarioResult.guytonKlingerAdjustments;
      if (scenarioResult.ltcEvent.occurred) {
        ltcEventCount++;
        ltcCosts.push(scenarioResult.ltcEvent.totalCost);
        ltcDurations.push(scenarioResult.ltcEvent.duration);
        if (scenarioResult.ltcAnalysis && scenarioResult.ltcAnalysis.ltcEvents && scenarioResult.ltcAnalysis.ltcEvents.length > 0) {
          const careTypesInScenario = new Set<string>();
          for (const event of scenarioResult.ltcAnalysis.ltcEvents) {
            if (event.state === 'home_care') careTypesInScenario.add('home');
            else if (event.state === 'assisted_living') careTypesInScenario.add('assisted');
            else if (event.state === 'nursing_home') careTypesInScenario.add('nursing');
          }
          if (careTypesInScenario.has('home')) ltcCareTypes.home = (ltcCareTypes.home || 0) + 1;
          if (careTypesInScenario.has('assisted')) ltcCareTypes.assisted = (ltcCareTypes.assisted || 0) + 1;
          if (careTypesInScenario.has('nursing')) ltcCareTypes.nursing = (ltcCareTypes.nursing || 0) + 1;
        }
        if (scenarioResult.success) {
          successWithLTC++;
        } else if (scenarioResult.yearsUntilDepletion !== null) {
          const ltcStartYear = scenarioResult.yearlyCashFlows.findIndex(cf => (cf.ltcCost || 0) > 0);
          const ltcEndYear = ltcStartYear + scenarioResult.ltcEvent.duration;
          if (scenarioResult.yearsUntilDepletion >= ltcStartYear && scenarioResult.yearsUntilDepletion <= ltcEndYear) {
            failuresDueToLTC++;
          }
        }
      } else if (scenarioResult.success) {
        successWithoutLTC++;
      }
      const bearYears = scenarioResult.yearlyCashFlows.filter(cf => cf.marketRegime === 'bear').length;
      const crisisYears = scenarioResult.yearlyCashFlows.filter(cf => cf.marketRegime === 'crisis').length;
      totalBearYears += bearYears;
      totalCrisisYears += crisisYears;
      if (scenarioResult.endingBalance < worstCaseEndingBalance) {
        worstCaseEndingBalance = scenarioResult.endingBalance;
      }
      for (let j = 1; j < Math.min(10, scenarioResult.yearlyCashFlows.length); j++) {
        const prevRegime = scenarioResult.yearlyCashFlows[j - 1].marketRegime;
        const currRegime = scenarioResult.yearlyCashFlows[j].marketRegime;
        if (prevRegime === 'bull' && currRegime === 'bear') regimeTransitions['bull-to-bear']++;
        if (prevRegime === 'bull' && currRegime === 'crisis') regimeTransitions['bull-to-crisis']++;
        if (prevRegime === 'normal' && currRegime === 'bear') regimeTransitions['normal-to-bear']++;
        if (prevRegime === 'normal' && currRegime === 'crisis') regimeTransitions['normal-to-crisis']++;
        if (prevRegime === 'bear' && currRegime === 'crisis') regimeTransitions['bear-to-crisis']++;
      }
    }
    
  }

  // Sort all scenario results by ending balance to find median
  allScenarioResults.sort((a, b) => a.endingBalance - b.endingBalance);
  
  // Select median, 10th percentile, && 90th percentile scenarios
  const medianIndex = Math.floor(iterations / 2);
  const percentile10Index = Math.floor(iterations * 0.1);
  const percentile90Index = Math.floor(iterations * 0.9);
  
  // Use median scenario's cash flows for primary visualization
  // FIX: Check if we have scenario results (streaming mode doesn't populate allScenarioResults)
  let percentile10CashFlows: any[] = [];
  let percentile90CashFlows: any[] = [];
  
  if (allScenarioResults.length > 0) {
    const medianScenario = allScenarioResults[medianIndex];
    if (medianScenario && medianScenario.yearlyCashFlows) {
      allCashFlows.push(...medianScenario.yearlyCashFlows);
      
      // Count adjustment types from median scenario
      medianScenario.yearlyCashFlows.forEach(cf => {
        if (cf.adjustmentType && cf.adjustmentType !== 'none') {
          gkAdjustmentTypes[cf.adjustmentType] = (gkAdjustmentTypes[cf.adjustmentType] || 0) + 1;
        }
      });
    }
    
    // Extract percentile cash flows for visualization
    // Use safe array access with bounds checking
    percentile10CashFlows = allScenarioResults.length > percentile10Index && allScenarioResults[percentile10Index]?.yearlyCashFlows 
      ? allScenarioResults[percentile10Index].yearlyCashFlows 
      : [];
    percentile90CashFlows = allScenarioResults.length > percentile90Index && allScenarioResults[percentile90Index]?.yearlyCashFlows 
      ? allScenarioResults[percentile90Index].yearlyCashFlows 
      : [];
  }

  // Get percentiles from streaming || sorted results
  let percentileValues: { p10: number; p25: number; p50: number; p75: number; p90: number };
  
  if (streamingStats) {
    // Use streaming statistics (approximations but memory efficient)
    const stats = streamingStats.getStatistics();
    percentileValues = stats.percentiles;
  } else {
    // Sort results for percentile calculations
    results.sort((a, b) => a - b);
    percentileValues = {
      p10: results[Math.floor(results.length * 0.1)] || 0,
      p25: results[Math.floor(results.length * 0.25)] || 0,
      p50: results[Math.floor(results.length * 0.5)] || 0,
      p75: results[Math.floor(results.length * 0.75)] || 0,
      p90: results[Math.floor(results.length * 0.9)] || 0
    };
  }
  
  // Apply control variate adjustment if enabled
  let probabilityOfSuccess = iterations > 0 ? (successfulScenarios / iterations) : 0;
  const legacyProbabilityOfSuccess = iterations > 0 ? (legacySuccessfulScenarios / iterations) : 0;
  
  if (varianceReduction.useControlVariates && controlExpectation > 0) {
    // Calculate empirical mean && adjust using control variate
    const empiricalMean = successfulScenarios / iterations;
    
    // Estimate beta (correlation between simulation && control)
    // Simple approach: use ratio of standard deviations
    const empiricalStd = Math.sqrt(empiricalMean * (1 - empiricalMean) / iterations);
    const controlStd = Math.sqrt(controlExpectation * (1 - controlExpectation));
    
    // Apply control variate adjustment
    // Adjusted = Empirical + beta * (Control - E[Control])
    const beta = controlStd > 0 ? Math.min(1, empiricalStd / controlStd) : 0;
    const adjustment = beta * (controlExpectation - empiricalMean);
    
    // Apply adjustment with bounds [0, 1]
    probabilityOfSuccess = Math.max(0, Math.min(1, empiricalMean + adjustment * 0.5)); // Use 50% of adjustment for stability
    
    if (verbose) {
      console.log('Control Variate Adjustment:');
      console.log('  Empirical success rate:', (empiricalMean * 100).toFixed(2) + '%');
      console.log('  Control estimate:', (controlExpectation * 100).toFixed(2) + '%');
      console.log('  Adjusted success rate:', (probabilityOfSuccess * 100).toFixed(2) + '%');
    }
  }
  
  // FIX: Add safety checks to getPercentile
  const getPercentile = (percentile: number): number => {
    if (results.length === 0) return 0;
    const index = Math.max(0, Math.min(results.length - 1, Math.floor((percentile / 100) * (results.length - 1))));
    return results[index] || 0;
  };
  
  // FIX: Calculate average ending balance
  const averageEndingBalance = results.length > 0 
    ? results.reduce((sum, balance) => sum + balance, 0) / results.length 
    : 0;
  
  // Calculate safe withdrawal rate - DISABLED for performance
  // This was running 1000 additional Monte Carlo simulations inside the main loop!
  let safeWithdrawalRate = params.withdrawalRate;
  /* Temporarily disabled for performance
  if (probabilityOfSuccess < 80) {
    let low = 0.0;
    let high = 0.10;
    
    while (high - low > 0.0001) {
      const mid = (low + high) / 2;
      const testParams = { ...params, withdrawalRate: mid };
      
      let testSuccesses = 0;
      for (let i = 0; i < 100; i++) { // Reduced from 1000 to 100
        const testResult = runEnhancedRetirementScenario(testParams, returnConfig);
        if (testResult.success) testSuccesses++;
      }
      
      const testProbability = (testSuccesses / 100) * 100;
      if (testProbability < 80) {
        high = mid;
      } else {
        low = mid;
      }
    }
    safeWithdrawalRate = low;
  }
  */
  
  const averageDepletionYear = depletionYears.length > 0 
    ? depletionYears.reduce((sum, year) => sum + year, 0) / depletionYears.length
    : null;

  // Calculate projected portfolio at retirement
  const yearsUntilRetirement2 = Math.max(0, params.retirementAge - params.currentAge);
  let projectedRetirementPortfolio = params.currentRetirementAssets;
  
  for (let year = 0; year < yearsUntilRetirement2; year++) {
    // H&&le staggered retirement for savings with wage growth
    let yearSavings = params.annualSavings;
    if (params.userAnnualSavings !== undefined && params.spouseAnnualSavings !== undefined) {
      yearSavings = 0;
      const userRetired = (params.currentAge + year) >= params.retirementAge;
      const spouseRetired = params.spouseAge ? 
        (params.spouseAge + year) >= (params.spouseRetirementAge || params.retirementAge) : true;
      
      // Apply wage growth to individual savings
      if (!userRetired && params.userAnnualIncome) {
        const futureUserIncome = calculateProgressiveWageGrowth(
          params.userAnnualIncome,
          params.currentAge,
          params.currentAge + year
        );
        const savingsRate = params.userAnnualSavings / params.userAnnualIncome;
        yearSavings += futureUserIncome * savingsRate;
      } else if (!userRetired) {
        // Fallback: direct wage growth on savings
        yearSavings += params.userAnnualSavings * Math.pow(1.04, year);
      }
      
      if (!spouseRetired && params.spouseAnnualIncome) {
        const futureSpouseIncome = calculateProgressiveWageGrowth(
          params.spouseAnnualIncome,
          params.spouseAge || params.currentAge,
          (params.spouseAge || params.currentAge) + year
        );
        const spouseSavingsRate = params.spouseAnnualSavings / params.spouseAnnualIncome;
        yearSavings += futureSpouseIncome * spouseSavingsRate;
      } else if (!spouseRetired) {
        // Fallback: direct wage growth on savings
        yearSavings += params.spouseAnnualSavings * Math.pow(1.04, year);
      }
    } else {
      // Apply wage growth to total annual savings
      if (params.userAnnualIncome && params.spouseAnnualIncome) {
        const householdGrowth = calculateHouseholdIncomeGrowth(
          params.userAnnualIncome,
          params.spouseAnnualIncome,
          params.currentAge,
          params.spouseAge || params.currentAge,
          year
        );
        const currentHouseholdIncome = params.userAnnualIncome + params.spouseAnnualIncome;
        const savingsRate = params.annualSavings / currentHouseholdIncome;
        yearSavings = householdGrowth.totalHouseholdIncome * savingsRate;
      } else {
        // Fallback: 4% compound growth
        yearSavings = params.annualSavings * Math.pow(1.04, year);
      }
    }
    
    projectedRetirementPortfolio += yearSavings;
    projectedRetirementPortfolio *= (1 + projectionReturn);  // Use geometric return for deterministic projection
  }

  const successWithoutLTCRate = (iterations - ltcEventCount) > 0 ? (successWithoutLTC / (iterations - ltcEventCount)) * 100 : 0;
  const successWithLTCRate = ltcEventCount > 0 ? (successWithLTC / ltcEventCount) * 100 : 0;
  
  // Extract ending balances from scenario results for risk metrics
  const endingBalancesForMetrics = allScenarioResults.map(scenario => scenario.endingBalance);
  
  // Extract portfolio balances over time for drawdown calculation
  // Get the median scenario's balance trajectory for drawdown metrics
  const medianScenarioForDrawdown = allScenarioResults.sort((a, b) => a.endingBalance - b.endingBalance)[Math.floor(allScenarioResults.length / 2)];
  const portfolioBalances = medianScenarioForDrawdown && medianScenarioForDrawdown.yearlyCashFlows 
    ? medianScenarioForDrawdown.yearlyCashFlows.map((y: any) => y.portfolioBalance || 0)
    : [];
  
  // Calculate advanced risk metrics
  const cvar95 = calculateCVaR(endingBalancesForMetrics, 0.95);
  const cvar99 = calculateCVaR(endingBalancesForMetrics, 0.99);
  const drawdownMetrics = calculateDrawdownMetrics(portfolioBalances);
  const utilitySuccess = calculateUtilityAdjustedSuccess(endingBalancesForMetrics, params.currentRetirementAssets || 500000);
  const dangerZones = identifyDangerZones(allScenarioResults, params);
  const sequenceRisk = calculateSequenceRiskScore(allScenarioResults, params);
  const flexibilityMetrics = calculateRetirementFlexibility(params, allScenarioResults, iterations);
  
  // Create advanced risk metrics object
  const advancedRiskMetrics: AdvancedRiskMetrics = {
    cvar95,
    cvar99,
    maxDrawdown: drawdownMetrics.maxDrawdown,
    ulcerIndex: drawdownMetrics.ulcerIndex,
    successVariants: {
      standard: probabilityOfSuccess,
      legacy: legacyProbabilityOfSuccess,
      utilityAdjusted: utilitySuccess,
      withInflationAdjustment: probabilityOfSuccess * 0.95, // Conservative adjustment
      withHealthCosts: successWithLTCRate / 100
    },
    dangerZones,
    sequenceRiskScore: sequenceRisk,
    retirementFlexibility: flexibilityMetrics
  };
  
  // FIX: Return structure matching RetirementMonteCarloResult interface
  return {
    // Required properties from base interface
    successProbability: probabilityOfSuccess,
    legacySuccessProbability: legacyProbabilityOfSuccess,
    averageEndingBalance,
    averageYearsUntilDepletion: averageDepletionYear,
    allScenarios: allScenarioResults,
    yearlyData: allCashFlows,
    
    // STANDARDIZED: All probabilities as 0-1 decimal internally 
    probabilityOfSuccess: probabilityOfSuccess, // Now standardized as 0-1 decimal
    medianEndingBalance: getPercentile(50),
    percentile10EndingBalance: getPercentile(10),
    percentile90EndingBalance: getPercentile(90),
    yearsUntilDepletion: averageDepletionYear,
    confidenceIntervals: {
      percentile10: getPercentile(10),
      percentile25: getPercentile(25),
      percentile50: getPercentile(50),
      percentile75: getPercentile(75),
      percentile90: getPercentile(90),
    },
    scenarios: {
      successful: successfulScenarios,
      failed: iterations - successfulScenarios,
      total: iterations,
    },
    safeWithdrawalRate,
    currentRetirementAssets: params.currentRetirementAssets,
    projectedRetirementPortfolio: Math.round(projectedRetirementPortfolio),
    yearlyCashFlows: allCashFlows,
    guytonKlingerStats: guardrailsEnabled ? {
      averageAdjustmentsPerScenario: totalGKAdjustments / iterations,
      adjustmentTypeBreakdown: gkAdjustmentTypes
    } : undefined,
    ltcAnalysis: {
      hasInsurance: params.hasLongTermCareInsurance || false,
      probabilityOfLTC: iterations > 0 ? (ltcEventCount / iterations) : 0,
      avgCostIfOccurs: ltcCosts.length > 0 ? ltcCosts.reduce((a, b) => a + b, 0) / ltcCosts.length : 0,
      avgDurationIfOccurs: ltcDurations.length > 0 ? ltcDurations.reduce((a, b) => a + b, 0) / ltcDurations.length : 0,
      careTypeBreakdown: ltcCareTypes,
      impactOnSuccess: {
        successWithLTC: successWithLTCRate,
        successWithoutLTC: successWithoutLTCRate,
        failuresDueToLTC: iterations > 0 ? (failuresDueToLTC / iterations) * 100 : 0,
        successDelta: successWithoutLTCRate - successWithLTCRate
      }
    },
    percentile10CashFlows,
    percentile90CashFlows,
    regimeAnalysis: {
      averageBearYears: totalBearYears / iterations,
      averageCrisisYears: totalCrisisYears / iterations,
      worstCaseEndingBalance: worstCaseEndingBalance === Infinity ? 0 : worstCaseEndingBalance,
      earlyRetirementTransitions: regimeTransitions,
      sequenceRiskMetrics: {
        bearInFirst5Years: regimeTransitions['bull-to-bear'] + regimeTransitions['normal-to-bear'],
        crisisInFirst5Years: regimeTransitions['bull-to-crisis'] + regimeTransitions['normal-to-crisis'] + regimeTransitions['bear-to-crisis'],
        totalAdverseTransitions: Object.values(regimeTransitions).reduce((a, b) => a + b, 0)
      }
    },
    // Advanced risk metrics for comprehensive risk analysis
    advancedRiskMetrics
  };
}

// RightCapital-style Monte Carlo simulation using simple log-normal distribution
// This approach is more aligned with industry standards && CFP practices
// Helper function to calculate percentiles from sorted array
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  
  const index = Math.floor((percentile / 100) * (sortedValues.length - 1));
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

// ===== LTC MODELING - PHASE 1: SIMPLE SHOCK MODEL =====

// LTC Episode interface
interface LTCEpisode {
  hasEpisode: boolean;
  onsetAge?: number;
  durationYears?: number;
  careType: 'HomeCare' | 'AssistedLiving' | 'NursingHome' | 'Memory';
  baseDailyCost?: number;
  totalLifetimeCost?: number;
}

// Regional LTC cost multipliers (based on 2024 data)
function calculateRegionalLTCCost(state: string = 'National'): number {
  const stateCostMultipliers: { [key: string]: number } = {
    'CA': 1.4,   // California - high cost
    'NY': 1.35,  // New York - high cost
    'MA': 1.3,   // Massachusetts - high cost
    'CT': 1.25,  // Connecticut - high cost
    'NJ': 1.2,   // New Jersey - high cost
    'FL': 0.9,   // Florida - moderate cost
    'TX': 0.8,   // Texas - lower cost
    'GA': 0.85,  // Georgia - lower cost
    'NC': 0.9,   // North Carolina - moderate cost
    'AZ': 0.95,  // Arizona - moderate cost
    'NV': 1.0,   // Nevada - national average
    'WA': 1.15,  // Washington - above average
    'OR': 1.1,   // Oregon - above average
    'CO': 1.05,  // Colorado - slightly above average
    'IL': 1.0,   // Illinois - national average
    'MI': 0.9,   // Michigan - moderate cost
    'OH': 0.85,  // Ohio - lower cost
    'PA': 0.95,  // Pennsylvania - moderate cost
    'VA': 1.0,   // Virginia - national average
    'MD': 1.1,   // Maryl&& - above average
    'National': 1.0
  };
  
  // 2024 national average for comprehensive LTC care (realistic baseline)
  const nationalBaseCost = 75000; // $75K annual average - more realistic weighted average
  return nationalBaseCost * (stateCostMultipliers[state] || 1.0);
}

// Seeded random number generator for deterministic Monte Carlo
function createSeededRNG(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296; // Convert to 0-1 range
  };
}

// Sample from categorical distribution
function sampleFromDistribution(probabilities: { [key: string]: number }, rng: () => number): string {
  const cumulative: Array<{ key: string; cumProb: number }> = [];
  let sum = 0;
  
  for (const [key, prob] of Object.entries(probabilities)) {
    sum += prob;
    cumulative.push({ key, cumProb: sum });
  }
  
  const random = rng() * sum;
  for (const { key, cumProb } of cumulative) {
    if (random <= cumProb) return key;
  }
  
  return cumulative[cumulative.length - 1].key;
}

// Generate LTC episode for a single Monte Carlo iteration
function generateLTCEpisodeForIteration(
  ltcParams: NonNullable<RetirementMonteCarloParams['ltcModeling']>,
  iteration: number
): LTCEpisode {
  // Create deterministic randomness using iteration as seed
  const rng = createSeededRNG(iteration + 10000); // Offset to avoid collision
  
  // Probability check: does this iteration have LTC need?
  if (rng() > ltcParams.lifetimeProbability) {
    return { 
      hasEpisode: false, 
      careType: 'HomeCare',
      totalLifetimeCost: 0 
    };
  }
  
  // Generate onset age within range
  const [minAge, maxAge] = ltcParams.onsetAgeRange;
  const onsetAge = minAge + (maxAge - minAge) * rng();
  
  // Generate duration with gender adjustment
  const baseDuration = ltcParams.averageDuration;
  const genderMultiplier = ltcParams.gender === 'F' ? 1.15 : 0.85; // Women have longer episodes
  const durationVariability = 0.5 + rng(); // 0.5x to 1.5x variation
  const durationYears = Math.max(0.5, baseDuration * genderMultiplier * durationVariability);
  
  // Determine care type based on probabilities
  const careTypeProbs = {
    'HomeCare': 0.4,        // 40% - least expensive
    'AssistedLiving': 0.35, // 35% - moderate cost
    'NursingHome': 0.20,    // 20% - high cost
    'Memory': 0.05          // 5% - highest cost (memory care)
  };
  
  const careType = sampleFromDistribution(careTypeProbs, rng) as LTCEpisode['careType'];
  
  // Calculate base daily cost with care type multipliers
  const careTypeCostMultipliers = {
    'HomeCare': 0.6,        // 60% of average ($54K/year)
    'AssistedLiving': 0.8,  // 80% of average ($72K/year)
    'NursingHome': 1.2,     // 120% of average ($108K/year)
    'Memory': 1.4           // 140% of average ($126K/year)
  };
  
  const baseDailyCost = (ltcParams.averageAnnualCost * careTypeCostMultipliers[careType]) / 365;
  
  // Calculate total lifetime cost for this episode
  const totalLifetimeCost = baseDailyCost * 365 * durationYears;

  return {
    hasEpisode: true,
    onsetAge: Math.round(onsetAge),
    durationYears,
    careType,
    baseDailyCost,
    totalLifetimeCost
  };
}

// Calculate LTC cost for a specific year
function calculateLTCCostForYear(
  episode: LTCEpisode,
  currentAge: number,
  yearIndex: number,
  generalInflation: number,
  ltcInflation: number,
  ltcParams?: NonNullable<RetirementMonteCarloParams['ltcModeling']>
): number {
  if (!episode.hasEpisode || !episode.onsetAge || !episode.baseDailyCost) return 0;
  
  // Check if this year falls within the LTC episode
  const episodeEndAge = episode.onsetAge + (episode.durationYears || 0);
  if (currentAge < episode.onsetAge || currentAge > episodeEndAge) return 0;
  
  // Use real-dollar LTC costs (no pre-onset compounding)
  // Only inflate within the episode years for more realistic modeling
  const yearsIntoEpisode = currentAge - episode.onsetAge;
  const inflatedDailyCost = episode.baseDailyCost * Math.pow(1 + ltcInflation, Math.max(0, yearsIntoEpisode));
  
  // Calculate partial year costs if episode starts/ends mid-year
  const remainingDuration = (episode.durationYears || 0) - yearsIntoEpisode;
  const fractionOfYear = Math.min(1, Math.max(0, remainingDuration));
  
  // Base annual cost
  let annualCost = inflatedDailyCost * 365 * fractionOfYear;
  
  // CRITICAL: Apply insurance coverage if user has LTC insurance
  if (ltcParams?.hasInsurance && ltcParams?.ltcInsurance) {
    const insurance = ltcParams.ltcInsurance;
    const yearsIntoCare = Math.floor(yearsIntoEpisode);
    
    // Check if within benefit period
    const isWithinBenefitPeriod = yearsIntoCare < insurance.benefitYears;
    
    // Check if elimination period has been met
    const eliminationDays = insurance.eliminationDays;
    const daysSinceCareStart = yearsIntoEpisode * 365;
    const hasMetEliminationPeriod = daysSinceCareStart >= eliminationDays;
    
    if (isWithinBenefitPeriod && hasMetEliminationPeriod) {
      // Insurance pays the daily benefit amount
      const insuranceBenefit = insurance.dailyBenefit * 365 * fractionOfYear;
      
      // Apply inflation adjustment to benefit if rider exists
      let adjustedBenefit = insuranceBenefit;
      if (insurance.inflationRider) {
        adjustedBenefit = insuranceBenefit * Math.pow(1 + ltcInflation, yearIndex);
      }
      
      // Net cost = Total cost - Insurance benefit (but never negative)
      annualCost = Math.max(0, annualCost - adjustedBenefit);
    }
    
    // Add insurance premium costs (paid annually while healthy)
    if (currentAge < episode.onsetAge) {
      // Still paying premiums before care starts
      const inflatedPremium = insurance.annualPremium * Math.pow(1 + generalInflation, yearIndex);
      annualCost += inflatedPremium;
    }
  }
  
  return annualCost;
}

// ===== END LTC MODELING FUNCTIONS =====

export function runRightCapitalStyleMonteCarloSimulation(
  params: RetirementMonteCarloParams,
  iterations: number = 1000,
  enableDetailedLogging: boolean = false
): MonteCarloResult {
  // DEPRECATION/SAFETY GUARD:
  // This legacy RC-style engine is retained for backwards compatibility in tests and some routes,
  // but should NOT be used in production. Prefer runEnhancedMonteCarloSimulation.
  if (process && (process.env.MC_DISABLE_RC_STYLE === '1' || process.env.NODE_ENV === 'production')) {
    throw new Error('RightCapital-style Monte Carlo is disabled. Use runEnhancedMonteCarloSimulation instead.');
  }
  console.warn('[DEPRECATED] runRightCapitalStyleMonteCarloSimulation called. Use runEnhancedMonteCarloSimulation.');
  const results: SimulationIteration[] = [];
  let successfulRuns = 0;
  let totalDeficit = 0;
  let maxDeficit = 0;
  let totalSurplus = 0;
  let maxSurplus = 0;

  console.log('=== RIGHTCAPITAL-STYLE MONTE CARLO SIMULATION ===');
  console.log('Using simple log-normal distribution (industry standard)');
  console.log('Iterations:', iterations);
  console.log('Expected Return:', (params.expectedReturn * 100).toFixed(1) + '%');
  console.log('Volatility:', (params.returnVolatility * 100).toFixed(1) + '%');
  console.log('=== START SIMULATION ===');

  for (let iteration = 0; iteration < iterations; iteration++) {
    const baseSeed = (((params as any).randomSeed || 12345) + iteration * 10007) >>> 0;
    const rng = new RNG(baseSeed);
    const result = runSingleRightCapitalStyleIteration(params, iteration, enableDetailedLogging, rng);
    results.push(result);

    if (result.success) {
      successfulRuns++;
      totalSurplus += Math.max(0, result.finalPortfolioValue);
      maxSurplus = Math.max(maxSurplus, result.finalPortfolioValue);
    } else {
      const deficit = Math.abs(result.totalShortfall || 0);
      totalDeficit += deficit;
      maxDeficit = Math.max(maxDeficit, deficit);
    }

    // Progress logging
    if ((iteration + 1) % 500 === 0 || iteration === iterations - 1) {
      const progress = ((iteration + 1) / iterations * 100).toFixed(1);
      const currentSuccessRate = (successfulRuns / (iteration + 1) * 100).toFixed(1);
      console.log(`Progress: ${progress}% (${iteration + 1}/${iterations}), Success Rate: ${currentSuccessRate}%`);
    }
  }

  const successProbability = successfulRuns / iterations;
  const averageDeficit = totalDeficit / Math.max(1, iterations - successfulRuns);
  const averageSurplus = totalSurplus / Math.max(1, successfulRuns);

  console.log('=== SIMULATION COMPLETE ===');
  console.log(`Success Rate: ${(successProbability * 100).toFixed(1)}%`);
  console.log(`Successful Runs: ${successfulRuns}/${iterations}`);
  console.log(`Average Deficit: $${averageDeficit.toFixed(0)}`);
  console.log(`Average Surplus: $${averageSurplus.toFixed(0)}`);

  return {
    successProbability,
    results,
    summary: {
      successfulRuns,
      totalRuns: iterations,
      averageDeficit,
      maxDeficit,
      averageSurplus,
      maxSurplus,
      medianFinalValue: calculatePercentile(results.map(r => r.finalPortfolioValue), 50),
      percentile10: calculatePercentile(results.map(r => r.finalPortfolioValue), 10),
      percentile25: calculatePercentile(results.map(r => r.finalPortfolioValue), 25),
      percentile75: calculatePercentile(results.map(r => r.finalPortfolioValue), 75),
      percentile90: calculatePercentile(results.map(r => r.finalPortfolioValue), 90)
    }
  };
}

// Single iteration using RightCapital's approach (simple log-normal returns)
function runSingleRightCapitalStyleIteration(
  params: RetirementMonteCarloParams,
  iterationNumber: number,
  enableDetailedLogging: boolean,
  rngArg?: RandomSource
): SimulationIteration {
  const rng = rngArg;
  const {
    currentAge,
    spouseAge,
    retirementAge,
    spouseRetirementAge,
    lifeExpectancy,
    spouseLifeExpectancy,
    currentRetirementAssets,
    annualGuaranteedIncome,
    annualRetirementExpenses,
    expectedReturn,
    spouseExpectedReturn,  // Add spouse-specific return
    jointAssetsReturn,     // Add joint assets return
    userAssetTotal,        // Add user asset total
    spouseAssetTotal,      // Add spouse asset total
    jointAssetTotal,       // Add joint asset total
    returnVolatility,
    inflationRate,
    taxRate,
    annualSavings,
    userAnnualSavings,
    spouseAnnualSavings,
    userAnnualIncome,
    spouseAnnualIncome,
    legacyGoal
  } = params;

  // Initialize portfolio with owner-specific tracking
  let portfolioValue = currentRetirementAssets;
  
  // Track portfolio values by owner for accurate return application
  const totalAssets = (userAssetTotal || 0) + (spouseAssetTotal || 0) + (jointAssetTotal || 0);
  let userPortfolioRatio = totalAssets > 0 ? (userAssetTotal || 0) / totalAssets : 0.5;
  let spousePortfolioRatio = totalAssets > 0 ? (spouseAssetTotal || 0) / totalAssets : 0.3;
  let jointPortfolioRatio = totalAssets > 0 ? (jointAssetTotal || 0) / totalAssets : 0.2;
  
  // Initialize owner-specific portfolio values
  let userPortfolio = portfolioValue * userPortfolioRatio;
  let spousePortfolio = portfolioValue * spousePortfolioRatio;
  let jointPortfolio = portfolioValue * jointPortfolioRatio;
  
  // Track portfolio balances by account type for tax-efficient withdrawals
  // Prefer categorized buckets built in profileToRetirementParams; fallback otherwise
  let taxableBalance = 0;
  let taxDeferredBalance = 0;
  let rothBalance = 0;

  const aggregateBuckets = (b?: { taxDeferred: number; taxFree: number; capitalGains: number; cashEquivalents: number; totalAssets: number }) => {
    if (!b) return { td: 0, tf: 0, cg: 0, cash: 0, total: 0 };
    return { td: b.taxDeferred || 0, tf: b.taxFree || 0, cg: b.capitalGains || 0, cash: b.cashEquivalents || 0, total: b.totalAssets || 0 };
  };

  const u = aggregateBuckets(params.userAssetBuckets);
  const s = aggregateBuckets(params.spouseAssetBuckets);
  const j = aggregateBuckets(params.jointAssetBuckets);
  const aggTd = u.td + s.td + j.td;
  const aggTf = u.tf + s.tf + j.tf;
  const aggCg = u.cg + s.cg + j.cg;
  const aggCash = u.cash + s.cash + j.cash;
  const aggTotal = u.total + s.total + j.total;

  if (aggTotal > 0) {
    taxDeferredBalance = aggTd;
    rothBalance = aggTf;
    taxableBalance = aggCg + aggCash;
    // Scale to initial portfolio value if totals differ
    const parsedTotal = taxDeferredBalance + rothBalance + taxableBalance;
    if (parsedTotal > 0 && Math.abs(parsedTotal - portfolioValue) > 1) {
      const scaleFactor = portfolioValue / parsedTotal;
      taxDeferredBalance *= scaleFactor;
      rothBalance *= scaleFactor;
      taxableBalance *= scaleFactor;
    }
  } else if (params.assetBuckets) {
    // Fallback to combined buckets if present
    taxDeferredBalance = params.assetBuckets.taxDeferred || 0;
    rothBalance = params.assetBuckets.taxFree || 0;
    taxableBalance = (params.assetBuckets.capitalGains || 0) + (params.assetBuckets.cashEquivalents || 0);
    const parsedTotal = taxDeferredBalance + rothBalance + taxableBalance;
    if (parsedTotal > 0 && Math.abs(parsedTotal - portfolioValue) > 1) {
      const scaleFactor = portfolioValue / parsedTotal;
      taxDeferredBalance *= scaleFactor;
      rothBalance *= scaleFactor;
      taxableBalance *= scaleFactor;
    }
  } else {
    // Last-resort fallback: simple split
    taxableBalance = portfolioValue * 0.3;
    taxDeferredBalance = portfolioValue * 0.5;
    rothBalance = portfolioValue * 0.2;
  }
  
  let currentUserAge = currentAge;
  let currentSpouseAge = spouseAge || currentAge;
  let totalContributions = 0;
  let totalWithdrawals = 0;
  let totalTaxesPaid = 0;
  let totalRMDPenalties = 0;
  let yearsWithShortfall = 0;
  let totalShortfall = 0;
  let maxShortfall = 0;
  
  // Track MAGI by year to approximate IRMAA 2-year lookback
  // FIX: Initialize with pre-retirement MAGI to avoid understating IRMAA in early retirement
  const preRetirementMAGI = (params.userAnnualIncome || 0) + (params.spouseAnnualIncome || 0);
  const magiHistory: number[] = [preRetirementMAGI, preRetirementMAGI]; // Seed with last working year MAGI
  
  const yearlyData: YearlyData[] = [];
  const baseLifeExpectancy = Math.max(lifeExpectancy, spouseLifeExpectancy || lifeExpectancy);
  // Remove longevity tail modeling for baseline; use fixed life expectancy age = 93
  const FIXED_LE_AGE_RC = 93;
  const effectiveLifeExpectancy = FIXED_LE_AGE_RC;

  // Generate LTC episode for this iteration (Phase 1: Simple Shock Model)
  const ltcEpisode = params.ltcModeling?.enabled 
    ? generateLTCEpisodeForIteration(params.ltcModeling, iterationNumber)
    : { hasEpisode: false, careType: 'HomeCare' as const, totalLifetimeCost: 0 };
  
  // Track LTC costs for analysis
  let totalLTCCosts = 0;

  // Simulation loop - much simpler than regime-based approach
  // Track survival flags for simplified RC-style modeling (no dynamic mortality here)
  let userAlive = true;
  let spouseAlive = spouseAge !== undefined;
  let acaContext: any = undefined;
  let acaEnrollees: number[] = [];
  for (let year = 0; year < effectiveLifeExpectancy - currentAge; year++) {
    let withdrawalPlan: any | undefined = undefined;
    let socialSecurityIncome = 0;
    let nonSSGuaranteedIncome = 0;
    // Dividend/interest yield estimate for MAGI purposes (not applied to portfolio mechanics)
    const DIV_INT_YIELD = 0.02; // 2% combined dividend/interest estimate on taxable holdings
    // Track taxable balance before we process any withdrawals this iteration (used for MAGI est.)
    let taxableBalanceBeforeWithdrawal = taxableBalance;
    currentUserAge = currentAge + year;
    currentSpouseAge = (spouseAge || currentAge) + year;

    // === CONTRIBUTION PHASE (Before Retirement) ===
    let contributions = 0;
    let userContribution = 0;
    let spouseContribution = 0;
    
    if (currentUserAge < retirementAge || (spouseAge && currentSpouseAge < (spouseRetirementAge || retirementAge))) {
      // Calculate contributions based on who's still working
      const userStillWorking = currentUserAge < retirementAge;
      const spouseStillWorking = spouseAge ? currentSpouseAge < (spouseRetirementAge || retirementAge) : false;
      
      if (userStillWorking && spouseStillWorking) {
        contributions = annualSavings;
        userContribution = userAnnualSavings || (annualSavings * 0.6);
        spouseContribution = spouseAnnualSavings || (annualSavings * 0.4);
      } else if (userStillWorking) {
        contributions = userAnnualSavings || (annualSavings * 0.6); // Assume user contributes 60% if married
        userContribution = contributions;
        spouseContribution = 0;
      } else if (spouseStillWorking) {
        contributions = spouseAnnualSavings || (annualSavings * 0.4); // Assume spouse contributes 40%
        userContribution = 0;
        spouseContribution = contributions;
      }
      
      // REAL DOLLAR MODEL: Keep contributions constant in today's purchasing power
      // No inflation adjustment needed since returns are already real (after inflation)
      
      portfolioValue += contributions;
      totalContributions += contributions;
      
      // Update owner-specific portfolios with contributions
      // Assume contributions go to respective owner's accounts
      userPortfolio += userContribution;
      spousePortfolio += spouseContribution;
    }

    // === OWNER-SPECIFIC LOG-NORMAL RETURN GENERATION ===
    // Apply different returns based on asset ownership
    
    // Generate returns for user assets
    const userLogMean = Math.log(1 + (expectedReturn || 0.05)) - (returnVolatility * returnVolatility) / 2;
    const userLogStdDev = returnVolatility;
    const userStandardNormal = (rng ? rng.normal() : deriveRNG(undefined, 'owner-user-normal').normal());
    const userLogReturn = userLogMean + userLogStdDev * userStandardNormal;
    let userAnnualReturn = Math.exp(userLogReturn) - 1;
    
    // Generate returns for spouse assets (if applicable)
    let spouseAnnualReturn = userAnnualReturn; // Default to user's return
    if (spouseAge && spouseExpectedReturn !== undefined) {
      const spouseLogMean = Math.log(1 + (spouseExpectedReturn || 0.05)) - (returnVolatility * returnVolatility) / 2;
      const spouseLogStdDev = returnVolatility;
      const spouseStandardNormal = (rng ? rng.normal() : deriveRNG(undefined, 'owner-spouse-normal').normal());
      const spouseLogReturn = spouseLogMean + spouseLogStdDev * spouseStandardNormal;
      spouseAnnualReturn = Math.exp(spouseLogReturn) - 1;
    }
    
    // Generate returns for joint assets (blended return)
    let jointAnnualReturn = userAnnualReturn; // Default to user's return
    if (jointAssetsReturn !== undefined) {
      const jointLogMean = Math.log(1 + (jointAssetsReturn || 0.05)) - (returnVolatility * returnVolatility) / 2;
      const jointLogStdDev = returnVolatility;
      const jointStandardNormal = (rng ? rng.normal() : deriveRNG(undefined, 'owner-joint-normal').normal());
      const jointLogReturn = jointLogMean + jointLogStdDev * jointStandardNormal;
      jointAnnualReturn = Math.exp(jointLogReturn) - 1;
    }
    
    // FIX: Apply mean reversion BEFORE updating balances
    userAnnualReturn = calculateMeanReversionAdjustment(year, userAnnualReturn);
    spouseAnnualReturn = calculateMeanReversionAdjustment(year, spouseAnnualReturn);
    jointAnnualReturn = calculateMeanReversionAdjustment(year, jointAnnualReturn);
    
    // Apply adjusted returns to owner-specific portfolios
    userPortfolio *= (1 + userAnnualReturn);
    spousePortfolio *= (1 + spouseAnnualReturn);
    jointPortfolio *= (1 + jointAnnualReturn);
    
    // Update total portfolio value
    const previousPortfolioValue = portfolioValue;
    portfolioValue = userPortfolio + spousePortfolio + jointPortfolio;
    
    // Calculate blended return for reporting
    let annualReturn = previousPortfolioValue > 0 ? (portfolioValue / previousPortfolioValue) - 1 : 0;
    
    // Apply adjusted returns to account types (using blended return)
    taxableBalance *= (1 + annualReturn);
    taxDeferredBalance *= (1 + annualReturn);
    rothBalance *= (1 + annualReturn);
    
    // Check for fat tail/black swan events
    const fatTailEvent = generateFatTailEvent(rng);
    if (fatTailEvent.hasEvent) {
      // Apply the crash to the portfolio
      const crashImpact = 1 + fatTailEvent.severity;
      portfolioValue *= crashImpact;
      userPortfolio *= crashImpact;
      spousePortfolio *= crashImpact;
      jointPortfolio *= crashImpact;
      annualReturn = Math.min(annualReturn, fatTailEvent.severity);
      
      if (enableDetailedLogging && iterationNumber < 5) {
        console.log(`Year ${year}: ${fatTailEvent.type} occurred with ${(fatTailEvent.severity * 100).toFixed(1)}% loss`);
      }
    }
    
    // Apply rebalancing costs annually with dynamic allocation
    if (year % 1 === 0 && portfolioValue > 0) {
      // Get current dynamic allocation
      const currentDynamicAllocation = calculateDynamicAssetAllocation(
        currentUserAge,
        retirementAge,
        'traditional'
      );
      
      // Simulate current allocation drift
      const stockGrowth = annualReturn > 0 ? 1.2 : 0.8; // Stocks drift more
      const bondGrowth = annualReturn > 0 ? 0.8 : 1.2; // Bonds drift opposite
      const currentStockWeight = currentDynamicAllocation.stocks * stockGrowth;
      const currentBondWeight = currentDynamicAllocation.bonds * bondGrowth;
      const totalWeight = currentStockWeight + currentBondWeight;
      
      const rebalancingCost = calculateRebalancingCosts(
        portfolioValue,
        currentDynamicAllocation, // Use dynamic target allocation
        { stocks: currentStockWeight / totalWeight, bonds: currentBondWeight / totalWeight },
        year
      );
      
      if (rebalancingCost > 0) {
        portfolioValue -= rebalancingCost;
        const costRatio = rebalancingCost / (portfolioValue + rebalancingCost);
        userPortfolio *= (1 - costRatio);
        spousePortfolio *= (1 - costRatio);
        jointPortfolio *= (1 - costRatio);
      }
    }

    // === WITHDRAWAL PHASE (After Retirement) ===
    let withdrawal = 0;
    let guaranteedIncome = 0;
    let shortfall = 0;

    if (currentUserAge >= retirementAge && (spouseAge === undefined || currentSpouseAge >= (spouseRetirementAge || retirementAge))) {
      // Both retired - use constant real expenses (no inflation adjustment in real dollar model)
      let baseExpenses = annualRetirementExpenses;
      
      // Baseline: do not add spending shocks; keep intake-form expenses
      // Enable only in stress mode or when explicitly requested
      if (process.env.STRESS_MODE === '1' || process.env.ENABLE_SPENDING_SHOCKS === '1') {
        const spendingVolatility = generateSpendingVolatility(baseExpenses, currentUserAge, rng);
        baseExpenses += spendingVolatility;
      }
      
  // Add healthcare costs beyond LTC (Medicare, supplements, out-of-pocket)
      const isMarried = spouseAge !== undefined;
      // Compute healthcare costs per person: Medicare only when age >= 65
      // Only add modeled healthcare/ACA if expensesIncludeHealthcare !== false
      if (params.expensesIncludeHealthcare !== false) {
        const userHealthcare = calculateHealthcareCosts(currentUserAge, year, inflationRate, false);
        const spouseHealthcare = (spouseAlive && currentSpouseAge) ? calculateHealthcareCosts(currentSpouseAge, year, inflationRate, false) : 0;
        let healthcareCosts = userHealthcare + spouseHealthcare;

        // Add pre‑Medicare ACA marketplace net premiums (Phase 1 baseline)
        const priorMAGI = magiHistory[Math.max(0, year - 1)] || preRetirementMAGI;
        const householdSize = 1 + (spouseAlive ? 1 : 0);
        const stateForACA = (params.retirementState || params.profileData?.state || 'TX');
        // Use predeclared ACA context variables
        acaContext = undefined;
        acaEnrollees = [];
        if (currentUserAge < 65 && userAlive) acaEnrollees.push(currentUserAge);
        if (spouseAlive && currentSpouseAge && currentSpouseAge < 65) acaEnrollees.push(currentSpouseAge);
        if (acaEnrollees.length > 0) {
          const acaNet = computeAcaNetPremiums(acaEnrollees, stateForACA, priorMAGI, householdSize, year);
          healthcareCosts += acaNet.totalNetPremium;
          acaContext = { aptc: acaNet.aptc, totalGross: acaNet.totalGross, totalNetPremium: acaNet.totalNetPremium };
        }
        baseExpenses += healthcareCosts;
      }
      
      // Calculate IRMAA surcharges based on income
      // Use IRMAA 2-year lookback: apply bracket based on MAGI from 2 years ago
      const filingStatus = (params.filingStatus as any) || (isMarried ? 'married' : 'single');
      // FIX: Use seeded MAGI history to avoid understatement in first two years
      const lookbackIndex = Math.max(0, year - 2);
      const lookbackMAGI = magiHistory[lookbackIndex] || preRetirementMAGI;
      const currentCalendarYear = new Date().getFullYear() + year;
      // Baseline: exclude IRMAA premiums from expenses unless stress mode enabled
      if (process.env.STRESS_MODE === '1' || process.env.ENABLE_IRMAA === '1') {
        let irmaaTotal = 0;
        if (userAlive && currentUserAge >= 65) {
          irmaaTotal += calculateIRMAA(lookbackMAGI, filingStatus, currentCalendarYear).annualSurcharge;
        }
        if (spouseAlive && currentSpouseAge && currentSpouseAge >= 65) {
          irmaaTotal += calculateIRMAA(lookbackMAGI, filingStatus, currentCalendarYear).annualSurcharge;
        }
        baseExpenses += irmaaTotal;
      }
      
      // Track mortgage payments && when they end
      let mortgagePayment = 0;
      if (params.profileData && params.profileData.primaryResidence) {
        const mortgageYearsRemaining = params.profileData.primaryResidence.yearsToPayOffMortgage || 0;
        const mortgageMonthlyPayment = params.profileData.primaryResidence.monthlyPayment || 0;
        
        // Check if mortgage is still active
        if (year < mortgageYearsRemaining) {
          mortgagePayment = mortgageMonthlyPayment * 12; // Annual mortgage payment
          baseExpenses += mortgagePayment;
        }
        // After mortgage ends, expenses naturally decrease
      }
      
      // Calculate LTC cost for this year (Phase 1: Simple Shock Model)
      const ltcCostThisYear = params.ltcModeling?.enabled 
        ? calculateLTCCostForYear(
            ltcEpisode, 
            currentUserAge, 
            year, 
            inflationRate,
            params.ltcModeling.costInflationRate,
            params.ltcModeling // Pass LTC parameters for insurance calculations
          )
        : 0;
      
      totalLTCCosts += ltcCostThisYear;
      
      // Apply expense replacement during LTC care periods
      let adjustedBaseExpenses = baseExpenses;
      if (ltcCostThisYear > 0 && ltcEpisode.careType) {
        // Reduce base expenses based on care type
        const expenseReplacementFactor = 
          ltcEpisode.careType === 'HomeCare' ? 0.15 :        // 15% of expenses replaced by home care
          ltcEpisode.careType === 'AssistedLiving' ? 0.40 :  // 40% replaced by assisted living
          ltcEpisode.careType === 'NursingHome' ? 0.60 :     // 60% replaced by nursing home
          ltcEpisode.careType === 'Memory' ? 0.60 : 0.40;    // 60% replaced by memory care
        adjustedBaseExpenses = baseExpenses * (1 - expenseReplacementFactor);
      }
      
      const inflatedExpenses = adjustedBaseExpenses + ltcCostThisYear;
      
      // ENHANCED: Calculate age-appropriate guaranteed income with annuity age-based triggering
      // This accounts for Social Security claim ages, pension timing, && annuity start dates
      guaranteedIncome = 0;
      const currentYear = new Date().getFullYear() + year;
      
      // Social Security (starts at claim age, not retirement age)
      socialSecurityIncome = 0;
      nonSSGuaranteedIncome = 0;
      const socialSecurityClaimAge = params.socialSecurityClaimAge || 67;
      const spouseSocialSecurityClaimAge = params.spouseSocialSecurityClaimAge || 67;
      
      if (currentUserAge >= socialSecurityClaimAge && params.socialSecurityBenefit) {
        // FIX: Apply Social Security solvency adjustment
        const currentCalendarYear = new Date().getFullYear() + year;
      const adjustedBenefit = adjustSocialSecurityForSolvency(
          params.socialSecurityBenefit * 12,
          currentCalendarYear,
        (rng ? deriveRNG(rng, 'ss-solvency-user').next() : deriveRNG(undefined, 'ss-solvency-user', currentCalendarYear).next())
        );
        socialSecurityIncome += adjustedBenefit;
      }
      if (currentSpouseAge >= spouseSocialSecurityClaimAge && params.spouseSocialSecurityBenefit) {
        // FIX: Apply Social Security solvency adjustment for spouse
        const currentCalendarYear = new Date().getFullYear() + year;
      const adjustedSpouseBenefit = adjustSocialSecurityForSolvency(
          params.spouseSocialSecurityBenefit * 12,
          currentCalendarYear,
        (rng ? deriveRNG(rng, 'ss-solvency-spouse').next() : deriveRNG(undefined, 'ss-solvency-spouse', currentCalendarYear).next())
        );
        socialSecurityIncome += adjustedSpouseBenefit;
      }
      
      // Pensions (start at retirement age)
      if (currentUserAge >= retirementAge && params.pensionBenefit) {
        nonSSGuaranteedIncome += params.pensionBenefit * 12;
      }
      if (currentSpouseAge >= (spouseRetirementAge || retirementAge) && params.spousePensionBenefit) {
        nonSSGuaranteedIncome += params.spousePensionBenefit * 12;
      }
      
      // Part-time income continues until death (no decay, realistic model)
      if (currentUserAge >= retirementAge && params.partTimeIncomeRetirement) {
        nonSSGuaranteedIncome += params.partTimeIncomeRetirement * 12;
      }
      if (currentSpouseAge >= (spouseRetirementAge || retirementAge) && params.spousePartTimeIncomeRetirement) {
        nonSSGuaranteedIncome += params.spousePartTimeIncomeRetirement * 12;
      }

      guaranteedIncome = socialSecurityIncome + nonSSGuaranteedIncome;
      
      // FIXED: Annuity income with proper age-based triggering
      // Calculate annuities that should be paying in this specific year
      if (params.profileData && params.profileData.assets) {
        const annuityTypes = ['qualified-annuities', 'non-qualified-annuities', 'roth-annuities'];
        const annuities = params.profileData.assets.filter((asset: any) => annuityTypes.includes(asset.type));
        const isMarriedOrPartnered = params.profileData.maritalStatus === 'married' || params.profileData.maritalStatus === 'partnered';
        
        let annualAnnuityIncome = 0;
        annuities.forEach((annuity: any) => {
          // Only include if owned by user || joint (or all if married/partnered)
          const owner = (annuity.owner || 'user').toLowerCase();
          if (isMarriedOrPartnered || owner === 'user' || owner === 'joint') {
            if (annuity.annuityType === 'immediate' || 
                (annuity.annuityType === 'deferred' && annuity.payoutStartDate)) {
              // Check if payout has started for this specific year
              const payoutStartDate = annuity.payoutStartDate ? new Date(annuity.payoutStartDate) : null;
              const hasStartedPayout = !payoutStartDate || payoutStartDate.getFullYear() <= currentYear;
              
              if (hasStartedPayout && annuity.payoutAmount) {
                const payoutAmount = Number(annuity.payoutAmount) || 0;
                const frequency = annuity.payoutFrequency || 'monthly';
                
                // Convert to annual amount
                let annualAmount = payoutAmount * 12; // Default: monthly
                if (frequency === 'quarterly') annualAmount = payoutAmount * 4;
                if (frequency === 'annually') annualAmount = payoutAmount;
                
                annualAnnuityIncome += annualAmount;
              }
            }
          }
        });
        
        guaranteedIncome += annualAnnuityIncome;
      }
      
      // REAL DOLLAR MODEL: Keep guaranteed income constant in today's purchasing power
      // No inflation adjustment needed since we're using real dollar projections
      
      const netExpenses = Math.max(0, inflatedExpenses - guaranteedIncome);
      // Update pre-withdrawal taxable snapshot for MAGI computation
      taxableBalanceBeforeWithdrawal = taxableBalance;
      
      if (netExpenses > 0 || (currentUserAge >= 73 && taxDeferredBalance > 0)) {
        // Calculate RMD if applicable
        let rmdAmount = 0;
        if (currentUserAge >= 73 && taxDeferredBalance > 0) {
          const rmdFactor = getRMDFactor(currentUserAge);
          rmdAmount = taxDeferredBalance / rmdFactor;
        }
        
        // Get state tax information
        const stateTax = getStateTaxRate(params.retirementState || (params.profileData?.retirementState || params.profileData?.state) || 'TX');
        
        // Calculate combined federal + state tax rate
        const federalRate = Math.min(0.37, Math.max(0, taxRate || 0.15));
        const stateRate = stateTax.incomeRate;
        const effectiveTaxRate = federalRate + stateRate * (1 - federalRate); // Account for state tax deduction
        
        // Calculate tax-efficient withdrawals
        withdrawalPlan = calculateLocalTaxEfficientWithdrawals(
          netExpenses,
          {
            taxable: taxableBalance,
            taxDeferred: taxDeferredBalance,
            roth: rothBalance
          },
          rmdAmount,
          currentUserAge,
          effectiveTaxRate
        );
        
        withdrawal = withdrawalPlan.totalWithdrawal;
        const taxesPaid = withdrawalPlan.taxesOwed;
        
        // Check for RMD penalties
        if (rmdAmount > 0 && withdrawalPlan.taxDeferredWithdrawal < rmdAmount) {
          const missedRMD = rmdAmount - withdrawalPlan.taxDeferredWithdrawal;
          const penalty = missedRMD * 0.25; // 25% penalty for missed RMDs
          totalRMDPenalties += penalty;
          portfolioValue -= penalty; // Deduct penalty from portfolio
          
          if (enableDetailedLogging && iterationNumber < 5) {
            console.log(`Year ${year}: RMD penalty of $${penalty.toFixed(0)} for missing $${missedRMD.toFixed(0)} RMD`);
          }
        }
        
        // Check for early withdrawal penalties (before age 59.5)
        if (currentUserAge < 59.5 && withdrawalPlan.taxDeferredWithdrawal > 0) {
          // 10% penalty on early withdrawals from tax-deferred accounts
          const earlyWithdrawalPenalty = withdrawalPlan.taxDeferredWithdrawal * 0.10;
          totalRMDPenalties += earlyWithdrawalPenalty; // Track with other penalties
          portfolioValue -= earlyWithdrawalPenalty;
          totalTaxesPaid += earlyWithdrawalPenalty; // This is an additional tax
          
          if (enableDetailedLogging && iterationNumber < 5) {
            console.log(`Year ${year}: Early withdrawal penalty of $${earlyWithdrawalPenalty.toFixed(0)} (age ${currentUserAge.toFixed(1)})`);
          }
        }
        
        if (portfolioValue >= withdrawal) {
          // Update account balances
          taxableBalance = Math.max(0, taxableBalance - withdrawalPlan.taxableWithdrawal);
          taxDeferredBalance = Math.max(0, taxDeferredBalance - withdrawalPlan.taxDeferredWithdrawal);
          rothBalance = Math.max(0, rothBalance - withdrawalPlan.rothWithdrawal);
          
          // Update owner portfolios proportionally
          const totalPortfolio = userPortfolio + spousePortfolio + jointPortfolio;
          if (totalPortfolio > 0) {
            const userWithdrawal = withdrawal * (userPortfolio / totalPortfolio);
            const spouseWithdrawal = withdrawal * (spousePortfolio / totalPortfolio);
            const jointWithdrawal = withdrawal * (jointPortfolio / totalPortfolio);
            
            userPortfolio = Math.max(0, userPortfolio - userWithdrawal);
            spousePortfolio = Math.max(0, spousePortfolio - spouseWithdrawal);
            jointPortfolio = Math.max(0, jointPortfolio - jointWithdrawal);
          }
          
          portfolioValue = taxableBalance + taxDeferredBalance + rothBalance;
          totalWithdrawals += withdrawal;
          totalTaxesPaid += taxesPaid;
        } else {
          // Portfolio exhausted - withdraw what's available
          withdrawal = portfolioValue;
          // After-tax amount delivered to cover expenses
          const netDelivered = withdrawal * (1 - effectiveTaxRate);
          const taxesPaid = withdrawal - netDelivered;
          shortfall = netExpenses - netDelivered;
          totalTaxesPaid += taxesPaid;
          portfolioValue = 0;
          userPortfolio = 0;
          spousePortfolio = 0;
          jointPortfolio = 0;
          
          yearsWithShortfall++;
          totalShortfall += shortfall;
          maxShortfall = Math.max(maxShortfall, shortfall);
        }
      }
    }

    // Calculate LTC cost for this year (also for pre-retirement tracking)
    const currentYearLTCCost = params.ltcModeling?.enabled 
      ? calculateLTCCostForYear(
          ltcEpisode, 
          currentUserAge, 
          year, 
          inflationRate,
          params.ltcModeling.costInflationRate,
          params.ltcModeling // Pass LTC parameters for insurance calculations
        )
      : 0;

    // Record yearly data
    yearlyData.push({
      year: year + 1,
      age: currentUserAge,
      spouseAge: currentSpouseAge,
      portfolioValue,
      contribution: contributions,
      withdrawal,
      guaranteedIncome,
      shortfall,
      returnRate: annualReturn,
      inflationRate,
      expenses: currentUserAge >= retirementAge ? annualRetirementExpenses : 0,
      totalExpenses: currentUserAge >= retirementAge ? (annualRetirementExpenses + currentYearLTCCost) : 0,
      ltcCost: currentYearLTCCost,
      ltcEpisodeActive: ltcEpisode.hasEpisode && 
        ltcEpisode.onsetAge && 
        currentUserAge >= ltcEpisode.onsetAge && 
        currentUserAge < (ltcEpisode.onsetAge + (ltcEpisode.durationYears || 0)),
      taxesPaid: withdrawal * taxRate, // Simplified tax calculation
      remainingYears: effectiveLifeExpectancy - currentUserAge
    });

    // Early exit if portfolio is exhausted && no guaranteed income
    if (portfolioValue <= 0 && guaranteedIncome === 0 && shortfall > 0) {
      break;
    }

    // Record current-year MAGI estimate for future IRMAA lookback
    // Compute MAGI ~ (non-SS guaranteed income + taxable portion of SS + ordinary taxable withdrawals + realized capital gains)
    let currentMAGIEstimate = 0;
    if (currentUserAge >= retirementAge) {
      // Dynamic capital gains realization ratio: grows over years in retirement
      const yearsSinceRetirement = Math.max(0, Math.floor(currentUserAge - retirementAge));
      const gainsRatio = 0.4 + (Math.min(30, yearsSinceRetirement) / 30) * 0.3; // 0.4 → 0.7 over 30 years
      const realizedCapitalGains = (typeof withdrawalPlan !== 'undefined' && withdrawalPlan.taxableWithdrawal) ?
        withdrawalPlan.taxableWithdrawal * gainsRatio : 0;
      const ordinaryFromTaxDeferred = (typeof withdrawalPlan !== 'undefined' && withdrawalPlan.taxDeferredWithdrawal) ?
        withdrawalPlan.taxDeferredWithdrawal : 0;
      const estDivIntIncome = Math.max(0, taxableBalanceBeforeWithdrawal) * DIV_INT_YIELD;

      // Taxable SS portion based on provisional income
      const filingStatusForSS = (spouseAge !== undefined) ? 'married' as const : 'single' as const;
      const otherIncomeForSS = nonSSGuaranteedIncome + ordinaryFromTaxDeferred + realizedCapitalGains + estDivIntIncome;
      const ssTaxation = calculateEnhancedSocialSecurityTaxation(
        socialSecurityIncome,
        otherIncomeForSS,
        filingStatusForSS
      );
      currentMAGIEstimate = otherIncomeForSS + ssTaxation.taxableAmount;
    } else {
      // Pre-retirement MAGI approximation (for IRMAA lookback at age 65)
      const wages = (userAnnualIncome || 0) + (spouseAnnualIncome || 0);
      currentMAGIEstimate = wages; // ignore investment income for simplicity
    }
    magiHistory.push(currentMAGIEstimate);
  }

  // Calculate final metrics
  const finalPortfolioValue = Math.max(0, portfolioValue);
  // Success = no cash flow shortfalls during retirement; legacy tracked separately
  const success = totalShortfall === 0;
  
  const result: SimulationIteration = {
    iteration: iterationNumber,
    success,
    finalPortfolioValue,
    totalContributions,
    totalWithdrawals,
    totalTaxesPaid,
    yearsWithShortfall,
    totalShortfall: totalShortfall || undefined,
    maxAnnualShortfall: maxShortfall || undefined,
    yearlyData,
    legacyGoalMet: finalPortfolioValue >= (legacyGoal || 0),
    // LTC Analysis Data
    ltcData: {
      hasLTCEpisode: ltcEpisode.hasEpisode,
      totalLTCCosts,
      ltcEpisode: ltcEpisode.hasEpisode ? {
        onsetAge: ltcEpisode.onsetAge,
        durationYears: ltcEpisode.durationYears,
        careType: ltcEpisode.careType,
        totalCost: ltcEpisode.totalLifetimeCost
      } : undefined
    }
  };

  if (enableDetailedLogging && (iterationNumber < 5 || !success)) {
    console.log(`\nIteration ${iterationNumber + 1}:`, {
      success,
      finalValue: finalPortfolioValue.toFixed(0),
      totalShortfall: totalShortfall.toFixed(0),
      yearsWithShortfall
    });
  }

  return result;
}

// ============================================
// Advanced Monte Carlo Improvements
// ============================================

/**
 * Calculate mean reversion adjustment based on portfolio valuation
 * Higher valuations (CAPE > 25) lead to lower expected returns
 * Lower valuations (CAPE < 15) lead to higher expected returns
 */
function calculateMeanReversionAdjustment(year: number, baseReturn: number): number {
  // Simulate CAPE ratio cycling between 10-35 over ~7 year cycles
  const cyclePosition = (year % 7) / 7;
  const cape = 20 + 10 * Math.sin(2 * Math.PI * cyclePosition);
  
  // Mean reversion factor based on CAPE
  let adjustment = 0;
  if (cape > 25) {
    // Overvalued - reduce returns
    adjustment = -0.02 * ((cape - 25) / 10); // -2% per 10 CAPE points above 25
  } else if (cape < 15) {
    // Undervalued - increase returns
    adjustment = 0.015 * ((15 - cape) / 5); // +1.5% per 5 CAPE points below 15
  }
  
  return baseReturn + adjustment;
}

/**
 * Generate fat tail / black swan events
 * Returns: { hasEvent: boolean, severity: number, type: string }
 */
function generateFatTailEvent(rng?: RandomSource): { hasEvent: boolean; severity: number; type: string } {
  // Baseline default: no extra crash overlay unless stress mode is explicitly enabled
  if (process.env.STRESS_MODE !== '1' || process.env.DISABLE_CRASH_OVERLAY === '1') {
    return { hasEvent: false, severity: 0, type: 'none' };
  }
  const rrng1 = deriveRNG(rng, 'fat-tail');
  const rnd = () => rrng1.next();
  const rand = rnd();
  // Allow probabilities to be configured via environment for calibration/stress testing
  const pBlack = Math.max(0, Math.min(1, parseFloat(process.env.FAT_TAIL_BLACK_SWAN_PROB || '0.0005'))); // default 0.05%
  const pSevere = Math.max(0, Math.min(1, parseFloat(process.env.FAT_TAIL_SEVERE_PROB || '0.005')));     // default 0.5%
  const pModerate = Math.max(0, Math.min(1, parseFloat(process.env.FAT_TAIL_MODERATE_PROB || '0.010'))); // default 1.0%
  const t1 = pBlack;
  const t2 = pBlack + pSevere;
  const t3 = pBlack + pSevere + pModerate;

  if (rand < t1) {
    return {
      hasEvent: true,
      severity: -0.35 - rnd() * 0.15, // -35% to -50% market crash
      type: 'black_swan'
    };
  }
  // Severe correction bucket
  if (rand < t2) {
    return {
      hasEvent: true,
      severity: -0.20 - rnd() * 0.10, // -20% to -30% correction
      type: 'severe_correction'
    };
  }
  // Moderate correction bucket
  if (rand < t3) {
    return {
      hasEvent: true,
      severity: -0.10 - rnd() * 0.05, // -10% to -15% correction
      type: 'moderate_correction'
    };
  }
  
  return { hasEvent: false, severity: 0, type: 'none' };
}

// ===== Types for RightCapital-style engine =====
interface YearlyData {
  year: number;
  age: number;
  spouseAge?: number;
  portfolioValue: number;
  contribution: number;
  withdrawal: number;
  guaranteedIncome: number;
  shortfall: number;
  returnRate: number;
  inflationRate: number;
  expenses: number;
  totalExpenses: number;
  ltcCost: number;
  ltcEpisodeActive: boolean;
  taxesPaid: number;
  remainingYears: number;
}

interface SimulationIteration {
  iteration: number;
  success: boolean;
  finalPortfolioValue: number;
  totalContributions: number;
  totalWithdrawals: number;
  totalTaxesPaid: number;
  yearsWithShortfall: number;
  totalShortfall?: number;
  maxAnnualShortfall?: number;
  yearlyData: YearlyData[];
  legacyGoalMet: boolean;
  ltcData: {
    hasLTCEpisode: boolean;
    totalLTCCosts: number;
    ltcEpisode?: {
      onsetAge?: number;
      durationYears?: number;
      careType?: 'HomeCare' | 'AssistedLiving' | 'NursingHome' | 'Memory';
      totalCost?: number;
    };
  };
}

interface MonteCarloResult {
  successProbability: number; // 0-1 decimal
  results: SimulationIteration[];
  summary: {
    successfulRuns: number;
    totalRuns: number;
    averageDeficit: number;
    maxDeficit: number;
    averageSurplus: number;
    maxSurplus: number;
    medianFinalValue: number;
    percentile10: number;
    percentile25: number;
    percentile75: number;
    percentile90: number;
  };
}

/**
 * Generate spending volatility && life events
 * Returns additional unexpected expenses for the year
 */
function generateSpendingVolatility(baseExpenses: number, age: number, rng?: RandomSource): number {
  const rrng2 = deriveRNG(rng, 'spending-vol', age);
  const rnd = () => rrng2.next();
  const rand = rnd();
  let additionalExpenses = 0;
  
  // Age-based probability adjustments
  const healthEventProb = Math.min(0.05 + (age - 65) * 0.002, 0.15); // 5% at 65, up to 15% at 85+
  const homeRepairProb = 0.03; // 3% annual chance
  const familySupportProb = age < 70 ? 0.02 : 0.01; // 2% before 70, 1% after
  
  // Health-related unexpected expenses
  if (rand < healthEventProb) {
    additionalExpenses += baseExpenses * (0.1 + rnd() * 0.3); // 10-40% of annual expenses
  }
  
  // Home repairs/maintenance
  if (rnd() < homeRepairProb) {
    additionalExpenses += 10000 + rnd() * 20000; // $10K-30K
  }
  
  // Family support (helping children, grandchildren)
  if (rnd() < familySupportProb) {
    additionalExpenses += 5000 + rnd() * 15000; // $5K-20K
  }
  
  // Normal spending volatility (±5% baseline)
  const normalVolatility = baseExpenses * (rnd() * 0.1 - 0.05);
  
  return additionalExpenses + normalVolatility;
}

/**
 * Calculate portfolio rebalancing costs && friction
 * Returns the cost as a percentage of portfolio value
 */
function calculateRebalancingCosts(
  portfolioValue: number,
  targetAllocation: { stocks: number; bonds: number },
  currentAllocation: { stocks: number; bonds: number },
  year: number
): number {
  // Baseline: ignore rebalancing frictions unless stress mode enabled
  if (process.env.STRESS_MODE !== '1' && process.env.ENABLE_REBAL_COSTS !== '1') {
    return 0;
  }
  // Calculate allocation drift
  const stockDrift = Math.abs(targetAllocation.stocks - currentAllocation.stocks);
  const bondDrift = Math.abs(targetAllocation.bonds - currentAllocation.bonds);
  const totalDrift = stockDrift + bondDrift;
  
  // Only rebalance if drift exceeds 5% threshold
  if (totalDrift < 0.05) {
    return 0;
  }
  
  // Trading costs: 0.1% for ETFs, 0.3% for mutual funds
  const tradingCostRate = 0.001; // Assume ETFs
  
  // Tax impact for taxable accounts (capital gains)
  const taxImpact = totalDrift * 0.002; // 0.2% per rebalance in taxable accounts
  
  // Bid-ask spread
  const bidAskSpread = totalDrift * 0.0005; // 0.05% spread
  
  // Total cost
  const totalCost = (tradingCostRate + taxImpact + bidAskSpread) * portfolioValue;
  
  return totalCost;
}

/**
 * Model longevity tail risk - chance of living significantly longer than expected
 * Returns adjusted life expectancy with tail risk consideration
 */
function adjustForLongevityTailRisk(
  baseLifeExpectancy: number,
  currentAge: number,
  healthStatus?: string,
  rng?: RandomSource
): number {
  const rrng3 = deriveRNG(rng, 'longevity-tail', currentAge);
  const rnd = () => rrng3.next();
  const rand = rnd();
  
  // 10% chance of living 10+ years beyond expectancy (longevity tail)
  if (rand < 0.10) {
    const extraYears = 10 + rnd() * 5; // 10-15 extra years
    return Math.min(baseLifeExpectancy + extraYears, 110);
  }
  
  // 20% chance of living 5-10 years beyond expectancy
  if (rand < 0.30) {
    const extraYears = 5 + rnd() * 5; // 5-10 extra years
    return Math.min(baseLifeExpectancy + extraYears, 105);
  }
  
  // 30% chance of living up to 5 years beyond expectancy
  if (rand < 0.60) {
    const extraYears = rnd() * 5; // 0-5 extra years
    return Math.min(baseLifeExpectancy + extraYears, 100);
  }
  
  // 40% baseline || shorter life expectancy
  return baseLifeExpectancy;
}

/**
 * Calculate dynamic asset allocation based on glide path
 * Starts with higher equity allocation && gradually shifts to bonds
 * Can use "bond tent" || "rising equity" strategies
 */
function calculateDynamicAssetAllocation(
  currentAge: number,
  retirementAge: number,
  strategy: 'traditional' | 'bond_tent' | 'rising_equity' = 'traditional'
): { stocks: number; bonds: number } {
  const yearsInRetirement = Math.max(0, currentAge - retirementAge);
  
  if (strategy === 'traditional') {
    // Traditional glide path: decrease stocks from 60% to 30% over 20 years
    const startingStockAllocation = 0.60;
    const endingStockAllocation = 0.30;
    const transitionYears = 20;
    
    const stockAllocation = Math.max(
      endingStockAllocation,
      startingStockAllocation - (yearsInRetirement / transitionYears) * (startingStockAllocation - endingStockAllocation)
    );
    
    return { stocks: stockAllocation, bonds: 1 - stockAllocation };
  }
  
  if (strategy === 'bond_tent') {
    // Bond tent: increase bonds early retirement (5-10 years), then decrease
    if (yearsInRetirement <= 5) {
      // Increase bonds from 40% to 50% in first 5 years
      const bondAllocation = 0.40 + (yearsInRetirement / 5) * 0.10;
      return { stocks: 1 - bondAllocation, bonds: bondAllocation };
    } else if (yearsInRetirement <= 15) {
      // Decrease bonds from 50% to 40% over next 10 years
      const bondAllocation = 0.50 - ((yearsInRetirement - 5) / 10) * 0.10;
      return { stocks: 1 - bondAllocation, bonds: bondAllocation };
    } else {
      // Maintain 60/40 allocation
      return { stocks: 0.60, bonds: 0.40 };
    }
  }
  
  if (strategy === 'rising_equity') {
    // Rising equity glide path: increase stocks from 30% to 60% over 30 years
    // Research shows this can reduce sequence risk
    const startingStockAllocation = 0.30;
    const endingStockAllocation = 0.60;
    const transitionYears = 30;
    
    const stockAllocation = Math.min(
      endingStockAllocation,
      startingStockAllocation + (yearsInRetirement / transitionYears) * (endingStockAllocation - startingStockAllocation)
    );
    
    return { stocks: stockAllocation, bonds: 1 - stockAllocation };
  }
  
  // Default fallback
  return { stocks: 0.60, bonds: 0.40 };
}

/**
 * Calculate healthcare costs beyond LTC (Medicare, supplements, out-of-pocket)
 * Healthcare inflation typically exceeds CPI by 2-4% annually
 */
function calculateHealthcareCosts(
  currentAge: number,
  year: number,
  generalInflation: number,
  isMarried: boolean = false
): number {
  // No healthcare costs before Medicare age
  if (currentAge < 65) return 0;
  
  // Healthcare inflation differential (historically 2-4% above CPI, we'll use 3% to be balanced)
  // FIX: In real-dollar model, only apply the differential, not general inflation
  const healthcareInflationDifferential = 0.03;
  // Since we're in real dollars, only apply the differential above CPI
  const compoundInflation = Math.pow(1 + healthcareInflationDifferential, year);
  
  // 2024 baseline costs (per person)
  const medicarePartB = 174.70 * 12; // Monthly premium
  const medicarePartD = 55 * 12; // Average Part D premium
  const medigapPremium = 200 * 12; // Average Medigap Plan G
  const outOfPocketBase = 3000; // Dental, vision, hearing, copays
  
  // Age-based adjustment (costs increase with age)
  const ageMultiplier = 1 + Math.max(0, (currentAge - 65) * 0.02); // 2% increase per year over 65
  
  // Calculate total annual healthcare costs
  let annualCosts = (medicarePartB + medicarePartD + medigapPremium + outOfPocketBase) * ageMultiplier * compoundInflation;
  
  // Double for married couples (both on Medicare)
  if (isMarried && currentAge >= 65) {
    annualCosts *= 2;
  }
  
  return annualCosts;
}

// ============================
// ACA Pre‑Medicare Modeling (Phase 1)
// ============================

function federalPovertyLevel(year: number, householdSize: number, state?: string): number {
  // 2024 HHS FPL (48 contiguous states/D.C.) baseline
  // Source: HHS (approx), simplified constants; Alaska/Hawaii adjustments applied via factor
  const base2024 = 15060; // household size 1
  const addl = 5380; // per additional person
  const akFactor = 1.25; // rough
  const hiFactor = 1.15; // rough
  let fpl2024 = base2024 + Math.max(0, householdSize - 1) * addl;
  const st = (state || '').toUpperCase();
  if (st === 'AK') fpl2024 *= akFactor;
  if (st === 'HI') fpl2024 *= hiFactor;
  // Inflate modestly by year for future years (1.5%/yr baseline)
  const years = Math.max(0, year - 2024);
  return fpl2024 * Math.pow(1.015, years);
}

function expectedContributionPercent(incomeAsFpl: number): number {
  // Simplified ARPA/IRA schedule (2024)
  if (incomeAsFpl <= 1.5) return 0.00;
  if (incomeAsFpl <= 2.0) return 0.02 * (incomeAsFpl - 1.5) / 0.5; // 0% to 2%
  if (incomeAsFpl <= 2.5) return 0.02 + (0.04 - 0.02) * (incomeAsFpl - 2.0) / 0.5; // 2% to 4%
  if (incomeAsFpl <= 3.0) return 0.04 + (0.06 - 0.04) * (incomeAsFpl - 2.5) / 0.5; // 4% to 6%
  if (incomeAsFpl <= 4.0) return 0.06 + (0.085 - 0.06) * (incomeAsFpl - 3.0) / 1.0; // 6% to 8.5%
  return 0.085; // capped at 8.5%
}

function slcspAgeFactor(age: number): number {
  // Rough ACA age rating approximation (not exact 3:1; simplified ramp)
  // 40yo ~ 1.0; 64yo ~ 2.2; 21yo ~ 0.9
  const a = Math.max(18, Math.min(64, age));
  const base = 1.0 + (a - 40) * 0.03; // ~3% per year after 40
  return Math.max(0.8, Math.min(2.4, base));
}

function statePremiumFactor(state?: string): number {
  const st = (state || '').toUpperCase();
  const factors: Record<string, number> = {
    'AK': 1.25, 'HI': 1.15, 'CA': 1.12, 'NY': 1.15, 'MA': 1.10, 'WY': 1.10,
    'TX': 0.95, 'FL': 1.00, 'NC': 0.98, 'GA': 0.98, 'WA': 1.05
  };
  return factors[st] || 1.0;
}

function computeAcaNetPremiums(
  enrolleeAges: number[],
  state: string,
  householdMAGI: number,
  householdSize: number,
  year: number
): { totalGross: number; expectedContribution: number; aptc: number; totalNetPremium: number; perPerson: number[] } {
  if (!enrolleeAges.length) return { totalGross: 0, expectedContribution: 0, aptc: 0, totalNetPremium: 0, perPerson: [] };
  const fpl = federalPovertyLevel(year, householdSize, state);
  const incomeFpl = fpl > 0 ? (householdMAGI / fpl) : 5;
  const expPct = expectedContributionPercent(incomeFpl);
  // Base SLCSP benchmark: annual for 40yo national average (rough)
  const baseSLCSP = 6500; // $6.5k/year baseline
  const sf = statePremiumFactor(state);
  const perGross = enrolleeAges.map(age => baseSLCSP * slcspAgeFactor(age) * sf);
  const sumGross = perGross.reduce((a, b) => a + b, 0);
  const expectedContribution = Math.max(0, expPct * householdMAGI);
  const aptc = Math.max(0, Math.min(sumGross, sumGross - expectedContribution));
  const totalNet = Math.max(0, sumGross - aptc);
  // Allocate net cost by gross share
  const shares = perGross.map(g => (sumGross > 0 ? g / sumGross : 0));
  const perNet = shares.map(s => totalNet * s);
  return { totalGross: sumGross, expectedContribution, aptc, totalNetPremium: totalNet, perPerson: perNet };
}

/**
 * Model Social Security solvency risk && potential benefit reductions
 * Current projections show trust fund depletion around 2033-2035
 * We'll be balanced: model various scenarios with probabilities
 */
function adjustSocialSecurityForSolvency(
  benefit: number,
  currentYear: number,
  scenarioRandom: number
): number {
  const trustFundDepletionYear = 2033;
  
  // Before depletion year, full benefits
  if (currentYear < trustFundDepletionYear) {
    return benefit;
  }
  
  // After depletion, model different scenarios
  // Being balanced: not everyone will see cuts, && cuts may be less severe
  
  if (scenarioRandom < 0.30) {
    // 30% chance: Full fix through legislation (no cuts)
    // Congress acts to preserve full benefits through tax increases || other means
    return benefit;
  } else if (scenarioRandom < 0.50) {
    // 20% chance: Partial fix (10% reduction)
    // Compromise solution with modest cuts && revenue increases
    return benefit * 0.90;
  } else if (scenarioRandom < 0.70) {
    // 20% chance: Means testing affects high earners only
    // Assume this simulation is for average earners (no cut)
    return benefit;
  } else if (scenarioRandom < 0.85) {
    // 15% chance: Across-the-board 15% reduction
    return benefit * 0.85;
  } else {
    // 15% chance: Worst case - 23% reduction (current projection)
    return benefit * 0.77;
  }
}

/**
 * Get RMD divisor factor based on age
 * Based on IRS Uniform Lifetime Table
 */
function getRMDFactor(age: number): number {
  const rmdTable: Record<number, number> = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4
  };
  
  // For ages above 100, use a conservative factor
  if (age > 100) return 6.0;
  
  // For ages 72 && below (pre-RMD), return high factor (no RMD)
  if (age < 73) return 1000;
  
  return rmdTable[age] || 20; // Default to age 80 factor if not found
}

/**
 * Calculate state tax rates based on retirement state
 * Includes special h&&ling for retirement-friendly states
 */
function getStateTaxRate(state: string): { 
  incomeRate: number; 
  capitalGainsRate: number; 
  socialSecurityTaxed: boolean;
  pensionExclusion: number;
  retirementFriendly: boolean;
} {
  const stateUpper = (state || 'TX').toUpperCase();
  
  // Comprehensive state tax data for retirement
  const stateTaxData: Record<string, any> = {
    // No income tax states
    'AK': { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    'FL': { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    'NV': { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    'NH': { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    'SD': { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    'TN': { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    'TX': { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    'WA': { incomeRate: 0, capitalGainsRate: 0.07, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true }, // WA has capital gains tax
    'WY': { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    
    // Retirement-friendly states (don't tax SS || pensions)
    'IL': { incomeRate: 0.0495, capitalGainsRate: 0.0495, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    'MS': { incomeRate: 0.05, capitalGainsRate: 0.05, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    'PA': { incomeRate: 0.0307, capitalGainsRate: 0.0307, socialSecurityTaxed: false, pensionExclusion: Infinity, retirementFriendly: true },
    
    // Partially retirement-friendly states
    'AL': { incomeRate: 0.05, capitalGainsRate: 0.05, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: false },
    'AZ': { incomeRate: 0.025, capitalGainsRate: 0.025, socialSecurityTaxed: false, pensionExclusion: 2500, retirementFriendly: true },
    'GA': { incomeRate: 0.0575, capitalGainsRate: 0.0575, socialSecurityTaxed: false, pensionExclusion: 65000, retirementFriendly: true },
    'SC': { incomeRate: 0.07, capitalGainsRate: 0.07, socialSecurityTaxed: false, pensionExclusion: 10000, retirementFriendly: false },
    
    // High-tax states
    'CA': { incomeRate: 0.133, capitalGainsRate: 0.133, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: false },
    'NY': { incomeRate: 0.109, capitalGainsRate: 0.109, socialSecurityTaxed: false, pensionExclusion: 20000, retirementFriendly: false },
    'NJ': { incomeRate: 0.1075, capitalGainsRate: 0.1075, socialSecurityTaxed: false, pensionExclusion: 100000, retirementFriendly: false },
    'OR': { incomeRate: 0.099, capitalGainsRate: 0.099, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: false },
    'HI': { incomeRate: 0.11, capitalGainsRate: 0.075, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: false },
    
    // States that tax Social Security
    'CO': { incomeRate: 0.044, capitalGainsRate: 0.044, socialSecurityTaxed: true, pensionExclusion: 24000, retirementFriendly: false },
    'CT': { incomeRate: 0.0699, capitalGainsRate: 0.0699, socialSecurityTaxed: true, pensionExclusion: 0, retirementFriendly: false },
    'KS': { incomeRate: 0.057, capitalGainsRate: 0.057, socialSecurityTaxed: true, pensionExclusion: 0, retirementFriendly: false },
    'MN': { incomeRate: 0.0985, capitalGainsRate: 0.0985, socialSecurityTaxed: true, pensionExclusion: 0, retirementFriendly: false },
    'MT': { incomeRate: 0.0675, capitalGainsRate: 0.0675, socialSecurityTaxed: true, pensionExclusion: 0, retirementFriendly: false },
    'NM': { incomeRate: 0.059, capitalGainsRate: 0.059, socialSecurityTaxed: true, pensionExclusion: 8000, retirementFriendly: false },
    'RI': { incomeRate: 0.0599, capitalGainsRate: 0.0599, socialSecurityTaxed: true, pensionExclusion: 15000, retirementFriendly: false },
    'UT': { incomeRate: 0.0465, capitalGainsRate: 0.0465, socialSecurityTaxed: true, pensionExclusion: 0, retirementFriendly: false },
    'VT': { incomeRate: 0.0875, capitalGainsRate: 0.0875, socialSecurityTaxed: true, pensionExclusion: 0, retirementFriendly: false },
    'WV': { incomeRate: 0.065, capitalGainsRate: 0.065, socialSecurityTaxed: true, pensionExclusion: 8000, retirementFriendly: false },
  };
  
  // Default to moderate tax state if not found
  return stateTaxData[stateUpper] || {
    incomeRate: 0.05,
    capitalGainsRate: 0.05,
    socialSecurityTaxed: false,
    pensionExclusion: 0,
    retirementFriendly: false
  };
}

/**
 * Local implementation of tax-efficient withdrawal sequencing
 * Returns the amount to withdraw from each account type
 * TODO: Consolidate with imported calculateTaxEfficientWithdrawal function
 */
function calculateLocalTaxEfficientWithdrawals(
  neededAmount: number,
  portfolioBalances: {
    taxable: number;
    taxDeferred: number;
    roth: number;
  },
  rmdAmount: number,
  currentAge: number,
  effectiveTaxRate: number
): {
  taxableWithdrawal: number;
  taxDeferredWithdrawal: number;
  rothWithdrawal: number;
  totalWithdrawal: number;
  taxesOwed: number;
} {
  let remainingNeed = neededAmount;
  let taxableWithdrawal = 0;
  let taxDeferredWithdrawal = 0;
  let rothWithdrawal = 0;
  
  // Step 1: Satisfy RMDs first (m&&atory)
  if (currentAge >= 73 && rmdAmount > 0) {
    taxDeferredWithdrawal = Math.min(rmdAmount, portfolioBalances.taxDeferred);
    remainingNeed = Math.max(0, remainingNeed - taxDeferredWithdrawal * (1 - effectiveTaxRate));
  }
  
  // Step 2: Withdraw from taxable accounts (most tax-efficient)
  if (remainingNeed > 0 && portfolioBalances.taxable > 0) {
    // Only 50% of gains are taxable (assume 50% basis)
    const taxableNeeded = remainingNeed / (1 - effectiveTaxRate * 0.5);
    taxableWithdrawal = Math.min(taxableNeeded, portfolioBalances.taxable);
    const afterTaxAmount = taxableWithdrawal * (1 - effectiveTaxRate * 0.5);
    remainingNeed -= afterTaxAmount;
  }
  
  // Step 3: Withdraw from tax-deferred accounts
  if (remainingNeed > 0 && portfolioBalances.taxDeferred > taxDeferredWithdrawal) {
    const additionalTaxDeferred = remainingNeed / (1 - effectiveTaxRate);
    const maxAdditional = portfolioBalances.taxDeferred - taxDeferredWithdrawal;
    const additionalWithdrawal = Math.min(additionalTaxDeferred, maxAdditional);
    taxDeferredWithdrawal += additionalWithdrawal;
    remainingNeed -= additionalWithdrawal * (1 - effectiveTaxRate);
  }
  
  // Step 4: Withdraw from Roth accounts (last resort - tax-free growth)
  if (remainingNeed > 0 && portfolioBalances.roth > 0) {
    rothWithdrawal = Math.min(remainingNeed, portfolioBalances.roth);
    remainingNeed -= rothWithdrawal;
  }
  
  // Calculate total taxes
  const taxesOwed = 
    taxableWithdrawal * effectiveTaxRate * 0.5 + // Capital gains tax on taxable
    taxDeferredWithdrawal * effectiveTaxRate;     // Ordinary income tax on tax-deferred
  
  return {
    taxableWithdrawal,
    taxDeferredWithdrawal,
    rothWithdrawal,
    totalWithdrawal: taxableWithdrawal + taxDeferredWithdrawal + rothWithdrawal,
    taxesOwed
  };
}


async function ensureCMA(params?: RetirementMonteCarloParams) {
  if (getActiveCMA()) return;
  const version = (params as any)?.cmaVersion || process.env.CMA_VERSION || '2025-US';
  const cma = await loadCMA(version);
  if (cma) {
    ASSET_CLASS_PARAMS = {
      usStocks: { expectedReturn: cma.assets.usStocks.expectedReturnCAGR, volatility: cma.assets.usStocks.volatility },
      intlStocks: { expectedReturn: cma.assets.intlStocks.expectedReturnCAGR, volatility: cma.assets.intlStocks.volatility },
      bonds: { expectedReturn: cma.assets.bonds.expectedReturnCAGR, volatility: cma.assets.bonds.volatility },
      reits: { expectedReturn: cma.assets.reits.expectedReturnCAGR, volatility: cma.assets.reits.volatility },
      cash: { expectedReturn: cma.assets.cash.expectedReturnCAGR, volatility: cma.assets.cash.volatility }
    } as any;
    ASSET_CORRELATIONS = cma.correlations as any;
  }
}
