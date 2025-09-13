-- Fix intake form data persistence issue
-- The ORM expects 'last_updated' column but the database only has 'updated_at'

-- Add the missing last_updated column to financial_profiles table
ALTER TABLE financial_profiles 
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Copy existing updated_at values to last_updated for existing records
UPDATE financial_profiles 
SET last_updated = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) 
WHERE last_updated IS NULL;

-- Create or replace trigger to automatically update last_updated on row changes
CREATE OR REPLACE FUNCTION update_financial_profiles_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    NEW.updated_at = CURRENT_TIMESTAMP; -- Also update updated_at for compatibility
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_financial_profiles_last_updated_trigger ON financial_profiles;

-- Create the trigger
CREATE TRIGGER update_financial_profiles_last_updated_trigger
    BEFORE UPDATE ON financial_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_financial_profiles_last_updated();

-- Verify the column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'financial_profiles'
AND column_name IN ('last_updated', 'updated_at', 'created_at')
ORDER BY column_name;