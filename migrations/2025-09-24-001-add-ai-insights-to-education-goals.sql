-- Add AI insights persistence columns to education_goals
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'education_goals' AND column_name = 'ai_insights'
  ) THEN
    ALTER TABLE IF EXISTS public.education_goals ADD COLUMN ai_insights jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'education_goals' AND column_name = 'ai_insights_generated_at'
  ) THEN
    ALTER TABLE IF EXISTS public.education_goals ADD COLUMN ai_insights_generated_at timestamp;
  END IF;
END $$;

