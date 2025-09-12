-- Add IRA contribution fields to financial_profiles table
ALTER TABLE financial_profiles
ADD COLUMN IF NOT EXISTS traditional_ira_contribution DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS roth_ira_contribution DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS spouse_traditional_ira_contribution DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS spouse_roth_ira_contribution DECIMAL(12, 2);

-- Add comments for documentation
COMMENT ON COLUMN financial_profiles.traditional_ira_contribution IS 'Annual Traditional IRA contribution amount';
COMMENT ON COLUMN financial_profiles.roth_ira_contribution IS 'Annual Roth IRA contribution amount';
COMMENT ON COLUMN financial_profiles.spouse_traditional_ira_contribution IS 'Spouse annual Traditional IRA contribution amount';
COMMENT ON COLUMN financial_profiles.spouse_roth_ira_contribution IS 'Spouse annual Roth IRA contribution amount';