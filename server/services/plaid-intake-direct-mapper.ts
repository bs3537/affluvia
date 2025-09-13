import { db } from '../db';
import { financialProfiles, plaidItems, plaidAccounts } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { PlaidService } from './plaid-service';
import { EncryptionService } from './encryption-service';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

/**
 * Service to sync Plaid account data directly to financial_profiles table
 * This replaces the intermediate plaid_accounts storage for immediate intake form updates
 */
export class PlaidIntakeDirectMapper {
  /**
   * Map Plaid account subtype to intake form asset type
   * Based on user-provided mapping guide
   */
  private static mapToAssetType(plaidSubtype: string | null | undefined): string {
    if (!plaidSubtype) return 'Other';
    
    const normalized = plaidSubtype.toLowerCase().replace(/_/g, ' ').trim();
    
    const assetMap: Record<string, string> = {
      // Checking/Savings
      'checking': 'Checking Account',
      'money market': 'Saving Account',
      'cash management': 'Saving Account',
      'savings': 'Savings Account',
      'thrift savings plan': 'Savings Account',
      'isa': 'Savings Account',
      'rdsp': 'Savings Account',
      
      // Retirement accounts
      '401k': '401(k)',
      '401 k': '401(k)',
      '403b': '403(b)',
      '403 b': '403(b)',
      'roth': 'Roth IRA',
      'roth ira': 'Roth IRA',
      'sep ira': 'Traditional IRA',
      'simple ira': 'Traditional IRA',
      'ira': 'Traditional IRA',
      'sarsep': 'Traditional IRA',
      'non-taxable brokerage': 'Traditional IRA',
      'retirement': '401(k)',
      'keogh': '401(k)',
      'keog': '401(k)',
      'profit sharing plan': '401(k)',
      
      // Annuities
      'fixed annuity': 'Qualified Annuities',
      'variable annuity': 'Qualified Annuities',
      'other annuity': 'Qualified Annuities',
      'annuity': 'Qualified Annuities',
      
      // Investment
      'brokerage': 'Taxable Brokerage',
      'investment': 'Taxable Brokerage',
      
      // Insurance
      'life insurance': 'Cash Value Life Insurance',
      'whole life': 'Cash Value Life Insurance',
      'universal life': 'Cash Value Life Insurance',
      'variable life': 'Cash Value Life Insurance',
      
      // Health
      'hsa': 'HSA',
      
      // Other specific types
      'auto': 'Vehicle',
      'business': 'Business Interest',
      
      // Default to Other
      '529': 'Other',
      '401a': 'Other',
      '401 a': 'Other',
      '457b': 'Other',
      '457 b': 'Other',
      'roth 401k': 'Other',
      'roth 401 k': 'Other',
      'crypto exchange': 'Other',
      'mutual fund': 'Other',
      'other insurance': 'Other',
      'paypal': 'Other',
      'pension': 'Other',
      'education saving account': 'Other',
      'irif': 'Other',
      'non-custodial wallet': 'Other',
      'payroll': 'Other',
      'prepaid': 'Other',
      'resp': 'Other',
      'trust': 'Other',
      'ugma': 'Other',
      'utma': 'Other',
      'other': 'Other',
    };
    
    return assetMap[normalized] || 'Other';
  }
  
  /**
   * Map Plaid account subtype to intake form liability type
   */
  private static mapToLiabilityType(plaidSubtype: string | null | undefined): string {
    if (!plaidSubtype) return 'Other';
    
    const normalized = plaidSubtype.toLowerCase().replace(/_/g, ' ').trim();
    
    const liabilityMap: Record<string, string> = {
      'credit card': 'Credit Card',
      'credit': 'Credit Card',
      'student': 'Private Student Loan',
      'student loan': 'Private Student Loan',
      'auto': 'Auto Loan',
      'auto loan': 'Auto Loan',
      'line of credit': 'Other',
      'loan': 'Other',
      'mortgage': 'Mortgage', // Will be handled specially for step 4
      'personal': 'Other',
      'personal loan': 'Other',
      'home equity': 'Other',
      'other': 'Other',
    };
    
    return liabilityMap[normalized] || 'Other';
  }
  
  /**
   * Determine if account is an asset or liability based on Plaid account type
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
    
    // For 'other' type, check specific subtypes
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
  private static mapOwner(
    accountOwnerNames: string[] | undefined,
    userFirstName: string | undefined,
    spouseFirstName: string | undefined
  ): string {
    if (!accountOwnerNames || accountOwnerNames.length === 0) {
      return 'User'; // Default to User (capitalized for intake form)
    }
    
    const userFirst = userFirstName?.toLowerCase().trim();
    const spouseFirst = spouseFirstName?.toLowerCase().trim();
    
    // Extract all first names from the account owner names
    const accountFirstNames = accountOwnerNames.map(name => 
      name?.split(' ')[0]?.toLowerCase().trim()
    ).filter(Boolean);
    
    // Check for joint ownership (both user and spouse names present)
    if (userFirst && spouseFirst && 
        accountFirstNames.includes(userFirst) && 
        accountFirstNames.includes(spouseFirst)) {
      return 'Joint';
    }
    
    // Check for single ownership - User
    if (userFirst && accountFirstNames.includes(userFirst)) {
      return 'User';
    }
    
    // Check for single ownership - Spouse
    if (spouseFirst && accountFirstNames.includes(spouseFirst)) {
      return 'Spouse';
    }
    
    return 'User'; // Default to User if no match
  }
  
  /**
   * Sync all Plaid accounts directly to financial_profiles table
   */
  static async syncAllToProfile(userId: number): Promise<{
    success: boolean;
    syncedAssets: number;
    syncedLiabilities: number;
    syncedMortgages: number;
    errors: any[];
  }> {
    const errors: any[] = [];
    let syncedAssets = 0;
    let syncedLiabilities = 0;
    let syncedMortgages = 0;
    
    try {
      // Get user's profile to get first names
      let [profile] = await db.select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, userId))
        .limit(1);
      
      const userFirstName = profile?.firstName || undefined;
      const spouseFirstName = profile?.spouseName?.split(' ')[0] || undefined;
      
      // Get all active Plaid items for the user
      const items = await db.select()
        .from(plaidItems)
        .where(and(
          eq(plaidItems.userId, userId),
          eq(plaidItems.status, 'active')
        ));
      
      const assets: any[] = [];
      const liabilities: any[] = [];
      let primaryMortgage: any = null;
      const additionalMortgages: any[] = [];
      
      // Process each Plaid item
      for (const item of items) {
        try {
          // Decrypt access token
          const accessToken = EncryptionService.decrypt(item.accessToken);
          
          // Fetch fresh accounts data from Plaid API
          console.log(`[PlaidIntakeDirectMapper] Fetching accounts for item ${item.itemId}`);
          const accountsResponse = await plaidClient.accountsBalanceGet({
            access_token: accessToken,
          });
          
          // Try to get identity data for owner names
          let identityData: any = null;
          try {
            const identityResponse = await plaidClient.identityGet({
              access_token: accessToken,
            });
            identityData = identityResponse.data;
          } catch (error) {
            console.log('[PlaidIntakeDirectMapper] Identity data not available');
          }
          
          // Process each account
          for (const account of accountsResponse.data.accounts) {
            const balance = account.balances.current || 0;
            const accountType = account.type;
            const accountSubtype = account.subtype;
            
            // Get owner names from identity data if available
            let ownerNames: string[] = [];
            if (identityData && identityData.accounts) {
              const identityAccount = identityData.accounts.find((acc: any) => acc.account_id === account.account_id);
              if (identityAccount && identityAccount.owners) {
                ownerNames = identityAccount.owners.flatMap((owner: any) => owner.names || []);
              }
            }
            const owner = this.mapOwner(ownerNames, userFirstName, spouseFirstName);
            
            // Determine if asset or liability
            const isAsset = this.isAsset(accountType, accountSubtype, balance);
            
            if (isAsset) {
              const assetType = this.mapToAssetType(accountSubtype);
              assets.push({
                type: assetType,
                description: account.name || 'Account',
                value: Math.abs(balance),
                owner: owner,
                // Metadata for tracking
                _source: {
                  plaidAccountId: account.account_id,
                  institutionName: item.institutionName,
                  accountSubtype: accountSubtype,
                  lastSynced: new Date().toISOString(),
                  isImported: true
                }
              });
              syncedAssets++;
            } else {
              const liabilityType = this.mapToLiabilityType(accountSubtype);
              
              // Handle mortgages specially
              if (liabilityType === 'Mortgage') {
                const mortgageData = {
                  mortgageBalance: Math.abs(balance),
                  monthlyPayment: 0, // User needs to fill
                  interestRate: 0, // User needs to fill
                  yearsToPayOffMortgage: 0, // User needs to fill
                  owner: owner, // Include owner for mortgage
                  _source: {
                    plaidAccountId: account.account_id,
                    institutionName: item.institutionName,
                    accountName: account.name,
                    lastSynced: new Date().toISOString(),
                    isImported: true
                  }
                };
                
                if (!primaryMortgage) {
                  primaryMortgage = mortgageData;
                } else {
                  additionalMortgages.push(mortgageData);
                }
                syncedMortgages++;
              } else {
                liabilities.push({
                  type: liabilityType,
                  description: account.name || 'Account',
                  balance: Math.abs(balance),
                  monthlyPayment: 0, // User needs to fill
                  interestRate: 0, // User needs to fill
                  owner: owner,
                  _source: {
                    plaidAccountId: account.account_id,
                    institutionName: item.institutionName,
                    accountSubtype: accountSubtype,
                    lastSynced: new Date().toISOString(),
                    isImported: true
                  }
                });
                syncedLiabilities++;
              }
            }
          }
          
          // Also store in plaid_accounts for reference (but not used for display)
          await PlaidService.syncAccounts(item.id, accessToken, userId);
          
        } catch (error: any) {
          console.error(`Error syncing item ${item.itemId}:`, error);
          errors.push({
            itemId: item.itemId,
            institution: item.institutionName,
            error: error.message
          });
        }
      }
      
      // Ensure profile exists
      if (!profile) {
        console.log('[PlaidIntakeDirectMapper] Creating new financial profile for user', userId);
        await db.insert(financialProfiles).values({
          userId,
          assets: JSON.stringify([]),
          liabilities: JSON.stringify([]),
        });
        // Re-fetch the profile
        const [newProfile] = await db.select()
          .from(financialProfiles)
          .where(eq(financialProfiles.userId, userId))
          .limit(1);
        profile = newProfile;
      }
      
      // Merge with existing data instead of overwriting
      const existingAssets = (profile?.assets as any[]) || [];
      const existingLiabilities = (profile?.liabilities as any[]) || [];
      
      // Separate manual and imported entries
      const manualAssets = existingAssets.filter(a => !a._source?.isImported);
      const manualLiabilities = existingLiabilities.filter(l => !l._source?.isImported);
      
      // Merge Plaid data with existing imported entries, preserving manual edits
      const mergedAssets = [...this.mergeWithExisting(existingAssets, assets, 'assets'), ...manualAssets];
      const mergedLiabilities = [...this.mergeWithExisting(existingLiabilities, liabilities, 'liabilities'), ...manualLiabilities];
      
      console.log(`[PlaidIntakeDirectMapper] Saving to database:`);
      console.log(`  - ${assets.length} Plaid assets + ${manualAssets.length} manual = ${mergedAssets.length} total`);
      console.log(`  - ${liabilities.length} Plaid liabilities + ${manualLiabilities.length} manual = ${mergedLiabilities.length} total`);
      
      // Update financial profile with the synced data
      const updateData: any = {
        assets: JSON.stringify(mergedAssets),
        liabilities: JSON.stringify(mergedLiabilities),
      };
      
      // Add mortgage data if exists
      if (primaryMortgage) {
        // Merge with existing primary residence data using the merge helper
        const existingResidence = profile?.primaryResidence as any || {};
        updateData.primaryResidence = JSON.stringify(
          this.mergePrimaryResidence(existingResidence, primaryMortgage)
        );
      }
      
      if (additionalMortgages.length > 0) {
        // Merge with existing additional properties preserving manual edits
        const existingProperties = profile?.additionalProperties as any[] || [];
        const manualProperties = existingProperties.filter((p: any) => !p._source?.isImported);
        const mergedImportedProperties = this.mergeWithExisting(
          existingProperties.filter((p: any) => p._source?.isImported),
          additionalMortgages,
          'additionalProperties'
        );
        updateData.additionalProperties = JSON.stringify([
          ...manualProperties,
          ...mergedImportedProperties
        ]);
      }
      
      // Update the profile
      await db.update(financialProfiles)
        .set(updateData)
        .where(eq(financialProfiles.userId, userId));
      
      return {
        success: true,
        syncedAssets,
        syncedLiabilities,
        syncedMortgages,
        errors
      };
      
    } catch (error: any) {
      console.error('Error in syncAllToProfile:', error);
      return {
        success: false,
        syncedAssets,
        syncedLiabilities,
        syncedMortgages,
        errors: [...errors, { general: error.message }]
      };
    }
  }
  
  /**
   * Get accounts formatted for display from financial_profiles AND plaid_accounts
   * Shows both what's synced to profile and what's available to sync
   */
  static async getProfileMappedAccounts(userId: number): Promise<{
    success: boolean;
    accounts: any[];
    totalAccounts: number;
  }> {
    try {
      // First, try to get from financial_profiles (already synced data)
      const [profile] = await db.select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, userId))
        .limit(1);
      
      // Also get from plaid_accounts to show what's available
      const plaidAccountsData = await db.select()
        .from(plaidAccounts as any)
        .innerJoin(plaidItems, eq(plaidAccounts.plaidItemId, plaidItems.id))
        .where(and(
          eq(plaidAccounts.userId, userId),
          eq(plaidAccounts.isActive, true),
          eq(plaidItems.status, 'active')
        ));
      
      // If we have plaid accounts but no synced data in profile, show plaid accounts
      if (plaidAccountsData.length > 0 && (!profile || 
          ((profile.assets as any[])?.filter(a => a._source?.isImported).length === 0 &&
           (profile.liabilities as any[])?.filter(l => l._source?.isImported).length === 0))) {
        
        console.log('[PlaidIntakeDirectMapper] Showing available Plaid accounts to sync');
        
        // Format plaid accounts for display
        const accountsByInstitution: Record<string, any> = {};
        
        for (const row of plaidAccountsData) {
          const account = row.plaid_accounts;
          const item = row.plaid_items;
          
          const institutionName = item.institutionName || 'Unknown Institution';
          
          if (!accountsByInstitution[institutionName]) {
            accountsByInstitution[institutionName] = {
              id: item.id,
              institutionName,
              institutionId: item.institutionId,
              status: 'ready_to_sync', // Indicate these need syncing
              lastSuccessfulUpdate: account.lastSynced,
              accounts: []
            };
          }
          
          accountsByInstitution[institutionName].accounts.push({
            id: account.id,
            accountId: account.accountId,
            accountName: account.accountName || account.officialName || 'Account',
            accountType: account.accountType,
            accountSubtype: account.accountSubtype,
            currentBalance: parseFloat(account.currentBalance || '0'),
            owner: 'User', // Default, will be determined during sync
            lastSynced: account.lastSynced,
            metadata: account.metadata || {}
          });
        }
        
        const institutions = Object.values(accountsByInstitution);
        const totalAccounts = institutions.reduce((sum, inst) => sum + inst.accounts.length, 0);
        
        return {
          success: true,
          accounts: institutions,
          totalAccounts
        };
      }
      
      if (!profile) {
        return { success: false, accounts: [], totalAccounts: 0 };
      }
      
      // Parse JSONB fields
      const assets = (profile.assets as any[]) || [];
      const liabilities = (profile.liabilities as any[]) || [];
      const primaryResidence = profile.primaryResidence as any;
      const additionalProperties = (profile.additionalProperties as any[]) || [];
      
      // Format for display - group by institution
      const accountsByInstitution: Record<string, any> = {};
      
      // Process assets
      assets.filter(a => a._source?.isImported).forEach(asset => {
        const institutionName = asset._source.institutionName || 'Unknown Institution';
        
        if (!accountsByInstitution[institutionName]) {
          accountsByInstitution[institutionName] = {
            id: Math.random(), // Generate temporary ID
            institutionName,
            institutionId: institutionName,
            status: 'active',
            lastSuccessfulUpdate: asset._source.lastSynced,
            accounts: []
          };
        }
        
        accountsByInstitution[institutionName].accounts.push({
          id: Math.random(),
          accountId: asset._source.plaidAccountId,
          accountName: asset.description,
          accountType: 'asset',
          accountSubtype: asset.type,
          currentBalance: asset.value,
          owner: asset.owner === 'Spouse' ? 'Spouse' : (asset.owner === 'Joint' ? 'Joint' : 'User'),
          lastSynced: asset._source.lastSynced,
          metadata: { ownerNames: [asset.owner] }
        });
      });
      
      // Process liabilities
      liabilities.filter(l => l._source?.isImported).forEach(liability => {
        const institutionName = liability._source.institutionName || 'Unknown Institution';
        
        if (!accountsByInstitution[institutionName]) {
          accountsByInstitution[institutionName] = {
            id: Math.random(),
            institutionName,
            institutionId: institutionName,
            status: 'active',
            lastSuccessfulUpdate: liability._source.lastSynced,
            accounts: []
          };
        }
        
        accountsByInstitution[institutionName].accounts.push({
          id: Math.random(),
          accountId: liability._source.plaidAccountId,
          accountName: liability.description,
          accountType: 'liability',
          accountSubtype: liability.type,
          currentBalance: -liability.balance, // Negative for display
          owner: liability.owner === 'Spouse' ? 'Spouse' : (liability.owner === 'Joint' ? 'Joint' : 'User'),
          lastSynced: liability._source.lastSynced,
          metadata: { ownerNames: [liability.owner] }
        });
      });
      
      // Process mortgages
      if (primaryResidence?._source?.isImported) {
        const institutionName = primaryResidence._source.institutionName || 'Unknown Institution';
        
        if (!accountsByInstitution[institutionName]) {
          accountsByInstitution[institutionName] = {
            id: Math.random(),
            institutionName,
            institutionId: institutionName,
            status: 'active',
            lastSuccessfulUpdate: primaryResidence._source.lastSynced,
            accounts: []
          };
        }
        
        accountsByInstitution[institutionName].accounts.push({
          id: Math.random(),
          accountId: primaryResidence._source.plaidAccountId,
          accountName: primaryResidence._source.accountName || 'Primary Mortgage',
          accountType: 'liability',
          accountSubtype: 'Mortgage',
          currentBalance: -primaryResidence.mortgageBalance,
          owner: 'User',
          lastSynced: primaryResidence._source.lastSynced,
          metadata: { ownerNames: ['User'] }
        });
      }
      
      const institutions = Object.values(accountsByInstitution);
      const totalAccounts = institutions.reduce((sum, inst) => sum + inst.accounts.length, 0);
      
      return {
        success: true,
        accounts: institutions,
        totalAccounts
      };
      
    } catch (error: any) {
      console.error('Error getting profile mapped accounts:', error);
      return {
        success: false,
        accounts: [],
        totalAccounts: 0
      };
    }
  }
  
  /**
   * Sync a specific Plaid item to profile
   */
  static async syncItemToProfile(itemId: number, userId: number): Promise<{
    success: boolean;
    message: string;
    accountCount: number;
  }> {
    try {
      // For now, just sync all - in future could optimize to sync specific item
      const result = await this.syncAllToProfile(userId);
      
      return {
        success: result.success,
        message: `Synced ${result.syncedAssets + result.syncedLiabilities + result.syncedMortgages} accounts`,
        accountCount: result.syncedAssets + result.syncedLiabilities + result.syncedMortgages
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        accountCount: 0
      };
    }
  }

  /**
   * Helper to merge Plaid data with existing profile data, preserving manual fields
   */
  private static mergeWithExisting(existing: any[], latestPlaid: any[], type: 'assets' | 'liabilities' | 'additionalProperties'): any[] {
    // For each Plaid item, check if we have existing data with manual overrides
    return latestPlaid.map(plaidItem => {
      // Find existing imported item by plaidAccountId
      const existingItem = existing.find(ex => 
        ex._source?.isImported && 
        ex._source?.plaidAccountId === plaidItem._source?.plaidAccountId
      );

      if (existingItem) {
        // Merge: update Plaid fields but preserve manual overrides
        if (type === 'liabilities') {
          return {
            ...plaidItem, // Update balance and other Plaid fields
            // Preserve manual overrides if they were set (non-zero values)
            monthlyPayment: (existingItem.monthlyPayment && existingItem.monthlyPayment > 0) 
              ? existingItem.monthlyPayment 
              : plaidItem.monthlyPayment,
            interestRate: (existingItem.interestRate && existingItem.interestRate > 0) 
              ? existingItem.interestRate 
              : plaidItem.interestRate,
            // Preserve any other manual fields as needed
          };
        }
        
        if (type === 'additionalProperties') {
          return {
            ...plaidItem, // Update Plaid fields
            // Preserve manual overrides for real estate properties
            owner: existingItem.owner || plaidItem.owner,
            marketValue: (existingItem.marketValue && existingItem.marketValue > 0)
              ? existingItem.marketValue
              : plaidItem.marketValue,
            monthlyPayment: (existingItem.monthlyPayment && existingItem.monthlyPayment > 0)
              ? existingItem.monthlyPayment
              : plaidItem.monthlyPayment,
            interestRate: (existingItem.interestRate && existingItem.interestRate > 0)
              ? existingItem.interestRate
              : plaidItem.interestRate,
            yearsToPayOffMortgage: (existingItem.yearsToPayOffMortgage && existingItem.yearsToPayOffMortgage > 0)
              ? existingItem.yearsToPayOffMortgage
              : plaidItem.yearsToPayOffMortgage,
          };
        }
        
        // For assets, just update the Plaid fields (balance, etc.)
        return plaidItem;
      }
      
      // New imported item, use as-is
      return plaidItem;
    });
  }

  /**
   * Merge primary residence, preserving manual mortgage fields
   */
  private static mergePrimaryResidence(existing: any, latestPlaid: any): any {
    if (!existing || !latestPlaid) return latestPlaid || existing;
    
    // If existing is not imported, keep it as manual entry
    if (!existing._source?.isImported) return existing;
    
    // If both are imported, merge preserving manual fields
    return {
      ...latestPlaid, // Update Plaid fields like balance
      // Preserve manual fields for Step 4 real estate
      owner: existing.owner || latestPlaid.owner,
      marketValue: (existing.marketValue && existing.marketValue > 0)
        ? existing.marketValue
        : latestPlaid.marketValue,
      monthlyPayment: (existing.monthlyPayment && existing.monthlyPayment > 0) 
        ? existing.monthlyPayment 
        : latestPlaid.monthlyPayment,
      interestRate: (existing.interestRate && existing.interestRate > 0) 
        ? existing.interestRate 
        : latestPlaid.interestRate,
      yearsToPayOffMortgage: (existing.yearsToPayOffMortgage && existing.yearsToPayOffMortgage > 0) 
        ? existing.yearsToPayOffMortgage 
        : latestPlaid.yearsToPayOffMortgage,
      // Preserve address if manually entered
      address: existing.address || latestPlaid.address,
    };
  }
}