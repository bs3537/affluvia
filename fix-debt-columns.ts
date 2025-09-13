import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function fixDebtPayoffPlansTable() {
  
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

  
  try {
    // Check if columns exist and add them if they don't
    await pool.query(`
      DO $$ 
      BEGIN
          -- Check if strategy_config column exists
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'debt_payoff_plans' 
                         AND column_name = 'strategy_config') THEN
              ALTER TABLE debt_payoff_plans ADD COLUMN strategy_config jsonb;
          END IF;
          
          -- Check if auto_pay_enabled column exists
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'debt_payoff_plans' 
                         AND column_name = 'auto_pay_enabled') THEN
              ALTER TABLE debt_payoff_plans ADD COLUMN auto_pay_enabled boolean DEFAULT false;
          END IF;
      END $$;
    `);
    
    console.log('✅ Successfully added missing columns to debt_payoff_plans table');
    
    // Verify columns exist
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'debt_payoff_plans'
      AND column_name IN ('strategy_config', 'auto_pay_enabled')
      ORDER BY ordinal_position
    `);
    
    console.log('Verified columns:', columns);
  await pool.end();
  } catch (error) {
    console.error('Error fixing table:', error);
  }
}

fixDebtPayoffPlansTable();