-- Add any additional missing columns referenced by code
ALTER TABLE IF EXISTS debts 
  ADD COLUMN IF NOT EXISTS origination_date DATE,
  ADD COLUMN IF NOT EXISTS maturity_date DATE;

ALTER TABLE IF EXISTS plaid_liabilities 
  ADD COLUMN IF NOT EXISTS original_balance NUMERIC(12,2);

-- Ensure extra_monthly_payment exists on payoff plans (safety)
ALTER TABLE IF EXISTS debt_payoff_plans 
  ADD COLUMN IF NOT EXISTS extra_monthly_payment NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount_paid NUMERIC(15,2);

