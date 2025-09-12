import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixMissingTables() {
  console.log('Creating missing tables...');
  
  try {
    // 1. Create dashboard_insights table
    console.log('Creating dashboard_insights table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS dashboard_insights (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        
        -- Insight categories
        financial_health_insights JSONB,
        retirement_insights JSONB,
        tax_insights JSONB,
        investment_insights JSONB,
        estate_planning_insights JSONB,
        risk_management_insights JSONB,
        cash_flow_insights JSONB,
        debt_insights JSONB,
        
        -- Aggregated insights
        top_priorities JSONB,
        action_items JSONB,
        opportunities JSONB,
        warnings JSONB,
        
        -- AI-generated comprehensive analysis
        ai_analysis TEXT,
        ai_recommendations JSONB,
        
        -- Metadata
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id)
      )
    `);
    
    // Create indexes for dashboard_insights
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_dashboard_insights_user_id 
      ON dashboard_insights(user_id)
    `);
    
    // 2. Create widget_cache table
    console.log('Creating widget_cache table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS widget_cache (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        widget_name TEXT NOT NULL,
        data_hash TEXT NOT NULL,
        cached_data JSONB,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Unique constraint to ensure one cache entry per widget per user
        UNIQUE(user_id, widget_name)
      )
    `);
    
    // Create indexes for widget_cache
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_widget_cache_user_id 
      ON widget_cache(user_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_widget_cache_widget_name 
      ON widget_cache(widget_name)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_widget_cache_expires_at 
      ON widget_cache(expires_at)
    `);
    
    console.log('✅ All missing tables created successfully!');
    
    // Verify tables were created
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('dashboard_insights', 'widget_cache')
      AND table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\nCreated tables:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixMissingTables();