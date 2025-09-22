-- Affluvia DB hotfix: align debts/plaid_liabilities with app schema
-- Date: 2025-09-22

-- Debts: add columns referenced by server and shared/schema.ts
ALTER TABLE IF EXISTS debts 
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_included_in_payoff BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS annual_interest_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS minimum_payment NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_due_date INTEGER,
  ADD COLUMN IF NOT EXISTS debt_name TEXT,
  ADD COLUMN IF NOT EXISTS debt_type TEXT,
  ADD COLUMN IF NOT EXISTS lender TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS original_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS loan_term_months INTEGER,
  ADD COLUMN IF NOT EXISTS is_secured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS collateral TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS utilization NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS paid_off_date DATE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Plaid Liabilities: add metadata and other commonly referenced fields
ALTER TABLE IF EXISTS plaid_liabilities 
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS liability_type TEXT,
  ADD COLUMN IF NOT EXISTS original_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS minimum_payment NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS next_payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS apr NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS loan_term_months INTEGER,
  ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Helpful indexes (no-op if they already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_debts_user_id'
  ) THEN
    CREATE INDEX idx_debts_user_id ON debts(user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_plaid_liabilities_plaid_account_id'
  ) THEN
    CREATE INDEX idx_plaid_liabilities_plaid_account_id ON plaid_liabilities(plaid_account_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_plaid_liabilities_user_id'
  ) THEN
    CREATE INDEX idx_plaid_liabilities_user_id ON plaid_liabilities(user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_plaid_liabilities_type'
  ) THEN
    CREATE INDEX idx_plaid_liabilities_type ON plaid_liabilities(liability_type);
  END IF;
END$$;

-- Quick visibility into the final column sets after patch
-- (Run manually if needed)
-- SELECT table_name, column_name
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name IN ('debts','plaid_liabilities')
--  ORDER BY table_name, ordinal_position;

