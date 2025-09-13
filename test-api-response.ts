/**
 * Test API Response for plaid@gmail.com
 * Calls the same API endpoint the dashboard uses
 */

import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';
import { ProbabilityUtils } from './server/monte-carlo-validation';
import express from 'express';

console.log('🔍 TESTING API RESPONSE: /api/calculate-retirement-score');
console.log('=' .repeat(60));

async function testApiResponse() {
  try {
    // Get user and profile (same as API does)
    const user = await storage.getUserByEmail('plaid@gmail.com');
    if (!user) {
      throw new Error('User not found');
    }
    
    const profile = await storage.getFinancialProfile(user.id);
    if (!profile) {
      throw new Error('Profile not found');
    }

    console.log('\n📊 SIMULATING API ENDPOINT LOGIC:');
    
    // Convert to Monte Carlo parameters (same as API)
    const params = profileToRetirementParams(profile);
    
    // Run the simulation (bypassing validation for this test)
    console.log('Running Enhanced Monte Carlo simulation...');
    
    // Create a minimal version that doesn't use validation
    let result;
    try {
      // Try with a modified params that has a small tax rate
      const modifiedParams = { ...params, taxRate: Math.max(0.01, params.taxRate) };
      result = await runEnhancedMonteCarloSimulation(modifiedParams, 1000, false);
    } catch (error) {
      console.log('Enhanced Monte Carlo failed, using simplified calculation...');
      
      // Calculate manually what the API should return
      const yearsToRetirement = params.retirementAge - params.currentAge;
      const projectedAssets = params.currentRetirementAssets * Math.pow(1 + params.expectedReturn, yearsToRetirement);
      const annualWithdrawalNeed = params.annualRetirementExpenses - params.annualGuaranteedIncome;
      const withdrawalRate = annualWithdrawalNeed / projectedAssets;
      
      // Simple success determination
      const successProbability = withdrawalRate <= 0.04 ? 1.0 : Math.max(0.01, 1 - (withdrawalRate - 0.04) * 10);
      
      result = {
        probabilityOfSuccess: successProbability,
        successProbability: successProbability,
        medianEndingBalance: projectedAssets,
        scenarios: { successful: Math.round(successProbability * 1000), total: 1000 }
      };
    }
    
    // Apply the same logic as the API endpoint
    const probabilityDecimal = ProbabilityUtils.toDecimal(result.probabilityOfSuccess);
    const probabilityPercentage = ProbabilityUtils.toPercentage(probabilityDecimal);
    
    console.log('\n🔧 API ENDPOINT PROCESSING:');
    console.log(`  Raw result.probabilityOfSuccess: ${result.probabilityOfSuccess}`);
    console.log(`  After ProbabilityUtils.toDecimal(): ${probabilityDecimal}`);
    console.log(`  After ProbabilityUtils.toPercentage(): ${probabilityPercentage}`);
    
    // Simulate the score calculation logic from API
    let score = 0;
    let message = '';
    
    if (probabilityPercentage >= 90) {
      score = 95;
      message = 'Excellent! Your retirement plan is very well funded.';
    } else if (probabilityPercentage >= 80) {
      score = 85;
      message = 'Great! You\'re on track for a comfortable retirement.';
    } else if (probabilityPercentage >= 70) {
      score = 75;
      message = 'Good progress, but consider increasing savings.';
    } else if (probabilityPercentage >= 60) {
      score = 65;
      message = 'Fair, but improvements needed for security.';
    } else if (probabilityPercentage >= 50) {
      score = 55;
      message = 'At risk - significant changes recommended.';
    } else {
      score = 35;
      message = 'High risk - urgent action needed.';
    }
    
    // Create the API response object that would be returned
    const apiResponse = {
      score,
      probability: probabilityPercentage, // Display format (0-100)
      probabilityDecimal: probabilityDecimal, // Internal format (0-1) for consistency  
      message,
      cached: false,
      calculatedAt: new Date().toISOString(),
      calculationTime: 1000
    };
    
    console.log('\n📤 SIMULATED API RESPONSE:');
    console.log('  API would return:');
    console.log('  {');
    console.log(`    score: ${apiResponse.score},`);
    console.log(`    probability: ${apiResponse.probability}, // This goes to widget`);
    console.log(`    probabilityDecimal: ${apiResponse.probabilityDecimal},`);
    console.log(`    message: "${apiResponse.message}",`);
    console.log(`    cached: ${apiResponse.cached}`);
    console.log('  }');
    
    console.log('\n📱 WIDGET PROCESSING:');
    console.log('  Widget sees result.probability =', apiResponse.probability);
    console.log('  Widget sets displayProbability =', apiResponse.probability);
    console.log('  Widget calls clampProbability(' + apiResponse.probability + ') =', Math.min(100, Math.max(0, apiResponse.probability)));
    console.log('  Widget passes to Gauge value =', Math.min(100, Math.max(0, apiResponse.probability)));
    
    console.log('\n🎯 EXPECTED DASHBOARD DISPLAY:');
    if (apiResponse.probability === 1) {
      console.log('  🚨 PROBLEM: API returning probability=1 instead of 100');
      console.log('  Dashboard will show: 1% (WRONG)');
      console.log('  Should show: 100% (CORRECT)');
    } else if (apiResponse.probability >= 95) {
      console.log('  ✅ CORRECT: Dashboard should show ~100%');
    } else {
      console.log(`  Dashboard should show: ${apiResponse.probability}%`);
    }
    
    // Check current cached data
    console.log('\n💾 CHECKING CACHED DATA:');
    const currentProfile = await storage.getFinancialProfile(user.id);
    const cachedMC = currentProfile?.monteCarloSimulation?.retirementSimulation;
    
    if (cachedMC) {
      console.log('  Cached Monte Carlo found:');
      console.log(`    successProbability: ${cachedMC.results?.successProbability}`);
      console.log(`    probabilityOfSuccess: ${cachedMC.results?.probabilityOfSuccess}`);
      console.log(`    Is cached value causing the issue? Likely YES if this is ~0.01`);
    } else {
      console.log('  No cached Monte Carlo data found');
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

testApiResponse();