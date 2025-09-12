-- Create plaid_sync_recovery table for managing failed sync retries
CREATE TABLE IF NOT EXISTS plaid_sync_recovery (
  id SERIAL PRIMARY KEY,
  plaid_item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- 'accounts', 'transactions', 'investments', 'liabilities'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'failed', 'recovered'
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,
  last_error TEXT,
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_plaid_sync_recovery_status ON plaid_sync_recovery(status);
CREATE INDEX idx_plaid_sync_recovery_next_retry ON plaid_sync_recovery(next_retry_at);
CREATE INDEX idx_plaid_sync_recovery_plaid_item ON plaid_sync_recovery(plaid_item_id);

-- Add comment
COMMENT ON TABLE plaid_sync_recovery IS 'Tracks and manages recovery of failed Plaid sync operations';