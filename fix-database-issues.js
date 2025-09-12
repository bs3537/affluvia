import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;
dotenv.config();

async function fixDatabaseIssues() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2, // Use minimal connections
    connectionTimeoutMillis: 30000 // 30 seconds
  });

  try {
    console.log('🔧 Starting database fixes...\n');
    
    // 1. Fix missing primary_category column
    console.log('1. Adding missing primary_category column to plaid_transactions...');
    try {
      await pool.query(`
        ALTER TABLE plaid_transactions 
        ADD COLUMN IF NOT EXISTS primary_category TEXT;
      `);
      console.log('✅ primary_category column added\n');
    } catch (err) {
      console.log('⚠️  Column may already exist:', err.message, '\n');
    }

    // 2. Fix plaid_aggregated_snapshot missing columns
    console.log('2. Fixing plaid_aggregated_snapshot table...');
    await pool.query(`
      -- Add missing debt columns
      ALTER TABLE plaid_aggregated_snapshot 
      ADD COLUMN IF NOT EXISTS credit_card_debt DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS student_loans DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS personal_loans DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS mortgage_debt DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS auto_loans DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS other_debt DECIMAL(15, 2);

      -- Add missing income columns
      ALTER TABLE plaid_aggregated_snapshot
      ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS annual_income DECIMAL(15, 2);

      -- Add missing metadata columns
      ALTER TABLE plaid_aggregated_snapshot
      ADD COLUMN IF NOT EXISTS accounts_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_sync_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false;
    `);
    console.log('✅ plaid_aggregated_snapshot table fixed\n');

    // 3. Kill idle connections to free up pool
    console.log('3. Cleaning up idle database connections...');
    const result = await pool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'idle'
        AND state_change < current_timestamp - interval '10 minutes';
    `);
    console.log(`✅ Terminated ${result.rowCount} idle connections\n`);

    // 4. Analyze tables for better performance
    console.log('4. Analyzing tables for better query performance...');
    await pool.query('ANALYZE financial_profiles;');
    await pool.query('ANALYZE plaid_accounts;');
    await pool.query('ANALYZE plaid_transactions;');
    console.log('✅ Tables analyzed\n');

    // 5. Create missing indexes
    console.log('5. Creating performance indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_plaid_transactions_category 
      ON plaid_transactions(primary_category);
      
      CREATE INDEX IF NOT EXISTS idx_plaid_snapshot_user_date 
      ON plaid_aggregated_snapshot(user_id, snapshot_date DESC);
      
      CREATE INDEX IF NOT EXISTS idx_financial_profiles_user 
      ON financial_profiles(user_id);
    `);
    console.log('✅ Indexes created\n');

    console.log('🎉 All database fixes completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixDatabaseIssues();