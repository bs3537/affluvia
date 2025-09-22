-- Relax legacy NOT NULL constraints on debts to match shared/schema.ts usage
-- Date: 2025-09-22

DO $$
BEGIN
  -- Only drop NOT NULL if the column exists and is currently NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'name' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE debts ALTER COLUMN name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'type' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE debts ALTER COLUMN type DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'balance' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE debts ALTER COLUMN balance DROP NOT NULL;
  END IF;
END$$;

