export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'intake' | 'dashboard' | 'retirement' | 'education' | 'estate' | 'tax' | 'investment' | 'engagement';
  xp: number;
  requirement: {
    type: 'visit' | 'time' | 'action' | 'streak' | 'completion';
    value: number;
    target?: string;
  };
  unlocked: boolean;
  unlockedAt?: Date;
}

export const ACHIEVEMENT_DEFINITIONS: Achievement[] = [
  // Intake Form Achievements
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Begin your financial journey',
    icon: '🚀',
    category: 'intake',
    xp: 25,
    requirement: { type: 'visit', value: 1, target: 'intake-form' },
    unlocked: false
  },
  {
    id: 'financial-foundation',
    name: 'Financial Foundation',
    description: 'Complete your income and assets',
    icon: '🏗️',
    category: 'intake',
    xp: 50,
    requirement: { type: 'completion', value: 5, target: 'intake-step' },
    unlocked: false
  },
  {
    id: 'risk-warrior',
    name: 'Risk Warrior',
    description: 'Complete investment profile',
    icon: '⚔️',
    category: 'intake',
    xp: 75,
    requirement: { type: 'completion', value: 8, target: 'intake-step' },
    unlocked: false
  },
  {
    id: 'planning-pro',
    name: 'Planning Pro',
    description: 'Complete retirement planning section',
    icon: '📋',
    category: 'intake',
    xp: 100,
    requirement: { type: 'completion', value: 12, target: 'intake-step' },
    unlocked: false
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Complete intake form in under 10 minutes',
    icon: '⚡',
    category: 'intake',
    xp: 150,
    requirement: { type: 'time', value: 600, target: 'intake-completion' },
    unlocked: false
  },
  {
    id: 'momentum-master',
    name: 'Momentum Master',
    description: 'Complete 5 steps in a row without breaks',
    icon: '🎯',
    category: 'intake',
    xp: 100,
    requirement: { type: 'streak', value: 5, target: 'intake-steps' },
    unlocked: false
  },
  {
    id: 'financial-champion',
    name: 'Financial Champion',
    description: 'Complete entire financial profile',
    icon: '🏆',
    category: 'intake',
    xp: 200,
    requirement: { type: 'completion', value: 100, target: 'intake-form' },
    unlocked: false
  },
  {
    id: 'detail-master',
    name: 'Detail Master',
    description: 'Provide comprehensive financial data',
    icon: '📊',
    category: 'intake',
    xp: 75,
    requirement: { type: 'action', value: 20, target: 'form-fields' },
    unlocked: false
  },
  {
    id: 'goal-setter',
    name: 'Goal Setter',
    description: 'Define 5+ financial goals',
    icon: '🎯',
    category: 'intake',
    xp: 100,
    requirement: { type: 'action', value: 5, target: 'financial-goals' },
    unlocked: false
  },
  {
    id: 'family-planner',
    name: 'Family Planner',
    description: 'Complete spouse financial profile',
    icon: '👨‍👩‍👧‍👦',
    category: 'intake',
    xp: 125,
    requirement: { type: 'completion', value: 100, target: 'spouse-profile' },
    unlocked: false
  },

  // Dashboard Achievements
  {
    id: 'dashboard-explorer',
    name: 'Dashboard Explorer',
    description: 'Visit dashboard 5 times',
    icon: '🗺️',
    category: 'dashboard',
    xp: 50,
    requirement: { type: 'visit', value: 5, target: 'dashboard' },
    unlocked: false
  },
  {
    id: 'metric-master',
    name: 'Metric Master',
    description: 'View all financial health scores',
    icon: '📈',
    category: 'dashboard',
    xp: 75,
    requirement: { type: 'action', value: 7, target: 'health-scores' },
    unlocked: false
  },
  {
    id: 'trend-tracker',
    name: 'Trend Tracker',
    description: 'Check dashboard 7 days in a row',
    icon: '📊',
    category: 'dashboard',
    xp: 150,
    requirement: { type: 'streak', value: 7, target: 'dashboard-visits' },
    unlocked: false
  },
  {
    id: 'insight-seeker',
    name: 'Insight Seeker',
    description: 'Read all personalized recommendations',
    icon: '🔍',
    category: 'dashboard',
    xp: 100,
    requirement: { type: 'action', value: 10, target: 'recommendations' },
    unlocked: false
  },
  {
    id: 'morning-ritual',
    name: 'Morning Ritual',
    description: 'Check dashboard before 10 AM',
    icon: '🌅',
    category: 'dashboard',
    xp: 25,
    requirement: { type: 'action', value: 1, target: 'morning-check' },
    unlocked: false
  },

  // Retirement Planning Achievements
  {
    id: 'retirement-rookie',
    name: 'Retirement Rookie',
    description: 'First visit to retirement section',
    icon: '🏖️',
    category: 'retirement',
    xp: 25,
    requirement: { type: 'visit', value: 1, target: 'retirement-prep' },
    unlocked: false
  },
  {
    id: 'future-focused',
    name: 'Future Focused',
    description: 'Complete retirement goal setting',
    icon: '🔮',
    category: 'retirement',
    xp: 100,
    requirement: { type: 'completion', value: 100, target: 'retirement-goals' },
    unlocked: false
  },
  {
    id: 'savings-strategist',
    name: 'Savings Strategist',
    description: 'Explore 3+ retirement scenarios',
    icon: '💰',
    category: 'retirement',
    xp: 125,
    requirement: { type: 'action', value: 3, target: 'scenario-modeling' },
    unlocked: false
  },
  {
    id: 'roth-converter',
    name: 'Roth Converter',
    description: 'Use Roth conversion optimizer',
    icon: '🔄',
    category: 'retirement',
    xp: 150,
    requirement: { type: 'action', value: 1, target: 'roth-optimizer' },
    unlocked: false
  },

  // Education Funding Achievements
  {
    id: 'education-champion',
    name: 'Education Champion',
    description: 'Start education planning',
    icon: '🎓',
    category: 'education',
    xp: 25,
    requirement: { type: 'visit', value: 1, target: 'education-funding' },
    unlocked: false
  },
  {
    id: 'smart-saver',
    name: 'Smart Saver',
    description: 'Explore education savings options',
    icon: '🧠',
    category: 'education',
    xp: 75,
    requirement: { type: 'action', value: 3, target: 'savings-options' },
    unlocked: false
  },
  {
    id: 'dream-enabler',
    name: 'Dream Enabler',
    description: 'Set education funding goals for family',
    icon: '✨',
    category: 'education',
    xp: 100,
    requirement: { type: 'completion', value: 100, target: 'education-goals' },
    unlocked: false
  },
  {
    id: 'learning-investor',
    name: 'Learning Investor',
    description: 'Complete 529 plan analysis',
    icon: '📚',
    category: 'education',
    xp: 125,
    requirement: { type: 'action', value: 1, target: '529-analysis' },
    unlocked: false
  },

  // Estate Planning Achievements
  {
    id: 'legacy-builder',
    name: 'Legacy Builder',
    description: 'Begin estate planning',
    icon: '🏛️',
    category: 'estate',
    xp: 25,
    requirement: { type: 'visit', value: 1, target: 'estate-planning' },
    unlocked: false
  },
  {
    id: 'protection-pro',
    name: 'Protection Pro',
    description: 'Complete insurance analysis',
    icon: '🛡️',
    category: 'estate',
    xp: 100,
    requirement: { type: 'completion', value: 100, target: 'insurance-analysis' },
    unlocked: false
  },
  {
    id: 'will-warrior',
    name: 'Will Warrior',
    description: 'Explore estate planning tools',
    icon: '📜',
    category: 'estate',
    xp: 75,
    requirement: { type: 'action', value: 3, target: 'estate-tools' },
    unlocked: false
  },

  // Tax Strategies Achievements
  {
    id: 'tax-optimizer',
    name: 'Tax Optimizer',
    description: 'Explore tax reduction strategies',
    icon: '📋',
    category: 'tax',
    xp: 25,
    requirement: { type: 'visit', value: 1, target: 'tax-strategies' },
    unlocked: false
  },
  {
    id: 'deduction-detective',
    name: 'Deduction Detective',
    description: 'Find tax savings opportunities',
    icon: '🕵️',
    category: 'tax',
    xp: 100,
    requirement: { type: 'action', value: 5, target: 'tax-opportunities' },
    unlocked: false
  },
  {
    id: 'strategy-specialist',
    name: 'Strategy Specialist',
    description: 'Implement tax strategies',
    icon: '⚡',
    category: 'tax',
    xp: 150,
    requirement: { type: 'action', value: 3, target: 'strategy-implementation' },
    unlocked: false
  },

  // Investment Planning Achievements
  {
    id: 'portfolio-pioneer',
    name: 'Portfolio Pioneer',
    description: 'Start investment planning',
    icon: '🚀',
    category: 'investment',
    xp: 25,
    requirement: { type: 'visit', value: 1, target: 'investment-planning' },
    unlocked: false
  },
  {
    id: 'diversification-expert',
    name: 'Diversification Expert',
    description: 'Explore asset allocation',
    icon: '📊',
    category: 'investment',
    xp: 100,
    requirement: { type: 'action', value: 1, target: 'asset-allocation' },
    unlocked: false
  },
  {
    id: 'risk-manager',
    name: 'Risk Manager',
    description: 'Complete risk assessment',
    icon: '⚖️',
    category: 'investment',
    xp: 75,
    requirement: { type: 'completion', value: 100, target: 'risk-assessment' },
    unlocked: false
  },

  // Engagement Achievements
  {
    id: 'seven-day-streak',
    name: '7-Day Streak',
    description: 'Use app 7 consecutive days',
    icon: '🔥',
    category: 'engagement',
    xp: 200,
    requirement: { type: 'streak', value: 7, target: 'daily-usage' },
    unlocked: false
  },
  {
    id: 'monthly-maven',
    name: 'Monthly Maven',
    description: 'Active for 30 days',
    icon: '📅',
    category: 'engagement',
    xp: 500,
    requirement: { type: 'streak', value: 30, target: 'monthly-usage' },
    unlocked: false
  },
  {
    id: 'financial-fanatic',
    name: 'Financial Fanatic',
    description: '100+ app sessions',
    icon: '💎',
    category: 'engagement',
    xp: 1000,
    requirement: { type: 'action', value: 100, target: 'app-sessions' },
    unlocked: false
  }
];

export const LEVEL_THRESHOLDS = [
  { level: 1, xpRequired: 0, title: 'Financial Newbie', theme: 'emerald' },
  { level: 2, xpRequired: 100, title: 'Financial Newbie', theme: 'emerald' },
  { level: 3, xpRequired: 250, title: 'Financial Newbie', theme: 'emerald' },
  { level: 4, xpRequired: 500, title: 'Money Smart', theme: 'blue' },
  { level: 5, xpRequired: 800, title: 'Money Smart', theme: 'blue' },
  { level: 6, xpRequired: 1200, title: 'Money Smart', theme: 'blue' },
  { level: 7, xpRequired: 1700, title: 'Financial Pro', theme: 'purple' },
  { level: 8, xpRequired: 2300, title: 'Financial Pro', theme: 'purple' },
  { level: 9, xpRequired: 3000, title: 'Financial Pro', theme: 'purple' },
  { level: 10, xpRequired: 3800, title: 'Wealth Wizard', theme: 'yellow' },
  { level: 11, xpRequired: 4700, title: 'Wealth Wizard', theme: 'yellow' },
  { level: 12, xpRequired: 5700, title: 'Wealth Wizard', theme: 'yellow' },
  { level: 13, xpRequired: 6800, title: 'Financial Master', theme: 'slate' }
];

export const calculateLevel = (totalXP: number) => {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i].xpRequired) {
      const currentLevel = LEVEL_THRESHOLDS[i];
      const nextLevel = LEVEL_THRESHOLDS[i + 1];
      
      return {
        level: currentLevel.level,
        title: currentLevel.title,
        theme: currentLevel.theme,
        currentXP: totalXP - currentLevel.xpRequired,
        xpToNext: nextLevel ? nextLevel.xpRequired - totalXP : 0,
        isMaxLevel: !nextLevel
      };
    }
  }
  
  return {
    level: 1,
    title: 'Financial Newbie',
    theme: 'emerald',
    currentXP: totalXP,
    xpToNext: 100 - totalXP,
    isMaxLevel: false
  };
};