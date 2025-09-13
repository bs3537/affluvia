-- Add funding_sources column to life_goals table
ALTER TABLE life_goals 
ADD COLUMN IF NOT EXISTS funding_sources JSONB DEFAULT '[]'::jsonb;

-- Add funding_percentage column if not exists
ALTER TABLE life_goals 
ADD COLUMN IF NOT EXISTS funding_percentage DECIMAL(5,2) DEFAULT 0;