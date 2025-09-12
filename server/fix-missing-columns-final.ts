import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixMissingColumnsFinal() {
  console.log('Adding missing columns to tables...');
  
  try {
    // 1. Add insights column to dashboard_insights table
    console.log('Adding insights column to dashboard_insights...');
    await db.execute(sql`
      ALTER TABLE dashboard_insights 
      ADD COLUMN IF NOT EXISTS insights JSONB
    `);
    
    // 2. Add widget_type column to widget_cache table (or rename widget_name to widget_type)
    console.log('Adding widget_type column to widget_cache...');
    
    // First check if widget_type exists
    const widgetTypeExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'widget_cache' 
      AND column_name = 'widget_type'
    `);
    
    if (widgetTypeExists.rows.length === 0) {
      // Add widget_type column
      await db.execute(sql`
        ALTER TABLE widget_cache 
        ADD COLUMN IF NOT EXISTS widget_type TEXT
      `);
      
      // Copy data from widget_name to widget_type if needed
      await db.execute(sql`
        UPDATE widget_cache 
        SET widget_type = widget_name 
        WHERE widget_type IS NULL
      `);
    }
    
    console.log('✅ All missing columns added successfully!');
    
    // Verify columns exist
    const dashboardCols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dashboard_insights'
      AND column_name = 'insights'
    `);
    
    const widgetCols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'widget_cache'
      AND column_name IN ('widget_type', 'widget_name')
      ORDER BY column_name
    `);
    
    console.log('\nVerification:');
    console.log('- dashboard_insights.insights exists:', dashboardCols.rows.length > 0);
    console.log('- widget_cache columns:');
    widgetCols.rows.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });
    
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixMissingColumnsFinal();