import { db } from '../db';
import { 
  plaidSyncRecovery, 
  plaidItems,
  auditLogs 
} from '../../shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { PlaidService } from './plaid-service';
import { PlaidDataAggregator } from './plaid-data-aggregator';
import { NotificationService } from './notification-service';
import { AuditLogger } from './encryption-service';

interface SyncFailure {
  itemId: number;
  userId: number;
  syncType: 'accounts' | 'transactions' | 'investments' | 'liabilities';
  error: string;
  retryCount: number;
  lastAttempt: Date;
}

/**
 * Service for handling Plaid sync failures and recovery
 */
export class PlaidSyncRecovery {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAYS = [
    5 * 60 * 1000,    // 5 minutes
    30 * 60 * 1000,   // 30 minutes
    2 * 60 * 60 * 1000 // 2 hours
  ];

  /**
   * Record a sync failure for recovery
   */
  static async recordSyncFailure(
    itemId: number,
    userId: number,
    syncType: string,
    error: any
  ): Promise<void> {
    try {
      // Check existing sync status
      const existing = await db
        .select()
        .from(plaidSyncRecovery)
        .where(
          and(
            eq(plaidSyncRecovery.plaidItemId, itemId),
            eq(plaidSyncRecovery.syncType, syncType)
          )
        )
        .limit(1);

      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      const now = new Date();

      if (existing.length > 0) {
        // Update existing failure record
        const retryCount = (existing[0].retryCount || 0) + 1;
        
        await db
          .update(plaidSyncRecovery)
          .set({
            status: 'failed',
            lastError: errorMessage,
            retryCount,
            nextRetryAt: this.calculateNextRetryTime(retryCount),
            lastAttemptAt: now
          })
          .where(eq(plaidSyncRecovery.id, existing[0].id));
      } else {
        // Create new failure record
        await db.insert(plaidSyncRecovery).values({
          plaidItemId: itemId,
          syncType,
          status: 'failed',
          lastSyncedAt: null,
          lastError: errorMessage,
          retryCount: 1,
          nextRetryAt: this.calculateNextRetryTime(1),
          lastAttemptAt: now
        });
      }

      // Log for audit
      await AuditLogger.logPlaidOperation(
        userId,
        `sync_failed_${syncType}`,
        itemId.toString(),
        false,
        errorMessage
      );

      // Notify user if max retries reached
      if ((existing[0]?.retryCount || 0) >= this.MAX_RETRY_ATTEMPTS) {
        await this.notifyMaxRetriesReached(userId, itemId, syncType, errorMessage);
      }
    } catch (error) {
      console.error('Failed to record sync failure:', error);
    }
  }

  /**
   * Attempt recovery for failed syncs
   */
  static async attemptRecovery(): Promise<void> {
    try {
      const now = new Date();
      
      // Find all failed syncs ready for retry
      const failedSyncs = await db
        .select({
          syncStatus: plaidSyncRecovery,
          plaidItem: plaidItems
        })
        .from(plaidSyncRecovery)
        .innerJoin(plaidItems, eq(plaidSyncRecovery.plaidItemId, plaidItems.id))
        .where(
          and(
            eq(plaidSyncRecovery.status, 'failed'),
            lt(plaidSyncRecovery.retryCount, this.MAX_RETRY_ATTEMPTS),
            lt(plaidSyncRecovery.nextRetryAt, now)
          )
        );

      console.log(`Found ${failedSyncs.length} failed syncs to retry`);

      for (const { syncStatus, plaidItem } of failedSyncs) {
        await this.retrySingleSync(syncStatus, plaidItem);
      }
    } catch (error) {
      console.error('Error in sync recovery:', error);
    }
  }

  /**
   * Retry a single failed sync
   */
  private static async retrySingleSync(
    syncStatus: any,
    plaidItem: any
  ): Promise<void> {
    console.log(`Retrying ${syncStatus.syncType} sync for item ${plaidItem.id}`);
    
    try {
      let success = false;
      const startTime = Date.now();

      // Attempt sync based on type
      switch (syncStatus.syncType) {
        case 'accounts':
          await PlaidService.syncAccounts(
            plaidItem.id,
            await this.getDecryptedAccessToken(plaidItem),
            plaidItem.userId
          );
          success = true;
          break;

        case 'transactions':
          await PlaidService.syncTransactions(plaidItem.userId);
          success = true;
          break;

        case 'investments':
          await PlaidService.syncInvestmentHoldings(plaidItem.userId);
          success = true;
          break;

        case 'liabilities':
          await PlaidService.syncLiabilities(plaidItem.userId);
          success = true;
          break;

        default:
          console.warn(`Unknown sync type: ${syncStatus.syncType}`);
      }

      if (success) {
        // Mark as successful
        await db
          .update(plaidSyncRecovery)
          .set({
            status: 'active',
            lastSyncedAt: new Date(),
            lastError: null,
            retryCount: 0,
            nextRetryAt: null,
            syncDuration: Date.now() - startTime
          })
          .where(eq(plaidSyncRecovery.id, syncStatus.id));

        console.log(`Successfully recovered ${syncStatus.syncType} sync for item ${plaidItem.id}`);
        
        // Trigger data aggregation update
        await PlaidDataAggregator.createAggregatedSnapshot(plaidItem.userId);
        
        // Log success
        await AuditLogger.logPlaidOperation(
          plaidItem.userId,
          `sync_recovered_${syncStatus.syncType}`,
          plaidItem.itemId,
          true
        );
      }
    } catch (error: any) {
      console.error(`Retry failed for ${syncStatus.syncType}:`, error);
      
      const newRetryCount = syncStatus.retryCount + 1;
      
      // Update failure record
      await db
        .update(plaidSyncRecovery)
        .set({
          lastError: error?.message || 'Unknown error',
          retryCount: newRetryCount,
          nextRetryAt: this.calculateNextRetryTime(newRetryCount),
          lastAttemptAt: new Date()
        })
        .where(eq(plaidSyncRecovery.id, syncStatus.id));

      // Check if max retries reached
      if (newRetryCount >= this.MAX_RETRY_ATTEMPTS) {
        await this.handleMaxRetriesReached(plaidItem, syncStatus.syncType, error);
      }
    }
  }

  /**
   * Handle when max retries are reached
   */
  private static async handleMaxRetriesReached(
    plaidItem: any,
    syncType: string,
    error: any
  ): Promise<void> {
    // Mark item as requiring attention
    if (error?.error_code === 'ITEM_LOGIN_REQUIRED') {
      await db
        .update(plaidItems)
        .set({
          status: 'requires_reauth',
          errorCode: error.error_code,
          errorMessage: 'Please re-authenticate your account'
        })
        .where(eq(plaidItems.id, plaidItem.id));
    }

    // Notify user
    await NotificationService.notify(plaidItem.userId, {
      type: 'plaid_error',
      title: 'Account Sync Failed',
      message: `Unable to sync ${syncType} data from ${plaidItem.institutionName || 'your bank'}. Please check your connection.`,
      severity: 'warning',
      actionRequired: true,
      actionUrl: '/settings/linked-accounts'
    });

    // Log critical failure
    await AuditLogger.logPlaidOperation(
      plaidItem.userId,
      `sync_max_retries_${syncType}`,
      plaidItem.itemId,
      false,
      error?.message
    );
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private static calculateNextRetryTime(retryCount: number): Date {
    const delayIndex = Math.min(retryCount - 1, this.RETRY_DELAYS.length - 1);
    const delay = this.RETRY_DELAYS[delayIndex];
    
    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 60 * 1000; // Up to 1 minute jitter
    
    return new Date(Date.now() + delay + jitter);
  }

  /**
   * Get decrypted access token
   */
  private static async getDecryptedAccessToken(plaidItem: any): string {
    const { EncryptionService } = await import('./encryption-service');
    return EncryptionService.decrypt(plaidItem.accessToken);
  }

  /**
   * Notify user when max retries reached
   */
  private static async notifyMaxRetriesReached(
    userId: number,
    itemId: number,
    syncType: string,
    error: string
  ): Promise<void> {
    const item = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.id, itemId))
      .limit(1);

    if (item.length > 0) {
      await NotificationService.notify(userId, {
        type: 'plaid_error',
        title: 'Sync Failed - Action Required',
        message: `Failed to sync ${syncType} from ${item[0].institutionName || 'your bank'} after multiple attempts. Error: ${error}`,
        severity: 'error',
        actionRequired: true,
        actionUrl: '/settings/linked-accounts'
      });
    }
  }

  /**
   * Manual retry for a specific item
   */
  static async manualRetry(
    userId: number,
    itemId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Reset retry counts for all sync types
      await db
        .update(plaidSyncRecovery)
        .set({
          retryCount: 0,
          nextRetryAt: new Date(),
          status: 'pending'
        })
        .where(eq(plaidSyncRecovery.plaidItemId, itemId));

      // Trigger immediate recovery
      await this.attemptRecovery();

      return {
        success: true,
        message: 'Retry initiated successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Failed to initiate retry'
      };
    }
  }

  /**
   * Get sync health status for a user
   */
  static async getSyncHealth(userId: number): Promise<any> {
    const items = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.userId, userId));

    const healthStatus = [];

    for (const item of items) {
      const syncStatuses = await db
        .select()
        .from(plaidSyncRecovery)
        .where(eq(plaidSyncRecovery.plaidItemId, item.id));

      const failedSyncs = syncStatuses.filter(s => s.status === 'failed');
      const pendingSyncs = syncStatuses.filter(s => s.status === 'pending');

      healthStatus.push({
        itemId: item.id,
        institutionName: item.institutionName,
        status: item.status,
        totalSyncs: syncStatuses.length,
        failedSyncs: failedSyncs.length,
        pendingSyncs: pendingSyncs.length,
        requiresReauth: item.status === 'requires_reauth',
        lastError: item.errorMessage,
        syncDetails: syncStatuses.map(s => ({
          type: s.syncType,
          status: s.status,
          lastSync: s.lastSyncedAt,
          lastError: s.lastError,
          retryCount: s.retryCount,
          nextRetry: s.nextRetryAt
        }))
      });
    }

    return healthStatus;
  }
}

/**
 * Schedule periodic recovery attempts
 */
export function startSyncRecoveryScheduler(): void {
  // Run recovery every 10 minutes
  setInterval(async () => {
    try {
      await PlaidSyncRecovery.attemptRecovery();
    } catch (error) {
      console.error('Sync recovery scheduler error:', error);
    }
  }, 10 * 60 * 1000);

  console.log('Plaid sync recovery scheduler started');
}

export default PlaidSyncRecovery;