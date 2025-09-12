// Stress Test Types and Interfaces for Retirement Planning

export interface StressScenarioParameter {
  value: number;
  unit: 'percentage' | 'years' | 'amount';
  timing?: 'immediate' | 'retirement' | 'ongoing';
  min?: number;
  max?: number;
  step?: number;
}

export interface StressScenario {
  id: string;
  name: string;
  description: string;
  category: 'market' | 'inflation' | 'longevity' | 'costs' | 'income' | 'timing';
  enabled: boolean;
  parameters: StressScenarioParameter;
  icon?: string;
}

export interface StressTestRequest {
  scenarios: StressScenario[];
  baselineVariables?: any; // OptimizationVariables type from existing code (deprecated)
  optimizationVariables?: any; // New field name
  runCombined?: boolean;
}

export interface StressTestResult {
  scenarioId: string;
  scenarioName: string;
  successProbability: number;
  baselineSuccessProbability: number;
  impactPercentage: number; // Change from baseline
  impactDescription: string;
  details?: {
    medianPortfolioValue?: number;
    depletionAge?: number;
    totalShortfall?: number;
    yearlyCashFlows?: any[];
  };
}

export interface StressTestResponse {
  plan?: string; // 'baseline' or 'optimized'
  baseline: {
    successProbability: number;
    details?: any;
  };
  individualResults: StressTestResult[];
  combinedResult?: StressTestResult;
  timestamp: number;
  planEcho?: {
    plan: string;
    retirementAge: number;
    socialSecurityAge: number;
    monthlyExpenses: number;
  };
}

// Default stress test scenarios
export const DEFAULT_STRESS_SCENARIOS: StressScenario[] = [
  {
    id: 'bear-market-immediate',
    name: 'Bear Market (Immediate)',
    description: 'Market drops 30% immediately',
    category: 'market',
    enabled: false,
    parameters: {
      value: -30,
      unit: 'percentage',
      timing: 'immediate',
      min: -50,
      max: -10,
      step: 5
    },
    icon: 'TrendingDown'
  },
  {
    id: 'bear-market-retirement',
    name: 'Bear Market (Year 1 of Retirement)',
    description: 'Market drops 30% in first year of retirement',
    category: 'market',
    enabled: false,
    parameters: {
      value: -30,
      unit: 'percentage',
      timing: 'retirement',
      min: -50,
      max: -10,
      step: 5
    },
    icon: 'TrendingDown'
  },
  {
    id: 'high-inflation',
    name: 'High Inflation',
    description: '5% annual inflation throughout retirement',
    category: 'inflation',
    enabled: false,
    parameters: {
      value: 5,
      unit: 'percentage',
      timing: 'ongoing',
      min: 3,
      max: 10,
      step: 0.5
    },
    icon: 'TrendingUp'
  },
  {
    id: 'longevity',
    name: 'Extended Longevity',
    description: 'Both spouses live 5 years longer',
    category: 'longevity',
    enabled: false,
    parameters: {
      value: 5,
      unit: 'years',
      timing: 'ongoing',
      min: 1,
      max: 10,
      step: 1
    },
    icon: 'Heart'
  },
  {
    id: 'healthcare-costs',
    name: 'Higher Healthcare Costs',
    description: 'Healthcare costs increase by 20%',
    category: 'costs',
    enabled: false,
    parameters: {
      value: 20,
      unit: 'percentage',
      timing: 'ongoing',
      min: 10,
      max: 50,
      step: 5
    },
    icon: 'Activity'
  },
  {
    id: 'social-security-cut',
    name: 'Social Security Reduction',
    description: 'Social Security benefits reduced by 20%',
    category: 'income',
    enabled: false,
    parameters: {
      value: -20,
      unit: 'percentage',
      timing: 'ongoing',
      min: -30,
      max: -10,
      step: 5
    },
    icon: 'Shield'
  },
  {
    id: 'higher-taxes',
    name: 'Higher Tax Rates',
    description: 'Tax rates increase by 20%',
    category: 'costs',
    enabled: false,
    parameters: {
      value: 20,
      unit: 'percentage',
      timing: 'ongoing',
      min: 10,
      max: 40,
      step: 5
    },
    icon: 'Receipt'
  },
  {
    id: 'lower-returns',
    name: 'Lower Investment Returns',
    description: 'Portfolio returns reduced by 1% annually',
    category: 'market',
    enabled: false,
    parameters: {
      value: -1,
      unit: 'percentage',
      timing: 'ongoing',
      min: -3,
      max: -0.5,
      step: 0.25
    },
    icon: 'BarChart'
  },
  {
    id: 'early-retirement',
    name: 'Early Retirement',
    description: 'Both spouses retire 5 years earlier',
    category: 'timing',
    enabled: false,
    parameters: {
      value: -5,
      unit: 'years',
      timing: 'immediate',
      min: -10,
      max: -1,
      step: 1
    },
    icon: 'Clock'
  }
];

// Helper function to get scenario by ID
export function getScenarioById(id: string): StressScenario | undefined {
  return DEFAULT_STRESS_SCENARIOS.find(s => s.id === id);
}

// Helper function to get enabled scenarios
export function getEnabledScenarios(scenarios: StressScenario[]): StressScenario[] {
  return scenarios.filter(s => s.enabled);
}

// Helper function to calculate combined impact description
export function getCombinedImpactDescription(results: StressTestResult[]): string {
  const enabledCount = results.filter(r => r.impactPercentage !== 0).length;
  if (enabledCount === 0) return 'No stress scenarios applied';
  if (enabledCount === 1) return results.find(r => r.impactPercentage !== 0)?.impactDescription || '';
  return `Combined impact of ${enabledCount} stress scenarios`;
}