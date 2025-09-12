// Helper function to save optimization results to database
import { db } from './db';
import { financialProfiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function saveOptimizationResults(
  userId: number,
  variables: any,
  optimizedScore: any,
  netWorthProjections: any,
  cashFlowData: any
) {
  console.log('Saving optimization results to database...');
  
  try {
    // Prepare the data to save
    const optimizationData = {
      optimizationVariables: {
        ...variables,
        lockedAt: new Date().toISOString(),
        optimizedScore: optimizedScore || null,
        netWorthProjections: netWorthProjections || null,
        cashFlowData: cashFlowData || null,
        savedAt: new Date().toISOString()
      },
      
      // Also save Monte Carlo results separately
      monteCarloSimulation: optimizedScore ? {
        calculatedAt: new Date().toISOString(),
        probabilityOfSuccess: optimizedScore.probabilityOfSuccess,
        medianEndingBalance: optimizedScore.medianEndingBalance,
        percentileData: optimizedScore.percentileData,
        yearlyCashFlows: optimizedScore.yearlyCashFlows,
        successByYear: optimizedScore.successByYear,
        withdrawalRates: optimizedScore.withdrawalRates,
        sensitivityAnalysis: optimizedScore.sensitivityAnalysis
      } : null,
      
      // Save retirement planning data
      retirementPlanningData: {
        lastOptimizedAt: new Date().toISOString(),
        optimizationVariables: variables,
        optimizedScore: optimizedScore?.probabilityOfSuccess,
        baselineScore: optimizedScore?.sensitivityAnalysis?.baselineSuccess,
        improvement: optimizedScore?.sensitivityAnalysis?.absoluteChange,
        netWorthProjections: netWorthProjections,
        cashFlowProjections: cashFlowData
      }
    };
    
    // Update the database
    const [updated] = await db
      .update(financialProfiles)
      .set(optimizationData)
      .where(eq(financialProfiles.userId, userId))
      .returning();
    
    if (updated) {
      console.log('✅ Optimization results saved successfully');
      console.log('- Optimization variables saved');
      console.log('- Monte Carlo results saved');
      console.log('- Net worth projections saved');
      console.log('- Cash flow data saved');
      return true;
    } else {
      console.error('❌ Failed to save optimization results - no profile found');
      return false;
    }
  } catch (error) {
    console.error('❌ Error saving optimization results:', error);
    return false;
  }
}

// Test function
export async function testSaveOptimization() {
  const testVariables = {
    retirementAge: 67,
    spouseRetirementAge: 67,
    socialSecurityAge: 68,
    spouseSocialSecurityAge: 68,
    assetAllocation: '7',
    monthlyContributions: 3000,
    monthlyExpenses: 7500,
    partTimeIncome: 0,
    spousePartTimeIncome: 0
  };
  
  const testScore = {
    probabilityOfSuccess: 52.5,
    medianEndingBalance: 1234567,
    percentileData: {
      p10: 500000,
      p25: 800000,
      p50: 1234567,
      p75: 2000000,
      p90: 3000000
    },
    yearlyCashFlows: [],
    successByYear: [],
    withdrawalRates: [],
    sensitivityAnalysis: {
      baselineSuccess: 48.0,
      optimizedSuccess: 52.5,
      absoluteChange: 4.5,
      relativeChange: '9.38%'
    }
  };
  
  const testNetWorth = {
    years: [2024, 2025, 2026],
    values: [600000, 650000, 700000]
  };
  
  const testCashFlow = {
    inflows: [100000, 105000, 110000],
    outflows: [80000, 85000, 90000]
  };
  
  const success = await saveOptimizationResults(
    1, // Test user ID
    testVariables,
    testScore,
    testNetWorth,
    testCashFlow
  );
  
  console.log('\nTest result:', success ? '✅ Success' : '❌ Failed');
}

// Run test if called directly
testSaveOptimization().then(() => process.exit(0));