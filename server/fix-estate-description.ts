import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixEstateDescription() {
  console.log('Adding description column to estate_documents...');
  
  try {
    await db.execute(sql`
      ALTER TABLE estate_documents 
      ADD COLUMN IF NOT EXISTS description TEXT
    `);
    
    console.log('✅ description column added successfully!');
    
    // Verify all columns exist
    const cols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'estate_documents'
      ORDER BY ordinal_position
    `);
    
    console.log('\nEstate documents columns:');
    cols.rows.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });
    
  } catch (error) {
    console.error('Error adding description column:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixEstateDescription();