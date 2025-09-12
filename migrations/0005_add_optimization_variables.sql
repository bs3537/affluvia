-- Add optimization_variables column to financial_profiles table
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "optimization_variables" jsonb;