-- Bootstrap migration for Supabase
-- This ensures all required extensions are enabled and basic RLS is configured

-- Extensions needed by schema/defaults
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- For UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;         -- For gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- For text search
CREATE EXTENSION IF NOT EXISTS citext;           -- Case-insensitive text

-- Ensure public schema exists
CREATE SCHEMA IF NOT EXISTS public;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Enable RLS on critical tables (will be created by subsequent migrations)
-- Note: We'll enable RLS after tables are created in the main migration

-- Note: auth.uid() and auth.role() are already provided by Supabase
-- No need to recreate them

-- Create a trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Note: RLS policies will be added after tables are created
-- This is just the bootstrap to ensure extensions are available