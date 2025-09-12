-- Add monthly cash flow after contributions for consistency across views
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS monthly_cash_flow_after_contributions DECIMAL(12, 2);

-- Optional backfill: if we can infer contributions from calculations JSON
-- Skipping complex backfill; new value will be written on next calculation/save.

CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_cashflow_after 
ON financial_profiles(user_id, monthly_cash_flow_after_contributions);

