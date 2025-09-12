// Stress Test Engine for Retirement Planning Monte Carlo Simulations

import { 
  RetirementMonteCarloParams,
  profileToRetirementParams
} from './monte-carlo-base';
import { mcPool } from './services/mc-pool';
import { 
  StressScenario, 
  StressTestRequest, 
  StressTestResult, 
  StressTestResponse 
} from '../shared/stress-test-types';
import { applyOptimizationVariables } from './services/apply-optimization-variables';

// Deprecated local helper retained for reference (no longer used)
function applyOptimizationVariablesToProfile(profile: any, variables: any) {
    const optimized = { ...profile };
    // Ages
    if (variables.retirementAge !== undefined) optimized.desiredRetirementAge = variables.retirementAge;
    if (variables.spouseRetirementAge !== undefined) optimized.spouseDesiredRetirementAge = variables.spouseRetirementAge;
    // Social Security claim ages
    if (variables.socialSecurityAge !== undefined) optimized.socialSecurityClaimAge = variables.socialSecurityAge;
    if (variables.spouseSocialSecurityAge !== undefined) optimized.spouseSocialSecurityClaimAge = variables.spouseSocialSecurityAge;
    // Asset allocation selection (consistent with intake Step 11)
    if (variables.assetAllocation) {
      optimized.expectedRealReturn =
        variables.assetAllocation === 'glide-path' ? -1 :
        variables.assetAllocation === 'current-allocation' ? -2 :
        isNaN(parseFloat(variables.assetAllocation)) ? optimized.expectedRealReturn :
        parseFloat(variables.assetAllocation) / 100;
    }
    // LTC
    if (typeof variables.hasLongTermCareInsurance === 'boolean') {
      optimized.hasLongTermCareInsurance = variables.hasLongTermCareInsurance;
    }
    // Contributions
    if (variables.monthlyEmployee401k !== undefined) {
      optimized.monthlyContribution401k = variables.monthlyEmployee401k;
      optimized.retirementContributions = {
        ...optimized.retirementContributions,
        employee: variables.monthlyEmployee401k
      };
    }
    if (variables.monthlyEmployer401k !== undefined) {
      optimized.monthlyEmployerContribution401k = variables.monthlyEmployer401k;
      optimized.retirementContributions = {
        ...optimized.retirementContributions,
        employer: variables.monthlyEmployer401k
      };
    }
    if (variables.annualTraditionalIRA !== undefined) optimized.traditionalIRAContribution = variables.annualTraditionalIRA;
    if (variables.annualRothIRA !== undefined) optimized.rothIRAContribution = variables.annualRothIRA;
    if (variables.spouseMonthlyEmployee401k !== undefined) {
      optimized.spouseMonthlyContribution401k = variables.spouseMonthlyEmployee401k;
      optimized.spouseRetirementContributions = {
        ...optimized.spouseRetirementContributions,
        employee: variables.spouseMonthlyEmployee401k
      };
    }
    if (variables.spouseMonthlyEmployer401k !== undefined) {
      optimized.spouseMonthlyEmployerContribution401k = variables.spouseMonthlyEmployer401k;
      optimized.spouseRetirementContributions = {
        ...optimized.spouseRetirementContributions,
        employer: variables.spouseMonthlyEmployer401k
      };
    }
    if (variables.spouseAnnualTraditionalIRA !== undefined) optimized.spouseTraditionalIRAContribution = variables.spouseAnnualTraditionalIRA;
    if (variables.spouseAnnualRothIRA !== undefined) optimized.spouseRothIRAContribution = variables.spouseAnnualRothIRA;
    // Retirement monthly spending and part-time income
    if (variables.monthlyExpenses !== undefined) optimized.expectedMonthlyExpensesRetirement = variables.monthlyExpenses;
    if (variables.partTimeIncome !== undefined) optimized.partTimeIncomeRetirement = variables.partTimeIncome;
    if (variables.spousePartTimeIncome !== undefined) optimized.spousePartTimeIncomeRetirement = variables.spousePartTimeIncome;
    return optimized;
}

// Deep clone helper for params
function cloneParams(params: RetirementMonteCarloParams): RetirementMonteCarloParams {
  return JSON.parse(JSON.stringify(params));
}

// Apply bear market stress to portfolio
export function applyBearMarketStress(
  params: RetirementMonteCarloParams, 
  timing: 'immediate' | 'retirement' | 'ongoing' | undefined,
  magnitude: number
): RetirementMonteCarloParams {
  const stressedParams = cloneParams(params);
  const dropFactor = 1 + (magnitude / 100); // magnitude is negative, e.g., -30
  
  // Log for debugging
  console.log('Bear market stress:', {
    originalAssets: params.currentRetirementAssets,
    magnitude,
    dropFactor,
    timing
  });
  
  if (timing === 'immediate') {
    // Apply immediate portfolio shock
    // Ensure we don't go below a minimum threshold ($10K for validation)
    const newAssets = Math.max(10000, stressedParams.currentRetirementAssets * dropFactor);
    stressedParams.currentRetirementAssets = newAssets;
    
    // Also adjust bucket allocations proportionally
    if (stressedParams.assetBuckets) {
      const adjustmentRatio = newAssets / params.currentRetirementAssets;
      stressedParams.assetBuckets.taxDeferred = Math.max(0, stressedParams.assetBuckets.taxDeferred * adjustmentRatio);
      stressedParams.assetBuckets.taxFree = Math.max(0, stressedParams.assetBuckets.taxFree * adjustmentRatio);
      stressedParams.assetBuckets.capitalGains = Math.max(0, stressedParams.assetBuckets.capitalGains * adjustmentRatio);
      stressedParams.assetBuckets.cashEquivalents = Math.max(0, stressedParams.assetBuckets.cashEquivalents * adjustmentRatio);
      stressedParams.assetBuckets.totalAssets = Math.max(0, stressedParams.assetBuckets.totalAssets * adjustmentRatio);
    }
  } else if (timing === 'retirement') {
    // Flag for first-year retirement crash
    // This will be handled in the Monte Carlo simulation by forcing negative returns in year 1
    (stressedParams as any).forceFirstYearCrash = magnitude;
  }
  
  // Increase market volatility to reflect stressed conditions
  stressedParams.returnVolatility = Math.min(0.25, stressedParams.returnVolatility * 1.5);
  
  return stressedParams;
}

// Apply inflation stress
export function applyInflationStress(
  params: RetirementMonteCarloParams,
  inflationRate: number
): RetirementMonteCarloParams {
  const stressedParams = cloneParams(params);
  
  // Override inflation rate (convert percentage to decimal)
  stressedParams.inflationRate = inflationRate / 100;
  
  // Adjust expense growth to account for higher inflation
  // Expenses will grow faster in real terms
  const inflationMultiplier = (1 + inflationRate / 100) / (1 + 0.025); // Relative to baseline 2.5%
  stressedParams.annualRetirementExpenses = stressedParams.annualRetirementExpenses * Math.pow(inflationMultiplier, 5);
  
  // Reduce real returns to account for higher inflation
  const inflationImpact = (inflationRate - 2.5) / 100; // Difference from baseline
  stressedParams.expectedReturn = Math.max(0.01, stressedParams.expectedReturn - inflationImpact);
  
  return stressedParams;
}

// Apply longevity stress
export function applyLongevityStress(
  params: RetirementMonteCarloParams,
  additionalYears: number
): RetirementMonteCarloParams {
  const stressedParams = cloneParams(params);
  
  // Extend life expectancy
  stressedParams.lifeExpectancy = stressedParams.lifeExpectancy + additionalYears;
  
  if (stressedParams.spouseAge !== undefined) {
    stressedParams.spouseLifeExpectancy = (stressedParams.spouseLifeExpectancy || 93) + additionalYears;
  }
  
  // Adjust stochastic life expectancy parameters if present
  if ((stressedParams as any).stochasticLifeExpectancy) {
    (stressedParams as any).stochasticLifeExpectancy.baseExpectancy += additionalYears;
    (stressedParams as any).stochasticLifeExpectancy.maxAge = Math.min(120, 
      (stressedParams as any).stochasticLifeExpectancy.maxAge + additionalYears);
  }
  
  return stressedParams;
}

// Apply healthcare cost stress
export function applyHealthcareCostStress(
  params: RetirementMonteCarloParams,
  increasePercentage: number
): RetirementMonteCarloParams {
  const stressedParams = cloneParams(params);
  const multiplier = 1 + (increasePercentage / 100);
  
  // Increase healthcare costs
  if (stressedParams.healthcareCosts) {
    stressedParams.healthcareCosts.baseCost *= multiplier;
    stressedParams.healthcareCosts.supplementalInsurance *= multiplier;
    stressedParams.healthcareCosts.prescriptionDrugs *= multiplier;
    stressedParams.healthcareCosts.outOfPocket *= multiplier;
    stressedParams.healthcareCosts.dental *= multiplier;
    stressedParams.healthcareCosts.vision *= multiplier;
    stressedParams.healthcareCosts.hearing *= multiplier;
  }
  
  // Also increase general retirement expenses to reflect higher healthcare portion
  const healthcarePortion = 0.15; // Assume 15% of expenses are healthcare-related
  const expenseIncrease = (increasePercentage / 100) * healthcarePortion;
  stressedParams.annualRetirementExpenses *= (1 + expenseIncrease);
  
  return stressedParams;
}

// Apply Social Security reduction
export function applySocialSecurityReduction(
  params: RetirementMonteCarloParams,
  reductionPercentage: number
): RetirementMonteCarloParams {
  const stressedParams = cloneParams(params);
  const multiplier = 1 + (reductionPercentage / 100); // reductionPercentage is negative
  
  // Reduce Social Security benefits
  stressedParams.annualGuaranteedIncome = stressedParams.annualGuaranteedIncome * multiplier;
  
  // Also adjust the detailed SS benefits if available
  if ((stressedParams as any).socialSecurityBenefit) {
    (stressedParams as any).socialSecurityBenefit *= multiplier;
  }
  if ((stressedParams as any).spouseSocialSecurityBenefit) {
    (stressedParams as any).spouseSocialSecurityBenefit *= multiplier;
  }
  
  return stressedParams;
}

// Apply tax increase stress
export function applyTaxIncrease(
  params: RetirementMonteCarloParams,
  increasePercentage: number
): RetirementMonteCarloParams {
  const stressedParams = cloneParams(params);
  const multiplier = 1 + (increasePercentage / 100);
  
  // Increase tax rate
  stressedParams.taxRate = Math.min(0.5, stressedParams.taxRate * multiplier);
  
  // Increase effective tax rate if present
  if ((stressedParams as any).effectiveTaxRate) {
    (stressedParams as any).effectiveTaxRate = Math.min(0.5, 
      (stressedParams as any).effectiveTaxRate * multiplier);
  }
  
  // Increase marginal tax rate if present
  if ((stressedParams as any).marginalTaxRate) {
    (stressedParams as any).marginalTaxRate = Math.min(0.5, 
      (stressedParams as any).marginalTaxRate * multiplier);
  }
  
  return stressedParams;
}

// Apply return reduction stress
export function applyReturnReduction(
  params: RetirementMonteCarloParams,
  reductionPercentage: number
): RetirementMonteCarloParams {
  const stressedParams = cloneParams(params);
  
  // Reduce expected return (reductionPercentage is negative)
  const reduction = Math.abs(reductionPercentage) / 100;
  stressedParams.expectedReturn = Math.max(0.01, stressedParams.expectedReturn - reduction);
  
  // Also adjust risk-based returns if using risk profile
  if (stressedParams.useRiskProfile && (stressedParams as any).riskProfile) {
    const profile = (stressedParams as any).riskProfile;
    profile.expectedReturn = Math.max(0.01, profile.expectedReturn - reduction);
  }
  
  return stressedParams;
}

// Apply early retirement stress
export function applyEarlyRetirement(
  params: RetirementMonteCarloParams,
  yearsEarlier: number
): RetirementMonteCarloParams {
  const stressedParams = cloneParams(params);
  
  // Reduce retirement age (yearsEarlier is negative)
  const reduction = Math.abs(yearsEarlier);
  stressedParams.retirementAge = Math.max(50, stressedParams.retirementAge - reduction);
  
  if (stressedParams.spouseAge !== undefined && stressedParams.spouseRetirementAge) {
    stressedParams.spouseRetirementAge = Math.max(50, stressedParams.spouseRetirementAge - reduction);
  }
  
  // Reduce years of savings accumulation
  const lostSavingsYears = reduction;
  const annualSavingsLoss = stressedParams.annualSavings * lostSavingsYears;
  
  // Approximate the portfolio impact (simplified - doesn't account for growth)
  // CRITICAL: Ensure assets never go below minimum threshold for validation
  const minAssets = 10000; // Minimum $10K to pass validation
  stressedParams.currentRetirementAssets = Math.max(minAssets, 
    stressedParams.currentRetirementAssets - annualSavingsLoss * 0.7); // Assume 70% would have been saved
  
  // Also means more years of retirement to fund
  // This is automatically handled by the earlier retirement age
  
  return stressedParams;
}

// Apply all enabled stress scenarios to parameters
export function applyStressScenarios(
  baseParams: RetirementMonteCarloParams,
  scenarios: StressScenario[]
): RetirementMonteCarloParams {
  let stressedParams = cloneParams(baseParams);
  
  for (const scenario of scenarios) {
    if (!scenario.enabled) continue;
    
    switch (scenario.id) {
      case 'bear-market-immediate':
        stressedParams = applyBearMarketStress(
          stressedParams, 
          scenario.parameters.timing, 
          scenario.parameters.value
        );
        break;
        
      case 'bear-market-retirement':
        stressedParams = applyBearMarketStress(
          stressedParams,
          scenario.parameters.timing,
          scenario.parameters.value
        );
        break;
        
      case 'high-inflation':
        stressedParams = applyInflationStress(
          stressedParams,
          scenario.parameters.value
        );
        break;
        
      case 'longevity':
        stressedParams = applyLongevityStress(
          stressedParams,
          scenario.parameters.value
        );
        break;
        
      case 'healthcare-costs':
        stressedParams = applyHealthcareCostStress(
          stressedParams,
          scenario.parameters.value
        );
        break;
        
      case 'social-security-cut':
        stressedParams = applySocialSecurityReduction(
          stressedParams,
          scenario.parameters.value
        );
        break;
        
      case 'higher-taxes':
        stressedParams = applyTaxIncrease(
          stressedParams,
          scenario.parameters.value
        );
        break;
        
      case 'lower-returns':
        stressedParams = applyReturnReduction(
          stressedParams,
          scenario.parameters.value
        );
        break;
        
      case 'early-retirement':
        stressedParams = applyEarlyRetirement(
          stressedParams,
          scenario.parameters.value
        );
        break;
    }
  }
  
  return stressedParams;
}

// Main function to run stress tests
export async function runStressTests(
  profile: any,
  request: StressTestRequest
): Promise<StressTestResponse> {
  // Support both new and old field names for backwards compatibility
  const optimizationVariables = (request as any).optimizationVariables || (request as any).baselineVariables;
  const plan = optimizationVariables ? 'optimized' : 'baseline';
  
  // Get baseline parameters
  const baseParams = profileToRetirementParams(profile);
  
  // Ensure base params have valid assets
  if (!baseParams.currentRetirementAssets || baseParams.currentRetirementAssets <= 0) {
    console.error('ERROR: Base params have invalid assets:', baseParams.currentRetirementAssets);
    baseParams.currentRetirementAssets = 10000; // Minimum fallback value
  }
  
  // Create optimized parameters if optimization variables provided
  let optimizedParams = baseParams;
  if (optimizationVariables) {
    // Use the shared utility function to apply optimization variables for consistency
    const optimizedProfile = applyOptimizationVariables(profile, optimizationVariables);
    optimizedParams = profileToRetirementParams(optimizedProfile);
    
    // CRITICAL FIX: Ensure assets are preserved from base params if they become 0 or negative
    if (!optimizedParams.currentRetirementAssets || optimizedParams.currentRetirementAssets <= 0) {
      console.log('WARNING: Optimized params resulted in zero/negative assets, using base assets');
      optimizedParams.currentRetirementAssets = baseParams.currentRetirementAssets || 10000;
      if (optimizedParams.assetBuckets && baseParams.assetBuckets) {
        optimizedParams.assetBuckets = { ...baseParams.assetBuckets };
      }
    }
    
    console.log('===== STRESS TEST OPTIMIZATION VARIABLES =====');
    console.log('Plan:', plan);
    console.log('Input variables:', {
      retirementAge: optimizationVariables.retirementAge,
      socialSecurityAge: optimizationVariables.socialSecurityAge,
      monthlyExpenses: optimizationVariables.monthlyExpenses,
      hasOptimized: optimizationVariables.hasOptimized,
      isLocked: optimizationVariables.isLocked
    });
    console.log('Applied to profile:', {
      retirementAge: optimizedProfile.desiredRetirementAge,
      socialSecurityAge: optimizedProfile.socialSecurityClaimAge,
      monthlyExpenses: optimizedProfile.expectedMonthlyExpensesRetirement
    });
    console.log('Expected optimized score:', optimizationVariables.optimizedScore?.probabilityOfSuccess || 'N/A');
    console.log('===============================================');
  } else {
    console.log('===== RUNNING BASELINE STRESS TEST =====');
    console.log('Plan:', plan);
    console.log('Using baseline profile values without optimization');
    console.log('Key parameters:', {
      retirementAge: baseParams.retirementAge,
      socialSecurityAge: baseParams.socialSecurityClaimAge,
      monthlyExpenses: baseParams.annualRetirementExpenses / 12,
      currentAssets: baseParams.currentRetirementAssets
    });
    console.log('===============================================');
  }
  
  // Determine which parameters to use as the source for scenarios
  const sourceParams = optimizationVariables ? optimizedParams : baseParams;
  
  // Log parameters for debugging
  console.log('Source parameters for stress test:', {
    currentRetirementAssets: sourceParams.currentRetirementAssets,
    hasAssetBuckets: !!sourceParams.assetBuckets,
    plan
  });
  
  // Validate source parameters before running stress tests
  if (!sourceParams.currentRetirementAssets || sourceParams.currentRetirementAssets <= 0) {
    console.error('Invalid currentRetirementAssets:', sourceParams.currentRetirementAssets);
    // Set a minimum value to allow stress tests to proceed
    sourceParams.currentRetirementAssets = 10000; // $10K minimum for stress testing
    console.log('Set minimum currentRetirementAssets to $10,000 for stress testing');
  }
  
  // Run simulation with correct parameters based on plan type
  const simulationCount = (request as any).simulationCount || 1000;
  console.log(`Running ${plan} Monte Carlo simulation with ${simulationCount} iterations...`);
  const baselineResult = await mcPool.run({ params: sourceParams, simulationCount, type: 'score' });
  const baselineSuccessProbability = baselineResult.fullResult?.successProbability || baselineResult.fullResult?.probabilityOfSuccess || 0;
  
  // Run individual stress tests
  const individualResults: StressTestResult[] = [];
  
  for (const scenario of request.scenarios) {
    if (!scenario.enabled) continue;
    
    console.log(`Running stress test: ${scenario.name}...`);
    
    // Apply only this scenario using the source parameters (baseline or optimized)
    const stressedParams = applyStressScenarios(sourceParams, [scenario]);
    
    // Run Monte Carlo with stressed parameters
    const stressedResult = await mcPool.run({ params: stressedParams, simulationCount, type: 'score' });
    
    // Calculate impact
    const successProb = stressedResult.fullResult?.successProbability || stressedResult.fullResult?.probabilityOfSuccess || 0;
    // Report absolute percentage points delta to match UI labeling
    const impactPercentage = (successProb - baselineSuccessProbability) * 100;
    
    individualResults.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      successProbability: successProb,
      baselineSuccessProbability,
      impactPercentage,
      impactDescription: `${scenario.name} ${impactPercentage >= 0 ? 'increases' : 'reduces'} success probability by ${Math.abs(impactPercentage).toFixed(1)} pts`,
      details: {
        medianPortfolioValue: stressedResult.fullResult?.summary?.medianFinalValue || stressedResult.fullResult?.portfolioPercentiles?.[50],
        yearlyCashFlows: stressedResult.fullResult?.yearlyCashFlows
      }
    });
  }
  
  // Run combined stress test if requested
  let combinedResult: StressTestResult | undefined;
  
  if (request.runCombined && request.scenarios.filter(s => s.enabled).length > 1) {
    console.log('Running combined stress test...');
    
    // Apply all enabled scenarios using the source parameters (baseline or optimized)
    const combinedStressedParams = applyStressScenarios(
      sourceParams, 
      request.scenarios.filter(s => s.enabled)
    );
    
    // Run Monte Carlo with all stresses combined
    const combinedStressedResult = await mcPool.run({ params: combinedStressedParams, simulationCount, type: 'score' });
    
    const combinedSuccessProb = combinedStressedResult.fullResult?.successProbability || combinedStressedResult.fullResult?.probabilityOfSuccess || 0;
    const combinedImpact = (combinedSuccessProb - baselineSuccessProbability) * 100;
    
    combinedResult = {
      scenarioId: 'combined',
      scenarioName: 'Combined Stress Scenarios',
      successProbability: combinedSuccessProb,
      baselineSuccessProbability,
      impactPercentage: combinedImpact,
      impactDescription: `Combined scenarios ${combinedImpact >= 0 ? 'increase' : 'reduce'} success probability by ${Math.abs(combinedImpact).toFixed(1)} pts`,
      details: {
        medianPortfolioValue: combinedStressedResult.fullResult?.summary?.medianFinalValue || combinedStressedResult.fullResult?.portfolioPercentiles?.[50],
        yearlyCashFlows: combinedStressedResult.fullResult?.yearlyCashFlows
      }
    };
  }
  
  return {
    plan,
    baseline: {
      successProbability: baselineSuccessProbability,
      details: {
        medianFinalValue: baselineResult.fullResult?.summary?.medianFinalValue,
        yearlyCashFlows: baselineResult.fullResult?.yearlyCashFlows
      }
    },
    individualResults,
    combinedResult,
    timestamp: Date.now(),
    planEcho: {
      plan,
      retirementAge: sourceParams.retirementAge,
      socialSecurityAge: sourceParams.socialSecurityStartAge,
      monthlyExpenses: Math.round(sourceParams.annualRetirementExpenses / 12)
    }
  };
}
