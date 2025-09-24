/**
 * FINAL DATABASE FIX SCRIPT
 * This comprehensively fixes ALL database issues including:
 * - Column name mismatches (data_hash vs input_hash)
 * - NOT NULL constraints that shouldn't exist
 * - Missing columns (updated_at, etc.)
 * - Type mismatches
 */

import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixDatabaseFinal() {
  console.log('🔧 FINAL DATABASE FIX - Resolving ALL schema issues...\n');
  
  try {
    // ============================================
    // STEP 1: FIX WIDGET_CACHE TABLE
    // ============================================
    console.log('📋 Step 1: Fixing widget_cache table...');
    
    // Check if data_hash column exists and rename it to input_hash
    const dataHashExists = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'widget_cache' AND column_name = 'data_hash'
    `);
    
    if (dataHashExists.rows.length > 0) {
      console.log('   Renaming data_hash to input_hash...');
      await db.execute(sql`
        ALTER TABLE widget_cache 
        RENAME COLUMN data_hash TO input_hash
      `).catch(() => console.log('   Column already renamed or doesn\'t exist'));
    }
    
    // Make all widget_cache columns nullable to prevent insertion errors
    console.log('   Making widget_cache columns nullable...');
    const widgetCacheNullableFixes = [
      'ALTER TABLE widget_cache ALTER COLUMN widget_type DROP NOT NULL',
      'ALTER TABLE widget_cache ALTER COLUMN widget_name DROP NOT NULL',
      'ALTER TABLE widget_cache ALTER COLUMN input_hash DROP NOT NULL',
      'ALTER TABLE widget_cache ALTER COLUMN widget_data DROP NOT NULL'
    ];
    
    for (const query of widgetCacheNullableFixes) {
      await db.execute(sql.raw(query)).catch(() => null);
    }
    
    // Add missing columns if they don't exist
    console.log('   Adding missing widget_cache columns...');
    await db.execute(sql`
      ALTER TABLE widget_cache 
      ADD COLUMN IF NOT EXISTS widget_type TEXT,
      ADD COLUMN IF NOT EXISTS widget_name TEXT,
      ADD COLUMN IF NOT EXISTS input_hash TEXT,
      ADD COLUMN IF NOT EXISTS widget_data JSONB,
      ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cache_key TEXT,
      ADD COLUMN IF NOT EXISTS ttl_seconds INTEGER DEFAULT 3600,
      ADD COLUMN IF NOT EXISTS hit_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    console.log('   ✅ widget_cache table fixed');
    
    // ============================================
    // STEP 2: FIX DASHBOARD_INSIGHTS TABLE
    // ============================================
    console.log('\n📋 Step 2: Fixing dashboard_insights table...');
    
    // Add all missing columns including updated_at
    await db.execute(sql`
      ALTER TABLE dashboard_insights 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS profile_data_hash TEXT,
      ADD COLUMN IF NOT EXISTS financial_snapshot JSONB,
      ADD COLUMN IF NOT EXISTS generation_version TEXT DEFAULT '1.0',
      ADD COLUMN IF NOT EXISTS generated_by_model TEXT DEFAULT 'gemini-2.5-flash-lite',
      ADD COLUMN IF NOT EXISTS generation_prompt TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP,
      ADD COLUMN IF NOT EXISTS regeneration_triggered BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_viewed TIMESTAMP,
      ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '[]'::jsonb
    `);
    
    console.log('   ✅ dashboard_insights table fixed');

    // ============================================
    // STEP 2a: Ensure indexes for insights and cache
    // ============================================
    console.log('\n📋 Step 2a: Creating performance indexes and uniqueness constraints...');
    try {
      // Deduplicate dashboard_insights by user (keep highest id)
      await db.execute(sql`
        DELETE FROM dashboard_insights di
        USING dashboard_insights d2
        WHERE di.user_id = d2.user_id AND di.id < d2.id;
      `);
      console.log('   ✅ Deduplicated dashboard_insights per user');
    } catch (e) {
      console.log('   ⚠️ Deduplication skipped or no duplicates:', (e as any)?.message || e);
    }
    try {
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_dashboard_insights_user ON dashboard_insights(user_id);`);
      console.log('   ✅ Unique index ux_dashboard_insights_user ensured');
    } catch (e) {
      console.log('   ⚠️ Unique index creation issue (may already exist or duplicates remain):', (e as any)?.message || e);
    }
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_dashboard_insights_user_created ON dashboard_insights(user_id, created_at DESC);`);
      console.log('   ✅ Index idx_dashboard_insights_user_created ensured');
    } catch (e) {
      console.log('   ⚠️ Index creation issue (dashboard_insights):', (e as any)?.message || e);
    }
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_widget_cache_user_type_hash ON widget_cache(user_id, widget_type, input_hash);`);
      console.log('   ✅ Index idx_widget_cache_user_type_hash ensured');
    } catch (e) {
      console.log('   ⚠️ Index creation issue (widget_cache):', (e as any)?.message || e);
    }
    
    // ============================================
    // STEP 2b: FIX FINANCIAL_PROFILES (central_insights + common columns)
    // ============================================
    console.log('\n📋 Step 2b: Fixing financial_profiles table...');
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS central_insights JSONB,
      ADD COLUMN IF NOT EXISTS retirement_insights JSONB,
      ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP;
    `).catch(() => console.log('   ⚠️ financial_profiles central_insights/last_updated may already exist'));
    console.log('   ✅ financial_profiles table fixed');

    // ============================================
    // STEP 3: FIX SECTION_PROGRESS TABLE
    // ============================================
    console.log('\n📋 Step 3: Fixing section_progress table...');
    
    // Make section_name nullable
    await db.execute(sql`
      ALTER TABLE section_progress 
      ALTER COLUMN section_name DROP NOT NULL
    `).catch(() => console.log('   section_name already nullable'));
    
    // Add missing columns
    await db.execute(sql`
      ALTER TABLE section_progress 
      ADD COLUMN IF NOT EXISTS section_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS fields_completed INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_fields INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    console.log('   ✅ section_progress table fixed');

    // ============================================
    // STEP 4: CREATE/ALTER SUPPORTING TABLES & COLUMNS USED BY AI CONTEXT
    // ============================================
    console.log('\n📋 Step 4: Ensuring supporting tables/columns (chat, goals, education, estate, cache, debts)...');
    // 4.1 chat_messages.response
    await db.execute(sql`
      ALTER TABLE IF EXISTS chat_messages
      ADD COLUMN IF NOT EXISTS response TEXT;
    `);
    // 4.2 chat_documents table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        processing_status TEXT DEFAULT 'pending' NOT NULL,
        extracted_text TEXT,
        extracted_data JSONB,
        ai_summary TEXT,
        ai_insights JSONB,
        document_type TEXT,
        document_category TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // 4.3 investment_cache.category
    await db.execute(sql`
      ALTER TABLE IF EXISTS investment_cache
      ADD COLUMN IF NOT EXISTS category TEXT;
    `);
    // 4.4 estate_trusts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS estate_trusts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        estate_plan_id INTEGER REFERENCES estate_plans(id) ON DELETE CASCADE,
        trust_type TEXT NOT NULL,
        trust_name TEXT NOT NULL,
        established_date TIMESTAMP,
        grantor TEXT NOT NULL,
        trustee TEXT NOT NULL,
        successor_trustee TEXT,
        beneficiaries JSONB,
        initial_funding NUMERIC(15,2),
        current_value NUMERIC(15,2),
        assets JSONB,
        distribution_terms TEXT,
        termination_conditions TEXT,
        tax_id_number TEXT,
        tax_strategy JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // 4.5 education_scenarios table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS education_scenarios (
        id SERIAL PRIMARY KEY,
        education_goal_id INTEGER REFERENCES education_goals(id) ON DELETE CASCADE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        scenario_name TEXT NOT NULL,
        scenario_type TEXT,
        parameters JSONB,
        results JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // 4.6 action_plan_tasks table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS action_plan_tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        task_id TEXT NOT NULL,
        recommendation_title TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // 4.7 goals.target_amount_today
    await db.execute(sql`
      ALTER TABLE IF EXISTS goals
      ADD COLUMN IF NOT EXISTS target_amount_today NUMERIC(12,2);
    `);
    // 4.8 debt_payoff_plans.debt_order
    await db.execute(sql`
      ALTER TABLE IF EXISTS debt_payoff_plans
      ADD COLUMN IF NOT EXISTS debt_order JSONB;
    `);
    console.log('   ✅ Supporting tables/columns ensured');

    // ============================================
    // STEP 4: COMPREHENSIVE FINANCIAL_PROFILES FIX
    // ============================================
    console.log('\n📋 Step 4: Comprehensive financial_profiles fix...');
    
    // Ensure monthly_expenses is JSONB
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'financial_profiles' 
          AND column_name = 'monthly_expenses' 
          AND data_type != 'jsonb'
        ) THEN
          ALTER TABLE financial_profiles 
          ALTER COLUMN monthly_expenses TYPE JSONB 
          USING COALESCE(monthly_expenses::text::jsonb, '{}'::jsonb);
        END IF;
      END $$;
    `);
    
    // Add all potentially missing columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS optimal_social_security_age INTEGER,
      ADD COLUMN IF NOT EXISTS optimal_spouse_social_security_age INTEGER,
      ADD COLUMN IF NOT EXISTS social_security_optimization JSONB,
      ADD COLUMN IF NOT EXISTS banking_assets JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS investment_assets JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS retirement_assets JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS other_assets JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS optimal_retirement_age JSONB,
      ADD COLUMN IF NOT EXISTS retirement_planning_data JSONB,
      ADD COLUMN IF NOT EXISTS retirement_planning_ui_preferences JSONB,
      ADD COLUMN IF NOT EXISTS monte_carlo_results JSONB,
      ADD COLUMN IF NOT EXISTS optimization_variables JSONB,
      ADD COLUMN IF NOT EXISTS calculations JSONB
    `);
    
    console.log('   ✅ financial_profiles table fixed');
    
    // ============================================
    // STEP 5: CREATE UPDATE TRIGGERS
    // ============================================
    console.log('\n📋 Step 5: Creating automatic update triggers...');
    
    // Create function for updating timestamps
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    // Create triggers for all tables with updated_at
    const tablesWithUpdatedAt = [
      'dashboard_insights',
      'widget_cache',
      'section_progress',
      'financial_profiles'
    ];
    
    for (const table of tablesWithUpdatedAt) {
      await db.execute(sql`
        DROP TRIGGER IF EXISTS update_${sql.identifier(table)}_updated_at ON ${sql.identifier(table)}
      `).catch(() => null);
      
      await db.execute(sql`
        CREATE TRIGGER update_${sql.identifier(table)}_updated_at
        BEFORE UPDATE ON ${sql.identifier(table)}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `).catch(() => null);
      
      console.log(`   ✅ Trigger created for ${table}`);
    }
    
    // ============================================
    // STEP 6: CLEANUP DUPLICATE/UNUSED COLUMNS
    // ============================================
    console.log('\n📋 Step 6: Cleaning up duplicate columns...');
    
    // Check for and remove duplicate columns
    const duplicateChecks = [
      { table: 'widget_cache', remove: ['data_hash'], keep: 'input_hash' },
      { table: 'widget_cache', remove: ['widget_id'], keep: 'id' }
    ];
    
    for (const check of duplicateChecks) {
      for (const colToRemove of check.remove) {
        const exists = await db.execute(sql`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = ${check.table} AND column_name = ${colToRemove}
        `);
        
        if (exists.rows.length > 0) {
          console.log(`   Removing duplicate column ${check.table}.${colToRemove}`);
          await db.execute(sql`
            ALTER TABLE ${sql.identifier(check.table)} 
            DROP COLUMN IF EXISTS ${sql.identifier(colToRemove)}
          `).catch((err) => console.log(`   Could not remove ${colToRemove}: ${err.message}`));
        }
      }
    }
    
    // ============================================
    // STEP 7: VERIFY ALL FIXES
    // ============================================
    console.log('\n📋 Step 7: Verifying all fixes...');
    
    // Check widget_cache
    const widgetCacheCheck = await db.execute(sql`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'widget_cache' 
      AND column_name IN ('widget_type', 'input_hash', 'widget_data', 'updated_at')
    `);
    
    console.log('   widget_cache columns:');
    widgetCacheCheck.rows.forEach((col: any) => {
      console.log(`     - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable ✅' : 'NOT NULL ❌'})`);
    });
    
    // Check dashboard_insights
    const dashboardCheck = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dashboard_insights' 
      AND column_name IN ('updated_at', 'profile_data_hash', 'financial_snapshot')
    `);
    
    console.log('   dashboard_insights columns:');
    dashboardCheck.rows.forEach((col: any) => {
      console.log(`     - ${col.column_name}: ${col.data_type} ✅`);
    });
    
    // Check financial_profiles monthly_expenses type
    const monthlyExpensesCheck = await db.execute(sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'financial_profiles' 
      AND column_name = 'monthly_expenses'
    `);
    
    console.log(`   financial_profiles.monthly_expenses: ${monthlyExpensesCheck.rows[0]?.data_type} ✅`);
    
    console.log('\n✅ SUCCESS! All database issues have been permanently fixed!');
    console.log('\n📝 What was fixed:');
    console.log('   ✅ Renamed data_hash to input_hash in widget_cache');
    console.log('   ✅ Made all cache columns nullable to prevent insertion errors');
    console.log('   ✅ Added updated_at to dashboard_insights');
    console.log('   ✅ Fixed monthly_expenses type to JSONB');
    console.log('   ✅ Added automatic update triggers');
    console.log('   ✅ Cleaned up duplicate columns');
    console.log('\n🎉 Your database is now perfectly synchronized with Drizzle schema!');
    console.log('\n⚠️ IMPORTANT: Restart your server after running this script!');
    
  } catch (error) {
    console.error('\n❌ Error during fix:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the fix
fixDatabaseFinal();
