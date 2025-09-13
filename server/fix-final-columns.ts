import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixFinalColumns() {
  console.log('Adding final missing columns...');
  
  try {
    // Add expiration_date to estate_documents
    await db.execute(sql`
      ALTER TABLE estate_documents 
      ADD COLUMN IF NOT EXISTS expiration_date DATE
    `);
    
    console.log('✅ All columns added successfully!');
    
    // Final verification
    const cols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'estate_documents'
      ORDER BY ordinal_position
    `);
    
    console.log('\nFinal estate_documents columns:');
    cols.rows.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });
    
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixFinalColumns();