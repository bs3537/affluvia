import { db } from '../db';
import { users } from '@/shared/schema';
import { eq } from 'drizzle-orm';
import { AuditLogger } from './encryption-service';

export enum NotificationType {
  PLAID_CONNECTION_SUCCESS = 'plaid_connection_success',
  PLAID_CONNECTION_ERROR = 'plaid_connection_error',
  PLAID_SYNC_SUCCESS = 'plaid_sync_success',
  PLAID_SYNC_ERROR = 'plaid_sync_error',
  PLAID_UPDATE_REQUIRED = 'plaid_update_required',
  PLAID_RATE_LIMIT_REACHED = 'plaid_rate_limit_reached',
  PLAID_SECURITY_EVENT = 'plaid_security_event',
  PLAID_WEBHOOK_ERROR = 'plaid_webhook_error'
}

export interface NotificationData {
  institutionName?: string;
  accountCount?: number;
  error?: string;
  syncedAt?: Date;
  itemId?: string;
  remainingSyncs?: number;
  securityEventType?: string;
  webhookType?: string;
}

export interface Notification {
  id?: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  read: boolean;
  createdAt: Date;
}

export class NotificationService {
  private static notifications: Map<number, Notification[]> = new Map();
  private static listeners: Map<number, ((notification: Notification) => void)[]> = new Map();

  static async createNotification(
    userId: number,
    type: NotificationType,
    data?: NotificationData
  ): Promise<Notification> {
    const { title, message } = this.buildNotificationContent(type, data);
    
    const notification: Notification = {
      id: Date.now(),
      userId,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: new Date()
    };

    // Store in memory (in production, would use database)
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    this.notifications.get(userId)!.push(notification);

    // Limit to last 100 notifications per user
    const userNotifications = this.notifications.get(userId)!;
    if (userNotifications.length > 100) {
      this.notifications.set(userId, userNotifications.slice(-100));
    }

    // Notify listeners
    this.notifyListeners(userId, notification);

    // Log to audit
    await AuditLogger.log(
      userId,
      'notification_created',
      'notification',
      notification.id!.toString(),
      { type, data },
      'system'
    );

    return notification;
  }

  private static buildNotificationContent(
    type: NotificationType,
    data?: NotificationData
  ): { title: string; message: string } {
    switch (type) {
      case NotificationType.PLAID_CONNECTION_SUCCESS:
        return {
          title: 'Account Connected Successfully',
          message: `Successfully connected ${data?.accountCount || 0} accounts from ${data?.institutionName || 'your bank'}`
        };

      case NotificationType.PLAID_CONNECTION_ERROR:
        return {
          title: 'Connection Error',
          message: data?.error || 'Failed to connect your account. Please try again.'
        };

      case NotificationType.PLAID_SYNC_SUCCESS:
        return {
          title: 'Account Sync Complete',
          message: `${data?.institutionName || 'Your accounts'} have been updated successfully`
        };

      case NotificationType.PLAID_SYNC_ERROR:
        return {
          title: 'Sync Failed',
          message: `Failed to sync ${data?.institutionName || 'your accounts'}. ${data?.error || 'Please try again later.'}`
        };

      case NotificationType.PLAID_UPDATE_REQUIRED:
        return {
          title: 'Action Required',
          message: `${data?.institutionName || 'Your bank'} requires you to re-authenticate. Please update your connection.`
        };

      case NotificationType.PLAID_RATE_LIMIT_REACHED:
        return {
          title: 'Sync Limit Reached',
          message: `You've reached your daily sync limit. You have ${data?.remainingSyncs || 0} syncs remaining today.`
        };

      case NotificationType.PLAID_SECURITY_EVENT:
        return {
          title: 'Security Alert',
          message: data?.securityEventType || 'A security event has been detected on your account'
        };

      case NotificationType.PLAID_WEBHOOK_ERROR:
        return {
          title: 'Update Error',
          message: `Failed to process automatic update for ${data?.institutionName || 'your account'}. Manual sync may be required.`
        };

      default:
        return {
          title: 'Notification',
          message: 'You have a new notification'
        };
    }
  }

  static async getNotifications(
    userId: number,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    const userNotifications = this.notifications.get(userId) || [];
    
    if (unreadOnly) {
      return userNotifications.filter(n => !n.read);
    }
    
    return userNotifications;
  }

  static async markAsRead(userId: number, notificationId: number): Promise<void> {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return;

    const notification = userNotifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  static async markAllAsRead(userId: number): Promise<void> {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return;

    userNotifications.forEach(n => n.read = true);
  }

  static async clearNotifications(userId: number): Promise<void> {
    this.notifications.delete(userId);
  }

  static subscribe(userId: number, callback: (notification: Notification) => void): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, []);
    }
    
    this.listeners.get(userId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const userListeners = this.listeners.get(userId);
      if (userListeners) {
        const index = userListeners.indexOf(callback);
        if (index > -1) {
          userListeners.splice(index, 1);
        }
      }
    };
  }

  private static notifyListeners(userId: number, notification: Notification): void {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.forEach(callback => {
        try {
          callback(notification);
        } catch (error) {
          console.error('[NotificationService] Error calling listener:', error);
        }
      });
    }
  }

  static async notifyPlaidConnectionSuccess(
    userId: number,
    institutionName: string,
    accountCount: number
  ): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.PLAID_CONNECTION_SUCCESS,
      { institutionName, accountCount }
    );
  }

  static async notifyPlaidConnectionError(
    userId: number,
    error: string,
    institutionName?: string
  ): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.PLAID_CONNECTION_ERROR,
      { error, institutionName }
    );
  }

  static async notifyPlaidSyncSuccess(
    userId: number,
    institutionName: string,
    syncedAt: Date
  ): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.PLAID_SYNC_SUCCESS,
      { institutionName, syncedAt }
    );
  }

  static async notifyPlaidSyncError(
    userId: number,
    institutionName: string,
    error: string
  ): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.PLAID_SYNC_ERROR,
      { institutionName, error }
    );
  }

  static async notifyPlaidUpdateRequired(
    userId: number,
    institutionName: string,
    itemId: string
  ): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.PLAID_UPDATE_REQUIRED,
      { institutionName, itemId }
    );
  }

  static async notifyRateLimitReached(
    userId: number,
    remainingSyncs: number
  ): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.PLAID_RATE_LIMIT_REACHED,
      { remainingSyncs }
    );
  }

  static async notifySecurityEvent(
    userId: number,
    securityEventType: string
  ): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.PLAID_SECURITY_EVENT,
      { securityEventType }
    );
  }

  static async notifyWebhookError(
    userId: number,
    institutionName: string,
    webhookType: string
  ): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.PLAID_WEBHOOK_ERROR,
      { institutionName, webhookType }
    );
  }
}