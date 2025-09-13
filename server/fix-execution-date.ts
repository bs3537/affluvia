import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixExecutionDate() {
  console.log('Adding execution_date column to estate_documents...');
  
  try {
    await db.execute(sql`
      ALTER TABLE estate_documents 
      ADD COLUMN IF NOT EXISTS execution_date DATE
    `);
    
    console.log('✅ execution_date column added successfully!');
    
  } catch (error) {
    console.error('Error adding execution_date column:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixExecutionDate();