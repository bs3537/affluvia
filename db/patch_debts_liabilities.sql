-- Add missing columns to debts table
ALTER TABLE IF EXISTS debts 
  ADD COLUMN IF NOT EXISTS loan_term_months INTEGER;

-- Add missing columns to debt_payoff_plans table
ALTER TABLE IF EXISTS debt_payoff_plans 
  ADD COLUMN IF NOT EXISTS plan_name TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS payoff_date DATE,
  ADD COLUMN IF NOT EXISTS total_interest_paid DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS total_amount_paid DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS months_to_payoff INTEGER,
  ADD COLUMN IF NOT EXISTS interest_saved DECIMAL(15,2);

-- Ensure required indexes exist
CREATE INDEX IF NOT EXISTS idx_debt_payoff_plans_user_id ON debt_payoff_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payoff_plans_active ON debt_payoff_plans(is_active);

-- Add missing liability_type to plaid_liabilities
ALTER TABLE IF EXISTS plaid_liabilities 
  ADD COLUMN IF NOT EXISTS liability_type TEXT,
  ADD COLUMN IF NOT EXISTS loan_term_months INTEGER,
  ADD COLUMN IF NOT EXISTS apr DECIMAL(5,3);

-- Helpful indexes (skip if already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_plaid_liabilities_type'
  ) THEN
    CREATE INDEX idx_plaid_liabilities_type ON plaid_liabilities(liability_type);
  END IF;
END$$;
