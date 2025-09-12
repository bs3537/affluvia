CREATE TABLE "achievement_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"category" text NOT NULL,
	"xp" integer NOT NULL,
	"requirement_type" text NOT NULL,
	"requirement_value" integer NOT NULL,
	"requirement_target" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "action_plan_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task_id" text NOT NULL,
	"recommendation_title" text NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "section_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"section" text NOT NULL,
	"visits" integer DEFAULT 0,
	"time_spent" integer DEFAULT 0,
	"actions_completed" integer DEFAULT 0,
	"last_visit" timestamp DEFAULT now(),
	"completion_percentage" numeric(5, 2) DEFAULT '0',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" text PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp DEFAULT now(),
	"xp_earned" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"total_xp" integer DEFAULT 0,
	"current_level" integer DEFAULT 1,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_visit" timestamp DEFAULT now(),
	"session_stats" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "user_health_status" text;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_health_status" text;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "retirement_state" text;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "part_time_income_retirement" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_part_time_income_retirement" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_pension_benefit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "expected_inflation_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_social_security_benefit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_retirement_contributions" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "optimization_variables" jsonb;--> statement-breakpoint
ALTER TABLE "action_plan_tasks" ADD CONSTRAINT "action_plan_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_progress" ADD CONSTRAINT "section_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;