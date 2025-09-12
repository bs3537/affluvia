import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixFinalMissingColumns() {
  console.log('Adding final missing columns...');
  
  try {
    // 1. Add generated_by_model column to dashboard_insights
    console.log('Adding generated_by_model to dashboard_insights...');
    await db.execute(sql`
      ALTER TABLE dashboard_insights 
      ADD COLUMN IF NOT EXISTS generated_by_model TEXT DEFAULT 'gemini-1.5-flash'
    `);
    
    // 2. Add input_hash column to widget_cache
    console.log('Adding input_hash to widget_cache...');
    await db.execute(sql`
      ALTER TABLE widget_cache 
      ADD COLUMN IF NOT EXISTS input_hash TEXT
    `);
    
    // Update existing rows to have input_hash from data_hash if needed
    await db.execute(sql`
      UPDATE widget_cache 
      SET input_hash = data_hash 
      WHERE input_hash IS NULL AND data_hash IS NOT NULL
    `);
    
    console.log('✅ All final missing columns added successfully!');
    
    // Verify columns
    const dashboardCols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dashboard_insights'
      AND column_name = 'generated_by_model'
    `);
    
    const widgetCols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'widget_cache'
      AND column_name = 'input_hash'
    `);
    
    console.log('\nVerification:');
    console.log('- dashboard_insights.generated_by_model exists:', dashboardCols.rows.length > 0);
    console.log('- widget_cache.input_hash exists:', widgetCols.rows.length > 0);
    
    // Show all columns for widget_cache to understand the structure
    const allWidgetCols = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'widget_cache'
      ORDER BY ordinal_position
    `);
    
    console.log('\nAll widget_cache columns:');
    allWidgetCols.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixFinalMissingColumns();