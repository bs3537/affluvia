-- Create debt_scenarios table to store what-if analyses
-- Aligns with shared/schema.ts definition
-- Date: 2025-09-22

CREATE TABLE IF NOT EXISTS debt_scenarios (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  plan_id INTEGER REFERENCES debt_payoff_plans(id) ON DELETE CASCADE,

  -- Scenario details
  scenario_name TEXT NOT NULL,
  scenario_type TEXT NOT NULL,

  -- Parameters and results
  parameters JSONB NOT NULL,
  results JSONB NOT NULL,
  payoff_date DATE,
  total_interest_paid DECIMAL(12,2),
  months_to_payoff INTEGER,

  -- Comparison metrics
  months_saved INTEGER,
  interest_saved DECIMAL(12,2),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_debt_scenarios_user_id ON debt_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_scenarios_created_at ON debt_scenarios(created_at DESC);

