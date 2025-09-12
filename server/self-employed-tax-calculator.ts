/**
 * Self-Employed Tax Calculator
 * Provides comprehensive tax calculations for self-employed individuals
 * Based on 2025 IRS guidelines
 */

interface SelfEmployedTaxInputs {
  selfEmploymentIncome: number;
  businessExpenses?: number;
  age: number;
  spouseAge?: number;
  filingStatus: 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household';
  previousYearAGI?: number;
  currentYear401kContribution?: number;
  currentYearIRAContribution?: number;
  businessType?: 'sole_proprietor' | 'llc' | 's_corp' | 'c_corp';
  state?: string;
}

interface RetirementPlanLimits {
  solo401k: {
    employeeDeferral: number;
    employerContribution: number;
    totalLimit: number;
    catchUp50: number;
    catchUp60to63: number;
    yourMaxContribution: number;
  };
  sepIRA: {
    contributionLimit: number;
    percentageLimit: number;
    yourMaxContribution: number;
  };
  simpleIRA: {
    employeeContribution: number;
    catchUp50: number;
    catchUp60to63: number;
    employerMatch: number;
    yourMaxContribution: number;
  };
}

interface TaxDeductions {
  homeOffice: number;
  vehicleExpenses: number;
  healthInsurance: number;
  hsaContribution: number;
  qbiDeduction: number;
  selfEmploymentTaxDeduction: number;
  businessExpenses: number;
  section179: number;
  totalDeductions: number;
}

interface QuarterlyTaxEstimate {
  quarter: number;
  dueDate: string;
  amount: number;
  safeHarborAmount: number;
  currentYearAmount: number;
}

interface SCorpAnalysis {
  reasonableSalary: number;
  distributions: number;
  payrollTaxSavings: number;
  additionalCosts: number;
  netSavings: number;
  breakEvenPoint: number;
  recommended: boolean;
}

export class SelfEmployedTaxCalculator {
  // 2025 Tax constants
  private static readonly SELF_EMPLOYMENT_TAX_RATE = 0.153; // 15.3%
  private static readonly SOCIAL_SECURITY_RATE = 0.124; // 12.4%
  private static readonly MEDICARE_RATE = 0.029; // 2.9%
  private static readonly SOCIAL_SECURITY_WAGE_BASE_2025 = 176100; // 2025 limit
  private static readonly ADDITIONAL_MEDICARE_THRESHOLD = {
    single: 200000,
    married_filing_jointly: 250000,
    married_filing_separately: 125000,
    head_of_household: 200000
  };

  // 2025 Retirement contribution limits (per IRS guidelines)
  private static readonly CONTRIBUTION_LIMITS_2025 = {
    solo401k: {
      employeeDeferral: 23000,  // Updated per IRS 2025 limits
      totalLimit: 69000,  // Updated per IRS 2025 limits
      catchUp50: 7500,
      catchUp60to63: 11250
    },
    sepIRA: {
      limit: 69000,  // Updated per IRS 2025 limits
      percentage: 0.25  // 25% of net earnings from self-employment
    },
    simpleIRA: {
      contribution: 16000,  // Updated per IRS 2025 limits
      higherLimit: 17600, // For certain employers
      catchUp50: 3500,
      catchUp60to63: 5250
    },
    traditionalIRA: 7000,
    rothIRA: 7000,
    iraCtachUp50: 1000,
    hsa: {
      self: 4300,
      family: 8550,
      catchUp55: 1000
    }
  };

  // Standard mileage rate for 2025
  private static readonly MILEAGE_RATE_2025 = 0.70; // 70 cents per mile

  /**
   * Calculate self-employment tax
   */
  static calculateSelfEmploymentTax(netEarnings: number): number {
    // Self-employment tax is calculated on 92.35% of net earnings
    const taxableEarnings = netEarnings * 0.9235;
    
    // Social Security portion (capped at wage base)
    const socialSecurityTaxable = Math.min(taxableEarnings, this.SOCIAL_SECURITY_WAGE_BASE_2025);
    const socialSecurityTax = socialSecurityTaxable * this.SOCIAL_SECURITY_RATE;
    
    // Medicare portion (no cap)
    const medicareTax = taxableEarnings * this.MEDICARE_RATE;
    
    return socialSecurityTax + medicareTax;
  }

  /**
   * Calculate retirement plan contribution limits based on self-employment income
   */
  static calculateRetirementPlanLimits(inputs: SelfEmployedTaxInputs): RetirementPlanLimits {
    const { selfEmploymentIncome, businessExpenses = 0, age, spouseAge } = inputs;
    const netEarnings = selfEmploymentIncome - businessExpenses;
    const selfEmploymentTax = this.calculateSelfEmploymentTax(netEarnings);
    
    // Adjusted net earnings (after deducting half of SE tax)
    const adjustedNetEarnings = netEarnings - (selfEmploymentTax / 2);
    
    // Solo 401(k) calculations
    const employeeDeferral = this.CONTRIBUTION_LIMITS_2025.solo401k.employeeDeferral;
    const catchUp50 = age >= 50 ? this.CONTRIBUTION_LIMITS_2025.solo401k.catchUp50 : 0;
    const catchUp60to63 = age >= 60 && age <= 63 ? 
      this.CONTRIBUTION_LIMITS_2025.solo401k.catchUp60to63 - catchUp50 : 0;
    
    // Employer contribution (up to 25% of compensation for self-employed)
    // For self-employed, this is actually 20% of adjusted net earnings (25% / 1.25)
    const employerContribution = Math.min(
      adjustedNetEarnings * 0.20,  // 20% for self-employed (not 25%)
      this.CONTRIBUTION_LIMITS_2025.solo401k.totalLimit - employeeDeferral - catchUp50 - catchUp60to63
    );
    
    const solo401kMax = Math.min(
      employeeDeferral + employerContribution + catchUp50 + catchUp60to63,
      age >= 60 && age <= 63 ? 80250 :  // 69000 + 11250
      age >= 50 ? 76500 :  // 69000 + 7500
      69000  // Base limit per IRS
    );

    // SEP IRA calculations (25% of compensation, but 20% for self-employed)
    const sepIRAMax = Math.min(
      adjustedNetEarnings * 0.20,  // 20% for self-employed (25% / 1.25)
      this.CONTRIBUTION_LIMITS_2025.sepIRA.limit
    );

    // SIMPLE IRA calculations
    const simpleEmployeeContribution = this.CONTRIBUTION_LIMITS_2025.simpleIRA.contribution;
    const simpleCatchUp50 = age >= 50 ? this.CONTRIBUTION_LIMITS_2025.simpleIRA.catchUp50 : 0;
    const simpleCatchUp60to63 = age >= 60 && age <= 63 ? 
      this.CONTRIBUTION_LIMITS_2025.simpleIRA.catchUp60to63 - simpleCatchUp50 : 0;
    const simpleEmployerMatch = Math.min(adjustedNetEarnings * 0.03, simpleEmployeeContribution);
    
    const simpleIRAMax = simpleEmployeeContribution + simpleCatchUp50 + simpleCatchUp60to63 + simpleEmployerMatch;

    return {
      solo401k: {
        employeeDeferral,
        employerContribution,
        totalLimit: this.CONTRIBUTION_LIMITS_2025.solo401k.totalLimit,
        catchUp50,
        catchUp60to63,
        yourMaxContribution: solo401kMax
      },
      sepIRA: {
        contributionLimit: this.CONTRIBUTION_LIMITS_2025.sepIRA.limit,
        percentageLimit: 25,
        yourMaxContribution: sepIRAMax
      },
      simpleIRA: {
        employeeContribution: simpleEmployeeContribution,
        catchUp50: simpleCatchUp50,
        catchUp60to63: simpleCatchUp60to63,
        employerMatch: simpleEmployerMatch,
        yourMaxContribution: simpleIRAMax
      }
    };
  }

  /**
   * Calculate available tax deductions for self-employed
   */
  static calculateTaxDeductions(
    inputs: SelfEmployedTaxInputs,
    additionalInputs?: {
      homeOfficeSquareFeet?: number;
      totalHomeSquareFeet?: number;
      businessMiles?: number;
      healthInsurancePremiums?: number;
      hasHDHP?: boolean;
      familyCoverage?: boolean;
    }
  ): TaxDeductions {
    const { selfEmploymentIncome, businessExpenses = 0, age } = inputs;
    const netEarnings = selfEmploymentIncome - businessExpenses;
    const selfEmploymentTax = this.calculateSelfEmploymentTax(netEarnings);
    
    // Self-employment tax deduction (50% of SE tax)
    const selfEmploymentTaxDeduction = selfEmploymentTax / 2;
    
    // Home office deduction (simplified method: $5 per sq ft, max 300 sq ft)
    let homeOfficeDeduction = 0;
    if (additionalInputs?.homeOfficeSquareFeet) {
      const eligibleSqFt = Math.min(additionalInputs.homeOfficeSquareFeet, 300);
      homeOfficeDeduction = eligibleSqFt * 5;
    }
    
    // Vehicle expenses (standard mileage rate)
    const vehicleExpenses = (additionalInputs?.businessMiles || 0) * this.MILEAGE_RATE_2025;
    
    // Health insurance premiums (100% deductible for self-employed)
    const healthInsuranceDeduction = additionalInputs?.healthInsurancePremiums || 0;
    
    // HSA contribution deduction
    let hsaDeduction = 0;
    if (additionalInputs?.hasHDHP) {
      hsaDeduction = additionalInputs.familyCoverage ? 
        this.CONTRIBUTION_LIMITS_2025.hsa.family : 
        this.CONTRIBUTION_LIMITS_2025.hsa.self;
      if (age >= 55) {
        hsaDeduction += this.CONTRIBUTION_LIMITS_2025.hsa.catchUp55;
      }
    }
    
    // QBI (Qualified Business Income) deduction - 20% of qualified income
    // Subject to taxable income thresholds
    const qbiEligibleIncome = netEarnings - selfEmploymentTaxDeduction;
    const qbiDeduction = qbiEligibleIncome * 0.20;
    
    // Section 179 deduction (equipment purchases) - placeholder
    const section179 = 0; // Would need actual equipment purchase data
    
    return {
      homeOffice: homeOfficeDeduction,
      vehicleExpenses,
      healthInsurance: healthInsuranceDeduction,
      hsaContribution: hsaDeduction,
      qbiDeduction,
      selfEmploymentTaxDeduction,
      businessExpenses,
      section179,
      totalDeductions: homeOfficeDeduction + vehicleExpenses + healthInsuranceDeduction + 
                      hsaDeduction + qbiDeduction + selfEmploymentTaxDeduction + 
                      businessExpenses + section179
    };
  }

  /**
   * Calculate estimated income tax using progressive tax brackets (2025)
   */
  static calculateEstimatedIncomeTax(
    adjustedIncome: number,
    filingStatus: 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household'
  ): number {
    // 2025 tax brackets for single filers (simplified)
    const brackets = {
      single: [
        { min: 0, max: 11000, rate: 0.10 },
        { min: 11000, max: 44725, rate: 0.12 },
        { min: 44725, max: 95375, rate: 0.22 },
        { min: 95375, max: 182050, rate: 0.24 },
        { min: 182050, max: 231250, rate: 0.32 },
        { min: 231250, max: Infinity, rate: 0.35 }
      ],
      married_filing_jointly: [
        { min: 0, max: 22000, rate: 0.10 },
        { min: 22000, max: 89450, rate: 0.12 },
        { min: 89450, max: 190750, rate: 0.22 },
        { min: 190750, max: 364200, rate: 0.24 },
        { min: 364200, max: 462500, rate: 0.32 },
        { min: 462500, max: Infinity, rate: 0.35 }
      ]
    };
    
    // Use single brackets for other filing statuses (simplified)
    const applicableBrackets = brackets[filingStatus] || brackets.single;
    
    let tax = 0;
    let remainingIncome = adjustedIncome;
    
    for (const bracket of applicableBrackets) {
      if (remainingIncome <= 0) break;
      
      const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
      tax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
    }
    
    return tax;
  }

  /**
   * Calculate quarterly estimated tax payments
   */
  static calculateQuarterlyTaxes(
    inputs: SelfEmployedTaxInputs,
    currentQuarter: number = 1
  ): QuarterlyTaxEstimate[] {
    const { selfEmploymentIncome, businessExpenses = 0, previousYearAGI = 0, filingStatus } = inputs;
    const netEarnings = selfEmploymentIncome - businessExpenses;
    const selfEmploymentTax = this.calculateSelfEmploymentTax(netEarnings);
    
    // Calculate adjusted income (after deducting half of SE tax)
    const adjustedIncome = netEarnings - (selfEmploymentTax / 2);
    
    // Use progressive tax calculation for more accurate estimate
    const estimatedIncomeTax = this.calculateEstimatedIncomeTax(adjustedIncome, filingStatus);
    const totalTaxLiability = estimatedIncomeTax + selfEmploymentTax;
    
    // Safe harbor calculation - use actual previous year tax if provided
    let safeHarborTax;
    if (inputs.previousYearAGI && inputs.previousYearAGI > 0) {
      // If we have actual previous year tax, use it; otherwise estimate
      safeHarborTax = inputs.previousYearTax || (inputs.previousYearAGI * 0.22);
    } else {
      safeHarborTax = previousYearAGI * 0.22; // Fallback simplified calculation
    }
    
    const safeHarborMultiplier = previousYearAGI > 150000 ? 1.1 : 1.0;
    const safeHarborAmount = safeHarborTax * safeHarborMultiplier;
    
    // Current year method (90% of current year tax)
    const currentYearAmount = totalTaxLiability * 0.9;
    
    // Use the lower of safe harbor or current year
    const quarterlyAmount = Math.min(safeHarborAmount, currentYearAmount) / 4;
    
    const quarters: QuarterlyTaxEstimate[] = [
      { quarter: 1, dueDate: '2025-04-15', amount: quarterlyAmount, safeHarborAmount: safeHarborAmount/4, currentYearAmount: currentYearAmount/4 },
      { quarter: 2, dueDate: '2025-06-16', amount: quarterlyAmount, safeHarborAmount: safeHarborAmount/4, currentYearAmount: currentYearAmount/4 },
      { quarter: 3, dueDate: '2025-09-15', amount: quarterlyAmount, safeHarborAmount: safeHarborAmount/4, currentYearAmount: currentYearAmount/4 },
      { quarter: 4, dueDate: '2026-01-15', amount: quarterlyAmount, safeHarborAmount: safeHarborAmount/4, currentYearAmount: currentYearAmount/4 }
    ];
    
    return quarters.filter(q => q.quarter >= currentQuarter);
  }

  /**
   * Analyze S-Corp election benefits
   */
  static analyzeSCorpElection(inputs: SelfEmployedTaxInputs): SCorpAnalysis {
    const { selfEmploymentIncome, businessExpenses = 0 } = inputs;
    const netIncome = selfEmploymentIncome - businessExpenses;
    
    // Reasonable salary calculation (using 60/40 guideline as starting point)
    const reasonableSalary = netIncome * 0.6;
    const distributions = netIncome * 0.4;
    
    // Current self-employment tax
    const currentSETax = this.calculateSelfEmploymentTax(netIncome);
    
    // S-Corp payroll taxes (only on salary)
    const sCorpPayrollTax = reasonableSalary * this.SELF_EMPLOYMENT_TAX_RATE;
    
    // Savings
    const payrollTaxSavings = currentSETax - sCorpPayrollTax;
    
    // Additional S-Corp costs
    const additionalCosts = 2500; // Estimated annual cost for payroll, tax return, etc.
    
    // Net savings
    const netSavings = payrollTaxSavings - additionalCosts;
    
    // Break-even point (income level where S-Corp makes sense)
    const breakEvenPoint = additionalCosts / 0.153 / 0.4; // Rough calculation
    
    return {
      reasonableSalary,
      distributions,
      payrollTaxSavings,
      additionalCosts,
      netSavings,
      breakEvenPoint,
      recommended: netIncome > 60000 && netSavings > 0
    };
  }

  /**
   * Calculate tax savings for different strategies
   */
  static calculateTaxSavings(
    strategy: 'solo401k' | 'sepIRA' | 'simpleIRA' | 's_corp' | 'deductions',
    inputs: SelfEmployedTaxInputs,
    contribution?: number
  ): number {
    const marginalRate = 0.24; // Simplified - would need full tax calculation
    
    switch (strategy) {
      case 'solo401k':
      case 'sepIRA':
      case 'simpleIRA':
        return (contribution || 0) * marginalRate;
      
      case 's_corp':
        const sCorpAnalysis = this.analyzeSCorpElection(inputs);
        return sCorpAnalysis.netSavings;
      
      case 'deductions':
        const deductions = this.calculateTaxDeductions(inputs);
        return deductions.totalDeductions * marginalRate;
      
      default:
        return 0;
    }
  }
}

export default SelfEmployedTaxCalculator;