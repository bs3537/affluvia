import { Router } from 'express';
import { PlaidService } from '../services/plaid-service';
import { PlaidDataAggregator } from '../services/plaid-data-aggregator';
import { PlaidSyncScheduler } from '../services/plaid-sync-scheduler';
import { PlaidWebhookHandler } from '../services/plaid-webhook-handler';
import { AuditLogger, EncryptionService } from '../services/encryption-service';
import { db } from '../db';
import { plaidItems, plaidAccounts, plaidTransactions, plaidInvestmentHoldings, plaidLiabilities, plaidAccountMappings, plaidSyncSchedule, plaidAggregatedSnapshot, userConsents, financialProfiles } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../auth';
import { validate, rateLimit, sanitizeMiddleware } from '../middleware/plaid-validation';

const { decrypt } = EncryptionService;

const router = Router();

/**
 * POST /api/plaid/create-link-token
 * Generate a Plaid Link token for the user to connect their accounts
 */
router.post('/create-link-token', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('[Plaid Route] Creating link token for user:', req.user.id);

    const linkToken = await PlaidService.createLinkToken(
      req.user.id,
      req.user.fullName || req.user.email
    );

    console.log('[Plaid Route] Link token created successfully');

    res.json({
      success: true,
      link_token: linkToken.link_token,
      expiration: linkToken.expiration,
    });
  } catch (error: any) {
    console.error('[Plaid Route] Error creating link token:', error);
    
    // Send appropriate status codes based on error type
    const statusCode = error.message.includes('credentials') ? 503 : 500;
    
    res.status(statusCode).json({ 
      error: error.message || 'Failed to create link token',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/plaid/create-update-link-token
 * Generate a Plaid Link token for updating an existing connection
 */
router.post('/create-update-link-token', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { itemId } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required for update mode' });
    }

    // Get the access token for this item
    const items = await db
      .select()
      .from(plaidItems)
      .where(
        and(
          eq(plaidItems.itemId, itemId),
          eq(plaidItems.userId, req.user.id)
        )
      )
      .limit(1);

    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const accessToken = decrypt(items[0].accessToken);

    // Create update mode link token
    const linkTokenResponse = await PlaidService.createUpdateLinkToken(
      accessToken,
      req.user.id,
      req.user.email || 'User'
    );

    // Audit log
    await AuditLogger.logPlaidOperation(
      req.user.id,
      'create_update_link_token',
      itemId,
      true,
      undefined,
      req.ip
    );

    res.json(linkTokenResponse);
  } catch (error: any) {
    console.error('Error creating update link token:', error);
    
    await AuditLogger.logPlaidOperation(
      req.user?.id || 0,
      'create_update_link_token_failed',
      req.body.itemId,
      false,
      error.message,
      req.ip
    );
    
    res.status(500).json({ 
      error: 'Failed to create update link token',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/exchange-public-token
 * Exchange a public token from Plaid Link for an access token
 */
router.post('/exchange-public-token', requireAuth, sanitizeMiddleware, validate.body.exchangeToken, async (req, res, next) => {
  try {
    console.log('[Plaid Route] Exchange public token endpoint called');
    console.log('[Plaid Route] Request body:', JSON.stringify(req.body));
    console.log('[Plaid Route] User authenticated:', !!req.user, req.user?.id);
    
    if (!req.user) {
      console.error('[Plaid Route] No authenticated user');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { publicToken } = req.body;

    if (!publicToken) {
      console.error('[Plaid Route] No public token in request body');
      return res.status(400).json({ error: 'Public token is required' });
    }

    console.log('[Plaid Route] Calling PlaidService.exchangePublicToken...');
    const result = await PlaidService.exchangePublicToken(publicToken, req.user.id);
    
    console.log('[Plaid Route] Exchange successful, result:', result);
    
    // Automatically sync to financial_profiles after successful connection
    try {
      console.log('[Plaid Route] Auto-syncing to financial_profiles...');
      const { PlaidIntakeDirectMapper } = await import('../services/plaid-intake-direct-mapper');
      const syncResult = await PlaidIntakeDirectMapper.syncAllToProfile(req.user.id);
      console.log('[Plaid Route] Auto-sync completed:', syncResult.message);
    } catch (syncError) {
      // Log error but don't fail the connection
      console.error('[Plaid Route] Auto-sync failed (non-blocking):', syncError);
    }

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Plaid Route] Error exchanging public token:', error);
    console.error('[Plaid Route] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to exchange public token',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/plaid/accounts
 * Get all linked accounts for the authenticated user
 */
router.get('/accounts', requireAuth, sanitizeMiddleware, validate.query.getAccounts, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('[Plaid Route] Getting accounts for user:', req.user.id);
    const accounts = await PlaidService.getUserAccounts(req.user.id);
    console.log('[Plaid Route] Found accounts:', accounts.length);

    // Group accounts by institution
    const itemIds = [...new Set(accounts.map(a => a.plaidItemId))];
    const items = await db.select()
      .from(plaidItems)
      .where(eq(plaidItems.userId, req.user.id));
    
    console.log('[Plaid Route] Found Plaid items:', items.length);
    const itemMap = new Map(items.map(item => [item.id, item]));

    const accountsByInstitution = accounts.reduce((acc: any, account) => {
      const item = itemMap.get(account.plaidItemId!);
      if (!item) {
        console.log('[Plaid Route] No item found for plaidItemId:', account.plaidItemId);
        return acc;
      }

      const institutionName = item.institutionName || 'Unknown Institution';
      
      if (!acc[institutionName]) {
        acc[institutionName] = {
          institutionName,
          institutionId: item.institutionId,
          itemId: item.itemId,
          status: item.status,
          accounts: [],
        };
      }

      acc[institutionName].accounts.push({
        id: account.id,
        accountId: account.accountId,
        name: account.accountName,
        officialName: account.officialName,
        type: account.accountType,
        subtype: account.accountSubtype,
        mask: account.mask,
        currentBalance: account.currentBalance,
        availableBalance: account.availableBalance,
        creditLimit: account.creditLimit,
        currency: account.currency,
        lastSynced: account.lastSynced,
        metadata: account.metadata,  // Include metadata which contains owner names
      });

      return acc;
    }, {});

    console.log('[Plaid Route] Grouped accounts by institution:', Object.keys(accountsByInstitution).length, 'institutions');
    console.log('[Plaid Route] Returning response with', Object.values(accountsByInstitution).length, 'institutions');

    res.json({
      success: true,
      accounts: Object.values(accountsByInstitution),
      totalAccounts: accounts.length,
    });
  } catch (error: any) {
    console.error('Error getting accounts:', error);
    res.status(500).json({ 
      error: 'Failed to get accounts',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/sync/:itemId
 * Sync a specific Plaid item's accounts
 */
router.post('/sync/:itemId', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const itemId = parseInt(req.params.itemId);
    console.log('[Plaid Route] Syncing item:', itemId, 'for user:', req.user.id);

    // Get the specific Plaid item
    const [item] = await db.select()
      .from(plaidItems)
      .where(and(
        eq(plaidItems.id, itemId),
        eq(plaidItems.userId, req.user.id),
        eq(plaidItems.status, 'active')
      ))
      .limit(1);

    if (!item) {
      return res.status(404).json({ 
        error: 'Plaid item not found or not active' 
      });
    }

    try {
      // Decrypt access token
      const accessToken = EncryptionService.decrypt(item.accessToken);
      
      // Sync accounts with identity data
      const accountCount = await PlaidService.syncAccounts(item.id, accessToken, req.user.id);
      
      console.log('[Plaid Route] Synced', accountCount, 'accounts for item:', itemId);

      res.json({
        success: true,
        message: `Successfully synced ${accountCount} account${accountCount !== 1 ? 's' : ''} from ${item.institutionName || 'institution'}`,
        accountCount,
        itemId: item.id,
        institutionName: item.institutionName
      });
    } catch (syncError: any) {
      console.error('[Plaid Route] Error syncing item:', itemId, syncError);
      res.status(500).json({ 
        error: 'Failed to sync accounts',
        message: syncError.message,
        itemId: item.id,
        institutionName: item.institutionName
      });
    }
  } catch (error: any) {
    console.error('[Plaid Route] Error in sync endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to sync',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/sync-accounts
 * Sync account balances for all linked accounts
 */
router.post('/sync-accounts', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get all active Plaid items for the user
    const items = await db.select()
      .from(plaidItems)
      .where(and(
        eq(plaidItems.userId, req.user.id),
        eq(plaidItems.status, 'active')
      ));

    let syncedAccounts = 0;
    const errors: any[] = [];

    for (const item of items) {
      try {
        // Decrypt access token using secure encryption service
        const accessToken = EncryptionService.decrypt(item.accessToken);

        await PlaidService.syncAccounts(item.id, accessToken, req.user.id);
        syncedAccounts++;
      } catch (error: any) {
        errors.push({
          itemId: item.itemId,
          institution: item.institutionName,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      syncedItems: syncedAccounts,
      totalItems: items.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error syncing accounts:', error);
    res.status(500).json({ 
      error: 'Failed to sync accounts',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/sync-transactions
 * Sync recent transactions for all linked accounts
 */
router.post('/sync-transactions', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { startDate, endDate } = req.body;

    const transactions = await PlaidService.syncTransactions(
      req.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    res.json({
      success: true,
      transactionCount: transactions.length,
      message: `Synced ${transactions.length} transactions`,
    });
  } catch (error: any) {
    console.error('Error syncing transactions:', error);
    res.status(500).json({ 
      error: 'Failed to sync transactions',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/transactions
 * Get recent transactions for the user
 */
router.get('/transactions', requireAuth, sanitizeMiddleware, validate.query.getTransactions, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { limit = 100, offset = 0, accountId } = req.query;

    let query = db.select({
      id: plaidTransactions.id,
      amount: plaidTransactions.amount,
      date: plaidTransactions.date,
      name: plaidTransactions.name,
      merchantName: plaidTransactions.merchantName,
      category: plaidTransactions.primaryCategory,
      pending: plaidTransactions.pending,
      accountName: plaidAccounts.accountName,
      accountMask: plaidAccounts.mask,
    })
    .from(plaidTransactions)
    .leftJoin(plaidAccounts, eq(plaidTransactions.plaidAccountId, plaidAccounts.id))
    .where(eq(plaidTransactions.userId, req.user.id))
    .orderBy(desc(plaidTransactions.date))
    .limit(Number(limit))
    .offset(Number(offset));

    const transactions = await query;

    res.json({
      success: true,
      transactions,
      total: transactions.length,
    });
  } catch (error: any) {
    console.error('Error getting transactions:', error);
    res.status(500).json({ 
      error: 'Failed to get transactions',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/sync-investments
 * Sync investment holdings for all investment accounts
 */
router.post('/sync-investments', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const holdings = await PlaidService.syncInvestmentHoldings(req.user.id);

    res.json({
      success: true,
      holdingsCount: holdings.length,
      message: `Synced ${holdings.length} investment holdings`,
    });
  } catch (error: any) {
    console.error('Error syncing investments:', error);
    res.status(500).json({ 
      error: 'Failed to sync investments',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/investments
 * Get investment holdings for the user
 */
router.get('/investments', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const holdings = await db.select({
      id: plaidInvestmentHoldings.id,
      symbol: plaidInvestmentHoldings.symbol,
      name: plaidInvestmentHoldings.name,
      quantity: plaidInvestmentHoldings.quantity,
      price: plaidInvestmentHoldings.price,
      value: plaidInvestmentHoldings.value,
      costBasis: plaidInvestmentHoldings.costBasis,
      type: plaidInvestmentHoldings.type,
      accountName: plaidAccounts.accountName,
      accountMask: plaidAccounts.mask,
    })
    .from(plaidInvestmentHoldings)
    .leftJoin(plaidAccounts, eq(plaidInvestmentHoldings.plaidAccountId, plaidAccounts.id))
    .where(eq(plaidInvestmentHoldings.userId, req.user.id));

    // Calculate totals and allocation
    const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.value || '0'), 0);
    const byType = holdings.reduce((acc: any, h) => {
      const type = h.type || 'other';
      if (!acc[type]) {
        acc[type] = {
          value: 0,
          count: 0,
          percentage: 0,
        };
      }
      acc[type].value += parseFloat(h.value || '0');
      acc[type].count++;
      return acc;
    }, {});

    // Calculate percentages
    Object.keys(byType).forEach(type => {
      byType[type].percentage = (byType[type].value / totalValue * 100).toFixed(2);
    });

    res.json({
      success: true,
      holdings,
      summary: {
        totalValue,
        totalHoldings: holdings.length,
        byType,
      },
    });
  } catch (error: any) {
    console.error('Error getting investments:', error);
    res.status(500).json({ 
      error: 'Failed to get investments',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/sync-liabilities
 * Sync liabilities (loans, credit cards) for all accounts
 */
router.post('/sync-liabilities', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const liabilities = await PlaidService.syncLiabilities(req.user.id);

    res.json({
      success: true,
      message: 'Liabilities synced successfully',
      liabilities,
    });
  } catch (error: any) {
    console.error('Error syncing liabilities:', error);
    res.status(500).json({ 
      error: 'Failed to sync liabilities',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/liabilities
 * Get all liabilities for the user
 */
router.get('/liabilities', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const liabilities = await db.select({
      id: plaidLiabilities.id,
      type: plaidLiabilities.liabilityType,
      currentBalance: plaidLiabilities.currentBalance,
      originalBalance: plaidLiabilities.originalBalance,
      minimumPayment: plaidLiabilities.minimumPayment,
      nextPaymentDueDate: plaidLiabilities.nextPaymentDueDate,
      interestRate: plaidLiabilities.interestRate,
      apr: plaidLiabilities.apr,
      accountName: plaidAccounts.accountName,
      accountMask: plaidAccounts.mask,
    })
    .from(plaidLiabilities)
    .leftJoin(plaidAccounts, eq(plaidLiabilities.plaidAccountId, plaidAccounts.id))
    .where(eq(plaidLiabilities.userId, req.user.id));

    // Calculate totals by type
    const summary = liabilities.reduce((acc: any, liability) => {
      const type = liability.type || 'other';
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          totalBalance: 0,
          totalMinimumPayment: 0,
        };
      }
      acc[type].count++;
      acc[type].totalBalance += parseFloat(liability.currentBalance || '0');
      acc[type].totalMinimumPayment += parseFloat(liability.minimumPayment || '0');
      return acc;
    }, {});

    res.json({
      success: true,
      liabilities,
      summary,
    });
  } catch (error: any) {
    console.error('Error getting liabilities:', error);
    res.status(500).json({ 
      error: 'Failed to get liabilities',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/plaid/unlink-account/:itemId
 * Remove a linked account/institution (all accounts from that institution)
 */
router.delete('/unlink-account/:itemId', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { itemId } = req.params;

    const result = await PlaidService.removeItem(itemId, req.user.id);

    res.json({
      success: true,
      message: 'Account unlinked successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error unlinking account:', error);
    res.status(500).json({ 
      error: 'Failed to unlink account',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/plaid/delete-account/:accountId
 * Remove a single account from Plaid accounts and intake form data
 */
router.delete('/delete-account/:accountId', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const accountIdParam = parseInt(req.params.accountId);
    console.log(`[PlaidAPI] Deleting account with ID ${accountIdParam} for user ${req.user.id}`);

    // 1. First get the account details before deletion
    const [account] = await db.select()
      .from(plaidAccounts)
      .where(and(
        eq(plaidAccounts.id, accountIdParam),
        eq(plaidAccounts.userId, req.user.id)
      ))
      .limit(1);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // 2. Mark the account as inactive in plaid_accounts table
    await db.update(plaidAccounts)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(and(
        eq(plaidAccounts.id, accountIdParam),
        eq(plaidAccounts.userId, req.user.id)
      ));

    // 2a. Tell Plaid to stop syncing this specific account
    // Note: Plaid doesn't support removing individual accounts from an Item.
    // We can only remove the entire Item (all accounts from that institution).
    // So we'll track this locally and filter out this account in our sync operations.

    // 3. Remove this account's data from intake form (financial_profiles table)
    const [financialProfile] = await db.select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, req.user.id))
      .limit(1);

    if (financialProfile) {
      const assets = (financialProfile.assets as any[]) || [];
      const liabilities = (financialProfile.liabilities as any[]) || [];
      
      // Remove from assets array if it exists there
      const filteredAssets = assets.filter((asset: any) => 
        !asset._source || asset._source.plaidAccountId !== account.accountId
      );
      
      // Remove from liabilities array if it exists there
      const filteredLiabilities = liabilities.filter((liability: any) => 
        !liability._source || liability._source.plaidAccountId !== account.accountId
      );
      
      // Update the financial profile
      await db.update(financialProfiles)
        .set({ 
          assets: filteredAssets,
          liabilities: filteredLiabilities,
          updatedAt: new Date()
        })
        .where(eq(financialProfiles.userId, req.user.id));
    }

    // 4. Check if this was the last active account for the item
    const remainingAccounts = await db.select()
      .from(plaidAccounts)
      .where(and(
        eq(plaidAccounts.plaidItemId, account.plaidItemId),
        eq(plaidAccounts.isActive, true)
      ));

    // If no more active accounts for this item, mark the item as inactive too
    if (remainingAccounts.length === 0) {
      await db.update(plaidItems)
        .set({ 
          status: 'inactive',
          updatedAt: new Date()
        })
        .where(eq(plaidItems.id, account.plaidItemId));
    }

    console.log(`[PlaidAPI] Successfully deleted account ${accountIdParam}`);
    
    // Important: Plaid API doesn't support removing individual accounts from an Item.
    // By marking isActive=false, our sync operations will skip this account.
    // The account will still exist in Plaid but we won't process its data.
    
    res.json({
      success: true,
      message: 'Account deleted successfully',
      accountId: accountIdParam,
      shouldUnlinkItem: remainingAccounts.length === 0,
      itemId: remainingAccounts.length === 0 ? account.plaidItemId : null,
      note: 'Account removed from your profile. Plaid syncing disabled for this account.'
    });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    res.status(500).json({ 
      error: 'Failed to delete account',
      message: error.message 
    });
  }
});

// Webhook endpoint moved to line 984 to avoid duplication

/**
 * GET /api/plaid/reauth-required
 * Check if any accounts need reauthentication
 */
router.get('/reauth-required', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const itemsNeedingReauth = await PlaidService.checkReauthRequired(req.user.id);

    res.json({
      success: true,
      requiresReauth: itemsNeedingReauth.length > 0,
      items: itemsNeedingReauth,
    });
  } catch (error: any) {
    console.error('Error checking reauth status:', error);
    res.status(500).json({ 
      error: 'Failed to check reauth status',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/sync-all
 * Sync all data (accounts, transactions, investments, liabilities) for a user
 */
router.post('/sync-all', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const results = {
      accounts: { success: false, error: null as any },
      transactions: { success: false, error: null as any },
      investments: { success: false, error: null as any },
      liabilities: { success: false, error: null as any },
    };

    // Sync accounts
    try {
      const items = await db.select()
        .from(plaidItems)
        .where(and(
          eq(plaidItems.userId, req.user.id),
          eq(plaidItems.status, 'active')
        ));

      for (const item of items) {
        // Decrypt access token using secure encryption service
        const accessToken = EncryptionService.decrypt(item.accessToken);
        await PlaidService.syncAccounts(item.id, accessToken, req.user.id);
      }
      results.accounts.success = true;
    } catch (error: any) {
      results.accounts.error = error.message;
    }

    // Sync transactions
    try {
      await PlaidService.syncTransactions(req.user.id);
      results.transactions.success = true;
    } catch (error: any) {
      results.transactions.error = error.message;
    }

    // Sync investments
    try {
      await PlaidService.syncInvestmentHoldings(req.user.id);
      results.investments.success = true;
    } catch (error: any) {
      results.investments.error = error.message;
    }

    // Sync liabilities
    try {
      await PlaidService.syncLiabilities(req.user.id);
      results.liabilities.success = true;
    } catch (error: any) {
      results.liabilities.error = error.message;
    }

    const allSuccess = Object.values(results).every(r => r.success);

    // If sync was successful, trigger financial metrics recalculation
    if (allSuccess) {
      try {
        console.log('[Plaid Route] Triggering financial metrics recalculation after Plaid sync');
        
        // Get current profile
        const profiles = await db.select()
          .from(financialProfiles)
          .where(eq(financialProfiles.userId, req.user.id))
          .limit(1);
        
        if (profiles.length > 0) {
          const profile = profiles[0];
          
          // Import the calculation function
          const { calculateFinancialMetricsWithPlaid } = await import('../financial-calculations-enhanced');
          
          // Recalculate metrics with Plaid data
          const calculations = await calculateFinancialMetricsWithPlaid(profile, [], req.user.id);
          
          // Update profile with new calculations and scores
          await db.update(financialProfiles)
            .set({
              calculations,
              financialHealthScore: calculations?.healthScore || 0,
              emergencyReadinessScore: calculations?.emergencyScore || 0,
              retirementReadinessScore: calculations?.retirementScore || 0,
              riskManagementScore: calculations?.insuranceScore || 0,
              cashFlowScore: calculations?.cashFlowScore || 0,
              netWorth: calculations?.netWorth || 0,
              monthlyCashFlow: calculations?.monthlyCashFlow || 0,
              userRiskProfile: calculations?.riskProfile || 'Not Assessed',
              targetAllocation: calculations?.targetAllocation || {},
              spouseRiskProfile: calculations?.spouseRiskProfile || 'Not Assessed',
              spouseTargetAllocation: calculations?.spouseTargetAllocation || {},
              lastUpdated: new Date(),
            })
            .where(eq(financialProfiles.userId, req.user.id));
          
          console.log('[Plaid Route] Financial metrics recalculated successfully');
        }
      } catch (recalcError) {
        console.error('[Plaid Route] Error recalculating financial metrics:', recalcError);
        // Don't fail the entire sync response if recalculation fails
      }
    }

    res.json({
      success: allSuccess,
      message: allSuccess ? 'All data synced successfully' : 'Some sync operations failed',
      results,
    });
  } catch (error: any) {
    console.error('Error syncing all data:', error);
    res.status(500).json({ 
      error: 'Failed to sync all data',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/aggregated-data
 * Get complete financial picture combining Plaid and manual data
 */
router.get('/aggregated-data', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const financialData = await PlaidDataAggregator.getUserCompleteFinancialPicture(req.user.id);

    res.json({
      success: true,
      data: financialData,
    });
  } catch (error: any) {
    console.error('Error getting aggregated data:', error);
    res.status(500).json({ 
      error: 'Failed to get aggregated data',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/snapshot
 * Get cached financial snapshot or create new one
 */
router.get('/snapshot', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { force } = req.query;
    
    let snapshot;
    if (force === 'true') {
      snapshot = await PlaidDataAggregator.createAggregatedSnapshot(req.user.id);
    } else {
      snapshot = await PlaidDataAggregator.getLatestSnapshot(req.user.id);
    }

    res.json({
      success: true,
      snapshot,
    });
  } catch (error: any) {
    console.error('Error getting snapshot:', error);
    res.status(500).json({ 
      error: 'Failed to get snapshot',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/cash-flow
 * Get monthly cash flow analysis
 */
router.get('/cash-flow', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { months = 3 } = req.query;
    const cashFlow = await PlaidDataAggregator.calculateMonthlyCashFlow(
      req.user.id,
      parseInt(months as string)
    );

    res.json({
      success: true,
      cashFlow,
    });
  } catch (error: any) {
    console.error('Error calculating cash flow:', error);
    res.status(500).json({ 
      error: 'Failed to calculate cash flow',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/sync-all-v2
 * Sync all Plaid accounts directly to financial_profiles table (Connections2)
 */
router.post('/sync-all-v2', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('[Plaid Route] Syncing all accounts to profile for user:', req.user.id);
    
    const { PlaidIntakeDirectMapper } = await import('../services/plaid-intake-direct-mapper');
    const result = await PlaidIntakeDirectMapper.syncAllToProfile(req.user.id);
    
    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to sync accounts',
        errors: result.errors
      });
    }
    
    // If sync was successful, trigger financial metrics recalculation
    if (result.success) {
      try {
        console.log('[Plaid Route] Triggering financial metrics recalculation after Plaid sync-v2');
        
        // Get current profile
        const profiles = await db.select()
          .from(financialProfiles)
          .where(eq(financialProfiles.userId, req.user.id))
          .limit(1);
        
        if (profiles.length > 0) {
          const profile = profiles[0];
          
          // Import the calculation function
          const { calculateFinancialMetricsWithPlaid } = await import('../financial-calculations-enhanced');
          
          // Recalculate metrics with Plaid data
          const calculations = await calculateFinancialMetricsWithPlaid(profile, [], req.user.id);
          
          // Update profile with new calculations and scores
          await db.update(financialProfiles)
            .set({
              calculations,
              financialHealthScore: calculations?.healthScore || 0,
              emergencyReadinessScore: calculations?.emergencyScore || 0,
              retirementReadinessScore: calculations?.retirementScore || 0,
              riskManagementScore: calculations?.insuranceScore || 0,
              cashFlowScore: calculations?.cashFlowScore || 0,
              netWorth: calculations?.netWorth || 0,
              monthlyCashFlow: calculations?.monthlyCashFlow || 0,
              userRiskProfile: calculations?.riskProfile || 'Not Assessed',
              targetAllocation: calculations?.targetAllocation || {},
              spouseRiskProfile: calculations?.spouseRiskProfile || 'Not Assessed',
              spouseTargetAllocation: calculations?.spouseTargetAllocation || {},
              lastUpdated: new Date(),
            })
            .where(eq(financialProfiles.userId, req.user.id));
          
          console.log('[Plaid Route] Financial metrics recalculated successfully');
        }
      } catch (recalcError) {
        console.error('[Plaid Route] Error recalculating financial metrics:', recalcError);
        // Don't fail the entire sync response if recalculation fails
      }
    }
    
    res.json({
      success: true,
      message: `Successfully synced ${result.syncedAssets} assets, ${result.syncedLiabilities} liabilities, and ${result.syncedMortgages} mortgages`,
      syncedAssets: result.syncedAssets,
      syncedLiabilities: result.syncedLiabilities,
      syncedMortgages: result.syncedMortgages,
      errors: result.errors.length > 0 ? result.errors : undefined
    });
  } catch (error: any) {
    console.error('[Plaid Route] Error in sync-all-v2:', error);
    res.status(500).json({ 
      error: 'Failed to sync accounts to profile',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/accounts-v2
 * Get accounts from financial_profiles table (Connections2)
 */
router.get('/accounts-v2', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('[Plaid Route] Getting accounts for connections2 for user:', req.user.id);
    
    // Auto-sync accounts to financial_profiles when page loads
    try {
      console.log('[Plaid Route] Auto-syncing on Connections2 page load...');
      const { PlaidIntakeDirectMapper } = await import('../services/plaid-intake-direct-mapper');
      const syncResult = await PlaidIntakeDirectMapper.syncAllToProfile(req.user.id);
      console.log('[Plaid Route] Auto-sync result:', syncResult.message);
    } catch (syncError) {
      console.error('[Plaid Route] Auto-sync failed (non-blocking):', syncError);
    }
    
    // Get all Plaid accounts (same as connections tab)
    const accounts = await PlaidService.getUserAccounts(req.user.id);
    console.log('[Plaid Route] Found accounts:', accounts.length);
    
    if (accounts.length === 0) {
      return res.json({
        success: true,
        accounts: [],
        totalAccounts: 0
      });
    }
    
    // Get Plaid items for grouping
    const items = await db.select()
      .from(plaidItems)
      .where(eq(plaidItems.userId, req.user.id));
    
    console.log('[Plaid Route] Found Plaid items:', items.length);
    
    // Get financial profile to check sync status
    const [profile] = await db.select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, req.user.id))
      .limit(1);
    
    // Check which accounts are already synced
    const syncedAccountIds = new Set<string>();
    if (profile) {
      const assets = (profile.assets as any[]) || [];
      const liabilities = (profile.liabilities as any[]) || [];
      
      // Collect synced account IDs
      [...assets, ...liabilities].forEach(item => {
        if (item._source?.isImported && item._source?.plaidAccountId) {
          syncedAccountIds.add(item._source.plaidAccountId);
        }
      });
    }
    
    // Group accounts by institution with sync status
    const itemMap = new Map(items.map(item => [item.id, item]));
    const accountsByInstitution: Record<string, any> = {};
    
    accounts.forEach(account => {
      const item = itemMap.get(account.plaidItemId!);
      if (!item) return;
      
      const institutionName = item.institutionName || 'Unknown Institution';
      
      if (!accountsByInstitution[institutionName]) {
        accountsByInstitution[institutionName] = {
          id: item.id,
          institutionName,
          institutionId: item.institutionId,
          itemId: item.itemId,
          status: syncedAccountIds.size > 0 ? 'synced' : 'ready_to_sync',
          lastSuccessfulUpdate: item.lastSuccessfulUpdate,
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
        availableBalance: parseFloat(account.availableBalance || '0'),
        creditLimit: account.creditLimit,
        mask: account.mask,
        currency: account.currency,
        lastSynced: account.lastSynced,
        isSynced: syncedAccountIds.has(account.accountId),
        metadata: account.metadata || {}
      });
    });
    
    const institutions = Object.values(accountsByInstitution);
    const totalAccounts = institutions.reduce((sum, inst) => sum + inst.accounts.length, 0);
    
    console.log('[Plaid Route] Returning', institutions.length, 'institutions with', totalAccounts, 'accounts');
    
    res.json({
      success: true,
      accounts: institutions,
      totalAccounts
    });
  } catch (error: any) {
    console.error('[Plaid Route] Error in accounts-v2:', error);
    res.status(500).json({ 
      error: 'Failed to get accounts',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/refresh-all
 * Refresh all accounts from Plaid and sync to profile
 */
router.post('/refresh-all', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('[Plaid Route] Refreshing all accounts from Plaid for user:', req.user.id);
    
    // Step 1: Get all active Plaid items for the user
    const items = await db.select()
      .from(plaidItems)
      .where(and(
        eq(plaidItems.userId, req.user.id),
        eq(plaidItems.status, 'active')
      ));

    let accountsUpdated = 0;
    const errors: any[] = [];

    // Step 2: Refresh each item from Plaid API
    for (const item of items) {
      try {
        // Decrypt access token
        const accessToken = EncryptionService.decrypt(item.accessToken);
        
        // Sync accounts (refresh balances from Plaid)
        await PlaidService.syncAccounts(item.id, accessToken, req.user.id);
        
        // Count accounts for this item
        const accounts = await db.select()
          .from(plaidAccounts)
          .where(eq(plaidAccounts.plaidItemId, item.id));
        
        accountsUpdated += accounts.length;
      } catch (error: any) {
        console.error(`[Plaid Route] Error refreshing item ${item.itemId}:`, error);
        errors.push({
          itemId: item.itemId,
          institution: item.institutionName,
          error: error.message,
        });
      }
    }
    
    // Step 3: Auto-sync refreshed data to financial_profiles
    try {
      const { PlaidIntakeDirectMapper } = await import('../services/plaid-intake-direct-mapper');
      await PlaidIntakeDirectMapper.syncAllToProfile(req.user.id);
      console.log('[Plaid Route] Auto-synced refreshed data to financial_profiles');
    } catch (syncError) {
      console.error('[Plaid Route] Failed to sync to profile after refresh:', syncError);
    }

    res.json({
      success: true,
      accountsUpdated,
      totalItems: items.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Refreshed ${accountsUpdated} accounts from ${items.length} institutions`
    });
  } catch (error: any) {
    console.error('[Plaid Route] Error in refresh-all:', error);
    res.status(500).json({ 
      error: 'Failed to refresh accounts',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/sync-v2/:itemId
 * Sync a specific Plaid item to profile (Connections2)
 */
router.post('/sync-v2/:itemId', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const itemId = parseInt(req.params.itemId);
    console.log('[Plaid Route] Syncing item to profile:', itemId, 'for user:', req.user.id);
    
    const { PlaidIntakeDirectMapper } = await import('../services/plaid-intake-direct-mapper');
    const result = await PlaidIntakeDirectMapper.syncItemToProfile(itemId, req.user.id);
    
    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to sync item',
        message: result.message
      });
    }
    
    res.json({
      success: true,
      message: result.message,
      accountCount: result.accountCount
    });
  } catch (error: any) {
    console.error('[Plaid Route] Error in sync-v2:', error);
    res.status(500).json({ 
      error: 'Failed to sync item to profile',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/categorize-accounts
 * Auto-categorize newly linked accounts
 */
router.post('/categorize-accounts', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const categorizedCount = await PlaidDataAggregator.autoCategorizeNewAccounts(req.user.id);

    res.json({
      success: true,
      categorizedCount,
      message: `Categorized ${categorizedCount} new accounts`,
    });
  } catch (error: any) {
    console.error('Error categorizing accounts:', error);
    res.status(500).json({ 
      error: 'Failed to categorize accounts',
      message: error.message 
    });
  }
});

/**
 * PUT /api/plaid/account-mapping/:accountId
 * Update account categorization and preferences
 */
router.put('/account-mapping/:accountId', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { accountId } = req.params;
    const updates = req.body;

    // Verify account belongs to user
    const [account] = await db.select()
      .from(plaidAccounts)
      .where(and(
        eq(plaidAccounts.accountId, accountId),
        eq(plaidAccounts.userId, req.user.id)
      ))
      .limit(1);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check if mapping exists
    const [existingMapping] = await db.select()
      .from(plaidAccountMappings)
      .where(eq(plaidAccountMappings.plaidAccountId, account.id))
      .limit(1);

    if (existingMapping) {
      // Update existing mapping
      await db.update(plaidAccountMappings)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(plaidAccountMappings.id, existingMapping.id));
    } else {
      // Create new mapping
      await db.insert(plaidAccountMappings).values({
        userId: req.user.id,
        plaidAccountId: account.id,
        ...updates,
      });
    }

    res.json({
      success: true,
      message: 'Account mapping updated',
    });
  } catch (error: any) {
    console.error('Error updating account mapping:', error);
    res.status(500).json({ 
      error: 'Failed to update account mapping',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/sync-preferences
 * Get user's sync preferences
 */
router.get('/sync-preferences', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const [preferences] = await db.select()
      .from(plaidSyncSchedule)
      .where(eq(plaidSyncSchedule.userId, req.user.id))
      .limit(1);

    res.json({
      success: true,
      preferences: preferences || {
        syncFrequency: 'monthly',
        autoSyncEnabled: true,
        syncTransactions: true,
        syncInvestments: true,
        syncLiabilities: true,
        transactionDaysToSync: 30,
      },
    });
  } catch (error: any) {
    console.error('Error getting sync preferences:', error);
    res.status(500).json({ 
      error: 'Failed to get sync preferences',
      message: error.message 
    });
  }
});

/**
 * PUT /api/plaid/sync-preferences
 * Update user's sync preferences
 */
router.put('/sync-preferences', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await PlaidSyncScheduler.updateSyncPreferences(req.user.id, req.body);

    res.json({
      success: true,
      message: 'Sync preferences updated',
    });
  } catch (error: any) {
    console.error('Error updating sync preferences:', error);
    res.status(500).json({ 
      error: 'Failed to update sync preferences',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/manual-sync
 * Trigger manual sync (rate-limited to 3 per day)
 */
router.post('/manual-sync', requireAuth, sanitizeMiddleware, validate.body.manualSync, rateLimit(5, 60), async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await PlaidSyncScheduler.manualSync(req.user.id);

    res.json({
      success: true,
      message: 'Manual sync triggered',
      result,
    });
  } catch (error: any) {
    console.error('Error triggering manual sync:', error);
    res.status(500).json({ 
      error: 'Failed to trigger manual sync',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/retirement-accounts
 * Get retirement-specific account data
 */
router.get('/retirement-accounts', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const retirementData = await PlaidDataAggregator.getRetirementAccounts(req.user.id);

    res.json({
      success: true,
      ...retirementData,
    });
  } catch (error: any) {
    console.error('Error getting retirement accounts:', error);
    res.status(500).json({ 
      error: 'Failed to get retirement accounts',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/webhook
 * Handle Plaid webhooks for real-time updates (monthly sync focus)
 */
router.post('/webhook', validate.body.webhook, async (req, res, next) => {
  try {
    // Verify webhook signature first
    const signatureHeader = req.headers['plaid-verification'] as string;
    const isValid = await PlaidWebhookHandler.verifyWebhookSignature(
      signatureHeader,
      req.body
    );
    
    if (!isValid) {
      console.error('[Plaid Webhook] Invalid signature');
      // Return 401 to indicate authentication failure
      return res.status(401).json({ 
        error: 'Invalid webhook signature',
        acknowledged: false 
      });
    }
    
    // Get IP address for audit logging
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Log webhook receipt
    console.log('[Plaid Webhook] Received and verified:', {
      type: req.body.webhook_type,
      code: req.body.webhook_code,
      item_id: req.body.item_id
    });

    // Process webhook
    const result = await PlaidWebhookHandler.handleWebhook(req.body, ipAddress);
    
    // Return success to Plaid immediately (async processing)
    res.json({ 
      acknowledged: true,
      message: result.message 
    });

    // If retry is needed, schedule it
    if (!result.success && result.shouldRetry) {
      // Schedule retry in background
      setTimeout(async () => {
        await PlaidWebhookHandler.handleWebhook(req.body, ipAddress);
      }, 5000);
    }
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    // Still return 200 to Plaid to prevent retry spam
    res.json({ 
      acknowledged: true,
      error: 'Processing error' 
    });
  }
});

/**
 * GET /api/plaid/consent-status
 * Check user's Plaid data sharing consent status
 */
router.get('/consent-status', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const consent = await db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, req.user.id),
          eq(userConsents.consentType, 'plaid_data_sharing')
        )
      )
      .limit(1);

    res.json({
      hasConsented: consent.length > 0 && consent[0].granted,
      consentDate: consent.length > 0 ? consent[0].grantedAt : null,
      consentVersion: consent.length > 0 ? consent[0].consentVersion : null
    });
  } catch (error: any) {
    console.error('Error checking consent status:', error);
    res.status(500).json({ error: 'Failed to check consent status' });
  }
});

/**
 * POST /api/plaid/grant-consent
 * Grant consent for Plaid data sharing
 */
router.post('/grant-consent', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;

    // Check if consent already exists
    const existingConsent = await db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, req.user.id),
          eq(userConsents.consentType, 'plaid_data_sharing')
        )
      )
      .limit(1);

    if (existingConsent.length > 0) {
      // Update existing consent
      await db
        .update(userConsents)
        .set({
          granted: true,
          grantedAt: new Date(),
          revokedAt: null,
          ipAddress: ipAddress || null,
          consentVersion: 'v1.0',
          updatedAt: new Date()
        })
        .where(eq(userConsents.id, existingConsent[0].id));
    } else {
      // Create new consent
      await db.insert(userConsents).values({
        userId: req.user.id,
        consentType: 'plaid_data_sharing',
        granted: true,
        grantedAt: new Date(),
        ipAddress: ipAddress || null,
        consentVersion: 'v1.0',
        details: {
          scope: ['accounts', 'transactions', 'investments', 'liabilities'],
          purpose: 'financial_planning',
          dataRetention: '7_years'
        }
      });
    }

    // Audit log the consent
    await AuditLogger.logConsentUpdate(
      req.user.id,
      'plaid_data_sharing',
      true,
      ipAddress
    );

    res.json({
      success: true,
      message: 'Consent granted successfully'
    });
  } catch (error: any) {
    console.error('Error granting consent:', error);
    res.status(500).json({ error: 'Failed to grant consent' });
  }
});

/**
 * POST /api/plaid/revoke-consent
 * Revoke consent for Plaid data sharing
 */
router.post('/revoke-consent', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;

    // Update consent to revoked
    await db
      .update(userConsents)
      .set({
        granted: false,
        revokedAt: new Date(),
        ipAddress: ipAddress || null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(userConsents.userId, req.user.id),
          eq(userConsents.consentType, 'plaid_data_sharing')
        )
      );

    // Remove all Plaid items for this user
    const items = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.userId, req.user.id));

    for (const item of items) {
      await PlaidService.removeItem(item.id, req.user.id);
    }

    // Audit log the consent revocation
    await AuditLogger.logConsentUpdate(
      req.user.id,
      'plaid_data_sharing',
      false,
      ipAddress
    );

    res.json({
      success: true,
      message: 'Consent revoked and all connected accounts removed'
    });
  } catch (error: any) {
    console.error('Error revoking consent:', error);
    res.status(500).json({ error: 'Failed to revoke consent' });
  }
});

/**
 * GET /api/plaid/sync-settings
 * Get user's sync settings
 */
router.get('/sync-settings', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const schedule = await db
      .select()
      .from(plaidSyncSchedule)
      .where(eq(plaidSyncSchedule.userId, req.user.id))
      .limit(1);

    res.json({
      settings: schedule.length > 0 ? {
        autoSyncEnabled: schedule[0].enabled,
        syncFrequency: schedule[0].frequency,
        syncTime: schedule[0].syncTime || '02:00',
        includeTransactions: true,
        includeInvestments: true,
        notifyOnSync: false,
        notifyOnErrors: true
      } : {
        autoSyncEnabled: true,
        syncFrequency: 'monthly',
        syncTime: '02:00',
        includeTransactions: true,
        includeInvestments: true,
        notifyOnSync: false,
        notifyOnErrors: true
      }
    });
  } catch (error: any) {
    console.error('Error getting sync settings:', error);
    res.status(500).json({ error: 'Failed to get sync settings' });
  }
});

/**
 * PUT /api/plaid/sync-settings
 * Update user's sync settings
 */
router.put('/sync-settings', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { settings } = req.body;
    
    // Check if schedule exists
    const existing = await db
      .select()
      .from(plaidSyncSchedule)
      .where(eq(plaidSyncSchedule.userId, req.user.id))
      .limit(1);

    if (existing.length > 0) {
      // Update existing schedule
      await db
        .update(plaidSyncSchedule)
        .set({
          enabled: settings.autoSyncEnabled,
          frequency: settings.syncFrequency,
          syncTime: settings.syncTime,
          updatedAt: new Date()
        })
        .where(eq(plaidSyncSchedule.id, existing[0].id));
    } else {
      // Create new schedule
      await db.insert(plaidSyncSchedule).values({
        userId: req.user.id,
        enabled: settings.autoSyncEnabled,
        frequency: settings.syncFrequency,
        syncTime: settings.syncTime,
        lastSyncAt: null,
        nextSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      });
    }

    res.json({
      success: true,
      message: 'Sync settings updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating sync settings:', error);
    res.status(500).json({ error: 'Failed to update sync settings' });
  }
});

/**
 * GET /api/plaid/sync-status
 * Get sync status and limits
 */
router.get('/sync-status', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const syncStatus = await PlaidSyncScheduler.getSyncStatus(req.user.id);
    
    res.json(syncStatus);
  } catch (error: any) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * GET /api/plaid/intake-form-data
 * Get Plaid accounts mapped to intake form format from database
 */
router.get('/intake-form-data', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Use the new database mapper for better persistence and consistency
    const { PlaidIntakeDatabaseMapper } = await import('../services/plaid-intake-database-mapper');
    const comprehensiveData = await PlaidIntakeDatabaseMapper.getComprehensiveIntakeData(req.user.id);
    
    // Return data in the format expected by the frontend for Step 3
    res.json({
      success: comprehensiveData.success,
      assets: comprehensiveData.step3.assets,
      liabilities: comprehensiveData.step3.liabilities,
      mortgages: comprehensiveData.step4.mortgages,
      totalAssets: comprehensiveData.step3.totalAssets,
      totalLiabilities: comprehensiveData.step3.totalLiabilities,
      totalMortgages: comprehensiveData.step4.totalMortgages,
      lastSynced: comprehensiveData.lastSynced
    });
  } catch (error: any) {
    console.error('Error getting intake form data:', error);
    res.status(500).json({ 
      error: 'Failed to get intake form data',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/intake-step/:stepNumber
 * Get Plaid data for a specific intake form step
 */
router.get('/intake-step/:stepNumber', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stepNumber = parseInt(req.params.stepNumber);
    if (![3, 4, 11].includes(stepNumber)) {
      return res.status(400).json({ error: 'Invalid step number. Only steps 3, 4, and 11 have Plaid data.' });
    }

    const { PlaidIntakeDatabaseMapper } = await import('../services/plaid-intake-database-mapper');
    const stepData = await PlaidIntakeDatabaseMapper.getStepData(req.user.id, stepNumber);
    
    res.json({
      success: true,
      step: stepNumber,
      data: stepData
    });
  } catch (error: any) {
    console.error(`Error getting intake step ${req.params.stepNumber} data:`, error);
    res.status(500).json({ 
      error: 'Failed to get step data',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/intake-accounts
 * Get Plaid accounts with proper owner name matching for intake form
 */
router.get('/intake-accounts', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user's first name and spouse first name from query params
    const userFirstName = req.query.userFirstName as string | undefined;
    const spouseFirstName = req.query.spouseFirstName as string | undefined;

    // Use the database mapper with name matching
    const { PlaidIntakeDatabaseMapper } = await import('../services/plaid-intake-database-mapper');
    const comprehensiveData = await PlaidIntakeDatabaseMapper.getComprehensiveIntakeData(
      req.user.id, 
      userFirstName, 
      spouseFirstName
    );
    
    // Return data specifically formatted for intake form step 3
    res.json({
      success: true,
      assets: comprehensiveData.step3.assets,
      liabilities: comprehensiveData.step3.liabilities,
      totalAssets: comprehensiveData.step3.totalAssets,
      totalLiabilities: comprehensiveData.step3.totalLiabilities,
      lastSynced: comprehensiveData.lastSynced
    });
  } catch (error: any) {
    console.error('Error getting intake accounts data:', error);
    res.status(500).json({ 
      error: 'Failed to get intake accounts data',
      message: error.message 
    });
  }
});

/**
 * GET /api/plaid/accounts-summary
 * Get summary of Plaid accounts for preview before import
 */
router.get('/accounts-summary', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { PlaidIntakeMapper } = await import('../services/plaid-intake-mapper');
    const summary = await PlaidIntakeMapper.getAccountsSummary(req.user.id);
    
    res.json(summary);
  } catch (error: any) {
    console.error('Error getting accounts summary:', error);
    res.status(500).json({ 
      error: 'Failed to get accounts summary',
      message: error.message 
    });
  }
});

/**
 * POST /api/plaid/transactions/categorize
 * Fetch and categorize transactions for household expense auto-fill
 */
router.post('/transactions/categorize', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('[Plaid Route] Starting transaction categorization for user:', req.user.id);

    // Get days to look back (default 30)
    const daysBack = req.body.daysBack || 30;
    
    // Import the categorizer service
    const { PlaidTransactionCategorizer } = await import('../services/plaid-transaction-categorizer');
    
    // Perform categorization
    const result = await PlaidTransactionCategorizer.categorizeHouseholdExpenses(
      req.user.id,
      daysBack
    );
    
    console.log('[Plaid Route] Categorization complete:', {
      totalExpenses: result.totalExpenses,
      transactionCount: result.transactionCount,
      accountCount: result.accountCount
    });
    
    // Store the categorization result in monthlyExpenses if successful
    if (result.transactionCount > 0) {
      try {
        // Get current profile
        const [profile] = await db.select()
          .from(financialProfiles)
          .where(eq(financialProfiles.userId, req.user.id))
          .limit(1);
        
        if (profile) {
          // Update the monthlyExpenses with categorized data
          const monthlyExpenses = profile.monthlyExpenses || {};
          const updatedExpenses = {
            ...monthlyExpenses,
            ...result.categorizedExpenses,
            // Store metadata for reference
            _lastAutoFill: {
              date: new Date().toISOString(),
              total: result.totalExpenses,
              transactionCount: result.transactionCount,
              accountCount: result.accountCount
            }
          };
          
          await db.update(financialProfiles)
            .set({
              monthlyExpenses: JSON.stringify(updatedExpenses)
            })
            .where(eq(financialProfiles.userId, req.user.id));
        }
      } catch (cacheError) {
        console.error('[Plaid Route] Failed to save categorization:', cacheError);
        // Non-blocking error
      }
    }
    
    res.json({
      success: true,
      ...result,
      transactions: undefined // Don't send individual transactions to frontend
    });
    
  } catch (error: any) {
    console.error('[Plaid Route] Error categorizing transactions:', error);
    res.status(500).json({ 
      error: 'Failed to categorize transactions',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Fetch and categorize investment holdings for portfolio allocation
router.get('/portfolio-allocation', requireAuth, async (req, res) => {
  try {
    console.log('[Plaid Route] Fetching portfolio allocation for user:', req.user.id);
    
    // Check for debug flag
    const enableDebug = req.query.debug === 'true';
    
    // Import the investment categorizer service
    const { InvestmentCategorizer } = await import('../services/investment-categorizer');
    
    // Fetch and categorize holdings
    const result = await InvestmentCategorizer.fetchAndCategorizeHoldings(req.user.id, enableDebug);
    
    console.log('[Plaid Route] Portfolio allocation complete:', {
      holdingsCount: result.holdings.length,
      totalValue: result.totalValue,
      accountCount: result.accountCount,
      allocation: result.allocation
    });
    
    // Optionally save to financial profile for caching
    if (result.holdings.length > 0) {
      try {
        const [profile] = await db.select()
          .from(financialProfiles)
          .where(eq(financialProfiles.userId, req.user.id))
          .limit(1);
        
        if (profile) {
          await db.update(financialProfiles)
            .set({
              currentAllocation: JSON.stringify(result.allocation.Total),
              lastUpdated: new Date()
            })
            .where(eq(financialProfiles.userId, req.user.id));
        }
      } catch (cacheError) {
        console.error('[Plaid Route] Failed to cache allocation:', cacheError);
        // Non-blocking error
      }
    }
    
    const response: any = {
      success: true,
      allocation: result.allocation,
      totalValue: result.totalValue,
      accountCount: result.accountCount,
      holdingsCount: result.holdings.length
    };
    
    // Include debug info if requested
    if (enableDebug && result.debug) {
      response.debug = result.debug;
    }
    
    res.json(response);
    
  } catch (error: any) {
    console.error('[Plaid Route] Error fetching portfolio allocation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch portfolio allocation'
    });
  }
});

// Sync investment holdings (manual trigger)
router.post('/sync-investment-holdings', requireAuth, async (req, res) => {
  try {
    console.log('[Plaid Route] Manual investment sync triggered for user:', req.user.id);
    
    const { InvestmentCategorizer } = await import('../services/investment-categorizer');
    
    // Perform sync
    const result = await InvestmentCategorizer.fetchAndCategorizeHoldings(req.user.id);
    
    res.json({
      success: true,
      message: 'Investment holdings synced successfully',
      holdingsSynced: result.holdings.length,
      accountsProcessed: result.accountCount,
      allocation: result.allocation
    });
    
  } catch (error: any) {
    console.error('[Plaid Route] Error syncing investment holdings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync investment holdings'
    });
  }
});

export default router;