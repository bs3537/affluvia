-- Add self-employed fields to financial_profiles table
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS is_self_employed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS self_employment_income DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS has_retirement_plan BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS quarterly_tax_payments JSONB,
ADD COLUMN IF NOT EXISTS self_employed_data JSONB;

-- Add comments for documentation
COMMENT ON COLUMN financial_profiles.is_self_employed IS 'Whether the user is self-employed';
COMMENT ON COLUMN financial_profiles.self_employment_income IS 'Annual self-employment income';
COMMENT ON COLUMN financial_profiles.business_type IS 'Type of business entity (sole proprietor, LLC, S-corp, etc.)';
COMMENT ON COLUMN financial_profiles.has_retirement_plan IS 'Whether the user has a retirement plan (401k, IRA, etc.)';
COMMENT ON COLUMN financial_profiles.quarterly_tax_payments IS 'Array of quarterly estimated tax payments';
COMMENT ON COLUMN financial_profiles.self_employed_data IS 'Comprehensive self-employed data including deductions, strategies, etc.';