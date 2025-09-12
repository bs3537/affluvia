/**
 * Social Security Optimization Engine
 * 
 * Implements the sustainable_real_spend_95 optimization algorithm
 * to find optimal Social Security claiming ages that maximize 
 * lifetime spending power with 95% Monte Carlo success rate.
 */

interface SocialSecurityProfile {
  // Basic demographics
  dateOfBirth: string;
  sex: 'male' | 'female';
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  
  // Social Security data
  primaryInsuranceAmount: number; // PIA - monthly benefit at FRA
  fullRetirementAge: number; // 66, 67, etc.
  
  // Spouse data (if married)
  spouseDateOfBirth?: string;
  spouseSex?: 'male' | 'female';
  spousePrimaryInsuranceAmount?: number;
  spouseFullRetirementAge?: number;
  
  // Financial profile
  currentAge: number;
  spouseCurrentAge?: number;
  retirementAge: number;
  spouseRetirementAge?: number;
  
  // Other retirement income
  pensionBenefit?: number;
  spousePensionBenefit?: number;
  partTimeIncome?: number;
  spousePartTimeIncome?: number;
  
  // Spending and expenses
  monthlyExpensesRetirement: number;
  hasLongTermCareInsurance: boolean;
  
  // Portfolio data
  portfolio: {
    taxable: number;
    taxDeferred: number;
    taxFree: number;
    hsa: number;
    expectedRealReturn: number;
  };
  
  // Tax information
  taxFilingStatus: string;
  stateOfResidence: string;
}

interface ClaimingStrategy {
  primaryAge: number;
  spouseAge?: number;
}

interface OptimizationResult {
  optimalStrategy: ClaimingStrategy;
  sustainableRealSpend95: number;
  lifetimeSpendingIncrease: number; // % increase over baseline
  confidenceLevel: number;
  analysis: {
    totalScenarios: number;
    successRate: number;
    medianLifetimeBenefit: number;
    survivorIncome: number;
    irmaaYears: number;
  };
}

interface MonteCarloConfig {
  iterations: number;
  successTarget: number; // 0.95 for 95%
  horizon: number; // age to project to
  marketVolatility: number;
  inflationRate: number;
}

class SocialSecurityOptimizer {
  private config: MonteCarloConfig;
  
  constructor(config: Partial<MonteCarloConfig> = {}) {
    this.config = {
      iterations: 1000,
      successTarget: 0.95,
      horizon: 95,
      marketVolatility: 0.15,
      inflationRate: 0.025,
      ...config
    };
  }

  /**
   * Main optimization function
   * Finds the optimal Social Security claiming strategy
   */
  async optimizeSocialSecurity(profile: SocialSecurityProfile): Promise<OptimizationResult> {
    const strategies = this.generateClaimingStrategies(profile);
    console.log(`Evaluating ${strategies.length} Social Security claiming strategies...`);
    
    let bestStrategy: ClaimingStrategy | null = null;
    let bestScore = 0;
    let bestAnalysis: any = null;
    
    // Use common random numbers for fair comparison
    const randomSeeds = this.generateRandomSeeds(this.config.iterations);
    
    for (const strategy of strategies) {
      try {
        const score = await this.evaluateStrategy(profile, strategy, randomSeeds);
        console.log(`Strategy ${strategy.primaryAge}${strategy.spouseAge ? `/${strategy.spouseAge}` : ''}: $${score.toFixed(0)}/year`);
        
        if (score > bestScore) {
          bestScore = score;
          bestStrategy = strategy;
          bestAnalysis = await this.getDetailedAnalysis(profile, strategy, randomSeeds);
        }
      } catch (error) {
        console.warn(`Failed to evaluate strategy ${strategy.primaryAge}/${strategy.spouseAge}:`, error);
      }
    }
    
    if (!bestStrategy) {
      throw new Error('No valid Social Security strategy found');
    }
    
    // Calculate improvement over baseline (current user selection)
    const baselineStrategy: ClaimingStrategy = {
      primaryAge: profile.currentAge >= 62 ? Math.min(profile.currentAge, 70) : 67,
      spouseAge: profile.spouseCurrentAge && profile.spouseCurrentAge >= 62 ? Math.min(profile.spouseCurrentAge, 70) : 67
    };
    
    const baselineScore = await this.evaluateStrategy(profile, baselineStrategy, randomSeeds);
    const improvementPercent = ((bestScore - baselineScore) / baselineScore) * 100;
    
    return {
      optimalStrategy: bestStrategy,
      sustainableRealSpend95: bestScore,
      lifetimeSpendingIncrease: improvementPercent,
      confidenceLevel: this.config.successTarget,
      analysis: bestAnalysis
    };
  }

  /**
   * Generate all possible claiming age combinations
   */
  private generateClaimingStrategies(profile: SocialSecurityProfile): ClaimingStrategy[] {
    const strategies: ClaimingStrategy[] = [];
    
    // Primary ages: 62-70 (yearly increments)
    for (let primaryAge = 62; primaryAge <= 70; primaryAge++) {
      if (profile.maritalStatus === 'married' && profile.spouseCurrentAge) {
        // Spouse ages: 62-70 (yearly increments)
        for (let spouseAge = 62; spouseAge <= 70; spouseAge++) {
          strategies.push({ primaryAge, spouseAge });
        }
      } else {
        // Single person
        strategies.push({ primaryAge });
      }
    }
    
    return strategies;
  }

  /**
   * Evaluate a specific claiming strategy using Monte Carlo simulation
   */
  private async evaluateStrategy(
    profile: SocialSecurityProfile, 
    strategy: ClaimingStrategy, 
    randomSeeds: number[]
  ): Promise<number> {
    // Binary search to find maximum sustainable spending with 95% success
    let lowSpend = 20000; // Minimum viable spending
    let highSpend = Math.min(profile.monthlyExpensesRetirement * 12 * 2, 200000); // Upper bound
    let optimalSpend = lowSpend;
    
    const tolerance = 100; // $100 tolerance
    
    while (highSpend - lowSpend > tolerance) {
      const testSpend = (lowSpend + highSpend) / 2;
      const successRate = await this.runMonteCarloSimulation(profile, strategy, testSpend, randomSeeds);
      
      if (successRate >= this.config.successTarget) {
        optimalSpend = testSpend;
        lowSpend = testSpend;
      } else {
        highSpend = testSpend;
      }
    }
    
    return optimalSpend;
  }

  /**
   * Run Monte Carlo simulation for a given spending level
   */
  private async runMonteCarloSimulation(
    profile: SocialSecurityProfile,
    strategy: ClaimingStrategy,
    annualSpending: number,
    randomSeeds: number[]
  ): Promise<number> {
    let successfulPaths = 0;
    
    for (let i = 0; i < this.config.iterations; i++) {
      const seed = randomSeeds[i];
      const pathSuccess = this.simulateSinglePath(profile, strategy, annualSpending, seed);
      if (pathSuccess) {
        successfulPaths++;
      }
    }
    
    return successfulPaths / this.config.iterations;
  }

  /**
   * Simulate a single retirement path
   */
  private simulateSinglePath(
    profile: SocialSecurityProfile,
    strategy: ClaimingStrategy,
    annualSpending: number,
    seed: number
  ): boolean {
    // Initialize portfolio values
    let portfolioValue = profile.portfolio.taxable + profile.portfolio.taxDeferred + 
                        profile.portfolio.taxFree + profile.portfolio.hsa;
    
    const currentYear = new Date().getFullYear();
    const retirementYear = currentYear + (profile.retirementAge - profile.currentAge);
    
    // Simulate each year from retirement to horizon
    for (let year = retirementYear; year <= retirementYear + (this.config.horizon - profile.retirementAge); year++) {
      const age = profile.retirementAge + (year - retirementYear);
      const spouseAge = profile.spouseCurrentAge ? profile.spouseRetirementAge! + (year - retirementYear) : 0;
      
      // Calculate annual income for this year
      const socialSecurityIncome = this.calculateSocialSecurityIncome(profile, strategy, age, spouseAge);
      const pensionIncome = (profile.pensionBenefit || 0) * 12 + (profile.spousePensionBenefit || 0) * 12;
      const partTimeIncome = (profile.partTimeIncome || 0) * 12 + (profile.spousePartTimeIncome || 0) * 12;
      
      const totalGuaranteedIncome = socialSecurityIncome + pensionIncome + partTimeIncome;
      
      // Calculate required portfolio withdrawal
      const requiredWithdrawal = Math.max(0, annualSpending - totalGuaranteedIncome);
      
      // Apply market returns (simplified random walk)
      const marketReturn = this.generateMarketReturn(seed + year);
      portfolioValue *= (1 + marketReturn);
      
      // Subtract withdrawal
      portfolioValue -= requiredWithdrawal;
      
      // Account for long-term care costs (if no insurance)
      if (!profile.hasLongTermCareInsurance && age >= 75) {
        const ltcProbability = this.calculateLTCProbability(age);
        if (Math.random() < ltcProbability) {
          portfolioValue -= 150000; // Average LTC cost
        }
      }
      
      // Check for portfolio depletion
      if (portfolioValue < 0) {
        return false; // Path failed
      }
    }
    
    return true; // Path succeeded
  }

  /**
   * Calculate Social Security benefits for a given age and strategy
   */
  private calculateSocialSecurityIncome(
    profile: SocialSecurityProfile,
    strategy: ClaimingStrategy,
    currentAge: number,
    spouseAge: number
  ): number {
    let totalAnnualBenefit = 0;
    
    // Primary earner benefits
    if (currentAge >= strategy.primaryAge) {
      const primaryMonthlyBenefit = this.calculateMonthlyBenefit(
        profile.primaryInsuranceAmount,
        profile.fullRetirementAge,
        strategy.primaryAge
      );
      totalAnnualBenefit += primaryMonthlyBenefit * 12;
    }
    
    // Spouse benefits (if married and spouse has claimed)
    if (profile.maritalStatus === 'married' && strategy.spouseAge && spouseAge >= strategy.spouseAge) {
      const spouseMonthlyBenefit = this.calculateMonthlyBenefit(
        profile.spousePrimaryInsuranceAmount || profile.primaryInsuranceAmount * 0.5,
        profile.spouseFullRetirementAge || 67,
        strategy.spouseAge
      );
      totalAnnualBenefit += spouseMonthlyBenefit * 12;
    }
    
    return totalAnnualBenefit;
  }

  /**
   * Calculate monthly Social Security benefit based on claiming age
   */
  private calculateMonthlyBenefit(pia: number, fra: number, claimAge: number): number {
    if (claimAge < 62) return 0;
    if (claimAge > 70) claimAge = 70;
    
    let benefit = pia;
    
    if (claimAge < fra) {
      // Early claiming reduction
      const monthsEarly = (fra - claimAge) * 12;
      const reductionPercent = Math.min(36, monthsEarly) * (5/9) / 100 + 
                              Math.max(0, monthsEarly - 36) * (5/12) / 100;
      benefit *= (1 - reductionPercent);
    } else if (claimAge > fra) {
      // Delayed retirement credits
      const yearsBeyondFRA = claimAge - fra;
      benefit *= (1 + yearsBeyondFRA * 0.08);
    }
    
    return benefit;
  }

  /**
   * Generate market returns for simulation
   */
  private generateMarketReturn(seed: number): number {
    // Simplified random normal distribution
    const random1 = this.seededRandom(seed);
    const random2 = this.seededRandom(seed + 1);
    
    // Box-Muller transformation for normal distribution
    const normalRandom = Math.sqrt(-2 * Math.log(random1)) * Math.cos(2 * Math.PI * random2);
    
    // Apply to market returns (expected return minus inflation, plus volatility)
    const realReturn = 0.05; // Default real return for SS optimization
    return realReturn + normalRandom * this.config.marketVolatility;
  }

  /**
   * Calculate long-term care probability by age
   */
  private calculateLTCProbability(age: number): number {
    // Simplified LTC probability model
    if (age < 75) return 0;
    if (age < 85) return 0.02; // 2% annual probability
    return 0.05; // 5% annual probability after 85
  }

  /**
   * Generate common random seeds for fair strategy comparison
   */
  private generateRandomSeeds(count: number): number[] {
    const seeds: number[] = [];
    for (let i = 0; i < count; i++) {
      seeds.push(Math.random() * 1000000);
    }
    return seeds;
  }

  /**
   * Seeded random number generator for reproducibility
   */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Get detailed analysis for a strategy
   */
  private async getDetailedAnalysis(
    profile: SocialSecurityProfile,
    strategy: ClaimingStrategy,
    randomSeeds: number[]
  ): Promise<any> {
    // Run additional simulations for analysis
    const lifetimeBenefits: number[] = [];
    let irmaaYears = 0;
    
    for (let i = 0; i < Math.min(1000, this.config.iterations); i++) {
      const seed = randomSeeds[i];
      const pathData = this.simulatePathWithDetails(profile, strategy, seed);
      lifetimeBenefits.push(pathData.lifetimeBenefit);
      irmaaYears += pathData.irmaaYears;
    }
    
    lifetimeBenefits.sort((a, b) => a - b);
    
    return {
      totalScenarios: this.config.iterations,
      successRate: this.config.successTarget,
      medianLifetimeBenefit: lifetimeBenefits[Math.floor(lifetimeBenefits.length / 2)],
      survivorIncome: this.calculateSurvivorIncome(profile, strategy),
      irmaaYears: Math.round(irmaaYears / 1000)
    };
  }

  /**
   * Simulate path with detailed tracking
   */
  private simulatePathWithDetails(profile: SocialSecurityProfile, strategy: ClaimingStrategy, seed: number): any {
    return {
      lifetimeBenefit: 500000, // Placeholder
      irmaaYears: 0 // Placeholder
    };
  }

  /**
   * Calculate survivor income
   */
  private calculateSurvivorIncome(profile: SocialSecurityProfile, strategy: ClaimingStrategy): number {
    if (profile.maritalStatus !== 'married') return 0;
    
    // Survivor gets the higher of the two benefits
    const primaryBenefit = this.calculateMonthlyBenefit(
      profile.primaryInsuranceAmount,
      profile.fullRetirementAge,
      strategy.primaryAge
    );
    
    const spouseBenefit = this.calculateMonthlyBenefit(
      profile.spousePrimaryInsuranceAmount || profile.primaryInsuranceAmount * 0.5,
      profile.spouseFullRetirementAge || 67,
      strategy.spouseAge || 67
    );
    
    return Math.max(primaryBenefit, spouseBenefit) * 12;
  }
}

export { SocialSecurityOptimizer, type SocialSecurityProfile, type OptimizationResult };