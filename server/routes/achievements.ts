import type { Express } from "express";
import { db } from "../db";
import { userAchievements, userProgress, sectionProgress, achievementDefinitions } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ACHIEVEMENT_DEFINITIONS, calculateLevel } from "../../client/src/components/gamification/achievement-definitions";

export function setupAchievementRoutes(app: Express) {
  
  // Initialize user progress
  app.post("/api/achievements/initialize", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Check if user progress already exists
      const existingProgress = await db.select()
        .from(userProgress)
        .where(eq(userProgress.userId, userId))
        .limit(1);

      if (existingProgress.length > 0) {
        return res.json({ message: "User progress already initialized", progress: existingProgress[0] });
      }

      // Create initial user progress
      const newProgress = await db.insert(userProgress)
        .values({
          userId,
          totalXP: 0,
          currentLevel: 1,
          currentStreak: 0,
          longestStreak: 0,
          lastVisit: new Date(),
          sessionStats: {
            totalSessions: 1,
            averageSessionTime: 0,
            firstSessionDate: new Date()
          }
        })
        .returning();

      res.json({ message: "User progress initialized", progress: newProgress[0] });
    } catch (error) {
      console.error("Error initializing user progress:", error);
      res.status(500).json({ error: "Failed to initialize user progress" });
    }
  });

  // Get user progress and achievements
  app.get("/api/achievements/progress/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Validate userId
      const parsedUserId = parseInt(userId);
      if (isNaN(parsedUserId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Get user progress
      const progress = await db.select()
        .from(userProgress)
        .where(eq(userProgress.userId, parsedUserId))
        .limit(1);

      // Get user achievements
      const achievements = await db.select({
        id: userAchievements.achievementId,
        unlockedAt: userAchievements.unlockedAt,
        xpEarned: userAchievements.xpEarned
      })
        .from(userAchievements)
        .where(eq(userAchievements.userId, parsedUserId));

      // Get section progress
      const sections = await db.select()
        .from(sectionProgress)
        .where(eq(sectionProgress.userId, parsedUserId));

      // Calculate level info
      const totalXP = progress[0]?.totalXP || 0;
      const levelInfo = calculateLevel(totalXP);

      // Get recent achievement (most recent unlocked)
      const recentAchievement = achievements.length > 0 
        ? achievements.sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())[0]
        : null;

      // Map achievements with definitions
      const achievementsWithDefs = ACHIEVEMENT_DEFINITIONS.map(def => ({
        ...def,
        unlocked: achievements.some(a => a.id === def.id),
        unlockedAt: achievements.find(a => a.id === def.id)?.unlockedAt
      }));

      // Calculate section progress for UI
      const sectionProgressData = [
        'dashboard', 'retirement', 'education', 'estate', 'tax', 'investment'
      ].map(section => {
        const sectionAchievements = achievementsWithDefs.filter(a => a.category === section);
        const completed = sectionAchievements.filter(a => a.unlocked).length;
        const total = sectionAchievements.length;
        
        return {
          category: section.charAt(0).toUpperCase() + section.slice(1),
          completed,
          total,
          progress: total > 0 ? (completed / total) * 100 : 0
        };
      });

      res.json({
        progress: progress[0] || {
          userId: parseInt(userId),
          totalXP: 0,
          currentLevel: 1,
          currentStreak: 0,
          longestStreak: 0,
          lastVisit: new Date(),
          sessionStats: { totalSessions: 0, averageSessionTime: 0, firstSessionDate: new Date() }
        },
        levelInfo,
        achievements: achievementsWithDefs,
        sectionProgress: sectionProgressData,
        recentAchievement: recentAchievement ? achievementsWithDefs.find(a => a.id === recentAchievement.id) : null
      });
    } catch (error) {
      console.error("Error fetching user progress:", error);
      res.status(500).json({ error: "Failed to fetch user progress" });
    }
  });

  // Track page visit
  app.post("/api/achievements/track-visit", async (req, res) => {
    try {
      const { userId, section } = req.body;
      
      if (!userId || !section) {
        return res.status(400).json({ error: "User ID and section are required" });
      }

      const now = new Date();

      // Update or create section progress
      const existingSection = await db.select()
        .from(sectionProgress)
        .where(and(
          eq(sectionProgress.userId, userId),
          eq(sectionProgress.section, section)
        ))
        .limit(1);

      if (existingSection.length > 0) {
        // Update existing
        await db.update(sectionProgress)
          .set({
            visits: existingSection[0].visits + 1,
            lastVisit: now,
            updatedAt: now
          })
          .where(and(
            eq(sectionProgress.userId, userId),
            eq(sectionProgress.section, section)
          ));
      } else {
        // Create new
        await db.insert(sectionProgress)
          .values({
            userId,
            section,
            visits: 1,
            timeSpent: 0,
            actionsCompleted: 0,
            lastVisit: now,
            completionPercentage: '0'
          });
      }

      // Update user progress (last visit and streak)
      const userProgressData = await db.select()
        .from(userProgress)
        .where(eq(userProgress.userId, userId))
        .limit(1);

      if (userProgressData.length > 0) {
        const lastVisit = new Date(userProgressData[0].lastVisit);
        const daysDiff = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
        
        let newStreak = userProgressData[0].currentStreak;
        if (daysDiff === 1) {
          newStreak++;
        } else if (daysDiff > 1) {
          newStreak = 1;
        }

        await db.update(userProgress)
          .set({
            currentStreak: newStreak,
            longestStreak: Math.max(userProgressData[0].longestStreak, newStreak),
            lastVisit: now,
            sessionStats: {
              ...userProgressData[0].sessionStats as any,
              totalSessions: (userProgressData[0].sessionStats as any)?.totalSessions + 1 || 1
            }
          })
          .where(eq(userProgress.userId, userId));
      }

      // Check for new achievements
      const newAchievements = await checkAchievements(userId, 'visit', section);

      res.json({ 
        message: "Visit tracked successfully", 
        newAchievements: newAchievements.map(a => a.achievementId)
      });

    } catch (error) {
      console.error("Error tracking visit:", error);
      res.status(500).json({ error: "Failed to track visit" });
    }
  });

  // Track action completion
  app.post("/api/achievements/track-action", async (req, res) => {
    try {
      const { userId, actionType, target, value = 1 } = req.body;
      
      if (!userId || !actionType) {
        return res.status(400).json({ error: "User ID and action type are required" });
      }

      // Update section progress if target is provided
      if (target) {
        const existingSection = await db.select()
          .from(sectionProgress)
          .where(and(
            eq(sectionProgress.userId, userId),
            eq(sectionProgress.section, target)
          ))
          .limit(1);

        if (existingSection.length > 0) {
          await db.update(sectionProgress)
            .set({
              actionsCompleted: existingSection[0].actionsCompleted + value,
              updatedAt: new Date()
            })
            .where(and(
              eq(sectionProgress.userId, userId),
              eq(sectionProgress.section, target)
            ));
        }
      }

      // Check for new achievements
      const newAchievements = await checkAchievements(userId, 'action', actionType, value);

      res.json({ 
        message: "Action tracked successfully", 
        newAchievements: newAchievements.map(a => a.achievementId)
      });

    } catch (error) {
      console.error("Error tracking action:", error);
      res.status(500).json({ error: "Failed to track action" });
    }
  });

  // Track time spent
  app.post("/api/achievements/track-time", async (req, res) => {
    try {
      const { userId, section, timeInSeconds } = req.body;
      
      if (!userId || !section || !timeInSeconds) {
        return res.status(400).json({ error: "User ID, section, and time are required" });
      }

      // Update section progress
      const existingSection = await db.select()
        .from(sectionProgress)
        .where(and(
          eq(sectionProgress.userId, userId),
          eq(sectionProgress.section, section)
        ))
        .limit(1);

      if (existingSection.length > 0) {
        await db.update(sectionProgress)
          .set({
            timeSpent: existingSection[0].timeSpent + timeInSeconds,
            updatedAt: new Date()
          })
          .where(and(
            eq(sectionProgress.userId, userId),
            eq(sectionProgress.section, section)
          ));
      } else {
        await db.insert(sectionProgress)
          .values({
            userId,
            section,
            visits: 0,
            timeSpent: timeInSeconds,
            actionsCompleted: 0,
            lastVisit: new Date(),
            completionPercentage: '0'
          });
      }

      // Check for time-based achievements
      const newAchievements = await checkAchievements(userId, 'time', section, timeInSeconds);

      res.json({ 
        message: "Time tracked successfully", 
        newAchievements: newAchievements.map(a => a.achievementId)
      });

    } catch (error) {
      console.error("Error tracking time:", error);
      res.status(500).json({ error: "Failed to track time" });
    }
  });

  // Unlock achievement manually (for testing)
  app.post("/api/achievements/unlock", async (req, res) => {
    try {
      const { userId, achievementId } = req.body;
      
      if (!userId || !achievementId) {
        return res.status(400).json({ error: "User ID and achievement ID are required" });
      }

      // Check if already unlocked
      const existing = await db.select()
        .from(userAchievements)
        .where(and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId)
        ))
        .limit(1);

      if (existing.length > 0) {
        return res.json({ message: "Achievement already unlocked" });
      }

      // Find achievement definition
      const achievementDef = ACHIEVEMENT_DEFINITIONS.find(a => a.id === achievementId);
      if (!achievementDef) {
        return res.status(404).json({ error: "Achievement not found" });
      }

      // Unlock achievement
      await db.insert(userAchievements)
        .values({
          userId,
          achievementId,
          xpEarned: achievementDef.xp,
          unlockedAt: new Date()
        });

      // Update user total XP and level
      const userProgressData = await db.select()
        .from(userProgress)
        .where(eq(userProgress.userId, userId))
        .limit(1);

      if (userProgressData.length > 0) {
        const newTotalXP = userProgressData[0].totalXP + achievementDef.xp;
        const levelInfo = calculateLevel(newTotalXP);

        await db.update(userProgress)
          .set({
            totalXP: newTotalXP,
            currentLevel: levelInfo.level
          })
          .where(eq(userProgress.userId, userId));
      }

      res.json({ message: "Achievement unlocked successfully", achievement: achievementDef });

    } catch (error) {
      console.error("Error unlocking achievement:", error);
      res.status(500).json({ error: "Failed to unlock achievement" });
    }
  });
}

// Helper function to check achievements
async function checkAchievements(userId: number, triggerType: string, target?: string, value?: number) {
  const newAchievements = [];

  // Get current user achievements
  const existingAchievements = await db.select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));

  const unlockedIds = existingAchievements.map(a => a.achievementId);

  // Get section progress
  const sections = await db.select()
    .from(sectionProgress)
    .where(eq(sectionProgress.userId, userId));

  const sectionMap = sections.reduce((acc, section) => {
    acc[section.section] = section;
    return acc;
  }, {} as Record<string, any>);

  // Get user progress for streak-based achievements
  const userProgressData = await db.select()
    .from(userProgress)
    .where(eq(userProgress.userId, userId))
    .limit(1);

  // Check each achievement definition
  for (const achievementDef of ACHIEVEMENT_DEFINITIONS) {
    if (unlockedIds.includes(achievementDef.id)) continue;

    const req = achievementDef.requirement;
    let shouldUnlock = false;

    switch (req.type) {
      case 'visit':
        if (triggerType === 'visit' && req.target === target) {
          const visits = sectionMap[target]?.visits || 0;
          shouldUnlock = visits >= req.value;
        }
        break;

      case 'action':
        if (triggerType === 'action' && req.target === target) {
          const actions = sectionMap[target]?.actionsCompleted || 0;
          shouldUnlock = actions >= req.value;
        }
        break;

      case 'time':
        if (triggerType === 'time' && req.target === target) {
          const timeSpent = sectionMap[target]?.timeSpent || 0;
          shouldUnlock = timeSpent >= req.value;
        }
        break;

      case 'streak':
        if (req.target === 'daily-usage' && userProgressData.length > 0) {
          shouldUnlock = userProgressData[0].currentStreak >= req.value;
        }
        break;
    }

    if (shouldUnlock) {
      // Unlock the achievement
      const newAchievement = await db.insert(userAchievements)
        .values({
          userId,
          achievementId: achievementDef.id,
          xpEarned: achievementDef.xp,
          unlockedAt: new Date()
        })
        .returning();

      // Update user total XP and level
      if (userProgressData.length > 0) {
        const newTotalXP = userProgressData[0].totalXP + achievementDef.xp;
        const levelInfo = calculateLevel(newTotalXP);

        await db.update(userProgress)
          .set({
            totalXP: newTotalXP,
            currentLevel: levelInfo.level
          })
          .where(eq(userProgress.userId, userId));
      }

      newAchievements.push(newAchievement[0]);
    }
  }

  return newAchievements;
}