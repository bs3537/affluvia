-- Migration: Remove part-time work boolean fields as they are no longer needed
-- We are keeping the income fields and removing the checkbox boolean fields

-- Remove the boolean columns that tracked whether someone planned to work part-time
-- The income fields (part_time_income_retirement, spouse_part_time_income_retirement) remain
-- Users can now simply enter 0 if they don't plan to work part-time

ALTER TABLE financial_profiles 
  DROP COLUMN IF EXISTS part_time_work_retirement,
  DROP COLUMN IF EXISTS spouse_part_time_work_retirement;