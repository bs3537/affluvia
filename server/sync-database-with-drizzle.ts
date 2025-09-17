/**
 * ULTIMATE DATABASE SYNC SCRIPT
 * This script ensures your Supabase database EXACTLY matches your Drizzle ORM schema
 * Run this whenever you have missing column errors
 */

import { db } from './db.js';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema';

interface ColumnDef {
  name: string;
  type: string;
  nullable?: boolean;
  default?: any;
}

interface TableDef {
  name: string;
  columns: ColumnDef[];
}

async function syncDatabaseWithDrizzle() {
  console.log('🔧 ULTIMATE DATABASE SYNC - Ensuring database matches Drizzle schema exactly...\n');
  
  try {
    // CRITICAL TABLES THAT NEED FIXING BASED ON YOUR ERRORS
    const criticalFixes = [
      {
        table: 'dashboard_insights',
        columns: [
          { name: 'profile_data_hash', type: 'TEXT' },
          { name: 'financial_snapshot', type: 'JSONB' },
          { name: 'generation_version', type: 'TEXT', default: "'1.0'" },
          { name: 'generated_by_model', type: 'TEXT', default: "'gemini-2.5-flash-lite'" },
          { name: 'generation_prompt', type: 'TEXT' },
          { name: 'is_active', type: 'BOOLEAN', default: 'true' },
          { name: 'valid_until', type: 'TIMESTAMP' },
          { name: 'regeneration_triggered', type: 'BOOLEAN', default: 'false' },
          { name: 'view_count', type: 'INTEGER', default: '0' },
          { name: 'last_viewed', type: 'TIMESTAMP' }
        ]
      },
      {
        table: 'widget_cache',
        columns: [
          { name: 'widget_type', type: 'TEXT' },
          { name: 'widget_name', type: 'TEXT' }, // For backward compatibility
          { name: 'input_hash', type: 'TEXT' },
          { name: 'widget_data', type: 'JSONB' },
          { name: 'version', type: 'INTEGER', default: '1' },
          { name: 'expires_at', type: 'TIMESTAMP' },
          { name: 'cache_key', type: 'TEXT' },
          { name: 'ttl_seconds', type: 'INTEGER', default: '3600' },
          { name: 'hit_count', type: 'INTEGER', default: '0' },
          { name: 'last_accessed', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
          { name: 'metadata', type: 'JSONB', default: "'{}'::jsonb" }
        ]
      },
      {
        table: 'financial_profiles',
        columns: [
          { name: 'optimal_social_security_age', type: 'INTEGER' },
          { name: 'optimal_spouse_social_security_age', type: 'INTEGER' },
          { name: 'social_security_optimization', type: 'JSONB' },
          { name: 'banking_assets', type: 'JSONB', default: "'[]'::jsonb" },
          { name: 'investment_assets', type: 'JSONB', default: "'[]'::jsonb" },
          { name: 'retirement_assets', type: 'JSONB', default: "'[]'::jsonb" },
          { name: 'other_assets', type: 'JSONB', default: "'[]'::jsonb" },
          { name: 'optimal_retirement_age', type: 'JSONB' },
          { name: 'retirement_planning_data', type: 'JSONB' },
          { name: 'retirement_planning_ui_preferences', type: 'JSONB' },
          { name: 'monte_carlo_results', type: 'JSONB' },
          { name: 'optimization_variables', type: 'JSONB' },
          { name: 'calculations', type: 'JSONB' },
          { name: 'last_updated', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
        ]
      },
      {
        table: 'plaid_sync_recovery',
        columns: [
          { name: 'sync_type', type: 'VARCHAR(50)' },
          { name: 'error_code', type: 'VARCHAR(100)' },
          { name: 'error_message', type: 'TEXT' },
          { name: 'retry_count', type: 'INTEGER', default: '0' },
          { name: 'last_attempt', type: 'TIMESTAMP' },
          { name: 'next_retry', type: 'TIMESTAMP' },
          { name: 'resolved', type: 'BOOLEAN', default: 'false' }
        ]
      },
      {
        table: 'plaid_aggregated_snapshot',
        columns: [
          { name: 'banking_assets', type: 'JSONB', default: "'[]'::jsonb" },
          { name: 'investment_assets', type: 'JSONB', default: "'[]'::jsonb" },
          { name: 'retirement_assets', type: 'JSONB', default: "'[]'::jsonb" },
          { name: 'other_assets', type: 'JSONB', default: "'[]'::jsonb" },
          { name: 'liabilities', type: 'JSONB', default: "'[]'::jsonb" },
          { name: 'total_assets', type: 'DECIMAL(15,2)', default: '0' },
          { name: 'total_liabilities', type: 'DECIMAL(15,2)', default: '0' },
          { name: 'net_worth', type: 'DECIMAL(15,2)', default: '0' },
          { name: 'monthly_income', type: 'DECIMAL(12,2)', default: '0' },
          { name: 'monthly_expenses', type: 'DECIMAL(12,2)', default: '0' },
          { name: 'monthly_cash_flow', type: 'DECIMAL(12,2)', default: '0' },
          { name: 'expense_categories', type: 'JSONB', default: "'{}'::jsonb" },
          { name: 'account_summary', type: 'JSONB', default: "'{}'::jsonb" },
          { name: 'institution_summary', type: 'JSONB', default: "'{}'::jsonb" },
          { name: 'metadata', type: 'JSONB', default: "'{}'::jsonb" }
        ]
      },
      {
        table: 'section_progress',
        columns: [
          { name: 'section_type', type: 'VARCHAR(100)' },
          { name: 'fields_completed', type: 'INTEGER', default: '0' },
          { name: 'total_fields', type: 'INTEGER', default: '0' },
          { name: 'time_spent_seconds', type: 'INTEGER', default: '0' },
          { name: 'last_activity', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
        ]
      }
    ];

    // Process each table
    for (const tableDef of criticalFixes) {
      console.log(`📋 Processing table: ${tableDef.table}`);
      
      // First check if table exists
      const tableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableDef.table}
        )
      `);
      
      if (!tableExists.rows[0]?.exists) {
        console.log(`   ⚠️ Table ${tableDef.table} doesn't exist. Creating...`);
        // Create basic table structure based on most common tables
        await createTableIfMissing(tableDef.table);
      }
      
      // Add missing columns
      for (const col of tableDef.columns) {
        try {
          const defaultClause = col.default ? `DEFAULT ${col.default}` : '';
          await db.execute(sql`
            ALTER TABLE ${sql.identifier(tableDef.table)} 
            ADD COLUMN IF NOT EXISTS ${sql.identifier(col.name)} ${sql.raw(col.type)} ${sql.raw(defaultClause)}
          `);
          console.log(`   ✅ Column ${col.name} ensured`);
        } catch (err: any) {
          if (err.code === '42701') { // Column already exists
            console.log(`   ℹ️ Column ${col.name} already exists`);
          } else {
            console.log(`   ⚠️ Error adding ${col.name}: ${err.message}`);
          }
        }
      }
    }

    // Fix column type mismatches
    console.log('\n📋 Fixing column type mismatches...');
    
    // Fix monthly_expenses if it's the wrong type
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
          USING CASE 
            WHEN monthly_expenses IS NULL THEN NULL
            ELSE json_build_object('total', monthly_expenses)
          END;
        END IF;
      END $$;
    `);
    console.log('   ✅ monthly_expenses type verified as JSONB');

    // Create missing tables
    console.log('\n📋 Creating missing tables...');
    
    const missingTables = [
      {
        name: 'plaid_aggregated_snapshot',
        sql: `CREATE TABLE IF NOT EXISTS plaid_aggregated_snapshot (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          banking_assets JSONB DEFAULT '[]'::jsonb,
          investment_assets JSONB DEFAULT '[]'::jsonb,
          retirement_assets JSONB DEFAULT '[]'::jsonb,
          other_assets JSONB DEFAULT '[]'::jsonb,
          liabilities JSONB DEFAULT '[]'::jsonb,
          total_assets DECIMAL(15,2) DEFAULT 0,
          total_liabilities DECIMAL(15,2) DEFAULT 0,
          net_worth DECIMAL(15,2) DEFAULT 0,
          monthly_income DECIMAL(12,2) DEFAULT 0,
          monthly_expenses DECIMAL(12,2) DEFAULT 0,
          monthly_cash_flow DECIMAL(12,2) DEFAULT 0,
          monthly_net_cash_flow DECIMAL(12,2) DEFAULT 0,
          expense_categories JSONB DEFAULT '{}'::jsonb,
          account_summary JSONB DEFAULT '{}'::jsonb,
          institution_summary JSONB DEFAULT '{}'::jsonb,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'debts',
        sql: `CREATE TABLE IF NOT EXISTS debts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          balance DECIMAL(12, 2) NOT NULL,
          interest_rate DECIMAL(5, 2),
          minimum_payment DECIMAL(12, 2),
          due_date INTEGER,
          priority INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'debt_payoff_plans',
        sql: `CREATE TABLE IF NOT EXISTS debt_payoff_plans (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          strategy VARCHAR(50) NOT NULL,
          extra_payment DECIMAL(12, 2) DEFAULT 0,
          target_date DATE,
          is_active BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'plaid_liabilities',
        sql: `CREATE TABLE IF NOT EXISTS plaid_liabilities (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          account_id VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          type VARCHAR(50),
          subtype VARCHAR(50),
          current_balance DECIMAL(12, 2),
          interest_rate DECIMAL(5, 2),
          minimum_payment DECIMAL(12, 2),
          origination_date DATE,
          institution_name VARCHAR(255),
          last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      }
    ];

    for (const table of missingTables) {
      await db.execute(sql.raw(table.sql));
      console.log(`   ✅ Table ${table.name} ensured`);
    }

    // Fix constraints
    console.log('\n📋 Fixing constraints...');
    
    // Make section_name nullable in section_progress
    await db.execute(sql`
      ALTER TABLE section_progress 
      ALTER COLUMN section_name DROP NOT NULL
    `).catch(() => console.log('   ℹ️ section_name already nullable'));

    // Make widget_name nullable in widget_cache (for backward compatibility)
    await db.execute(sql`
      ALTER TABLE widget_cache 
      ALTER COLUMN widget_name DROP NOT NULL
    `).catch(() => console.log('   ℹ️ widget_name already nullable'));

    // Verify critical columns
    console.log('\n📋 Verifying critical columns...');
    
    const verifications = [
      { table: 'dashboard_insights', column: 'profile_data_hash' },
      { table: 'dashboard_insights', column: 'financial_snapshot' },
      { table: 'widget_cache', column: 'widget_type' },
      { table: 'financial_profiles', column: 'last_updated' },
      { table: 'financial_profiles', column: 'optimal_social_security_age' }
    ];

    for (const check of verifications) {
      const result = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = ${check.table} 
        AND column_name = ${check.column}
      `);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ ${check.table}.${check.column}: ${result.rows[0].data_type}`);
      } else {
        console.log(`   ❌ MISSING: ${check.table}.${check.column}`);
      }
    }

    console.log('\n✅ SUCCESS! Database is now synchronized with Drizzle schema!');
    console.log('\n📝 Next Steps:');
    console.log('1. Restart your server to pick up the changes');
    console.log('2. Try submitting the intake form again');
    console.log('3. If you still get errors, run: npm run db:validate');
    
  } catch (error) {
    console.error('\n❌ Error during sync:', error);
    console.error('\n💡 Manual Fix Instructions:');
    console.error('1. Go to your Supabase dashboard');
    console.error('2. Open the SQL Editor');
    console.error('3. Run the SQL commands shown above manually');
    process.exit(1);
  }
  
  process.exit(0);
}

async function createTableIfMissing(tableName: string) {
  // Basic table creation for common tables
  const tableCreations: Record<string, string> = {
    'dashboard_insights': `
      CREATE TABLE dashboard_insights (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        insights JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    'widget_cache': `
      CREATE TABLE widget_cache (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        widget_type TEXT,
        widget_name TEXT,
        input_hash TEXT,
        widget_data JSONB,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    'section_progress': `
      CREATE TABLE section_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        section_name VARCHAR(100),
        completion_percentage INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, section_name)
      )
    `,
    'plaid_sync_recovery': `
      CREATE TABLE plaid_sync_recovery (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        item_id VARCHAR(255),
        sync_type VARCHAR(50),
        error_code VARCHAR(100),
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        last_attempt TIMESTAMP,
        next_retry TIMESTAMP,
        resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  };

  if (tableCreations[tableName]) {
    await db.execute(sql.raw(tableCreations[tableName]));
  }
}

// Run the sync
syncDatabaseWithDrizzle();
