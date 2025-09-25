import type { Request } from 'express';

// Normalizes and applies optimization variables onto a copy of the profile,
// preserving intake form values when a variable is not provided.
export function applyOptimizationVariables(profile: any, rawVars: any) {
  const optimizationVariables = rawVars || {};

  // Start with a DEEP copy of the profile to preserve ALL fields
  // This ensures fields like dateOfBirth, maritalStatus, etc. are preserved for calculations
  const optimizedProfile: any = {
    ...profile,
    
    // CRITICAL: Explicitly ensure assets and key fields are preserved from the original profile
    assets: profile.assets,
    additionalAssets: profile.additionalAssets,
    dateOfBirth: profile.dateOfBirth,
    spouseDateOfBirth: profile.spouseDateOfBirth,
    maritalStatus: profile.maritalStatus,
    state: profile.state,
    retirementState: profile.retirementState,
    annualIncome: profile.annualIncome,
    spouseAnnualIncome: profile.spouseAnnualIncome,
    userLifeExpectancy: profile.userLifeExpectancy,
    spouseLifeExpectancy: profile.spouseLifeExpectancy,
    riskQuestions: profile.riskQuestions,
    spouseRiskQuestions: profile.spouseRiskQuestions,

    // Retirement ages
    desiredRetirementAge: optimizationVariables.retirementAge ?? profile.desiredRetirementAge,
    spouseDesiredRetirementAge: optimizationVariables.spouseRetirementAge ?? profile.spouseDesiredRetirementAge,

    // Social Security claim ages
    socialSecurityClaimAge: optimizationVariables.socialSecurityAge ?? profile.socialSecurityClaimAge,
    spouseSocialSecurityClaimAge: optimizationVariables.spouseSocialSecurityAge ?? profile.spouseSocialSecurityClaimAge,

    // Benefit overrides
    socialSecurityBenefit: optimizationVariables.socialSecurityBenefit ?? profile.socialSecurityBenefit,
    spouseSocialSecurityBenefit: optimizationVariables.spouseSocialSecurityBenefit ?? profile.spouseSocialSecurityBenefit,
    pensionBenefit: optimizationVariables.pensionBenefit ?? profile.pensionBenefit,
    spousePensionBenefit: optimizationVariables.spousePensionBenefit ?? profile.spousePensionBenefit,

    // Contributions (employee/employer pairs)
    retirementContributions: {
      employee: optimizationVariables.monthlyEmployee401k ?? profile?.retirementContributions?.employee ?? 0,
      employer: optimizationVariables.monthlyEmployer401k ?? profile?.retirementContributions?.employer ?? 0,
    },
    spouseRetirementContributions: {
      employee: optimizationVariables.spouseMonthlyEmployee401k ?? profile?.spouseRetirementContributions?.employee ?? 0,
      employer: optimizationVariables.spouseMonthlyEmployer401k ?? profile?.spouseRetirementContributions?.employer ?? 0,
    },

    traditionalIRAContribution: optimizationVariables.annualTraditionalIRA ?? profile.traditionalIRAContribution ?? 0,
    rothIRAContribution: optimizationVariables.annualRothIRA ?? profile.rothIRAContribution ?? 0,
    spouseTraditionalIRAContribution: optimizationVariables.spouseAnnualTraditionalIRA ?? profile.spouseTraditionalIRAContribution ?? 0,
    spouseRothIRAContribution: optimizationVariables.spouseAnnualRothIRA ?? profile.spouseRothIRAContribution ?? 0,

    // Expenses and income in retirement
    expectedMonthlyExpensesRetirement: optimizationVariables.monthlyExpenses ?? profile.expectedMonthlyExpensesRetirement,
    partTimeIncomeRetirement: optimizationVariables.partTimeIncome ?? profile.partTimeIncomeRetirement,
    spousePartTimeIncomeRetirement: optimizationVariables.spousePartTimeIncome ?? profile.spousePartTimeIncomeRetirement,

    // LTC insurance flag
    hasLongTermCareInsurance: optimizationVariables.hasLongTermCareInsurance ?? profile.hasLongTermCareInsurance,
  };

  // Asset allocation sentinels: special values consumed downstream in MC
  if (typeof optimizationVariables.assetAllocation === 'string') {
    optimizedProfile.expectedRealReturn =
      optimizationVariables.assetAllocation === 'current-allocation' ? -2 :
      optimizationVariables.assetAllocation === 'glide-path' ? -1 :
      parseFloat(optimizationVariables.assetAllocation) / 100;
  }
  if (typeof optimizationVariables.spouseAssetAllocation === 'string') {
    optimizedProfile.spouseExpectedRealReturn =
      optimizationVariables.spouseAssetAllocation === 'current-allocation' ? -2 :
      optimizationVariables.spouseAssetAllocation === 'glide-path' ? -1 :
      parseFloat(optimizationVariables.spouseAssetAllocation) / 100;
  }

  // Debug logging to verify assets preservation
  const assetCount = Array.isArray(optimizedProfile.assets) ? optimizedProfile.assets.length : 0;
  const additionalAssetCount = Array.isArray(optimizedProfile.additionalAssets) ? optimizedProfile.additionalAssets.length : 0;
  const totalAssetValue = (optimizedProfile.assets || []).reduce((sum: number, a: any) => sum + (Number(a?.value) || 0), 0) +
                          (optimizedProfile.additionalAssets || []).reduce((sum: number, a: any) => sum + (Number(a?.value) || 0), 0);
  
  console.log('[OPTIMIZATION] Assets preserved:', {
    assetCount,
    additionalAssetCount,
    totalAssetValue: totalAssetValue.toFixed(0),
    hasAssets: assetCount > 0 || additionalAssetCount > 0
  });

  return optimizedProfile;
}

