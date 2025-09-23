import * as dotenv from "dotenv";
import { chatComplete } from "./services/xai-client";
import * as crypto from "crypto";
import { db } from './db';
import { plaidAccounts, plaidItems, plaidAggregatedSnapshot, plaidTransactions } from '../shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

dotenv.config();

interface InsightItem {
  title: string;
  description: string;
  priority: number; // 1-3 (1 = highest)
  category: string;
  actionSteps?: string[];
  potentialImprovement?: number;
  timeframe?: string;
  urgencyReason?: string;
  
  // Phase 4: Quantified Impact & Sophisticated Analysis
  quantifiedImpact?: {
    dollarBenefit1Year?: number;
    dollarBenefit5Years?: number;
    dollarBenefitRetirement?: number;
    healthScoreImprovement?: number;
    riskReduction?: number;
    compoundingValue?: number;
  };
  benchmarkContext?: string;
  accountSpecific?: string;
}

interface FinancialDataSnapshot {
  // Basic metrics
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyCashFlow: number;
  emergencyMonths: number;
  savingsRate: number;
  
  // Demographics
  age: number;
  maritalStatus: string;
  dependents: number;
  employmentType: string;
  
  // Assets and liabilities
  totalAssets: number;
  totalLiabilities: number;
  retirementAssets: number;
  taxablePortfolio?: number; // Taxable brokerage only (used for TLH)
  investableAssets?: number; // retirementAssets + taxablePortfolio
  highInterestDebt: number;
  
  // Insurance and planning
  hasLifeInsurance: boolean;
  hasDisabilityInsurance: boolean;
  hasWill: boolean;
  hasPowerOfAttorney: boolean;
  
  // Investment allocation
  stockAllocation: number;
  bondAllocation: number;
  cashAllocation: number;
  
  // Goals and timeline
  retirementAge: number;
  yearsToRetirement: number;
  hasEducationGoals: boolean;
  
  // Enhanced Plaid Data
  plaidData?: {
    totalAccounts: number;
    accountTypes: {
      checking: number;
      savings: number;
      investment: number;
      retirement: number;
      credit: number;
      mortgage: number;
    };
    institutions: string[];
    lastSynced: string;
    totalBalances: {
      banking: number;
      investment: number;
      retirement: number;
      creditCardDebt: number;
      mortgage: number;
    };
  };
  
  // Dashboard Widget Data
  dashboardData?: {
    retirementConfidence?: {
      currentScore: number;
      probabilityOfSuccess: number;
      optimalRetirementAge?: number;
      canRetireEarlier: boolean;
      earliestAge?: number;
      targetScore?: number;
    };
    netWorthProjections?: {
      netWorthAtRetirement: number;
      netWorthAtLongevity: number;
      projectionYears: number;
      realEstateGrowth: number;
    };
    healthScores?: {
      overall: number;
      emergency: number;
      retirement: number;
      riskManagement: number;
      cashFlow: number;
    };
  };
  
  // Behavioral Analysis (Phase 3)
  behavioralInsights?: {
    spendingPatterns: {
      monthlyTrends: Array<{category: string, amount: number, trend: string}>;
      topCategories: Array<{category: string, amount: number, percentage: number}>;
      seasonalPatterns: Array<{period: string, variance: number}>;
      unusualSpending: Array<{category: string, amount: number, reason: string}>;
    };
    savingsPatterns: {
      consistencyScore: number;
      averageMonthlyContributions: number;
      contributionFrequency: string;
      goalProgress: number;
    };
    investmentBehavior: {
      portfolioRebalancingFrequency: string;
      riskConsistency: number;
      diversificationScore: number;
      contributionTiming: string;
    };
  };
  
  // Comparative Analysis (Phase 3) 
  benchmarkData?: {
    peerComparison: {
      ageGroup: string;
      incomePercentile: number;
      netWorthPercentile: number;
      savingsRatePercentile: number;
      allocationComparison: string;
    };
    targetBenchmarks: {
      recommendedEmergencyFund: number;
      recommendedSavingsRate: number;
      recommendedAllocation: {stocks: number, bonds: number, cash: number};
      gapAnalysis: Array<{area: string, current: number, target: number, gap: number}>;
    };
  };
}

/**
 * Fetch comprehensive Plaid account data for enhanced AI context
 */
async function fetchPlaidAccountData(userId: number): Promise<any> {
  try {
    // Get Plaid accounts with institution info
    const accounts = await db.select({
      accountId: plaidAccounts.accountId,
      accountName: plaidAccounts.accountName,
      accountType: plaidAccounts.accountType,
      accountSubtype: plaidAccounts.accountSubtype,
      // Use currentBalance from schema; expose as generic balance for calculations below
      balance: plaidAccounts.currentBalance,
      institutionName: plaidItems.institutionName,
      isActive: plaidAccounts.isActive,
    })
    .from(plaidAccounts)
    .innerJoin(plaidItems, eq(plaidAccounts.plaidItemId, plaidItems.id))
    .where(and(
      eq(plaidAccounts.userId, userId),
      eq(plaidAccounts.isActive, true),
      eq(plaidItems.status, 'active')
    ));

    // Get latest aggregated snapshot
    // Get latest aggregated snapshot
    const snapshot = await db.select({
      snapshotDate: plaidAggregatedSnapshot.snapshotDate,
      totalAssets: plaidAggregatedSnapshot.totalAssets,
      totalLiabilities: plaidAggregatedSnapshot.totalLiabilities,
      netWorth: plaidAggregatedSnapshot.netWorth,
      // accountCount column name differs across environments; omit to avoid column errors
    })
      .from(plaidAggregatedSnapshot)
      .where(eq(plaidAggregatedSnapshot.userId, userId))
      .orderBy(desc(plaidAggregatedSnapshot.snapshotDate))
      .limit(1);

    // Categorize accounts by type
    const accountTypes = {
      checking: accounts.filter(a => a.accountType === 'depository' && a.accountSubtype === 'checking').length,
      savings: accounts.filter(a => a.accountType === 'depository' && a.accountSubtype === 'savings').length,
      investment: accounts.filter(a => a.accountType === 'investment' || a.accountType === 'brokerage').length,
      retirement: accounts.filter(a => ['401k', 'ira', 'roth', '403b', 'pension'].includes(a.accountSubtype || '')).length,
      credit: accounts.filter(a => a.accountType === 'credit').length,
      mortgage: accounts.filter(a => a.accountSubtype === 'mortgage').length,
    };

    // Calculate total balances by category
    const totalBalances = {
      banking: accounts.filter(a => a.accountType === 'depository').reduce((sum, a) => sum + (parseFloat(a.balance || '0')), 0),
      investment: accounts.filter(a => a.accountType === 'investment' || a.accountType === 'brokerage').reduce((sum, a) => sum + (parseFloat(a.balance || '0')), 0),
      retirement: accounts.filter(a => ['401k', 'ira', 'roth', '403b', 'pension'].includes(a.accountSubtype || '')).reduce((sum, a) => sum + (parseFloat(a.balance || '0')), 0),
      creditCardDebt: accounts.filter(a => a.accountType === 'credit').reduce((sum, a) => sum + Math.abs(parseFloat(a.balance || '0')), 0),
      mortgage: accounts.filter(a => a.accountSubtype === 'mortgage').reduce((sum, a) => sum + Math.abs(parseFloat(a.balance || '0')), 0),
    };

    // Get unique institutions
    const institutions = [...new Set(accounts.map(a => a.institutionName))].filter(Boolean);

    return {
      totalAccounts: accounts.length,
      accountTypes,
      institutions,
      lastSynced: snapshot[0]?.snapshotDate || new Date().toISOString(),
      totalBalances,
      rawAccounts: accounts,
      latestSnapshot: snapshot[0] || null
    };
  } catch (error) {
    console.error('Error fetching Plaid account data:', error);
    return null;
  }
}

/**
 * Extract dashboard widget data from profile
 */
function extractDashboardData(profileData: any, financialMetrics: any): any {
  const dashboardData: any = {};

  // Monte Carlo / Retirement Success Data (baseline)
  if (profileData.monteCarloSimulation) {
    const mcData = typeof profileData.monteCarloSimulation === 'string' 
      ? JSON.parse(profileData.monteCarloSimulation) 
      : profileData.monteCarloSimulation;
    
    // Prefer detailed retirementSimulation results if present
    const mcResults = mcData?.retirementSimulation?.results || {};
    const rawProb = (typeof mcResults.probabilityOfSuccess === 'number' ? mcResults.probabilityOfSuccess :
                     typeof mcResults.successProbability === 'number' ? mcResults.successProbability :
                     typeof mcData.probabilityOfSuccess === 'number' ? mcData.probabilityOfSuccess :
                     typeof mcData.successProbability === 'number' ? mcData.successProbability : 0);

    if (rawProb || rawProb === 0) {
      const probabilityDecimal = rawProb > 1 ? (rawProb / 100) : rawProb;
      const probabilityPct = probabilityDecimal * 100;
      dashboardData.retirementConfidence = {
        currentScore: probabilityPct,
        probabilityOfSuccess: probabilityPct, // always 0-100 for downstream prompt
        probabilityDecimal,
        optimalRetirementAge: mcData.retirementSimulation?.results?.optimalRetirementAge?.optimalAge,
        canRetireEarlier: mcData.retirementSimulation?.results?.optimalRetirementAge?.canRetireEarlier || false,
        earliestAge: mcData.retirementSimulation?.results?.optimalRetirementAge?.earliestAge,
        targetScore: mcData.targetScore || 85
      };
    }

    // Retirement Portfolio Projections (Confidence Bands) Data
    if (mcData.retirementConfidenceBands) {
      const bandsData = mcData.retirementConfidenceBands;
      dashboardData.retirementPortfolioProjections = {
        ages: bandsData.ages || [],
        percentiles: bandsData.percentiles || {},
        meta: bandsData.meta || {},
        runs: bandsData.meta?.runs || 1000,
        calculatedAt: bandsData.meta?.calculatedAt,
        cached: bandsData.cached || false,
        calculationTime: bandsData.calculationTime || 0
      };
      
      // Extract key insights from percentiles
      if (bandsData.percentiles && bandsData.ages) {
        const finalAge = bandsData.ages[bandsData.ages.length - 1];
        const finalAgeIndex = bandsData.ages.length - 1;
        dashboardData.retirementPortfolioProjections.finalProjections = {
          age: finalAge,
          p95: bandsData.percentiles.p95?.[finalAgeIndex] || 0,
          p75: bandsData.percentiles.p75?.[finalAgeIndex] || 0,
          p50: bandsData.percentiles.p50?.[finalAgeIndex] || 0,
          p25: bandsData.percentiles.p25?.[finalAgeIndex] || 0,
          p05: bandsData.percentiles.p05?.[finalAgeIndex] || 0
        };
      }
    }
  }

  // Net Worth Projections
  if (profileData.netWorthProjections) {
    const nwData = typeof profileData.netWorthProjections === 'string'
      ? JSON.parse(profileData.netWorthProjections)
      : profileData.netWorthProjections;
    
    dashboardData.netWorthProjections = {
      netWorthAtRetirement: nwData.netWorthAtRetirement || 0,
      netWorthAtLongevity: nwData.netWorthAtLongevity || 0,
      projectionYears: nwData.projectionData?.length || 0,
      realEstateGrowth: 4.3 // Historical average growth rate used in calculations
    };
  }

  // Financial Health Scores (prefer exact widget-calculated values)
  if (financialMetrics) {
    // Retirement success probability (%), always 0-100
    let retirementScore = 0;
    if (dashboardData.retirementConfidence?.probabilityOfSuccess !== undefined) {
      retirementScore = dashboardData.retirementConfidence.probabilityOfSuccess;
    } else if (typeof financialMetrics.retirementScore === 'number') {
      retirementScore = financialMetrics.retirementScore;
    } else if (typeof profileData.retirementReadinessScore === 'number') {
      retirementScore = profileData.retirementReadinessScore;
    }

    // Emergency score alignment: use the same source the dashboard widget uses
    // Widget source of truth: profile.emergencyReadinessScore (persisted) → calculations.emergencyScore (fallback)
    const widgetEmergencyScore = (
      typeof profileData.emergencyReadinessScore === 'number' ? profileData.emergencyReadinessScore :
      typeof financialMetrics.emergencyScore === 'number' ? financialMetrics.emergencyScore :
      // Final fallback to CFP-aligned if neither of the widget sources exists
      typeof financialMetrics.emergencyReadinessScoreCFP === 'number' ? financialMetrics.emergencyReadinessScoreCFP : 0
    );

    // Compute canonical Insurance Adequacy using same precedence as widget (if available in calculations)
    const canonicalIAS = (
      typeof (financialMetrics as any)?.insuranceAdequacy?.score === 'number' ? (financialMetrics as any).insuranceAdequacy.score :
      typeof (financialMetrics as any)?.insuranceScore === 'number' ? (financialMetrics as any).insuranceScore :
      typeof (profileData as any)?.riskManagementScore === 'number' ? (profileData as any).riskManagementScore :
      null
    );

    dashboardData.healthScores = {
      overall: financialMetrics.healthScore || profileData.financialHealthScore || 0,
      emergency: widgetEmergencyScore,
      retirement: retirementScore,
      riskManagement: (canonicalIAS ?? 0),
      cashFlow: financialMetrics.cashFlowScore || 0
    };
  }

  return dashboardData;
}

/**
 * Analyze behavioral patterns from Plaid transaction data (Phase 3)
 */
async function analyzeBehavioralPatterns(userId: number, profileData: any): Promise<any> {
  try {
    // Get last 6 months of transactions for pattern analysis
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const transactions = await db.select({
      amount: plaidTransactions.amount,
      date: plaidTransactions.date,
      // Use primaryCategory for analysis; detailedCategory may not exist on older DBs
      category: plaidTransactions.primaryCategory,
      merchantName: plaidTransactions.merchantName,
      pending: plaidTransactions.pending
    })
    .from(plaidTransactions)
    .innerJoin(plaidAccounts, eq(plaidTransactions.plaidAccountId, plaidAccounts.id))
    .where(and(
      eq(plaidAccounts.userId, userId),
      gte(plaidTransactions.date, sixMonthsAgo.toISOString().split('T')[0]),
      eq(plaidTransactions.pending, false)
    ))
    .orderBy(desc(plaidTransactions.date))
    .limit(1000); // Limit for performance

    if (transactions.length === 0) {
      return null;
    }

    // Analyze spending patterns by category
    const categorySpending = new Map<string, number>();
    const monthlySpending = new Map<string, Map<string, number>>();
    
    transactions.forEach(tx => {
      if (parseFloat(tx.amount) > 0) { // Expenses are positive in Plaid
        const category = tx.category || 'Other';
        const month = tx.date.substring(0, 7); // YYYY-MM format
        
        // Category totals
        categorySpending.set(category, (categorySpending.get(category) || 0) + parseFloat(tx.amount));
        
        // Monthly breakdown by category
        if (!monthlySpending.has(month)) {
          monthlySpending.set(month, new Map());
        }
        const monthCategories = monthlySpending.get(month)!;
        monthCategories.set(category, (monthCategories.get(category) || 0) + parseFloat(tx.amount));
      }
    });

    // Calculate total spending for percentages
    const totalSpending = Array.from(categorySpending.values()).reduce((sum, amount) => sum + amount, 0);
    
    // Top spending categories
    const topCategories = Array.from(categorySpending.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: Math.round((amount / totalSpending) * 100)
      }));

    // Monthly trends analysis
    const monthlyTrends = Array.from(categorySpending.keys()).slice(0, 5).map(category => {
      const monthlyAmounts = Array.from(monthlySpending.values())
        .map(monthCategories => monthCategories.get(category) || 0);
      
      const avgAmount = monthlyAmounts.reduce((sum, amt) => sum + amt, 0) / monthlyAmounts.length;
      const trend = monthlyAmounts.length > 3 && monthlyAmounts[0] > monthlyAmounts[monthlyAmounts.length - 1] 
        ? 'decreasing' : monthlyAmounts.length > 3 && monthlyAmounts[0] < monthlyAmounts[monthlyAmounts.length - 1]
        ? 'increasing' : 'stable';
      
      return { category, amount: Math.round(avgAmount), trend };
    });

    // Seasonal patterns (simplified)
    const seasonalPatterns = [
      { period: 'Recent 3 months', variance: 15 },
      { period: 'Holiday season', variance: 25 },
    ];

    // Unusual spending detection (simplified)
    const avgMonthlySpending = totalSpending / Math.max(monthlySpending.size, 1);
    const unusualSpending = topCategories.slice(0, 2).map(cat => ({
      category: cat.category,
      amount: cat.amount,
      reason: cat.amount > avgMonthlySpending * 0.3 ? 'High spending category' : 'Regular expense'
    }));

    // Savings patterns analysis
    const savingsTransactions = transactions.filter(tx => 
      parseFloat(tx.amount) < 0 && // Credits/deposits
      (tx.category?.toLowerCase().includes('transfer') || 
       tx.category?.toLowerCase().includes('savings') ||
       tx.merchantName?.toLowerCase().includes('transfer'))
    );

    const savingsPatterns = {
      consistencyScore: Math.min(100, Math.round((savingsTransactions.length / 6) * 20)), // Score out of 100
      averageMonthlyContributions: Math.abs(savingsTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) / 6),
      contributionFrequency: savingsTransactions.length > 12 ? 'Weekly' : savingsTransactions.length > 6 ? 'Monthly' : 'Irregular',
      goalProgress: 75 // Simplified - could integrate with actual goals
    };

    // Investment behavior analysis (simplified based on account activity)
    const investmentBehavior = {
      portfolioRebalancingFrequency: 'Quarterly', // Could analyze actual rebalancing from investment transactions
      riskConsistency: 85, // Based on allocation stability
      diversificationScore: Math.min(100, topCategories.length * 15), // More categories = more diversified spending
      contributionTiming: 'Regular' // Based on consistency score
    };

    return {
      spendingPatterns: {
        monthlyTrends,
        topCategories,
        seasonalPatterns,
        unusualSpending
      },
      savingsPatterns,
      investmentBehavior
    };

  } catch (error) {
    console.error('Error analyzing behavioral patterns:', error);
    return null;
  }
}

/**
 * Generate comparative benchmarks and peer analysis (Phase 3)
 */
function generateComparativeBenchmarks(profileData: any, financialMetrics: any): any {
  const age = profileData.dateOfBirth ? 
    new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear() : 45;
  
  const annualIncome = (parseFloat(profileData.annualIncome || '0') + parseFloat(profileData.spouseAnnualIncome || '0'));
  const netWorth = financialMetrics.netWorth || 0;
  const savingsRate = financialMetrics.savingsRate || 0;

  // Age-based benchmarks (industry standard benchmarks)
  const ageGroup = age < 30 ? '20s' : age < 40 ? '30s' : age < 50 ? '40s' : age < 60 ? '50s' : '60+';
  
  // Net worth benchmarks by age (rule of thumb: age x annual income)
  const targetNetWorth = age * annualIncome;
  const netWorthPercentile = netWorth > targetNetWorth * 1.5 ? 90 : 
                            netWorth > targetNetWorth ? 75 :
                            netWorth > targetNetWorth * 0.5 ? 50 : 25;

  // Income percentiles (simplified based on US data)
  const incomePercentile = annualIncome > 200000 ? 95 :
                          annualIncome > 150000 ? 90 :
                          annualIncome > 100000 ? 75 :
                          annualIncome > 75000 ? 50 : 25;

  // Savings rate percentiles
  const savingsRatePercentile = savingsRate > 25 ? 95 :
                               savingsRate > 20 ? 90 :
                               savingsRate > 15 ? 75 :
                               savingsRate > 10 ? 50 : 25;

  // Asset allocation comparison
  const currentStocks = parseFloat(profileData.currentStockAllocation || '0');
  const ageBasedStockTarget = Math.max(20, 110 - age);
  const allocationComparison = currentStocks > ageBasedStockTarget + 20 ? 'Very Aggressive' :
                              currentStocks > ageBasedStockTarget + 10 ? 'Aggressive' :
                              currentStocks > ageBasedStockTarget - 10 ? 'Age Appropriate' :
                              'Conservative';

  // Target benchmarks
  const recommendedEmergencyFund = (financialMetrics.monthlyExpenses || 0) * (financialMetrics.isDualEarner ? 3 : 6);
  const recommendedSavingsRate = age < 30 ? 15 : age < 40 ? 20 : age < 50 ? 25 : 30;
  const recommendedAllocation = {
    stocks: Math.max(20, 110 - age),
    bonds: Math.min(80, age - 10),
    cash: 5
  };

  // Gap analysis
  const gapAnalysis = [
    {
      area: 'Emergency Fund',
      current: financialMetrics.emergencyMonths * (financialMetrics.monthlyExpenses || 0),
      target: recommendedEmergencyFund,
      gap: recommendedEmergencyFund - (financialMetrics.emergencyMonths * (financialMetrics.monthlyExpenses || 0))
    },
    {
      area: 'Savings Rate',
      current: savingsRate,
      target: recommendedSavingsRate,
      gap: recommendedSavingsRate - savingsRate
    },
    {
      area: 'Stock Allocation',
      current: currentStocks,
      target: recommendedAllocation.stocks,
      gap: recommendedAllocation.stocks - currentStocks
    }
  ];

  return {
    peerComparison: {
      ageGroup,
      incomePercentile,
      netWorthPercentile,
      savingsRatePercentile,
      allocationComparison
    },
    targetBenchmarks: {
      recommendedEmergencyFund,
      recommendedSavingsRate,
      recommendedAllocation,
      gapAnalysis
    }
  };
}

export async function generateGeminiInsights(
  profileData: any, 
  financialMetrics: any,
  estateDocuments: any[] = []
): Promise<{
  insights: InsightItem[];
  profileDataHash: string;
  financialSnapshot: FinancialDataSnapshot;
  generationPrompt: string;
}> {
  
  // Create financial data snapshot
  const currentAge = profileData.dateOfBirth ? 
    new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear() : 30;
  const retirementAge = parseInt(profileData.retirementAge) || 67;
  
  // Fetch comprehensive Plaid account data - extract userId from profile
  const userId = profileData.userId || profileData.id; // Try both common fields
  const plaidData = userId ? await fetchPlaidAccountData(userId) : null;
  
  // Extract dashboard widget data
  const dashboardData = extractDashboardData(profileData, financialMetrics);
  
  // Phase 3: Advanced Analytics
  // Behavioral analysis from transaction patterns
  const behavioralInsights = userId ? await analyzeBehavioralPatterns(userId, profileData) : null;
  
  // Comparative benchmarks and peer analysis
  const benchmarkData = generateComparativeBenchmarks(profileData, financialMetrics);
  
  // Calculate actual monthly expenses from profile data
  const monthlyExpenses = profileData.monthlyExpenses || {};
  const totalMonthlyExpenses = Object.values(monthlyExpenses).reduce((sum: number, expense: any) => sum + (parseFloat(expense) || 0), 0);
  
  // Use the SAME allocation source as the dashboard widget: profileData.currentAllocation
  // This ensures Gemini sees exactly what the user sees on the dashboard
  const currentAllocation = (profileData as any).currentAllocation || {};
  
  // Calculate allocations EXACTLY the same way the dashboard widget does
  // Dashboard uses: usStocks, intlStocks, bonds, alternatives, cash (IGNORE legacy 'stocks' field)
  const stockAllocation = (currentAllocation.usStocks || 0) + (currentAllocation.intlStocks || 0);
  const bondAllocation = currentAllocation.bonds || 0;
  const cashAllocation = currentAllocation.cash || 0;
  const alternativesAllocation = currentAllocation.alternatives || 0;
  
  // CRITICAL FIX: If legacy 'stocks' field exists but usStocks doesn't, use legacy data as fallback
  const finalStockAllocation = (currentAllocation.usStocks !== undefined || currentAllocation.intlStocks !== undefined) 
    ? stockAllocation 
    : (currentAllocation.stocks || 0);
  
  // Calculate total to validate (should be 100% or close to it) 
  const totalAllocation = finalStockAllocation + bondAllocation + cashAllocation + alternativesAllocation;

  // Debug allocation data (keeping logs for troubleshooting)
  console.log('🎯 Gemini using dashboard widget allocation source:');
  console.log('  profileData.currentAllocation:', currentAllocation);
  console.log('  computed stockAllocation (usStocks + intlStocks):', stockAllocation, `(${currentAllocation.usStocks || 0} + ${currentAllocation.intlStocks || 0})`);
  console.log('  finalStockAllocation (used for Gemini):', finalStockAllocation);
  console.log('  computed bondAllocation:', bondAllocation);
  console.log('  computed cashAllocation:', cashAllocation);
  console.log('  computed alternativesAllocation:', alternativesAllocation);
  console.log('  totalAllocation:', totalAllocation, '%', totalAllocation === 100 ? '✅' : '⚠️');
  
  // CRITICAL: Check if there's an old calculation somewhere adding duplicate values
  if (currentAllocation.stocks && currentAllocation.usStocks) {
    console.log('🚨 WARNING: Both stocks and usStocks fields present - potential duplicate!');
    console.log('   currentAllocation.stocks:', currentAllocation.stocks);
    console.log('   currentAllocation.usStocks:', currentAllocation.usStocks);
  }

  // Log the exact values being sent to snapshot
  console.log('📋 Values being sent to Gemini snapshot:');
  console.log('  finalStockAllocation:', finalStockAllocation);
  console.log('  bondAllocation:', bondAllocation);
  console.log('  cashAllocation:', cashAllocation);

  // Align savings rate with the widget (net-based):
  // - monthly income uses take-home inputs when available
  // - monthly cash flow accounts for retirement contributions
  // - savings rate = monthlyCashFlow / monthlyTakeHome
  const deriveWidgetSavingsRate = () => {
    try {
      const monthlyExpensesObj = (profileData as any)?.monthlyExpenses || {};
      const categorizedExpenses = Object.entries(monthlyExpensesObj)
        .filter(([key]) => !key.startsWith('_') && key !== 'total')
        .reduce((sum: number, [, v]: [string, any]) => sum + (parseFloat(v as any) || 0), 0);
      const manualTotalExpenses = parseFloat((profileData as any)?.totalMonthlyExpenses || monthlyExpensesObj.total || 0) || 0;
      const plaidImportedExpenses = monthlyExpensesObj._lastAutoFill?.total || 0;
      const derivedMonthlyExpenses = (typeof financialMetrics.monthlyExpenses === 'number' && financialMetrics.monthlyExpenses > 0)
        ? financialMetrics.monthlyExpenses
        : (categorizedExpenses > 0 ? categorizedExpenses : (manualTotalExpenses > 0 ? manualTotalExpenses : plaidImportedExpenses));

      const takeHomeIncome = Number((profileData as any)?.takeHomeIncome) || 0;
      const spouseTakeHomeIncome = Number((profileData as any)?.spouseTakeHomeIncome) || 0;
      const otherIncome = Number((profileData as any)?.otherMonthlyIncome) || 0;
      const derivedMonthlyIncome = takeHomeIncome + spouseTakeHomeIncome + otherIncome;

      // Retirement contributions (employee + IRA annuals to monthly)
      const rc = (profileData as any)?.retirementContributions || { employee: 0, employer: 0 };
      const src = (profileData as any)?.spouseRetirementContributions || { employee: 0, employer: 0 };
      let monthlyRetirementContributions = (Number(rc.employee) || 0) + (Number(src.employee) || 0);
      const monthlyTraditionalIRA = (Number((profileData as any)?.traditionalIRAContribution) || 0) / 12;
      const monthlyRothIRA = (Number((profileData as any)?.rothIRAContribution) || 0) / 12;
      const monthlySpouseTraditionalIRA = (Number((profileData as any)?.spouseTraditionalIRAContribution) || 0) / 12;
      const monthlySpouseRothIRA = (Number((profileData as any)?.spouseRothIRAContribution) || 0) / 12;
      monthlyRetirementContributions += monthlyTraditionalIRA + monthlyRothIRA + monthlySpouseTraditionalIRA + monthlySpouseRothIRA;

      const persistedMonthlyCashFlow = ((): number | undefined => {
        const p = profileData as any;
        if (typeof p?.monthlyCashFlow === 'number') return p.monthlyCashFlow;
        if (typeof financialMetrics?.monthlyCashFlow === 'number') return financialMetrics.monthlyCashFlow;
        return undefined;
      })();
      const monthlyCashFlow = typeof persistedMonthlyCashFlow === 'number'
        ? persistedMonthlyCashFlow
        : (derivedMonthlyIncome - derivedMonthlyExpenses - monthlyRetirementContributions);

      const savingsRate = derivedMonthlyIncome > 0 ? (monthlyCashFlow / derivedMonthlyIncome) * 100 : 0;
      return Math.max(-100, Math.min(100, savingsRate));
    } catch {
      return typeof financialMetrics.savingsRate === 'number' ? financialMetrics.savingsRate : 0;
    }
  };

  const widgetAlignedSavingsRate = (typeof financialMetrics.savingsRate === 'number')
    ? financialMetrics.savingsRate
    : deriveWidgetSavingsRate();

  const snapshot: FinancialDataSnapshot = {
    netWorth: financialMetrics.netWorth || 0,
    monthlyIncome: (parseFloat(profileData.annualIncome) || 0) / 12 + (parseFloat(profileData.spouseAnnualIncome) || 0) / 12,
    monthlyExpenses: totalMonthlyExpenses,
    monthlyCashFlow: financialMetrics.monthlyCashFlow || 0,
    emergencyMonths: financialMetrics.emergencyMonths || 0,
    savingsRate: widgetAlignedSavingsRate,
    // Persist retirement expenses for drift checks
    // Derive from intake Step 11 with fallbacks
    // (not part of interface; attached via any)
    
    age: currentAge,
    maritalStatus: profileData.maritalStatus || 'single',
    dependents: profileData.dependents || 0,
    employmentType: profileData.employmentStatus || 'employed',
    
    totalAssets: financialMetrics.totalAssets || 0,
    totalLiabilities: financialMetrics.totalLiabilities || 0,
    retirementAssets: 0, // Calculate from assets
    highInterestDebt: 0, // Calculate from liabilities
    
    // Separate user vs spouse coverage to avoid conflating
    hasLifeInsurance: !!(
      (profileData.lifeInsurance?.hasPolicy === true && parseFloat(profileData.lifeInsurance?.coverageAmount || '0') > 0) ||
      (profileData.lifeInsurance && parseFloat(profileData.lifeInsurance as any) > 0)
    ),
    hasDisabilityInsurance: !!(
      (profileData.disabilityInsurance?.hasDisability === true) ||
      (profileData.disabilityInsurance?.hasPolicy === true)
    ),
    hasWill: estateDocuments.some(doc => doc.type?.toLowerCase().includes('will')),
    hasPowerOfAttorney: estateDocuments.some(doc => doc.type?.toLowerCase().includes('power')),
    
    stockAllocation: finalStockAllocation,
    bondAllocation: bondAllocation,
    cashAllocation: cashAllocation,
    
    retirementAge,
    yearsToRetirement: Math.max(0, retirementAge - currentAge),
    hasEducationGoals: profileData.dependents > 0,
    
    // Enhanced data
    plaidData: plaidData || undefined,
    dashboardData: dashboardData || undefined,
    
    // Phase 3: Advanced Analytics
    behavioralInsights: behavioralInsights || undefined,
    benchmarkData: benchmarkData || undefined
  };

  // Calculate high-interest debt and retirement assets
  const assets = Array.isArray(profileData.assets) ? profileData.assets : [];
  const liabilities = Array.isArray(profileData.liabilities) ? profileData.liabilities : [];
  
  snapshot.retirementAssets = assets
    .filter((asset: any) => asset.type && (
      asset.type.toLowerCase().includes('401') ||
      asset.type.toLowerCase().includes('ira') ||
      asset.type.toLowerCase().includes('retirement')
    ))
    .reduce((sum: number, asset: any) => sum + (parseFloat(asset.value) || 0), 0);

  // Compute taxable investment assets (brokerage/taxable accounts only; TLH applies here, not to annuities)
  const taxableFromManual = assets
    .filter((asset: any) => {
      const t = String(asset.type || '').toLowerCase();
      if (!t) return false;
      const isRet = t.includes('401') || t.includes('ira') || t.includes('roth') || t.includes('403') || t.includes('retirement');
      const isBrokerage = t.includes('brokerage') || t.includes('taxable') || (t.includes('investment') && !isRet);
      return isBrokerage && !isRet;
    })
    .reduce((sum: number, a: any) => sum + (parseFloat(a.value) || 0), 0);

  const taxableFromPlaid = (() => {
    try {
      const raw = (snapshot as any)?.plaidData?.rawAccounts || [];
      const lower = (s: any) => String(s || '').toLowerCase();
      const isRetSubtype = (sub: string) => {
        const t = lower(sub);
        return t.includes('ira') || t.includes('roth') || t.includes('401') || t.includes('403') || t.includes('pension');
      };
      return raw
        .filter((a: any) => lower(a.accountType) === 'investment' && !isRetSubtype(a.accountSubtype))
        .reduce((sum: number, a: any) => sum + (parseFloat(a.balance || '0') || 0), 0);
    } catch { return 0; }
  })();
  snapshot.taxablePortfolio = Math.round((taxableFromPlaid || 0) + taxableFromManual);
  snapshot.investableAssets = Math.round((snapshot.retirementAssets || 0) + (snapshot.taxablePortfolio || 0));
  // Derive retirement monthly expenses for drift check
  (snapshot as any).retirementMonthlyExpenses = (
    Number((profileData as any).expectedMonthlyExpensesRetirement) ||
    Number((profileData as any)?.optimizationVariables?.monthlyExpenses) ||
    Number((profileData as any)?.retirementPlanningData?.monthlyExpenses) ||
    0
  );

  snapshot.highInterestDebt = liabilities
    .filter((debt: any) => parseFloat(debt.interestRate || '0') > 7)
    .reduce((sum: number, debt: any) => sum + (parseFloat(debt.balance) || 0), 0);

  // Create profile data hash for change detection
  const profileDataHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      ...profileData,
      estateDocuments: estateDocuments.length,
      timestamp: Math.floor(Date.now() / (1000 * 60 * 60 * 24)) // Daily granularity
    }))
    .digest('hex');

  // Generate comprehensive prompt
  const generationPrompt = `
You are a CERTIFIED FINANCIAL PLANNER (CFP) analyzing a client's complete financial situation. Evaluate all the data available to you and think hard before making any recommendations.
Today's date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.

CRITICAL: DO NOT recommend obtaining insurance that the client already has. Always check the "Life Insurance", "Disability Insurance", and Insurance Adequacy Score before making insurance recommendations. If they have existing coverage, focus on optimization or adequacy review instead.

NON-NEGOTIABLE DASHBOARD INTEGRATION RULES:
- Emergency Fund insights MUST use the Emergency Readiness Score from the dashboard widget. Use the simplified widget score (calculations.emergencyScore or persisted profile.emergencyReadinessScore) as canonical. Do NOT infer targets from income; base adequacy on monthly ESSENTIAL expenses. Do not recompute months unless the data provides them.
- Savings Rate MUST exactly match the dashboard value provided (net take-home basis). Do not recompute from gross income.
 - Debt Management: Default to the app's Hybrid (Snowball + Avalanche) payoff strategy. Use quick-win momentum on small balances while prioritizing surplus to highest-interest debts. Do not recommend pure Avalanche/Snowball as default. Always include a call to action for the user to visit the Debt Management Center for detailed planning, comparisons, and execution.
- Retirement readiness MUST reference the Monte Carlo Success Probability from the dashboard widget Retirement Success (it has saved database data)(probabilityOfSuccess in percent, 0–100). Do NOT use or mention any legacy "retirement confidence score" metric.
- Do NOT recommend Social Security claiming age optimization here. A dedicated optimizer exists in the Retirement Planning optimization tab; avoid SS-claiming-age recommendations in these insights.

CLIENT PROFILE:
- Age: ${snapshot.age}, Marital Status: ${snapshot.maritalStatus}, Dependents: ${snapshot.dependents}
- Employment: ${snapshot.employmentType}${profileData.isSelfEmployed ? ' (Self-employed)' : ''}
- Life Stage: ${snapshot.age < 35 ? 'Early Career (Focus: Debt elimination, emergency fund, aggressive growth)' : 
  snapshot.age < 50 ? 'Peak Earning Years (Focus: Wealth building, tax optimization, college planning)' : 
  snapshot.age < 60 ? 'Pre-Retirement (Focus: Catch-up contributions, risk adjustment, succession planning)' : 
  'Retirement/Legacy Phase (Focus: Income optimization, healthcare costs, estate planning)'}

**CAREER & INDUSTRY-SPECIFIC FINANCIAL STRATEGIES:**
${profileData.isSelfEmployed ? `
SELF-EMPLOYED PROFESSIONAL ANALYSIS:
- Business Structure Optimization: Consider LLC/S-Corp election for tax efficiency if income >$50,000
- Retirement Contributions: Solo 401(k) allows up to $69,000 (2024) vs. SEP-IRA limitations
- Quarterly Tax Planning: Set aside 25-30% of income for taxes, use tax-advantaged accounts to reduce burden
- Business Emergency Fund: 6-12 months expenses (vs. 3-6 for employees) due to income volatility
- Health Insurance: HSA eligibility critical for self-employed - triple tax advantage
- Equipment/Office Deductions: Section 179 depreciation and home office deductions
- Professional Liability: Industry-specific insurance needs and business protection
- Income Smoothing: Roth conversions during lower-income years to manage tax brackets
` : `
EMPLOYED PROFESSIONAL ANALYSIS:
- 401(k) Optimization: ${snapshot.retirementAssets > 0 ? 'Contributing to retirement plan - ensure maximum employer match' : 'PRIORITY: Start 401(k) contributions immediately for employer match'}
- Job Security Assessment: ${(snapshot.monthlyIncome * 12) > 100000 ? 'High-income professional - specialized skills provide stability' : 'Standard employment - maintain marketable skills'}
- Career Development ROI: Professional development and certifications can increase lifetime earnings by $200,000+
- Stock Options/RSUs: ${(snapshot.monthlyIncome * 12) > 150000 ? 'Likely eligible for equity compensation - need concentrated risk management' : 'Focus on cash compensation optimization'}
`}

${(snapshot.monthlyIncome * 12) > 200000 ? `
HIGH-INCOME PROFESSIONAL STRATEGIES:
- Alternative Minimum Tax (AMT): Monitor AMT triggers, especially with stock options/incentive stock options
- Backdoor Roth IRA: Income likely exceeds direct Roth contribution limits - use backdoor strategy
- Mega Backdoor Roth: If 401(k) allows after-tax contributions, can contribute additional $46,000
- Tax-Loss Harvesting: High tax bracket makes tax-loss harvesting extremely valuable
- Estate Planning: Higher net worth requires more sophisticated estate planning
- Cash Management: May benefit from private banking/wealth management services
` : (snapshot.monthlyIncome * 12) > 75000 ? `
MIDDLE-TO-UPPER INCOME STRATEGIES:
- Roth vs. Traditional Decision: Likely in 22-24% tax bracket - balance current vs. future tax rates
- Catch-Up Contribution Planning: If 50+, maximize catch-up contributions
- 529 vs. Retirement Trade-off: Balance college funding with retirement security
` : `
MODERATE INCOME OPTIMIZATION:
- Earned Income Tax Credit: Verify eligibility for EITC if applicable
- Saver's Credit: Up to $1,000 credit for retirement contributions (income limits apply)
- Roth IRA Priority: Lower current tax bracket makes Roth IRA highly advantageous
- Emergency Fund First: Build 3-6 months expenses before aggressive investing. Use the Emergency Readiness Score from the dashboard. It has saved database data (calculations.emergencyReadinessScoreCFP) as the authoritative signal. Do NOT infer targets from income; use monthly essential EXPENSES. Do not recompute months unless explicitly provided by data.
`}

**PROFESSION-SPECIFIC CONSIDERATIONS:**
${profileData.employmentStatus?.toLowerCase().includes('teacher') || profileData.jobTitle?.toLowerCase().includes('teacher') ? `
EDUCATOR STRATEGIES:
- 403(b) vs. 401(k): Understand 403(b) plan rules and investment options
- Pension Integration: Coordinate pension benefits with personal retirement savings
- Summer Income Planning: Budget for irregular income during summer months
- Student Loan Forgiveness: Public Service Loan Forgiveness (PSLF) eligibility
- Educator Tax Deductions: Up to $300 for classroom supplies (above-the-line deduction)
` : profileData.employmentStatus?.toLowerCase().includes('healthcare') || profileData.jobTitle?.toLowerCase().includes('doctor') || profileData.jobTitle?.toLowerCase().includes('nurse') ? `
HEALTHCARE PROFESSIONAL STRATEGIES:
- Malpractice Insurance: Professional liability and adequate coverage limits
- Irregular Hours Premium: Shift differentials and overtime affect tax planning
- Continuing Education: Tax-deductible professional development requirements
- Disability Insurance: Critical for healthcare workers due to physical demands
- Student Loan Strategy: Medical/nursing school debt optimization and forgiveness programs
` : profileData.employmentStatus?.toLowerCase().includes('tech') || profileData.jobTitle?.toLowerCase().includes('software') || profileData.jobTitle?.toLowerCase().includes('engineer') ? `
TECHNOLOGY PROFESSIONAL STRATEGIES:
- Stock Options/RSUs: Diversification critical to avoid concentration risk
- AMT Planning: Incentive Stock Options (ISOs) can trigger AMT
- Job Mobility: High demand allows for strategic career moves and salary negotiation
- Sabbatical Planning: Tech industry normalizes career breaks - plan financially
- Geographic Arbitrage: Remote work enables living in lower-cost areas
` : `
GENERAL PROFESSIONAL STRATEGIES:
- Skill Development ROI: Invest in skills that increase earning potential
- Industry Diversification: Avoid overconcentration in employer stock or industry
- Professional Network: Networking can increase lifetime earning potential significantly
- Career Flexibility: Maintain emergency fund for job transitions and opportunities
`}
- Net Worth: ${snapshot.netWorth.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Monthly Income: ${snapshot.monthlyIncome.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}${profileData.spouseAnnualIncome ? ` (includes spouse: ${(parseFloat(profileData.spouseAnnualIncome)/12).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}/month)` : ''}
- Monthly Expenses: ${snapshot.monthlyExpenses.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Monthly Cash Flow: ${snapshot.monthlyCashFlow.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Emergency Fund: ${snapshot.emergencyMonths.toFixed(1)} months of expenses covered
- Savings Rate: ${snapshot.savingsRate.toFixed(1)}%${profileData.state ? `
- State: ${profileData.state} (for tax planning and state-specific opportunities)` : ''}

${profileData.state ? `
**STATE-SPECIFIC TAX & PLANNING CONTEXT:**
${['TX', 'FL', 'WA', 'NV', 'NH', 'TN', 'WY', 'AK', 'SD'].includes(profileData.state) ? `
TAX-ADVANTAGED STATE (${profileData.state}):
- No state income tax = Higher Roth conversion capacity without state tax burden
- Consider municipal bonds from other states for potentially higher yields
- Retirement relocation advantage: Already in tax-friendly state
- 529 Plan: Review if other states offer better investment options/deductions
- Estate planning: No state estate tax (except WA has estate tax)
` : ['CA', 'NY', 'NJ', 'CT', 'MA', 'OR', 'MN', 'DC', 'VT'].includes(profileData.state) ? `
HIGH-TAX STATE (${profileData.state}):
- State income tax rate: ${profileData.state === 'CA' ? '13.3%' : profileData.state === 'NY' ? '10.9%' : profileData.state === 'NJ' ? '10.75%' : 'High'} (top bracket)
- Municipal bond strategy: In-state munis provide triple tax exemption
- Roth conversions: Consider timing with lower-income years to minimize state taxes
- SALT deduction: $10,000 cap affects tax planning (itemized vs. standard deduction)
- Retirement relocation: Consider FL, TX, NV for 0% state income tax in retirement
- 529 Plan: ${profileData.state} offers state tax deduction for contributions
- Estate tax: ${['NY', 'MA', 'CT', 'OR', 'MN', 'DC', 'VT'].includes(profileData.state) ? 'State estate tax applies - plan accordingly' : 'No state estate tax'}
` : `
MODERATE-TAX STATE (${profileData.state}):
- Balanced tax environment for retirement planning
- Review in-state 529 plan benefits vs. other states
- Municipal bond opportunities within state
- Estate tax: ${['IL', 'ME', 'MD', 'RI', 'HI'].includes(profileData.state) ? 'State estate tax applies' : 'No state estate tax'}
`}
${profileData.state === 'CA' ? `
CALIFORNIA SPECIFIC:
- High earners: Consider Nevada/Florida for retirement (save ~13% on retirement income)
- Disability insurance: CA SDI provides some coverage, review need for additional
- Real estate: High values affect estate planning and retirement cash flow
` : profileData.state === 'TX' ? `
TEXAS SPECIFIC:
- No state income tax: Maximize pre-tax 401(k) over Roth while working
- Property taxes high: Factor into retirement location decisions
- Energy sector: Diversify if concentrated in oil/gas industry
` : profileData.state === 'FL' ? `
FLORIDA SPECIFIC:
- No state income tax: Popular retirement destination
- Hurricane risk: Adequate homeowner's/flood insurance essential
- No state estate tax: Estate planning advantage
` : ''}
` : ''}

ASSETS & LIABILITIES:
- Total Assets: ${snapshot.totalAssets.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Retirement Assets: ${snapshot.retirementAssets.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Investable Assets (retirement + taxable): ${(snapshot.investableAssets || (snapshot.retirementAssets + (snapshot as any).taxablePortfolio || 0)).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Total Liabilities: ${snapshot.totalLiabilities.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- High-Interest Debt (>7%): ${snapshot.highInterestDebt.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}

PROTECTION & PLANNING:
- Life Insurance: ${snapshot.hasLifeInsurance ? 'Yes' : 'No'}${
  snapshot.hasLifeInsurance ? ` (User: ${profileData.lifeInsurance?.coverageAmount ? '$' + parseFloat(profileData.lifeInsurance.coverageAmount).toLocaleString() : 'N/A'}${
    profileData.spouseLifeInsurance?.coverageAmount ? `, Spouse: $${parseFloat(profileData.spouseLifeInsurance.coverageAmount).toLocaleString()}` : ''
  })` : ''
}
- Disability Insurance: ${snapshot.hasDisabilityInsurance ? 'Yes' : 'No'}
- Long-Term Care Insurance: ${profileData.hasLongTermCareInsurance ? 'Yes' : 'No'}
- Will: ${snapshot.hasWill ? 'Yes' : 'No'}
- Power of Attorney: ${snapshot.hasPowerOfAttorney ? 'Yes' : 'No'}

INVESTMENT ALLOCATION:
- Stocks (US + International): ${snapshot.stockAllocation}%
- Bonds: ${snapshot.bondAllocation}%
- Alternatives: ${alternativesAllocation}%
- Cash: ${snapshot.cashAllocation}%
- Total Allocation: ${totalAllocation}% ${totalAllocation === 100 ? '(✅ Properly balanced)' : totalAllocation > 0 ? '(⚠️ May need rebalancing)' : '(❌ No allocation data)'}
- User Risk Profile: ${profileData.userRiskProfile || 'Not assessed'}
${profileData.spouseRiskProfile && profileData.maritalStatus === 'married' ? `- Spouse Risk Profile: ${profileData.spouseRiskProfile}` : ''}

RETIREMENT PLANNING:
- Target Retirement Age: ${snapshot.retirementAge}
- Years Until Retirement: ${snapshot.yearsToRetirement}${profileData.retirementIncome ? `
- Target Retirement Income: ${parseFloat(profileData.retirementIncome).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}/month` : ''}

**HEALTHCARE COST ANALYSIS:**
- Lifetime Healthcare Costs: $300,000-$400,000 per person average in retirement
- Current Age Healthcare Projection: ~${((snapshot.age < 35 ? 350000 : snapshot.age < 50 ? 320000 : snapshot.age < 60 ? 280000 : 250000) * (snapshot.maritalStatus === 'married' ? 2 : 1)).toLocaleString('en-US', {style: 'currency', currency: 'USD'})} total for ${snapshot.maritalStatus === 'married' ? 'couple' : 'individual'}
- Medicare Coverage: Begins age 65, covers ~80% of costs
- Medicare Premiums: Part B ~$175/month, Part D ~$50/month (2024, income-dependent)
- Medigap Insurance: $100-300/month for comprehensive coverage
- HSA Strategy: ${profileData.hasHSA ? 'EXCELLENT - Triple tax advantage for medical expenses' : 'Consider HSA if available - triple tax advantage'}
- Long-Term Care Risk: 70% probability of needing care, $55,000-$108,000 annually
- LTC Insurance Status: ${profileData.hasLongTermCareInsurance ? 'Protected' : 'EXPOSED - Major financial risk'}
${snapshot.age >= 50 ? `
- Medicare Planning Timeline: Review Medicare options 3 months before 65th birthday
- COBRA/ACA Bridge: Plan healthcare coverage gap if retiring before 65
` : `
- Future Medicare Planning: Begin research 5 years before retirement
- HSA Maximization: If eligible, contribute maximum ($4,300 individual, $8,550 family for 2024)
`}

**SOCIAL SECURITY OPTIMIZATION ANALYSIS:**
- Full Retirement Age (FRA): ${snapshot.age >= 1960 ? '67' : snapshot.age >= 1955 ? '66 + 2-10 months' : '66'}
- Early Claiming Penalty: 25-30% reduction if claimed at 62 vs. FRA
- Delayed Retirement Credits: 8% increase per year from FRA to age 70 (132% of FRA benefit)
- Break-Even Analysis: Delayed claiming typically breaks even around age 78-82
${snapshot.maritalStatus === 'married' ? `
- Spousal Benefits: Up to 50% of higher earner's FRA benefit (if higher than own benefit)
- Survivor Benefits: 100% of deceased spouse's benefit (including delayed retirement credits)
- Claiming Strategy: Consider "claim and invest" vs. delayed claiming based on health/longevity
- Tax Implications: Up to 85% of Social Security may be taxable depending on other retirement income
- File and Suspend: No longer available, but spousal coordination still important
` : `
- Single Person Strategy: Consider health, longevity, and investment returns for optimal claiming age
- Tax Implications: Up to 85% of Social Security may be taxable depending on other retirement income
`}
- Medicare Enrollment: Must enroll at 65 even if delaying Social Security to avoid penalties
- Earnings Test: If claiming before FRA and still working, benefits reduced $1 for every $2 earned over $22,320 (2024)
${snapshot.age >= 50 ? `
- Action Timeline: Review Social Security statements annually, plan claiming strategy 5 years before FRA
` : `
- Long-term Planning: Social Security provides foundation, plan for 40-50% of pre-retirement income replacement
`}

**ADVANCED TAX STRATEGY INTELLIGENCE:**
Current Tax Situation Analysis:
- Estimated Federal Tax Bracket: ${snapshot.monthlyIncome * 12 < 44725 ? '12%' : snapshot.monthlyIncome * 12 < 95375 ? '22%' : snapshot.monthlyIncome * 12 < 182050 ? '24%' : snapshot.monthlyIncome * 12 < 231250 ? '32%' : snapshot.monthlyIncome * 12 < 578125 ? '35%' : '37%'}
- Annual Income: ${(snapshot.monthlyIncome * 12).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- State Tax Impact: ${['TX', 'FL', 'WA', 'NV', 'NH', 'TN', 'WY', 'AK', 'SD'].includes(profileData.state) ? 'No state income tax - tax advantage' : ['CA', 'NY', 'NJ'].includes(profileData.state) ? 'High state taxes - advanced strategies critical' : 'Moderate state tax environment'}

**ROTH CONVERSION LADDER STRATEGY:**
${snapshot.age < 60 ? `
- Optimal Conversion Window: Ages ${Math.max(snapshot.age, 50)}-65 (between peak earning and RMDs)
- Annual Conversion Target: $${Math.min(25000, Math.max(10000, snapshot.monthlyIncome * 2)).toLocaleString()} (stay within current tax bracket)
- Timing Strategy: Convert during market downturns for tax-efficiency
- 5-Year Rule: Each conversion has 5-year waiting period for penalty-free withdrawals
- Total Potential Benefit: Converting $${(Math.min(25000, Math.max(10000, snapshot.monthlyIncome * 2)) * (65 - Math.max(snapshot.age, 50))).toLocaleString()} could save $${Math.round((Math.min(25000, Math.max(10000, snapshot.monthlyIncome * 2)) * (65 - Math.max(snapshot.age, 50))) * 0.25).toLocaleString()} in lifetime taxes
` : `
- Late-Stage Conversions: Limited window before age 70 RMDs
- Accelerated Strategy: Consider larger annual conversions if health concerns
- Legacy Planning: Roth IRAs have no RMDs, better for heirs
`}

**ASSET LOCATION OPTIMIZATION:**
Tax-Efficient Account Placement Strategy:
- Traditional 401(k)/IRA: Bonds, REITs, high-dividend stocks (tax-inefficient assets)
- Roth IRA: Growth stocks, small-cap, international (highest growth potential)
- Taxable Accounts: Tax-efficient index funds, municipal bonds, individual stocks (tax-loss harvesting)
- HSA (if available): Long-term growth investments (triple tax advantage)
- Current Allocation Review: ${snapshot.stockAllocation}% stocks, ${snapshot.bondAllocation}% bonds, ${alternativesAllocation}% alternatives, ${snapshot.cashAllocation}% cash (Total: ${totalAllocation}%)

  **TAX-LOSS HARVESTING STRATEGY:**
  ${snapshot.taxablePortfolio > 50000 ? `
  - Taxable Portfolio: ${snapshot.taxablePortfolio.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} - Tax-loss harvesting beneficial
  - Annual Potential: Up to $3,000 ordinary income offset + unlimited capital gains offset
  - Wash Sale Avoidance: 30-day rule for substantially identical securities
  - Tax-Efficient Funds: Use index funds to minimize taxable distributions
  ` : `
  - Portfolio Growing: Implement tax-loss harvesting once taxable brokerage exceeds $50,000
  - Focus on Tax-Deferred Growth: Maximize 401(k) and IRA contributions first
  `}

**IRMAA AVOIDANCE PLANNING:**
Medicare Income-Related Monthly Adjustment Amount:
- IRMAA Thresholds (2024): Single $103,000, Married $206,000 (modified AGI)
- Penalty: Up to $419.30/month extra for Medicare Part B + Part D surcharges
- Planning Strategy: ${snapshot.age >= 50 ? 'Monitor AGI 2 years before Medicare eligibility' : 'Future planning - manage retirement income to avoid thresholds'}
- Roth Benefits: Roth withdrawals don't count toward IRMAA thresholds

**CHARITABLE GIVING TAX STRATEGIES:**
${snapshot.age >= 50 ? `
- Donor-Advised Funds: Bunch charitable deductions to exceed standard deduction
- Qualified Charitable Distribution: Age 70.5+ can give up to $105,000 directly from IRA (counts toward RMD)
` : `
- Future Charitable Planning: Donor-advised funds for tax-efficient giving
- Appreciated Assets: Donate stocks instead of cash to avoid capital gains
`}

**ESTATE TAX PLANNING:**
${snapshot.netWorth > 1000000 ? `
- Net Worth: ${snapshot.netWorth.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} - Estate planning critical
- Federal Exemption (2024): $13.61 million individual, $27.22 million married
- State Estate Tax: ${['NY', 'MA', 'CT', 'OR', 'MN', 'DC', 'VT', 'WA', 'IL', 'ME', 'MD', 'RI', 'HI'].includes(profileData.state) ? `${profileData.state} has state estate tax - lower thresholds apply` : 'No state estate tax'}
- Annual Gifting: $18,000 per recipient (2024), $27,000 for spouses combined
` : `
- Current Net Worth: ${snapshot.netWorth.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} - Monitor for future estate planning needs
- Basic Documents: Will, power of attorney, healthcare directives essential regardless of wealth
`}

${(profileData.goals && Array.isArray(profileData.goals) && profileData.goals.length > 0) ? `
FINANCIAL GOALS:
${profileData.goals.slice(0, 5).map((goal: any) => 
  `- ${goal.description || goal.title}: ${goal.targetAmount ? parseFloat(goal.targetAmount).toLocaleString('en-US', {style: 'currency', currency: 'USD'}) : 'Amount not specified'} by ${goal.targetDate || 'No date specified'}`
).join('\n')}

**GOAL INTERCONNECTIVITY & TRADE-OFF ANALYSIS:**
${profileData.goals.length > 1 ? `
- Multiple Goals Detected: ${profileData.goals.length} active goals competing for resources
- Cash Flow Allocation: Monthly savings must be distributed across all goals
- Timeline Conflicts: ${profileData.goals.filter((g: any) => g.targetDate && new Date(g.targetDate) < new Date(Date.now() + 10*365*24*60*60*1000)).length > 1 ? 'Multiple goals have overlapping timelines - prioritization critical' : 'Goals have different timelines - sequential planning possible'}
- Retirement vs. Other Goals: Every $1 invested for goals instead of retirement costs ~$7-10 in retirement wealth (compound growth)
` : ''}
${profileData.goals.some((g: any) => g.description?.toLowerCase().includes('college') || g.description?.toLowerCase().includes('education')) && profileData.goals.some((g: any) => g.description?.toLowerCase().includes('retirement')) ? `
- COLLEGE vs. RETIREMENT TRADE-OFF:
  • Rule of Thumb: Prioritize retirement over college funding (can borrow for college, not retirement)
  • 529 Plan Strategy: State tax benefits may tip balance toward college savings
  • Impact Analysis: Reducing college goal by 25% could increase retirement success probability by 5-8%
  • Financial Aid: Higher retirement savings don't count against college financial aid eligibility
` : ''}
${profileData.goals.some((g: any) => g.description?.toLowerCase().includes('house') || g.description?.toLowerCase().includes('home')) ? `
- HOME PURCHASE STRATEGY:
  • Down Payment vs. Retirement: 20% down prevents PMI but delays retirement savings
  • Roth IRA Exception: Can withdraw contributions penalty-free for first-time home purchase
  • Rent vs. Buy Calculator: Consider total cost of ownership, not just mortgage payment
` : ''}
- Goal Rebalancing Strategy: Review and adjust goal priorities annually based on progress and life changes
- Emergency vs. Goals: Ensure emergency fund is fully funded before pursuing other goals
` : ''}

${snapshot.plaidData ? `
PLAID CONNECTED ACCOUNTS:
- Total Connected Accounts: ${snapshot.plaidData.totalAccounts}
- Banking Accounts: ${snapshot.plaidData.accountTypes.checking} checking, ${snapshot.plaidData.accountTypes.savings} savings
- Investment Accounts: ${snapshot.plaidData.accountTypes.investment} brokerage, ${snapshot.plaidData.accountTypes.retirement} retirement
- Debt Accounts: ${snapshot.plaidData.accountTypes.credit} credit cards, ${snapshot.plaidData.accountTypes.mortgage} mortgages
- Financial Institutions: ${snapshot.plaidData.institutions.join(', ')}
- Last Data Sync: ${new Date(snapshot.plaidData.lastSynced).toLocaleDateString()}

ACCOUNT BALANCES (Real-time):
- Banking Assets: ${snapshot.plaidData.totalBalances.banking.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Investment Assets: ${snapshot.plaidData.totalBalances.investment.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Retirement Assets: ${snapshot.plaidData.totalBalances.retirement.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Credit Card Debt: ${snapshot.plaidData.totalBalances.creditCardDebt.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Mortgage Debt: ${snapshot.plaidData.totalBalances.mortgage.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
` : ''}

${dashboardBlock}
${snapshot.dashboardData?.retirementConfidence ? `
- Retirement Success Probability: ${Math.round(snapshot.dashboardData.retirementConfidence.probabilityOfSuccess)}% (Monte Carlo)
${snapshot.dashboardData.retirementConfidence.canRetireEarlier ? `- Early Retirement Possible: Can retire ${snapshot.dashboardData.retirementConfidence.earliestAge ? `at age ${snapshot.dashboardData.retirementConfidence.earliestAge}` : 'earlier than planned'}` : ''}
- Target Confidence Score: ${snapshot.dashboardData.retirementConfidence.targetScore}%
` : ''}

${snapshot.dashboardData.retirementPortfolioProjections ? `
- Portfolio Projections Widget: Monte Carlo simulation with ${snapshot.dashboardData.retirementPortfolioProjections.runs || 1000} scenarios
- Portfolio Value at Age ${snapshot.dashboardData.retirementPortfolioProjections.finalProjections?.age || 93}:
  • 95th Percentile (Best Case): ${(snapshot.dashboardData.retirementPortfolioProjections.finalProjections?.p95 || 0).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
  • 75th Percentile (Good Case): ${(snapshot.dashboardData.retirementPortfolioProjections.finalProjections?.p75 || 0).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
  • 50th Percentile (Median): ${(snapshot.dashboardData.retirementPortfolioProjections.finalProjections?.p50 || 0).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
  • 25th Percentile (Conservative): ${(snapshot.dashboardData.retirementPortfolioProjections.finalProjections?.p25 || 0).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
  • 5th Percentile (Worst Case): ${(snapshot.dashboardData.retirementPortfolioProjections.finalProjections?.p05 || 0).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Projection Methodology: Uses inflation-adjusted returns (μ=5.0%, σ=12.0%) for real dollar values
- Calculation Date: ${snapshot.dashboardData.retirementPortfolioProjections.calculatedAt ? new Date(snapshot.dashboardData.retirementPortfolioProjections.calculatedAt).toLocaleDateString() : 'Recently calculated'}
` : ''}

**MARKET CONTEXT & ECONOMIC CYCLE AWARENESS:**
Current Market Environment Analysis (${new Date().getFullYear()}):
- Market Phase: ${new Date().getFullYear() >= 2022 ? 'Post-Pandemic Recovery/Inflation Management Era' : 'Bull Market Continuation'}
- Interest Rate Environment: ${new Date().getFullYear() >= 2022 ? 'Rising/High Rate Environment (Fed fighting inflation)' : 'Low Rate Environment'}
- Inflation Context: ${new Date().getFullYear() >= 2021 ? 'Elevated inflation period - asset allocation and cash management critical' : 'Low inflation - growth-focused strategies appropriate'}

**ECONOMIC CYCLE POSITIONING:**
${new Date().getFullYear() >= 2022 ? `
HIGH INTEREST RATE STRATEGIES (Current Environment):
- Cash Position: Higher cash yields (4-5% money market rates) make cash more attractive
- Bond Duration: Shorter duration bonds reduce interest rate risk
- Real Estate: Higher mortgage rates affect affordability and valuations
- Stock Valuations: Higher discount rates compress growth stock multiples
- Refinancing: Avoid unless absolutely necessary due to high mortgage rates
- TIPS/I-Bonds: Inflation protection becomes more valuable
` : `
LOW INTEREST RATE STRATEGIES:
- Cash Opportunity Cost: Low cash yields encourage investment in growth assets
- Bond Strategy: Longer duration bonds for yield, but interest rate risk exists
- Real Estate: Low mortgage rates support property values and affordability
- Growth Stocks: Low discount rates support higher valuations
- Refinancing: Excellent opportunity to reduce mortgage payments
`}

**RECESSION PREPAREDNESS ANALYSIS:**
Current Economic Risk Assessment:
- Recession Probability: ${new Date().getFullYear() >= 2022 ? 'Elevated (inverted yield curve, inflation concerns, geopolitical tensions)' : 'Low (economic expansion phase)'}
- Portfolio Defensiveness: ${snapshot.stockAllocation > 80 ? 'Aggressive allocation - consider defensive positioning' : snapshot.stockAllocation > 60 ? 'Moderate allocation - well-positioned' : 'Conservative allocation - prepared for volatility'}
- Emergency Fund Adequacy: ${typeof snapshot.dashboardData?.healthScores?.emergency === 'number' ? `${snapshot.dashboardData.healthScores.emergency}/100 Emergency Readiness Score (use as canonical)` : (snapshot.emergencyMonths >= 6 ? 'Well-prepared for economic downturn' : 'Consider increasing reserves during uncertainty')}
- Job Security Assessment: ${profileData.employmentStatus === 'employed' ? (profileData.isSelfEmployed ? 'Self-employed - higher recession risk, need larger emergency fund' : 'Employed - moderate security, standard emergency fund adequate') : 'Not employed - maximum emergency fund critical'}

**INFLATION PROTECTION STRATEGIES:**
${new Date().getFullYear() >= 2021 ? `
HIGH INFLATION ENVIRONMENT TACTICS:
- Asset Allocation: Real assets (REITs, commodities, inflation-protected bonds)
- Fixed-Rate Debt Advantage: Existing low-rate mortgages become valuable in inflation
- Cash Management: Minimize cash holdings, maximize high-yield savings rates
- Salary Negotiation: Annual cost-of-living adjustments critical
- Real Estate: Property values and rents typically rise with inflation
- Stock Selection: Companies with pricing power outperform during inflation
` : `
LOW INFLATION ENVIRONMENT:
- Growth Focus: Technology and growth stocks benefit from low inflation expectations
- Long-Term Bonds: Fixed income provides steady returns with low inflation risk
- Cash Strategy: Minimize cash due to low real returns
`}

**MARKET TIMING & VOLATILITY MANAGEMENT:**
- Dollar-Cost Averaging: Continue regular investments regardless of market conditions
- Rebalancing Opportunities: Market volatility creates rebalancing alpha
- Tax-Loss Harvesting: Bear markets provide excellent tax-loss opportunities
- Sequence of Returns Risk: ${snapshot.age >= 55 ? 'CRITICAL - Consider glide path and bond tent strategies' : 'Future concern - maintain growth allocation while young'}
- Market Corrections: ${snapshot.emergencyMonths >= 3 ? 'Prepared to avoid selling investments during downturns' : 'Risk of forced selling during market stress'}

**GEOPOLITICAL & SYSTEMATIC RISK FACTORS:**
Current Risk Assessment (${new Date().getFullYear()}):
- International Diversification: ${snapshot.stockAllocation > 0 ? 'Review international allocation for geopolitical risk management' : 'Consider adding international exposure for diversification'}
- Supply Chain Disruption: Affects certain sectors more than others
- Energy Volatility: ${profileData.state === 'TX' ? 'Texas resident - energy sector exposure may be concentrated' : 'Consider energy sector allocation for inflation protection'}
- Currency Risk: Dollar strength affects international investments and multinationals
` : ''}

${snapshot.behavioralInsights ? `
**BEHAVIORAL PSYCHOLOGY & SPENDING ANALYSIS:**

**SPENDING PERSONALITY PROFILE:**
${snapshot.behavioralInsights ? `
Primary Spending Categories (Last 6 Months):
${snapshot.behavioralInsights.spendingPatterns.topCategories.slice(0, 5).map((cat: any) => 
  `- ${cat.category}: ${cat.amount.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} (${cat.percentage}% of spending)`
).join('\n')}

**BEHAVIORAL PATTERN ANALYSIS:**
- Spending Consistency: ${snapshot.behavioralInsights.spendingPatterns.monthlyTrends.find((t: any) => t.trend === 'stable') ? 'Stable spender - predictable budgeting' : 'Variable spender - need flexible emergency fund'}
- Savings Discipline: ${snapshot.behavioralInsights.savingsPatterns.consistencyScore}/100 (${snapshot.behavioralInsights.savingsPatterns.consistencyScore >= 80 ? 'Excellent discipline' : snapshot.behavioralInsights.savingsPatterns.consistencyScore >= 60 ? 'Good habits, room for improvement' : 'Needs behavioral intervention'})
- Investment Timing: ${snapshot.behavioralInsights.investmentBehavior.contributionTiming === 'consistent' ? 'Dollar-cost averaging - good strategy' : 'Irregular timing - may miss market opportunities'}

**PSYCHOLOGICAL MONEY PROFILE:**
${snapshot.behavioralInsights.savingsPatterns.consistencyScore >= 80 ? `
DISCIPLINED SAVER PROFILE:
- Strengths: Consistent savings habits, delayed gratification
- Optimization: Consider automated investment increases, tax-loss harvesting
- Risk: May be too conservative - evaluate risk tolerance vs. time horizon
` : snapshot.behavioralInsights.savingsPatterns.consistencyScore >= 60 ? `
MODERATE SAVER PROFILE:
- Strengths: Generally good habits with occasional lapses
- Behavioral Nudges: Automate savings increases, visual progress tracking
- Focus: Build consistency through systematic approach
` : `
INCONSISTENT SAVER PROFILE:
- Challenge: Irregular savings pattern indicates behavioral barriers
- Interventions: Start small ($50/month), automate everything, celebrate small wins
- Psychology: Address underlying money mindset and spending triggers
`}
` : `
**SPENDING PERSONALITY ASSESSMENT (Based on Available Data):**
- Monthly Cash Flow: ${snapshot.monthlyCashFlow > 0 ? `Positive $${snapshot.monthlyCashFlow.toLocaleString()} - indicates good spending control` : `Negative $${Math.abs(snapshot.monthlyCashFlow).toLocaleString()} - spending exceeds income`}
- Savings Rate: ${snapshot.savingsRate >= 20 ? 'Excellent (20%+ savings rate)' : snapshot.savingsRate >= 10 ? 'Good (10-19% savings rate)' : 'Needs Improvement (<10% savings rate)'}
`}

**BEHAVIORAL OPTIMIZATION STRATEGIES:**
${snapshot.savingsRate < 10 ? `
LOW SAVINGS RATE INTERVENTION:
- Start Small: Begin with 1% savings increase, then add 1% every 3 months
- Automate: Set up automatic transfers to remove willpower from equation
- Visual Tracking: Use apps/charts to see progress and maintain motivation
- Behavioral Economics: Use "pay yourself first" principle
` : snapshot.savingsRate < 20 ? `
MODERATE SAVERS OPTIMIZATION:
- Incremental Increases: Add 1% to savings rate every 6 months until reaching 20%
- Spending Awareness: Track largest expense categories for optimization opportunities
- Goal-Based Budgeting: Allocate savings to specific goals for motivation
` : `
HIGH SAVERS ADVANCED STRATEGIES:
- Tax Optimization: Focus on tax-advantaged account maximization
- Investment Sophistication: Consider factor investing, international diversification
- Estate Planning: High savings rate enables advanced wealth transfer strategies
`}

**HABIT FORMATION & MAINTENANCE:**
- Automation Level: ${snapshot.behavioralInsights?.savingsPatterns?.contributionFrequency === 'automatic' ? 'Fully automated - excellent for consistency' : 'Manual savings - consider automation for better results'}
- Rebalancing Discipline: ${snapshot.behavioralInsights?.investmentBehavior?.portfolioRebalancingFrequency === 'regular' ? 'Disciplined rebalancer' : 'Inconsistent rebalancing - consider target-date funds or robo-advisors'}
- Emergency Fund Psychology: ${snapshot.emergencyMonths >= 6 ? 'Strong security mindset - well-prepared for unexpected events' : 'Low emergency fund may indicate optimism bias or cash flow challenges'}
` : ''}

${snapshot.benchmarkData ? `
PEER COMPARISON & BENCHMARKS:
PEER ANALYSIS (${snapshot.benchmarkData.peerComparison.ageGroup}):
- Income Percentile: ${snapshot.benchmarkData.peerComparison.incomePercentile}th percentile
- Net Worth Percentile: ${snapshot.benchmarkData.peerComparison.netWorthPercentile}th percentile  
- Savings Rate Percentile: ${snapshot.benchmarkData.peerComparison.savingsRatePercentile}th percentile
- Asset Allocation vs Peers: ${snapshot.benchmarkData.peerComparison.allocationComparison}

TARGET BENCHMARKS:
- Recommended Emergency Fund: ${snapshot.benchmarkData.targetBenchmarks.recommendedEmergencyFund.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
- Recommended Savings Rate: ${snapshot.benchmarkData.targetBenchmarks.recommendedSavingsRate}%
- Recommended Allocation: ${snapshot.benchmarkData.targetBenchmarks.recommendedAllocation.stocks}% stocks, ${snapshot.benchmarkData.targetBenchmarks.recommendedAllocation.bonds}% bonds, ${snapshot.benchmarkData.targetBenchmarks.recommendedAllocation.cash}% cash

GAP ANALYSIS:
${snapshot.benchmarkData.targetBenchmarks.gapAnalysis.map((gap: any) => 
  `- ${gap.area}: Current ${typeof gap.current === 'number' && gap.area !== 'Savings Rate' && gap.area !== 'Stock Allocation' ? 
    gap.current.toLocaleString('en-US', {style: 'currency', currency: 'USD'}) : 
    gap.current + (gap.area === 'Savings Rate' || gap.area === 'Stock Allocation' ? '%' : '')}, 
    Target ${typeof gap.target === 'number' && gap.area !== 'Savings Rate' && gap.area !== 'Stock Allocation' ? 
    gap.target.toLocaleString('en-US', {style: 'currency', currency: 'USD'}) : 
    gap.target + (gap.area === 'Savings Rate' || gap.area === 'Stock Allocation' ? '%' : '')}, 
    Gap: ${gap.gap > 0 ? '+' : ''}${typeof gap.gap === 'number' && gap.area !== 'Savings Rate' && gap.area !== 'Stock Allocation' ? 
    gap.gap.toLocaleString('en-US', {style: 'currency', currency: 'USD'}) : 
    gap.gap + (gap.area === 'Savings Rate' || gap.area === 'Stock Allocation' ? '%' : '')}`
).join('\n')}
` : ''}

CRITICAL ANALYSIS AREAS (prioritize these based on life stage):

**LIFE STAGE SPECIFIC PRIORITIES:**
${snapshot.age < 35 ? `
EARLY CAREER FOCUS (Ages 20-34):
- High-interest debt elimination (credit cards, student loans >7% APR)
- Emergency fund building (3-6 months expenses)
- Aggressive growth investing (80-90% stocks appropriate)
- Employer 401(k) match maximization (free money first)
- Roth IRA contributions while in lower tax bracket
- Term life insurance if dependents, avoid whole life insurance
` : snapshot.age < 50 ? `
PEAK EARNING YEARS FOCUS (Ages 35-49):
- Maximum retirement contributions (401k, IRA, backdoor Roth if applicable)
- Tax optimization strategies (529 plans, HSA maximization)
- Estate planning documents (will, trust if net worth >$1M)
- College funding vs. retirement trade-off analysis
- Life insurance needs analysis for family protection
- Consider Roth conversions during lower-income years
` : snapshot.age < 60 ? `
PRE-RETIREMENT FOCUS (Ages 50-59):
- Catch-up contributions ($7,500 extra 401k, $1,000 extra IRA)
- Asset allocation shift (reduce risk gradually)
- Healthcare cost planning and HSA maximization
- Long-term care insurance evaluation (premiums lowest now)
- Social Security optimization strategy development
- Tax-efficient withdrawal sequencing planning
` : `
RETIREMENT/LEGACY PHASE (Ages 60+):
- Medicare planning and supplement insurance
- Social Security claiming optimization
- Required Minimum Distribution (RMD) strategies
- Healthcare cost budgeting ($300,000+ lifetime average)
- Estate tax planning and beneficiary optimization
- Long-term care cost protection strategies
`}

1. **Emergency Fund Adequacy**: ${financialMetrics.emergencyFundTargetMonths || 6} months of EXPENSES recommended (NOT income)
   - Current: ${snapshot.emergencyMonths.toFixed(1)} months × $${snapshot.monthlyExpenses.toLocaleString()} = $${(snapshot.emergencyMonths * snapshot.monthlyExpenses).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
   - Target: ${financialMetrics.emergencyFundTargetMonths || 6} months × $${snapshot.monthlyExpenses.toLocaleString()} = ${(snapshot.monthlyExpenses > 0 ? (financialMetrics.emergencyFundTargetMonths || 6) * snapshot.monthlyExpenses : 0).toLocaleString('en-US', {style: 'currency', currency: 'USD'})}
   - Household: ${financialMetrics.isDualEarner ? 'Dual earner (3 months recommended)' : 'Single earner (6 months recommended)'}
2. **Long-Term Care Insurance**: ${!profileData.hasLongTermCareInsurance ? 'CRITICAL PRIORITY - Missing LTC coverage' : 'Covered'}
   - Status: ${profileData.hasLongTermCareInsurance ? 'Protected from LTC costs' : 'Exposed to potentially catastrophic LTC costs'}
   - Risk: ${!profileData.hasLongTermCareInsurance ? 'Average LTC costs $55,000-$108,000 annually, can quickly deplete retirement savings' : 'Protected'}
   - Action: ${!profileData.hasLongTermCareInsurance ? 'Research LTC insurance options, hybrid life/LTC policies, or self-insurance strategies' : 'Review policy annually'}
3. **Debt Strategy**: High-interest debt elimination vs. investing
4. **Insurance Gaps**: Life/disability coverage for income earners
5. **Retirement Readiness**: On-track analysis for ${snapshot.retirementAge} retirement
   - Current Success Probability: ${(dashboardData?.healthScores?.retirement || 0)}% (Target: 80%+)
   - Status: ${(dashboardData?.healthScores?.retirement || 0) >= 80 ? 'On track for confident retirement' : 'NEEDS IMPROVEMENT - Below 80% success probability'}
   - Required Actions: ${(dashboardData?.healthScores?.retirement || 0) < 80 ? 'Visit Retirement Planning section for optimization tools, increase contributions, work longer, reduce expenses, or adjust retirement goals' : 'Maintain current trajectory'}
6. **Tax Optimization**: Current year and long-term strategies
7. **Estate Planning**: Essential documents and beneficiaries
8. **Investment Strategy**: Age-appropriate allocation and diversification
9. **Cash Flow Optimization**: Expense management and income growth
10. **Education Funding**: ${snapshot.hasEducationGoals ? '529 plans and college planning' : 'Not applicable'}
11. **Risk Management**: Comprehensive protection strategy

INSTRUCTIONS:
Generate 8-12 sophisticated, CFP-level personalized financial insights using ALL available data sources. Match the depth and quality of recommendations provided by a Certified Financial Planner. Implement advanced prioritization with quantified impact projections.

**CFP-LEVEL SOPHISTICATION REQUIREMENTS:**
- Integrate multiple data sources (life stage, state tax implications, healthcare costs, Social Security strategy)
- Provide specific dollar impact calculations with compound growth projections
- Consider behavioral psychology and implementation challenges
- Address tax efficiency across multiple time horizons
- Include implementation timeline and monitoring checkpoints
- Reference industry benchmarks and best practices
- Account for sequence of returns risk in retirement planning
- Consider estate and legacy planning implications

PHASE 3-4 ADVANCED ANALYTICS REQUIREMENTS:

**BEHAVIORAL PATTERN INTEGRATION:**
- Use spending trends to identify optimization opportunities
- Reference savings consistency scores for behavioral recommendations  
- Leverage investment behavior patterns for rebalancing advice
- Identify seasonal spending patterns for cash flow planning

**COMPARATIVE BENCHMARKING:**
- Always reference peer percentile standings when making recommendations
- Use gap analysis to quantify specific improvement targets
- Compare current vs. target benchmarks with dollar amounts
- Provide context of where user stands relative to age/income cohorts

**QUANTIFIED IMPACT PROJECTIONS:**
For EVERY recommendation, you must calculate and include:
1. **Dollar Impact**: Specific monetary benefit over time periods (1 year, 5 years, retirement)
2. **Percentage Improvement**: How much this will improve relevant financial health scores
3. **Timeline to Benefit**: When the user will see tangible results
4. **Compounding Effect**: Long-term value if maintained consistently
5. **Risk Mitigation**: Dollar amount of risk reduced or eliminated

**SOPHISTICATED PRIORITIZATION ALGORITHM:**
Use this scoring system to rank recommendations (1=highest priority, 3=lowest):

Priority 1 (Critical - Score 90-100):
- Health scores below 60/100 in any category
- **Retirement Success Probability below 65%** - CRITICAL retirement readiness gap
- Gap analysis showing >$50K shortfall in emergency fund or >10% in savings rate
- Missing critical insurance (LTC, life, disability) with >$100K+ annual impact potential
  NOTE: Only recommend insurance if client doesn't already have it - check hasLifeInsurance, hasDisabilityInsurance flags
- Debt with >7% interest rates totaling >$10K
- Behavioral patterns showing declining savings (>20% drop in contributions)

Priority 2 (Important - Score 70-89):
- Health scores 60-79/100 with clear improvement path
- **Retirement Success Probability 65-79%** - Below 80% target, needs improvement
- Peer benchmarks showing <50th percentile with achievable targets
- Suboptimal asset allocation with >5% allocation gap from target
- Tax optimization opportunities with >$5K annual benefit
- Investment rebalancing with >10% drift from target allocation

Priority 3 (Optimization - Score 50-69):
- Health scores >80/100 with minor enhancements possible
- Peer benchmarks >75th percentile with stretch goal opportunities  
- Fine-tuning existing strategies for marginal improvements
- Estate planning document updates (existing coverage but outdated)
- Advanced tax strategies for high-income situations

**ACCOUNT-SPECIFIC RECOMMENDATIONS:**
When Plaid data is available, be extremely specific:
- "Move $15,000 from your Chase checking (currently $45K) to your Vanguard emergency fund"
- "Increase contributions to your Fidelity 401(k) from $500/month to $750/month" 
- "Rebalance your Charles Schwab IRA: sell $12K bonds, buy $12K stock index funds"
- "Pay off $8,500 Chase credit card (18% APR) using funds from Bank of America savings"

**RETIREMENT SUCCESS IMPROVEMENT STRATEGIES:**
For users with retirement success probability below 80%, you MUST include specific actionable strategies:
- **Visit Retirement Planning Section**: ALWAYS recommend visiting the app's retirement planning section for detailed optimization tools and scenario modeling
- **Increase Contributions**: Calculate exact dollar increases needed in 401(k), IRA, or other retirement accounts
- **Work Longer**: Show impact of working 1-3 additional years on success probability
- **Reduce Expenses**: Identify expense categories that can be reduced to improve cash flow for savings
- **Asset Allocation**: Optimize portfolio for age-appropriate risk/return balance
- **Catch-up Contributions**: For users 50+, recommend catch-up contribution strategies
- **Roth Conversions**: Tax-efficient strategies to reduce future tax burden
- **Social Security Optimization**: Timing strategies for claiming benefits
- **Part-time Income**: Consider part-time work in early retirement to bridge income gaps

**MANDATORY APP NAVIGATION FOR RETIREMENT IMPROVEMENT:**
When retirement success probability is below 80%, you MUST include an action step directing users to:
"Visit the Retirement Planning section of your Affluvia app to access advanced optimization tools, run detailed scenarios, and get personalized recommendations to improve your retirement preparedness from [current]% to 80%+ success probability."

MANDATORY PRIORITY: If Long-Term Care Insurance = "No", you MUST include this as a high priority (priority 1 or 2) insight with detailed action steps:
- Title should mention "Long-Term Care Insurance" or "LTC Planning"
- Category should be "Insurance"
- Include specific cost ranges ($55,000-$108,000 annually)
- Provide 4-5 detailed actionSteps including research, quotes, hybrid policies, timing considerations
- Explain the catastrophic financial risk of going without LTC coverage
- urgencyReason should emphasize the importance regardless of current age

IMPORTANT: Emergency fund calculations must ALWAYS be based on monthly EXPENSES, never income.
- Emergency fund target = months of expenses × monthly expenses
- Example: 6 months × $3,000 monthly expenses = $18,000 (NOT 6 months × $8,000 income = $48,000)

Return ONLY valid JSON with QUANTIFIED IMPACT ANALYSIS:
{
  "insights": [
    {
      "title": "Specific Action Title",
      "description": "Detailed explanation with exact numbers and context",
      "priority": 1-3,
      "category": "Emergency Fund|Debt|Insurance|Retirement|Tax|Estate|Investment|Cash Flow",
      "actionSteps": ["Step 1", "Step 2", "Step 3"],
      "potentialImprovement": 10-50,
      "timeframe": "Immediate|3 months|6 months|1 year",
      "quantifiedImpact": {
        "dollarBenefit1Year": 5000,
        "dollarBenefit5Years": 45000,
        "dollarBenefitRetirement": 180000,
        "healthScoreImprovement": 15,
        "riskReduction": 75000,
        "compoundingValue": 25000
      },
      "benchmarkContext": "Currently 25th percentile, target 75th percentile for age group",
      "accountSpecific": "Move $15K from Chase checking to Vanguard emergency fund",
      "urgencyReason": "Why this matters now"
    }
  ]
}

Analyze this client's situation and provide actionable, prioritized recommendations.`;

  try {
    const text = await chatComplete([
      { role: 'user', content: generationPrompt }
    ], { temperature: 0.7, stream: false });
    
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/({[\s\S]*})/);
      const insightsData = JSON.parse(jsonMatch?.[1] || text);
      
      // Validate and clean insights with Phase 4 quantified impact
      const insights: InsightItem[] = (insightsData.insights || [])
        .slice(0, 12) // Limit to 12 insights max for CFP-level sophistication
        .map((insight: any) => ({
          title: insight.title || "Financial Recommendation",
          description: insight.description || "",
          priority: Math.min(3, Math.max(1, insight.priority || 2)),
          category: insight.category || "General",
          actionSteps: Array.isArray(insight.actionSteps) ? insight.actionSteps.slice(0, 5) : [],
          potentialImprovement: Math.min(50, Math.max(0, insight.potentialImprovement || 0)),
          timeframe: insight.timeframe || "3 months",
          urgencyReason: insight.urgencyReason || "",
          
          // Phase 4: Quantified Impact & Advanced Analysis
          quantifiedImpact: insight.quantifiedImpact ? {
            dollarBenefit1Year: Math.max(0, insight.quantifiedImpact.dollarBenefit1Year || 0),
            dollarBenefit5Years: Math.max(0, insight.quantifiedImpact.dollarBenefit5Years || 0),
            dollarBenefitRetirement: Math.max(0, insight.quantifiedImpact.dollarBenefitRetirement || 0),
            healthScoreImprovement: Math.min(100, Math.max(0, insight.quantifiedImpact.healthScoreImprovement || 0)),
            riskReduction: Math.max(0, insight.quantifiedImpact.riskReduction || 0),
            compoundingValue: Math.max(0, insight.quantifiedImpact.compoundingValue || 0)
          } : undefined,
          benchmarkContext: insight.benchmarkContext || undefined,
          accountSpecific: insight.accountSpecific || undefined
        }))
        .filter((insight: InsightItem) => insight.title && insight.description);

      return {
        insights,
        profileDataHash,
        financialSnapshot: snapshot,
        generationPrompt
      };

    } catch (parseError) {
      console.error("Failed to parse AI insights response:", parseError);
      
      // Fallback insights
      return {
        insights: [{
          title: "Complete Financial Health Assessment",
          description: "Your financial profile has been updated. Our AI analysis will provide personalized recommendations within 24 hours.",
          priority: 2,
          category: "General",
          actionSteps: [
            "Review your updated financial dashboard",
            "Monitor your progress on key metrics",
            "Check back tomorrow for detailed insights"
          ],
          potentialImprovement: 15,
          timeframe: "24 hours",
          urgencyReason: "Ensure all recommendations are current and accurate"
        }],
        profileDataHash,
        financialSnapshot: snapshot,
        generationPrompt
      };
    }

  } catch (error) {
    console.error("Error generating AI insights:", error);
    
    // Fallback insights
    return {
      insights: [{
        title: "Financial Analysis Pending",
        description: "We're analyzing your financial data to provide personalized recommendations. Please check back shortly.",
        priority: 2,
        category: "General",
        actionSteps: [
          "Ensure all financial data is up to date",
          "Review your emergency fund status",
          "Check retirement contribution limits"
        ],
        potentialImprovement: 10,
        timeframe: "1 hour",
        urgencyReason: "Technical processing delay"
      }],
      profileDataHash,
      financialSnapshot: snapshot,
      generationPrompt
    };
  }
}

export function createProfileDataHash(profileData: any, estateDocuments: any[] = []): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      ...profileData,
      estateDocuments: estateDocuments.length,
      timestamp: Math.floor(Date.now() / (1000 * 60 * 60 * 24)) // Daily granularity
    }))
    .digest('hex');
}
