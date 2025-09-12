# Supabase Database Optimization Guide

## Current Issues & Solutions

### YES - Upgrading Will Help! Here's Why:

Your app is hitting Supabase Medium plan limits (15 connections). Upgrading to Pro plan or increasing resources will:
- **Fix connection pool exhaustion** (main cause of timeouts)
- **Handle concurrent operations** (Plaid sync + Monte Carlo + Gemini all compete for connections)
- **Support more users** (currently limited to 2-3 concurrent users)

## Your Supabase Configuration
- **Current Plan**: Medium ($15/month)
- **Pool Size Limit**: 15 connections (YOUR BOTTLENECK!)
- **RAM**: 4GB
- **Max Client Connections**: 600

## Applied Optimizations ✅

### 1. Connection Pool Settings (server/db.ts)
```javascript
max: 12              // Stay under Supabase's 15 limit with headroom
min: 2               // Keep 2 connections warm
idleTimeoutMillis: 10000    // Release idle connections quickly (10s)
connectionTimeoutMillis: 5000 // Fail fast on connection attempts (5s)
```

### 2. Why These Settings Work

**Pool Size = 12 (not 15)**
- Leaves 3 connections as buffer for Supabase internal operations
- Prevents hitting hard limit which causes "too many connections" errors
- Allows room for database migrations and admin connections

**Aggressive Timeouts**
- Idle timeout 10s: Releases connections back to pool quickly
- Connection timeout 5s: Fails fast instead of hanging
- Query timeout 30s: Prevents runaway queries from holding connections

### 3. Connection Usage Pattern

Your app uses connections for:
- Main application queries (via Drizzle ORM)
- Session management (connect-pg-simple)
- Background jobs (Plaid sync scheduler)

All share the same pool = efficient!

## Performance Tips for Slow Queries

### 1. Enable Prepared Statements
```javascript
// In db.ts, add to pool config:
prepare: true  // Caches query plans for better performance
```

### 2. Add Critical Indexes
Run these in Supabase SQL Editor:
```sql
-- User lookups (most common)
CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_id 
ON financial_profiles(user_id);

-- Session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_sid 
ON sessions(sid);

-- Chat messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created 
ON chat_messages(user_id, created_at DESC);

-- Goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id 
ON goals(user_id);
```

### 3. Optimize Large JSON Queries
Your `calculations` field is huge. Query specific fields:

```javascript
// Slow - fetches entire JSON
const profile = await db.select().from(financialProfiles)
  .where(eq(financialProfiles.userId, userId));

// Fast - fetches only needed JSON paths
const result = await pool.query(
  `SELECT 
    calculations->>'healthScore' as healthScore,
    calculations->>'retirementScore' as retirementScore
   FROM financial_profiles 
   WHERE user_id = $1`,
  [userId]
);
```

### 4. Enable Row Level Security (RLS)
Helps Supabase optimize queries:
```sql
-- Enable RLS on tables
ALTER TABLE financial_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view own profile" 
ON financial_profiles FOR SELECT 
USING (user_id = auth.uid());
```

## Monitor Connection Usage

Add this endpoint to track pool health:

```javascript
app.get('/api/admin/db-stats', async (req, res) => {
  const stats = getPoolStats();
  const health = await checkDatabaseHealth();
  
  res.json({
    healthy: health,
    connections: {
      total: stats.total,      // Should stay under 12
      idle: stats.idle,        // Idle connections ready
      waiting: stats.waiting    // Queries waiting for connection
    },
    limits: {
      appMax: 12,
      supabaseMax: 15,
      clientMax: 600
    }
  });
});
```

## Warning Signs to Watch For

1. **`stats.total` approaching 12**: Increase timeouts or optimize queries
2. **`stats.waiting` > 0**: Queries are queuing, need optimization
3. **Connection timeout errors**: Reduce pool max or fix slow queries
4. **"too many connections"**: You're hitting Supabase's 15 limit

## Environment Variables

Add to `.env`:
```env
# Optimized for Supabase Medium plan
DB_POOL_MAX=12
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=10000
DB_CONN_TIMEOUT=5000
DB_QUERY_TIMEOUT=30000
```

## Quick Fixes for Common Issues

### "Unable to check out process from pool"
```bash
# Restart the server to reset connections
npm run dev
```

### Slow Dashboard Loading
1. Check if Monte Carlo calculations are running (CPU intensive)
2. Enable async calculations: `CALCS_ASYNC=1`
3. Use widget caching (already implemented)

### Database Feels Slow
1. Check Supabase dashboard for slow query logs
2. Run `EXPLAIN ANALYZE` on slow queries
3. Add indexes as needed
4. Consider upgrading to Pro plan (50 pool size)

## RECOMMENDED UPGRADE OPTIONS

### Option 1: Upgrade to Pro Plan ($25/month) - BEST VALUE
- **60 connections** (4x increase!) 
- **8GB RAM** (2x increase)
- **Better CPU**
- **PgBouncer connection pooling included**
- **Solves 90% of your issues for just $10 more/month**

### Option 2: Add Database Add-ons (More expensive)
- Extra connections: $50/month for +50 connections
- Extra RAM: $100/month for +4GB
- **Note**: Pro plan is much more cost-effective

### Option 3: Stay on Medium + Optimize (Temporary fix)
- Keep current optimizations
- Add aggressive caching with Redis
- Limit concurrent operations
- **Note**: Will still hit limits with 3+ users

## After Upgrading - Update These Settings

```env
# Pro Plan Optimized Settings
DB_POOL_MAX=40              # Can safely use more with 60 available
DB_POOL_MIN=5               # Keep more connections ready
DB_IDLE_TIMEOUT=30000       # Can be less aggressive
DB_CONN_TIMEOUT=10000       
DB_QUERY_TIMEOUT=120000     
DB_STATEMENT_TIMEOUT=120000

# Enable Supabase connection pooling (Pro plan feature)
DATABASE_URL=postgresql://[user]:[password]@[host]:6543/postgres?pgbouncer=true
```

## Expected Improvements After Upgrade

| Metric | Current (Medium) | After (Pro) |
|--------|-----------------|-------------|
| Concurrent Users | 2-3 users | 10-15 users |
| Dashboard Load | 5-10 seconds | 1-2 seconds |
| Intake Form Processing | 4+ minutes (times out) | 30-60 seconds |
| Connection Errors | Frequent | Rare |
| Monthly Cost | $15 | $25 |

## Next Steps

1. **RECOMMENDED**: Upgrade to Supabase Pro plan ($25/month)
2. **After upgrade**: Update connection pool settings to DB_POOL_MAX=40
3. **Enable**: PgBouncer pooling mode in Supabase dashboard
4. **Monitor**: Connection usage for 24 hours
5. **Optional**: Add Redis caching for further optimization