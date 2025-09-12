import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixEstateReviewDate() {
  console.log('Fixing estate_documents last_review_date column...');
  
  try {
    // Add the missing last_review_date column
    await db.execute(sql`
      ALTER TABLE estate_documents 
      ADD COLUMN IF NOT EXISTS last_review_date TIMESTAMP
    `);
    
    // Migrate data from last_reviewed to last_review_date if needed
    await db.execute(sql`
      UPDATE estate_documents 
      SET last_review_date = last_reviewed::timestamp 
      WHERE last_reviewed IS NOT NULL AND last_review_date IS NULL
    `);
    
    // Add other missing columns from the schema
    await db.execute(sql`
      ALTER TABLE estate_documents 
      ADD COLUMN IF NOT EXISTS prepared_by TEXT,
      ADD COLUMN IF NOT EXISTS witnesses JSONB,
      ADD COLUMN IF NOT EXISTS notarized BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS for_spouse BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS storage_location TEXT,
      ADD COLUMN IF NOT EXISTS document_url TEXT,
      ADD COLUMN IF NOT EXISTS parsed_insights JSONB,
      ADD COLUMN IF NOT EXISTS review_reminder_days INTEGER DEFAULT 365,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    console.log('✅ estate_documents table structure fixed!');
    
    // Verify all columns
    const cols = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'estate_documents'
      ORDER BY ordinal_position
    `);
    
    console.log('\nFinal estate_documents columns:');
    cols.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Error fixing estate_documents:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixEstateReviewDate();