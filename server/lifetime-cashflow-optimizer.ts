import type { FinancialProfile } from "@shared/schema";

interface CashFlowAnalysis {
  age: number;
  socialSecurityBenefit: number;
  spouseSocialSecurityBenefit: number;
  pensionIncome: number;
  partTimeIncome: number;
  retirementAccountWithdrawals: number;
  otherIncome: number;
  totalIncome: number;
  livingExpenses: number;
  taxes: number;
  healthcareCosts: number;
  totalExpenses: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}

interface OptimalSSResult {
  optimalUserAge: number;
  optimalSpouseAge?: number;
  totalLifetimeCashFlow: number;
  yearlyAnalysis: CashFlowAnalysis[];
  alternativeScenarios: {
    userAge: number;
    spouseAge?: number;
    lifetimeCashFlow: number;
  }[];
}

interface IntakeFormData {
  // Personal info
  dateOfBirth?: string;
  spouseDateOfBirth?: string;
  maritalStatus?: string;
  
  // Income
  annualIncome?: number;
  spouseAnnualIncome?: number;
  
  // Social Security
  socialSecurityBenefit?: number;
  spouseSocialSecurityBenefit?: number;
  
  // Pensions
  pensionBenefit?: number;
  spousePensionBenefit?: number;
  
  // Retirement accounts
  assets?: any[];
  retirementContributions?: { employee: number; employer: number };
  spouseRetirementContributions?: { employee: number; employer: number };
  
  // Expenses
  monthlyExpenses?: any;
  expectedMonthlyExpensesRetirement?: number;
  
  // Retirement planning
  desiredRetirementAge?: number;
  spouseDesiredRetirementAge?: number;
  userLifeExpectancy?: number;
  spouseLifeExpectancy?: number;
  partTimeIncomeRetirement?: number;
  spousePartTimeIncomeRetirement?: number;
}

export class LifetimeCashFlowOptimizer {
  private profile: IntakeFormData;
  private currentAge: number;
  private spouseCurrentAge?: number;
  private retirementAge: number;
  private spouseRetirementAge?: number;
  private lifeExpectancy: number;
  private spouseLifeExpectancy?: number;

  constructor(profile: IntakeFormData) {
    this.profile = profile;
    this.currentAge = this.calculateAge(profile.dateOfBirth);
    this.spouseCurrentAge = profile.spouseDateOfBirth ? this.calculateAge(profile.spouseDateOfBirth) : undefined;
    this.retirementAge = profile.desiredRetirementAge || 65;
    this.spouseRetirementAge = profile.spouseDesiredRetirementAge;
    this.lifeExpectancy = profile.userLifeExpectancy || 93;
    this.spouseLifeExpectancy = profile.spouseLifeExpectancy;
  }

  private calculateAge(dateOfBirth?: string): number {
    if (!dateOfBirth) return 35; // Default age
    const birth = new Date(dateOfBirth);
    const today = new Date();
    return today.getFullYear() - birth.getFullYear();
  }

  // Calculate Social Security benefit at different claiming ages
  public calculateSSBenefit(baseAnnualBenefit: number, claimAge: number, fullRetirementAge: number = 67): number {
    if (!baseAnnualBenefit || claimAge < 62 || claimAge > 70) return 0;
    
    const monthlyBaseBenefit = baseAnnualBenefit / 12;
    
    if (claimAge < fullRetirementAge) {
      // Early retirement reduction
      const monthsEarly = (fullRetirementAge - claimAge) * 12;
      let reduction = 0;
      
      if (monthsEarly <= 36) {
        reduction = monthsEarly * (5/9) / 100;
      } else {
        reduction = 36 * (5/9) / 100 + (monthsEarly - 36) * (5/12) / 100;
      }
      
      return monthlyBaseBenefit * (1 - reduction) * 12;
    } else if (claimAge > fullRetirementAge) {
      // Delayed retirement credits: 8% per year
      const yearsDelayed = Math.min(claimAge - fullRetirementAge, 70 - fullRetirementAge);
      const increase = yearsDelayed * 0.08;
      
      return monthlyBaseBenefit * (1 + increase) * 12;
    } else {
      return baseAnnualBenefit; // Full retirement age
    }
  }

  // Calculate retirement account balances and withdrawals
  private calculateRetirementAssets(): { totalValue: number; annualWithdrawal: number } {
    const assets = this.profile.assets || [];
    let retirementValue = 0;
    
    // Sum up retirement accounts
    assets.forEach(asset => {
      if (asset.type === '401k' || asset.type === 'ira' || asset.type === 'roth_ira' || 
          asset.type === '403b' || asset.type === 'pension') {
        retirementValue += asset.value || 0;
      }
    });
    
    // Add current contributions projected to retirement
    const userContribs = this.profile.retirementContributions || { employee: 0, employer: 0 };
    const spouseContribs = this.profile.spouseRetirementContributions || { employee: 0, employer: 0 };
    const totalMonthlyContribs = userContribs.employee + userContribs.employer + 
                                spouseContribs.employee + spouseContribs.employer;
    
    const yearsToRetirement = Math.max(0, this.retirementAge - this.currentAge);
    const assumedReturn = 0.07; // 7% annual return
    
    // Future value of current contributions
    if (yearsToRetirement > 0) {
      const futureValueContribs = (totalMonthlyContribs * 12) * 
        ((Math.pow(1 + assumedReturn, yearsToRetirement) - 1) / assumedReturn);
      retirementValue += futureValueContribs;
    }
    
    // Current assets grown to retirement
    retirementValue = retirementValue * Math.pow(1 + assumedReturn, yearsToRetirement);
    
    // Use 4% safe withdrawal rule as baseline
    const annualWithdrawal = retirementValue * 0.04;
    
    return { totalValue: retirementValue, annualWithdrawal };
  }

  // Calculate healthcare costs by age
  private calculateHealthcareCosts(age: number): number {
    // Healthcare costs increase with age
    const baseCost = 5000; // Base annual healthcare cost
    const ageMultiplier = Math.max(1, 1 + (age - 65) * 0.03); // 3% increase per year after 65
    return baseCost * ageMultiplier;
  }

  // Calculate taxes on income
  private calculateTaxes(income: number): number {
    // Simplified tax calculation - assume 22% effective rate in retirement
    const effectiveRate = 0.22;
    const standardDeduction = 15000; // Approximate for retirees
    const taxableIncome = Math.max(0, income - standardDeduction);
    return taxableIncome * effectiveRate;
  }

  // Main calculation for a specific SS claiming strategy
  private calculateLifetimeCashFlow(userSSAge: number, spouseSSAge?: number): {
    totalLifetimeCashFlow: number;
    yearlyAnalysis: CashFlowAnalysis[];
  } {
    const analysis: CashFlowAnalysis[] = [];
    let cumulativeCashFlow = 0;
    const retirementAssets = this.calculateRetirementAssets();
    
    // Calculate from retirement to life expectancy
    for (let age = this.retirementAge; age <= this.lifeExpectancy; age++) {
      const spouseAge = this.spouseCurrentAge ? (age - this.currentAge + this.spouseCurrentAge) : undefined;
      
      // Income Sources
      const socialSecurityBenefit = age >= userSSAge ? 
        this.calculateSSBenefit(this.profile.socialSecurityBenefit || 0, userSSAge) : 0;
      
      const spouseSocialSecurityBenefit = (spouseAge && spouseSSAge && spouseAge >= spouseSSAge) ? 
        this.calculateSSBenefit(this.profile.spouseSocialSecurityBenefit || 0, spouseSSAge) : 0;
      
      const pensionIncome = (this.profile.pensionBenefit || 0) + (this.profile.spousePensionBenefit || 0);
      
      const partTimeIncome = (this.profile.partTimeIncomeRetirement || 0) + 
                           (this.profile.spousePartTimeIncomeRetirement || 0);
      
      const retirementAccountWithdrawals = retirementAssets.annualWithdrawal;
      
      const otherIncome = 0; // Could add rental income, etc.
      
      const totalIncome = socialSecurityBenefit + spouseSocialSecurityBenefit + 
                         pensionIncome + partTimeIncome + retirementAccountWithdrawals + otherIncome;
      
      // Expenses
      const livingExpenses = (this.profile.expectedMonthlyExpensesRetirement || 6000) * 12;
      const healthcareCosts = this.calculateHealthcareCosts(age) + 
                             (spouseAge ? this.calculateHealthcareCosts(spouseAge) : 0);
      const taxes = this.calculateTaxes(totalIncome);
      const totalExpenses = livingExpenses + healthcareCosts + taxes;
      
      // Net cash flow
      const netCashFlow = totalIncome - totalExpenses;
      cumulativeCashFlow += netCashFlow;
      
      analysis.push({
        age,
        socialSecurityBenefit,
        spouseSocialSecurityBenefit,
        pensionIncome,
        partTimeIncome,
        retirementAccountWithdrawals,
        otherIncome,
        totalIncome,
        livingExpenses,
        taxes,
        healthcareCosts,
        totalExpenses,
        netCashFlow,
        cumulativeCashFlow
      });
    }
    
    return {
      totalLifetimeCashFlow: cumulativeCashFlow,
      yearlyAnalysis: analysis
    };
  }

  // Calculate NPV of Social Security benefits from claiming age to longevity
  private calculateSocialSecurityNPV(
    claimAge: number, 
    baseAnnualBenefit: number,
    currentAge: number,
    longevityAge: number = 93,
    discountRate: number = 0.03,
    colaRate: number = 0.025
  ): number {
    if (!baseAnnualBenefit || claimAge < 62 || claimAge > 70) return 0;
    
    // Calculate annual benefit at claiming age
    const annualBenefit = this.calculateSSBenefit(baseAnnualBenefit, claimAge);
    
    let totalNPV = 0;
    
    // Calculate NPV for each year from claiming age to longevity
    for (let age = claimAge; age <= longevityAge; age++) {
      const yearsFromClaim = age - claimAge;
      const yearsFromNow = age - currentAge;
      
      // Apply COLA adjustment (2.5% annual)
      const adjustedBenefit = annualBenefit * Math.pow(1 + colaRate, yearsFromClaim);
      
      // Discount to present value
      const discountFactor = Math.pow(1 + discountRate, yearsFromNow);
      const presentValue = adjustedBenefit / discountFactor;
      
      totalNPV += presentValue;
    }
    
    return totalNPV;
  }

  // Find optimal Social Security claiming ages based on NPV maximization
  public findOptimalClaimingAges(): OptimalSSResult {
    // Use longevity age of 93 for optimization
    const longevityAge = 93;
    const discountRate = 0.03;
    const colaRate = 0.025;
    
    let bestStrategy = {
      userAge: 67,
      spouseAge: this.spouseCurrentAge ? 67 : undefined,
      totalSSNPV: -Infinity,
      lifetimeCashFlow: -Infinity
    };
    
    const alternativeScenarios: { 
      userAge: number; 
      spouseAge?: number; 
      lifetimeCashFlow: number 
    }[] = [];
    
    // Test all combinations of claiming ages
    for (let userAge = 62; userAge <= 70; userAge++) {
      if (this.profile.maritalStatus === 'married' && this.spouseCurrentAge) {
        // Test spouse ages for married couples
        for (let spouseAge = 62; spouseAge <= 70; spouseAge++) {
          // Calculate Social Security NPV for this claiming strategy
          const userSSNPV = this.calculateSocialSecurityNPV(
            userAge,
            this.profile.socialSecurityBenefit || 0,
            this.currentAge,
            longevityAge,
            discountRate,
            colaRate
          );
          
          const spouseSSNPV = this.calculateSocialSecurityNPV(
            spouseAge,
            this.profile.spouseSocialSecurityBenefit || 0,
            this.spouseCurrentAge,
            longevityAge,
            discountRate,
            colaRate
          );
          
          const totalSSNPV = userSSNPV + spouseSSNPV;
          
          // Also calculate full lifetime cash flow for reference
          const result = this.calculateLifetimeCashFlow(userAge, spouseAge);
          
          alternativeScenarios.push({
            userAge,
            spouseAge,
            lifetimeCashFlow: result.totalLifetimeCashFlow
          });
          
          // Optimize based on total Social Security NPV
          if (totalSSNPV > bestStrategy.totalSSNPV) {
            bestStrategy = {
              userAge,
              spouseAge,
              totalSSNPV,
              lifetimeCashFlow: result.totalLifetimeCashFlow
            };
          }
        }
      } else {
        // Single person
        const userSSNPV = this.calculateSocialSecurityNPV(
          userAge,
          this.profile.socialSecurityBenefit || 0,
          this.currentAge,
          longevityAge,
          discountRate,
          colaRate
        );
        
        const result = this.calculateLifetimeCashFlow(userAge);
        
        alternativeScenarios.push({
          userAge,
          lifetimeCashFlow: result.totalLifetimeCashFlow
        });
        
        // Optimize based on Social Security NPV
        if (userSSNPV > bestStrategy.totalSSNPV) {
          bestStrategy = {
            userAge,
            spouseAge: undefined,
            totalSSNPV: userSSNPV,
            lifetimeCashFlow: result.totalLifetimeCashFlow
          };
        }
      }
    }
    
    // Get detailed analysis for optimal strategy
    const optimalAnalysis = this.calculateLifetimeCashFlow(bestStrategy.userAge, bestStrategy.spouseAge);
    
    // Log the optimization results
    console.log('🎯 Social Security NPV Optimization Results:');
    console.log(`  User optimal age: ${bestStrategy.userAge}`);
    console.log(`  User SS benefit at FRA: $${(this.profile.socialSecurityBenefit || 0).toLocaleString()}/year`);
    console.log(`  User SS NPV at optimal age: $${Math.round(bestStrategy.totalSSNPV).toLocaleString()}`);
    
    if (bestStrategy.spouseAge) {
      console.log(`  Spouse optimal age: ${bestStrategy.spouseAge}`);
      console.log(`  Spouse SS benefit at FRA: $${(this.profile.spouseSocialSecurityBenefit || 0).toLocaleString()}/year`);
    }
    console.log(`  Total lifetime cash flow: $${Math.round(bestStrategy.lifetimeCashFlow).toLocaleString()}`);
    
    return {
      optimalUserAge: bestStrategy.userAge,
      optimalSpouseAge: bestStrategy.spouseAge,
      totalLifetimeCashFlow: bestStrategy.lifetimeCashFlow,
      yearlyAnalysis: optimalAnalysis.yearlyAnalysis,
      alternativeScenarios: alternativeScenarios.sort((a, b) => b.lifetimeCashFlow - a.lifetimeCashFlow)
    };
  }

  // Helper method to analyze SS NPV at different claiming ages
  public analyzeSocialSecurityNPV(): void {
    const longevityAge = 93;
    const discountRate = 0.03;
    const colaRate = 0.025;
    
    console.log('📊 Social Security NPV Analysis:');
    console.log('User SS Benefit at FRA:', this.profile.socialSecurityBenefit);
    
    for (let age = 62; age <= 70; age++) {
      const npv = this.calculateSocialSecurityNPV(
        age,
        this.profile.socialSecurityBenefit || 0,
        this.currentAge,
        longevityAge,
        discountRate,
        colaRate
      );
      
      const annualBenefit = this.calculateSSBenefit(this.profile.socialSecurityBenefit || 0, age);
      console.log(`  Age ${age}: Annual benefit = $${Math.round(annualBenefit).toLocaleString()}, NPV = $${Math.round(npv).toLocaleString()}`);
    }
    
    if (this.profile.maritalStatus === 'married' && this.profile.spouseSocialSecurityBenefit) {
      console.log('Spouse SS Benefit at FRA:', this.profile.spouseSocialSecurityBenefit);
      
      for (let age = 62; age <= 70; age++) {
        const npv = this.calculateSocialSecurityNPV(
          age,
          this.profile.spouseSocialSecurityBenefit || 0,
          this.spouseCurrentAge || 65,
          longevityAge,
          discountRate,
          colaRate
        );
        
        const annualBenefit = this.calculateSSBenefit(this.profile.spouseSocialSecurityBenefit || 0, age);
        console.log(`  Age ${age}: Annual benefit = $${Math.round(annualBenefit).toLocaleString()}, NPV = $${Math.round(npv).toLocaleString()}`);
      }
    }
  }

  // Static method to calculate optimal ages from profile
  static calculateOptimalAgesFromProfile(profile: IntakeFormData | FinancialProfile): OptimalSSResult | null {
    try {
      console.log('🔧 Creating optimizer with profile...');
      const optimizer = new LifetimeCashFlowOptimizer(profile);
      
      // Analyze NPV at different ages for debugging
      optimizer.analyzeSocialSecurityNPV();
      
      console.log('🎯 Optimizer created, current age:', optimizer['currentAge']);
      console.log('🎯 Retirement age:', optimizer['retirementAge']);
      console.log('🎯 Life expectancy:', optimizer['lifeExpectancy']);
      
      const result = optimizer.findOptimalClaimingAges();
      
      if (result) {
        console.log('🎉 Optimization successful!');
      } else {
        console.log('❌ Optimization returned null - check data requirements');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Exception in calculateOptimalAgesFromProfile:', error);
      return null;
    }
  }
}

export type { OptimalSSResult, CashFlowAnalysis, IntakeFormData };
