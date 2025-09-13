-- Add missing spouse retirement fields to financial_profiles table
ALTER TABLE financial_profiles
ADD COLUMN IF NOT EXISTS spouse_social_security_benefit DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS spouse_retirement_contributions JSONB;

-- Set default values for existing records
UPDATE financial_profiles 
SET spouse_social_security_benefit = 0
WHERE spouse_social_security_benefit IS NULL;

UPDATE financial_profiles 
SET spouse_retirement_contributions = '{"employee": 0, "employer": 0}'::jsonb
WHERE spouse_retirement_contributions IS NULL;