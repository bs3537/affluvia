SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('debts','debt_payoff_plans','plaid_liabilities')
ORDER BY table_name, column_name;
