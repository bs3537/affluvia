-- Reporting feature schema: white-label, report layouts, snapshots

-- 1) Advisor white-label profile (one per advisor)
CREATE TABLE IF NOT EXISTS white_label_profiles (
  id serial PRIMARY KEY,
  advisor_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  firm_name text,
  logo_url text,
  address text,
  phone text,
  email text,
  default_disclaimer text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT unique_white_label_per_advisor UNIQUE (advisor_id)
);

-- 2) Persist per-user widget layout and insights section title
CREATE TABLE IF NOT EXISTS report_layouts (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  layout jsonb NOT NULL DEFAULT (
    '[
      "financial_health_score",
      "monthly_cash_flow",
      "net_worth",
      "retirement_confidence_gauge",
      "optimization_impact_on_balance",
      "retirement_stress_test",
      "net_worth_projection_optimized",
      "insurance_adequacy_score",
      "emergency_readiness_score"
    ]'::jsonb
  ),
  insights_section_title text DEFAULT 'Insights',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT unique_layout_per_user UNIQUE (user_id)
);

-- 3) Report snapshots (stable data for printable reports)
CREATE TABLE IF NOT EXISTS report_snapshots (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  advisor_id integer REFERENCES users(id) ON DELETE SET NULL,
  layout jsonb NOT NULL,
  widgets jsonb NOT NULL,
  insights jsonb NOT NULL,
  insights_title text DEFAULT 'Insights',
  disclaimer_text text,
  disclaimer_version text DEFAULT '1.0',
  theme_version text DEFAULT 'report-light-1',
  created_at timestamp DEFAULT now()
);

