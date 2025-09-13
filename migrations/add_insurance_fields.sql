-- Add missing insurance fields to financial_profiles table
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "auto_insurance" jsonb;
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "homeowner_insurance" jsonb;
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "umbrella_insurance" jsonb;
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "business_liability_insurance" jsonb;

-- Also ensure state field exists for proper tax calculations
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "state" text;