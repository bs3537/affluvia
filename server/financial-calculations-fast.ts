/**
 * Fast financial calculations for intake form submission
 * These calculations run quickly (<200ms) and don't require heavy processing
 * Monte Carlo and other heavy calculations are handled separately on-demand
 */

import { PlaidDataAggregator } from './services/plaid-data-aggregator';

/**
 * Calculate ONLY fast financial metrics (no Monte Carlo, no heavy processing)
 * Used during intake form submission for immediate feedback
 */
export async function calculateFastFinancialMetrics(
  profileData: any,
  userId?: number
) {
  console.log('🚀 Running FAST calculations only (no Monte Carlo)');
  
  // Try to get Plaid aggregated data if userId is provided
  let plaidSnapshot: any = null;
  
  if (userId) {
    try {
      plaidSnapshot = await PlaidDataAggregator.getLatestSnapshot(userId);
    } catch (error) {
      console.log('Plaid data not available, using manual data only');
    }
  }

  // Calculate basic metrics
  const netWorth = calculateNetWorth(profileData, plaidSnapshot);
  const monthlyCashFlow = calculateCashFlow(profileData, plaidSnapshot);
  const healthScore = calculateHealthScore(profileData, netWorth, monthlyCashFlow);
  const emergencyScore = calculateEmergencyScore(profileData, monthlyCashFlow);
  const insuranceScore = calculateInsuranceScore(profileData);
  const riskProfile = calculateRiskProfile(profileData);
  const currentAllocation = getCurrentAllocation(profileData);
  const targetAllocation = getTargetAllocation(riskProfile.score);
  
  // For spouse if married
  const spouseRiskProfile = profileData.maritalStatus === 'married' ? 
    calculateSpouseRiskProfile(profileData) : null;
  const spouseTargetAllocation = spouseRiskProfile ? 
    getTargetAllocation(spouseRiskProfile.score) : null;

  return {
    // Core metrics (FAST)
    netWorth,
    monthlyCashFlow,
    monthlyCashFlowAfterContributions: monthlyCashFlow - calculateMonthlyContributions(profileData),
    healthScore,
    emergencyScore,
    insuranceScore,
    cashFlowScore: monthlyCashFlow > 0 ? 80 : 40,
    
    // Risk profiles (FAST)
    riskProfile: riskProfile.profile,
    riskScore: riskProfile.score,
    targetAllocation,
    currentAllocation,
    
    // Spouse data (FAST)
    spouseRiskProfile: spouseRiskProfile?.profile || 'Not Assessed',
    spouseRiskScore: spouseRiskProfile?.score || 0,
    spouseTargetAllocation,
    
    // PLACEHOLDER for retirement score (will be calculated on-demand)
    retirementScore: 0,
    retirementMessage: 'Click "Calculate" to generate retirement analysis',
    
    // Metadata
    calculatedAt: new Date().toISOString(),
    calculationType: 'fast', // Indicates this is fast calculation only
  };
}

function calculateNetWorth(profileData: any, plaidSnapshot: any): number {
  if (plaidSnapshot) {
    const totalAssets = parseFloat(plaidSnapshot.totalAssets || '0');
    const totalLiabilities = parseFloat(plaidSnapshot.totalLiabilities || '0');
    
    // Add real estate equity
    const primaryResidence = profileData.primaryResidence || {};
    const primaryHomeValue = parseFloat(primaryResidence.marketValue) || 0;
    const primaryMortgageBalance = parseFloat(primaryResidence.mortgageBalance) || 0;
    const primaryHomeEquity = primaryHomeValue - primaryMortgageBalance;
    
    return totalAssets - totalLiabilities + primaryHomeEquity;
  }
  
  // Manual calculation
  const assets = Array.isArray(profileData.assets) ? profileData.assets : [];
  const liabilities = Array.isArray(profileData.liabilities) ? profileData.liabilities : [];
  
  const totalAssets = assets.reduce((sum: number, asset: any) => 
    sum + (parseFloat(asset.value) || 0), 0);
  const totalLiabilities = liabilities.reduce((sum: number, liability: any) => 
    sum + (parseFloat(liability.value) || 0), 0);
    
  return totalAssets - totalLiabilities;
}

function calculateCashFlow(profileData: any, plaidSnapshot: any): number {
  if (plaidSnapshot) {
    return parseFloat(plaidSnapshot.monthlyNetCashFlow || '0');
  }
  
  // Manual calculation
  const monthlyIncome = (parseFloat(profileData.annualIncome) || 0) / 12;
  const spouseIncome = (parseFloat(profileData.spouseAnnualIncome) || 0) / 12;
  const monthlyExpenses = parseFloat(profileData.monthlyExpenses) || 0;
  
  return monthlyIncome + spouseIncome - monthlyExpenses;
}

function calculateHealthScore(profileData: any, netWorth: number, monthlyCashFlow: number): number {
  // Simple weighted average of key metrics
  let score = 0;
  let weights = 0;
  
  // Net worth component (30%)
  if (netWorth > 0) {
    const netWorthScore = Math.min(100, (netWorth / 100000) * 20);
    score += netWorthScore * 0.3;
    weights += 0.3;
  }
  
  // Cash flow component (30%)
  if (monthlyCashFlow > 0) {
    const cashFlowScore = Math.min(100, (monthlyCashFlow / 5000) * 100);
    score += cashFlowScore * 0.3;
    weights += 0.3;
  }
  
  // Debt-to-income component (20%)
  const annualIncome = parseFloat(profileData.annualIncome) || 0;
  const totalDebt = calculateTotalDebt(profileData);
  if (annualIncome > 0) {
    const dtiRatio = totalDebt / annualIncome;
    const dtiScore = Math.max(0, 100 - (dtiRatio * 100));
    score += dtiScore * 0.2;
    weights += 0.2;
  }
  
  // Emergency fund component (20%)
  const emergencyScore = calculateEmergencyScore(profileData, monthlyCashFlow);
  score += emergencyScore * 0.2;
  weights += 0.2;
  
  return weights > 0 ? Math.round(score / weights) : 50;
}

function getEssentialMonthlyExpenses(profileData: any, fallbackTotalMonthly: number): number {
  const me = (profileData?.monthlyExpenses || {}) as Record<string, any>;
  const explicit = Number((me as any).essential || (profileData as any).essentialMonthlyExpenses || 0);
  if (explicit > 0) return explicit;

  const discretionaryKeys = new Set([
    'dining', 'restaurants', 'entertainment', 'vacation', 'travel', 'shopping',
    'subscriptions', 'streaming', 'gym', 'hobbies', 'gifts', 'coffee', 'alcohol',
    'luxury', 'misc', 'personalCare', 'recreation'
  ]);
  let essential = 0;
  let sawAny = false;
  for (const [key, raw] of Object.entries(me)) {
    if (key.startsWith('_') || key === 'total') continue;
    const k = key.toLowerCase();
    const val = Number(raw) || 0;
    if (!Number.isFinite(val) || val <= 0) continue;
    sawAny = true;
    if (!discretionaryKeys.has(k)) essential += val;
  }
  if (sawAny && essential > 0) return essential;
  return Math.max(0, Number(fallbackTotalMonthly || 0) * 0.75);
}

function calculateEmergencyScore(profileData: any, _monthlyCashFlow: number): number {
  const emergencyFund = parseFloat(profileData.emergencyFundSize) || 0;
  const totalMonthly = (() => {
    const me = (profileData?.monthlyExpenses || {}) as Record<string, any>;
    const manualTotal = Number((profileData as any).totalMonthlyExpenses || me.total || 0) || 0;
    if (manualTotal > 0) return manualTotal;
    const categorized = Object.entries(me)
      .filter(([k]) => !k.startsWith('_') && k !== 'total')
      .reduce((s, [, v]) => s + (Number(v) || 0), 0);
    return categorized || 0;
  })();
  const essentialMonthly = getEssentialMonthlyExpenses(profileData, totalMonthly || 3000);
  const targetMonths = 6; // Policy: 6 months minimum of essential expenses
  const targetFund = essentialMonthly * targetMonths;

  if (targetFund <= 0) return 100;
  const ratio = emergencyFund / targetFund; // e.g., 1.0 = fully funded
  // Map ratio to score with gentle tiers consistent with enhanced calculator
  if (ratio >= 1) return 100;
  if (ratio >= 0.75) return 85;
  if (ratio >= 0.5) return 70;
  if (ratio >= 0.25) return 50;
  if (ratio >= 0.1) return 30;
  return 10;
}

function calculateInsuranceScore(profileData: any): number {
  let score = 0;
  let components = 0;
  
  // Life insurance
  if (profileData.lifeInsurance?.coverageAmount > 0) {
    score += 25;
    components++;
  }
  
  // Health insurance
  if (profileData.healthInsurance?.hasHealthInsurance) {
    score += 25;
    components++;
  }
  
  // Disability insurance
  if (profileData.disabilityInsurance?.hasDisability) {
    score += 25;
    components++;
  }
  
  // Auto/Home insurance
  if (profileData.insurance?.hasAutoInsurance || profileData.insurance?.hasHomeInsurance) {
    score += 25;
    components++;
  }
  
  return components > 0 ? Math.round(score) : 50;
}

function calculateRiskProfile(profileData: any): { profile: string, score: number } {
  const riskScore = parseInt(profileData.riskScore) || 
                    parseInt(profileData.userRiskScore) || 3;
  
  const profiles = [
    'Conservative',
    'Moderately Conservative', 
    'Moderate',
    'Moderately Aggressive',
    'Aggressive'
  ];
  
  return {
    score: riskScore,
    profile: profiles[Math.min(4, Math.max(0, riskScore - 1))]
  };
}

function calculateSpouseRiskProfile(profileData: any): { profile: string, score: number } | null {
  if (profileData.maritalStatus !== 'married') return null;
  
  const riskScore = parseInt(profileData.spouseRiskScore) || 3;
  
  const profiles = [
    'Conservative',
    'Moderately Conservative',
    'Moderate', 
    'Moderately Aggressive',
    'Aggressive'
  ];
  
  return {
    score: riskScore,
    profile: profiles[Math.min(4, Math.max(0, riskScore - 1))]
  };
}

function getCurrentAllocation(profileData: any): any {
  return profileData.currentAllocation || {
    stocks: 60,
    bonds: 30,
    cash: 10,
    alternatives: 0
  };
}

function getTargetAllocation(riskScore: number): any {
  const allocations = [
    { stocks: 20, bonds: 60, cash: 20, alternatives: 0 }, // Conservative
    { stocks: 40, bonds: 45, cash: 15, alternatives: 0 }, // Moderately Conservative
    { stocks: 60, bonds: 30, cash: 10, alternatives: 0 }, // Moderate
    { stocks: 75, bonds: 20, cash: 5, alternatives: 0 },  // Moderately Aggressive
    { stocks: 90, bonds: 5, cash: 5, alternatives: 0 }    // Aggressive
  ];
  
  return allocations[Math.min(4, Math.max(0, riskScore - 1))];
}

function calculateMonthlyContributions(profileData: any): number {
  const monthly401k = parseFloat(profileData.monthlyContribution401k) || 0;
  const monthlyIRA = parseFloat(profileData.monthlyContributionIRA) || 0;
  const monthlyRoth = parseFloat(profileData.monthlyContributionRothIRA) || 0;
  const monthlyBrokerage = parseFloat(profileData.monthlyContributionBrokerage) || 0;
  
  return monthly401k + monthlyIRA + monthlyRoth + monthlyBrokerage;
}

function calculateTotalDebt(profileData: any): number {
  const liabilities = Array.isArray(profileData.liabilities) ? profileData.liabilities : [];
  return liabilities.reduce((sum: number, liability: any) => 
    sum + (parseFloat(liability.value) || 0), 0);
}
