-- Fix All Missing Database Columns
-- Date: 2025-08-30
-- Purpose: Add all missing columns that are causing application errors

-- 1. Add spouse_name column to financial_profiles (the app is looking for this)
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS spouse_name TEXT;

-- 2. Add separate spouse first and last name fields
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS spouse_first_name TEXT,
ADD COLUMN IF NOT EXISTS spouse_last_name TEXT;

-- 3. Ensure section_progress table has the section column
-- First check if table exists, if not create it
CREATE TABLE IF NOT EXISTS section_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  visits INTEGER DEFAULT 0,
  time_spent INTEGER DEFAULT 0,
  actions_completed INTEGER DEFAULT 0,
  last_visit TIMESTAMP DEFAULT now(),
  completion_percentage NUMERIC(5,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, section)
);

-- If table exists but column doesn't, add it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'section_progress') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'section_progress' AND column_name = 'section') THEN
      ALTER TABLE section_progress ADD COLUMN section TEXT NOT NULL DEFAULT 'general';
    END IF;
  END IF;
END $$;

-- 4. Add missing columns to plaid_sync_status (from the other migration)
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

-- 5. Migrate existing spouse_name data to new fields if they exist
UPDATE financial_profiles
SET 
  spouse_first_name = CASE 
    WHEN spouse_name IS NOT NULL AND spouse_name != '' 
    THEN SPLIT_PART(spouse_name, ' ', 1)
    ELSE spouse_first_name
  END,
  spouse_last_name = CASE
    WHEN spouse_name IS NOT NULL AND spouse_name != '' AND ARRAY_LENGTH(STRING_TO_ARRAY(spouse_name, ' '), 1) > 1
    THEN SUBSTRING(spouse_name FROM POSITION(' ' IN spouse_name) + 1)
    ELSE spouse_last_name
  END
WHERE spouse_name IS NOT NULL AND spouse_name != '' 
  AND (spouse_first_name IS NULL OR spouse_last_name IS NULL);

-- 6. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_financial_profiles_spouse_names 
ON financial_profiles(spouse_first_name, spouse_last_name);

CREATE INDEX IF NOT EXISTS idx_section_progress_user_section 
ON section_progress(user_id, section);

-- 7. Add any other commonly accessed columns that might be missing
ALTER TABLE financial_profiles
ADD COLUMN IF NOT EXISTS plaid_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_plaid_sync TIMESTAMP;

-- Print completion message
DO $$
BEGIN
  RAISE NOTICE 'All missing columns have been added successfully';
END $$;