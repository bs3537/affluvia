-- Add retirement planning UI preferences field to financial_profiles table
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS retirement_planning_ui_preferences JSONB;

-- Set default empty object for existing rows
UPDATE financial_profiles 
SET retirement_planning_ui_preferences = '{}'::jsonb 
WHERE retirement_planning_ui_preferences IS NULL;