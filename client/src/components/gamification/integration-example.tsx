import React from 'react';
import { PersistentAchievementBar } from './persistent-achievement-bar';
import { useAchievements } from '../../hooks/useAchievements';
import { DashboardGamification, RetirementGamification, EducationGamification } from './gamification-wrapper';
import { TrackingButton, TrackingForm, CalculatorTracker, MilestoneTracker } from './tracking-components';

// Example of how to integrate the achievement system into your main app layout
export const AppWithAchievements: React.FC<{ userId: number; children: React.ReactNode }> = ({ 
  userId, 
  children 
}) => {
  const {
    progress,
    levelInfo,
    achievements,
    sectionProgress,
    recentAchievement,
    loading
  } = useAchievements(userId);

  if (loading) {
    return <div>Loading achievements...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Persistent Achievement Bar at the top */}
      <PersistentAchievementBar
        userId={userId.toString()}
        currentLevel={levelInfo?.level || 1}
        currentXP={levelInfo?.currentXP || 0}
        xpToNext={levelInfo?.xpToNext || 100}
        streakDays={progress?.currentStreak || 0}
        recentAchievement={recentAchievement || undefined}
        achievements={achievements}
        sectionProgress={sectionProgress}
      />

      {/* Main Content */}
      <main className="pt-4">
        {children}
      </main>
    </div>
  );
};

// Example Dashboard component with gamification
export const ExampleDashboard: React.FC<{ userId: number }> = ({ userId }) => {
  return (
    <DashboardGamification userId={userId}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Financial Dashboard</h1>
        
        {/* Health Score Section with Milestone Tracking */}
        <MilestoneTracker
          milestoneType="health-score-view"
          threshold={1}
          currentValue={1}
          celebrationText="Health Score Viewed!"
          xpReward={15}
        >
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Financial Health Score</h2>
            <div className="text-4xl font-bold text-green-600">85</div>
            <p className="text-gray-600">Excellent financial health!</p>
          </div>
        </MilestoneTracker>

        {/* Action buttons that track engagement */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TrackingButton
            actionType="navigation"
            actionTarget="retirement-prep"
            celebrationText="Exploring Retirement!"
            xpReward={10}
            className="bg-blue-500 text-white px-6 py-4 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retirement Planning
          </TrackingButton>

          <TrackingButton
            actionType="navigation"
            actionTarget="investment-planning"
            celebrationText="Investment Explorer!"
            xpReward={10}
            className="bg-green-500 text-white px-6 py-4 rounded-lg hover:bg-green-600 transition-colors"
          >
            Investment Planning
          </TrackingButton>

          <TrackingButton
            actionType="navigation"
            actionTarget="tax-strategies"
            celebrationText="Tax Optimizer!"
            xpReward={10}
            className="bg-purple-500 text-white px-6 py-4 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Tax Strategies
          </TrackingButton>
        </div>
      </div>
    </DashboardGamification>
  );
};

// Example Retirement Planning component with gamification
export const ExampleRetirementPlanning: React.FC<{ userId: number }> = ({ userId }) => {
  const [monthlyContribution, setMonthlyContribution] = React.useState(500);
  const [retirementAge, setRetirementAge] = React.useState(65);

  return (
    <RetirementGamification userId={userId}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Retirement Planning</h1>

        {/* Calculator with tracking */}
        <CalculatorTracker calculatorType="retirement-calculator">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Retirement Calculator</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Contribution
                </label>
                <input
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Retirement Age
                </label>
                <input
                  type="number"
                  value={retirementAge}
                  onChange={(e) => setRetirementAge(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <TrackingButton
              actionType="calculator-run"
              actionTarget="retirement-calculator"
              celebrationText="Calculation Complete!"
              xpReward={20}
              className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition-colors"
            >
              Calculate Retirement Needs
            </TrackingButton>
          </div>
        </CalculatorTracker>

        {/* Milestone tracking for large contributions */}
        <MilestoneTracker
          milestoneType="high-contribution"
          threshold={1000}
          currentValue={monthlyContribution}
          celebrationText="High Saver! 🎉"
          xpReward={50}
        >
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              Monthly contribution: ${monthlyContribution.toLocaleString()}
            </p>
          </div>
        </MilestoneTracker>
      </div>
    </RetirementGamification>
  );
};

// Example Education Planning with form tracking
export const ExampleEducationPlanning: React.FC<{ userId: number }> = ({ userId }) => {
  const [studentName, setStudentName] = React.useState('');
  const [startYear, setStartYear] = React.useState(2030);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Education goal submitted:', { studentName, startYear });
  };

  return (
    <EducationGamification userId={userId}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Education Planning</h1>

        {/* Form with tracking */}
        <TrackingForm
          actionType="education-goal-submission"
          actionTarget="education-planning"
          celebrationText="Education Goal Created!"
          xpReward={75}
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow p-6"
        >
          <h2 className="text-xl font-semibold mb-4">Create Education Goal</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student Name
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                College Start Year
              </label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              className="bg-indigo-500 text-white px-6 py-2 rounded-md hover:bg-indigo-600 transition-colors"
            >
              Create Education Goal
            </button>
          </div>
        </TrackingForm>
      </div>
    </EducationGamification>
  );
};

// Integration instructions (commented out for reference)
/*
INTEGRATION GUIDE:

1. **App-wide Setup:**
   - Wrap your main app component with achievement tracking
   - Add the PersistentAchievementBar at the top level
   - Initialize the achievement system with user ID

2. **Page-level Integration:**
   - Wrap each major section (Dashboard, Retirement, etc.) with its corresponding gamification component
   - Example: <DashboardGamification userId={userId}>...</DashboardGamification>

3. **Component-level Tracking:**
   - Replace regular buttons with TrackingButton for action tracking
   - Use TrackingForm for form submissions
   - Wrap calculators with CalculatorTracker
   - Add MilestoneTracker for progress celebrations

4. **Database Migration:**
   - Run database migration to create achievement tables
   - Initialize achievement definitions in the database

5. **Custom Tracking:**
   - Use the useGamification hook in components for custom tracking
   - Call trackAction() for specific interactions
   - Use addMicroCelebration() for instant feedback

6. **Achievement Definitions:**
   - Modify ACHIEVEMENT_DEFINITIONS in achievement-definitions.ts
   - Add new achievements as needed
   - Sync with database achievement_definitions table

Example usage in existing components:

// Instead of:
<button onClick={handleClick}>Save Changes</button>

// Use:
<TrackingButton 
  actionType="data-save" 
  actionTarget="financial-profile"
  celebrationText="Progress Saved!"
  xpReward={10}
  onClick={handleClick}
>
  Save Changes
</TrackingButton>
*/

export default {
  AppWithAchievements,
  ExampleDashboard,
  ExampleRetirementPlanning,
  ExampleEducationPlanning
};