import * as crypto from 'crypto';
import { db } from './db';
import { widgetCache } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

export interface CachedWidgetData {
  data: any;
  calculatedAt: string;
  inputHash: string;
  isExpired?: boolean;
}

export class WidgetCacheManager {
  /**
   * Generate a hash from widget dependencies for cache key
   */
  generateInputHash(widgetType: string, dependencies: any): string {
    const payload = {
      widgetType,
      dependencies,
      version: 1 // Increment when calculation logic changes
    };
    const json = JSON.stringify(payload);
    return crypto.createHash('sha256').update(json).digest('hex').slice(0, 32);
  }

  /**
   * Check if cached data exists and is valid
   */
  async getCachedWidget(userId: number, widgetType: string, currentHash: string): Promise<CachedWidgetData | null> {
    try {
      console.log(`[WIDGET-CACHE] Getting cached data for ${widgetType}, user ${userId}, hash ${currentHash}`);
      
      const cached = await db.select()
        .from(widgetCache)
        .where(
          and(
            eq(widgetCache.userId, userId),
            eq(widgetCache.widgetType, widgetType),
            eq(widgetCache.inputHash, currentHash)
          )
        )
        .limit(1);

      if (cached.length === 0) {
        console.log(`[WIDGET-CACHE] No cache found for ${widgetType}`);
        return null;
      }

      const cacheEntry = cached[0];
      
      // Check if cache has expired
      const isExpired = cacheEntry.expiresAt && new Date() > cacheEntry.expiresAt;
      if (isExpired) {
        console.log(`[WIDGET-CACHE] Cache expired for ${widgetType}`);
        // Clean up expired cache
        await this.invalidateWidget(userId, widgetType);
        return null;
      }

      console.log(`[WIDGET-CACHE] Found valid cache for ${widgetType}, calculated at ${cacheEntry.calculatedAt}`);
      return {
        data: cacheEntry.widgetData,
        calculatedAt: cacheEntry.calculatedAt?.toISOString() || new Date().toISOString(),
        inputHash: cacheEntry.inputHash,
        isExpired: false
      };
    } catch (error) {
      console.error(`[WIDGET-CACHE] Error getting cached widget ${widgetType}:`, error);
      return null;
    }
  }

  /**
   * Save widget calculation results to cache
   */
  async cacheWidget(
    userId: number, 
    widgetType: string, 
    inputHash: string, 
    data: any, 
    expirationHours?: number
  ): Promise<void> {
    try {
      console.log(`[WIDGET-CACHE] Caching widget data for ${widgetType}, user ${userId}`);
      
      const expiresAt = expirationHours 
        ? new Date(Date.now() + expirationHours * 60 * 60 * 1000)
        : null;

      // First, remove any existing cache for this widget type and user
      await db.delete(widgetCache)
        .where(
          and(
            eq(widgetCache.userId, userId),
            eq(widgetCache.widgetType, widgetType)
          )
        );

      // Insert new cache entry
      await db.insert(widgetCache).values({
        userId,
        widgetType,
        inputHash,
        widgetData: data,
        expiresAt,
        calculatedAt: new Date(),
        version: 1
      });

      console.log(`[WIDGET-CACHE] Successfully cached ${widgetType} for user ${userId}`);
    } catch (error) {
      console.error(`[WIDGET-CACHE] Error caching widget ${widgetType}:`, error);
    }
  }

  /**
   * Invalidate specific widget cache
   */
  async invalidateWidget(userId: number, widgetType: string): Promise<void> {
    try {
      console.log(`[WIDGET-CACHE] Invalidating ${widgetType} cache for user ${userId}`);
      
      const result = await db.delete(widgetCache)
        .where(
          and(
            eq(widgetCache.userId, userId),
            eq(widgetCache.widgetType, widgetType)
          )
        );

      console.log(`[WIDGET-CACHE] Invalidated ${widgetType} cache for user ${userId}`);
    } catch (error) {
      console.error(`[WIDGET-CACHE] Error invalidating widget ${widgetType}:`, error);
    }
  }

  /**
   * Invalidate all cached widgets for a user
   */
  async invalidateAllUserCache(userId: number): Promise<void> {
    try {
      console.log(`[WIDGET-CACHE] Invalidating all cached widgets for user ${userId}`);
      
      await db.delete(widgetCache)
        .where(eq(widgetCache.userId, userId));

      console.log(`[WIDGET-CACHE] Invalidated all cached widgets for user ${userId}`);
    } catch (error) {
      console.error(`[WIDGET-CACHE] Error invalidating all user cache:`, error);
    }
  }

  /**
   * Clean up expired cache entries (run periodically)
   */
  async cleanupExpiredCache(): Promise<void> {
    try {
      console.log('[WIDGET-CACHE] Cleaning up expired cache entries');
      
      await db.delete(widgetCache)
        .where(
          and(
            eq(widgetCache.expiresAt, null) === false, // Has expiration date
            // expiresAt < now()
          )
        );

      console.log('[WIDGET-CACHE] Cleaned up expired cache entries');
    } catch (error) {
      console.error('[WIDGET-CACHE] Error cleaning up expired cache:', error);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(userId?: number): Promise<any> {
    try {
      const query = db.select().from(widgetCache);
      if (userId) {
        query.where(eq(widgetCache.userId, userId));
      }
      
      const entries = await query;
      const stats = {
        totalEntries: entries.length,
        byWidgetType: {} as Record<string, number>,
        oldestEntry: null as string | null,
        newestEntry: null as string | null
      };

      entries.forEach(entry => {
        stats.byWidgetType[entry.widgetType] = (stats.byWidgetType[entry.widgetType] || 0) + 1;
        
        const entryDate = entry.calculatedAt?.toISOString();
        if (entryDate) {
          if (!stats.oldestEntry || entryDate < stats.oldestEntry) {
            stats.oldestEntry = entryDate;
          }
          if (!stats.newestEntry || entryDate > stats.newestEntry) {
            stats.newestEntry = entryDate;
          }
        }
      });

      return stats;
    } catch (error) {
      console.error('[WIDGET-CACHE] Error getting cache stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const widgetCacheManager = new WidgetCacheManager();