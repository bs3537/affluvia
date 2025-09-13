-- Sample goals for demo user (assuming user_id = 1)
INSERT INTO goals (user_id, type, description, target_amount_today, target_date, inflation_assumption_pct, priority, current_savings, risk_preference, success_threshold_pct, notes)
VALUES 
  (1, 'retirement', 'Comfortable Retirement at 65', 2000000, '2055-01-01', 2.5, 1, 125000, 'moderate', 85, 'Planning for a comfortable retirement with travel and hobbies'),
  (1, 'college', 'College Fund for Children', 200000, '2040-09-01', 5.0, 2, 25000, 'moderate', 80, 'Fund for 2 children attending 4-year universities'),
  (1, 'home', 'Dream Home Down Payment', 150000, '2028-06-01', 3.0, 3, 45000, 'conservative', 90, '20% down payment for a home in desired neighborhood');

-- Sample tasks for the goals
INSERT INTO goal_tasks (goal_id, user_id, title, description, assignee, due_date, status)
VALUES
  (1, 1, 'Review 401k allocation', 'Ensure proper diversification across asset classes', 'user', '2025-07-15', 'pending'),
  (1, 1, 'Increase contribution rate', 'Bump up 401k contribution by 1%', 'user', '2025-08-01', 'pending'),
  (1, 1, 'Meet with financial advisor', 'Annual retirement planning review', 'user', '2025-09-01', 'pending'),
  (2, 1, 'Open 529 account', 'Research and open tax-advantaged education savings account', 'user', '2025-07-01', 'pending'),
  (2, 1, 'Set up automatic contributions', 'Configure monthly $500 auto-transfer to 529', 'spouse', '2025-07-10', 'pending'),
  (3, 1, 'Get pre-approval letter', 'Contact lenders for mortgage pre-approval', 'user', '2025-08-15', 'pending'),
  (3, 1, 'Research neighborhoods', 'Visit top 5 neighborhoods and compare', 'spouse', '2025-07-30', 'in_progress');