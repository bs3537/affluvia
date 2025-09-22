-- Add remaining debts columns expected by Drizzle schema
ALTER TABLE IF EXISTS debts 
  ADD COLUMN IF NOT EXISTS paid_off_date DATE;

-- Add remaining Plaid liabilities columns expected by schema
ALTER TABLE IF EXISTS plaid_liabilities 
  ADD COLUMN IF NOT EXISTS principal_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS interest_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS last_payment_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS last_payment_date DATE,
  ADD COLUMN IF NOT EXISTS ytd_interest_paid NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS ytd_principal_paid NUMERIC(12,2);
