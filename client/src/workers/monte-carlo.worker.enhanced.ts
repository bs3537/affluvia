// Enhanced Monte Carlo Web Worker with Constants
// This worker handles Monte Carlo simulations with improved constants management

import {
  MAX_RETIREMENT_YEARS,
  MIN_LIFE_EXPECTANCY_AGE,
  MAX_LIFE_EXPECTANCY_AGE,
  LIFE_EXPECTANCY_DISTRIBUTION,
  COUPLES_LIFE_CORRELATION,
  SPOUSE_EXPENSE_REDUCTION,
  SPOUSE_SS_SURVIVOR_BENEFIT,
  ASSET_CORRELATIONS,
  ASSET_RETURN_FACTORS,
  GUARDRAILS,
  HEALTH_ADJUSTMENTS,
  MORTALITY_RATES,
  WORKER_BATCH_SIZE
} from './monte-carlo.constants';
import { RNG, type RandomSource } from './rng';

let RNG_CTX: RandomSource | null = null;
function rnd(): number { return RNG_CTX ? RNG_CTX.next() : Math.random(); }
function setRng(seed: number) { RNG_CTX = new RNG(seed); }

interface WorkerMessage {
  type: 'RUN_SIMULATION' | 'CANCEL';
  id: string;
  params?: SimulationParams;
  iterations?: number;
  batchSize?: number;
  startSeed?: number;
}

interface WorkerResponse {
  type: 'PROGRESS' | 'COMPLETE' | 'ERROR' | 'BATCH_COMPLETE';
  id: string;
  progress?: number;
  result?: any;
  error?: string;
  batchResult?: BatchResult;
}

interface SimulationParams {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  spouseAge?: number;
  spouseLifeExpectancy?: number;
  currentRetirementAssets: number;
  annualGuaranteedIncome: number;
  annualRetirementExpenses: number;
  annualHealthcareCosts: number;
  expectedReturn: number;
  returnVolatility: number;
  inflationRate: number;
  stockAllocation: number;
  bondAllocation: number;
  cashAllocation: number;
  withdrawalRate: number;
  useGuardrails: boolean;
  taxRate: number;
  annualSavings: number;
  legacyGoal: number;
  assetBuckets: {
    taxDeferred: number;
    taxFree: number;
    capitalGains: number;
    cashEquivalents: number;
    totalAssets: number;
  };
  userHealthStatus?: string;
  spouseHealthStatus?: string;
}

interface BatchResult {
  endingBalances: number[];
  successCount: number;
  depletionYears: (number | null)[];
  yearlyData?: any[];
}

// Stochastic life expectancy generation using constants
function generateStochasticLifeExpectancy(
  baseLifeExpectancy: number,
  currentAge: number
): number {
  const random = rnd();
  let stochasticAge: number;
  
  const dist = LIFE_EXPECTANCY_DISTRIBUTION;
  
  if (random < dist.EARLY_MORTALITY_CHANCE) {
    // Early mortality
    const minAge = Math.max(currentAge + 5, baseLifeExpectancy + dist.EARLY_MORTALITY_RANGE.min);
    const maxAge = baseLifeExpectancy + dist.EARLY_MORTALITY_RANGE.max;
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  } else if (random < (dist.EARLY_MORTALITY_CHANCE + dist.MEDIAN_RANGE_CHANCE)) {
    // Median range
    const minAge = baseLifeExpectancy + dist.MEDIAN_RANGE.min;
    const maxAge = baseLifeExpectancy + dist.MEDIAN_RANGE.max;
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  } else {
    // Longevity tail risk
    const minAge = baseLifeExpectancy + dist.LONGEVITY_RANGE.min;
    const maxAge = Math.min(baseLifeExpectancy + dist.LONGEVITY_RANGE.max, MAX_LIFE_EXPECTANCY_AGE);
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  }
  
  // Ensure reasonable bounds
  return Math.round(
    Math.max(
      Math.max(currentAge + 1, MIN_LIFE_EXPECTANCY_AGE),
      Math.min(MAX_LIFE_EXPECTANCY_AGE, stochasticAge)
    )
  );
}

// Generate correlated life expectancies for couples
function generateCouplesStochasticLifeExpectancy(
  userBase: number,
  userAge: number,
  spouseBase: number,
  spouseAge: number,
  correlation: number = COUPLES_LIFE_CORRELATION
): { userLife: number; spouseLife: number } {
  const userRandom = rnd();
  const spouseIndependentRandom = rnd();
  const spouseRandom = correlation * userRandom + (1 - correlation) * spouseIndependentRandom;
  
  const userLife = generateStochasticLifeExpectancyWithRandom(userBase, userAge, userRandom);
  const spouseLife = generateStochasticLifeExpectancyWithRandom(spouseBase, spouseAge, spouseRandom);
  
  return { userLife, spouseLife };
}

function generateStochasticLifeExpectancyWithRandom(
  baseLifeExpectancy: number,
  currentAge: number,
  random: number
): number {
  let stochasticAge: number;
  const dist = LIFE_EXPECTANCY_DISTRIBUTION;
  
  if (random < dist.EARLY_MORTALITY_CHANCE) {
    const minAge = Math.max(currentAge + 5, baseLifeExpectancy + dist.EARLY_MORTALITY_RANGE.min);
    const maxAge = baseLifeExpectancy + dist.EARLY_MORTALITY_RANGE.max;
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  } else if (random < (dist.EARLY_MORTALITY_CHANCE + dist.MEDIAN_RANGE_CHANCE)) {
    const minAge = baseLifeExpectancy + dist.MEDIAN_RANGE.min;
    const maxAge = baseLifeExpectancy + dist.MEDIAN_RANGE.max;
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  } else {
    const minAge = baseLifeExpectancy + dist.LONGEVITY_RANGE.min;
    const maxAge = Math.min(baseLifeExpectancy + dist.LONGEVITY_RANGE.max, MAX_LIFE_EXPECTANCY_AGE);
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  }
  
  return Math.round(
    Math.max(
      Math.max(currentAge + 1, MIN_LIFE_EXPECTANCY_AGE),
      Math.min(MAX_LIFE_EXPECTANCY_AGE, stochasticAge)
    )
  );
}

// Simulate survival for one year using constants
function simulateSurvival(age: number, healthStatus: string = 'good'): boolean {
  const baseRate = MORTALITY_RATES[Math.min(120, Math.max(50, Math.round(age)))] || 
    MORTALITY_RATES[120];
  const adjustedRate = Math.min(1.0, baseRate * HEALTH_ADJUSTMENTS[healthStatus]);
  return rnd() > adjustedRate;
}

// Simulate couples survival
function simulateCouplesSurvival(
  userAge: number,
  userHealth: string,
  spouseAge: number,
  spouseHealth: string
): { userSurvives: boolean; spouseSurvives: boolean; eitherSurvives: boolean } {
  const userSurvives = simulateSurvival(userAge, userHealth);
  const spouseSurvives = simulateSurvival(spouseAge, spouseHealth);
  
  return {
    userSurvives,
    spouseSurvives,
    eitherSurvives: userSurvives || spouseSurvives
  };
}

// Cholesky decomposition for asset correlation
function choleskyDecomposition(correlation: number[][]): number[][] {
  const n = correlation.length;
  const L: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      if (i === j) {
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[j][k] * L[j][k];
        }
        L[j][j] = Math.sqrt(Math.max(0, correlation[j][j] - sum));
      } else {
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

// Generate normal random number
function normalRandom(): number {
  if (RNG_CTX) return RNG_CTX.normal();
  let u = Math.max(Math.random(), 1e-12);
  let v = Math.max(Math.random(), 1e-12);
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Generate correlated returns using constants
function generateCorrelatedReturns(
  stockAllocation: number,
  bondAllocation: number,
  cashAllocation: number,
  expectedReturn: number,
  volatility: number
): number {
  const allocations = [stockAllocation, bondAllocation, cashAllocation];
  const activeAssets = allocations.filter(a => a > 0).length;
  
  if (activeAssets === 1) {
    const z = normalRandom();
    return expectedReturn + volatility * z;
  }
  
  // Use correlation matrix from constants
  const corrMatrix = [
    [ASSET_CORRELATIONS.stocks.stocks, ASSET_CORRELATIONS.stocks.bonds, ASSET_CORRELATIONS.stocks.cash],
    [ASSET_CORRELATIONS.bonds.stocks, ASSET_CORRELATIONS.bonds.bonds, ASSET_CORRELATIONS.bonds.cash],
    [ASSET_CORRELATIONS.cash.stocks, ASSET_CORRELATIONS.cash.bonds, ASSET_CORRELATIONS.cash.cash]
  ];
  
  const L = choleskyDecomposition(corrMatrix);
  const Z = [normalRandom(), normalRandom(), normalRandom()];
  
  const correlatedZ = [
    L[0][0] * Z[0],
    L[1][0] * Z[0] + L[1][1] * Z[1],
    L[2][0] * Z[0] + L[2][1] * Z[1] + L[2][2] * Z[2]
  ];
  
  // Calculate weighted return using factors from constants
  const assetReturns = [
    expectedReturn * ASSET_RETURN_FACTORS.stocks.returnMultiplier + 
      volatility * ASSET_RETURN_FACTORS.stocks.volatilityMultiplier * correlatedZ[0],
    expectedReturn * ASSET_RETURN_FACTORS.bonds.returnMultiplier + 
      volatility * ASSET_RETURN_FACTORS.bonds.volatilityMultiplier * correlatedZ[1],
    expectedReturn * ASSET_RETURN_FACTORS.cash.returnMultiplier + 
      volatility * ASSET_RETURN_FACTORS.cash.volatilityMultiplier * correlatedZ[2]
  ];
  
  let portfolioReturn = 0;
  for (let i = 0; i < 3; i++) {
    portfolioReturn += allocations[i] * assetReturns[i];
  }
  
  return portfolioReturn;
}

// Apply Guyton-Klinger guardrails using constants
function applyGuytonKlinger(
  previousWithdrawal: number,
  portfolioValue: number,
  initialWithdrawalRate: number,
  inflation: number,
  yearsSinceRetirement: number
): { withdrawal: number; adjustmentType: string } {
  const currentWithdrawalRate = previousWithdrawal / portfolioValue;
  let withdrawal = previousWithdrawal;
  let adjustmentType = 'inflation';
  
  if (currentWithdrawalRate > initialWithdrawalRate * GUARDRAILS.CAPITAL_PRESERVATION_TRIGGER) {
    withdrawal = previousWithdrawal * GUARDRAILS.CAPITAL_PRESERVATION_ADJUSTMENT;
    adjustmentType = 'capital-preservation';
  } else if (currentWithdrawalRate < initialWithdrawalRate * GUARDRAILS.PROSPERITY_TRIGGER) {
    withdrawal = previousWithdrawal * GUARDRAILS.PROSPERITY_ADJUSTMENT;
    adjustmentType = 'prosperity';
  } else {
    withdrawal = previousWithdrawal * (1 + inflation);
  }
  
  return { withdrawal, adjustmentType };
}

// Run a single scenario
function runScenario(params: SimulationParams): {
  endingBalance: number;
  success: boolean;
  yearsUntilDepletion: number | null;
  yearlyData: any[];
} {
  let portfolio = params.currentRetirementAssets;
  const yearlyData = [];
  let yearsUntilDepletion: number | null = null;
  
  const yearsToRetirement = Math.max(0, params.retirementAge - params.currentAge);
  
  // Generate stochastic life expectancy
  let stochasticLifeExpectancy: number;
  
  if (params.spouseAge && params.spouseLifeExpectancy) {
    const couplesLife = generateCouplesStochasticLifeExpectancy(
      params.lifeExpectancy,
      params.currentAge,
      params.spouseLifeExpectancy,
      params.spouseAge,
      COUPLES_LIFE_CORRELATION
    );
    stochasticLifeExpectancy = Math.max(couplesLife.userLife, couplesLife.spouseLife);
  } else {
    stochasticLifeExpectancy = generateStochasticLifeExpectancy(
      params.lifeExpectancy,
      params.currentAge
    );
  }
  
  const retirementYears = stochasticLifeExpectancy - params.retirementAge;
  
  // Accumulation phase
  for (let year = 0; year < yearsToRetirement; year++) {
    portfolio += params.annualSavings;
    const annualReturn = generateCorrelatedReturns(
      params.stockAllocation,
      params.bondAllocation,
      params.cashAllocation,
      params.expectedReturn,
      params.returnVolatility
    );
    portfolio *= (1 + annualReturn);
    portfolio = Math.max(0, portfolio);
  }
  
  // Distribution phase
  let currentWithdrawal = params.withdrawalRate * portfolio;
  let userAlive = true;
  let spouseAlive = params.spouseAge !== undefined;
  let guaranteedIncome = params.annualGuaranteedIncome;
  let age = params.currentAge + yearsToRetirement;
  let year = 0;
  
  while ((userAlive || spouseAlive) && portfolio > 0 && year < MAX_RETIREMENT_YEARS) {
    const annualReturn = generateCorrelatedReturns(
      params.stockAllocation,
      params.bondAllocation,
      params.cashAllocation,
      params.expectedReturn,
      params.returnVolatility
    );
    
    portfolio *= (1 + annualReturn);
    
    if (params.useGuardrails && year > 0) {
      const gkResult = applyGuytonKlinger(
        currentWithdrawal,
        portfolio,
        params.withdrawalRate,
        params.inflationRate,
        year
      );
      currentWithdrawal = gkResult.withdrawal;
    } else if (year > 0) {
      currentWithdrawal *= (1 + params.inflationRate);
    }
    
    const netWithdrawal = Math.max(0, currentWithdrawal - guaranteedIncome);
    const grossWithdrawal = netWithdrawal / (1 - params.taxRate);
    
    portfolio -= grossWithdrawal;
    
    yearlyData.push({
      year: year + 1,
      portfolioBalance: Math.max(0, portfolio),
      withdrawal: grossWithdrawal,
      netWithdrawal: netWithdrawal
    });
    
    if (portfolio <= 0 && yearsUntilDepletion === null) {
      yearsUntilDepletion = yearsToRetirement + year + 1;
      break;
    }
    
    // Simulate mortality
    if (params.spouseAge !== undefined) {
      const spouseCurrentAge = params.spouseAge + yearsToRetirement + year;
      const survivalResult = simulateCouplesSurvival(
        age,
        params.userHealthStatus || 'good',
        spouseCurrentAge,
        params.spouseHealthStatus || 'good'
      );
      
      userAlive = survivalResult.userSurvives;
      spouseAlive = survivalResult.spouseSurvives;
      
      if (!survivalResult.eitherSurvives) {
        break;
      }
      
      // Adjust expenses if one spouse dies
      if (!userAlive && spouseAlive || userAlive && !spouseAlive) {
        currentWithdrawal *= SPOUSE_EXPENSE_REDUCTION;
        guaranteedIncome *= SPOUSE_SS_SURVIVOR_BENEFIT;
      }
    } else {
      userAlive = simulateSurvival(age, params.userHealthStatus || 'good');
      if (!userAlive) {
        break;
      }
    }
    
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

// Process a batch of simulations
function processBatch(
  params: SimulationParams,
  batchSize: number,
  batchId: number
): BatchResult {
  const endingBalances: number[] = [];
  const depletionYears: (number | null)[] = [];
  let successCount = 0;
  let yearlyData: any[] | undefined;
  
  for (let i = 0; i < batchSize; i++) {
    const result = runScenario(params);
    endingBalances.push(result.endingBalance);
    depletionYears.push(result.yearsUntilDepletion);
    
    if (result.success) {
      successCount++;
    }
    
    if (i === 0 && batchId === 0) {
      yearlyData = result.yearlyData;
    }
  }
  
  return {
    endingBalances,
    successCount,
    depletionYears,
    yearlyData
  };
}

// Message handler
self.onmessage = function(e: MessageEvent<WorkerMessage>) {
  const { type, id, params, iterations = 1000, batchSize = WORKER_BATCH_SIZE, startSeed = 12345 } = e.data;
  
  if (type === 'RUN_SIMULATION' && params) {
    try {
      const batches = Math.ceil(iterations / batchSize);
      const allEndingBalances: number[] = [];
      const allDepletionYears: (number | null)[] = [];
      let totalSuccessCount = 0;
      let firstYearlyData: any[] | undefined;
      
      for (let batch = 0; batch < batches; batch++) {
        const currentBatchSize = Math.min(batchSize, iterations - batch * batchSize);
        setRng(((startSeed + batch * 1000003) >>> 0));
        const batchResult = processBatch(params, currentBatchSize, batch);
        
        allEndingBalances.push(...batchResult.endingBalances);
        allDepletionYears.push(...batchResult.depletionYears);
        totalSuccessCount += batchResult.successCount;
        
        if (batch === 0 && batchResult.yearlyData) {
          firstYearlyData = batchResult.yearlyData;
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
        const index = Math.floor((p / 100) * (iterations - 1));
        return allEndingBalances[index];
      };
      
      const validDepletionYears = allDepletionYears.filter(y => y !== null) as number[];
      const avgDepletion = validDepletionYears.length > 0
        ? validDepletionYears.reduce((sum, y) => sum + y, 0) / validDepletionYears.length
        : null;
      
      // Send final result
      self.postMessage({
        type: 'COMPLETE',
        id,
        result: {
          probabilityOfSuccess: (totalSuccessCount / iterations) * 100,
          medianEndingBalance: getPercentile(50),
          percentile10EndingBalance: getPercentile(10),
          percentile90EndingBalance: getPercentile(90),
          yearsUntilDepletion: avgDepletion,
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
          yearlyCashFlows: firstYearlyData || []
        }
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
