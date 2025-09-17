-- Create estate_scenarios table if it does not exist (aligns with shared/schema.ts)
CREATE TABLE IF NOT EXISTS estate_scenarios (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  estate_plan_id integer,
  scenario_name text NOT NULL,
  scenario_type text NOT NULL,
  description text,
  assumptions jsonb,
  results jsonb,
  net_to_heirs numeric(15, 2),
  total_taxes numeric(15, 2),
  is_baseline boolean DEFAULT false,
  comparison_to_baseline jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Optionally add FKs (ignore if they already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estate_scenarios_user_fk'
  ) THEN
    ALTER TABLE estate_scenarios
      ADD CONSTRAINT estate_scenarios_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estate_scenarios_estate_plan_fk'
  ) THEN
    ALTER TABLE estate_scenarios
      ADD CONSTRAINT estate_scenarios_estate_plan_fk FOREIGN KEY (estate_plan_id) REFERENCES public.estate_plans(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

