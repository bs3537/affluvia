import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    console.log('Fixing missing columns causing console DB errors...');

    // 1) Ensure plaid_account_id exists on key Plaid tables
    await client.query(`
      ALTER TABLE IF EXISTS plaid_liabilities
        ADD COLUMN IF NOT EXISTS plaid_account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_plaid_liabilities_plaid_account_id ON plaid_liabilities(plaid_account_id);
    `);
    console.log('✓ plaid_liabilities.plaid_account_id ensured');

    await client.query(`
      ALTER TABLE IF EXISTS plaid_investment_holdings
        ADD COLUMN IF NOT EXISTS plaid_account_id INTEGER REFERENCES plaid_accounts(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_plaid_investment_holdings_plaid_account_id ON plaid_investment_holdings(plaid_account_id);
    `);
    console.log('✓ plaid_investment_holdings.plaid_account_id ensured');

    // 2) Ensure aggregated snapshot columns exist
    await client.query(`
      ALTER TABLE IF EXISTS plaid_aggregated_snapshot
        ADD COLUMN IF NOT EXISTS education_funds DECIMAL(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS emergency_funds DECIMAL(15,2) DEFAULT 0;
    `);
    console.log('✓ plaid_aggregated_snapshot.education_funds/emergency_funds ensured');

    // 3) Ensure debts table has columns expected by app code
    await client.query(`
      ALTER TABLE IF EXISTS debts
        ADD COLUMN IF NOT EXISTS debt_name TEXT,
        ADD COLUMN IF NOT EXISTS debt_type TEXT,
        ADD COLUMN IF NOT EXISTS original_balance DECIMAL(12,2),
        ADD COLUMN IF NOT EXISTS current_balance DECIMAL(12,2),
        ADD COLUMN IF NOT EXISTS annual_interest_rate DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS minimum_payment DECIMAL(12,2),
        ADD COLUMN IF NOT EXISTS payment_due_date INTEGER,
        ADD COLUMN IF NOT EXISTS owner TEXT,
        ADD COLUMN IF NOT EXISTS lender TEXT,
        ADD COLUMN IF NOT EXISTS account_number TEXT;
    `);
    console.log('✓ debts table columns ensured');

    // 4) Ensure financial_profiles has optimal SS columns used by code
    await client.query(`
      ALTER TABLE IF EXISTS financial_profiles
        ADD COLUMN IF NOT EXISTS optimal_social_security_age INTEGER,
        ADD COLUMN IF NOT EXISTS optimal_spouse_social_security_age INTEGER,
        ADD COLUMN IF NOT EXISTS social_security_optimization JSONB;
    `);
    console.log('✓ financial_profiles optimal SS columns ensured');

    console.log('\n✅ All targeted DB fixes applied successfully.');
  } catch (err) {
    console.error('❌ Error applying DB fixes:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
