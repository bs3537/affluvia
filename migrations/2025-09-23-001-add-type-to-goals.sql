-- Add missing 'type' column to goals table to match shared/schema.ts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'type'
  ) THEN
    ALTER TABLE IF EXISTS public.goals ADD COLUMN type text;
  END IF;
END $$;

-- Backfill and enforce defaults
UPDATE public.goals SET type = COALESCE(type, 'custom');
ALTER TABLE public.goals ALTER COLUMN type SET DEFAULT 'custom';
-- Only set NOT NULL if no remaining nulls
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.goals WHERE type IS NULL) THEN
    RAISE NOTICE 'goals.type still has NULLs; NOT NULL constraint not applied.';
  ELSE
    ALTER TABLE public.goals ALTER COLUMN type SET NOT NULL;
  END IF;
END $$;

