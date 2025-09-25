CREATE TABLE "advisor_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_advisor_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "advisor_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"advisor_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "advisor_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"advisor_id" integer NOT NULL,
	"email" text NOT NULL,
	"invite_token" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"client_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(255),
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"message_id" integer,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" text NOT NULL,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"extracted_text" text,
	"extracted_data" jsonb,
	"ai_summary" text,
	"ai_insights" jsonb,
	"document_type" text,
	"document_category" text,
	"uploaded_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"insights" jsonb NOT NULL,
	"generated_by_model" text DEFAULT 'gemini-2.5-flash-lite',
	"generation_prompt" text,
	"generation_version" text DEFAULT '1.0',
	"financial_snapshot" jsonb,
	"profile_data_hash" text,
	"is_active" boolean DEFAULT true,
	"valid_until" timestamp,
	"regeneration_triggered" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"last_viewed" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"accessed_by" integer,
	"data_type" varchar(50) NOT NULL,
	"purpose" varchar(100) NOT NULL,
	"fields_accessed" text[],
	"export_format" varchar(20),
	"ip_address" text,
	"accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"goal_type" text NOT NULL,
	"goal_name" text NOT NULL,
	"description" text,
	"target_date" text,
	"target_amount" numeric(12, 2),
	"current_amount" numeric(12, 2) DEFAULT '0',
	"monthly_contribution" numeric(12, 2) DEFAULT '0',
	"funding_sources" jsonb DEFAULT '[]'::jsonb,
	"funding_percentage" numeric(5, 2) DEFAULT '0',
	"priority" text DEFAULT 'medium',
	"status" text DEFAULT 'pending',
	"linked_entity_id" text,
	"linked_entity_type" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plaid_account_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plaid_account_id" integer,
	"category" text NOT NULL,
	"subcategory" text,
	"asset_type" text,
	"owner" text DEFAULT 'user',
	"allocation_percentage" numeric(5, 2) DEFAULT '100',
	"include_in_calculations" boolean DEFAULT true,
	"is_emergency_fund" boolean DEFAULT false,
	"is_retirement_account" boolean DEFAULT false,
	"is_education_account" boolean DEFAULT false,
	"custom_name" text,
	"tags" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plaid_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"plaid_item_id" integer,
	"user_id" integer NOT NULL,
	"account_id" text NOT NULL,
	"account_name" text,
	"official_name" text,
	"account_type" text,
	"account_subtype" text,
	"current_balance" numeric(12, 2),
	"available_balance" numeric(12, 2),
	"credit_limit" numeric(12, 2),
	"currency" text DEFAULT 'USD',
	"mask" text,
	"is_active" boolean DEFAULT true,
	"last_synced" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "plaid_accounts_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "plaid_aggregated_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"total_assets" numeric(15, 2),
	"total_liabilities" numeric(15, 2),
	"net_worth" numeric(15, 2),
	"banking_assets" numeric(15, 2),
	"investment_assets" numeric(15, 2),
	"retirement_assets" numeric(15, 2),
	"emergency_funds" numeric(15, 2),
	"education_funds" numeric(15, 2),
	"credit_card_debt" numeric(15, 2),
	"student_loans" numeric(15, 2),
	"personal_loans" numeric(15, 2),
	"mortgage_debt" numeric(15, 2),
	"other_debt" numeric(15, 2),
	"monthly_income" numeric(12, 2),
	"monthly_expenses" numeric(12, 2),
	"monthly_net_cash_flow" numeric(12, 2),
	"stocks_percentage" numeric(5, 2),
	"bonds_percentage" numeric(5, 2),
	"cash_percentage" numeric(5, 2),
	"alternatives_percentage" numeric(5, 2),
	"user_assets" numeric(15, 2),
	"spouse_assets" numeric(15, 2),
	"joint_assets" numeric(15, 2),
	"snapshot_date" timestamp DEFAULT now(),
	"data_sources" jsonb,
	"account_count" integer,
	"linked_account_count" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plaid_investment_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"plaid_account_id" integer,
	"user_id" integer NOT NULL,
	"holding_id" text NOT NULL,
	"security_id" text,
	"cost_basis" numeric(12, 2),
	"quantity" numeric(15, 6),
	"price" numeric(12, 4),
	"price_as_of" date,
	"value" numeric(12, 2),
	"symbol" text,
	"name" text,
	"type" text,
	"iso_currency_code" text DEFAULT 'USD',
	"unofficial_currency_code" text,
	"last_synced" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plaid_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"access_token" text NOT NULL,
	"item_id" text NOT NULL,
	"institution_id" text,
	"institution_name" text,
	"status" text DEFAULT 'active',
	"error_code" text,
	"error_message" text,
	"consent_expiration_time" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "plaid_items_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "plaid_liabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"plaid_account_id" integer,
	"user_id" integer NOT NULL,
	"liability_type" text,
	"current_balance" numeric(12, 2),
	"original_balance" numeric(12, 2),
	"minimum_payment" numeric(12, 2),
	"next_payment_due_date" date,
	"interest_rate" numeric(5, 3),
	"apr" numeric(5, 3),
	"loan_term_months" integer,
	"origination_date" date,
	"principal_balance" numeric(12, 2),
	"interest_balance" numeric(12, 2),
	"escrow_balance" numeric(12, 2),
	"last_payment_amount" numeric(12, 2),
	"last_payment_date" date,
	"ytd_interest_paid" numeric(12, 2),
	"ytd_principal_paid" numeric(12, 2),
	"metadata" jsonb,
	"last_synced" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plaid_sync_recovery" (
	"id" serial PRIMARY KEY NOT NULL,
	"plaid_item_id" integer,
	"user_id" integer,
	"sync_type" text NOT NULL,
	"status" text DEFAULT 'pending',
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp,
	"last_error" text,
	"last_attempt_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plaid_sync_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"sync_frequency" text DEFAULT 'monthly',
	"next_sync_date" timestamp,
	"last_full_sync" timestamp,
	"last_partial_sync" timestamp,
	"auto_sync_enabled" boolean DEFAULT true,
	"sync_transactions" boolean DEFAULT true,
	"sync_investments" boolean DEFAULT true,
	"sync_liabilities" boolean DEFAULT true,
	"transaction_days_to_sync" integer DEFAULT 30,
	"manual_syncs_today" integer DEFAULT 0,
	"manual_sync_reset_date" date,
	"notify_on_sync" boolean DEFAULT true,
	"notify_on_large_changes" boolean DEFAULT true,
	"large_change_threshold" numeric(12, 2) DEFAULT '10000',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "plaid_sync_schedule_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "plaid_sync_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"last_accounts_sync" timestamp,
	"last_transactions_sync" timestamp,
	"last_holdings_sync" timestamp,
	"last_liabilities_sync" timestamp,
	"transactions_cursor" text,
	"sync_in_progress" boolean DEFAULT false,
	"last_error" text,
	"last_error_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "plaid_sync_status_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "plaid_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"plaid_account_id" integer,
	"user_id" integer NOT NULL,
	"transaction_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"authorized_date" date,
	"name" text,
	"merchant_name" text,
	"category" jsonb,
	"primary_category" text,
	"detailed_category" text,
	"pending" boolean DEFAULT false,
	"payment_channel" text,
	"location" jsonb,
	"account_owner" text,
	"iso_currency_code" text DEFAULT 'USD',
	"unofficial_currency_code" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "plaid_transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "plaid_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_type" text NOT NULL,
	"webhook_code" text NOT NULL,
	"item_id" text,
	"plaid_item_id" integer,
	"error" jsonb,
	"new_transactions" integer,
	"removed_transactions" jsonb,
	"request_id" text,
	"payload" jsonb,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_layouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"layout" jsonb DEFAULT '["financial_health_score","monthly_cash_flow","net_worth","retirement_confidence_gauge","optimization_impact_on_balance","retirement_stress_test","net_worth_projection_optimized","insurance_adequacy_score","emergency_readiness_score"]'::jsonb NOT NULL,
	"insights_section_title" text DEFAULT 'Insights',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"advisor_id" integer,
	"layout" jsonb NOT NULL,
	"widgets" jsonb NOT NULL,
	"insights" jsonb NOT NULL,
	"insights_title" text DEFAULT 'Insights',
	"disclaimer_text" text,
	"disclaimer_version" text DEFAULT '1.0',
	"theme_version" text DEFAULT 'report-light-1',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roth_conversion_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"analysis" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "roth_conversion_analyses_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"event_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"description" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_rotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"plaid_item_id" integer NOT NULL,
	"old_token_hash" varchar(64),
	"new_token_hash" varchar(64),
	"rotation_reason" varchar(50),
	"rotated_at" timestamp DEFAULT now() NOT NULL,
	"rotated_by" integer,
	"success" boolean DEFAULT true,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"granted" boolean DEFAULT false NOT NULL,
	"granted_at" timestamp,
	"revoked_at" timestamp,
	"ip_address" text,
	"consent_version" varchar(20),
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "white_label_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"advisor_id" integer NOT NULL,
	"firm_name" text,
	"logo_url" text,
	"address" text,
	"phone" text,
	"email" text,
	"default_disclaimer" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "widget_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"widget_type" text NOT NULL,
	"input_hash" text NOT NULL,
	"widget_data" jsonb NOT NULL,
	"calculated_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"version" integer DEFAULT 1
);
--> statement-breakpoint
ALTER TABLE "education_goals" ADD COLUMN "ai_insights" jsonb;--> statement-breakpoint
ALTER TABLE "education_goals" ADD COLUMN "ai_insights_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "total_monthly_expenses" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "current_stock_allocation" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "current_bond_allocation" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "current_cash_allocation" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "current_alternatives_allocation" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "user_risk_profile" text;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "target_allocation" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_risk_profile" text;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "spouse_target_allocation" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "net_worth" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "monthly_cash_flow" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "monthly_cash_flow_after_contributions" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "central_insights" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "retirement_insights" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "net_worth_projections" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "last_stress_test_results" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "last_stress_test_date" varchar(50);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "is_self_employed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "self_employment_income" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "has_retirement_plan" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "quarterly_tax_payments" jsonb;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD COLUMN "self_employed_data" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "advisor_audit_logs" ADD CONSTRAINT "advisor_audit_logs_actor_advisor_id_users_id_fk" FOREIGN KEY ("actor_advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_audit_logs" ADD CONSTRAINT "advisor_audit_logs_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_clients" ADD CONSTRAINT "advisor_clients_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_clients" ADD CONSTRAINT "advisor_clients_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_invites" ADD CONSTRAINT "advisor_invites_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_invites" ADD CONSTRAINT "advisor_invites_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_documents" ADD CONSTRAINT "chat_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_documents" ADD CONSTRAINT "chat_documents_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_insights" ADD CONSTRAINT "dashboard_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_access_logs" ADD CONSTRAINT "data_access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_access_logs" ADD CONSTRAINT "data_access_logs_accessed_by_users_id_fk" FOREIGN KEY ("accessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_goals" ADD CONSTRAINT "life_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_account_mappings" ADD CONSTRAINT "plaid_account_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_account_mappings" ADD CONSTRAINT "plaid_account_mappings_plaid_account_id_plaid_accounts_id_fk" FOREIGN KEY ("plaid_account_id") REFERENCES "public"."plaid_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_accounts" ADD CONSTRAINT "plaid_accounts_plaid_item_id_plaid_items_id_fk" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_accounts" ADD CONSTRAINT "plaid_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_aggregated_snapshot" ADD CONSTRAINT "plaid_aggregated_snapshot_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_investment_holdings" ADD CONSTRAINT "plaid_investment_holdings_plaid_account_id_plaid_accounts_id_fk" FOREIGN KEY ("plaid_account_id") REFERENCES "public"."plaid_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_investment_holdings" ADD CONSTRAINT "plaid_investment_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_liabilities" ADD CONSTRAINT "plaid_liabilities_plaid_account_id_plaid_accounts_id_fk" FOREIGN KEY ("plaid_account_id") REFERENCES "public"."plaid_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_liabilities" ADD CONSTRAINT "plaid_liabilities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_sync_recovery" ADD CONSTRAINT "plaid_sync_recovery_plaid_item_id_plaid_items_id_fk" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_sync_recovery" ADD CONSTRAINT "plaid_sync_recovery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_sync_schedule" ADD CONSTRAINT "plaid_sync_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_sync_status" ADD CONSTRAINT "plaid_sync_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_transactions" ADD CONSTRAINT "plaid_transactions_plaid_account_id_plaid_accounts_id_fk" FOREIGN KEY ("plaid_account_id") REFERENCES "public"."plaid_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_transactions" ADD CONSTRAINT "plaid_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_webhook_events" ADD CONSTRAINT "plaid_webhook_events_plaid_item_id_plaid_items_id_fk" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_layouts" ADD CONSTRAINT "report_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roth_conversion_analyses" ADD CONSTRAINT "roth_conversion_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_rotations" ADD CONSTRAINT "token_rotations_plaid_item_id_plaid_items_id_fk" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_rotations" ADD CONSTRAINT "token_rotations_rotated_by_users_id_fk" FOREIGN KEY ("rotated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "white_label_profiles" ADD CONSTRAINT "white_label_profiles_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_cache" ADD CONSTRAINT "widget_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;