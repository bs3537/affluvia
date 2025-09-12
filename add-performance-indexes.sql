-- Performance optimization indexes for dashboard load time improvement
-- Run this against your Neon database to speed up queries

-- Financial Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_financial_profiles_userid ON financial_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_profiles_userid_updated ON financial_profiles(user_id, updated_at DESC);

-- Plaid sync status index
CREATE INDEX IF NOT EXISTS idx_plaid_sync_status_userid ON plaid_sync_status(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_sync_status_userid_synced ON plaid_sync_status(user_id, last_synced_at DESC);

-- Plaid items indexes
CREATE INDEX IF NOT EXISTS idx_plaid_items_userid ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_userid_status ON plaid_items(user_id, status);

-- Plaid accounts indexes
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_userid ON plaid_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_plaiditemid ON plaid_accounts(plaid_item_id);

-- Estate documents index
CREATE INDEX IF NOT EXISTS idx_estate_documents_userid ON estate_documents(user_id);

-- Widget cache indexes for faster dashboard loads
CREATE INDEX IF NOT EXISTS idx_widget_cache_userid_widget ON widget_cache(user_id, widget_type);
CREATE INDEX IF NOT EXISTS idx_widget_cache_userid_updated ON widget_cache(user_id, updated_at DESC);

-- Achievements indexes
CREATE INDEX IF NOT EXISTS idx_user_progress_userid ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_userid ON user_achievements(user_id);

-- Goals indexes
CREATE INDEX IF NOT EXISTS idx_goals_userid ON goals(user_id);

-- Dashboard insights index
CREATE INDEX IF NOT EXISTS idx_dashboard_insights_userid ON dashboard_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_insights_userid_date ON dashboard_insights(user_id, generated_at DESC);

-- Analyze tables to update statistics
ANALYZE financial_profiles;
ANALYZE plaid_sync_status;
ANALYZE plaid_items;
ANALYZE plaid_accounts;
ANALYZE widget_cache;

-- Show index usage stats (optional - for monitoring)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;