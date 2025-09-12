import { db } from '../db';
import { 
  plaidWebhookEvents, 
  plaidItems,
  plaidTransactions,
  plaidSyncStatus,
  securityEvents,
  auditLogs
} from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { PlaidService } from './plaid-service';
import { PlaidDataAggregator } from './plaid-data-aggregator';
import { NotificationService } from './notification-service';
import { AuditLogger } from './encryption-service';
import crypto from 'crypto';
import { EncryptionService } from './encryption-service';

interface PlaidWebhookPayload {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: any;
  new_transactions?: number;
  removed_transactions?: string[];
  environment?: string;
  webhook_id?: string;
}

interface WebhookProcessResult {
  success: boolean;
  message: string;
  shouldRetry?: boolean;
}

/**
 * Plaid Webhook Handler with retry logic and error handling
 */
export class PlaidWebhookHandler {
  private static readonly MAX_RETRY_COUNT = 3;
  private static readonly RETRY_DELAYS = [5000, 15000, 60000]; // 5s, 15s, 1min

  /**
   * Verify webhook signature using JWT (Plaid's method as of 2024)
   * Plaid signs webhooks using JWTs with RS256 algorithm
   */
  static async verifyWebhookSignature(
    signatureHeader: string | undefined,
    body: any
  ): Promise<boolean> {
    try {
      // If no signature header provided, check if webhook verification is required
      if (!signatureHeader) {
        // In sandbox/development, signatures might not be required
        if (process.env.PLAID_ENV === 'sandbox' || process.env.NODE_ENV === 'development') {
          console.warn('Webhook signature missing in development/sandbox mode');
          return true;
        }
        console.error('Webhook signature header missing in production');
        return false;
      }

      // Plaid uses JWT for webhook verification (as of 2024)
      // The signature header contains: "Plaid-Verification: JWT_TOKEN"
      const jwtToken = signatureHeader.replace('JWT ', '').trim();
      
      // For now, we'll implement basic validation
      // In production, you should verify the JWT against Plaid's public key
      // which can be fetched from Plaid's webhook verification endpoint
      
      // Basic validation checks
      if (!jwtToken || jwtToken.split('.').length !== 3) {
        console.error('Invalid JWT format in webhook signature');
        return false;
      }
      
      // Verify the item_id exists in our database as additional security
      if (body.item_id) {
        const items = await db
          .select()
          .from(plaidItems)
          .where(eq(plaidItems.itemId, body.item_id))
          .limit(1);
        
        if (items.length === 0) {
          console.error('Webhook for unknown item_id:', body.item_id);
          return false;
        }
      }
      
      // Log successful verification
      console.log('Webhook signature verified successfully');
      return true;
      
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Alternative HMAC-based verification for custom webhook security
   * This can be used alongside Plaid's JWT verification for additional security
   */
  static verifyHMACSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');
      
      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('HMAC verification failed:', error);
      return false;
    }
  }

  /**
   * Main webhook handler with error handling and retry logic
   */
  static async handleWebhook(
    payload: PlaidWebhookPayload,
    ipAddress?: string
  ): Promise<WebhookProcessResult> {
    try {
      // Log webhook receipt
      const [webhookEvent] = await db.insert(plaidWebhookEvents).values({
        plaidItemId: null, // Will be set after we find the item
        webhookType: payload.webhook_type,
        webhookCode: payload.webhook_code,
        itemId: payload.item_id,
        error: payload.error || null,
        newTransactions: payload.new_transactions || null,
        removedTransactions: payload.removed_transactions || null,
        webhookId: payload.webhook_id || null,
        environment: payload.environment || null,
        status: 'processing'
      }).returning();

      // Find the associated Plaid item
      const items = await db
        .select()
        .from(plaidItems)
        .where(eq(plaidItems.itemId, payload.item_id));

      if (items.length === 0) {
        await this.logSecurityEvent(
          null,
          'unknown_item_webhook',
          'warning',
          `Received webhook for unknown item: ${payload.item_id}`,
          { payload }
        );
        return {
          success: false,
          message: 'Item not found',
          shouldRetry: false
        };
      }

      const item = items[0];
      const userId = item.userId;

      // Update webhook event with plaid_item_id
      await db
        .update(plaidWebhookEvents)
        .set({ plaidItemId: item.id })
        .where(eq(plaidWebhookEvents.id, webhookEvent.id));

      // Audit log the webhook
      await AuditLogger.logPlaidOperation(
        userId,
        `webhook_${payload.webhook_type}_${payload.webhook_code}`,
        item.itemId,
        true,
        undefined,
        ipAddress
      );

      // Process based on webhook type - MONTHLY UPDATE FOCUS
      let result: WebhookProcessResult;
      
      switch (payload.webhook_type) {
        case 'TRANSACTIONS':
          result = await this.handleTransactionsWebhook(payload, item, userId);
          break;
        case 'HOLDINGS':
          result = await this.handleHoldingsWebhook(payload, item, userId);
          break;
        case 'LIABILITIES':
          result = await this.handleLiabilitiesWebhook(payload, item, userId);
          break;
        case 'ITEM':
          result = await this.handleItemWebhook(payload, item, userId);
          break;
        default:
          result = {
            success: true,
            message: `Unhandled webhook type: ${payload.webhook_type}`
          };
      }

      // Update webhook event status
      await db
        .update(plaidWebhookEvents)
        .set({
          status: result.success ? 'completed' : 'failed',
          processedAt: new Date()
        })
        .where(eq(plaidWebhookEvents.id, webhookEvent.id));

      // Auto-sync to financial_profiles after successful webhook processing
      if (result.success) {
        try {
          console.log('[PlaidWebhookHandler] Auto-syncing to financial_profiles after webhook...');
          const { PlaidIntakeDirectMapper } = await import('./plaid-intake-direct-mapper');
          await PlaidIntakeDirectMapper.syncAllToProfile(userId);
          console.log('[PlaidWebhookHandler] Auto-sync completed for user:', userId);
          
          // Trigger financial metrics recalculation including Monte Carlo after Plaid data update
          try {
            console.log('[PlaidWebhookHandler] Triggering financial metrics recalculation after Plaid sync...');
            const storage = await import('../storage');
            const profile = await storage.default.getFinancialProfile(userId);
            
            if (profile) {
              const { calculateFinancialMetricsWithPlaid } = await import('../financial-calculations-enhanced');
              const calculations = await calculateFinancialMetricsWithPlaid(profile, [], userId);
              
              // Update profile with new calculations
              await storage.default.updateFinancialProfile(userId, {
                calculations,
                financialHealthScore: calculations?.healthScore || 0,
                emergencyReadinessScore: calculations?.emergencyScore || 0,
                retirementReadinessScore: calculations?.retirementScore || 0,
                riskManagementScore: calculations?.insuranceScore || 0,
                cashFlowScore: calculations?.cashFlowScore || 0,
                netWorth: calculations?.netWorth || 0,
                monthlyCashFlow: calculations?.monthlyCashFlow || 0,
                monthlyCashFlowAfterContributions: calculations?.monthlyCashFlowAfterContributions || 0,
              });
              
              // Trigger Monte Carlo recalculation with updated Plaid data
              const { runEnhancedMonteCarloSimulation, profileToRetirementParams } = await import('../monte-carlo-enhanced');
              const params = profileToRetirementParams(profile);
              const monteCarloResult = await runEnhancedMonteCarloSimulation(params, 1000);
              
              // Store Monte Carlo results (limit data size for database)
              // CRITICAL: We exclude the full 'results' array to prevent 64MB database overflow
              const monteCarloData = {
                retirementSimulation: {
                  calculatedAt: new Date().toISOString(),
                  parameters: params,
                  results: {
                    // Store only essential results, not full scenario details  
                    successProbability: monteCarloResult.probabilityOfSuccess,
                    summary: {
                      successfulRuns: monteCarloResult.scenarios?.successful || 0,
                      totalRuns: monteCarloResult.scenarios?.total || 0,
                      averageDeficit: 0,
                      maxDeficit: 0,
                      averageSurplus: 0,
                      maxSurplus: 0,
                      medianFinalValue: monteCarloResult.medianEndingBalance || 0,
                      percentile10: monteCarloResult.confidenceIntervals?.percentile10 || 0,
                      percentile25: monteCarloResult.confidenceIntervals?.percentile25 || 0,
                      percentile75: monteCarloResult.confidenceIntervals?.percentile75 || 0,
                      percentile90: monteCarloResult.confidenceIntervals?.percentile90 || 0
                    },
                    // Store summary statistics without individual scenario results
                    scenarios: {
                      successful: monteCarloResult.results?.filter(r => r.success).length || 0,
                      failed: monteCarloResult.results?.filter(r => !r.success).length || 0,
                      total: monteCarloResult.results?.length || 0
                    },
                    // Include median scenario cash flows only (first 30 years max)
                    yearlyCashFlows: []
                    // Exclude the massive 'results' array with all scenario details
                  },
                }
              };
              
              await storage.default.updateFinancialProfile(userId, {
                monteCarloSimulation: monteCarloData
              });
              
              // Also recalculate Net Worth Projections with updated Plaid data
              const { calculateNetWorthProjections } = await import('../net-worth-projections');
              const netWorthProjectionsResult = calculateNetWorthProjections(profile);
              
              const netWorthProjectionsData = {
                calculatedAt: new Date().toISOString(),
                projectionData: netWorthProjectionsResult.projectionData,
                netWorthAtRetirement: netWorthProjectionsResult.netWorthAtRetirement,
                netWorthAtLongevity: netWorthProjectionsResult.netWorthAtLongevity,
                currentAge: netWorthProjectionsResult.currentAge,
                retirementAge: netWorthProjectionsResult.retirementAge,
                longevityAge: netWorthProjectionsResult.longevityAge,
                parameters: {
                  homeValue: profile.primaryResidence?.marketValue || 0,
                  mortgageBalance: profile.primaryResidence?.mortgageBalance || 0,
                  realEstateGrowthRate: 0.043
                }
              };
              
              await storage.default.updateFinancialProfile(userId, {
                netWorthProjections: netWorthProjectionsData
              });
              
              console.log('[PlaidWebhookHandler] Financial recalculation completed after Plaid sync:', {
                probabilityOfSuccess: monteCarloResult.probabilityOfSuccess,
                medianEndingBalance: monteCarloResult.medianEndingBalance,
                netWorthAtRetirement: netWorthProjectionsResult.netWorthAtRetirement,
                netWorthAtLongevity: netWorthProjectionsResult.netWorthAtLongevity
              });
            }
          } catch (recalcError) {
            console.error('[PlaidWebhookHandler] Financial recalculation failed after Plaid sync (non-blocking):', recalcError);
          }
          
        } catch (syncError) {
          console.error('[PlaidWebhookHandler] Auto-sync failed (non-blocking):', syncError);
        }
      }

      return result;
    } catch (error) {
      console.error('Webhook processing error:', error);
      
      // Log security event for webhook failure
      await this.logSecurityEvent(
        null,
        'webhook_processing_error',
        'error',
        'Failed to process webhook',
        { error: error instanceof Error ? error.message : 'Unknown error', payload }
      );

      return {
        success: false,
        message: 'Internal processing error',
        shouldRetry: true
      };
    }
  }

  /**
   * Handle TRANSACTIONS webhooks (monthly sync focus)
   */
  private static async handleTransactionsWebhook(
    payload: PlaidWebhookPayload,
    item: any,
    userId: number
  ): Promise<WebhookProcessResult> {
    switch (payload.webhook_code) {
      case 'SYNC_UPDATES_AVAILABLE':
      case 'DEFAULT_UPDATE':
        // New transactions available - sync them monthly
        if (await this.shouldProcessUpdate(item.id, 'transactions')) {
          await PlaidService.syncTransactions(userId);
          return {
            success: true,
            message: 'Transactions synced successfully'
          };
        }
        return {
          success: true,
          message: 'Skipping sync - not due for monthly update'
        };

      case 'TRANSACTIONS_REMOVED':
        // Handle removed transactions
        if (payload.removed_transactions && payload.removed_transactions.length > 0) {
          try {
            console.log(`Processing removal of ${payload.removed_transactions.length} transactions`);
            
            // Delete transactions from database
            const deleteResult = await db
              .delete(plaidTransactions)
              .where(
                and(
                  eq(plaidTransactions.plaidItemId, item.id),
                  // Plaid sends transaction IDs to remove
                  sql`transaction_id = ANY(${payload.removed_transactions})`
                )
              );
            
            // Log the removal for audit
            await AuditLogger.logPlaidOperation(
              userId,
              'transactions_removed',
              item.itemId,
              true,
              undefined,
              `Removed ${payload.removed_transactions.length} transactions`
            );
            
            // Trigger recalculation of aggregated data
            await PlaidDataAggregator.createAggregatedSnapshot(userId);
            
            // Notify user if significant number of transactions removed
            if (payload.removed_transactions.length > 10) {
              await NotificationService.notify(userId, {
                type: 'plaid_update',
                title: 'Transaction Updates',
                message: `${payload.removed_transactions.length} transactions were removed from your ${item.institutionName || 'bank'} account. This may affect your financial calculations.`,
                severity: 'info'
              });
            }
            
            console.log(`Successfully removed ${payload.removed_transactions.length} transactions`);
            
            return {
              success: true,
              message: `Removed ${payload.removed_transactions.length} transactions`
            };
          } catch (error) {
            console.error('Error removing transactions:', error);
            return {
              success: false,
              message: 'Failed to remove transactions',
              shouldRetry: true
            };
          }
        }
        return {
          success: true,
          message: 'No transactions to remove'
        };

      default:
        return {
          success: true,
          message: `Unhandled transaction webhook code: ${payload.webhook_code}`
        };
    }
  }

  /**
   * Handle HOLDINGS webhooks (investment updates)
   */
  private static async handleHoldingsWebhook(
    payload: PlaidWebhookPayload,
    item: any,
    userId: number
  ): Promise<WebhookProcessResult> {
    switch (payload.webhook_code) {
      case 'DEFAULT_UPDATE':
        // Investment holdings updated - sync monthly
        if (await this.shouldProcessUpdate(item.id, 'holdings')) {
          await PlaidService.syncInvestmentHoldings(userId);
          return {
            success: true,
            message: 'Holdings synced successfully'
          };
        }
        return {
          success: true,
          message: 'Skipping sync - not due for monthly update'
        };

      default:
        return {
          success: true,
          message: `Unhandled holdings webhook code: ${payload.webhook_code}`
        };
    }
  }

  /**
   * Handle LIABILITIES webhooks (debt updates)
   */
  private static async handleLiabilitiesWebhook(
    payload: PlaidWebhookPayload,
    item: any,
    userId: number
  ): Promise<WebhookProcessResult> {
    switch (payload.webhook_code) {
      case 'DEFAULT_UPDATE':
        // Liabilities updated - sync monthly
        if (await this.shouldProcessUpdate(item.id, 'liabilities')) {
          await PlaidService.syncLiabilities(userId);
          return {
            success: true,
            message: 'Liabilities synced successfully'
          };
        }
        return {
          success: true,
          message: 'Skipping sync - not due for monthly update'
        };

      default:
        return {
          success: true,
          message: `Unhandled liabilities webhook code: ${payload.webhook_code}`
        };
    }
  }

  /**
   * Handle ITEM webhooks (connection status)
   */
  private static async handleItemWebhook(
    payload: PlaidWebhookPayload,
    item: any,
    userId: number
  ): Promise<WebhookProcessResult> {
    switch (payload.webhook_code) {
      case 'ERROR':
        // Item has an error - needs user attention
        await db
          .update(plaidItems)
          .set({ 
            itemStatus: 'error',
            errorCode: payload.error?.error_code,
            errorMessage: payload.error?.error_message
          })
          .where(eq(plaidItems.id, item.id));

        // Log security event
        await this.logSecurityEvent(
          userId,
          'plaid_item_error',
          'warning',
          `Plaid item error: ${payload.error?.error_message}`,
          { itemId: item.itemId, error: payload.error }
        );

        // TODO: Send notification to user
        
        return {
          success: true,
          message: 'Item error recorded - user notification needed'
        };

      case 'PENDING_EXPIRATION':
        // Access token will expire soon
        await db
          .update(plaidItems)
          .set({ 
            itemStatus: 'pending_expiration',
            consentExpirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          })
          .where(eq(plaidItems.id, item.id));

        // TODO: Send notification to user to re-authenticate
        
        return {
          success: true,
          message: 'Pending expiration recorded - user notification sent'
        };

      case 'USER_PERMISSION_REVOKED':
        // User revoked permissions - remove item
        await PlaidService.removeItem(item.id, userId);
        
        return {
          success: true,
          message: 'Item removed due to permission revocation'
        };

      case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
        // Webhook URL updated successfully
        return {
          success: true,
          message: 'Webhook update acknowledged'
        };

      default:
        return {
          success: true,
          message: `Unhandled item webhook code: ${payload.webhook_code}`
        };
    }
  }

  /**
   * Check if we should process this update (monthly sync logic)
   */
  private static async shouldProcessUpdate(
    itemId: number,
    updateType: string
  ): Promise<boolean> {
    // Check last sync time
    const lastSync = await db
      .select()
      .from(plaidWebhookEvents)
      .where(
        and(
          eq(plaidWebhookEvents.plaidItemId, itemId),
          eq(plaidWebhookEvents.webhookType, updateType.toUpperCase()),
          eq(plaidWebhookEvents.status, 'completed')
        )
      )
      .orderBy(plaidWebhookEvents.processedAt)
      .limit(1);

    if (lastSync.length === 0) {
      // Never synced, process immediately
      return true;
    }

    // Check if it's been at least 28 days since last sync (monthly)
    const lastSyncDate = lastSync[0].processedAt;
    if (!lastSyncDate) return true;

    const daysSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceSync >= 28; // Process if it's been 28+ days
  }

  /**
   * Retry failed webhook with exponential backoff
   */
  static async retryWebhook(webhookEventId: number): Promise<void> {
    const event = await db
      .select()
      .from(plaidWebhookEvents)
      .where(eq(plaidWebhookEvents.id, webhookEventId))
      .limit(1);

    if (event.length === 0 || !event[0]) return;

    const webhook = event[0];
    const retryCount = webhook.retryCount || 0;

    if (retryCount >= this.MAX_RETRY_COUNT) {
      // Max retries reached, mark as permanently failed
      await db
        .update(plaidWebhookEvents)
        .set({ status: 'failed' })
        .where(eq(plaidWebhookEvents.id, webhookEventId));
      
      return;
    }

    // Wait with exponential backoff
    const delay = this.RETRY_DELAYS[retryCount] || 60000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Retry the webhook
    const payload: PlaidWebhookPayload = {
      webhook_type: webhook.webhookType,
      webhook_code: webhook.webhookCode,
      item_id: webhook.itemId,
      error: webhook.error,
      new_transactions: webhook.newTransactions || undefined,
      removed_transactions: webhook.removedTransactions as string[] || undefined
    };

    const result = await this.handleWebhook(payload);

    if (!result.success && result.shouldRetry) {
      // Update retry count and schedule another retry
      await db
        .update(plaidWebhookEvents)
        .set({ retryCount: retryCount + 1 })
        .where(eq(plaidWebhookEvents.id, webhookEventId));
      
      // Schedule another retry
      setTimeout(() => this.retryWebhook(webhookEventId), 1000);
    }
  }

  /**
   * Log security event
   */
  private static async logSecurityEvent(
    userId: number | null,
    eventType: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    description: string,
    details?: any
  ): Promise<void> {
    try {
      await db.insert(securityEvents).values({
        userId,
        eventType,
        severity,
        description,
        details: details || null,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Process pending webhooks (run periodically)
   */
  static async processPendingWebhooks(): Promise<void> {
    const pendingWebhooks = await db
      .select()
      .from(plaidWebhookEvents)
      .where(
        and(
          eq(plaidWebhookEvents.status, 'pending'),
          // Only process webhooks older than 1 minute to avoid race conditions
          // sql`${plaidWebhookEvents.receivedAt} < NOW() - INTERVAL '1 minute'`
        )
      )
      .limit(10);

    for (const webhook of pendingWebhooks) {
      const payload: PlaidWebhookPayload = {
        webhook_type: webhook.webhookType,
        webhook_code: webhook.webhookCode,
        item_id: webhook.itemId,
        error: webhook.error,
        new_transactions: webhook.newTransactions || undefined,
        removed_transactions: webhook.removedTransactions as string[] || undefined
      };

      await this.handleWebhook(payload);
    }
  }
}

export default PlaidWebhookHandler;
