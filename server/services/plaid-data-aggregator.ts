import { db } from '../db';
import { 
  plaidAccounts, 
  plaidInvestmentHoldings,
  plaidLiabilities,
  plaidTransactions,
  plaidAccountMappings,
  plaidAggregatedSnapshot,
  financialProfiles,
  PlaidAccount,
  PlaidAccountMapping,
  PlaidInvestmentHolding,
  PlaidLiability,
  PlaidTransaction
} from '../../shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

/**
 * Account categorization rules based on Plaid account types
 */
const ACCOUNT_CATEGORIZATION_RULES = {
  // Asset categories
  retirement: [
    '401k', '403b', '457', '457b', 'ira', 'roth', 'roth ira', 
    'sep ira', 'simple ira', 'keogh', 'profit sharing',
    'thrift savings plan', 'tsp', '401a', 'pension'
  ],
  investment: [
    'investment', 'brokerage', 'securities', 'stocks',
    'mutual fund', 'etf', 'bonds', 'taxable'
  ],
  education: [
    '529', 'coverdell', 'esa', 'education savings',
    'college savings', 'ugma', 'utma'
  ],
  banking: [
    'checking', 'savings', 'money market', 'cd',
    'cash management', 'prepaid'
  ],
  
  // Liability categories
  credit: ['credit card', 'credit', 'charge card'],
  student: ['student', 'student loan'],
  mortgage: ['mortgage', 'home equity', 'heloc'],
  personal: ['personal', 'personal loan', 'line of credit'],
  auto: ['auto', 'auto loan', 'car loan', 'vehicle']
};

/**
 * Investment type mapping for holdings
 */
const INVESTMENT_TYPE_MAPPING: Record<string, string> = {
  'equity': 'stocks',
  'etf': 'stocks',
  'mutual fund': 'stocks', // Will be refined based on fund type
  'bond': 'bonds',
  'fixed income': 'bonds',
  'cash': 'cash',
  'money market': 'cash',
  'commodity': 'alternatives',
  'cryptocurrency': 'alternatives',
  'derivative': 'alternatives',
  'other': 'alternatives'
};

export class PlaidDataAggregator {
  /**
   * Auto-categorize a Plaid account based on its type and subtype
   */
  static categorizeAccount(account: PlaidAccount): Partial<PlaidAccountMapping> {
    const accountTypeLower = account.accountType?.toLowerCase() || '';
    const accountSubtypeLower = account.accountSubtype?.toLowerCase() || '';
    const accountNameLower = account.accountName?.toLowerCase() || '';
    const officialNameLower = account.officialName?.toLowerCase() || '';
    
    // Combine all text for matching
    const searchText = `${accountTypeLower} ${accountSubtypeLower} ${accountNameLower} ${officialNameLower}`;
    
    let category: 'asset' | 'liability' = 'asset';
    let subcategory = '';
    let isRetirement = false;
    let isEducation = false;
    
    // Determine if asset or liability
    if (accountTypeLower === 'loan' || accountTypeLower === 'credit') {
      category = 'liability';
    } else if (accountTypeLower === 'depository' || accountTypeLower === 'investment') {
      category = 'asset';
    }
    
    // Categorize assets
    if (category === 'asset') {
      // Check for retirement accounts
      for (const term of ACCOUNT_CATEGORIZATION_RULES.retirement) {
        if (searchText.includes(term)) {
          subcategory = 'retirement';
          isRetirement = true;
          break;
        }
      }
      
      // Check for education accounts
      if (!subcategory) {
        for (const term of ACCOUNT_CATEGORIZATION_RULES.education) {
          if (searchText.includes(term)) {
            subcategory = 'education';
            isEducation = true;
            break;
          }
        }
      }
      
      // Check for investment accounts
      if (!subcategory) {
        for (const term of ACCOUNT_CATEGORIZATION_RULES.investment) {
          if (searchText.includes(term) || accountTypeLower === 'investment') {
            subcategory = 'investment';
            break;
          }
        }
      }
      
      // Default to banking for depository accounts
      if (!subcategory && accountTypeLower === 'depository') {
        subcategory = 'banking';
      }
    }
    
    // Categorize liabilities
    if (category === 'liability') {
      // Check for student loans
      for (const term of ACCOUNT_CATEGORIZATION_RULES.student) {
        if (searchText.includes(term)) {
          subcategory = 'student_loan';
          break;
        }
      }
      
      // Check for mortgages
      if (!subcategory) {
        for (const term of ACCOUNT_CATEGORIZATION_RULES.mortgage) {
          if (searchText.includes(term)) {
            subcategory = 'mortgage';
            break;
          }
        }
      }
      
      // Check for auto loans
      if (!subcategory) {
        for (const term of ACCOUNT_CATEGORIZATION_RULES.auto) {
          if (searchText.includes(term)) {
            subcategory = 'auto_loan';
            break;
          }
        }
      }
      
      // Check for credit cards
      if (!subcategory) {
        for (const term of ACCOUNT_CATEGORIZATION_RULES.credit) {
          if (searchText.includes(term) || accountTypeLower === 'credit') {
            subcategory = 'credit_card';
            break;
          }
        }
      }
      
      // Default to personal loan
      if (!subcategory) {
        subcategory = 'personal_loan';
      }
    }
    
    // Check if it might be an emergency fund (high-yield savings)
    const isEmergencyFund = subcategory === 'banking' && 
      (searchText.includes('emergency') || searchText.includes('high yield') || 
       searchText.includes('reserve') || accountSubtypeLower === 'savings');
    
    return {
      category,
      subcategory,
      isRetirementAccount: isRetirement,
      isEducationAccount: isEducation,
      isEmergencyFund,
      includeInCalculations: true
    };
  }

  /**
   * Get complete financial picture combining Plaid and manual data
   */
  static async getUserCompleteFinancialPicture(userId: number) {
    // Fetch all Plaid accounts with mappings
    const plaidAccountsData = await db.select({
      account: plaidAccounts,
      mapping: plaidAccountMappings
    })
    .from(plaidAccounts)
    .leftJoin(plaidAccountMappings, eq(plaidAccounts.id, plaidAccountMappings.plaidAccountId))
    .where(and(
      eq(plaidAccounts.userId, userId),
      eq(plaidAccounts.isActive, true)
    ));
    
    // Fetch manual financial profile
    const [profile] = await db.select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    
    // Fetch investment holdings
    const holdings = await db.select()
      .from(plaidInvestmentHoldings)
      .where(eq(plaidInvestmentHoldings.userId, userId));
    
    // Fetch liabilities
    const liabilities = await db.select()
      .from(plaidLiabilities)
      .where(eq(plaidLiabilities.userId, userId));
    
    // Aggregate Plaid data
    const plaidAssets = {
      checking: 0,
      savings: 0,
      investment: 0,
      retirement: 0,
      emergency: 0,
      education: 0,
      other: 0
    };
    
    const plaidLiabilitiesData = {
      creditCards: 0,
      studentLoans: 0,
      personalLoans: 0,
      mortgage: 0,
      autoLoans: 0,
      other: 0
    };
    
    const accountsByOwner = {
      user: [] as any[],
      spouse: [] as any[],
      joint: [] as any[]
    };
    
    // Process Plaid accounts
    for (const { account, mapping } of plaidAccountsData) {
      if (!account || (mapping && !mapping.includeInCalculations)) continue;
      
      const balance = parseFloat(account.currentBalance || '0');
      const owner = mapping?.owner || 'user';
      const subcategory = mapping?.subcategory || '';
      
      // Add to owner tracking
      accountsByOwner[owner as keyof typeof accountsByOwner].push({
        ...account,
        mapping
      });
      
      // Aggregate assets
      if (account.accountType === 'depository' || account.accountType === 'investment') {
        if (mapping?.isEmergencyFund) {
          plaidAssets.emergency += balance;
        } else if (mapping?.isRetirementAccount || subcategory === 'retirement') {
          plaidAssets.retirement += balance;
        } else if (mapping?.isEducationAccount || subcategory === 'education') {
          plaidAssets.education += balance;
        } else if (subcategory === 'investment') {
          plaidAssets.investment += balance;
        } else if (subcategory === 'banking' || account.accountType === 'depository') {
          // Split banking between checking and savings based on subtype
          if (account.accountSubtype === 'checking') {
            plaidAssets.checking += balance;
          } else if (account.accountSubtype === 'savings') {
            plaidAssets.savings += balance;
          } else {
            // Default to checking for other depository types
            plaidAssets.checking += balance;
          }
        } else {
          plaidAssets.other += balance;
        }
      }
      
      // Aggregate liabilities
      if (account.accountType === 'loan' || account.accountType === 'credit') {
        if (subcategory === 'credit_card') {
          plaidLiabilitiesData.creditCards += balance;
        } else if (subcategory === 'student_loan') {
          plaidLiabilitiesData.studentLoans += balance;
        } else if (subcategory === 'mortgage') {
          plaidLiabilitiesData.mortgage += balance;
        } else if (subcategory === 'auto_loan') {
          plaidLiabilitiesData.autoLoans += balance;
        } else if (subcategory === 'personal_loan') {
          plaidLiabilitiesData.personalLoans += balance;
        } else {
          plaidLiabilitiesData.other += balance;
        }
      }
    }
    
    // Parse manual data from profile
    const manualAssetsArray = Array.isArray(profile?.assets) ? profile.assets : [];
    const manualLiabilitiesArray = Array.isArray(profile?.liabilities) ? profile.liabilities : [];
    
    // Aggregate manual assets
    const manualAssets = {
      checking: 0,
      savings: 0,
      emergencyFund: 0,
      taxableInvestment: 0,
      retirement401k: 0,
      retirementIRA: 0,
      retirementRoth: 0,
      education529: 0,
      realEstate: 0,
      vehicles: 0,
      otherAssets: 0
    };
    
    manualAssetsArray.forEach((asset: any) => {
      const value = parseFloat(asset.value) || 0;
      const type = asset.type?.toLowerCase() || '';
      
      if (type.includes('checking')) manualAssets.checking += value;
      else if (type.includes('savings')) manualAssets.savings += value;
      else if (type.includes('emergency')) manualAssets.emergencyFund += value;
      else if (type.includes('investment') || type.includes('brokerage')) manualAssets.taxableInvestment += value;
      else if (type.includes('401k') || type.includes('403b')) manualAssets.retirement401k += value;
      else if (type.includes('ira') && !type.includes('roth')) manualAssets.retirementIRA += value;
      else if (type.includes('roth')) manualAssets.retirementRoth += value;
      else if (type.includes('529') || type.includes('education')) manualAssets.education529 += value;
      else if (type.includes('real estate') || type.includes('property')) manualAssets.realEstate += value;
      else if (type.includes('vehicle') || type.includes('car')) manualAssets.vehicles += value;
      else manualAssets.otherAssets += value;
    });
    
    // Aggregate manual liabilities similarly
    const manualLiabilities = {
      creditCards: 0,
      studentLoans: 0,
      personalLoans: 0,
      mortgage: 0,
      autoLoans: 0,
      otherDebts: 0
    };
    
    manualLiabilitiesArray.forEach((liability: any) => {
      const balance = parseFloat(liability.balance) || 0;
      const type = liability.type?.toLowerCase() || '';
      
      if (type.includes('credit card')) manualLiabilities.creditCards += balance;
      else if (type.includes('student')) manualLiabilities.studentLoans += balance;
      else if (type.includes('personal')) manualLiabilities.personalLoans += balance;
      else if (type.includes('mortgage')) manualLiabilities.mortgage += balance;
      else if (type.includes('auto') || type.includes('car')) manualLiabilities.autoLoans += balance;
      else manualLiabilities.otherDebts += balance;
    });
    
    // Merge Plaid and manual data
    const totalAssets = {
      checking: plaidAssets.checking + manualAssets.checking,
      savings: plaidAssets.savings + manualAssets.savings,
      emergencyFund: plaidAssets.emergency + manualAssets.emergencyFund,
      
      // Investments
      taxableInvestment: plaidAssets.investment + manualAssets.taxableInvestment,
      retirement401k: plaidAssets.retirement + manualAssets.retirement401k,
      retirementIRA: manualAssets.retirementIRA,
      retirementRoth: manualAssets.retirementRoth,
      
      // Education
      education529: plaidAssets.education + manualAssets.education529,
      
      // Other assets
      realEstate: manualAssets.realEstate,
      vehicles: manualAssets.vehicles,
      otherAssets: manualAssets.otherAssets + plaidAssets.other
    };
    
    const totalLiabilities = {
      creditCards: plaidLiabilitiesData.creditCards + manualLiabilities.creditCards,
      studentLoans: plaidLiabilitiesData.studentLoans + manualLiabilities.studentLoans,
      personalLoans: plaidLiabilitiesData.personalLoans + manualLiabilities.personalLoans,
      mortgage: plaidLiabilitiesData.mortgage + manualLiabilities.mortgage,
      autoLoans: plaidLiabilitiesData.autoLoans + manualLiabilities.autoLoans,
      otherDebts: plaidLiabilitiesData.other + manualLiabilities.otherDebts
    };
    
    // Calculate totals
    const totalAssetsValue = Object.values(totalAssets).reduce((sum, val) => sum + val, 0);
    const totalLiabilitiesValue = Object.values(totalLiabilities).reduce((sum, val) => sum + val, 0);
    const netWorth = totalAssetsValue - totalLiabilitiesValue;
    
    // Calculate investment allocation from holdings
    const allocation = await this.calculateInvestmentAllocation(holdings);
    
    // Calculate ownership split
    const ownershipSplit = {
      user: accountsByOwner.user.reduce((sum, acc) => 
        sum + parseFloat(acc.currentBalance || '0'), 0),
      spouse: accountsByOwner.spouse.reduce((sum, acc) => 
        sum + parseFloat(acc.currentBalance || '0'), 0),
      joint: accountsByOwner.joint.reduce((sum, acc) => 
        sum + parseFloat(acc.currentBalance || '0'), 0)
    };
    
    return {
      plaidAccounts: plaidAccountsData,
      manualProfile: profile,
      assets: totalAssets,
      liabilities: totalLiabilities,
      totals: {
        totalAssets: totalAssetsValue,
        totalLiabilities: totalLiabilitiesValue,
        netWorth
      },
      allocation,
      ownershipSplit,
      dataSources: {
        plaid: plaidAccountsData.length > 0,
        manual: profile !== null
      }
    };
  }

  /**
   * Calculate investment allocation from holdings
   */
  static async calculateInvestmentAllocation(holdings: PlaidInvestmentHolding[]) {
    const allocation = {
      stocks: 0,
      bonds: 0,
      cash: 0,
      alternatives: 0,
      total: 0
    };
    
    for (const holding of holdings) {
      const value = parseFloat(holding.value || '0');
      const type = holding.type?.toLowerCase() || '';
      const mappedType = INVESTMENT_TYPE_MAPPING[type] || 'alternatives';
      
      allocation[mappedType as keyof typeof allocation] += value;
      allocation.total += value;
    }
    
    // Calculate percentages
    const percentages = {
      stocks: allocation.total > 0 ? (allocation.stocks / allocation.total * 100) : 0,
      bonds: allocation.total > 0 ? (allocation.bonds / allocation.total * 100) : 0,
      cash: allocation.total > 0 ? (allocation.cash / allocation.total * 100) : 0,
      alternatives: allocation.total > 0 ? (allocation.alternatives / allocation.total * 100) : 0
    };
    
    return {
      amounts: allocation,
      percentages
    };
  }

  /**
   * Calculate monthly cash flow from transactions
   */
  static async calculateMonthlyCashFlow(userId: number, monthsToAnalyze = 3) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsToAnalyze);
    
    const transactions = await db.select()
      .from(plaidTransactions)
      .where(and(
        eq(plaidTransactions.userId, userId),
        gte(plaidTransactions.date, startDate),
        eq(plaidTransactions.pending, false)
      ));
    
    const monthlyData: Record<string, { income: number; expenses: number }> = {};
    
    for (const transaction of transactions) {
      const amount = parseFloat(transaction.amount || '0');
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0 };
      }
      
      // Plaid amounts are positive for debits (expenses) and negative for credits (income)
      if (amount > 0) {
        monthlyData[monthKey].expenses += amount;
      } else {
        monthlyData[monthKey].income += Math.abs(amount);
      }
    }
    
    // Calculate averages
    const months = Object.values(monthlyData);
    const avgIncome = months.reduce((sum, m) => sum + m.income, 0) / Math.max(months.length, 1);
    const avgExpenses = months.reduce((sum, m) => sum + m.expenses, 0) / Math.max(months.length, 1);
    
    return {
      monthlyAverage: {
        income: avgIncome,
        expenses: avgExpenses,
        netCashFlow: avgIncome - avgExpenses
      },
      monthlyBreakdown: monthlyData,
      monthsAnalyzed: months.length
    };
  }

  /**
   * Create or update aggregated snapshot
   */
  static async createAggregatedSnapshot(userId: number) {
    // Get complete financial picture
    const financialData = await this.getUserCompleteFinancialPicture(userId);
    
    // Calculate cash flow
    const cashFlow = await this.calculateMonthlyCashFlow(userId);
    
    // Get liability details
    const liabilities = await db.select()
      .from(plaidLiabilities)
      .where(eq(plaidLiabilities.userId, userId));
    
    // Aggregate liability data
    const liabilityBreakdown = {
      creditCardDebt: 0,
      studentLoans: 0,
      personalLoans: 0,
      mortgageDebt: 0,
      otherDebt: 0
    };
    
    for (const liability of liabilities) {
      const balance = parseFloat(liability.currentBalance || '0');
      const type = liability.liabilityType?.toLowerCase() || '';
      
      if (type === 'credit_card') {
        liabilityBreakdown.creditCardDebt += balance;
      } else if (type === 'student_loan') {
        liabilityBreakdown.studentLoans += balance;
      } else if (type === 'mortgage') {
        liabilityBreakdown.mortgageDebt += balance;
      } else if (type.includes('personal')) {
        liabilityBreakdown.personalLoans += balance;
      } else {
        liabilityBreakdown.otherDebt += balance;
      }
    }
    
    // Create snapshot
    const snapshot = {
      userId,
      totalAssets: financialData.totals.totalAssets.toString(),
      totalLiabilities: financialData.totals.totalLiabilities.toString(),
      netWorth: financialData.totals.netWorth.toString(),
      
      // Asset breakdown
      bankingAssets: (financialData.assets.checking + financialData.assets.savings).toString(),
      investmentAssets: financialData.assets.taxableInvestment.toString(),
      retirementAssets: (financialData.assets.retirement401k + 
                        financialData.assets.retirementIRA + 
                        financialData.assets.retirementRoth).toString(),
      emergencyFunds: financialData.assets.emergencyFund.toString(),
      educationFunds: financialData.assets.education529.toString(),
      
      // Liability breakdown
      ...Object.fromEntries(
        Object.entries(liabilityBreakdown).map(([key, val]) => [key, val.toString()])
      ),
      
      // Cash flow
      monthlyIncome: cashFlow.monthlyAverage.income.toString(),
      monthlyExpenses: cashFlow.monthlyAverage.expenses.toString(),
      monthlyNetCashFlow: cashFlow.monthlyAverage.netCashFlow.toString(),
      
      // Investment allocation (omit per-env columns; store in metadata if needed)
      
      // Ownership split
      userAssets: financialData.ownershipSplit.user.toString(),
      spouseAssets: financialData.ownershipSplit.spouse.toString(),
      jointAssets: financialData.ownershipSplit.joint.toString(),
      
      // Metadata
      dataSources: financialData.dataSources
    };
    
    // Insert snapshot
    await db.insert(plaidAggregatedSnapshot).values(snapshot);
    
    return snapshot;
  }

  /**
   * Get latest snapshot or create if stale
   */
  static async getLatestSnapshot(userId: number, maxAgeHours = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
    
    const [latest] = await db.select({
        id: plaidAggregatedSnapshot.id,
        userId: plaidAggregatedSnapshot.userId,
        snapshotDate: plaidAggregatedSnapshot.snapshotDate,
        totalAssets: plaidAggregatedSnapshot.totalAssets,
        totalLiabilities: plaidAggregatedSnapshot.totalLiabilities,
        netWorth: plaidAggregatedSnapshot.netWorth,
        bankingAssets: plaidAggregatedSnapshot.bankingAssets,
        investmentAssets: plaidAggregatedSnapshot.investmentAssets,
        retirementAssets: plaidAggregatedSnapshot.retirementAssets,
        educationFunds: plaidAggregatedSnapshot.educationFunds,
        creditCardDebt: plaidAggregatedSnapshot.creditCardDebt,
        studentLoans: plaidAggregatedSnapshot.studentLoans,
        personalLoans: plaidAggregatedSnapshot.personalLoans,
        mortgageDebt: plaidAggregatedSnapshot.mortgageDebt,
        otherDebt: plaidAggregatedSnapshot.otherDebt,
        monthlyIncome: plaidAggregatedSnapshot.monthlyIncome,
        monthlyExpenses: plaidAggregatedSnapshot.monthlyExpenses,
        monthlyNetCashFlow: plaidAggregatedSnapshot.monthlyNetCashFlow,
      })
      .from(plaidAggregatedSnapshot)
      .where(and(
        eq(plaidAggregatedSnapshot.userId, userId),
        gte(plaidAggregatedSnapshot.snapshotDate, cutoffTime)
      ))
      .orderBy(desc(plaidAggregatedSnapshot.snapshotDate))
      .limit(1);
    
    if (latest) {
      // Normalize environment differences via adapter
      return this.plaidSnapshotAdapter(latest as any);
    }
    
    // Create new snapshot if none exists or is stale
    return await this.createAggregatedSnapshot(userId);
  }

  /**
   * Adapter to normalize plaid_aggregated_snapshot rows across environments.
   */
  static plaidSnapshotAdapter(row: any) {
    if (!row) return row;
    // Prefer provided fields; map alternates if missing
    row.accountCount = row.accountCount ?? row.accountsCount ?? undefined;
    // Normalize monthly net cash flow naming
    row.monthlyNetCashFlow = row.monthlyNetCashFlow ?? row.monthlyCashFlow ?? row.monthly_net_cash_flow ?? undefined;
    return row;
  }

  /**
   * Auto-categorize newly linked accounts
   */
  static async autoCategorizeNewAccounts(userId: number) {
    // Get accounts without mappings
    const unmappedAccounts = await db.select()
      .from(plaidAccounts)
      .leftJoin(plaidAccountMappings, eq(plaidAccounts.id, plaidAccountMappings.plaidAccountId))
      .where(and(
        eq(plaidAccounts.userId, userId),
        eq(plaidAccounts.isActive, true),
        sql`${plaidAccountMappings.id} IS NULL`
      ));
    
    for (const { plaid_accounts: account } of unmappedAccounts) {
      if (!account) continue;
      
      const categorization = this.categorizeAccount(account);
      
      await db.insert(plaidAccountMappings).values({
        userId,
        plaidAccountId: account.id,
        ...categorization
      });
    }
    
    return unmappedAccounts.length;
  }

  /**
   * Get accounts by category for specific calculations
   */
  static async getAccountsByCategory(userId: number, category?: string, subcategory?: string) {
    let query = db.select({
      account: plaidAccounts,
      mapping: plaidAccountMappings
    })
    .from(plaidAccounts)
    .leftJoin(plaidAccountMappings, eq(plaidAccounts.id, plaidAccountMappings.plaidAccountId))
    .where(and(
      eq(plaidAccounts.userId, userId),
      eq(plaidAccounts.isActive, true)
    ));
    
    const conditions = [
      eq(plaidAccounts.userId, userId),
      eq(plaidAccounts.isActive, true)
    ];
    
    if (category) {
      conditions.push(eq(plaidAccountMappings.category, category));
    }
    
    if (subcategory) {
      conditions.push(eq(plaidAccountMappings.subcategory, subcategory));
    }
    
    return await db.select({
      account: plaidAccounts,
      mapping: plaidAccountMappings
    })
    .from(plaidAccounts)
    .leftJoin(plaidAccountMappings, eq(plaidAccounts.id, plaidAccountMappings.plaidAccountId))
    .where(and(...conditions));
  }

  /**
   * Get retirement-specific account data
   */
  static async getRetirementAccounts(userId: number) {
    const accounts = await db.select({
      account: plaidAccounts,
      mapping: plaidAccountMappings
    })
    .from(plaidAccounts)
    .leftJoin(plaidAccountMappings, eq(plaidAccounts.id, plaidAccountMappings.plaidAccountId))
    .where(and(
      eq(plaidAccounts.userId, userId),
      eq(plaidAccounts.isActive, true),
      eq(plaidAccountMappings.isRetirementAccount, true)
    ));
    
    const breakdown = {
      traditional401k: 0,
      roth401k: 0,
      traditionalIRA: 0,
      rothIRA: 0,
      other403b: 0,
      pension: 0,
      total: 0
    };
    
    for (const { account, mapping } of accounts) {
      if (!account) continue;
      
      const balance = parseFloat(account.currentBalance || '0');
      const nameLower = (account.accountName || '').toLowerCase();
      const officialLower = (account.officialName || '').toLowerCase();
      const searchText = `${nameLower} ${officialLower}`;
      
      if (searchText.includes('roth')) {
        if (searchText.includes('401')) {
          breakdown.roth401k += balance;
        } else {
          breakdown.rothIRA += balance;
        }
      } else if (searchText.includes('401')) {
        breakdown.traditional401k += balance;
      } else if (searchText.includes('ira')) {
        breakdown.traditionalIRA += balance;
      } else if (searchText.includes('403') || searchText.includes('457')) {
        breakdown.other403b += balance;
      } else if (searchText.includes('pension')) {
        breakdown.pension += balance;
      }
      
      breakdown.total += balance;
    }
    
    return {
      accounts,
      breakdown
    };
  }

  /**
   * Get 529 education savings accounts
   */
  static async get529Accounts(userId: number): Promise<PlaidAccount[]> {
    try {
      // Get all investment accounts that are categorized as education accounts
      const educationAccounts = await db
        .select({
          account: plaidAccounts,
          mapping: plaidAccountMappings
        })
        .from(plaidAccounts)
        .leftJoin(
          plaidAccountMappings,
          eq(plaidAccounts.id, plaidAccountMappings.plaidAccountId)
        )
        .where(
          and(
            eq(plaidAccounts.userId, userId),
            eq(plaidAccountMappings.subcategory, 'education')
          )
        );

      // Also get accounts that explicitly mention 529 in their name
      const all529Accounts = await db
        .select()
        .from(plaidAccounts)
        .where(
          and(
            eq(plaidAccounts.userId, userId),
            sql`LOWER(${plaidAccounts.accountName}) LIKE '%529%' 
                OR LOWER(${plaidAccounts.accountName}) LIKE '%education%' 
                OR LOWER(${plaidAccounts.accountName}) LIKE '%college%'
                OR LOWER(${plaidAccounts.accountName}) LIKE '%coverdell%'
                OR LOWER(${plaidAccounts.accountName}) LIKE '%esa%'`
          )
        );

      // Combine and deduplicate
      const accountMap = new Map<number, PlaidAccount>();
      
      educationAccounts.forEach(({ account }) => {
        if (account) accountMap.set(account.id, account);
      });
      
      all529Accounts.forEach(account => {
        accountMap.set(account.id, account);
      });

      return Array.from(accountMap.values());
    } catch (error) {
      console.error('Error fetching 529 accounts:', error);
      return [];
    }
  }

  /**
   * Detect recurring 529 contributions from transactions
   */
  static async detect529Contributions(userId: number): Promise<number> {
    try {
      // Get 529 accounts
      const educationAccounts = await this.get529Accounts(userId);
      if (educationAccounts.length === 0) return 0;

      const accountIds = educationAccounts.map(acc => acc.id);
      
      // Get last 3 months of transactions for these accounts
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const contributions = await db
        .select()
        .from(plaidTransactions)
        .where(
          and(
            eq(plaidTransactions.userId, userId),
            sql`${plaidTransactions.plaidAccountId} IN (${sql.join(accountIds, sql`, `)})`,
            gte(plaidTransactions.date, threeMonthsAgo),
            // Look for deposits/contributions (negative amounts in Plaid mean money coming in)
            sql`${plaidTransactions.amount} < 0`
          )
        )
        .orderBy(desc(plaidTransactions.date));

      if (contributions.length === 0) return 0;

      // Analyze transaction patterns to detect recurring contributions
      const monthlyContributions: { [key: string]: number[] } = {};
      
      contributions.forEach(tx => {
        const month = tx.date instanceof Date
          ? tx.date.toISOString().slice(0, 7)
          : String(tx.date).slice(0, 7); // YYYY-MM
        if (month) {
          if (!monthlyContributions[month]) {
            monthlyContributions[month] = [];
          }
          // Convert to positive amount (Plaid uses negative for deposits)
          monthlyContributions[month].push(Math.abs(tx.amount));
        }
      });

      // Calculate average monthly contribution
      const monthlyTotals = Object.values(monthlyContributions).map(
        amounts => amounts.reduce((sum, amt) => sum + amt, 0)
      );

      if (monthlyTotals.length === 0) return 0;

      // Return average monthly contribution
      const averageMonthly = monthlyTotals.reduce((sum, amt) => sum + amt, 0) / monthlyTotals.length;
      
      return Math.round(averageMonthly);
    } catch (error) {
      console.error('Error detecting 529 contributions:', error);
      return 0;
    }
  }
}

export default PlaidDataAggregator;
