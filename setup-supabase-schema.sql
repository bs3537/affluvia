-- Initial Supabase Schema Setup for Affluvia
-- Run this in Supabase SQL Editor or via CLI

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_advisor BOOLEAN DEFAULT FALSE,
    advisor_id INTEGER REFERENCES users(id)
);

-- Financial profiles table with comprehensive fields
CREATE TABLE IF NOT EXISTS financial_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic Information
    age INTEGER,
    spouse_age INTEGER,
    annual_income DECIMAL(12, 2),
    spouse_annual_income DECIMAL(12, 2),
    monthly_expenses DECIMAL(12, 2),
    state_of_residence VARCHAR(2),
    retirement_state VARCHAR(2),
    filing_status VARCHAR(50),
    
    -- Assets
    checking_savings_balance DECIMAL(12, 2),
    investment_accounts_balance DECIMAL(12, 2),
    retirement_accounts_401k DECIMAL(12, 2),
    retirement_accounts_ira DECIMAL(12, 2),
    retirement_accounts_roth_ira DECIMAL(12, 2),
    spouse_retirement_accounts_401k DECIMAL(12, 2),
    spouse_retirement_accounts_ira DECIMAL(12, 2),
    spouse_retirement_accounts_roth_ira DECIMAL(12, 2),
    other_assets DECIMAL(12, 2),
    primary_residence_value DECIMAL(12, 2),
    other_real_estate_value DECIMAL(12, 2),
    
    -- Debts
    mortgage_balance DECIMAL(12, 2),
    mortgage_payment DECIMAL(12, 2),
    mortgage_rate DECIMAL(5, 2),
    mortgage_years_remaining INTEGER,
    other_debts JSONB DEFAULT '[]',
    
    -- Insurance
    life_insurance_coverage DECIMAL(12, 2),
    spouse_life_insurance_coverage DECIMAL(12, 2),
    disability_insurance_coverage DECIMAL(12, 2),
    spouse_disability_insurance_coverage DECIMAL(12, 2),
    long_term_care_insurance BOOLEAN DEFAULT FALSE,
    spouse_long_term_care_insurance BOOLEAN DEFAULT FALSE,
    
    -- Retirement Planning
    desired_retirement_age INTEGER,
    spouse_desired_retirement_age INTEGER,
    social_security_claim_age INTEGER,
    spouse_social_security_claim_age INTEGER,
    expected_social_security_benefit DECIMAL(12, 2),
    spouse_expected_social_security_benefit DECIMAL(12, 2),
    expected_monthly_expenses_retirement DECIMAL(12, 2),
    part_time_income_retirement DECIMAL(12, 2),
    spouse_part_time_income_retirement DECIMAL(12, 2),
    expected_inflation_rate DECIMAL(5, 2) DEFAULT 2.5,
    
    -- Health & Life Expectancy
    user_health_status TEXT DEFAULT 'good' CHECK (user_health_status IN ('excellent', 'good', 'fair', 'poor')),
    spouse_health_status TEXT DEFAULT 'good' CHECK (spouse_health_status IN ('excellent', 'good', 'fair', 'poor')),
    user_gender TEXT DEFAULT 'male',
    spouse_gender TEXT DEFAULT 'female',
    user_life_expectancy INTEGER,
    spouse_life_expectancy INTEGER,
    
    -- Investment Profile
    risk_tolerance VARCHAR(50),
    spouse_risk_tolerance VARCHAR(50),
    current_asset_allocation JSONB,
    spouse_current_asset_allocation JSONB,
    recommended_asset_allocation JSONB,
    spouse_recommended_asset_allocation JSONB,
    
    -- Contributions
    retirement_monthly_contribution DECIMAL(12, 2),
    spouse_retirement_monthly_contribution DECIMAL(12, 2),
    employer_match_percentage DECIMAL(5, 2),
    spouse_employer_match_percentage DECIMAL(5, 2),
    annual_ira_contribution DECIMAL(12, 2),
    spouse_annual_ira_contribution DECIMAL(12, 2),
    
    -- Goals & Plans
    goals JSONB DEFAULT '[]',
    emergency_fund_target DECIMAL(12, 2),
    
    -- Calculated Fields
    financial_health_score INTEGER,
    net_worth DECIMAL(12, 2),
    monthly_cash_flow DECIMAL(12, 2),
    monthly_cash_flow_after_contrib DECIMAL(12, 2),
    emergency_readiness_score INTEGER,
    retirement_readiness_score INTEGER,
    monte_carlo_success_rate DECIMAL(5, 2),
    monte_carlo_results JSONB,
    net_worth_projections JSONB,
    optimization_variables JSONB,
    
    -- Tax Planning
    effective_tax_rate DECIMAL(5, 2),
    marginal_tax_rate DECIMAL(5, 2),
    
    -- Self-employed fields
    is_self_employed BOOLEAN DEFAULT FALSE,
    spouse_is_self_employed BOOLEAN DEFAULT FALSE,
    business_income DECIMAL(12, 2),
    spouse_business_income DECIMAL(12, 2),
    business_expenses DECIMAL(12, 2),
    spouse_business_expenses DECIMAL(12, 2),
    solo_401k_contribution DECIMAL(12, 2),
    spouse_solo_401k_contribution DECIMAL(12, 2),
    sep_ira_contribution DECIMAL(12, 2),
    spouse_sep_ira_contribution DECIMAL(12, 2),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_amount DECIMAL(12, 2),
    current_amount DECIMAL(12, 2) DEFAULT 0,
    target_date DATE,
    category VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Life Goals table
CREATE TABLE IF NOT EXISTS life_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL,
    goal_name VARCHAR(255) NOT NULL,
    target_age INTEGER,
    target_amount DECIMAL(12, 2),
    one_time_expense BOOLEAN DEFAULT TRUE,
    annual_expense_amount DECIMAL(12, 2),
    expense_duration_years INTEGER,
    priority VARCHAR(20) DEFAULT 'medium',
    notes TEXT,
    funding_sources JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sender VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    conversation_id VARCHAR(255),
    metadata JSONB
);

-- PDF Reports table
CREATE TABLE IF NOT EXISTS pdf_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    report_data JSONB NOT NULL,
    file_path VARCHAR(500),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Education goals table
CREATE TABLE IF NOT EXISTS education_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_name VARCHAR(255) NOT NULL,
    child_age INTEGER NOT NULL,
    college_start_year INTEGER NOT NULL,
    college_type VARCHAR(50),
    estimated_annual_cost DECIMAL(12, 2),
    years_of_education INTEGER DEFAULT 4,
    current_savings DECIMAL(12, 2) DEFAULT 0,
    monthly_contribution DECIMAL(12, 2) DEFAULT 0,
    state_of_residence VARCHAR(2),
    state_529_plan VARCHAR(100),
    funding_sources JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Estate planning tables
CREATE TABLE IF NOT EXISTS estate_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    has_will BOOLEAN DEFAULT FALSE,
    will_last_updated DATE,
    has_trust BOOLEAN DEFAULT FALSE,
    trust_type VARCHAR(100),
    has_power_of_attorney BOOLEAN DEFAULT FALSE,
    has_healthcare_directive BOOLEAN DEFAULT FALSE,
    executor_name VARCHAR(255),
    executor_relationship VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estate_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_reviewed DATE,
    expiry_date DATE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS estate_beneficiaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_type VARCHAR(100) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    primary_beneficiary VARCHAR(255),
    primary_beneficiary_relationship VARCHAR(100),
    primary_beneficiary_percentage DECIMAL(5, 2),
    contingent_beneficiary VARCHAR(255),
    contingent_beneficiary_relationship VARCHAR(100),
    contingent_beneficiary_percentage DECIMAL(5, 2),
    last_updated DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Investment cache table
CREATE TABLE IF NOT EXISTS investment_cache (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cache_key VARCHAR(255) NOT NULL,
    cache_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(user_id, cache_key)
);

-- Plaid integration tables
CREATE TABLE IF NOT EXISTS plaid_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    item_id VARCHAR(255) NOT NULL,
    institution_id VARCHAR(255),
    institution_name VARCHAR(255),
    cursor TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS plaid_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    official_name VARCHAR(255),
    type VARCHAR(50),
    subtype VARCHAR(50),
    mask VARCHAR(10),
    current_balance DECIMAL(12, 2),
    available_balance DECIMAL(12, 2),
    iso_currency_code VARCHAR(3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id)
);

CREATE TABLE IF NOT EXISTS plaid_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2),
    iso_currency_code VARCHAR(3),
    category JSONB,
    category_id VARCHAR(50),
    date DATE,
    authorized_date DATE,
    name VARCHAR(255),
    merchant_name VARCHAR(255),
    payment_channel VARCHAR(50),
    pending BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_id)
);

CREATE TABLE IF NOT EXISTS plaid_holdings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id VARCHAR(255) NOT NULL,
    security_id VARCHAR(255),
    institution_price DECIMAL(12, 4),
    institution_price_as_of DATE,
    institution_value DECIMAL(12, 2),
    cost_basis DECIMAL(12, 2),
    quantity DECIMAL(12, 4),
    iso_currency_code VARCHAR(3),
    unofficial_currency_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plaid_securities (
    id SERIAL PRIMARY KEY,
    security_id VARCHAR(255) UNIQUE NOT NULL,
    isin VARCHAR(12),
    cusip VARCHAR(9),
    sedol VARCHAR(7),
    institution_security_id VARCHAR(255),
    institution_id VARCHAR(255),
    proxy_security_id VARCHAR(255),
    name VARCHAR(255),
    ticker_symbol VARCHAR(10),
    is_cash_equivalent BOOLEAN DEFAULT FALSE,
    type VARCHAR(50),
    close_price DECIMAL(12, 4),
    close_price_as_of DATE,
    iso_currency_code VARCHAR(3),
    unofficial_currency_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session table for authentication
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (sid)
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);

-- Gamification tables
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(100) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS section_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section_name VARCHAR(100) NOT NULL,
    completion_percentage INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, section_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_id ON financial_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_life_goals_user_id ON life_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_education_goals_user_id ON education_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user_id ON plaid_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_user_id ON plaid_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_date ON plaid_transactions(date);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_profiles_updated_at BEFORE UPDATE ON financial_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_life_goals_updated_at BEFORE UPDATE ON life_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_education_goals_updated_at BEFORE UPDATE ON education_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estate_plans_updated_at BEFORE UPDATE ON estate_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();