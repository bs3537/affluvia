// Enhanced Monte Carlo Simulation with Professional-Grade Tax Modeling
// Fixes critical issues: SS taxation, IRMAA, RMDs, sequence of returns

import { 
  RetirementMonteCarloParams, 
  RetirementMonteCarloResult,
  AssetBuckets 
} from './monte-carlo-base';
import { 
  calculateTaxEfficientWithdrawal,
  calculateRMD,
} from './asset-tax-classifier';
import { calculateCombinedTaxRate } from './tax-calculator';
import {
  generateStochasticLifeExpectancy,
  generateCouplesStochasticLifeExpectancy
} from './stochastic-life-expectancy';
import {
  simulateSurvival,
  simulateCouplesSurvival
} from './mortality-tables';

// Social Security taxation calculation
interface SocialSecurityTaxation {
  taxableAmount: number;
  taxablePercentage: number;
  provisionalIncome: number;
}

function calculateSocialSecurityTaxation(
  grossSSBenefit: number, 
  otherIncome: number, 
  filingStatus: 'single' | 'married'
): SocialSecurityTaxation {
  if (grossSSBenefit <= 0) {
    return { taxableAmount: 0, taxablePercentage: 0, provisionalIncome: 0 };
  }
  
  // Calculate provisional income (AGI + tax-exempt interest + 50% of SS benefits)
  const provisionalIncome = otherIncome + (grossSSBenefit * 0.5);
  
  // 2024 thresholds
  const thresholds = filingStatus === 'single' ? 
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

// IRMAA Medicare surcharge calculation
interface IRMAAResult {
  monthlyPartBPremium: number;
  monthlyPartDPremium: number;
  annualSurcharge: number;
  incomeBracket: string;
}

function calculateIRMAA(
  modifiedAGI: number, 
  filingStatus: 'single' | 'married',
  year: number = 2024
): IRMAAResult {
  // 2024 IRMAA brackets (based on 2022 MAGI)
  const basePremium = 174.70; // 2024 Part B base premium
  
  const brackets = filingStatus === 'single' ? [
    { min: 0, max: 103000, partBTotal: 174.70, partDAdd: 0 },
    { min: 103000, max: 129000, partBTotal: 244.60, partDAdd: 12.90 },
    { min: 129000, max: 161000, partBTotal: 349.40, partDAdd: 33.30 },
    { min: 161000, max: 193000, partBTotal: 454.20, partDAdd: 53.80 },
    { min: 193000, max: 500000, partBTotal: 559.00, partDAdd: 74.20 },
    { min: 500000, max: Infinity, partBTotal: 594.00, partDAdd: 81.00 }
  ] : [
    { min: 0, max: 206000, partBTotal: 174.70, partDAdd: 0 },
    { min: 206000, max: 258000, partBTotal: 244.60, partDAdd: 12.90 },
    { min: 258000, max: 322000, partBTotal: 349.40, partDAdd: 33.30 },
    { min: 322000, max: 386000, partBTotal: 454.20, partDAdd: 53.80 },
    { min: 386000, max: 750000, partBTotal: 559.00, partDAdd: 74.20 },
    { min: 750000, max: Infinity, partBTotal: 594.00, partDAdd: 81.00 }
  ];
  
  let applicable = brackets[0];
  let bracketName = "Standard";
  
  for (let i = 0; i < brackets.length; i++) {
    if (modifiedAGI >= brackets[i].min && modifiedAGI < brackets[i].max) {
      applicable = brackets[i];
      if (i === 0) bracketName = "Standard";
      else if (i === 1) bracketName = "Tier 1";
      else if (i === 2) bracketName = "Tier 2";
      else if (i === 3) bracketName = "Tier 3";
      else if (i === 4) bracketName = "Tier 4";
      else bracketName = "Tier 5";
      break;
    }
  }
  
  const monthlyPartBPremium = applicable.partBTotal;
  const monthlyPartDPremium = applicable.partDAdd;
  const annualSurcharge = (monthlyPartBPremium - basePremium + monthlyPartDPremium) * 12;
  
  return {
    monthlyPartBPremium,
    monthlyPartDPremium,
    annualSurcharge,
    incomeBracket: bracketName
  };
}

// Enhanced withdrawal calculation with proper tax modeling
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

function calculateEnhancedWithdrawal(
  netNeeded: number,
  buckets: AssetBuckets,
  guaranteedIncome: number,
  age: number,
  spouseAge: number | undefined,
  retirementState: string,
  filingStatus: 'single' | 'married'
): EnhancedWithdrawalResult {
  // Step 1: Calculate RMDs
  const userRMD = age >= 73 ? calculateRMD(buckets.taxDeferred, age) : 0;
  const spouseRMD = spouseAge && spouseAge >= 73 ? 0 : 0; // Simplified - assume joint accounts
  const totalRMD = userRMD + spouseRMD;
  
  // Step 2: Calculate minimum withdrawal (greater of need or RMD)
  const minimumGrossNeeded = Math.max(netNeeded, totalRMD);
  
  // Step 3: Iterative calculation to find gross withdrawal that yields net after all taxes
  let grossWithdrawal = minimumGrossNeeded * 1.3; // Initial guess with 30% tax buffer
  let iterations = 0;
  const maxIterations = 20;
  
  while (iterations < maxIterations) {
    // Calculate withdrawal strategy
    const withdrawalStrategy = calculateTaxEfficientWithdrawal(
      grossWithdrawal,
      buckets,
      0.25, // Will be refined below
      age,
      0.15,
      false
    );
    
    // Calculate income components
    const ordinaryIncome = withdrawalStrategy.fromTaxDeferred;
    const capitalGainsIncome = withdrawalStrategy.fromCapitalGains * 0.5; // Assume 50% gains
    
    // Calculate Social Security taxation
    const ssTaxation = calculateSocialSecurityTaxation(
      guaranteedIncome,
      ordinaryIncome + capitalGainsIncome,
      filingStatus
    );
    
    // Calculate total taxable income
    const totalTaxableIncome = ordinaryIncome + ssTaxation.taxableAmount + capitalGainsIncome;
    
    // Calculate combined tax rate
    const combinedTaxRate = calculateCombinedTaxRate(
      totalTaxableIncome,
      retirementState,
      filingStatus,
      true,
      age,
      spouseAge
    );
    
    // Calculate federal and state taxes
    const federalRate = combinedTaxRate * 0.7; // Rough federal portion
    const stateRate = combinedTaxRate * 0.3; // Rough state portion
    
    const federalTax = ordinaryIncome * federalRate + ssTaxation.taxableAmount * federalRate;
    const stateTax = ordinaryIncome * stateRate; // Most states don't tax SS
    const capitalGainsTax = capitalGainsIncome * 0.15;
    
    const totalTaxes = federalTax + stateTax + capitalGainsTax;
    const netAfterTaxes = grossWithdrawal - totalTaxes;
    
    // Check if we've converged
    const difference = Math.abs(netAfterTaxes - netNeeded);
    if (difference < 100 || iterations === maxIterations - 1) {
      // Calculate MAGI for IRMAA (2-year lookback)
      const modifiedAGI = ordinaryIncome + ssTaxation.taxableAmount + capitalGainsIncome;
      const irmaaResult = calculateIRMAA(modifiedAGI, filingStatus);
      
      return {
        grossWithdrawal: Math.max(grossWithdrawal, totalRMD),
        netAfterTaxes,
        federalTax,
        stateTax,
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
    
    // Adjust gross withdrawal for next iteration
    if (netAfterTaxes < netNeeded) {
      grossWithdrawal *= 1.1; // Increase by 10%
    } else {
      grossWithdrawal *= 0.95; // Decrease by 5%
    }
    
    iterations++;
  }
  
  // Should not reach here, but return last calculation
  const modifiedAGI = ordinaryIncome + ssTaxation.taxableAmount + capitalGainsIncome;
  const irmaaResult = calculateIRMAA(modifiedAGI, filingStatus);
  
  return {
    grossWithdrawal: Math.max(grossWithdrawal, totalRMD),
    netAfterTaxes,
    federalTax: 0,
    stateTax: 0,
    capitalGainsTax: 0,
    totalTaxes: grossWithdrawal - netNeeded,
    effectiveTaxRate: (grossWithdrawal - netNeeded) / grossWithdrawal,
    marginalTaxRate: 0.25,
    modifiedAGI,
    taxableSSBenefit: 0,
    irmaaResult,
    requiredRMD: totalRMD,
    actualRMDWithdrawn: totalRMD
  };
}

// Market regime for sequence of returns risk
type MarketRegime = 'bull' | 'bear' | 'normal' | 'crisis';

interface RegimeParameters {
  meanReturn: number;
  volatility: number;
  duration: number; // Average years in regime
  transitionProbs: { [key in MarketRegime]: number };
}

const MARKET_REGIMES: { [key in MarketRegime]: RegimeParameters } = {
  bull: {
    meanReturn: 0.15,
    volatility: 0.12,
    duration: 5,
    transitionProbs: { bull: 0.7, bear: 0.2, normal: 0.1, crisis: 0.0 }
  },
  bear: {
    meanReturn: -0.10,
    volatility: 0.25,
    duration: 1.5,
    transitionProbs: { bull: 0.3, bear: 0.3, normal: 0.3, crisis: 0.1 }
  },
  normal: {
    meanReturn: 0.07,
    volatility: 0.15,
    duration: 3,
    transitionProbs: { bull: 0.3, bear: 0.2, normal: 0.4, crisis: 0.1 }
  },
  crisis: {
    meanReturn: -0.30,
    volatility: 0.40,
    duration: 1,
    transitionProbs: { bull: 0.1, bear: 0.4, normal: 0.4, crisis: 0.1 }
  }
};

// Generate return with regime switching
function generateRegimeReturn(
  currentRegime: MarketRegime,
  stockAllocation: number,
  bondAllocation: number
): { return: number; nextRegime: MarketRegime } {
  const regime = MARKET_REGIMES[currentRegime];
  
  // Generate stock return based on regime
  const stockReturn = generateNormalRandom(regime.meanReturn, regime.volatility);
  
  // Bonds are less affected by regimes
  const bondReturn = generateNormalRandom(0.04, 0.05);
  
  // Calculate portfolio return
  const portfolioReturn = stockAllocation * stockReturn + bondAllocation * bondReturn;
  
  // Determine next regime
  let nextRegime = currentRegime;
  const rand = Math.random();
  let cumProb = 0;
  
  for (const [nextRegimeKey, prob] of Object.entries(regime.transitionProbs)) {
    cumProb += prob;
    if (rand <= cumProb) {
      nextRegime = nextRegimeKey as MarketRegime;
      break;
    }
  }
  
  return { return: portfolioReturn, nextRegime };
}

// Helper functions
function generateNormalRandom(mean: number = 0, stdDev: number = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

// Fixed retirement scenario with all enhancements
export function runFixedRetirementScenario(params: RetirementMonteCarloParams): {
  success: boolean;
  endingBalance: number;
  yearsUntilDepletion: number | null;
  totalTaxesPaid: number;
  totalIRMAASurcharges: number;
  averageEffectiveTaxRate: number;
  yearlyCashFlows: Array<{
    year: number;
    age: number;
    portfolioBalance: number;
    guaranteedIncome: number;
    withdrawal: number;
    netCashFlow: number;
    taxes: number;
    irmaaSurcharge: number;
    marketRegime?: string;
  }>;
} {
  const {
    currentAge,
    spouseAge,
    retirementAge,
    lifeExpectancy,
    spouseLifeExpectancy,
    currentRetirementAssets,
    annualGuaranteedIncome,
    annualRetirementExpenses,
    annualHealthcareCosts = 0,
    healthcareInflationRate = 0.045, // Higher than 2.69% for realism
    expectedReturn,
    returnVolatility,
    inflationRate,
    stockAllocation,
    bondAllocation,
    cashAllocation,
    withdrawalRate,
    useGuardrails = false,
    annualSavings,
    legacyGoal = 0
  } = params;
  
  // Generate stochastic life expectancy for this simulation run
  let stochasticLifeExpectancy: number;
  
  if (spouseAge && spouseLifeExpectancy) {
    // For couples, generate correlated life expectancies
    const couplesLife = generateCouplesStochasticLifeExpectancy(
      {
        baseLifeExpectancy: lifeExpectancy,
        currentAge: currentAge,
        gender: undefined,
        healthAdjustment: 0
      },
      {
        baseLifeExpectancy: spouseLifeExpectancy,
        currentAge: spouseAge,
        gender: undefined,
        healthAdjustment: 0
      },
      0.4
    );
    // Use the longer of the two for planning
    stochasticLifeExpectancy = Math.max(couplesLife.userLifeExpectancy, couplesLife.spouseLifeExpectancy);
  } else {
    // Single person
    stochasticLifeExpectancy = generateStochasticLifeExpectancy({
      baseLifeExpectancy: lifeExpectancy,
      currentAge: currentAge,
      gender: undefined,
      healthAdjustment: 0
    });
  }

  let portfolioBalance = currentRetirementAssets;
  const yearlyCashFlows = [];
  let yearsUntilDepletion: number | null = null;
  let totalTaxesPaid = 0;
  let totalIRMAASurcharges = 0;
  
  // Determine filing status and state
  const filingStatus = spouseAge ? 'married' : 'single';
  const retirementState = 'TX'; // Default, should come from params
  
  // Track asset buckets
  let currentBuckets: AssetBuckets = {
    taxDeferred: params.assetBuckets.taxDeferred,
    taxFree: params.assetBuckets.taxFree,
    capitalGains: params.assetBuckets.capitalGains,
    cashEquivalents: params.assetBuckets.cashEquivalents,
    totalAssets: params.assetBuckets.totalAssets
  };
  
  // Initialize market regime
  let currentRegime: MarketRegime = 'normal';
  
  let age = currentAge;
  let year = 0;
  
  // Accumulation phase
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  for (let accumYear = 0; accumYear < yearsToRetirement; accumYear++) {
    // Generate return with regime switching
    const { return: annualReturn, nextRegime } = generateRegimeReturn(
      currentRegime,
      stockAllocation,
      bondAllocation
    );
    currentRegime = nextRegime;
    
    // Add savings and apply returns
    currentBuckets.taxDeferred += annualSavings * 0.70;
    currentBuckets.taxFree += annualSavings * 0.20;
    currentBuckets.capitalGains += annualSavings * 0.10;
    
    currentBuckets.taxDeferred *= (1 + annualReturn);
    currentBuckets.taxFree *= (1 + annualReturn);
    currentBuckets.capitalGains *= (1 + annualReturn);
    currentBuckets.cashEquivalents *= (1 + annualReturn);
    
    currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    portfolioBalance = currentBuckets.totalAssets;
    
    age++;
    year++;
  }
  
  // Distribution phase with dynamic mortality
  let currentHealthcareCosts = annualHealthcareCosts;
  let currentNonHealthcareCosts = annualRetirementExpenses - annualHealthcareCosts;
  
  // Track survival status for dynamic mortality
  let userAlive = true;
  let spouseAlive = spouseAge !== undefined;
  let distYear = 0;
  
  // Continue simulation until life expectancy is reached or portfolio depletes
  // We simulate to life expectancy even if person dies earlier to properly assess portfolio longevity
  const targetYears = stochasticLifeExpectancy - retirementAge;
  while (distYear < targetYears && portfolioBalance > 0 && distYear < 60) { // Cap at 60 years of retirement
    // Generate return with regime switching
    const { return: annualReturn, nextRegime } = generateRegimeReturn(
      currentRegime,
      stockAllocation,
      bondAllocation
    );
    currentRegime = nextRegime;
    
    // Apply returns BEFORE withdrawals
    currentBuckets.taxDeferred *= (1 + annualReturn);
    currentBuckets.taxFree *= (1 + annualReturn);
    currentBuckets.capitalGains *= (1 + annualReturn);
    currentBuckets.cashEquivalents *= (1 + annualReturn);
    currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    
    // Apply inflation
    if (distYear > 0) {
      currentNonHealthcareCosts *= (1 + generateNormalRandom(inflationRate, 0.01));
      currentHealthcareCosts *= (1 + generateNormalRandom(healthcareInflationRate, 0.015));
    }
    
    const totalExpenses = currentNonHealthcareCosts + currentHealthcareCosts;
    const netNeeded = Math.max(0, totalExpenses - annualGuaranteedIncome);
    
    // Calculate enhanced withdrawal with all tax considerations
    const withdrawalResult = calculateEnhancedWithdrawal(
      netNeeded,
      currentBuckets,
      annualGuaranteedIncome,
      age,
      spouseAge ? spouseAge + distYear : undefined,
      retirementState,
      filingStatus
    );
    
    // Apply withdrawal to buckets
    const withdrawalStrategy = calculateTaxEfficientWithdrawal(
      withdrawalResult.grossWithdrawal,
      currentBuckets,
      withdrawalResult.effectiveTaxRate,
      age,
      0.15,
      false
    );
    
    currentBuckets = withdrawalStrategy.updatedBuckets;
    portfolioBalance = currentBuckets.totalAssets;
    
    // Add IRMAA surcharge to healthcare costs for next year
    if (age < 85) { // 2-year lookback for IRMAA typically applies until age 85
      currentHealthcareCosts += withdrawalResult.irmaaResult.annualSurcharge / 12;
    }
    
    totalTaxesPaid += withdrawalResult.totalTaxes;
    totalIRMAASurcharges += withdrawalResult.irmaaResult.annualSurcharge;
    
    yearlyCashFlows.push({
      year: year + 1,
      age: age + 1,
      portfolioBalance: Math.max(0, portfolioBalance),
      guaranteedIncome: annualGuaranteedIncome,
      withdrawal: withdrawalResult.grossWithdrawal,
      netCashFlow: annualGuaranteedIncome - withdrawalResult.grossWithdrawal,
      taxes: withdrawalResult.totalTaxes,
      irmaaSurcharge: withdrawalResult.irmaaResult.annualSurcharge,
      marketRegime: currentRegime
    });
    
    if (portfolioBalance <= 0 && yearsUntilDepletion === null) {
      yearsUntilDepletion = yearsToRetirement + distYear + 1;
      break;
    }
    
    // Simulate mortality at end of year
    if (spouseAge !== undefined) {
      // Couple simulation
      const healthStatus = params.userHealthStatus || 'good';
      const spouseHealthStatus = params.spouseHealthStatus || 'good';
      
      const survivalResult = simulateCouplesSurvival(
        { currentAge: age, healthStatus: healthStatus as 'excellent' | 'good' | 'fair' | 'poor' },
        { currentAge: spouseAge + distYear, healthStatus: spouseHealthStatus as 'excellent' | 'good' | 'fair' | 'poor' }
      );
      
      userAlive = survivalResult.userSurvives;
      spouseAlive = survivalResult.spouseSurvives;
      
      // If both died, continue simulation with zero expenses to test portfolio longevity
      // This ensures we properly test if the portfolio would have lasted to life expectancy
      if (!survivalResult.eitherSurvives) {
        // Set expenses to zero but continue simulation
        currentNonHealthcareCosts = 0;
        currentHealthcareCosts = 0;
      }
      
      // Adjust expenses if one spouse dies (typically 70-80% of couple expenses)
      if (!userAlive && spouseAlive || userAlive && !spouseAlive) {
        currentNonHealthcareCosts *= 0.75;
        currentHealthcareCosts *= 0.85; // Healthcare costs don't drop as much
        annualGuaranteedIncome *= 0.60; // Social Security survivor benefit approximation
      }
    } else {
      // Single person simulation
      const healthStatus = params.userHealthStatus || 'good';
      userAlive = simulateSurvival({ 
        currentAge: age, 
        healthStatus: healthStatus as 'excellent' | 'good' | 'fair' | 'poor' 
      });
      
      if (!userAlive) {
        // Set expenses to zero but continue simulation to test portfolio longevity
        currentNonHealthcareCosts = 0;
        currentHealthcareCosts = 0;
      }
    }
    
    age++;
    distYear++;
    year++;
  }
  
  // Success means: portfolio lasted through life expectancy
  // Legacy goal is tracked separately but shouldn't determine overall success
  // A retiree who doesn't run out of money is successful, even if they don't meet their legacy goal
  const success = yearsUntilDepletion === null;
  const averageEffectiveTaxRate = totalTaxesPaid / 
    (yearlyCashFlows.reduce((sum, cf) => sum + cf.withdrawal, 0) || 1);
  
  return {
    success,
    endingBalance: Math.max(0, portfolioBalance),
    yearsUntilDepletion,
    totalTaxesPaid,
    totalIRMAASurcharges,
    averageEffectiveTaxRate,
    yearlyCashFlows
  };
}

// Run enhanced Monte Carlo with all fixes
export function runFixedMonteCarloSimulation(
  params: RetirementMonteCarloParams,
  iterations: number = 1000
): RetirementMonteCarloResult & {
  taxAnalysis: {
    averageEffectiveTaxRate: number;
    totalTaxesPaid: number;
    totalIRMAASurcharges: number;
    percentWithIRMAA: number;
  };
  regimeAnalysis: {
    averageBearMarkets: number;
    averageCrises: number;
    worstCaseScenario: number;
  };
} {
  const results: number[] = [];
  const depletionYears: number[] = [];
  let successfulScenarios = 0;
  const allCashFlows: Array<any> = [];
  
  // Tax analysis tracking
  let totalTaxRates = 0;
  let totalTaxes = 0;
  let totalIRMAA = 0;
  let scenariosWithIRMAA = 0;
  
  // Regime analysis tracking
  let totalBearMarkets = 0;
  let totalCrises = 0;
  let worstEndingBalance = Infinity;
  
  // Run simulations
  for (let i = 0; i < iterations; i++) {
    const scenarioResult = runFixedRetirementScenario(params);
    results.push(scenarioResult.endingBalance);
    
    if (scenarioResult.success) {
      successfulScenarios++;
    }
    
    if (scenarioResult.yearsUntilDepletion !== null) {
      depletionYears.push(scenarioResult.yearsUntilDepletion);
    }
    
    // Track tax analysis
    totalTaxRates += scenarioResult.averageEffectiveTaxRate;
    totalTaxes += scenarioResult.totalTaxesPaid;
    totalIRMAA += scenarioResult.totalIRMAASurcharges;
    if (scenarioResult.totalIRMAASurcharges > 0) {
      scenariosWithIRMAA++;
    }
    
    // Track regime analysis
    const bearYears = scenarioResult.yearlyCashFlows.filter(cf => cf.marketRegime === 'bear').length;
    const crisisYears = scenarioResult.yearlyCashFlows.filter(cf => cf.marketRegime === 'crisis').length;
    totalBearMarkets += bearYears;
    totalCrises += crisisYears;
    
    if (scenarioResult.endingBalance < worstEndingBalance) {
      worstEndingBalance = scenarioResult.endingBalance;
    }
    
    // Store first scenario's cash flows
    if (i === 0) {
      allCashFlows.push(...scenarioResult.yearlyCashFlows);
    }
  }
  
  // Sort results for percentile calculations
  results.sort((a, b) => a - b);
  
  const probabilityOfSuccess = (successfulScenarios / iterations) * 100;
  
  const getPercentile = (percentile: number): number => {
    const index = Math.floor((percentile / 100) * (iterations - 1));
    return results[index];
  };
  
  // Calculate safe withdrawal rate
  let safeWithdrawalRate = params.withdrawalRate;
  if (probabilityOfSuccess < 90) {
    // Binary search for 90% success rate
    let low = 0.02;
    let high = params.withdrawalRate;
    
    while (high - low > 0.0001) {
      const mid = (low + high) / 2;
      const testParams = { ...params, withdrawalRate: mid };
      
      let testSuccesses = 0;
      for (let i = 0; i < 200; i++) { // Fewer iterations for speed
        const testResult = runFixedRetirementScenario(testParams);
        if (testResult.success) testSuccesses++;
      }
      
      const testProbability = (testSuccesses / 200) * 100;
      if (testProbability < 90) {
        high = mid;
      } else {
        low = mid;
      }
    }
    safeWithdrawalRate = low;
  }
  
  const averageDepletionYear = depletionYears.length > 0 
    ? depletionYears.reduce((sum, year) => sum + year, 0) / depletionYears.length
    : null;
  
  // Calculate projected portfolio at retirement
  const yearsToRetirement = Math.max(0, params.retirementAge - params.currentAge);
  let projectedRetirementPortfolio = params.currentRetirementAssets;
  
  // Use expected return for projection (simplified)
  for (let year = 0; year < yearsToRetirement; year++) {
    projectedRetirementPortfolio += params.annualSavings;
    projectedRetirementPortfolio *= (1 + params.expectedReturn);
  }
  
  return {
    probabilityOfSuccess,
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
    taxAnalysis: {
      averageEffectiveTaxRate: totalTaxRates / iterations,
      totalTaxesPaid: totalTaxes / iterations,
      totalIRMAASurcharges: totalIRMAA / iterations,
      percentWithIRMAA: (scenariosWithIRMAA / iterations) * 100
    },
    regimeAnalysis: {
      averageBearMarkets: totalBearMarkets / iterations,
      averageCrises: totalCrises / iterations,
      worstCaseScenario: worstEndingBalance
    }
  };
}