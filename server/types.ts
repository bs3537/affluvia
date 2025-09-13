// Glide Path Projection Types
export interface GlidePathAllocation {
  equity: number;
  bonds: number;
  cash: number;
}

export interface GlidePathYearlyProjection {
  year: number;
  balance: number;
  yearlyReturn: number;
  allocation: GlidePathAllocation;
}

export interface GlidePathProjection {
  finalBalance: number;
  annualReturns: number[];
  yearlyProjection: GlidePathYearlyProjection[];
}

export interface EducationProjection {
  years: number[];
  costs: number[];
  funded: number[];
  loanAmounts?: number[];
  totalCost: number;
  totalFunded: number;
  totalLoans?: number;
  fundingPercentage: number;
  monthlyContributionNeeded: number;
  comprehensiveFundingPercentage?: number;
  glidePathProjection?: GlidePathProjection;
}

// Education Goal Types
export interface EducationGoal {
  id?: number;
  userId: number;
  studentName: string;
  relationship?: string;
  studentBirthYear?: number;
  goalType: 'college' | 'pre-college';
  startYear: number;
  endYear: number;
  years: number;
  costOption: 'average' | 'specific' | 'custom';
  collegeId?: string;
  collegeName?: string;
  costPerYear?: number | string;
  inflationRate?: number | string;
  coverPercent?: number | string;
  scholarshipPerYear?: number | string;
  loanPerYear?: number | string;
  currentSavings?: number | string;
  monthlyContribution?: number | string;
  accountType?: string;
  expectedReturn?: number | string;
  riskProfile?: string;
  projection?: EducationProjection;
  projectionData?: any; // Legacy field, will be replaced by projection
  monthlyContributionNeeded?: number;
  fundingPercentage?: number;
  probabilityOfSuccess?: number;
  lastCalculatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Financial Profile Types
export interface FinancialProfile {
  id: number;
  userId: number;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  maritalStatus?: string | null;
  dependents?: number | null;
  spouseName?: string | null;
  spouseDateOfBirth?: string | null;
  state?: string | null;
  employmentStatus?: string | null;
  annualIncome?: number | null;
  taxWithholdingStatus?: string | null;
  takeHomeIncome?: number | null;
  otherIncome?: number | null;
  spouseEmploymentStatus?: string | null;
  spouseAnnualIncome?: number | null;
  spouseTaxWithholdingStatus?: string | null;
  spouseTakeHomeIncome?: number | null;
  savingsRate?: number | null;
  assets?: any;
  liabilities?: any;
  primaryResidence?: any;
  additionalProperties?: any;
  monthlyExpenses?: any;
  totalMonthlyExpenses?: number | null;
  monthlyCashFlow?: number | null;
  monthlyCashFlowAfterContributions?: number | null;
  emergencyFundSize?: number | null;
  lifeInsurance?: any;
  spouseLifeInsurance?: any;
  healthInsurance?: any;
  disabilityInsurance?: any;
  spouseDisabilityInsurance?: any;
  insurance?: any;
  riskTolerance?: string | null;
  riskQuestionnaire?: any;
  riskQuestions?: any;
  currentAllocation?: any;
  spouseRiskQuestions?: any;
  spouseAllocation?: any;
  hasWill?: boolean | null;
  hasTrust?: boolean | null;
  hasPowerOfAttorney?: boolean | null;
  hasHealthcareProxy?: boolean | null;
  hasBeneficiaries?: boolean | null;
  estatePlanning?: any;
  goals?: any;
  lifeGoals?: any;
  retirementAge?: number | null;
  retirementIncome?: number | null;
  additionalNotes?: string | null;
  lifeExpectancy?: number | null;
  retirementExpenseBudget?: any;
  socialSecurityBenefit?: number | null;
  pensionBenefit?: number | null;
  retirementContributions?: any;
  spouseRetirementContributions?: any;
  traditionalIRAContribution?: number | null;
  rothIRAContribution?: number | null;
  spouseTraditionalIRAContribution?: number | null;
  spouseRothIRAContribution?: number | null;
  expectedRealReturn?: number | null;
  withdrawalRate?: number | null;
  optimalRetirementAge?: number | null;
  hasLongTermCareInsurance?: boolean | null;
  legacyGoal?: number | null;
  lastYearAGI?: number | null;
  deductionAmount?: number | null;
  taxFilingStatus?: string | null;
  taxReturns?: any;
  calculations?: any;
  isComplete?: boolean | null;
  lastUpdated?: Date | null;
}

// Estate Plan Types
export interface EstatePlan {
  id?: number;
  userId: number;
  planName: string;
  description?: string;
  lastReviewDate?: Date;
  nextReviewDate?: Date;
  primaryBeneficiaries?: any;
  contingentBeneficiaries?: any;
  executors?: any;
  guardians?: any;
  powerOfAttorney?: any;
  healthcareProxy?: any;
  trustStrategies?: any;
  taxStrategies?: any;
  charitableGiving?: any;
  specialInstructions?: string;
  documents?: any;
  estimatedEstateTax?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Export all types
export * from '../shared/schema.ts';
