-- Add net_worth and monthly_cash_flow fields to financial_profiles table
-- These fields provide quick access to dashboard widget data without recalculation

ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS net_worth DECIMAL(15, 2);

ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS monthly_cash_flow DECIMAL(12, 2);

-- Create indexes for faster retrieval on dashboard
CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_networth 
ON financial_profiles(user_id, net_worth);

CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_cashflow 
ON financial_profiles(user_id, monthly_cash_flow);

-- Update existing records with calculated values from calculations JSON
UPDATE financial_profiles 
SET net_worth = CAST((calculations->>'netWorth')::text AS DECIMAL(15, 2))
WHERE calculations IS NOT NULL 
AND calculations->>'netWorth' IS NOT NULL
AND net_worth IS NULL;

UPDATE financial_profiles 
SET monthly_cash_flow = CAST((calculations->>'monthlyCashFlow')::text AS DECIMAL(12, 2))
WHERE calculations IS NOT NULL 
AND calculations->>'monthlyCashFlow' IS NOT NULL
AND monthly_cash_flow IS NULL;