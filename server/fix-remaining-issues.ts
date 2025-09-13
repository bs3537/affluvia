import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixRemainingIssues() {
  console.log('Fixing remaining database issues...');
  
  try {
    // 1. Add estate_plan_id to estate_documents table
    console.log('Adding estate_plan_id column to estate_documents...');
    await db.execute(sql`
      ALTER TABLE estate_documents 
      ADD COLUMN IF NOT EXISTS estate_plan_id INTEGER
    `);
    
    // 2. Create plaid_sync_recovery table
    console.log('Creating plaid_sync_recovery table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plaid_sync_recovery (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        plaid_item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
        error_code TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        next_retry TIMESTAMP,
        resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add indexes for plaid_sync_recovery
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_plaid_sync_recovery_user_id ON plaid_sync_recovery(user_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_plaid_sync_recovery_resolved ON plaid_sync_recovery(resolved)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_plaid_sync_recovery_next_retry ON plaid_sync_recovery(next_retry)
    `);
    
    // 3. Fix plaid_accounts table - make item_id nullable since it's being set to null
    console.log('Making item_id nullable in plaid_accounts...');
    await db.execute(sql`
      ALTER TABLE plaid_accounts 
      ALTER COLUMN item_id DROP NOT NULL
    `);
    
    // 4. Add any other missing columns that might be needed
    console.log('Adding additional columns that might be missing...');
    
    // Add to plaid_items if missing
    await db.execute(sql`
      ALTER TABLE plaid_items 
      ADD COLUMN IF NOT EXISTS last_successful_update TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_failed_update TIMESTAMP,
      ADD COLUMN IF NOT EXISTS consent_expiration_time TIMESTAMP
    `);
    
    // Add to plaid_accounts if missing
    await db.execute(sql`
      ALTER TABLE plaid_accounts 
      ADD COLUMN IF NOT EXISTS balances JSONB,
      ADD COLUMN IF NOT EXISTS owners JSONB
    `);
    
    // Verify estate_documents table structure
    const estateCols = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'estate_documents'
      ORDER BY ordinal_position
    `);
    
    console.log('\nEstate documents columns:');
    estateCols.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Verify plaid_sync_recovery table was created
    const syncRecoveryExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'plaid_sync_recovery'
      ) as exists
    `);
    
    console.log('\nplaid_sync_recovery table exists:', syncRecoveryExists.rows[0].exists);
    
    // Check plaid_accounts constraints
    const accountConstraints = await db.execute(sql`
      SELECT 
        column_name,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'plaid_accounts'
      AND column_name = 'item_id'
    `);
    
    if (accountConstraints.rows.length > 0) {
      console.log('\nitem_id column in plaid_accounts:');
      console.log('  - is_nullable:', accountConstraints.rows[0].is_nullable);
    }
    
    console.log('\n✅ All remaining issues fixed successfully!');
    
  } catch (error) {
    console.error('Error fixing remaining issues:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixRemainingIssues();