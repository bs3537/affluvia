import { Achievement, ACHIEVEMENT_DEFINITIONS, calculateLevel } from '../components/gamification/achievement-definitions';

export interface UserAchievementData {
  userId: string;
  totalXP: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastVisit: Date;
  achievements: Achievement[];
  sectionProgress: {
    [key: string]: {
      visits: number;
      timeSpent: number;
      actionsCompleted: number;
      lastVisit: Date;
    };
  };
  sessionStats: {
    totalSessions: number;
    averageSessionTime: number;
    firstSessionDate: Date;
  };
}

class AchievementService {
  private storageKey = 'affluvia_achievements';

  // Initialize user achievement data
  initializeUser(userId: string): UserAchievementData {
    const existingData = this.getUserData(userId);
    if (existingData) return existingData;

    const userData: UserAchievementData = {
      userId,
      totalXP: 0,
      currentLevel: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastVisit: new Date(),
      achievements: ACHIEVEMENT_DEFINITIONS.map(def => ({ ...def, unlocked: false })),
      sectionProgress: {},
      sessionStats: {
        totalSessions: 0,
        averageSessionTime: 0,
        firstSessionDate: new Date()
      }
    };

    this.saveUserData(userData);
    return userData;
  }

  // Get user achievement data
  getUserData(userId: string): UserAchievementData | null {
    try {
      const data = localStorage.getItem(`${this.storageKey}_${userId}`);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      // Ensure dates are parsed correctly
      parsed.lastVisit = new Date(parsed.lastVisit);
      parsed.sessionStats.firstSessionDate = new Date(parsed.sessionStats.firstSessionDate);
      
      return parsed;
    } catch (error) {
      console.error('Error loading achievement data:', error);
      return null;
    }
  }

  // Save user achievement data
  private saveUserData(userData: UserAchievementData): void {
    try {
      localStorage.setItem(`${this.storageKey}_${userData.userId}`, JSON.stringify(userData));
    } catch (error) {
      console.error('Error saving achievement data:', error);
    }
  }

  // Track page visit
  trackVisit(userId: string, section: string): Achievement[] {
    const userData = this.getUserData(userId) || this.initializeUser(userId);
    const now = new Date();
    
    // Update section progress
    if (!userData.sectionProgress[section]) {
      userData.sectionProgress[section] = {
        visits: 0,
        timeSpent: 0,
        actionsCompleted: 0,
        lastVisit: now
      };
    }
    
    userData.sectionProgress[section].visits++;
    userData.sectionProgress[section].lastVisit = now;

    // Update streak
    const lastVisitDate = new Date(userData.lastVisit);
    const daysDiff = Math.floor((now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      userData.currentStreak++;
    } else if (daysDiff > 1) {
      userData.currentStreak = 1;
    }
    
    userData.longestStreak = Math.max(userData.longestStreak, userData.currentStreak);
    userData.lastVisit = now;

    // Update session stats
    userData.sessionStats.totalSessions++;

    // Check for achievements
    const newAchievements = this.checkAchievements(userData, 'visit', section);
    
    this.saveUserData(userData);
    return newAchievements;
  }

  // Track action completion
  trackAction(userId: string, actionType: string, target?: string, value: number = 1): Achievement[] {
    const userData = this.getUserData(userId) || this.initializeUser(userId);
    
    // Update relevant section progress
    if (target && userData.sectionProgress[target]) {
      userData.sectionProgress[target].actionsCompleted += value;
    }

    // Check for achievements
    const newAchievements = this.checkAchievements(userData, 'action', actionType, value);
    
    this.saveUserData(userData);
    return newAchievements;
  }

  // Track time spent
  trackTimeSpent(userId: string, section: string, timeInSeconds: number): Achievement[] {
    const userData = this.getUserData(userId) || this.initializeUser(userId);
    
    if (!userData.sectionProgress[section]) {
      userData.sectionProgress[section] = {
        visits: 0,
        timeSpent: 0,
        actionsCompleted: 0,
        lastVisit: new Date()
      };
    }

    userData.sectionProgress[section].timeSpent += timeInSeconds;

    // Check for time-based achievements
    const newAchievements = this.checkAchievements(userData, 'time', section, timeInSeconds);
    
    this.saveUserData(userData);
    return newAchievements;
  }

  // Check and unlock achievements
  private checkAchievements(
    userData: UserAchievementData, 
    triggerType: string, 
    target?: string, 
    value?: number
  ): Achievement[] {
    const newAchievements: Achievement[] = [];

    userData.achievements.forEach(achievement => {
      if (achievement.unlocked) return;

      const req = achievement.requirement;
      let shouldUnlock = false;

      switch (req.type) {
        case 'visit':
          if (triggerType === 'visit' && req.target === target) {
            const visits = userData.sectionProgress[target]?.visits || 0;
            shouldUnlock = visits >= req.value;
          }
          break;

        case 'action':
          if (triggerType === 'action' && req.target === target) {
            const actions = userData.sectionProgress[target]?.actionsCompleted || 0;
            shouldUnlock = actions >= req.value;
          }
          break;

        case 'time':
          if (triggerType === 'time' && req.target === target) {
            const timeSpent = userData.sectionProgress[target]?.timeSpent || 0;
            shouldUnlock = timeSpent >= req.value;
          }
          break;

        case 'streak':
          if (req.target === 'daily-usage') {
            shouldUnlock = userData.currentStreak >= req.value;
          }
          break;

        case 'completion':
          // This would be implemented based on specific completion criteria
          break;
      }

      if (shouldUnlock) {
        achievement.unlocked = true;
        achievement.unlockedAt = new Date();
        userData.totalXP += achievement.xp;
        newAchievements.push(achievement);
      }
    });

    // Update level based on total XP
    const levelInfo = calculateLevel(userData.totalXP);
    userData.currentLevel = levelInfo.level;

    return newAchievements;
  }

  // Get section progress for UI
  getSectionProgress(userId: string): Array<{
    category: string;
    completed: number;
    total: number;
    progress: number;
  }> {
    const userData = this.getUserData(userId);
    if (!userData) return [];

    const sections = ['dashboard', 'retirement', 'education', 'estate', 'tax', 'investment'];
    
    return sections.map(section => {
      const sectionAchievements = userData.achievements.filter(a => a.category === section);
      const completed = sectionAchievements.filter(a => a.unlocked).length;
      const total = sectionAchievements.length;
      
      return {
        category: section.charAt(0).toUpperCase() + section.slice(1),
        completed,
        total,
        progress: total > 0 ? (completed / total) * 100 : 0
      };
    });
  }

  // Get recent achievement
  getRecentAchievement(userId: string): Achievement | null {
    const userData = this.getUserData(userId);
    if (!userData) return null;

    const unlockedAchievements = userData.achievements
      .filter(a => a.unlocked && a.unlockedAt)
      .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime());

    return unlockedAchievements.length > 0 ? unlockedAchievements[0] : null;
  }

  // Get level information
  getLevelInfo(userId: string) {
    const userData = this.getUserData(userId);
    if (!userData) return calculateLevel(0);

    return calculateLevel(userData.totalXP);
  }

  // Reset achievements (for testing)
  resetAchievements(userId: string): void {
    localStorage.removeItem(`${this.storageKey}_${userId}`);
  }
}

export const achievementService = new AchievementService();
export default achievementService;