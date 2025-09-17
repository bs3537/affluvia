-- Ensure child estate tables have estate_plan_id to support filtering by plan

-- estate_beneficiaries: add estate_plan_id + is_primary if missing
ALTER TABLE IF EXISTS estate_beneficiaries
  ADD COLUMN IF NOT EXISTS estate_plan_id integer,
  ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT true;

-- estate_documents: add estate_plan_id if missing
ALTER TABLE IF EXISTS estate_documents
  ADD COLUMN IF NOT EXISTS estate_plan_id integer;

-- estate_trusts: add estate_plan_id if missing
ALTER TABLE IF EXISTS estate_trusts
  ADD COLUMN IF NOT EXISTS estate_plan_id integer;

-- Optionally add foreign keys if not present (commented to avoid duplicate constraint errors)
-- ALTER TABLE estate_beneficiaries
--   ADD CONSTRAINT IF NOT EXISTS estate_beneficiaries_estate_plan_fk FOREIGN KEY (estate_plan_id) REFERENCES public.estate_plans(id) ON DELETE CASCADE;
-- ALTER TABLE estate_documents
--   ADD CONSTRAINT IF NOT EXISTS estate_documents_estate_plan_fk FOREIGN KEY (estate_plan_id) REFERENCES public.estate_plans(id) ON DELETE CASCADE;
-- ALTER TABLE estate_trusts
--   ADD CONSTRAINT IF NOT EXISTS estate_trusts_estate_plan_fk FOREIGN KEY (estate_plan_id) REFERENCES public.estate_plans(id) ON DELETE CASCADE;
