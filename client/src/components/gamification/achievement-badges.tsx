import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Star, Zap, Trophy, Target, Shield, DollarSign, TrendingUp, User, FileText } from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  unlockedAt: number[];
  color: string;
  type: 'section' | 'milestone' | 'speed' | 'completion';
}

interface AchievementBadgesProps {
  currentStep: number;
  totalSteps: number;
  sessionTime: number;
  onNewAchievement: (achievement: Achievement) => void;
}

const achievements: Achievement[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: 'Started your financial journey',
    icon: User,
    unlockedAt: [1],
    color: 'bg-blue-500',
    type: 'section'
  },
  {
    id: 'financial-foundation',
    title: 'Financial Foundation',
    description: 'Completed income and assets',
    icon: DollarSign,
    unlockedAt: [5],
    color: 'bg-green-500',
    type: 'section'
  },
  {
    id: 'risk-warrior',
    title: 'Risk Warrior',
    description: 'Completed investment profile',
    icon: TrendingUp,
    unlockedAt: [8],
    color: 'bg-purple-500',
    type: 'section'
  },
  {
    id: 'planning-pro',
    title: 'Planning Pro',
    description: 'Completed retirement planning',
    icon: Target,
    unlockedAt: [12],
    color: 'bg-orange-500',
    type: 'completion'
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Completed in under 10 minutes',
    icon: Zap,
    unlockedAt: [12],
    color: 'bg-yellow-500',
    type: 'speed'
  },
  {
    id: 'momentum-master',
    title: 'Momentum Master',
    description: 'Completed 5 steps in a row',
    icon: Star,
    unlockedAt: [6],
    color: 'bg-indigo-500',
    type: 'milestone'
  },
  {
    id: 'financial-champion',
    title: 'Financial Champion',
    description: 'Completed entire profile in one session',
    icon: Trophy,
    unlockedAt: [12],
    color: 'bg-gold-500',
    type: 'completion'
  }
];

export function AchievementBadges({ currentStep, totalSteps, sessionTime, onNewAchievement }: AchievementBadgesProps) {
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [showNewAchievement, setShowNewAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    achievements.forEach(achievement => {
      if (!unlockedAchievements.has(achievement.id)) {
        let shouldUnlock = false;

        // Check step-based achievements
        if (achievement.type === 'section' || achievement.type === 'milestone') {
          shouldUnlock = achievement.unlockedAt.some(step => currentStep >= step);
        }

        // Check completion achievements
        if (achievement.type === 'completion' && currentStep >= totalSteps) {
          shouldUnlock = true;
        }

        // Check speed achievements
        if (achievement.type === 'speed' && achievement.id === 'speed-demon') {
          const timeMinutes = sessionTime / 60;
          shouldUnlock = currentStep >= totalSteps && timeMinutes < 10;
        }

        if (shouldUnlock) {
          setUnlockedAchievements(prev => new Set(Array.from(prev).concat([achievement.id])));
          setShowNewAchievement(achievement);
          onNewAchievement(achievement);

          // Hide new achievement after 3 seconds
          setTimeout(() => {
            setShowNewAchievement(null);
          }, 3000);
        }
      }
    });
  }, [currentStep, sessionTime, totalSteps, unlockedAchievements, onNewAchievement]);

  const getDisplayAchievements = () => {
    return achievements.filter(achievement => {
      // Show if unlocked
      if (unlockedAchievements.has(achievement.id)) return true;
      
      // Show next achievable achievement
      if (achievement.type === 'section' || achievement.type === 'milestone') {
        return achievement.unlockedAt.some(step => step === currentStep + 1 || step === currentStep + 2);
      }
      
      // Show completion achievements when close
      if (achievement.type === 'completion' || achievement.type === 'speed') {
        return currentStep >= totalSteps - 2;
      }
      
      return false;
    });
  };

  const displayAchievements = getDisplayAchievements();

  return (
    <>
      {/* Achievement Grid */}
      <Card className="bg-gray-800/30 border-gray-700 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-white font-medium text-sm">Achievements</span>
          <Badge variant="secondary" className="bg-[#B040FF]/20 text-[#B040FF] text-xs">
            {unlockedAchievements.size}/{achievements.length}
          </Badge>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {displayAchievements.map(achievement => {
            const isUnlocked = unlockedAchievements.has(achievement.id);
            const IconComponent = achievement.icon;

            return (
              <div
                key={achievement.id}
                className={`
                  relative p-2 rounded-lg border transition-all duration-300
                  ${isUnlocked 
                    ? `${achievement.color} border-transparent shadow-lg` 
                    : 'bg-gray-700/50 border-gray-600 opacity-60'
                  }
                `}
                title={achievement.description}
              >
                <div className="flex flex-col items-center gap-1">
                  <IconComponent className={`w-5 h-5 ${isUnlocked ? 'text-white' : 'text-gray-400'}`} />
                  <span className={`text-xs font-medium text-center leading-tight ${
                    isUnlocked ? 'text-white' : 'text-gray-400'
                  }`}>
                    {achievement.title}
                  </span>
                </div>

                {isUnlocked && (
                  <div className="absolute -top-1 -right-1">
                    <CheckCircle className="w-4 h-4 text-green-400 bg-gray-800 rounded-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* New Achievement Popup */}
      {showNewAchievement && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-5 duration-500">
          <Card className="bg-gradient-to-r from-[#B040FF] to-[#8A00C4] border-0 p-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="animate-bounce">
                <Trophy className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">Achievement Unlocked!</div>
                <div className="text-purple-100 text-xs">{showNewAchievement.title}</div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}