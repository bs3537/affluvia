import { PlaidApi } from 'plaid';
import { db } from '../db';
import { plaidItems, plaidAccounts, financialProfiles } from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { chatComplete } from './xai-client';
import PlaidConfig from '../config/plaid-config';
import { EncryptionService } from './encryption-service';

// Initialize Plaid client
const configuration = PlaidConfig.getConfiguration();
const plaidClient = new PlaidApi(configuration);

// XAI client is used on demand in enhanceWithGemini

// Expense categories from intake form Step 5
export interface ExpenseCategories {
  housing: number;
  transportation: number;
  food: number;
  utilities: number;
  healthcare: number;
  entertainment: number;
  creditCardPayments: number;
  studentLoanPayments: number;
  otherDebtPayments: number;
  clothing: number;
  other: number;
  expectedAnnualTaxes?: number; // This is annual, not monthly
}

// Transaction with categorization
export interface CategorizedTransaction {
  id: string;
  accountId: string;
  amount: number;
  date: string;
  merchantName: string | null;
  plaidCategory: string | null;
  plaidCategoryDetailed: string | null;
  confidenceLevel: string | null;
  assignedCategory: keyof ExpenseCategories;
  aiEnhanced?: boolean;
}

// Result of categorization
export interface CategorizationResult {
  totalExpenses: number;
  categorizedExpenses: ExpenseCategories;
  transactionCount: number;
  accountCount: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  transactions?: CategorizedTransaction[];
  confidence: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Maps Plaid Personal Finance Categories to Intake Form expense categories
 * Using Plaid's new simplified PFC taxonomy (16 primary, 104 detailed categories)
 */
const PFC_TO_EXPENSE_MAPPING: Record<string, keyof ExpenseCategories> = {
  // Housing related
  'RENT_AND_UTILITIES.RENT': 'housing',
  'RENT_AND_UTILITIES.GAS_AND_ELECTRICITY': 'housing',
  'RENT_AND_UTILITIES.WATER': 'housing',
  'RENT_AND_UTILITIES.SEWAGE_AND_WASTE_MANAGEMENT': 'housing',
  'RENT_AND_UTILITIES.OTHER_UTILITIES': 'housing',
  'HOME_IMPROVEMENT': 'housing',
  
  // Utilities (separate from housing utilities)
  'RENT_AND_UTILITIES.INTERNET_AND_CABLE': 'utilities',
  'RENT_AND_UTILITIES.TELEPHONE': 'utilities',
  
  // Transportation
  'TRANSPORTATION.GAS': 'transportation',
  'TRANSPORTATION.PUBLIC_TRANSIT': 'transportation',
  'TRANSPORTATION.PARKING': 'transportation',
  'TRANSPORTATION.TOLLS': 'transportation',
  'TRANSPORTATION.TAXIS_AND_RIDE_SHARES': 'transportation',
  'TRANSPORTATION.BIKE_AND_SCOOTER_SHARE': 'transportation',
  'TRANSPORTATION.CAR_RENTAL': 'transportation',
  'TRANSPORTATION.CAR_INSURANCE': 'transportation',
  'TRANSPORTATION.CAR_MAINTENANCE': 'transportation',
  
  // Food & Dining
  'FOOD_AND_DRINK.GROCERIES': 'food',
  'FOOD_AND_DRINK.RESTAURANT': 'food',
  'FOOD_AND_DRINK.FAST_FOOD': 'food',
  'FOOD_AND_DRINK.COFFEE': 'food',
  'FOOD_AND_DRINK.ALCOHOL_AND_BARS': 'food',
  'FOOD_AND_DRINK.VENDING_MACHINES': 'food',
  
  // Healthcare
  'MEDICAL.PRIMARY_CARE': 'healthcare',
  'MEDICAL.DENTAL_CARE': 'healthcare',
  'MEDICAL.EYE_CARE': 'healthcare',
  'MEDICAL.PHARMACIES': 'healthcare',
  'MEDICAL.VETERINARY_SERVICES': 'healthcare',
  'MEDICAL.OTHER_MEDICAL': 'healthcare',
  'MEDICAL.MEDICAL_INSURANCE': 'healthcare',
  
  // Entertainment
  'ENTERTAINMENT.STREAMING_SERVICES': 'entertainment',
  'ENTERTAINMENT.MOVIES': 'entertainment',
  'ENTERTAINMENT.MUSIC_AND_AUDIO': 'entertainment',
  'ENTERTAINMENT.VIDEO_GAMES': 'entertainment',
  'ENTERTAINMENT.SPORTING_EVENTS': 'entertainment',
  'ENTERTAINMENT.AMUSEMENT_PARKS': 'entertainment',
  'ENTERTAINMENT.CASINOS_AND_GAMBLING': 'entertainment',
  'ENTERTAINMENT.OTHER_ENTERTAINMENT': 'entertainment',
  
  // Loan Payments
  'LOAN_PAYMENTS.CREDIT_CARD': 'creditCardPayments',
  'LOAN_PAYMENTS.STUDENT': 'studentLoanPayments',
  'LOAN_PAYMENTS.AUTO': 'otherDebtPayments',
  'LOAN_PAYMENTS.PERSONAL': 'otherDebtPayments',
  'LOAN_PAYMENTS.MORTGAGE': 'housing', // Mortgage goes to housing
  
  // Personal Care & Clothing
  'PERSONAL_CARE.CLOTHING_AND_ACCESSORIES': 'clothing',
  'PERSONAL_CARE.HAIR_AND_BEAUTY': 'clothing', // Group with personal care
  'PERSONAL_CARE.LAUNDRY_AND_DRY_CLEANING': 'clothing',
  'PERSONAL_CARE.GYMS_AND_FITNESS': 'healthcare', // Could argue for healthcare
  
  // General & Other
  'GENERAL_MERCHANDISE': 'other',
  'GENERAL_SERVICES': 'other',
  'BANK_FEES': 'other',
  'GOVERNMENT_AND_NON_PROFIT': 'other',
  'TRAVEL': 'other',
  'TRANSFER_OUT': 'other',
};

export class PlaidTransactionCategorizer {
  /**
   * Fetch and categorize transactions for a user's household (including spouse)
   */
  static async categorizeHouseholdExpenses(
    userId: number,
    daysBack: number = 30
  ): Promise<CategorizationResult> {
    try {
      console.log(`[TransactionCategorizer] Starting categorization for user ${userId}, last ${daysBack} days`);
      
      // Get all active Plaid items for the user
      const items = await db.select()
        .from(plaidItems)
        .where(and(
          eq(plaidItems.userId, userId),
          eq(plaidItems.status, 'active')
        ));
      
      if (items.length === 0) {
        console.log('[TransactionCategorizer] No connected Plaid accounts found');
        return this.getEmptyResult(daysBack);
      }
      
      // Get all accounts for these items
      const itemIds = items.map(item => item.id);
      const accounts = await db.select()
        .from(plaidAccounts)
        .where(inArray(plaidAccounts.plaidItemId, itemIds));
      
      console.log(`[TransactionCategorizer] Found ${accounts.length} accounts across ${items.length} institutions`);
      
      // Filter for checking accounts only to avoid double-counting
      // (Credit card payments will show as outflows from checking)
      const relevantAccounts = accounts.filter(acc => 
        acc.accountType === 'depository' && 
        (acc.accountSubtype?.includes('checking') || acc.accountSubtype === 'depository')
      );
      
      console.log(`[TransactionCategorizer] Filtered to ${relevantAccounts.length} checking accounts only (avoiding double-counting)`);
      
      // Fetch transactions from Plaid for each item
      const allTransactions: CategorizedTransaction[] = [];
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      for (const item of items) {
        try {
          const itemAccounts = relevantAccounts.filter(acc => acc.plaidItemId === item.id);
          if (itemAccounts.length === 0) continue;
          
          console.log(`[TransactionCategorizer] Fetching transactions for item ${item.id}`);
          
          // Decrypt the access token before using it
          const decryptedAccessToken = EncryptionService.decrypt(item.accessToken);
          
          // Use transactions/get for fetching transactions
          const request = {
            access_token: decryptedAccessToken,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            options: {
              account_ids: itemAccounts.map(acc => acc.accountId),
              count: 500, // Max per request
              offset: 0
            }
          };
          
          const response = await plaidClient.transactionsGet(request);
          const transactions = response.data.transactions;
          
          console.log(`[TransactionCategorizer] Retrieved ${transactions.length} transactions`);
          
          // Process each transaction (only counting outflows from checking)
          for (const txn of transactions) {
            // Skip credits/deposits (negative or zero amounts in Plaid)
            // Plaid represents debits as positive for checking accounts
            if (txn.amount <= 0) continue;
            
            // For checking accounts, we want all outflows regardless of category
            // This includes credit card payments, bills, transfers, etc.
            const categorized = await this.categorizeTransaction(txn);
            allTransactions.push(categorized);
          }
          
        } catch (error) {
          console.error(`[TransactionCategorizer] Error fetching transactions for item ${item.id}:`, error);
          // Continue with other items
        }
      }
      
      console.log(`[TransactionCategorizer] Found ${allTransactions.length} outflow transactions from checking accounts`);
      
      // Aggregate by category
      const aggregated = this.aggregateTransactions(allTransactions);
      
      // Calculate confidence breakdown
      const confidenceBreakdown = this.calculateConfidenceBreakdown(allTransactions);
      
      return {
        totalExpenses: allTransactions.reduce((sum, t) => sum + t.amount, 0),
        categorizedExpenses: aggregated,
        transactionCount: allTransactions.length,
        accountCount: relevantAccounts.length,
        dateRange: {
          start: startDate,
          end: endDate
        },
        confidence: confidenceBreakdown,
        transactions: allTransactions // Optional: include for debugging
      };
      
    } catch (error) {
      console.error('[TransactionCategorizer] Error in categorizeHouseholdExpenses:', error);
      throw error;
    }
  }
  
  /**
   * Categorize a single transaction
   */
  private static async categorizeTransaction(transaction: any): Promise<CategorizedTransaction> {
    // First attempt: Use Plaid's Personal Finance Category
    let assignedCategory: keyof ExpenseCategories = 'other';
    let aiEnhanced = false;
    
    const plaidCategory = transaction.personal_finance_category?.primary;
    const plaidCategoryDetailed = transaction.personal_finance_category?.detailed;
    const confidence = transaction.personal_finance_category?.confidence_level;
    
    // Try to map using detailed category first, then primary
    if (plaidCategoryDetailed && PFC_TO_EXPENSE_MAPPING[plaidCategoryDetailed]) {
      assignedCategory = PFC_TO_EXPENSE_MAPPING[plaidCategoryDetailed];
    } else if (plaidCategory && PFC_TO_EXPENSE_MAPPING[plaidCategory]) {
      assignedCategory = PFC_TO_EXPENSE_MAPPING[plaidCategory];
    }
    
    // Skip AI enhancement for now - user wants simple total expenses
    // The categorization is less important than accurate total
    // if ((confidence === 'LOW' || confidence === 'MEDIUM' || assignedCategory === 'other') && 
    //     transaction.merchant_name) {
    //   try {
    //     const aiCategory = await this.enhanceWithGemini(...);
    //   } catch (error) {
    //     console.error('[TransactionCategorizer] Gemini enhancement failed:', error);
    //   }
    // }
    
    return {
      id: transaction.transaction_id,
      accountId: transaction.account_id,
      amount: transaction.amount,
      date: transaction.date,
      merchantName: transaction.merchant_name || transaction.name,
      plaidCategory: plaidCategory,
      plaidCategoryDetailed: plaidCategoryDetailed,
      confidenceLevel: confidence,
      assignedCategory,
      aiEnhanced
    };
  }
  
  /**
   * Use Gemini AI to enhance categorization for ambiguous transactions
   */
  private static async enhanceWithGemini(
    merchantName: string,
    amount: number,
    plaidCategory: string | null,
    confidence: string | null
  ): Promise<keyof ExpenseCategories | null> {
    try {
      const prompt = `
        Categorize this financial transaction into exactly ONE household expense category.
        
        Transaction Details:
        - Merchant: ${merchantName}
        - Amount: $${amount}
        - Plaid Category: ${plaidCategory || 'unknown'}
        - Confidence: ${confidence || 'unknown'}
        
        Available Categories (choose exactly one):
        - housing: rent, mortgage, property tax, home maintenance, utilities like gas/electric/water
        - transportation: car payment, gas, auto insurance, public transit, uber/lyft
        - food: groceries, restaurants, takeout, coffee shops
        - utilities: internet, cable, phone bills (separate from housing utilities)
        - healthcare: doctor visits, prescriptions, medical insurance, dental, vision
        - entertainment: streaming services, movies, games, sports, hobbies
        - creditCardPayments: credit card debt payments
        - studentLoanPayments: student loan payments
        - otherDebtPayments: auto loans, personal loans
        - clothing: clothes, shoes, accessories, personal care, haircuts
        - other: anything that doesn't fit above categories
        
        Common merchant patterns:
        - Amazon/Walmart/Target: Could be any category, default to 'other' unless clear
        - Gas stations: 'transportation'
        - Grocery stores: 'food'
        - Restaurants: 'food'
        - Netflix/Spotify/Hulu: 'entertainment'
        - Utilities companies: Check if housing utility or separate
        
        Response must be JSON: { "category": "string", "confidence": number }
        Where confidence is 0-100.
      `;
      
      const text = await chatComplete([
        { role: 'user', content: prompt }
      ], { temperature: 0.7, stream: false });
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.category && parsed.confidence > 60) {
          return parsed.category as keyof ExpenseCategories;
        }
      }
      
      return null;
    } catch (error) {
      console.error('[TransactionCategorizer] Gemini categorization error:', error);
      return null;
    }
  }
  
  /**
   * Aggregate transactions by category
   */
  private static aggregateTransactions(
    transactions: CategorizedTransaction[]
  ): ExpenseCategories {
    const aggregated: ExpenseCategories = {
      housing: 0,
      transportation: 0,
      food: 0,
      utilities: 0,
      healthcare: 0,
      entertainment: 0,
      creditCardPayments: 0,
      studentLoanPayments: 0,
      otherDebtPayments: 0,
      clothing: 0,
      other: 0
    };
    
    for (const txn of transactions) {
      aggregated[txn.assignedCategory] += txn.amount;
    }
    
    // Round all values to 2 decimal places
    for (const key in aggregated) {
      aggregated[key as keyof ExpenseCategories] = 
        Math.round(aggregated[key as keyof ExpenseCategories] * 100) / 100;
    }
    
    return aggregated;
  }
  
  /**
   * Calculate confidence breakdown
   */
  private static calculateConfidenceBreakdown(
    transactions: CategorizedTransaction[]
  ): { high: number; medium: number; low: number } {
    const breakdown = {
      high: 0,
      medium: 0,
      low: 0
    };
    
    for (const txn of transactions) {
      if (txn.confidenceLevel === 'VERY_HIGH' || txn.confidenceLevel === 'HIGH') {
        breakdown.high++;
      } else if (txn.confidenceLevel === 'MEDIUM') {
        breakdown.medium++;
      } else {
        breakdown.low++;
      }
    }
    
    return breakdown;
  }
  
  /**
   * Get empty result structure
   */
  private static getEmptyResult(daysBack: number): CategorizationResult {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    return {
      totalExpenses: 0,
      categorizedExpenses: {
        housing: 0,
        transportation: 0,
        food: 0,
        utilities: 0,
        healthcare: 0,
        entertainment: 0,
        creditCardPayments: 0,
        studentLoanPayments: 0,
        otherDebtPayments: 0,
        clothing: 0,
        other: 0
      },
      transactionCount: 0,
      accountCount: 0,
      dateRange: {
        start: startDate,
        end: endDate
      },
      confidence: {
        high: 0,
        medium: 0,
        low: 0
      }
    };
  }
}
