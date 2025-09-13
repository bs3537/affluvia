-- Add Achievement System Tables
-- Migration: 0004_add_achievement_system

-- User Achievements table - tracks which achievements each user has unlocked
CREATE TABLE "user_achievements" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "achievement_id" text NOT NULL,
  "unlocked_at" timestamp DEFAULT now(),
  "xp_earned" integer NOT NULL
);

-- User Progress table - tracks overall user progress, XP, level, streaks
CREATE TABLE "user_progress" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "total_xp" integer DEFAULT 0,
  "current_level" integer DEFAULT 1,
  "current_streak" integer DEFAULT 0,
  "longest_streak" integer DEFAULT 0,
  "last_visit" timestamp DEFAULT now(),
  "session_stats" jsonb,
  "updated_at" timestamp DEFAULT now()
);

-- Section Progress table - tracks user activity in each app section
CREATE TABLE "section_progress" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "section" text NOT NULL,
  "visits" integer DEFAULT 0,
  "time_spent" integer DEFAULT 0,
  "actions_completed" integer DEFAULT 0,
  "last_visit" timestamp DEFAULT now(),
  "completion_percentage" numeric(5,2) DEFAULT '0',
  "updated_at" timestamp DEFAULT now()
);

-- Achievement Definitions table - stores all available achievements
CREATE TABLE "achievement_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "icon" text NOT NULL,
  "category" text NOT NULL,
  "xp" integer NOT NULL,
  "requirement_type" text NOT NULL,
  "requirement_value" integer NOT NULL,
  "requirement_target" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievement_definitions_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "achievement_definitions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "section_progress" ADD CONSTRAINT "section_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

-- Add indexes for performance
CREATE INDEX "idx_user_achievements_user_id" ON "user_achievements" ("user_id");
CREATE INDEX "idx_user_achievements_achievement_id" ON "user_achievements" ("achievement_id");
CREATE INDEX "idx_user_progress_user_id" ON "user_progress" ("user_id");
CREATE INDEX "idx_section_progress_user_id" ON "section_progress" ("user_id");
CREATE INDEX "idx_section_progress_section" ON "section_progress" ("section");
CREATE UNIQUE INDEX "idx_user_progress_user_unique" ON "user_progress" ("user_id");
CREATE UNIQUE INDEX "idx_section_progress_user_section_unique" ON "section_progress" ("user_id", "section");

-- Insert achievement definitions
INSERT INTO "achievement_definitions" ("id", "name", "description", "icon", "category", "xp", "requirement_type", "requirement_value", "requirement_target") VALUES
-- Intake Form Achievements
('first-steps', 'First Steps', 'Begin your financial journey', '🚀', 'intake', 25, 'visit', 1, 'intake-form'),
('financial-foundation', 'Financial Foundation', 'Complete your income and assets', '🏗️', 'intake', 50, 'completion', 5, 'intake-step'),
('risk-warrior', 'Risk Warrior', 'Complete investment profile', '⚔️', 'intake', 75, 'completion', 8, 'intake-step'),
('planning-pro', 'Planning Pro', 'Complete retirement planning section', '📋', 'intake', 100, 'completion', 12, 'intake-step'),
('speed-demon', 'Speed Demon', 'Complete intake form in under 10 minutes', '⚡', 'intake', 150, 'time', 600, 'intake-completion'),
('momentum-master', 'Momentum Master', 'Complete 5 steps in a row without breaks', '🎯', 'intake', 100, 'streak', 5, 'intake-steps'),
('financial-champion', 'Financial Champion', 'Complete entire financial profile', '🏆', 'intake', 200, 'completion', 100, 'intake-form'),
('detail-master', 'Detail Master', 'Provide comprehensive financial data', '📊', 'intake', 75, 'action', 20, 'form-fields'),
('goal-setter', 'Goal Setter', 'Define 5+ financial goals', '🎯', 'intake', 100, 'action', 5, 'financial-goals'),
('family-planner', 'Family Planner', 'Complete spouse financial profile', '👨‍👩‍👧‍👦', 'intake', 125, 'completion', 100, 'spouse-profile'),

-- Dashboard Achievements
('dashboard-explorer', 'Dashboard Explorer', 'Visit dashboard 5 times', '🗺️', 'dashboard', 50, 'visit', 5, 'dashboard'),
('metric-master', 'Metric Master', 'View all financial health scores', '📈', 'dashboard', 75, 'action', 7, 'health-scores'),
('trend-tracker', 'Trend Tracker', 'Check dashboard 7 days in a row', '📊', 'dashboard', 150, 'streak', 7, 'dashboard-visits'),
('insight-seeker', 'Insight Seeker', 'Read all personalized recommendations', '🔍', 'dashboard', 100, 'action', 10, 'recommendations'),
('morning-ritual', 'Morning Ritual', 'Check dashboard before 10 AM', '🌅', 'dashboard', 25, 'action', 1, 'morning-check'),

-- Retirement Planning Achievements
('retirement-rookie', 'Retirement Rookie', 'First visit to retirement section', '🏖️', 'retirement', 25, 'visit', 1, 'retirement-prep'),
('future-focused', 'Future Focused', 'Complete retirement goal setting', '🔮', 'retirement', 100, 'completion', 100, 'retirement-goals'),
('savings-strategist', 'Savings Strategist', 'Explore 3+ retirement scenarios', '💰', 'retirement', 125, 'action', 3, 'scenario-modeling'),
('roth-converter', 'Roth Converter', 'Use Roth conversion optimizer', '🔄', 'retirement', 150, 'action', 1, 'roth-optimizer'),

-- Education Funding Achievements
('education-champion', 'Education Champion', 'Start education planning', '🎓', 'education', 25, 'visit', 1, 'education-funding'),
('smart-saver', 'Smart Saver', 'Explore education savings options', '🧠', 'education', 75, 'action', 3, 'savings-options'),
('dream-enabler', 'Dream Enabler', 'Set education funding goals for family', '✨', 'education', 100, 'completion', 100, 'education-goals'),
('learning-investor', 'Learning Investor', 'Complete 529 plan analysis', '📚', 'education', 125, 'action', 1, '529-analysis'),

-- Estate Planning Achievements
('legacy-builder', 'Legacy Builder', 'Begin estate planning', '🏛️', 'estate', 25, 'visit', 1, 'estate-planning'),
('protection-pro', 'Protection Pro', 'Complete insurance analysis', '🛡️', 'estate', 100, 'completion', 100, 'insurance-analysis'),
('will-warrior', 'Will Warrior', 'Explore estate planning tools', '📜', 'estate', 75, 'action', 3, 'estate-tools'),

-- Tax Strategies Achievements
('tax-optimizer', 'Tax Optimizer', 'Explore tax reduction strategies', '📋', 'tax', 25, 'visit', 1, 'tax-strategies'),
('deduction-detective', 'Deduction Detective', 'Find tax savings opportunities', '🕵️', 'tax', 100, 'action', 5, 'tax-opportunities'),
('strategy-specialist', 'Strategy Specialist', 'Implement tax strategies', '⚡', 'tax', 150, 'action', 3, 'strategy-implementation'),

-- Investment Planning Achievements
('portfolio-pioneer', 'Portfolio Pioneer', 'Start investment planning', '🚀', 'investment', 25, 'visit', 1, 'investment-planning'),
('diversification-expert', 'Diversification Expert', 'Explore asset allocation', '📊', 'investment', 100, 'action', 1, 'asset-allocation'),
('risk-manager', 'Risk Manager', 'Complete risk assessment', '⚖️', 'investment', 75, 'completion', 100, 'risk-assessment'),

-- Engagement Achievements
('seven-day-streak', '7-Day Streak', 'Use app 7 consecutive days', '🔥', 'engagement', 200, 'streak', 7, 'daily-usage'),
('monthly-maven', 'Monthly Maven', 'Active for 30 days', '📅', 'engagement', 500, 'streak', 30, 'monthly-usage'),
('financial-fanatic', 'Financial Fanatic', '100+ app sessions', '💎', 'engagement', 1000, 'action', 100, 'app-sessions');