-- Add missing columns to debt_payoff_plans table if they don't exist
DO $$ 
BEGIN
    -- Check if strategy_config column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debt_payoff_plans' 
                   AND column_name = 'strategy_config') THEN
        ALTER TABLE debt_payoff_plans ADD COLUMN strategy_config jsonb;
    END IF;
    
    -- Check if auto_pay_enabled column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debt_payoff_plans' 
                   AND column_name = 'auto_pay_enabled') THEN
        ALTER TABLE debt_payoff_plans ADD COLUMN auto_pay_enabled boolean DEFAULT false;
    END IF;
END $$;