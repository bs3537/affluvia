-- Set LZ4 compression on large JSONB columns to reduce TOAST bloat
ALTER TABLE financial_profiles ALTER COLUMN monte_carlo_simulation SET COMPRESSION lz4;
ALTER TABLE financial_profiles ALTER COLUMN optimization_variables SET COMPRESSION lz4;
ALTER TABLE financial_profiles ALTER COLUMN retirement_planning_data SET COMPRESSION lz4;
ALTER TABLE financial_profiles ALTER COLUMN last_stress_test_results SET COMPRESSION lz4;

-- Note: requires PostgreSQL 14+ and pg_lz4. Supabase supports column compression.
