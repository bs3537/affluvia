-- Add Investment Profile and Asset Allocation persistence fields
-- These fields provide quick access to dashboard widget data without recalculation

-- User Risk Profile and Target Allocation
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS user_risk_profile TEXT;

ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS target_allocation JSONB;

-- Spouse Risk Profile and Target Allocation  
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS spouse_risk_profile TEXT;

ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS spouse_target_allocation JSONB;

-- Create indexes for faster retrieval on dashboard
CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_risk_profile 
ON financial_profiles(user_id, user_risk_profile);

CREATE INDEX IF NOT EXISTS idx_financial_profiles_spouse_risk_profile 
ON financial_profiles(user_id, spouse_risk_profile);

-- Update existing records with calculated values from calculations JSON
UPDATE financial_profiles 
SET user_risk_profile = calculations->>'riskProfile'
WHERE calculations IS NOT NULL 
AND calculations->>'riskProfile' IS NOT NULL
AND user_risk_profile IS NULL;

UPDATE financial_profiles 
SET target_allocation = calculations->'targetAllocation'
WHERE calculations IS NOT NULL 
AND calculations->'targetAllocation' IS NOT NULL
AND target_allocation IS NULL;

UPDATE financial_profiles 
SET spouse_risk_profile = calculations->>'spouseRiskProfile'
WHERE calculations IS NOT NULL 
AND calculations->>'spouseRiskProfile' IS NOT NULL
AND spouse_risk_profile IS NULL;

UPDATE financial_profiles 
SET spouse_target_allocation = calculations->'spouseTargetAllocation'
WHERE calculations IS NOT NULL 
AND calculations->'spouseTargetAllocation' IS NOT NULL
AND spouse_target_allocation IS NULL;