-- Performance optimization indexes for dashboard load time improvement
-- Fixed version with correct column names

-- Financial Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_financial_profiles_userid ON financial_profiles(user_id);

-- Plaid sync status index (if table exists)
CREATE INDEX IF NOT EXISTS idx_plaid_sync_status_userid ON plaid_sync_status(user_id);

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

-- Achievements indexes
CREATE INDEX IF NOT EXISTS idx_user_progress_userid ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_userid ON user_achievements(user_id);

-- Goals indexes
CREATE INDEX IF NOT EXISTS idx_goals_userid ON goals(user_id);

-- Dashboard insights index
CREATE INDEX IF NOT EXISTS idx_dashboard_insights_userid ON dashboard_insights(user_id);

-- Plaid sync schedule (for the new sync optimization)
CREATE INDEX IF NOT EXISTS idx_plaid_sync_schedule_userid ON plaid_sync_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_sync_schedule_next_sync ON plaid_sync_schedule(next_sync_date);

-- Sessions table for faster auth
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- Analyze tables to update statistics
ANALYZE financial_profiles;
ANALYZE plaid_items;
ANALYZE plaid_accounts;
ANALYZE widget_cache;
ANALYZE user_progress;
ANALYZE goals;