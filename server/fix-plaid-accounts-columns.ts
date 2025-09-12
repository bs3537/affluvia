import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixPlaidAccountsColumns() {
  console.log('Fixing missing columns in plaid_accounts table...');
  
  try {
    // First ensure plaid_accounts table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plaid_accounts (
        id SERIAL PRIMARY KEY,
        plaid_item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        account_id TEXT NOT NULL UNIQUE,
        account_name TEXT,
        official_name TEXT,
        account_type TEXT,
        account_subtype TEXT,
        current_balance DECIMAL(12, 2),
        available_balance DECIMAL(12, 2),
        credit_limit DECIMAL(12, 2),
        currency TEXT DEFAULT 'USD',
        mask TEXT,
        is_active BOOLEAN DEFAULT true,
        last_synced TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add missing columns if they don't exist
    console.log('Adding missing columns to plaid_accounts...');
    await db.execute(sql`
      ALTER TABLE plaid_accounts 
      ADD COLUMN IF NOT EXISTS plaid_item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS account_id TEXT,
      ADD COLUMN IF NOT EXISTS account_name TEXT,
      ADD COLUMN IF NOT EXISTS official_name TEXT,
      ADD COLUMN IF NOT EXISTS account_type TEXT,
      ADD COLUMN IF NOT EXISTS account_subtype TEXT,
      ADD COLUMN IF NOT EXISTS current_balance DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS available_balance DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
      ADD COLUMN IF NOT EXISTS mask TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    // Add unique constraint if it doesn't exist
    await db.execute(sql`
      ALTER TABLE plaid_accounts 
      ADD CONSTRAINT IF NOT EXISTS plaid_accounts_account_id_unique UNIQUE (account_id)
    `).catch(() => {
      console.log('Unique constraint on account_id already exists or could not be added');
    });
    
    // Add indexes for better performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user_id ON plaid_accounts(user_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_plaid_accounts_plaid_item_id ON plaid_accounts(plaid_item_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_plaid_accounts_is_active ON plaid_accounts(is_active)
    `);
    
    console.log('✅ plaid_accounts table structure fixed successfully!');
    
    // Verify the column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'plaid_accounts' 
      AND column_name = 'plaid_item_id'
    `);
    
    console.log('plaid_item_id column exists:', result.rows.length > 0);
    
    // Check table structure
    const columns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'plaid_accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('\nCurrent plaid_accounts columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Error fixing plaid_accounts columns:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixPlaidAccountsColumns();