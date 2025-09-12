-- Create table for mapping and categorizing Plaid accounts
CREATE TABLE IF NOT EXISTS plaid_account_mappings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  plaid_account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
  
  -- Categorization
  category TEXT NOT NULL, -- 'asset' or 'liability'
  subcategory TEXT, -- 'retirement', 'investment', 'banking', 'emergency', 'debt', 'education'
  asset_type TEXT, -- For investments: 'stocks', 'bonds', 'cash', 'alternatives'
  
  -- Ownership and allocation
  owner TEXT DEFAULT 'user', -- 'user', 'spouse', 'joint'
  allocation_percentage DECIMAL(5, 2) DEFAULT 100, -- For joint accounts
  
  -- User preferences
  include_in_calculations BOOLEAN DEFAULT true,
  is_emergency_fund BOOLEAN DEFAULT false,
  is_retirement_account BOOLEAN DEFAULT false,
  is_education_account BOOLEAN DEFAULT false,
  custom_name TEXT, -- User can rename for clarity
  
  -- Tags and notes
  tags JSONB, -- Array of custom tags
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_plaid_account_mappings_user_id ON plaid_account_mappings(user_id);
CREATE INDEX idx_plaid_account_mappings_plaid_account_id ON plaid_account_mappings(plaid_account_id);
CREATE INDEX idx_plaid_account_mappings_category ON plaid_account_mappings(category);
CREATE INDEX idx_plaid_account_mappings_subcategory ON plaid_account_mappings(subcategory);
CREATE INDEX idx_plaid_account_mappings_owner ON plaid_account_mappings(owner);

-- Create table for Plaid sync schedule and history
CREATE TABLE IF NOT EXISTS plaid_sync_schedule (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL UNIQUE,
  
  -- Schedule settings
  sync_frequency TEXT DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly', 'manual'
  next_sync_date TIMESTAMP,
  last_full_sync TIMESTAMP,
  last_partial_sync TIMESTAMP,
  
  -- Sync preferences
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_transactions BOOLEAN DEFAULT true,
  sync_investments BOOLEAN DEFAULT true,
  sync_liabilities BOOLEAN DEFAULT true,
  transaction_days_to_sync INTEGER DEFAULT 30,
  
  -- Rate limiting
  manual_syncs_today INTEGER DEFAULT 0,
  manual_sync_reset_date DATE,
  
  -- Notifications
  notify_on_sync BOOLEAN DEFAULT true,
  notify_on_large_changes BOOLEAN DEFAULT true,
  large_change_threshold DECIMAL(12, 2) DEFAULT 10000, -- Dollar amount
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index
CREATE INDEX idx_plaid_sync_schedule_next_sync ON plaid_sync_schedule(next_sync_date);

-- Create table for aggregated financial snapshot (cached calculations)
CREATE TABLE IF NOT EXISTS plaid_aggregated_snapshot (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  
  -- Aggregated balances
  total_assets DECIMAL(15, 2),
  total_liabilities DECIMAL(15, 2),
  net_worth DECIMAL(15, 2),
  
  -- Asset breakdown
  banking_assets DECIMAL(15, 2), -- Checking + Savings
  investment_assets DECIMAL(15, 2), -- Taxable investment accounts
  retirement_assets DECIMAL(15, 2), -- 401k, IRA, etc.
  emergency_funds DECIMAL(15, 2), -- Tagged emergency accounts
  education_funds DECIMAL(15, 2), -- 529 plans
  
  -- Liability breakdown
  credit_card_debt DECIMAL(15, 2),
  student_loans DECIMAL(15, 2),
  personal_loans DECIMAL(15, 2),
  mortgage_debt DECIMAL(15, 2),
  other_debt DECIMAL(15, 2),
  
  -- Cash flow
  monthly_income DECIMAL(12, 2),
  monthly_expenses DECIMAL(12, 2),
  monthly_net_cash_flow DECIMAL(12, 2),
  
  -- Investment allocation (percentages)
  stocks_percentage DECIMAL(5, 2),
  bonds_percentage DECIMAL(5, 2),
  cash_percentage DECIMAL(5, 2),
  alternatives_percentage DECIMAL(5, 2),
  
  -- Ownership split
  user_assets DECIMAL(15, 2),
  spouse_assets DECIMAL(15, 2),
  joint_assets DECIMAL(15, 2),
  
  -- Metadata
  snapshot_date TIMESTAMP DEFAULT NOW(),
  data_sources JSONB, -- {'plaid': true, 'manual': true}
  account_count INTEGER,
  linked_account_count INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_plaid_aggregated_snapshot_user_id ON plaid_aggregated_snapshot(user_id);
CREATE INDEX idx_plaid_aggregated_snapshot_date ON plaid_aggregated_snapshot(snapshot_date DESC);