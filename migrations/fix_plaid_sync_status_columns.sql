-- Fix for plaid_sync_status table missing columns
-- This adds the missing columns that should be in plaid_sync_schedule
-- but are being queried from plaid_sync_status due to a runtime issue

ALTER TABLE plaid_sync_status 
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_on_sync BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_on_large_changes BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS large_change_threshold DECIMAL(12, 2) DEFAULT 10000,
ADD COLUMN IF NOT EXISTS sync_frequency TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS next_sync_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_full_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_partial_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS sync_transactions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_investments BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_liabilities BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS transaction_days_to_sync INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS manual_syncs_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_sync_reset_date DATE;