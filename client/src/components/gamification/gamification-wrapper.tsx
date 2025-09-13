import React, { useEffect, useState, useRef } from 'react';
import { useAchievements } from '../../hooks/useAchievements';
import { AchievementCelebration, MicroCelebration } from './achievement-celebrations';
import { Achievement } from './achievement-definitions';

interface GamificationWrapperProps {
  userId: number | null;
  section: string;
  children: React.ReactNode;
  trackActions?: boolean;
  trackTime?: boolean;
}

interface MicroCelebrationData {
  id: string;
  text: string;
  xp?: number;
  position: { x: number; y: number };
}

export const GamificationWrapper: React.FC<GamificationWrapperProps> = ({
  userId,
  section,
  children,
  trackActions = true,
  trackTime = true
}) => {
  const {
    achievements,
    recentAchievement,
    trackVisit,
    trackAction,
    trackTime: trackTimeSpent
  } = useAchievements(userId);

  const [celebratingAchievement, setCelebratingAchievement] = useState<Achievement | null>(null);
  const [microCelebrations, setMicroCelebrations] = useState<MicroCelebrationData[]>([]);
  const [visitTracked, setVisitTracked] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const startTimeRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track visit on component mount
  useEffect(() => {
    if (userId && !visitTracked) {
      trackVisit(section).then((newAchievements) => {
        if (newAchievements.length > 0) {
          // Show celebration for the first new achievement
          const firstAchievement = achievements.find(a => newAchievements.includes(a.id));
          if (firstAchievement) {
            setCelebratingAchievement(firstAchievement);
          }
        }
      });
      setVisitTracked(true);
    }
  }, [userId, section, trackVisit, visitTracked, achievements]);

  // Track time spent
  useEffect(() => {
    if (!userId || !trackTime) return;

    startTimeRef.current = new Date();

    intervalRef.current = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Track total time on unmount
      if (startTimeRef.current && trackTime) {
        const totalTime = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
        if (totalTime > 10) { // Only track if spent more than 10 seconds
          trackTimeSpent(section, totalTime);
        }
      }
    };
  }, [userId, section, trackTimeSpent, trackTime]);

  // Track engagement milestones
  useEffect(() => {
    if (timeSpent > 0 && timeSpent % 60 === 0) { // Every minute
      addMicroCelebration(`${timeSpent / 60} min engaged!`, 5);
    }
  }, [timeSpent]);

  // Function to track custom actions
  const trackCustomAction = (actionType: string, target?: string, value?: number) => {
    if (!userId || !trackActions) return;

    trackAction(actionType, target, value).then((newAchievements) => {
      if (newAchievements.length > 0) {
        const firstAchievement = achievements.find(a => newAchievements.includes(a.id));
        if (firstAchievement) {
          setCelebratingAchievement(firstAchievement);
        }
      }
    });
  };

  // Add micro celebration
  const addMicroCelebration = (text: string, xp?: number, position?: { x: number; y: number }) => {
    const id = Date.now().toString();
    // Position in top-right corner below engagement metrics
    const defaultPosition = { x: window.innerWidth - 100, y: 120 };
    
    setMicroCelebrations(prev => [...prev, {
      id,
      text,
      xp,
      position: position || defaultPosition
    }]);
  };

  // Remove micro celebration
  const removeMicroCelebration = (id: string) => {
    setMicroCelebrations(prev => prev.filter(c => c.id !== id));
  };

  // Create context value for child components
  const gamificationContext = {
    trackAction: trackCustomAction,
    addMicroCelebration,
    timeSpent,
    section
  };

  return (
    <GamificationContext.Provider value={gamificationContext}>
      {children}
      
      {/* Achievement Celebration Modal */}
      {celebratingAchievement && (
        <AchievementCelebration
          achievement={celebratingAchievement}
          onClose={() => setCelebratingAchievement(null)}
        />
      )}

      {/* Micro Celebrations */}
      {microCelebrations.map(celebration => (
        <MicroCelebration
          key={celebration.id}
          text={celebration.text}
          xp={celebration.xp}
          position={celebration.position}
          onComplete={() => removeMicroCelebration(celebration.id)}
        />
      ))}
    </GamificationContext.Provider>
  );
};

// Context for child components to access gamification functions
export const GamificationContext = React.createContext<{
  trackAction: (actionType: string, target?: string, value?: number) => void;
  addMicroCelebration: (text: string, xp?: number, position?: { x: number; y: number }) => void;
  timeSpent: number;
  section: string;
} | null>(null);

// Hook for child components to use gamification
export const useGamification = () => {
  const context = React.useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationWrapper');
  }
  return context;
};

// Higher-order component for easy wrapping
export const withGamification = <P extends object>(
  Component: React.ComponentType<P>,
  section: string,
  options: { trackActions?: boolean; trackTime?: boolean } = {}
) => {
  return (props: P & { userId?: number }) => {
    return (
      <GamificationWrapper
        userId={props.userId || null}
        section={section}
        trackActions={options.trackActions}
        trackTime={options.trackTime}
      >
        <Component {...props} />
      </GamificationWrapper>
    );
  };
};

// Specific gamification components for each section
export const DashboardGamification: React.FC<{ userId: number | null; children: React.ReactNode }> = 
  ({ userId, children }) => (
    <GamificationWrapper userId={userId} section="dashboard">
      {children}
    </GamificationWrapper>
  );

export const RetirementGamification: React.FC<{ userId: number | null; children: React.ReactNode }> = 
  ({ userId, children }) => (
    <GamificationWrapper userId={userId} section="retirement-prep">
      {children}
    </GamificationWrapper>
  );

export const EducationGamification: React.FC<{ userId: number | null; children: React.ReactNode }> = 
  ({ userId, children }) => (
    <GamificationWrapper userId={userId} section="education-funding">
      {children}
    </GamificationWrapper>
  );

export const EstateGamification: React.FC<{ userId: number | null; children: React.ReactNode }> = 
  ({ userId, children }) => (
    <GamificationWrapper userId={userId} section="estate-planning">
      {children}
    </GamificationWrapper>
  );

export const TaxGamification: React.FC<{ userId: number | null; children: React.ReactNode }> = 
  ({ userId, children }) => (
    <GamificationWrapper userId={userId} section="tax-strategies">
      {children}
    </GamificationWrapper>
  );

export const InvestmentGamification: React.FC<{ userId: number | null; children: React.ReactNode }> = 
  ({ userId, children }) => (
    <GamificationWrapper userId={userId} section="investment-planning">
      {children}
    </GamificationWrapper>
  );

export default GamificationWrapper;