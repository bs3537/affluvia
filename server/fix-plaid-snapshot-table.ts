import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixPlaidSnapshotTable() {
  console.log('Creating plaid_aggregated_snapshot table...');
  
  try {
    // Create plaid_aggregated_snapshot table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plaid_aggregated_snapshot (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Asset totals
        total_cash DECIMAL(15, 2) DEFAULT 0,
        total_investments DECIMAL(15, 2) DEFAULT 0,
        total_retirement DECIMAL(15, 2) DEFAULT 0,
        total_real_estate DECIMAL(15, 2) DEFAULT 0,
        total_other_assets DECIMAL(15, 2) DEFAULT 0,
        total_assets DECIMAL(15, 2) DEFAULT 0,
        
        -- Liability totals
        total_credit_cards DECIMAL(15, 2) DEFAULT 0,
        total_mortgages DECIMAL(15, 2) DEFAULT 0,
        total_loans DECIMAL(15, 2) DEFAULT 0,
        total_other_liabilities DECIMAL(15, 2) DEFAULT 0,
        total_liabilities DECIMAL(15, 2) DEFAULT 0,
        
        -- Net worth
        net_worth DECIMAL(15, 2) DEFAULT 0,
        
        -- Account details
        accounts_data JSONB,
        
        -- Income & Expenses (from transactions)
        monthly_income DECIMAL(12, 2),
        monthly_expenses DECIMAL(12, 2),
        monthly_cash_flow DECIMAL(12, 2),
        
        -- Categorized expenses
        expenses_by_category JSONB,
        
        -- Investment allocation
        investment_allocation JSONB,
        
        -- Metadata
        plaid_items_count INTEGER DEFAULT 0,
        accounts_count INTEGER DEFAULT 0,
        last_sync_timestamp TIMESTAMP,
        is_complete BOOLEAN DEFAULT false,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Ensure only one latest snapshot per user
        UNIQUE(user_id, snapshot_date)
      )
    `);
    
    // Create indexes for better performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_plaid_snapshot_user_id 
      ON plaid_aggregated_snapshot(user_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_plaid_snapshot_date 
      ON plaid_aggregated_snapshot(snapshot_date DESC)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_plaid_snapshot_user_date 
      ON plaid_aggregated_snapshot(user_id, snapshot_date DESC)
    `);
    
    console.log('✅ plaid_aggregated_snapshot table created successfully!');
    
    // Verify the table was created
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'plaid_aggregated_snapshot'
      ) as exists
    `);
    
    console.log('Table exists:', tableExists.rows[0].exists);
    
    // Show table structure
    const cols = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'plaid_aggregated_snapshot'
      ORDER BY ordinal_position
      LIMIT 10
    `);
    
    console.log('\nFirst 10 columns of plaid_aggregated_snapshot:');
    cols.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Error creating plaid_aggregated_snapshot table:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixPlaidSnapshotTable();