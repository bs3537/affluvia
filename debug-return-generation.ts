/**
 * Debug return generation in isolation
 */

import { RNG } from './server/rng';

// Copy the key constants and functions we need to test
const ASSET_CLASS_PARAMS = {
  usStocks:   { expectedReturn: 0.10, volatility: 0.18 },
  intlStocks: { expectedReturn: 0.09, volatility: 0.20 },
  bonds:      { expectedReturn: 0.05, volatility: 0.05 },
  reits:      { expectedReturn: 0.08, volatility: 0.19 },
  cash:       { expectedReturn: 0.02, volatility: 0.01 }
};

const ASSET_CORRELATIONS = {
  usStocks:   { usStocks: 1.00, intlStocks: 0.75, bonds: 0.10, reits: 0.65, cash: 0.05 },
  intlStocks: { usStocks: 0.75, intlStocks: 1.00, bonds: 0.15, reits: 0.55, cash: 0.05 },
  bonds:      { usStocks: 0.10, intlStocks: 0.15, bonds: 1.00, reits: 0.25, cash: 0.20 },
  reits:      { usStocks: 0.65, intlStocks: 0.55, bonds: 0.25, reits: 1.00, cash: 0.10 },
  cash:       { usStocks: 0.05, intlStocks: 0.05, bonds: 0.20, reits: 0.10, cash: 1.00 }
};

function cagr2aagr(cagr: number, volatility: number): number {
  return cagr + (volatility * volatility) / 2;
}

function choleskyDecomposition(correlation: number[][]): number[][] {
  const n = correlation.length;
  const L: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      if (i === j) {
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[i][k];
        }
        const diag = correlation[i][j] - sum;
        if (diag < 0) {
          console.log(`Cholesky decomposition failed at [${i}][${j}]: diagonal = ${diag}`);
          L[i][j] = 0;
        } else {
          L[i][j] = Math.sqrt(diag);
        }
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

function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  const n = matrix.length;
  const result = new Array(n).fill(0);
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < vector.length; j++) {
      result[i] += matrix[i][j] * vector[j];
    }
  }
  
  return result;
}

function testCorrelatedReturns() {
  console.log('=== Testing Correlated Return Generation ===\n');
  
  const rng = new RNG(12345);
  
  // Test allocation
  const assetAllocation = {
    stocks: 0.42,      // 60% * 0.7
    intlStocks: 0.18,  // 60% * 0.3
    bonds: 0.3,
    reits: 0,
    cash: 0.1
  };
  
  console.log('Asset Allocation:');
  console.log(`  US Stocks: ${assetAllocation.stocks}`);
  console.log(`  Intl Stocks: ${assetAllocation.intlStocks}`);
  console.log(`  Bonds: ${assetAllocation.bonds}`);
  console.log(`  REITs: ${assetAllocation.reits}`);
  console.log(`  Cash: ${assetAllocation.cash}\n`);
  
  // Build asset arrays
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
  if (assetAllocation.cash > 0) {
    assetClasses.push('cash');
    allocations.push(assetAllocation.cash);
  }
  
  const n = assetClasses.length;
  console.log(`Number of asset classes: ${n}`);
  console.log(`Asset classes: ${assetClasses.join(', ')}\n`);
  
  // Build correlation matrix
  const correlationMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const asset1 = assetClasses[i] as keyof typeof ASSET_CORRELATIONS;
      const asset2 = assetClasses[j] as keyof typeof ASSET_CORRELATIONS;
      correlationMatrix[i][j] = ASSET_CORRELATIONS[asset1][asset2];
    }
  }
  
  console.log('Correlation Matrix:');
  for (let i = 0; i < n; i++) {
    console.log(`  ${assetClasses[i]}: ${correlationMatrix[i].map(x => x.toFixed(2)).join(', ')}`);
  }
  console.log();
  
  // Cholesky decomposition
  const L = choleskyDecomposition(correlationMatrix);
  console.log('Cholesky L Matrix:');
  for (let i = 0; i < n; i++) {
    console.log(`  ${L[i].map(x => x.toFixed(3)).join(', ')}`);
  }
  console.log();
  
  // Generate random Z values
  const Z = Array(n).fill(0).map(() => rng.normal());
  console.log('Random Z values:', Z.map(x => x.toFixed(3)).join(', '));
  
  // Transform to correlated
  const correlatedZ = multiplyMatrixVector(L, Z);
  console.log('Correlated Z values:', correlatedZ.map(x => x.toFixed(3)).join(', '));
  console.log();
  
  // Calculate returns for each asset
  let portfolioReturn = 0;
  console.log('Asset Returns:');
  
  for (let i = 0; i < n; i++) {
    const assetClass = assetClasses[i];
    const baseParams = ASSET_CLASS_PARAMS[assetClass as keyof typeof ASSET_CLASS_PARAMS];
    
    if (!baseParams) {
      console.log(`  ${assetClass}: NO PARAMS FOUND`);
      continue;
    }
    
    const baseAAGR = cagr2aagr(baseParams.expectedReturn, baseParams.volatility);
    console.log(`  ${assetClass}:`);
    console.log(`    Base CAGR: ${baseParams.expectedReturn}`);
    console.log(`    Base Volatility: ${baseParams.volatility}`);
    console.log(`    Base AAGR: ${baseAAGR.toFixed(4)}`);
    
    // Generate log-normal return
    const drift = Math.log(1 + baseAAGR) - 0.5 * baseParams.volatility * baseParams.volatility;
    const diffusion = baseParams.volatility * correlatedZ[i];
    const assetReturn = Math.exp(drift + diffusion) - 1;
    
    console.log(`    Drift: ${drift.toFixed(4)}`);
    console.log(`    Diffusion: ${diffusion.toFixed(4)}`);
    console.log(`    Asset Return: ${assetReturn.toFixed(4)}`);
    console.log(`    Is NaN: ${isNaN(assetReturn)}`);
    
    const allocation = allocations[i];
    portfolioReturn += assetReturn * allocation;
    console.log(`    Weighted Contribution: ${(assetReturn * allocation).toFixed(4)}`);
  }
  
  console.log(`\nPortfolio Return: ${portfolioReturn.toFixed(4)}`);
  console.log(`Portfolio Return is NaN: ${isNaN(portfolioReturn)}`);
}

// Run the test
testCorrelatedReturns();