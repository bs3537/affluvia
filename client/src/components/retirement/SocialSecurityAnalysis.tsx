import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnnualSocialSecurityCashFlows } from '@/components/retirement/AnnualSocialSecurityCashFlows';
import { CumulativeSocialSecurityComparison } from '@/components/retirement/CumulativeSocialSecurityComparison';
import { CumulativeCashFlowsByAge } from '@/components/retirement/CumulativeCashFlowsByAge';
import { SocialSecurityClaimingComparison } from '@/components/retirement/SocialSecurityClaimingComparison';
import { SocialSecurityClaimingComparisonNew } from '@/components/retirement/SocialSecurityClaimingComparisonNew';
import { CumulativeSocialSecurityComparisonNew } from '@/components/retirement/CumulativeSocialSecurityComparisonNew';
import { AnnualSocialSecurityCashFlowsNew } from '@/components/retirement/AnnualSocialSecurityCashFlowsNew';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, Info } from 'lucide-react';
import { 
  calculateScenarios, 
  calculateBreakevenAnalysis,
  findOptimalClaimingAges
} from '@/utils/socialSecurityLifetimeIncome';
import { calculateAIME, calculatePrimaryInsuranceAmount } from '@/utils/socialSecurityOptimizer';

interface SocialSecurityAnalysisProps {
  profile: any;
  variables: any;
  isOptimized: boolean;
}

const SocialSecurityAnalysis: React.FC<SocialSecurityAnalysisProps> = ({ 
  profile, 
  variables,
  isOptimized 
}) => {
  // Removed baseline tab - only showing optimized plan
  
  // Use actual Social Security benefit amounts from profile
  // These are the monthly benefits at Full Retirement Age (67)
  const userPIA = useMemo(() => {
    if (!profile) return 0;
    
    // Use the actual Social Security benefit from profile
    // This is already the monthly benefit amount at FRA
    const ssBenefit = profile.socialSecurityBenefit;
    if (ssBenefit && typeof ssBenefit === 'string') {
      return parseFloat(ssBenefit);
    } else if (typeof ssBenefit === 'number') {
      return ssBenefit;
    }
    
    // Fallback: If no SS benefit stored, calculate from income (less accurate)
    if (profile.annualIncome) {
      const monthlyIncome = (profile.annualIncome || 0) / 12;
      const userAIME = calculateAIME(monthlyIncome, profile.age || 65, 67);
      return calculatePrimaryInsuranceAmount(userAIME);
    }
    
    return 0;
  }, [profile]);
  
  const spousePIA = useMemo(() => {
    if (!profile || !profile.isMarried) return 0;
    
    // Use the actual spouse Social Security benefit from profile
    const spouseSsBenefit = profile.spouseSocialSecurityBenefit;
    if (spouseSsBenefit && typeof spouseSsBenefit === 'string') {
      return parseFloat(spouseSsBenefit);
    } else if (typeof spouseSsBenefit === 'number') {
      return spouseSsBenefit;
    }
    
    // Fallback: If no spouse SS benefit stored, calculate from income (less accurate)
    if (profile.spouseAnnualIncome) {
      const monthlyIncome = (profile.spouseAnnualIncome || 0) / 12;
      const spouseAIME = calculateAIME(monthlyIncome, profile.spouseAge || 65, 67);
      return calculatePrimaryInsuranceAmount(spouseAIME);
    }
    
    return 0;
  }, [profile]);
  
  // Removed baseline scenarios - only using optimized plan
  
  // Get optimized scenarios (using variables if available)
  const optimizedScenarios = useMemo(() => {
    if (!profile || !userPIA) return [];
    
    const userParams = {
      pia: userPIA,
      currentAge: profile.age || 65,
      lifeExpectancy: profile.userLifeExpectancy || profile.lifeExpectancy || 93, // Use 93 as default
      fra: 67,
      discountRate: 0.03,
      inflationRate: 0.025
    };
    
    const spouseParams = profile.isMarried && spousePIA ? {
      pia: spousePIA,
      currentAge: profile.spouseAge || 65,
      lifeExpectancy: profile.spouseLifeExpectancy || 93, // Use 93 as default
      fra: 67,
      discountRate: 0.03,
      inflationRate: 0.025
    } : undefined;
    
    // Use optimized ages from variables if available, or calculate optimal based on NPV
    const optimalUserAge = variables.socialSecurityAge || profile.optimalSocialSecurityAge;
    const optimalSpouseAge = variables.spouseSocialSecurityAge || profile.optimalSpouseSocialSecurityAge;
    
    // If no optimal ages provided, calculate them
    const optimal = (!optimalUserAge || !optimalSpouseAge) ? 
      findOptimalClaimingAges(userParams, spouseParams) : 
      { userAge: optimalUserAge, spouseAge: optimalSpouseAge };
    
    return calculateScenarios(
      userParams,
      spouseParams,
      optimal.userAge,
      optimal.spouseAge || undefined
    );
  }, [profile, userPIA, spousePIA, variables]);
  
  // Removed baseline breakeven analysis - only using optimized
  
  // Calculate breakeven analysis for optimized plan
  const optimizedBreakevenAnalysis = useMemo(() => {
    if (!profile || !userPIA || optimizedScenarios.length === 0) return null;
    
    // Use the age from the scenario with highest lifetime income (first in sorted array)
    const optimalScenario = optimizedScenarios[0];
    
    // Extract the optimal ages from the winning scenario
    let optimalUserAge = variables?.socialSecurityAge || profile.optimalSocialSecurityAge || 70;
    let optimalSpouseAge = variables?.spouseSocialSecurityAge || profile.optimalSpouseSocialSecurityAge || 70;
    
    // If we have the optimal scenario, extract ages from it
    if (optimalScenario) {
      optimalUserAge = optimalScenario.userResult.claimAge;
      optimalSpouseAge = optimalScenario.spouseResult?.claimAge || optimalUserAge;
    }
    
    // Determine retirement ages for each spouse individually
    const userRetirementAge = profile.desiredRetirementAge || profile.retirementAge || profile.age;
    const spouseRetirementAge = profile.spouseDesiredRetirementAge || userRetirementAge;
    
    return calculateBreakevenAnalysis(
      userPIA,
      profile.age || 65,
      profile.userLifeExpectancy || profile.lifeExpectancy || 85,
      userRetirementAge, // User's individual retirement age
      optimalUserAge,
      profile.isMarried ? spousePIA : undefined,
      profile.isMarried ? profile.spouseAge : undefined,
      profile.isMarried ? profile.spouseLifeExpectancy : undefined,
      profile.isMarried ? spouseRetirementAge : undefined, // Spouse's individual retirement age
      profile.isMarried ? optimalSpouseAge : undefined,
      0.025 // Inflation rate
    );
  }, [profile, userPIA, spousePIA, optimizedScenarios, variables]);
  
  // Use optimized breakeven analysis
  const breakevenAnalysis = optimizedBreakevenAnalysis;
  
  // Removed IncomeBar component - no longer needed without baseline tab
  
  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-xl text-white flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-400" />
          Social Security Lifetime Income Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Info Alert */}
        <Alert className="bg-blue-900/20 border-blue-500/50 mb-6">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-300">
            Compare total lifetime Social Security income across different claiming strategies. 
            The analysis uses nominal dollars with {((0.025) * 100).toFixed(1)}% annual inflation adjustment.
          </AlertDescription>
        </Alert>
        
        {/* Social Security Analysis Content - Optimized Plan Only */}
        <div className="space-y-4">
          {/* Social Security Claiming Comparison */}
          <SocialSecurityClaimingComparisonNew profile={profile} isLocked={false} variables={variables} />
          
          {/* Cumulative Benefit Comparison */}
          <CumulativeSocialSecurityComparisonNew profile={profile} variables={variables} />
          
          {/* Annual Social Security Cash Flows */}
          <AnnualSocialSecurityCashFlowsNew profile={profile} isLocked={false} variables={variables} />
        </div>
      </CardContent>
    </Card>
  );
};

export default SocialSecurityAnalysis;