import type { Request } from 'express';

// Normalizes and applies optimization variables onto a copy of the profile,
// preserving intake form values when a variable is not provided.
export function applyOptimizationVariables(profile: any, rawVars: any) {
  const optimizationVariables = rawVars || {};

  const optimizedProfile: any = {
    ...profile,

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

  return optimizedProfile;
}

