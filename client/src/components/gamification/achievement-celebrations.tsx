import React, { useState, useEffect } from 'react';
import { Trophy, Sparkles, Star, Zap, Crown, Medal } from 'lucide-react';
import { Achievement } from './achievement-definitions';

interface AchievementCelebrationProps {
  achievement: Achievement | null;
  onClose: () => void;
  showLevelUp?: boolean;
  newLevel?: number;
}

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export const AchievementCelebration: React.FC<AchievementCelebrationProps> = ({
  achievement,
  onClose,
  showLevelUp = false,
  newLevel
}) => {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);
  const [showModal, setShowModal] = useState(false);

  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

  // Create confetti particles
  const createConfetti = () => {
    const newParticles: ConfettiParticle[] = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        life: 0,
        maxLife: 150 + Math.random() * 100
      });
    }

    setParticles(newParticles);
  };

  // Animate particles
  useEffect(() => {
    if (!achievement && !showLevelUp) return;

    createConfetti();
    setShowModal(true);

    const interval = setInterval(() => {
      setParticles(prev => prev.map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        rotation: particle.rotation + particle.rotationSpeed,
        life: particle.life + 1,
        vy: particle.vy + 0.1 // gravity
      })).filter(particle => particle.life < particle.maxLife && particle.y < window.innerHeight + 50));
    }, 16);

    // Auto close after animation
    const timeout = setTimeout(() => {
      setShowModal(false);
      setTimeout(onClose, 300);
    }, 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [achievement, showLevelUp, onClose]);

  if (!achievement && !showLevelUp) return null;

  const getAchievementIcon = () => {
    if (showLevelUp) return <Crown className="w-12 h-12 text-yellow-500" />;
    
    const categoryIcons = {
      intake: <Star className="w-12 h-12 text-blue-500" />,
      dashboard: <Sparkles className="w-12 h-12 text-purple-500" />,
      retirement: <Trophy className="w-12 h-12 text-green-500" />,
      education: <Medal className="w-12 h-12 text-indigo-500" />,
      estate: <Crown className="w-12 h-12 text-yellow-600" />,
      tax: <Zap className="w-12 h-12 text-orange-500" />,
      investment: <Star className="w-12 h-12 text-red-500" />,
      engagement: <Trophy className="w-12 h-12 text-pink-500" />
    };

    return achievement ? categoryIcons[achievement.category] || <Trophy className="w-12 h-12 text-gray-500" /> : null;
  };

  const getBgGradient = () => {
    if (showLevelUp) return 'from-yellow-400 via-yellow-500 to-yellow-600';
    
    const gradients = {
      intake: 'from-blue-400 via-blue-500 to-blue-600',
      dashboard: 'from-purple-400 via-purple-500 to-purple-600',
      retirement: 'from-green-400 via-green-500 to-green-600',
      education: 'from-indigo-400 via-indigo-500 to-indigo-600',
      estate: 'from-yellow-400 via-yellow-500 to-yellow-600',
      tax: 'from-orange-400 via-orange-500 to-orange-600',
      investment: 'from-red-400 via-red-500 to-red-600',
      engagement: 'from-pink-400 via-pink-500 to-pink-600'
    };

    return achievement ? gradients[achievement.category] || 'from-gray-400 via-gray-500 to-gray-600' : 'from-gray-400 via-gray-500 to-gray-600';
  };

  return (
    <>
      {/* Confetti Particles */}
      <div className="fixed inset-0 pointer-events-none z-[100]">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute w-2 h-2 opacity-80"
            style={{
              left: particle.x,
              top: particle.y,
              backgroundColor: particle.color,
              transform: `rotate(${particle.rotation}deg)`,
              width: particle.size,
              height: particle.size,
              borderRadius: Math.random() > 0.5 ? '50%' : '0%'
            }}
          />
        ))}
      </div>

      {/* Achievement Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[101] animate-fadeIn">
          <div className={`relative overflow-hidden rounded-2xl shadow-2xl transform transition-all duration-500 ${
            showModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>
            {/* Animated Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${getBgGradient()} animate-pulse`} />
            
            {/* Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-shine" />
            
            {/* Content */}
            <div className="relative bg-white/95 backdrop-blur-sm p-8 max-w-md mx-4">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="flex justify-center mb-4 animate-bounce">
                  <div className="p-4 bg-gradient-to-br from-white/80 to-white/60 rounded-full shadow-lg">
                    {getAchievementIcon()}
                  </div>
                </div>
                
                {showLevelUp ? (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Level Up!</h2>
                    <p className="text-lg text-gray-700">
                      You've reached Level {newLevel}!
                    </p>
                  </>
                ) : achievement ? (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Achievement Unlocked!</h2>
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <span className="text-2xl">{achievement.icon}</span>
                      <span className="text-xl font-semibold text-gray-800">{achievement.name}</span>
                    </div>
                    <p className="text-gray-600">{achievement.description}</p>
                  </>
                ) : null}
              </div>

              {/* XP Badge */}
              {achievement && (
                <div className="text-center mb-6">
                  <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-4 py-2 rounded-full font-semibold shadow-lg">
                    <Zap className="w-4 h-4" />
                    <span>+{achievement.xp} XP</span>
                  </div>
                </div>
              )}

              {/* Progress Elements */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Your Progress</span>
                  <span className="font-semibold">Keep Going!</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-400 to-green-500 h-full rounded-full animate-grow" style={{ width: '75%' }} />
                </div>
              </div>

              {/* Action Button */}
              <div className="text-center">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setTimeout(onClose, 300);
                  }}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Continue Journey
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes shine {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        
        @keyframes grow {
          0% { width: 0%; }
          100% { width: 75%; }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-shine {
          animation: shine 2s ease-in-out infinite;
        }
        
        .animate-grow {
          animation: grow 1s ease-out 0.5s both;
        }
      `}</style>
    </>
  );
};

// Micro-celebration component for small achievements
interface MicroCelebrationProps {
  text: string;
  xp?: number;
  position?: { x: number; y: number };
  onComplete?: () => void;
}

export const MicroCelebration: React.FC<MicroCelebrationProps> = ({
  text,
  xp,
  position = { x: 0, y: 0 },
  onComplete
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onComplete?.(), 300);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-[100] pointer-events-none animate-float-up"
      style={{
        right: '20px',
        top: '120px',
        transform: 'none'
      }}
    >
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg flex items-center space-x-1">
        {xp && <Zap className="w-3 h-3" />}
        <span>{text}</span>
        {xp && <span>+{xp}</span>}
      </div>

      <style>{`
        @keyframes float-up {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.8);
          }
          50% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-20px) scale(0.9);
          }
        }
        
        .animate-float-up {
          animation: float-up 2s ease-out;
        }
      `}</style>
    </div>
  );
};

// Progress ring component for achievements
interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 60,
  strokeWidth = 4,
  color = '#3B82F6',
  backgroundColor = '#E5E7EB'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold text-gray-700">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export default AchievementCelebration;