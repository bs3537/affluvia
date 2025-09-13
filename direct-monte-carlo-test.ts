/**
 * Direct Monte Carlo Test for plaid@gmail.com
 * Bypasses validation to run the simulation directly
 */

import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';

console.log('🎯 DIRECT MONTE CARLO TEST: plaid@gmail.com');
console.log('=' .repeat(60));

async function runDirectTest() {
  try {
    // Get user and profile
    const user = await storage.getUserByEmail('plaid@gmail.com');
    if (!user) {
      throw new Error('User not found');
    }
    
    const profile = await storage.getFinancialProfile(user.id);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Convert to Monte Carlo parameters
    const params = profileToRetirementParams(profile);
    
    console.log('\n📊 CRITICAL PARAMETERS:');
    console.log(`  Current Retirement Assets: $${params.currentRetirementAssets.toLocaleString()}`);
    console.log(`  Annual Retirement Expenses: $${params.annualRetirementExpenses.toLocaleString()}`);
    console.log(`  Annual Guaranteed Income: $${params.annualGuaranteedIncome.toLocaleString()}`);
    console.log(`  Net Annual Withdrawal Needed: $${(params.annualRetirementExpenses - params.annualGuaranteedIncome).toLocaleString()}`);
    console.log(`  Tax Rate: ${(params.taxRate * 100).toFixed(2)}%`);
    console.log(`  Expected Return: ${(params.expectedReturn * 100).toFixed(2)}%`);
    console.log(`  Years to Retirement: ${params.retirementAge - params.currentAge}`);
    console.log(`  Years in Retirement: ${params.lifeExpectancy - params.retirementAge}`);

    // Manual calculation to understand the problem
    const yearsToRetirement = params.retirementAge - params.currentAge; // 35 years
    const yearsInRetirement = params.lifeExpectancy - params.retirementAge; // 28 years
    const annualWithdrawalNeed = params.annualRetirementExpenses - params.annualGuaranteedIncome;
    
    // Project assets at retirement
    const projectedAssets = params.currentRetirementAssets * Math.pow(1 + params.expectedReturn, yearsToRetirement);
    
    console.log('\n🔬 MANUAL ANALYSIS:');
    console.log(`  Assets projected at retirement: $${projectedAssets.toLocaleString()}`);
    console.log(`  Annual withdrawal needed: $${annualWithdrawalNeed.toLocaleString()}`);
    console.log(`  Initial withdrawal rate: ${((annualWithdrawalNeed / projectedAssets) * 100).toFixed(2)}%`);
    
    // Simple success check
    const totalWithdrawalsNeeded = annualWithdrawalNeed * yearsInRetirement;
    const simpleSuccess = projectedAssets > totalWithdrawalsNeeded;
    
    console.log(`  Total withdrawals over retirement: $${totalWithdrawalsNeeded.toLocaleString()}`);
    console.log(`  Simple static analysis: ${simpleSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);
    
    if (annualWithdrawalNeed <= 0) {
      console.log('\n🎉 DISCOVERY: Net withdrawal need is ≤ 0!');
      console.log('   Social Security + other guaranteed income covers all expenses');
      console.log('   This should result in ~100% success probability');
      console.log('   The 1% shown on dashboard is clearly WRONG!');
    }
    
    // Try to run a minimal simulation without validation
    console.log('\n🎲 ATTEMPTING SIMPLE SIMULATION:');
    
    // Simple Monte Carlo logic
    let successCount = 0;
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      // Simulate market returns (simple normal distribution approximation)
      let portfolioBalance = params.currentRetirementAssets;
      let success = true;
      
      // Accumulation phase
      for (let year = 0; year < yearsToRetirement; year++) {
        const marketReturn = params.expectedReturn + (Math.random() - 0.5) * params.returnVolatility * 2;
        portfolioBalance = portfolioBalance * (1 + marketReturn) + params.annualSavings;
      }
      
      // Withdrawal phase
      for (let year = 0; year < yearsInRetirement; year++) {
        const marketReturn = params.expectedReturn + (Math.random() - 0.5) * params.returnVolatility * 2;
        portfolioBalance = portfolioBalance * (1 + marketReturn) - annualWithdrawalNeed;
        
        if (portfolioBalance < 0) {
          success = false;
          break;
        }
      }
      
      if (success) successCount++;
    }
    
    const successRate = (successCount / iterations) * 100;
    console.log(`  Simple simulation result: ${successRate.toFixed(1)}% success rate`);
    
    // Compare with dashboard
    console.log('\n🔍 COMPARISON WITH DASHBOARD:');
    console.log(`  Dashboard shows: 1%`);
    console.log(`  Our calculation: ${successRate.toFixed(1)}%`);
    
    if (Math.abs(successRate - 1) > 10) {
      console.log('🚨 MAJOR DISCREPANCY CONFIRMED!');
      console.log('  Possible causes:');
      console.log('  1. Dashboard calculation has bug');
      console.log('  2. Dashboard using wrong/cached parameters');
      console.log('  3. Unit conversion error in dashboard');
      console.log('  4. Different calculation methodology');
    }
    
  } catch (error) {
    console.error('❌ Direct test failed:', error);
  }
}

runDirectTest();