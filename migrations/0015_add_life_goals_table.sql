CREATE TABLE IF NOT EXISTS "life_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"goal_type" text NOT NULL,
	"goal_name" text NOT NULL,
	"description" text,
	"target_date" date,
	"target_amount" numeric(12, 2),
	"current_amount" numeric(12, 2) DEFAULT '0',
	"monthly_contribution" numeric(12, 2) DEFAULT '0',
	"funding_percentage" numeric(5, 2) DEFAULT '0',
	"priority" text DEFAULT 'medium',
	"status" text DEFAULT 'behind',
	"funding_sources" jsonb,
	"metadata" jsonb,
	"linked_entity_id" text,
	"linked_entity_type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "life_goals" ADD CONSTRAINT "life_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "life_goals_user_id_idx" ON "life_goals" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "life_goals_goal_type_idx" ON "life_goals" ("goal_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "life_goals_linked_entity_idx" ON "life_goals" ("linked_entity_id", "linked_entity_type");