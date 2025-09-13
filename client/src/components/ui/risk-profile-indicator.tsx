import React from 'react';
import { Shield, TrendingUp, Zap } from 'lucide-react';

interface RiskProfileIndicatorProps {
  profile: 'Conservative' | 'Moderate' | 'Aggressive' | 'ModerateConservative' | 'ModerateAggressive' | 'Moderately Conservative' | 'Moderately Aggressive' | 'Not Assessed' | string;
  score?: number;
  name?: string;
  compact?: boolean;
}

export function RiskProfileIndicator({ 
  profile, 
  score, 
  name,
  compact = false 
}: RiskProfileIndicatorProps) {
  const profiles = {
    Conservative: {
      icon: Shield,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-400',
      borderColor: 'border-blue-500/30',
      position: 10,
      description: 'Capital preservation focus with minimal volatility'
    },
    'Moderately Conservative': {
      icon: Shield,
      color: 'from-cyan-500 to-teal-500',
      bgColor: 'bg-cyan-500/20',
      textColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/30',
      position: 30,
      description: 'Balanced approach with slight conservative tilt'
    },
    ModerateConservative: {
      icon: Shield,
      color: 'from-cyan-500 to-teal-500',
      bgColor: 'bg-cyan-500/20',
      textColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/30',
      position: 30,
      description: 'Balanced approach with slight conservative tilt'
    },
    Moderate: {
      icon: TrendingUp,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-500/20',
      textColor: 'text-yellow-400',
      borderColor: 'border-yellow-500/30',
      position: 50,
      description: 'Balanced growth and income approach'
    },
    'Moderately Aggressive': {
      icon: TrendingUp,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-500/20',
      textColor: 'text-orange-400',
      borderColor: 'border-orange-500/30',
      position: 70,
      description: 'Growth-focused with moderate risk tolerance'
    },
    ModerateAggressive: {
      icon: TrendingUp,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-500/20',
      textColor: 'text-orange-400',
      borderColor: 'border-orange-500/30',
      position: 70,
      description: 'Growth-focused with moderate risk tolerance'
    },
    Aggressive: {
      icon: Zap,
      color: 'from-red-500 to-pink-500',
      bgColor: 'bg-red-500/20',
      textColor: 'text-red-400',
      borderColor: 'border-red-500/30',
      position: 90,
      description: 'Maximum growth potential with higher volatility'
    },
    'Not Assessed': {
      icon: Shield,
      color: 'from-gray-500 to-gray-600',
      bgColor: 'bg-gray-500/20',
      textColor: 'text-gray-400',
      borderColor: 'border-gray-500/30',
      position: 0,
      description: 'Complete risk assessment to determine your profile'
    }
  };

  const currentProfile = profiles[profile as keyof typeof profiles] || profiles.Moderate;
  const Icon = currentProfile.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl ${currentProfile.bgColor} ${currentProfile.borderColor} border flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${currentProfile.textColor}`} />
        </div>
        <div>
          <div className={`text-sm font-semibold ${currentProfile.textColor}`}>{profile}</div>
          {score && <div className="text-xs text-gray-400">Score: {score}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with name and score */}
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-white">{name || 'Risk Profile'}</h4>
        {score && (
          <div className="text-sm text-gray-400">
            Score: <span className="font-medium text-white">{score}</span>
          </div>
        )}
      </div>

      {/* Risk spectrum visualization - only show if assessed */}
      {profile !== 'Not Assessed' && (
        <div className="relative">
          {/* Background spectrum bar */}
          <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 opacity-20" />
          
          {/* Position indicator */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-gray-900 shadow-lg transition-all duration-500"
            style={{ 
              left: `${currentProfile.position}%`,
              transform: `translateX(-50%) translateY(-50%)`,
              background: `linear-gradient(135deg, ${currentProfile.color.split(' ')[1]} 0%, ${currentProfile.color.split(' ')[3]} 100%)`
            }}
          />
          
          {/* Scale labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Conservative</span>
            <span>Moderate</span>
            <span>Aggressive</span>
          </div>
        </div>
      )}

      {/* Profile card */}
      <div className={`rounded-xl p-4 ${currentProfile.bgColor} ${currentProfile.borderColor} border backdrop-blur-sm`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${currentProfile.color} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h5 className={`font-semibold ${currentProfile.textColor}`}>{profile}</h5>
            <p className="text-xs text-gray-400 mt-1">{currentProfile.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}