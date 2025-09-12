-- Fix funding_percentage constraint to allow values over 999%
ALTER TABLE "life_goals" 
ALTER COLUMN "funding_percentage" TYPE numeric(10, 2);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "life_goals_goal_type_idx" ON "life_goals" ("goal_type");
CREATE INDEX IF NOT EXISTS "life_goals_status_idx" ON "life_goals" ("status");
CREATE INDEX IF NOT EXISTS "life_goals_priority_idx" ON "life_goals" ("priority");