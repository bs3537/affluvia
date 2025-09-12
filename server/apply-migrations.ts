/**
 * Script to apply missing database migrations
 * Run with: npx tsx server/apply-migrations.ts
 */

import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows;
  } finally {
    client.release();
  }
}


async function applyMigrations() {
  console.log('=== Applying Database Migrations ===\n');
  
  try {
    // First, check which columns exist
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'financial_profiles' 
      AND column_name IN ('user_health_status', 'spouse_health_status', 
                          'user_gender', 'spouse_gender', 'retirement_state',
                          'user_life_expectancy', 'spouse_life_expectancy',
                          'expected_monthly_expenses_retirement', 'retirement_state');
    `;
    
    const existingColumns = await query(checkColumnsQuery);
    const existingColumnNames = new Set(existingColumns.map((row: any) => row.column_name));
    
    console.log('Existing columns:', Array.from(existingColumnNames).join(', ') || 'None');
    
    // Apply health status columns if missing
    if (!existingColumnNames.has('user_health_status') || !existingColumnNames.has('spouse_health_status')) {
      console.log('\nAdding health status columns...');
      
      // First drop constraints if they exist
      try {
        await query('ALTER TABLE financial_profiles DROP CONSTRAINT IF EXISTS check_user_health_status');
        await query('ALTER TABLE financial_profiles DROP CONSTRAINT IF EXISTS check_spouse_health_status');
      } catch (e) {
        // Constraints might not exist, that's ok
      }
      
      // Add columns
      await query(`
        ALTER TABLE financial_profiles
        ADD COLUMN IF NOT EXISTS user_health_status TEXT DEFAULT 'good',
        ADD COLUMN IF NOT EXISTS spouse_health_status TEXT DEFAULT 'good'
      `);
      
      // Add constraints
      await query(`
        ALTER TABLE financial_profiles
        ADD CONSTRAINT check_user_health_status 
        CHECK (user_health_status IN ('excellent', 'good', 'fair', 'poor'))
      `);
      
      await query(`
        ALTER TABLE financial_profiles
        ADD CONSTRAINT check_spouse_health_status 
        CHECK (spouse_health_status IN ('excellent', 'good', 'fair', 'poor'))
      `);
      
      console.log('✓ Health status columns added');
    }
    
    // Add gender columns if missing (for LTC modeling)
    if (!existingColumnNames.has('user_gender') || !existingColumnNames.has('spouse_gender')) {
      console.log('\nAdding gender columns for LTC modeling...');
      
      await query(`
        ALTER TABLE financial_profiles
        ADD COLUMN IF NOT EXISTS user_gender TEXT DEFAULT 'male',
        ADD COLUMN IF NOT EXISTS spouse_gender TEXT DEFAULT 'female'
      `);
      
      console.log('✓ Gender columns added');
    }
    
    // Check if retirement planning columns exist
    const retirementColumns = [
      'desired_retirement_age',
      'spouse_desired_retirement_age',
      'social_security_claim_age',
      'spouse_social_security_claim_age',
      'expected_monthly_expenses_retirement',
      'part_time_income_retirement',
      'spouse_part_time_income_retirement',
      'expected_inflation_rate'
    ];
    
    const checkRetirementQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'financial_profiles' 
      AND column_name = ANY($1);
    `;
    
    const existingRetirementColumns = await query(checkRetirementQuery, [retirementColumns]);
    const hasAllRetirementColumns = retirementColumns.every(col => 
      existingRetirementColumns.some((row: any) => row.column_name === col)
    );
    
    if (!hasAllRetirementColumns) {
      console.log('\nSome retirement planning columns are missing, adding them...');
      
      // Apply retirement planning migration
      await query(`
        ALTER TABLE financial_profiles
        ADD COLUMN IF NOT EXISTS desired_retirement_age INTEGER,
        ADD COLUMN IF NOT EXISTS spouse_desired_retirement_age INTEGER,
        ADD COLUMN IF NOT EXISTS social_security_claim_age INTEGER,
        ADD COLUMN IF NOT EXISTS spouse_social_security_claim_age INTEGER,
        ADD COLUMN IF NOT EXISTS part_time_income_retirement DECIMAL(12, 2),
        ADD COLUMN IF NOT EXISTS spouse_part_time_income_retirement DECIMAL(12, 2),
        ADD COLUMN IF NOT EXISTS expected_inflation_rate DECIMAL(5, 2)
      `);
      
      console.log('✓ Retirement planning columns added');
    }
    
    // Verify all columns now exist
    console.log('\n=== Verification ===');
    const finalCheckQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'financial_profiles' 
      AND column_name IN ('user_health_status', 'spouse_health_status', 
                          'user_gender', 'spouse_gender', 
                          'user_life_expectancy', 'spouse_life_expectancy',
                          'desired_retirement_age', 'spouse_desired_retirement_age')
      ORDER BY column_name;
    `;
    
    const finalColumns = await query(finalCheckQuery);
    console.log('\nKey columns after migration:');
    for (const col of finalColumns) {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
    }
    
    console.log('\n✓ All migrations applied successfully!');
    
  } catch (error) {
    console.error('Error applying migrations:', error);
    process.exit(1);
  }
}

applyMigrations().then(async () => { await pool.end(); process.exit(0); });