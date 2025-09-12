-- Add health status fields to financial_profiles table
ALTER TABLE financial_profiles
ADD COLUMN IF NOT EXISTS user_health_status TEXT DEFAULT 'good',
ADD COLUMN IF NOT EXISTS spouse_health_status TEXT DEFAULT 'good';

-- Add check constraints to ensure valid values
ALTER TABLE financial_profiles
ADD CONSTRAINT check_user_health_status 
CHECK (user_health_status IN ('excellent', 'good', 'fair', 'poor')),
ADD CONSTRAINT check_spouse_health_status 
CHECK (spouse_health_status IN ('excellent', 'good', 'fair', 'poor'));