// Monte Carlo Worker with Full Server Parity
// This implementation matches the server-side algorithm exactly for consistency

import {
  MORTALITY_RATES,
  HEALTH_ADJUSTMENTS,
  COUPLES_LIFE_CORRELATION,
  SPOUSE_EXPENSE_REDUCTION,
  SPOUSE_SS_SURVIVOR_BENEFIT,
  LIFE_EXPECTANCY_DISTRIBUTION,
  DEFAULT_ALLOCATIONS,
  GUARDRAILS,
  LTC_PROBABILITY,
  LTC_ANNUAL_COST,
  LTC_AVERAGE_DURATION_YEARS,
  HEALTHCARE_COSTS,
  INFLATION_RATES,
  WORKER_BATCH_SIZE,
  MAX_RETIREMENT_YEARS
} from './monte-carlo.constants';
import { RNG, type RandomSource } from './rng';

// Deterministic RNG context for this worker
let RNG_CTX: RandomSource | null = null;
function rnd(): number { return RNG_CTX ? RNG_CTX.next() : Math.random(); }
function setRng(seed: number) { RNG_CTX = new RNG(seed); }

// ============================================================================
// Type Definitions (matching server types)
// ============================================================================

interface AssetBuckets {
  taxDeferred: number;     // 401(k), Traditional IRA
  taxFree: number;         // Roth IRA, Roth 401(k)
  capitalGains: number;    // Brokerage accounts
  cashEquivalents: number; // Savings, money market
  totalAssets: number;
}

interface SimulationParams {
  // Basic parameters
  currentAge: number;
  spouseAge?: number;
  retirementAge: number;
  spouseRetirementAge?: number;
  lifeExpectancy: number;
  spouseLifeExpectancy?: number;
  
  // Assets and Income
  currentRetirementAssets: number;
  annualGuaranteedIncome: number;
  
  // Social Security
  socialSecurityClaimAge?: number;
  spouseSocialSecurityClaimAge?: number;
  socialSecurityBenefit?: number;
  spouseSocialSecurityBenefit?: number;
  
  // Part-time and pension
  partTimeIncomeRetirement?: number;
  spousePartTimeIncomeRetirement?: number;
  pensionBenefit?: number;
  spousePensionBenefit?: number;
  
  // Expenses
  annualRetirementExpenses: number;
  annualHealthcareCosts?: number;
  healthcareInflationRate?: number;
  
  // Market assumptions
  expectedReturn: number;
  returnVolatility: number;
  inflationRate: number;
  
  // Asset allocation
  stockAllocation: number;
  bondAllocation: number;
  cashAllocation: number;
  
  // Asset buckets for tax-efficient withdrawal
  assetBuckets: AssetBuckets;
  userAssetBuckets?: AssetBuckets;
  spouseAssetBuckets?: AssetBuckets;
  jointAssetBuckets?: AssetBuckets;
  
  // Strategy parameters
  withdrawalRate: number;
  useGuardrails?: boolean;
  taxRate: number;
  
  // Accumulation phase
  annualSavings: number;
  userAnnualSavings?: number;
  spouseAnnualSavings?: number;
  
  // Goals
  legacyGoal: number;
  
  // Health status
  userHealthStatus?: 'excellent' | 'good' | 'fair' | 'poor';
  spouseHealthStatus?: 'excellent' | 'good' | 'fair' | 'poor';
  
  // LTC insurance
  hasLongTermCareInsurance?: boolean;
  ltcInsuranceDailyBenefit?: number;
  ltcInsuranceInflationProtection?: boolean;
  
  // State for tax calculations
  stateCode?: string;
  filingStatus?: 'single' | 'married' | 'marriedFilingSeparately';
}

// ============================================================================
// Market Regime Modeling (from server)
// ============================================================================

type MarketRegime = 'bull' | 'normal' | 'bear' | 'crisis';

interface RegimeParams {
  meanReturn: number;
  volatility: number;
  transitionProbabilities: Record<MarketRegime, number>;
  assetAdjustments: {
    stocks: { returnMultiplier: number; volMultiplier: number };
    bonds: { returnMultiplier: number; volMultiplier: number };
    cash: { returnMultiplier: number; volMultiplier: number };
  };
}

const MARKET_REGIMES: Record<MarketRegime, RegimeParams> = {
  bull: {
    meanReturn: 0.15,
    volatility: 0.12,
    transitionProbabilities: { bull: 0.60, normal: 0.30, bear: 0.08, crisis: 0.02 },
    assetAdjustments: {
      stocks: { returnMultiplier: 1.3, volMultiplier: 0.8 },
      bonds: { returnMultiplier: 0.9, volMultiplier: 0.9 },
      cash: { returnMultiplier: 1.0, volMultiplier: 1.0 }
    }
  },
  normal: {
    meanReturn: 0.08,
    volatility: 0.16,
    transitionProbabilities: { bull: 0.20, normal: 0.60, bear: 0.15, crisis: 0.05 },
    assetAdjustments: {
      stocks: { returnMultiplier: 1.0, volMultiplier: 1.0 },
      bonds: { returnMultiplier: 1.0, volMultiplier: 1.0 },
      cash: { returnMultiplier: 1.0, volMultiplier: 1.0 }
    }
  },
  bear: {
    meanReturn: -0.05,
    volatility: 0.25,
    transitionProbabilities: { bull: 0.15, normal: 0.40, bear: 0.35, crisis: 0.10 },
    assetAdjustments: {
      stocks: { returnMultiplier: 0.6, volMultiplier: 1.5 },
      bonds: { returnMultiplier: 1.2, volMultiplier: 1.1 },
      cash: { returnMultiplier: 1.0, volMultiplier: 1.0 }
    }
  },
  crisis: {
    meanReturn: -0.20,
    volatility: 0.40,
    transitionProbabilities: { bull: 0.10, normal: 0.30, bear: 0.40, crisis: 0.20 },
    assetAdjustments: {
      stocks: { returnMultiplier: 0.3, volMultiplier: 2.0 },
      bonds: { returnMultiplier: 1.3, volMultiplier: 1.3 },
      cash: { returnMultiplier: 1.0, volMultiplier: 1.0 }
    }
  }
};

// ============================================================================
// Tax Calculations (from server)
// ============================================================================

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

const FEDERAL_TAX_BRACKETS_2024: Record<string, TaxBracket[]> = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 }
  ],
  married: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 }
  ]
};

const STANDARD_DEDUCTIONS_2024 = {
  single: 14600,
  married: 29200,
  marriedFilingSeparately: 14600
};

function calculateFederalTax(income: number, filingStatus: string): number {
  const standardDeduction = STANDARD_DEDUCTIONS_2024[filingStatus] || STANDARD_DEDUCTIONS_2024.single;
  const taxableIncome = Math.max(0, income - standardDeduction);
  
  const brackets = FEDERAL_TAX_BRACKETS_2024[filingStatus] || FEDERAL_TAX_BRACKETS_2024.single;
  let tax = 0;
  
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome - bracket.min, bracket.max - bracket.min);
    tax += taxableInBracket * bracket.rate;
  }
  
  return tax;
}

// Social Security taxation (from server)
function calculateSocialSecurityTaxation(
  grossSSBenefit: number,
  otherIncome: number,
  filingStatus: 'single' | 'married'
): { taxableAmount: number; taxablePercentage: number } {
  if (grossSSBenefit <= 0) {
    return { taxableAmount: 0, taxablePercentage: 0 };
  }
  
  const provisionalIncome = otherIncome + (grossSSBenefit * 0.5);
  
  const thresholds = filingStatus === 'single' ? 
    { first: 25000, second: 34000 } : 
    { first: 32000, second: 44000 };
  
  let taxableAmount = 0;
  
  if (provisionalIncome <= thresholds.first) {
    taxableAmount = 0;
  } else if (provisionalIncome <= thresholds.second) {
    const excess = provisionalIncome - thresholds.first;
    taxableAmount = Math.min(excess * 0.5, grossSSBenefit * 0.5);
  } else {
    const firstTier = (thresholds.second - thresholds.first) * 0.5;
    const secondTier = (provisionalIncome - thresholds.second) * 0.85;
    taxableAmount = Math.min(firstTier + secondTier, grossSSBenefit * 0.85);
  }
  
  return {
    taxableAmount,
    taxablePercentage: grossSSBenefit > 0 ? taxableAmount / grossSSBenefit : 0
  };
}

// IRMAA calculation (from server)
interface IRMAAResult {
  monthlyPartBPremium: number;
  monthlyPartDPremium: number;
  annualSurcharge: number;
}

function calculateIRMAA(modifiedAGI: number, filingStatus: 'single' | 'married'): IRMAAResult {
  const basePremium = 174.70;
  
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
  
  const bracket = brackets.find(b => modifiedAGI >= b.min && modifiedAGI < b.max) || brackets[brackets.length - 1];
  
  return {
    monthlyPartBPremium: bracket.partBTotal,
    monthlyPartDPremium: bracket.partDAdd,
    annualSurcharge: (bracket.partBTotal - basePremium + bracket.partDAdd) * 12
  };
}

// RMD calculation (from server)
function calculateRMD(age: number, balance: number): number {
  const rmdFactors: Record<number, number> = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9
  };
  
  if (age < 72) return 0;
  const factor = rmdFactors[Math.min(age, 95)] || 8.9;
  return balance / factor;
}

// ============================================================================
// Tax-Efficient Withdrawal Sequencing (from server)
// ============================================================================

interface WithdrawalResult {
  grossWithdrawal: number;
  netAfterTaxes: number;
  federalTax: number;
  stateTax: number;
  capitalGainsTax: number;
  totalTaxes: number;
  effectiveTaxRate: number;
  bucketWithdrawals: AssetBuckets;
}

function calculateTaxEfficientWithdrawal(
  requiredAmount: number,
  buckets: AssetBuckets,
  age: number,
  otherIncome: number,
  filingStatus: 'single' | 'married'
): WithdrawalResult {
  const withdrawals: AssetBuckets = {
    taxDeferred: 0,
    taxFree: 0,
    capitalGains: 0,
    cashEquivalents: 0,
    totalAssets: 0
  };
  
  let remainingNeed = requiredAmount;
  let totalTaxableIncome = otherIncome;
  
  // Step 1: RMDs from tax-deferred accounts (mandatory)
  const rmdAmount = calculateRMD(age, buckets.taxDeferred);
  if (rmdAmount > 0) {
    const rmdWithdrawal = Math.min(rmdAmount, buckets.taxDeferred);
    withdrawals.taxDeferred += rmdWithdrawal;
    buckets.taxDeferred -= rmdWithdrawal;
    remainingNeed -= rmdWithdrawal;
    totalTaxableIncome += rmdWithdrawal;
  }
  
  // Step 2: Withdraw from cash first (no tax impact)
  if (remainingNeed > 0 && buckets.cashEquivalents > 0) {
    const cashWithdrawal = Math.min(remainingNeed, buckets.cashEquivalents);
    withdrawals.cashEquivalents = cashWithdrawal;
    buckets.cashEquivalents -= cashWithdrawal;
    remainingNeed -= cashWithdrawal;
  }
  
  // Step 3: Withdraw from capital gains accounts (lower tax rate)
  if (remainingNeed > 0 && buckets.capitalGains > 0) {
    const capitalWithdrawal = Math.min(remainingNeed, buckets.capitalGains);
    withdrawals.capitalGains = capitalWithdrawal;
    buckets.capitalGains -= capitalWithdrawal;
    remainingNeed -= capitalWithdrawal;
    // Assume 50% is basis, 50% is gains
    totalTaxableIncome += capitalWithdrawal * 0.5;
  }
  
  // Step 4: Withdraw from tax-deferred accounts
  if (remainingNeed > 0 && buckets.taxDeferred > 0) {
    const taxDeferredWithdrawal = Math.min(remainingNeed, buckets.taxDeferred);
    withdrawals.taxDeferred += taxDeferredWithdrawal;
    buckets.taxDeferred -= taxDeferredWithdrawal;
    remainingNeed -= taxDeferredWithdrawal;
    totalTaxableIncome += taxDeferredWithdrawal;
  }
  
  // Step 5: Finally, withdraw from Roth accounts (tax-free, preserve for last)
  if (remainingNeed > 0 && buckets.taxFree > 0) {
    const rothWithdrawal = Math.min(remainingNeed, buckets.taxFree);
    withdrawals.taxFree = rothWithdrawal;
    buckets.taxFree -= rothWithdrawal;
    remainingNeed -= rothWithdrawal;
    // No tax impact
  }
  
  // Calculate taxes
  const federalTax = calculateFederalTax(totalTaxableIncome, filingStatus);
  const capitalGainsTax = withdrawals.capitalGains * 0.5 * 0.15; // 15% on gains portion
  const stateTax = totalTaxableIncome * 0.05; // Simplified state tax
  const totalTaxes = federalTax + capitalGainsTax + stateTax;
  
  const grossWithdrawal = requiredAmount;
  const netAfterTaxes = grossWithdrawal - totalTaxes;
  
  return {
    grossWithdrawal,
    netAfterTaxes,
    federalTax,
    stateTax,
    capitalGainsTax,
    totalTaxes,
    effectiveTaxRate: grossWithdrawal > 0 ? totalTaxes / grossWithdrawal : 0,
    bucketWithdrawals: withdrawals
  };
}

// ============================================================================
// Enhanced Guyton-Klinger Guardrails (from server)
// ============================================================================

interface GuytonKlingerResult {
  withdrawal: number;
  adjustmentType: 'none' | 'capital-preservation' | 'prosperity' | 'portfolio-management' | 'inflation';
  adjustmentReason: string;
  withdrawalRate: number;
}

function applyGuytonKlingerGuardrails(
  initialWithdrawalRate: number,
  currentWithdrawalRate: number,
  previousWithdrawal: number,
  portfolioValue: number,
  inflation: number,
  yearsSinceRetirement: number,
  remainingYears: number
): GuytonKlingerResult {
  let withdrawal = previousWithdrawal;
  let adjustmentType: GuytonKlingerResult['adjustmentType'] = 'none';
  let adjustmentReason = '';
  
  const withdrawalRatio = currentWithdrawalRate / initialWithdrawalRate;
  const essentialPortion = 0.7;
  const discretionaryPortion = 0.3;
  
  // Capital Preservation Rule (graduated adjustments)
  if (withdrawalRatio > 1.3 && remainingYears > 15) {
    const discretionaryCut = previousWithdrawal * discretionaryPortion * 0.4;
    withdrawal = previousWithdrawal - discretionaryCut;
    adjustmentType = 'capital-preservation';
    adjustmentReason = `Withdrawal rate exceeded 130% of initial rate`;
  }
  else if (withdrawalRatio > 1.2 && remainingYears > 15) {
    const cutPercent = 0.2 + (withdrawalRatio - 1.2) * 2;
    const discretionaryCut = previousWithdrawal * discretionaryPortion * cutPercent;
    withdrawal = previousWithdrawal - discretionaryCut;
    adjustmentType = 'capital-preservation';
    adjustmentReason = `Withdrawal rate exceeded 120% of initial rate`;
  }
  // Prosperity Rule
  else if (withdrawalRatio < 0.7 && remainingYears > 15) {
    const discretionaryIncrease = previousWithdrawal * discretionaryPortion * 0.3;
    withdrawal = previousWithdrawal + discretionaryIncrease;
    adjustmentType = 'prosperity';
    adjustmentReason = `Withdrawal rate well below initial rate`;
  }
  else if (withdrawalRatio < 0.8 && remainingYears > 15) {
    const increasePercent = 0.1 + (0.8 - withdrawalRatio) * 2;
    const discretionaryIncrease = previousWithdrawal * discretionaryPortion * increasePercent;
    withdrawal = previousWithdrawal + discretionaryIncrease;
    adjustmentType = 'prosperity';
    adjustmentReason = `Withdrawal rate below 80% of initial rate`;
  }
  // Default inflation adjustment
  else {
    withdrawal = previousWithdrawal * (1 + inflation);
    adjustmentType = 'inflation';
    adjustmentReason = 'Standard inflation adjustment';
  }
  
  // Floor: never go below 50% of initial withdrawal
  const minWithdrawal = previousWithdrawal * 0.5;
  withdrawal = Math.max(withdrawal, minWithdrawal);
  
  // Ceiling: never exceed 150% of inflation-adjusted initial
  const maxWithdrawal = previousWithdrawal * 1.5;
  withdrawal = Math.min(withdrawal, maxWithdrawal);
  
  return {
    withdrawal,
    adjustmentType,
    adjustmentReason,
    withdrawalRate: portfolioValue > 0 ? withdrawal / portfolioValue : 0
  };
}

// ============================================================================
// LTC Event Modeling (from server)
// ============================================================================

interface LTCEvent {
  startAge: number;
  durationYears: number;
  annualCost: number;
  coveredByInsurance: number;
}

function modelLTCEvent(age: number, hasInsurance: boolean): LTCEvent | null {
  let probability = 0;
  
  if (age >= 85) {
    probability = LTC_PROBABILITY.age85plus;
  } else if (age >= 75) {
    probability = LTC_PROBABILITY.age75to84;
  } else if (age >= 65) {
    probability = LTC_PROBABILITY.age65to74;
  } else {
    return null;
  }
  
  if (rnd() > probability) {
    return null;
  }
  
  const duration = LTC_AVERAGE_DURATION_YEARS + (rnd() - 0.5) * 2;
  const annualCost = LTC_ANNUAL_COST.assisted * (1 + (rnd() - 0.5) * 0.4);
  
  return {
    startAge: age,
    durationYears: Math.max(1, Math.min(5, duration)),
    annualCost,
    coveredByInsurance: hasInsurance ? annualCost * 0.7 : 0
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateNormalRandom(): number {
  if (RNG_CTX) return RNG_CTX.normal();
  let u = Math.max(Math.random(), 1e-12);
  let v = Math.max(Math.random(), 1e-12);
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(0, matrix[i][i] - sum));
      } else {
        L[i][j] = L[j][j] !== 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
      }
    }
  }
  
  return L;
}

function getInitialRegime(yearsToRetirement: number): MarketRegime {
  if (yearsToRetirement <= 5) {
    const rand = rnd();
    if (rand < 0.1) return 'crisis';
    if (rand < 0.3) return 'bear';
    if (rand < 0.7) return 'normal';
    return 'bull';
  }
  return 'normal';
}

function transitionRegime(current: MarketRegime): MarketRegime {
  const probs = MARKET_REGIMES[current].transitionProbabilities;
  const rand = rnd();
  let cumulative = 0;
  
  for (const [regime, prob] of Object.entries(probs)) {
    cumulative += prob;
    if (rand < cumulative) {
      return regime as MarketRegime;
    }
  }
  
  return current;
}

function generateCorrelatedReturnsWithRegime(
  stockAlloc: number,
  bondAlloc: number,
  cashAlloc: number,
  regime: MarketRegime
): number {
  const regimeParams = MARKET_REGIMES[regime];
  
  // Generate correlated returns
  const correlationMatrix = [
    [1.00, 0.15, 0.00],  // stocks
    [0.15, 1.00, 0.30],  // bonds
    [0.00, 0.30, 1.00]   // cash
  ];
  
  const L = choleskyDecomposition(correlationMatrix);
  const Z = [generateNormalRandom(), generateNormalRandom(), generateNormalRandom()];
  
  let correlatedReturns = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j <= i; j++) {
      correlatedReturns[i] += L[i][j] * Z[j];
    }
  }
  
  // Apply regime adjustments
  const stockReturn = (0.10 * regimeParams.assetAdjustments.stocks.returnMultiplier) + 
                      (0.20 * regimeParams.assetAdjustments.stocks.volMultiplier * correlatedReturns[0]);
  const bondReturn = (0.04 * regimeParams.assetAdjustments.bonds.returnMultiplier) + 
                     (0.05 * regimeParams.assetAdjustments.bonds.volMultiplier * correlatedReturns[1]);
  const cashReturn = (0.02 * regimeParams.assetAdjustments.cash.returnMultiplier) + 
                     (0.01 * regimeParams.assetAdjustments.cash.volMultiplier * correlatedReturns[2]);
  
  return stockAlloc * stockReturn + bondAlloc * bondReturn + cashAlloc * cashReturn;
}

function generateStochasticLifeExpectancy(baseExpectancy: number, currentAge: number): number {
  const rand = rnd();
  let adjustment = 0;
  
  if (rand < LIFE_EXPECTANCY_DISTRIBUTION.EARLY_MORTALITY_CHANCE) {
    const range = LIFE_EXPECTANCY_DISTRIBUTION.EARLY_MORTALITY_RANGE;
    adjustment = range.min + rnd() * (range.max - range.min);
  } else if (rand < LIFE_EXPECTANCY_DISTRIBUTION.EARLY_MORTALITY_CHANCE + LIFE_EXPECTANCY_DISTRIBUTION.MEDIAN_RANGE_CHANCE) {
    const range = LIFE_EXPECTANCY_DISTRIBUTION.MEDIAN_RANGE;
    adjustment = range.min + rnd() * (range.max - range.min);
  } else {
    const range = LIFE_EXPECTANCY_DISTRIBUTION.LONGEVITY_RANGE;
    adjustment = range.min + rnd() * (range.max - range.min);
  }
  
  return Math.max(currentAge + 1, Math.min(120, baseExpectancy + adjustment));
}

function simulateSurvival(age: number, healthStatus: string): boolean {
  const mortalityRate = MORTALITY_RATES[Math.min(age, 120)] || 1.0;
  const healthMultiplier = HEALTH_ADJUSTMENTS[healthStatus] || 1.0;
  const adjustedMortalityRate = Math.min(1.0, mortalityRate * healthMultiplier);
  return rnd() > adjustedMortalityRate;
}

// ============================================================================
// Main Simulation Function (Full Server Parity)
// ============================================================================

function runScenarioWithServerParity(params: SimulationParams): {
  endingBalance: number;
  success: boolean;
  yearsUntilDepletion: number | null;
  yearlyData: any[];
} {
  // Initialize portfolio and buckets
  let portfolio = params.currentRetirementAssets;
  let buckets: AssetBuckets = { ...params.assetBuckets };
  const yearlyData = [];
  let yearsUntilDepletion: number | null = null;
  
  const yearsToRetirement = Math.max(0, params.retirementAge - params.currentAge);
  const filingStatus = params.filingStatus || (params.spouseAge ? 'married' : 'single');
  
  // Initialize market regime
  let currentRegime = getInitialRegime(yearsToRetirement);
  
  // Accumulation phase
  for (let year = 0; year < yearsToRetirement; year++) {
    // Add annual savings proportionally to buckets
    const savingsAllocation = {
      taxDeferred: 0.5,
      taxFree: 0.2,
      capitalGains: 0.2,
      cashEquivalents: 0.1
    };
    
    for (const [bucket, allocation] of Object.entries(savingsAllocation)) {
      buckets[bucket] += params.annualSavings * allocation;
    }
    portfolio += params.annualSavings;
    
    // Market returns with regime
    const annualReturn = generateCorrelatedReturnsWithRegime(
      params.stockAllocation,
      params.bondAllocation,
      params.cashAllocation,
      currentRegime
    );
    
    // Apply returns to each bucket
    for (const bucket of ['taxDeferred', 'taxFree', 'capitalGains', 'cashEquivalents'] as const) {
      buckets[bucket] *= (1 + annualReturn);
    }
    portfolio *= (1 + annualReturn);
    
    // Transition market regime
    currentRegime = transitionRegime(currentRegime);
  }
  
  // Distribution phase
  let age = params.retirementAge;
  let year = 0;
  let previousWithdrawal = params.withdrawalRate * portfolio;
  let userAlive = true;
  let spouseAlive = params.spouseAge !== undefined;
  
  // Calculate initial guaranteed income
  let guaranteedIncome = params.annualGuaranteedIncome || 0;
  
  while ((userAlive || spouseAlive) && portfolio > 0 && year < MAX_RETIREMENT_YEARS) {
    // Social Security benefits
    let socialSecurityIncome = 0;
    if (age >= (params.socialSecurityClaimAge || 67)) {
      socialSecurityIncome = (params.socialSecurityBenefit || 0) * 12;
    }
    if (spouseAlive && params.spouseAge && 
        (params.spouseAge + year) >= (params.spouseSocialSecurityClaimAge || 67)) {
      socialSecurityIncome += (params.spouseSocialSecurityBenefit || 0) * 12;
    }
    
    // Calculate taxable Social Security
    const ssTaxation = calculateSocialSecurityTaxation(
      socialSecurityIncome,
      portfolio * params.withdrawalRate,
      filingStatus as 'single' | 'married'
    );
    
    // Healthcare costs
    const isOnMedicare = age >= 65;
    const healthcareCosts = isOnMedicare ? 
      HEALTHCARE_COSTS.medicare[filingStatus === 'married' ? 'couple' : 'single'] :
      HEALTHCARE_COSTS.preMedicare[filingStatus === 'married' ? 'couple' : 'single'];
    
    // Calculate IRMAA if on Medicare
    let irmaaSurcharge = 0;
    if (isOnMedicare) {
      const modifiedAGI = portfolio * params.withdrawalRate + ssTaxation.taxableAmount;
      const irmaa = calculateIRMAA(modifiedAGI, filingStatus as 'single' | 'married');
      irmaaSurcharge = irmaa.annualSurcharge;
    }
    
    // LTC event modeling
    const ltcEvent = modelLTCEvent(age, params.hasLongTermCareInsurance || false);
    const ltcCosts = ltcEvent ? ltcEvent.annualCost - ltcEvent.coveredByInsurance : 0;
    
    // Total expenses
    const totalExpenses = params.annualRetirementExpenses + healthcareCosts + irmaaSurcharge + ltcCosts;
    
    // Apply Guyton-Klinger guardrails if enabled
    let withdrawal = previousWithdrawal;
    if (params.useGuardrails && year > 0) {
      const currentWithdrawalRate = portfolio > 0 ? previousWithdrawal / portfolio : 0;
      const remainingYears = Math.max(params.lifeExpectancy - age, 0);
      
      const gkResult = applyGuytonKlingerGuardrails(
        params.withdrawalRate,
        currentWithdrawalRate,
        previousWithdrawal,
        portfolio,
        params.inflationRate,
        year,
        remainingYears
      );
      withdrawal = gkResult.withdrawal;
    } else if (year > 0) {
      withdrawal = previousWithdrawal * (1 + params.inflationRate);
    }
    
    // Calculate required withdrawal after guaranteed income
    const netRequired = Math.max(0, totalExpenses - guaranteedIncome - socialSecurityIncome);
    
    // Tax-efficient withdrawal sequencing
    const withdrawalResult = calculateTaxEfficientWithdrawal(
      netRequired,
      buckets,
      age,
      ssTaxation.taxableAmount,
      filingStatus as 'single' | 'married'
    );
    
    // Update buckets after withdrawal
    buckets = {
      taxDeferred: buckets.taxDeferred - withdrawalResult.bucketWithdrawals.taxDeferred,
      taxFree: buckets.taxFree - withdrawalResult.bucketWithdrawals.taxFree,
      capitalGains: buckets.capitalGains - withdrawalResult.bucketWithdrawals.capitalGains,
      cashEquivalents: buckets.cashEquivalents - withdrawalResult.bucketWithdrawals.cashEquivalents,
      totalAssets: 0
    };
    
    // Update total portfolio
    portfolio = buckets.taxDeferred + buckets.taxFree + buckets.capitalGains + buckets.cashEquivalents;
    
    // Apply market returns
    const annualReturn = generateCorrelatedReturnsWithRegime(
      params.stockAllocation,
      params.bondAllocation,
      params.cashAllocation,
      currentRegime
    );
    
    for (const bucket of ['taxDeferred', 'taxFree', 'capitalGains', 'cashEquivalents'] as const) {
      buckets[bucket] *= (1 + annualReturn);
    }
    portfolio = buckets.taxDeferred + buckets.taxFree + buckets.capitalGains + buckets.cashEquivalents;
    
    // Record yearly data
    yearlyData.push({
      year: year + 1,
      age,
      portfolioBalance: Math.max(0, portfolio),
      withdrawal: withdrawalResult.grossWithdrawal,
      netWithdrawal: withdrawalResult.netAfterTaxes,
      taxes: withdrawalResult.totalTaxes,
      socialSecurity: socialSecurityIncome,
      healthcareCosts,
      ltcCosts,
      marketRegime: currentRegime
    });
    
    // Check for portfolio depletion
    if (portfolio <= 0 && yearsUntilDepletion === null) {
      yearsUntilDepletion = yearsToRetirement + year + 1;
      break;
    }
    
    // Simulate mortality
    userAlive = simulateSurvival(age, params.userHealthStatus || 'good');
    if (params.spouseAge) {
      const spouseCurrentAge = params.spouseAge + yearsToRetirement + year;
      spouseAlive = simulateSurvival(spouseCurrentAge, params.spouseHealthStatus || 'good');
    }
    
    if (!userAlive && !spouseAlive) {
      break;
    }
    
    // Adjust for surviving spouse
    if ((!userAlive && spouseAlive) || (userAlive && !spouseAlive)) {
      withdrawal *= SPOUSE_EXPENSE_REDUCTION;
      guaranteedIncome *= SPOUSE_SS_SURVIVOR_BENEFIT;
    }
    
    // Update for next iteration
    previousWithdrawal = withdrawal;
    currentRegime = transitionRegime(currentRegime);
    age++;
    year++;
  }
  
  const success = portfolio >= params.legacyGoal;
  
  return {
    endingBalance: Math.max(0, portfolio),
    success,
    yearsUntilDepletion,
    yearlyData
  };
}

// ============================================================================
// Worker Message Handler
// ============================================================================

interface WorkerMessage {
  type: 'RUN_SIMULATION';
  id: string;
  params: SimulationParams;
  iterations: number;
  batchSize?: number;
  useServerParity?: boolean;
  startSeed?: number;
}

interface WorkerResponse {
  type: 'COMPLETE' | 'ERROR' | 'PROGRESS';
  id: string;
  result?: any;
  error?: string;
  progress?: number;
}

self.onmessage = function(e: MessageEvent<WorkerMessage>) {
  const { type, id, params, iterations = 1000, batchSize = WORKER_BATCH_SIZE, useServerParity = true, startSeed = 12345 } = e.data;
  
  if (type === 'RUN_SIMULATION' && params) {
    try {
      const batches = Math.ceil(iterations / batchSize);
      const allEndingBalances: number[] = [];
      const allDepletionYears: (number | null)[] = [];
      let totalSuccessCount = 0;
      let firstYearlyData: any[] | undefined;
      
      for (let batch = 0; batch < batches; batch++) {
        const currentBatchSize = Math.min(batchSize, iterations - batch * batchSize);
        for (let i = 0; i < currentBatchSize; i++) {
          // Derive deterministic seed per iteration
          const globalIndex = batch * batchSize + i;
          setRng(((startSeed + globalIndex * 10007) >>> 0));
          const result = runScenarioWithServerParity(params);
          allEndingBalances.push(result.endingBalance);
          allDepletionYears.push(result.yearsUntilDepletion);
          
          if (result.success) {
            totalSuccessCount++;
          }
          
          if (batch === 0 && i === 0) {
            firstYearlyData = result.yearlyData;
          }
        }
        
        // Report progress
        const progress = ((batch + 1) / batches) * 100;
        self.postMessage({
          type: 'PROGRESS',
          id,
          progress
        } as WorkerResponse);
      }
      
      // Calculate statistics
      allEndingBalances.sort((a, b) => a - b);
      
      const getPercentile = (p: number): number => {
        const index = Math.floor((p / 100) * (allEndingBalances.length - 1));
        return allEndingBalances[index] || 0;
      };
      
      const validDepletionYears = allDepletionYears.filter(y => y !== null) as number[];
      const avgDepletionYear = validDepletionYears.length > 0 ?
        validDepletionYears.reduce((sum, year) => sum + year, 0) / validDepletionYears.length :
        null;
      
      const result = {
        probabilityOfSuccess: (totalSuccessCount / iterations) * 100,
        medianEndingBalance: getPercentile(50),
        percentile10EndingBalance: getPercentile(10),
        percentile90EndingBalance: getPercentile(90),
        yearsUntilDepletion: avgDepletionYear,
        confidenceIntervals: {
          percentile10: getPercentile(10),
          percentile25: getPercentile(25),
          percentile50: getPercentile(50),
          percentile75: getPercentile(75),
          percentile90: getPercentile(90)
        },
        scenarios: {
          successful: totalSuccessCount,
          failed: iterations - totalSuccessCount,
          total: iterations
        },
        yearlyCashFlows: firstYearlyData || [],
        currentRetirementAssets: params.currentRetirementAssets,
        projectedRetirementPortfolio: allEndingBalances[Math.floor(allEndingBalances.length / 2)]
      };
      
      self.postMessage({
        type: 'COMPLETE',
        id,
        result
      } as WorkerResponse);
      
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as WorkerResponse);
    }
  }
};

export {};
