/**
 * Enhanced financial calculations that integrate Plaid data
 */

import { PlaidDataAggregator } from './services/plaid-data-aggregator';
import { db } from './db';
import { plaidAggregatedSnapshot } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

// Helper: estimate essential (non-discretionary) monthly expenses
function getEssentialMonthlyExpenses(profileData: any, fallbackTotalMonthly: number): number {
  const me = (profileData?.monthlyExpenses || {}) as Record<string, any>;
  // Explicit override if provided
  const explicit = Number((me as any).essential || (profileData as any).essentialMonthlyExpenses || 0);
  if (explicit > 0) return explicit;

  // Sum categorized expenses, excluding clearly discretionary categories
  const discretionaryKeys = new Set([
    'dining', 'restaurants', 'entertainment', 'vacation', 'travel', 'shopping',
    'subscriptions', 'streaming', 'gym', 'hobbies', 'gifts', 'coffee', 'alcohol',
    'luxury', 'misc', 'personalCare', 'recreation'
  ]);
  let essential = 0;
  let sawAnyCategory = false;
  for (const [key, raw] of Object.entries(me)) {
    if (key.startsWith('_') || key === 'total') continue;
    const k = key.toString().toLowerCase();
    const val = Number(raw) || 0;
    if (!Number.isFinite(val) || val <= 0) continue;
    sawAnyCategory = true;
    if (!discretionaryKeys.has(k)) essential += val; // treat unknowns as essential by default
  }

  if (sawAnyCategory && essential > 0) return essential;
  // Fallback heuristic: assume 75% of total are essential
  return Math.max(0, Number(fallbackTotalMonthly || 0) * 0.75);
}

/**
 * Calculate insurance adequacy score based on manual data
 */
function computeInsuranceAdequacy(profileData: any, netWorth: number, monthlyIncome: number) {
  const age = profileData.dateOfBirth ? new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear() : 35;
  const spouseAge = profileData.spouseDateOfBirth ? new Date().getFullYear() - new Date(profileData.spouseDateOfBirth).getFullYear() : null;
  const isMarried = profileData.maritalStatus === 'married' || profileData.maritalStatus === 'partnered';
  const userIncome = Number(profileData.annualIncome) || 0;
  const spouseIncome = Number(profileData.spouseAnnualIncome) || 0;
  const householdIncome = (monthlyIncome || 0) * 12;

  const life = { 
    user: (profileData.lifeInsurance as any)?.coverageAmount || 0, 
    spouse: (profileData.spouseLifeInsurance as any)?.coverageAmount || 0 
  };
  const disability = {
    user: { 
      has: (profileData.disabilityInsurance as any)?.hasDisability || false, 
      benefit: (profileData.disabilityInsurance as any)?.benefitAmount || 0 
    },
    spouse: { 
      has: (profileData.spouseDisabilityInsurance as any)?.hasDisability || false, 
      benefit: (profileData.spouseDisabilityInsurance as any)?.benefitAmount || 0 
    }
  };
  const health = profileData.healthInsurance as any || {};
  const ins = profileData.insurance as any || {};
  const primaryResidenceValue = 
    (profileData.primaryResidence as any)?.currentValue ??
    (profileData.primaryResidence as any)?.marketValue ?? 0;

  // Life insurance score calculation
  const calcLife = (inc: number, cov: number, working: boolean) => {
    if (!working || inc <= 0) return 100;
    const ratio = cov / (inc * 10);
    if (ratio >= 1.5) return 100;
    if (ratio >= 1.0) return 80 + (ratio - 1) * 40;
    return Math.min(80, ratio * 80);
  };
  
  const userWorking = profileData.employmentStatus !== 'retired' && profileData.employmentStatus !== 'unemployed';
  const spouseWorking = profileData.spouseEmploymentStatus !== 'retired' && profileData.spouseEmploymentStatus !== 'unemployed';
  const userLifeScore = calcLife(userIncome, life.user, userWorking && ((profileData.dependents || 0) > 0 || isMarried));
  const spouseLifeScore = isMarried ? calcLife(spouseIncome, life.spouse, spouseWorking && ((profileData.dependents || 0) > 0 || userIncome < householdIncome * 0.4)) : 100;
  const totalIncForLife = (userWorking ? userIncome : 0) + (isMarried && spouseWorking ? spouseIncome : 0);
  const lifeScore = totalIncForLife > 0
    ? (userLifeScore * (userIncome / totalIncForLife || 0)) + (spouseLifeScore * (spouseIncome / totalIncForLife || 0))
    : 100;

  // Disability insurance score
  const calcDisab = (inc: number, has: boolean, benefit: number) => {
    if (inc <= 0) return 100;
    if (!has) return 0;
    const repl = benefit / (inc / 12);
    return Math.min(100, (repl / 0.65) * 100);
  };
  
  const userDisabScore = (userWorking && age < 65) ? calcDisab(userIncome, disability.user.has, disability.user.benefit) : 100;
  const spouseDisabScore = (isMarried && spouseWorking && spouseAge && spouseAge < 65)
    ? calcDisab(spouseIncome, disability.spouse.has, disability.spouse.benefit) : 100;
  const eligibleUserInc = (userWorking && age < 65) ? userIncome : 0;
  const eligibleSpouseInc = (isMarried && spouseWorking && spouseAge && spouseAge < 65) ? spouseIncome : 0;
  const totalEligInc = eligibleUserInc + eligibleSpouseInc;
  const disabilityScore = totalEligInc > 0
    ? (userDisabScore * (eligibleUserInc / totalEligInc)) + (spouseDisabScore * (eligibleSpouseInc / totalEligInc))
    : 100;

  // Health insurance score
  const hasHealth = !!health.hasHealthInsurance;
  const annualPremium = (health.monthlyPremium || 0) * 12;
  const deductible = health.annualDeductible || 0;
  const oopMax = health.outOfPocketMax || 0;
  const expectedOOP = (deductible * 0.5) + Math.max(0, (oopMax - deductible)) * 0.1;
  const totalCost = annualPremium + expectedOOP;
  const costRatio = householdIncome > 0 ? totalCost / householdIncome : 1;
  const healthScore = !hasHealth ? 0 :
    costRatio <= 0.08 ? 100 :
    costRatio <= 0.10 ? 80 :
    costRatio <= 0.12 ? 60 :
    costRatio <= 0.15 ? 40 : 20;

  // Home insurance score
  const hasHome = !!ins.home;
  const homeDwellingLimit = ins.homeDwellingLimit || 0;
  const homeScore = primaryResidenceValue <= 0 ? 100 : (!hasHome ? 0 :
    (homeDwellingLimit / primaryResidenceValue) >= 1 ? 100 :
    (homeDwellingLimit / primaryResidenceValue) >= 0.8 ? 80 :
    Math.min(80, (homeDwellingLimit / primaryResidenceValue) * 100));

  // Auto insurance score
  const hasAuto = !!ins.auto;
  const autoLim = ins.autoLiabilityLimits || {};
  const biPer = autoLim.bodilyInjuryPerPerson || 0;
  const biTot = autoLim.bodilyInjuryPerAccident || 0;
  const propDam = autoLim.propertyDamage || 0;
  const biPerScore = biPer >= 250000 ? 100 : biPer >= 100000 ? 85 : biPer >= 50000 ? 60 : biPer >= 25000 ? 40 : (biPer / 25000) * 40;
  const biTotScore = biTot >= 500000 ? 100 : biTot >= 300000 ? 85 : biTot >= 100000 ? 60 : biTot >= 50000 ? 40 : (biTot / 50000) * 40;
  const pdScore = propDam >= 250000 ? 100 : propDam >= 100000 ? 85 : propDam >= 50000 ? 60 : propDam >= 25000 ? 40 : (propDam / 25000) * 40;
  const autoScore = !hasAuto ? 100 : (biPerScore + biTotScore + pdScore) / 3;

  // Umbrella insurance score
  const hasUmbrella = !!ins.umbrella;
  const umbrellaLimit = ins.umbrellaLimit || 0;
  const umbrellaScore = netWorth < 500000 ? 100 : (!hasUmbrella ? 0 : Math.min(100, (umbrellaLimit / Math.max(netWorth, 1)) * 100));

  // Business liability score
  const isSelfEmployed = profileData.employmentStatus === 'self-employed';
  const bizLim = ins.businessLiabilityLimits || {};
  let businessScore = 100;
  if (isSelfEmployed) {
    const perOcc = bizLim.perOccurrence || 0, agg = bizLim.aggregate || 0;
    businessScore = 0;
    if (perOcc >= 1000000) businessScore += 50;
    if (agg >= 2000000) businessScore += 50;
  }

  const subScores: Record<string, number> = {
    life: Math.round(lifeScore),
    disability: Math.round(disabilityScore),
    health: Math.round(healthScore),
    home: Math.round(homeScore),
    auto: Math.round(autoScore),
    umbrella: Math.round(umbrellaScore),
    business: Math.round(businessScore)
  };

  // Calculate weighted scores
  const baseWeights: Record<string, number> = { 
    life: 0.15, 
    health: 0.20, 
    disability: 0.15, 
    home: 0.15, 
    auto: 0.10, 
    umbrella: 0.10, 
    business: 0.15 
  };
  
  const applicable: Record<string, number> = { ...baseWeights };
  let totalW = 0;
  Object.keys(applicable).forEach(k => {
    const na = (k === 'home' && primaryResidenceValue <= 0) ||
               (k === 'auto' && !hasAuto) ||
               (k === 'umbrella' && netWorth < 500000) ||
               (k === 'business' && !isSelfEmployed);
    if (na && subScores[k] === 100) applicable[k] = 0;
    totalW += applicable[k];
  });
  
  if (totalW > 0) Object.keys(applicable).forEach(k => applicable[k] = applicable[k] / totalW);

  let totalScore = 0; 
  const breakdown: Record<string, any> = {};
  Object.keys(subScores).forEach(k => {
    totalScore += subScores[k] * (applicable[k] || 0);
    breakdown[k] = { 
      score: subScores[k], 
      weight: Math.round((applicable[k] || 0) * 100), 
      weighted: Math.round(subScores[k] * (applicable[k] || 0)) 
    };
  });

  return { 
    score: Math.round(totalScore), 
    breakdown, 
    subScores 
  };
}

/**
 * Calculate enhanced financial metrics using Plaid + manual data
 */
export async function calculateFinancialMetricsWithPlaid(
  profileData: any, 
  estateDocuments: any[] = [],
  userId?: number
) {
  // Try to get Plaid aggregated data if userId is provided
  let plaidData: any = null;
  let plaidSnapshot: any = null;
  
  if (userId) {
    try {
      // Get latest snapshot (within 24 hours)
      plaidSnapshot = await PlaidDataAggregator.getLatestSnapshot(userId);
      
      // Get full financial picture
      plaidData = await PlaidDataAggregator.getUserCompleteFinancialPicture(userId);
    } catch (error) {
      console.log('Plaid data not available, using manual data only:', error);
    }
  }
  
  // Use Plaid snapshot data if available, otherwise fall back to manual calculations
  if (plaidSnapshot) {
    return calculateMetricsFromPlaidSnapshot(plaidSnapshot, profileData, plaidData);
  } else {
    return calculateMetricsFromManualData(profileData, estateDocuments);
  }
}

/**
 * Calculate metrics using Plaid aggregated snapshot
 */
function calculateMetricsFromPlaidSnapshot(
  snapshot: any,
  profileData: any,
  plaidData: any
) {
  // Extract values from snapshot
  const totalAssets = parseFloat(snapshot.totalAssets || '0');
  const totalLiabilities = parseFloat(snapshot.totalLiabilities || '0');
  
  // Calculate home equity from Step 4 (same as manual calculation)
  const primaryResidence = profileData.primaryResidence || {};
  const primaryHomeValue = parseFloat(primaryResidence.marketValue) || 0;
  const primaryMortgageBalance = parseFloat(primaryResidence.mortgageBalance) || 0;
  const primaryHomeEquity = primaryHomeValue - primaryMortgageBalance;
  
  // Calculate additional properties equity from Step 4
  const additionalProperties = Array.isArray(profileData.additionalProperties) ? profileData.additionalProperties : [];
  const additionalPropertiesEquity = additionalProperties.reduce((sum: number, property: any) => {
    const marketValue = parseFloat(property.marketValue) || 0;
    const mortgageBalance = parseFloat(property.mortgageBalance) || 0;
    return sum + (marketValue - mortgageBalance);
  }, 0);
  
  // Calculate net worth including real estate equity
  const netWorth = totalAssets - totalLiabilities + primaryHomeEquity + additionalPropertiesEquity;
  
  // Banking and investments
  const bankingAssets = parseFloat(snapshot.bankingAssets || '0');
  const investmentAssets = parseFloat(snapshot.investmentAssets || '0');
  const retirementAssets = parseFloat(snapshot.retirementAssets || '0');
  // Emergency funds from manual entry (user enters this in intake form)
  const emergencyFunds = parseFloat(profileData.emergencyFundSize || '0');
  const educationFunds = parseFloat(snapshot.educationFunds || '0');
  
  // Liabilities breakdown
  const creditCardDebt = parseFloat(snapshot.creditCardDebt || '0');
  const studentLoans = parseFloat(snapshot.studentLoans || '0');
  const personalLoans = parseFloat(snapshot.personalLoans || '0');
  const mortgageDebt = parseFloat(snapshot.mortgageDebt || '0');
  const otherDebt = parseFloat(snapshot.otherDebt || '0');
  
  // Cash flow from Plaid
  const monthlyIncome = parseFloat(snapshot.monthlyIncome || '0');
  const monthlyExpenses = parseFloat(snapshot.monthlyExpenses || '0');
  const monthlyCashFlow = parseFloat(snapshot.monthlyNetCashFlow || '0');
  
  // Investment allocation
  const stocksPercentage = parseFloat(snapshot.stocksPercentage || '0');
  const bondsPercentage = parseFloat(snapshot.bondsPercentage || '0');
  const cashPercentage = parseFloat(snapshot.cashPercentage || '0');
  const alternativesPercentage = parseFloat(snapshot.alternativesPercentage || '0');
  
  // Get manual income if Plaid income is missing
  const manualAnnualIncome = parseFloat(profileData.annualIncome || '0');
  const manualSpouseIncome = parseFloat(profileData.spouseAnnualIncome || '0');
  const manualMonthlyIncome = (manualAnnualIncome + manualSpouseIncome) / 12;
  
  // Use Plaid income if available, otherwise use manual
  const effectiveMonthlyIncome = monthlyIncome > 0 ? monthlyIncome : manualMonthlyIncome;
  const effectiveAnnualIncome = effectiveMonthlyIncome * 12;
  
  // Get manual monthly expenses if needed (respect manual override when provided)
  const manualMonthlyExpenses = profileData.monthlyExpenses || {};
  const manualOverride = parseFloat(profileData.totalMonthlyExpenses || manualMonthlyExpenses.total || '0') || 0;
  const summedCategorized = Object.values(manualMonthlyExpenses).reduce(
    (sum: number, expense: any) => sum + (parseFloat(expense) || 0), 0
  );
  const totalManualMonthlyExpenses = manualOverride > 0 ? manualOverride : summedCategorized;
  
  // Use Plaid expenses if available, otherwise use manual
  const effectiveMonthlyExpenses = monthlyExpenses > 0 ? monthlyExpenses : totalManualMonthlyExpenses;
  
  // Calculate effective cash flow
  const effectiveMonthlyCashFlow = effectiveMonthlyIncome - effectiveMonthlyExpenses;
  
  // Monthly retirement contributions (employee + IRA annuals to monthly)
  const userRetirement = (profileData as any)?.retirementContributions || { employee: 0, employer: 0 };
  const spouseRetirement = (profileData as any)?.spouseRetirementContributions || { employee: 0, employer: 0 };
  let monthlyRetirementContributions = (Number(userRetirement.employee) || 0) + (Number(spouseRetirement.employee) || 0);
  const monthlyTraditionalIRA = (Number((profileData as any)?.traditionalIRAContribution) || 0) / 12;
  const monthlyRothIRA = (Number((profileData as any)?.rothIRAContribution) || 0) / 12;
  const monthlySpouseTraditionalIRA = (Number((profileData as any)?.spouseTraditionalIRAContribution) || 0) / 12;
  const monthlySpouseRothIRA = (Number((profileData as any)?.spouseRothIRAContribution) || 0) / 12;
  monthlyRetirementContributions += monthlyTraditionalIRA + monthlyRothIRA + monthlySpouseTraditionalIRA + monthlySpouseRothIRA;
  
  const monthlyCashFlowAfterContributions = effectiveMonthlyCashFlow - monthlyRetirementContributions;
  
  // Emergency readiness calculation per CFP: use essential expenses and a 6-month target minimum
  const essentialMonthly = getEssentialMonthlyExpenses(profileData, effectiveMonthlyExpenses);
  const emergencyMonths = essentialMonthly > 0 ? emergencyFunds / essentialMonthly : 0;
  
  // Updated policy: minimum 6 months of essential expenses
  const emergencyFundTargetMonths = 6;
  
  // Calculate emergency readiness score
  let emergencyReadinessScoreCFP = 0;
  if (emergencyMonths >= emergencyFundTargetMonths) emergencyReadinessScoreCFP = 100;
  else if (emergencyMonths >= emergencyFundTargetMonths * 0.75) emergencyReadinessScoreCFP = 85;
  else if (emergencyMonths >= emergencyFundTargetMonths * 0.5) emergencyReadinessScoreCFP = 70;
  else if (emergencyMonths >= emergencyFundTargetMonths * 0.25) emergencyReadinessScoreCFP = 50;
  else if (emergencyMonths >= 1) emergencyReadinessScoreCFP = 30;
  else emergencyReadinessScoreCFP = 10;
  
  // Calculate debt metrics
  const totalDebt = creditCardDebt + studentLoans + personalLoans + mortgageDebt + otherDebt;
  
  // Estimate monthly debt payments (if not available from Plaid)
  const estimatedMonthlyDebtPayments = 
    (creditCardDebt * 0.03) + // 3% minimum for credit cards
    (studentLoans * 0.01) + // ~1% for student loans
    (personalLoans * 0.025) + // ~2.5% for personal loans
    (mortgageDebt * 0.004) + // ~0.4% for mortgages (30-year)
    (otherDebt * 0.02); // 2% for other debt
  
  const dtiRatio = effectiveMonthlyIncome > 0 ? 
    (estimatedMonthlyDebtPayments / effectiveMonthlyIncome) * 100 : 0;
  
  // Calculate savings rate using Plaid data
  const savingsRate = effectiveMonthlyIncome > 0 ? 
    (effectiveMonthlyCashFlow / effectiveMonthlyIncome) * 100 : 0;
  
  // Calculate insurance adequacy score (uses manual data only)
  const insuranceResult = computeInsuranceAdequacy(profileData, netWorth, effectiveMonthlyIncome);
  
  // COMPREHENSIVE FINANCIAL HEALTH SCORE CALCULATION
  // Based on AFFLUVIA specification with 5 weighted components
  
  // 1. Net Worth vs Income Score (25% weight)
  const netWorthRatio = effectiveAnnualIncome > 0 ? netWorth / effectiveAnnualIncome : 0;
  let netWorthScore = 0;
  if (netWorthRatio >= 5) {
    netWorthScore = 100;
  } else if (netWorthRatio >= 0) {
    netWorthScore = 30 + (netWorthRatio / 5) * 70;
  } else if (netWorthRatio >= -0.5) {
    netWorthScore = Math.max(0, 30 + (netWorthRatio + 0.5) / 0.5 * 30);
  } else {
    netWorthScore = 0;
  }
  
  // 2. Emergency Fund Score (20% weight) - use the already calculated CFP score directly
  const emergencyScore = emergencyReadinessScoreCFP;
  
  // 3. Debt-to-Income Score (20% weight)
  let dtiScore = 0;
  if (dtiRatio === 0) dtiScore = 100;
  else if (dtiRatio <= 10) dtiScore = 90;
  else if (dtiRatio <= 20) dtiScore = 80;
  else if (dtiRatio <= 28) dtiScore = 70;
  else if (dtiRatio <= 36) dtiScore = 60;
  else if (dtiRatio <= 43) dtiScore = 40;
  else if (dtiRatio <= 50) dtiScore = 20;
  else dtiScore = 0;
  
  // 4. Savings Rate Score (20% weight)
  let savingsRateScore = 0;
  if (savingsRate >= 20) savingsRateScore = 100;
  else if (savingsRate >= 15) savingsRateScore = 85;
  else if (savingsRate >= 10) savingsRateScore = 70;
  else if (savingsRate >= 5) savingsRateScore = 50;
  else if (savingsRate > 0) savingsRateScore = 30;
  else savingsRateScore = 0;
  
  // 5. Insurance Score (15% weight) - already calculated
  const insuranceScore = insuranceResult.score;
  
  // Calculate weighted health score
  const healthScore = Math.round(
    (netWorthScore * 0.25) +
    (emergencyScore * 0.20) +
    (dtiScore * 0.20) +
    (savingsRateScore * 0.20) +
    (insuranceScore * 0.15)
  );
  
  // Enhanced retirement score using Plaid data
  const currentAge = profileData.dateOfBirth ? 
    new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear() : 30;
  const retirementAge = parseInt(profileData.retirementAge) || 67;
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  
  // Calculate retirement readiness based on age and current savings
  const annualExpenses = effectiveMonthlyExpenses * 12;
  const targetRetirementSavings = annualExpenses * 25; // 4% rule
  
  // Include all retirement assets (401k, IRA, etc.)
  const totalRetirementAssets = retirementAssets;
  
  // Adjust retirement score based on years to retirement
  let retirementScore = 0;
  if (yearsToRetirement > 20) {
    // Young savers - focus on contribution rate
    const expectedSavings = effectiveAnnualIncome * 1 * (currentAge - 25); // 1x income by 30
    retirementScore = Math.min(100, (totalRetirementAssets / Math.max(expectedSavings, 10000)) * 100);
  } else if (yearsToRetirement > 10) {
    // Mid-career - should have 3-5x annual income
    const expectedSavings = effectiveAnnualIncome * 3;
    retirementScore = Math.min(100, (totalRetirementAssets / expectedSavings) * 100);
  } else {
    // Near retirement - should be close to target
    retirementScore = targetRetirementSavings > 0 ? 
      Math.min(100, (totalRetirementAssets / targetRetirementSavings) * 100) : 0;
  }
  
  // Investment health score based on allocation
  let investmentScore = 0;
  const targetStockAllocation = Math.max(20, 100 - currentAge); // Age-based rule
  const allocationDiff = Math.abs(stocksPercentage - targetStockAllocation);
  
  if (allocationDiff <= 5) investmentScore = 100;
  else if (allocationDiff <= 10) investmentScore = 85;
  else if (allocationDiff <= 20) investmentScore = 70;
  else if (allocationDiff <= 30) investmentScore = 50;
  else investmentScore = 30;
  
  // Life goals score (if available)
  const lifeGoals = profileData.lifeGoals || profileData.goals || [];
  let goalsScore = 0;
  if (lifeGoals.length > 0) {
    const fundedGoals = lifeGoals.filter((goal: any) => {
      const targetAmount = parseFloat(goal.targetAmount || '0');
      const currentAmount = parseFloat(goal.currentAmount || '0');
      return currentAmount >= targetAmount * 0.5; // At least 50% funded
    });
    goalsScore = (fundedGoals.length / lifeGoals.length) * 100;
  }
  
  // Calculate risk profile from questionnaire
  const riskQuestionnaire = Array.isArray(profileData.riskQuestionnaire) ? profileData.riskQuestionnaire : 
                            Array.isArray(profileData.riskQuestions) ? profileData.riskQuestions : [];
  
  // New simplified scoring: Just use the first value (1-5) directly
  const riskScore = riskQuestionnaire.length > 0 ? riskQuestionnaire[0] : 3; // Default to Moderate (3)
  
  // Map risk score to profile according to simplified system
  let riskProfile = 'Moderate';
  let targetAllocation = { usStocks: 35, intlStocks: 15, bonds: 35, alternatives: 10, cash: 5 };
  
  if (riskScore === 1) {
    riskProfile = 'Conservative';
    targetAllocation = { usStocks: 15, intlStocks: 5, bonds: 60, alternatives: 5, cash: 15 };
  } else if (riskScore === 2) {
    riskProfile = 'Moderately Conservative';
    targetAllocation = { usStocks: 25, intlStocks: 10, bonds: 45, alternatives: 10, cash: 10 };
  } else if (riskScore === 3) {
    riskProfile = 'Moderate';
    targetAllocation = { usStocks: 35, intlStocks: 15, bonds: 35, alternatives: 10, cash: 5 };
  } else if (riskScore === 4) {
    riskProfile = 'Moderately Aggressive';
    targetAllocation = { usStocks: 45, intlStocks: 20, bonds: 25, alternatives: 8, cash: 2 };
  } else if (riskScore === 5) {
    riskProfile = 'Aggressive';
    targetAllocation = { usStocks: 55, intlStocks: 25, bonds: 10, alternatives: 8, cash: 2 };
  }

  // Calculate spouse risk profile if married and spouse risk questions exist
  let spouseRiskProfile = 'Not Assessed';
  let spouseTargetAllocation = null;
  let spouseRiskScore = 0;
  
  if (profileData.maritalStatus === 'married' && profileData.spouseRiskQuestions && Array.isArray(profileData.spouseRiskQuestions) && profileData.spouseRiskQuestions.length > 0) {
    const spouseRiskQuestionnaire = profileData.spouseRiskQuestions;
    // New simplified scoring: Just use the first value (1-5) directly
    spouseRiskScore = spouseRiskQuestionnaire.length > 0 ? spouseRiskQuestionnaire[0] : 3; // Default to Moderate (3)
    
    // Map spouse risk score to profile using simplified system
    if (spouseRiskScore === 1) {
      spouseRiskProfile = 'Conservative';
      spouseTargetAllocation = { usStocks: 15, intlStocks: 5, bonds: 60, alternatives: 5, cash: 15 };
    } else if (spouseRiskScore === 2) {
      spouseRiskProfile = 'Moderately Conservative';
      spouseTargetAllocation = { usStocks: 25, intlStocks: 10, bonds: 45, alternatives: 10, cash: 10 };
    } else if (spouseRiskScore === 3) {
      spouseRiskProfile = 'Moderate';
      spouseTargetAllocation = { usStocks: 35, intlStocks: 15, bonds: 35, alternatives: 10, cash: 5 };
    } else if (spouseRiskScore === 4) {
      spouseRiskProfile = 'Moderately Aggressive';
      spouseTargetAllocation = { usStocks: 45, intlStocks: 20, bonds: 25, alternatives: 8, cash: 2 };
    } else if (spouseRiskScore === 5) {
      spouseRiskProfile = 'Aggressive';
      spouseTargetAllocation = { usStocks: 55, intlStocks: 25, bonds: 10, alternatives: 8, cash: 2 };
    }
  }
  
  return {
    // Core metrics
    netWorth,
    totalAssets,
    totalLiabilities,
    
    // Monthly metrics
    monthlyIncome: effectiveMonthlyIncome,
    monthlyExpenses: effectiveMonthlyExpenses,
    monthlyCashFlow: effectiveMonthlyCashFlow,
    monthlyRetirementContributions,
    monthlyCashFlowAfterContributions,
    
    // Debt metrics
    totalDebt,
    creditCardDebt,
    studentLoans,
    personalLoans,
    mortgageDebt,
    dtiRatio,
    monthlyDebtPayments: estimatedMonthlyDebtPayments,
    
    // Asset breakdown
    bankingAssets,
    investmentAssets,
    retirementAssets,
    emergencyFunds,
    educationFunds,
    
    // Investment allocation
    allocation: {
      stocks: stocksPercentage,
      bonds: bondsPercentage,
      cash: cashPercentage,
      alternatives: alternativesPercentage
    },
    
    // Scores
    emergencyMonths,
    emergencyReadinessScore: emergencyReadinessScoreCFP,
    emergencyScore: emergencyScore,  // Add direct field for API consistency
    emergencyFundTarget: emergencyFundTargetMonths * essentialMonthly,
    savingsRate,
    healthScore: Math.min(100, healthScore),
    retirementScore: Math.min(100, retirementScore),
    investmentScore,
    goalsScore,
    cashFlowScore: Math.min(100, savingsRateScore),  // Add cash flow score
    
    // Insurance adequacy
    insuranceAdequacy: {
      score: insuranceResult.score,
      breakdown: insuranceResult.breakdown,
      subScores: insuranceResult.subScores
    },
    riskManagementScore: insuranceResult.score,
    insuranceScore: insuranceResult.score,  // Add direct field for API consistency
    
    // Risk profile and allocation
    riskProfile,
    riskScore,
    targetAllocation,
    spouseRiskProfile,
    spouseRiskScore,
    spouseTargetAllocation,
    
    // Additional info
    yearsToRetirement,
    currentAge,
    
    // Breakdown for compatibility
    breakdown: {
      netWorthScore: Math.round(netWorthScore),
      emergencyFundScore: Math.round(emergencyScore),
      dtiScore: Math.round(dtiScore),
      savingsRateScore: Math.round(savingsRateScore),
      insuranceScore: Math.round(insuranceScore)
    },
    
    // Data source tracking
    dataSource: 'plaid_enhanced',
    lastSynced: snapshot.snapshotDate,
    plaidAccounts: snapshot.linkedAccountCount || 0
  };
}

/**
 * Fall back to manual calculations (original logic)
 */
function calculateMetricsFromManualData(profileData: any, estateDocuments: any[] = []) {
  const assets = Array.isArray(profileData.assets) ? profileData.assets : [];
  const liabilities = Array.isArray(profileData.liabilities) ? profileData.liabilities : [];

  // Calculate basic metrics
  const totalAssets = assets.reduce((sum: number, asset: any) => sum + (parseFloat(asset.value) || 0), 0);
  const totalLiabilities = liabilities.reduce((sum: number, debt: any) => sum + (parseFloat(debt.balance) || 0), 0);
  
  // Calculate home equity from Step 4
  const primaryResidence = profileData.primaryResidence || {};
  const primaryHomeValue = parseFloat(primaryResidence.marketValue) || 0;
  const primaryMortgageBalance = parseFloat(primaryResidence.mortgageBalance) || 0;
  const primaryHomeEquity = primaryHomeValue - primaryMortgageBalance;
  
  // Calculate additional properties equity from Step 4
  const additionalProperties = Array.isArray(profileData.additionalProperties) ? profileData.additionalProperties : [];
  const additionalPropertiesEquity = additionalProperties.reduce((sum: number, property: any) => {
    const marketValue = parseFloat(property.marketValue) || 0;
    const mortgageBalance = parseFloat(property.mortgageBalance) || 0;
    return sum + (marketValue - mortgageBalance);
  }, 0);
  
  // Net worth = Assets from Step 3 - Liabilities from Step 3 + Home Equity from Step 4
  const netWorth = totalAssets - totalLiabilities + primaryHomeEquity + additionalPropertiesEquity;

  // Get annual income (gross for reporting)
  const annualIncome = parseFloat(profileData.annualIncome) || 0;
  const spouseAnnualIncome = parseFloat(profileData.spouseAnnualIncome) || 0;
  const otherIncome = parseFloat(profileData.otherIncome) || 0;
  
  // Get take-home income (after taxes) for cash flow calculation
  // These are from Step 2 of intake form: "Your Annual Take-Home Income (After Taxes)"
  const takeHomeIncome = parseFloat(profileData.takeHomeIncome) || 0;
  const spouseTakeHomeIncome = parseFloat(profileData.spouseTakeHomeIncome) || 0;
  
  // Use take-home income if provided, otherwise estimate from gross (75% assumption)
  const effectiveTakeHomeIncome = takeHomeIncome > 0 ? takeHomeIncome : annualIncome * 0.75;
  const effectiveSpouseTakeHome = spouseTakeHomeIncome > 0 ? spouseTakeHomeIncome : spouseAnnualIncome * 0.75;
  
  // Total annual after-tax income for cash flow calculation
  const totalAnnualTakeHome = effectiveTakeHomeIncome + effectiveSpouseTakeHome + otherIncome;
  // Total gross income for other calculations
  const totalAnnualIncome = annualIncome + spouseAnnualIncome + otherIncome;

  // Calculate monthly expenses - 3-tier hierarchy
  const monthlyExpenses = profileData.monthlyExpenses || {};
  
  // Priority 1: Sum of categorized expenses from Step 5
  // Filter out metadata fields (those starting with _ or special fields like 'total')
  const categorizedExpenses = Object.entries(monthlyExpenses)
    .filter(([key]) => !key.startsWith('_') && key !== 'total')
    .reduce((sum: number, [, expense]: [string, any]) => sum + (parseFloat(expense) || 0), 0);
  
  // Priority 2: Manual total override from "Total Monthly Expenses (Manual Override)" field
  const manualTotalExpenses = parseFloat(profileData.totalMonthlyExpenses) || parseFloat(monthlyExpenses.total) || 0;
  
  // Priority 3: Plaid-imported expenses from checking account transactions
  const plaidImportedExpenses = monthlyExpenses._lastAutoFill?.total || 0;
  
  // Use hierarchy: categorized > manual > Plaid-imported
  let totalMonthlyExpenses = 0;
  let expenseSource = '';
  
  if (categorizedExpenses > 0) {
    totalMonthlyExpenses = categorizedExpenses;
    expenseSource = 'categorized';
  } else if (manualTotalExpenses > 0) {
    totalMonthlyExpenses = manualTotalExpenses;
    expenseSource = 'manual_override';
  } else if (plaidImportedExpenses > 0) {
    totalMonthlyExpenses = plaidImportedExpenses;
    expenseSource = 'plaid_imported';
  }
  
  const annualExpenses = totalMonthlyExpenses * 12;

  // Calculate monthly cash flow using AFTER-TAX income
  const monthlyTakeHome = totalAnnualTakeHome / 12;
  const monthlyCashFlow = monthlyTakeHome - totalMonthlyExpenses;

  // Monthly retirement contributions (employee + IRA annuals to monthly)
  const userRetirement = (profileData as any)?.retirementContributions || { employee: 0, employer: 0 };
  const spouseRetirement = (profileData as any)?.spouseRetirementContributions || { employee: 0, employer: 0 };
  let monthlyRetirementContributions = (Number(userRetirement.employee) || 0) + (Number(spouseRetirement.employee) || 0);
  const monthlyTraditionalIRA = (Number((profileData as any)?.traditionalIRAContribution) || 0) / 12;
  const monthlyRothIRA = (Number((profileData as any)?.rothIRAContribution) || 0) / 12;
  const monthlySpouseTraditionalIRA = (Number((profileData as any)?.spouseTraditionalIRAContribution) || 0) / 12;
  const monthlySpouseRothIRA = (Number((profileData as any)?.spouseRothIRAContribution) || 0) / 12;
  monthlyRetirementContributions += monthlyTraditionalIRA + monthlyRothIRA + monthlySpouseTraditionalIRA + monthlySpouseRothIRA;
  
  const monthlyCashFlowAfterContributions = monthlyCashFlow - monthlyRetirementContributions;
  
  // Keep monthlyIncome as gross for other calculations (DTI ratio, etc.)
  const monthlyIncome = totalAnnualIncome / 12;

  // Calculate emergency fund metrics (user enters emergencyFundSize manually in intake form)
  const emergencyFundSize = parseFloat(profileData.emergencyFundSize) || 0;
  const essentialMonthly = getEssentialMonthlyExpenses(profileData, totalMonthlyExpenses);
  const emergencyMonths = essentialMonthly > 0 ? emergencyFundSize / essentialMonthly : 0;

  // Determine emergency fund target
  const emergencyFundTargetMonths = 6; // Updated policy: minimum 6 months of essential expenses

  // Calculate debt-to-income ratio (uses GROSS income per industry standard)
  const monthlyDebtPayments = liabilities.reduce((sum: number, debt: any) => sum + (parseFloat(debt.monthlyPayment) || 0), 0);
  const dtiRatio = monthlyIncome > 0 ? (monthlyDebtPayments / monthlyIncome) * 100 : 0;

  // Calculate savings rate (uses TAKE-HOME income for accuracy)
  const savingsRate = monthlyTakeHome > 0 ? (monthlyCashFlow / monthlyTakeHome) * 100 : 0;

  // Calculate emergency readiness score
  let emergencyReadinessScoreCFP = 0;
  if (emergencyMonths >= emergencyFundTargetMonths) emergencyReadinessScoreCFP = 100;
  else if (emergencyMonths >= emergencyFundTargetMonths * 0.75) emergencyReadinessScoreCFP = 85;
  else if (emergencyMonths >= emergencyFundTargetMonths * 0.5) emergencyReadinessScoreCFP = 70;
  else if (emergencyMonths >= emergencyFundTargetMonths * 0.25) emergencyReadinessScoreCFP = 50;
  else if (emergencyMonths >= 1) emergencyReadinessScoreCFP = 30;
  else emergencyReadinessScoreCFP = 10;

  // Calculate insurance adequacy score (uses manual data only) - needed for health score
  const insuranceResult = computeInsuranceAdequacy(profileData, netWorth, monthlyIncome);

  // COMPREHENSIVE FINANCIAL HEALTH SCORE CALCULATION
  // Based on AFFLUVIA specification with 5 weighted components
  
  // 1. Net Worth vs Income Score (25% weight)
  const netWorthRatio = totalAnnualIncome > 0 ? netWorth / totalAnnualIncome : 0;
  let netWorthScore = 0;
  if (netWorthRatio >= 5) {
    netWorthScore = 100;
  } else if (netWorthRatio >= 0) {
    netWorthScore = 30 + (netWorthRatio / 5) * 70;
  } else if (netWorthRatio >= -0.5) {
    netWorthScore = Math.max(0, 30 + (netWorthRatio + 0.5) / 0.5 * 30);
  } else {
    netWorthScore = 0;
  }
  
  // 2. Emergency Fund Score (20% weight) - use the already calculated CFP score directly
  const emergencyScore = emergencyReadinessScoreCFP;
  
  // 3. Debt-to-Income Score (20% weight)
  let dtiScore = 0;
  if (dtiRatio === 0) dtiScore = 100;
  else if (dtiRatio <= 10) dtiScore = 90;
  else if (dtiRatio <= 20) dtiScore = 80;
  else if (dtiRatio <= 28) dtiScore = 70;
  else if (dtiRatio <= 36) dtiScore = 60;
  else if (dtiRatio <= 43) dtiScore = 40;
  else if (dtiRatio <= 50) dtiScore = 20;
  else dtiScore = 0;
  
  // 4. Savings Rate Score (20% weight)
  let savingsRateScore = 0;
  if (savingsRate >= 20) savingsRateScore = 100;
  else if (savingsRate >= 15) savingsRateScore = 85;
  else if (savingsRate >= 10) savingsRateScore = 70;
  else if (savingsRate >= 5) savingsRateScore = 50;
  else if (savingsRate > 0) savingsRateScore = 30;
  else savingsRateScore = 0;
  
  // 5. Insurance Score (15% weight) - calculate now
  const insuranceScore = insuranceResult.score;
  
  // Calculate weighted health score
  const healthScore = Math.round(
    (netWorthScore * 0.25) +
    (emergencyScore * 0.20) +
    (dtiScore * 0.20) +
    (savingsRateScore * 0.20) +
    (insuranceScore * 0.15)
  );

  // Basic retirement score calculation
  const currentAge = profileData.dateOfBirth ? 
    new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear() : 30;
  const retirementAge = parseInt(profileData.retirementAge) || 67;
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  
  // Get retirement assets
  const retirementAssets = assets.filter((asset: any) => 
    asset.type && (
      asset.type.toLowerCase().includes('401') ||
      asset.type.toLowerCase().includes('ira') ||
      asset.type.toLowerCase().includes('retirement') ||
      asset.type.toLowerCase().includes('pension')
    )
  );
  const totalRetirementAssets = retirementAssets.reduce((sum: number, asset: any) => sum + (parseFloat(asset.value) || 0), 0);
  
  // Simple retirement score based on current savings vs target
  const targetRetirementSavings = annualExpenses * 25; // 4% rule
  const retirementScore = targetRetirementSavings > 0 ? 
    Math.min(100, (totalRetirementAssets / targetRetirementSavings) * 100) : 0;

  // Calculate risk profile from questionnaire
  const riskQuestionnaire = Array.isArray(profileData.riskQuestionnaire) ? profileData.riskQuestionnaire : 
                            Array.isArray(profileData.riskQuestions) ? profileData.riskQuestions : [];
  
  // New simplified scoring: Just use the first value (1-5) directly
  const riskScore = riskQuestionnaire.length > 0 ? riskQuestionnaire[0] : 3; // Default to Moderate (3)
  
  // Map risk score to profile according to simplified system
  let riskProfile = 'Moderate';
  let targetAllocation = { usStocks: 35, intlStocks: 15, bonds: 35, alternatives: 10, cash: 5 };
  
  if (riskScore === 1) {
    riskProfile = 'Conservative';
    targetAllocation = { usStocks: 15, intlStocks: 5, bonds: 60, alternatives: 5, cash: 15 };
  } else if (riskScore === 2) {
    riskProfile = 'Moderately Conservative';
    targetAllocation = { usStocks: 25, intlStocks: 10, bonds: 45, alternatives: 10, cash: 10 };
  } else if (riskScore === 3) {
    riskProfile = 'Moderate';
    targetAllocation = { usStocks: 35, intlStocks: 15, bonds: 35, alternatives: 10, cash: 5 };
  } else if (riskScore === 4) {
    riskProfile = 'Moderately Aggressive';
    targetAllocation = { usStocks: 45, intlStocks: 20, bonds: 25, alternatives: 8, cash: 2 };
  } else if (riskScore === 5) {
    riskProfile = 'Aggressive';
    targetAllocation = { usStocks: 55, intlStocks: 25, bonds: 10, alternatives: 8, cash: 2 };
  }

  // Calculate spouse risk profile if married and spouse risk questions exist
  let spouseRiskProfile = 'Not Assessed';
  let spouseTargetAllocation = null;
  let spouseRiskScore = 0;
  
  if (profileData.maritalStatus === 'married' && profileData.spouseRiskQuestions && Array.isArray(profileData.spouseRiskQuestions) && profileData.spouseRiskQuestions.length > 0) {
    const spouseRiskQuestionnaire = profileData.spouseRiskQuestions;
    // New simplified scoring: Just use the first value (1-5) directly
    spouseRiskScore = spouseRiskQuestionnaire.length > 0 ? spouseRiskQuestionnaire[0] : 3; // Default to Moderate (3)
    
    // Map spouse risk score to profile using simplified system
    if (spouseRiskScore === 1) {
      spouseRiskProfile = 'Conservative';
      spouseTargetAllocation = { usStocks: 15, intlStocks: 5, bonds: 60, alternatives: 5, cash: 15 };
    } else if (spouseRiskScore === 2) {
      spouseRiskProfile = 'Moderately Conservative';
      spouseTargetAllocation = { usStocks: 25, intlStocks: 10, bonds: 45, alternatives: 10, cash: 10 };
    } else if (spouseRiskScore === 3) {
      spouseRiskProfile = 'Moderate';
      spouseTargetAllocation = { usStocks: 35, intlStocks: 15, bonds: 35, alternatives: 10, cash: 5 };
    } else if (spouseRiskScore === 4) {
      spouseRiskProfile = 'Moderately Aggressive';
      spouseTargetAllocation = { usStocks: 45, intlStocks: 20, bonds: 25, alternatives: 8, cash: 2 };
    } else if (spouseRiskScore === 5) {
      spouseRiskProfile = 'Aggressive';
      spouseTargetAllocation = { usStocks: 55, intlStocks: 25, bonds: 10, alternatives: 8, cash: 2 };
    }
  }

  return {
    // Core metrics
    netWorth,
    totalAssets,
    totalLiabilities,
    
    // Monthly metrics
    monthlyIncome,
    monthlyExpenses: totalMonthlyExpenses,
    monthlyCashFlow,
    monthlyRetirementContributions,
    monthlyCashFlowAfterContributions,
    
    // Debt metrics
    totalDebt: totalLiabilities,
    dtiRatio,
    monthlyDebtPayments,
    
    // Scores
    emergencyMonths,
    emergencyReadinessScore: emergencyReadinessScoreCFP,
    emergencyScore: emergencyScore,  // Add direct field for API consistency
    emergencyFundTarget: emergencyFundTargetMonths * essentialMonthly,
    savingsRate,
    healthScore: Math.min(100, healthScore),
    retirementScore: Math.min(100, retirementScore),
    cashFlowScore: Math.min(100, savingsRateScore),  // Add cash flow score
    
    // Insurance adequacy
    insuranceAdequacy: {
      score: insuranceResult.score,
      breakdown: insuranceResult.breakdown,
      subScores: insuranceResult.subScores
    },
    riskManagementScore: insuranceResult.score,
    insuranceScore: insuranceResult.score,  // Add direct field for API consistency
    
    // Breakdown for compatibility
    breakdown: {
      netWorthScore: Math.round(netWorthScore),
      emergencyFundScore: Math.round(emergencyScore),
      dtiScore: Math.round(dtiScore),
      savingsRateScore: Math.round(savingsRateScore),
      insuranceScore: Math.round(insuranceScore)
    },
    
    // Risk profile and allocation
    riskProfile,
    riskScore,
    targetAllocation,
    spouseRiskProfile,
    spouseRiskScore,
    spouseTargetAllocation,
    
    // Additional info
    yearsToRetirement,
    currentAge,
    totalRetirementAssets,
    
    // Data source tracking
    dataSource: 'manual',
    plaidAccounts: 0
  };
}

// Function is already exported above, no need to re-export
