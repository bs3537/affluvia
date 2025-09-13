export interface MonteCarloParams {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  spouseAge?: number;
  spouseLifeExpectancy?: number;
  currentRetirementAssets: number;
  annualGuaranteedIncome: number;
  annualRetirementExpenses: number;
  annualHealthcareCosts: number;
  expectedReturn: number;
  returnVolatility: number;
  inflationRate: number;
  stockAllocation: number;
  bondAllocation: number;
  cashAllocation: number;
  withdrawalRate: number;
  useGuardrails: boolean;
  taxRate: number;
  annualSavings: number;
  legacyGoal: number;
  assetBuckets: {
    taxDeferred: number;
    taxFree: number;
    capitalGains: number;
    cashEquivalents: number;
    totalAssets: number;
  };
  userHealthStatus?: string;
  spouseHealthStatus?: string;
}

export function buildMonteCarloParams(profile: any): MonteCarloParams {
  const currentAge = calculateAge(profile?.dateOfBirth);
  const spouseAge = profile?.spouseDateOfBirth ? calculateAge(profile.spouseDateOfBirth) : undefined;

  const stockAllocation = ((profile?.currentAllocation?.usStocks || 0) + (profile?.currentAllocation?.intlStocks || 0)) / 100;
  const bondAllocation = (profile?.currentAllocation?.bonds || 0) / 100;
  const cashAllocation = (profile?.currentAllocation?.cash || 0) / 100;

  // Simple mapping if no allocation is provided
  const hasAlloc = stockAllocation + bondAllocation + cashAllocation > 0;
  const stocks = hasAlloc ? stockAllocation : 0.6;
  const bonds = hasAlloc ? bondAllocation : 0.35;
  const cash = hasAlloc ? cashAllocation : 0.05;

  const expectedReturn = (Number(profile?.expectedRealReturn) || 6) / 100;
  const returnVolatility = 0.15;
  const inflationRate = (Number(profile?.expectedInflationRate) || 3) / 100;

  return {
    currentAge,
    retirementAge: Number(profile?.desiredRetirementAge) || 65,
    lifeExpectancy: Number(profile?.userLifeExpectancy) || 90,
    spouseAge,
    spouseLifeExpectancy: profile?.spouseLifeExpectancy ? Number(profile.spouseLifeExpectancy) : undefined,
    currentRetirementAssets: calculateRetirementAssets(profile?.assets),
    annualGuaranteedIncome: calculateGuaranteedIncome(profile),
    annualRetirementExpenses: (Number(profile?.expectedMonthlyExpensesRetirement) || 8000) * 12,
    annualHealthcareCosts: estimateHealthcareCosts(profile),
    expectedReturn,
    returnVolatility,
    inflationRate,
    stockAllocation: stocks,
    bondAllocation: bonds,
    cashAllocation: cash,
    withdrawalRate: (Number(profile?.withdrawalRate) || 4) / 100,
    useGuardrails: true,
    taxRate: 0.22,
    annualSavings: calculateAnnualSavings(profile),
    legacyGoal: Number(profile?.legacyGoal) || 0,
    assetBuckets: categorizeAssets(profile?.assets),
    userHealthStatus: profile?.userHealthStatus || 'good',
    spouseHealthStatus: profile?.spouseHealthStatus || 'good'
  };
}

export function calculateAge(dateOfBirth: string | undefined): number {
  if (!dateOfBirth) return 45;
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function calculateRetirementAssets(assets: any[]): number {
  if (!assets) return 0;
  const retirementTypes = ['401k', '403b', 'traditional-ira', 'roth-ira', 'hsa', 'taxable-brokerage', 'savings', 'checking'];
  return assets
    .filter(asset => retirementTypes.includes(asset.type))
    .reduce((sum, asset) => sum + (Number(asset.value) || 0), 0);
}

export function calculateGuaranteedIncome(profile: any): number {
  if (!profile) return 0;
  const socialSecurity = (Number(profile.socialSecurityBenefit) || 0) * 12;
  const pension = (Number(profile.pensionBenefit) || 0) * 12;
  const partTime = (Number(profile.partTimeIncomeRetirement) || 0) * 12;
  const spouseSS = (Number(profile.spouseSocialSecurityBenefit) || 0) * 12;
  const spousePension = (Number(profile.spousePensionBenefit) || 0) * 12;
  const spousePartTime = (Number(profile.spousePartTimeIncomeRetirement) || 0) * 12;
  return socialSecurity + pension + partTime + spouseSS + spousePension + spousePartTime;
}

export function estimateHealthcareCosts(profile: any): number {
  const age = calculateAge(profile?.dateOfBirth);
  const isMarried = profile?.maritalStatus === 'married';
  if (age >= 65) return isMarried ? 7200 : 3600;
  return isMarried ? 24000 : 12000;
}

export function calculateAnnualSavings(profile: any): number {
  if (!profile) return 0;
  const savingsRate = Number(profile.savingsRate) || 0;
  const annualIncome = Number(profile.annualIncome) || 0;
  const spouseIncome = Number(profile.spouseAnnualIncome) || 0;
  const totalIncome = annualIncome + spouseIncome;
  return totalIncome * (savingsRate / 100);
}

export function categorizeAssets(assets: any[]): any {
  if (!assets) {
    return {
      taxDeferred: 0,
      taxFree: 0,
      capitalGains: 0,
      cashEquivalents: 0,
      totalAssets: 0
    };
  }
  
  const buckets = {
    taxDeferred: 0,
    taxFree: 0,
    capitalGains: 0,
    cashEquivalents: 0,
    totalAssets: 0
  };
  
  assets.forEach(asset => {
    const value = Number(asset.value) || 0;
    if (['401k', '403b', 'traditional-ira'].includes(asset.type)) {
      buckets.taxDeferred += value;
    } else if (asset.type === 'roth-ira') {
      buckets.taxFree += value;
    } else if (asset.type === 'taxable-brokerage') {
      buckets.capitalGains += value;
    } else if (['savings', 'checking'].includes(asset.type)) {
      buckets.cashEquivalents += value;
    }
  });
  
  buckets.totalAssets = buckets.taxDeferred + buckets.taxFree + buckets.capitalGains + buckets.cashEquivalents;
  return buckets;
}

