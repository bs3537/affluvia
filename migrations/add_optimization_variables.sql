-- Add optimization_variables column to financial_profiles table
-- This stores the locked optimization variables from the retirement planning optimization tab
ALTER TABLE financial_profiles 
ADD COLUMN optimization_variables jsonb DEFAULT NULL;

-- The optimization_variables will store:
-- {
--   "retirementAge": 67,
--   "spouseRetirementAge": 67,
--   "socialSecurityAge": 70,
--   "spouseSocialSecurityAge": 70,
--   "assetAllocation": "7",
--   "monthlyContributions": 3000,
--   "monthlyExpenses": 7000,
--   "partTimeIncome": 2000,
--   "spousePartTimeIncome": 1500,
--   "lockedAt": "2024-01-15T10:30:00Z"
-- }