import { storage } from './storage';
import { calculateFinancialMetrics, runEnhancedMonteCarloSimulation, profileToRetirementParams, generateCashFlowData, calculateEstateAnalysis } from './financial-calculations';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { debts, debtPayoffPlans, debtScenarios, debtPayments, debtMilestones, debtAIInsights } from '@shared/schema';

export interface ComprehensiveUserData {
  profile?: any;
  calculations?: any;
  monteCarloData?: any;
  retirementParams?: any;
  cashFlowData?: any;
  estatePlan?: any;
  estateAnalysis?: any;
  estateDocuments?: any[];
  estateBeneficiaries?: any[];
  estateTrusts?: any[];
  estateScenarios?: any[];
  goals?: any[];
  lifeGoals?: any[];
  educationGoals?: any[];
  educationScenarios?: any[];
  achievements?: any[];
  chatHistory?: any[];
  chatDocuments?: any[];
  investments?: any;
  actionPlanTasks?: any[];
  taxAnalysis?: any;
  debtAnalysis?: any;
  emergencyFundAnalysis?: any;
  insuranceAnalysis?: any;
  netWorthProjections?: any;
  retirementOptimization?: any;
  sectionProgress?: any;
  debts?: any[];
  debtPayoffPlans?: any[];
  debtScenarios?: any[];
  debtPayments?: any[];
  debtMilestones?: any[];
  debtAIInsights?: any[];
  selfEmployedData?: any;
}

/**
 * Builds comprehensive user context data for AI assistant
 * This includes all financial data from the database plus calculated metrics
 */
export async function buildComprehensiveUserContext(userId: number): Promise<ComprehensiveUserData> {
  const context: ComprehensiveUserData = {};
  
  try {
    // Core financial profile
    context.profile = await storage.getFinancialProfile(userId);
    
    if (context.profile) {
      // Estate planning data
      const estateDocuments = await storage.getEstateDocuments(userId);
      context.estateDocuments = estateDocuments;
      
      // Use stored calculations if available, otherwise calculate fresh
      if (context.profile.calculations) {
        console.log('Using stored calculations for AI context');
        context.calculations = context.profile.calculations;
      } else {
        console.log('No stored calculations found, calculating fresh metrics');
        context.calculations = await calculateFinancialMetrics(context.profile, estateDocuments);
      }
      
      // Use stored Monte Carlo results if available
      if (context.profile.monteCarloSimulation?.retirementSimulation?.results) {
        console.log('Using stored Monte Carlo results for AI context');
        context.monteCarloData = context.profile.monteCarloSimulation.retirementSimulation.results;
        
        // Also get the parameters used
        if (context.profile.monteCarloSimulation.retirementSimulation.params) {
          context.retirementParams = context.profile.monteCarloSimulation.retirementSimulation.params;
        }
      } else {
        console.log('No stored Monte Carlo results, running fresh simulation');
        try {
          // Monte Carlo retirement simulation (enhanced engine)
          context.retirementParams = profileToRetirementParams(context.profile);
          const enhanced = await runEnhancedMonteCarloSimulation(context.retirementParams, 1000);
          context.monteCarloData = enhanced;
        } catch (error) {
          console.log('Error running fresh Monte Carlo simulation:', error);
        }
      }
      
      // Get stored retirement planning data (optimizations, projections, etc.)
      if (context.profile.retirementPlanningData) {
        console.log('Using stored retirement planning data for AI context');
        context.retirementOptimization = context.profile.retirementPlanningData;
        
        // Net worth projections if available
        if (context.profile.retirementPlanningData.netWorthProjections) {
          context.netWorthProjections = context.profile.retirementPlanningData.netWorthProjections;
        }
      }
      
      // Get stored tax analysis and recommendations
      if (context.profile.taxReturns || context.profile.taxRecommendations) {
        console.log('Using stored tax analysis for AI context');
        context.taxAnalysis = {
          taxReturns: context.profile.taxReturns,
          taxRecommendations: context.profile.taxRecommendations
        };
      }
      
      // Get self-employed data if available
      if (context.profile.selfEmployedData || context.profile.isSeflEmployed) {
        console.log('Using stored self-employed data for AI context');
        context.selfEmployedData = {
          isSeflEmployed: context.profile.isSeflEmployed,
          selfEmployedData: context.profile.selfEmployedData,
          businessType: context.profile.businessType,
          quarterlyTaxPayments: context.profile.quarterlyTaxPayments,
          selfEmploymentIncome: context.profile.selfEmploymentIncome
        };
      }
      
      try {
        // Cash flow projections (these are usually calculated on demand)
        context.cashFlowData = generateCashFlowData(context.profile, { scenarioId: 'base', percentile: 50 });
      } catch (error) {
        console.log('Error generating cash flow data:', error);
      }
      
      // Estate plan analysis
      context.estatePlan = await storage.getEstatePlan(userId);
      if (context.estatePlan) {
        try {
          context.estateAnalysis = await calculateEstateAnalysis(context.estatePlan, userId);
        } catch (error) {
          console.log('Error calculating estate analysis:', error);
        }
      }
    }
    
    // Goals and planning data
    try {
      context.goals = await storage.getGoals(userId);
    } catch (error) {
      console.log('Error fetching goals:', error);
      context.goals = [];
    }
    
    try {
      context.educationGoals = await storage.getEducationGoals(userId);
    } catch (error) {
      console.log('Error fetching education goals:', error);
      context.educationGoals = [];
    }
    
    // Gamification and progress data (skip if functions don't exist)
    try {
      if (typeof storage.getUserAchievements === 'function') {
        context.achievements = await storage.getUserAchievements(userId);
      } else {
        context.achievements = [];
      }
      
      if (typeof storage.getSectionProgress === 'function') {
        context.sectionProgress = await storage.getSectionProgress(userId);
      } else {
        context.sectionProgress = [];
      }
    } catch (error) {
      console.log('Error fetching achievements/progress:', error);
      context.achievements = [];
      context.sectionProgress = [];
    }
    
    // Chat history for context
    try {
      context.chatHistory = await storage.getChatMessages(userId);
    } catch (error) {
      console.log('Error fetching chat history:', error);
      context.chatHistory = [];
    }

    // Load user's uploaded documents
    try {
      context.chatDocuments = await storage.getUserChatDocuments(userId);
    } catch (error) {
      console.log('Error fetching chat documents:', error);
      context.chatDocuments = [];
    }
    
    // Additional analysis data if available
    try {
      // Get investment cache/recommendations if available (need to specify category)
      const investmentCache = await storage.getInvestmentCache(userId, 'recommendations');
      if (investmentCache) {
        context.investments = investmentCache;
      }
    } catch (error) {
      console.log('Error fetching investment data:', error);
    }
    
    // Get comprehensive estate planning data
    try {
      context.estateBeneficiaries = await storage.getEstateBeneficiaries(userId);
      context.estateTrusts = await storage.getEstateTrusts(userId);
      context.estateScenarios = await storage.getEstateScenarios(userId);
    } catch (error) {
      console.log('Error fetching comprehensive estate data:', error);
    }
    
    // Get life goals (separate from regular goals)
    try {
      context.lifeGoals = await storage.getLifeGoals(userId);
    } catch (error) {
      console.log('Error fetching life goals:', error);
      context.lifeGoals = [];
    }
    
    // Get education scenarios
    if (context.educationGoals && context.educationGoals.length > 0) {
      try {
        context.educationScenarios = [];
        for (const goal of context.educationGoals) {
          const scenarios = await storage.getEducationScenariosByGoal(userId, goal.id);
          context.educationScenarios.push(...scenarios);
        }
      } catch (error) {
        console.log('Error fetching education scenarios:', error);
      }
    }
    
    // Get action plan tasks if available
    try {
      if (typeof storage.getActionPlanTasks === 'function') {
        context.actionPlanTasks = await storage.getActionPlanTasks(userId);
      }
    } catch (error) {
      console.log('Error fetching action plan tasks:', error);
    }
    
    // Get comprehensive debt management data
    try {
      // Get active debts
      context.debts = await db
        .select()
        .from(debts)
        .where(eq(debts.userId, userId));
      
      // Get debt payoff plans
      context.debtPayoffPlans = await db
        .select()
        .from(debtPayoffPlans)
        .where(eq(debtPayoffPlans.userId, userId));
      
      // Get debt scenarios
      context.debtScenarios = await db
        .select()
        .from(debtScenarios)
        .where(eq(debtScenarios.userId, userId));
      
      // Get debt payments history
      context.debtPayments = await db
        .select()
        .from(debtPayments)
        .where(eq(debtPayments.userId, userId));
      
      // Get debt milestones
      context.debtMilestones = await db
        .select()
        .from(debtMilestones)
        .where(eq(debtMilestones.userId, userId));
      
      // Get debt AI insights
      context.debtAIInsights = await db
        .select()
        .from(debtAIInsights)
        .where(eq(debtAIInsights.userId, userId));
      
      console.log(`Retrieved debt management data: ${context.debts?.length || 0} debts, ${context.debtPayoffPlans?.length || 0} plans, ${context.debtScenarios?.length || 0} scenarios`);
    } catch (error) {
      console.log('Error fetching debt management data:', error);
      context.debts = [];
      context.debtPayoffPlans = [];
      context.debtScenarios = [];
      context.debtPayments = [];
      context.debtMilestones = [];
      context.debtAIInsights = [];
    }
    
    // Get tax analysis if available
    try {
      // This would require checking if there's a tax analysis stored
      // For now, we'll rely on the profile data
    } catch (error) {
      console.log('Error fetching tax analysis:', error);
    }
    
  } catch (error) {
    console.error('Error building comprehensive user context:', error);
  }
  
  return context;
}

/**
 * Formats the comprehensive user data into a contextual prompt for AI
 */
export function formatUserDataForAI(userData: ComprehensiveUserData): string {
  const { profile, calculations, monteCarloData, retirementParams, cashFlowData, estatePlan, estateAnalysis, 
          estateDocuments, estateBeneficiaries, estateTrusts, estateScenarios, goals, lifeGoals, educationGoals, 
          educationScenarios, achievements, chatHistory, chatDocuments, investments, actionPlanTasks, retirementOptimization, netWorthProjections,
          debts, debtPayoffPlans, debtScenarios, debtPayments, debtMilestones, debtAIInsights, selfEmployedData } = userData;

  let contextPrompt = `You are AFFLUVIA AI, a CFP certified professional financial planner. You provide personalized financial advice based on the user's complete financial data and situation. `;

  if (!profile) {
    contextPrompt += `\nNo financial profile found. Please encourage the user to complete their intake form first.`;
    return contextPrompt;
  }

  const age = profile.dateOfBirth ? 
    new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : null;

  // Basic profile information
  contextPrompt += `\n\n=== USER PROFILE ===
- Name: ${profile.firstName || 'User'}
- Age: ${age || 'Not specified'}
- Marital Status: ${profile.maritalStatus || 'Not specified'}
- Dependents: ${profile.dependents || 0}
- Employment: ${profile.employmentStatus || 'Not specified'}
- State: ${profile.state || 'Not specified'}
- Spouse: ${profile.maritalStatus === 'married' ? 
    `${profile.spouseName || 'Spouse'}, Age ${profile.spouseDateOfBirth ? 
    new Date().getFullYear() - new Date(profile.spouseDateOfBirth).getFullYear() : 'Not specified'}, 
    Income $${(profile.spouseAnnualIncome || 0).toLocaleString()}` : 'N/A'}`;

  // Financial metrics with Monte Carlo priority
  if (calculations) {
    contextPrompt += `\n\n=== FINANCIAL OVERVIEW ===
- Net Worth: $${calculations.netWorth.toLocaleString()}
- Monthly Cash Flow: $${calculations.monthlyCashFlow.toLocaleString()}
- Financial Health Score: ${calculations.healthScore}/100
- Annual Income: $${(profile.annualIncome || 0).toLocaleString()}
- Total Assets: $${calculations.totalAssets.toLocaleString()}
- Total Liabilities: $${calculations.totalLiabilities.toLocaleString()}
- Emergency Fund: $${(profile.emergencyFundSize || 0).toLocaleString()} (${calculations.emergencyMonths?.toFixed(1) || 0} months)
- Emergency Readiness Score: ${calculations.emergencyReadinessScoreCFP || 0}/100
- Risk Profile: ${calculations.riskProfile || 'Not assessed'} (${calculations.riskScore}/5)
- Debt-to-Income Ratio: ${calculations.dtiRatio?.toFixed(1) || 0}%
- Savings Rate: ${calculations.savingsRate?.toFixed(1) || 0}%`;

    // Target Asset Allocation
    if (calculations.targetAllocation) {
      contextPrompt += `\n\n=== TARGET ASSET ALLOCATION ===
- US Stocks: ${calculations.targetAllocation.usStocks || 0}%
- International Stocks: ${calculations.targetAllocation.intlStocks || 0}%
- Bonds: ${calculations.targetAllocation.bonds || 0}%
- Alternatives: ${calculations.targetAllocation.alternatives || 0}%
- Cash: ${calculations.targetAllocation.cash || 0}%`;
    }
  }

  // 🎯 PRIORITY: Monte Carlo Retirement Confidence (Dashboard Baseline)
  if (monteCarloData && retirementParams) {
    const mcRaw = (typeof (monteCarloData as any).probabilityOfSuccess === 'number')
      ? (monteCarloData as any).probabilityOfSuccess
      : (typeof (monteCarloData as any).successProbability === 'number')
        ? (monteCarloData as any).successProbability
        : 0;
    const mcPct = Math.round((mcRaw > 1 ? mcRaw : mcRaw * 100));

    contextPrompt += `\n\n=== 🎯 RETIREMENT CONFIDENCE SCORE (DASHBOARD BASELINE) ===
⭐ BASELINE RETIREMENT CONFIDENCE: ${mcPct}% SUCCESS PROBABILITY
📊 Based on 1,000 Monte Carlo Simulation Scenarios
🎯 Target Confidence Level: ≥80% (Industry Standard)
📈 Current Status: ${mcPct >= 80 ? '✅ CONFIDENT' : '⚠️ NEEDS IMPROVEMENT'}

SIMULATION INPUT PARAMETERS:
- Current Age: ${retirementParams.currentAge}, Target Retirement: ${retirementParams.retirementAge}
- Current Retirement Assets: $${(retirementParams.currentRetirementAssets || 0).toLocaleString()}
- Annual Pre-Retirement Savings: $${(retirementParams.annualSavings || 0).toLocaleString()}
- Annual Guaranteed Income: $${(retirementParams.annualGuaranteedIncome || 0).toLocaleString()}
- Target Annual Expenses: $${(retirementParams.annualRetirementExpenses || 0).toLocaleString()}
- Asset Allocation: ${retirementParams.stockAllocation}% stocks, ${retirementParams.bondAllocation}% bonds

SIMULATION RESULTS:
- SUCCESS PROBABILITY: ${mcPct}% (Target: ≥80%)
- SAFE WITHDRAWAL RATE: ${((monteCarloData as any).safeWithdrawalRate ? ((monteCarloData as any).safeWithdrawalRate * 100).toFixed(1) : '0.0')}% (Standard: 4%)
- MEDIAN ENDING BALANCE: $${(((monteCarloData as any).medianEndingBalance) || 0).toLocaleString()}
- WORST CASE (10th percentile): $${(((monteCarloData as any).percentile10EndingBalance) || 0).toLocaleString()}
- BEST CASE (90th percentile): $${(((monteCarloData as any).percentile90EndingBalance) || 0).toLocaleString()}
- Years Until Depletion: ${((monteCarloData as any).yearsUntilDepletion) || 'None projected'}
- Successful Scenarios: ${((monteCarloData as any).scenarios?.successful) || 0}/${((monteCarloData as any).scenarios?.total) || 0}

🚨 CRITICAL: This ${mcPct}% is the PRIMARY retirement metric shown on the dashboard. Use this for ALL retirement advice, NOT any other retirement score.`;
  }

  // 🚀 RETIREMENT OPTIMIZATION (User's Improvement Plan)
  if (retirementOptimization) {
    contextPrompt += `\n\n=== 🚀 RETIREMENT OPTIMIZATION (USER'S IMPROVEMENT PLAN) ===`;
    
    // Show optimization variables if available
    if (retirementOptimization.optimizationVariables) {
      const vars = retirementOptimization.optimizationVariables;
      contextPrompt += `\n\n🎯 USER'S OPTIMIZATION CHOICES:`;
      if (vars.retirementAge) contextPrompt += `\n- Target Retirement Age: ${vars.retirementAge} years old`;
      if (vars.socialSecurityAge) contextPrompt += `\n- Social Security Claim Age: ${vars.socialSecurityAge} years old`;
      if (vars.monthlyContributions) contextPrompt += `\n- Increased Monthly Contributions: $${Number(vars.monthlyContributions).toLocaleString()}`;
      if (vars.optimizedScore) contextPrompt += `\n- TARGET OPTIMIZED CONFIDENCE: ${vars.optimizedScore}% (vs ${monteCarloData.probabilityOfSuccess || 0}% baseline)`;
    }
    
    // Show optimization results if available
    if (retirementOptimization.optimizationResults) {
      const results = retirementOptimization.optimizationResults;
      contextPrompt += `\n\n📊 OPTIMIZATION ANALYSIS:`;
      contextPrompt += `\n- Optimization Status: ${results.status || 'Available'}`;
      if (results.originalScore) contextPrompt += `\n- Original Baseline Score: ${results.originalScore}%`;
      if (results.optimizedScore) contextPrompt += `\n- Optimized Target Score: ${results.optimizedScore}%`;
      if (results.improvements) {
        contextPrompt += `\n- Optimization Strategies: ${results.improvements.join(', ')}`;
      }
      if (results.potentialImprovement) {
        contextPrompt += `\n- Potential Improvement: +${results.potentialImprovement}% confidence increase`;
      }
    }
    
    // Show net worth projections if available
    if (retirementOptimization.netWorthProjections) {
      contextPrompt += `\n\n📈 PROJECTED OUTCOMES:`;
      contextPrompt += `\n- Net Worth Projections: Available for ${retirementOptimization.netWorthProjections.length || 0} years`;
      contextPrompt += `\n- Shows impact of optimization choices on long-term wealth`;
    }
    
    contextPrompt += `\n\n💡 The user has actively engaged with retirement optimization tools. Consider their optimization choices when making recommendations.`;
  }

  // Detailed expenses
  if (profile.monthlyExpenses) {
    contextPrompt += `\n\n=== MONTHLY EXPENSES ===`;
    Object.entries(profile.monthlyExpenses).forEach(([category, amount]) => {
      contextPrompt += `\n- ${category.charAt(0).toUpperCase() + category.slice(1)}: $${Number(amount || 0).toLocaleString()}`;
    });
    contextPrompt += `\n- Total: $${Object.values(profile.monthlyExpenses).reduce((sum, exp) => sum + Number(exp || 0), 0).toLocaleString()}`;
  }

  // Asset portfolio
  if (profile.assets && profile.assets.length > 0) {
    contextPrompt += `\n\n=== ASSET PORTFOLIO ===`;
    profile.assets.forEach((asset: any) => {
      contextPrompt += `\n- ${asset.type}: $${Number(asset.value || 0).toLocaleString()} (${asset.owner})`;
    });
  }

  // Debt portfolio
  if (profile.liabilities && profile.liabilities.length > 0) {
    contextPrompt += `\n\n=== DEBT PORTFOLIO ===`;
    profile.liabilities.forEach((debt: any) => {
      contextPrompt += `\n- ${debt.type}: $${Number(debt.balance || 0).toLocaleString()} @ ${debt.interestRate}% ($${Number(debt.monthlyPayment || 0).toLocaleString()}/month)`;
    });
  }

  // Insurance coverage
  contextPrompt += `\n\n=== INSURANCE COVERAGE ===
- Life Insurance: ${profile.lifeInsurance?.hasPolicy ? `$${Number(profile.lifeInsurance.coverageAmount || 0).toLocaleString()}` : 'None'}
- Spouse Life Insurance: ${profile.spouseLifeInsurance?.hasPolicy ? `$${Number(profile.spouseLifeInsurance.coverageAmount || 0).toLocaleString()}` : 'None'}
- Health Insurance: ${profile.healthInsurance?.hasHealthInsurance ? `$${Number(profile.healthInsurance.monthlyPremium || 0).toLocaleString()}/month, $${Number(profile.healthInsurance.annualDeductible || 0).toLocaleString()} deductible` : 'None'}
- Disability Insurance: ${profile.disabilityInsurance?.hasDisability ? `$${Number(profile.disabilityInsurance.benefitAmount || 0).toLocaleString()}/month benefit` : 'None'}`;


  // Cash flow projections
  if (cashFlowData && cashFlowData.length > 0) {
    contextPrompt += `\n\n=== CASH FLOW PROJECTIONS (Next 5 Years) ===`;
    cashFlowData.slice(0, 5).forEach((year: any) => {
      contextPrompt += `\n- ${year.year}: Income $${year.inflows.grossIncome.toLocaleString()}, Expenses $${year.outflows.fixed.toLocaleString()}, Tax Rate ${year.effectiveTaxRate.toFixed(1)}%`;
    });
  }

  // Goals
  if (goals && goals.length > 0) {
    contextPrompt += `\n\n=== FINANCIAL GOALS ===`;
    goals.forEach((goal: any) => {
      contextPrompt += `\n- ${goal.title}: $${goal.targetAmount?.toLocaleString() || 0} by ${goal.targetDate ? new Date(goal.targetDate).getFullYear() : 'TBD'} (${goal.status || 'active'})`;
      if (goal.description) contextPrompt += ` - ${goal.description}`;
    });
  }

  // Education goals
  if (educationGoals && educationGoals.length > 0) {
    contextPrompt += `\n\n=== EDUCATION PLANNING ===`;
    educationGoals.forEach((goal: any) => {
      contextPrompt += `\n- ${goal.studentName}: ${goal.schoolType} starting ${goal.startYear}, Cost $${goal.totalCost?.toLocaleString() || 0}`;
      if (goal.currentSavings) contextPrompt += ` (Current savings: $${goal.currentSavings.toLocaleString()})`;
    });
  }

  // Education scenarios
  if (educationScenarios && educationScenarios.length > 0) {
    contextPrompt += `\n\n=== EDUCATION SCENARIOS ===`;
    educationScenarios.forEach((scenario: any) => {
      contextPrompt += `\n- Scenario: ${scenario.name || scenario.description}`;
      if (scenario.results) contextPrompt += ` - Success Rate: ${scenario.results.successRate || 'N/A'}%`;
    });
  }

  // Life goals (separate from financial goals)
  if (lifeGoals && lifeGoals.length > 0) {
    contextPrompt += `\n\n=== LIFE GOALS ===`;
    lifeGoals.forEach((goal: any) => {
      contextPrompt += `\n- ${goal.title}: ${goal.description || 'No description'}`;
      if (goal.targetDate) contextPrompt += ` (Target: ${new Date(goal.targetDate).getFullYear()})`;
      if (goal.status) contextPrompt += ` [${goal.status}]`;
    });
  }

  // Estate planning
  if (estatePlan && estateAnalysis) {
    contextPrompt += `\n\n=== ESTATE PLANNING ===
- Total Estate Value: $${parseFloat(estatePlan.totalEstateValue || '0').toLocaleString()}
- Estate Tax Liability: $${estateAnalysis.totalEstateTax.toLocaleString()}
- Net to Heirs: $${estateAnalysis.netToHeirs.toLocaleString()}`;
  }

  // Estate documents with insights
  if (estateDocuments && estateDocuments.length > 0) {
    const docsWithInsights = estateDocuments.filter(doc => doc.parsedInsights);
    if (docsWithInsights.length > 0) {
      contextPrompt += `\n\n=== ESTATE DOCUMENTS ===`;
      docsWithInsights.forEach(doc => {
        const insights = doc.parsedInsights as any;
        contextPrompt += `\n\n${doc.documentType.toUpperCase()}:`;
        if (insights.summary) contextPrompt += `\n- Summary: ${insights.summary}`;
        if (insights.beneficiaries?.length > 0) {
          contextPrompt += `\n- Beneficiaries: ${insights.beneficiaries.map((b: any) => `${b.name} (${b.relationship})`).join(', ')}`;
        }
        if (insights.executor) contextPrompt += `\n- Executor: ${insights.executor.name}`;
        if (insights.recommendations?.length > 0) {
          contextPrompt += `\n- Recommendations: ${insights.recommendations.join('; ')}`;
        }
      });
    }
  }

  // Estate beneficiaries
  if (estateBeneficiaries && estateBeneficiaries.length > 0) {
    contextPrompt += `\n\n=== ESTATE BENEFICIARIES ===`;
    estateBeneficiaries.forEach((beneficiary: any) => {
      contextPrompt += `\n- ${beneficiary.name} (${beneficiary.relationship}): ${beneficiary.percentage}%`;
      if (beneficiary.specificBequest) contextPrompt += ` - Specific bequest: $${beneficiary.specificBequest.toLocaleString()}`;
    });
  }

  // Estate trusts
  if (estateTrusts && estateTrusts.length > 0) {
    contextPrompt += `\n\n=== ESTATE TRUSTS ===`;
    estateTrusts.forEach((trust: any) => {
      contextPrompt += `\n- ${trust.trustType}: ${trust.trustName}`;
      if (trust.fundingAmount) contextPrompt += ` ($${trust.fundingAmount.toLocaleString()})`;
      if (trust.purpose) contextPrompt += ` - ${trust.purpose}`;
    });
  }

  // Estate scenarios
  if (estateScenarios && estateScenarios.length > 0) {
    contextPrompt += `\n\n=== ESTATE SCENARIOS ===`;
    estateScenarios.forEach((scenario: any) => {
      contextPrompt += `\n- ${scenario.scenarioName}: ${scenario.description}`;
      if (scenario.estimatedValue) contextPrompt += ` (Est. Value: $${scenario.estimatedValue.toLocaleString()})`;
    });
  }

  // Action plan tasks
  if (actionPlanTasks && actionPlanTasks.length > 0) {
    contextPrompt += `\n\n=== ACTION PLAN TASKS ===`;
    actionPlanTasks.forEach((task: any) => {
      contextPrompt += `\n- ${task.title} [${task.status}]`;
      if (task.priority) contextPrompt += ` (Priority: ${task.priority})`;
      if (task.dueDate) contextPrompt += ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`;
    });
  }

  // Investment recommendations
  if (investments && investments.recommendations) {
    contextPrompt += `\n\n=== INVESTMENT RECOMMENDATIONS ===`;
    investments.recommendations.slice(0, 5).forEach((rec: any, index: number) => {
      contextPrompt += `\n${index + 1}. ${rec.symbol || rec.name}: ${rec.reason || rec.description}`;
      if (rec.allocation) contextPrompt += ` (${rec.allocation}%)`;
    });
  }


  // Net worth projections
  if (netWorthProjections && netWorthProjections.length > 0) {
    contextPrompt += `\n\n=== NET WORTH PROJECTIONS ===`;
    const futureProjections = netWorthProjections.slice(0, 5);
    futureProjections.forEach((projection: any) => {
      contextPrompt += `\n- ${projection.year}: $${(projection.totalNetWorth || 0).toLocaleString()} (Age ${projection.age})`;
    });
  }

  // Recent recommendations
  if (calculations?.recommendations?.length > 0) {
    contextPrompt += `\n\n=== RECENT RECOMMENDATIONS ===`;
    calculations.recommendations.slice(0, 5).forEach((rec: any, index: number) => {
      contextPrompt += `\n${index + 1}. ${rec.title}: ${rec.description} (Impact: +${rec.potentialImprovement || 0} points)`;
    });
  }

  // Comprehensive debt management data
  if (debts && debts.length > 0) {
    contextPrompt += `\n\n=== DEBT MANAGEMENT CENTER ===`;
    
    // Active debts
    const activeDebts = debts.filter(debt => debt.status === 'active');
    if (activeDebts.length > 0) {
      contextPrompt += `\n\nActive Debts (${activeDebts.length}):`;
      activeDebts.forEach((debt: any) => {
        contextPrompt += `\n- ${debt.debtName} (${debt.debtType}): $${Number(debt.currentBalance || 0).toLocaleString()} @ ${debt.annualInterestRate}% APR`;
        contextPrompt += `\n  Minimum Payment: $${Number(debt.minimumPayment || 0).toLocaleString()}/month`;
        if (debt.isSecured) contextPrompt += ` [SECURED: ${debt.collateral}]`;
        if (debt.owner !== 'user') contextPrompt += ` [Owner: ${debt.owner}]`;
      });
      
      // Calculate total debt burden
      const totalDebtBalance = activeDebts.reduce((sum: number, debt: any) => sum + Number(debt.currentBalance || 0), 0);
      const totalMonthlyPayments = activeDebts.reduce((sum: number, debt: any) => sum + Number(debt.minimumPayment || 0), 0);
      contextPrompt += `\n\nTotal Debt Balance: $${totalDebtBalance.toLocaleString()}`;
      contextPrompt += `\nTotal Monthly Payments: $${totalMonthlyPayments.toLocaleString()}`;
    }
  }

  // Debt payoff plans and strategies
  if (debtPayoffPlans && debtPayoffPlans.length > 0) {
    contextPrompt += `\n\n=== DEBT PAYOFF STRATEGIES ===`;
    const activePlans = debtPayoffPlans.filter(plan => plan.isActive);
    
    if (activePlans.length > 0) {
      activePlans.forEach((plan: any) => {
        contextPrompt += `\n\nActive Plan: ${plan.planName}`;
        contextPrompt += `\n- Strategy: ${plan.strategy}`;
        contextPrompt += `\n- Extra Monthly Payment: $${Number(plan.extraMonthlyPayment || 0).toLocaleString()}`;
        if (plan.projectedPayoffDate) contextPrompt += `\n- Projected Payoff: ${new Date(plan.projectedPayoffDate).toLocaleDateString()}`;
        if (plan.totalInterestSaved) contextPrompt += `\n- Interest Savings: $${Number(plan.totalInterestSaved).toLocaleString()}`;
        if (plan.monthsSaved) contextPrompt += `\n- Time Savings: ${plan.monthsSaved} months`;
      });
    }
    
    // Historical plans for comparison
    const historicalPlans = debtPayoffPlans.filter(plan => !plan.isActive);
    if (historicalPlans.length > 0) {
      contextPrompt += `\n\nPrevious Plans Evaluated: ${historicalPlans.length}`;
    }
  }

  // Debt scenarios and what-if analysis
  if (debtScenarios && debtScenarios.length > 0) {
    contextPrompt += `\n\n=== DEBT SCENARIOS ANALYZED ===`;
    debtScenarios.slice(0, 5).forEach((scenario: any) => {
      contextPrompt += `\n- ${scenario.scenarioName} (${scenario.scenarioType})`;
      if (scenario.payoffDate) contextPrompt += ` - Payoff: ${new Date(scenario.payoffDate).toLocaleDateString()}`;
      if (scenario.totalInterestPaid) contextPrompt += `, Interest: $${Number(scenario.totalInterestPaid).toLocaleString()}`;
      if (scenario.monthsToPayoff) contextPrompt += `, Duration: ${scenario.monthsToPayoff} months`;
    });
  }

  // Debt payment history
  if (debtPayments && debtPayments.length > 0) {
    contextPrompt += `\n\n=== DEBT PAYMENT HISTORY ===`;
    const recentPayments = debtPayments.slice(-5);
    recentPayments.forEach((payment: any) => {
      contextPrompt += `\n- ${new Date(payment.paymentDate).toLocaleDateString()}: $${Number(payment.paymentAmount).toLocaleString()} to ${payment.debtName || 'Debt'}`;
      if (payment.extraAmount) contextPrompt += ` (Extra: $${Number(payment.extraAmount).toLocaleString()})`;
    });
    contextPrompt += `\n\nTotal Payments Tracked: ${debtPayments.length}`;
  }

  // Debt milestones achieved
  if (debtMilestones && debtMilestones.length > 0) {
    contextPrompt += `\n\n=== DEBT MILESTONES ===`;
    debtMilestones.forEach((milestone: any) => {
      contextPrompt += `\n- ${milestone.milestoneName}`;
      if (milestone.isAchieved) {
        contextPrompt += ` ✓ ACHIEVED (${new Date(milestone.achievedDate).toLocaleDateString()})`;
      } else {
        contextPrompt += ` [Target: ${milestone.targetValue || 'TBD'}]`;
      }
    });
  }

  // AI insights and recommendations for debt
  if (debtAIInsights && debtAIInsights.length > 0) {
    contextPrompt += `\n\n=== DEBT AI INSIGHTS ===`;
    const recentInsights = debtAIInsights.slice(-3);
    recentInsights.forEach((insight: any) => {
      contextPrompt += `\n- ${insight.insightType}: ${insight.recommendation}`;
      if (insight.potentialSavings) contextPrompt += ` (Potential savings: $${Number(insight.potentialSavings).toLocaleString()})`;
    });
  }

  // Self-employed business data
  if (selfEmployedData && selfEmployedData.isSeflEmployed) {
    contextPrompt += `\n\n=== SELF-EMPLOYMENT DATA ===`;
    contextPrompt += `\n- Business Status: Self-Employed`;
    if (selfEmployedData.businessType) contextPrompt += `\n- Business Type: ${selfEmployedData.businessType}`;
    if (selfEmployedData.selfEmploymentIncome) contextPrompt += `\n- Self-Employment Income: $${Number(selfEmployedData.selfEmploymentIncome).toLocaleString()}`;
    if (selfEmployedData.quarterlyTaxPayments) {
      contextPrompt += `\n- Quarterly Tax Payments: `;
      Object.entries(selfEmployedData.quarterlyTaxPayments).forEach(([quarter, amount]) => {
        contextPrompt += `\n  ${quarter}: $${Number(amount || 0).toLocaleString()}`;
      });
    }
    if (selfEmployedData.selfEmployedData) {
      contextPrompt += `\n- Additional Business Data: Available`;
    }
  }

  // User progress and achievements
  if (achievements && achievements.length > 0) {
    contextPrompt += `\n\n=== RECENT ACHIEVEMENTS ===`;
    achievements.slice(-5).forEach((achievement: any) => {
      contextPrompt += `\n- ${achievement.title}: ${achievement.description} (+${achievement.xpReward} XP)`;
    });
  }

  // 📄 UPLOADED DOCUMENTS (Recent user submissions)
  if (chatDocuments && chatDocuments.length > 0) {
    contextPrompt += `\n\n=== 📄 UPLOADED DOCUMENTS (USER-SUBMITTED FILES) ===`;
    
    // Group documents by type
    const docsByType: { [key: string]: any[] } = {};
    chatDocuments.forEach((doc: any) => {
      if (!docsByType[doc.documentType]) {
        docsByType[doc.documentType] = [];
      }
      docsByType[doc.documentType].push(doc);
    });
    
    // Display by document type
    Object.entries(docsByType).forEach(([type, docs]) => {
      const typeTitle = type.replace(/_/g, ' ').toUpperCase();
      contextPrompt += `\n\n${typeTitle} DOCUMENTS (${docs.length}):`;
      
      docs.slice(-5).forEach((doc: any) => { // Show last 5 documents per type
        contextPrompt += `\n- "${doc.originalName}" (${new Date(doc.uploadedAt).toLocaleDateString()})`;
        
        if (doc.aiSummary) {
          contextPrompt += `\n  Summary: ${doc.aiSummary.substring(0, 200)}${doc.aiSummary.length > 200 ? '...' : ''}`;
        }
        
        if (doc.aiInsights?.keyFinancialData) {
          const insights = doc.aiInsights;
          if (insights.keyFinancialData.amounts && insights.keyFinancialData.amounts.length > 0) {
            contextPrompt += `\n  Key Amounts: ${insights.keyFinancialData.amounts.slice(0, 3).join(', ')}`;
          }
          if (insights.keyFinancialData.accounts && insights.keyFinancialData.accounts.length > 0) {
            contextPrompt += `\n  Accounts: ${insights.keyFinancialData.accounts.slice(0, 2).join(', ')}`;
          }
        }
        
        if (doc.aiInsights?.recommendations && doc.aiInsights.recommendations.length > 0) {
          contextPrompt += `\n  AI Recommendations: ${doc.aiInsights.recommendations.slice(0, 2).join('; ')}`;
        }
        
        contextPrompt += `\n  Status: ${doc.processingStatus}`;
        
        if (doc.extractedText && doc.extractedText.length > 50) {
          // Include snippet of extracted text for context
          const textPreview = doc.extractedText.substring(0, 300).replace(/\s+/g, ' ');
          contextPrompt += `\n  Content Preview: "${textPreview}${doc.extractedText.length > 300 ? '...' : ''}"`;
        }
      });
    });
    
    contextPrompt += `\n\nTotal Documents: ${chatDocuments.length} files uploaded`;
    contextPrompt += `\n📋 IMPORTANT: When the user asks about documents, reference these specific uploaded files and their content. The user has provided these documents for analysis and expects personalized advice based on their actual financial documents.`;
  }

  return contextPrompt;
}

/**
 * Enhanced AI response generator with comprehensive context
 */
export async function generateEnhancedAIResponse(message: string, userId: number): Promise<string> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });
    
    // Build comprehensive user context
    const userData = await buildComprehensiveUserContext(userId);
    
    let contextPrompt;
    try {
      contextPrompt = formatUserDataForAI(userData);
    } catch (error) {
      console.error('Error formatting user data for AI:', error);
      // Fallback to basic context
      contextPrompt = `You are AFFLUVIA AI, a CFP certified professional financial planner. 
      The user ${userData.profile?.firstName || 'there'} is asking for financial advice.
      I'm experiencing some difficulty accessing all their financial data right now, but I can still provide general guidance.`;
    }
    
    const baseProbRaw = (userData.monteCarloData as any)?.probabilityOfSuccess ?? (userData.monteCarloData as any)?.successProbability;
    const baseProbText = (typeof baseProbRaw === 'number') ? Math.round((baseProbRaw > 1 ? baseProbRaw : baseProbRaw * 100)) : 'X';

    const fullPrompt = `${contextPrompt}

=== USER QUESTION ===
"${message}"

=== RESPONSE INSTRUCTIONS ===
1. Address the user by their first name (${userData.profile?.firstName || 'there'})
2. Provide specific, actionable advice based on their complete financial profile
3. Reference actual numbers from their data when making recommendations

🚨 CRITICAL RETIREMENT GUIDANCE RULES:
4. PRIMARY RETIREMENT METRIC: The user's BASELINE RETIREMENT CONFIDENCE is ${baseProbText}% (from Monte Carlo simulation)
5. NEVER use any other retirement score - this ${baseProbText}% is what appears on their dashboard and is the ONLY accurate metric
6. For ALL retirement questions, base your assessment on this ${baseProbText}% baseline confidence score
7. If user has optimization variables (retirement age, Social Security age, contributions), acknowledge their optimization choices and explain how these could improve their baseline score
8. Retirement advice priority: (1) Baseline confidence score, (2) User's optimization goals, (3) Monte Carlo projection data

GENERAL GUIDANCE:
9. Be encouraging but realistic based on their actual financial position  
10. Provide 2-4 prioritized, specific next steps they can take
11. Reference the specific dashboard metrics (net worth, cash flow, Monte Carlo confidence)
12. Keep response comprehensive but focused (3-5 paragraphs max)
13. If the question is about general topics, relate it back to their specific situation
14. Consider their optimization activities as evidence of engagement and planning

Please provide a detailed, personalized response that demonstrates deep understanding of their complete financial situation.`;

    const result = await model.generateContent(fullPrompt);
    return result.response.text();
    
  } catch (error) {
    console.error("Enhanced AI response error:", error);
    
    // Intelligent fallback based on the question
    const fallbackResponses = {
      retirement: "I'm having technical difficulties, but based on general principles, focus on maximizing your 401(k) contributions and maintaining a diversified investment portfolio for retirement planning.",
      investment: "The AI service is temporarily unavailable. Generally, consider low-cost index funds and maintain a balanced allocation appropriate for your age and risk tolerance.",
      budget: "I'm experiencing connection issues. In the meantime, track your expenses, create a monthly budget, and aim to save at least 20% of your income.",
      debt: "The service is down. Focus on paying off high-interest debt first while maintaining minimum payments on all accounts.",
      emergency: "Technical difficulties are preventing me from accessing your data. Ensure you have 3-6 months of expenses saved in a liquid emergency fund.",
      default: "I'm having trouble connecting to the AI service right now. Please try again in a moment, or feel free to ask about specific areas like retirement planning, budgeting, or investment advice."
    };
    
    // Simple keyword matching for better fallbacks
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('retire')) return fallbackResponses.retirement;
    if (lowerMessage.includes('invest')) return fallbackResponses.investment;
    if (lowerMessage.includes('budget') || lowerMessage.includes('spend')) return fallbackResponses.budget;
    if (lowerMessage.includes('debt') || lowerMessage.includes('loan')) return fallbackResponses.debt;
    if (lowerMessage.includes('emergency') || lowerMessage.includes('fund')) return fallbackResponses.emergency;
    
    return fallbackResponses.default;
  }
}
