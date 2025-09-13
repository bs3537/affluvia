import { PlaidTransaction } from '../../shared/schema';

/**
 * Transaction categorization service for expense breakdown
 */
export class TransactionCategorizer {
  /**
   * Category mappings based on Plaid categories
   */
  private static readonly CATEGORY_MAPPINGS: Record<string, string> = {
    // Housing
    'Rent and Utilities': 'Housing',
    'Mortgage and Rent': 'Housing',
    'Home Improvement': 'Housing',
    'Home Services': 'Housing',
    
    // Transportation
    'Transportation': 'Transportation',
    'Car Payment': 'Transportation',
    'Gas': 'Transportation',
    'Parking': 'Transportation',
    'Public Transportation': 'Transportation',
    'Taxi': 'Transportation',
    'Ride Share': 'Transportation',
    
    // Food
    'Food and Drink': 'Food & Dining',
    'Restaurants': 'Food & Dining',
    'Groceries': 'Groceries',
    'Fast Food': 'Food & Dining',
    'Coffee Shops': 'Food & Dining',
    'Alcohol & Bars': 'Food & Dining',
    
    // Shopping
    'Shops': 'Shopping',
    'Clothing': 'Shopping',
    'Electronics & Software': 'Shopping',
    'Sporting Goods': 'Shopping',
    
    // Healthcare
    'Healthcare': 'Healthcare',
    'Medical': 'Healthcare',
    'Pharmacy': 'Healthcare',
    'Dentist': 'Healthcare',
    'Doctor': 'Healthcare',
    
    // Entertainment
    'Entertainment': 'Entertainment',
    'Movies & DVDs': 'Entertainment',
    'Music': 'Entertainment',
    'Newspapers & Magazines': 'Entertainment',
    
    // Bills & Utilities
    'Bills and Utilities': 'Utilities',
    'Internet': 'Utilities',
    'Mobile Phone': 'Utilities',
    'Television': 'Utilities',
    'Utilities': 'Utilities',
    
    // Financial
    'Financial': 'Financial',
    'Bank Fee': 'Financial',
    'Finance Charge': 'Financial',
    'ATM Fee': 'Financial',
    'Interest': 'Financial',
    
    // Insurance
    'Insurance': 'Insurance',
    'Life Insurance': 'Insurance',
    'Auto Insurance': 'Insurance',
    'Home Insurance': 'Insurance',
    'Health Insurance': 'Insurance',
    
    // Personal Care
    'Personal Care': 'Personal Care',
    'Hair': 'Personal Care',
    'Spa & Massage': 'Personal Care',
    'Gym': 'Personal Care',
    
    // Education
    'Education': 'Education',
    'Tuition': 'Education',
    'Student Loan': 'Education',
    'Books': 'Education',
    
    // Travel
    'Travel': 'Travel',
    'Hotel': 'Travel',
    'Rental Car & Taxi': 'Travel',
    'Airlines': 'Travel',
    
    // Gifts & Donations
    'Gift': 'Gifts & Donations',
    'Charity': 'Gifts & Donations',
    'Gift': 'Gifts & Donations',
    
    // Pets
    'Pet Food & Supplies': 'Pets',
    'Pet Grooming': 'Pets',
    'Veterinary': 'Pets',
    
    // Kids
    'Kids Activities': 'Kids',
    'Babysitter & Daycare': 'Kids',
    'Baby Supplies': 'Kids',
    'Toys': 'Kids',
    
    // Other
    'Cash & ATM': 'Cash',
    'Check': 'Other',
    'Deposit': 'Income',
    'Payroll': 'Income',
    'Transfer': 'Transfer',
    'Other': 'Other'
  };

  /**
   * Categorize a single transaction
   */
  static categorizeTransaction(transaction: Partial<PlaidTransaction>): {
    category: string;
    subcategory: string;
    isIncome: boolean;
    isTransfer: boolean;
    confidence: number;
  } {
    // Check if it's income (negative amounts in Plaid are deposits/income)
    const isIncome = (transaction.amount || 0) < 0;
    
    // Get primary category from Plaid
    const plaidCategory = transaction.primaryCategory || transaction.category?.[0] || 'Other';
    const plaidSubcategory = transaction.detailedCategory || transaction.category?.[1] || '';
    
    // Map to our categories
    let mappedCategory = this.CATEGORY_MAPPINGS[plaidCategory] || 'Other';
    
    // Check for transfers
    const isTransfer = this.isTransfer(transaction);
    if (isTransfer) {
      mappedCategory = 'Transfer';
    }
    
    // Override for income transactions
    if (isIncome) {
      if (transaction.name?.toLowerCase().includes('payroll') || 
          transaction.name?.toLowerCase().includes('salary')) {
        mappedCategory = 'Salary';
      } else if (transaction.name?.toLowerCase().includes('interest')) {
        mappedCategory = 'Investment Income';
      } else {
        mappedCategory = 'Other Income';
      }
    }
    
    // Calculate confidence based on available data
    let confidence = 0.5; // Base confidence
    if (transaction.primaryCategory) confidence += 0.3;
    if (transaction.detailedCategory) confidence += 0.2;
    
    return {
      category: mappedCategory,
      subcategory: plaidSubcategory,
      isIncome,
      isTransfer,
      confidence
    };
  }

  /**
   * Check if transaction is a transfer
   */
  private static isTransfer(transaction: Partial<PlaidTransaction>): boolean {
    const transferKeywords = ['transfer', 'xfer', 'trnsfr', 'moved money'];
    const name = transaction.name?.toLowerCase() || '';
    
    return transferKeywords.some(keyword => name.includes(keyword)) ||
           transaction.primaryCategory?.toLowerCase() === 'transfer';
  }

  /**
   * Aggregate transactions by category
   */
  static aggregateByCategory(transactions: Partial<PlaidTransaction>[]): {
    expenses: Record<string, number>;
    income: Record<string, number>;
    totalExpenses: number;
    totalIncome: number;
    netCashFlow: number;
    categoryCounts: Record<string, number>;
  } {
    const expenses: Record<string, number> = {};
    const income: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    let totalExpenses = 0;
    let totalIncome = 0;
    
    transactions.forEach(transaction => {
      const { category, isIncome, isTransfer } = this.categorizeTransaction(transaction);
      const amount = Math.abs(transaction.amount || 0);
      
      // Skip transfers in totals
      if (isTransfer) {
        return;
      }
      
      if (isIncome) {
        income[category] = (income[category] || 0) + amount;
        totalIncome += amount;
      } else {
        expenses[category] = (expenses[category] || 0) + amount;
        totalExpenses += amount;
      }
      
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    return {
      expenses,
      income,
      totalExpenses,
      totalIncome,
      netCashFlow: totalIncome - totalExpenses,
      categoryCounts
    };
  }

  /**
   * Get spending trends by category over time
   */
  static getSpendingTrends(
    transactions: Partial<PlaidTransaction>[],
    months: number = 6
  ): {
    monthly: Record<string, Record<string, number>>;
    averages: Record<string, number>;
    trends: Record<string, 'increasing' | 'decreasing' | 'stable'>;
  } {
    const monthly: Record<string, Record<string, number>> = {};
    const categoryTotals: Record<string, number[]> = {};
    
    // Group by month
    transactions.forEach(transaction => {
      const { category, isIncome, isTransfer } = this.categorizeTransaction(transaction);
      if (isIncome || isTransfer) return;
      
      const date = new Date(transaction.transactionDate || transaction.authorizedDate || '');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthly[monthKey]) {
        monthly[monthKey] = {};
      }
      
      const amount = Math.abs(transaction.amount || 0);
      monthly[monthKey][category] = (monthly[monthKey][category] || 0) + amount;
      
      if (!categoryTotals[category]) {
        categoryTotals[category] = [];
      }
      categoryTotals[category].push(amount);
    });
    
    // Calculate averages and trends
    const averages: Record<string, number> = {};
    const trends: Record<string, 'increasing' | 'decreasing' | 'stable'> = {};
    
    Object.entries(categoryTotals).forEach(([category, amounts]) => {
      averages[category] = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      
      // Simple trend calculation (compare first half to second half)
      const midpoint = Math.floor(amounts.length / 2);
      const firstHalf = amounts.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
      const secondHalf = amounts.slice(midpoint).reduce((a, b) => a + b, 0) / (amounts.length - midpoint);
      
      const change = ((secondHalf - firstHalf) / firstHalf) * 100;
      
      if (change > 10) {
        trends[category] = 'increasing';
      } else if (change < -10) {
        trends[category] = 'decreasing';
      } else {
        trends[category] = 'stable';
      }
    });
    
    return { monthly, averages, trends };
  }

  /**
   * Detect recurring transactions
   */
  static detectRecurringTransactions(
    transactions: Partial<PlaidTransaction>[]
  ): {
    subscriptions: Array<{
      name: string;
      amount: number;
      frequency: 'monthly' | 'quarterly' | 'annual';
      category: string;
    }>;
    totalMonthlyRecurring: number;
  } {
    const transactionGroups: Record<string, Partial<PlaidTransaction>[]> = {};
    
    // Group by merchant name and amount
    transactions.forEach(tx => {
      if (!tx.name || tx.amount === undefined) return;
      const key = `${tx.name}_${Math.abs(tx.amount)}`;
      if (!transactionGroups[key]) {
        transactionGroups[key] = [];
      }
      transactionGroups[key].push(tx);
    });
    
    const subscriptions: Array<{
      name: string;
      amount: number;
      frequency: 'monthly' | 'quarterly' | 'annual';
      category: string;
    }> = [];
    
    // Detect recurring patterns
    Object.entries(transactionGroups).forEach(([key, txs]) => {
      if (txs.length < 2) return;
      
      // Sort by date
      txs.sort((a, b) => {
        const dateA = new Date(a.transactionDate || a.authorizedDate || '');
        const dateB = new Date(b.transactionDate || b.authorizedDate || '');
        return dateA.getTime() - dateB.getTime();
      });
      
      // Calculate intervals
      const intervals: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        const dateA = new Date(txs[i - 1].transactionDate || txs[i - 1].authorizedDate || '');
        const dateB = new Date(txs[i].transactionDate || txs[i].authorizedDate || '');
        const daysDiff = Math.floor((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));
        intervals.push(daysDiff);
      }
      
      // Determine frequency
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      let frequency: 'monthly' | 'quarterly' | 'annual';
      
      if (avgInterval >= 25 && avgInterval <= 35) {
        frequency = 'monthly';
      } else if (avgInterval >= 85 && avgInterval <= 95) {
        frequency = 'quarterly';
      } else if (avgInterval >= 360 && avgInterval <= 370) {
        frequency = 'annual';
      } else {
        return; // Not a clear recurring pattern
      }
      
      const { category } = this.categorizeTransaction(txs[0]);
      
      subscriptions.push({
        name: txs[0].name || 'Unknown',
        amount: Math.abs(txs[0].amount || 0),
        frequency,
        category
      });
    });
    
    // Calculate total monthly recurring
    const totalMonthlyRecurring = subscriptions.reduce((total, sub) => {
      if (sub.frequency === 'monthly') {
        return total + sub.amount;
      } else if (sub.frequency === 'quarterly') {
        return total + (sub.amount / 3);
      } else if (sub.frequency === 'annual') {
        return total + (sub.amount / 12);
      }
      return total;
    }, 0);
    
    return { subscriptions, totalMonthlyRecurring };
  }
}

export default TransactionCategorizer;