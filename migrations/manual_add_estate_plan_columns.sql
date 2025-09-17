-- Manual patch to ensure estate_plans has required columns for new estate planning UI
ALTER TABLE IF EXISTS estate_plans
  ADD COLUMN IF NOT EXISTS total_estate_value numeric(15, 2),
  ADD COLUMN IF NOT EXISTS liquid_assets numeric(15, 2),
  ADD COLUMN IF NOT EXISTS illiquid_assets numeric(15, 2),
  ADD COLUMN IF NOT EXISTS federal_exemption_used numeric(15, 2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS state_exemption_used numeric(15, 2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS estimated_federal_estate_tax numeric(15, 2),
  ADD COLUMN IF NOT EXISTS estimated_state_estate_tax numeric(15, 2),
  ADD COLUMN IF NOT EXISTS trust_strategies jsonb,
  ADD COLUMN IF NOT EXISTS distribution_plan jsonb,
  ADD COLUMN IF NOT EXISTS charitable_gifts jsonb,
  ADD COLUMN IF NOT EXISTS business_succession_plan jsonb,
  ADD COLUMN IF NOT EXISTS analysis_results jsonb,
  ADD COLUMN IF NOT EXISTS last_review_date timestamp,
  ADD COLUMN IF NOT EXISTS next_review_date timestamp,
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Ensure estate_scenarios has expected numeric ordering (optional safety)
ALTER TABLE IF EXISTS estate_scenarios
  ADD COLUMN IF NOT EXISTS net_to_heirs numeric(15, 2),
  ADD COLUMN IF NOT EXISTS total_taxes numeric(15, 2),
  ADD COLUMN IF NOT EXISTS is_baseline boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS comparison_to_baseline jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Ensure estate_documents table timestamps exist (optional safety)
-- Optional: timestamps on estate_documents (skip if table not present)
-- ALTER TABLE estate_documents
--   ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
--   ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
