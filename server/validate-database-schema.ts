/**
 * DATABASE SCHEMA VALIDATION SCRIPT
 * Run this to check if your database matches your Drizzle schema
 * Usage: npm run db:validate
 */

import { db } from './db.js';
import { sql } from 'drizzle-orm';

interface SchemaIssue {
  type: 'missing_table' | 'missing_column' | 'type_mismatch' | 'constraint_issue';
  table: string;
  column?: string;
  expected?: string;
  actual?: string;
  severity: 'critical' | 'warning' | 'info';
}

async function validateDatabaseSchema() {
  console.log('🔍 DATABASE SCHEMA VALIDATION\n');
  console.log('Checking if your Supabase database matches your Drizzle ORM schema...\n');
  
  const issues: SchemaIssue[] = [];
  
  try {
    // CRITICAL TABLES TO CHECK
    const criticalTables = [
      'users',
      'financial_profiles',
      'dashboard_insights',
      'widget_cache',
      'plaid_accounts',
      'plaid_items',
      'plaid_aggregated_snapshot',
      'section_progress',
      'debts',
      'debt_payoff_plans',
      'plaid_sync_recovery',
      // Debt management scenario storage
      'debt_scenarios'
    ];

    // CRITICAL COLUMNS TO CHECK
    const criticalColumns = {
      financial_profiles: [
        { name: 'monthly_expenses', type: 'jsonb' },
        { name: 'last_updated', type: 'timestamp' },
        { name: 'optimal_social_security_age', type: 'integer' },
        { name: 'social_security_optimization', type: 'jsonb' },
        { name: 'banking_assets', type: 'jsonb' },
        { name: 'investment_assets', type: 'jsonb' },
        { name: 'retirement_assets', type: 'jsonb' },
        { name: 'monte_carlo_results', type: 'jsonb' },
        { name: 'optimization_variables', type: 'jsonb' },
        // Prevent type drift for retirement fields
        { name: 'retirement_expense_budget', type: 'jsonb' },
        { name: 'retirement_contributions', type: 'jsonb' },
        { name: 'spouse_retirement_contributions', type: 'jsonb' }
      ],
      dashboard_insights: [
        { name: 'profile_data_hash', type: 'text' },
        { name: 'financial_snapshot', type: 'jsonb' },
        { name: 'generation_version', type: 'text' },
        { name: 'insights', type: 'jsonb' }
      ],
      widget_cache: [
        { name: 'widget_type', type: 'text' },
        { name: 'widget_data', type: 'jsonb' },
        { name: 'input_hash', type: 'text' },
        { name: 'version', type: 'integer' }
      ],
      plaid_aggregated_snapshot: [
        { name: 'banking_assets', type: 'jsonb' },
        { name: 'investment_assets', type: 'jsonb' },
        { name: 'retirement_assets', type: 'jsonb' }
      ],
      debt_scenarios: [
        { name: 'scenario_name', type: 'text' },
        { name: 'scenario_type', type: 'text' },
        { name: 'parameters', type: 'jsonb' },
        { name: 'results', type: 'jsonb' },
        { name: 'created_at', type: 'timestamp' },
      ],
      section_progress: [
        { name: 'section_name', type: 'character varying', nullable: true }
      ],
      plaid_sync_recovery: [
        { name: 'sync_type', type: 'character varying' },
        { name: 'error_code', type: 'character varying' }
      ]
    };

    // 1. Check for missing tables
    console.log('📋 Checking tables...');
    for (const tableName of criticalTables) {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        )
      `);
      
      if (!result.rows[0]?.exists) {
        issues.push({
          type: 'missing_table',
          table: tableName,
          severity: 'critical'
        });
        console.log(`   ❌ Table '${tableName}' is MISSING`);
      } else {
        console.log(`   ✅ Table '${tableName}' exists`);
      }
    }

    // 2. Check for missing columns
    console.log('\n📋 Checking columns...');
    for (const [tableName, columns] of Object.entries(criticalColumns)) {
      // Check if table exists first
      const tableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        )
      `);

      if (!tableExists.rows[0]?.exists) {
        console.log(`   ⚠️ Skipping columns for missing table '${tableName}'`);
        continue;
      }

      console.log(`   Table: ${tableName}`);
      
      for (const col of columns) {
        const result = await db.execute(sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_schema = 'public'
          AND table_name = ${tableName}
          AND column_name = ${col.name}
        `);
        
        if (result.rows.length === 0) {
          issues.push({
            type: 'missing_column',
            table: tableName,
            column: col.name,
            expected: col.type,
            severity: 'critical'
          });
          console.log(`     ❌ Column '${col.name}' (${col.type}) is MISSING`);
        } else {
          const actualType = result.rows[0].data_type;
          const isNullable = result.rows[0].is_nullable === 'YES';
          
          // Check type mismatch
          if (!actualType.toLowerCase().includes(col.type.toLowerCase().replace('varying', ''))) {
            issues.push({
              type: 'type_mismatch',
              table: tableName,
              column: col.name,
              expected: col.type,
              actual: actualType,
              severity: 'warning'
            });
            console.log(`     ⚠️ Column '${col.name}' type mismatch: expected ${col.type}, got ${actualType}`);
          } else {
            console.log(`     ✅ Column '${col.name}' (${actualType}${isNullable ? ', nullable' : ''}) exists`);
          }
        }
      }
    }

    // 3. Check specific constraint issues
    console.log('\n📋 Checking constraints...');
    
    // Check if section_name is nullable
    const sectionNameCheck = await db.execute(sql`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'section_progress' 
      AND column_name = 'section_name'
    `);
    
    if (sectionNameCheck.rows[0]?.is_nullable === 'NO') {
      issues.push({
        type: 'constraint_issue',
        table: 'section_progress',
        column: 'section_name',
        expected: 'nullable',
        actual: 'not null',
        severity: 'critical'
      });
      console.log(`   ❌ section_progress.section_name should be nullable`);
    } else {
      console.log(`   ✅ section_progress.section_name is nullable`);
    }

    // 4. Summary
    console.log('\n' + '='.repeat(50));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(50));
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const warnings = issues.filter(i => i.severity === 'warning');
    
    // Additional environment compatibility checks for Plaid snapshot/transactions
    try {
      // Check plaid_aggregated_snapshot account count column (either account_count or accounts_count)
      const pasCol = await db.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'plaid_aggregated_snapshot'
        AND column_name IN ('account_count','accounts_count')
      `);
      if ((pasCol.rows || []).length === 0) {
        issues.push({ type: 'missing_column', table: 'plaid_aggregated_snapshot', column: 'account_count|accounts_count', expected: 'integer', severity: 'warning' });
        console.log("     ⚠️ plaid_aggregated_snapshot.account_count/accounts_count column missing (non-critical)");
      }

      // Check optional monthly_net_cash_flow column
      const mnet = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'plaid_aggregated_snapshot' AND column_name = 'monthly_net_cash_flow'
        )
      `);
      if (!mnet.rows[0]?.exists) {
        issues.push({ type: 'missing_column', table: 'plaid_aggregated_snapshot', column: 'monthly_net_cash_flow', expected: 'numeric', severity: 'warning' });
        console.log("     ⚠️ plaid_aggregated_snapshot.monthly_net_cash_flow column missing (non-critical)");
      }

      // plaid_transactions detailed_category presence (warn only)
      const det = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'plaid_transactions' AND column_name = 'detailed_category'
        )
      `);
      if (!det.rows[0]?.exists) {
        issues.push({ type: 'missing_column', table: 'plaid_transactions', column: 'detailed_category', expected: 'text', severity: 'warning' });
        console.log("     ⚠️ plaid_transactions.detailed_category column missing (non-critical)");
      }

      // plaid_accounts optional columns check
      const acctCols = ['account_type','account_subtype','current_balance','available_balance','is_active','last_synced'];
      for (const c of acctCols) {
        const r = await db.execute(sql`SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema='public' AND table_name='plaid_accounts' AND column_name=${c}
        )`);
        if (!r.rows[0]?.exists) {
          issues.push({ type: 'missing_column', table: 'plaid_accounts', column: c, expected: 'varies', severity: 'warning' });
          console.log(`     ⚠️ plaid_accounts.${c} missing (non-critical)`);
        }
      }

      // plaid_items optional columns check
      const itemCols = ['status','institution_name','consent_expiration_time'];
      for (const c of itemCols) {
        const r = await db.execute(sql`SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema='public' AND table_name='plaid_items' AND column_name=${c}
        )`);
        if (!r.rows[0]?.exists) {
          issues.push({ type: 'missing_column', table: 'plaid_items', column: c, expected: 'varies', severity: 'warning' });
          console.log(`     ⚠️ plaid_items.${c} missing (non-critical)`);
        }
      }

      // Optional stock percentage fields in snapshot
      const stockCols = ['stocks_percentage','bonds_percentage','cash_percentage','alternatives_percentage'];
      for (const c of stockCols) {
        const r = await db.execute(sql`SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema='public' AND table_name='plaid_aggregated_snapshot' AND column_name=${c}
        )`);
        if (!r.rows[0]?.exists) {
          console.log(`     ℹ️ plaid_aggregated_snapshot.${c} not found (optional; will be omitted)`);
        }
      }
    } catch (compatErr) {
      console.log('   ⚠️ Skipped Plaid compatibility checks:', (compatErr as any)?.message || compatErr);
    }

    if (criticalIssues.length === 0 && warnings.length === 0) {
      console.log('\n✅ SUCCESS! Your database schema is fully synchronized!');
      console.log('All tables and columns match the Drizzle schema.');
    } else {
      if (criticalIssues.length > 0) {
        console.log(`\n❌ CRITICAL ISSUES FOUND: ${criticalIssues.length}`);
        console.log('\nThese must be fixed for the application to work:');
        criticalIssues.forEach(issue => {
          if (issue.type === 'missing_table') {
            console.log(`  - Missing table: ${issue.table}`);
          } else if (issue.type === 'missing_column') {
            console.log(`  - Missing column: ${issue.table}.${issue.column} (${issue.expected})`);
          } else if (issue.type === 'constraint_issue') {
            console.log(`  - Constraint issue: ${issue.table}.${issue.column} - expected ${issue.expected}, got ${issue.actual}`);
          }
        });
      }
      
      if (warnings.length > 0) {
        console.log(`\n⚠️ WARNINGS: ${warnings.length}`);
        console.log('\nThese might cause issues:');
        warnings.forEach(issue => {
          if (issue.type === 'type_mismatch') {
            console.log(`  - Type mismatch: ${issue.table}.${issue.column} - expected ${issue.expected}, got ${issue.actual}`);
          }
        });
      }
      
      console.log('\n🔧 FIX INSTRUCTIONS:');
      console.log('1. Run: npm run db:push');
      console.log('2. Or manually fix the issues in Supabase SQL Editor');
      console.log('3. Then run this validation again to confirm');
    }
    
    // Return exit code based on critical issues
    process.exit(criticalIssues.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Error during validation:', error);
    process.exit(1);
  }
}

// Run validation
validateDatabaseSchema();
