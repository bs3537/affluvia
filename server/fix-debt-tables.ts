import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function fixDebtTables() {
  console.log('Creating/fixing debt tables...');
  
  try {
    // Check if debts table exists
    const debtsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'debts'
      );
    `);
    
    if (!debtsTableExists.rows[0].exists) {
      // Create debts table
      await client.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        
        -- Debt details
        debt_name TEXT NOT NULL,
        debt_type TEXT NOT NULL, -- 'credit_card', 'student_loan', 'personal_loan', 'auto_loan', 'mortgage', 'other'
        current_balance DECIMAL(15, 2) NOT NULL,
        original_balance DECIMAL(15, 2),
        interest_rate DECIMAL(5, 3) NOT NULL,
        minimum_payment DECIMAL(10, 2) NOT NULL,
        
        -- Terms
        loan_term_months INTEGER,
        origination_date DATE,
        payoff_date DATE,
        
        -- Status
        is_active BOOLEAN DEFAULT true,
        is_in_payoff_plan BOOLEAN DEFAULT false,
        priority_order INTEGER,
        
        -- Additional info
        lender_name TEXT,
        account_number TEXT,
        notes TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
        CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(debt_type);
        CREATE INDEX IF NOT EXISTS idx_debts_active ON debts(is_active);
      `);
      console.log('✓ Created debts table');
    } else {
      console.log('✓ Debts table already exists');
    }
    
    // Create debt_payoff_plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS debt_payoff_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        
        -- Plan details
        plan_name TEXT NOT NULL,
        strategy TEXT NOT NULL, -- 'avalanche', 'snowball', 'custom'
        extra_monthly_payment DECIMAL(10, 2) DEFAULT 0,
        
        -- Calculated values
        total_interest_saved DECIMAL(15, 2),
        months_saved INTEGER,
        projected_payoff_date DATE,
        
        -- Status
        is_active BOOLEAN DEFAULT true,
        start_date DATE DEFAULT CURRENT_DATE,
        
        -- Plan data
        debt_order JSONB, -- Array of debt IDs in payoff order
        projections JSONB, -- Monthly projections
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_debt_payoff_plans_user_id ON debt_payoff_plans(user_id);
      CREATE INDEX IF NOT EXISTS idx_debt_payoff_plans_active ON debt_payoff_plans(is_active);
    `);
    console.log('✓ Created debt_payoff_plans table');
    
    // Create debt_payments table for tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS debt_payments (
        id SERIAL PRIMARY KEY,
        debt_id INTEGER REFERENCES debts(id) ON DELETE CASCADE,
        
        -- Payment details
        payment_date DATE NOT NULL,
        payment_amount DECIMAL(10, 2) NOT NULL,
        principal_amount DECIMAL(10, 2),
        interest_amount DECIMAL(10, 2),
        
        -- Balance after payment
        remaining_balance DECIMAL(15, 2),
        
        -- Payment type
        payment_type TEXT DEFAULT 'regular', -- 'regular', 'extra', 'final'
        
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);
      CREATE INDEX IF NOT EXISTS idx_debt_payments_date ON debt_payments(payment_date);
    `);
    console.log('✓ Created debt_payments table');
    
    // Verify all tables were created
    const verification = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('debts', 'debt_payoff_plans', 'debt_payments')
      ORDER BY table_name;
    `);
    
    console.log('\nVerification Results:');
    console.table(verification.rows);
    
    console.log('\n✅ Debt tables setup completed successfully!');
    
    await client.end();
    
  } catch (error) {
    console.error('Error creating debt tables:', error);
    await client.end();
    process.exit(1);
  }
}

async function main() {
  await client.connect();
  await fixDebtTables();
}

main();
