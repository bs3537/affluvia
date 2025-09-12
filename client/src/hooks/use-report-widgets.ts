import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

export function useReportWidgets() {
  const { data: profile } = useQuery({
    queryKey: ['/api/financial-profile'],
    queryFn: async () => {
      const res = await fetch('/api/financial-profile', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
    staleTime: 10_000,
  });

  // Compute ending portfolio impact from cached MC withdrawals (same as Optimization tab)
  const endingImpact = useMemo(() => {
    console.log('[USE-REPORT-WIDGETS] Computing ending impact from profile:', {
      hasProfile: !!profile,
      hasOptimizationVariables: !!profile?.optimizationVariables,
      hasMcWithdrawalsData: !!profile?.optimizationVariables?.mcWithdrawalsData,
      hasBaselineData: !!profile?.optimizationVariables?.mcWithdrawalsData?.baselineData,
      hasOptimizedData: !!profile?.optimizationVariables?.mcWithdrawalsData?.optimizedData,
      baselineLength: profile?.optimizationVariables?.mcWithdrawalsData?.baselineData?.length,
      optimizedLength: profile?.optimizationVariables?.mcWithdrawalsData?.optimizedData?.length
    });

    const saved = profile?.optimizationVariables?.mcWithdrawalsData;
    if (!saved?.baselineData?.length || !saved?.optimizedData?.length) {
      console.log('[USE-REPORT-WIDGETS] No MC withdrawals data available');
      return null;
    }

    const lastBase = saved.baselineData[saved.baselineData.length - 1] || {};
    const lastOpt = saved.optimizedData[saved.optimizedData.length - 1] || {};

    const base =
      lastBase.totalBalance ?? lastBase.portfolioValue ?? lastBase.totalPortfolioValue ?? 0;
    const opt =
      lastOpt.totalBalance ?? lastOpt.portfolioValue ?? lastOpt.totalPortfolioValue ?? 0;

    const impact = opt - base;
    console.log('[USE-REPORT-WIDGETS] Calculated ending impact:', {
      lastBaseData: lastBase,
      lastOptData: lastOpt,
      baseValue: base,
      optValue: opt,
      impact: impact
    });

    return impact;
  }, [profile]);


  const calc = profile?.calculations || {};
  const optimizationVariables = profile?.optimizationVariables || {};

  return {
    healthScore: calc.healthScore ?? null,
    monthlyCashFlow: calc.monthlyCashFlow ?? null,
    netWorth: calc.netWorth ?? null,
    emergencyReadinessScore: calc.emergencyReadinessScoreCFP ?? profile?.emergencyReadinessScoreCFP ?? null,
    optimizationImpact: endingImpact ?? null,
    optimizationVariables: optimizationVariables,
  };
}
