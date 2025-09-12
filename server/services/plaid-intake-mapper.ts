import { db } from '../db';
import { plaidAccounts, plaidItems, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Service to map Plaid account data to intake form format
 */
export class PlaidIntakeMapper {
  /**
   * Map Plaid account subtype to intake form asset type
   */
  private static mapToAssetType(plaidSubtype: string | null | undefined): string | null {
    if (!plaidSubtype) return null;
    
    // Log for debugging
    console.log('[PlaidIntakeMapper] Mapping asset subtype:', plaidSubtype);
    
    const assetMap: Record<string, string> = {
      // Depository accounts
      'checking': 'checking',
      'savings': 'savings',
      'cd': 'savings',
      'money_market': 'savings',  // Money market mapped to savings
      'prepaid': 'checking',
      'cash_management': 'savings',  // Cash management mapped to savings (changed from checking)
      'paypal': 'checking',
      
      // Retirement accounts
      '401k': '401k',
      '403b': '403b',
      '457': 'other-tax-deferred',
      '457b': 'other-tax-deferred',
      'ira': 'traditional-ira',
      'roth_ira': 'roth-ira',
      'roth_401k': '401k',
      'roth': 'roth-ira',
      'sep_ira': 'traditional-ira',
      'simple_ira': 'traditional-ira',
      'sarsep': 'traditional-ira',
      'pension': 'other-tax-deferred',
      'profit_sharing_plan': 'other-tax-deferred',
      'retirement': 'other-tax-deferred',
      '401a': 'other-tax-deferred',
      'keogh': 'other-tax-deferred',
      'thrift_savings_plan': 'other-tax-deferred',
      
      // Investment accounts
      'brokerage': 'taxable-brokerage',
      'investment': 'taxable-brokerage',
      'mutual_fund': 'taxable-brokerage',
      'stock_plan': 'taxable-brokerage',
      'non_taxable_brokerage_account': 'taxable-brokerage',
      'trust': 'taxable-brokerage',
      'ugma': 'taxable-brokerage',
      'utma': 'taxable-brokerage',
      
      // Health & Education
      'hsa': 'hsa',
      'fsa': 'other',
      '529': 'other',
      'education_savings_account': 'other',
      'coverdell': 'other',
      
      // Annuities
      'annuity': 'non-qualified-annuities',
      'fixed_annuity': 'non-qualified-annuities',
      'variable_annuity': 'non-qualified-annuities',
      
      // Other
      'cash_isa': 'savings',
      'crypto_exchange': 'other',
      'gic': 'other',
      'health_reimbursement_arrangement': 'other',
      'isa': 'other',
      'lif': 'other-tax-deferred',
      'lira': 'other-tax-deferred',
      'lrif': 'other-tax-deferred',
      'lrsp': 'other-tax-deferred',
      'prif': 'other-tax-deferred',
      'rdsp': 'other',
      'resp': 'other',
      'rlif': 'other-tax-deferred',
      'rrif': 'other-tax-deferred',
      'rrsp': 'other-tax-deferred',
      'sipp': 'other-tax-deferred',
      'tfsa': 'other',
    };
    
    const mappedType = assetMap[plaidSubtype.toLowerCase()] || 'other';
    console.log('[PlaidIntakeMapper] Asset mapped to:', mappedType);
    return mappedType;
  }
  
  /**
   * Map Plaid account subtype to intake form liability type
   * Returns null for mortgages (handled in Step 4) and undefined subtypes
   */
  private static mapToLiabilityType(plaidSubtype: string | null | undefined): string | null {
    if (!plaidSubtype) return null;
    
    // Log for debugging
    console.log('[PlaidIntakeMapper] Mapping liability subtype:', plaidSubtype);
    
    const liabilityMap: Record<string, string> = {
      'credit_card': 'credit-card',
      'credit': 'credit-card',
      'business_credit_card': 'credit-card',  // Business credit cards map to credit-card
      'student': 'private-student-loan',  // Changed from federal to private
      'student_loan': 'private-student-loan',  // Changed from federal to private
      'auto': 'auto-loan',
      'auto_loan': 'auto-loan',
      'personal': 'personal-loan',
      'personal_loan': 'personal-loan',
      'home_equity': 'other',
      'line_of_credit': 'other',
      'loan': 'personal-loan',
      'mortgage': null, // Exclude mortgages - handled in Step 4
      'overdraft': 'other',
      'consumer': 'personal-loan',
      'commercial': 'credit-card',  // Commercial cards also map to credit-card
      'construction': 'other',
      'business': 'other',
    };
    
    const mappedType = liabilityMap[plaidSubtype?.toLowerCase() || ''] || 'other';
    console.log('[PlaidIntakeMapper] Liability mapped to:', mappedType);
    return mappedType;
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
   * Map owner name to intake form owner type
   */
  private static mapOwner(ownerFirstName: string | undefined, userId: number): string {
    // This is a simplified implementation
    // In production, you'd match against actual user and spouse names
    // For now, default to "User" if no owner info, can be edited by user
    if (!ownerFirstName) return 'User';
    
    // TODO: Match against user's first name and spouse's first name from profile
    // If matches spouse name, return 'Spouse'
    // If both names present, return 'Joint'
    
    return 'User'; // Default for now, user can change in UI
  }
  
  /**
   * Get intake form data from Plaid connected accounts
   */
  static async getIntakeFormData(userId: number) {
    try {
      // Get all active Plaid accounts for the user
      const accounts = await db.select()
        .from(plaidAccounts)
        .innerJoin(plaidItems, eq(plaidAccounts.plaidItemId, plaidItems.id))
        .where(and(
          eq(plaidAccounts.userId, userId),
          eq(plaidAccounts.isActive, true),
          eq(plaidItems.status, 'active')
        ));
      
      const assets: any[] = [];
      const liabilities: any[] = [];
      const mortgages: any[] = [];
      
      for (const row of accounts) {
        const account = row.plaid_accounts;
        const item = row.plaid_items;
        
        const balance = parseFloat(account.currentBalance || '0');
        const accountType = account.accountType || 'other';
        const accountSubtype = account.accountSubtype;
        
        // Determine if this is an asset or liability
        const isAsset = this.isAsset(accountType, accountSubtype, balance);
        
        // Get owner from metadata
        const ownerNames = (account.metadata as any)?.ownerNames || [];
        const ownerFirstName = ownerNames[0];
        const owner = this.mapOwner(ownerFirstName, userId);
        
        if (isAsset) {
          // Map to asset format
          const assetType = this.mapToAssetType(accountSubtype);
          if (assetType) {
            const assetData = {
              type: assetType,
              description: `${account.accountName || 'Account'} (${item.institutionName || 'Bank'})`,
              value: Math.abs(balance), // Use absolute value for assets
              owner: owner,
              // Store source info for reference
              _source: {
                plaidAccountId: account.accountId,
                institutionName: item.institutionName,
                lastUpdated: account.lastSynced,
                isImported: true
              }
            };
            console.log('[PlaidIntakeMapper] Adding asset:', {
              accountName: account.accountName,
              subtype: accountSubtype,
              mappedType: assetType
            });
            assets.push(assetData);
          }
        } else {
          // Check if it's a mortgage account
          if (accountSubtype?.toLowerCase() === 'mortgage') {
            // Add to mortgages array for Step 4
            mortgages.push({
              accountName: account.accountName || 'Mortgage Account',
              institution: item.institutionName || 'Bank',
              balance: Math.abs(balance), // Use absolute value
              owner: owner,
              // Store source info for reference
              _source: {
                plaidAccountId: account.accountId,
                institutionName: item.institutionName,
                lastUpdated: account.lastSynced,
                isImported: true
              }
            });
          } else {
            // Map to liability format
            const liabilityType = this.mapToLiabilityType(accountSubtype);
            // Only include if liabilityType is not null (excludes mortgages)
            if (liabilityType !== null && liabilityType !== undefined) {
              const liabilityData = {
                type: liabilityType,
                description: `${account.accountName || 'Account'} (${item.institutionName || 'Bank'})`,
                balance: Math.abs(balance), // Use absolute value for liabilities
                monthlyPayment: 0, // User will need to fill this in
                interestRate: 0, // User will need to fill this in
                owner: owner,
                // Store source info for reference
                _source: {
                  plaidAccountId: account.accountId,
                  institutionName: item.institutionName,
                  lastUpdated: account.lastSynced,
                  isImported: true
                }
              };
              console.log('[PlaidIntakeMapper] Adding liability:', {
                accountName: account.accountName,
                subtype: accountSubtype,
                mappedType: liabilityType
              });
              liabilities.push(liabilityData);
            }
          }
        }
      }
      
      return {
        success: true,
        assets,
        liabilities,
        mortgages,
        totalAssets: assets.length,
        totalLiabilities: liabilities.length,
        totalMortgages: mortgages.length,
        lastSynced: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[PlaidIntakeMapper] Error mapping Plaid data:', error);
      throw new Error(`Failed to map Plaid data for intake form: ${error.message}`);
    }
  }
  
  /**
   * Get a summary of available Plaid accounts for preview
   */
  static async getAccountsSummary(userId: number) {
    try {
      const accounts = await db.select()
        .from(plaidAccounts)
        .innerJoin(plaidItems, eq(plaidAccounts.plaidItemId, plaidItems.id))
        .where(and(
          eq(plaidAccounts.userId, userId),
          eq(plaidAccounts.isActive, true),
          eq(plaidItems.status, 'active')
        ));
      
      const summary = accounts.map(row => {
        const account = row.plaid_accounts;
        const item = row.plaid_items;
        const balance = parseFloat(account.currentBalance || '0');
        
        return {
          id: account.accountId,
          name: account.accountName,
          institution: item.institutionName,
          type: account.accountType,
          subtype: account.accountSubtype,
          balance: balance,
          willMapTo: this.isAsset(
            account.accountType || 'other',
            account.accountSubtype,
            balance
          ) ? 'asset' : 'liability',
          mappedType: this.isAsset(
            account.accountType || 'other',
            account.accountSubtype,
            balance
          ) 
            ? this.mapToAssetType(account.accountSubtype)
            : this.mapToLiabilityType(account.accountSubtype)
        };
      });
      
      return {
        success: true,
        accounts: summary,
        total: summary.length
      };
    } catch (error: any) {
      console.error('[PlaidIntakeMapper] Error getting accounts summary:', error);
      throw new Error(`Failed to get accounts summary: ${error.message}`);
    }
  }
}