CREATE TABLE IF NOT EXISTS "education_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"student_name" text NOT NULL,
	"relationship" text,
	"student_birth_year" integer,
	"goal_type" text DEFAULT 'college' NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer NOT NULL,
	"years" integer NOT NULL,
	"cost_option" text NOT NULL,
	"college_id" text,
	"college_name" text,
	"cost_per_year" numeric(12, 2),
	"inflation_rate" numeric(5, 2) DEFAULT '5.0',
	"cover_percent" numeric(5, 2) DEFAULT '100',
	"scholarship_per_year" numeric(12, 2) DEFAULT '0',
	"loan_per_year" numeric(12, 2) DEFAULT '0',
	"current_savings" numeric(12, 2) DEFAULT '0',
	"monthly_contribution" numeric(12, 2) DEFAULT '0',
	"account_type" text,
	"expected_return" numeric(5, 2) DEFAULT '6.0',
	"risk_profile" text DEFAULT 'moderate',
	"projection_data" jsonb,
	"monthly_contribution_needed" numeric(12, 2),
	"funding_percentage" numeric(5, 2),
	"probability_of_success" numeric(5, 2),
	"last_calculated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "college_reference" (
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
CREATE TABLE IF NOT EXISTS "state_529_plans" (
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
CREATE TABLE IF NOT EXISTS "education_scenarios" (
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
DO $$ BEGIN
 ALTER TABLE "education_goals" ADD CONSTRAINT "education_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "education_scenarios" ADD CONSTRAINT "education_scenarios_education_goal_id_education_goals_id_fk" FOREIGN KEY ("education_goal_id") REFERENCES "public"."education_goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "education_scenarios" ADD CONSTRAINT "education_scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;