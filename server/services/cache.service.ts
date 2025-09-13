import Redis from 'ioredis';
import crypto from 'crypto';

class CacheService {
  private redis: Redis | null = null;
  private enabled: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              console.log('[Cache] Redis connection failed, running without cache');
              this.enabled = false;
              return null;
            }
            return Math.min(times * 100, 3000);
          }
        });

        this.redis.on('connect', () => {
          this.enabled = true;
          console.log('[Cache] Redis connected successfully');
        });

        this.redis.on('error', (err) => {
          console.error('[Cache] Redis error:', err.message);
          this.enabled = false;
        });
      } else {
        console.log('[Cache] Redis URL not configured, cache disabled');
      }
    } catch (error) {
      console.log('[Cache] Failed to initialize Redis:', error);
      this.enabled = false;
    }
  }

  /**
   * Generate cache key with namespace
   */
  private generateKey(namespace: string, params: any): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
    return `affluvia:${namespace}:${hash}`;
  }

  /**
   * Get cached data
   */
  async get<T>(namespace: string, params: any): Promise<T | null> {
    if (!this.enabled || !this.redis) return null;

    try {
      const key = this.generateKey(namespace, params);
      const cached = await this.redis.get(key);
      
      if (cached) {
        console.log(`[Cache] HIT: ${namespace}`);
        return JSON.parse(cached);
      }
      
      console.log(`[Cache] MISS: ${namespace}`);
      return null;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set<T>(namespace: string, params: any, data: T, ttlSeconds: number = 3600): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const key = this.generateKey(namespace, params);
      await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
      console.log(`[Cache] SET: ${namespace} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      console.error('[Cache] Set error:', error);
    }
  }

  /**
   * Invalidate cache by namespace pattern
   */
  async invalidate(pattern: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const keys = await this.redis.keys(`affluvia:${pattern}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`[Cache] Invalidated ${keys.length} keys matching: ${pattern}`);
      }
    } catch (error) {
      console.error('[Cache] Invalidate error:', error);
    }
  }

  /**
   * Invalidate user-specific cache
   */
  async invalidateUser(userId: number): Promise<void> {
    const patterns = [
      `profile:${userId}`,
      `monte_carlo:${userId}`,
      `projections:${userId}`,
      `retirement:${userId}`,
      `goals:${userId}`,
      `tax:${userId}`,
      // Dashboard snapshots are keyed only by namespace hash; invalidate all to avoid stale data
      `dashboard_snapshot`
    ];

    for (const pattern of patterns) {
      await this.invalidate(pattern);
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const keys = await this.redis.keys('affluvia:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`[Cache] Cleared all ${keys.length} cached items`);
      }
    } catch (error) {
      console.error('[Cache] Clear all error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ enabled: boolean; keyCount?: number; memoryUsage?: string }> {
    if (!this.enabled || !this.redis) {
      return { enabled: false };
    }

    try {
      const keys = await this.redis.keys('affluvia:*');
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      
      return {
        enabled: true,
        keyCount: keys.length,
        memoryUsage: memoryMatch ? memoryMatch[1].trim() : 'unknown'
      };
    } catch (error) {
      console.error('[Cache] Stats error:', error);
      return { enabled: false };
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
