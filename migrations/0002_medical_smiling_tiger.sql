CREATE TABLE "college_reference" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"type" text NOT NULL,
	"in_state_tuition" numeric(12, 2),
	"out_of_state_tuition" numeric(12, 2),
	"room_and_board" numeric(12, 2),
	"books_and_supplies" numeric(12, 2),
	"other_expenses" numeric(12, 2),
	"website" text,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "education_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"student_name" text NOT NULL,
	"relationship" text,
	"student_birth_year" integer,
	"goal_type" text DEFAULT 'college' NOT NULL,
	"degree_type" text,
	"start_year" integer NOT NULL,
	"end_year" integer NOT NULL,
	"years" integer NOT NULL,
	"cost_option" text NOT NULL,
	"college_id" text,
	"college_name" text,
	"cost_per_year" numeric(12, 2),
	"include_room_board" boolean DEFAULT true,
	"is_in_state" boolean DEFAULT true,
	"inflation_rate" numeric(5, 2) DEFAULT '5.0',
	"cover_percent" numeric(5, 2) DEFAULT '100',
	"scholarship_per_year" numeric(12, 2) DEFAULT '0',
	"loan_per_year" numeric(12, 2) DEFAULT '0',
	"loan_interest_rate" numeric(5, 2) DEFAULT '10.0',
	"loan_repayment_term" integer DEFAULT 10,
	"loan_type" text,
	"current_savings" numeric(12, 2) DEFAULT '0',
	"monthly_contribution" numeric(12, 2) DEFAULT '0',
	"account_type" text,
	"expected_return" numeric(5, 2) DEFAULT '6.0',
	"risk_profile" text DEFAULT 'moderate',
	"state_of_residence" text,
	"funding_sources" jsonb,
	"projection_data" jsonb,
	"monthly_contribution_needed" numeric(12, 2),
	"funding_percentage" numeric(5, 2),
	"probability_of_success" numeric(5, 2),
	"last_calculated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "education_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"education_goal_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"scenario_name" text NOT NULL,
	"scenario_type" text,
	"parameters" jsonb,
	"results" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "estate_beneficiaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"estate_plan_id" integer,
	"beneficiary_type" text NOT NULL,
	"name" text NOT NULL,
	"relationship" text,
	"date_of_birth" timestamp,
	"tax_id" text,
	"contact_info" jsonb,
	"distribution_type" text NOT NULL,
	"distribution_percentage" numeric(5, 2),
	"distribution_amount" numeric(15, 2),
	"specific_assets" jsonb,
	"conditions" text,
	"trustee" text,
	"age_restriction" integer,
	"is_primary" boolean DEFAULT true,
	"contingent_beneficiary_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "estate_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"estate_plan_id" integer,
	"document_type" text NOT NULL,
	"document_name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"execution_date" timestamp,
	"expiration_date" timestamp,
	"last_review_date" timestamp,
	"prepared_by" text,
	"witnesses" jsonb,
	"notarized" boolean DEFAULT false,
	"for_spouse" boolean DEFAULT false,
	"storage_location" text,
	"document_url" text,
	"parsed_insights" jsonb,
	"review_reminder_days" integer DEFAULT 365,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "estate_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"total_estate_value" numeric(15, 2),
	"liquid_assets" numeric(15, 2),
	"illiquid_assets" numeric(15, 2),
	"federal_exemption_used" numeric(15, 2) DEFAULT '0',
	"state_exemption_used" numeric(15, 2) DEFAULT '0',
	"estimated_federal_estate_tax" numeric(15, 2),
	"estimated_state_estate_tax" numeric(15, 2),
	"trust_strategies" jsonb,
	"distribution_plan" jsonb,
	"charitable_gifts" jsonb,
	"business_succession_plan" jsonb,
	"analysis_results" jsonb,
	"last_review_date" timestamp,
	"next_review_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "estate_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"estate_plan_id" integer,
	"scenario_name" text NOT NULL,
	"scenario_type" text NOT NULL,
	"description" text,
	"assumptions" jsonb,
	"results" jsonb,
	"net_to_heirs" numeric(15, 2),
	"total_taxes" numeric(15, 2),
	"is_baseline" boolean DEFAULT false,
	"comparison_to_baseline" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "estate_trusts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"estate_plan_id" integer,
	"trust_type" text NOT NULL,
	"trust_name" text NOT NULL,
	"established_date" timestamp,
	"grantor" text NOT NULL,
	"trustee" text NOT NULL,
	"successor_trustee" text,
	"beneficiaries" jsonb,
	"initial_funding" numeric(15, 2),
	"current_value" numeric(15, 2),
	"assets" jsonb,
	"distribution_terms" text,
	"termination_conditions" text,
	"tax_id_number" text,
	"tax_strategy" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goal_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"goal_id" integer,
	"task_id" integer,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goal_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignee" text,
	"due_date" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"description" text NOT NULL,
	"target_amount_today" numeric(12, 2) NOT NULL,
	"target_date" timestamp NOT NULL,
	"inflation_assumption_pct" numeric(5, 2) DEFAULT '2.5',
	"priority" integer DEFAULT 1 NOT NULL,
	"funding_source_account_ids" jsonb,
	"current_savings" numeric(12, 2) DEFAULT '0',
	"risk_preference" text DEFAULT 'moderate',
	"success_threshold_pct" numeric(5, 2) DEFAULT '70',
	"notes" text,
	"probability_of_success" numeric(5, 2),
	"last_calculated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investment_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category" text NOT NULL,
	"data" jsonb NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_529_plans" (
	"state" text PRIMARY KEY NOT NULL,
	"state_name" text NOT NULL,
	"has_state_tax_deduction" boolean DEFAULT false,
	"max_deduction_single" numeric(12, 2),
	"max_deduction_married" numeric(12, 2),
	"tax_credit_available" boolean DEFAULT false,
	"tax_credit_amount" numeric(12, 2),
	"plan_name" text,
	"plan_website" text,
	"special_features" jsonb,
	"other_benefits" text,
	"restrictions" text,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "desired_retirement_age" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_desired_retirement_age" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "social_security_claim_age" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_social_security_claim_age" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "user_life_expectancy" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_life_expectancy" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "expected_monthly_expenses_retirement" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "life_expectancy" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "retirement_expense_budget" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "social_security_benefit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "pension_benefit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "retirement_contributions" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "expected_real_return" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "withdrawal_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "has_long_term_care_insurance" boolean;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "legacy_goal" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "retirement_planning_data" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "monte_carlo_simulation" jsonb;--> statement-breakpoint
ALTER TABLE "education_goals" ADD CONSTRAINT "education_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_scenarios" ADD CONSTRAINT "education_scenarios_education_goal_id_education_goals_id_fk" FOREIGN KEY ("education_goal_id") REFERENCES "public"."education_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_scenarios" ADD CONSTRAINT "education_scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_beneficiaries" ADD CONSTRAINT "estate_beneficiaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_beneficiaries" ADD CONSTRAINT "estate_beneficiaries_estate_plan_id_estate_plans_id_fk" FOREIGN KEY ("estate_plan_id") REFERENCES "public"."estate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_beneficiaries" ADD CONSTRAINT "estate_beneficiaries_contingent_beneficiary_id_estate_beneficiaries_id_fk" FOREIGN KEY ("contingent_beneficiary_id") REFERENCES "public"."estate_beneficiaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_documents" ADD CONSTRAINT "estate_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_documents" ADD CONSTRAINT "estate_documents_estate_plan_id_estate_plans_id_fk" FOREIGN KEY ("estate_plan_id") REFERENCES "public"."estate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_plans" ADD CONSTRAINT "estate_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_scenarios" ADD CONSTRAINT "estate_scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_scenarios" ADD CONSTRAINT "estate_scenarios_estate_plan_id_estate_plans_id_fk" FOREIGN KEY ("estate_plan_id") REFERENCES "public"."estate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_trusts" ADD CONSTRAINT "estate_trusts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_trusts" ADD CONSTRAINT "estate_trusts_estate_plan_id_estate_plans_id_fk" FOREIGN KEY ("estate_plan_id") REFERENCES "public"."estate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_audit_log" ADD CONSTRAINT "goal_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_audit_log" ADD CONSTRAINT "goal_audit_log_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_audit_log" ADD CONSTRAINT "goal_audit_log_task_id_goal_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."goal_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_tasks" ADD CONSTRAINT "goal_tasks_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_tasks" ADD CONSTRAINT "goal_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_cache" ADD CONSTRAINT "investment_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;