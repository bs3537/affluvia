-- Align debts table with application schema expectations
ALTER TABLE IF EXISTS debts 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_included_in_payoff BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS annual_interest_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS minimum_payment NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_due_date INTEGER,
  ADD COLUMN IF NOT EXISTS debt_name TEXT,
  ADD COLUMN IF NOT EXISTS debt_type TEXT,
  ADD COLUMN IF NOT EXISTS lender TEXT,
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS original_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS is_secured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS collateral TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS utilization NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add missing Plaid liability fields
ALTER TABLE IF EXISTS plaid_liabilities
  ADD COLUMN IF NOT EXISTS next_payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS liability_type TEXT,
  ADD COLUMN IF NOT EXISTS original_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS minimum_payment NUMERIC(12,2);

