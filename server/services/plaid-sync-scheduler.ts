import cron from 'node-cron';
import { db, checkDatabaseHealth as checkDbHealth } from '../db';
import { 
  plaidSyncSchedule, 
  plaidItems,
  users,
  plaidAggregatedSnapshot
} from '../../shared/schema';
import { eq, and, lte, or, isNull, desc } from 'drizzle-orm';
import { PlaidService } from './plaid-service';
import { PlaidDataAggregator } from './plaid-data-aggregator';
import { NotificationService } from './notification-service';

/**
 * Plaid Sync Scheduler Service
 * Manages automatic monthly syncing of Plaid data
 */
export class PlaidSyncScheduler {
  private static cronJob: cron.ScheduledTask | null = null;
  private static isRunning = false;

  /**
   * Initialize the scheduler
   */
  static initialize() {
    const syncIntervalDays = parseInt(process.env.PLAID_SYNC_INTERVAL_DAYS || '30', 10);
    console.log(`[PlaidSyncScheduler] Initializing sync scheduler with ${syncIntervalDays}-day interval...`);

    // Allow disabling entirely by env flag
    if (process.env.PLAID_SYNC_ENABLED === 'false' || process.env.DISABLE_PLAID_AUTO_SYNC === 'true') {
      if (process.env.DISABLE_PLAID_AUTO_SYNC === 'true') {
        console.log('[PlaidSyncScheduler] Disabled by legacy env (DISABLE_PLAID_AUTO_SYNC=true)');
      }
      console.log('[PlaidSyncScheduler] Disabled by env (PLAID_SYNC_ENABLED=false)');
      return;
    }

    // Run daily at 2 AM to check for users needing sync
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      await this.runScheduledSyncs();
    });

    // Only run on startup in production or if explicitly enabled
    const runOnStartup =
      process.env.PLAID_SYNC_RUN_ON_STARTUP === 'true' || process.env.NODE_ENV === 'production';

    if (runOnStartup) {
      setTimeout(async () => {
        const healthy = await checkDbHealth().catch(() => false);
        if (!healthy) {
          console.warn('[PlaidSyncScheduler] Skipping startup sync: database not reachable');
          return;
        }
        await this.runScheduledSyncs();
      }, 5000);
    } else {
      console.log('[PlaidSyncScheduler] Skipping startup sync run (dev/default)');
    }

    console.log(`[PlaidSyncScheduler] Scheduler initialized. Checking daily at 2 AM for users needing sync (${syncIntervalDays}-day interval).`);
  }

  /**
   * Stop the scheduler
   */
  static stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[PlaidSyncScheduler] Scheduler stopped.');
    }
  }

  /**
   * Run scheduled syncs for all users due for sync
   */
  static async runScheduledSyncs() {
    if (this.isRunning) {
      console.log('[PlaidSyncScheduler] Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('[PlaidSyncScheduler] Starting scheduled sync run...');

    // Bail early if DB is down to avoid noisy errors
    const healthy = await checkDbHealth().catch(() => false);
    if (!healthy) {
      console.warn('[PlaidSyncScheduler] Database not reachable; skipping scheduled sync run');
      this.isRunning = false;
      return;
    }

    try {
      const now = new Date();
      
      // Find all users with sync schedules due for sync
      const syncIntervalDays = parseInt(process.env.PLAID_SYNC_INTERVAL_DAYS || '30', 10);
      const dueSchedules = await db.select()
        .from(plaidSyncSchedule)
        .where(and(
          eq(plaidSyncSchedule.autoSyncEnabled, true),
          or(
            isNull(plaidSyncSchedule.nextSyncDate),
            lte(plaidSyncSchedule.nextSyncDate, now)
          )
        ));
      
      console.log(`[PlaidSyncScheduler] Found ${dueSchedules.length} users due for sync.`);
      
      for (const schedule of dueSchedules) {
        try {
          await this.syncUserData(schedule.userId, schedule);
        } catch (error) {
          console.error(`[PlaidSyncScheduler] Error syncing user ${schedule.userId}:`, error);
        }
      }
      
      console.log('[PlaidSyncScheduler] Scheduled sync run completed.');
    } catch (error) {
      console.error('[PlaidSyncScheduler] Error in scheduled sync run:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync data for a specific user
   */
  static async syncUserData(userId: number, schedule?: any) {
    console.log(`[PlaidSyncScheduler] Syncing data for user ${userId}...`);
    
    // Get or create sync schedule
    if (!schedule) {
      [schedule] = await db.select()
        .from(plaidSyncSchedule)
        .where(eq(plaidSyncSchedule.userId, userId))
        .limit(1);
      
      if (!schedule) {
        // Create default schedule
        [schedule] = await db.insert(plaidSyncSchedule).values({
          userId,
          syncFrequency: 'monthly',
          autoSyncEnabled: true,
          nextSyncDate: this.calculateNextSyncDate('monthly')
        }).returning();
      }
    }
    
    // Check if 30 days have passed since last sync
    const syncIntervalDays = parseInt(process.env.PLAID_SYNC_INTERVAL_DAYS || '30', 10);
    if (schedule.lastFullSync) {
      const daysSinceLastSync = Math.floor(
        (Date.now() - new Date(schedule.lastFullSync).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastSync < syncIntervalDays) {
        console.log(`[PlaidSyncScheduler] Skipping sync for user ${userId} - only ${daysSinceLastSync} days since last sync (minimum: ${syncIntervalDays} days)`);
        return { skipped: true, reason: `Last sync was ${daysSinceLastSync} days ago, waiting for ${syncIntervalDays} day interval` };
      }
    }
    
    const syncResults = {
      accounts: false,
      transactions: false,
      investments: false,
      liabilities: false,
      snapshot: false,
      error: null as any
    };
    
    try {
      // Check if user has any active Plaid items
      const items = await db.select()
        .from(plaidItems)
        .where(and(
          eq(plaidItems.userId, userId),
          eq(plaidItems.status, 'active')
        ));
      
      if (items.length === 0) {
        console.log(`[PlaidSyncScheduler] User ${userId} has no active Plaid items, skipping...`);
        return;
      }
      
      // Sync accounts
      if (schedule.syncTransactions || schedule.syncInvestments || schedule.syncLiabilities) {
        try {
          for (const item of items) {
            // Decrypt access token
            const accessToken = this.decryptAccessToken(item.accessToken);
            await PlaidService.syncAccounts(item.id, accessToken, userId);
          }
          syncResults.accounts = true;
        } catch (error) {
          console.error(`[PlaidSyncScheduler] Error syncing accounts for user ${userId}:`, error);
        }
      }
      
      // Sync transactions
      if (schedule.syncTransactions) {
        try {
          const daysToSync = schedule.transactionDaysToSync || 30;
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - daysToSync);
          
          await PlaidService.syncTransactions(userId, startDate);
          syncResults.transactions = true;
        } catch (error) {
          console.error(`[PlaidSyncScheduler] Error syncing transactions for user ${userId}:`, error);
        }
      }
      
      // Sync investments
      if (schedule.syncInvestments) {
        try {
          await PlaidService.syncInvestmentHoldings(userId);
          syncResults.investments = true;
        } catch (error) {
          console.error(`[PlaidSyncScheduler] Error syncing investments for user ${userId}:`, error);
        }
      }
      
      // Sync liabilities
      if (schedule.syncLiabilities) {
        try {
          await PlaidService.syncLiabilities(userId);
          syncResults.liabilities = true;
        } catch (error) {
          console.error(`[PlaidSyncScheduler] Error syncing liabilities for user ${userId}:`, error);
        }
      }
      
      // Auto-categorize new accounts
      await PlaidDataAggregator.autoCategorizeNewAccounts(userId);
      
      // Create aggregated snapshot
      try {
        await PlaidDataAggregator.createAggregatedSnapshot(userId);
        syncResults.snapshot = true;
      } catch (error) {
        console.error(`[PlaidSyncScheduler] Error creating snapshot for user ${userId}:`, error);
      }
      
      // Auto-sync to financial_profiles for intake form
      try {
        const { PlaidIntakeDirectMapper } = await import('./plaid-intake-direct-mapper');
        await PlaidIntakeDirectMapper.syncAllToProfile(userId);
        console.log(`[PlaidSyncScheduler] Auto-synced to financial_profiles for user ${userId}`);
      } catch (error) {
        console.error(`[PlaidSyncScheduler] Error syncing to financial_profiles:`, error);
      }
      
      // Update sync schedule
      const nextSyncDate = this.calculateNextSyncDate(schedule.syncFrequency);
      await db.update(plaidSyncSchedule)
        .set({
          lastFullSync: new Date(),
          nextSyncDate,
          updatedAt: new Date()
        })
        .where(eq(plaidSyncSchedule.userId, userId));
      
      console.log(`[PlaidSyncScheduler] Sync completed for user ${userId}. Results:`, syncResults);
      
      // Get institution names for notification
      const plaidItemsForNotification = await db.select()
        .from(plaidItems)
        .where(eq(plaidItems.userId, userId));
      
      const institutionNames = plaidItemsForNotification.map(item => item.institutionName || 'Bank').join(', ');
      
      // Send success notification
      const successCount = Object.values(syncResults).filter(v => v === true).length;
      if (successCount > 0) {
        await NotificationService.notifyPlaidSyncSuccess(
          userId,
          institutionNames,
          new Date()
        );
      }
      
      // Check for large changes and notify if needed
      if (schedule.notifyOnLargeChanges) {
        await this.checkForLargeChanges(userId, schedule.largeChangeThreshold);
      }
      
    } catch (error) {
      console.error(`[PlaidSyncScheduler] Critical error syncing user ${userId}:`, error);
      syncResults.error = error;
      
      // Send error notification
      const plaidItemsForError = await db.select()
        .from(plaidItems)
        .where(eq(plaidItems.userId, userId));
      
      const institutionNames = plaidItemsForError.map(item => item.institutionName || 'Bank').join(', ');
      
      await NotificationService.notifyPlaidSyncError(
        userId,
        institutionNames,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
    
    return syncResults;
  }

  /**
   * Calculate next sync date based on frequency
   */
  static calculateNextSyncDate(frequency: string): Date {
    const date = new Date();
    const syncIntervalDays = parseInt(process.env.PLAID_SYNC_INTERVAL_DAYS || '30', 10);
    
    switch (frequency) {
      case 'daily':
        // Override with 30-day interval if set
        date.setDate(date.getDate() + syncIntervalDays);
        break;
      case 'weekly':
        // Override with 30-day interval if set
        date.setDate(date.getDate() + syncIntervalDays);
        break;
      case 'monthly':
      default:
        // Use 30-day interval from env or default to monthly
        date.setDate(date.getDate() + syncIntervalDays);
        break;
    }
    
    // Set to 2 AM
    date.setHours(2, 0, 0, 0);
    
    return date;
  }

  /**
   * Manually trigger sync for a user
   */
  static async manualSync(userId: number) {
    console.log(`[PlaidSyncScheduler] Manual sync requested for user ${userId}`);
    
    // Check rate limiting
    const [schedule] = await db.select()
      .from(plaidSyncSchedule)
      .where(eq(plaidSyncSchedule.userId, userId))
      .limit(1);
    
    if (schedule) {
      const today = new Date().toDateString();
      const resetDate = schedule.manualSyncResetDate?.toDateString();
      
      if (resetDate !== today) {
        // Reset counter for new day
        await db.update(plaidSyncSchedule)
          .set({
            manualSyncsToday: 1,
            manualSyncResetDate: new Date()
          })
          .where(eq(plaidSyncSchedule.userId, userId));
      } else if ((schedule.manualSyncsToday || 0) >= 3) {
        // Send rate limit notification
        await NotificationService.notifyRateLimitReached(userId, 0);
        throw new Error('Daily manual sync limit reached (3 per day)');
      } else {
        // Increment counter
        await db.update(plaidSyncSchedule)
          .set({
            manualSyncsToday: (schedule.manualSyncsToday || 0) + 1
          })
          .where(eq(plaidSyncSchedule.userId, userId));
      }
    }
    
    // Run sync
    const result = await this.syncUserData(userId, schedule);
    
    // Notify about remaining syncs
    const remainingSyncs = 3 - (schedule?.manualSyncsToday || 1);
    if (remainingSyncs < 3 && remainingSyncs > 0) {
      await NotificationService.createNotification(
        userId,
        'plaid_sync_success' as any,
        { remainingSyncs }
      );
    }
    
    return result;
  }

  /**
   * Check for large balance changes
   */
  private static async checkForLargeChanges(userId: number, threshold: string | null) {
    if (!threshold) return;
    
    const thresholdAmount = parseFloat(threshold);
    if (thresholdAmount <= 0) return;
    
    // Get last two snapshots
    const snapshots = await db.select()
      .from(plaidAggregatedSnapshot)
      .where(eq(plaidAggregatedSnapshot.userId, userId))
      .orderBy(desc(plaidAggregatedSnapshot.snapshotDate))
      .limit(2);
    
    if (snapshots.length < 2) return;
    
    const [current, previous] = snapshots;
    const netWorthChange = Math.abs(
      parseFloat(current.netWorth || '0') - parseFloat(previous.netWorth || '0')
    );
    
    if (netWorthChange >= thresholdAmount) {
      console.log(`[PlaidSyncScheduler] Large change detected for user ${userId}: $${netWorthChange.toFixed(2)}`);
      // TODO: Send notification to user
    }
  }

  /**
   * Get sync status for a user
   */
  static async getSyncStatus(userId: number) {
    try {
      const schedule = await db.select()
        .from(plaidSyncSchedule)
        .where(eq(plaidSyncSchedule.userId, userId))
        .limit(1);
      
      if (schedule.length === 0) {
        // Create default schedule if none exists
        await db.insert(plaidSyncSchedule).values({
          userId,
          syncFrequency: 'monthly',
          nextSyncDate: this.calculateNextSyncDate('monthly'),
          autoSyncEnabled: true,
          manualSyncsToday: 0,
          manualSyncResetDate: new Date()
        });
        
        return {
          lastSync: null,
          nextSync: this.calculateNextSyncDate('monthly'),
          syncsToday: 0,
          syncsRemaining: 5,
          maxDailySyncs: 5,
          isAutoSyncEnabled: true
        };
      }
      
      const userSchedule = schedule[0];
      const now = new Date();
      
      // Reset daily sync count if needed
      if (userSchedule.manualSyncResetDate && 
          new Date(userSchedule.manualSyncResetDate) < new Date(now.toDateString())) {
        await db.update(plaidSyncSchedule)
          .set({
            manualSyncsToday: 0,
            manualSyncResetDate: now
          })
          .where(eq(plaidSyncSchedule.userId, userId));
        userSchedule.manualSyncsToday = 0;
      }
      
      const maxDailySyncs = 5; // Rate limit
      const syncsRemaining = Math.max(0, maxDailySyncs - (userSchedule.manualSyncsToday || 0));
      
      return {
        lastSync: userSchedule.lastFullSync,
        nextSync: userSchedule.nextSyncDate,
        syncsToday: userSchedule.manualSyncsToday || 0,
        syncsRemaining,
        maxDailySyncs,
        isAutoSyncEnabled: userSchedule.autoSyncEnabled
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }

  /**
   * Update user sync preferences
   */
  static async updateSyncPreferences(userId: number, preferences: Partial<typeof plaidSyncSchedule.$inferInsert>) {
    const existing = await db.select()
      .from(plaidSyncSchedule)
      .where(eq(plaidSyncSchedule.userId, userId))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(plaidSyncSchedule)
        .set({
          ...preferences,
          updatedAt: new Date()
        })
        .where(eq(plaidSyncSchedule.userId, userId));
    } else {
      await db.insert(plaidSyncSchedule).values({
        userId,
        ...preferences
      });
    }
    
    // If frequency changed, update next sync date
    if (preferences.syncFrequency) {
      const nextSyncDate = this.calculateNextSyncDate(preferences.syncFrequency);
      await db.update(plaidSyncSchedule)
        .set({ nextSyncDate })
        .where(eq(plaidSyncSchedule.userId, userId));
    }
  }

  /**
   * Decrypt access token (helper method)
   */
  private static decryptAccessToken(encryptedToken: string): string {
    const { EncryptionService } = require('./encryption-service');
    return EncryptionService.decrypt(encryptedToken);
  }
}

export default PlaidSyncScheduler;
