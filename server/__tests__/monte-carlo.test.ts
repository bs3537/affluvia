import { describe, it, expect } from '@jest/globals';
import { 
  runRetirementMonteCarloSimulation,
  profileToRetirementParams,
  runMonteCarloSimulation,
  calculateEducationProjectionWithMonteCarlo
} from '../monte-carlo';

describe('Monte Carlo - Basic Functionality', () => {
  const createBasicProfile = () => ({
    dateOfBirth: '1980-01-01',
    maritalStatus: 'married',
    desiredRetirementAge: 65,
    userLifeExpectancy: 90,
    expectedMonthlyExpensesRetirement: 6000,
    socialSecurityBenefit: 2000,
    pensionBenefit: 0,
    partTimeIncomeRetirement: 0,
    annualIncome: 100000,
    spouseAnnualIncome: 80000,
    savingsRate: 15,
    retirementContributions: { employee: 500, employer: 500 },
    spouseRetirementContributions: { employee: 400, employer: 400 },
    assets: [
      { type: '401k', value: '300000', owner: 'user' },
      { type: 'traditional-ira', value: '100000', owner: 'user' },
      { type: 'roth-ira', value: '50000', owner: 'user' },
      { type: 'taxable-brokerage', value: '80000', owner: 'user' },
      { type: 'savings', value: '20000', owner: 'user' }
    ],
    currentAllocation: { usStocks: 60, bonds: 35, cash: 5 },
    expectedRealReturn: 6,
    expectedInflationRate: 3,
    withdrawalRate: 4,
    retirementState: 'FL',
    netWorth: { monthlyNetCashFlow: 3000 }
  });
  
  it('should convert profile to retirement params correctly', () => {
    const profile = createBasicProfile();
    const params = profileToRetirementParams(profile);
    
    expect(params.currentAge).toBeCloseTo(45, 0);
    expect(params.retirementAge).toBe(65);
    expect(params.lifeExpectancy).toBe(90);
    expect(params.currentRetirementAssets).toBe(550000); // Sum of retirement assets
    expect(params.annualSavings).toBeGreaterThan(0);
    expect(params.stockAllocation).toBe(0.6);
    expect(params.bondAllocation).toBe(0.35);
    expect(params.cashAllocation).toBe(0.05);
  });
  
  it('should run basic retirement simulation', () => {
    const profile = createBasicProfile();
    const params = profileToRetirementParams(profile);
    const result = runRetirementMonteCarloSimulation(params, 100);
    
    expect(result.probabilityOfSuccess).toBeGreaterThanOrEqual(0);
    expect(result.probabilityOfSuccess).toBeLessThanOrEqual(100);
    expect(result.scenarios.total).toBe(100);
    expect(result.scenarios.successful + result.scenarios.failed).toBe(100);
    expect(result.medianEndingBalance).toBeGreaterThanOrEqual(0);
  });
  
  it('should calculate percentiles correctly', () => {
    const profile = createBasicProfile();
    const params = profileToRetirementParams(profile);
    const result = runRetirementMonteCarloSimulation(params, 1000);
    
    // Percentiles should be in order
    expect(result.percentile10EndingBalance).toBeLessThanOrEqual(result.confidenceIntervals.percentile25);
    expect(result.confidenceIntervals.percentile25).toBeLessThanOrEqual(result.medianEndingBalance);
    expect(result.medianEndingBalance).toBeLessThanOrEqual(result.confidenceIntervals.percentile75);
    expect(result.confidenceIntervals.percentile75).toBeLessThanOrEqual(result.percentile90EndingBalance);
  });
});

describe('Monte Carlo - Education Planning', () => {
  const createEducationGoal = () => ({
    id: '1',
    userId: 1,
    studentName: 'Test Student',
    studentAge: 10,
    startYear: new Date().getFullYear() + 8,
    years: 4,
    goalType: 'college',
    collegeType: 'in-state-public',
    costOption: 'average',
    costPerYear: '35000',
    inflationRate: '5',
    currentSavings: '20000',
    monthlyContribution: '500',
    coverPercent: '100',
    scholarshipPerYear: '5000',
    expectedReturn: '6',
    riskProfile: 'moderate'
  });
  
  it('should run education Monte Carlo simulation', async () => {
    const goal = createEducationGoal();
    const result = await calculateEducationProjectionWithMonteCarlo(goal, null);
    
    expect(result.totalCostNeeded).toBeGreaterThan(0);
    expect(result.probabilityOfSuccess).toBeGreaterThanOrEqual(0);
    expect(result.probabilityOfSuccess).toBeLessThanOrEqual(100);
    expect(result.monthlyContributionNeeded).toBeGreaterThanOrEqual(0);
    expect(result.monteCarloAnalysis).toBeDefined();
    expect(result.monteCarloAnalysis.scenarios.total).toBeGreaterThan(0);
  });
  
  it('should handle glide path strategy for education', async () => {
    const goal = createEducationGoal();
    goal.riskProfile = 'glide';
    
    const result = await calculateEducationProjectionWithMonteCarlo(goal, null);
    
    expect(result.glidePathProjection).toBeDefined();
    expect(result.glidePathProjection?.yearlyProjection).toBeDefined();
    expect(result.glidePathProjection?.yearlyProjection.length).toBeGreaterThan(0);
  });
  
  it('should calculate required monthly contribution for target success', async () => {
    const goal = createEducationGoal();
    goal.monthlyContribution = '100'; // Start with low contribution
    
    const result = await calculateEducationProjectionWithMonteCarlo(goal, null);
    
    // If success rate is low, should recommend higher contribution
    if (result.probabilityOfSuccess < 80) {
      expect(result.monthlyContributionNeeded).toBeGreaterThan(100);
    }
  });
});

describe('Monte Carlo - Edge Cases', () => {
  it('should handle single person profile', () => {
    const profile = createBasicProfile();
    profile.maritalStatus = 'single';
    profile.spouseAnnualIncome = 0;
    profile.spouseRetirementContributions = { employee: 0, employer: 0 };
    
    const params = profileToRetirementParams(profile);
    const result = runRetirementMonteCarloSimulation(params, 100);
    
    expect(result).toBeDefined();
    expect(params.spouseAge).toBeUndefined();
  });
  
  it('should handle no current assets', () => {
    const profile = createBasicProfile();
    profile.assets = [];
    
    const params = profileToRetirementParams(profile);
    expect(params.currentRetirementAssets).toBe(0);
    
    const result = runRetirementMonteCarloSimulation(params, 100);
    expect(result.probabilityOfSuccess).toBeGreaterThanOrEqual(0);
  });
  
  it('should handle immediate retirement', () => {
    const profile = createBasicProfile();
    profile.dateOfBirth = '1960-01-01'; // Make person 65
    profile.desiredRetirementAge = 65;
    
    const params = profileToRetirementParams(profile);
    const result = runRetirementMonteCarloSimulation(params, 100);
    
    expect(result).toBeDefined();
    expect(params.currentAge).toBeGreaterThanOrEqual(64);
  });
});

describe('Monte Carlo - Validation', () => {
  it('should produce reasonable success rates for typical scenarios', () => {
    const profile = createBasicProfile();
    const params = profileToRetirementParams(profile);
    const result = runRetirementMonteCarloSimulation(params, 1000);
    
    // For a reasonable scenario, expect success rate between 40-95%
    expect(result.probabilityOfSuccess).toBeGreaterThan(40);
    expect(result.probabilityOfSuccess).toBeLessThan(95);
  });
  
  it('should calculate safe withdrawal rate correctly', () => {
    const profile = createBasicProfile();
    profile.withdrawalRate = 6; // High withdrawal rate
    
    const params = profileToRetirementParams(profile);
    const result = runRetirementMonteCarloSimulation(params, 1000);
    
    // Safe withdrawal rate should be lower than initial if success < 80%
    if (result.probabilityOfSuccess < 80) {
      expect(result.safeWithdrawalRate).toBeLessThan(0.06);
    }
  });
  
  it('should handle negative returns gracefully', () => {
    const params = runMonteCarloSimulation({
      currentSavings: 100000,
      monthlyContribution: 1000,
      yearsUntilStart: 10,
      totalCostNeeded: 200000,
      expectedReturn: 0.06,
      inflationRate: 0.03,
      returnVolatility: 0.20 // High volatility
    }, 100);
    
    expect(params.probabilityOfSuccess).toBeGreaterThanOrEqual(0);
    expect(params.probabilityOfSuccess).toBeLessThanOrEqual(100);
    expect(params.projectedValues.worst).toBeGreaterThanOrEqual(0);
  });
});

describe('Monte Carlo - Tax Calculations', () => {
  it('should categorize assets by tax treatment', () => {
    const profile = createBasicProfile();
    const params = profileToRetirementParams(profile);
    
    expect(params.assetBuckets.taxDeferred).toBe(400000); // 401k + IRA
    expect(params.assetBuckets.taxFree).toBe(50000); // Roth IRA
    expect(params.assetBuckets.capitalGains).toBe(80000); // Brokerage
    expect(params.assetBuckets.cashEquivalents).toBe(20000); // Savings
    expect(params.assetBuckets.totalAssets).toBe(550000);
  });
  
  it('should calculate appropriate tax rate', () => {
    const profile = createBasicProfile();
    const params = profileToRetirementParams(profile);
    
    // Should have reasonable tax rate
    expect(params.taxRate).toBeGreaterThan(0);
    expect(params.taxRate).toBeLessThan(0.4);
  });
});

// Helper function for tests
function createBasicProfile() {
  return {
    dateOfBirth: '1980-01-01',
    maritalStatus: 'married' as const,
    desiredRetirementAge: 65,
    userLifeExpectancy: 90,
    expectedMonthlyExpensesRetirement: 6000,
    socialSecurityBenefit: 2000,
    pensionBenefit: 0,
    partTimeIncomeRetirement: 0,
    annualIncome: 100000,
    spouseAnnualIncome: 80000,
    savingsRate: 15,
    retirementContributions: { employee: 500, employer: 500 },
    spouseRetirementContributions: { employee: 400, employer: 400 },
    assets: [
      { type: '401k', value: '300000', owner: 'user' },
      { type: 'traditional-ira', value: '100000', owner: 'user' },
      { type: 'roth-ira', value: '50000', owner: 'user' },
      { type: 'taxable-brokerage', value: '80000', owner: 'user' },
      { type: 'savings', value: '20000', owner: 'user' }
    ],
    currentAllocation: { usStocks: 60, bonds: 35, cash: 5 },
    expectedRealReturn: 6,
    expectedInflationRate: 3,
    withdrawalRate: 4,
    retirementState: 'FL',
    netWorth: { monthlyNetCashFlow: 3000 }
  };
}