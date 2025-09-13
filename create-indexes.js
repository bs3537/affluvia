import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function createIndexes() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
  const query = async (text, params) => {
    const client = await pool.connect();
    try { return (await client.query(text, params)).rows; } finally { client.release(); }
  };
  
  console.log('Creating database indexes for better performance...\n');
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_id ON financial_profiles(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id)', 
    'CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item_id ON plaid_accounts(item_id)',
    'CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_estate_plans_user_id ON estate_plans(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_widget_cache_user_id ON widget_cache(user_id)'
  ];
  
  for (const index of indexes) {
    try {
      await query(index);
      console.log('✅', index.match(/idx_\w+/)[0], 'created');
    } catch (error) {
      console.log('⚠️', index.match(/idx_\w+/)[0], 'already exists or failed:', error.message);
    }
  }
  
  console.log('\nChecking all indexes...');
  const existing = await query(`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    ORDER BY tablename, indexname
  `);
  
  console.log('\nExisting indexes:');
  existing.forEach(idx => {
    console.log(`  - ${idx.tablename}: ${idx.indexname}`);
  });
  
  await pool.end();
  process.exit(0);
}

createIndexes();
