import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function fixAllPlaidTables() {
  console.log('Creating/fixing ALL Plaid tables...');
  
  try {
    // Create plaid_investment_holdings table (missing from original setup)
    await client.query(`
      CREATE TABLE IF NOT EXISTS plaid_investment_holdings (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
        security_id TEXT REFERENCES plaid_securities(security_id),
        institution_price DECIMAL(20, 8),
        institution_price_as_of DATE,
        institution_value DECIMAL(15, 2),
        cost_basis DECIMAL(15, 2),
        quantity DECIMAL(20, 8),
        iso_currency_code TEXT,
        unofficial_currency_code TEXT,
        vested_quantity DECIMAL(20, 8),
        vested_value DECIMAL(15, 2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_plaid_investment_holdings_account_id 
        ON plaid_investment_holdings(account_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_investment_holdings_security_id 
        ON plaid_investment_holdings(security_id);
    `);
    console.log('✓ Created plaid_investment_holdings table');
    
    // Create plaid_investment_transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS plaid_investment_transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
        investment_transaction_id TEXT NOT NULL UNIQUE,
        security_id TEXT REFERENCES plaid_securities(security_id),
        amount DECIMAL(15, 2),
        price DECIMAL(20, 8),
        quantity DECIMAL(20, 8),
        fees DECIMAL(10, 2),
        type TEXT,
        subtype TEXT,
        iso_currency_code TEXT,
        unofficial_currency_code TEXT,
        date DATE,
        datetime TIMESTAMP,
        name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_plaid_investment_transactions_account_id 
        ON plaid_investment_transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_investment_transactions_date 
        ON plaid_investment_transactions(date);
      CREATE INDEX IF NOT EXISTS idx_plaid_investment_transactions_security_id 
        ON plaid_investment_transactions(security_id);
    `);
    console.log('✓ Created plaid_investment_transactions table');
    
    // Create plaid_categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS plaid_categories (
        id SERIAL PRIMARY KEY,
        category_id TEXT NOT NULL UNIQUE,
        category_group TEXT,
        hierarchy TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_plaid_categories_category_id 
        ON plaid_categories(category_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_categories_category_group 
        ON plaid_categories(category_group);
    `);
    console.log('✓ Created plaid_categories table');
    
    // Create plaid_income table for income verification
    await client.query(`
      CREATE TABLE IF NOT EXISTS plaid_income (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
        
        -- Income streams
        income_streams JSONB, -- Array of income sources
        last_year_income DECIMAL(15, 2),
        last_year_income_before_tax DECIMAL(15, 2),
        projected_yearly_income DECIMAL(15, 2),
        projected_yearly_income_before_tax DECIMAL(15, 2),
        max_number_of_overlapping_income_streams INTEGER,
        number_of_income_streams INTEGER,
        
        -- Verification status
        verification_status TEXT,
        verification_refresh_status TEXT,
        precheck_id TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_plaid_income_user_id ON plaid_income(user_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_income_item_id ON plaid_income(item_id);
    `);
    console.log('✓ Created plaid_income table');
    
    // Create plaid_asset_reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS plaid_asset_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        asset_report_token TEXT NOT NULL UNIQUE,
        asset_report_id TEXT NOT NULL,
        
        -- Report details
        days_requested INTEGER,
        client_report_id TEXT,
        webhook TEXT,
        
        -- Report data
        report_data JSONB, -- Full asset report data
        
        created_at TIMESTAMP DEFAULT NOW(),
        removed_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_plaid_asset_reports_user_id ON plaid_asset_reports(user_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_asset_reports_token ON plaid_asset_reports(asset_report_token);
    `);
    console.log('✓ Created plaid_asset_reports table');
    
    // Create plaid_recurring_transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS plaid_recurring_transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
        stream_id TEXT NOT NULL UNIQUE,
        
        -- Transaction details
        category TEXT[],
        category_id TEXT,
        description TEXT,
        merchant_name TEXT,
        
        -- Frequency and timing
        first_date DATE,
        last_date DATE,
        frequency TEXT, -- 'weekly', 'biweekly', 'monthly', etc.
        transaction_ids TEXT[], -- Array of linked transaction IDs
        
        -- Amounts
        average_amount DECIMAL(10, 2),
        last_amount DECIMAL(10, 2),
        is_user_modified BOOLEAN DEFAULT false,
        
        -- Status
        status TEXT, -- 'mature', 'early_detection', 'tombstoned'
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_plaid_recurring_transactions_account_id 
        ON plaid_recurring_transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_recurring_transactions_stream_id 
        ON plaid_recurring_transactions(stream_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_recurring_transactions_status 
        ON plaid_recurring_transactions(status);
    `);
    console.log('✓ Created plaid_recurring_transactions table');
    
    // Create plaid_webhooks table for webhook management
    await client.query(`
      CREATE TABLE IF NOT EXISTS plaid_webhooks (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
        webhook_type TEXT NOT NULL,
        webhook_code TEXT NOT NULL,
        
        -- Webhook data
        error TEXT,
        new_transactions INTEGER,
        removed_transactions TEXT[], -- Array of removed transaction IDs
        
        -- Processing status
        processed BOOLEAN DEFAULT false,
        processed_at TIMESTAMP,
        
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_plaid_webhooks_item_id ON plaid_webhooks(item_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_webhooks_type ON plaid_webhooks(webhook_type);
      CREATE INDEX IF NOT EXISTS idx_plaid_webhooks_processed ON plaid_webhooks(processed);
      CREATE INDEX IF NOT EXISTS idx_plaid_webhooks_created_at ON plaid_webhooks(created_at DESC);
    `);
    console.log('✓ Created plaid_webhooks table');
    
    // Verify all tables were created
    const verification = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'plaid_%'
      ORDER BY table_name;
    `);
    
    console.log('\n✅ All Plaid tables verified:');
    console.table(verification.rows);
    
    // Count total Plaid tables
    const tableCount = verification.rows.length;
    console.log(`\nTotal Plaid tables: ${tableCount}`);
    
    const expectedTables = [
      'plaid_accounts',
      'plaid_account_mappings',
      'plaid_aggregated_snapshot',
      'plaid_asset_reports',
      'plaid_categories',
      'plaid_holdings',
      'plaid_income',
      'plaid_institutions',
      'plaid_investment_holdings',
      'plaid_investment_transactions',
      'plaid_items',
      'plaid_liabilities',
      'plaid_recurring_transactions',
      'plaid_securities',
      'plaid_sync_schedule',
      'plaid_transactions',
      'plaid_webhooks'
    ];
    
    const existingTables = verification.rows.map(r => r.table_name);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables:', missingTables);
    } else {
      console.log('\n✅ All expected Plaid tables exist!');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('Error creating Plaid tables:', error);
    await client.end();
    process.exit(1);
  }
}

async function main() {
  await client.connect();
  await fixAllPlaidTables();
}

main();