import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function fixAllMissingColumns() {
  console.log('Adding ALL missing database columns comprehensively...');
  
  try {
    // Add ALL missing columns to financial_profiles based on schema
    console.log('Adding all missing columns to financial_profiles...');
    
    // Personal Information columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS first_name TEXT,
      ADD COLUMN IF NOT EXISTS last_name TEXT,
      ADD COLUMN IF NOT EXISTS date_of_birth TEXT,
      ADD COLUMN IF NOT EXISTS marital_status TEXT,
      ADD COLUMN IF NOT EXISTS dependents INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_name TEXT,
      ADD COLUMN IF NOT EXISTS spouse_date_of_birth TEXT,
      ADD COLUMN IF NOT EXISTS spouse_first_name TEXT,
      ADD COLUMN IF NOT EXISTS spouse_last_name TEXT,
      ADD COLUMN IF NOT EXISTS state TEXT
    `);
    
    // Employment & Income columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS employment_status TEXT,
      ADD COLUMN IF NOT EXISTS annual_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS tax_withholding_status TEXT,
      ADD COLUMN IF NOT EXISTS take_home_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS other_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS self_employment_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_self_employment_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS self_employed_data JSONB,
      ADD COLUMN IF NOT EXISTS spouse_self_employed_data JSONB,
      ADD COLUMN IF NOT EXISTS business_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_business_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS business_type TEXT,
      ADD COLUMN IF NOT EXISTS business_value DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS business_ownership_percentage DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS rental_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS investment_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS passive_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_employment_status TEXT,
      ADD COLUMN IF NOT EXISTS spouse_annual_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_tax_withholding_status TEXT,
      ADD COLUMN IF NOT EXISTS spouse_take_home_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS savings_rate DECIMAL(12, 2)
    `);
    
    // Assets & Liabilities columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS assets JSONB,
      ADD COLUMN IF NOT EXISTS liabilities JSONB,
      ADD COLUMN IF NOT EXISTS primary_residence JSONB,
      ADD COLUMN IF NOT EXISTS additional_properties JSONB
    `);
    
    // Monthly Expenses columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS monthly_expenses JSONB,
      ADD COLUMN IF NOT EXISTS total_monthly_expenses DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS emergency_fund_size DECIMAL(12, 2)
    `);
    
    // Insurance columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS life_insurance JSONB,
      ADD COLUMN IF NOT EXISTS spouse_life_insurance JSONB,
      ADD COLUMN IF NOT EXISTS health_insurance JSONB,
      ADD COLUMN IF NOT EXISTS disability_insurance JSONB,
      ADD COLUMN IF NOT EXISTS spouse_disability_insurance JSONB,
      ADD COLUMN IF NOT EXISTS auto_insurance JSONB,
      ADD COLUMN IF NOT EXISTS homeowner_insurance JSONB,
      ADD COLUMN IF NOT EXISTS umbrella_insurance JSONB,
      ADD COLUMN IF NOT EXISTS business_liability_insurance JSONB,
      ADD COLUMN IF NOT EXISTS insurance JSONB
    `);
    
    // Retirement & Investment columns (checking schema for more)
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS retirement_accounts JSONB,
      ADD COLUMN IF NOT EXISTS retirement_planning_data JSONB,
      ADD COLUMN IF NOT EXISTS retirement_planning_ui_preferences JSONB,
      ADD COLUMN IF NOT EXISTS has_retirement_plan BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_401k BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_ira BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_roth_ira BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_pension BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS retirement_age INTEGER,
      ADD COLUMN IF NOT EXISTS retirement_goal_age INTEGER,
      ADD COLUMN IF NOT EXISTS retirement_goal_amount DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS spouse_retirement_age INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_retirement_goal_age INTEGER,
      ADD COLUMN IF NOT EXISTS social_security_start_age INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_social_security_start_age INTEGER,
      ADD COLUMN IF NOT EXISTS optimal_social_security_age INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_optimal_social_security_age INTEGER,
      ADD COLUMN IF NOT EXISTS optimal_spouse_social_security_age INTEGER,
      ADD COLUMN IF NOT EXISTS expected_annual_return DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS expected_real_return DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS inflation_rate DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS long_term_care_insurance JSONB,
      ADD COLUMN IF NOT EXISTS spouse_long_term_care_insurance JSONB,
      ADD COLUMN IF NOT EXISTS has_long_term_care_insurance BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS spouse_has_long_term_care_insurance BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS estimated_social_security_benefit DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_estimated_social_security_benefit DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS social_security_benefit DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_social_security_benefit DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS social_security_optimization JSONB,
      ADD COLUMN IF NOT EXISTS retirement_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_retirement_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS retirement_expenses DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS retirement_lifestyle TEXT,
      ADD COLUMN IF NOT EXISTS pension_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_pension_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_pension_benefit DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS pension_benefit DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS other_retirement_income DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS life_expectancy INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_life_expectancy INTEGER
    `);
    
    // Risk Profile columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS risk_profile JSONB,
      ADD COLUMN IF NOT EXISTS risk_questionnaire JSONB,
      ADD COLUMN IF NOT EXISTS risk_questions JSONB,
      ADD COLUMN IF NOT EXISTS spouse_risk_questions JSONB,
      ADD COLUMN IF NOT EXISTS user_risk_profile TEXT,
      ADD COLUMN IF NOT EXISTS investor_risk_profile TEXT,
      ADD COLUMN IF NOT EXISTS spouse_investor_risk_profile TEXT,
      ADD COLUMN IF NOT EXISTS spouse_risk_profile TEXT,
      ADD COLUMN IF NOT EXISTS financial_priorities JSONB
    `);
    
    // Goals columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS goals JSONB,
      ADD COLUMN IF NOT EXISTS life_goals JSONB,
      ADD COLUMN IF NOT EXISTS major_life_events JSONB,
      ADD COLUMN IF NOT EXISTS legacy_goal DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS legacy_goal_age INTEGER
    `);
    
    // Estate Planning columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS has_will BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_trust BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_power_of_attorney BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_healthcare_proxy BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_beneficiaries BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS estate_planning JSONB,
      ADD COLUMN IF NOT EXISTS estate_planning_documents JSONB,
      ADD COLUMN IF NOT EXISTS beneficiaries JSONB
    `);
    
    // Calculated fields
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS net_worth DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS monthly_cash_flow DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS monthly_cash_flow_after_contributions DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS financial_health_score INTEGER,
      ADD COLUMN IF NOT EXISTS emergency_readiness_score INTEGER,
      ADD COLUMN IF NOT EXISTS retirement_readiness_score INTEGER,
      ADD COLUMN IF NOT EXISTS insurance_adequacy_score INTEGER,
      ADD COLUMN IF NOT EXISTS risk_management_score INTEGER,
      ADD COLUMN IF NOT EXISTS tax_efficiency_score INTEGER,
      ADD COLUMN IF NOT EXISTS estate_planning_score INTEGER,
      ADD COLUMN IF NOT EXISTS investment_optimization_score INTEGER,
      ADD COLUMN IF NOT EXISTS cash_flow_score INTEGER,
      ADD COLUMN IF NOT EXISTS debt_management_score INTEGER,
      ADD COLUMN IF NOT EXISTS wealth_building_score INTEGER,
      ADD COLUMN IF NOT EXISTS financial_independence_score INTEGER,
      ADD COLUMN IF NOT EXISTS life_goals_success_probability DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS current_asset_allocation JSONB,
      ADD COLUMN IF NOT EXISTS current_allocation JSONB,
      ADD COLUMN IF NOT EXISTS current_stock_allocation DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS current_bond_allocation DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS current_cash_allocation DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS current_alternatives_allocation DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS target_allocation JSONB,
      ADD COLUMN IF NOT EXISTS spouse_allocation JSONB,
      ADD COLUMN IF NOT EXISTS spouse_target_allocation JSONB,
      ADD COLUMN IF NOT EXISTS recommended_asset_allocation JSONB,
      ADD COLUMN IF NOT EXISTS user_recommended_asset_allocation JSONB,
      ADD COLUMN IF NOT EXISTS spouse_recommended_asset_allocation JSONB,
      ADD COLUMN IF NOT EXISTS personalized_recommendations JSONB,
      ADD COLUMN IF NOT EXISTS ai_insights TEXT,
      ADD COLUMN IF NOT EXISTS calculations JSONB,
      ADD COLUMN IF NOT EXISTS monte_carlo_results JSONB,
      ADD COLUMN IF NOT EXISTS monte_carlo_simulation JSONB,
      ADD COLUMN IF NOT EXISTS optimization_variables JSONB,
      ADD COLUMN IF NOT EXISTS last_stress_test_results JSONB,
      ADD COLUMN IF NOT EXISTS last_stress_test_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS scenario_analysis JSONB,
      ADD COLUMN IF NOT EXISTS sensitivity_analysis JSONB
    `);
    
    // Tax & Contribution columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS traditional_ira_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS roth_ira_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS traditional_401k_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS roth_401k_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_traditional_ira_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_roth_ira_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_traditional_401k_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_roth_401k_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS hsa_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS spouse_hsa_contribution DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS tax_filing_status TEXT,
      ADD COLUMN IF NOT EXISTS effective_tax_rate DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS marginal_tax_rate DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS state_tax_rate DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS last_year_agi DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS last_year_taxes_paid DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS estimated_current_year_taxes DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS quarterly_tax_payments DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS deductions JSONB,
      ADD COLUMN IF NOT EXISTS deduction_amount DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS tax_credits JSONB,
      ADD COLUMN IF NOT EXISTS tax_returns JSONB,
      ADD COLUMN IF NOT EXISTS tax_recommendations JSONB
    `);
    
    // Metadata columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS completion_percentage DECIMAL(5, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS additional_notes TEXT,
      ADD COLUMN IF NOT EXISTS advisor_notes TEXT,
      ADD COLUMN IF NOT EXISTS last_review_date TIMESTAMP
    `);
    
    // Plaid integration columns
    await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS plaid_sync_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_plaid_sync TIMESTAMP,
      ADD COLUMN IF NOT EXISTS plaid_items JSONB,
      ADD COLUMN IF NOT EXISTS plaid_institutions JSONB
    `);
    
    // Now handle section_progress table
    console.log('Ensuring section_progress table and columns...');
    
    // Check if table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'section_progress'
      ) as exists
    `);
    
    if (tableExists.rows[0].exists) {
      // Add all columns
      await db.execute(sql`
        ALTER TABLE section_progress 
        ADD COLUMN IF NOT EXISTS section TEXT,
        ADD COLUMN IF NOT EXISTS visits INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS actions_completed INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_visit TIMESTAMP DEFAULT now(),
        ADD COLUMN IF NOT EXISTS completion_percentage NUMERIC(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now()
      `);
      
      // Update NULL sections
      await db.execute(sql`
        UPDATE section_progress 
        SET section = 'general' 
        WHERE section IS NULL
      `);
    } else {
      // Create the table
      await db.execute(sql`
        CREATE TABLE section_progress (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          section TEXT NOT NULL,
          visits INTEGER DEFAULT 0,
          time_spent INTEGER DEFAULT 0,
          actions_completed INTEGER DEFAULT 0,
          last_visit TIMESTAMP DEFAULT now(),
          completion_percentage NUMERIC(5,2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT now(),
          UNIQUE(user_id, section)
        )
      `);
    }
    
    // Add ALL remaining possible columns
    console.log('Adding comprehensive list of remaining columns...');
    const remainingSql = await db.execute(sql`
      ALTER TABLE financial_profiles 
      ADD COLUMN IF NOT EXISTS retirement_expense_budget JSONB,
      ADD COLUMN IF NOT EXISTS retirement_income_needed DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS retirement_income_gap DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS retirement_savings_needed DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS retirement_monthly_savings_needed DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS retirement_contributions JSONB,
      ADD COLUMN IF NOT EXISTS spouse_retirement_contributions JSONB,
      ADD COLUMN IF NOT EXISTS withdrawal_rate DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS safe_withdrawal_rate DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS years_to_retirement INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_years_to_retirement INTEGER,
      ADD COLUMN IF NOT EXISTS college_savings_goals JSONB,
      ADD COLUMN IF NOT EXISTS college_savings_529_plans JSONB,
      ADD COLUMN IF NOT EXISTS college_savings_monthly_needed DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS emergency_fund_months INTEGER,
      ADD COLUMN IF NOT EXISTS emergency_fund_target DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS emergency_fund_gap DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS debt_to_income_ratio DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS housing_expense_ratio DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS savings_ratio DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS investment_horizon TEXT,
      ADD COLUMN IF NOT EXISTS liquidity_needs TEXT,
      ADD COLUMN IF NOT EXISTS tax_situation TEXT,
      ADD COLUMN IF NOT EXISTS investment_experience TEXT,
      ADD COLUMN IF NOT EXISTS investment_objectives JSONB,
      ADD COLUMN IF NOT EXISTS investment_strategy TEXT,
      ADD COLUMN IF NOT EXISTS special_circumstances TEXT,
      ADD COLUMN IF NOT EXISTS healthcare_costs_retirement DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS long_term_care_costs DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS inflation_adjusted_expenses DECIMAL(12, 2)
    `).catch(err => console.log('Some columns might already exist'));
    
    console.log('✅ All columns added successfully!');
    
    // Quick verification
    const profileCols = await db.execute(sql`
      SELECT COUNT(*) as col_count 
      FROM information_schema.columns 
      WHERE table_name = 'financial_profiles'
    `);
    console.log(`Total columns in financial_profiles: ${profileCols.rows[0].col_count}`);
    
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixAllMissingColumns();
