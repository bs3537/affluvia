-- Add individual allocation fields for Gemini API integration
-- These fields will store the Plaid-calculated asset allocation percentages
-- for direct access by the Gemini API recommendation engine

ALTER TABLE financial_profiles
ADD COLUMN current_stock_allocation DECIMAL(5,2),
ADD COLUMN current_bond_allocation DECIMAL(5,2), 
ADD COLUMN current_cash_allocation DECIMAL(5,2),
ADD COLUMN current_alternatives_allocation DECIMAL(5,2);

-- Add comments for documentation
COMMENT ON COLUMN financial_profiles.current_stock_allocation IS 'Current stocks allocation percentage from Plaid data';
COMMENT ON COLUMN financial_profiles.current_bond_allocation IS 'Current bonds allocation percentage from Plaid data'; 
COMMENT ON COLUMN financial_profiles.current_cash_allocation IS 'Current cash allocation percentage from Plaid data';
COMMENT ON COLUMN financial_profiles.current_alternatives_allocation IS 'Current alternatives allocation percentage from Plaid data';