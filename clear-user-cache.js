import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function clearUserCache() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    console.log('Clearing large cached data for user 18...');
    
    const result = await pool.query(`
      UPDATE financial_profiles 
      SET 
        monte_carlo_simulation = NULL,
        net_worth_projections = NULL,
        last_stress_test_results = NULL,
        retirement_planning_data = NULL,
        calculations = NULL
      WHERE user_id = $1
      RETURNING user_id
    `,[18]);
    
    if (result.rows.length > 0) {
      console.log('✅ Successfully cleared cached data for user 18');
      console.log('Affected user ID:', result.rows[0].user_id);
    } else {
      console.log('⚠️ No user found with ID 18');
    }
    
    // Check the size of remaining data
    console.log('\nChecking remaining data size...');
    const sizeCheck = await pool.query(`
      SELECT 
        user_id,
        pg_column_size(assets) as assets_size,
        pg_column_size(liabilities) as liabilities_size,
        pg_column_size(monthly_expenses) as expenses_size,
        pg_column_size(goals) as goals_size
      FROM financial_profiles 
      WHERE user_id = $1
    `,[18]);
    
    if (sizeCheck.rows.length > 0) {
      console.log('Remaining field sizes (in bytes):');
      console.log('- Assets:', sizeCheck.rows[0].assets_size || 0);
      console.log('- Liabilities:', sizeCheck.rows[0].liabilities_size || 0);
      console.log('- Monthly Expenses:', sizeCheck.rows[0].expenses_size || 0);
      console.log('- Goals:', sizeCheck.rows[0].goals_size || 0);
    }
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
  
  await pool.end();
  process.exit(0);
}

clearUserCache();
