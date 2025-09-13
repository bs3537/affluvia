-- Create Plaid items table for storing access tokens and item metadata
CREATE TABLE IF NOT EXISTS plaid_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  access_token TEXT NOT NULL,
  item_id TEXT NOT NULL UNIQUE,
  institution_id TEXT,
  institution_name TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'requires_reauth', 'error', 'removed'
  error_code TEXT,
  error_message TEXT,
  consent_expiration_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for user_id lookups
CREATE INDEX idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX idx_plaid_items_status ON plaid_items(status);

-- Create Plaid accounts table for individual accounts from each item
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id SERIAL PRIMARY KEY,
  plaid_item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  account_id TEXT NOT NULL UNIQUE,
  account_name TEXT,
  official_name TEXT,
  account_type TEXT, -- 'depository', 'investment', 'loan', 'credit'
  account_subtype TEXT, -- 'checking', 'savings', 'cd', 'money_market', 'credit_card', 'mortgage', etc.
  current_balance DECIMAL(12, 2),
  available_balance DECIMAL(12, 2),
  credit_limit DECIMAL(12, 2), -- For credit cards
  currency TEXT DEFAULT 'USD',
  mask TEXT, -- Last 4 digits of account number
  is_active BOOLEAN DEFAULT true,
  last_synced TIMESTAMP,
  metadata JSONB, -- Store additional account-specific data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for account lookups
CREATE INDEX idx_plaid_accounts_plaid_item_id ON plaid_accounts(plaid_item_id);
CREATE INDEX idx_plaid_accounts_user_id ON plaid_accounts(user_id);
CREATE INDEX idx_plaid_accounts_account_type ON plaid_accounts(account_type);
CREATE INDEX idx_plaid_accounts_is_active ON plaid_accounts(is_active);

-- Create Plaid transactions table
CREATE TABLE IF NOT EXISTS plaid_transactions (
  id SERIAL PRIMARY KEY,
  plaid_account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  authorized_date DATE,
  name TEXT,
  merchant_name TEXT,
  category JSONB, -- Array of category hierarchy
  primary_category TEXT,
  detailed_category TEXT,
  pending BOOLEAN DEFAULT false,
  payment_channel TEXT, -- 'online', 'in_store', 'other'
  location JSONB, -- Store location data if available
  account_owner TEXT,
  iso_currency_code TEXT DEFAULT 'USD',
  unofficial_currency_code TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for transaction queries
CREATE INDEX idx_plaid_transactions_plaid_account_id ON plaid_transactions(plaid_account_id);
CREATE INDEX idx_plaid_transactions_user_id ON plaid_transactions(user_id);
CREATE INDEX idx_plaid_transactions_date ON plaid_transactions(date DESC);
CREATE INDEX idx_plaid_transactions_category ON plaid_transactions(primary_category);
CREATE INDEX idx_plaid_transactions_pending ON plaid_transactions(pending);

-- Create Plaid investment holdings table
CREATE TABLE IF NOT EXISTS plaid_investment_holdings (
  id SERIAL PRIMARY KEY,
  plaid_account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  holding_id TEXT NOT NULL,
  security_id TEXT,
  cost_basis DECIMAL(12, 2),
  quantity DECIMAL(15, 6),
  price DECIMAL(12, 4),
  price_as_of DATE,
  value DECIMAL(12, 2),
  symbol TEXT,
  name TEXT,
  type TEXT, -- 'equity', 'mutual_fund', 'etf', 'bond', etc.
  iso_currency_code TEXT DEFAULT 'USD',
  unofficial_currency_code TEXT,
  last_synced TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for investment holdings
CREATE INDEX idx_plaid_investment_holdings_plaid_account_id ON plaid_investment_holdings(plaid_account_id);
CREATE INDEX idx_plaid_investment_holdings_user_id ON plaid_investment_holdings(user_id);
CREATE INDEX idx_plaid_investment_holdings_symbol ON plaid_investment_holdings(symbol);

-- Create Plaid liabilities table
CREATE TABLE IF NOT EXISTS plaid_liabilities (
  id SERIAL PRIMARY KEY,
  plaid_account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  liability_type TEXT, -- 'mortgage', 'student_loan', 'credit_card'
  current_balance DECIMAL(12, 2),
  original_balance DECIMAL(12, 2),
  minimum_payment DECIMAL(12, 2),
  next_payment_due_date DATE,
  interest_rate DECIMAL(5, 3),
  apr DECIMAL(5, 3),
  loan_term_months INTEGER,
  origination_date DATE,
  principal_balance DECIMAL(12, 2),
  interest_balance DECIMAL(12, 2),
  escrow_balance DECIMAL(12, 2),
  last_payment_amount DECIMAL(12, 2),
  last_payment_date DATE,
  ytd_interest_paid DECIMAL(12, 2),
  ytd_principal_paid DECIMAL(12, 2),
  metadata JSONB,
  last_synced TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for liabilities
CREATE INDEX idx_plaid_liabilities_plaid_account_id ON plaid_liabilities(plaid_account_id);
CREATE INDEX idx_plaid_liabilities_user_id ON plaid_liabilities(user_id);
CREATE INDEX idx_plaid_liabilities_type ON plaid_liabilities(liability_type);

-- Create Plaid webhook events table for audit trail
CREATE TABLE IF NOT EXISTS plaid_webhook_events (
  id SERIAL PRIMARY KEY,
  webhook_type TEXT NOT NULL,
  webhook_code TEXT NOT NULL,
  item_id TEXT,
  plaid_item_id INTEGER REFERENCES plaid_items(id),
  error JSON,
  new_transactions INTEGER,
  removed_transactions JSONB,
  request_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for webhook events
CREATE INDEX idx_plaid_webhook_events_item_id ON plaid_webhook_events(item_id);
CREATE INDEX idx_plaid_webhook_events_processed ON plaid_webhook_events(processed);
CREATE INDEX idx_plaid_webhook_events_created_at ON plaid_webhook_events(created_at DESC);

-- Create sync status table for tracking data synchronization
CREATE TABLE IF NOT EXISTS plaid_sync_status (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL UNIQUE,
  last_accounts_sync TIMESTAMP,
  last_transactions_sync TIMESTAMP,
  last_holdings_sync TIMESTAMP,
  last_liabilities_sync TIMESTAMP,
  transactions_cursor TEXT, -- For incremental sync
  sync_in_progress BOOLEAN DEFAULT false,
  last_error TEXT,
  last_error_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for sync status
CREATE INDEX idx_plaid_sync_status_user_id ON plaid_sync_status(user_id);