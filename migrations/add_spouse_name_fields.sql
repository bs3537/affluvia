-- Migration: Add separate spouse first and last name fields
-- Date: 2025-08-30
-- Purpose: Improve data structure by splitting spouse name into first and last components

-- Add new columns for spouse first and last names
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS spouse_first_name TEXT,
ADD COLUMN IF NOT EXISTS spouse_last_name TEXT;

-- Migrate existing data from spouseName field to new fields
UPDATE financial_profiles
SET 
  spouse_first_name = CASE 
    WHEN spouse_name IS NOT NULL AND spouse_name != '' 
    THEN SPLIT_PART(spouse_name, ' ', 1)
    ELSE NULL
  END,
  spouse_last_name = CASE
    WHEN spouse_name IS NOT NULL AND spouse_name != '' AND ARRAY_LENGTH(STRING_TO_ARRAY(spouse_name, ' '), 1) > 1
    THEN SUBSTRING(spouse_name FROM POSITION(' ' IN spouse_name) + 1)
    ELSE NULL
  END
WHERE spouse_name IS NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_financial_profiles_spouse_names 
ON financial_profiles(spouse_first_name, spouse_last_name);

-- Note: We keep the original spouse_name column for backward compatibility
-- The application layer will handle the mapping between the fields