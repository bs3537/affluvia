import { db } from '../db';
import { plaidAccounts, plaidItems, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Service to retrieve Plaid account data from database and map to intake form format
 * This ensures data persistence and allows population of multiple intake form steps
 */
export class PlaidIntakeDatabaseMapper {
  /**
   * Map Plaid account subtype to intake form asset type
   * Based on user-specified mappings for intake form step 3
   */
  private static mapToAssetType(plaidSubtype: string | null | undefined): string | null {
    if (!plaidSubtype) return 'other';
    
    const normalized = plaidSubtype.toLowerCase().replace(/_/g, ' ').trim();
    
    const assetMap: Record<string, string> = {
      // Direct mappings from user requirements
      'checking': 'checking',
      'money market': 'savings',
      'cash management': 'savings',
      'fixed annuity': 'qualified-annuities',
      'variable annuity': 'qualified-annuities',
      'other annuity': 'qualified-annuities',
      'annuity': 'qualified-annuities',
      '403b': '403b',
      '403 b': '403b',
      'auto': 'vehicle',
      'life insurance': 'cash-value-life-insurance',
      'roth': 'roth-ira',
      'roth ira': 'roth-ira',
      'sep ira': 'traditional-ira',
      'simple ira': 'traditional-ira',
      'ira': 'traditional-ira',
      'savings': 'savings',
      'hsa': 'hsa',
      '401k': '401k',
      '401 k': '401k',
      '529': 'other',
      '401a': 'other',
      '401 a': 'other',
      '457b': 'other',
      '457 b': 'other',
      'brokerage': 'taxable-brokerage',
      'investment': 'taxable-brokerage',
      'crypto exchange': 'other',
      'mutual fund': 'other',
      'other': 'other',
      'other insurance': 'other',
      'paypal': 'other',
      'pension': 'other',
      'thrift savings plan': 'savings',
      'roth 401k': 'other',
      'roth 401 k': 'other',
      
      // Additional common mappings
      'cd': 'savings',
      'prepaid': 'checking',
      'fsa': 'other',
      'education savings account': 'other',
      'coverdell': 'other',
      'whole life': 'cash-value-life-insurance',
      'universal life': 'cash-value-life-insurance',
      'variable life': 'cash-value-life-insurance',
      'sarsep': 'traditional-ira',
      'profit sharing plan': 'other',
      'retirement': 'other',
      'keogh': 'other',
      'stock plan': 'taxable-brokerage',
      'non taxable brokerage account': 'taxable-brokerage',
      'trust': 'taxable-brokerage',
      'ugma': 'taxable-brokerage',
      'utma': 'taxable-brokerage',
    };
    
    return assetMap[normalized] || 'other';
  }
  
  /**
   * Map Plaid account subtype to intake form liability type
   * Based on user-specified mappings for intake form step 3
   */
  private static mapToLiabilityType(plaidSubtype: string | null | undefined): string | null {
    if (!plaidSubtype) {
      return 'other';
    }
    
    const normalized = plaidSubtype.toLowerCase().replace(/_/g, ' ').trim();
    
    const liabilityMap: Record<string, string | null> = {
      // Direct mappings from user requirements
      'credit card': 'credit-card',
      'creditcard': 'credit-card',
      'credit': 'credit-card',
      'business credit card': 'credit-card',
      'commercial credit card': 'credit-card',
      'line of credit': 'other',
      'lineofcredit': 'other',
      'loan': 'other',
      'student': 'private-student-loan',
      'student loan': 'private-student-loan',
      'mortgage': 'other', // Changed from null - now handled as 'other' in step 3
      'personal': 'other',
      'personal loan': 'other',
      'home equity': 'other',
      'homeequity': 'other',
      'auto': 'auto-loan',
      'auto loan': 'auto-loan',
      'overdraft': 'other',
      'consumer': 'other',
      'commercial': 'other',
      'construction': 'other',
      'business': 'other',
    };
    
    const mappedType = liabilityMap[normalized];
    return mappedType !== undefined ? mappedType : 'other';
  }
  
  /**
   * Determine if account is an asset or liability based on Plaid account type and balance
   */
  private static isAsset(accountType: string, accountSubtype: string | null, balance: number): boolean {
    // Investment and depository accounts are always assets
    if (accountType === 'investment' || accountType === 'depository' || accountType === 'brokerage') {
      return true;
    }
    
    // Loan and credit accounts are always liabilities
    if (accountType === 'loan' || accountType === 'credit') {
      return false;
    }
    
    // For 'other' type, check specific subtypes or use balance
    const assetSubtypes = ['hsa', 'fsa', '529', 'cash_management', 'prepaid', 'paypal'];
    if (accountSubtype && assetSubtypes.includes(accountSubtype.toLowerCase())) {
      return true;
    }
    
    // Default: positive balance = asset, negative = liability
    return balance >= 0;
  }
  
  /**
   * Map owner name to intake form owner type by comparing first names
   */
  private static mapOwner(
    accountOwnerNames: string[] | undefined, 
    userFirstName: string | undefined,
    spouseFirstName: string | undefined
  ): string {
    if (!accountOwnerNames || accountOwnerNames.length === 0) {
      return 'User'; // Default to user if no owner names
    }
    
    // Get the first owner name from the account
    const accountOwnerFirstName = accountOwnerNames[0]?.split(' ')[0]?.toLowerCase().trim();
    
    if (!accountOwnerFirstName) {
      return 'User';
    }
    
    // Compare with user and spouse first names
    const userFirst = userFirstName?.toLowerCase().trim();
    const spouseFirst = spouseFirstName?.toLowerCase().trim();
    
    if (userFirst && accountOwnerFirstName === userFirst) {
      return 'User'; // Matches user's first name
    }
    
    if (spouseFirst && accountOwnerFirstName === spouseFirst) {
      return 'Spouse'; // Matches spouse's first name
    }
    
    // Default to User if no match
    return 'User';
  }
  
  /**
   * Get comprehensive intake form data from database
   * Returns data for all relevant intake form steps
   */
  static async getComprehensiveIntakeData(
    userId: number,
    userFirstName?: string,
    spouseFirstName?: string
  ) {
    try {
      // Get all active Plaid accounts from database
      const accounts = await db.select()
        .from(plaidAccounts)
        .innerJoin(plaidItems, eq(plaidAccounts.plaidItemId, plaidItems.id))
        .where(and(
          eq(plaidAccounts.userId, userId),
          eq(plaidAccounts.isActive, true),
          eq(plaidItems.status, 'active')
        ));
      
      // Initialize data structures for different steps
      const step3Assets: any[] = [];
      const step3Liabilities: any[] = [];
      const step4Mortgages: any[] = [];
      const step11RetirementAccounts: any[] = [];
      
      for (const row of accounts) {
        const account = row.plaid_accounts;
        const item = row.plaid_items;
        
        const balance = parseFloat(account.currentBalance || '0');
        const accountType = account.accountType || 'other';
        const accountSubtype = account.accountSubtype;
        
        // Get owner from metadata and map to intake form owner
        const ownerNames = (account.metadata as any)?.ownerNames || [];
        const owner = this.mapOwner(ownerNames, userFirstName, spouseFirstName);
        
        // Determine if this is an asset or liability
        const isAsset = this.isAsset(accountType, accountSubtype, balance);
        
        if (isAsset) {
          const assetType = this.mapToAssetType(accountSubtype);
          
          // Add to Step 3 assets
          if (assetType) {
            step3Assets.push({
              type: assetType,
              description: account.accountName || 'Account',
              value: Math.abs(balance),
              owner: owner,
              _source: {
                plaidAccountId: account.accountId,
                institutionName: item.institutionName,
                accountSubtype: account.accountSubtype,
                lastUpdated: account.lastSynced,
                isImported: true
              }
            });
            
            // Also collect retirement accounts for Step 11
            const retirementTypes = ['401k', '403b', 'traditional-ira', 'roth-ira', 'other-tax-deferred'];
            if (retirementTypes.includes(assetType)) {
              step11RetirementAccounts.push({
                type: assetType,
                accountName: account.accountName || 'Retirement Account',
                institution: item.institutionName || 'Bank',
                balance: Math.abs(balance),
                owner: owner,
                plaidAccountId: account.accountId
              });
            }
          }
        } else {
          // Check if it's a mortgage for Step 4
          const normalizedSubtype = accountSubtype?.toLowerCase().replace(/_/g, '');
          if (normalizedSubtype === 'mortgage') {
            step4Mortgages.push({
              accountName: account.accountName || 'Mortgage',
              institution: item.institutionName || 'Bank',
              balance: Math.abs(balance),
              owner: owner,
              plaidAccountId: account.accountId
            });
          } else {
            // Map to liability for Step 3
            // For credit accounts without subtype, default to credit-card
            let liabilityType = this.mapToLiabilityType(accountSubtype);
            if (accountType === 'credit' && !accountSubtype) {
              liabilityType = 'credit-card';
            }
            if (liabilityType !== null && liabilityType !== undefined) {
              step3Liabilities.push({
                type: liabilityType,
                description: account.accountName || 'Account',
                balance: Math.abs(balance),
                monthlyPayment: 0, // User will need to fill this in
                interestRate: 0, // User will need to fill this in
                owner: owner,
                _source: {
                  plaidAccountId: account.accountId,
                  institutionName: item.institutionName,
                  accountSubtype: account.accountSubtype,
                  lastUpdated: account.lastSynced,
                  isImported: true
                }
              });
            }
          }
        }
      }
      
      return {
        success: true,
        step3: {
          assets: step3Assets,
          liabilities: step3Liabilities,
          totalAssets: step3Assets.length,
          totalLiabilities: step3Liabilities.length
        },
        step4: {
          mortgages: step4Mortgages,
          totalMortgages: step4Mortgages.length,
          primaryMortgageBalance: step4Mortgages[0]?.balance || 0
        },
        step11: {
          retirementAccounts: step11RetirementAccounts,
          totalRetirementBalance: step11RetirementAccounts.reduce((sum, acc) => sum + acc.balance, 0),
          accountsByType: step11RetirementAccounts.reduce((acc, account) => {
            acc[account.type] = (acc[account.type] || 0) + account.balance;
            return acc;
          }, {} as Record<string, number>)
        },
        lastSynced: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[PlaidIntakeDatabaseMapper] Error mapping Plaid data:', error);
      throw new Error(`Failed to map Plaid data for intake form: ${error.message}`);
    }
  }
  
  /**
   * Get data for a specific intake form step
   */
  static async getStepData(
    userId: number, 
    stepNumber: number,
    userFirstName?: string,
    spouseFirstName?: string
  ) {
    const allData = await this.getComprehensiveIntakeData(userId, userFirstName, spouseFirstName);
    
    switch (stepNumber) {
      case 3:
        return allData.step3;
      case 4:
        return allData.step4;
      case 11:
        return allData.step11;
      default:
        throw new Error(`No Plaid data mapping for step ${stepNumber}`);
    }
  }
}