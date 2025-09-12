-- Create plaid_sync_schedule table for tracking Plaid sync operations
CREATE TABLE IF NOT EXISTS plaid_sync_schedule (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  next_sync_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'running', 'completed', 'failed')),
  sync_frequency TEXT DEFAULT 'daily' CHECK (sync_frequency IN ('daily', 'weekly', 'monthly')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, account_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_plaid_sync_schedule_next_sync ON plaid_sync_schedule(next_sync_at);
CREATE INDEX IF NOT EXISTS idx_plaid_sync_schedule_status ON plaid_sync_schedule(sync_status);
CREATE INDEX IF NOT EXISTS idx_plaid_sync_schedule_user_id ON plaid_sync_schedule(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_plaid_sync_schedule_updated_at ON plaid_sync_schedule;
CREATE TRIGGER update_plaid_sync_schedule_updated_at
  BEFORE UPDATE ON plaid_sync_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON plaid_sync_schedule TO postgres;
GRANT ALL ON plaid_sync_schedule_id_seq TO postgres;