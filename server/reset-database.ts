import { sql } from 'drizzle-orm';
import { db } from './db';

async function resetDatabase() {
  try {
    console.log('Resetting database schema...\n');
    
    // Drop existing tables
    console.log('Dropping existing tables...');
    await db.execute(sql`DROP TABLE IF EXISTS chat_messages CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS pdf_reports CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS financial_profiles CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS goals CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS goal_allocations CASCADE`);
    
    console.log('Tables dropped successfully.');
    
    // Create tables with new schema
    console.log('\nCreating tables with new schema...');
    
    // Users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Financial profiles table with all required columns
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS financial_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        
        -- Personal Information
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        date_of_birth DATE,
        spouse_date_of_birth DATE,
        gender VARCHAR(10),
        spouse_gender VARCHAR(10),
        marital_status VARCHAR(50),
        state VARCHAR(2),
        spouse_name VARCHAR(255),
        dependents INTEGER,
        
        -- Income
        annual_income NUMERIC,
        spouse_annual_income NUMERIC,
        
        -- Assets (stored as JSONB)
        assets JSONB,
        
        -- Retirement
        desired_retirement_age INTEGER,
        spouse_desired_retirement_age INTEGER,
        life_expectancy INTEGER,
        spouse_life_expectancy INTEGER,
        
        -- Social Security
        social_security_benefit NUMERIC,
        spouse_social_security_benefit NUMERIC,
        social_security_claim_age INTEGER,
        spouse_social_security_claim_age INTEGER,
        
        -- Expenses
        expected_monthly_expenses_retirement NUMERIC,
        
        -- Contributions
        monthly_contribution_401k NUMERIC,
        monthly_contribution_ira NUMERIC,
        monthly_contribution_roth_ira NUMERIC,
        monthly_contribution_brokerage NUMERIC,
        
        -- Investment
        expected_real_return NUMERIC,
        
        -- Insurance
        has_long_term_care_insurance BOOLEAN DEFAULT false,
        auto_insurance NUMERIC DEFAULT 0,
        
        -- Part-time work
        part_time_work_retirement BOOLEAN DEFAULT false,
        spouse_part_time_work_retirement BOOLEAN DEFAULT false,
        part_time_income NUMERIC DEFAULT 0,
        spouse_part_time_income NUMERIC DEFAULT 0,
        part_time_work_years INTEGER DEFAULT 0,
        spouse_part_time_work_years INTEGER DEFAULT 0,
        
        -- Gender fields (if different from above)
        user_gender VARCHAR(10),
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Chat messages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // PDF reports table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pdf_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Goals table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        target_amount NUMERIC NOT NULL,
        target_date DATE NOT NULL,
        priority VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Goal allocations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS goal_allocations (
        id SERIAL PRIMARY KEY,
        goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
        asset_type VARCHAR(50) NOT NULL,
        amount NUMERIC NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Tables created successfully.');
    
    console.log('\n✅ Database reset complete!');
    console.log('\nNext steps:');
    console.log('1. Register a new user');
    console.log('2. Fill out the intake form');
    console.log('3. View the dashboard');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();