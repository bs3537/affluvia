-- Add missing columns to plaid_aggregated_snapshot table
-- These columns are in the schema but missing from the database

ALTER TABLE plaid_aggregated_snapshot 
ADD COLUMN IF NOT EXISTS credit_card_debt DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS student_loans DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS personal_loans DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS mortgage_debt DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS auto_loans DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS other_debt DECIMAL(15, 2);

-- Add missing income columns
ALTER TABLE plaid_aggregated_snapshot
ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS annual_income DECIMAL(15, 2);

-- Add missing metadata columns
ALTER TABLE plaid_aggregated_snapshot
ADD COLUMN IF NOT EXISTS accounts_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_plaid_snapshot_user_date 
ON plaid_aggregated_snapshot(user_id, snapshot_date DESC);