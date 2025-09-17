import { z } from 'zod';
import { calculateNetWorthProjections } from './net-worth-projections';

/**
 * Advanced Roth Conversion Engine
 * Implements the Tax Bracket Filling Strategy as specified in roth_conversion_algorithm.md
 * 
 * This engine focuses solely on the tax bracket filling strategy to minimize lifetime tax liability
 * by strategically converting during low-income gap years between retirement and Social Security/RMDs.
 */

// Input Schema - Maps to actual database fields
export const RothConversionInputsSchema = z.object({
  // Personal Information (maps to financialProfiles table)
  user_dob: z.string(), // dateOfBirth
  spouse_dob: z.string().optional(), // spouseDateOfBirth
  user_retirement_age: z.number(), // desiredRetirementAge
  spouse_retirement_age: z.number().optional(), // spouseDesiredRetirementAge
  user_ss_claim_age: z.number(), // socialSecurityClaimAge
  spouse_ss_claim_age: z.number().optional(), // spouseSocialSecurityClaimAge
  longevity_age: z.number().default(90), // userLifeExpectancy
  
  // Income Information
  user_gross_income: z.number(), // annualIncome
  spouse_gross_income: z.number().optional(), // spouseAnnualIncome
  user_deductions: z.number().default(0), // estimated pre-tax deductions
  spouse_deductions: z.number().default(0),
  filing_status: z.enum(['single', 'marriedFilingJointly', 'headOfHousehold']), // based on maritalStatus
  state_of_residence: z.string(), // state
  desired_monthly_retirement_expense: z.number(), // expectedMonthlyExpensesRetirement
  
  // Account Information - calculated from assets JSON
  accounts: z.array(z.object({
    account_type: z.string(),
    owner: z.enum(['User', 'Spouse', 'Joint']),
    balance: z.number(),
    cost_basis: z.number().optional(),
    asset_allocation_model: z.string().default('Balanced')
  })),
  
  // Social Security
  social_security_benefit: z.number().optional(), // socialSecurityBenefit
  spouse_social_security_benefit: z.number().optional()
});

export type RothConversionInputs = z.infer<typeof RothConversionInputsSchema>;

// Federal Tax Brackets for 2025 (IRS official rates - CORRECTED PER RESEARCH)
const TAX_BRACKETS_2025 = {
  single: [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 }
  ],
  marriedFilingJointly: [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
    { min: 394600, max: 501050, rate: 0.32 },
    { min: 501050, max: 751600, rate: 0.35 },
    { min: 751600, max: Infinity, rate: 0.37 }
  ],
  headOfHousehold: [
    { min: 0, max: 17000, rate: 0.10 },
    { min: 17000, max: 64850, rate: 0.12 },
    { min: 64850, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250500, rate: 0.32 },
    { min: 250500, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 }
  ]
};

// Post-2026 brackets (assuming current 2025 brackets continue)
const TAX_BRACKETS_POST_2026 = TAX_BRACKETS_2025;

// Standard Deductions (Updated for 2025)
const STANDARD_DEDUCTIONS = {
  2025: { single: 15000, marriedFilingJointly: 30000, headOfHousehold: 22500 },  // 2025 IRS values
  post2026: { single: 15000, marriedFilingJointly: 30000, headOfHousehold: 22500 } // Assumes continuation
};

// Additional Standard Deduction for Age 65+ (per person)
const ADDITIONAL_STANDARD_DEDUCTION_65 = {
  single: 2000,
  marriedFilingJointly: 1600,  // Per spouse
  headOfHousehold: 2000
};

// OBBBA Bonus Deduction for Seniors (2025-2028)
const SENIOR_BONUS_DEDUCTION = {
  amount: 6000,  // Per person age 65+
  phaseoutStart: { single: 75000, marriedFilingJointly: 150000, headOfHousehold: 112500 },
  phaseoutEnd: { single: 175000, marriedFilingJointly: 250000, headOfHousehold: 212500 },
  phaseoutRate: 0.06,  // 6% reduction per dollar over threshold
  startYear: 2025,
  endYear: 2028
};

// IRMAA Thresholds for 2025
const IRMAA_THRESHOLDS_2025 = {
  single: [
    { min: 0, max: 106000, surcharge: 0 },
    { min: 106001, max: 133000, surcharge: 888 },
    { min: 133001, max: 167000, surcharge: 2220 },
    { min: 167001, max: 200000, surcharge: 3540 },
    { min: 200001, max: 500000, surcharge: 4872 },
    { min: 500001, max: Infinity, surcharge: 5328 }
  ],
  marriedFilingJointly: [
    { min: 0, max: 212000, surcharge: 0 },
    { min: 212001, max: 266000, surcharge: 1776 },
    { min: 266001, max: 334000, surcharge: 4440 },
    { min: 334001, max: 400000, surcharge: 7080 },
    { min: 400001, max: 750000, surcharge: 9744 },
    { min: 750001, max: Infinity, surcharge: 10656 }
  ],
  headOfHousehold: [
    { min: 0, max: 106000, surcharge: 0 },
    { min: 106001, max: 133000, surcharge: 888 },
    { min: 133001, max: 167000, surcharge: 2220 },
    { min: 167001, max: 200000, surcharge: 3540 },
    { min: 200001, max: 500000, surcharge: 4872 },
    { min: 500001, max: Infinity, surcharge: 5328 }
  ]
};

// RMD Life Expectancy Table (IRS Uniform Lifetime Table)
const RMD_LIFE_EXPECTANCY_TABLE: { [age: number]: number } = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
  83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
  88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
  93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8,
  98: 7.3, 99: 6.8, 100: 6.4
};

// Capital Market Assumptions
const CAPITAL_MARKET_ASSUMPTIONS = {
  'Conservative': { expectedReturn: 0.045, dividendYield: 0.025 },
  'Balanced': { expectedReturn: 0.064, dividendYield: 0.02 },
  'Aggressive Growth': { expectedReturn: 0.075, dividendYield: 0.015 }
};

// System assumptions
const INFLATION_RATE = 0.025;
const SS_COLA = 0.02;

interface ProjectionYear {
  year: number;
  userAge: number;
  spouseAge?: number;
  
  // Income components
  wagesIncome: number;
  pensionIncome: number;
  socialSecurityGross: number;
  socialSecurityTaxable: number;
  investmentIncome: number;
  rmdAmount: number;
  conversionAmount: number;
  totalIncome: number;
  
  // Expenses and taxes
  livingExpenses: number;
  federalIncomeTax: number;
  stateIncomeTax: number;
  niitTax: number;
  irmaaSurcharge: number;
  conversionTax: number;
  totalTaxes: number;
  totalExpenses: number;
  
  // Account balances (end of year)
  traditionalBalance: number;
  rothBalance: number;
  taxableBalance: number;
  savingsBalance: number;
  
  // Metadata
  isConversionYear: boolean;
  marginalTaxRate: number;
  availableConversionCapacity: number;
}

interface ConversionAnalysisResult {
  // Summary metrics
  lifetimeTaxSavings: number;
  totalConversions: number;
  estateValueWithConversion: number;
  estateValueWithoutConversion: number;
  heirTaxSavings: number;
  
  // Detailed projections
  withConversionProjection: ProjectionYear[];
  withoutConversionProjection: ProjectionYear[];
  
  // Recommendations
  recommendedStrategy: string;
  keyInsights: string[];
  warnings: string[];
  
  // 5-year conversion plan
  conversionPlan: Array<{
    year: number;
    age: number;
    conversionAmount: number;
    taxOwed: number;
    marginalRate: number;
    paymentSource: string;
  }>;
}

export type ConversionStrategy = 'conservative' | 'moderate' | 'aggressive' | 'irmaa-aware';

export class RothConversionEngine {
  private inputs: RothConversionInputs;
  private strategy: ConversionStrategy;
  private actualIncomeProjections?: any[]; // YearlyWithdrawal[] from withdrawal sequence
  private financialProfile?: any; // Financial profile with savings rate and optimization data
  
  constructor(
    inputs: RothConversionInputs, 
    strategy: ConversionStrategy = 'moderate', 
    actualIncomeProjections?: any[],
    financialProfile?: any
  ) {
    this.inputs = inputs;
    this.strategy = strategy;
    this.actualIncomeProjections = actualIncomeProjections;
    this.financialProfile = financialProfile;
    
    if (actualIncomeProjections && actualIncomeProjections.length > 0) {
      console.log(`✅ Using actual retirement income projections from withdrawal sequence (${actualIncomeProjections.length} years)`);
    } else {
      console.log('⚠️ Using engine-calculated income projections (fallback mode)');
    }
  }
  
  /**
   * Main analysis method that implements the bracket filling strategy
   */
  public async analyze(): Promise<ConversionAnalysisResult> {
    // Run baseline "no conversion" scenario
    const withoutConversionProjection = this.runProjection(false);
    
    // Run "with conversion" scenario using bracket filling strategy
    const withConversionProjection = this.runProjection(true);
    
    // Calculate comparative metrics
    const lifetimeTaxSavings = this.calculateLifetimeTaxes(withoutConversionProjection) - 
                               this.calculateLifetimeTaxes(withConversionProjection);
    
    const totalConversions = withConversionProjection
      .reduce((sum, year) => sum + year.conversionAmount, 0);
    
    const estateValueWithConversion = this.calculateFinalEstateValue(withConversionProjection);
    const estateValueWithoutConversion = this.calculateFinalEstateValue(withoutConversionProjection);
    
    const heirTaxSavings = this.calculateHeirTaxBurden(withoutConversionProjection) - 
                          this.calculateHeirTaxBurden(withConversionProjection);
    
    // Generate recommendations
    const { recommendedStrategy, keyInsights, warnings } = this.generateRecommendations(
      withConversionProjection, withoutConversionProjection, lifetimeTaxSavings
    );
    
    // Create 5-year conversion plan
    const conversionPlan = this.createConversionPlan(withConversionProjection);
    
    return {
      lifetimeTaxSavings,
      totalConversions,
      estateValueWithConversion,
      estateValueWithoutConversion,
      heirTaxSavings,
      withConversionProjection,
      withoutConversionProjection,
      recommendedStrategy,
      keyInsights,
      warnings,
      conversionPlan
    };
  }
  
  /**
   * Analyze all strategies and return comparison
   */
  public async analyzeAllStrategies(): Promise<{[key: string]: ConversionAnalysisResult}> {
    const strategies: ConversionStrategy[] = ['conservative', 'moderate', 'aggressive', 'irmaa-aware'];
    const results: {[key: string]: ConversionAnalysisResult} = {};
    
    for (const strategy of strategies) {
      this.strategy = strategy;
      results[strategy] = await this.analyze();
    }
    
    return results;
  }
  
  /**
   * Core projection engine - runs annual simulation loop
   */
  private runProjection(includeConversions: boolean): ProjectionYear[] {
    const projection: ProjectionYear[] = [];
    const currentYear = new Date().getFullYear();
    const userAge = this.calculateAge(this.inputs.user_dob);
    const spouseAge = this.inputs.spouse_dob ? this.calculateAge(this.inputs.spouse_dob) : undefined;
    
    // Initialize account balances
    let traditionalBalance = this.getTotalTaxDeferredAssets();
    let rothBalance = this.getTotalRothAssets();
    let taxableBalance = this.getTotalTaxableAssets();
    let savingsBalance = this.getTotalSavingsAssets();
    
    // Track MAGI history for IRMAA (2-year lookback)
    const magiHistory: number[] = [];
    
    for (let yearOffset = 0; yearOffset <= (this.inputs.longevity_age - userAge); yearOffset++) {
      const year = currentYear + yearOffset;
      const currentUserAge = userAge + yearOffset;
      const currentSpouseAge = spouseAge ? spouseAge + yearOffset : undefined;
      
      // Determine if this is a conversion year (gap years)
      const isConversionYear = includeConversions && this.isConversionYear(
        currentUserAge, currentSpouseAge, year
      );
      
      // Calculate income components - use actual projections if available
      let wagesIncome: number;
      let pensionIncome: number;
      let socialSecurityGross: number;
      let investmentIncome: number;
      let rmdAmount: number;
      let actualRetirementWithdrawal = 0;
      
      if (this.actualIncomeProjections) {
        // Use actual income projections from withdrawal sequence (same as Income tab)
        const projectionForYear = this.actualIncomeProjections.find(p => p.year === year);
        if (projectionForYear) {
          wagesIncome = (projectionForYear.workingIncome || 0) + (projectionForYear.spouseWorkingIncome || 0);
          pensionIncome = (projectionForYear.pension || 0) + (projectionForYear.spousePension || 0);
          socialSecurityGross = (projectionForYear.socialSecurity || 0) + (projectionForYear.spouseSocialSecurity || 0);
          investmentIncome = 0; // Included in withdrawals
          rmdAmount = projectionForYear.rmdAmount || 0;
          // Sum all withdrawals to get total retirement withdrawal
          actualRetirementWithdrawal = (projectionForYear.taxableWithdrawal || 0) + 
                                     (projectionForYear.taxDeferredWithdrawal || 0) + 
                                     (projectionForYear.taxFreeWithdrawal || 0) + 
                                     (projectionForYear.hsaWithdrawal || 0);
          
          console.log(`📊 Using actual projections for ${year}: Wages=${wagesIncome}, SS=${socialSecurityGross}, Withdrawals=${actualRetirementWithdrawal}`);
        } else {
          // Fallback to engine calculations if year not found
          wagesIncome = this.calculateWagesIncome(currentUserAge, currentSpouseAge, year);
          pensionIncome = 0;
          socialSecurityGross = this.calculateSocialSecurityBenefit(currentUserAge, currentSpouseAge, year);
          investmentIncome = this.calculateInvestmentIncome(taxableBalance);
          rmdAmount = this.calculateRMD(currentUserAge, traditionalBalance, currentSpouseAge);
        }
      } else {
        // Fallback: use engine's own calculations
        wagesIncome = this.calculateWagesIncome(currentUserAge, currentSpouseAge, year);
        pensionIncome = 0;
        socialSecurityGross = this.calculateSocialSecurityBenefit(currentUserAge, currentSpouseAge, year);
        investmentIncome = this.calculateInvestmentIncome(taxableBalance);
        rmdAmount = this.calculateRMD(currentUserAge, traditionalBalance, currentSpouseAge);
      }
      
      // Calculate living expenses for the year
      const livingExpenses = this.inputs.desired_monthly_retirement_expense * 12 * Math.pow(1 + INFLATION_RATE, yearOffset);
      
      // Calculate retirement withdrawal needed to cover expenses
      // Use actual withdrawal data if available, otherwise calculate
      let retirementWithdrawal = 0;
      
      if (this.actualIncomeProjections && actualRetirementWithdrawal > 0) {
        // Use the actual withdrawal amount from the retirement projections
        retirementWithdrawal = actualRetirementWithdrawal;
        console.log(`📊 Using actual retirement withdrawal: $${retirementWithdrawal.toLocaleString()}`);
      } else {
        // Fallback: calculate withdrawal iteratively
        const availableIncome = wagesIncome + pensionIncome + socialSecurityGross + investmentIncome;
      
      // Only calculate retirement withdrawals if actually retired
      const isUserRetired = currentUserAge >= this.inputs.user_retirement_age;
      const isSpouseRetired = currentSpouseAge ? currentSpouseAge >= (this.inputs.spouse_retirement_age || Infinity) : true;
      
      // If at least one person is retired and needs withdrawals
      if ((isUserRetired || isSpouseRetired) && availableIncome < livingExpenses) {
        // Calculate net amount needed after available income
        const netNeeded = livingExpenses - availableIncome;
        
        // For retirement withdrawals, we need to gross up for taxes
        // Start with a reasonable estimate based on expected tax rate
        let estimatedTaxRate = 0.20; // Start with 20% estimate
        
        // Iteratively solve for the correct withdrawal amount
        const maxIterations = 5;
        let iteration = 0;
        let previousWithdrawal = 0;
        
        while (iteration < maxIterations) {
          // Calculate gross withdrawal needed
          const grossNeeded = netNeeded / (1 - estimatedTaxRate);
          retirementWithdrawal = Math.min(grossNeeded, traditionalBalance - rmdAmount); // Don't exceed available balance after RMD
          
          // Calculate actual taxes on this withdrawal
          // Note: Don't include the withdrawal itself in baseline for tax calculation
          const withdrawalIncome = wagesIncome + pensionIncome + investmentIncome + rmdAmount + retirementWithdrawal;
          const withdrawalSST = this.calculateTaxableSocialSecurity(socialSecurityGross, withdrawalIncome, this.inputs.filing_status);
          const withdrawalTotalIncome = withdrawalIncome + withdrawalSST;
          
          // Calculate taxes on total income including withdrawal
          const totalDeductions = this.getTotalDeductions(year, currentUserAge, currentSpouseAge, withdrawalTotalIncome);
          const withdrawalTaxableIncome = Math.max(0, withdrawalTotalIncome - totalDeductions);
          
          // Calculate taxes WITH withdrawal
          const taxesWithWithdrawal = this.calculateIncomeTaxes(
            withdrawalTotalIncome, year, false, currentUserAge, currentSpouseAge
          );
          
          // Calculate taxes WITHOUT withdrawal (baseline)
          const baselineForTax = wagesIncome + pensionIncome + investmentIncome + rmdAmount;
          const baselineSST = this.calculateTaxableSocialSecurity(socialSecurityGross, baselineForTax, this.inputs.filing_status);
          const baselineTotalForTax = baselineForTax + baselineSST;
          const taxesWithoutWithdrawal = this.calculateIncomeTaxes(
            baselineTotalForTax, year, false, currentUserAge, currentSpouseAge
          );
          
          // The incremental tax is what we need to account for
          const incrementalTax = (taxesWithWithdrawal.federalIncomeTax + taxesWithWithdrawal.stateIncomeTax) - 
                                (taxesWithoutWithdrawal.federalIncomeTax + taxesWithoutWithdrawal.stateIncomeTax);
          
          // Update effective tax rate for next iteration
          if (retirementWithdrawal > 0) {
            estimatedTaxRate = incrementalTax / retirementWithdrawal;
          }
          
          // Check for convergence
          if (Math.abs(retirementWithdrawal - previousWithdrawal) < 100 || iteration >= maxIterations - 1) {
            break;
          }
          
          previousWithdrawal = retirementWithdrawal;
          iteration++;
        }
        
        // Ensure we have enough to cover expenses after taxes
        const afterTaxAmount = retirementWithdrawal * (1 - estimatedTaxRate);
        if (afterTaxAmount < netNeeded && retirementWithdrawal < traditionalBalance - rmdAmount) {
          // Need one more adjustment
          retirementWithdrawal = Math.min(netNeeded / (1 - estimatedTaxRate), traditionalBalance - rmdAmount);
        }
        
        // console.log(`Year ${year}: Iterative withdrawal calculation (${iteration} iterations):`);
        // console.log(`  Living expenses: $${livingExpenses.toLocaleString()}`);
        // console.log(`  Available income: $${availableIncome.toLocaleString()}`);
        // console.log(`  Final withdrawal: $${Math.round(retirementWithdrawal).toLocaleString()}`);
        // console.log(`  Effective tax rate: ${(estimatedTaxRate * 100).toFixed(1)}%`);
      }
      } // Close the actual income projections conditional
      
      // Calculate baseline income before conversion
      // CORRECTED LOGIC: Include retirement withdrawals in conversion analysis since they are TAXABLE INCOME
      // The original approach was wrong - retirement withdrawals from 401k/IRA are taxable and affect tax brackets
      const baselineIncomeForConversion = wagesIncome + pensionIncome + investmentIncome + rmdAmount + retirementWithdrawal;
      
      // For tax calculations, use the same income (no double counting)
      const baselineIncome = baselineIncomeForConversion;
      
      // Initialize conversion amount
      let conversionAmount = 0;
      
      // Debug logging for income components
      if (retirementWithdrawal > 0 || isConversionYear) {
        console.log(`Year ${year} Income Components:`);
        console.log(`  Wages: $${Math.round(wagesIncome).toLocaleString()}`);
        console.log(`  Investment Income: $${Math.round(investmentIncome).toLocaleString()}`);
        console.log(`  RMD: $${Math.round(rmdAmount).toLocaleString()}`);
        console.log(`  Social Security Gross: $${Math.round(socialSecurityGross).toLocaleString()}`);
        console.log(`  Retirement Withdrawal: $${Math.round(retirementWithdrawal).toLocaleString()}`);
        console.log(`  ---`);
        console.log(`  CORRECTED: Total Taxable Income (includes retirement withdrawals): $${Math.round(baselineIncomeForConversion).toLocaleString()}`);
        console.log(`  Conversion Year: ${isConversionYear ? 'YES' : 'NO'}`);
      }
      
      // Calculate taxable Social Security for full income (needed for tax calculations)
      const socialSecurityTaxable = this.calculateTaxableSocialSecurity(
        socialSecurityGross, baselineIncome, this.inputs.filing_status
      );
      
      // CRITICAL FIX: Calculate SS tax based on NATURAL income only for conversion analysis
      const socialSecurityTaxableForConversion = this.calculateTaxableSocialSecurity(
        socialSecurityGross, baselineIncomeForConversion, this.inputs.filing_status
      );
      
      const baselineTaxableIncome = baselineIncome + socialSecurityTaxable;
      const baselineForConversionAnalysis = baselineIncomeForConversion + socialSecurityTaxableForConversion;
      
      // Calculate optimal conversion amount if this is a conversion year
      if (isConversionYear && traditionalBalance > rmdAmount + retirementWithdrawal) {
        // FIXED: Use ONLY natural income sources for conversion opportunity analysis
        // This properly identifies the golden window when natural income is low
        conversionAmount = this.calculateOptimalConversionAmount(
          baselineForConversionAnalysis, // Uses only natural income (wages, dividends, SS, RMDs)
          traditionalBalance - rmdAmount - retirementWithdrawal, // Available after RMD and withdrawal
          currentUserAge,
          year,
          savingsBalance,
          taxableBalance,
          traditionalBalance,
          currentSpouseAge
        );
      }
      
      // Calculate total income including conversion
      const totalIncome = baselineTaxableIncome + conversionAmount;
      
      // Calculate taxes
      const { federalIncomeTax, stateIncomeTax, niitTax } = this.calculateIncomeTaxes(
        totalIncome, year, conversionAmount > 0, currentUserAge, currentSpouseAge
      );
      
      // Calculate IRMAA surcharge (based on MAGI from 2 years ago)
      const irmaaSurcharge = this.calculateIRMAASurcharge(currentUserAge, currentSpouseAge, magiHistory, yearOffset);
      
      // Calculate conversion-specific tax
      const baselineTax = this.calculateIncomeTaxes(baselineTaxableIncome, year, false, currentUserAge, currentSpouseAge);
      const conversionTax = federalIncomeTax + stateIncomeTax - baselineTax.federalIncomeTax - baselineTax.stateIncomeTax;
      
      // Total taxes including all components
      const totalTaxes = federalIncomeTax + stateIncomeTax + niitTax + irmaaSurcharge;
      const totalExpenses = livingExpenses + totalTaxes;
      
      // Calculate marginal tax rate and available conversion capacity
      const marginalTaxRate = this.calculateMarginalTaxRate(baselineTaxableIncome, year, currentUserAge, currentSpouseAge);
      const availableConversionCapacity = this.calculateAvailableConversionCapacity(
        baselineTaxableIncome, currentUserAge, year, currentSpouseAge
      );
      
      // Update account balances
      if (conversionAmount > 0) {
        traditionalBalance -= conversionAmount;
        rothBalance += conversionAmount;
        
        // Pay conversion tax from non-retirement accounts
        const { updatedTaxableBalance, updatedSavingsBalance } = this.payConversionTax(
          conversionTax, taxableBalance, savingsBalance
        );
        taxableBalance = updatedTaxableBalance;
        savingsBalance = updatedSavingsBalance;
      }
      
      // Process RMD and retirement withdrawal
      traditionalBalance -= rmdAmount;
      traditionalBalance -= retirementWithdrawal;
      
      // Apply asset growth
      const growthRate = this.getExpectedReturn();
      traditionalBalance *= (1 + growthRate);
      rothBalance *= (1 + growthRate);
      taxableBalance *= (1 + growthRate);
      savingsBalance *= (1 + growthRate);
      
      // Ensure balances don't go negative
      traditionalBalance = Math.max(0, traditionalBalance);
      rothBalance = Math.max(0, rothBalance);
      taxableBalance = Math.max(0, taxableBalance);
      savingsBalance = Math.max(0, savingsBalance);
      
      // Track MAGI for IRMAA lookback
      const magi = totalIncome; // Simplified MAGI calculation
      magiHistory.push(magi);
      
      // Create projection year
      const projectionYear: ProjectionYear = {
        year,
        userAge: currentUserAge,
        spouseAge: currentSpouseAge,
        wagesIncome,
        pensionIncome,
        socialSecurityGross,
        socialSecurityTaxable,
        investmentIncome,
        rmdAmount,
        conversionAmount,
        totalIncome,
        livingExpenses,
        federalIncomeTax,
        stateIncomeTax,
        niitTax,
        irmaaSurcharge,
        conversionTax,
        totalTaxes,
        totalExpenses,
        traditionalBalance,
        rothBalance,
        taxableBalance,
        savingsBalance,
        isConversionYear,
        marginalTaxRate,
        availableConversionCapacity
      };
      
      projection.push(projectionYear);
    }
    
    return projection;
  }
  
  /**
   * Determines if the current year qualifies for Roth conversions
   * New window: from retirement until age 72 (pre‑RMD), regardless of Social Security status.
   */
  private isConversionYear(userAge: number, spouseAge: number | undefined, year: number): boolean {
    const userRetiredPreRmd = userAge >= this.inputs.user_retirement_age && userAge < 73;
    const spouseRetiredPreRmd = spouseAge && this.inputs.spouse_retirement_age
      ? (spouseAge >= this.inputs.spouse_retirement_age && spouseAge < 73)
      : false;
    const inWindow = userRetiredPreRmd || spouseRetiredPreRmd;

    if (inWindow) {
      console.log(`Year ${year}: IN CONVERSION WINDOW`);
      console.log(`  User: Age ${userAge}, Retired: ${userAge >= this.inputs.user_retirement_age}, Pre‑RMD: ${userAge < 73}`);
      if (spouseAge) {
        console.log(`  Spouse: Age ${spouseAge}, Retired: ${spouseAge >= (this.inputs.spouse_retirement_age || 999)}, Pre‑RMD: ${spouseAge < 73}`);
      }
    }

    return inWindow;
  }
  
  /**
   * COMPLETELY REWRITTEN: True tax bracket filling strategy
   * Formula: Conversion Amount = Upper Limit of Target Bracket - Projected Income
   * This follows classic CFP/CPA bracket filling methodology
   */
  private calculateOptimalConversionAmount(
    baselineTaxableIncome: number,
    availableToConvert: number,
    age: number,
    year: number,
    savingsNow: number,
    taxableNow: number,
    traditionalNow: number,
    spouseAge?: number
  ): number {
    // Hard stop once RMDs begin
    if (age >= 73) return 0;
    const taxBrackets = this.getTaxBrackets(year);
    const totalDeductions = this.getTotalDeductions(year, age, undefined, baselineTaxableIncome);
    
    // Calculate actual taxable income after deductions
    const actualTaxableIncome = Math.max(0, baselineTaxableIncome - totalDeductions);
    
    // Enhanced debug logging
    console.log(`\n=== TAX BRACKET FILLING CALCULATION FOR YEAR ${year} (Age ${age}) ===`);
    console.log(`Gross Income (natural sources): $${baselineTaxableIncome.toLocaleString()}`);
    console.log(`Total Deductions: $${totalDeductions.toLocaleString()}`);
    console.log(`NET TAXABLE INCOME: $${actualTaxableIncome.toLocaleString()}`);
    console.log(`Available to Convert: $${availableToConvert.toLocaleString()}`);
    
    // Log current tax brackets
    console.log(`\n2025 Tax Brackets (MFJ):`);
    taxBrackets.slice(0, 5).forEach((bracket, index) => {
      const isCurrentBracket = actualTaxableIncome >= bracket.min && actualTaxableIncome <= bracket.max;
      const marker = isCurrentBracket ? ' ← CURRENT' : '';
      console.log(`  ${(bracket.rate * 100).toFixed(0)}%: $${bracket.min.toLocaleString()} - $${bracket.max === Infinity ? '∞' : bracket.max.toLocaleString()}${marker}`);
    });
    
    // Find current tax bracket
    let currentBracket = taxBrackets.find(bracket => 
      actualTaxableIncome >= bracket.min && actualTaxableIncome <= bracket.max
    ) || taxBrackets[taxBrackets.length - 1];
    
    console.log(`\nCURRENT BRACKET: ${(currentBracket.rate * 100).toFixed(0)}% bracket`);
    console.log(`CURRENT POSITION: $${actualTaxableIncome.toLocaleString()} in bracket`);
    
    // CORE BRACKET FILLING LOGIC: Determine target bracket based on strategy
    let targetBracket = this.determineTargetBracket(currentBracket, taxBrackets, age, actualTaxableIncome);
    
    if (!targetBracket) {
      console.log(`NO SUITABLE TARGET BRACKET - No conversion recommended`);
      return 0;
    }
    
    // New target income: 95% of the full bracket width from the lower bound
    const lower = targetBracket.min;
    const upper = targetBracket.max === Infinity ? (lower + 100000) : targetBracket.max;
    const targetIncome95 = lower + 0.95 * (upper - lower);
    const capacityToTarget = Math.max(0, targetIncome95 - actualTaxableIncome);

    console.log(`\nBRACKET FILLING CALCULATION:`);
    console.log(`Target Bracket: ${(targetBracket.rate * 100).toFixed(0)}% ($${lower.toLocaleString()} - $${upper === Infinity ? '∞' : upper.toLocaleString()})`);
    console.log(`Target Income (95% of width from lower): $${Math.round(targetIncome95).toLocaleString()}`);
    console.log(`Capacity to target: $${Math.round(capacityToTarget).toLocaleString()}`);
    
    // Constraint 1: Liquidity cap (ensure taxes can be paid from savings + taxable today)
    const stateRate = this.calculateStateTax(1000) / 1000;
    const combinedMarginalRate = targetBracket.rate + stateRate;
    const capByLiquidity = combinedMarginalRate > 0
      ? Math.floor((savingsNow + taxableNow) / combinedMarginalRate)
      : capacityToTarget;

    // Constraint 2: TDA pacing through age 72 (preserve for future conversions)
    const userSpan = (age >= this.inputs.user_retirement_age && age < 73) ? Math.max(0, 72 - age) : 0;
    const spouseSpan = (spouseAge && this.inputs.spouse_retirement_age && spouseAge >= this.inputs.spouse_retirement_age && spouseAge < 73)
      ? Math.max(0, 72 - spouseAge) : 0;
    const yearsLeft = Math.max(userSpan, spouseSpan);
    const pacingSafety = 0.9;
    const perYearAllotment = traditionalNow > 0 ? (traditionalNow / (yearsLeft + 1)) : 0;
    const capByTda = Math.floor(perYearAllotment * pacingSafety);

    // Constraint 3: Inventory (cannot exceed remaining traditional balance this year)
    const capByInventory = Math.max(0, Math.floor(availableToConvert));

    const rawCap = Math.min(
      capacityToTarget,
      capByLiquidity,
      capByTda,
      capByInventory,
      this.getMaxConversionConstraints(age, actualTaxableIncome, year)
    );

    // Apply constraints
    let conversionAmount = Math.max(0, rawCap);
    
    // Round down to nearest $1,000
    conversionAmount = Math.floor(conversionAmount / 1000) * 1000;
    
    console.log(`Final Conversion Amount: $${conversionAmount.toLocaleString()}`);
    console.log(`Effective Tax Rate: ${((targetBracket.rate) * 100).toFixed(1)}%`);
    console.log(`=== END BRACKET FILLING CALCULATION ===\n`);
    
    return conversionAmount;
  }
  
  /**
   * NEW: Determine target tax bracket based on strategy and current situation
   */
  private determineTargetBracket(currentBracket: any, taxBrackets: any[], age: number, taxableIncome: number) {
    const stateTaxRate = this.calculateStateTax(1000) / 1000;
    
    // Strategy-based bracket targeting
    if (this.strategy === 'conservative') {
      // Conservative: Only fill up to 12% bracket
      if (currentBracket.rate <= 0.12) {
        const target = taxBrackets.find(b => b.rate === 0.12);
        console.log(`Conservative strategy: Targeting 12% bracket`);
        return target;
      }
      console.log(`Conservative strategy: Current bracket too high (${(currentBracket.rate * 100).toFixed(0)}%)`);
      return null;
      
    } else if (this.strategy === 'aggressive') {
      // Aggressive: Fill up to 24% bracket
      if (currentBracket.rate <= 0.24) {
        const target = taxBrackets.find(b => b.rate === 0.24);
        console.log(`Aggressive strategy: Targeting 24% bracket`);
        return target;
      }
      console.log(`Aggressive strategy: Current bracket too high (${(currentBracket.rate * 100).toFixed(0)}%)`);
      return null;
      
    } else {
      // Moderate (default): Fill up to 22% bracket, consider state taxes
      if (currentBracket.rate <= 0.12) {
        // Always fill through 12% if starting there
        const target = taxBrackets.find(b => b.rate === 0.22);
        console.log(`Moderate strategy: In ${(currentBracket.rate * 100).toFixed(0)}% bracket - targeting 22% bracket`);
        return target;
        
      } else if (currentBracket.rate === 0.22) {
        // In 22% bracket - fill it unless high state taxes
        if (stateTaxRate > 0.08) {
          console.log(`Moderate strategy: 22% bracket but high state tax (${(stateTaxRate * 100).toFixed(1)}%) - partial fill only`);
          return currentBracket; // Stay in current bracket
        }
        console.log(`Moderate strategy: Filling 22% bracket completely`);
        return currentBracket;
        
      } else if (currentBracket.rate === 0.24) {
        // In 24% bracket - limited conversions
        const percentThrough = (taxableIncome - currentBracket.min) / (currentBracket.max - currentBracket.min);
        if (percentThrough < 0.25 && stateTaxRate < 0.06) {
          console.log(`Moderate strategy: Early in 24% bracket (${(percentThrough * 100).toFixed(0)}%) with low state tax - limited conversion`);
          return currentBracket;
        }
        console.log(`Moderate strategy: 24% bracket too expensive for conversions`);
        return null;
      }
      
      console.log(`Moderate strategy: Current bracket (${(currentBracket.rate * 100).toFixed(0)}%) too high`);
      return null;
    }
  }
  
  /**
   * NEW: Apply additional constraints (IRMAA, liquidity, etc.)
   */
  private getMaxConversionConstraints(age: number, baselineIncome: number, year: number): number {
    let maxConstraint = Infinity;
    
    // IRMAA constraint for Medicare-age individuals
    if (age >= 63) {
      const irmaaLimit = this.calculateIRMAAConstrainedCapacity(baselineIncome);
      maxConstraint = Math.min(maxConstraint, irmaaLimit);
      console.log(`IRMAA Constraint Applied: $${irmaaLimit.toLocaleString()}`);
    }
    
    // Additional constraints can be added here
    // (liquidity checks, cash flow constraints, etc.)
    
    return maxConstraint;
  }
  
  /**
   * DEPRECATED - Old calculation logic replaced by new bracket filling method above
   * This method is left for reference but should not be used
   */
  private calculateOptimalConversionAmountOLD(baselineTaxableIncome: number, availableToConvert: number, age: number, year: number): number {
    // This old method has been replaced by the new bracket filling strategy above
    return 0;
  }
  
  /**
   * Calculates IRMAA-constrained conversion capacity
   */
  private calculateIRMAAConstrainedCapacity(baselineIncome: number): number {
    const irmaaThresholds = this.inputs.filing_status === 'single' ? 
      IRMAA_THRESHOLDS_2025.single : 
      this.inputs.filing_status === 'headOfHousehold' ? 
      IRMAA_THRESHOLDS_2025.headOfHousehold : 
      IRMAA_THRESHOLDS_2025.marriedFilingJointly;
    
    // Find current IRMAA tier
    const currentTier = irmaaThresholds.find(tier => 
      baselineIncome >= tier.min && baselineIncome <= tier.max
    );
    
    if (!currentTier || currentTier.surcharge === 0) {
      // If not in IRMAA territory, find capacity to first threshold
      const firstThreshold = irmaaThresholds.find(tier => tier.surcharge > 0);
      return firstThreshold ? Math.max(0, firstThreshold.min - baselineIncome - 1) : Infinity;
    }
    
    // If already in IRMAA, stay in current tier
    return Math.max(0, currentTier.max - baselineIncome);
  }
  
  /**
   * Comprehensive tax calculation including federal, state, and NIIT
   */
  private calculateIncomeTaxes(income: number, year: number, hasConversion: boolean, userAge?: number, spouseAge?: number) {
    const taxBrackets = this.getTaxBrackets(year);
    const totalDeductions = this.getTotalDeductions(year, userAge || 0, spouseAge, income);
    const taxableIncome = Math.max(0, income - totalDeductions);
    
    // Federal income tax
    const federalIncomeTax = this.calculateProgressiveTax(taxableIncome, taxBrackets);
    
    // State income tax (simplified)
    const stateIncomeTax = this.calculateStateTax(taxableIncome);
    
    // Net Investment Income Tax (3.8% on investment income for high earners)
    const niitTax = this.calculateNIIT(income, taxableIncome);
    
    return { federalIncomeTax, stateIncomeTax, niitTax };
  }
  
  /**
   * Progressive tax calculation
   */
  private calculateProgressiveTax(income: number, brackets: any[]): number {
    let totalTax = 0;
    let previousMax = 0;
    
    for (const bracket of brackets) {
      if (income <= bracket.min) break;
      
      const taxableInThisBracket = Math.min(income, bracket.max) - previousMax;
      totalTax += taxableInThisBracket * bracket.rate;
      previousMax = bracket.max;
      
      if (income <= bracket.max) break;
    }
    
    return totalTax;
  }
  
  /**
   * Calculate taxable portion of Social Security benefits
   */
  private calculateTaxableSocialSecurity(grossBenefit: number, otherIncome: number, filingStatus: string): number {
    if (grossBenefit <= 0) return 0;
    
    // Calculate provisional income
    const provisionalIncome = otherIncome + (grossBenefit * 0.5);
    
    // Thresholds based on filing status
    const thresholds = filingStatus === 'single' ? 
      { first: 25000, second: 34000 } : 
      { first: 32000, second: 44000 };
    
    let taxableAmount = 0;
    
    if (provisionalIncome <= thresholds.first) {
      taxableAmount = 0;
    } else if (provisionalIncome <= thresholds.second) {
      const excess = provisionalIncome - thresholds.first;
      taxableAmount = Math.min(excess * 0.5, grossBenefit * 0.5);
    } else {
      const firstTier = (thresholds.second - thresholds.first) * 0.5;
      const secondTier = (provisionalIncome - thresholds.second) * 0.85;
      taxableAmount = Math.min(firstTier + secondTier, grossBenefit * 0.85);
    }
    
    return taxableAmount;
  }
  
  /**
   * Calculate Required Minimum Distribution
   */
  private calculateRMD(userAge: number, traditionalBalance: number, spouseAge?: number): number {
    const rmdAge = userAge >= 73 ? userAge : (spouseAge && spouseAge >= 73 ? spouseAge : 0);
    
    if (rmdAge === 0 || traditionalBalance <= 0) return 0;
    
    const lifeFactor = RMD_LIFE_EXPECTANCY_TABLE[rmdAge] || 11.5;
    return traditionalBalance / lifeFactor;
  }
  
  /**
   * Pay conversion tax using the specified cascade: Savings -> Taxable -> Traditional
   */
  private payConversionTax(taxAmount: number, taxableBalance: number, savingsBalance: number) {
    let remainingTax = taxAmount;
    let updatedSavingsBalance = savingsBalance;
    let updatedTaxableBalance = taxableBalance;
    
    // Tier 1: Pay from savings accounts
    if (remainingTax > 0 && updatedSavingsBalance > 0) {
      const fromSavings = Math.min(remainingTax, updatedSavingsBalance);
      updatedSavingsBalance -= fromSavings;
      remainingTax -= fromSavings;
    }
    
    // Tier 2: Pay from taxable accounts (creates additional taxable gain)
    if (remainingTax > 0 && updatedTaxableBalance > 0) {
      // Simplified: assume 20% of withdrawal is taxable gain
      const gainRate = 0.20;
      const grossWithdrawal = remainingTax / (1 - gainRate * 0.15); // Approximate tax on gains
      const actualWithdrawal = Math.min(grossWithdrawal, updatedTaxableBalance);
      updatedTaxableBalance -= actualWithdrawal;
      remainingTax = Math.max(0, remainingTax - actualWithdrawal);
    }
    
    return { updatedTaxableBalance, updatedSavingsBalance };
  }
  
  // Helper methods for calculation
  private calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  
  private getTotalTaxDeferredAssets(): number {
    return this.inputs.accounts
      .filter(account => ['Traditional IRA', '401k', '403b', 'Traditional 401k', 'Traditional 403b', 'HSA'].includes(account.account_type))
      .reduce((sum, account) => sum + account.balance, 0);
  }
  
  private getTotalRothAssets(): number {
    return this.inputs.accounts
      .filter(account => ['Roth IRA', 'Roth 401k', 'Roth 403b'].includes(account.account_type))
      .reduce((sum, account) => sum + account.balance, 0);
  }
  
  private getTotalTaxableAssets(): number {
    return this.inputs.accounts
      .filter(account => ['Taxable', 'Brokerage'].includes(account.account_type))
      .reduce((sum, account) => sum + account.balance, 0);
  }
  
  private getTotalSavingsAssets(): number {
    return this.inputs.accounts
      .filter(account => ['Savings', 'Checking', 'Cash'].includes(account.account_type))
      .reduce((sum, account) => sum + account.balance, 0);
  }
  
  private getTaxBrackets(year: number) {
    const brackets = year <= 2025 ? TAX_BRACKETS_2025 : TAX_BRACKETS_POST_2026;
    if (this.inputs.filing_status === 'single') {
      return brackets.single;
    } else if (this.inputs.filing_status === 'headOfHousehold') {
      return brackets.headOfHousehold;
    } else {
      return brackets.marriedFilingJointly;
    }
  }
  
  private getStandardDeduction(year: number): number {
    const deductions = year <= 2025 ? STANDARD_DEDUCTIONS[2025] : STANDARD_DEDUCTIONS.post2026;
    if (this.inputs.filing_status === 'single') {
      return deductions.single;
    } else if (this.inputs.filing_status === 'headOfHousehold') {
      return deductions.headOfHousehold;
    } else {
      return deductions.marriedFilingJointly;
    }
  }
  
  /**
   * Calculates total deductions including standard, age 65+, and OBBBA bonus deductions
   */
  private getTotalDeductions(year: number, userAge: number, spouseAge: number | undefined, grossIncome: number): number {
    // Start with standard deduction
    let totalDeduction = this.getStandardDeduction(year);
    
    // Add additional standard deduction for age 65+
    const addlDeductionAmount = this.inputs.filing_status === 'single' ? 
      ADDITIONAL_STANDARD_DEDUCTION_65.single : 
      this.inputs.filing_status === 'headOfHousehold' ? 
      ADDITIONAL_STANDARD_DEDUCTION_65.headOfHousehold : 
      ADDITIONAL_STANDARD_DEDUCTION_65.marriedFilingJointly;
    
    if (userAge >= 65) {
      totalDeduction += addlDeductionAmount;
    }
    
    if (spouseAge && spouseAge >= 65 && this.inputs.filing_status === 'marriedFilingJointly') {
      totalDeduction += addlDeductionAmount;
    }
    
    // Add OBBBA bonus deduction for seniors (2025-2028)
    if (year >= SENIOR_BONUS_DEDUCTION.startYear && year <= SENIOR_BONUS_DEDUCTION.endYear) {
      const bonusDeduction = this.calculateSeniorBonusDeduction(userAge, spouseAge, grossIncome);
      totalDeduction += bonusDeduction;
    }
    
    return totalDeduction;
  }
  
  /**
   * Calculates OBBBA bonus deduction with income phase-out
   */
  private calculateSeniorBonusDeduction(userAge: number, spouseAge: number | undefined, grossIncome: number): number {
    let eligibleCount = 0;
    
    if (userAge >= 65) eligibleCount++;
    if (spouseAge && spouseAge >= 65) eligibleCount++;
    
    if (eligibleCount === 0) return 0;
    
    const maxDeduction = eligibleCount * SENIOR_BONUS_DEDUCTION.amount;
    const phaseout = this.inputs.filing_status === 'single' ? 
      SENIOR_BONUS_DEDUCTION.phaseoutStart.single : 
      this.inputs.filing_status === 'headOfHousehold' ? 
      SENIOR_BONUS_DEDUCTION.phaseoutStart.headOfHousehold : 
      SENIOR_BONUS_DEDUCTION.phaseoutStart.marriedFilingJointly;
    const phaseoutEnd = this.inputs.filing_status === 'single' ? 
      SENIOR_BONUS_DEDUCTION.phaseoutEnd.single : 
      this.inputs.filing_status === 'headOfHousehold' ? 
      SENIOR_BONUS_DEDUCTION.phaseoutEnd.headOfHousehold : 
      SENIOR_BONUS_DEDUCTION.phaseoutEnd.marriedFilingJointly;
    
    // No phase-out if under threshold
    if (grossIncome <= phaseout) {
      return maxDeduction;
    }
    
    // Fully phased out if over end threshold
    if (grossIncome >= phaseoutEnd) {
      return 0;
    }
    
    // Calculate phase-out reduction
    const excessIncome = grossIncome - phaseout;
    const reduction = excessIncome * SENIOR_BONUS_DEDUCTION.phaseoutRate;
    
    return Math.max(0, maxDeduction - reduction);
  }
  
  private calculateWagesIncome(userAge: number, spouseAge: number | undefined, year: number): number {
    const currentYear = new Date().getFullYear();
    const yearOffset = year - currentYear;
    let income = 0;
    
    // Debug logging for first few years
    if (year <= currentYear + 3) {
      console.log(`\nWage calculation for year ${year}:`);
      console.log(`  User age: ${userAge}, Retirement age: ${this.inputs.user_retirement_age}`);
      console.log(`  Current year: ${currentYear}, Year offset: ${yearOffset}`);
    }
    
    // For current year, use actual income regardless of retirement age
    if (year === currentYear) {
      // Use actual current income for immediate conversion analysis
      income += this.inputs.user_gross_income - this.inputs.user_deductions;
      if (this.inputs.spouse_gross_income) {
        income += this.inputs.spouse_gross_income - this.inputs.spouse_deductions;
      }
      if (year <= currentYear + 3) {
        console.log(`  Current year income: $${income.toLocaleString()}`);
      }
    } else {
      // For future years, check retirement status
      // User income
      if (userAge < this.inputs.user_retirement_age) {
        const grossIncome = this.inputs.user_gross_income * Math.pow(1.03, yearOffset); // 3% annual increase
        const deductions = this.inputs.user_deductions * Math.pow(1.03, yearOffset);
        income += grossIncome - deductions;
        if (year <= currentYear + 3) {
          console.log(`  User still working: Gross $${grossIncome.toLocaleString()}, Net $${(grossIncome - deductions).toLocaleString()}`);
        }
      } else {
        if (year <= currentYear + 3) {
          console.log(`  User retired (age ${userAge} >= ${this.inputs.user_retirement_age})`);
        }
      }
      
      // Spouse income
      if (spouseAge && this.inputs.spouse_retirement_age && spouseAge < this.inputs.spouse_retirement_age) {
        const grossIncome = (this.inputs.spouse_gross_income || 0) * Math.pow(1.03, yearOffset);
        const deductions = this.inputs.spouse_deductions * Math.pow(1.03, yearOffset);
        income += grossIncome - deductions;
        if (year <= currentYear + 3) {
          console.log(`  Spouse still working: Gross $${grossIncome.toLocaleString()}, Net $${(grossIncome - deductions).toLocaleString()}`);
        }
      }
    }
    
    return income;
  }
  
  private calculateSocialSecurityBenefit(userAge: number, spouseAge: number | undefined, year: number): number {
    const yearOffset = year - new Date().getFullYear();
    let totalBenefit = 0;
    
    // User Social Security
    if (userAge >= this.inputs.user_ss_claim_age) {
      const annualBenefit = (this.inputs.social_security_benefit || 0) * 12;
      totalBenefit += annualBenefit * Math.pow(1 + SS_COLA, yearOffset);
    }
    
    // Spouse Social Security
    if (spouseAge && this.inputs.spouse_ss_claim_age && spouseAge >= this.inputs.spouse_ss_claim_age) {
      const annualBenefit = (this.inputs.spouse_social_security_benefit || 0) * 12;
      totalBenefit += annualBenefit * Math.pow(1 + SS_COLA, yearOffset);
    }
    
    return totalBenefit;
  }
  
  private calculateInvestmentIncome(taxableBalance: number): number {
    const dividendYield = CAPITAL_MARKET_ASSUMPTIONS.Balanced.dividendYield;
    return taxableBalance * dividendYield;
  }
  
  private getExpectedReturn(): number {
    return CAPITAL_MARKET_ASSUMPTIONS.Balanced.expectedReturn;
  }
  
  private calculateMarginalTaxRate(income: number, year: number, userAge?: number, spouseAge?: number): number {
    const brackets = this.getTaxBrackets(year);
    const totalDeductions = this.getTotalDeductions(year, userAge || 0, spouseAge, income);
    const taxableIncome = Math.max(0, income - totalDeductions);
    
    for (const bracket of brackets) {
      if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
        return bracket.rate;
      }
    }
    return brackets[brackets.length - 1].rate;
  }
  
  private calculateAvailableConversionCapacity(baselineIncome: number, age: number, year: number, spouseAge?: number): number {
    const brackets = this.getTaxBrackets(year);
    const totalDeductions = this.getTotalDeductions(year, age, spouseAge, baselineIncome);
    const taxableIncome = Math.max(0, baselineIncome - totalDeductions);
    
    const currentBracket = brackets.find(bracket => 
      taxableIncome >= bracket.min && taxableIncome <= bracket.max
    ) || brackets[brackets.length - 1];
    
    const bracketCapacity = currentBracket.max - taxableIncome;
    const irmaaCapacity = age >= 63 ? this.calculateIRMAAConstrainedCapacity(baselineIncome) : Infinity;
    
    return Math.min(bracketCapacity * 0.95, irmaaCapacity);
  }
  
  private calculateStateTax(taxableIncome: number): number {
    // Comprehensive state tax calculation with progressive brackets for major states
    const state = this.inputs.state_of_residence;
    
    // States with no income tax
    const noTaxStates = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];
    if (noTaxStates.includes(state)) return 0;
    
    // For married filing jointly in 2025 (simplified - top marginal rates)
    const stateRates: { [key: string]: { rate: number, threshold?: number } } = {
      // High tax states
      'CA': { rate: 0.133, threshold: 1250000 }, // 13.3% top rate (includes mental health tax)
      'NY': { rate: 0.109, threshold: 5000000 },  // 10.9% top rate
      'NJ': { rate: 0.1075, threshold: 1000000 }, // 10.75% top rate
      'HI': { rate: 0.11, threshold: 400000 },    // 11% top rate
      'OR': { rate: 0.099, threshold: 250000 },   // 9.9% top rate
      
      // Moderate tax states
      'MA': { rate: 0.05 },   // 5% flat rate
      'IL': { rate: 0.0495 },  // 4.95% flat rate
      'CT': { rate: 0.0699, threshold: 1000000 }, // 6.99% top rate
      'MD': { rate: 0.0575, threshold: 300000 },  // 5.75% top rate
      'VA': { rate: 0.0575, threshold: 17000 },   // 5.75% top rate
      
      // Lower tax states
      'AZ': { rate: 0.025 },   // 2.5% flat rate (as of 2025)
      'NC': { rate: 0.0475 },  // 4.75% flat rate
      'CO': { rate: 0.044 },   // 4.4% flat rate
      'UT': { rate: 0.0465 },  // 4.65% flat rate
      'IN': { rate: 0.0315 },  // 3.15% flat rate
      'PA': { rate: 0.0307 },  // 3.07% flat rate
      'ND': { rate: 0.0158, threshold: 125000 }  // 1.58% top rate
    };
    
    // Get state tax info
    const stateInfo = stateRates[state];
    if (!stateInfo) {
      // Default for states not listed - assume 5% average
      return taxableIncome * 0.05;
    }
    
    // For simplicity, apply the top marginal rate to conversion income
    // In reality, this would use progressive brackets, but for Roth conversions
    // we're typically adding income on top, so marginal rate is appropriate
    return taxableIncome * stateInfo.rate;
  }
  
  private calculateNIIT(totalIncome: number, taxableIncome: number): number {
    const niitThreshold = this.inputs.filing_status === 'single' || this.inputs.filing_status === 'headOfHousehold' ? 200000 : 250000;
    if (totalIncome <= niitThreshold) return 0;
    
    // Simplified NIIT calculation
    const investmentIncome = Math.min(taxableIncome * 0.1, totalIncome - niitThreshold); // Rough estimate
    return investmentIncome * 0.038;
  }
  
  private calculateIRMAASurcharge(userAge: number, spouseAge: number | undefined, magiHistory: number[], yearOffset: number): number {
    // IRMAA is based on MAGI from 2 years ago
    if (yearOffset < 2) return 0;
    
    const relevantMagi = magiHistory[yearOffset - 2] || 0;
    const irmaaThresholds = this.inputs.filing_status === 'single' ? 
      IRMAA_THRESHOLDS_2025.single : 
      this.inputs.filing_status === 'headOfHousehold' ? 
      IRMAA_THRESHOLDS_2025.headOfHousehold : 
      IRMAA_THRESHOLDS_2025.marriedFilingJointly;
    
    // Only apply IRMAA if on Medicare (age 65+)
    const onMedicare = userAge >= 65 || (spouseAge && spouseAge >= 65);
    if (!onMedicare) return 0;
    
    const tier = irmaaThresholds.find(t => relevantMagi >= t.min && relevantMagi <= t.max);
    return tier ? tier.surcharge : 0;
  }
  
  private processWithdrawals(
    amount: number, 
    savings: number, 
    taxable: number, 
    traditional: number, 
    roth: number
  ) {
    let remaining = amount;
    let newSavings = savings;
    let newTaxable = taxable;
    let newTraditional = traditional;
    let newRoth = roth;
    let withdrawalFromTraditional = 0;
    
    // Tier 1: Savings
    if (remaining > 0 && newSavings > 0) {
      const withdrawal = Math.min(remaining, newSavings);
      newSavings -= withdrawal;
      remaining -= withdrawal;
    }
    
    // Tier 2: Taxable
    if (remaining > 0 && newTaxable > 0) {
      const withdrawal = Math.min(remaining, newTaxable);
      newTaxable -= withdrawal;
      remaining -= withdrawal;
    }
    
    // Tier 3: Traditional (taxable withdrawal)
    if (remaining > 0 && newTraditional > 0) {
      const withdrawal = Math.min(remaining, newTraditional);
      newTraditional -= withdrawal;
      remaining -= withdrawal;
      withdrawalFromTraditional = withdrawal;
    }
    
    // Tier 4: Roth (last resort)
    if (remaining > 0 && newRoth > 0) {
      const withdrawal = Math.min(remaining, newRoth);
      newRoth -= withdrawal;
      remaining -= withdrawal;
    }
    
    return {
      updatedBalances: {
        savings: newSavings,
        taxable: newTaxable,
        traditional: newTraditional,
        roth: newRoth
      },
      withdrawalFromTraditional
    };
  }
  
  private calculateLifetimeTaxes(projection: ProjectionYear[]): number {
    return projection.reduce((sum, year) => sum + year.totalTaxes, 0);
  }
  
  private calculateFinalEstateValue(projection: ProjectionYear[]): number {
    const finalYear = projection[projection.length - 1];
    return finalYear.traditionalBalance + finalYear.rothBalance + 
           finalYear.taxableBalance + finalYear.savingsBalance;
  }
  
  private calculateHeirTaxBurden(projection: ProjectionYear[]): number {
    const finalYear = projection[projection.length - 1];
    // Under SECURE Act, heirs pay tax on inherited traditional IRA at their marginal rate
    // Assume 24% marginal rate for heirs
    return finalYear.traditionalBalance * 0.24;
  }
  
  private generateRecommendations(
    withConversion: ProjectionYear[], 
    withoutConversion: ProjectionYear[], 
    lifetimeTaxSavings: number
  ) {
    const keyInsights: string[] = [];
    const warnings: string[] = [];
    
    // Analyze conversion years
    const conversionYears = withConversion.filter(year => year.conversionAmount > 0);
    const totalConversions = conversionYears.reduce((sum, year) => sum + year.conversionAmount, 0);
    const avgConversion = conversionYears.length > 0 ? totalConversions / conversionYears.length : 0;
    
    // Check for dangerous patterns
    const hasHighBracketConversions = conversionYears.some(year => year.marginalTaxRate >= 0.24);
    const hasPreRetirementConversions = conversionYears.some(year => {
      const age = year.userAge;
      return age < this.inputs.user_retirement_age;
    });
    
    // State tax impact
    const stateTaxRate = this.calculateStateTax(1000) / 1000;
    const totalStateTax = conversionYears.reduce((sum, year) => 
      sum + this.calculateStateTax(year.conversionAmount), 0
    );
    
    // IRMAA impact check
    const triggersIRMAA = conversionYears.some(year => {
      const income = year.totalIncome;
      const threshold = this.inputs.filing_status === 'single' || this.inputs.filing_status === 'headOfHousehold' ? 106000 : 212000;
      return year.userAge >= 63 && income > threshold;
    });
    
    // Generate insights
    if (lifetimeTaxSavings > 0) {
      keyInsights.push(`Lifetime tax savings of $${Math.round(lifetimeTaxSavings).toLocaleString()}`);
      keyInsights.push(`Reduces future RMDs by approximately $${Math.round(totalConversions * 0.04).toLocaleString()} annually`);
      keyInsights.push("Creates tax-free inheritance for heirs (no 10-year distribution requirement)");
      
      if (stateTaxRate > 0) {
        keyInsights.push(`State tax cost: $${Math.round(totalStateTax).toLocaleString()} (${(stateTaxRate * 100).toFixed(1)}% rate in ${this.inputs.state_of_residence})`);
      } else {
        keyInsights.push(`Tax-free state advantage: No state income tax in ${this.inputs.state_of_residence}`);
      }
    }
    
    // Generate warnings
    if (lifetimeTaxSavings < 0) {
      warnings.push(`⚠️ Conversions increase lifetime taxes by $${Math.abs(Math.round(lifetimeTaxSavings)).toLocaleString()}`);
    }
    
    if (hasHighBracketConversions) {
      warnings.push("⚠️ Some conversions occur in 24% or higher tax bracket - consider reducing amounts");
    }
    
    if (hasPreRetirementConversions) {
      warnings.push("⚠️ Converting while still working at high income - wait until retirement for lower rates");
    }
    
    if (triggersIRMAA) {
      warnings.push("⚠️ Conversions may trigger Medicare IRMAA surcharges - consider spreading over more years");
    }
    
    if (stateTaxRate > 0.07) {
      warnings.push(`⚠️ High state tax rate (${(stateTaxRate * 100).toFixed(1)}%) significantly impacts conversion benefits`);
    }
    
    // Cash flow warning
    const avgTaxCost = conversionYears.length > 0 ?
      conversionYears.reduce((sum, year) => sum + year.conversionTax, 0) / conversionYears.length : 0;
    if (avgTaxCost > 50000) {
      warnings.push(`⚠️ Average annual tax cost of $${Math.round(avgTaxCost).toLocaleString()} - ensure adequate liquidity`);
    }
    
    // Strategy recommendation
    let recommendedStrategy = "";
    
    if (lifetimeTaxSavings > 10000 && !hasHighBracketConversions && !hasPreRetirementConversions) {
      recommendedStrategy = `Execute ${this.strategy} bracket-filling conversions over ${conversionYears.length} years, averaging $${Math.round(avgConversion).toLocaleString()} annually. ` +
        `Focus on the gap years between retirement and Social Security/RMDs. ` +
        `Total lifetime benefit: $${Math.round(lifetimeTaxSavings).toLocaleString()}. ` +
        `Important: Consult with a tax professional after retirement to optimize the conversion timing and amounts based on your actual retirement income.`;
    } else if (lifetimeTaxSavings > 0 && (hasHighBracketConversions || hasPreRetirementConversions)) {
      recommendedStrategy = `Conversions show potential but need optimization. Consider waiting until retirement and limiting conversions to lower tax brackets. ` +
        `Current plan saves $${Math.round(lifetimeTaxSavings).toLocaleString()} but could be improved. ` +
        `We recommend consulting with a tax professional after retirement to develop an optimal conversion strategy.`;
    } else if (lifetimeTaxSavings > 0) {
      // This handles the case where there are small positive savings (matching the AI recommendation logic)
      recommendedStrategy = `Consider Roth conversions after retirement. While the projected lifetime tax savings of $${Math.round(lifetimeTaxSavings).toLocaleString()} are modest, ` +
        `there may be opportunities to optimize conversions during low-income years. ` +
        `Consult with a tax professional after retirement to evaluate if conversions make sense based on your actual retirement situation.`;
    } else {
      recommendedStrategy = `Roth conversions are not recommended based on current projections. ` +
        `Your tax situation doesn't create sufficient arbitrage opportunity. ` +
        `Reassess if your income drops significantly or tax laws change. ` +
        `Consider reviewing with a tax professional if your circumstances change significantly.`;
    }
    
    return { recommendedStrategy, keyInsights, warnings };
  }
  
  private createConversionPlan(projection: ProjectionYear[]) {
    return projection
      .filter(year => year.conversionAmount > 0)
      .map(year => {
        const federalRate = year.marginalTaxRate;
        const stateRate = this.calculateStateTax(1000) / 1000;
        const combinedRate = federalRate + stateRate;
        
        return {
          year: year.year,
          age: year.userAge,
          conversionAmount: year.conversionAmount,
          taxOwed: year.conversionTax,
          marginalRate: year.marginalTaxRate,
          federalTaxOnConversion: year.conversionTax * (federalRate / combinedRate),
          stateTaxOnConversion: year.conversionTax * (stateRate / combinedRate),
          effectiveTaxRate: year.conversionTax / year.conversionAmount,
          paymentSource: this.determineOptimalPaymentSource(year),
          taxBracket: `${(federalRate * 100).toFixed(0)}% federal + ${(stateRate * 100).toFixed(1)}% state = ${(combinedRate * 100).toFixed(1)}% combined`,
          incomeBeforeConversion: year.totalIncome - year.conversionAmount,
          incomeAfterConversion: year.totalIncome
        };
      });
  }
  
  private determineOptimalPaymentSource(year: ProjectionYear): string {
    const taxOwed = Math.max(0, year.conversionTax || 0);
    const savingsNow = Math.max(0, Math.round(year.savingsBalance || 0));
    const taxableNow = Math.max(0, Math.round(year.taxableBalance || 0));

    // Priority 1: Savings accounts today (tax-free to withdraw)
    if (savingsNow >= taxOwed) {
      return `Savings accounts ($${savingsNow.toLocaleString()} available) - tax-free withdrawal`;
    }

    // Priority 2: Taxable brokerage today (approx capital gains impact)
    if (taxableNow >= taxOwed) {
      const capitalGainsRate = this.getCapitalGainsRate(year.totalIncome);
      return `Taxable brokerage ($${taxableNow.toLocaleString()} available) - ~${(capitalGainsRate * 100).toFixed(1)}% capital gains drag`;
    }

    // Priority 3: Combination of savings + taxable
    if (savingsNow + taxableNow >= taxOwed) {
      const fromSavings = Math.min(savingsNow, taxOwed);
      const fromTaxable = taxOwed - fromSavings;
      return `Combination: $${fromSavings.toLocaleString()} from savings + $${fromTaxable.toLocaleString()} from taxable brokerage`;
    }

    // Last resort
    const monthlyTaxPayment = Math.round(taxOwed / 12);
    return `Monthly cash flow (~$${monthlyTaxPayment.toLocaleString()}/mo) or withholding (not recommended)`;
  }
  
  private getExpectedReturnByRiskProfile(riskProfile: string): number {
    const returns = {
      'conservative': 0.045,
      'balanced': 0.064,
      'aggressive': 0.075,
      'growth': 0.075
    };
    return returns[riskProfile.toLowerCase()] || 0.064;
  }
  
  private calculateSavingsGrowth(currentBalance: number, monthlySavings: number, years: number, annualRate: number): number {
    // Future value of current balance
    const futureValueCurrent = currentBalance * Math.pow(1 + annualRate, years);
    
    // Future value of monthly contributions (annuity)
    const monthlyRate = annualRate / 12;
    const months = years * 12;
    const futureValueContributions = monthlySavings * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
    
    return futureValueCurrent + futureValueContributions;
  }
  
  private getCurrentSavingsBalance(): number {
    return this.inputs.accounts
      .filter(account => account.account_type.toLowerCase().includes('savings') || 
                        account.account_type.toLowerCase().includes('checking') ||
                        account.account_type.toLowerCase().includes('money market'))
      .reduce((sum, account) => sum + account.balance, 0);
  }
  
  private getCurrentTaxableBalance(): number {
    return this.inputs.accounts
      .filter(account => account.account_type.toLowerCase().includes('taxable') || 
                        account.account_type.toLowerCase().includes('brokerage'))
      .reduce((sum, account) => sum + account.balance, 0);
  }
  
  private getCapitalGainsRate(totalIncome: number): number {
    // 2025 capital gains brackets
    if (this.inputs.filing_status === 'single' || this.inputs.filing_status === 'headOfHousehold') {
      if (totalIncome <= 47025) return 0.00; // 0%
      if (totalIncome <= 518900) return 0.15; // 15%
      return 0.20; // 20%
    } else { // married filing jointly
      if (totalIncome <= 94050) return 0.00; // 0%
      if (totalIncome <= 583750) return 0.15; // 15%
      return 0.20; // 20%
    }
  }
}
