import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixRemainingColumns() {
  console.log('Adding remaining missing columns...');
  
  try {
    // 1. Add generation_prompt column to dashboard_insights
    console.log('Adding generation_prompt to dashboard_insights...');
    await db.execute(sql`
      ALTER TABLE dashboard_insights 
      ADD COLUMN IF NOT EXISTS generation_prompt TEXT
    `);
    
    // 2. Add widget_data column to widget_cache
    console.log('Adding widget_data to widget_cache...');
    await db.execute(sql`
      ALTER TABLE widget_cache 
      ADD COLUMN IF NOT EXISTS widget_data JSONB
    `);
    
    // Copy data from cached_data to widget_data if needed
    await db.execute(sql`
      UPDATE widget_cache 
      SET widget_data = cached_data 
      WHERE widget_data IS NULL AND cached_data IS NOT NULL
    `);
    
    console.log('✅ All remaining columns added successfully!');
    
    // Verify columns
    const dashboardCols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dashboard_insights'
      ORDER BY ordinal_position
    `);
    
    const widgetCols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'widget_cache'
      ORDER BY ordinal_position
    `);
    
    console.log('\nDashboard insights columns:');
    dashboardCols.rows.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });
    
    console.log('\nWidget cache columns:');
    widgetCols.rows.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });
    
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixRemainingColumns();