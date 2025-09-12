/**
 * Test the fixed validation with plaid@gmail.com's data
 * Should now pass validation and run Monte Carlo successfully
 */

import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';
import { MonteCarloValidator, ProbabilityUtils } from './server/monte-carlo-validation';

console.log('🧪 TESTING FIXED VALIDATION: plaid@gmail.com');
console.log('=' .repeat(50));

async function testFixedValidation() {
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
    
    console.log('\n🔍 VALIDATION TEST:');
    console.log(`  Tax Rate: ${(params.taxRate * 100).toFixed(2)}% (was failing before)`);
    
    // Test validation with fixed code
    const validationResult = MonteCarloValidator.validateParameters(params);
    
    console.log(`  Validation Result: ${validationResult.isValid ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (!validationResult.isValid) {
      console.log('  🚨 ERRORS:');
      validationResult.errors.forEach(error => {
        console.log(`    • ${error.field}: ${error.message}`);
      });
      return;
    }
    
    if (validationResult.warnings.length > 0) {
      console.log('  ⚠️  WARNINGS:');
      validationResult.warnings.forEach(warning => {
        console.log(`    • ${warning.field}: ${warning.message}`);
      });
    }
    
    // Test missing parameters check
    const missingParams = MonteCarloValidator.checkRequiredParameters(params);
    if (missingParams.length > 0) {
      console.log(`  ❌ Missing parameters: ${missingParams.join(', ')}`);
      return;
    }
    
    console.log('  ✅ All parameters present and valid');
    
    // Now try running the actual Monte Carlo simulation
    console.log('\n🎲 RUNNING ENHANCED MONTE CARLO:');
    
    const startTime = Date.now();
    const result = await runEnhancedMonteCarloSimulation(params, 1000, false);
    const duration = Date.now() - startTime;
    
    console.log(`  ✅ Simulation completed in ${duration}ms`);
    
    // Process the results with our standardized utils
    const probabilityDecimal = ProbabilityUtils.toDecimal(result.probabilityOfSuccess);
    const probabilityPercentage = ProbabilityUtils.toPercentage(probabilityDecimal);
    
    console.log('\n📊 RESULTS:');
    console.log(`  Raw probabilityOfSuccess: ${result.probabilityOfSuccess}`);
    console.log(`  Standardized decimal: ${probabilityDecimal}`);
    console.log(`  Display percentage: ${probabilityPercentage}%`);
    console.log(`  Median ending balance: $${result.medianEndingBalance?.toLocaleString()}`);
    
    // Simulate what the API endpoint would return
    console.log('\n📤 API WOULD RETURN:');
    console.log(`  probability: ${probabilityPercentage} (for widget display)`);
    console.log(`  probabilityDecimal: ${probabilityDecimal} (internal format)`);
    
    console.log('\n🎯 EXPECTED DASHBOARD BEHAVIOR:');
    if (probabilityPercentage >= 95) {
      console.log('  ✅ Widget should show ~100% success rate');
      console.log('  ✅ Status: "Highly Confident" (green)');
      console.log('  ✅ Message: "Excellent! Your retirement plan is very well funded."');
    } else {
      console.log(`  Widget should show: ${probabilityPercentage}% success rate`);
    }
    
    console.log('\n✅ VALIDATION AND ALGORITHM FIXES WORKING!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // If it's still a validation error, we have more work to do
    if (error.message?.includes('Invalid Monte Carlo parameters')) {
      console.log('\n🔍 Still have validation issues to fix...');
    }
  }
}

testFixedValidation();