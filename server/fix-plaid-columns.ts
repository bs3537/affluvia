import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function fixPlaidColumns() {
  console.log('Adding missing Plaid columns and tables...');
  
  try {
    // Add missing columns to plaid_transactions
    await client.query(`
      ALTER TABLE plaid_transactions
        ADD COLUMN IF NOT EXISTS plaid_account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE;
    `);
    console.log('✓ Added plaid_account_id to plaid_transactions');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plaid_transactions_plaid_account_id 
        ON plaid_transactions(plaid_account_id);
    `);
    console.log('✓ Created index on plaid_account_id');
    
    // Add missing columns to plaid_sync_recovery if it exists
    const syncRecoveryExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'plaid_sync_recovery'
      );
    `);
    
    if (syncRecoveryExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE plaid_sync_recovery
          ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
          ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS last_error TEXT,
          ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP;
      `);
      console.log('✓ Added missing columns to plaid_sync_recovery');
    } else {
      // Create plaid_sync_recovery table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS plaid_sync_recovery (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) NOT NULL,
          item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
          cursor TEXT,
          status TEXT DEFAULT 'pending',
          retry_count INTEGER DEFAULT 0,
          next_retry_at TIMESTAMP,
          last_error TEXT,
          last_attempt_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_plaid_sync_recovery_user_id 
          ON plaid_sync_recovery(user_id);
        CREATE INDEX IF NOT EXISTS idx_plaid_sync_recovery_item_id 
          ON plaid_sync_recovery(item_id);
        CREATE INDEX IF NOT EXISTS idx_plaid_sync_recovery_status 
          ON plaid_sync_recovery(status);
      `);
      console.log('✓ Created plaid_sync_recovery table');
    }
    
    // Ensure plaid_account_mappings exists with all columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS plaid_account_mappings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        plaid_account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        subcategory TEXT,
        asset_type TEXT,
        owner TEXT DEFAULT 'user',
        allocation_percentage DECIMAL(5,2) DEFAULT 100,
        include_in_calculations BOOLEAN DEFAULT true,
        is_emergency_fund BOOLEAN DEFAULT false,
        is_retirement_account BOOLEAN DEFAULT false,
        is_education_account BOOLEAN DEFAULT false,
        custom_name TEXT,
        tags JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Ensured plaid_account_mappings table exists');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plaid_account_mappings_user_id 
        ON plaid_account_mappings(user_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_account_mappings_plaid_account_id 
        ON plaid_account_mappings(plaid_account_id);
      CREATE INDEX IF NOT EXISTS idx_plaid_account_mappings_category 
        ON plaid_account_mappings(category);
      CREATE INDEX IF NOT EXISTS idx_plaid_account_mappings_subcategory 
        ON plaid_account_mappings(subcategory);
      CREATE INDEX IF NOT EXISTS idx_plaid_account_mappings_owner 
        ON plaid_account_mappings(owner);
    `);
    console.log('✓ Created indexes for plaid_account_mappings');
    
    // Verify all columns exist
    const columnCheck = await client.query(`
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'plaid_transactions' AND column_name = 'plaid_account_id')
          OR (table_name = 'plaid_sync_recovery' AND column_name IN ('status', 'retry_count', 'next_retry_at', 'last_error', 'last_attempt_at'))
        )
      ORDER BY table_name, column_name;
    `);
    
    console.log('\n✅ Column verification:');
    console.table(columnCheck.rows);
    
    // Check if plaid_account_mappings table exists
    const mappingsCheck = await client.query(`
      SELECT COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plaid_account_mappings';
    `);
    
    console.log(`\n✅ plaid_account_mappings has ${mappingsCheck.rows[0].column_count} columns`);
    
    console.log('\n✅ All Plaid columns and tables fixed successfully!');
    
    await client.end();
    
  } catch (error) {
    console.error('Error fixing Plaid columns:', error);
    await client.end();
    process.exit(1);
  }
}

async function main() {
  await client.connect();
  await fixPlaidColumns();
}

main();