-- Create dedicated storage for Roth conversion analysis results
CREATE TABLE IF NOT EXISTS "roth_conversion_analyses" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "analysis" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "roth_conversion_analyses_updated_idx"
  ON "roth_conversion_analyses" ("updated_at");
