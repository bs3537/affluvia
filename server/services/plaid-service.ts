import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { db } from '../db';
import { 
  plaidItems, 
  plaidAccounts, 
  plaidTransactions, 
  plaidInvestmentHoldings,
  plaidLiabilities,
  plaidWebhookEvents,
  plaidSyncStatus,
  plaidSyncSchedule
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { NotificationService } from './notification-service';
import { EncryptionService } from './encryption-service';
import { PlaidSyncRecovery } from './plaid-sync-recovery';
import PlaidConfig from '../config/plaid-config';

// Initialize Plaid client using PlaidConfig
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = PlaidConfig.getPlaidSecret();

// Validate configuration
const configValidation = PlaidConfig.validateConfiguration();
if (!configValidation.valid) {
  console.error('[PlaidService] Configuration errors:', configValidation.errors);
}

// Log configuration for debugging (without exposing full secrets)
console.log('[PlaidService] Initializing with:', {
  environment: PLAID_ENV,
  clientId: PLAID_CLIENT_ID ? `${PLAID_CLIENT_ID.substring(0, 8)}...` : 'NOT SET',
  secretConfigured: !!PLAID_SECRET,
  webhookUrl: PlaidConfig.getWebhookUrl(),
  redirectUri: PlaidConfig.getRedirectUri()
});

// Use PlaidConfig to get proper configuration with Plaid-Version header
const configuration = PlaidConfig.getConfiguration();
const plaidClient = new PlaidApi(configuration);


export class PlaidService {
  /**
   * Create a Link token for initializing Plaid Link
   */
  static async createLinkToken(userId: number, userName?: string) {
    try {
      // Validate credentials are available
      if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
        throw new Error('Plaid credentials not configured. Please check environment variables.');
      }

      // Get available products from environment
      // Note: 'accounts' is not a valid product, but is implicitly included with auth/transactions
      // Adding 'identity' to get account owner names
      const productsStr = process.env.PLAID_PRODUCTS || 'transactions,investments,liabilities,identity';
      const products = productsStr.split(',').map(p => p.trim()) as Products[];
      
      const request = {
        user: {
          client_user_id: userId.toString(),
        },
        client_name: 'Affluvia Financial',
        products: products,
        country_codes: [CountryCode.Us],
        language: 'en',
        webhook: process.env.PLAID_WEBHOOK_URL || `${process.env.APP_ORIGIN || 'http://localhost:3004'}/api/plaid/webhook`,
      };

      // Don't include redirect_uri for sandbox testing
      // Uncomment below when OAuth is needed for production
      // if (process.env.PLAID_REDIRECT_URI) {
      //   (request as any).redirect_uri = process.env.PLAID_REDIRECT_URI;
      // }

      console.log('[PlaidService] Creating link token for user:', userId);
      console.log('[PlaidService] Request config:', {
        products,
        webhook: request.webhook,
        environment: PLAID_ENV,
        country_codes: request.country_codes,
        client_name: request.client_name,
        language: request.language
      });
      console.log('[PlaidService] Full request object:', JSON.stringify(request, null, 2));

      const response = await plaidClient.linkTokenCreate(request);
      
      console.log('[PlaidService] Link token created successfully');
      console.log('[PlaidService] Link token details:', {
        link_token: response.data.link_token ? `${response.data.link_token.substring(0, 20)}...` : 'null',
        expiration: response.data.expiration,
        request_id: response.data.request_id
      });
      return response.data;
    } catch (error: any) {
      console.error('[PlaidService] Error creating link token:', error.response?.data || error);
      
      // Provide more specific error messages
      if (error.response?.data?.error_code === 'INVALID_API_KEYS') {
        throw new Error('Invalid Plaid API keys. Please check your credentials.');
      } else if (error.response?.data?.error_message) {
        throw new Error(`Plaid error: ${error.response.data.error_message}`);
      } else {
        throw new Error(`Failed to create link token: ${error.message}`);
      }
    }
  }

  /**
   * Create link token for update mode (re-authentication)
   */
  static async createUpdateLinkToken(accessToken: string, userId: number, userName?: string) {
    try {
      const request = {
        user: {
          client_user_id: userId.toString(),
        },
        client_name: 'Affluvia Financial',
        country_codes: [CountryCode.Us],
        language: 'en',
        access_token: accessToken, // This puts Link in update mode
        webhook: process.env.PLAID_WEBHOOK_URL || `${process.env.APP_ORIGIN || 'http://localhost:3004'}/api/plaid/webhook`,
      };

      const response = await plaidClient.linkTokenCreate(request);
      return response.data;
    } catch (error: any) {
      console.error('Error creating update link token:', error);
      throw new Error(`Failed to create update link token: ${error.message}`);
    }
  }

  /**
   * Exchange public token for access token
   */
  static async exchangePublicToken(publicToken: string, userId: number) {
    console.log('[PlaidService] Starting public token exchange for user:', userId);
    console.log('[PlaidService] Public token:', publicToken ? `${publicToken.substring(0, 20)}...` : 'null');
    
    try {
      // Exchange public token for access token
      console.log('[PlaidService] Calling Plaid API to exchange token...');
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const { access_token, item_id } = exchangeResponse.data;
      console.log('[PlaidService] Token exchange successful');
      console.log('[PlaidService] Item ID:', item_id);
      console.log('[PlaidService] Access token:', access_token ? `${access_token.substring(0, 20)}...` : 'null');

      // Get item metadata
      console.log('[PlaidService] Fetching item metadata...');
      const itemResponse = await plaidClient.itemGet({
        access_token,
      });

      const institution = itemResponse.data.item.institution_id 
        ? await plaidClient.institutionsGetById({
            institution_id: itemResponse.data.item.institution_id,
            country_codes: [CountryCode.Us],
          })
        : null;

      // Store encrypted access token in database
      console.log('[PlaidService] Encrypting access token...');
      const encryptedToken = EncryptionService.encrypt(access_token);
      
      console.log('[PlaidService] Inserting Plaid item into database...');
      console.log('[PlaidService] User ID:', userId);
      console.log('[PlaidService] Item ID:', item_id);
      console.log('[PlaidService] Institution:', institution?.data.institution.name || 'Unknown');
      
      const [plaidItem] = await db.insert(plaidItems).values({
        userId,
        accessToken: encryptedToken,
        itemId: item_id,
        institutionId: itemResponse.data.item.institution_id || undefined,
        institutionName: institution?.data.institution.name || undefined,
        consentExpirationTime: itemResponse.data.item.consent_expiration_time 
          ? new Date(itemResponse.data.item.consent_expiration_time) 
          : undefined,
      }).returning();
      
      console.log('[PlaidService] Plaid item stored successfully, ID:', plaidItem.id);

      // Fetch and store accounts
      console.log('[PlaidService] Starting account sync...');
      const accountCount = await this.syncAccounts(plaidItem.id, access_token, userId);
      console.log('[PlaidService] Account sync completed, count:', accountCount);

      // Create sync schedule for monthly syncing
      await this.createSyncSchedule(userId);

      // Send success notification
      await NotificationService.notifyPlaidConnectionSuccess(
        userId,
        institution?.data.institution.name || 'Bank',
        accountCount
      );

      return {
        success: true,
        itemId: item_id,
        institutionName: institution?.data.institution.name,
      };
    } catch (error: any) {
      console.error('[PlaidService] ERROR exchanging public token');
      console.error('[PlaidService] Error details:', {
        type: error.constructor.name,
        message: error.message,
        code: error.code,
        status: error.status,
        stack: error.stack
      });
      
      // Check for specific Plaid API errors
      if (error.response?.data) {
        console.error('[PlaidService] Plaid API response:', {
          error_type: error.response.data.error_type,
          error_code: error.response.data.error_code,
          error_message: error.response.data.error_message,
          display_message: error.response.data.display_message,
          documentation_url: error.response.data.documentation_url,
          request_id: error.response.data.request_id
        });
        
        // Common Plaid error troubleshooting
        if (error.response.data.error_code === 'INVALID_API_KEYS') {
          console.error('[PlaidService] CHECK: Ensure PLAID_CLIENT_ID and PLAID_SECRET_SANDBOX are correctly set in .env');
        } else if (error.response.data.error_code === 'INVALID_PUBLIC_TOKEN') {
          console.error('[PlaidService] CHECK: Public token may have expired or been used already');
        } else if (error.response.data.error_code === 'INVALID_HEADERS') {
          console.error('[PlaidService] CHECK: Missing required headers (Plaid-Version, etc.)');
        }
      }
      
      // Send error notification with more context
      const errorMessage = error.response?.data?.display_message || 
                          error.response?.data?.error_message || 
                          error.message || 
                          'Failed to connect account';
      
      await NotificationService.notifyPlaidConnectionError(
        userId,
        errorMessage
      );
      
      throw new Error(`Failed to exchange public token: ${errorMessage}`);
    }
  }

  /**
   * Sync accounts for a Plaid item
   */
  static async syncAccounts(plaidItemId: number, accessToken: string, userId: number): Promise<number> {
    try {
      console.log('[PlaidService] Fetching real-time balances for plaidItemId:', plaidItemId);
      
      // Use accountsBalanceGet for real-time balance data instead of cached accountsGet
      // This ensures we get the most up-to-date balance information
      const accountsResponse = await plaidClient.accountsBalanceGet({
        access_token: accessToken,
      });

      const accounts = accountsResponse.data.accounts;
      console.log('[PlaidService] Retrieved', accounts.length, 'accounts with real-time balances');
      
      // Try to fetch identity data for account owner names
      let identityData: any = null;
      try {
        console.log('[PlaidService] Fetching identity data for account owners...');
        const identityResponse = await plaidClient.identityGet({
          access_token: accessToken,
        });
        identityData = identityResponse.data;
        console.log('[PlaidService] Identity data retrieved successfully');
      } catch (error) {
        console.log('[PlaidService] Identity data not available (product may not be enabled):', error);
        // Continue without identity data - it's optional
      }

      // Store or update accounts
      for (const account of accounts) {
        // Get owner names for this account from identity data
        let ownerNames: string[] = [];
        let ownerFirstNames: string[] = [];
        if (identityData && identityData.accounts) {
          const identityAccount = identityData.accounts.find((acc: any) => acc.account_id === account.account_id);
          if (identityAccount && identityAccount.owners) {
            // Get full names for logging
            ownerNames = identityAccount.owners.flatMap((owner: any) => owner.names || []);
            // Extract only first names for storage
            ownerFirstNames = ownerNames.map((fullName: string) => {
              // Split the name and take the first part
              const nameParts = fullName.trim().split(' ');
              return nameParts[0] || fullName;
            });
          }
        }
        
        // Log balance and owner information for debugging
        console.log(`[PlaidService] Account ${account.name} (${account.mask}):`, {
          current: account.balances.current,
          available: account.balances.available,
          limit: account.balances.limit,
          currency: account.balances.iso_currency_code,
          fullOwnerNames: ownerNames.length > 0 ? ownerNames : 'Not available',
          storedFirstNames: ownerFirstNames.length > 0 ? ownerFirstNames : 'Not available'
        });
        
        const existingAccount = await db.select()
          .from(plaidAccounts)
          .where(eq(plaidAccounts.accountId, account.account_id))
          .limit(1);

        // Check if account was previously marked as inactive (deleted by user)
        // If so, skip updating it during sync
        if (existingAccount.length > 0 && existingAccount[0].isActive === false) {
          console.log(`[PlaidService] Skipping sync for inactive account ${account.name} (${account.mask})`);
          continue; // Skip this account - user has deleted it
        }

        const accountData = {
          plaidItemId,
          userId,
          accountId: account.account_id,
          accountName: account.name,
          officialName: account.official_name || undefined,
          accountType: account.type,
          accountSubtype: account.subtype || undefined,
          currentBalance: account.balances.current?.toString() || undefined,
          availableBalance: account.balances.available?.toString() || undefined,
          creditLimit: account.balances.limit?.toString() || undefined,
          currency: account.balances.iso_currency_code || 'USD',
          mask: account.mask || undefined,
          isActive: existingAccount.length > 0 ? existingAccount[0].isActive : true,  // Preserve existing isActive state
          lastSynced: new Date(),
          metadata: {
            ...(existingAccount[0]?.metadata as any || {}),
            ownerNames: ownerFirstNames.length > 0 ? ownerFirstNames : undefined,
            // Optionally store full names separately if needed for audit/compliance
            fullOwnerNames: ownerNames.length > 0 ? ownerNames : undefined
          }
        };

        if (existingAccount.length > 0) {
          await db.update(plaidAccounts)
            .set({ ...accountData, updatedAt: new Date() })
            .where(eq(plaidAccounts.id, existingAccount[0].id));
        } else {
          await db.insert(plaidAccounts).values(accountData);
        }
      }

      // Update sync status
      await this.updateSyncStatus(userId, 'accounts');

      return accounts.length;
    } catch (error: any) {
      console.error('Error syncing accounts:', error);
      
      // Record failure for recovery
      await PlaidSyncRecovery.recordSyncFailure(
        plaidItemId,
        userId,
        'accounts',
        error
      );
      
      throw new Error(`Failed to sync accounts: ${error.message}`);
    }
  }

  /**
   * Sync transactions for a user
   */
  static async syncTransactions(userId: number, startDate?: Date, endDate?: Date) {
    try {
      // Get all active Plaid items for the user
      const items = await db.select()
        .from(plaidItems)
        .where(and(
          eq(plaidItems.userId, userId),
          eq(plaidItems.status, 'active')
        ));

      const allTransactions = [];

      for (const item of items) {
        const accessToken = EncryptionService.decrypt(item.accessToken);
        
        // Set date range (default to last 30 days)
        const end = endDate || new Date();
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const transactionsResponse = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
        });

        const transactions = transactionsResponse.data.transactions;
        
        // Get account mapping
        const accounts = await db.select()
          .from(plaidAccounts)
          .where(eq(plaidAccounts.plaidItemId, item.id));
        
        const accountMap = new Map(accounts.map(a => [a.accountId, a.id]));

        // Store transactions
        for (const transaction of transactions) {
          const plaidAccountId = accountMap.get(transaction.account_id);
          if (!plaidAccountId) continue;

          const existingTransaction = await db.select()
            .from(plaidTransactions)
            .where(eq(plaidTransactions.transactionId, transaction.transaction_id))
            .limit(1);

          const transactionData = {
            plaidAccountId,
            userId,
            transactionId: transaction.transaction_id,
            amount: transaction.amount.toString(),
            date: new Date(transaction.date),
            authorizedDate: transaction.authorized_date 
              ? new Date(transaction.authorized_date) 
              : undefined,
            name: transaction.name,
            merchantName: transaction.merchant_name || undefined,
            category: transaction.category || undefined,
            primaryCategory: transaction.category?.[0] || undefined,
            detailedCategory: transaction.category?.[transaction.category.length - 1] || undefined,
            pending: transaction.pending,
            paymentChannel: transaction.payment_channel,
            location: transaction.location || undefined,
            accountOwner: transaction.account_owner || undefined,
            isoCurrencyCode: transaction.iso_currency_code || 'USD',
            unofficialCurrencyCode: transaction.unofficial_currency_code || undefined,
          };

          if (existingTransaction.length === 0) {
            await db.insert(plaidTransactions).values(transactionData);
          }
        }

        allTransactions.push(...transactions);
      }

      // Update sync status
      await this.updateSyncStatus(userId, 'transactions');

      return allTransactions;
    } catch (error: any) {
      console.error('Error syncing transactions:', error);
      throw new Error(`Failed to sync transactions: ${error.message}`);
    }
  }

  /**
   * Sync investment holdings for a user
   */
  static async syncInvestmentHoldings(userId: number) {
    try {
      // Get all active investment accounts
      const items = await db.select()
        .from(plaidItems)
        .where(and(
          eq(plaidItems.userId, userId),
          eq(plaidItems.status, 'active')
        ));

      const allHoldings = [];

      for (const item of items) {
        const accessToken = EncryptionService.decrypt(item.accessToken);
        
        try {
          const holdingsResponse = await plaidClient.investmentsHoldingsGet({
            access_token: accessToken,
          });

          const holdings = holdingsResponse.data.holdings;
          const securities = holdingsResponse.data.securities;
          
          // Create security map
          const securityMap = new Map(securities.map(s => [s.security_id, s]));
          
          // Get account mapping
          const accounts = await db.select()
            .from(plaidAccounts)
            .where(and(
              eq(plaidAccounts.plaidItemId, item.id),
              eq(plaidAccounts.accountType, 'investment')
            ));
          
          const accountMap = new Map(accounts.map(a => [a.accountId, a.id]));

          // Store holdings
          for (const holding of holdings) {
            const plaidAccountId = accountMap.get(holding.account_id);
            if (!plaidAccountId) continue;

            const security = securityMap.get(holding.security_id);

            await db.insert(plaidInvestmentHoldings).values({
              plaidAccountId,
              userId,
              holdingId: `${holding.account_id}_${holding.security_id}`,
              securityId: holding.security_id,
              costBasis: holding.cost_basis?.toString() || undefined,
              quantity: holding.quantity.toString(),
              price: security?.close_price?.toString() || undefined,
              priceAsOf: security?.close_price_as_of 
                ? new Date(security.close_price_as_of) 
                : undefined,
              value: (holding.quantity * (security?.close_price || 0)).toString(),
              symbol: security?.ticker_symbol || undefined,
              name: security?.name || undefined,
              type: security?.type || undefined,
              isoCurrencyCode: holding.iso_currency_code || 'USD',
              unofficialCurrencyCode: holding.unofficial_currency_code || undefined,
              lastSynced: new Date(),
            }).onConflictDoUpdate({
              target: [plaidInvestmentHoldings.holdingId],
              set: {
                quantity: holding.quantity.toString(),
                costBasis: holding.cost_basis?.toString() || undefined,
                price: security?.close_price?.toString() || undefined,
                value: (holding.quantity * (security?.close_price || 0)).toString(),
                lastSynced: new Date(),
                updatedAt: new Date(),
              },
            });
          }

          allHoldings.push(...holdings);
        } catch (error) {
          console.log(`Investment holdings not available for item ${item.id}`);
        }
      }

      // Update sync status
      await this.updateSyncStatus(userId, 'holdings');

      return allHoldings;
    } catch (error: any) {
      console.error('Error syncing investment holdings:', error);
      throw new Error(`Failed to sync investment holdings: ${error.message}`);
    }
  }

  /**
   * Sync liabilities for a user
   */
  static async syncLiabilities(userId: number) {
    try {
      const items = await db.select()
        .from(plaidItems)
        .where(and(
          eq(plaidItems.userId, userId),
          eq(plaidItems.status, 'active')
        ));

      const allLiabilities = [];

      for (const item of items) {
        const accessToken = EncryptionService.decrypt(item.accessToken);
        
        try {
          const liabilitiesResponse = await plaidClient.liabilitiesGet({
            access_token: accessToken,
          });

          const liabilities = liabilitiesResponse.data.liabilities;
          
          // Get account mapping
          const accounts = await db.select()
            .from(plaidAccounts)
            .where(eq(plaidAccounts.plaidItemId, item.id));
          
          const accountMap = new Map(accounts.map(a => [a.accountId, a.id]));

          // Process mortgages
          if (liabilities.mortgage) {
            for (const mortgage of liabilities.mortgage) {
              const plaidAccountId = accountMap.get(mortgage.account_id);
              if (!plaidAccountId) continue;

              await db.insert(plaidLiabilities).values({
                plaidAccountId,
                userId,
                liabilityType: 'mortgage',
                currentBalance: mortgage.current?.toString() || undefined,
                originalBalance: mortgage.origination_principal_amount?.toString() || undefined,
                nextPaymentDueDate: mortgage.next_payment_due_date 
                  ? new Date(mortgage.next_payment_due_date) 
                  : undefined,
                interestRate: mortgage.interest_rate?.percentage?.toString() || undefined,
                loanTermMonths: mortgage.loan_term ? parseInt(mortgage.loan_term) : undefined,
                originationDate: mortgage.origination_date 
                  ? new Date(mortgage.origination_date) 
                  : undefined,
                principalBalance: mortgage.principal?.toString() || undefined,
                escrowBalance: mortgage.escrow_balance?.toString() || undefined,
                lastPaymentAmount: mortgage.last_payment_amount?.toString() || undefined,
                lastPaymentDate: mortgage.last_payment_date 
                  ? new Date(mortgage.last_payment_date) 
                  : undefined,
                ytdInterestPaid: mortgage.ytd_interest_paid?.toString() || undefined,
                ytdPrincipalPaid: mortgage.ytd_principal_paid?.toString() || undefined,
                metadata: mortgage,
                lastSynced: new Date(),
              }).onConflictDoUpdate({
                target: [plaidLiabilities.plaidAccountId],
                set: {
                  currentBalance: mortgage.current?.toString() || undefined,
                  nextPaymentDueDate: mortgage.next_payment_due_date 
                    ? new Date(mortgage.next_payment_due_date) 
                    : undefined,
                  principalBalance: mortgage.principal?.toString() || undefined,
                  lastSynced: new Date(),
                  updatedAt: new Date(),
                },
              });
            }
          }

          // Process student loans
          if (liabilities.student) {
            for (const loan of liabilities.student) {
              const plaidAccountId = accountMap.get(loan.account_id);
              if (!plaidAccountId) continue;

              await db.insert(plaidLiabilities).values({
                plaidAccountId,
                userId,
                liabilityType: 'student_loan',
                currentBalance: loan.balance?.toString() || undefined,
                originalBalance: loan.original_principal_amount?.toString() || undefined,
                minimumPayment: loan.minimum_payment_amount?.toString() || undefined,
                nextPaymentDueDate: loan.next_payment_due_date 
                  ? new Date(loan.next_payment_due_date) 
                  : undefined,
                interestRate: loan.interest_rate?.percentage?.toString() || undefined,
                originationDate: loan.origination_date 
                  ? new Date(loan.origination_date) 
                  : undefined,
                lastPaymentAmount: loan.last_payment_amount?.toString() || undefined,
                lastPaymentDate: loan.last_payment_date 
                  ? new Date(loan.last_payment_date) 
                  : undefined,
                ytdInterestPaid: loan.ytd_interest_paid?.toString() || undefined,
                ytdPrincipalPaid: loan.ytd_principal_paid?.toString() || undefined,
                metadata: loan,
                lastSynced: new Date(),
              }).onConflictDoUpdate({
                target: [plaidLiabilities.plaidAccountId],
                set: {
                  currentBalance: loan.balance?.toString() || undefined,
                  minimumPayment: loan.minimum_payment_amount?.toString() || undefined,
                  nextPaymentDueDate: loan.next_payment_due_date 
                    ? new Date(loan.next_payment_due_date) 
                    : undefined,
                  lastSynced: new Date(),
                  updatedAt: new Date(),
                },
              });
            }
          }

          // Process credit cards
          if (liabilities.credit) {
            for (const credit of liabilities.credit) {
              const plaidAccountId = accountMap.get(credit.account_id);
              if (!plaidAccountId) continue;

              await db.insert(plaidLiabilities).values({
                plaidAccountId,
                userId,
                liabilityType: 'credit_card',
                currentBalance: credit.balance?.toString() || undefined,
                minimumPayment: credit.minimum_payment_amount?.toString() || undefined,
                nextPaymentDueDate: credit.next_payment_due_date 
                  ? new Date(credit.next_payment_due_date) 
                  : undefined,
                apr: credit.aprs?.find(apr => apr.apr_type === 'balance_transfer')?.apr_percentage?.toString() || undefined,
                lastPaymentAmount: credit.last_payment_amount?.toString() || undefined,
                lastPaymentDate: credit.last_payment_date 
                  ? new Date(credit.last_payment_date) 
                  : undefined,
                metadata: credit,
                lastSynced: new Date(),
              }).onConflictDoUpdate({
                target: [plaidLiabilities.plaidAccountId],
                set: {
                  currentBalance: credit.balance?.toString() || undefined,
                  minimumPayment: credit.minimum_payment_amount?.toString() || undefined,
                  nextPaymentDueDate: credit.next_payment_due_date 
                    ? new Date(credit.next_payment_due_date) 
                    : undefined,
                  lastSynced: new Date(),
                  updatedAt: new Date(),
                },
              });
            }
          }

          allLiabilities.push(liabilities);
        } catch (error) {
          console.log(`Liabilities not available for item ${item.id}`);
        }
      }

      // Update sync status
      await this.updateSyncStatus(userId, 'liabilities');

      return allLiabilities;
    } catch (error: any) {
      console.error('Error syncing liabilities:', error);
      throw new Error(`Failed to sync liabilities: ${error.message}`);
    }
  }

  /**
   * Get all linked accounts for a user
   */
  static async getUserAccounts(userId: number) {
    try {
      const accounts = await db.select()
        .from(plaidAccounts)
        .where(and(
          eq(plaidAccounts.userId, userId),
          eq(plaidAccounts.isActive, true)
        ));

      return accounts;
    } catch (error: any) {
      console.error('Error getting user accounts:', error);
      throw new Error(`Failed to get user accounts: ${error.message}`);
    }
  }

  /**
   * Remove a Plaid item and all associated data
   */
  static async removeItem(itemId: string, userId: number) {
    try {
      const item = await db.select()
        .from(plaidItems)
        .where(and(
          eq(plaidItems.itemId, itemId),
          eq(plaidItems.userId, userId)
        ))
        .limit(1);

      if (item.length === 0) {
        throw new Error('Item not found');
      }

      const accessToken = EncryptionService.decrypt(item[0].accessToken);

      // Remove item from Plaid
      await plaidClient.itemRemove({
        access_token: accessToken,
      });

      // Update status in database
      await db.update(plaidItems)
        .set({ 
          status: 'removed',
          updatedAt: new Date() 
        })
        .where(eq(plaidItems.id, item[0].id));

      return { success: true };
    } catch (error: any) {
      console.error('Error removing item:', error);
      throw new Error(`Failed to remove item: ${error.message}`);
    }
  }

  /**
   * Handle webhook events
   */
  static async handleWebhook(webhookType: string, webhookCode: string, itemId: string, payload: any) {
    try {
      // Store webhook event
      await db.insert(plaidWebhookEvents).values({
        webhookType,
        webhookCode,
        itemId,
        payload,
      });

      // Get the Plaid item
      const item = await db.select()
        .from(plaidItems)
        .where(eq(plaidItems.itemId, itemId))
        .limit(1);

      if (item.length === 0) {
        console.error('Item not found for webhook:', itemId);
        return;
      }

      const userId = item[0].userId;

      // Handle different webhook types
      switch (webhookType) {
        case 'TRANSACTIONS':
          if (webhookCode === 'SYNC_UPDATES_AVAILABLE') {
            // New transactions available, trigger sync
            await this.syncTransactions(userId);
          }
          break;

        case 'ITEM':
          if (webhookCode === 'ERROR') {
            // Item error, update status
            await db.update(plaidItems)
              .set({ 
                status: 'requires_reauth',
                errorCode: payload.error?.error_code,
                errorMessage: payload.error?.error_message,
                updatedAt: new Date() 
              })
              .where(eq(plaidItems.id, item[0].id));
          } else if (webhookCode === 'PENDING_EXPIRATION') {
            // Token will expire soon, notify user
            console.log('Token expiring soon for item:', itemId);
          }
          break;

        case 'HOLDINGS':
          if (webhookCode === 'DEFAULT_UPDATE') {
            // Holdings updated
            await this.syncInvestmentHoldings(userId);
          }
          break;

        case 'LIABILITIES':
          if (webhookCode === 'DEFAULT_UPDATE') {
            // Liabilities updated
            await this.syncLiabilities(userId);
          }
          break;

        case 'ACCOUNTS':
          if (webhookCode === 'DEFAULT_UPDATE') {
            // Accounts updated
            const accessToken = EncryptionService.decrypt(item[0].accessToken);
            await this.syncAccounts(item[0].id, accessToken, userId);
          }
          break;

        default:
          console.log('Unhandled webhook type:', webhookType);
      }

      // Mark webhook as processed
      await db.update(plaidWebhookEvents)
        .set({ 
          processed: true,
          processedAt: new Date() 
        })
        .where(and(
          eq(plaidWebhookEvents.webhookType, webhookType),
          eq(plaidWebhookEvents.webhookCode, webhookCode),
          eq(plaidWebhookEvents.itemId, itemId)
        ));

    } catch (error: any) {
      console.error('Error handling webhook:', error);
      throw new Error(`Failed to handle webhook: ${error.message}`);
    }
  }

  /**
   * Update sync status for a user
   */
  private static async updateSyncStatus(userId: number, syncType: 'accounts' | 'transactions' | 'holdings' | 'liabilities') {
    const existingStatus = await db.select()
      .from(plaidSyncStatus)
      .where(eq(plaidSyncStatus.userId, userId))
      .limit(1);

    const updateData: any = {
      updatedAt: new Date(),
    };

    switch (syncType) {
      case 'accounts':
        updateData.lastAccountsSync = new Date();
        break;
      case 'transactions':
        updateData.lastTransactionsSync = new Date();
        break;
      case 'holdings':
        updateData.lastHoldingsSync = new Date();
        break;
      case 'liabilities':
        updateData.lastLiabilitiesSync = new Date();
        break;
    }

    if (existingStatus.length > 0) {
      await db.update(plaidSyncStatus)
        .set(updateData)
        .where(eq(plaidSyncStatus.userId, userId));
    } else {
      await db.insert(plaidSyncStatus).values({
        userId,
        ...updateData,
      });
    }
  }

  /**
   * Check if user needs reauthentication for any items
   */
  static async checkReauthRequired(userId: number) {
    const items = await db.select()
      .from(plaidItems)
      .where(and(
        eq(plaidItems.userId, userId),
        eq(plaidItems.status, 'requires_reauth')
      ));

    return items.map(item => ({
      itemId: item.itemId,
      institutionName: item.institutionName,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
    }));
  }

  /**
   * Create or update sync schedule for a user
   */
  static async createSyncSchedule(userId: number) {
    try {
      // Check if schedule already exists
      const existing = await db.select()
        .from(plaidSyncSchedule)
        .where(eq(plaidSyncSchedule.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        // Create new schedule with default monthly sync
        const nextSyncDate = new Date();
        nextSyncDate.setMonth(nextSyncDate.getMonth() + 1); // Next month

        await db.insert(plaidSyncSchedule).values({
          userId,
          autoSyncEnabled: true,
          syncFrequency: 'monthly',
          nextSyncDate,
          lastSyncedAt: new Date(),
          notifyOnSync: true,
          notifyOnError: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        console.log(`[PlaidService] Created sync schedule for user ${userId} - next sync: ${nextSyncDate.toISOString()}`);
      } else {
        // Update last synced time
        await db.update(plaidSyncSchedule)
          .set({ 
            lastSyncedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(plaidSyncSchedule.userId, userId));

        console.log(`[PlaidService] Updated sync schedule for user ${userId}`);
      }
    } catch (error) {
      console.error('Error creating/updating sync schedule:', error);
      // Don't throw - this shouldn't fail the main operation
    }
  }
}

export default PlaidService;