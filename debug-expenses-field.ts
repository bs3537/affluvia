#!/usr/bin/env tsx

/**
 * Debug script to identify the expectedMonthlyExpensesRetirement field issue
 * This script will check the actual profile data to understand the discrepancy
 */

import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';

async function debugExpensesField() {
  try {
    // Test with a specific user ID - using Alberta Simmons who has complete profile
    const userId = 2; // User with $3200 expected monthly expenses
    
    console.log('=== DEBUG: Expected Monthly Expenses Field Issue ===');
    
    // Get the current profile from database
    const profile = await storage.getFinancialProfile(userId);
    if (!profile) {
      console.log('❌ No profile found for user:', userId);
      return;
    }
    
    console.log('\n🔍 PROFILE DATA ANALYSIS:');
    console.log('User ID:', userId);
    console.log('Profile Last Updated:', profile.lastUpdated);
    
    // Check all possible expense-related fields
    console.log('\n💰 EXPENSE-RELATED FIELDS:');
    console.log('expectedMonthlyExpensesRetirement:', profile.expectedMonthlyExpensesRetirement);
    console.log('totalMonthlyExpenses:', profile.totalMonthlyExpenses);
    console.log('monthlyExpenses:', profile.monthlyExpenses);
    console.log('retirementExpenseBudget:', profile.retirementExpenseBudget);
    
    // Check the raw database row to see if there's field name mismatch
    const { db } = await import('./server/db');
    const { financialProfiles } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const rawProfile = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId));
    
    if (rawProfile[0]) {
      console.log('\n📊 RAW DATABASE FIELDS:');
      const raw = rawProfile[0] as any;
      console.log('expectedMonthlyExpensesRetirement (raw):', raw.expectedMonthlyExpensesRetirement);
      console.log('totalMonthlyExpenses (raw):', raw.totalMonthlyExpenses);
      console.log('monthlyExpenses (raw):', raw.monthlyExpenses);
    }
    
    // Test profileToRetirementParams function
    console.log('\n⚙️ MONTE CARLO PARAMETERS:');
    const params = profileToRetirementParams(profile);
    console.log('annualRetirementExpenses:', params.annualRetirementExpenses);
    console.log('baseAnnualRetirementExpenses in params:', (params as any).baseAnnualRetirementExpenses);
    
    // Check what the default calculation would be
    const defaultMonthly = 8000;
    const actualMonthly = Number(profile.expectedMonthlyExpensesRetirement) || defaultMonthly;
    const annualExpected = actualMonthly * 12;
    
    console.log('\n🧮 CALCULATIONS:');
    console.log('Expected monthly (from profile):', profile.expectedMonthlyExpensesRetirement);
    console.log('Actual monthly used:', actualMonthly);
    console.log('Annual expected:', annualExpected);
    console.log('Is using default?', actualMonthly === defaultMonthly);
    
    // Run a quick Monte Carlo to see the probability
    console.log('\n🎲 MONTE CARLO TEST:');
    const result = await runEnhancedMonteCarloSimulation(params, 100); // Small sample for speed
    console.log('Success Probability:', result.probabilityOfSuccess);
    console.log('Success Percentage:', (result.probabilityOfSuccess * 100).toFixed(1) + '%');
    
    // Test with modified expenses to see impact
    const modifiedProfile = { 
      ...profile, 
      expectedMonthlyExpensesRetirement: 6000  // Test with lower expenses
    };
    
    const modifiedParams = profileToRetirementParams(modifiedProfile);
    const modifiedResult = await runEnhancedMonteCarloSimulation(modifiedParams, 100);
    
    console.log('\n🔄 MODIFIED TEST (6K monthly expenses):');
    console.log('Modified Success Probability:', modifiedResult.probabilityOfSuccess);
    console.log('Modified Success Percentage:', (modifiedResult.probabilityOfSuccess * 100).toFixed(1) + '%');
    
    console.log('\n📈 IMPACT ANALYSIS:');
    const improvementPercentage = ((modifiedResult.probabilityOfSuccess - result.probabilityOfSuccess) * 100);
    console.log('Improvement from 8K->6K expenses:', improvementPercentage.toFixed(1) + ' percentage points');
    
  } catch (error) {
    console.error('❌ Error in debug script:', error);
  }
}

// Run the debug function
debugExpensesField().then(() => {
  console.log('\n✅ Debug analysis complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});