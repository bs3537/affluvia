import { MonteCarloResult } from './monte-carlo-enhanced';

interface NetWorthProjection {
  year: number;
  age: number;
  spouseAge?: number;
  savings: number;
  realEstate: number;
  otherAssets: number;
  debt: number;
  totalNetWorth: number;
}

interface MonteCarloProjectionsResult {
  projections: NetWorthProjection[];
  currentNetWorth: number;
  targetYear: number;
  targetNetWorth: number;
  percentiles?: {
    p10: NetWorthProjection[];
    p25: NetWorthProjection[];
    p50: NetWorthProjection[];
    p75: NetWorthProjection[];
    p90: NetWorthProjection[];
  };
}

/**
 * Extract net worth projections from Monte Carlo simulation results
 * Uses the median (50th percentile) scenario for the main projection
 * and provides additional percentiles for confidence intervals
 */
export function extractMonteCarloProjections(
  monteCarloResult: MonteCarloResult,
  profile: any
): MonteCarloProjectionsResult {
  const currentYear = new Date().getFullYear();
  const birthYear = profile.dateOfBirth ? new Date(profile.dateOfBirth).getFullYear() : currentYear - 35;
  const currentAge = currentYear - birthYear;
  const spouseBirthYear = profile.spouseDateOfBirth ? new Date(profile.spouseDateOfBirth).getFullYear() : null;
  const spouseCurrentAge = spouseBirthYear ? currentYear - spouseBirthYear : null;
  
  // Get the percentile data from Monte Carlo results
  const percentileData = monteCarloResult.percentileData || {};
  const yearlyCashFlows = monteCarloResult.yearlyCashFlows || [];
  
  // Calculate current net worth from profile
  let currentSavings = 0;
  let currentRealEstate = 0;
  let currentOtherAssets = 0;
  let currentDebt = 0;
  
  if (profile.assets && Array.isArray(profile.assets)) {
    profile.assets.forEach((asset: any) => {
      const value = Number(asset.value) || 0;
      const type = asset.type || '';
      
      const savingsTypes = ['401k', '403b', 'ira', 'sep-ira', 'simple-ira', 'roth-ira', 'roth-401k', 
                           'taxable-brokerage', 'savings', 'checking', 'hsa'];
      
      if (savingsTypes.includes(type)) {
        currentSavings += value;
      } else if (type === 'other-real-estate') {
        currentRealEstate += value;
      } else if (type === 'cash-value-life-insurance') {
        currentOtherAssets += value;
      } else {
        currentOtherAssets += value;
      }
    });
  }
  
  // Add primary residence to real estate
  if (profile.primaryResidence?.marketValue) {
    currentRealEstate += Number(profile.primaryResidence.marketValue) || 0;
  }
  
  // Calculate total debt
  if (profile.liabilities && Array.isArray(profile.liabilities)) {
    profile.liabilities.forEach((liability: any) => {
      currentDebt += Number(liability.balance) || 0;
    });
  }
  
  // Add mortgage to debt
  if (profile.primaryResidence?.mortgageBalance) {
    currentDebt += Number(profile.primaryResidence.mortgageBalance) || 0;
  }
  
  const currentNetWorth = currentSavings + currentRealEstate + currentOtherAssets - currentDebt;
  
  // Extract projections from percentile data
  const projections: NetWorthProjection[] = [];
  const percentileProjections: any = {
    p10: [],
    p25: [],
    p50: [],
    p75: [],
    p90: []
  };
  
  // Use yearly cash flows to build projections
  const lifeExpectancy = profile.lifeExpectancy || 85;
  const spouseLifeExpectancy = profile.spouseLifeExpectancy || 85;
  const maxAge = Math.max(lifeExpectancy, spouseCurrentAge ? spouseLifeExpectancy : 0);
  const yearsToProject = maxAge - currentAge;
  
  // Real estate appreciation rate (inflation + 1.6%)
  const realEstateAppreciation = 0.016; // 1.6% real
  const otherAssetsGrowth = 0.019; // CVLI growth rate
  
  // Initialize projection values
  let projectedRealEstate = currentRealEstate;
  let projectedOtherAssets = currentOtherAssets;
  let projectedDebt = currentDebt;
  
  // Extract data from Monte Carlo percentiles
  for (let year = 0; year <= yearsToProject && year < yearlyCashFlows.length; year++) {
    const projectionAge = currentAge + year;
    const projectionSpouseAge = spouseCurrentAge ? spouseCurrentAge + year : undefined;
    const projectionYear = currentYear + year;
    
    // Get the median (50th percentile) portfolio value for this year
    const yearData = yearlyCashFlows[year];
    const medianPortfolioValue = yearData?.percentile50 || 0;
    
    // Apply appreciation to non-portfolio assets
    if (year > 0) {
      projectedRealEstate *= (1 + realEstateAppreciation);
      projectedOtherAssets *= (1 + otherAssetsGrowth);
      
      // Reduce debt based on payment schedule (simplified)
      const annualDebtReduction = (profile.primaryResidence?.monthlyPayment || 0) * 12 * 0.4; // Assume 40% goes to principal
      projectedDebt = Math.max(0, projectedDebt - annualDebtReduction);
    }
    
    // Create projection for median scenario
    const projection: NetWorthProjection = {
      year: projectionYear,
      age: projectionAge,
      spouseAge: projectionSpouseAge,
      savings: Math.round(medianPortfolioValue),
      realEstate: Math.round(projectedRealEstate),
      otherAssets: Math.round(projectedOtherAssets),
      debt: Math.round(projectedDebt),
      totalNetWorth: Math.round(medianPortfolioValue + projectedRealEstate + projectedOtherAssets - projectedDebt)
    };
    
    projections.push(projection);
    
    // Also store other percentiles for confidence intervals
    ['p10', 'p25', 'p50', 'p75', 'p90'].forEach(percentile => {
      const percentileKey = `percentile${percentile.slice(1)}`;
      const portfolioValue = yearData?.[percentileKey] || 0;
      
      percentileProjections[percentile].push({
        year: projectionYear,
        age: projectionAge,
        spouseAge: projectionSpouseAge,
        savings: Math.round(portfolioValue),
        realEstate: Math.round(projectedRealEstate),
        otherAssets: Math.round(projectedOtherAssets),
        debt: Math.round(projectedDebt),
        totalNetWorth: Math.round(portfolioValue + projectedRealEstate + projectedOtherAssets - projectedDebt)
      });
    });
  }
  
  // If Monte Carlo doesn't cover full life expectancy, extrapolate
  if (projections.length < yearsToProject + 1) {
    const lastProjection = projections[projections.length - 1];
    const declineRate = 0.03; // Assume 3% annual decline in real terms after Monte Carlo ends
    
    for (let year = projections.length; year <= yearsToProject; year++) {
      const projectionAge = currentAge + year;
      const projectionSpouseAge = spouseCurrentAge ? spouseCurrentAge + year : undefined;
      const projectionYear = currentYear + year;
      
      // Extrapolate portfolio value with decline
      const extrapolatedSavings = lastProjection.savings * Math.pow(1 - declineRate, year - projections.length + 1);
      
      // Continue appreciating real estate and other assets
      projectedRealEstate *= (1 + realEstateAppreciation);
      projectedOtherAssets *= (1 + otherAssetsGrowth);
      projectedDebt = Math.max(0, projectedDebt - (profile.primaryResidence?.monthlyPayment || 0) * 12 * 0.4);
      
      projections.push({
        year: projectionYear,
        age: projectionAge,
        spouseAge: projectionSpouseAge,
        savings: Math.round(Math.max(0, extrapolatedSavings)),
        realEstate: Math.round(projectedRealEstate),
        otherAssets: Math.round(projectedOtherAssets),
        debt: Math.round(projectedDebt),
        totalNetWorth: Math.round(Math.max(0, extrapolatedSavings) + projectedRealEstate + projectedOtherAssets - projectedDebt)
      });
    }
  }
  
  const targetProjection = projections[projections.length - 1];
  
  return {
    projections,
    currentNetWorth: Math.round(currentNetWorth),
    targetYear: targetProjection.year,
    targetNetWorth: targetProjection.totalNetWorth,
    percentiles: percentileProjections
  };
}

/**
 * Get Monte Carlo-based projections for optimized retirement plan
 * This replaces the flawed deterministic projections with Monte Carlo median
 */
export async function getMonteCarloOptimizedProjections(
  profile: any,
  optimizationVariables: any
): Promise<MonteCarloProjectionsResult> {
  // Import Monte Carlo functions
  const { runEnhancedMonteCarloSimulation } = await import('./monte-carlo-enhanced');
  const { profileToRetirementParams } = await import('./monte-carlo-base');
  
  // Apply optimization variables to profile
  const optimizedProfile = { ...profile };
  
  if (optimizationVariables.retirementAge !== undefined) {
    optimizedProfile.desiredRetirementAge = optimizationVariables.retirementAge;
  }
  if (optimizationVariables.spouseRetirementAge !== undefined) {
    optimizedProfile.spouseDesiredRetirementAge = optimizationVariables.spouseRetirementAge;
  }
  if (optimizationVariables.monthlyRetirementSpending !== undefined) {
    optimizedProfile.expectedMonthlyExpensesRetirement = optimizationVariables.monthlyRetirementSpending;
  }
  if (optimizationVariables.monthlyContributions !== undefined) {
    const totalMonthly = optimizationVariables.monthlyContributions;
    optimizedProfile.monthlyContribution401k = totalMonthly * 0.5;
    optimizedProfile.monthlyContributionIRA = totalMonthly * 0.2;
    optimizedProfile.monthlyContributionRothIRA = totalMonthly * 0.2;
    optimizedProfile.monthlyContributionBrokerage = totalMonthly * 0.1;
  }
  
  // Convert profile to Monte Carlo parameters
  const monteCarloParams = profileToRetirementParams(optimizedProfile);
  
  // Run Monte Carlo simulation
  const monteCarloResult = await runEnhancedMonteCarloSimulation(monteCarloParams);
  
  // Extract projections from Monte Carlo results
  return extractMonteCarloProjections(monteCarloResult, optimizedProfile);
}