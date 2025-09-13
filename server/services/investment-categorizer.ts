import { PlaidApi, Security, Holding } from 'plaid';
import { db } from '../db';
import { plaidItems, plaidAccounts, financialProfiles } from '../../shared/schema';
import { eq, and, inArray, or } from 'drizzle-orm';
import PlaidConfig from '../config/plaid-config';
import { EncryptionService } from './encryption-service';

// Initialize Plaid client
const configuration = PlaidConfig.getConfiguration();
const plaidClient = new PlaidApi(configuration);

/**
 * Asset categorization following CFP (Certified Financial Planner) and 
 * RIA (Registered Investment Advisor) industry conventions:
 * 
 * STOCKS: Core U.S. and international equity
 * - US large-cap, mid-cap, small-cap stocks
 * - International developed and emerging market equities
 * - Equity ETFs and mutual funds
 * - Individual company stocks
 * 
 * BONDS: Fixed income securities
 * - US Treasuries (bills, notes, bonds)
 * - Corporate bonds (investment grade and high yield)
 * - Municipal bonds
 * - International bonds
 * - Bond ETFs and mutual funds
 * 
 * CASH: Highly liquid, stable value assets
 * - Money market funds
 * - Bank savings and checking accounts
 * - CDs (Certificates of Deposit)
 * - Cash management accounts
 * 
 * ALTERNATIVES: Non-traditional investments
 * - REITs (Real Estate Investment Trusts)
 * - Commodities (gold, silver, oil, agriculture)
 * - Cryptocurrency
 * - Hedge funds and managed futures
 * - Private equity and venture capital
 * - Infrastructure funds
 * - Derivatives and options
 */
export type AssetCategory = 'stocks' | 'bonds' | 'cash' | 'alternatives';

export interface PortfolioAllocation {
  stocks: number;
  bonds: number;
  cash: number;
  alternatives: number;
}

export interface OwnerBasedAllocation {
  User: PortfolioAllocation;
  Spouse: PortfolioAllocation;
  Joint: PortfolioAllocation;
  Total: PortfolioAllocation;
}

export interface CategorizedHolding {
  accountId: string;
  securityId: string;
  symbol: string | null;
  name: string;
  quantity: number;
  value: number;
  category: AssetCategory;
  owner: 'User' | 'Spouse' | 'Joint';
  accountName: string | null;
  accountType: string | null;
  accountSubtype: string | null;
}

// Investment account subtypes to include
const INVESTMENT_SUBTYPES = [
  // Retirement accounts
  '401a', '401k', '403b', '457b', 'ira', 'roth', 'roth_401k',
  'sep_ira', 'simple_ira', 'keogh', 'pension', 'profit_sharing_plan',
  'retirement', 'sarsep', 'lira', 'lrsp', 'rrif', 'rrsp', 'sipp',
  
  // Taxable investment
  'brokerage', 'non_taxable_brokerage_account', 'stock_plan',
  'mutual_fund', 'trust', 'money_market', 'cash_management',
  
  // Education & health
  '529', 'education_savings_account', 'hsa', 'ugma', 'utma',
  
  // Annuities & other
  'variable_annuity', 'fixed_annuity', 'other_annuity',
  'crypto_exchange', 'non_custodial_wallet', 'gic'
];

export class InvestmentCategorizer {
  /**
   * Fetch and categorize investment holdings for a user
   */
  static async fetchAndCategorizeHoldings(
    userId: number,
    enableDebugLogging: boolean = false
  ): Promise<{
    holdings: CategorizedHolding[];
    allocation: OwnerBasedAllocation;
    totalValue: number;
    accountCount: number;
    debug?: any;
  }> {
    try {
      console.log(`[InvestmentCategorizer] Starting holdings fetch for user ${userId}`);
      
      // Get financial profile for user/spouse names
      const [profile] = await db.select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, userId))
        .limit(1);
      
      const userFirstName = profile?.firstName?.toLowerCase();
      const spouseFirstName = profile?.spouseName?.split(' ')[0]?.toLowerCase();
      
      // Get all active Plaid items for the user
      const items = await db.select()
        .from(plaidItems)
        .where(and(
          eq(plaidItems.userId, userId),
          eq(plaidItems.status, 'active')
        ));
      
      if (items.length === 0) {
        console.log('[InvestmentCategorizer] No connected Plaid accounts found');
        return {
          holdings: [],
          allocation: this.getEmptyAllocation(),
          totalValue: 0,
          accountCount: 0
        };
      }
      
      // Get investment accounts
      const itemIds = items.map(item => item.id);
      const accounts = await db.select()
        .from(plaidAccounts)
        .where(and(
          inArray(plaidAccounts.plaidItemId, itemIds),
          or(
            eq(plaidAccounts.accountType, 'investment'),
            eq(plaidAccounts.accountType, 'brokerage'),
            inArray(plaidAccounts.accountSubtype, INVESTMENT_SUBTYPES)
          )
        ));
      
      console.log(`[InvestmentCategorizer] Found ${accounts.length} investment accounts`);
      
      const allHoldings: CategorizedHolding[] = [];
      
      // Fetch holdings for each item
      for (const item of items) {
        try {
          const itemAccounts = accounts.filter(acc => acc.plaidItemId === item.id);
          if (itemAccounts.length === 0) continue;
          
          const decryptedAccessToken = EncryptionService.decrypt(item.accessToken);
          
          console.log(`[InvestmentCategorizer] Fetching holdings for item ${item.id}`);
          
          // Fetch investment holdings
          const holdingsResponse = await plaidClient.investmentsHoldingsGet({
            access_token: decryptedAccessToken,
            options: {
              account_ids: itemAccounts.map(acc => acc.accountId)
            }
          });
          
          const { holdings, securities } = holdingsResponse.data;
          
          // Create security map for quick lookup
          const securityMap = new Map<string, Security>();
          securities.forEach(security => {
            securityMap.set(security.security_id, security);
          });
          
          // Try to get identity data for owner names
          let identityData: any = null;
          try {
            const identityResponse = await plaidClient.identityGet({
              access_token: decryptedAccessToken,
              options: {
                account_ids: itemAccounts.map(acc => acc.accountId)
              }
            });
            identityData = identityResponse.data;
          } catch (error) {
            console.log('[InvestmentCategorizer] Identity data not available');
          }
          
          // Process each holding
          for (const holding of holdings) {
            const security = securityMap.get(holding.security_id);
            if (!security) continue;
            
            const account = itemAccounts.find(acc => acc.accountId === holding.account_id);
            const value = (holding.institution_value || 0);
            
            // Skip holdings with zero or negative value
            if (value <= 0) continue;
            
            // Determine owner
            const owner = this.determineOwner(
              account,
              identityData,
              userFirstName,
              spouseFirstName
            );
            
            // Categorize the security
            const category = this.categorizeSecurity(security);
            
            allHoldings.push({
              accountId: holding.account_id,
              securityId: security.security_id,
              symbol: security.ticker_symbol || security.symbol || null,
              name: security.name || 'Unknown Security',
              quantity: holding.quantity || 0,
              value,
              category,
              owner,
              accountName: account?.accountName || null,
              accountType: account?.accountType || null,
              accountSubtype: account?.accountSubtype || null
            });
          }
          
        } catch (error: any) {
          console.error(`[InvestmentCategorizer] Error fetching holdings for item ${item.id}:`, error);
          // Continue with other items
        }
      }
      
      console.log(`[InvestmentCategorizer] Categorized ${allHoldings.length} holdings`);
      
      // Calculate allocation percentages
      const allocation = this.calculateAllocation(allHoldings);
      const totalValue = allHoldings.reduce((sum, h) => sum + h.value, 0);
      
      // Debug information if requested
      let debug = undefined;
      if (enableDebugLogging) {
        const categoryBreakdown = {
          stocks: allHoldings.filter(h => h.category === 'stocks').map(h => ({ 
            symbol: h.symbol, 
            name: h.name, 
            value: h.value 
          })),
          bonds: allHoldings.filter(h => h.category === 'bonds').map(h => ({ 
            symbol: h.symbol, 
            name: h.name, 
            value: h.value 
          })),
          cash: allHoldings.filter(h => h.category === 'cash').map(h => ({ 
            symbol: h.symbol, 
            name: h.name, 
            value: h.value 
          })),
          alternatives: allHoldings.filter(h => h.category === 'alternatives').map(h => ({ 
            symbol: h.symbol, 
            name: h.name, 
            value: h.value 
          }))
        };
        
        const categoryTotals = {
          stocks: allHoldings.filter(h => h.category === 'stocks').reduce((sum, h) => sum + h.value, 0),
          bonds: allHoldings.filter(h => h.category === 'bonds').reduce((sum, h) => sum + h.value, 0),
          cash: allHoldings.filter(h => h.category === 'cash').reduce((sum, h) => sum + h.value, 0),
          alternatives: allHoldings.filter(h => h.category === 'alternatives').reduce((sum, h) => sum + h.value, 0)
        };
        
        debug = {
          categoryBreakdown,
          categoryTotals,
          totalValue,
          rawPercentages: {
            stocks: (categoryTotals.stocks / totalValue * 100).toFixed(2),
            bonds: (categoryTotals.bonds / totalValue * 100).toFixed(2),
            cash: (categoryTotals.cash / totalValue * 100).toFixed(2),
            alternatives: (categoryTotals.alternatives / totalValue * 100).toFixed(2)
          },
          normalizedPercentages: allocation.Total
        };
        
        console.log('[InvestmentCategorizer] Debug - Category Totals:', categoryTotals);
        console.log('[InvestmentCategorizer] Debug - Raw Percentages:', debug.rawPercentages);
        console.log('[InvestmentCategorizer] Debug - Normalized Percentages:', allocation.Total);
      }
      
      return {
        holdings: allHoldings,
        allocation,
        totalValue,
        accountCount: accounts.length,
        debug
      };
      
    } catch (error) {
      console.error('[InvestmentCategorizer] Error in fetchAndCategorizeHoldings:', error);
      throw error;
    }
  }
  
  /**
   * Categorize a security into asset classes following CFP/RIA conventions
   * 
   * CFP/RIA Industry Standard Categories:
   * - Stocks: Core U.S. and international equity
   * - Bonds: Treasuries, corporates, municipals, etc.
   * - Cash: Money market funds, bank deposits
   * - Alternatives: REITs, commodities, hedge funds, private equity, crypto, etc.
   */
  private static categorizeSecurity(security: Security): AssetCategory {
    const type = security.type?.toLowerCase();
    const name = security.name?.toLowerCase() || '';
    const symbol = security.ticker_symbol?.toLowerCase() || security.symbol?.toLowerCase() || '';
    
    // === CASH (CFP: Money market funds, bank deposits) ===
    // Check first as these are most specific
    if (type === 'cash' || 
        name.includes('money market') || 
        name.includes('cash management') ||
        name.includes('bank deposit') ||
        symbol.match(/vmfxx|spaxx|fzfxx|swvxx|vmmxx/i)) {
      return 'cash';
    }
    
    // === BONDS (CFP: Treasuries, corporates, municipals, etc.) ===
    // Fixed income securities
    if (type === 'fixed income' || type === 'fixed_income') {
      return 'bonds';
    }
    
    // Bond ETFs and mutual funds - check patterns before general ETF categorization
    if (name.match(/bond|treasury|fixed income|corporate debt|government|municipal|muni|tips|aggregate|credit/i) ||
        symbol.match(/bnd|agg|tlt|ief|tip|lqd|hyg|jnk|mub|vcsh|vcit|vclt|bndx|igov|emb/i)) {
      return 'bonds';
    }
    
    // === ALTERNATIVES (CFP: REITs, commodities, hedge funds, private equity, crypto) ===
    // Must check BEFORE defaulting ETFs/mutual funds to stocks
    
    // Cryptocurrency
    if (type === 'cryptocurrency' || 
        name.includes('bitcoin') || 
        name.includes('ethereum') ||
        symbol.match(/btc|eth|gbtc/i)) {
      return 'alternatives';
    }
    
    // Derivatives and options
    if (type === 'derivative' || type === 'option' || type === 'future') {
      return 'alternatives';
    }
    
    // REITs (Real Estate Investment Trusts)
    if (name.match(/reit|real estate/i) || 
        symbol.match(/vnq|vgslx|xlre|rem|rwt|iyr|schh|usrt|frel|reet/i)) {
      return 'alternatives';
    }
    
    // Commodities (including precious metals)
    if (name.match(/gold|silver|commodity|metal|oil|gas|agriculture|natural resources/i) || 
        symbol.match(/gld|slv|dbc|pdbc|iau|sgol|pall|pplt|dja|corn|weat|soyb|uso|ung|gsg/i)) {
      return 'alternatives';
    }
    
    // Hedge fund and alternative strategy funds
    if (name.match(/hedge|absolute return|market neutral|long.short|arbitrage|managed futures|private equity/i) ||
        symbol.match(/qai|mna|ftls|btal|rpar|dbmf/i)) {
      return 'alternatives';
    }
    
    // Infrastructure funds (considered alternatives in CFP practice)
    if (name.match(/infrastructure/i) || symbol.match(/ifra|nfra|pave/i)) {
      return 'alternatives';
    }
    
    // === STOCKS (CFP: Core U.S. and international equity) ===
    // International equity ETFs and funds
    if (name.match(/international|emerging market|foreign|global equity|world stock/i) ||
        symbol.match(/vxus|vtiax|veu|iefa|ixus|schf|efa|iemg|vwo|eem|fm/i)) {
      return 'stocks';
    }
    
    // U.S. equity - sector funds, index funds, individual stocks
    if (name.match(/s&p|nasdaq|dow|russell|equity|stock|growth|value|dividend|technology|healthcare|financial/i) ||
        symbol.match(/spy|voo|ivv|vti|qqq|dia|iwm|vtv|vug|vb|vo|schx|schb|schg|schv/i)) {
      return 'stocks';
    }
    
    // Direct equity securities
    if (type === 'equity' || type === 'stock') {
      return 'stocks';
    }
    
    // Mutual funds and ETFs default to stocks ONLY after all other checks
    // This follows CFP convention: most mutual funds/ETFs are equity unless specifically bonds/alternatives
    if (type === 'mutual fund' || type === 'etf') {
      // Do one final check for mixed/balanced funds
      if (name.includes('balanced') || name.includes('allocation') || name.includes('target date')) {
        // For balanced funds, default to stocks (they're usually 60/40 or similar)
        // In practice, these should be broken down, but we'll categorize as stocks
        return 'stocks';
      }
      return 'stocks';
    }
    
    // Default anything unrecognized to alternatives (conservative approach per CFP standards)
    // This includes private placements, limited partnerships, etc.
    return 'alternatives';
  }
  
  /**
   * Determine account owner based on identity data and account info
   */
  private static determineOwner(
    account: any,
    identityData: any,
    userFirstName?: string,
    spouseFirstName?: string
  ): 'User' | 'Spouse' | 'Joint' {
    if (!account) return 'User';
    
    // Check account name patterns
    const accountName = account.accountName?.toLowerCase() || '';
    if (accountName.includes('joint')) {
      return 'Joint';
    }
    
    // Try identity data if available
    if (identityData && identityData.accounts) {
      const identityAccount = identityData.accounts.find(
        (acc: any) => acc.account_id === account.accountId
      );
      
      if (identityAccount && identityAccount.owners) {
        const ownerNames = identityAccount.owners
          .flatMap((owner: any) => owner.names || [])
          .join(' ')
          .toLowerCase();
        
        const hasUser = userFirstName && ownerNames.includes(userFirstName);
        const hasSpouse = spouseFirstName && ownerNames.includes(spouseFirstName);
        
        if (hasUser && hasSpouse) return 'Joint';
        if (hasSpouse && !hasUser) return 'Spouse';
      }
    }
    
    // Check if account name contains spouse name
    if (spouseFirstName && accountName.includes(spouseFirstName)) {
      return 'Spouse';
    }
    
    // Default to User
    return 'User';
  }
  
  /**
   * Normalize allocation to ensure it sums to exactly 100%
   * Adjusts cash allocation when total exceeds 100% due to rounding
   */
  private static normalizeAllocation(allocation: PortfolioAllocation): PortfolioAllocation {
    const total = allocation.stocks + allocation.bonds + allocation.cash + allocation.alternatives;
    
    // If already exactly 100, return as-is
    if (total === 100) {
      return allocation;
    }
    
    // If total is 0, return empty allocation
    if (total === 0) {
      return allocation;
    }
    
    // Calculate the difference from 100
    const diff = total - 100;
    
    // Adjust cash allocation to compensate for rounding
    // If cash is insufficient, adjust alternatives, then bonds, then stocks
    let normalized = { ...allocation };
    
    if (diff !== 0) {
      // Priority order for adjustment: cash, alternatives, bonds, stocks
      const adjustmentOrder: (keyof PortfolioAllocation)[] = ['cash', 'alternatives', 'bonds', 'stocks'];
      
      for (const category of adjustmentOrder) {
        if (diff > 0 && normalized[category] >= diff) {
          // Reduce this category to make total 100
          normalized[category] -= diff;
          break;
        } else if (diff < 0 && normalized[category] >= 0) {
          // Increase this category to make total 100
          normalized[category] -= diff; // diff is negative, so this adds
          break;
        } else if (diff > 0 && normalized[category] > 0) {
          // Category has some value but not enough to cover the full difference
          const reduction = Math.min(normalized[category], diff);
          normalized[category] -= reduction;
          // Continue with the remaining difference
          if (reduction < diff) {
            const remaining = diff - reduction;
            // Find the next non-zero category
            for (let i = adjustmentOrder.indexOf(category) + 1; i < adjustmentOrder.length; i++) {
              const nextCategory = adjustmentOrder[i];
              if (normalized[nextCategory] > 0) {
                normalized[nextCategory] = Math.max(0, normalized[nextCategory] - remaining);
                break;
              }
            }
          }
          break;
        }
      }
    }
    
    // Final validation - ensure we sum to exactly 100
    const finalTotal = normalized.stocks + normalized.bonds + normalized.cash + normalized.alternatives;
    if (finalTotal !== 100 && finalTotal > 0) {
      // Last resort: proportionally scale all values
      const scale = 100 / finalTotal;
      normalized = {
        stocks: Math.round(normalized.stocks * scale),
        bonds: Math.round(normalized.bonds * scale),
        cash: Math.round(normalized.cash * scale),
        alternatives: Math.round(normalized.alternatives * scale)
      };
      
      // Handle final rounding error by adjusting the largest category
      const finalCheck = normalized.stocks + normalized.bonds + normalized.cash + normalized.alternatives;
      if (finalCheck !== 100) {
        const finalDiff = 100 - finalCheck;
        // Add difference to the largest category
        const categories = Object.entries(normalized).sort((a, b) => b[1] - a[1]);
        normalized[categories[0][0] as keyof PortfolioAllocation] += finalDiff;
      }
    }
    
    return normalized;
  }

  /**
   * Calculate allocation percentages by owner and category
   */
  private static calculateAllocation(holdings: CategorizedHolding[]): OwnerBasedAllocation {
    const allocation: OwnerBasedAllocation = {
      User: { stocks: 0, bonds: 0, cash: 0, alternatives: 0 },
      Spouse: { stocks: 0, bonds: 0, cash: 0, alternatives: 0 },
      Joint: { stocks: 0, bonds: 0, cash: 0, alternatives: 0 },
      Total: { stocks: 0, bonds: 0, cash: 0, alternatives: 0 }
    };
    
    // Group holdings by owner
    const ownerGroups: Record<string, CategorizedHolding[]> = {
      User: [],
      Spouse: [],
      Joint: []
    };
    
    holdings.forEach(holding => {
      ownerGroups[holding.owner].push(holding);
    });
    
    // Calculate percentages for each owner
    ['User', 'Spouse', 'Joint'].forEach(owner => {
      const ownerHoldings = ownerGroups[owner];
      const totalValue = ownerHoldings.reduce((sum, h) => sum + h.value, 0);
      
      if (totalValue > 0) {
        const categoryTotals = {
          stocks: 0,
          bonds: 0,
          cash: 0,
          alternatives: 0
        };
        
        ownerHoldings.forEach(holding => {
          categoryTotals[holding.category] += holding.value;
        });
        
        const rawAllocation = {
          stocks: Math.round((categoryTotals.stocks / totalValue) * 100),
          bonds: Math.round((categoryTotals.bonds / totalValue) * 100),
          cash: Math.round((categoryTotals.cash / totalValue) * 100),
          alternatives: Math.round((categoryTotals.alternatives / totalValue) * 100)
        };
        
        // Normalize to ensure it sums to exactly 100%
        allocation[owner as keyof OwnerBasedAllocation] = this.normalizeAllocation(rawAllocation);
      }
    });
    
    // Calculate total allocation across all owners
    const allHoldingsTotalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    
    if (allHoldingsTotalValue > 0) {
      const totalCategoryValues = {
        stocks: holdings.filter(h => h.category === 'stocks').reduce((sum, h) => sum + h.value, 0),
        bonds: holdings.filter(h => h.category === 'bonds').reduce((sum, h) => sum + h.value, 0),
        cash: holdings.filter(h => h.category === 'cash').reduce((sum, h) => sum + h.value, 0),
        alternatives: holdings.filter(h => h.category === 'alternatives').reduce((sum, h) => sum + h.value, 0)
      };
      
      const rawTotalAllocation = {
        stocks: Math.round((totalCategoryValues.stocks / allHoldingsTotalValue) * 100),
        bonds: Math.round((totalCategoryValues.bonds / allHoldingsTotalValue) * 100),
        cash: Math.round((totalCategoryValues.cash / allHoldingsTotalValue) * 100),
        alternatives: Math.round((totalCategoryValues.alternatives / allHoldingsTotalValue) * 100)
      };
      
      // Normalize to ensure it sums to exactly 100%
      allocation.Total = this.normalizeAllocation(rawTotalAllocation);
    }
    
    return allocation;
  }
  
  /**
   * Get empty allocation structure
   */
  private static getEmptyAllocation(): OwnerBasedAllocation {
    return {
      User: { stocks: 0, bonds: 0, cash: 0, alternatives: 0 },
      Spouse: { stocks: 0, bonds: 0, cash: 0, alternatives: 0 },
      Joint: { stocks: 0, bonds: 0, cash: 0, alternatives: 0 },
      Total: { stocks: 0, bonds: 0, cash: 0, alternatives: 0 }
    };
  }
}