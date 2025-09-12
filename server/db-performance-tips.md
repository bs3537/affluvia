# Database Performance Optimization Guide

## Connection Pool Optimizations Applied ✅

1. **Reduced pool size** from 20 to 10 connections (Supabase free tier limit)
2. **Aggressive timeouts** to prevent hanging connections:
   - Idle timeout: 10s (from 30s)
   - Connection timeout: 5s (from 10s)
   - Query timeout: 30s (new)
3. **Keep-alive settings** for connection stability
4. **Graceful shutdown** handlers for SIGTERM/SIGINT

## Query Performance Best Practices

### 1. Use Indexes
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_financial_profiles_user_id ON financial_profiles(user_id);
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
```

### 2. Optimize Large JSON Queries
```typescript
// Bad - fetching entire profile
const profile = await db.query.financialProfiles.findFirst({
  where: eq(financialProfiles.userId, userId)
});

// Good - select only needed fields
const profile = await db.query.financialProfiles.findFirst({
  where: eq(financialProfiles.userId, userId),
  columns: {
    calculations: true,
    retirementPlanningData: true
  }
});
```

### 3. Batch Operations
```typescript
// Bad - multiple individual queries
for (const item of items) {
  await db.insert(table).values(item);
}

// Good - single batch insert
await db.insert(table).values(items);
```

### 4. Use Connection Pooling Properly
```typescript
// Bad - creating new connections
const client = new Client(connectionString);
await client.connect();

// Good - use the pool
import { pool } from './db';
const result = await pool.query('SELECT ...');
```

### 5. Cache Frequently Accessed Data
```typescript
// Use Redis for caching
import { cacheService } from './services/cache.service';

const cached = await cacheService.get(key);
if (cached) return cached;

const data = await expensiveQuery();
await cacheService.set(key, data, 3600); // 1 hour TTL
```

## Environment Variables to Add

Add these to your `.env` file:

```env
# Database optimization
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=10000
DB_CONN_TIMEOUT=5000
DB_QUERY_TIMEOUT=30000

# Enable query logging in development
DB_LOG_QUERIES=true

# Cache configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600
```

## Monitoring Database Health

Add this endpoint to monitor database health:

```typescript
app.get('/api/health/database', async (req, res) => {
  const { checkDatabaseHealth, getPoolStats } = await import('./db');
  
  const isHealthy = await checkDatabaseHealth();
  const stats = getPoolStats();
  
  res.json({
    healthy: isHealthy,
    pool: stats,
    timestamp: new Date().toISOString()
  });
});
```

## Common Issues and Solutions

### Issue: "Unable to check out process from the pool"
**Cause**: Too many connections or connections not being released
**Solution**: 
- Reduce pool max size
- Ensure all queries complete or timeout
- Add connection timeout settings

### Issue: Slow queries
**Cause**: Large JSON fields, missing indexes, N+1 queries
**Solution**:
- Add indexes on frequently queried columns
- Use selective column queries
- Batch operations where possible
- Implement caching layer

### Issue: Connection drops
**Cause**: Network issues, idle connections
**Solution**:
- Enable keep-alive
- Reduce idle timeout
- Implement retry logic

## Recommended Actions

1. **Immediate**: Apply the db.ts changes (already done ✅)
2. **Short-term**: 
   - Add database indexes
   - Implement Redis caching for heavy queries
   - Add health monitoring endpoint
3. **Long-term**:
   - Consider database read replicas for heavy read loads
   - Implement query result caching
   - Add APM (Application Performance Monitoring)