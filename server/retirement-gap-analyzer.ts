// Retirement Gap Analyzer - Identifies top factors affecting retirement confidence score
import { RetirementMonteCarloParams, RetirementMonteCarloResult } from './monte-carlo-base';

export interface RetirementActionItem {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimatedScoreImprovement: number; // Estimated percentage point improvement
  category: 'savings' | 'insurance' | 'optimization' | 'allocation' | 'income';
  priority: number; // 1 = highest priority
}

export interface RetirementGapAnalysis {
  currentScore: number;
  targetScore: number;
  gap: number;
  topFactors: RetirementActionItem[];
}

// Analyze retirement gaps and generate prioritized action items
export function analyzeRetirementGaps(
  params: RetirementMonteCarloParams,
  result: RetirementMonteCarloResult,
  profile: any
): RetirementGapAnalysis {
  const currentScore = result.probabilityOfSuccess;
  const targetScore = 80; // Target 80% confidence
  const gap = Math.max(0, targetScore - currentScore);
  
  const actionItems: RetirementActionItem[] = [];
  
  // Only generate action items if score is below target
  if (currentScore < targetScore) {
    // 1. Long-Term Care Insurance Analysis
    if (!params.hasLongTermCareInsurance) {
      const ltcImpact = calculateLTCImpact(params);
      if (ltcImpact > 5) {
        actionItems.push({
          id: 'ltc-insurance',
          title: 'Purchase Long-Term Care Insurance',
          description: `Without LTC insurance, a long-term care event could significantly impact your retirement. Average LTC costs are $100k/year with 70% lifetime probability.`,
          impact: ltcImpact > 10 ? 'high' : 'medium',
          estimatedScoreImprovement: ltcImpact,
          category: 'insurance',
          priority: 0
        });
      }
    }
    
    // 2. Retirement Contribution Analysis
    const contributionGap = analyzeContributionGap(params, result);
    if (contributionGap.monthlyIncrease > 0) {
      actionItems.push({
        id: 'increase-contributions',
        title: 'Increase Retirement Contributions',
        description: `Increase monthly retirement savings by ${formatCurrency(contributionGap.monthlyIncrease)} to reach your retirement goals. Consider maximizing employer match first.`,
        impact: contributionGap.impact,
        estimatedScoreImprovement: contributionGap.scoreImprovement,
        category: 'savings',
        priority: 0
      });
    }
    
    // 3. Social Security Optimization
    const ssOptimization = analyzeSocialSecurityTiming(params, profile);
    if (ssOptimization.potentialGain > 0) {
      actionItems.push({
        id: 'optimize-social-security',
        title: 'Optimize Social Security Claiming Age',
        description: `Delay Social Security to age ${ssOptimization.optimalAge} to increase lifetime benefits by ${formatCurrency(ssOptimization.potentialGain)}.`,
        impact: ssOptimization.impact,
        estimatedScoreImprovement: ssOptimization.scoreImprovement,
        category: 'optimization',
        priority: 0
      });
    }
    
    // 4. Portfolio Allocation Analysis
    const allocationGap = analyzePortfolioAllocation(params, profile);
    if (allocationGap.needsAdjustment) {
      actionItems.push({
        id: 'optimize-allocation',
        title: 'Optimize Portfolio Allocation',
        description: `Adjust your portfolio to ${allocationGap.targetEquity}% stocks, ${allocationGap.targetBonds}% bonds for better risk-adjusted returns based on your age and risk tolerance.`,
        impact: allocationGap.impact,
        estimatedScoreImprovement: allocationGap.scoreImprovement,
        category: 'allocation',
        priority: 0
      });
    }
    
    // 5. Expense Reduction Analysis
    const expenseAnalysis = analyzeExpenseReduction(params);
    if (expenseAnalysis.potentialSavings > 0) {
      actionItems.push({
        id: 'reduce-expenses',
        title: 'Reduce Retirement Expenses',
        description: `Reducing monthly expenses by ${formatCurrency(expenseAnalysis.monthlySavings)} could significantly improve retirement security. Focus on ${expenseAnalysis.topCategory}.`,
        impact: expenseAnalysis.impact,
        estimatedScoreImprovement: expenseAnalysis.scoreImprovement,
        category: 'optimization',
        priority: 0
      });
    }
    
    // 6. Work Longer Analysis
    const workLongerAnalysis = analyzeWorkingLonger(params, result);
    if (workLongerAnalysis.yearsToWork > 0 && workLongerAnalysis.yearsToWork <= 5) {
      actionItems.push({
        id: 'work-longer',
        title: `Work ${workLongerAnalysis.yearsToWork} More Year${workLongerAnalysis.yearsToWork > 1 ? 's' : ''}`,
        description: `Delaying retirement by ${workLongerAnalysis.yearsToWork} year${workLongerAnalysis.yearsToWork > 1 ? 's' : ''} allows more savings and reduces portfolio withdrawal years.`,
        impact: workLongerAnalysis.impact,
        estimatedScoreImprovement: workLongerAnalysis.scoreImprovement,
        category: 'income',
        priority: 0
      });
    }
    
    // 7. Part-Time Income Analysis
    if (!params.partTimeIncomeRetirement || params.partTimeIncomeRetirement < 1000) {
      const partTimeAnalysis = analyzePartTimeIncome(params);
      actionItems.push({
        id: 'part-time-income',
        title: 'Consider Part-Time Work in Early Retirement',
        description: `Earning ${formatCurrency(partTimeAnalysis.suggestedIncome)}/month for the first 5-10 years of retirement can significantly reduce portfolio stress.`,
        impact: partTimeAnalysis.impact,
        estimatedScoreImprovement: partTimeAnalysis.scoreImprovement,
        category: 'income',
        priority: 0
      });
    }
    
    // 8. Healthcare Cost Planning
    const healthcareAnalysis = analyzeHealthcareCosts(params, profile);
    if (healthcareAnalysis.gap > 0) {
      actionItems.push({
        id: 'healthcare-planning',
        title: 'Plan for Healthcare Costs',
        description: `Healthcare costs are projected to be ${formatCurrency(healthcareAnalysis.monthlyHealthcare)}/month. Consider HSA contributions or supplemental insurance.`,
        impact: healthcareAnalysis.impact,
        estimatedScoreImprovement: healthcareAnalysis.scoreImprovement,
        category: 'insurance',
        priority: 0
      });
    }
    
    // Sort by estimated score improvement and assign priorities
    actionItems.sort((a, b) => b.estimatedScoreImprovement - a.estimatedScoreImprovement);
    actionItems.forEach((item, index) => {
      item.priority = index + 1;
    });
    
    // Return top 3 items
    const topFactors = actionItems.slice(0, 3);
    
    return {
      currentScore,
      targetScore,
      gap,
      topFactors
    };
  }
  
  return {
    currentScore,
    targetScore,
    gap,
    topFactors: []
  };
}

// Helper functions for impact calculations

function calculateLTCImpact(params: RetirementMonteCarloParams): number {
  // Base impact depends on age and assets
  const age = params.currentAge;
  const assetLevel = params.currentSavings;
  
  // Higher impact for older individuals with moderate assets
  if (age > 50 && assetLevel < 2000000) {
    return 12; // 12 percentage point improvement
  } else if (age > 45 && assetLevel < 1500000) {
    return 8;
  } else if (assetLevel < 1000000) {
    return 6;
  }
  return 4;
}

function analyzeContributionGap(params: RetirementMonteCarloParams, result: RetirementMonteCarloResult): any {
  const currentMonthlySavings = params.monthlyContribution;
  const yearsToRetirement = params.retirementAge - params.currentAge;
  
  // Calculate needed savings for 80% success rate
  const targetBalance = params.expectedExpenses * 25; // 4% rule approximation
  const currentProjected = result.projectedRetirementPortfolio;
  const gap = targetBalance - currentProjected;
  
  if (gap > 0 && yearsToRetirement > 0) {
    // Simple calculation for monthly increase needed
    const monthlyIncrease = gap / (yearsToRetirement * 12) / 1.5; // Assuming some growth
    
    return {
      monthlyIncrease,
      impact: monthlyIncrease > 1000 ? 'high' : monthlyIncrease > 500 ? 'medium' : 'low',
      scoreImprovement: Math.min(15, monthlyIncrease / 100) // Rough estimate
    };
  }
  
  return { monthlyIncrease: 0, impact: 'low', scoreImprovement: 0 };
}

function analyzeSocialSecurityTiming(params: RetirementMonteCarloParams, profile: any): any {
  const currentClaimAge = params.socialSecurityAge || 67;
  const maxAge = 70;
  
  if (currentClaimAge < maxAge) {
    const yearsToDelay = maxAge - currentClaimAge;
    const monthlyBenefit = params.socialSecurityBenefit || 2000;
    const increasePct = 0.08 * yearsToDelay; // 8% per year delay
    const lifetimeGain = monthlyBenefit * increasePct * 12 * 20; // Assume 20 years of benefits
    
    return {
      optimalAge: maxAge,
      potentialGain: lifetimeGain,
      impact: lifetimeGain > 100000 ? 'high' : 'medium',
      scoreImprovement: Math.min(10, lifetimeGain / 50000)
    };
  }
  
  return { optimalAge: currentClaimAge, potentialGain: 0, impact: 'low', scoreImprovement: 0 };
}

function analyzePortfolioAllocation(params: RetirementMonteCarloParams, profile: any): any {
  const age = params.currentAge;
  const targetEquity = Math.max(40, 110 - age); // Age-based rule of thumb
  
  // Get current allocation from profile (using same structure as dashboard)
  const currentAllocation = profile.currentAllocation || {};
  const currentEquity = (currentAllocation.usStocks || 0) + (currentAllocation.intlStocks || 0);
  const currentBonds = currentAllocation.bonds || 0;
  
  const equityGap = Math.abs(targetEquity - currentEquity);
  
  if (equityGap > 10) {
    return {
      needsAdjustment: true,
      targetEquity,
      targetBonds: 100 - targetEquity,
      impact: equityGap > 20 ? 'high' : 'medium',
      scoreImprovement: Math.min(8, equityGap / 5)
    };
  }
  
  return { needsAdjustment: false, impact: 'low', scoreImprovement: 0 };
}

function analyzeExpenseReduction(params: RetirementMonteCarloParams): any {
  const currentExpenses = params.expectedExpenses;
  const highExpenseThreshold = 8000; // Monthly
  
  if (currentExpenses > highExpenseThreshold) {
    const reductionTarget = currentExpenses * 0.1; // 10% reduction
    
    return {
      potentialSavings: reductionTarget * 12,
      monthlySavings: reductionTarget,
      topCategory: 'discretionary spending',
      impact: reductionTarget > 1000 ? 'high' : 'medium',
      scoreImprovement: Math.min(12, reductionTarget / 100)
    };
  }
  
  return { potentialSavings: 0, impact: 'low', scoreImprovement: 0 };
}

function analyzeWorkingLonger(params: RetirementMonteCarloParams, result: RetirementMonteCarloResult): any {
  const currentAge = params.currentAge;
  const retirementAge = params.retirementAge;
  const yearsToRetirement = retirementAge - currentAge;
  
  if (result.probabilityOfSuccess < 70 && yearsToRetirement > 0) {
    // Calculate years needed to reach 80% success
    const yearsNeeded = Math.min(5, Math.ceil((80 - result.probabilityOfSuccess) / 5));
    
    return {
      yearsToWork: yearsNeeded,
      impact: yearsNeeded > 3 ? 'high' : 'medium',
      scoreImprovement: yearsNeeded * 5
    };
  }
  
  return { yearsToWork: 0, impact: 'low', scoreImprovement: 0 };
}

function analyzePartTimeIncome(params: RetirementMonteCarloParams): any {
  const expenseGap = params.expectedExpenses - params.guaranteedIncome;
  const suggestedIncome = Math.min(3000, expenseGap * 0.3); // 30% of gap, max $3k/month
  
  return {
    suggestedIncome,
    impact: suggestedIncome > 2000 ? 'high' : 'medium',
    scoreImprovement: Math.min(10, suggestedIncome / 300)
  };
}

function analyzeHealthcareCosts(params: RetirementMonteCarloParams, profile: any): any {
  const age = params.currentAge;
  const retirementAge = params.retirementAge;
  const preMedicareYears = Math.max(0, 65 - retirementAge);
  
  if (preMedicareYears > 0) {
    const monthlyHealthcare = 800; // Estimated pre-Medicare costs
    const totalGap = monthlyHealthcare * 12 * preMedicareYears;
    
    return {
      gap: totalGap,
      monthlyHealthcare,
      impact: preMedicareYears > 5 ? 'high' : 'medium',
      scoreImprovement: Math.min(8, preMedicareYears * 1.5)
    };
  }
  
  return { gap: 0, impact: 'low', scoreImprovement: 0 };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}