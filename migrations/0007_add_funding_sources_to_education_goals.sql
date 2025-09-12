-- Add funding_sources column to education_goals table
ALTER TABLE education_goals 
ADD COLUMN funding_sources JSONB;

-- This will store the detailed funding sources array from the form
-- Example structure:
-- [
--   { "type": "529", "amount": 5000 },
--   { "type": "savings", "amount": 12000 },
--   { "type": "scholarships", "amount": 10000 }
-- ]