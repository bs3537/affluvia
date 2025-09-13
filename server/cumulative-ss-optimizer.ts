/**
 * New Social Security Optimizer
 * Calculates optimal claiming age based on cumulative (non-discounted) lifetime benefits
 * Tests all ages from 62 to 70 for both user and spouse
 */

import { calculateSocialSecurityBenefit } from './social-security-calculator.js';

interface BridgePeriodAnalysis {
  yearsOfBridge: number;
  totalBridgeCost: number;
  portfolioDrawdownPercent: number;
  bridgeFeasible: boolean;
  cashFlowShortfall: number;
  recommendation: string;
}

interface SuccessProbabilityImpact {
  successAtOptimalAge: number;
  successAtRetirementAge: number;
  successAt62: number;
  recommendedAge: number;
  warning?: string;
}

interface SSOptimizationResult {
  user: {
    optimalAge: number;
    cumulativeAtOptimal: number;
    cumulativeAtRetirement: number;
    difference: number;
    monthlyAtOptimal: number;
    monthlyAtRetirement: number;
  };
  spouse?: {
    optimalAge: number;
    cumulativeAtOptimal: number;
    cumulativeAtRetirement: number;
    difference: number;
    monthlyAtOptimal: number;
    monthlyAtRetirement: number;
  };
  combined: {
    optimalUserAge: number;
    optimalSpouseAge: number;
    totalCumulativeAtOptimal: number;
    totalCumulativeAtRetirement: number;
    totalDifference: number;
    percentageGain: number;
  };
  ageAnalysis: Array<{
    userAge: number;
    spouseAge: number;
    userMonthly: number;
    spouseMonthly: number;
    combinedMonthly: number;
    userCumulative: number;
    spouseCumulative: number;
    combinedCumulative: number;
    yearsReceiving: number;
  }>;
  bridgeAnalysis?: BridgePeriodAnalysis;
  successProbabilityImpact?: SuccessProbabilityImpact;
  constrainedRecommendation?: {
    recommendedUserAge: number;
    recommendedSpouseAge: number;
    reason: string;
  };
}

/**
 * Evaluate bridge period feasibility
 */
function evaluateBridgePeriod(
  profile: any,
  retirementAge: number,
  optimalSSAge: number
): BridgePeriodAnalysis {
  const bridgeYears = Math.max(0, optimalSSAge - retirementAge);
  const monthlyExpenses = profile.expectedMonthlyExpensesRetirement || profile.monthlyExpenses || 5000;
  const annualExpenses = monthlyExpenses * 12;
  const totalBridgeCost = annualExpenses * bridgeYears;
  
  // Calculate liquid assets (accessible for bridge period)
  const assets = profile.assets || [];
  const liquidAssets = assets
    .filter((a: any) => a.type === 'taxable' || a.type === '401k' || a.type === 'ira' || a.type === 'roth')
    .reduce((sum: number, a: any) => sum + (a.value || 0), 0);
  
  // Calculate total portfolio value including less liquid assets
  const totalPortfolio = assets.reduce((sum: number, a: any) => sum + (a.value || 0), 0);
  
  const portfolioDrawdownPercent = totalPortfolio > 0 ? (totalBridgeCost / totalPortfolio) * 100 : 100;
  const remainingAfterBridge = liquidAssets - totalBridgeCost;
  const yearsOfCoverageRemaining = remainingAfterBridge > 0 ? remainingAfterBridge / annualExpenses : 0;
  
  // Check feasibility based on multiple criteria
  const bridgeFeasible = 
    bridgeYears === 0 || // No bridge needed
    (remainingAfterBridge >= annualExpenses * 3 && // At least 3 years expenses left
     portfolioDrawdownPercent < 50); // Less than 50% portfolio depletion
  
  const cashFlowShortfall = Math.max(0, totalBridgeCost - liquidAssets);
  
  let recommendation = '';
  if (bridgeYears === 0) {
    recommendation = 'No bridge period needed';
  } else if (!bridgeFeasible) {
    if (cashFlowShortfall > 0) {
      recommendation = `Bridge period not feasible - would require $${cashFlowShortfall.toLocaleString()} more in liquid assets`;
    } else {
      recommendation = `Bridge period risky - would leave only ${yearsOfCoverageRemaining.toFixed(1)} years of expenses`;
    }
  } else {
    recommendation = `Bridge period appears feasible with ${yearsOfCoverageRemaining.toFixed(1)} years coverage remaining`;
  }
  
  return {
    yearsOfBridge: bridgeYears,
    totalBridgeCost,
    portfolioDrawdownPercent,
    bridgeFeasible,
    cashFlowShortfall,
    recommendation
  };
}

/**
 * Estimate success probability impact of different claiming ages
 */
function estimateSuccessProbabilityImpact(
  profile: any,
  optimalAge: number,
  retirementAge: number
): SuccessProbabilityImpact {
  const netWorth = profile.netWorth || 0;
  const monthlyExpenses = profile.expectedMonthlyExpensesRetirement || profile.monthlyExpenses || 5000;
  const annualExpenses = monthlyExpenses * 12;
  const yearsOfAssets = netWorth > 0 ? netWorth / annualExpenses : 0;
  
  // Simplified success probability estimation based on coverage ratio and bridge period
  const bridgeYears = Math.max(0, optimalAge - retirementAge);
  const bridgeCost = annualExpenses * bridgeYears;
  const assetsAfterBridge = Math.max(0, netWorth - bridgeCost);
  const yearsAfterBridge = assetsAfterBridge / annualExpenses;
  
  // Base success probabilities (simplified model)
  let successAtOptimal = 0.5; // Base 50%
  let successAtRetirement = 0.5;
  let successAt62 = 0.5;
  
  // Adjust based on years of coverage
  if (yearsOfAssets >= 30) {
    successAtOptimal = 0.95;
    successAtRetirement = 0.93;
    successAt62 = 0.90;
  } else if (yearsOfAssets >= 25) {
    successAtOptimal = 0.90;
    successAtRetirement = 0.88;
    successAt62 = 0.85;
  } else if (yearsOfAssets >= 20) {
    successAtOptimal = 0.80;
    successAtRetirement = 0.78;
    successAt62 = 0.75;
  } else if (yearsOfAssets >= 15) {
    successAtOptimal = 0.70;
    successAtRetirement = 0.68;
    successAt62 = 0.65;
  } else if (yearsOfAssets >= 10) {
    successAtOptimal = 0.55;
    successAtRetirement = 0.60;
    successAt62 = 0.58;
  } else {
    successAtOptimal = 0.30;
    successAtRetirement = 0.40;
    successAt62 = 0.45;
  }
  
  // Penalize success probability for bridge period stress
  if (bridgeYears > 0) {
    const bridgePenalty = Math.min(0.30, bridgeYears * 0.05); // 5% per bridge year, max 30%
    successAtOptimal = Math.max(0.20, successAtOptimal - bridgePenalty);
  }
  
  // Determine recommended age based on success probability
  let recommendedAge = optimalAge;
  let warning: string | undefined;
  
  if (successAtOptimal < 0.70 && successAtRetirement >= successAtOptimal) {
    recommendedAge = retirementAge;
    warning = `Claiming at ${optimalAge} may reduce retirement success to ${(successAtOptimal * 100).toFixed(0)}%. Consider claiming at ${retirementAge}.`;
  } else if (successAtOptimal < 0.50) {
    recommendedAge = 62; // Claim as early as possible
    warning = `Limited assets suggest claiming Social Security as early as possible for cash flow stability.`;
  }
  
  return {
    successAtOptimalAge: successAtOptimal,
    successAtRetirementAge: successAtRetirement,
    successAt62,
    recommendedAge,
    warning
  };
}

/**
 * Find the latest feasible claiming age given constraints
 */
function findLatestFeasibleClaimingAge(
  profile: any,
  retirementAge: number,
  maxAge: number = 70
): number {
  for (let age = maxAge; age >= 62; age--) {
    const bridgeAnalysis = evaluateBridgePeriod(profile, retirementAge, age);
    if (bridgeAnalysis.bridgeFeasible) {
      return age;
    }
  }
  return 62; // Default to earliest if nothing is feasible
}

/**
 * Calculate cumulative lifetime Social Security benefits (non-discounted)
 * @param monthlyBenefit Monthly benefit amount
 * @param claimAge Age when claiming starts
 * @param longevityAge Age at death (default 93)
 * @param colaRate Annual COLA adjustment (default 2.5%)
 */
function calculateCumulativeBenefit(
  monthlyBenefit: number,
  claimAge: number,
  longevityAge: number = 93,
  colaRate: number = 0.025
): number {
  const yearsReceiving = Math.max(0, longevityAge - claimAge);
  let cumulative = 0;
  
  for (let year = 0; year < yearsReceiving; year++) {
    // Apply COLA adjustment for each year
    const adjustedAnnualBenefit = monthlyBenefit * 12 * Math.pow(1 + colaRate, year);
    cumulative += adjustedAnnualBenefit;
  }
  
  return Math.round(cumulative);
}

/**
 * Calculate optimal Social Security claiming ages using cumulative benefits
 * @param profile Financial profile data
 */
export function calculateCumulativeSSOptimization(profile: any): SSOptimizationResult {
  console.log('=== NEW CUMULATIVE SS OPTIMIZER ===');
  
  // Extract user data
  const userIncome = profile.annualIncome || 0;
  const userMonthlyIncome = userIncome / 12;
  const userCurrentAge = profile.dateOfBirth ? 
    Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 51;
  const userRetirementAge = profile.desiredRetirementAge || 65;
  const longevityAge = 93; // Standard longevity assumption
  
  // Extract spouse data if married
  const isMarried = profile.maritalStatus === 'married';
  const spouseIncome = profile.spouseAnnualIncome || 0;
  const spouseMonthlyIncome = spouseIncome / 12;
  const spouseCurrentAge = profile.spouseDateOfBirth ? 
    Math.floor((Date.now() - new Date(profile.spouseDateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 51;
  const spouseRetirementAge = profile.spouseDesiredRetirementAge || 65;
  
  // Store all age combinations for analysis
  const ageAnalysis: SSOptimizationResult['ageAnalysis'] = [];
  
  // Calculate benefits for all age combinations
  let maxCombinedCumulative = 0;
  let optimalUserAge = 67;
  let optimalSpouseAge = 67;
  let cumulativeAtRetirement = 0;
  
  // Test all ages from 62 to 70
  for (let userAge = 62; userAge <= 70; userAge++) {
    // Calculate user benefit at this age
    const userMonthlyBenefit = userMonthlyIncome > 0 ? 
      calculateSocialSecurityBenefit(userMonthlyIncome, userCurrentAge, userAge) : 0;
    const userCumulative = calculateCumulativeBenefit(userMonthlyBenefit, userAge, longevityAge);
    
    if (isMarried && spouseMonthlyIncome > 0) {
      // Test all spouse ages too
      for (let spouseAge = 62; spouseAge <= 70; spouseAge++) {
        const spouseMonthlyBenefit = calculateSocialSecurityBenefit(spouseMonthlyIncome, spouseCurrentAge, spouseAge);
        const spouseCumulative = calculateCumulativeBenefit(spouseMonthlyBenefit, spouseAge, longevityAge);
        const combinedCumulative = userCumulative + spouseCumulative;
        
        // Store for analysis
        ageAnalysis.push({
          userAge,
          spouseAge,
          userMonthly: userMonthlyBenefit,
          spouseMonthly: spouseMonthlyBenefit,
          combinedMonthly: userMonthlyBenefit + spouseMonthlyBenefit,
          userCumulative,
          spouseCumulative,
          combinedCumulative,
          yearsReceiving: Math.min(longevityAge - userAge, longevityAge - spouseAge)
        });
        
        // Track maximum
        if (combinedCumulative > maxCombinedCumulative) {
          maxCombinedCumulative = combinedCumulative;
          optimalUserAge = userAge;
          optimalSpouseAge = spouseAge;
        }
        
        // Calculate retirement age scenario
        if (userAge === userRetirementAge && spouseAge === spouseRetirementAge) {
          cumulativeAtRetirement = combinedCumulative;
        }
      }
    } else {
      // Single or spouse with no income
      ageAnalysis.push({
        userAge,
        spouseAge: 0,
        userMonthly: userMonthlyBenefit,
        spouseMonthly: 0,
        combinedMonthly: userMonthlyBenefit,
        userCumulative,
        spouseCumulative: 0,
        combinedCumulative: userCumulative,
        yearsReceiving: longevityAge - userAge
      });
      
      if (userCumulative > maxCombinedCumulative) {
        maxCombinedCumulative = userCumulative;
        optimalUserAge = userAge;
      }
      
      if (userAge === userRetirementAge) {
        cumulativeAtRetirement = userCumulative;
      }
    }
  }
  
  // Calculate individual results for user
  const userMonthlyAtOptimal = userMonthlyIncome > 0 ? 
    calculateSocialSecurityBenefit(userMonthlyIncome, userCurrentAge, optimalUserAge) : 0;
  const userMonthlyAtRetirement = userMonthlyIncome > 0 ? 
    calculateSocialSecurityBenefit(userMonthlyIncome, userCurrentAge, userRetirementAge) : 0;
  const userCumulativeAtOptimal = calculateCumulativeBenefit(userMonthlyAtOptimal, optimalUserAge, longevityAge);
  const userCumulativeAtRetirement = calculateCumulativeBenefit(userMonthlyAtRetirement, userRetirementAge, longevityAge);
  
  const result: SSOptimizationResult = {
    user: {
      optimalAge: optimalUserAge,
      cumulativeAtOptimal: userCumulativeAtOptimal,
      cumulativeAtRetirement: userCumulativeAtRetirement,
      difference: userCumulativeAtOptimal - userCumulativeAtRetirement,
      monthlyAtOptimal: userMonthlyAtOptimal,
      monthlyAtRetirement: userMonthlyAtRetirement
    },
    combined: {
      optimalUserAge,
      optimalSpouseAge: isMarried ? optimalSpouseAge : 0,
      totalCumulativeAtOptimal: maxCombinedCumulative,
      totalCumulativeAtRetirement: cumulativeAtRetirement,
      totalDifference: maxCombinedCumulative - cumulativeAtRetirement,
      percentageGain: cumulativeAtRetirement > 0 ? 
        ((maxCombinedCumulative - cumulativeAtRetirement) / cumulativeAtRetirement) * 100 : 0
    },
    ageAnalysis: ageAnalysis.sort((a, b) => b.combinedCumulative - a.combinedCumulative).slice(0, 10)
  };
  
  // Add spouse results if married
  if (isMarried && spouseMonthlyIncome > 0) {
    const spouseMonthlyAtOptimal = calculateSocialSecurityBenefit(spouseMonthlyIncome, spouseCurrentAge, optimalSpouseAge);
    const spouseMonthlyAtRetirement = calculateSocialSecurityBenefit(spouseMonthlyIncome, spouseCurrentAge, spouseRetirementAge);
    const spouseCumulativeAtOptimal = calculateCumulativeBenefit(spouseMonthlyAtOptimal, optimalSpouseAge, longevityAge);
    const spouseCumulativeAtRetirement = calculateCumulativeBenefit(spouseMonthlyAtRetirement, spouseRetirementAge, longevityAge);
    
    result.spouse = {
      optimalAge: optimalSpouseAge,
      cumulativeAtOptimal: spouseCumulativeAtOptimal,
      cumulativeAtRetirement: spouseCumulativeAtRetirement,
      difference: spouseCumulativeAtOptimal - spouseCumulativeAtRetirement,
      monthlyAtOptimal: spouseMonthlyAtOptimal,
      monthlyAtRetirement: spouseMonthlyAtRetirement
    };
  }
  
  // Ensure all key claiming ages are included in ageAnalysis for proper scenario display
  const keyAges = [62, 67, 70]; // Always include these ages
  if (userRetirementAge !== 62 && userRetirementAge !== 67 && userRetirementAge !== 70) {
    keyAges.push(userRetirementAge);
  }
  if (isMarried && spouseRetirementAge !== 62 && spouseRetirementAge !== 67 && spouseRetirementAge !== 70) {
    keyAges.push(spouseRetirementAge);
  }
  
  // Ensure optimal ages are included
  if (!keyAges.includes(optimalUserAge)) {
    keyAges.push(optimalUserAge);
  }
  if (isMarried && !keyAges.includes(optimalSpouseAge)) {
    keyAges.push(optimalSpouseAge);
  }
  
  // Filter ageAnalysis to ensure we have all key age combinations
  const keyScenarios = [];
  const addedCombinations = new Set();
  
  // First, add all scenarios that match our key ages
  for (const scenario of ageAnalysis) {
    const userAge = scenario.userAge;
    const spouseAge = scenario.spouseAge;
    const combination = `${userAge}-${spouseAge}`;
    
    if (keyAges.includes(userAge) && (!isMarried || keyAges.includes(spouseAge) || spouseAge === 0)) {
      keyScenarios.push(scenario);
      addedCombinations.add(combination);
    }
  }
  
  // Then add the top performers that aren't already included
  for (const scenario of ageAnalysis) {
    const combination = `${scenario.userAge}-${scenario.spouseAge}`;
    if (!addedCombinations.has(combination) && keyScenarios.length < 15) {
      keyScenarios.push(scenario);
      addedCombinations.add(combination);
    }
  }
  
  // Sort by combined cumulative benefits (highest first)
  result.ageAnalysis = keyScenarios.sort((a, b) => b.combinedCumulative - a.combinedCumulative);
  
  // Add bridge period analysis
  const bridgeAnalysis = evaluateBridgePeriod(profile, userRetirementAge, optimalUserAge);
  result.bridgeAnalysis = bridgeAnalysis;
  
  // Add success probability impact analysis
  const successProbability = estimateSuccessProbabilityImpact(profile, optimalUserAge, userRetirementAge);
  result.successProbabilityImpact = successProbability;
  
  // Check if we need to add a constrained recommendation
  if (!bridgeAnalysis.bridgeFeasible || successProbability.warning) {
    const constrainedUserAge = findLatestFeasibleClaimingAge(profile, userRetirementAge, optimalUserAge);
    const constrainedSpouseAge = isMarried ? findLatestFeasibleClaimingAge(profile, spouseRetirementAge, optimalSpouseAge) : 0;
    
    let reason = '';
    if (!bridgeAnalysis.bridgeFeasible) {
      reason = `Bridge period to age ${optimalUserAge} not feasible with current assets. `;
    }
    if (successProbability.warning) {
      reason += successProbability.warning;
    }
    
    result.constrainedRecommendation = {
      recommendedUserAge: Math.min(constrainedUserAge, successProbability.recommendedAge),
      recommendedSpouseAge: constrainedSpouseAge,
      reason: reason.trim()
    };
    
    console.log('⚠️ CONSTRAINED RECOMMENDATION:', result.constrainedRecommendation);
  }
  
  console.log('User optimal age:', optimalUserAge, 'Cumulative:', userCumulativeAtOptimal);
  if (result.spouse) {
    console.log('Spouse optimal age:', optimalSpouseAge, 'Cumulative:', result.spouse.cumulativeAtOptimal);
  }
  console.log('Combined gain:', result.combined.totalDifference, `(${result.combined.percentageGain.toFixed(1)}%)`);
  console.log('Bridge Analysis:', bridgeAnalysis.recommendation);
  console.log('Success Probability at Optimal:', (successProbability.successAtOptimalAge * 100).toFixed(0) + '%');
  if (successProbability.warning) {
    console.log('⚠️ WARNING:', successProbability.warning);
  }
  console.log('Key scenarios included:', keyScenarios.map(s => `${s.userAge}${s.spouseAge > 0 ? `/${s.spouseAge}` : ''}`).join(', '));
  console.log('=== END CUMULATIVE SS OPTIMIZER ===');
  
  return result;
}