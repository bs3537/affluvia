import { Router } from 'express'
import { z } from 'zod'
import { db } from '@/db'
import { estateScenarios, financialProfiles } from '@shared/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { EstateTaxScenarioCalculator, createCalculatorFromProfile } from '../services/estate-scenario-calculator'

const router = Router()

// Get calculated scenarios for the current user
router.get('/calculated-scenarios', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Get user's financial profile
    const profile = await db.query.financialProfiles.findFirst({
      where: eq(financialProfiles.userId, userId)
    })

    if (!profile) {
      return res.status(404).json({ error: 'Financial profile not found' })
    }

    // Create estate profile from financial profile
    const estateProfile = {
      id: profile.id.toString(),
      userId: profile.userId.toString(),
      totalAssets: calculateTotalAssets(profile),
      totalLiabilities: calculateTotalLiabilities(profile),
      netWorth: calculateNetWorth(profile),
      spouseDetails: profile.maritalStatus === 'married' ? {
        firstName: profile.spouseName?.split(' ')[0],
        lastName: profile.spouseName?.split(' ')[1],
        dateOfBirth: profile.spouseDateOfBirth
      } : undefined,
      maritalStatus: profile.maritalStatus || 'single',
      state: profile.state || 'CA'
    }

    // Create calculator and run scenarios
    const calculator = createCalculatorFromProfile(estateProfile)
    const scenarios = calculator.runAllScenarios()

    res.json({ scenarios })
  } catch (error) {
    console.error('Error calculating scenarios:', error)
    res.status(500).json({ error: 'Failed to calculate scenarios' })
  }
})

// Helper functions to calculate totals from profile
function calculateTotalAssets(profile: any): number {
  let total = 0
  
  // Add liquid assets
  const assets = Array.isArray(profile.assets) ? profile.assets : []
  total += assets.reduce((sum: number, asset: any) => sum + (asset.value || 0), 0)
  
  // Add real estate
  if (profile.primaryResidence) {
    total += profile.primaryResidence.marketValue || 0
  }
  
  const additionalProperties = Array.isArray(profile.additionalProperties) ? profile.additionalProperties : []
  total += additionalProperties.reduce((sum: number, prop: any) => sum + (prop.marketValue || 0), 0)
  
  // Add life insurance if owned (not in ILIT)
  if (profile.lifeInsurance?.hasPolicy) {
    total += profile.lifeInsurance.coverageAmount || 0
  }
  
  return total
}

function calculateTotalLiabilities(profile: any): number {
  let total = 0
  
  // Add general liabilities
  const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : []
  total += liabilities.reduce((sum: number, liability: any) => sum + (liability.balance || 0), 0)
  
  // Add mortgage
  if (profile.primaryResidence) {
    total += profile.primaryResidence.mortgageBalance || 0
  }
  
  const additionalProperties = Array.isArray(profile.additionalProperties) ? profile.additionalProperties : []
  total += additionalProperties.reduce((sum: number, prop: any) => sum + (prop.mortgageBalance || 0), 0)
  
  return total
}

function calculateNetWorth(profile: any): number {
  return calculateTotalAssets(profile) - calculateTotalLiabilities(profile)
}

// Save a custom scenario
router.post('/custom-scenario', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const scenarioData = req.body
    
    // Save to database
    const [scenario] = await db.insert(estateScenarios)
      .values({
        userId,
        scenarioName: scenarioData.title,
        scenarioType: scenarioData.scenarioId,
        description: scenarioData.summary,
        assumptions: scenarioData.assumptions,
        results: scenarioData.metrics,
        netToHeirs: scenarioData.metrics['Total to Heirs'] || '0',
        totalTaxes: scenarioData.metrics['Estate Tax'] || '0',
        isBaseline: false
      })
      .returning()

    res.json(scenario)
  } catch (error) {
    console.error('Error saving scenario:', error)
    res.status(500).json({ error: 'Failed to save scenario' })
  }
})

export { router as estateScenarioRoutes }