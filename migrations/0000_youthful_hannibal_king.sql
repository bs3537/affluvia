CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"response" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"first_name" text,
	"last_name" text,
	"date_of_birth" text,
	"marital_status" text,
	"dependents" integer,
	"spouse_name" text,
	"spouse_date_of_birth" text,
	"employment_status" text,
	"annual_income" numeric(12, 2),
	"tax_withholding_status" text,
	"take_home_income" numeric(12, 2),
	"other_income" numeric(12, 2),
	"spouse_employment_status" text,
	"spouse_annual_income" numeric(12, 2),
	"spouse_tax_withholding_status" text,
	"spouse_take_home_income" numeric(12, 2),
	"savings_rate" numeric(12, 2),
	"assets" jsonb,
	"liabilities" jsonb,
	"primary_residence" jsonb,
	"additional_properties" jsonb,
	"monthly_expenses" jsonb,
	"emergency_fund_size" numeric(12, 2),
	"life_insurance" jsonb,
	"spouse_life_insurance" jsonb,
	"health_insurance" jsonb,
	"disability_insurance" jsonb,
	"spouse_disability_insurance" jsonb,
	"insurance" jsonb,
	"risk_tolerance" text,
	"risk_questionnaire" jsonb,
	"risk_questions" jsonb,
	"current_allocation" jsonb,
	"spouse_risk_questions" jsonb,
	"spouse_allocation" jsonb,
	"estate_planning" jsonb,
	"goals" jsonb,
	"life_goals" jsonb,
	"tax_returns" jsonb,
	"financial_health_score" integer,
	"emergency_readiness_score" integer,
	"retirement_readiness_score" integer,
	"risk_management_score" integer,
	"cash_flow_score" integer,
	"calculations" jsonb,
	"is_complete" boolean DEFAULT false,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pdf_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"report_data" jsonb,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD CONSTRAINT "financial_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_reports" ADD CONSTRAINT "pdf_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;