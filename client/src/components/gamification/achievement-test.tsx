import React from 'react';
import { useAchievements } from '../../hooks/useAchievements';
import { TrackingButton } from './tracking-components';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AchievementTestProps {
  userId: number;
}

export const AchievementTest: React.FC<AchievementTestProps> = ({ userId }) => {
  const {
    progress,
    levelInfo,
    achievements,
    sectionProgress,
    recentAchievement,
    loading,
    error,
    trackVisit,
    trackAction,
    trackTime,
    unlockAchievement,
    refreshProgress
  } = useAchievements(userId);

  if (loading) return <div>Loading achievements...</div>;
  if (error) return <div>Error: {error}</div>;

  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const lockedAchievements = achievements.filter(a => !a.unlocked);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Achievement System Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Progress */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Level</h3>
              <p className="text-2xl font-bold text-blue-600">{levelInfo?.level || 1}</p>
              <p className="text-sm text-blue-700">{levelInfo?.title}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">Total XP</h3>
              <p className="text-2xl font-bold text-green-600">{progress?.totalXP || 0}</p>
              <p className="text-sm text-green-700">XP to next: {levelInfo?.xpToNext || 0}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-semibold text-orange-900">Current Streak</h3>
              <p className="text-2xl font-bold text-orange-600">{progress?.currentStreak || 0}</p>
              <p className="text-sm text-orange-700">days</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">Achievements</h3>
              <p className="text-2xl font-bold text-purple-600">{unlockedAchievements.length}</p>
              <p className="text-sm text-purple-700">of {achievements.length}</p>
            </div>
          </div>

          {/* Test Actions */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Test Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <TrackingButton
                onClick={() => trackVisit('dashboard')}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                actionType="visit"
                actionTarget="dashboard"
                celebrationText="Dashboard Visited!"
                xpReward={10}
              >
                Visit Dashboard
              </TrackingButton>

              <TrackingButton
                onClick={() => trackAction('calculator-usage', 'retirement-calculator')}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                actionType="calculator-usage"
                actionTarget="retirement-calculator"
                celebrationText="Calculator Used!"
                xpReward={15}
              >
                Use Calculator
              </TrackingButton>

              <TrackingButton
                onClick={() => trackTime('retirement-prep', 60)}
                className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                actionType="time-tracking"
                actionTarget="retirement-prep"
                celebrationText="Time Tracked!"
              >
                Track 1 Min
              </TrackingButton>

              <Button
                onClick={() => unlockAchievement('first-steps')}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
              >
                Unlock First Steps
              </Button>
            </div>
          </div>

          {/* Recent Achievement */}
          {recentAchievement && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Recent Achievement</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{recentAchievement.icon}</span>
                  <div>
                    <p className="font-semibold text-yellow-900">{recentAchievement.name}</p>
                    <p className="text-sm text-yellow-700">{recentAchievement.description}</p>
                    <p className="text-xs text-yellow-600">+{recentAchievement.xp} XP</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unlocked Achievements */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Unlocked Achievements ({unlockedAchievements.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
              {unlockedAchievements.map(achievement => (
                <div key={achievement.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{achievement.icon}</span>
                    <div>
                      <p className="font-medium text-green-900">{achievement.name}</p>
                      <p className="text-sm text-green-700">{achievement.description}</p>
                      <p className="text-xs text-green-600">+{achievement.xp} XP</p>
                    </div>
                  </div>
                </div>
              ))}
              {unlockedAchievements.length === 0 && (
                <p className="text-gray-500 col-span-2">No achievements unlocked yet. Start using the app!</p>
              )}
            </div>
          </div>

          {/* Section Progress */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Section Progress</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sectionProgress.map(section => (
                <div key={section.category} className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900">{section.category}</h4>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>{section.completed}/{section.total}</span>
                      <span>{Math.round(section.progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${section.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <Button 
              onClick={refreshProgress}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Refresh Progress
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AchievementTest;