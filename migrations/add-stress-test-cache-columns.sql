-- Add columns for caching stress test results
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS last_stress_test_results JSONB,
ADD COLUMN IF NOT EXISTS last_stress_test_date VARCHAR(50);

-- Add index for faster lookup by date
CREATE INDEX IF NOT EXISTS idx_financial_profiles_last_stress_test_date 
ON financial_profiles(last_stress_test_date);

-- Comment on columns
COMMENT ON COLUMN financial_profiles.last_stress_test_results IS 'Cached stress test results to avoid recalculation';
COMMENT ON COLUMN financial_profiles.last_stress_test_date IS 'Timestamp when stress test was last calculated';