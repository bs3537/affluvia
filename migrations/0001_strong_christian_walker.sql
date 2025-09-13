ALTER TABLE "financial_profiles" ADD COLUMN "has_will" boolean;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "has_trust" boolean;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "has_power_of_attorney" boolean;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "has_healthcare_proxy" boolean;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "has_beneficiaries" boolean;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "retirement_age" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "retirement_income" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "additional_notes" text;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "last_year_agi" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "deduction_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "tax_filing_status" text;