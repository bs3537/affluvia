import { runRightCapitalStyleMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';
import { aggregateAssetsByType } from './retirement-withdrawal';

export interface MonteCarloWithdrawalData {
  year: number;
  age: number;
  spouseAge?: number;
  monthlyExpenses: number;
  
  // Working income (pre-retirement)
  workingIncome: number;
  spouseWorkingIncome: number;
  
  // Income sources
  socialSecurity: number;
  spouseSocialSecurity: number;
  pension: number;
  spousePension: number;
  partTimeIncome: number;
  spousePartTimeIncome: number;
  
  // Portfolio balance with percentiles
  portfolioBalance: {
    // Primary bands (aligned to dashboard): 5/25/50/75/95
    p5?: number;
    p25: number;
    p50: number;
    p75: number;
    p95?: number;
    // Backward compatibility fields
    p10?: number;
    p90?: number;
  };
  
  // Withdrawals by account type (simplified)
  taxableWithdrawal: number;
  taxDeferredWithdrawal: number;
  taxFreeWithdrawal: number;
  hsaWithdrawal: number;
  
  // Account balances (simplified)
  taxableBalance: number;
  taxDeferredBalance: number;
  taxFreeBalance: number;
  hsaBalance: number;
  
  // Summary
  totalIncome: number;
  totalWithdrawals: number;
  totalBalance: number;
  withdrawalTax: number;
  netIncome: number;
  rmdAmount?: number;
  
  // Monte Carlo specific
  successProbability: number;
  failureYear?: boolean;
  marketRegime?: string;
  portfolioReturn?: number;
}

export interface MonteCarloWithdrawalResult {
  projections: MonteCarloWithdrawalData[];
  monteCarloSummary: {
    probabilityOfSuccess: number;
    medianEndingBalance: number;
    percentile10EndingBalance: number;
    percentile90EndingBalance: number;
    totalScenarios: number;
    successfulScenarios: number;
    failedScenarios: number;
    averageYearsUntilDepletion?: number;
    taxableDepletionYear?: number;
    taxDeferredDepletionYear?: number;
    totalLifetimeTax: number;
  };
}

export async function calculateMonteCarloWithdrawalSequence(
  profile: any,
  optimizationVariables?: any
): Promise<MonteCarloWithdrawalResult> {
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 MONTE CARLO WITHDRAWAL SEQUENCE CALCULATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Log baseline profile values
  console.log('=== BASELINE PROFILE VALUES (BEFORE OPTIMIZATION) ===');
  console.log('Retirement age:', profile.desiredRetirementAge);
  console.log('Social Security claim age:', profile.socialSecurityClaimAge);
  console.log('Social Security benefit:', profile.socialSecurityBenefit);
  console.log('Pension benefit:', profile.pensionBenefit);
  console.log('Monthly expenses:', profile.expectedMonthlyExpensesRetirement);
  console.log('Expected return:', profile.expectedRealReturn);
  console.log('401k contributions:', profile.retirementContributions);
  console.log('IRA contributions:', profile.traditionalIRAContribution, profile.rothIRAContribution);
  console.log('Has LTC insurance:', profile.hasLongTermCareInsurance);
  
  // Apply optimization variables to profile if provided
  const profileToUse = optimizationVariables ? 
    applyOptimizationVariables(profile, optimizationVariables) : profile;
  
  // Log the profile after optimization
  if (optimizationVariables) {
    console.log('\n=== PROFILE VALUES AFTER OPTIMIZATION ===');
    console.log('Retirement age:', profileToUse.desiredRetirementAge);
    console.log('Social Security claim age:', profileToUse.socialSecurityClaimAge);
    console.log('Social Security benefit:', profileToUse.socialSecurityBenefit);
    console.log('Pension benefit:', profileToUse.pensionBenefit);
    console.log('Monthly expenses:', profileToUse.expectedMonthlyExpensesRetirement);
    console.log('Expected return:', profileToUse.expectedRealReturn);
    console.log('401k contributions:', profileToUse.retirementContributions);
    console.log('IRA contributions:', profileToUse.traditionalIRAContribution, profileToUse.rothIRAContribution);
    console.log('Has LTC insurance:', profileToUse.hasLongTermCareInsurance);
  }
  
  // Convert profile to Monte Carlo parameters
  const monteCarloParams = profileToRetirementParams(profileToUse);
  
  console.log('\n=== MONTE CARLO PARAMETERS ===');
  console.log('Current age:', monteCarloParams.currentAge);
  console.log('Retirement age:', monteCarloParams.retirementAge);
  console.log('Life expectancy:', monteCarloParams.lifeExpectancy);
  console.log('Current retirement assets:', monteCarloParams.currentRetirementAssets);
  console.log('Annual guaranteed income:', monteCarloParams.annualGuaranteedIncome);
  console.log('Annual retirement expenses:', monteCarloParams.annualRetirementExpenses);
  console.log('Annual savings:', monteCarloParams.annualSavings);
  console.log('Expected return:', monteCarloParams.expectedReturn);
  console.log('Return volatility:', monteCarloParams.returnVolatility);
  console.log('Stock allocation:', monteCarloParams.stockAllocation);
  console.log('Use glide path:', monteCarloParams.useGlidePath);
  console.log('Use risk profile:', monteCarloParams.useRiskProfile);
  console.log('Tax rate:', monteCarloParams.taxRate);
  console.log('Has LTC insurance:', monteCarloParams.hasLongTermCareInsurance);
  
  // FIXED: Use same Monte Carlo engine as dashboard retirement confidence score
  console.log('\n=== RUNNING MONTE CARLO SIMULATION ===');
  console.log('Engine: runRightCapitalStyleMonteCarloSimulation (same as dashboard)');
  console.log('Iterations: 1000');
  
  const monteCarloResult = await runRightCapitalStyleMonteCarloSimulation(monteCarloParams, 1000);
  
  console.log('\n=== MONTE CARLO RESULT ===');
  console.log('Success Probability:', (monteCarloResult.successProbability * 100).toFixed(1) + '%');
  console.log('Successful Runs:', monteCarloResult.summary?.successfulRuns);
  console.log('Total Runs:', monteCarloResult.summary?.totalRuns);
  console.log('Median Final Value:', monteCarloResult.summary?.medianFinalValue);
  console.log('10th Percentile:', monteCarloResult.summary?.percentile10);
  console.log('90th Percentile:', monteCarloResult.summary?.percentile90);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Transform Monte Carlo results to withdrawal sequence format
  const withdrawalSequence = await transformMonteCarloResults(
    monteCarloResult,
    profileToUse,
    monteCarloParams
  );
  
  return withdrawalSequence;
}

async function transformMonteCarloResults(
  monteCarloResult: any,
  profile: any,
  params: any
): Promise<MonteCarloWithdrawalResult> {
  
  // Extract yearly percentiles from all simulation iterations
  const yearlyPercentileData = calculateYearlyPercentilesFromRightCapitalResults(monteCarloResult);
  
  // Get current year and ages
  const currentYear = new Date().getFullYear();
  const birthYear = profile.dateOfBirth ? new Date(profile.dateOfBirth).getFullYear() : currentYear - 35;
  const currentAge = currentYear - birthYear;
  const spouseBirthYear = profile.spouseDateOfBirth ? new Date(profile.spouseDateOfBirth).getFullYear() : null;
  const spouseCurrentAge = spouseBirthYear ? currentYear - spouseBirthYear : null;
  
  // Calculate retirement ages
  const retirementAge = profile.desiredRetirementAge || 65;
  const spouseRetirementAge = profile.spouseDesiredRetirementAge || 65;
  
  // Get asset breakdown
  const assets = aggregateAssetsByType(profile);
  const totalAssets = assets.taxable + assets.taxDeferred + assets.taxFree + assets.hsa;
  
  // Calculate initial bucket percentages
  const taxablePercent = totalAssets > 0 ? assets.taxable / totalAssets : 0.25;
  const taxDeferredPercent = totalAssets > 0 ? assets.taxDeferred / totalAssets : 0.50;
  const taxFreePercent = totalAssets > 0 ? assets.taxFree / totalAssets : 0.20;
  const hsaPercent = totalAssets > 0 ? assets.hsa / totalAssets : 0.05;
  
  // Determine starting point - either current age or earliest retirement
  const startFromCurrentAge = params.startFromCurrentAge || false;
  let projectionStartYear: number;
  let startingAge: number;
  let startingSpouseAge: number | undefined;
  let projectionData: any[];
  
  if (startFromCurrentAge) {
    // Start from current year/age and go to life expectancy
    projectionStartYear = currentYear;
    startingAge = currentAge;
    startingSpouseAge = spouseCurrentAge;
    projectionData = yearlyPercentileData; // Use all data from current age
    
    console.log('Starting projections from current age:', {
      startYear: projectionStartYear,
      currentAge: startingAge,
      spouseCurrentAge: startingSpouseAge,
      totalYears: yearlyPercentileData.length
    });
  } else {
    // Original logic - start from earliest retirement
    const yearsUntilUserRetirement = Math.max(0, retirementAge - currentAge);
    const yearsUntilSpouseRetirement = spouseCurrentAge ? 
      Math.max(0, spouseRetirementAge - spouseCurrentAge) : Infinity;
    const yearsUntilRetirement = Math.min(yearsUntilUserRetirement, yearsUntilSpouseRetirement);
    projectionStartYear = currentYear + yearsUntilRetirement;
    startingAge = currentAge + yearsUntilRetirement;
    startingSpouseAge = spouseCurrentAge ? spouseCurrentAge + yearsUntilRetirement : undefined;
    
    // We'll select slices by index later; leave full array
    projectionData = yearlyPercentileData;
    
    console.log('Starting projections from retirement:', {
      userRetirementAge: retirementAge,
      spouseRetirementAge: spouseRetirementAge,
      yearsUntilRetirement,
      retirementStartYear: projectionStartYear
    });
  }
  
  // Standardize horizon to age 93
  const targetLongevityAge = 93;
  const totalYears = Math.max(0, targetLongevityAge - startingAge + 1);

  // Transform to withdrawal sequence format using REAL percentile data at 5/25/50/75/95
  const projections: MonteCarloWithdrawalData[] = Array.from({ length: totalYears }).map((_, idx) => {
    const age = startingAge + idx;
    const yearIndexFromCurrent = age - currentAge; // align with yearlyPercentileData starting at current age
    const percentileData = yearlyPercentileData[yearIndexFromCurrent] || yearlyPercentileData[yearlyPercentileData.length - 1];
    const year = currentYear + (age - currentAge);
    const spouseAge = startingSpouseAge ? startingSpouseAge + idx : undefined;
    
    // Check if retired
    const userRetired = age >= retirementAge;
    const spouseRetired = spouseAge ? spouseAge >= spouseRetirementAge : true;
    
    // Calculate working income
    const workingIncome = !userRetired ? (profile.annualIncome || 0) : 0;
    const spouseWorkingIncome = !spouseRetired && profile.spouseAnnualIncome ? profile.spouseAnnualIncome : 0;
    
    // Calculate part-time income (needs to be before SS earnings test)
    const partTimeIncome = userRetired ? (profile.partTimeIncomeRetirement || 0) * 12 : 0;
    const spousePartTimeIncome = spouseRetired && spouseAge ? 
      (profile.spousePartTimeIncomeRetirement || 0) * 12 : 0;
    
    // Calculate Social Security with earnings test
    const socialSecurityAge = profile.socialSecurityClaimAge || 67;
    const spouseSocialSecurityAge = profile.spouseSocialSecurityClaimAge || 67;
    
    // Calculate Full Retirement Age (FRA) based on birth year
    const userFRA = getFullRetirementAge(birthYear);
    const spouseFRA = spouseBirthYear ? getFullRetirementAge(spouseBirthYear) : 67;
    
    // Debug: Log SS benefit values
    if (idx === 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💵 SOCIAL SECURITY CALCULATION DEBUG');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Profile SS Values:', {
        userMonthlyBenefit: profile.socialSecurityBenefit,
        spouseMonthlyBenefit: profile.spouseSocialSecurityBenefit,
        userAnnualIncome: profile.annualIncome,
        spouseAnnualIncome: profile.spouseAnnualIncome,
        userClaimAge: socialSecurityAge,
        spouseClaimAge: spouseSocialSecurityAge,
        currentAge: age,
        spouseAge: spouseAge,
        userFRA,
        spouseFRA
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    // Calculate base Social Security benefits (monthly amount * 12)
    let socialSecurity = age >= socialSecurityAge ? (profile.socialSecurityBenefit || 0) * 12 : 0;
    let spouseSocialSecurity = spouseAge && spouseAge >= spouseSocialSecurityAge ? 
      (profile.spouseSocialSecurityBenefit || 0) * 12 : 0;
    
    // Debug annual SS values
    if (idx === 0 && (socialSecurity > 0 || spouseSocialSecurity > 0)) {
      console.log('Annual SS Benefits (before earnings test):', {
        userAnnualSS: socialSecurity,
        spouseAnnualSS: spouseSocialSecurity,
        combined: socialSecurity + spouseSocialSecurity,
        note: 'Monthly benefit * 12'
      });
    }
    
    // Apply Social Security earnings test if working before FRA
    if (socialSecurity > 0 && age < userFRA) {
      const totalEarnings = workingIncome + partTimeIncome;
      if (totalEarnings > 0) {
        // 2025 earnings limit: $23,400/year if under FRA all year
        const earningsLimit = 23400;
        if (totalEarnings > earningsLimit) {
          const excess = totalEarnings - earningsLimit;
          const reduction = excess / 2; // $1 reduction for every $2 over limit
          socialSecurity = Math.max(0, socialSecurity - reduction);
          
          if (idx === 0) {
            console.log('SS Earnings Test Applied:', {
              earnings: totalEarnings,
              limit: earningsLimit,
              reduction: reduction,
              adjustedBenefit: socialSecurity
            });
          }
        }
      }
    }
    
    // Apply earnings test for spouse
    if (spouseSocialSecurity > 0 && spouseAge && spouseAge < spouseFRA) {
      const spouseTotalEarnings = spouseWorkingIncome + spousePartTimeIncome;
      if (spouseTotalEarnings > 0) {
        const earningsLimit = 23400;
        if (spouseTotalEarnings > earningsLimit) {
          const excess = spouseTotalEarnings - earningsLimit;
          const reduction = excess / 2;
          spouseSocialSecurity = Math.max(0, spouseSocialSecurity - reduction);
        }
      }
    }
    
    // Calculate pension
    const pension = userRetired ? (profile.pensionBenefit || 0) * 12 : 0;
    const spousePension = spouseRetired ? (profile.spousePensionBenefit || 0) * 12 : 0;
    
    // Get REAL portfolio balance percentiles from aggregated Monte Carlo data
    const portfolioBalance = {
      p5: percentileData.p5 ?? percentileData.p10 ?? 0,
      p25: percentileData.p25 || 0,
      p50: percentileData.p50 || 0,
      p75: percentileData.p75 || 0,
      p95: percentileData.p95 ?? percentileData.p90 ?? 0,
      // Back-compat
      p10: percentileData.p10,
      p90: percentileData.p90
    };
    
    // Calculate median portfolio balance for bucket calculations
    const medianBalance = portfolioBalance.p50;
    
    // Estimate account balances based on initial allocation percentages
    const taxableBalance = Math.round(medianBalance * taxablePercent);
    const taxDeferredBalance = Math.round(medianBalance * taxDeferredPercent);
    const taxFreeBalance = Math.round(medianBalance * taxFreePercent);
    const hsaBalance = Math.round(medianBalance * hsaPercent);
    
    // Calculate total guaranteed income
    const totalIncome = workingIncome + spouseWorkingIncome + socialSecurity + 
      spouseSocialSecurity + pension + spousePension + partTimeIncome + spousePartTimeIncome;
    
    // Calculate expenses - Note: This is the BASE amount before inflation
    // The Monte Carlo engine applies inflation during simulation
    const monthlyExpenses = profile.expectedMonthlyExpensesRetirement || 8000;
    const annualExpenses = monthlyExpenses * 12;
    
    // Debug expenses
    if (idx === 0) {
      console.log('Expenses Debug:', {
        monthlyExpenses,
        annualExpenses,
        year,
        age,
        note: 'Base amount - inflation applied in Monte Carlo engine'
      });
    }
    
    // Calculate withdrawal need
    const withdrawalNeed = Math.max(0, annualExpenses - totalIncome);
    
    // Estimate withdrawals using tax-efficient ordering
    let remainingNeed = withdrawalNeed;
    let hsaWithdrawal = 0;
    let taxableWithdrawal = 0;
    let taxDeferredWithdrawal = 0;
    let taxFreeWithdrawal = 0;
    
    // 1. Use HSA for healthcare expenses (15% of total expenses)
    const healthcareExpenses = annualExpenses * 0.15;
    if (hsaBalance > 0 && healthcareExpenses > 0) {
      hsaWithdrawal = Math.min(healthcareExpenses, hsaBalance, remainingNeed);
      remainingNeed -= hsaWithdrawal;
    }
    
    // 2. Use taxable accounts
    if (remainingNeed > 0 && taxableBalance > 0) {
      taxableWithdrawal = Math.min(remainingNeed, taxableBalance);
      remainingNeed -= taxableWithdrawal;
    }
    
    // 3. Use tax-deferred accounts (considering RMDs at 73+)
    let rmdAmount = 0;
    if (age >= 73 && taxDeferredBalance > 0) {
      rmdAmount = taxDeferredBalance / getRMDDivisor(age);
    }
    
    if (remainingNeed > 0 || rmdAmount > 0) {
      taxDeferredWithdrawal = Math.max(Math.min(remainingNeed, taxDeferredBalance), rmdAmount);
      remainingNeed -= taxDeferredWithdrawal;
    }
    
    // 4. Use tax-free accounts (Roth) last
    if (remainingNeed > 0 && taxFreeBalance > 0) {
      taxFreeWithdrawal = Math.min(remainingNeed, taxFreeBalance);
      remainingNeed -= taxFreeWithdrawal;
    }
    
    const totalWithdrawals = hsaWithdrawal + taxableWithdrawal + taxDeferredWithdrawal + taxFreeWithdrawal;
    
    // Estimate taxes (simplified)
    const taxableIncome = taxDeferredWithdrawal + (taxableWithdrawal * 0.15); // 15% of taxable is gains
    const withdrawalTax = taxableIncome * (profile.effectiveTaxRate || 0.22);
    
    // Calculate success probability for this year from percentile data
    const successProbability = percentileData.successProbability || 0;
    
    return {
      year,
      age,
      spouseAge,
      monthlyExpenses,
      workingIncome,
      spouseWorkingIncome,
      socialSecurity,
      spouseSocialSecurity,
      pension,
      spousePension,
      partTimeIncome,
      spousePartTimeIncome,
      portfolioBalance,
      taxableWithdrawal,
      taxDeferredWithdrawal,
      taxFreeWithdrawal,
      hsaWithdrawal,
      taxableBalance,
      taxDeferredBalance,
      taxFreeBalance,
      hsaBalance,
      totalIncome,
      totalWithdrawals,
      totalBalance: medianBalance,
      withdrawalTax,
      netIncome: totalIncome + totalWithdrawals - withdrawalTax,
      rmdAmount: rmdAmount > 0 ? rmdAmount : undefined,
      successProbability,
      failureYear: successProbability < 50,
      marketRegime: percentileData.marketRegime,
      portfolioReturn: percentileData.portfolioReturn
    };
  });
  
  // Calculate summary statistics
  const monteCarloSummary = calculateSummaryStatistics(monteCarloResult, projections);
  
  return {
    projections,
    monteCarloSummary
  };
}

function calculateSummaryStatistics(monteCarloResult: any, projections: MonteCarloWithdrawalData[]): any {
  // Find depletion years
  const taxableDepletionYear = projections.find(p => p.taxableBalance <= 0)?.year;
  const taxDeferredDepletionYear = projections.find(p => p.taxDeferredBalance <= 0)?.year;
  
  // Calculate total lifetime tax
  const totalLifetimeTax = projections.reduce((sum, p) => sum + (p.withdrawalTax || 0), 0);
  
  // Use the actual success probability from the RightCapital Monte Carlo result
  const successProbability = monteCarloResult.successProbability || 0;
  
  // Get ending balance percentiles from the summary
  const summary = monteCarloResult.summary || {};
  
  return {
    probabilityOfSuccess: successProbability, // Already a decimal (0.951 = 95.1%)
    medianEndingBalance: summary.medianFinalValue || 0,
    percentile10EndingBalance: summary.percentile10 || 0,
    percentile90EndingBalance: summary.percentile90 || 0,
    totalScenarios: summary.totalRuns || 1000,
    successfulScenarios: summary.successfulRuns || 0,
    failedScenarios: (summary.totalRuns || 1000) - (summary.successfulRuns || 0),
    averageYearsUntilDepletion: undefined, // Not directly available from RightCapital results
    taxableDepletionYear,
    taxDeferredDepletionYear,
    totalLifetimeTax
  };
}

function applyOptimizationVariables(profile: any, variables: any): any {
  // If no variables provided, return the original profile
  if (!variables || Object.keys(variables).length === 0) {
    console.log('No optimization variables provided, using baseline profile');
    return profile;
  }

  // Create a copy of the profile to modify
  const optimized = { ...profile };
  
  // Track what changes are being made for debugging
  const changes: string[] = [];
  
  // Retirement ages - use explicit undefined checks to handle zero values correctly
  if (variables.retirementAge !== undefined) {
    optimized.desiredRetirementAge = variables.retirementAge;
    if (variables.retirementAge !== profile.desiredRetirementAge) {
      changes.push(`retirementAge: ${profile.desiredRetirementAge} -> ${variables.retirementAge}`);
    }
  }
  
  if (variables.spouseRetirementAge !== undefined) {
    optimized.spouseDesiredRetirementAge = variables.spouseRetirementAge;
    if (variables.spouseRetirementAge !== profile.spouseDesiredRetirementAge) {
      changes.push(`spouseRetirementAge: ${profile.spouseDesiredRetirementAge} -> ${variables.spouseRetirementAge}`);
    }
  }
  
  // Social Security claim ages
  if (variables.socialSecurityAge !== undefined) {
    optimized.socialSecurityClaimAge = variables.socialSecurityAge;
    if (variables.socialSecurityAge !== profile.socialSecurityClaimAge) {
      changes.push(`socialSecurityAge: ${profile.socialSecurityClaimAge} -> ${variables.socialSecurityAge}`);
    }
  }
  
  if (variables.spouseSocialSecurityAge !== undefined) {
    optimized.spouseSocialSecurityClaimAge = variables.spouseSocialSecurityAge;
    if (variables.spouseSocialSecurityAge !== profile.spouseSocialSecurityClaimAge) {
      changes.push(`spouseSocialSecurityAge: ${profile.spouseSocialSecurityClaimAge} -> ${variables.spouseSocialSecurityAge}`);
    }
  }
  
  // CRITICAL FIX: Add asset allocation handling (was missing!)
  // This matches the logic in routes.ts
  if (variables.assetAllocation !== undefined) {
    const oldReturn = profile.expectedRealReturn;
    if (variables.assetAllocation === 'current-allocation') {
      optimized.expectedRealReturn = -2; // Special value for current allocation
      changes.push(`assetAllocation: ${oldReturn} -> current-allocation (-2)`);
    } else if (variables.assetAllocation === 'glide-path') {
      optimized.expectedRealReturn = -1; // Special value for glide path
      changes.push(`assetAllocation: ${oldReturn} -> glide-path (-1)`);
    } else if (variables.assetAllocation) {
      // Convert percentage string to decimal
      optimized.expectedRealReturn = parseFloat(variables.assetAllocation) / 100;
      changes.push(`assetAllocation: ${oldReturn} -> ${variables.assetAllocation}% (${optimized.expectedRealReturn})`);
    }
  }
  
  // Spouse asset allocation (also was missing!)
  if (variables.spouseAssetAllocation !== undefined) {
    const oldReturn = profile.spouseExpectedRealReturn;
    if (variables.spouseAssetAllocation === 'current-allocation') {
      optimized.spouseExpectedRealReturn = -2;
      changes.push(`spouseAssetAllocation: ${oldReturn} -> current-allocation (-2)`);
    } else if (variables.spouseAssetAllocation === 'glide-path') {
      optimized.spouseExpectedRealReturn = -1;
      changes.push(`spouseAssetAllocation: ${oldReturn} -> glide-path (-1)`);
    } else if (variables.spouseAssetAllocation) {
      optimized.spouseExpectedRealReturn = parseFloat(variables.spouseAssetAllocation) / 100;
      changes.push(`spouseAssetAllocation: ${oldReturn} -> ${variables.spouseAssetAllocation}% (${optimized.spouseExpectedRealReturn})`);
    }
  }
  
  // Monthly expenses
  if (variables.monthlyExpenses !== undefined) {
    optimized.expectedMonthlyExpensesRetirement = variables.monthlyExpenses;
    if (variables.monthlyExpenses !== profile.expectedMonthlyExpensesRetirement) {
      changes.push(`monthlyExpenses: ${profile.expectedMonthlyExpensesRetirement} -> ${variables.monthlyExpenses}`);
    }
  }
  // Also check for alternative field name used in some places
  if (variables.monthlyRetirementSpending !== undefined) {
    optimized.expectedMonthlyExpensesRetirement = variables.monthlyRetirementSpending;
    if (variables.monthlyRetirementSpending !== profile.expectedMonthlyExpensesRetirement) {
      changes.push(`monthlyExpenses: ${profile.expectedMonthlyExpensesRetirement} -> ${variables.monthlyRetirementSpending}`);
    }
  }
  
  // Part-time income
  if (variables.partTimeIncome !== undefined) {
    optimized.partTimeIncomeRetirement = variables.partTimeIncome;
    if (variables.partTimeIncome !== profile.partTimeIncomeRetirement) {
      changes.push(`partTimeIncome: ${profile.partTimeIncomeRetirement} -> ${variables.partTimeIncome}`);
    }
  }
  
  if (variables.spousePartTimeIncome !== undefined) {
    optimized.spousePartTimeIncomeRetirement = variables.spousePartTimeIncome;
    if (variables.spousePartTimeIncome !== profile.spousePartTimeIncomeRetirement) {
      changes.push(`spousePartTimeIncome: ${profile.spousePartTimeIncomeRetirement} -> ${variables.spousePartTimeIncome}`);
    }
  }
  
  // Long-term care insurance
  if (variables.hasLongTermCareInsurance !== undefined) {
    optimized.hasLongTermCareInsurance = variables.hasLongTermCareInsurance;
    if (variables.hasLongTermCareInsurance !== profile.hasLongTermCareInsurance) {
      changes.push(`hasLongTermCareInsurance: ${profile.hasLongTermCareInsurance} -> ${variables.hasLongTermCareInsurance}`);
    }
  }
  
  // Retirement contributions - match the intake form structure
  // User 401k/403b contributions (monthly values)
  if (variables.monthlyEmployee401k !== undefined || variables.monthlyEmployer401k !== undefined) {
    optimized.retirementContributions = {
      employee: variables.monthlyEmployee401k ?? profile.retirementContributions?.employee ?? 0,
      employer: variables.monthlyEmployer401k ?? profile.retirementContributions?.employer ?? 0
    };
    changes.push(`401k contributions updated`);
  }
  
  // User IRA contributions (annual values converted to profile fields)
  if (variables.annualTraditionalIRA !== undefined) {
    optimized.traditionalIRAContribution = variables.annualTraditionalIRA;
    if (variables.annualTraditionalIRA !== profile.traditionalIRAContribution) {
      changes.push(`traditionalIRA: ${profile.traditionalIRAContribution} -> ${variables.annualTraditionalIRA}`);
    }
  }
  
  if (variables.annualRothIRA !== undefined) {
    optimized.rothIRAContribution = variables.annualRothIRA;
    if (variables.annualRothIRA !== profile.rothIRAContribution) {
      changes.push(`rothIRA: ${profile.rothIRAContribution} -> ${variables.annualRothIRA}`);
    }
  }
  
  // Spouse 401k/403b contributions (monthly values)
  if (variables.spouseMonthlyEmployee401k !== undefined || variables.spouseMonthlyEmployer401k !== undefined) {
    optimized.spouseRetirementContributions = {
      employee: variables.spouseMonthlyEmployee401k ?? profile.spouseRetirementContributions?.employee ?? 0,
      employer: variables.spouseMonthlyEmployer401k ?? profile.spouseRetirementContributions?.employer ?? 0
    };
    changes.push(`spouse 401k contributions updated`);
  }
  
  // Spouse IRA contributions (annual values)
  if (variables.spouseAnnualTraditionalIRA !== undefined) {
    optimized.spouseTraditionalIRAContribution = variables.spouseAnnualTraditionalIRA;
    if (variables.spouseAnnualTraditionalIRA !== profile.spouseTraditionalIRAContribution) {
      changes.push(`spouseTraditionalIRA: ${profile.spouseTraditionalIRAContribution} -> ${variables.spouseAnnualTraditionalIRA}`);
    }
  }
  
  if (variables.spouseAnnualRothIRA !== undefined) {
    optimized.spouseRothIRAContribution = variables.spouseAnnualRothIRA;
    if (variables.spouseAnnualRothIRA !== profile.spouseRothIRAContribution) {
      changes.push(`spouseRothIRA: ${profile.spouseRothIRAContribution} -> ${variables.spouseAnnualRothIRA}`);
    }
  }
  
  // Social Security and Pension benefits (if provided directly)
  if (variables.socialSecurityBenefit !== undefined) {
    optimized.socialSecurityBenefit = variables.socialSecurityBenefit;
    if (variables.socialSecurityBenefit !== profile.socialSecurityBenefit) {
      changes.push(`socialSecurityBenefit: ${profile.socialSecurityBenefit} -> ${variables.socialSecurityBenefit}`);
    }
  }
  
  if (variables.spouseSocialSecurityBenefit !== undefined) {
    optimized.spouseSocialSecurityBenefit = variables.spouseSocialSecurityBenefit;
    if (variables.spouseSocialSecurityBenefit !== profile.spouseSocialSecurityBenefit) {
      changes.push(`spouseSocialSecurityBenefit: ${profile.spouseSocialSecurityBenefit} -> ${variables.spouseSocialSecurityBenefit}`);
    }
  }
  
  if (variables.pensionBenefit !== undefined) {
    optimized.pensionBenefit = variables.pensionBenefit;
    if (variables.pensionBenefit !== profile.pensionBenefit) {
      changes.push(`pensionBenefit: ${profile.pensionBenefit} -> ${variables.pensionBenefit}`);
    }
  }
  
  if (variables.spousePensionBenefit !== undefined) {
    optimized.spousePensionBenefit = variables.spousePensionBenefit;
    if (variables.spousePensionBenefit !== profile.spousePensionBenefit) {
      changes.push(`spousePensionBenefit: ${profile.spousePensionBenefit} -> ${variables.spousePensionBenefit}`);
    }
  }
  
  // Log the changes for debugging
  if (changes.length > 0) {
    console.log('=== OPTIMIZATION VARIABLES APPLIED ===');
    console.log('Changes made:', changes);
  } else {
    console.log('=== NO CHANGES FROM OPTIMIZATION VARIABLES ===');
    console.log('All variables match baseline profile values');
  }
  
  return optimized;
}

// CRITICAL FUNCTION: Calculate actual percentiles from all Monte Carlo scenarios
// CRITICAL FUNCTION: Calculate actual percentiles from RightCapital Monte Carlo results
function calculateYearlyPercentilesFromRightCapitalResults(monteCarloResult: any): any[] {
  // RightCapital result contains array of simulation iterations, each with yearlyData
  const iterations = monteCarloResult.results || [];
  
  if (!iterations.length) {
    console.warn('No simulation iterations found in Monte Carlo result');
    return [];
  }
  
  // Find the maximum number of years across all iterations
  let maxYears = 0;
  iterations.forEach((iteration: any) => {
    if (iteration.yearlyData && iteration.yearlyData.length > maxYears) {
      maxYears = iteration.yearlyData.length;
    }
  });
  
  if (maxYears === 0) {
    console.warn('No yearly data found in simulation iterations');
    return [];
  }
  
  // Aggregate portfolio values for each year across all iterations
  const yearlyPercentiles = [];
  
  for (let yearIndex = 0; yearIndex < maxYears; yearIndex++) {
    // Collect all portfolio values for this year across all iterations
    const portfolioValues: number[] = [];
    let successCount = 0;
    
    iterations.forEach((iteration: any) => {
      if (iteration.yearlyData && iteration.yearlyData[yearIndex]) {
        const yearData = iteration.yearlyData[yearIndex];
        const portfolioValue = yearData.portfolioValue || 0;
        portfolioValues.push(portfolioValue);
        
        // Count successful scenarios (portfolio > 0)
        if (portfolioValue > 0) {
          successCount++;
        }
      }
    });
    
    // Calculate percentiles from collected values
    portfolioValues.sort((a, b) => a - b);
    
    const p5 = calculatePercentileFromArray(portfolioValues, 5);
    const p25 = calculatePercentileFromArray(portfolioValues, 25);
    const p50 = calculatePercentileFromArray(portfolioValues, 50);
    const p75 = calculatePercentileFromArray(portfolioValues, 75);
    const p95 = calculatePercentileFromArray(portfolioValues, 95);
    // Back-compat
    const p10 = calculatePercentileFromArray(portfolioValues, 10);
    const p90 = calculatePercentileFromArray(portfolioValues, 90);
    
    // Calculate success probability for this year
    const successProbability = portfolioValues.length > 0 
      ? (successCount / portfolioValues.length) * 100 
      : 0;
    
    yearlyPercentiles.push({
      p5,
      p25,
      p50,
      p75,
      p95,
      // Back-compat
      p10,
      p90,
      successProbability,
      marketRegime: undefined, // Not applicable for aggregated data
      portfolioReturn: undefined // Not applicable for aggregated data
    });
  }
  
  console.log(`Calculated yearly percentiles for ${maxYears} years from ${iterations.length} iterations`);
  console.log(`Year 0 success: ${yearlyPercentiles[0]?.successProbability?.toFixed(1)}%`);
  console.log(`Final year success: ${yearlyPercentiles[maxYears-1]?.successProbability?.toFixed(1)}%`);
  
  return yearlyPercentiles;
}

// Helper function to calculate percentile from sorted array
function calculatePercentileFromArray(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (upper >= sortedValues.length) {
    return sortedValues[sortedValues.length - 1];
  }
  
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

// Calculate Full Retirement Age based on birth year
function getFullRetirementAge(birthYear: number): number {
  if (birthYear <= 1937) return 65;
  if (birthYear === 1938) return 65.167; // 65 and 2 months
  if (birthYear === 1939) return 65.333; // 65 and 4 months
  if (birthYear === 1940) return 65.5;   // 65 and 6 months
  if (birthYear === 1941) return 65.667; // 65 and 8 months
  if (birthYear === 1942) return 65.833; // 65 and 10 months
  if (birthYear >= 1943 && birthYear <= 1954) return 66;
  if (birthYear === 1955) return 66.167; // 66 and 2 months
  if (birthYear === 1956) return 66.333; // 66 and 4 months
  if (birthYear === 1957) return 66.5;   // 66 and 6 months
  if (birthYear === 1958) return 66.667; // 66 and 8 months
  if (birthYear === 1959) return 66.833; // 66 and 10 months
  return 67; // 1960 and later
}

// RMD divisors based on IRS Uniform Lifetime Table
function getRMDDivisor(age: number): number {
  const rmdTable: { [key: number]: number } = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4
  };
  
  if (age > 100) return 6.4;
  return rmdTable[age] || 27.4;
}

// Main entry point for API
export async function generateMonteCarloWithdrawalSequence(profile: any, variables?: any) {
  return calculateMonteCarloWithdrawalSequence(profile, variables);
}
