import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixMissingColumns() {
  console.log('Adding missing database columns...');
  
  try {
    // Add missing columns to financial_profiles
    console.log('Adding missing columns to financial_profiles...');
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS spouse_name TEXT,
      ADD COLUMN IF NOT EXISTS spouse_date_of_birth TEXT,
      ADD COLUMN IF NOT EXISTS spouse_first_name TEXT,
      ADD COLUMN IF NOT EXISTS spouse_last_name TEXT,
      ADD COLUMN IF NOT EXISTS state TEXT
    `);
    
    // Check if section_progress table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'section_progress'
      ) as exists
    `);
    
    if (tableExists.rows[0].exists) {
      // Table exists, add column if missing
      console.log('section_progress table exists, adding section column if missing...');
      
      // First drop any unique constraint that might prevent adding the column
      await db.execute(sql`
        ALTER TABLE section_progress 
        DROP CONSTRAINT IF EXISTS section_progress_user_id_section_key
      `).catch(() => {});
      
      // Add all missing columns
      await db.execute(sql`
        ALTER TABLE section_progress 
        ADD COLUMN IF NOT EXISTS section TEXT,
        ADD COLUMN IF NOT EXISTS visits INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS actions_completed INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_visit TIMESTAMP DEFAULT now(),
        ADD COLUMN IF NOT EXISTS completion_percentage NUMERIC(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now()
      `);
      
      // Update any NULL values to a default
      await db.execute(sql`
        UPDATE section_progress 
        SET section = 'general' 
        WHERE section IS NULL
      `);
      
      // Make section NOT NULL after setting defaults
      await db.execute(sql`
        ALTER TABLE section_progress 
        ALTER COLUMN section SET NOT NULL
      `).catch(() => {});
      
    } else {
      // Create the table
      console.log('Creating section_progress table...');
      await db.execute(sql`
        CREATE TABLE section_progress (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          section TEXT NOT NULL,
          visits INTEGER DEFAULT 0,
          time_spent INTEGER DEFAULT 0,
          actions_completed INTEGER DEFAULT 0,
          last_visit TIMESTAMP DEFAULT now(),
          completion_percentage NUMERIC(5,2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT now(),
          UNIQUE(user_id, section)
        )
      `);
    }
    
    // Add missing columns to plaid_sync_status
    console.log('Adding missing columns to plaid_sync_status...');
    await db.execute(sql`
      ALTER TABLE plaid_sync_status 
      ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS notify_on_sync BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS notify_on_large_changes BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS large_change_threshold DECIMAL(12, 2) DEFAULT 10000,
      ADD COLUMN IF NOT EXISTS sync_frequency TEXT DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS next_sync_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_full_sync TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_partial_sync TIMESTAMP,
      ADD COLUMN IF NOT EXISTS sync_transactions BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS sync_investments BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS sync_liabilities BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS transaction_days_to_sync INTEGER DEFAULT 30,
      ADD COLUMN IF NOT EXISTS manual_syncs_today INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS manual_sync_reset_date DATE
    `);
    
    console.log('✅ All missing columns added successfully!');
    
    // Verify columns exist
    const spouseNameCols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'financial_profiles' 
      AND column_name = 'spouse_name'
    `);
    console.log('spouse_name column exists:', spouseNameCols.rows.length > 0);
    
    const spouseDobCols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'financial_profiles' 
      AND column_name = 'spouse_date_of_birth'
    `);
    console.log('spouse_date_of_birth column exists:', spouseDobCols.rows.length > 0);
    
    const sectionCols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'section_progress' 
      AND column_name = 'section'
    `);
    console.log('section column exists:', sectionCols.rows.length > 0);
    
    const visitsCols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'section_progress' 
      AND column_name = 'visits'
    `);
    console.log('visits column exists:', visitsCols.rows.length > 0);
    
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixMissingColumns();