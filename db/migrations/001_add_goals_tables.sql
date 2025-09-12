-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'custom',
  description TEXT NOT NULL,
  target_amount_today DECIMAL(12, 2) NOT NULL,
  target_date TIMESTAMP NOT NULL,
  inflation_assumption_pct DECIMAL(5, 2) DEFAULT 2.5,
  priority INTEGER NOT NULL DEFAULT 1,
  funding_source_account_ids JSONB,
  current_savings DECIMAL(12, 2) DEFAULT 0,
  risk_preference TEXT DEFAULT 'moderate',
  success_threshold_pct DECIMAL(5, 2) DEFAULT 70,
  notes TEXT,
  probability_of_success DECIMAL(5, 2),
  last_calculated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Goal tasks table
CREATE TABLE IF NOT EXISTS goal_tasks (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT,
  due_date TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Goal audit log table
CREATE TABLE IF NOT EXISTS goal_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES goal_tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_priority ON goals(priority);
CREATE INDEX idx_goal_tasks_goal_id ON goal_tasks(goal_id);
CREATE INDEX idx_goal_tasks_user_id ON goal_tasks(user_id);
CREATE INDEX idx_goal_tasks_status ON goal_tasks(status);
CREATE INDEX idx_goal_audit_log_user_id ON goal_audit_log(user_id);
CREATE INDEX idx_goal_audit_log_goal_id ON goal_audit_log(goal_id);
CREATE INDEX idx_goal_audit_log_task_id ON goal_audit_log(task_id);