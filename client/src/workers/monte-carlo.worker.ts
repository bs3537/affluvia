// Monte Carlo Web Worker for parallel processing
// This worker handles Monte Carlo simulations in a separate thread

import { RNG, type RandomSource } from './rng';

// Deterministic RNG context
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

// Stochastic life expectancy generation
function generateStochasticLifeExpectancy(
  baseLifeExpectancy: number,
  currentAge: number
): number {
  const random = rnd();
  let stochasticAge: number;
  
  if (random < 0.25) {
    // 25% chance: Early mortality (base - 8 to base - 3 years)
    const minAge = Math.max(currentAge + 5, baseLifeExpectancy - 8);
    const maxAge = baseLifeExpectancy - 3;
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  } else if (random < 0.75) {
    // 50% chance: Median range (base - 2 to base + 2 years)
    const minAge = baseLifeExpectancy - 2;
    const maxAge = baseLifeExpectancy + 2;
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  } else {
    // 25% chance: Longevity tail risk (base + 3 to base + 7 years)
    const minAge = baseLifeExpectancy + 3;
    const maxAge = Math.min(baseLifeExpectancy + 7, 105);
    stochasticAge = minAge + rnd() * (maxAge - minAge);
}
  
  // Ensure reasonable bounds
  const minLifeExpectancy = Math.max(currentAge + 1, 70);
  const maxLifeExpectancy = 105;
  
  return Math.round(Math.max(minLifeExpectancy, Math.min(maxLifeExpectancy, stochasticAge)));
}

// Generate correlated life expectancies for couples
function generateCouplesStochasticLifeExpectancy(
  userBase: number,
  userAge: number,
  spouseBase: number,
  spouseAge: number,
  correlation: number = 0.4
): { userLife: number; spouseLife: number } {
  const userRandom = rnd();
  const spouseIndependentRandom = rnd();
  const spouseRandom = correlation * userRandom + (1 - correlation) * spouseIndependentRandom;
  
  const userLife = generateStochasticLifeExpectancyWithRandom(userBase, userAge, userRandom);
  const spouseLife = generateStochasticLifeExpectancyWithRandom(spouseBase, spouseAge, spouseRandom);
  
  return { userLife, spouseLife };
}

// Dynamic mortality table - simplified version for web worker
const MORTALITY_RATES: { [age: number]: number } = {
  50: 0.003410, 51: 0.003684, 52: 0.003992, 53: 0.004345, 54: 0.004748,
  55: 0.005198, 56: 0.005686, 57: 0.006213, 58: 0.006788, 59: 0.007429,
  60: 0.008156, 61: 0.008959, 62: 0.009829, 63: 0.010760, 64: 0.011760,
  65: 0.012843, 66: 0.014014, 67: 0.015278, 68: 0.016645, 69: 0.018134,
  70: 0.019771, 71: 0.021572, 72: 0.023551, 73: 0.025707, 74: 0.028050,
  75: 0.030618, 76: 0.033460, 77: 0.036620, 78: 0.040124, 79: 0.043994,
  80: 0.048252, 81: 0.052921, 82: 0.058025, 83: 0.063588, 84: 0.069637,
  85: 0.076197, 86: 0.083295, 87: 0.090958, 88: 0.099210, 89: 0.108077,
  90: 0.117583, 91: 0.127754, 92: 0.138612, 93: 0.150180, 94: 0.162481,
  95: 0.175535, 96: 0.189365, 97: 0.203989, 98: 0.219427, 99: 0.235696,
  100: 0.252813, 101: 0.270796, 102: 0.289661, 103: 0.309426, 104: 0.330105,
  105: 0.351716, 106: 0.374274, 107: 0.397795, 108: 0.422293, 109: 0.447784,
  110: 0.474285, 111: 0.501809, 112: 0.530372, 113: 0.559990, 114: 0.590677,
  115: 0.622450, 116: 0.655324, 117: 0.689314, 118: 0.724436, 119: 0.760707,
  120: 1.000000
};

// Health adjustment factors
const HEALTH_ADJUSTMENTS: { [status: string]: number } = {
  excellent: 0.7,
  good: 1.0,
  fair: 1.5,
  poor: 2.2
};

// Simulate survival for one year
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

function generateStochasticLifeExpectancyWithRandom(
  baseLifeExpectancy: number,
  currentAge: number,
  random: number
): number {
  let stochasticAge: number;
  
  if (random < 0.25) {
    const minAge = Math.max(currentAge + 5, baseLifeExpectancy - 8);
    const maxAge = baseLifeExpectancy - 3;
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  } else if (random < 0.75) {
    const minAge = baseLifeExpectancy - 2;
    const maxAge = baseLifeExpectancy + 2;
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  } else {
    const minAge = baseLifeExpectancy + 3;
    const maxAge = Math.min(baseLifeExpectancy + 7, 105);
    stochasticAge = minAge + rnd() * (maxAge - minAge);
  }
  
  const minLifeExpectancy = Math.max(currentAge + 1, 70);
  const maxLifeExpectancy = 105;
  
  return Math.round(Math.max(minLifeExpectancy, Math.min(maxLifeExpectancy, stochasticAge)));
}

// Asset correlations
const ASSET_CORRELATIONS = {
  stocks: { stocks: 1.00, bonds: 0.15, cash: 0.00 },
  bonds: { stocks: 0.15, bonds: 1.00, cash: 0.30 },
  cash: { stocks: 0.00, bonds: 0.30, cash: 1.00 }
};

// Cholesky decomposition
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

// Generate correlated returns
function generateCorrelatedReturns(
  stockAllocation: number,
  bondAllocation: number,
  cashAllocation: number,
  expectedReturn: number,
  volatility: number
): number {
  // Build correlation matrix
  const allocations = [stockAllocation, bondAllocation, cashAllocation];
  const activeAssets = allocations.filter(a => a > 0).length;
  
  if (activeAssets === 1) {
    // Single asset, no correlation needed
    const z = normalRandom();
    return expectedReturn + volatility * z;
  }
  
  // Simplified 3x3 correlation matrix
  const corrMatrix = [
    [1.00, 0.15, 0.00],
    [0.15, 1.00, 0.30],
    [0.00, 0.30, 1.00]
  ];
  
  // Cholesky decomposition
  const L = choleskyDecomposition(corrMatrix);
  
  // Generate independent random variables
  const Z = [normalRandom(), normalRandom(), normalRandom()];
  
  // Transform to correlated variables
  const correlatedZ = [
    L[0][0] * Z[0],
    L[1][0] * Z[0] + L[1][1] * Z[1],
    L[2][0] * Z[0] + L[2][1] * Z[1] + L[2][2] * Z[2]
  ];
  
  // Calculate weighted return
  const assetReturns = [
    expectedReturn * 1.2 + volatility * 1.2 * correlatedZ[0], // Stocks: higher return/vol
    expectedReturn * 0.5 + volatility * 0.3 * correlatedZ[1], // Bonds: lower return/vol
    expectedReturn * 0.3 + volatility * 0.1 * correlatedZ[2]  // Cash: lowest return/vol
  ];
  
  let portfolioReturn = 0;
  for (let i = 0; i < 3; i++) {
    portfolioReturn += allocations[i] * assetReturns[i];
  }
  
  return portfolioReturn;
}

// Apply Guyton-Klinger guardrails
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
  
  // Capital preservation rule
  if (currentWithdrawalRate > initialWithdrawalRate * 1.2) {
    withdrawal = previousWithdrawal * 0.9;
    adjustmentType = 'capital-preservation';
  }
  // Prosperity rule
  else if (currentWithdrawalRate < initialWithdrawalRate * 0.8) {
    withdrawal = previousWithdrawal * 1.1;
    adjustmentType = 'prosperity';
  }
  // Standard inflation adjustment
  else {
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
  
  // Generate stochastic life expectancy for this simulation run
  let stochasticLifeExpectancy: number;
  
  if (params.spouseAge && params.spouseLifeExpectancy) {
    // For couples, generate correlated life expectancies
    const couplesLife = generateCouplesStochasticLifeExpectancy(
      params.lifeExpectancy,
      params.currentAge,
      params.spouseLifeExpectancy,
      params.spouseAge,
      0.4
    );
    // Use the longer of the two for planning
    stochasticLifeExpectancy = Math.max(couplesLife.userLife, couplesLife.spouseLife);
  } else {
    // Single person
    stochasticLifeExpectancy = generateStochasticLifeExpectancy(
      params.lifeExpectancy,
      params.currentAge
    );
  }
  
  const retirementYears = stochasticLifeExpectancy - params.retirementAge;
  
  // Accumulation phase
  for (let year = 0; year < yearsToRetirement; year++) {
    // Add annual savings
    portfolio += params.annualSavings;
    
    // Generate correlated return
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
  
  // Distribution phase with dynamic mortality
  let currentWithdrawal = params.withdrawalRate * portfolio;
  let userAlive = true;
  let spouseAlive = params.spouseAge !== undefined;
  let guaranteedIncome = params.annualGuaranteedIncome;
  let age = params.currentAge + yearsToRetirement;
  let year = 0;
  
  // Continue simulation while at least one person is alive and has assets
  while ((userAlive || spouseAlive) && portfolio > 0 && year < 60) { // Cap at 60 years of retirement
    // Generate correlated return
    const annualReturn = generateCorrelatedReturns(
      params.stockAllocation,
      params.bondAllocation,
      params.cashAllocation,
      params.expectedReturn,
      params.returnVolatility
    );
    
    // Apply return first
    portfolio *= (1 + annualReturn);
    
    // Apply Guyton-Klinger if enabled
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
      // Standard inflation adjustment
      currentWithdrawal *= (1 + params.inflationRate);
    }
    
    // Calculate net withdrawal after guaranteed income
    const netWithdrawal = Math.max(0, currentWithdrawal - guaranteedIncome);
    
    // Apply tax gross-up
    const grossWithdrawal = netWithdrawal / (1 - params.taxRate);
    
    // Withdraw from portfolio
    portfolio -= grossWithdrawal;
    
    yearlyData.push({
      year: year + 1,
      portfolioBalance: Math.max(0, portfolio),
      withdrawal: grossWithdrawal,
      netWithdrawal: netWithdrawal
    });
    
    // Check for depletion
    if (portfolio <= 0 && yearsUntilDepletion === null) {
      yearsUntilDepletion = yearsToRetirement + year + 1;
      break;
    }
    
    // Simulate mortality at end of year
    if (params.spouseAge !== undefined) {
      // Couple simulation
      const spouseCurrentAge = params.spouseAge + yearsToRetirement + year;
      const survivalResult = simulateCouplesSurvival(
        age,
        params.userHealthStatus || 'good',
        spouseCurrentAge,
        params.spouseHealthStatus || 'good'
      );
      
      userAlive = survivalResult.userSurvives;
      spouseAlive = survivalResult.spouseSurvives;
      
      // If both died, simulation ends
      if (!survivalResult.eitherSurvives) {
        break;
      }
      
      // Adjust expenses if one spouse dies
      if (!userAlive && spouseAlive || userAlive && !spouseAlive) {
        currentWithdrawal *= 0.75; // Reduce expenses to 75%
        guaranteedIncome *= 0.60; // Social Security survivor benefit
      }
    } else {
      // Single person simulation
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
    
    // Store first scenario's yearly data
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
  const { type, id, params, iterations = 1000, batchSize = 100, startSeed = 12345 } = e.data;
  
  if (type === 'RUN_SIMULATION' && params) {
    try {
      const batches = Math.ceil(iterations / batchSize);
      const allEndingBalances: number[] = [];
      const allDepletionYears: (number | null)[] = [];
      let totalSuccessCount = 0;
      let firstYearlyData: any[] | undefined;
      
      for (let batch = 0; batch < batches; batch++) {
        const currentBatchSize = Math.min(batchSize, iterations - batch * batchSize);
        // Seed RNG deterministically for this batch; processBatch seeds per-iteration
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
