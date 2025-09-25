/**
 * Widget Cache Manager
 * Optimized caching for dashboard widgets using Redis
 * Takes advantage of Supabase Large plan resources
 */

import { createClient } from 'redis';
import crypto from 'node:crypto';

class WidgetCacheManager {
  private redisClient: any = null;
  private readonly defaultTTL = Number(process.env.REDIS_CACHE_TTL || 3600); // 1 hour default
  private readonly enabled = process.env.ENABLE_REDIS_CACHE === 'true';
  
  constructor() {
    if (this.enabled && process.env.REDIS_URL) {
      this.initRedis();
    }
  }
  
  private async initRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > Number(process.env.REDIS_MAX_RETRIES || 3)) {
              console.error('[WidgetCache] Max Redis reconnection attempts reached');
              return null;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });
      
      this.redisClient.on('error', (err: any) => {
        console.error('[WidgetCache] Redis error:', err);
      });
      
      this.redisClient.on('connect', () => {
        console.log('[WidgetCache] Redis connected successfully');
      });
      
      await this.redisClient.connect();
    } catch (error) {
      console.error('[WidgetCache] Failed to initialize Redis:', error);
      this.redisClient = null;
    }
  }
  
  /**
   * Generate cache key for a widget
   */
  private getCacheKey(userId: number, widgetName: string, suffix?: string): string {
    const key = `widget:${userId}:${widgetName}`;
    return suffix ? `${key}:${suffix}` : key;
  }

  generateInputHash(widgetName: string, dependencies: any): string {
    try {
      const payload = {
        widgetName,
        dependencies,
        version: 1
      };
      const json = JSON.stringify(payload);
      return crypto.createHash('sha256').update(json).digest('hex').slice(0, 32);
    } catch (error) {
      console.error('[WidgetCache] Failed to generate input hash:', error);
      return `${widgetName}:${Date.now().toString(36)}`;
    }
  }
  
  /**
   * Cache widget data
   */
  async cacheWidget(userId: number, widgetName: string, key: string, data: any, ttl?: number): Promise<void> {
    if (!this.enabled || !this.redisClient) return;
    
    try {
      const cacheKey = this.getCacheKey(userId, widgetName, key);
      const ttlSeconds = ttl != null ? Math.max(1, Math.floor(ttl * 3600)) : this.defaultTTL;
      
      await this.redisClient.setEx(
        cacheKey,
        ttlSeconds,
        JSON.stringify({
          data,
          cachedAt: new Date().toISOString(),
          ttl: ttlSeconds
        })
      );
      
      console.log(`[WidgetCache] Cached ${widgetName} for user ${userId}, TTL: ${ttlSeconds}s`);
    } catch (error) {
      console.error('[WidgetCache] Cache write error:', error);
    }
  }
  
  /**
   * Get cached widget data
   */
  async getWidget(userId: number, widgetName: string, suffix?: string): Promise<any | null> {
    if (!this.enabled || !this.redisClient) return null;
    
    try {
      const cacheKey = this.getCacheKey(userId, widgetName, suffix);
      const cached = await this.redisClient.get(cacheKey);
      
      if (cached) {
        const parsed = JSON.parse(cached);
        console.log(`[WidgetCache] Cache hit for ${widgetName}, user ${userId}`);
        return parsed;
      }
    } catch (error) {
      console.error('[WidgetCache] Cache read error:', error);
    }
    
    return null;
  }

  async getCachedWidget(userId: number, widgetName: string, inputHash: string): Promise<{ data: any; calculatedAt: string; inputHash: string; isExpired?: boolean } | null> {
    const cached = await this.getWidget(userId, widgetName, inputHash);
    if (!cached) return null;
    return {
      data: cached.data,
      calculatedAt: cached.cachedAt || new Date().toISOString(),
      inputHash,
      isExpired: false,
    };
  }
  
  /**
   * Invalidate widget cache
   */
  async invalidateWidget(userId: number, widgetName: string): Promise<void> {
    if (!this.enabled || !this.redisClient) return;
    
    try {
      const pattern = this.getCacheKey(userId, widgetName, '*');
      const keys = await this.redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await this.redisClient.del(keys);
        console.log(`[WidgetCache] Invalidated ${keys.length} cache entries for ${widgetName}`);
      }
    } catch (error) {
      console.error('[WidgetCache] Cache invalidation error:', error);
    }
  }
  
  /**
   * Invalidate all user's widget caches
   */
  async invalidateUserCache(userId: number): Promise<void> {
    if (!this.enabled || !this.redisClient) return;
    
    try {
      const pattern = `widget:${userId}:*`;
      const keys = await this.redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await this.redisClient.del(keys);
        console.log(`[WidgetCache] Invalidated all ${keys.length} cache entries for user ${userId}`);
      }
    } catch (error) {
      console.error('[WidgetCache] User cache invalidation error:', error);
    }
  }
  
  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.redisClient !== null;
  }
  
  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      console.log('[WidgetCache] Redis connection closed');
    }
  }
}

// Export singleton instance
export const widgetCacheManager = new WidgetCacheManager();
