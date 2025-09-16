import type { EducationGoal, FinancialProfile } from './types.ts';
import { runEducationMonteCarlo } from "./education-monte-carlo.ts";
import { calculateCombinedTaxRate, calculateCapitalGainsTax } from './tax-calculator.ts';
import { 
  categorizeAssetsByTax, 
  calculateTaxEfficientWithdrawal,
  estimateBlendedTaxRate,
  calculateAssetWeightedReturns
} from './asset-tax-classifier.ts';
import type { AssetBuckets } from './asset-tax-classifier.ts';
import { 
  applyInflation, 
  realToNominalReturn,
  DEFAULT_INFLATION_RATES
} from './inflation-utils.ts';
import type { InflationRates } from './inflation-utils.ts';
import { calculateHealthcareCosts } from './healthcare-cost-calculator.ts';
import type { HealthcareCostParams } from './healthcare-cost-calculator.ts';
import {
  generateStochasticLifeExpectancy,
  generateCouplesStochasticLifeExpectancy
} from './stochastic-life-expectancy.ts';
import {
  simulateSurvival,
  simulateCouplesSurvival
} from './mortality-tables.ts';

// Retirement-specific interfaces

export interface RetirementMonteCarloParams {
  currentAge: number;
  spouseAge?: number;
  retirementAge: number;
  spouseRetirementAge?: number;
  lifeExpectancy: number;
  spouseLifeExpectancy?: number;
  
  // Assets and Income
  currentRetirementAssets: number;
  annualGuaranteedIncome: number; // SS, pensions, annuities, part-time work
  
  // Social Security claim ages
  socialSecurityClaimAge?: number;
  spouseSocialSecurityClaimAge?: number;
  socialSecurityBenefit?: number; // Monthly benefit
  spouseSocialSecurityBenefit?: number; // Monthly benefit
  
  // Part-time and pension income
  partTimeIncomeRetirement?: number; // Monthly part-time income
  spousePartTimeIncomeRetirement?: number;
  pensionBenefit?: number; // Monthly pension
  spousePensionBenefit?: number;
  
  // Pension survivorship options
  pensionSurvivorshipPercentage?: number; // Percentage of pension that continues to survivor (0-100)
  spousePensionSurvivorshipPercentage?: number; // Percentage of spouse pension that continues to survivor
  
  // Expenses
  annualRetirementExpenses: number;
  annualHealthcareCosts?: number; // Separated healthcare costs
  healthcareInflationRate?: number; // Healthcare-specific inflation
  // If true (default), annualRetirementExpenses already includes healthcare; skip modeled add-on
  expensesIncludeHealthcare?: boolean;
  
  // Market assumptions
  expectedReturn: number; // Real return after inflation (weighted average for portfolio)
  userExpectedReturn?: number; // User-specific expected return
  spouseExpectedReturn?: number; // Spouse-specific expected return for optimization
  jointAssetsReturn?: number; // Blended return for joint assets
  spouseUseGlidePath?: boolean; // Whether spouse uses glide path
  spouseUseRiskProfile?: boolean; // Whether spouse uses risk profile-based returns
  
  // Asset totals by owner
  userAssetTotal?: number;
  spouseAssetTotal?: number;
  jointAssetTotal?: number;
  returnVolatility: number;
  inflationRate: number;
  
  // Asset allocation
  stockAllocation: number; // 0-1
  bondAllocation: number; // 0-1
  cashAllocation: number; // 0-1
  
  // Owner-specific allocations
  userAllocation?: {
    usStocks: number;
    intlStocks: number;
    bonds: number;
    cash: number;
    alternatives: number;
  };
  spouseAllocation?: {
    usStocks: number;
    intlStocks: number;
    bonds: number;
    cash: number;
    alternatives: number;
  };
  
  // Owner-specific asset buckets
  userAssetBuckets?: AssetBuckets;
  spouseAssetBuckets?: AssetBuckets;
  jointAssetBuckets?: AssetBuckets;
  
  // Investment strategy options
  useGlidePath: boolean; // Whether to use dynamic glide path allocation
  useRiskProfile?: boolean; // Whether to use risk profile-based returns
  userRiskScore?: number; // User's risk profile score (1-5)
  spouseRiskScore?: number; // Spouse's risk profile score (1-5)
  
  // Strategy parameters
  withdrawalRate: number; // Initial withdrawal rate (e.g., 0.04 for 4%)
  useGuardrails?: boolean; // Dynamic withdrawal adjustments
  withdrawalTiming?: 'start' | 'mid' | 'end'; // When to take withdrawals (default: 'end')
  
  // Tax considerations
  taxRate: number; // Average tax rate on withdrawals
  filingStatus?: 'single' | 'married' | 'head_of_household';

  // Optional detailed accounts for per-account mechanics (RMD/QCD/QLAC/Inherited)
  accounts?: Array<{
    type: 'trad_ira' | '401k' | '403b' | 'roth_ira' | 'brokerage' | 'inherited_ira';
    owner: 'user' | 'spouse';
    balance: number;
    birthYear?: number;
    inherited?: { endYear: number };
  }>;
  qcdAnnualTarget?: number; // Desired annual QCD amount (cap handled in engine)
  qlac?: {
    userPurchase?: number;         // purchase amount excluded from RMD base until start
    userStartAge?: number;         // payout start age
    userPayoutRate?: number;       // annual payout rate (e.g., 0.05)
    spousePurchase?: number;
    spouseStartAge?: number;
    spousePayoutRate?: number;
  };
  
  // Accumulation phase parameters
  annualSavings: number; // Annual retirement contributions during accumulation
  
  // Individual savings breakdown for staggered retirement
  userAnnualSavings?: number; // User's individual annual savings
  spouseAnnualSavings?: number; // Spouse's individual annual savings
  userAnnualIncome?: number; // User's annual income (for staggered retirement)
  spouseAnnualIncome?: number; // Spouse's annual income (for staggered retirement)
  
  // Contribution allocations by account type (User)
  monthlyContribution401k?: number;
  monthlyContributionIRA?: number;
  monthlyContributionRothIRA?: number;
  monthlyContributionBrokerage?: number;
  annualContributionTraditionalIRA?: number;  // Annual Traditional IRA contribution
  annualContributionRothIRA?: number;  // Annual Roth IRA contribution
  
  // Spouse contribution allocations
  spouseMonthlyContribution401k?: number;
  spouseMonthlyContributionIRA?: number;
  spouseMonthlyContributionRothIRA?: number;
  spouseMonthlyContributionBrokerage?: number;
  spouseAnnualContributionTraditionalIRA?: number;  // Spouse Annual Traditional IRA
  spouseAnnualContributionRothIRA?: number;  // Spouse Annual Roth IRA
  
  // Cash flow allocation
  cashFlowRetirementAllocation?: number;  // Percentage of cash flow surplus allocated to retirement (0-100)
  
  // Legacy goal
  legacyGoal: number; // Amount desired to leave as legacy/inheritance
  
  // Long-term care considerations
  hasLongTermCareInsurance?: boolean;
  
  // Comprehensive LTC Modeling Parameters (Phase 1: Simple Shock Model)
  ltcModeling?: {
    enabled: boolean;
    approach: 'simple' | 'stochastic' | 'episodes';
    
    // Simple shock parameters
    lifetimeProbability: number;        // 0.70 default (70% chance of needing LTC)
    averageDuration: number;            // 3.0 years default (gender-adjusted)  
    averageAnnualCost: number;         // Regional-adjusted cost (e.g., $90K default)
    onsetAgeRange: [number, number];   // [75, 85] default onset age range
    costInflationRate: number;         // 4.9% LTC-specific inflation vs 3% general
    
    // Personal factors affecting LTC risk and costs
    gender: 'M' | 'F';                // Affects duration (F=longer episodes)
    maritalStatus: string;            // Affects care options and costs
    familySupport: 'High' | 'Medium' | 'Low'; // Affects home care vs facility probability
    
    // CRITICAL: Insurance coverage flag from Step 11 intake form
    hasInsurance: boolean;            // From hasLongTermCareInsurance field
    
    // Insurance parameters (for Phase 3)
    ltcInsurance?: {
      dailyBenefit: number;
      eliminationDays: number;
      benefitYears: number;
      annualPremium: number;
      inflationRider: boolean;
    };
  };
  
  // Asset buckets by tax treatment (for backward compatibility)
  assetBuckets: AssetBuckets;
  
  // Health status for mortality calculations
  userHealthStatus?: 'excellent' | 'good' | 'fair' | 'poor';
  spouseHealthStatus?: 'excellent' | 'good' | 'fair' | 'poor';
  
  // Demographics for LTC modeling
  userGender?: 'male' | 'female';
  spouseGender?: 'male' | 'female';
  retirementState?: string;
  
  // Dynamic withdrawal parameters
  discretionaryExpenseRatio?: number; // Portion of expenses that are discretionary (default 0.25)
  minDiscretionaryExpenses?: number; // Minimum discretionary spending (default $24k/year)
  enableDynamicWithdrawals?: boolean; // Enable/disable dynamic spending adjustments
  bearOnlyDynamicWithdrawals?: boolean; // Only adjust spending during bear/crisis markets (20%+ drawdowns)
  
  // Profile data for annuity access
  profileData?: any; // Full profile data to access annuity information for age-based triggering
  
  // Nominal dollar parameters
  useNominalDollars?: boolean; // If true, use nominal dollars internally (default: true)
  displayInTodaysDollars?: boolean; // If true, display results in today's dollars (default: true)
  generalInflationRate?: number; // General CPI inflation (default: 2.5%)
  healthcareInflationRate?: number; // Healthcare-specific inflation (default: 4.5%)
  educationInflationRate?: number; // Education inflation (default: 5%)
  socialSecurityCOLARate?: number; // SS COLA adjustment (default: matches CPI)

  // Return assumption set (Capital Market Assumptions)
  // If provided, overrides built-in defaults for expected returns/volatility/correlations
  cmaVersion?: string;

  // Performance/behavior toggles
  stopAtSecondDeath?: boolean; // If true, end simulation when both died (default true)
  useSpendingSmile?: boolean;  // If true, apply retirement spending smile adjustments (default false)
  spendingSmile?: {
    earlyDeclineRate?: number; // Real decline per year in early retirement (e.g., 0.01)
    lateIncreaseRate?: number; // Real increase per year in late retirement (e.g., 0.01)
    transitionYear?: number;   // Year at which spending transitions from decline to increase (e.g., 20)
  };

  // Optional tax itemization inputs for unified tax engine
  taxItemization?: {
    useItemized?: boolean;
    saltPaid?: number;
    mortgageInterest?: number;
    charitableGifts?: number;
    medicalExpenses?: number;
    otherItemized?: number;
    qbiIncome?: number;
  };
}

export interface RetirementMonteCarloResult {
  probabilityOfSuccess: number;
  medianEndingBalance: number;
  percentile10EndingBalance: number;
  percentile90EndingBalance: number;
  yearsUntilDepletion: number | null; // null if portfolio survives
  confidenceIntervals: {
    percentile10: number;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    percentile90: number;
  };
  scenarios: {
    successful: number;
    failed: number;
    total: number;
  };
  safeWithdrawalRate: number; // Calculated SWR for 80% success
  currentRetirementAssets: number; // Current portfolio value
  projectedRetirementPortfolio: number; // Projected portfolio value at retirement start
  yearlyCashFlows: Array<{
    year: number;
    age: number;
    portfolioBalance: number;
    guaranteedIncome: number;
    withdrawal: number;
    netCashFlow: number;
    marketRegime?: string;
  }>;
}

interface MonteCarloParams {
  currentSavings: number;
  monthlyContribution: number;
  yearsUntilStart: number;
  totalCostNeeded: number;
  expectedReturn: number;
  inflationRate: number;
  returnVolatility?: number; // Standard deviation
  riskProfile?: string; // For glide path strategy
}

interface MonteCarloResult {
  probabilityOfSuccess: number;
  confidenceIntervals: {
    percentile10: number;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    percentile90: number;
  };
  scenarios: {
    successful: number;
    failed: number;
    total: number;
  };
  projectedValues: {
    best: number;
    worst: number;
    median: number;
    mean: number;
  };
}

// Glide path portfolio allocation calculation
function getGlidePathAllocation(yearsLeft: number, riskProfile: string): { equity: number, bonds: number, cash: number, weightedReturn: number } {
  let equityWaypoints: { [key: number]: number };
  let baseReturn: number;
  
  if (riskProfile === 'aggressive') {
    equityWaypoints = { 17: 100, 13: 90, 9: 80, 5: 60, 1: 40, 0: 20, [-1]: 10 };
    baseReturn = 8.0;
  } else if (riskProfile === 'moderate') {
    equityWaypoints = { 17: 80, 13: 70, 9: 60, 5: 50, 1: 30, 0: 15, [-1]: 10 };
    baseReturn = 6.0;
  } else { // conservative
    equityWaypoints = { 17: 60, 13: 50, 9: 40, 5: 30, 1: 20, 0: 10, [-1]: 5 };
    baseReturn = 4.0;
  }
  
  // Find equity percentage for current year
  let equity: number;
  if (yearsLeft >= 17) equity = equityWaypoints[17];
  else if (yearsLeft >= 13) equity = equityWaypoints[13];
  else if (yearsLeft >= 9) equity = equityWaypoints[9];
  else if (yearsLeft >= 5) equity = equityWaypoints[5];
  else if (yearsLeft >= 1) equity = equityWaypoints[1];
  else if (yearsLeft === 0) equity = equityWaypoints[0];
  else equity = equityWaypoints[-1];
  
  // Allocate: bonds ~80% of non-equity, cash remainder
  const nonEquity = 100 - equity;
  const bonds = Math.floor(nonEquity * 0.8);
  const cash = nonEquity - bonds;
  
  // Weighted annual return (assuming 8% equity, 4% bonds, 2% cash)
  const weightedReturn = (equity * 0.08 + bonds * 0.04 + cash * 0.02) / 100;
  
  return { equity, bonds, cash, weightedReturn };
}

// Project 529 growth using glide path strategy
function project529GrowthWithGlidePath(
  initialBalance: number,
  monthlyContrib: number,
  yearsToCollege: number,
  riskProfile: string
): { finalBalance: number; annualReturns: number[] } {
  let balance = initialBalance;
  const annualReturns: number[] = [];
  
  for (let year = yearsToCollege; year >= 0; year--) {
    const allocation = getGlidePathAllocation(year, riskProfile);
    const annualReturn = allocation.weightedReturn;
    annualReturns.push(annualReturn);
    
    // Add monthly contributions for the year
    for (let month = 0; month < 12; month++) {
      balance += monthlyContrib;
    }
    
    // Apply annual return
    balance *= (1 + annualReturn);
  }
  
  return { finalBalance: Math.round(balance), annualReturns };
}

import { RNG } from './rng.ts';
// Generate normally distributed random number using Box-Muller transform (deterministic fallback)
function generateNormalRandom(mean: number, stdDev: number): number {
  const rrng = new RNG(951);
  const z = rrng.normal();
  return z * stdDev + mean;
}

// FIXED: Generate log-normal distributed returns (prevents negative returns)
function generateLogNormalReturn(expectedReturn: number, volatility: number): number {
  // For log-normal: ln(r) ~ N(μ - σ²/2, σ)
  const adjustedMean = expectedReturn - (volatility * volatility) / 2;
  const normalSample = generateNormalRandom(adjustedMean, volatility);
  return Math.exp(normalSample) - 1; // Convert to actual return rate
}

// Run a single Monte Carlo simulation scenario
function runScenario(params: MonteCarloParams): number {
  const {
    currentSavings,
    monthlyContribution,
    yearsUntilStart,
    expectedReturn,
    returnVolatility = 0.15, // Default 15% volatility
    riskProfile = 'moderate'
  } = params;

  let portfolioValue = currentSavings;

  // Handle glide path strategy
  if (riskProfile === 'glide') {
    // Use glide path strategy for year-by-year simulation
    for (let year = yearsUntilStart; year >= 1; year--) {
      const allocation = getGlidePathAllocation(year, 'moderate'); // Use moderate glide path
      const yearlyReturn = allocation.weightedReturn;
      
      // Add monthly contributions for the year with monthly compounding
      for (let month = 0; month < 12; month++) {
        portfolioValue += monthlyContribution;
        // Apply monthly return with volatility
        const monthlyReturn = yearlyReturn / 12;
        const randomReturn = generateNormalRandom(monthlyReturn, (returnVolatility * 0.8) / Math.sqrt(12)); // Lower volatility for glide path
        portfolioValue *= (1 + randomReturn);
        portfolioValue = Math.max(0, portfolioValue);
      }
    }
  } else {
    // Original fixed allocation strategy
    const monthsUntilStart = yearsUntilStart * 12;
    const monthlyReturn = expectedReturn / 12;

    // Simulate each month until education starts
    for (let month = 0; month < monthsUntilStart; month++) {
      // Add monthly contribution
      portfolioValue += monthlyContribution;

      // Apply random return based on expected return and volatility
      const randomReturn = generateNormalRandom(monthlyReturn, returnVolatility / Math.sqrt(12));
      portfolioValue *= (1 + randomReturn);

      // Ensure portfolio doesn't go negative
      portfolioValue = Math.max(0, portfolioValue);
    }
  }

  return portfolioValue;
}

// Main Monte Carlo simulation function
export function runMonteCarloSimulation(
  params: MonteCarloParams,
  iterations: number = 1000  // Industry standard for balance between accuracy and performance
): MonteCarloResult {
  const results: number[] = [];
  let successfulScenarios = 0;

  // Run simulations
  for (let i = 0; i < iterations; i++) {
    const finalValue = runScenario(params);
    results.push(finalValue);

    if (finalValue >= params.totalCostNeeded) {
      successfulScenarios++;
    }
  }

  // Sort results for percentile calculations
  results.sort((a, b) => a - b);

  // Calculate statistics
  const probabilityOfSuccess = (successfulScenarios / iterations) * 100;
  const mean = results.reduce((sum, val) => sum + val, 0) / iterations;

  // Get percentiles
  const getPercentile = (percentile: number): number => {
    const index = Math.floor((percentile / 100) * (iterations - 1));
    return results[index];
  };

  return {
    probabilityOfSuccess,
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
    projectedValues: {
      best: results[results.length - 1],
      worst: results[0],
      median: getPercentile(50),
      mean,
    },
  };
}

// Enhanced education projection with Monte Carlo
export async function calculateEducationProjectionWithMonteCarlo(
  goal: EducationGoal,
  profile: FinancialProfile | null
): Promise<any> {
  // Basic projection calculation (existing logic)
  const inflationRate = parseFloat(goal.inflationRate?.toString() || '2.4') / 100;
  const expectedReturn = parseFloat(goal.expectedReturn?.toString() || '6') / 100;
  const currentYear = new Date().getFullYear();
  
  // Calculate total cost needed
  let baseCost = 0;
  if ((goal.costOption === 'custom' || goal.costOption === 'specific') && goal.costPerYear) {
    baseCost = parseFloat(goal.costPerYear.toString());
  } else {
    baseCost = goal.goalType === 'college' ? 35000 : 15000;
  }
  
  const scholarshipPerYear = parseFloat(goal.scholarshipPerYear?.toString() || '0');
  const coverPercent = parseFloat(goal.coverPercent?.toString() || '100') / 100;
  
  let totalCostNeeded = 0;
  // Use goal.years to iterate exactly the specified number of years
  for (let i = 0; i < goal.years; i++) {
    const year = goal.startYear + i;
    const yearsFromNow = year - currentYear;
    const inflatedCost = baseCost * Math.pow(1 + inflationRate, yearsFromNow);
    const netCost = (inflatedCost - scholarshipPerYear) * coverPercent;
    totalCostNeeded += netCost;
  }
  
  // Run Education-specific tax/aid-aware Monte Carlo for success probability and contribution target
  const eduMC = runEducationMonteCarlo(
    goal,
    profile,
    {
      iterations: 1000,
      targetSuccessRate: 80,
      allowLoans: Number((goal as any)?.loanPerYear ?? 0) > 0,
      extraYearProbability: Number((goal as any)?.extraYearProbability ?? 0),
    }
  );
  const monthlyContribution = parseFloat(goal.monthlyContribution?.toString() || '0');
  const targetMonthlyContribution = eduMC.recommendedMonthlyContribution ?? monthlyContribution;
  
  // Generate glide path projection data for dashboard
  let glidePathProjection = null;
  // Define missing variables for glide path projection
  const currentSavings = parseFloat(goal.currentSavings?.toString() || '0');
  const yearsUntilStart = Math.max(0, goal.startYear - currentYear);
  if (goal.riskProfile === 'glide') {
    const glideData = project529GrowthWithGlidePath(
      currentSavings,
      monthlyContribution,
      yearsUntilStart,
      'moderate'
    );
    
    // Generate yearly projection data for charts
    const yearlyProjection = [];
    let balance = currentSavings;
    for (let year = yearsUntilStart; year >= 1; year--) {
      const allocation = getGlidePathAllocation(year, 'moderate');
      
      // Add contributions and apply return for the year
      for (let month = 0; month < 12; month++) {
        balance += monthlyContribution;
      }
      balance *= (1 + allocation.weightedReturn);
      
      yearlyProjection.push({
        year: currentYear + (yearsUntilStart - year + 1),
        balance: Math.round(balance),
        yearlyReturn: Math.round(allocation.weightedReturn * 100 * 10) / 10, // Round to 1 decimal
        allocation: {
          equity: allocation.equity,
          bonds: allocation.bonds,
          cash: allocation.cash
        }
      });
    }
    
    glidePathProjection = {
      finalBalance: glideData.finalBalance,
      annualReturns: glideData.annualReturns.map(r => Math.round(r * 100 * 10) / 10),
      yearlyProjection
    };
  }

  // Return enhanced projection with Monte Carlo results
  return {
    totalCostNeeded: Math.round(totalCostNeeded),
    currentProjectedValue: undefined,
    // Primary metric now reflects Option C
    probabilityOfSuccess: Math.round(eduMC.probabilityOfSuccess),
    comprehensiveCoverageProbability: Math.round(eduMC.probabilityOfComprehensiveCoverage),
    monthlyContributionNeeded: targetMonthlyContribution,
    glidePathProjection,
    monteCarloAnalysis: {
      probabilityOfComprehensiveCoverage: Math.round(eduMC.probabilityOfComprehensiveCoverage),
      probabilityNoLoan: Math.round(eduMC.probabilityNoLoan),
      scenarios: eduMC.scenarios,
      shortfallPercentiles: eduMC.shortfallPercentiles,
      recommendedMonthlyContribution: targetMonthlyContribution,
      riskProfile: goal.riskProfile,
      volatilityUsed: undefined,
      confidenceLevels: {
        veryLikely: eduMC.probabilityOfSuccess >= 90,
        likely: eduMC.probabilityOfSuccess >= 75,
        possible: eduMC.probabilityOfSuccess >= 50,
        unlikely: eduMC.probabilityOfSuccess < 50,
      },
    },
  };
}

// Scenario analysis for education funding
export function analyzeEducationScenarios(
  baseParams: MonteCarloParams,
  scenarios: Array<{
    name: string;
    changes: Partial<MonteCarloParams>;
  }>
): Array<{
  name: string;
  result: MonteCarloResult;
  comparisonToBase: {
    probabilityDelta: number;
    medianValueDelta: number;
  };
}> {
  // Run base scenario
  const baseResult = runMonteCarloSimulation(baseParams);
  
  // Run each scenario
  return scenarios.map(scenario => {
    const scenarioParams = { ...baseParams, ...scenario.changes };
    const result = runMonteCarloSimulation(scenarioParams);
    
    return {
      name: scenario.name,
      result,
      comparisonToBase: {
        probabilityDelta: result.probabilityOfSuccess - baseResult.probabilityOfSuccess,
        medianValueDelta: result.projectedValues.median - baseResult.projectedValues.median,
      },
    };
  });
}

// ==== GLIDE PATH STRATEGY ====

// Define the glide path schedule (years to retirement -> allocation)
interface GlidePathAllocation {
  stock: number;
  bond: number;
  cash: number;
}

const GLIDE_PATH_SCHEDULE: { [key: number]: GlidePathAllocation } = {
  30: { stock: 90, bond: 10, cash: 0 },   // 30+ years out
  25: { stock: 85, bond: 15, cash: 0 },
  20: { stock: 80, bond: 20, cash: 0 },
  15: { stock: 70, bond: 25, cash: 5 },
  10: { stock: 60, bond: 35, cash: 5 },
  5:  { stock: 50, bond: 40, cash: 10 },
  0:  { stock: 40, bond: 50, cash: 10 },  // At retirement
  [-5]: { stock: 35, bond: 55, cash: 10 }, // 5 years into retirement
  [-10]: { stock: 30, bond: 55, cash: 15 }, // 10+ years into retirement
};

// Get the target allocation for a given number of years to retirement
function getGlidePathTarget(yearsToRetirement: number): GlidePathAllocation {
  if (yearsToRetirement >= 30) return GLIDE_PATH_SCHEDULE[30];
  if (yearsToRetirement >= 25) return GLIDE_PATH_SCHEDULE[25];
  if (yearsToRetirement >= 20) return GLIDE_PATH_SCHEDULE[20];
  if (yearsToRetirement >= 15) return GLIDE_PATH_SCHEDULE[15];
  if (yearsToRetirement >= 10) return GLIDE_PATH_SCHEDULE[10];
  if (yearsToRetirement >= 5) return GLIDE_PATH_SCHEDULE[5];
  if (yearsToRetirement >= 0) return GLIDE_PATH_SCHEDULE[0];
  if (yearsToRetirement >= -5) return GLIDE_PATH_SCHEDULE[-5];
  
  // Default for deep into retirement
  return GLIDE_PATH_SCHEDULE[-10];
}

// Calculate expected return based on glide path allocation
// Helper function to calculate current allocation from user's portfolio
function calculateCurrentAllocation(profileData: any): { stocks: number, bonds: number, cash: number } {
  // Extract current allocation from user's assets
  // This is a simplified version - in practice, we'd analyze actual holdings
  const assets = profileData.assets || [];
  let totalValue = 0;
  let stockValue = 0;
  let bondValue = 0;
  let cashValue = 0;
  
  // Categorize assets (simplified mapping)
  assets.forEach((asset: any) => {
    const value = parseFloat(asset.currentValue || '0');
    totalValue += value;
    
    // Map asset types to allocations (this could be more sophisticated)
    if (asset.type === 'brokerage' || asset.type === '401k' || asset.type === 'ira') {
      // Assume mixed allocation based on risk profile for retirement accounts
      stockValue += value * 0.7; // 70% stocks assumption
      bondValue += value * 0.25; // 25% bonds
      cashValue += value * 0.05; // 5% cash
    } else if (asset.type === 'savings' || asset.type === 'checking') {
      cashValue += value;
    }
  });
  
  if (totalValue === 0) {
    // Default allocation if no assets found
    return { stocks: 70, bonds: 25, cash: 5 };
  }
  
  return {
    stocks: (stockValue / totalValue) * 100,
    bonds: (bondValue / totalValue) * 100,
    cash: (cashValue / totalValue) * 100
  };
}

// Helper function to calculate spouse current allocation
function calculateSpouseCurrentAllocation(profileData: any): { stocks: number, bonds: number, cash: number } {
  // Similar logic for spouse assets - simplified for now
  return calculateCurrentAllocation(profileData); // Could be enhanced to separate spouse assets
}

// Helper function to calculate expected return from allocation
function calculateReturnFromAllocation(allocation: { stocks: number, bonds: number, cash: number }): number {
  const stockReturn = 0.10; // 10% expected for stocks
  const bondReturn = 0.04; // 4% expected for bonds  
  const cashReturn = 0.02; // 2% expected for cash
  
  const weightedReturn = 
    (allocation.stocks / 100) * stockReturn +
    (allocation.bonds / 100) * bondReturn +
    (allocation.cash / 100) * cashReturn;
  
  return weightedReturn;
}

// Map risk profile scores to expected real returns (after inflation)
function getRiskProfileReturn(riskScore: number): number {
  // Risk scores: 1 = Conservative, 2 = Moderately Conservative, 3 = Moderate, 4 = Moderately Aggressive, 5 = Aggressive
  // Updated return values as per requirements
  switch (riskScore) {
    case 1: // Conservative
      return 0.050; // 5.0% real return
    case 2: // Moderately Conservative
      return 0.056; // 5.6% real return
    case 3: // Moderate
      return 0.061; // 6.1% real return
    case 4: // Moderately Aggressive
      return 0.066; // 6.6% real return
    case 5: // Aggressive
      return 0.070; // 7.0% real return
    default:
      return 0.061; // Default to moderate (6.1%)
  }
}

// Get risk profile allocation based on risk score
function getRiskProfileAllocation(riskScore: number): { stock: number; bond: number; cash: number } {
  switch (riskScore) {
    case 1: // Conservative
      return { stock: 20, bond: 70, cash: 10 };
    case 2: // Moderately Conservative
      return { stock: 40, bond: 50, cash: 10 };
    case 3: // Moderate
      return { stock: 60, bond: 35, cash: 5 };
    case 4: // Moderately Aggressive
      return { stock: 75, bond: 20, cash: 5 };
    case 5: // Aggressive
      return { stock: 90, bond: 10, cash: 0 };
    default:
      return { stock: 60, bond: 35, cash: 5 }; // Default to moderate
  }
}

// Export the risk profile functions for use in other modules
export { getRiskProfileReturn, getRiskProfileAllocation };

function getGlidePathReturn(yearsToRetirement: number): number {
  const allocation = getGlidePathTarget(yearsToRetirement);
  
  // Historical real returns (after inflation)
  const stockReturn = 0.07;  // 7% real return for stocks
  const bondReturn = 0.025; // 2.5% real return for bonds
  const cashReturn = 0.005; // 0.5% real return for cash
  
  return (allocation.stock / 100) * stockReturn +
         (allocation.bond / 100) * bondReturn +
         (allocation.cash / 100) * cashReturn;
}

// ==== RETIREMENT MONTE CARLO SIMULATION ====

// FIXED: Calculate asset allocation-based returns using log-normal distribution
// Calculate return based on specific allocation percentages
function calculateAllocationReturn(
  allocation: {
    usStocks: number;
    intlStocks?: number;
    bonds: number;
    cash: number;
    alternatives?: number;
  },
  inflationRate: number = 0.03
): number {
  // Expected real returns (after inflation) for each asset class
  const assetReturns = {
    usStocks: 0.07,      // 7% real return for US stocks
    intlStocks: 0.065,    // 6.5% real return for international stocks
    bonds: 0.02,          // 2% real return for bonds
    cash: -0.01,          // -1% real return for cash (below inflation)
    alternatives: 0.05    // 5% real return for alternatives
  };
  
  // Volatility for each asset class
  const assetVolatilities = {
    usStocks: 0.16,      // 16% volatility for US stocks
    intlStocks: 0.18,    // 18% volatility for international stocks
    bonds: 0.05,          // 5% volatility for bonds
    cash: 0.01,           // 1% volatility for cash
    alternatives: 0.10    // 10% volatility for alternatives
  };
  
  // Calculate weighted expected return and volatility
  let expectedReturn = 0;
  let portfolioVariance = 0;
  
  const totalAllocation = (allocation.usStocks || 0) + 
                          (allocation.intlStocks || 0) + 
                          (allocation.bonds || 0) + 
                          (allocation.cash || 0) + 
                          (allocation.alternatives || 0);
  
  if (totalAllocation > 0) {
    // Normalize allocations to sum to 100%
    const normalizedAllocation = {
      usStocks: (allocation.usStocks || 0) / totalAllocation,
      intlStocks: (allocation.intlStocks || 0) / totalAllocation,
      bonds: (allocation.bonds || 0) / totalAllocation,
      cash: (allocation.cash || 0) / totalAllocation,
      alternatives: (allocation.alternatives || 0) / totalAllocation
    };
    
    // Calculate weighted return
    expectedReturn = normalizedAllocation.usStocks * assetReturns.usStocks +
                    normalizedAllocation.intlStocks * assetReturns.intlStocks +
                    normalizedAllocation.bonds * assetReturns.bonds +
                    normalizedAllocation.cash * assetReturns.cash +
                    normalizedAllocation.alternatives * assetReturns.alternatives;
    
    // Calculate portfolio variance (simplified - assumes no correlation)
    portfolioVariance = Math.pow(normalizedAllocation.usStocks * assetVolatilities.usStocks, 2) +
                       Math.pow(normalizedAllocation.intlStocks * assetVolatilities.intlStocks, 2) +
                       Math.pow(normalizedAllocation.bonds * assetVolatilities.bonds, 2) +
                       Math.pow(normalizedAllocation.cash * assetVolatilities.cash, 2) +
                       Math.pow(normalizedAllocation.alternatives * assetVolatilities.alternatives, 2);
  }
  
  const portfolioVolatility = Math.sqrt(portfolioVariance);
  
  // Generate random return using log-normal distribution
  return generateLogNormalReturn(expectedReturn, portfolioVolatility);
}

// Calculate owner-specific returns for assets
function calculateOwnerSpecificReturns(
  userAssets: number,
  spouseAssets: number,
  jointAssets: number,
  userAllocation: any,
  spouseAllocation: any,
  inflationRate: number = 0.03
): {
  userReturn: number;
  spouseReturn: number;
  jointReturn: number;
  weightedAverageReturn: number;
} {
  // Calculate returns for each owner's allocation
  const userReturn = userAssets > 0 ? calculateAllocationReturn(userAllocation, inflationRate) : 0;
  const spouseReturn = spouseAssets > 0 ? calculateAllocationReturn(spouseAllocation, inflationRate) : 0;
  
  // For joint assets, use average of both allocations
  const jointAllocation = {
    usStocks: ((userAllocation.usStocks || 0) + (spouseAllocation.usStocks || 0)) / 2,
    intlStocks: ((userAllocation.intlStocks || 0) + (spouseAllocation.intlStocks || 0)) / 2,
    bonds: ((userAllocation.bonds || 0) + (spouseAllocation.bonds || 0)) / 2,
    cash: ((userAllocation.cash || 0) + (spouseAllocation.cash || 0)) / 2,
    alternatives: ((userAllocation.alternatives || 0) + (spouseAllocation.alternatives || 0)) / 2
  };
  const jointReturn = jointAssets > 0 ? calculateAllocationReturn(jointAllocation, inflationRate) : 0;
  
  // Calculate weighted average return based on asset values
  const totalAssets = userAssets + spouseAssets + jointAssets;
  const weightedAverageReturn = totalAssets > 0 ?
    (userAssets * userReturn + spouseAssets * spouseReturn + jointAssets * jointReturn) / totalAssets :
    0;
  
  return {
    userReturn,
    spouseReturn,
    jointReturn,
    weightedAverageReturn
  };
}

function getAssetAllocationReturn(
  stockAllocation: number,
  bondAllocation: number,
  cashAllocation: number,
  expectedReturn: number, // Use the passed-in expected return (already inflation-adjusted)
  returnVolatility: number // Use the passed-in volatility
): number {
  // Calculate weighted volatility based on asset allocation
  // These are typical volatilities for each asset class
  const stockVolatility = 0.16; // 16% volatility for stocks
  const bondVolatility = 0.05; // 5% volatility for bonds
  const cashVolatility = 0.01; // 1% volatility for cash
  
  // Calculate portfolio volatility based on allocation
  // This is a simplified calculation assuming no correlation
  const portfolioVolatility = Math.sqrt(
    Math.pow(stockAllocation * stockVolatility, 2) +
    Math.pow(bondAllocation * bondVolatility, 2) +
    Math.pow(cashAllocation * cashVolatility, 2)
  );
  
  // Use the minimum of calculated volatility and passed-in volatility
  // This ensures we don't underestimate risk
  const finalVolatility = Math.max(portfolioVolatility, returnVolatility);
  
  // Use log-normal distribution with the expected return (already inflation-adjusted)
  return generateLogNormalReturn(expectedReturn, finalVolatility);
}

// Run a single retirement scenario simulation
// Market regime types and parameters for sequence of returns risk
type MarketRegime = 'bull' | 'bear' | 'normal' | 'crisis';

interface RegimeParameters {
  meanReturn: number;
  volatility: number;
  duration: number;
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

// Get initial regime with sequence of returns risk consideration
function getInitialRegime(yearsToRetirement: number): MarketRegime {
  // Adjust for sequence of returns risk - higher bear/crisis probability near retirement
  const nearRetirement = yearsToRetirement <= 5;
  
  const probabilities = nearRetirement ? {
    bull: 0.25,    // 25% (reduced from 30%)
    normal: 0.40,  // 40% (reduced from 50%)
    bear: 0.25,    // 25% (increased from 15%)
    crisis: 0.10   // 10% (increased from 5%)
  } : {
    bull: 0.30,    // 30%
    normal: 0.50,  // 50%
    bear: 0.15,    // 15%
    crisis: 0.05   // 5%
  };
  
  // Deterministic placeholder; non-critical path
  const rand = 0.5;
  let cumProb = 0;
  
  for (const [regime, prob] of Object.entries(probabilities)) {
    cumProb += prob;
    if (rand <= cumProb) {
      return regime as MarketRegime;
    }
  }
  
  return 'normal'; // Default fallback
}

// Generate return with regime switching
function generateRegimeReturn(
  currentRegime: MarketRegime,
  stockAllocation: number,
  bondAllocation: number,
  yearsToRetirement?: number
): { return: number; nextRegime: MarketRegime } {
  const regime = MARKET_REGIMES[currentRegime];
  
  // Apply sequence of returns risk - higher bear/crisis probability near retirement
  let adjustedRegime = { ...regime };
  if (yearsToRetirement !== undefined && yearsToRetirement <= 5 && yearsToRetirement >= 0) {
    // Near retirement - increase volatility and bear market probability
    adjustedRegime.volatility = adjustedRegime.volatility * 1.2;
    if (currentRegime === 'normal' || currentRegime === 'bull') {
      // Increase chance of transitioning to bear or crisis
      adjustedRegime.transitionProbs = {
        ...adjustedRegime.transitionProbs,
        bear: Math.min(0.4, adjustedRegime.transitionProbs.bear * 1.5),
        crisis: Math.min(0.15, adjustedRegime.transitionProbs.crisis * 2),
        bull: adjustedRegime.transitionProbs.bull * 0.7,
        normal: adjustedRegime.transitionProbs.normal * 0.8
      };
      // Normalize probabilities
      const total = Object.values(adjustedRegime.transitionProbs).reduce((a, b) => a + b, 0);
      for (const key in adjustedRegime.transitionProbs) {
        adjustedRegime.transitionProbs[key as MarketRegime] /= total;
      }
    }
  }
  
  // Generate stock return based on regime
  const stockReturn = generateNormalRandom(adjustedRegime.meanReturn, adjustedRegime.volatility);
  
  // Bonds are less affected by regimes
  const bondReturn = generateNormalRandom(0.04, 0.05);
  
  // Calculate portfolio return
  const portfolioReturn = stockAllocation * stockReturn + bondAllocation * bondReturn + 
                          (1 - stockAllocation - bondAllocation) * 0.02; // Cash return
  
  // Determine next regime
  let nextRegime = currentRegime;
  const rand = 0.5;
  let cumProb = 0;
  
  for (const [nextRegimeKey, prob] of Object.entries(adjustedRegime.transitionProbs)) {
    cumProb += prob;
    if (rand <= cumProb) {
      nextRegime = nextRegimeKey as MarketRegime;
      break;
    }
  }
  
  return { return: portfolioReturn, nextRegime };
}

function runRetirementScenario(params: RetirementMonteCarloParams): {
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
    marketRegime?: string;
  }>;
} {
  const {
    currentAge,
    retirementAge,
    lifeExpectancy,
    currentRetirementAssets,
    annualGuaranteedIncome: initialGuaranteedIncome,
    annualRetirementExpenses,
    annualHealthcareCosts = 0,
    spouseAge,
    spouseLifeExpectancy,
    expectedReturn,
    returnVolatility,
    inflationRate,
    stockAllocation,
    bondAllocation,
    cashAllocation,
    withdrawalRate,
    useGuardrails = false,
    taxRate,
    annualSavings,
    legacyGoal = 0
  } = params;
  
  // No longer need to generate stochastic life expectancy upfront
  // We now use year-by-year mortality simulation for more realistic modeling

  let portfolioBalance = currentRetirementAssets;
  let currentWithdrawalRate = withdrawalRate;
  const yearlyCashFlows = [];
  let yearsUntilDepletion: number | null = null;
  
  let age = currentAge;
  let year = 0;
  
  // CRITICAL FIX: Track actual asset buckets throughout simulation
  // Previously, the code was recalculating buckets proportionally each year,
  // which incorrectly assumed all asset types deplete at the same rate.
  // Tax-efficient withdrawal means cash and brokerage accounts deplete FIRST,
  // while tax-deferred and Roth accounts are preserved until later.
  // This fix tracks the actual balance of each bucket type throughout retirement.
  let currentBuckets: AssetBuckets = {
    taxDeferred: params.assetBuckets.taxDeferred,
    taxFree: params.assetBuckets.taxFree,
    capitalGains: params.assetBuckets.capitalGains,
    cashEquivalents: params.assetBuckets.cashEquivalents,
    totalAssets: params.assetBuckets.totalAssets
  };
  
  // Track owner-specific buckets if available for more accurate returns
  let userBuckets: AssetBuckets | undefined = params.userAssetBuckets ? {
    ...params.userAssetBuckets
  } : undefined;
  let spouseBuckets: AssetBuckets | undefined = params.spouseAssetBuckets ? {
    ...params.spouseAssetBuckets
  } : undefined;
  let jointBuckets: AssetBuckets | undefined = params.jointAssetBuckets ? {
    ...params.jointAssetBuckets
  } : undefined;

  // Accumulation phase: simulate from current age to retirement age
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  
  // Initialize market regime with sequence of returns risk consideration
  let currentMarketRegime = getInitialRegime(yearsToRetirement);
  
  for (let accumYear = 0; accumYear < yearsToRetirement; accumYear++) {
    const currentYearAge = currentAge + accumYear;
    const yearsUntilRetirement = retirementAge - currentYearAge;
    
    // Determine allocation and expected return based on strategy
    let currentStockAllocation = stockAllocation;
    let currentBondAllocation = bondAllocation;
    let currentCashAllocation = cashAllocation;
    let currentExpectedReturn = expectedReturn;
    
    if (params.useGlidePath) {
      // Use glide path strategy
      const glidePathAllocation = getGlidePathTarget(yearsUntilRetirement);
      currentStockAllocation = glidePathAllocation.stock / 100;
      currentBondAllocation = glidePathAllocation.bond / 100;
      currentCashAllocation = glidePathAllocation.cash / 100;
      currentExpectedReturn = getGlidePathReturn(yearsUntilRetirement);
    }
    
    // Calculate annual return with market regime switching for sequence of returns risk
    let annualReturn: number;
    const regimeResult = generateRegimeReturn(
      currentMarketRegime,
      currentStockAllocation,
      currentBondAllocation,
      yearsUntilRetirement
    );
    currentMarketRegime = regimeResult.nextRegime;
    const regimeReturn = regimeResult.return;
    
    // Use owner-specific returns if available (prioritize when useCurrentAllocation is true)
    if ((params.useCurrentAllocation || (params.userAllocation && params.spouseAllocation)) && 
        userBuckets && spouseBuckets && jointBuckets) {
      // Calculate owner-specific base returns
      const baseOwnerReturns = calculateOwnerSpecificReturns(
        userBuckets.totalAssets,
        spouseBuckets.totalAssets,
        jointBuckets.totalAssets,
        params.userAllocation,
        params.spouseAllocation,
        params.inflationRate
      );
      
      // Adjust owner returns based on market regime
      const regimeAdjustmentFactor = regimeReturn / (currentExpectedReturn || 0.07);
      const ownerReturns = {
        userReturn: baseOwnerReturns.userReturn * regimeAdjustmentFactor,
        spouseReturn: baseOwnerReturns.spouseReturn * regimeAdjustmentFactor,
        jointReturn: baseOwnerReturns.jointReturn * regimeAdjustmentFactor,
        weightedAverageReturn: baseOwnerReturns.weightedAverageReturn * regimeAdjustmentFactor
      };
      
      // Apply owner-specific returns to each bucket
      userBuckets.taxDeferred *= (1 + baseOwnerReturns.userReturn);
      userBuckets.taxFree *= (1 + baseOwnerReturns.userReturn);
      userBuckets.capitalGains *= (1 + baseOwnerReturns.userReturn);
      userBuckets.cashEquivalents *= (1 + baseOwnerReturns.userReturn);
      userBuckets.totalAssets = userBuckets.taxDeferred + userBuckets.taxFree + 
                                userBuckets.capitalGains + userBuckets.cashEquivalents;
      
      spouseBuckets.taxDeferred *= (1 + baseOwnerReturns.spouseReturn);
      spouseBuckets.taxFree *= (1 + baseOwnerReturns.spouseReturn);
      spouseBuckets.capitalGains *= (1 + baseOwnerReturns.spouseReturn);
      spouseBuckets.cashEquivalents *= (1 + baseOwnerReturns.spouseReturn);
      spouseBuckets.totalAssets = spouseBuckets.taxDeferred + spouseBuckets.taxFree + 
                                  spouseBuckets.capitalGains + spouseBuckets.cashEquivalents;
      
      jointBuckets.taxDeferred *= (1 + baseOwnerReturns.jointReturn);
      jointBuckets.taxFree *= (1 + baseOwnerReturns.jointReturn);
      jointBuckets.capitalGains *= (1 + baseOwnerReturns.jointReturn);
      jointBuckets.cashEquivalents *= (1 + baseOwnerReturns.jointReturn);
      jointBuckets.totalAssets = jointBuckets.taxDeferred + jointBuckets.taxFree + 
                                 jointBuckets.capitalGains + jointBuckets.cashEquivalents;
      
      // Update combined buckets from owner-specific buckets
      currentBuckets.taxDeferred = userBuckets.taxDeferred + spouseBuckets.taxDeferred + jointBuckets.taxDeferred;
      currentBuckets.taxFree = userBuckets.taxFree + spouseBuckets.taxFree + jointBuckets.taxFree;
      currentBuckets.capitalGains = userBuckets.capitalGains + spouseBuckets.capitalGains + jointBuckets.capitalGains;
      currentBuckets.cashEquivalents = userBuckets.cashEquivalents + spouseBuckets.cashEquivalents + jointBuckets.cashEquivalents;
      
      // Use weighted average return for logging
      annualReturn = baseOwnerReturns.weightedAverageReturn;
    } else {
      // Use market regime return directly when owner-specific data not available
      annualReturn = regimeReturn;
      
      // Apply returns to each bucket
      currentBuckets.taxDeferred *= (1 + annualReturn);
      currentBuckets.taxFree *= (1 + annualReturn);
      currentBuckets.capitalGains *= (1 + annualReturn);
      currentBuckets.cashEquivalents *= (1 + annualReturn);
    }
    
    // ENHANCED: Calculate dynamic savings capacity accounting for actual debt payoff and staggered retirement
    let dynamicAnnualSavings = annualSavings;
    
    // CRITICAL FIX: Handle staggered retirement - adjust savings when one spouse retires
    if (params.spouseAge && params.spouseRetirementAge) {
      const spouseCurrentAge = params.spouseAge + accumYear;
      const userIsRetired = currentYearAge >= params.retirementAge;
      const spouseIsRetired = spouseCurrentAge >= params.spouseRetirementAge;
      
      // If both have individual savings data, calculate based on who's still working
      if (params.userAnnualSavings !== undefined && params.spouseAnnualSavings !== undefined) {
        dynamicAnnualSavings = 0;
        if (!userIsRetired) {
          dynamicAnnualSavings += params.userAnnualSavings;
        }
        if (!spouseIsRetired) {
          dynamicAnnualSavings += params.spouseAnnualSavings;
        }
      } else {
        // Fallback: proportional reduction based on income
        if (userIsRetired && !spouseIsRetired && params.spouseAnnualIncome && params.userAnnualIncome) {
          // Only spouse is working
          const totalIncome = params.userAnnualIncome + params.spouseAnnualIncome;
          dynamicAnnualSavings = annualSavings * (params.spouseAnnualIncome / totalIncome);
        } else if (!userIsRetired && spouseIsRetired && params.spouseAnnualIncome && params.userAnnualIncome) {
          // Only user is working
          const totalIncome = params.userAnnualIncome + params.spouseAnnualIncome;
          dynamicAnnualSavings = annualSavings * (params.userAnnualIncome / totalIncome);
        } else if (userIsRetired && spouseIsRetired) {
          // Both retired - no more savings
          dynamicAnnualSavings = 0;
        }
      }
    } else {
      // Single person scenario
      if (currentYearAge >= params.retirementAge) {
        dynamicAnnualSavings = 0;
      }
    }
    
    // Calculate potential additional savings from debt payoff
    const yearsFromRetirement = yearsToRetirement - accumYear;
    
    if (yearsFromRetirement <= 15 && yearsFromRetirement >= 1 && dynamicAnnualSavings > 0) {
      // Gradual increase in savings capacity as debts are paid off
      const potentialDebtPayoffBonus = dynamicAnnualSavings * 0.15; // 15% boost assumption
      const rampUpFactor = Math.min(1, (16 - yearsFromRetirement) / 10); // Gradual increase
      dynamicAnnualSavings += potentialDebtPayoffBonus * rampUpFactor;
    }
    
    // Allocate contributions to owner-specific buckets if available
    if (dynamicAnnualSavings > 0) {
      const allocationResult = allocateContributionsToOwnerBuckets(
        params,
        dynamicAnnualSavings,
        currentYearAge,
        accumYear,
        userBuckets,
        spouseBuckets,
        jointBuckets
      );
      
      if (allocationResult.updatedUserBuckets) {
        userBuckets = allocationResult.updatedUserBuckets;
      }
      if (allocationResult.updatedSpouseBuckets) {
        spouseBuckets = allocationResult.updatedSpouseBuckets;
      }
      if (allocationResult.updatedJointBuckets) {
        jointBuckets = allocationResult.updatedJointBuckets;
      }
      
      currentBuckets = allocationResult.updatedCombinedBuckets;
    }
    
    // Update total assets and portfolio balance
    currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    portfolioBalance = currentBuckets.totalAssets;

    // Record cash flow for accumulation phase
    yearlyCashFlows.push({
      year: year + 1,
      age: age + 1,
      portfolioBalance: Math.max(0, portfolioBalance),
      guaranteedIncome: 0, // No guaranteed income during accumulation
      withdrawal: -dynamicAnnualSavings, // Negative withdrawal = contribution
      netCashFlow: dynamicAnnualSavings,
      marketRegime: currentMarketRegime
    });
    


    // Check for portfolio failure during accumulation (unlikely but possible)
    if (portfolioBalance <= 0 && yearsUntilDepletion === null) {
      yearsUntilDepletion = accumYear + 1;
      break;
    }

    age++;
    year++;
  }
  
  // Distribution phase: simulate with dynamic mortality
  // FIXED: Track withdrawal amount that gets adjusted for inflation each year
  // Initial withdrawal based on withdrawal rate of starting retirement portfolio
  let currentWithdrawal = withdrawalRate * portfolioBalance;
  
  // We'll calculate guaranteed income dynamically each year based on ages and income sources
  
  // Track healthcare and non-healthcare expenses separately with dynamic withdrawals
  let currentHealthcareCosts = annualHealthcareCosts;
  let baseNonHealthcareCosts = annualRetirementExpenses - annualHealthcareCosts;
  
  // Split non-healthcare expenses into essential and discretionary
  const enableDynamic = params.enableDynamicWithdrawals !== false; // Default true
  const discretionaryRatio = params.discretionaryExpenseRatio || 0.25;
  const minDiscretionary = params.minDiscretionaryExpenses || 24000; // $2k/month default
  
  let baseEssentialExpenses = baseNonHealthcareCosts * (1 - discretionaryRatio);
  let baseDiscretionaryExpenses = Math.max(
    baseNonHealthcareCosts * discretionaryRatio,
    enableDynamic ? minDiscretionary : 0
  );
  
  // Adjust if discretionary minimum pushes total too high
  if (baseEssentialExpenses + baseDiscretionaryExpenses > baseNonHealthcareCosts && enableDynamic) {
    baseEssentialExpenses = baseNonHealthcareCosts - baseDiscretionaryExpenses;
  }
  
  let currentEssentialExpenses = baseEssentialExpenses;
  let currentDiscretionaryExpenses = enableDynamic ? baseDiscretionaryExpenses : baseNonHealthcareCosts - baseEssentialExpenses;
  let currentNonHealthcareCosts = currentEssentialExpenses + currentDiscretionaryExpenses;
  
  // Track portfolio value for dynamic adjustments
  let previousPortfolioValue = portfolioBalance;
  let previousYearPortfolioValue = portfolioBalance; // Track for guardrails
  
  // Track survival status for dynamic mortality
  let userAlive = true;
  let spouseAlive = spouseAge !== undefined;
  let distYear = 0;
  
  // Debug: Track initial conditions
  let debugFirstYear = true;
  
  // Continue simulation until life expectancy is reached or portfolio depletes
  // Continue simulation while at least one person is alive OR portfolio has assets
  // This properly captures longevity risk and portfolio sustainability
  const maxSimulationYears = Math.min(60, Math.max(120 - retirementAge, 120 - (spouseAge || retirementAge)));
  while ((userAlive || spouseAlive || portfolioBalance > 0) && distYear < maxSimulationYears) { // Cap at 60 years of retirement
    const yearsIntoRetirement = -distYear; // Negative for years after retirement
    const currentSpouseAge = params.spouseAge ? params.spouseAge + (age - params.currentAge) : undefined;
    
    // Determine allocation and expected return based on strategy
    let currentStockAllocation = stockAllocation;
    let currentBondAllocation = bondAllocation;
    let currentCashAllocation = cashAllocation;
    let currentExpectedReturn = expectedReturn;
    
    if (params.useGlidePath) {
      // Use glide path strategy (continues through retirement)
      const glidePathAllocation = getGlidePathTarget(yearsIntoRetirement);
      currentStockAllocation = glidePathAllocation.stock / 100;
      currentBondAllocation = glidePathAllocation.bond / 100;
      currentCashAllocation = glidePathAllocation.cash / 100;
      currentExpectedReturn = getGlidePathReturn(yearsIntoRetirement);
    }
    
    // Calculate annual return with market regime switching for sequence of returns risk
    let annualReturn: number;
    const regimeResult = generateRegimeReturn(
      currentMarketRegime,
      currentStockAllocation,
      currentBondAllocation,
      0 // In retirement, sequence risk is ongoing
    );
    currentMarketRegime = regimeResult.nextRegime;
    const regimeReturn = regimeResult.return;
    
    // Use owner-specific returns if available (even in retirement)
    if ((params.useCurrentAllocation || (params.userAllocation && params.spouseAllocation)) && 
        userBuckets && spouseBuckets && jointBuckets) {
      // Calculate owner-specific base returns
      const baseOwnerReturns = calculateOwnerSpecificReturns(
        userBuckets.totalAssets,
        spouseBuckets.totalAssets,
        jointBuckets.totalAssets,
        params.userAllocation,
        params.spouseAllocation,
        params.inflationRate
      );
      
      // Apply owner-specific returns to each bucket
      userBuckets.taxDeferred *= (1 + baseOwnerReturns.userReturn);
      userBuckets.taxFree *= (1 + baseOwnerReturns.userReturn);
      userBuckets.capitalGains *= (1 + baseOwnerReturns.userReturn);
      userBuckets.cashEquivalents *= (1 + baseOwnerReturns.userReturn);
      userBuckets.totalAssets = userBuckets.taxDeferred + userBuckets.taxFree + 
                                userBuckets.capitalGains + userBuckets.cashEquivalents;
      
      spouseBuckets.taxDeferred *= (1 + baseOwnerReturns.spouseReturn);
      spouseBuckets.taxFree *= (1 + baseOwnerReturns.spouseReturn);
      spouseBuckets.capitalGains *= (1 + baseOwnerReturns.spouseReturn);
      spouseBuckets.cashEquivalents *= (1 + baseOwnerReturns.spouseReturn);
      spouseBuckets.totalAssets = spouseBuckets.taxDeferred + spouseBuckets.taxFree + 
                                  spouseBuckets.capitalGains + spouseBuckets.cashEquivalents;
      
      jointBuckets.taxDeferred *= (1 + baseOwnerReturns.jointReturn);
      jointBuckets.taxFree *= (1 + baseOwnerReturns.jointReturn);
      jointBuckets.capitalGains *= (1 + baseOwnerReturns.jointReturn);
      jointBuckets.cashEquivalents *= (1 + baseOwnerReturns.jointReturn);
      jointBuckets.totalAssets = jointBuckets.taxDeferred + jointBuckets.taxFree + 
                                 jointBuckets.capitalGains + jointBuckets.cashEquivalents;
      
      // Update combined buckets from owner-specific buckets
      currentBuckets.taxDeferred = userBuckets.taxDeferred + spouseBuckets.taxDeferred + jointBuckets.taxDeferred;
      currentBuckets.taxFree = userBuckets.taxFree + spouseBuckets.taxFree + jointBuckets.taxFree;
      currentBuckets.capitalGains = userBuckets.capitalGains + spouseBuckets.capitalGains + jointBuckets.capitalGains;
      currentBuckets.cashEquivalents = userBuckets.cashEquivalents + spouseBuckets.cashEquivalents + jointBuckets.cashEquivalents;
      currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                  currentBuckets.capitalGains + currentBuckets.cashEquivalents;
      
      // Use weighted average return for logging
      annualReturn = baseOwnerReturns.weightedAverageReturn;
    } else {
      // Use market regime return directly when owner-specific data not available
      annualReturn = regimeReturn;
      
      // FIXED: Apply investment returns to each bucket FIRST (before withdrawals)
      // IMPORTANT: Returns apply every year, including the first year
      currentBuckets.taxDeferred *= (1 + annualReturn);
      currentBuckets.taxFree *= (1 + annualReturn);
      currentBuckets.capitalGains *= (1 + annualReturn);
      currentBuckets.cashEquivalents *= (1 + annualReturn);
      currentBuckets.totalAssets = currentBuckets.taxDeferred + currentBuckets.taxFree + 
                                  currentBuckets.capitalGains + currentBuckets.cashEquivalents;
    }
    
    // Calculate dynamic guaranteed income for current year
    let annualGuaranteedIncome = 0;
    
    // Social Security (starts at claim age, only if alive)
    if (userAlive && age >= (params.socialSecurityClaimAge || 67)) {
      annualGuaranteedIncome += (params.socialSecurityBenefit || 0) * 12;
    }
    if (spouseAlive && currentSpouseAge && currentSpouseAge >= (params.spouseSocialSecurityClaimAge || 67)) {
      annualGuaranteedIncome += (params.spouseSocialSecurityBenefit || 0) * 12;
    }
    
    // Pensions (start at retirement, only if alive)
    if (userAlive && age >= params.retirementAge) {
      annualGuaranteedIncome += (params.pensionBenefit || 0) * 12;
    }
    if (spouseAlive && currentSpouseAge && currentSpouseAge >= (params.spouseRetirementAge || params.retirementAge)) {
      annualGuaranteedIncome += (params.spousePensionBenefit || 0) * 12;
    }
    
    // Part-time income continues until death (no decay, realistic model)
    if (userAlive && age >= params.retirementAge) {
      annualGuaranteedIncome += (params.partTimeIncomeRetirement || 0) * 12;
    }
    if (spouseAlive && currentSpouseAge && currentSpouseAge >= (params.spouseRetirementAge || params.retirementAge)) {
      annualGuaranteedIncome += (params.spousePartTimeIncomeRetirement || 0) * 12;
    }
    
    // Handle Social Security survivor benefits
    if (!userAlive && spouseAlive) {
      // Spouse can get survivor benefit if user would have been eligible
      if (age >= (params.socialSecurityClaimAge || 67)) {
        const deceasedBenefit = (params.socialSecurityBenefit || 0) * 12;
        const ownBenefit = currentSpouseAge && currentSpouseAge >= (params.spouseSocialSecurityClaimAge || 67) ? 
          (params.spouseSocialSecurityBenefit || 0) * 12 : 0;
        // Survivor gets the higher of their own benefit or deceased's benefit
        annualGuaranteedIncome += Math.max(deceasedBenefit - ownBenefit, 0);
      }
    } else if (userAlive && !spouseAlive) {
      // User can get survivor benefit if spouse would have been eligible
      if (currentSpouseAge && currentSpouseAge >= (params.spouseSocialSecurityClaimAge || 67)) {
        const deceasedBenefit = (params.spouseSocialSecurityBenefit || 0) * 12;
        const ownBenefit = age >= (params.socialSecurityClaimAge || 67) ? 
          (params.socialSecurityBenefit || 0) * 12 : 0;
        // Survivor gets the higher of their own benefit or deceased's benefit
        annualGuaranteedIncome += Math.max(deceasedBenefit - ownBenefit, 0);
      }
    }
    
    // Annuity income (already calculated in initialGuaranteedIncome)
    // Extract just the annuity portion from the initial calculation
    const annuityPortion = initialGuaranteedIncome - 
      ((params.socialSecurityBenefit || 0) + (params.spouseSocialSecurityBenefit || 0) +
       (params.pensionBenefit || 0) + (params.spousePensionBenefit || 0) +
       (params.partTimeIncomeRetirement || 0) + (params.spousePartTimeIncomeRetirement || 0)) * 12;
    annualGuaranteedIncome += annuityPortion;
    
    // REAL DOLLAR MODEL: No inflation adjustments - all expenses remain constant in today's purchasing power
    // Healthcare costs, essential expenses, and discretionary expenses all stay constant
    // This is consistent with the real dollar model where returns are already inflation-adjusted
    
    // Dynamic withdrawal adjustments based on market conditions
    let spendingAdjustmentFactor = 1.0;
    
    if (enableDynamic && distYear > 0) {
      // Check portfolio health and market conditions
      const currentFundingRatio = portfolioBalance / (previousPortfolioValue || currentBuckets.totalAssets);
      const yearsRemaining = Math.max(90 - (retirementAge + distYear), 10);
      const sustainableWithdrawalRate = yearsRemaining > 0 ? 1 / yearsRemaining : 0.04;
      const currentWithdrawalRate = (currentEssentialExpenses + currentDiscretionaryExpenses + currentHealthcareCosts) / portfolioBalance;
      
      // Bear-only mode: only adjust during bear/crisis regimes (20%+ drawdowns)
      const bearOnly = params.bearOnlyDynamicWithdrawals === true;
      const isBearOrCrisis = currentMarketRegime === 'bear' || currentMarketRegime === 'crisis';
      
      // Adjust discretionary spending based on market regime and portfolio performance
      if (currentMarketRegime === 'crisis') {
        // Crisis: Cut discretionary by 50%
        spendingAdjustmentFactor = 0.5;
      } else if (currentMarketRegime === 'bear') {
        // Bear market: Cut discretionary by 30%
        spendingAdjustmentFactor = 0.7;
      } else if (!bearOnly && currentFundingRatio < 0.85 && currentWithdrawalRate > sustainableWithdrawalRate * 1.2) {
        // Portfolio down >15% and withdrawal rate unsustainable: Cut by 40% (only if not bear-only mode)
        spendingAdjustmentFactor = 0.6;
      } else if (!bearOnly && currentFundingRatio < 0.95) {
        // Portfolio down 5-15%: Cut by 20% (only if not bear-only mode)
        spendingAdjustmentFactor = 0.8;
      } else if (!bearOnly && currentMarketRegime === 'bull' && currentFundingRatio > 1.15) {
        // Bull market and portfolio up >15%: Allow 10% increase (only if not bear-only mode)
        spendingAdjustmentFactor = 1.1;
      }
    }
    
    // Apply adjustment only to discretionary expenses
    const adjustedDiscretionaryExpenses = currentDiscretionaryExpenses * spendingAdjustmentFactor;
    currentNonHealthcareCosts = currentEssentialExpenses + adjustedDiscretionaryExpenses;
    
    // Update total withdrawal need
    currentWithdrawal = currentNonHealthcareCosts + currentHealthcareCosts;
    
    // Calculate net withdrawal needed (expenses minus guaranteed income)
    // Use the inflation-adjusted withdrawal amount instead of recalculating expenses
    const netExpensesNeeded = Math.max(0, currentWithdrawal - annualGuaranteedIncome);
    
    // Calculate tax-efficient withdrawal strategy
    // Determine filing status for capital gains tax calculation
    const filingStatus = (params.filingStatus as any) || ((params.spouseAge !== undefined) ? 'married' : 'single');
    
    // Calculate proper capital gains tax rate based on income
    // Need to estimate total taxable income for capital gains bracket determination
    const estimatedOrdinaryIncome = annualGuaranteedIncome; // Conservative estimate
    const estimatedCapitalGains = netExpensesNeeded * 0.5 * 0.5; // Rough estimate: 50% from brokerage, 50% of that is gains
    const totalEstimatedIncome = estimatedOrdinaryIncome + estimatedCapitalGains;
    
    // Import calculateCapitalGainsTax function

    
    // Calculate actual capital gains tax
    const cgFS = filingStatus === 'married' ? 'married' : 'single';
    const capitalGainsTax = calculateCapitalGainsTax(
      estimatedCapitalGains,
      totalEstimatedIncome,
      cgFS
    );
    
    // Calculate effective capital gains rate
    const effectiveCapitalGainsRate = estimatedCapitalGains > 0 ? 
      capitalGainsTax / estimatedCapitalGains : 0;
    
    const withdrawalStrategy = calculateTaxEfficientWithdrawal(
      netExpensesNeeded,
      currentBuckets,
      taxRate,
      age,
      effectiveCapitalGainsRate // Use calculated rate instead of hard-coded 15%
    );
    
    // Apply guardrails if enabled - MUST BE BEFORE withdrawal calculation
    let adjustedNetExpenses = netExpensesNeeded;
    if (useGuardrails && distYear > 0 && previousPortfolioValue > 0) {
      // Compare to PREVIOUS year's portfolio value for proper guardrails
      const portfolioChangeRatio = portfolioBalance / previousPortfolioValue;
      
      // Apply graduated adjustments to avoid cliff effects
      if (portfolioChangeRatio < 0.85) { 
        // Portfolio down >15%: Reduce spending by 10-15% based on severity
        const reductionFactor = Math.max(0.85, Math.min(0.90, portfolioChangeRatio));
        adjustedNetExpenses = netExpensesNeeded * reductionFactor;
      } else if (portfolioChangeRatio < 0.95) { 
        // Portfolio down 5-15%: Reduce spending by 2-5%
        const reductionFactor = 0.95 + (portfolioChangeRatio - 0.85) * 0.5;
        adjustedNetExpenses = netExpensesNeeded * reductionFactor;
      } else if (portfolioChangeRatio > 1.15) { 
        // Portfolio up >15%: Can increase spending by 5-10%
        const increaseFactor = Math.min(1.10, 1.05 + (portfolioChangeRatio - 1.15) * 0.1);
        adjustedNetExpenses = netExpensesNeeded * increaseFactor;
      }
    }
    
    // FIXED: Recalculate withdrawal strategy with adjusted amount if guardrails were applied
    const finalWithdrawalStrategy = (adjustedNetExpenses !== netExpensesNeeded) ?
      calculateTaxEfficientWithdrawal(
        adjustedNetExpenses,
        currentBuckets,
        taxRate,
        age,
        effectiveCapitalGainsRate
      ) : withdrawalStrategy;
    
    // Use the calculated gross withdrawal (includes taxes)
    const withdrawal = finalWithdrawalStrategy.totalGrossWithdrawal;
    
    // FIXED: Update bucket balances based on actual withdrawals
    currentBuckets = finalWithdrawalStrategy.updatedBuckets;
    
    // Update owner-specific buckets proportionally if available
    if (userBuckets && spouseBuckets && jointBuckets) {
      const totalBeforeWithdrawal = currentBuckets.totalAssets + finalWithdrawalStrategy.totalGrossWithdrawal;
      if (totalBeforeWithdrawal > 0) {
        // Calculate proportional withdrawal from each owner's assets
        const userProportion = userBuckets.totalAssets / totalBeforeWithdrawal;
        const spouseProportion = spouseBuckets.totalAssets / totalBeforeWithdrawal;
        const jointProportion = jointBuckets.totalAssets / totalBeforeWithdrawal;
        
        // Apply proportional withdrawals
        const userWithdrawal = finalWithdrawalStrategy.totalGrossWithdrawal * userProportion;
        const spouseWithdrawal = finalWithdrawalStrategy.totalGrossWithdrawal * spouseProportion;
        const jointWithdrawal = finalWithdrawalStrategy.totalGrossWithdrawal * jointProportion;
        
        // Update owner-specific bucket totals
        userBuckets.totalAssets = Math.max(0, userBuckets.totalAssets - userWithdrawal);
        spouseBuckets.totalAssets = Math.max(0, spouseBuckets.totalAssets - spouseWithdrawal);
        jointBuckets.totalAssets = Math.max(0, jointBuckets.totalAssets - jointWithdrawal);
        
        // Redistribute bucket components proportionally
        if (userBuckets.totalAssets > 0) {
          const ratio = (userBuckets.totalAssets + userWithdrawal) > 0 ? 
            userBuckets.totalAssets / (userBuckets.totalAssets + userWithdrawal) : 0;
          userBuckets.taxDeferred *= ratio;
          userBuckets.taxFree *= ratio;
          userBuckets.capitalGains *= ratio;
          userBuckets.cashEquivalents *= ratio;
        } else {
          userBuckets.taxDeferred = 0;
          userBuckets.taxFree = 0;
          userBuckets.capitalGains = 0;
          userBuckets.cashEquivalents = 0;
        }
        
        if (spouseBuckets.totalAssets > 0) {
          const ratio = (spouseBuckets.totalAssets + spouseWithdrawal) > 0 ?
            spouseBuckets.totalAssets / (spouseBuckets.totalAssets + spouseWithdrawal) : 0;
          spouseBuckets.taxDeferred *= ratio;
          spouseBuckets.taxFree *= ratio;
          spouseBuckets.capitalGains *= ratio;
          spouseBuckets.cashEquivalents *= ratio;
        } else {
          spouseBuckets.taxDeferred = 0;
          spouseBuckets.taxFree = 0;
          spouseBuckets.capitalGains = 0;
          spouseBuckets.cashEquivalents = 0;
        }
        
        if (jointBuckets.totalAssets > 0) {
          const ratio = (jointBuckets.totalAssets + jointWithdrawal) > 0 ?
            jointBuckets.totalAssets / (jointBuckets.totalAssets + jointWithdrawal) : 0;
          jointBuckets.taxDeferred *= ratio;
          jointBuckets.taxFree *= ratio;
          jointBuckets.capitalGains *= ratio;
          jointBuckets.cashEquivalents *= ratio;
        } else {
          jointBuckets.taxDeferred = 0;
          jointBuckets.taxFree = 0;
          jointBuckets.capitalGains = 0;
          jointBuckets.cashEquivalents = 0;
        }
      }
    }
    
    // Debug logging for first year
    if (debugFirstYear) {
      // Temporarily commented out to avoid EPIPE error
      debugFirstYear = false;
    }
    
    // Track previous portfolio value BEFORE updating for next year
    previousYearPortfolioValue = previousPortfolioValue;
    previousPortfolioValue = portfolioBalance;
    
    // FIXED: Portfolio balance is now the sum of all buckets after withdrawals
    portfolioBalance = currentBuckets.totalAssets;
    
    // Record cash flow for this year
    yearlyCashFlows.push({
      year: year + 1,
      age: age + 1,
      portfolioBalance: Math.max(0, portfolioBalance),
      guaranteedIncome: annualGuaranteedIncome,
      withdrawal,
      netCashFlow: annualGuaranteedIncome - withdrawal,
      marketRegime: currentMarketRegime
    });
    
    // Check for portfolio depletion
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
        { currentAge: age, healthStatus },
        { currentAge: currentSpouseAge || 0, healthStatus: spouseHealthStatus }
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
        // Note: Guaranteed income will be recalculated next iteration based on who is alive
      }
    } else {
      // Single person simulation
      const healthStatus = params.userHealthStatus || 'good';
      userAlive = simulateSurvival({ 
        currentAge: age, 
        healthStatus
      });
      
      if (!userAlive) {
        // Set expenses to zero but continue simulation to test portfolio longevity
        currentNonHealthcareCosts = 0;
        currentHealthcareCosts = 0;
      }
    }
    
    // Update previous portfolio value for next iteration's dynamic adjustments
    previousPortfolioValue = currentBuckets.totalAssets;
    
    age++;
    distYear++;
    year++;
  }
  
  // Success means the portfolio lasted throughout retirement without depletion
  // Legacy goal is tracked separately but shouldn't determine overall success
  // A retiree who doesn't run out of money is successful, even if they don't meet their legacy goal
  const success = yearsUntilDepletion === null;
  
  return {
    success,
    endingBalance: Math.max(0, portfolioBalance),
    yearsUntilDepletion,
    yearlyCashFlows
  };
}

// Helper function to allocate contributions to owner-specific buckets
function allocateContributionsToOwnerBuckets(
  params: RetirementMonteCarloParams,
  dynamicAnnualSavings: number,
  currentYearAge: number,
  accumYear: number,
  userBuckets?: AssetBuckets,
  spouseBuckets?: AssetBuckets,
  jointBuckets?: AssetBuckets
): {
  updatedUserBuckets?: AssetBuckets;
  updatedSpouseBuckets?: AssetBuckets;
  updatedJointBuckets?: AssetBuckets;
  updatedCombinedBuckets: AssetBuckets;
} {
  // Initialize combined buckets
  let combinedBuckets: AssetBuckets = {
    taxDeferred: 0,
    taxFree: 0,
    capitalGains: 0,
    cashEquivalents: 0,
    totalAssets: 0
  };

  // Use actual contribution allocations from user profile if available
  const annual401k = (params.monthlyContribution401k || 0) * 12;
  const annualIRA = (params.monthlyContributionIRA || 0) * 12;
  const annualRoth = (params.monthlyContributionRothIRA || 0) * 12;
  const annualBrokerage = (params.monthlyContributionBrokerage || 0) * 12;
  const totalSpecifiedContributions = annual401k + annualIRA + annualRoth + annualBrokerage;
  
  let taxDeferredContribution = 0;
  let taxFreeContribution = 0;
  let capitalGainsContribution = 0;
  
  if (totalSpecifiedContributions > 0 && dynamicAnnualSavings > 0) {
    // Scale the contributions proportionally based on dynamicAnnualSavings
    const scaleFactor = dynamicAnnualSavings / totalSpecifiedContributions;
    
    taxDeferredContribution = (annual401k + annualIRA) * scaleFactor;
    taxFreeContribution = annualRoth * scaleFactor;
    capitalGainsContribution = annualBrokerage * scaleFactor;
  } else {
    // Fallback to default allocation if no specific contributions are provided
    taxDeferredContribution = dynamicAnnualSavings * 0.70;
    taxFreeContribution = dynamicAnnualSavings * 0.20;
    capitalGainsContribution = dynamicAnnualSavings * 0.10;
  }
  
  // Distribute to owner-specific buckets if available
  if (userBuckets && spouseBuckets && params.userAnnualSavings !== undefined && params.spouseAnnualSavings !== undefined) {
    // Determine who is contributing based on retirement status
    const userIsRetired = currentYearAge >= params.retirementAge;
    const spouseCurrentAge = params.spouseAge ? params.spouseAge + accumYear : undefined;
    const spouseIsRetired = spouseCurrentAge && params.spouseRetirementAge ? 
      spouseCurrentAge >= params.spouseRetirementAge : false;
    
    const updatedUserBuckets = { ...userBuckets };
    const updatedSpouseBuckets = { ...spouseBuckets };
    const updatedJointBuckets = jointBuckets ? { ...jointBuckets } : undefined;
    
    if (!userIsRetired && !spouseIsRetired && params.userAnnualSavings > 0 && params.spouseAnnualSavings > 0) {
      // Both working - split contributions proportionally
      const userRatio = params.userAnnualSavings / (params.userAnnualSavings + params.spouseAnnualSavings);
      const spouseRatio = 1 - userRatio;
      
      updatedUserBuckets.taxDeferred += taxDeferredContribution * userRatio;
      updatedUserBuckets.taxFree += taxFreeContribution * userRatio;
      updatedUserBuckets.capitalGains += capitalGainsContribution * userRatio;
      updatedUserBuckets.totalAssets = updatedUserBuckets.taxDeferred + updatedUserBuckets.taxFree + 
                                       updatedUserBuckets.capitalGains + updatedUserBuckets.cashEquivalents;
      
      updatedSpouseBuckets.taxDeferred += taxDeferredContribution * spouseRatio;
      updatedSpouseBuckets.taxFree += taxFreeContribution * spouseRatio;
      updatedSpouseBuckets.capitalGains += capitalGainsContribution * spouseRatio;
      updatedSpouseBuckets.totalAssets = updatedSpouseBuckets.taxDeferred + updatedSpouseBuckets.taxFree + 
                                         updatedSpouseBuckets.capitalGains + updatedSpouseBuckets.cashEquivalents;
    } else if (!userIsRetired) {
      // Only user working
      updatedUserBuckets.taxDeferred += taxDeferredContribution;
      updatedUserBuckets.taxFree += taxFreeContribution;
      updatedUserBuckets.capitalGains += capitalGainsContribution;
      updatedUserBuckets.totalAssets = updatedUserBuckets.taxDeferred + updatedUserBuckets.taxFree + 
                                       updatedUserBuckets.capitalGains + updatedUserBuckets.cashEquivalents;
    } else if (!spouseIsRetired) {
      // Only spouse working
      updatedSpouseBuckets.taxDeferred += taxDeferredContribution;
      updatedSpouseBuckets.taxFree += taxFreeContribution;
      updatedSpouseBuckets.capitalGains += capitalGainsContribution;
      updatedSpouseBuckets.totalAssets = updatedSpouseBuckets.taxDeferred + updatedSpouseBuckets.taxFree + 
                                         updatedSpouseBuckets.capitalGains + updatedSpouseBuckets.cashEquivalents;
    }
    
    // Update combined buckets
    combinedBuckets.taxDeferred = updatedUserBuckets.taxDeferred + updatedSpouseBuckets.taxDeferred + 
                                  (updatedJointBuckets?.taxDeferred || 0);
    combinedBuckets.taxFree = updatedUserBuckets.taxFree + updatedSpouseBuckets.taxFree + 
                              (updatedJointBuckets?.taxFree || 0);
    combinedBuckets.capitalGains = updatedUserBuckets.capitalGains + updatedSpouseBuckets.capitalGains + 
                                   (updatedJointBuckets?.capitalGains || 0);
    combinedBuckets.cashEquivalents = updatedUserBuckets.cashEquivalents + updatedSpouseBuckets.cashEquivalents + 
                                      (updatedJointBuckets?.cashEquivalents || 0);
    combinedBuckets.totalAssets = combinedBuckets.taxDeferred + combinedBuckets.taxFree + 
                                  combinedBuckets.capitalGains + combinedBuckets.cashEquivalents;
    
    return {
      updatedUserBuckets,
      updatedSpouseBuckets,
      updatedJointBuckets,
      updatedCombinedBuckets: combinedBuckets
    };
  }
  
  // Fallback: return combined buckets only
  combinedBuckets.taxDeferred = (params.assetBuckets.taxDeferred || 0) + taxDeferredContribution;
  combinedBuckets.taxFree = (params.assetBuckets.taxFree || 0) + taxFreeContribution;
  combinedBuckets.capitalGains = (params.assetBuckets.capitalGains || 0) + capitalGainsContribution;
  combinedBuckets.cashEquivalents = params.assetBuckets.cashEquivalents || 0;
  combinedBuckets.totalAssets = combinedBuckets.taxDeferred + combinedBuckets.taxFree + 
                                combinedBuckets.capitalGains + combinedBuckets.cashEquivalents;
  
  return {
    updatedCombinedBuckets: combinedBuckets
  };
}

// Main retirement Monte Carlo simulation function
export function runRetirementMonteCarloSimulation(
  params: RetirementMonteCarloParams,
  iterations: number = 1000  // Industry standard for balance between accuracy and performance
): RetirementMonteCarloResult {
  const results: number[] = [];
  const depletionYears: number[] = [];
  let successfulScenarios = 0;
  const allCashFlows: Array<any> = [];

  // Run simulations
  for (let i = 0; i < iterations; i++) {
    const scenarioResult = runRetirementScenario(params);
    results.push(scenarioResult.endingBalance);
    
    if (scenarioResult.success) {
      successfulScenarios++;
    }
    
    if (scenarioResult.yearsUntilDepletion !== null) {
      depletionYears.push(scenarioResult.yearsUntilDepletion);
    }
    
    // Store first scenario's cash flows for visualization
    if (i === 0) {
      allCashFlows.push(...scenarioResult.yearlyCashFlows);
    }
  }

  // Sort results for percentile calculations
  results.sort((a, b) => a - b);
  
  // Calculate statistics
  const probabilityOfSuccess = (successfulScenarios / iterations) * 100;
  
  // Get percentiles
  const getPercentile = (percentile: number): number => {
    const index = Math.floor((percentile / 100) * (iterations - 1));
    return results[index];
  };
  
  // FIXED: Calculate safe withdrawal rate using binary search (following guide algorithm)
  let safeWithdrawalRate = params.withdrawalRate;
  if (probabilityOfSuccess < 80) {
    let low = 0.0; // Start from 0% as per guide
    let high = 0.10; // Upper bound at 10% as per guide
    
    while (high - low > 0.0001) { // 0.01% precision as per guide
      const mid = (low + high) / 2;
      const testParams = { ...params, withdrawalRate: mid };
      
      // FIXED: Use more iterations for better accuracy (guide recommends N=10,000)
      // Use 1000 for binary search testing to balance speed vs accuracy
      let testSuccesses = 0;
      for (let i = 0; i < 1000; i++) {
        const testResult = runRetirementScenario(testParams);
        if (testResult.success) testSuccesses++;
      }
      
      const testProbability = (testSuccesses / 1000) * 100;
      if (testProbability < 80) {
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
    // FIXED: Include initial retirement assets for safe withdrawal dollar calculation
    // IMPORTANT: Safe withdrawal dollar amount = safeWithdrawalRate * projectedRetirementPortfolio
    // NOT safeWithdrawalRate * medianEndingBalance (common error)
    currentRetirementAssets: params.currentRetirementAssets,
    // Calculate projected portfolio value at retirement start (after accumulation phase)
    projectedRetirementPortfolio: calculateProjectedRetirementPortfolio(params),
    yearlyCashFlows: allCashFlows
  };
}

// Helper function to calculate projected portfolio value at retirement start
function calculateProjectedRetirementPortfolio(params: RetirementMonteCarloParams): number {
  const yearsToRetirement = Math.max(0, params.retirementAge - params.currentAge);
  
  if (yearsToRetirement === 0) {
    return params.currentRetirementAssets;
  }
  
  // Calculate expected portfolio growth during accumulation phase
  let projectedValue = params.currentRetirementAssets;
  
  for (let year = 0; year < yearsToRetirement; year++) {
    // Calculate dynamic savings capacity (including debt payoff effects and staggered retirement)
    let dynamicAnnualSavings = params.annualSavings;
    
    const currentYearAge = params.currentAge + year;
    
    // CRITICAL FIX: Handle staggered retirement in projections
    if (params.spouseAge && params.spouseRetirementAge) {
      const spouseCurrentAge = params.spouseAge + year;
      const userIsRetired = currentYearAge >= params.retirementAge;
      const spouseIsRetired = spouseCurrentAge >= params.spouseRetirementAge;
      
      // If both have individual savings data, calculate based on who's still working
      if (params.userAnnualSavings !== undefined && params.spouseAnnualSavings !== undefined) {
        dynamicAnnualSavings = 0;
        if (!userIsRetired) {
          dynamicAnnualSavings += params.userAnnualSavings;
        }
        if (!spouseIsRetired) {
          dynamicAnnualSavings += params.spouseAnnualSavings;
        }
      } else {
        // Fallback: proportional reduction based on income
        if (userIsRetired && !spouseIsRetired && params.spouseAnnualIncome && params.userAnnualIncome) {
          // Only spouse is working
          const totalIncome = params.userAnnualIncome + params.spouseAnnualIncome;
          dynamicAnnualSavings = params.annualSavings * (params.spouseAnnualIncome / totalIncome);
        } else if (!userIsRetired && spouseIsRetired && params.spouseAnnualIncome && params.userAnnualIncome) {
          // Only user is working
          const totalIncome = params.userAnnualIncome + params.spouseAnnualIncome;
          dynamicAnnualSavings = params.annualSavings * (params.userAnnualIncome / totalIncome);
        } else if (userIsRetired && spouseIsRetired) {
          // Both retired - no more savings
          dynamicAnnualSavings = 0;
        }
      }
    } else {
      // Single person scenario
      if (currentYearAge >= params.retirementAge) {
        dynamicAnnualSavings = 0;
      }
    }
    
    const yearsFromRetirement = yearsToRetirement - year;
    
    // Account for increased savings capacity as debts are paid off
    if (yearsFromRetirement <= 15 && yearsFromRetirement >= 1 && dynamicAnnualSavings > 0) {
      const potentialDebtPayoffBonus = dynamicAnnualSavings * 0.15; // 15% boost assumption
      const rampUpFactor = Math.min(1, (16 - yearsFromRetirement) / 10); // Gradual increase
      dynamicAnnualSavings += potentialDebtPayoffBonus * rampUpFactor;
    }
    
    // Add dynamic annual savings
    projectedValue += dynamicAnnualSavings;
    
    // Apply expected return based on strategy
    let expectedReturn: number;
    
    if (params.useGlidePath) {
      // Use glide path return for the current year
      const yearsUntilRetirement = yearsToRetirement - year;
      expectedReturn = getGlidePathReturn(yearsUntilRetirement);
    } else {
      // Use fixed expected return
      expectedReturn = params.expectedReturn;
    }
    
    projectedValue *= (1 + expectedReturn);
  }
  
  return Math.round(projectedValue);
}

// Helper function to calculate debt payoff impact on savings capacity
function calculateDebtPayoffSavingsIncrease(profileData: any, currentAge: number, targetYear: number): number {
  const liabilities = profileData.liabilities || [];
  const primaryMortgage = profileData.primaryResidence?.monthlyPayment || 0;
  
  let additionalSavings = 0;
  
  // Calculate when major debts will be paid off and add their payments to savings capacity
  liabilities.forEach((debt: any) => {
    const monthlyPayment = Number(debt.monthlyPayment) || 0;
    const balance = Number(debt.balance) || 0;
    const interestRate = Number(debt.interestRate) || 0;
    
    if (monthlyPayment > 0 && balance > 0) {
      // Simple debt payoff calculation (assumes fixed payments)
      const monthsToPayoff = Math.ceil(
        Math.log(1 + (balance * (interestRate / 1200)) / monthlyPayment) / 
        Math.log(1 + (interestRate / 1200))
      );
      
      const yearsToPayoff = monthsToPayoff / 12;
      
      // If debt is paid off before the target year, add the payment to savings capacity
      if (yearsToPayoff <= (targetYear - currentAge)) {
        additionalSavings += monthlyPayment * 12;
      }
    }
  });
  
  // Add primary mortgage payment if it will be paid off
  if (primaryMortgage > 0 && profileData.primaryResidence?.mortgageBalance) {
    const mortgageBalance = Number(profileData.primaryResidence.mortgageBalance);
    const mortgageRate = Number(profileData.primaryResidence.interestRate) || 0;
    
    if (mortgageBalance > 0 && mortgageRate > 0) {
      const monthsToPayoff = Math.ceil(
        Math.log(1 + (mortgageBalance * (mortgageRate / 1200)) / primaryMortgage) / 
        Math.log(1 + (mortgageRate / 1200))
      );
      
      const yearsToPayoff = monthsToPayoff / 12;
      
      if (yearsToPayoff <= (targetYear - currentAge)) {
        additionalSavings += primaryMortgage * 12;
      }
    }
  }
  
  return additionalSavings;
}

// Convert profile data to retirement Monte Carlo parameters
// Regional LTC cost calculator (same as in monte-carlo-enhanced.ts)
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
    'MD': 1.1,   // Maryland - above average
    'National': 1.0
  };
  
  // 2024 national average for comprehensive LTC care (realistic baseline)
  const nationalBaseCost = 75000; // $75K annual average - more realistic weighted average
  return nationalBaseCost * (stateCostMultipliers[state] || 1.0);
}

export function profileToRetirementParams(profileData: any): RetirementMonteCarloParams {
  // Add null safety check
  if (!profileData) {
    console.error('ERROR: profileData is null or undefined in profileToRetirementParams');
    throw new Error('Profile data is required for retirement calculations');
  }
  
  // Calculate ages
  const currentAge = profileData.dateOfBirth 
    ? new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear()
    : 35;
    
  const spouseAge = profileData.spouseDateOfBirth 
    ? new Date().getFullYear() - new Date(profileData.spouseDateOfBirth).getFullYear()
    : undefined;
  
  const isMarriedOrPartnered = profileData.maritalStatus === 'married' || profileData.maritalStatus === 'partnered';
  
  // Get retirement ages early for calculations
  const retirementAge = Number(profileData.desiredRetirementAge) || 65;
  const spouseDesiredRetirementAge = Number(profileData.spouseDesiredRetirementAge);
  
  // Use longer life expectancy for married couples
  let lifeExpectancy = Number(profileData.userLifeExpectancy) || 90;
  let spouseLifeExpectancy = undefined;
  
  if (isMarriedOrPartnered && profileData.spouseLifeExpectancy) {
    spouseLifeExpectancy = Number(profileData.spouseLifeExpectancy) || 90;
    lifeExpectancy = Math.max(lifeExpectancy, spouseLifeExpectancy);
  }
  
  // FIXED: Calculate ALL liquid assets available for retirement (CFP-compliant approach)
  const allAssets = profileData.assets || [];
  const annuityTypes = ['qualified-annuities', 'non-qualified-annuities', 'roth-annuities'];
  
  // Define asset types that should be included in retirement calculations (CFP best practices)
  const retirementEligibleAssets = [
    // Traditional retirement accounts
    '401k', '403b', 'traditional-ira', 'roth-ira', 'other-tax-deferred',
    '401(k)', '403(b)', 'Traditional IRA', 'Roth IRA', // Plaid format variants
    // Health Savings Account (triple tax-advantaged after age 65)
    'hsa', 'HSA',
    // Liquid investment assets
    'taxable-brokerage', 'brokerage', 'Brokerage Account',
    // Savings accounts (at US average savings rate ~0.5%)
    'savings', 'Savings Account', 'Saving Account',
    // Money Market and CDs
    'money-market', 'Money Market', 'CD', 'Other',
    // EXCLUDED: checking accounts (not appropriate for retirement projections)
    // Cash value life insurance (modeled at ~3% annual return)
    'cash-value-life-insurance',
    // Other liquid assets that could be used for retirement
    'other'
  ];
  
  // Asset types that should NOT be included (illiquid or non-financial assets)
  const excludedAssetTypes = [
    'vehicle',           // Cars depreciate and are transportation needs, not retirement assets
    'business',          // Business interests are complex and may not be liquidatable
    // Annuities are handled separately for guaranteed income calculation
    'qualified-annuities', 'non-qualified-annuities', 'roth-annuities'
  ];
  
  // Track included and excluded assets for debugging
  const includedAssets: any[] = [];
  const excludedAssets: any[] = [];
  
  let retirementAssets = allAssets
    .filter((asset: any) => {
      const owner = (asset.owner || 'user').toLowerCase();
      const value = Number(asset.value) || 0;
      
      // Temporary debug log for stress test issue
      if (value === 35000) {
        console.log('    value: 35000,');
      }
      
      // Skip zero-value assets
      if (value <= 0) return false;
      
      // Check ownership - include user/joint for single, all for married/partnered
      const validOwnership = isMarriedOrPartnered || 
                            owner === 'user' || 
                            owner === 'joint' || 
                            owner.toLowerCase() === 'user';
      
      // Check if asset type is retirement-eligible
      const isEligibleType = retirementEligibleAssets.includes(asset.type);
      
      const shouldInclude = validOwnership && isEligibleType;
      
      if (shouldInclude) {
        includedAssets.push({ type: asset.type, value, owner, description: asset.description });
      } else {
        excludedAssets.push({ type: asset.type, value, owner, description: asset.description, reason: !validOwnership ? 'ownership' : 'asset-type' });
      }
      
      return shouldInclude;
    })
    .reduce((sum: number, asset: any) => sum + (Number(asset.value) || 0), 0);
  
  // Extract annuity information for guaranteed income calculation
  const annuities = allAssets.filter((asset: any) => annuityTypes.includes(asset.type));
  
  // Calculate guaranteed income from annuities and track deferred annuity assets
  let annuityIncome = 0;
  let deferredAnnuityAssets = 0;
  
  annuities.forEach((annuity: any) => {
    // Only include if owned by user or joint (or all if married/partnered)
    const owner = (annuity.owner || 'user').toLowerCase();
    if (isMarriedOrPartnered || owner === 'user' || owner === 'joint') {
      if (annuity.annuityType === 'immediate' || 
          (annuity.annuityType === 'deferred' && annuity.payoutStartDate)) {
        // Check if payout has started
        const payoutStartDate = annuity.payoutStartDate ? new Date(annuity.payoutStartDate) : null;
        const hasStartedPayout = !payoutStartDate || payoutStartDate <= new Date();
        
        if (hasStartedPayout && annuity.payoutAmount) {
          const payoutAmount = Number(annuity.payoutAmount) || 0;
          const frequency = annuity.payoutFrequency || 'monthly';
          
          // Convert to monthly amount
          let monthlyAmount = payoutAmount;
          if (frequency === 'quarterly') monthlyAmount = payoutAmount / 3;
          if (frequency === 'annually') monthlyAmount = payoutAmount / 12;
          
          annuityIncome += monthlyAmount;
        } else if (annuity.annuityType === 'deferred' && !hasStartedPayout) {
          // Deferred annuity not yet paying out - count as asset
          deferredAnnuityAssets += Number(annuity.value) || 0;
        }
      }
    }
  });

  // Add deferred annuity assets to retirement assets
  retirementAssets += deferredAnnuityAssets;

  // Calculate annual guaranteed income (includes SS, pensions, annuities, part-time work)
  const userSocialSecurity = Number(profileData.socialSecurityBenefit) || 0;
  const userPension = Number(profileData.pensionBenefit) || 0;
  const userPartTime = Number(profileData.partTimeIncomeRetirement) || 0;
  
  let spouseSocialSecurity = 0;
  let spousePension = 0;
  let spousePartTime = 0;
  
  if (isMarriedOrPartnered) {
    spouseSocialSecurity = Number(profileData.spouseSocialSecurityBenefit) || 0;
    spousePension = Number(profileData.spousePensionBenefit) || 0;
    spousePartTime = Number(profileData.spousePartTimeIncomeRetirement) || 0;
  }
  
  // Include annuity income in guaranteed income
  console.log('Guaranteed Income Calculation:');
  console.log('  User SS:', userSocialSecurity, 'Pension:', userPension, 'Part-time:', userPartTime);
  console.log('  Spouse SS:', spouseSocialSecurity, 'Pension:', spousePension, 'Part-time:', spousePartTime);
  console.log('  Annuity Income:', annuityIncome);
  const totalMonthlyGuaranteed = userSocialSecurity + userPension + userPartTime + 
                                spouseSocialSecurity + spousePension + spousePartTime + annuityIncome;
  const annualGuaranteedIncome = totalMonthlyGuaranteed * 12;
  
  // Calculate guaranteed income WITHOUT part-time work for tax rate estimation
  // Part-time income ends at 75, so we shouldn't lock in a high tax rate based on temporary income
  const permanentMonthlyGuaranteed = userSocialSecurity + userPension + 
                                    spouseSocialSecurity + spousePension + annuityIncome;
  const permanentAnnualGuaranteedIncome = permanentMonthlyGuaranteed * 12;
  console.log('  Total Monthly:', totalMonthlyGuaranteed, 'Annual:', annualGuaranteedIncome);
  console.log('  Permanent Monthly (no part-time):', permanentMonthlyGuaranteed, 'Annual:', permanentAnnualGuaranteedIncome);
  
  // Get risk profiles from intake form
  const userRiskScore = profileData.riskQuestions?.[0] || 3; // Default to moderate
  const spouseRiskScore = profileData.spouseRiskQuestions?.[0] || userRiskScore; // Default to user's risk if not specified
  
  // Calculate asset allocation based on risk profiles
  const userAllocation = getRiskProfileAllocation(userRiskScore);
  const spouseAssetAllocation = getRiskProfileAllocation(spouseRiskScore);
  
  // Group assets by owner and calculate total values
  let userAssetTotal = 0;
  let spouseAssetTotal = 0;
  let jointAssetTotal = 0;
  
  // Also categorize assets by owner and tax type
  const userAssets: any[] = [];
  const spouseAssets: any[] = [];
  const jointAssets: any[] = [];
  
  includedAssets.forEach((asset: any) => {
    const value = Number(asset.value) || 0;
    const owner = (asset.owner || 'user').toLowerCase();
    
    if (owner === 'spouse') {
      spouseAssetTotal += value;
      spouseAssets.push(asset);
    } else if (owner === 'joint') {
      jointAssetTotal += value;
      jointAssets.push(asset);
    } else {
      userAssetTotal += value;
      userAssets.push(asset);
    }
  });
  
  console.log('\n=== OWNERSHIP-BASED ALLOCATION ===');
  console.log('User assets:', userAssetTotal.toLocaleString(), 'with allocation:', userAllocation);
  console.log('Spouse assets:', spouseAssetTotal.toLocaleString(), 'with allocation:', spouseAssetAllocation);
  console.log('Joint assets:', jointAssetTotal.toLocaleString());
  
  // Calculate owner-specific asset buckets for improved returns calculation
  const userAssetBuckets = categorizeAssetsByTax(userAssets);
  const spouseAssetBuckets = categorizeAssetsByTax(spouseAssets);
  const jointAssetBuckets = categorizeAssetsByTax(jointAssets);
  
  console.log('\n=== OWNER-SPECIFIC ASSET BUCKETS ===');
  console.log('User Asset Buckets:', {
    taxDeferred: userAssetBuckets.taxDeferred.toFixed(0),
    taxFree: userAssetBuckets.taxFree.toFixed(0),
    capitalGains: userAssetBuckets.capitalGains.toFixed(0),
    cash: userAssetBuckets.cashEquivalents.toFixed(0),
    total: userAssetBuckets.totalAssets.toFixed(0)
  });
  console.log('Spouse Asset Buckets:', {
    taxDeferred: spouseAssetBuckets.taxDeferred.toFixed(0),
    taxFree: spouseAssetBuckets.taxFree.toFixed(0),
    capitalGains: spouseAssetBuckets.capitalGains.toFixed(0),
    cash: spouseAssetBuckets.cashEquivalents.toFixed(0),
    total: spouseAssetBuckets.totalAssets.toFixed(0)
  });
  console.log('Joint Asset Buckets:', {
    taxDeferred: jointAssetBuckets.taxDeferred.toFixed(0),
    taxFree: jointAssetBuckets.taxFree.toFixed(0),
    capitalGains: jointAssetBuckets.capitalGains.toFixed(0),
    cash: jointAssetBuckets.cashEquivalents.toFixed(0),
    total: jointAssetBuckets.totalAssets.toFixed(0)
  });
  
  // Calculate weighted allocation (for backward compatibility)
  const totalAssets = userAssetTotal + spouseAssetTotal + jointAssetTotal;
  
  // For joint assets, use weighted average based on individual contributions or 50/50
  const jointAllocationWeight = isMarriedOrPartnered ? 0.5 : 1.0;
  
  // Fix: getRiskProfileAllocation returns {stock, bond, cash}, not {usStocks, intlStocks, etc}
  const userStocks = userAllocation.stock || 0;
  const userBonds = userAllocation.bond || 0;
  const userCash = userAllocation.cash || 0;
  
  const spouseStocks = spouseAssetAllocation.stock || 0;
  const spouseBonds = spouseAssetAllocation.bond || 0;
  const spouseCash = spouseAssetAllocation.cash || 0;
  
  // Calculate weighted portfolio allocation
  const stockAllocation = totalAssets > 0 ? (
    (userAssetTotal * userStocks / 100) +
    (spouseAssetTotal * spouseStocks / 100) +
    (jointAssetTotal * ((jointAllocationWeight * userStocks + (1 - jointAllocationWeight) * spouseStocks) / 100))
  ) / totalAssets : 0.6;
  
  const bondAllocation = totalAssets > 0 ? (
    (userAssetTotal * userBonds / 100) +
    (spouseAssetTotal * spouseBonds / 100) +
    (jointAssetTotal * ((jointAllocationWeight * userBonds + (1 - jointAllocationWeight) * spouseBonds) / 100))
  ) / totalAssets : 0.35;
  
  const cashAllocation = totalAssets > 0 ? (
    (userAssetTotal * userCash / 100) +
    (spouseAssetTotal * spouseCash / 100) +
    (jointAssetTotal * ((jointAllocationWeight * userCash + (1 - jointAllocationWeight) * spouseCash) / 100))
  ) / totalAssets : 0.05;
  
  console.log('Weighted Portfolio Allocation (for backward compatibility):');
  console.log('  Stocks:', (stockAllocation * 100).toFixed(1) + '%');
  console.log('  Bonds:', (bondAllocation * 100).toFixed(1) + '%');
  console.log('  Cash:', (cashAllocation * 100).toFixed(1) + '%');
  console.log('  Total:', ((stockAllocation + bondAllocation + cashAllocation) * 100).toFixed(1) + '%');
  
  // Get annual incomes
  const userAnnualIncome = Number(profileData.annualIncome) || 0;
  const spouseAnnualIncome = Number(profileData.spouseAnnualIncome) || 0;
  const totalAnnualIncome = userAnnualIncome + spouseAnnualIncome;
  
  // ENHANCED: Categorize assets by tax treatment for accurate withdrawal modeling
  // Need to calculate this early for tax calculations
  const assetBuckets = categorizeAssetsByTax(allAssets.filter((asset: any) => {
    const owner = (asset.owner || 'user').toLowerCase();
    const value = Number(asset.value) || 0;
    
    // Include assets based on ownership rules
    return value > 0 && (isMarriedOrPartnered || owner === 'user' || owner === 'joint');
  }));
  
  // Calculate tax rate based on retirement state, income, and filing status
  // Use retirement state if specified, otherwise fall back to current state, then default to TX
  const retirementState = profileData.retirementState || profileData.state || 'TX';
  const intakeFS = (profileData.taxFilingStatus || '').toLowerCase();
  const filingStatus: 'single' | 'married' | 'head_of_household' =
    intakeFS === 'head_of_household' ? 'head_of_household' : (isMarriedOrPartnered ? 'married' : 'single');
  
  // More accurate tax calculation considering the taxable portion of withdrawals
  // Use intake form value with conservative default only if truly missing
  const monthlyExpensesValue = Number(profileData.expectedMonthlyExpensesRetirement);
  const baseAnnualRetirementExpenses = (monthlyExpensesValue > 0 ? monthlyExpensesValue : 8000) * 12;
  const portfolioWithdrawalNeeded = Math.max(0, baseAnnualRetirementExpenses - annualGuaranteedIncome);
  
  // Estimate taxable income based on withdrawal sources
  let estimatedTaxableWithdrawals = 0;
  
  if (portfolioWithdrawalNeeded > 0) {
    const { taxDeferred, taxFree, capitalGains, cashEquivalents } = assetBuckets;
    const totalAssets = taxDeferred + taxFree + capitalGains + cashEquivalents;
    
    if (totalAssets > 0) {
      // Rough estimate: cash and half of brokerage withdrawals are not taxable
      const nonTaxableAssets = cashEquivalents + (capitalGains * 0.5); // Assume 50% basis
      
      if (portfolioWithdrawalNeeded > nonTaxableAssets) {
        // Will need to withdraw from tax-deferred accounts
        estimatedTaxableWithdrawals = portfolioWithdrawalNeeded - nonTaxableAssets;
      }
    } else {
      // Conservative: assume all withdrawals are taxable
      estimatedTaxableWithdrawals = portfolioWithdrawalNeeded;
    }
  }
  
  // Taxable income = guaranteed income + taxable withdrawals
  // FIX: Use permanent guaranteed income (without part-time) for tax rate calculation
  // Part-time income ends at 75, so we shouldn't lock in a high tax rate based on temporary income
  const estimatedRetirementIncome = permanentAnnualGuaranteedIncome + estimatedTaxableWithdrawals;
  
  // Use the retirement income for tax calculation
  const baseTaxRate = calculateCombinedTaxRate(
    estimatedRetirementIncome > 0 ? estimatedRetirementIncome : totalAnnualIncome,
    retirementState,
    filingStatus,
    true, // isRetired
    currentAge < 65 ? 65 : currentAge, // Assume at least 65 in retirement
    spouseAge && spouseAge < 65 ? 65 : spouseAge
  );
  
  // CRITICAL: Compute effective blended tax rate based on asset buckets
  // Tax-deferred withdrawals are taxed at ordinary income rates
  // Tax-free (Roth) withdrawals are not taxed
  // Capital gains withdrawals are taxed at lower capital gains rates (assume 15%)
  // Cash withdrawals were already taxed
  const totalAssetValue = assetBuckets.totalAssets || 1;
  const taxDeferredRatio = assetBuckets.taxDeferred / totalAssetValue;
  const taxFreeRatio = assetBuckets.taxFree / totalAssetValue;
  const capitalGainsRatio = assetBuckets.capitalGains / totalAssetValue;
  const cashRatio = assetBuckets.cashEquivalents / totalAssetValue;
  
  // Blended effective tax rate considering withdrawal sequencing
  // Assumes tax-efficient withdrawal: Cash first, then brokerage, then tax-deferred, then Roth
  const effectiveBlendedRate = 
    taxDeferredRatio * baseTaxRate +      // Tax-deferred at full rate
    taxFreeRatio * 0 +                     // Roth at 0%
    capitalGainsRatio * 0.15 +            // Capital gains at 15% (simplified)
    cashRatio * 0;                         // Cash already taxed
    
  // Use the blended rate, clamped to reasonable bounds
  const taxRate = Math.min(0.5, Math.max(0, effectiveBlendedRate));
  
  // Calculate annual savings (FIXED: Use either explicit contributions OR savings rate, not both)
  // First, check for individual monthly contribution fields
  const monthlyContribution401k = Number(profileData.monthlyContribution401k || 0);
  const monthlyContributionIRA = Number(profileData.monthlyContributionIRA || 0);
  const monthlyContributionRothIRA = Number(profileData.monthlyContributionRothIRA || 0);
  const monthlyContributionBrokerage = Number(profileData.monthlyContributionBrokerage || 0);
  const totalMonthlyContributions = monthlyContribution401k + monthlyContributionIRA + 
                                   monthlyContributionRothIRA + monthlyContributionBrokerage;
  const annualContributionsFromMonthly = totalMonthlyContributions * 12;
  
  // Also check for legacy retirementContributions field
  const userContributions = profileData.retirementContributions || { employee: 0, employer: 0 };
  const spouseContributions = isMarriedOrPartnered ? 
    (profileData.spouseRetirementContributions || { employee: 0, employer: 0 }) : 
    { employee: 0, employer: 0 };
  
  const totalEmployeeContributions = (userContributions.employee || 0) + (spouseContributions.employee || 0);
  const totalEmployerContributions = (userContributions.employer || 0) + (spouseContributions.employer || 0);
  const retirementContributions = (totalEmployeeContributions + totalEmployerContributions) * 12;
  
  // Calculate individual annual savings for staggered retirement handling
  const userRetirementContributions = ((userContributions.employee || 0) + (userContributions.employer || 0)) * 12;
  const spouseRetirementContributions = ((spouseContributions.employee || 0) + (spouseContributions.employer || 0)) * 12;
  
  // Add IRA contributions (annual amounts)
  const userTraditionalIRA = Number(profileData.traditionalIRAContribution) || 0;
  const userRothIRA = Number(profileData.rothIRAContribution) || 0;
  const spouseTraditionalIRA = Number(profileData.spouseTraditionalIRAContribution) || 0;
  const spouseRothIRA = Number(profileData.spouseRothIRAContribution) || 0;
  
  const totalUserIRAContributions = userTraditionalIRA + userRothIRA;
  const totalSpouseIRAContributions = spouseTraditionalIRA + spouseRothIRA;
  
  // Calculate savings from savings rate
  const savingsRate = Number(profileData.savingsRate) || 0;
  const savingsRateAmount = totalAnnualIncome * (savingsRate / 100);
  
  // Calculate individual savings from savings rate (proportional to income)
  const userSavingsRateAmount = userAnnualIncome * (savingsRate / 100);
  const spouseSavingsRateAmount = spouseAnnualIncome * (savingsRate / 100);
  
  // Get monthly net cash flow for reference but don't automatically include it all
  const monthlyNetCashFlow = Number(profileData.netWorth?.monthlyNetCashFlow || 0);
  const annualCashFlow = monthlyNetCashFlow * 12;
  
  // Use the actual retirement contributions from the intake form
  // These come from retirementContributions.employee and retirementContributions.employer
  // Plus IRA contributions (Traditional and Roth)
  const totalUserRetirementContributions = userRetirementContributions + totalUserIRAContributions;
  const totalSpouseRetirementContributions = spouseRetirementContributions + totalSpouseIRAContributions;
  
  // Priority for calculating savings:
  // 1. Use actual retirement contributions (from intake form)
  // 2. If no contributions, use savings rate
  // 3. Never automatically assume all cash flow goes to retirement
  
  let annualSavings = 0;
  
  // Include IRA contributions in total retirement contributions
  const totalRetirementWithIRA = retirementContributions + totalUserIRAContributions + totalSpouseIRAContributions;
  
  if (totalRetirementWithIRA > 0) {
    // Use actual retirement contributions from the form (including IRAs)
    annualSavings = totalRetirementWithIRA;
  } else if (savingsRateAmount > 0) {
    // Fall back to savings rate if specified
    annualSavings = savingsRateAmount;
  } else if (annualCashFlow > 0) {
    // As a last resort, use a conservative portion of cash flow (30%)
    // This accounts for other expenses and goals
    annualSavings = annualCashFlow * 0.30;
    console.log('No explicit retirement contributions; using 30% of cash flow surplus');
  }
  
  // Individual savings allocation (including IRA contributions)
  let userAnnualSavings = totalUserRetirementContributions;
  let spouseAnnualSavings = totalSpouseRetirementContributions;
  
  // If total individual savings don't match total, allocate proportionally
  if (userAnnualSavings + spouseAnnualSavings < annualSavings) {
    const gap = annualSavings - (userAnnualSavings + spouseAnnualSavings);
    if (totalAnnualIncome > 0) {
      userAnnualSavings += gap * (userAnnualIncome / totalAnnualIncome);
      spouseAnnualSavings += gap * (spouseAnnualIncome / totalAnnualIncome);
    }
  }
  
  console.log('Retirement Savings Calculation:');
  console.log('  User Contributions (employee + employer):', userRetirementContributions);
  console.log('  User IRA Contributions (Traditional + Roth):', totalUserIRAContributions);
  console.log('  Spouse Contributions (employee + employer):', spouseRetirementContributions);
  console.log('  Spouse IRA Contributions (Traditional + Roth):', totalSpouseIRAContributions);
  console.log('  Total from Form:', retirementContributions);
  console.log('  Savings Rate Amount:', savingsRateAmount);
  console.log('  Annual Cash Flow:', annualCashFlow);
  
  console.log('=== MONTE CARLO ENHANCED CALCULATIONS (CFP-COMPLIANT) ===');
  console.log('Marital Status:', profileData.maritalStatus, '| Is Married/Partnered:', isMarriedOrPartnered);
  console.log('Retirement State:', retirementState, '| Filing Status:', filingStatus);
  console.log('Total Annual Income:', totalAnnualIncome);
  console.log('Estimated Retirement Income:', estimatedRetirementIncome);
  console.log('Combined Tax Rate (Federal + State):', (taxRate * 100).toFixed(1) + '%');
  console.log('Monthly Net Cash Flow Surplus:', monthlyNetCashFlow);
  console.log('Annual Cash Flow Surplus:', annualCashFlow);
  console.log('Savings Rate Amount:', savingsRateAmount);
  console.log('Retirement Contributions:', retirementContributions);
  console.log('Annual Savings (using priority logic):', annualSavings);
  console.log('User Annual Savings:', userAnnualSavings);
  console.log('Spouse Annual Savings:', spouseAnnualSavings);
  console.log('User Annual Income:', userAnnualIncome);
  console.log('Spouse Annual Income:', spouseAnnualIncome);
  console.log('User Retirement Age:', retirementAge);
  console.log('Spouse Retirement Age:', spouseDesiredRetirementAge || 'N/A');
  console.log('');
  console.log('CONTRIBUTION ALLOCATIONS:');
  console.log('Monthly 401k:', Number(profileData.monthlyContribution401k || 0));
  console.log('Monthly IRA:', Number(profileData.monthlyContributionIRA || 0));
  console.log('Monthly Roth IRA:', Number(profileData.monthlyContributionRothIRA || 0));
  console.log('Monthly Brokerage:', Number(profileData.monthlyContributionBrokerage || 0));
  console.log('');
  console.log('ASSET INCLUSION ANALYSIS:');
  console.log('Assets INCLUDED in retirement calculation:', includedAssets.length);
  includedAssets.forEach(asset => {
    console.log(`  ✓ ${asset.type}: $${asset.value.toLocaleString()} (${asset.owner}) - ${asset.description || 'N/A'}`);
  });
  console.log('Assets EXCLUDED from retirement calculation:', excludedAssets.length);
  excludedAssets.forEach(asset => {
    console.log(`  ✗ ${asset.type}: $${asset.value.toLocaleString()} (${asset.owner}) - ${asset.reason} - ${asset.description || 'N/A'}`);
  });
  console.log('');
  console.log('FIXED: Comprehensive Retirement Assets Total (EXCLUDING checking accounts):', retirementAssets);
  console.log('Deferred Annuity Assets:', deferredAnnuityAssets);
  console.log('Total Retirement Assets (including deferred annuities):', retirementAssets + deferredAnnuityAssets);
  console.log('Annuity Income (monthly):', annuityIncome);
  console.log('Total Guaranteed Annual Income:', annualGuaranteedIncome);
  console.log('=== END MONTE CARLO ENHANCED CALCULATIONS ===');
  
  // Get legacy goal
  const legacyGoal = Number(profileData.legacyGoal) || 0;
  
  // Get long-term care insurance status from the dedicated column or profileData
  // Prioritize the dedicated database column if it exists
  console.log('DEBUG: hasLongTermCareInsurance from column:', profileData.hasLongTermCareInsurance);
  console.log('DEBUG: typeof hasLongTermCareInsurance:', typeof profileData.hasLongTermCareInsurance);
  const hasLongTermCareInsurance = profileData.hasLongTermCareInsurance !== null && profileData.hasLongTermCareInsurance !== undefined
    ? Boolean(profileData.hasLongTermCareInsurance)
    : false;
  
  // Get spouse allocation for analysis
  const spouseAllocation = profileData.spouseAllocation;
  
  // Log detailed asset breakdown
  console.log('\n=== ASSET INCLUSION ANALYSIS ===');
  console.log('Included assets:', includedAssets);
  console.log('Excluded assets:', excludedAssets);
  console.log('Total retirement assets:', retirementAssets);
  
  // Log asset tax categorization
  console.log('ASSET TAX CATEGORIZATION WITH ASSET-SPECIFIC RETURNS:');
  console.log('  Tax-Deferred (401k/IRA):', assetBuckets.taxDeferred.toFixed(0));
  console.log('  Tax-Free (Roth):', assetBuckets.taxFree.toFixed(0));
  console.log('  Capital Gains (Brokerage):', assetBuckets.capitalGains.toFixed(0));
  console.log('  Cash Equivalents (Savings only - Checking EXCLUDED):', assetBuckets.cashEquivalents.toFixed(0));
  console.log('  Total:', assetBuckets.totalAssets.toFixed(0));
  
  // Calculate effective tax rate using asset mix
  const blendedTaxRate = estimateBlendedTaxRate(assetBuckets, taxRate, 0.15);
  console.log('  Ordinary Tax Rate:', (taxRate * 100).toFixed(1) + '%');
  console.log('  Blended Tax Rate (based on asset mix):', (blendedTaxRate * 100).toFixed(1) + '%');
  
  // FIXED: RightCapital-style transparent healthcare costs
  // Base healthcare cost from RightCapital: $12,794/year (for couple)
  const baseHealthcareCost = isMarriedOrPartnered ? 12794 : 6397;
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  
  // REAL DOLLAR MODEL: Keep healthcare costs constant in today's purchasing power
  const annualHealthcareCosts = baseHealthcareCost;
  
  console.log('');
  console.log('=== HEALTHCARE COSTS (REAL DOLLAR MODEL) ===');
  console.log('Base Healthcare Cost (today):', baseHealthcareCost.toFixed(0));
  console.log('Healthcare costs kept constant in real dollars (no inflation adjustment)');
  console.log('Annual Healthcare Costs (constant real):', annualHealthcareCosts.toFixed(0));
  
  // Get base retirement expenses (user's estimate)
  // DEBUG: Log what value we're receiving
  console.log('DEBUG: Raw expectedMonthlyExpensesRetirement value:', profileData.expectedMonthlyExpensesRetirement);
  
  // Use intake form value with conservative default only if truly missing
  // This ensures consistency between Monte Carlo and Net Worth calculations
  const monthlyExpensesRetirement = Number(profileData.expectedMonthlyExpensesRetirement);
  const baseRetirementExpenses = (monthlyExpensesRetirement > 0 ? monthlyExpensesRetirement : 8000) * 12;
  
  console.log('DEBUG: Using monthly retirement expenses: $' + (baseRetirementExpenses / 12).toFixed(0) + ' (annual: $' + baseRetirementExpenses.toFixed(0) + ')');
  
  // RIGHTCAPITAL APPROACH: Healthcare is ALWAYS a separate goal
  // Keep general living expenses (non-healthcare) separate from healthcare costs
  // Monte Carlo iteration will add healthcare dynamically; do not double-count here
  // CRITICAL FIX: Include healthcare in total retirement expenses for consistent calculation
  const annualRetirementExpenses = baseRetirementExpenses + annualHealthcareCosts;
  
  console.log('');
  console.log('EXPENSE ANALYSIS (RIGHTCAPITAL METHOD):');
  console.log('  Base Retirement Expenses (today\'s dollars):', baseRetirementExpenses.toFixed(0));
  console.log('  Healthcare costs (included):', annualHealthcareCosts.toFixed(0));
  console.log('  Total Annual Retirement Expenses:', annualRetirementExpenses.toFixed(0));
  console.log('  Healthcare as % of total expenses:', ((annualHealthcareCosts / annualRetirementExpenses) * 100).toFixed(1) + '%');
  console.log('  Note: Healthcare included in total expenses for consistent calculation');
  console.log('');
  
  // ALWAYS use risk profile-based returns for each owner's assets
  // This provides more accurate modeling based on individual risk tolerances
  const useRiskProfile = true;
  
  // Calculate expected return - check for optimization overrides first
  let expectedReturn: number;
  let useGlidePath = false;
  
  if (typeof profileData.expectedRealReturn === 'number') {
    if (profileData.expectedRealReturn === -1) {
      // Glide path optimization selected
      useGlidePath = true;
      expectedReturn = getRiskProfileReturn(userRiskScore); // Fallback for now, glide path will override per year
    } else if (profileData.expectedRealReturn === -2) {
      // Current allocation optimization selected - calculate from current portfolio
      const currentAllocation = calculateCurrentAllocation(profileData);
      expectedReturn = calculateReturnFromAllocation(currentAllocation);
    } else {
      // Specific percentage selected (e.g., 6.5% -> 0.065)
      expectedReturn = profileData.expectedRealReturn;
    }
  } else {
    // No optimization override - use risk profile-based return
    expectedReturn = getRiskProfileReturn(userRiskScore);
  }
  
  // Handle spouse-specific expected returns
  let spouseUseGlidePath = false;
  let spouseUseRiskProfile = true; // Always use risk profile for spouse by default
  let spouseExpectedReturn: number;
  
  if (isMarriedOrPartnered && typeof profileData.spouseExpectedRealReturn === 'number') {
    if (profileData.spouseExpectedRealReturn === -1) {
      // Spouse glide path optimization selected
      spouseUseGlidePath = true;
      spouseExpectedReturn = spouseRiskScore ? getRiskProfileReturn(spouseRiskScore) : expectedReturn;
    } else if (profileData.spouseExpectedRealReturn === -2) {
      // Spouse current allocation optimization selected
      const spouseCurrentAllocation = calculateSpouseCurrentAllocation(profileData);
      spouseExpectedReturn = calculateReturnFromAllocation(spouseCurrentAllocation);
    } else {
      // Spouse specific percentage selected
      spouseExpectedReturn = profileData.spouseExpectedRealReturn;
    }
  } else {
    // No spouse optimization override - use spouse risk profile or default to user's
    spouseExpectedReturn = isMarriedOrPartnered && spouseRiskScore
      ? getRiskProfileReturn(spouseRiskScore)
      : expectedReturn;
  }
  
  // Calculate blended return for joint assets (average of both risk profiles)
  const jointAssetsReturn = isMarriedOrPartnered && jointAssetTotal > 0
    ? (expectedReturn + spouseExpectedReturn) / 2
    : expectedReturn;
  
  // Calculate weighted average return based on actual asset distribution
  // totalAssets already calculated above on line 2293
  const weightedAverageReturn = totalAssets > 0 && expectedReturn && spouseExpectedReturn && jointAssetsReturn
    ? (userAssetTotal * expectedReturn +
       spouseAssetTotal * spouseExpectedReturn +
       jointAssetTotal * jointAssetsReturn) / totalAssets
    : expectedReturn;
  
  console.log('');
  console.log('SIMULATION PARAMETERS (REAL DOLLAR MODEL):');
  console.log('  Model Type: Real Dollar (all values in today\'s purchasing power)');
  console.log('  Contributions: No inflation adjustment (constant real value)');
  console.log('  Expenses: No inflation adjustment (constant real value)');
  console.log('  Returns: Real returns (already inflation-adjusted)');
  console.log('  Investment Strategy: Risk Profile-Based');
  console.log('  User Risk Profile: ' + userRiskScore + ' (' + 
    (userRiskScore === 1 ? 'Conservative' : 
     userRiskScore === 2 ? 'Moderately Conservative' :
     userRiskScore === 3 ? 'Moderate' :
     userRiskScore === 4 ? 'Moderately Aggressive' : 'Aggressive') + ')');
  console.log('  Spouse Risk Profile: ' + spouseRiskScore + ' (' +
    (spouseRiskScore === 1 ? 'Conservative' : 
     spouseRiskScore === 2 ? 'Moderately Conservative' :
     spouseRiskScore === 3 ? 'Moderate' :
     spouseRiskScore === 4 ? 'Moderately Aggressive' : 'Aggressive') + ')');
  console.log('  Expected Real Returns:');
  console.log('    User Assets: ' + (expectedReturn * 100).toFixed(1) + '%');
  console.log('    Spouse Assets: ' + (spouseExpectedReturn * 100).toFixed(1) + '%');
  console.log('    Joint Assets: ' + (jointAssetsReturn * 100).toFixed(1) + '% (blended)');
  console.log('    Weighted Portfolio Return: ' + (weightedAverageReturn * 100).toFixed(1) + '% (actual)');
  console.log('  Years to Retirement:', (retirementAge - currentAge).toFixed(0));
  console.log('  Current Retirement Assets:', retirementAssets.toFixed(0));
  console.log('  Annual Savings:', annualSavings.toFixed(0));
  console.log('  Stock Allocation:', ((Number(profileData.stockAllocation) || 60)).toFixed(0) + '%');
  
  // Add asset allocation analysis and recommendations
  const currentStockAllocation = stockAllocation * 100;
  const currentBondAllocation = bondAllocation * 100;
  const ageBasedStockAllocation = Math.max(20, 110 - currentAge); // Common rule: 110 - age
  const conservativeStockAllocation = Math.max(30, 100 - currentAge); // More conservative: 100 - age
  
  console.log('');
  console.log('ASSET ALLOCATION ANALYSIS:');
  console.log('  Current allocation: ' + currentStockAllocation.toFixed(0) + '% stocks, ' + currentBondAllocation.toFixed(0) + '% bonds');
  console.log('  Age-based guideline (110 - age): ' + ageBasedStockAllocation.toFixed(0) + '% stocks');
  console.log('  Conservative guideline (100 - age): ' + conservativeStockAllocation.toFixed(0) + '% stocks');
  
  if (currentStockAllocation > ageBasedStockAllocation + 20) {
    console.log('  ⚠️  WARNING: Very aggressive allocation for age ' + currentAge);
    console.log('     Consider reducing to ' + ageBasedStockAllocation.toFixed(0) + '% stocks for better risk management');
    console.log('     High stock allocation increases sequence of returns risk in early retirement');
  } else if (currentStockAllocation > ageBasedStockAllocation + 10) {
    console.log('  ℹ️  INFO: Moderately aggressive allocation. Consider rebalancing as retirement approaches');
  }
  
  if (currentStockAllocation < 30 && currentAge < 60) {
    console.log('  ℹ️  INFO: Very conservative allocation may limit growth potential');
  }
  
  const params = {
    currentAge,
    spouseAge,
    retirementAge,
    spouseRetirementAge: spouseDesiredRetirementAge,
    lifeExpectancy,
    spouseLifeExpectancy,
    currentRetirementAssets: retirementAssets,
    annualGuaranteedIncome,
    socialSecurityClaimAge: Number(profileData.socialSecurityClaimAge) || 67,
    spouseSocialSecurityClaimAge: Number(profileData.spouseSocialSecurityClaimAge) || 67,
    socialSecurityBenefit: userSocialSecurity,
    spouseSocialSecurityBenefit: spouseSocialSecurity,
    partTimeIncomeRetirement: userPartTime,
    spousePartTimeIncomeRetirement: spousePartTime,
    pensionBenefit: userPension,
    spousePensionBenefit: spousePension,
    annualRetirementExpenses,
    annualHealthcareCosts,
    expectedReturn: weightedAverageReturn, // Use the weighted average for the simulation
    userExpectedReturn: expectedReturn, // User-specific return for legacy compatibility
    spouseExpectedReturn,
    jointAssetsReturn,
    spouseUseGlidePath,
    spouseUseRiskProfile,
    returnVolatility: 0.15, // Default 15% volatility
    inflationRate: (Number(profileData.expectedInflationRate) || 2) / 100,
    stockAllocation,
    bondAllocation,
    cashAllocation,
    // Add owner-specific allocations
    userAllocation,
    spouseAllocation: spouseAssetAllocation,
    userAssetBuckets,
    // Add asset totals by owner for return calculations
    userAssetTotal,
    spouseAssetTotal,
    jointAssetTotal,
    spouseAssetBuckets,
    jointAssetBuckets,
    useGlidePath, // Set by asset allocation optimization logic above
    useRiskProfile,
    userRiskScore,
    spouseRiskScore,
    withdrawalRate: (Number(profileData.withdrawalRate) || 4) / 100,
    useGuardrails: true,
    taxRate,
    filingStatus,
    annualSavings,
    // Enable dynamic withdrawals but only during bear/crisis markets
    enableDynamicWithdrawals: true,
    bearOnlyDynamicWithdrawals: true, // Only adjust spending in bear/crisis markets (20%+ drawdowns)
    userAnnualSavings,
    spouseAnnualSavings,
    userAnnualIncome,
    spouseAnnualIncome,
    monthlyContribution401k: Number(profileData.monthlyContribution401k || 0),
    monthlyContributionIRA: Number(profileData.monthlyContributionIRA || 0),
    monthlyContributionRothIRA: Number(profileData.monthlyContributionRothIRA || 0),
    monthlyContributionBrokerage: Number(profileData.monthlyContributionBrokerage || 0),
    legacyGoal,
    hasLongTermCareInsurance,
    assetBuckets,
    userHealthStatus: profileData.userHealthStatus || 'good',
    spouseHealthStatus: profileData.spouseHealthStatus || 'good',
    userGender: profileData.userGender || 'male',
    spouseGender: profileData.spouseGender || 'female',
    retirementState,
    profileData, // Pass full profile data for annuity age-based triggering
    
    // LTC Modeling Parameters (Phase 1: Simple Shock Model)
    // CRITICAL: Always model LTC risk, but adjust costs based on insurance coverage
    ltcModeling: {
      enabled: true, // Always model LTC risk - it's a reality everyone faces
      approach: 'simple' as const,
      lifetimeProbability: Number(profileData.ltcLifetimeProbability) || 0.48, // Realistic 48% paid-care probability
      averageDuration: (profileData.userGender === 'female' || profileData.gender === 'F') ? 3.7 : 2.2,
      averageAnnualCost: calculateRegionalLTCCost(profileData.state || retirementState || 'National'),
      onsetAgeRange: [75, 85] as [number, number],
      costInflationRate: 0.02, // 2% real LTC inflation (above general inflation)
      gender: (profileData.userGender === 'female' || profileData.gender === 'F') ? 'F' as const : 'M' as const,
      maritalStatus: profileData.maritalStatus || 'single',
      familySupport: (profileData.familySupport as 'High' | 'Medium' | 'Low') || 'Medium',
      
      // FIXED: Use hasLongTermCareInsurance from Step 11 of intake form
      hasInsurance: Boolean(profileData.hasLongTermCareInsurance),
      
      // Insurance coverage parameters (if user has LTC insurance)
      ltcInsurance: profileData.hasLongTermCareInsurance ? {
        dailyBenefit: 200, // $200/day default coverage (~$73K/year)
        eliminationDays: 90, // 90-day elimination period typical
        benefitYears: 3, // 3-year benefit period typical
        annualPremium: 3000, // ~$3K annual premium typical
        inflationRider: true // Assume inflation protection
      } : undefined
    }
  };
  
  // Calculate and log projected portfolio value
  const projectedPortfolio = calculateProjectedRetirementPortfolio(params);
  console.log('');
  console.log('PROJECTED VALUES AT RETIREMENT:');
  console.log('  Projected Portfolio Value:', projectedPortfolio.toFixed(0));
  console.log('  Annual Withdrawal Needed (total):', (annualRetirementExpenses - annualGuaranteedIncome).toFixed(0));
  console.log('  Initial Withdrawal Rate:', ((annualRetirementExpenses - annualGuaranteedIncome) / projectedPortfolio * 100).toFixed(2) + '%');
  console.log('');
  
  return params;
}
