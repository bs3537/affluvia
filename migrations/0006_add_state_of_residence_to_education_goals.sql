-- Add state_of_residence column to education_goals table
ALTER TABLE "education_goals" 
ADD COLUMN IF NOT EXISTS "state_of_residence" text;

-- Add comment for clarity
COMMENT ON COLUMN "education_goals"."state_of_residence" IS 'User state of residence for 529 plan tax benefits';