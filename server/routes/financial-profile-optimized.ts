import { Request, Response } from 'express';
import { db } from '../db';
import { financialProfiles } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Optimized financial profile endpoint
 * Target: < 2 second response time
 */
export async function getFinancialProfileOptimized(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = (req.session as any).actingAsClientId || req.user!.id;
    
    // CRITICAL: Only fetch essential fields for dashboard
    // Don't fetch large JSON columns unless needed
    const [profile] = await db
      .select({
        id: financialProfiles.id,
        userId: financialProfiles.userId,
        firstName: financialProfiles.firstName,
        lastName: financialProfiles.lastName,
        dateOfBirth: financialProfiles.dateOfBirth,
        maritalStatus: financialProfiles.maritalStatus,
        state: financialProfiles.state,
        
        // Financial scores (already calculated)
        financialHealthScore: financialProfiles.financialHealthScore,
        emergencyReadinessScore: financialProfiles.emergencyReadinessScore,
        retirementReadinessScore: financialProfiles.retirementReadinessScore,
        riskManagementScore: financialProfiles.riskManagementScore,
        cashFlowScore: financialProfiles.cashFlowScore,
        netWorth: financialProfiles.netWorth,
        monthlyCashFlow: financialProfiles.monthlyCashFlow,
        
        // Only get calculations if explicitly requested
        calculations: req.query.includeCalculations === 'true' 
          ? financialProfiles.calculations 
          : undefined,
        
        // Only get Monte Carlo if explicitly requested
        monteCarloSimulation: req.query.includeMonteCarlo === 'true'
          ? financialProfiles.monteCarloSimulation
          : undefined,
        
        // Essential fields for dashboard
        annualIncome: financialProfiles.annualIncome,
        takeHomeIncome: financialProfiles.takeHomeIncome,
        monthlyExpenses: financialProfiles.monthlyExpenses,
        assets: financialProfiles.assets,
        liabilities: financialProfiles.liabilities,
        
        // Metadata
        isComplete: financialProfiles.isComplete,
        updatedAt: financialProfiles.updatedAt
      })
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    
    if (!profile) {
      return res.json(null);
    }
    
    // Return minimal data for fast dashboard load
    return res.json({
      ...profile,
      // Add computed flags for UI
      hasProfile: true,
      needsSync: false, // Can be computed based on updatedAt
      dashboardReady: true
    });
    
  } catch (error) {
    console.error('Error fetching financial profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

/**
 * Get full profile with all data (for detailed views)
 */
export async function getFullFinancialProfile(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userId = (req.session as any).actingAsClientId || req.user!.id;
    
    // Fetch complete profile
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    
    return res.json(profile);
    
  } catch (error) {
    console.error('Error fetching full profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
}