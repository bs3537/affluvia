-- Manual sync of education_goals table to match Drizzle schema
-- Drops legacy columns that are no longer used by the application.

ALTER TABLE IF EXISTS education_goals
  DROP COLUMN IF EXISTS child_name,
  DROP COLUMN IF EXISTS child_age,
  DROP COLUMN IF EXISTS college_start_year,
  DROP COLUMN IF EXISTS college_type,
  DROP COLUMN IF EXISTS estimated_annual_cost,
  DROP COLUMN IF EXISTS years_of_education,
  DROP COLUMN IF EXISTS state_529_plan;

