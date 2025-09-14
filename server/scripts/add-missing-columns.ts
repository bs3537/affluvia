import dotenv from "dotenv";
dotenv.config();

import { pool } from "../db-optimized";

async function run() {
  const client = await pool.connect();
  try {
    console.log("Applying non-destructive column fixes for life_goals and education_goals...");

    // 1) education_goals.student_name (text, nullable)
    await client.query(
      `ALTER TABLE IF EXISTS public.education_goals
       ADD COLUMN IF NOT EXISTS student_name text;`
    );
    console.log("✔ education_goals.student_name ensured");

    // 2) education_goals.relationship (text, nullable)
    await client.query(
      `ALTER TABLE IF EXISTS public.education_goals
       ADD COLUMN IF NOT EXISTS relationship text;`
    );
    console.log("✔ education_goals.relationship ensured");

    // 3) life_goals.description (text, nullable)
    await client.query(
      `ALTER TABLE IF EXISTS public.life_goals
       ADD COLUMN IF NOT EXISTS description text;`
    );
    console.log("✔ life_goals.description ensured");

    // 4) life_goals.target_date (text, nullable)
    await client.query(
      `ALTER TABLE IF EXISTS public.life_goals
       ADD COLUMN IF NOT EXISTS target_date text;`
    );
    console.log("✔ life_goals.target_date ensured");

    // 5) life_goals.funding_percentage (numeric(5,2) DEFAULT '0')
    await client.query(
      `ALTER TABLE IF EXISTS public.life_goals
       ADD COLUMN IF NOT EXISTS funding_percentage numeric(5,2) DEFAULT '0';`
    );
    console.log("✔ life_goals.funding_percentage ensured");

    // 6) life_goals.status (text DEFAULT 'pending')
    await client.query(
      `ALTER TABLE IF EXISTS public.life_goals
       ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';`
    );
    console.log("✔ life_goals.status ensured");

    // 7) life_goals.metadata (jsonb, nullable)
    await client.query(
      `ALTER TABLE IF EXISTS public.life_goals
       ADD COLUMN IF NOT EXISTS metadata jsonb;`
    );
    console.log("✔ life_goals.metadata ensured");

    // 8) Ensure remaining life_goals columns used by code/schema
    await client.query(
      `ALTER TABLE IF EXISTS public.life_goals
         ADD COLUMN IF NOT EXISTS goal_type text,
         ADD COLUMN IF NOT EXISTS goal_name text,
         ADD COLUMN IF NOT EXISTS target_amount numeric(12,2),
         ADD COLUMN IF NOT EXISTS current_amount numeric(12,2) DEFAULT '0',
         ADD COLUMN IF NOT EXISTS monthly_contribution numeric(12,2) DEFAULT '0',
         ADD COLUMN IF NOT EXISTS funding_sources jsonb DEFAULT '[]'::jsonb,
         ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
         ADD COLUMN IF NOT EXISTS linked_entity_id text,
         ADD COLUMN IF NOT EXISTS linked_entity_type text,
         ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT NOW(),
         ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();`
    );
    console.log("✔ life_goals core columns ensured");

    // 9) Ensure education_goals full set of referenced columns
    await client.query(
      `ALTER TABLE IF EXISTS public.education_goals
         ADD COLUMN IF NOT EXISTS relationship text,
         ADD COLUMN IF NOT EXISTS student_birth_year integer,
         ADD COLUMN IF NOT EXISTS goal_type text DEFAULT 'college',
         ADD COLUMN IF NOT EXISTS degree_type text,
         ADD COLUMN IF NOT EXISTS start_year integer,
         ADD COLUMN IF NOT EXISTS end_year integer,
         ADD COLUMN IF NOT EXISTS years integer,
         ADD COLUMN IF NOT EXISTS cost_option text,
         ADD COLUMN IF NOT EXISTS college_id text,
         ADD COLUMN IF NOT EXISTS college_name text,
         ADD COLUMN IF NOT EXISTS cost_per_year numeric(12,2),
         ADD COLUMN IF NOT EXISTS include_room_board boolean DEFAULT true,
         ADD COLUMN IF NOT EXISTS is_in_state boolean DEFAULT true,
         ADD COLUMN IF NOT EXISTS inflation_rate numeric(5,2) DEFAULT '5.0',
         ADD COLUMN IF NOT EXISTS cover_percent numeric(5,2) DEFAULT '100',
         ADD COLUMN IF NOT EXISTS scholarship_per_year numeric(12,2) DEFAULT '0',
         ADD COLUMN IF NOT EXISTS loan_per_year numeric(12,2) DEFAULT '0',
         ADD COLUMN IF NOT EXISTS loan_interest_rate numeric(5,2) DEFAULT '10.0',
         ADD COLUMN IF NOT EXISTS loan_repayment_term integer DEFAULT 10,
         ADD COLUMN IF NOT EXISTS loan_type text,
         ADD COLUMN IF NOT EXISTS current_savings numeric(12,2) DEFAULT '0',
         ADD COLUMN IF NOT EXISTS monthly_contribution numeric(12,2) DEFAULT '0',
         ADD COLUMN IF NOT EXISTS account_type text,
         ADD COLUMN IF NOT EXISTS expected_return numeric(5,2) DEFAULT '6.0',
         ADD COLUMN IF NOT EXISTS risk_profile text DEFAULT 'moderate',
         ADD COLUMN IF NOT EXISTS state_of_residence text,
         ADD COLUMN IF NOT EXISTS funding_sources jsonb,
         ADD COLUMN IF NOT EXISTS projection_data jsonb,
         ADD COLUMN IF NOT EXISTS monthly_contribution_needed numeric(12,2),
         ADD COLUMN IF NOT EXISTS funding_percentage numeric(5,2),
         ADD COLUMN IF NOT EXISTS probability_of_success numeric(5,2),
         ADD COLUMN IF NOT EXISTS last_calculated_at timestamp,
         ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW(),
         ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();`
    );
    console.log("✔ education_goals core columns ensured");

    // Optional: align types noted in validation warnings (safe conversions)
    try {
      // Drop default first to avoid cast errors, sanitize invalid values, then alter type and set default
      await client.query(
        `ALTER TABLE IF EXISTS public.widget_cache
           ALTER COLUMN version DROP DEFAULT;`
      );
      await client.query(
        `UPDATE public.widget_cache
           SET version = NULL
         WHERE version IS NOT NULL AND version !~ '^-?[0-9]+$';`
      );
      await client.query(
        `ALTER TABLE IF EXISTS public.widget_cache
           ALTER COLUMN version TYPE integer USING version::integer;`
      );
      await client.query(
        `ALTER TABLE IF EXISTS public.widget_cache
           ALTER COLUMN version SET DEFAULT 1;`
      );
      console.log("✔ widget_cache.version converted to integer with default 1 (if existed)");
    } catch (e) {
      console.warn("(warn) Could not fully alter widget_cache.version:", (e as Error).message);
    }

    try {
      await client.query(
        `ALTER TABLE IF EXISTS public.plaid_sync_recovery
         ALTER COLUMN error_code TYPE varchar USING error_code::varchar;`
      );
      console.log("✔ plaid_sync_recovery.error_code converted to varchar (if existed)");
    } catch (e) {
      console.warn("(warn) Could not alter plaid_sync_recovery.error_code:", (e as Error).message);
    }

    console.log("All done.");
  } finally {
    client.release();
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error("Failed to apply column fixes:", err);
  process.exit(1);
});
