-- Add new retirement planning fields to financial_profiles table
ALTER TABLE financial_profiles
ADD COLUMN IF NOT EXISTS retirement_state TEXT,
ADD COLUMN IF NOT EXISTS part_time_work_retirement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS part_time_income_retirement DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS spouse_part_time_work_retirement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS spouse_part_time_income_retirement DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS spouse_pension_benefit DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS expected_inflation_rate DECIMAL(5, 2) DEFAULT 3.0;