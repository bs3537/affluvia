/**
 * Social Security Pre-Calculator
 * 
 * Calculates optimal Social Security claiming ages from complete intake form data
 * and stores them in the financial profile for use in optimization form.
 * 
 * Based on RightCapital's approach of pre-calculating optimal strategies.
 */

import { SocialSecurityOptimizer, type SocialSecurityProfile } from './social-security-optimizer';

interface IntakeFormProfile {
  // Demographics
  dateOfBirth?: string;
  spouseDateOfBirth?: string;
  sex?: string;
  spouseSex?: string;
  maritalStatus?: string;
  state?: string;
  
  // Income data
  annualIncome?: number;
  spouseAnnualIncome?: number;
  
  // Retirement preferences from intake
  desiredRetirementAge?: number;
  spouseDesiredRetirementAge?: number;
  expectedMonthlyExpensesRetirement?: number;
  
  // Insurance
  hasLongTermCareInsurance?: boolean;
  
  // Assets
  assets?: Array<{
    type: string;
    value: number;
    owner?: string;
  }>;
  
  // Benefits
  pensionBenefit?: number;
  spousePensionBenefit?: number;
  
  // Risk preferences
  riskQuestions?: number[];
  spouseRiskQuestions?: number[];
  expectedRealReturn?: number;
}

interface OptimalSSResult {
  optimalSocialSecurityAge: number;
  optimalSpouseSocialSecurityAge?: number;
  lifetimeBenefitIncrease: number;
  sustainableAnnualSpending: number;
  confidence: number;
  calculatedAt: string;
  methodology: string;
}

export class SocialSecurityPreCalculator {
  
  /**
   * Main function to pre-calculate optimal Social Security ages from intake form
   */
  static async calculateOptimalAgesFromIntake(profile: IntakeFormProfile): Promise<OptimalSSResult | null> {
    try {
      console.log('\n=== PRE-CALCULATING OPTIMAL SOCIAL SECURITY AGES ===');
      console.log('Using complete intake form data for accurate optimization');
      
      // Only calculate if we have sufficient data
      if (!profile.dateOfBirth || !profile.annualIncome) {
        console.log('Insufficient data for Social Security optimization');
        return null;
      }
      
      // Convert intake profile to optimizer format
      const ssProfile = this.convertIntakeToSSProfile(profile);
      console.log('Converted intake profile to SS optimizer format');
      
      // Run optimization with high accuracy (more iterations for pre-calculation)
      const optimizer = new SocialSecurityOptimizer({
        iterations: 2000, // Higher accuracy for pre-calculation
        successTarget: 0.95,
        horizon: 95
      });
      
      console.log('Running comprehensive Social Security optimization...');
      const optimizationResult = await optimizer.optimizeSocialSecurity(ssProfile);
      
      // Calculate improvement over intake form defaults
      const intakeDefaultAge = 67; // Full retirement age default
      const spouseIntakeDefaultAge = profile.maritalStatus === 'married' ? 67 : undefined;
      
      // Calculate baseline scenario for comparison
      const baselineResult = await this.calculateBaselineScenario(ssProfile, intakeDefaultAge, spouseIntakeDefaultAge);
      const improvementPercent = ((optimizationResult.sustainableRealSpend95 - baselineResult) / baselineResult) * 100;
      
      const result: OptimalSSResult = {
        optimalSocialSecurityAge: optimizationResult.optimalStrategy.primaryAge,
        optimalSpouseSocialSecurityAge: optimizationResult.optimalStrategy.spouseAge,
        lifetimeBenefitIncrease: improvementPercent,
        sustainableAnnualSpending: optimizationResult.sustainableRealSpend95,
        confidence: optimizationResult.confidenceLevel,
        calculatedAt: new Date().toISOString(),
        methodology: 'sustainable_real_spend_95'
      };
      
      console.log('=== OPTIMAL SOCIAL SECURITY RESULTS ===');
      console.log(`Optimal primary age: ${result.optimalSocialSecurityAge}`);
      console.log(`Optimal spouse age: ${result.optimalSpouseSocialSecurityAge || 'N/A'}`);
      console.log(`Lifetime benefit increase: ${result.lifetimeBenefitIncrease.toFixed(1)}%`);
      console.log(`Sustainable annual spending: $${result.sustainableAnnualSpending.toLocaleString()}`);
      
      return result;
      
    } catch (error) {
      console.error('Error pre-calculating optimal Social Security ages:', error);
      return null;
    }
  }
  
  /**
   * Convert intake form profile to Social Security optimizer format
   */
  private static convertIntakeToSSProfile(profile: IntakeFormProfile): SocialSecurityProfile {
    // Calculate current ages
    const currentAge = profile.dateOfBirth 
      ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() 
      : 35;
    const spouseAge = profile.spouseDateOfBirth 
      ? new Date().getFullYear() - new Date(profile.spouseDateOfBirth).getFullYear() 
      : undefined;
    
    // Calculate PIA from income
    const monthlyIncome = (profile.annualIncome || 60000) / 12;
    const userPIA = this.calculatePIA(monthlyIncome, currentAge);
    
    const spouseMonthlyIncome = (profile.spouseAnnualIncome || monthlyIncome * 0.8) / 12;
    const spousePIA = spouseAge ? this.calculatePIA(spouseMonthlyIncome, spouseAge) : 0;
    
    // Map risk profile to expected return
    const userRiskProfile = profile.riskQuestions?.[0] || 3;
    const spouseRiskProfile = profile.spouseRiskQuestions?.[0] || userRiskProfile;
    const expectedReturn = this.mapRiskProfileToReturn(userRiskProfile);
    
    // Aggregate assets by tax type
    const assets = profile.assets || [];
    const portfolio = this.aggregateAssetsByType(assets);
    
    return {
      dateOfBirth: profile.dateOfBirth || '1985-01-01',
      sex: (profile.sex as 'male' | 'female') || 'male',
      maritalStatus: profile.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed',
      primaryInsuranceAmount: userPIA,
      fullRetirementAge: 67,
      spouseDateOfBirth: profile.spouseDateOfBirth,
      spouseSex: (profile.spouseSex as 'male' | 'female') || 'female',
      spousePrimaryInsuranceAmount: spousePIA,
      spouseFullRetirementAge: 67,
      currentAge,
      spouseCurrentAge: spouseAge,
      retirementAge: profile.desiredRetirementAge || 65,
      spouseRetirementAge: profile.spouseDesiredRetirementAge || 65,
      pensionBenefit: profile.pensionBenefit || 0,
      spousePensionBenefit: profile.spousePensionBenefit || 0,
      partTimeIncome: 0, // Not typically in intake form
      spousePartTimeIncome: 0,
      monthlyExpensesRetirement: profile.expectedMonthlyExpensesRetirement || 8000,
      hasLongTermCareInsurance: profile.hasLongTermCareInsurance || false,
      portfolio: {
        ...portfolio,
        expectedRealReturn: expectedReturn
      },
      taxFilingStatus: profile.maritalStatus === 'married' ? 'married_filing_jointly' : 'single',
      stateOfResidence: profile.state || 'CA'
    };
  }
  
  /**
   * Calculate Primary Insurance Amount from monthly income and age
   */
  private static calculatePIA(monthlyIncome: number, currentAge: number): number {
    // Calculate AIME (simplified)
    const workingYears = Math.min(35, currentAge - 22);
    const aime = monthlyIncome * workingYears / 35;
    
    // 2024 PIA bend points
    if (aime <= 1174) return aime * 0.9;
    if (aime <= 7078) return 1174 * 0.9 + (aime - 1174) * 0.32;
    return 1174 * 0.9 + (7078 - 1174) * 0.32 + (aime - 7078) * 0.15;
  }
  
  /**
   * Map risk profile to expected real return
   */
  private static mapRiskProfileToReturn(riskProfile: number): number {
    const riskToReturn: { [key: number]: number } = {
      1: 0.03,  // Conservative → 3%
      2: 0.035, // Moderately Conservative → 3.5%
      3: 0.04,  // Moderate → 4%
      4: 0.045, // Moderately Aggressive → 4.5%
      5: 0.05   // Aggressive → 5%
    };
    return riskToReturn[riskProfile] || 0.04;
  }
  
  /**
   * Aggregate assets by tax type for portfolio calculation
   */
  private static aggregateAssetsByType(assets: Array<{type: string; value: number; owner?: string}>): {
    taxable: number;
    taxDeferred: number;
    taxFree: number;
    hsa: number;
  } {
    return {
      taxable: assets
        .filter(a => ['savings', 'checking', 'brokerage', 'investment'].includes(a.type?.toLowerCase()))
        .reduce((sum, a) => sum + (a.value || 0), 0),
      taxDeferred: assets
        .filter(a => ['401k', '403b', 'traditional-ira', 'pension'].includes(a.type?.toLowerCase()))
        .reduce((sum, a) => sum + (a.value || 0), 0),
      taxFree: assets
        .filter(a => ['roth-ira', 'roth-401k'].includes(a.type?.toLowerCase()))
        .reduce((sum, a) => sum + (a.value || 0), 0),
      hsa: assets
        .filter(a => a.type?.toLowerCase() === 'hsa')
        .reduce((sum, a) => sum + (a.value || 0), 0)
    };
  }
  
  /**
   * Calculate baseline scenario for comparison
   */
  private static async calculateBaselineScenario(
    ssProfile: SocialSecurityProfile, 
    primaryAge: number, 
    spouseAge?: number
  ): Promise<number> {
    const optimizer = new SocialSecurityOptimizer({
      iterations: 500, // Quick calculation for baseline
      successTarget: 0.95,
      horizon: 95
    });
    
    // Create baseline strategy
    const baselineStrategy = {
      primaryAge,
      spouseAge
    };
    
    // Use the optimizer's evaluation method for consistency
    const randomSeeds = Array.from({length: 500}, () => Math.random() * 1000000);
    return await optimizer['evaluateStrategy'](ssProfile, baselineStrategy, randomSeeds);
  }
  
  /**
   * Quick validation to check if optimization is beneficial
   */
  static shouldOptimizeForProfile(profile: IntakeFormProfile): boolean {
    // Only optimize if user has significant retirement assets or income
    const hasSignificantAssets = (profile.assets || [])
      .reduce((sum, asset) => sum + (asset.value || 0), 0) > 100000;
    
    const hasSignificantIncome = (profile.annualIncome || 0) > 40000;
    
    const isNearRetirement = profile.dateOfBirth ? 
      (new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()) > 50 : false;
    
    return hasSignificantAssets || hasSignificantIncome || isNearRetirement;
  }
}

export { type OptimalSSResult, type IntakeFormProfile };