-- Ensure estate_beneficiaries has all columns expected by the application

ALTER TABLE IF EXISTS estate_beneficiaries
  ADD COLUMN IF NOT EXISTS beneficiary_type text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS date_of_birth timestamp,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS contact_info jsonb,
  ADD COLUMN IF NOT EXISTS distribution_type text,
  ADD COLUMN IF NOT EXISTS distribution_percentage numeric(5, 2),
  ADD COLUMN IF NOT EXISTS distribution_amount numeric(15, 2),
  ADD COLUMN IF NOT EXISTS specific_assets jsonb,
  ADD COLUMN IF NOT EXISTS conditions text,
  ADD COLUMN IF NOT EXISTS trustee text,
  ADD COLUMN IF NOT EXISTS age_restriction integer,
  ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contingent_beneficiary_id integer,
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Optional: add FK for contingent_beneficiary_id if not present (commented to avoid duplicate errors)
-- ALTER TABLE estate_beneficiaries
--   ADD CONSTRAINT IF NOT EXISTS estate_beneficiaries_contingent_fk FOREIGN KEY (contingent_beneficiary_id)
--   REFERENCES public.estate_beneficiaries(id) ON DELETE SET NULL;
