import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Flame, Zap, ChevronDown, ChevronUp, X } from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlockedAt?: Date;
  xp: number;
}

interface AchievementProgress {
  category: string;
  completed: number;
  total: number;
  progress: number;
}

interface PersistentAchievementBarProps {
  userId?: string;
  currentLevel: number;
  currentXP: number;
  xpToNext: number;
  streakDays: number;
  recentAchievement?: Achievement;
  achievements: Achievement[];
  sectionProgress: AchievementProgress[];
}

export const PersistentAchievementBar: React.FC<PersistentAchievementBarProps> = ({
  currentLevel = 1,
  currentXP = 0,
  xpToNext = 100,
  streakDays = 0,
  recentAchievement,
  achievements = [],
  sectionProgress = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(false);

  const getLevelTheme = (level: number) => {
    if (level <= 3) return { theme: 'Financial Newbie', color: 'emerald', bg: 'bg-emerald-500' };
    if (level <= 6) return { theme: 'Money Smart', color: 'blue', bg: 'bg-blue-500' };
    if (level <= 9) return { theme: 'Financial Pro', color: 'purple', bg: 'bg-purple-500' };
    if (level <= 12) return { theme: 'Wealth Wizard', color: 'yellow', bg: 'bg-yellow-500' };
    return { theme: 'Financial Master', color: 'slate', bg: 'bg-slate-500' };
  };

  const levelInfo = getLevelTheme(currentLevel);
  const progressPercentage = (currentXP / (currentXP + xpToNext)) * 100;

  // Show new achievement notification
  useEffect(() => {
    if (recentAchievement && !recentAchievement.unlocked) {
      setShowNewBadge(true);
      const timer = setTimeout(() => setShowNewBadge(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [recentAchievement]);

  const getStreakIcon = () => {
    if (streakDays >= 7) return <Flame className="w-4 h-4 text-orange-500 animate-pulse" />;
    if (streakDays >= 3) return <Flame className="w-4 h-4 text-orange-400" />;
    return <Flame className="w-4 h-4 text-gray-400" />;
  };

  return (
    <>
      {/* Main Achievement Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            {/* Left Side - Level & Progress */}
            <div className="flex items-center space-x-4">
              {/* Avatar & Level */}
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full ${levelInfo.bg} flex items-center justify-center text-white text-sm font-bold`}>
                  {currentLevel}
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-semibold text-white">{levelInfo.theme}</div>
                  <div className="text-xs text-gray-300">Level {currentLevel}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="flex items-center space-x-2">
                <div className="w-24 sm:w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${levelInfo.bg} transition-all duration-500 ease-out`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-300 hidden sm:inline">
                  {currentXP}/{currentXP + xpToNext} XP
                </span>
              </div>
            </div>

            {/* Center - Recent Achievement */}
            {recentAchievement && (
              <div className="flex items-center space-x-2">
                {showNewBadge && (
                  <div className="flex items-center space-x-1 bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-xs animate-bounce border border-yellow-500/30">
                    <Trophy className="w-3 h-3" />
                    <span className="hidden sm:inline">NEW!</span>
                  </div>
                )}
                <div className="text-sm text-gray-200 hidden sm:block">
                  {recentAchievement.icon} {recentAchievement.name}
                </div>
              </div>
            )}

            {/* Right Side - Streak & Expand */}
            <div className="flex items-center space-x-3">
              {/* Streak Counter */}
              {streakDays > 0 && (
                <div className="flex items-center space-x-1">
                  {getStreakIcon()}
                  <span className="text-sm font-semibold text-gray-200">{streakDays}</span>
                  <Zap className="w-4 h-4 text-yellow-500" />
                </div>
              )}

              {/* Expand Button */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-300" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-300" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Achievement Panel */}
      {isExpanded && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-gray-800 shadow-lg border-b border-gray-600">
          <div className="max-w-7xl mx-auto p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-full ${levelInfo.bg} flex items-center justify-center text-white text-lg font-bold`}>
                  {currentLevel}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Level {currentLevel} - {levelInfo.theme}</h3>
                  <p className="text-sm text-gray-300">{achievements.filter(a => a.unlocked).length} achievements unlocked</p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-300" />
              </button>
            </div>

            {/* Recent Achievement Highlight */}
            {recentAchievement && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm font-semibold text-yellow-300">
                    Recent: {recentAchievement.icon} {recentAchievement.name} (+{recentAchievement.xp} XP)
                  </span>
                </div>
              </div>
            )}

            {/* Section Progress */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
              {sectionProgress.map((section, index) => (
                <div key={index} className="text-center">
                  <div className="text-sm font-medium text-gray-200 mb-1">{section.category}</div>
                  <div className="text-xs text-gray-400 mb-2">
                    {section.completed}/{section.total}
                  </div>
                  <div className="w-full h-2 bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${section.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Next Goal */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🎯</span>
                <span className="text-sm font-medium text-blue-300">
                  Next Goal: Complete Tax Strategies section (+50 XP)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spacer to prevent content from hiding behind fixed bar */}
      <div className="h-16" />
    </>
  );
};

export default PersistentAchievementBar;