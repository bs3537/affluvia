-- Create debt_ai_insights table if missing (for AI debt recommendations persistence)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'debt_ai_insights'
  ) THEN
    CREATE TABLE debt_ai_insights (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      insight_type TEXT NOT NULL, -- 'strategy_recommendation', 'progress_update', 'optimization_tip', 'warning'
      insight_title TEXT NOT NULL,
      insight_content TEXT NOT NULL,
      related_debt_id INTEGER REFERENCES debts(id) ON DELETE CASCADE,
      related_plan_id INTEGER REFERENCES debt_payoff_plans(id) ON DELETE CASCADE,
      priority INTEGER DEFAULT 0,
      is_actionable BOOLEAN DEFAULT false,
      action_taken BOOLEAN DEFAULT false,
      valid_until TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
  END IF;
END$$;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_debt_ai_insights_user_id ON debt_ai_insights(user_id);
