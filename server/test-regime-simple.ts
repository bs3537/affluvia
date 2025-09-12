/**
 * Simple test to verify regime-based Monte Carlo
 * 
 * Run with: npx tsx server/test-regime-simple.ts
 */

import { MARKET_REGIMES, getInitialRegime, transitionRegime } from './monte-carlo-enhanced';

console.log('=== Regime-Based Monte Carlo Simple Test ===\n');

// Test 1: Show regime parameters
console.log('Test 1: Market Regime Parameters\n');

console.log('Regime | Mean Return | Volatility | Avg Duration');
console.log('─'.repeat(50));

for (const [regime, params] of Object.entries(MARKET_REGIMES)) {
  console.log(`${regime.padEnd(7)}| ${(params.meanReturn * 100).toFixed(0).padStart(11)}% | ${(params.volatility * 100).toFixed(0).padStart(10)}% | ${params.avgDuration.toFixed(1).padStart(12)} years`);
}

// Test 2: Initial regime probabilities
console.log('\n\nTest 2: Initial Regime Probabilities\n');

const testCases = [
  { years: 30, name: 'Early Career (30 years to retirement)' },
  { years: 5, name: 'Near Retirement (5 years to retirement)' }
];

for (const test of testCases) {
  console.log(`\n${test.name}:`);
  const regimeCounts = { bull: 0, normal: 0, bear: 0, crisis: 0 };
  
  // Sample 1000 times
  for (let i = 0; i < 1000; i++) {
    const regime = getInitialRegime(test.years);
    regimeCounts[regime]++;
  }
  
  console.log(`  Bull:   ${(regimeCounts.bull / 10).toFixed(1)}%`);
  console.log(`  Normal: ${(regimeCounts.normal / 10).toFixed(1)}%`);
  console.log(`  Bear:   ${(regimeCounts.bear / 10).toFixed(1)}%`);
  console.log(`  Crisis: ${(regimeCounts.crisis / 10).toFixed(1)}%`);
}

// Test 3: Regime transitions
console.log('\n\nTest 3: Regime Transition Probabilities\n');

for (const [currentRegime, params] of Object.entries(MARKET_REGIMES)) {
  console.log(`\nFrom ${currentRegime}:`);
  for (const [nextRegime, prob] of Object.entries(params.transitionProbs)) {
    console.log(`  → ${nextRegime}: ${(prob * 100).toFixed(0)}%`);
  }
}

// Test 4: Simulate regime path
console.log('\n\nTest 4: Sample 30-Year Regime Path\n');

let regime = getInitialRegime(30);
const path = [regime];

for (let year = 1; year < 30; year++) {
  regime = transitionRegime(regime);
  path.push(regime);
}

// Count regimes in path
const pathCounts = { bull: 0, normal: 0, bear: 0, crisis: 0 };
path.forEach(r => pathCounts[r]++);

console.log('30-year simulation path:');
console.log(path.map((r, i) => `${i + 1}:${r.charAt(0).toUpperCase()}`).join(' '));
console.log('\nRegime distribution:');
console.log(`  Bull:   ${pathCounts.bull} years (${(pathCounts.bull / 30 * 100).toFixed(1)}%)`);
console.log(`  Normal: ${pathCounts.normal} years (${(pathCounts.normal / 30 * 100).toFixed(1)}%)`);
console.log(`  Bear:   ${pathCounts.bear} years (${(pathCounts.bear / 30 * 100).toFixed(1)}%)`);
console.log(`  Crisis: ${pathCounts.crisis} years (${(pathCounts.crisis / 30 * 100).toFixed(1)}%)`);

console.log('\n=== Test Complete ===');