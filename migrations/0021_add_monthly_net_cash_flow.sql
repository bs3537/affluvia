-- Ensure monthly_net_cash_flow exists for plaid_aggregated_snapshot
-- Some environments created monthly_cash_flow only; code expects monthly_net_cash_flow

ALTER TABLE IF EXISTS plaid_aggregated_snapshot
ADD COLUMN IF NOT EXISTS monthly_net_cash_flow DECIMAL(12, 2);

-- If legacy monthly_cash_flow exists and net column is NULL, backfill
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaid_aggregated_snapshot'
      AND column_name = 'monthly_cash_flow'
  ) THEN
    EXECUTE 'UPDATE plaid_aggregated_snapshot
             SET monthly_net_cash_flow = monthly_cash_flow
             WHERE monthly_net_cash_flow IS NULL';
  END IF;
END $$;

