import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function fixPlaidTables() {
  console.log('Creating missing Plaid tables...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '0016_add_plaid_account_mappings.sql');
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Add IF NOT EXISTS to all CREATE INDEX statements
    migrationSQL = migrationSQL.replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ');
    
    // Execute the migration
    await client.query(migrationSQL);
    console.log('✓ Created plaid_account_mappings table');
    console.log('✓ Created plaid_sync_schedule table');
    console.log('✓ Created plaid_aggregated_snapshot table');
    
    // Verify the tables were created
    const verification = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'plaid_account_mappings',
          'plaid_sync_schedule',
          'plaid_aggregated_snapshot'
        )
      ORDER BY table_name;
    `);
    
    console.log('\nVerification Results:');
    console.table(verification.rows);
    
    // Also check if the main plaid tables exist
    const plaidTablesCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'plaid_accounts',
          'plaid_institutions',
          'plaid_items',
          'plaid_holdings',
          'plaid_securities',
          'plaid_transactions',
          'plaid_liabilities'
        )
      ORDER BY table_name;
    `);
    
    if (plaidTablesCheck.rows.length === 0) {
      console.log('\n⚠️  Warning: Main Plaid tables are missing.');
      console.log('Creating main Plaid tables...');
      
      // Create the main Plaid tables
      await client.query(`
        -- Create plaid_items table
        CREATE TABLE IF NOT EXISTS plaid_items (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) NOT NULL,
          access_token TEXT NOT NULL,
          item_id TEXT NOT NULL UNIQUE,
          institution_id TEXT,
          institution_name TEXT,
          webhook TEXT,
          error TEXT,
          available_products TEXT[],
          billed_products TEXT[],
          consent_expiration_time TIMESTAMP,
          update_type TEXT DEFAULT 'background',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Create plaid_accounts table
        CREATE TABLE IF NOT EXISTS plaid_accounts (
          id SERIAL PRIMARY KEY,
          item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
          account_id TEXT NOT NULL UNIQUE,
          persistent_account_id TEXT,
          name TEXT,
          official_name TEXT,
          type TEXT,
          subtype TEXT,
          mask TEXT,
          current_balance DECIMAL(15, 2),
          available_balance DECIMAL(15, 2),
          iso_currency_code TEXT,
          unofficial_currency_code TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Create plaid_transactions table
        CREATE TABLE IF NOT EXISTS plaid_transactions (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
          transaction_id TEXT NOT NULL UNIQUE,
          amount DECIMAL(15, 2),
          iso_currency_code TEXT,
          category TEXT[],
          category_id TEXT,
          date DATE,
          datetime TIMESTAMP,
          authorized_date DATE,
          authorized_datetime TIMESTAMP,
          name TEXT,
          merchant_name TEXT,
          payment_channel TEXT,
          pending BOOLEAN,
          pending_transaction_id TEXT,
          account_owner TEXT,
          transaction_type TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Create plaid_holdings table
        CREATE TABLE IF NOT EXISTS plaid_holdings (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
          security_id TEXT,
          institution_price DECIMAL(20, 8),
          institution_price_as_of DATE,
          institution_value DECIMAL(15, 2),
          cost_basis DECIMAL(15, 2),
          quantity DECIMAL(20, 8),
          iso_currency_code TEXT,
          unofficial_currency_code TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Create plaid_securities table
        CREATE TABLE IF NOT EXISTS plaid_securities (
          id SERIAL PRIMARY KEY,
          security_id TEXT NOT NULL UNIQUE,
          isin TEXT,
          cusip TEXT,
          sedol TEXT,
          institution_security_id TEXT,
          institution_id TEXT,
          proxy_security_id TEXT,
          name TEXT,
          ticker_symbol TEXT,
          is_cash_equivalent BOOLEAN,
          type TEXT,
          close_price DECIMAL(20, 8),
          close_price_as_of DATE,
          iso_currency_code TEXT,
          unofficial_currency_code TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Create plaid_liabilities table
        CREATE TABLE IF NOT EXISTS plaid_liabilities (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
          credit_card_apr_percentage DECIMAL(5, 2),
          credit_card_balance DECIMAL(15, 2),
          credit_card_limit DECIMAL(15, 2),
          credit_card_minimum_payment DECIMAL(10, 2),
          mortgage_account_number TEXT,
          mortgage_current_balance DECIMAL(15, 2),
          mortgage_origination_date DATE,
          mortgage_loan_term TEXT,
          mortgage_interest_rate DECIMAL(5, 3),
          mortgage_loan_type TEXT,
          student_loan_name TEXT,
          student_loan_balance DECIMAL(15, 2),
          student_loan_interest_rate DECIMAL(5, 3),
          student_loan_status TEXT,
          student_loan_minimum_payment DECIMAL(10, 2),
          student_loan_repayment_plan TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Create plaid_institutions table if it doesn't exist
        CREATE TABLE IF NOT EXISTS plaid_institutions (
          id SERIAL PRIMARY KEY,
          institution_id TEXT NOT NULL UNIQUE,
          name TEXT,
          products TEXT[],
          country_codes TEXT[],
          url TEXT,
          primary_color TEXT,
          logo TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
        CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item_id ON plaid_accounts(item_id);
        CREATE INDEX IF NOT EXISTS idx_plaid_transactions_account_id ON plaid_transactions(account_id);
        CREATE INDEX IF NOT EXISTS idx_plaid_holdings_account_id ON plaid_holdings(account_id);
        CREATE INDEX IF NOT EXISTS idx_plaid_liabilities_account_id ON plaid_liabilities(account_id);
      `);
      
      console.log('✓ Created all main Plaid tables');
    } else {
      console.log('\n✓ Main Plaid tables already exist:');
      console.table(plaidTablesCheck.rows);
    }
    
    console.log('\n✅ Plaid tables setup completed successfully!');
    
    await client.end();
    
  } catch (error) {
    console.error('Error creating Plaid tables:', error);
    await client.end();
    process.exit(1);
  }
}

async function main() {
  await client.connect();
  await fixPlaidTables();
}

main();
