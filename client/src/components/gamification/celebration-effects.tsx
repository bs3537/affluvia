import { useState, useEffect } from 'react';
import { Trophy, Star, Zap, CheckCircle, Sparkles } from 'lucide-react';

interface CelebrationEffectsProps {
  currentStep: number;
  totalSteps: number;
  momentum: number;
  onCelebrationComplete: () => void;
}

type CelebrationType = 'step-complete' | 'section-complete' | 'momentum-boost' | 'final-complete';

interface Celebration {
  type: CelebrationType;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  particles: boolean;
}

export function CelebrationEffects({ 
  currentStep, 
  totalSteps, 
  momentum, 
  onCelebrationComplete 
}: CelebrationEffectsProps) {
  const [activeCelebration, setActiveCelebration] = useState<Celebration | null>(null);
  const [showParticles, setShowParticles] = useState(false);
  const [lastStep, setLastStep] = useState(0);

  const celebrations: Record<CelebrationType, Celebration> = {
    'step-complete': {
      type: 'step-complete',
      title: 'Great Progress!',
      subtitle: 'Keep the momentum going',
      icon: CheckCircle,
      color: 'from-green-400 to-green-600',
      particles: false
    },
    'section-complete': {
      type: 'section-complete',
      title: 'Section Complete!',
      subtitle: 'You\'re building a strong financial foundation',
      icon: Star,
      color: 'from-[#B040FF] to-[#8A00C4]',
      particles: true
    },
    'momentum-boost': {
      type: 'momentum-boost',
      title: 'On Fire! 🔥',
      subtitle: 'Your momentum is unstoppable',
      icon: Zap,
      color: 'from-orange-400 to-red-500',
      particles: true
    },
    'final-complete': {
      type: 'final-complete',
      title: 'Financial Profile Complete! 🎉',
      subtitle: 'You\'ve taken control of your financial future',
      icon: Trophy,
      color: 'from-yellow-400 to-orange-500',
      particles: true
    }
  };

  useEffect(() => {
    // Check for step completion
    if (currentStep > lastStep && lastStep > 0) {
      const isNewSection = isNewSectionStart(currentStep);
      
      if (currentStep >= totalSteps) {
        triggerCelebration('final-complete');
      } else if (isNewSection) {
        triggerCelebration('section-complete');
      } else {
        triggerCelebration('step-complete');
      }
    }
    
    setLastStep(currentStep);
  }, [currentStep, lastStep, totalSteps]);

  useEffect(() => {
    // Check for momentum boost
    if (momentum >= 80) {
      triggerCelebration('momentum-boost');
    }
  }, [momentum]);

  const isNewSectionStart = (step: number): boolean => {
    // Section boundaries: 1-2 (Personal), 3-5 (Financial), 6 (Protection), 7-8 (Investment), 9-12 (Planning)
    return [3, 6, 7, 9].includes(step);
  };

  const triggerCelebration = (type: CelebrationType) => {
    const celebration = celebrations[type];
    setActiveCelebration(celebration);
    
    if (celebration.particles) {
      setShowParticles(true);
    }

    // Auto-hide after duration
    const duration = type === 'final-complete' ? 4000 : 2500;
    setTimeout(() => {
      setActiveCelebration(null);
      setShowParticles(false);
      onCelebrationComplete();
    }, duration);
  };

  if (!activeCelebration) return null;

  const IconComponent = activeCelebration.icon;

  return (
    <>
      {/* Main Celebration Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
        <div className={`
          relative p-8 rounded-2xl shadow-2xl text-center
          bg-gradient-to-br ${activeCelebration.color}
          animate-in zoom-in-95 duration-500
          max-w-sm mx-4
        `}>
          {/* Animated Icon */}
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <IconComponent className="w-16 h-16 text-white animate-bounce" />
              <div className="absolute inset-0 w-16 h-16 bg-white/20 rounded-full animate-ping" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2">
            {activeCelebration.title}
          </h2>

          {/* Subtitle */}
          <p className="text-white/90 text-sm mb-4">
            {activeCelebration.subtitle}
          </p>

          {/* Progress indicator for non-final celebrations */}
          {activeCelebration.type !== 'final-complete' && (
            <div className="text-white/80 text-xs">
              Step {currentStep} of {totalSteps} complete
            </div>
          )}

          {/* Sparkle effects */}
          <div className="absolute -top-2 -right-2">
            <Sparkles className="w-6 h-6 text-yellow-300 animate-spin" />
          </div>
          <div className="absolute -bottom-2 -left-2">
            <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Confetti Particles */}
      {showParticles && (
        <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className={`
                absolute w-2 h-2 rounded-full animate-bounce
                ${i % 4 === 0 ? 'bg-yellow-400' : 
                  i % 4 === 1 ? 'bg-[#B040FF]' : 
                  i % 4 === 2 ? 'bg-green-400' : 'bg-orange-400'}
              `}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Success Sound Effect Placeholder */}
      {activeCelebration && (
        <audio autoPlay>
          <source src="/sounds/success.mp3" type="audio/mpeg" />
        </audio>
      )}
    </>
  );
}