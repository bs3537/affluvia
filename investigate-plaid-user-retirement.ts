/**
 * Investigation Script: plaid@gmail.com Retirement Success Probability Analysis
 * 
 * This script investigates why the dashboard shows only 1% retirement success
 * probability for the user plaid@gmail.com
 */

import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';
import { MonteCarloValidator, ProbabilityUtils } from './server/monte-carlo-validation';

console.log('🔍 INVESTIGATION: plaid@gmail.com Retirement Success Probability Analysis');
console.log('=' .repeat(80));

async function investigatePlaidUser() {
  try {
    // Phase 1: Pull Financial Profile Data
    console.log('\n📊 PHASE 1: Data Extraction');
    console.log('-'.repeat(40));
    
    console.log('Searching for user with email: plaid@gmail.com...');
    
    // Query the database for the user
    const user = await storage.getUserByEmail('plaid@gmail.com');
    
    if (!user) {
      throw new Error('❌ User with email plaid@gmail.com not found in database');
    }
    
    console.log(`✅ Found user: ID ${user.id}, Name: ${user.firstName} ${user.lastName}`);
    
    // Get financial profile
    const profile = await storage.getFinancialProfile(user.id);
    
    if (!profile) {
      throw new Error('❌ No financial profile found for user');
    }
    console.log('✅ Financial profile loaded');
    
    // Phase 2: Data Quality Analysis
    console.log('\n🔍 PHASE 2: Data Quality Analysis');
    console.log('-'.repeat(40));
    
    // Key demographic data
    console.log('\n👤 DEMOGRAPHIC DATA:');
    console.log(`  Age: ${profile.dateOfBirth ? calculateAge(profile.dateOfBirth) : 'Not provided'}`);
    console.log(`  Marital Status: ${profile.maritalStatus || 'Not provided'}`);
    console.log(`  Desired Retirement Age: ${profile.desiredRetirementAge || 'Not provided'}`);
    console.log(`  Life Expectancy: ${profile.userLifeExpectancy || 'Not provided'}`);
    
    if (profile.spouseDateOfBirth) {
      console.log(`  Spouse Age: ${calculateAge(profile.spouseDateOfBirth)}`);
      console.log(`  Spouse Retirement Age: ${profile.spouseDesiredRetirementAge || 'Not provided'}`);
      console.log(`  Spouse Life Expectancy: ${profile.spouseLifeExpectancy || 'Not provided'}`);
    }
    
    // Financial assets
    console.log('\n💰 ASSET DATA:');
    const totalRetirementAssets = (
      (Number(profile.current401kBalance) || 0) +
      (Number(profile.currentIRABalance) || 0) +
      (Number(profile.currentRothIRABalance) || 0) +
      (Number(profile.currentBrokerageBalance) || 0)
    );
    
    console.log(`  401(k) Balance: $${formatCurrency(Number(profile.current401kBalance) || 0)}`);
    console.log(`  IRA Balance: $${formatCurrency(Number(profile.currentIRABalance) || 0)}`);
    console.log(`  Roth IRA Balance: $${formatCurrency(Number(profile.currentRothIRABalance) || 0)}`);
    console.log(`  Brokerage Balance: $${formatCurrency(Number(profile.currentBrokerageBalance) || 0)}`);
    console.log(`  TOTAL RETIREMENT ASSETS: $${formatCurrency(totalRetirementAssets)}`);
    
    // Income and expenses
    console.log('\n💵 INCOME & EXPENSES:');
    console.log(`  Current Annual Income: $${formatCurrency(Number(profile.currentAnnualIncome) || 0)}`);
    console.log(`  Current Monthly Expenses: $${formatCurrency(Number(profile.currentMonthlyExpenses) || 0)}`);
    console.log(`  Desired Retirement Income: $${formatCurrency(Number(profile.desiredRetirementIncome) || 0)}`);
    
    // Social Security
    console.log('\n🏛️ SOCIAL SECURITY:');
    console.log(`  Estimated Monthly Benefit: $${formatCurrency(Number(profile.estimatedSocialSecurityBenefit) || 0)}`);
    console.log(`  Claiming Age: ${profile.socialSecurityClaimingAge || 'Not provided'}`);
    
    // Contributions
    console.log('\n📈 CONTRIBUTIONS:');
    console.log(`  Monthly 401(k): $${formatCurrency(Number(profile.monthlyContribution401k) || 0)}`);
    console.log(`  Monthly IRA: $${formatCurrency(Number(profile.monthlyContributionIRA) || 0)}`);
    console.log(`  Monthly Roth IRA: $${formatCurrency(Number(profile.monthlyContributionRothIRA) || 0)}`);
    console.log(`  Monthly Brokerage: $${formatCurrency(Number(profile.monthlyContributionBrokerage) || 0)}`);
    
    // Asset allocation
    console.log('\n📊 ASSET ALLOCATION:');
    let userAllocation = null;
    let spouseAllocation = null;
    
    try {
      userAllocation = profile.userAssetAllocation ? JSON.parse(profile.userAssetAllocation as any) : null;
      spouseAllocation = profile.spouseAssetAllocation ? JSON.parse(profile.spouseAssetAllocation as any) : null;
    } catch (e) {
      console.log('  Error parsing asset allocation data');
    }
    
    if (userAllocation) {
      console.log('  User Allocation:');
      console.log(`    US Stocks: ${(userAllocation.usStocks * 100).toFixed(1)}%`);
      console.log(`    Intl Stocks: ${(userAllocation.intlStocks * 100).toFixed(1)}%`);
      console.log(`    Bonds: ${(userAllocation.bonds * 100).toFixed(1)}%`);
      console.log(`    Cash: ${(userAllocation.cash * 100).toFixed(1)}%`);
      console.log(`    Alternatives: ${(userAllocation.alternatives * 100).toFixed(1)}%`);
      
      const totalAllocation = userAllocation.usStocks + userAllocation.intlStocks + 
                             userAllocation.bonds + userAllocation.cash + userAllocation.alternatives;
      console.log(`    TOTAL: ${(totalAllocation * 100).toFixed(1)}%`);
    }
    
    // Check for obvious data issues
    console.log('\n⚠️  DATA QUALITY ISSUES:');
    const issues = [];
    
    if (totalRetirementAssets < 1000) {
      issues.push(`Very low retirement assets: $${formatCurrency(totalRetirementAssets)}`);
    }
    
    if (!profile.dateOfBirth) {
      issues.push('Missing date of birth');
    }
    
    if (!profile.desiredRetirementAge) {
      issues.push('Missing desired retirement age');
    }
    
    if (!profile.userLifeExpectancy) {
      issues.push('Missing life expectancy');
    }
    
    if (!profile.desiredRetirementIncome && !profile.currentMonthlyExpenses) {
      issues.push('Missing retirement expense estimate');
    }
    
    if (issues.length > 0) {
      issues.forEach(issue => console.log(`  ❌ ${issue}`));
    } else {
      console.log('  ✅ No obvious data quality issues found');
    }
    
    // Phase 3: Parameter Conversion
    console.log('\n🔄 PHASE 3: Parameter Conversion');
    console.log('-'.repeat(40));
    
    try {
      const params = profileToRetirementParams(profile);
      
      console.log('\n📋 MONTE CARLO PARAMETERS:');
      console.log(`  Current Age: ${params.currentAge}`);
      console.log(`  Retirement Age: ${params.retirementAge}`);
      console.log(`  Life Expectancy: ${params.lifeExpectancy}`);
      console.log(`  Current Retirement Assets: $${formatCurrency(params.currentRetirementAssets)}`);
      console.log(`  Annual Retirement Expenses: $${formatCurrency(params.annualRetirementExpenses)}`);
      console.log(`  Annual Guaranteed Income: $${formatCurrency(params.annualGuaranteedIncome)}`);
      console.log(`  Expected Return: ${(params.expectedReturn * 100).toFixed(2)}%`);
      console.log(`  Return Volatility: ${(params.returnVolatility * 100).toFixed(2)}%`);
      console.log(`  Inflation Rate: ${(params.inflationRate * 100).toFixed(2)}%`);
      console.log(`  Tax Rate: ${(params.taxRate * 100).toFixed(2)}%`);
      console.log(`  Withdrawal Rate: ${(params.withdrawalRate * 100).toFixed(2)}%`);
      console.log(`  Stock Allocation: ${(params.stockAllocation * 100).toFixed(1)}%`);
      console.log(`  Bond Allocation: ${(params.bondAllocation * 100).toFixed(1)}%`);
      console.log(`  Cash Allocation: ${(params.cashAllocation * 100).toFixed(1)}%`);
      
      // Validate parameters
      const validationResult = MonteCarloValidator.validateParameters(params);
      
      console.log('\n✅ PARAMETER VALIDATION:');
      console.log(`  Valid: ${validationResult.isValid ? '✅ YES' : '❌ NO'}`);
      
      if (validationResult.errors.length > 0) {
        console.log('  🚨 ERRORS:');
        validationResult.errors.forEach(error => {
          console.log(`    • ${error.field}: ${error.message}`);
        });
      }
      
      if (validationResult.warnings.length > 0) {
        console.log('  ⚠️  WARNINGS:');
        validationResult.warnings.forEach(warning => {
          console.log(`    • ${warning.field}: ${warning.message}`);
        });
      }
      
      // Phase 4: Independent Monte Carlo Calculation
      console.log('\n🎲 PHASE 4: Independent Monte Carlo Simulation');
      console.log('-'.repeat(40));
      
      // For investigation purposes, run simulation even with validation warnings
      if (validationResult.isValid || validationResult.errors.length <= 1) {
        if (!validationResult.isValid) {
          console.log('⚠️  Running simulation despite validation errors for investigation purposes...');
        }
        console.log('Running Enhanced Monte Carlo simulation with 1000 iterations...');
        const startTime = Date.now();
        
        const result = await runEnhancedMonteCarloSimulation(params, 1000, true);
        
        const duration = Date.now() - startTime;
        console.log(`Simulation completed in ${duration}ms`);
        
        // Analyze results
        console.log('\n📊 SIMULATION RESULTS:');
        const probabilityDecimal = ProbabilityUtils.toDecimal(result.probabilityOfSuccess);
        const probabilityPercentage = ProbabilityUtils.toPercentage(probabilityDecimal);
        
        console.log(`  Success Probability: ${probabilityPercentage}% (${probabilityDecimal} decimal)`);
        console.log(`  Median Ending Balance: $${formatCurrency(result.medianEndingBalance || 0)}`);
        console.log(`  10th Percentile Balance: $${formatCurrency(result.percentile10EndingBalance || 0)}`);
        console.log(`  90th Percentile Balance: $${formatCurrency(result.percentile90EndingBalance || 0)}`);
        
        if (result.scenarios) {
          console.log(`  Successful Scenarios: ${result.scenarios.successful}/${result.scenarios.total}`);
        }
        
        // Compare with dashboard
        console.log('\n🔍 PHASE 5: Dashboard Comparison');
        console.log('-'.repeat(40));
        
        console.log('Dashboard shows: 1% success probability');
        console.log(`Our calculation: ${probabilityPercentage}% success probability`);
        
        if (Math.abs(probabilityPercentage - 1) > 0.5) {
          console.log('🚨 SIGNIFICANT DISCREPANCY DETECTED!');
          console.log('Possible causes:');
          console.log('  1. Dashboard using cached/outdated calculation');
          console.log('  2. Different parameters being used');
          console.log('  3. Bug in dashboard display logic');
          console.log('  4. Unit conversion error');
        } else {
          console.log('✅ Results match - user genuinely has very low success probability');
        }
        
        // Analyze why success rate is low (if it is)
        if (probabilityPercentage < 20) {
          console.log('\n💡 LOW SUCCESS RATE ANALYSIS:');
          analyzeFailureReasons(params, result);
        }
        
      } else {
        console.log('❌ Cannot run simulation - parameter validation failed');
      }
      
    } catch (paramError) {
      console.error('❌ Error in parameter conversion:', paramError);
    }
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
    throw error;
  }
}

function calculateAge(birthDate: string | Date): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function analyzeFailureReasons(params: any, result: any) {
  const yearsToRetirement = params.retirementAge - params.currentAge;
  const yearsInRetirement = params.lifeExpectancy - params.retirementAge;
  
  console.log('  Potential Issues:');
  
  // Asset adequacy
  const projectedAssets = params.currentRetirementAssets * Math.pow(1.07, yearsToRetirement);
  const annualWithdrawalNeed = params.annualRetirementExpenses - params.annualGuaranteedIncome;
  const assetsToExpenseRatio = projectedAssets / annualWithdrawalNeed;
  
  console.log(`    • Assets at retirement: $${formatCurrency(projectedAssets)} (projected)`);
  console.log(`    • Annual withdrawal needed: $${formatCurrency(annualWithdrawalNeed)}`);
  console.log(`    • Asset-to-expense ratio: ${assetsToExpenseRatio.toFixed(1)}x`);
  
  if (assetsToExpenseRatio < 20) {
    console.log(`    🚨 CRITICAL: Very low asset-to-expense ratio (<20x)`);
  }
  
  if (params.currentRetirementAssets < 50000) {
    console.log(`    🚨 Very low current assets: $${formatCurrency(params.currentRetirementAssets)}`);
  }
  
  if (params.annualRetirementExpenses > 100000) {
    console.log(`    ⚠️  High retirement expenses: $${formatCurrency(params.annualRetirementExpenses)}`);
  }
  
  if (yearsToRetirement < 10) {
    console.log(`    ⚠️  Short time to retirement: ${yearsToRetirement} years`);
  }
  
  if (yearsInRetirement > 30) {
    console.log(`    ⚠️  Long retirement period: ${yearsInRetirement} years`);
  }
  
  const withdrawalRate = annualWithdrawalNeed / projectedAssets;
  if (withdrawalRate > 0.05) {
    console.log(`    🚨 HIGH: Required withdrawal rate: ${(withdrawalRate * 100).toFixed(2)}% (>5%)`);
  }
}

// Run the investigation
investigatePlaidUser().then(() => {
  console.log('\n✅ Investigation completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Investigation failed:', error);
  process.exit(1);
});