-- Add total_monthly_expenses column for manual override in dashboard calculations
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS total_monthly_expenses DECIMAL(12, 2);

-- Optional: backfill from monthly_expenses.total if present
UPDATE financial_profiles
SET total_monthly_expenses = COALESCE(
  total_monthly_expenses,
  NULLIF((monthly_expenses->>'total'), '')::DECIMAL
)
WHERE monthly_expenses IS NOT NULL;

-- Index to help dashboard queries if needed
CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_total_expenses 
ON financial_profiles(user_id, total_monthly_expenses);

