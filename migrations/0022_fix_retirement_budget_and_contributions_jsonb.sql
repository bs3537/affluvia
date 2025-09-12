-- Fix column types for retirement_expense_budget, retirement_contributions, and spouse_retirement_contributions
-- These should be JSONB to store objects like {essential: number, discretionary: number}

DO $$
BEGIN
  -- Fix retirement_expense_budget column type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_profiles'
      AND column_name = 'retirement_expense_budget'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE financial_profiles
      ALTER COLUMN retirement_expense_budget
      TYPE jsonb
      USING CASE
        WHEN retirement_expense_budget IS NULL THEN NULL
        ELSE jsonb_build_object('essential', COALESCE(retirement_expense_budget::numeric, 0), 'discretionary', 0)
      END;
    RAISE NOTICE 'Fixed retirement_expense_budget column type to JSONB';
  END IF;

  -- Fix retirement_contributions column type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_profiles'
      AND column_name = 'retirement_contributions'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE financial_profiles
      ALTER COLUMN retirement_contributions
      TYPE jsonb
      USING CASE
        WHEN retirement_contributions IS NULL THEN NULL
        ELSE jsonb_build_object('employee', COALESCE(retirement_contributions::numeric, 0), 'employer', 0)
      END;
    RAISE NOTICE 'Fixed retirement_contributions column type to JSONB';
  END IF;

  -- Fix spouse_retirement_contributions column type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_profiles'
      AND column_name = 'spouse_retirement_contributions'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE financial_profiles
      ALTER COLUMN spouse_retirement_contributions
      TYPE jsonb
      USING CASE
        WHEN spouse_retirement_contributions IS NULL THEN NULL
        ELSE jsonb_build_object('employee', COALESCE(spouse_retirement_contributions::numeric, 0), 'employer', 0)
      END;
    RAISE NOTICE 'Fixed spouse_retirement_contributions column type to JSONB';
  END IF;
END $$;

-- Verify the changes
SELECT 
  column_name, 
  data_type,
  CASE 
    WHEN data_type = 'jsonb' THEN '✓ Fixed'
    ELSE '✗ Still needs fixing'
  END as status
FROM information_schema.columns
WHERE table_name = 'financial_profiles'
  AND column_name IN (
    'retirement_expense_budget',
    'retirement_contributions', 
    'spouse_retirement_contributions'
  )
ORDER BY column_name;
