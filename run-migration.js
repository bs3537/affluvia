import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;
dotenv.config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Running migration to fix missing columns...');
    
    const migrationSQL = `
      -- Add missing columns to plaid_aggregated_snapshot table
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

      -- Create index for faster queries
      CREATE INDEX IF NOT EXISTS idx_plaid_snapshot_user_date 
      ON plaid_aggregated_snapshot(user_id, snapshot_date DESC);
    `;

    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();