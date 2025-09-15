import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildComprehensiveUserContext, formatUserDataForAI } from "../ai-context-builder";

interface FundingSource {
  id: string;
  type: 'asset' | 'loan' | 'monthly_savings';
  name: string;
  amount: number;
  interestRate?: number;
  termMonths?: number;
  monthlyAmount?: number;
}

interface LifeGoal {
  id: number;
  goalType: string;
  goalName: string;
  description?: string;
  targetDate: string;
  targetAmount: number;
  currentAmount?: number;
  fundingSources: string | FundingSource[];
  fundingPercentage?: number;
  priority?: string;
  status?: string;
  metadata?: string | Record<string, any>;
}

interface WhatIfScenario {
  monthlySavings?: number;
  loanAmount?: number;
  loanRate?: number;
  targetDate?: string;
  targetAmount?: number;
}

interface ScenarioResult {
  fundingPercentage: number;
  fundingGap: number;
  monthlyPayment?: number;
  totalInterest?: number;
  breakEvenMonth?: number;
  recommendation?: string;
}

export function calculateLifeGoalScenario(goal: LifeGoal, scenario: WhatIfScenario): ScenarioResult {
  // Parse funding sources if they're a string
  const fundingSources: FundingSource[] = typeof goal.fundingSources === 'string' 
    ? JSON.parse(goal.fundingSources) 
    : goal.fundingSources;
  
  // Calculate months to goal
  const targetDate = new Date(scenario.targetDate || goal.targetDate);
  const monthsToGoal = Math.max(0, 
    Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30))
  );
  
  // Calculate current funding from existing sources
  let currentFunding = goal.currentAmount || 0;
  
  fundingSources.forEach(source => {
    if (source.type === 'asset') {
      currentFunding += source.amount;
    } else if (source.type === 'loan') {
      currentFunding += source.amount;
    } else if (source.type === 'monthly_savings') {
      currentFunding += (source.monthlyAmount || 0) * monthsToGoal;
    }
  });
  
  // Add scenario adjustments
  if (scenario.monthlySavings) {
    currentFunding += scenario.monthlySavings * monthsToGoal;
  }
  
  if (scenario.loanAmount) {
    currentFunding += scenario.loanAmount;
  }
  
  const targetAmount = scenario.targetAmount || goal.targetAmount;
  const fundingPercentage = (currentFunding / targetAmount) * 100;
  const fundingGap = Math.max(0, targetAmount - currentFunding);
  
  // Calculate loan payments if applicable
  let monthlyPayment = scenario.monthlySavings || 0;
  let totalInterest = 0;
  
  if (scenario.loanAmount && scenario.loanRate) {
    const monthlyRate = scenario.loanRate / 100 / 12;
    const loanTermMonths = Math.min(monthsToGoal, 60); // Cap at 5 years
    
    if (monthlyRate > 0) {
      const loanPayment = scenario.loanAmount * 
        (monthlyRate * Math.pow(1 + monthlyRate, loanTermMonths)) / 
        (Math.pow(1 + monthlyRate, loanTermMonths) - 1);
      
      monthlyPayment += loanPayment;
      totalInterest = (loanPayment * loanTermMonths) - scenario.loanAmount;
    } else {
      monthlyPayment += scenario.loanAmount / loanTermMonths;
    }
  }
  
  // Calculate break-even month (when funding reaches target)
  let breakEvenMonth: number | undefined;
  if (scenario.monthlySavings && fundingGap > 0) {
    breakEvenMonth = Math.ceil(fundingGap / scenario.monthlySavings);
  }
  
  // Generate recommendation
  let recommendation = '';
  if (fundingPercentage >= 100) {
    recommendation = 'Great! This scenario fully funds your goal.';
  } else if (fundingPercentage >= 80) {
    recommendation = 'You\'re on track. Consider increasing monthly savings slightly to ensure full funding.';
  } else if (fundingPercentage >= 50) {
    recommendation = 'You\'re making progress, but need to increase funding sources or extend your timeline.';
  } else {
    recommendation = 'Significant additional funding is needed. Consider a combination of increased savings, loans, or adjusting your target.';
  }
  
  return {
    fundingPercentage: Math.round(fundingPercentage * 10) / 10,
    fundingGap,
    monthlyPayment: monthlyPayment > 0 ? Math.round(monthlyPayment) : undefined,
    totalInterest: totalInterest > 0 ? Math.round(totalInterest) : undefined,
    breakEvenMonth,
    recommendation
  };
}

export async function generateLifeGoalInsights(goal: LifeGoal, profile: any, userId?: number): Promise<any[]> {
  try {
    // Ignore Gemini insights for retirement and education goals per requirements
    if (goal.goalType === 'retirement' || goal.goalType === 'education') {
      return [];
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Parse funding sources and metadata
    const fundingSources = typeof goal.fundingSources === 'string' 
      ? JSON.parse(goal.fundingSources) 
      : goal.fundingSources || [];
    
    const metadata = typeof goal.metadata === 'string'
      ? JSON.parse(goal.metadata)
      : goal.metadata || {};
    
    // Calculate key metrics
    const monthsToGoal = Math.max(0,
      Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
    
    // Calculate current total funding from all sources
    let currentTotalFunding = 0;
    fundingSources.forEach((source: FundingSource) => {
      if (source.type === 'asset') {
        currentTotalFunding += source.amount || 0;
      } else if (source.type === 'loan') {
        currentTotalFunding += source.amount || 0;
      } else if (source.type === 'monthly_savings') {
        const monthlyAmount = source.monthlyAmount || 0;
        currentTotalFunding += monthlyAmount * monthsToGoal;
      }
    });
    
    // The ACTUAL shortfall is the difference between target and current funding
    const actualShortfall = Math.max(0, goal.targetAmount - currentTotalFunding);
    const shortfallPercentage = goal.targetAmount > 0 ? (actualShortfall / goal.targetAmount) * 100 : 0;
    
    // Extract detailed financial data from profile
    const monthlyIncome = ((profile.annualIncome || 0) + (profile.spouseAnnualIncome || 0)) / 12;
    const monthlyExpenses = profile.monthlyExpenses || 0;
    const monthlyCashFlow = monthlyIncome - monthlyExpenses;
    
    // Home equity calculation
    const homeValue = profile.homeValue || 0;
    const mortgageBalance = profile.mortgageBalance || 0;
    const homeEquity = Math.max(0, homeValue - mortgageBalance);
    const maxHELOC = Math.max(0, (homeValue * 0.8) - mortgageBalance); // 80% LTV
    
    // 401k loan calculation
    const user401k = profile.retirement401k || 0;
    const spouse401k = profile.spouseRetirement401k || 0;
    const total401k = user401k + spouse401k;
    const max401kLoan = Math.min(50000, total401k * 0.5); // IRS limit: 50% or $50k
    
    // Other assets
    const taxableInvestments = profile.taxableInvestments || 0;
    const emergencyFund = profile.emergencyFund || 0;
    const netWorth = profile.netWorth || 0;
    
    // Build comprehensive user context (if possible)
    let comprehensiveContext = '';
    if (typeof userId === 'number') {
      try {
        const userData = await buildComprehensiveUserContext(userId);
        comprehensiveContext = formatUserDataForAI(userData);
      } catch (e) {
        console.log('Error building comprehensive user context for insights:', e);
      }
    }

    const prompt = `
    You are AFFLUVIA AI, a CFP professional planner.
    THINK HARD. Reason step-by-step using the user's FULL financial context (intake, dashboard widgets, retirement planning results, optimized plan deltas).
    Use the user's ACTUAL numbers. Be precise, realistic, and prioritize impact. Do not output your internal reasoning, only final results.

    Analyze this life goal and provide SPECIFIC, PERSONALIZED recommendations to COMPLETELY ELIMINATE the funding shortfall.
    
    CRITICAL: THE ACTUAL SHORTFALL IS $${actualShortfall.toLocaleString()} - USE THIS NUMBER FOR ALL CALCULATIONS
    
    GOAL DETAILS:
    - Goal Type: ${goal.goalType}
    - Goal Name: ${goal.goalName}
    - Target Amount: $${goal.targetAmount.toLocaleString()}
    - Target Date: ${goal.targetDate} (${monthsToGoal} months away)
    - Current Total Funding: $${currentTotalFunding.toLocaleString()}
    - **ACTUAL SHORTFALL: $${actualShortfall.toLocaleString()} (${shortfallPercentage.toFixed(1)}%)**
    - Priority: ${goal.priority || 'medium'}
    
    EXISTING FUNDING SOURCES:
    ${JSON.stringify(fundingSources, null, 2)}
    
    CLIENT'S ACTUAL FINANCIAL DATA:
    - Monthly Household Income: $${Math.round(monthlyIncome).toLocaleString()}
    - Monthly Expenses: $${Math.round(monthlyExpenses).toLocaleString()}
    - **Monthly Cash Flow Available: $${Math.round(monthlyCashFlow).toLocaleString()}**
    - Emergency Fund: $${emergencyFund.toLocaleString()}
    - Taxable Investments: $${taxableInvestments.toLocaleString()}
    
    HOME EQUITY:
    - Home Value: $${homeValue.toLocaleString()}
    - Mortgage Balance: $${mortgageBalance.toLocaleString()}
    - **Available Home Equity: $${homeEquity.toLocaleString()}**
    - **Maximum HELOC Available: $${maxHELOC.toLocaleString()}**
    
    RETIREMENT ACCOUNTS:
    - User 401(k): $${user401k.toLocaleString()}
    - Spouse 401(k): $${spouse401k.toLocaleString()}
    - **Total 401(k): $${total401k.toLocaleString()}**
    - **Maximum 401(k) Loan: $${max401kLoan.toLocaleString()}**
    
    - Total Net Worth: $${netWorth.toLocaleString()}

    ${comprehensiveContext ? `\n\n=== USER CONTEXT (CONDENSED) ===\n${comprehensiveContext}` : ''}
    
    ${actualShortfall <= 0 ? 
      'NOTE: This goal is ALREADY FULLY FUNDED! Provide optimization recommendations instead.' :
      `PROVIDE AT LEAST 3 (ideally 3-5) SPECIFIC recommendations to eliminate the $${actualShortfall.toLocaleString()} shortfall.`
    }
    
    FOLLOW THIS EXACT PRIORITY ORDER:
    
    1. **FIRST - Monthly Cash Flow**: 
       - If monthly cash flow > 0, calculate EXACTLY how much per month is needed
       - Required monthly: $${monthsToGoal > 0 ? Math.round(actualShortfall / monthsToGoal) : 0}
       - Can they afford this from their $${Math.round(monthlyCashFlow)} monthly surplus?
    
    2. **SECOND - HELOC** (if cash flow insufficient):
       - They have $${homeEquity.toLocaleString()} in home equity
       - Can borrow up to $${maxHELOC.toLocaleString()} via HELOC
       - Calculate exact monthly payment at current rates (~8% APR)
       - Only suggest if they have sufficient equity
    
    3. **THIRD - 401(k) Loan** (last resort):
       - Can borrow up to $${max401kLoan.toLocaleString()}
       - Only suggest if shortfall > $${max401kLoan / 2} (need 2x coverage)
       - Calculate monthly payment over 5 years at ~6.5% rate
       - Mention opportunity cost
    
    4. **ALTERNATIVE OPTIONS**:
       - Liquidate portion of $${taxableInvestments.toLocaleString()} in taxable investments
       - Extend timeline to reduce monthly requirement
       - Reduce target amount if appropriate
    
    For EACH recommendation provide:
    - EXACT dollar amounts based on their ACTUAL data
    - Monthly payment if it's a loan
    - Why this option makes sense for THEIR specific situation
    - Any risks or considerations
    
    Return ONLY a JSON array with this structure (no markdown, no prose, JSON array only):
    [
      {
        "title": "Specific action with exact dollar amount",
        "description": "Detailed explanation using their ACTUAL numbers, monthly payments, and personalized advice",
        "priority": "high|medium|low",
        "actionable": true,
        "estimatedImpact": "Eliminates $X of the $${actualShortfall.toLocaleString()} shortfall (Y%)",
        "fundingType": "cashflow|heloc|401k|investment|other",
        "monthlyPayment": number or null,
        "totalCost": number,
        "shortfallReduction": number
      }
    ]
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]);
      
      // Sort by funding type priority
      const typeOrder = { cashflow: 0, investment: 1, heloc: 2, '401k': 3, other: 4 };
      insights.sort((a: any, b: any) => {
        const aOrder = typeOrder[a.fundingType as keyof typeof typeOrder] ?? 5;
        const bOrder = typeOrder[b.fundingType as keyof typeof typeOrder] ?? 5;
        return aOrder - bOrder;
      });
      
      // Ensure at least 3 insights; if fewer, top up with fallback
      if (Array.isArray(insights) && insights.length < 3) {
        const fallback = getEnhancedDefaultInsights(
          goal,
          profile,
          monthsToGoal,
          monthlyCashFlow,
          actualShortfall,
          {
            homeEquity,
            maxHELOC,
            total401k,
            max401kLoan,
            taxableInvestments
          }
        );
        const merged = [...insights, ...fallback];
        // De-duplicate by title and take first 3-5
        const seen = new Set<string>();
        const unique = merged.filter((i: any) => {
          const key = (i.title || '').toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return unique.slice(0, Math.max(3, Math.min(5, unique.length)));
      }
      return insights;
    }
    
    // Enhanced fallback if AI fails
    return getEnhancedDefaultInsights(
      goal, 
      profile, 
      monthsToGoal, 
      monthlyCashFlow, 
      actualShortfall,
      {
        homeEquity,
        maxHELOC,
        total401k,
        max401kLoan,
        taxableInvestments
      }
    );
    
  } catch (error) {
    console.error('Error generating AI insights:', error);
    
    // Calculate metrics for fallback
    const monthsToGoal = Math.max(0,
      Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
    
    // Parse funding sources to calculate actual shortfall
    const fundingSources = typeof goal.fundingSources === 'string' 
      ? JSON.parse(goal.fundingSources) 
      : goal.fundingSources || [];
    
    let currentTotalFunding = 0;
    fundingSources.forEach((source: FundingSource) => {
      if (source.type === 'asset') {
        currentTotalFunding += source.amount || 0;
      } else if (source.type === 'loan') {
        currentTotalFunding += source.amount || 0;
      } else if (source.type === 'monthly_savings') {
        currentTotalFunding += (source.monthlyAmount || 0) * monthsToGoal;
      }
    });
    
    const actualShortfall = Math.max(0, goal.targetAmount - currentTotalFunding);
    
    const monthlyIncome = ((profile.annualIncome || 0) + (profile.spouseAnnualIncome || 0)) / 12;
    const monthlyExpenses = profile.monthlyExpenses || 0;
    const monthlyCashFlow = monthlyIncome - monthlyExpenses;
    
    const homeValue = profile.homeValue || 0;
    const mortgageBalance = profile.mortgageBalance || 0;
    const homeEquity = Math.max(0, homeValue - mortgageBalance);
    const maxHELOC = Math.max(0, (homeValue * 0.8) - mortgageBalance);
    
    const user401k = profile.retirement401k || 0;
    const spouse401k = profile.spouseRetirement401k || 0;
    const total401k = user401k + spouse401k;
    const max401kLoan = Math.min(50000, total401k * 0.5);
    
    const taxableInvestments = profile.taxableInvestments || 0;
    
    return getEnhancedDefaultInsights(
      goal, 
      profile, 
      monthsToGoal, 
      monthlyCashFlow, 
      actualShortfall,
      {
        homeEquity,
        maxHELOC,
        total401k,
        max401kLoan,
        taxableInvestments
      }
    );
  }
}

function getDefaultInsights(goal: LifeGoal, profile: any, monthsToGoal: number, monthlySurplus: number): any[] {
  const insights = [];
  const fundingGap = goal.targetAmount - (goal.currentAmount || 0);
  const requiredMonthlySavings = fundingGap / monthsToGoal;
  
  // Insight 1: Monthly savings recommendation
  if (requiredMonthlySavings > 0) {
    insights.push({
      title: "Increase Monthly Savings",
      description: `To fully fund your ${goal.goalName}, you need to save $${Math.round(requiredMonthlySavings)}/month. ` +
        `This represents ${Math.round((requiredMonthlySavings / monthlySurplus) * 100)}% of your monthly surplus.`,
      priority: "high",
      actionable: true,
      estimatedImpact: `Achieve 100% funding by ${goal.targetDate}`
    });
  }
  
  // Insight 2: Timeline adjustment
  if (goal.fundingPercentage && goal.fundingPercentage < 50) {
    const additionalMonths = Math.ceil((fundingGap - (monthlySurplus * monthsToGoal)) / monthlySurplus);
    insights.push({
      title: "Consider Extending Timeline",
      description: `Your current funding rate suggests extending your target date by ${additionalMonths} months ` +
        `would allow you to achieve this goal without additional strain on your budget.`,
      priority: "medium",
      actionable: true,
      estimatedImpact: `Reduce required monthly savings by ${Math.round((additionalMonths / monthsToGoal) * 100)}%`
    });
  }
  
  // Insight 3: Asset reallocation
  if (profile.netWorth && profile.netWorth > goal.targetAmount * 2) {
    insights.push({
      title: "Reallocate Existing Assets",
      description: `With a net worth of $${profile.netWorth.toLocaleString()}, consider reallocating ` +
        `underperforming or low-priority assets toward this goal for faster achievement.`,
      priority: "medium",
      actionable: true,
      estimatedImpact: "Potentially achieve goal 6-12 months earlier"
    });
  }
  
  // Insight 4: Tax optimization
  if (goal.goalType === 'home-purchase') {
    insights.push({
      title: "Maximize Tax Benefits",
      description: "First-time homebuyers may qualify for tax credits and deductions. " +
        "Consider using tax-advantaged accounts like Roth IRA (up to $10,000 withdrawal) for down payment.",
      priority: "medium",
      actionable: true,
      estimatedImpact: "Save $2,000-5,000 in taxes"
    });
  }
  
  // Insight 5: Risk management
  insights.push({
    title: "Protect Your Goal",
    description: `Ensure adequate insurance coverage to protect against events that could derail your savings plan. ` +
      `Your emergency fund should cover at least 3-6 months of expenses including goal contributions.`,
    priority: "low",
    actionable: true,
    estimatedImpact: "Prevent potential 6-12 month setback"
  });
  
  return insights;
}

function getEnhancedDefaultInsights(
  goal: LifeGoal, 
  profile: any, 
  monthsToGoal: number, 
  monthlyCashFlow: number, 
  shortfall: number,
  resources?: {
    homeEquity?: number;
    maxHELOC?: number;
    total401k?: number;
    max401kLoan?: number;
    taxableInvestments?: number;
  }
): any[] {
  const insights = [];
  let remainingShortfall = shortfall;
  
  // Use provided resources or calculate from profile
  const homeEquity = resources?.homeEquity ?? ((profile.homeValue || 0) - (profile.mortgageBalance || 0));
  const availableHELOC = resources?.maxHELOC ?? Math.max(0, (profile.homeValue || 0) * 0.8 - (profile.mortgageBalance || 0));
  const total401k = resources?.total401k ?? ((profile.retirement401k || 0) + (profile.spouseRetirement401k || 0));
  const available401kLoan = resources?.max401kLoan ?? Math.min(50000, total401k * 0.5);
  const taxableInvestments = resources?.taxableInvestments ?? (profile.taxableInvestments || 0);
  
  // Strategy 1: Use monthly cash flow surplus
  if (monthlyCashFlow > 0 && monthsToGoal > 0 && remainingShortfall > 0) {
    const maxFromCashFlow = monthlyCashFlow * monthsToGoal;
    const cashFlowContribution = Math.min(remainingShortfall, maxFromCashFlow);
    const requiredMonthly = cashFlowContribution / monthsToGoal;
    
    insights.push({
      title: `Allocate $${Math.round(requiredMonthly)}/month from Cash Flow`,
      description: `You have $${Math.round(monthlyCashFlow).toLocaleString()}/month in available cash flow. ` +
        `Allocating $${Math.round(requiredMonthly)}/month for ${monthsToGoal} months will contribute ` +
        `$${Math.round(cashFlowContribution).toLocaleString()} toward eliminating your shortfall. ` +
        `This uses ${Math.round((requiredMonthly / monthlyCashFlow) * 100)}% of your monthly surplus.`,
      priority: "high",
      actionable: true,
      estimatedImpact: `Eliminates $${Math.round(cashFlowContribution).toLocaleString()} of shortfall (${Math.round((cashFlowContribution / shortfall) * 100)}%)`,
      fundingType: "cashflow",
      monthlyPayment: Math.round(requiredMonthly),
      totalCost: cashFlowContribution,
      shortfallReduction: cashFlowContribution
    });
    
    remainingShortfall -= cashFlowContribution;
  }
  
  // Strategy 2: Liquidate taxable investments
  if (taxableInvestments > 0 && remainingShortfall > 0) {
    const investmentContribution = Math.min(remainingShortfall, taxableInvestments * 0.5); // Use up to 50% of taxable
    const taxImpact = investmentContribution * 0.15; // Assume 15% capital gains tax
    const netContribution = investmentContribution - taxImpact;
    
    insights.push({
      title: `Liquidate $${Math.round(investmentContribution).toLocaleString()} from Taxable Investments`,
      description: `You have $${taxableInvestments.toLocaleString()} in taxable investment accounts. ` +
        `Liquidating $${Math.round(investmentContribution).toLocaleString()} will provide ` +
        `$${Math.round(netContribution).toLocaleString()} after estimated taxes (15% capital gains). ` +
        `This represents ${Math.round((investmentContribution / taxableInvestments) * 100)}% of your taxable portfolio.`,
      priority: "high",
      actionable: true,
      estimatedImpact: `Eliminates $${Math.round(netContribution).toLocaleString()} of shortfall (${Math.round((netContribution / shortfall) * 100)}%)`,
      fundingType: "investment",
      monthlyPayment: null,
      totalCost: investmentContribution,
      shortfallReduction: netContribution
    });
    
    remainingShortfall -= netContribution;
  }
  
  // Strategy 3: HELOC
  if (availableHELOC > 10000 && remainingShortfall > 0) {
    const helocAmount = Math.min(remainingShortfall, availableHELOC * 0.8); // Use up to 80% of available
    const helocRate = 0.08; // Assume 8% HELOC rate
    const helocTerm = Math.min(120, monthsToGoal * 2); // 10 years max, or 2x goal timeline
    const monthlyRate = helocRate / 12;
    const helocPayment = helocAmount * (monthlyRate * Math.pow(1 + monthlyRate, helocTerm)) / 
                         (Math.pow(1 + monthlyRate, helocTerm) - 1);
    const totalInterest = (helocPayment * helocTerm) - helocAmount;
    
    insights.push({
      title: `HELOC for $${Math.round(helocAmount).toLocaleString()}`,
      description: `You have $${Math.round(availableHELOC).toLocaleString()} in available home equity line of credit. ` +
        `Borrowing $${Math.round(helocAmount).toLocaleString()} at 8% APR for ${helocTerm} months ` +
        `requires monthly payments of $${Math.round(helocPayment).toLocaleString()}. ` +
        `Total interest cost: $${Math.round(totalInterest).toLocaleString()}.`,
      priority: "medium",
      actionable: true,
      estimatedImpact: `Eliminates $${Math.round(helocAmount).toLocaleString()} of shortfall (${Math.round((helocAmount / shortfall) * 100)}%)`,
      fundingType: "heloc",
      monthlyPayment: Math.round(helocPayment),
      totalCost: helocAmount + totalInterest,
      shortfallReduction: helocAmount
    });
    
    remainingShortfall -= helocAmount;
  }
  
  // Strategy 4: 401(k) loan
  if (available401kLoan > 5000 && remainingShortfall > 0) {
    const loanAmount = Math.min(remainingShortfall, available401kLoan);
    const loanRate = 0.065; // Prime + 1%, assume 6.5%
    const loanTerm = 60; // 5 years max for 401k loans
    const monthlyRate = loanRate / 12;
    const loanPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) / 
                        (Math.pow(1 + monthlyRate, loanTerm) - 1);
    const totalInterest = (loanPayment * loanTerm) - loanAmount;
    
    insights.push({
      title: `401(k) Loan for $${Math.round(loanAmount).toLocaleString()}`,
      description: `You can borrow up to $${Math.round(available401kLoan).toLocaleString()} from your 401(k). ` +
        `A $${Math.round(loanAmount).toLocaleString()} loan at 6.5% for 60 months ` +
        `requires monthly payments of $${Math.round(loanPayment).toLocaleString()}. ` +
        `Interest ($${Math.round(totalInterest).toLocaleString()}) is paid back to your account, ` +
        `but you'll miss potential investment growth. Consider this as a last resort.`,
      priority: "low",
      actionable: true,
      estimatedImpact: `Eliminates $${Math.round(loanAmount).toLocaleString()} of shortfall (${Math.round((loanAmount / shortfall) * 100)}%)`,
      fundingType: "401k",
      monthlyPayment: Math.round(loanPayment),
      totalCost: loanAmount + totalInterest,
      shortfallReduction: loanAmount
    });
    
    remainingShortfall -= loanAmount;
  }
  
  // Additional strategies if still short
  if (remainingShortfall > 100) {
    insights.push({
      title: "Consider Alternative Strategies",
      description: `After exhausting primary funding sources, you still need $${Math.round(remainingShortfall).toLocaleString()}. ` +
        `Consider: 1) Extending the timeline by ${Math.ceil(remainingShortfall / Math.max(100, monthlyCashFlow))} months, ` +
        `2) Reducing the target amount by ${Math.round((remainingShortfall / goal.targetAmount) * 100)}%, ` +
        `3) Finding additional income sources (side job, selling unused items), ` +
        `4) Negotiating better terms or prices for your goal.`,
      priority: "medium",
      actionable: true,
      estimatedImpact: `Addresses remaining $${Math.round(remainingShortfall).toLocaleString()} gap`,
      fundingType: "other",
      monthlyPayment: null,
      totalCost: remainingShortfall,
      shortfallReduction: remainingShortfall
    });
  }
  
  // Summary insight
  const totalMonthlyCommitment = insights.reduce((sum, i) => sum + (i.monthlyPayment || 0), 0);
  if (insights.length > 0) {
    insights.push({
      title: "Combined Strategy Summary",
      description: `By combining the above strategies, you can eliminate the entire $${shortfall.toLocaleString()} shortfall. ` +
        `Total monthly commitment: $${totalMonthlyCommitment.toLocaleString()}. ` +
        `This comprehensive approach ensures your ${goal.goalName} is fully funded by ${goal.targetDate}.`,
      priority: "high",
      actionable: false,
      estimatedImpact: "100% goal funding achieved",
      fundingType: "other",
      monthlyPayment: totalMonthlyCommitment,
      totalCost: shortfall,
      shortfallReduction: shortfall
    });
  }
  
  return insights;
}
