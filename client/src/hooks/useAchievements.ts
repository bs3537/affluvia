import { useState, useEffect, useCallback } from 'react';
import { Achievement } from '../components/gamification/achievement-definitions';

interface AchievementProgress {
  category: string;
  completed: number;
  total: number;
  progress: number;
}

interface UserProgressData {
  userId: number;
  totalXP: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastVisit: Date;
  sessionStats: {
    totalSessions: number;
    averageSessionTime: number;
    firstSessionDate: Date;
  };
}

interface LevelInfo {
  level: number;
  title: string;
  theme: string;
  currentXP: number;
  xpToNext: number;
  isMaxLevel: boolean;
}

interface UseAchievementsReturn {
  progress: UserProgressData | null;
  levelInfo: LevelInfo | null;
  achievements: Achievement[];
  sectionProgress: AchievementProgress[];
  recentAchievement: Achievement | null;
  loading: boolean;
  error: string | null;
  trackVisit: (section: string) => Promise<string[]>;
  trackAction: (actionType: string, target?: string, value?: number) => Promise<string[]>;
  trackTime: (section: string, timeInSeconds: number) => Promise<string[]>;
  unlockAchievement: (achievementId: string) => Promise<void>;
  refreshProgress: () => Promise<void>;
}

export function useAchievements(userId: number | null): UseAchievementsReturn {
  const [progress, setProgress] = useState<UserProgressData | null>(null);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [sectionProgress, setSectionProgress] = useState<AchievementProgress[]>([]);
  const [recentAchievement, setRecentAchievement] = useState<Achievement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize user progress
  const initializeUser = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch('/api/achievements/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to initialize user progress');
      }

      return await response.json();
    } catch (err) {
      console.error('Error initializing user:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [userId]);

  // Fetch user progress and achievements
  const fetchProgress = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/achievements/progress/${userId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch progress');
      }

      const data = await response.json();
      setProgress(data.progress);
      setLevelInfo(data.levelInfo);
      setAchievements(data.achievements);
      setSectionProgress(data.sectionProgress);
      setRecentAchievement(data.recentAchievement);
    } catch (err) {
      console.error('Error fetching progress:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Track page visit
  const trackVisit = useCallback(async (section: string): Promise<string[]> => {
    if (!userId) return [];

    try {
      const response = await fetch('/api/achievements/track-visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId, section }),
      });

      if (!response.ok) {
        throw new Error('Failed to track visit');
      }

      const data = await response.json();
      
      // Refresh progress to get updated data
      await fetchProgress();
      
      return data.newAchievements || [];
    } catch (err) {
      console.error('Error tracking visit:', err);
      return [];
    }
  }, [userId, fetchProgress]);

  // Track action
  const trackAction = useCallback(async (
    actionType: string, 
    target?: string, 
    value: number = 1
  ): Promise<string[]> => {
    if (!userId) return [];

    try {
      const response = await fetch('/api/achievements/track-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId, actionType, target, value }),
      });

      if (!response.ok) {
        throw new Error('Failed to track action');
      }

      const data = await response.json();
      
      // Refresh progress to get updated data
      await fetchProgress();
      
      return data.newAchievements || [];
    } catch (err) {
      console.error('Error tracking action:', err);
      return [];
    }
  }, [userId, fetchProgress]);

  // Track time spent
  const trackTime = useCallback(async (section: string, timeInSeconds: number): Promise<string[]> => {
    if (!userId) return [];

    try {
      const response = await fetch('/api/achievements/track-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId, section, timeInSeconds }),
      });

      if (!response.ok) {
        throw new Error('Failed to track time');
      }

      const data = await response.json();
      
      // Refresh progress to get updated data
      await fetchProgress();
      
      return data.newAchievements || [];
    } catch (err) {
      console.error('Error tracking time:', err);
      return [];
    }
  }, [userId, fetchProgress]);

  // Unlock achievement manually (for testing)
  const unlockAchievement = useCallback(async (achievementId: string): Promise<void> => {
    if (!userId) return;

    try {
      const response = await fetch('/api/achievements/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId, achievementId }),
      });

      if (!response.ok) {
        throw new Error('Failed to unlock achievement');
      }

      // Refresh progress to get updated data
      await fetchProgress();
    } catch (err) {
      console.error('Error unlocking achievement:', err);
    }
  }, [userId, fetchProgress]);

  // Refresh progress data
  const refreshProgress = useCallback(async (): Promise<void> => {
    await fetchProgress();
  }, [fetchProgress]);

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      initializeUser().then(() => {
        fetchProgress();
      });
    }
  }, [userId, initializeUser, fetchProgress]);

  return {
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
    refreshProgress,
  };
}