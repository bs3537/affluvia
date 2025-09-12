-- Add optimal Social Security age fields to financial_profiles table
ALTER TABLE financial_profiles 
ADD COLUMN optimal_social_security_age INTEGER,
ADD COLUMN optimal_spouse_social_security_age INTEGER,
ADD COLUMN social_security_optimization JSONB;

-- Add comment for documentation
COMMENT ON COLUMN financial_profiles.optimal_social_security_age IS 'Pre-calculated optimal Social Security claiming age for primary earner';
COMMENT ON COLUMN financial_profiles.optimal_spouse_social_security_age IS 'Pre-calculated optimal Social Security claiming age for spouse';
COMMENT ON COLUMN financial_profiles.social_security_optimization IS 'Complete Social Security optimization results and metadata';