-- Add net worth projections field to financial_profiles table
ALTER TABLE financial_profiles ADD COLUMN net_worth_projections JSONB;

-- Add index for performance on net worth projections queries  
CREATE INDEX IF NOT EXISTS idx_financial_profiles_net_worth_projections ON financial_profiles USING GIN (net_worth_projections);

-- Add comment explaining the field
COMMENT ON COLUMN financial_profiles.net_worth_projections IS 'Cached net worth projection calculations including real estate growth, mortgage paydown, and retirement asset projections';