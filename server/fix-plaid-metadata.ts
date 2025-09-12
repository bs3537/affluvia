import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixPlaidMetadata() {
  console.log('Adding metadata column to plaid_accounts...');
  
  try {
    // Add metadata column to plaid_accounts
    await db.execute(sql`
      ALTER TABLE plaid_accounts 
      ADD COLUMN IF NOT EXISTS metadata JSONB
    `);
    
    console.log('✅ metadata column added successfully!');
    
    // Verify the column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'plaid_accounts' 
      AND column_name = 'metadata'
    `);
    
    console.log('metadata column exists:', result.rows.length > 0);
    
  } catch (error) {
    console.error('Error adding metadata column:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixPlaidMetadata();