CREATE TABLE "debt_ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"insight_type" text NOT NULL,
	"insight_title" text NOT NULL,
	"insight_content" text NOT NULL,
	"related_debt_id" integer,
	"related_plan_id" integer,
	"priority" integer DEFAULT 0,
	"is_actionable" boolean DEFAULT false,
	"action_taken" boolean DEFAULT false,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debt_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"milestone_type" text NOT NULL,
	"milestone_value" text,
	"debt_id" integer,
	"achieved_at" timestamp DEFAULT now(),
	"xp_earned" integer DEFAULT 0,
	"badge_earned" text,
	"celebrated" boolean DEFAULT false,
	"celebration_message" text
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"debt_id" integer NOT NULL,
	"payment_date" date NOT NULL,
	"payment_amount" numeric(12, 2) NOT NULL,
	"principal_paid" numeric(12, 2) NOT NULL,
	"interest_paid" numeric(12, 2) NOT NULL,
	"payment_type" text DEFAULT 'regular',
	"balance_after_payment" numeric(12, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debt_payoff_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_name" text NOT NULL,
	"strategy" text NOT NULL,
	"is_active" boolean DEFAULT false,
	"extra_monthly_payment" numeric(12, 2) DEFAULT '0',
	"start_date" date NOT NULL,
	"payoff_date" date NOT NULL,
	"total_interest_paid" numeric(12, 2) NOT NULL,
	"total_amount_paid" numeric(12, 2) NOT NULL,
	"months_to_payoff" integer NOT NULL,
	"interest_saved" numeric(12, 2),
	"debt_order" jsonb,
	"payoff_schedule" jsonb,
	"comparison_metrics" jsonb,
	"strategy_config" jsonb,
	"auto_pay_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debt_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_id" integer,
	"scenario_name" text NOT NULL,
	"scenario_type" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"payoff_date" date,
	"total_interest_paid" numeric(12, 2),
	"months_to_payoff" integer,
	"months_saved" integer,
	"interest_saved" numeric(12, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"debt_name" text NOT NULL,
	"debt_type" text NOT NULL,
	"owner" text DEFAULT 'user',
	"lender" text,
	"account_number" text,
	"original_balance" numeric(12, 2) NOT NULL,
	"current_balance" numeric(12, 2) NOT NULL,
	"annual_interest_rate" numeric(5, 2) NOT NULL,
	"minimum_payment" numeric(12, 2) NOT NULL,
	"loan_term_months" integer,
	"payment_due_date" integer,
	"origination_date" date,
	"maturity_date" date,
	"status" text DEFAULT 'active',
	"is_included_in_payoff" boolean DEFAULT true,
	"paid_off_date" date,
	"notes" text,
	"is_secured" boolean DEFAULT false,
	"collateral" text,
	"credit_limit" numeric(12, 2),
	"utilization" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "auto_insurance" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "homeowner_insurance" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "umbrella_insurance" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "business_liability_insurance" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "traditional_ira_contribution" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "roth_ira_contribution" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_traditional_ira_contribution" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_roth_ira_contribution" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "investment_strategy" text;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "retirement_planning_ui_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "optimal_social_security_age" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "optimal_spouse_social_security_age" integer;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "social_security_optimization" jsonb;--> statement-breakpoint
ALTER TABLE "debt_ai_insights" ADD CONSTRAINT "debt_ai_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_ai_insights" ADD CONSTRAINT "debt_ai_insights_related_debt_id_debts_id_fk" FOREIGN KEY ("related_debt_id") REFERENCES "public"."debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_ai_insights" ADD CONSTRAINT "debt_ai_insights_related_plan_id_debt_payoff_plans_id_fk" FOREIGN KEY ("related_plan_id") REFERENCES "public"."debt_payoff_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_milestones" ADD CONSTRAINT "debt_milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_milestones" ADD CONSTRAINT "debt_milestones_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payoff_plans" ADD CONSTRAINT "debt_payoff_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_scenarios" ADD CONSTRAINT "debt_scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_scenarios" ADD CONSTRAINT "debt_scenarios_plan_id_debt_payoff_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."debt_payoff_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;