-- Add loan-related fields to education_goals table
ALTER TABLE education_goals
ADD COLUMN IF NOT EXISTS loan_interest_rate DECIMAL(5, 2) DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS loan_repayment_term INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS loan_type TEXT;

-- Add monthly debt payments to financial_profiles table
ALTER TABLE financial_profiles
ADD COLUMN IF NOT EXISTS monthly_debt_payments DECIMAL(12, 2) DEFAULT 0;