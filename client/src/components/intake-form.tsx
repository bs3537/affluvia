import React, { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, User, DollarSign, TrendingUp, Home, CreditCard, Shield, PieChart, FileText, Calculator, Target, Settings, ChevronDown, ChevronRight, List, CheckCircle, Info, Loader2, Link2, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SessionTracker } from "@/components/gamification/session-tracker";
import { AchievementBadges } from "@/components/gamification/achievement-badges";
import { LiveInsights } from "@/components/gamification/live-insights";
import { CelebrationEffects } from "@/components/gamification/celebration-effects";
import { ActivityFeed } from "@/components/gamification/activity-feed";
import { GamificationWrapper, useGamification } from "@/components/gamification/gamification-wrapper";
import { TrackingButton } from "@/components/gamification/tracking-components";
import { useAuth } from "@/hooks/use-auth";
import { calculateOptimalSocialSecurityAge, calculatePrimaryInsuranceAmount, calculateAIME, calculateBenefitAtAge } from "@/utils/socialSecurityOptimizer";
import { Switch } from "@/components/ui/switch";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRetirementContributionValidation, ContributionValidationMessage, ContributionLimitInfo } from "@/hooks/use-retirement-contribution-validation";
import { useDebouncedSave } from "@/hooks/use-debounced-save";
import { useFormPersistence } from "@/hooks/use-form-persistence";

// Helper function to calculate life expectancy based on health status
function calculateLifeExpectancyFromHealth(healthStatus: 'excellent' | 'good' | 'fair' | 'poor' | undefined): number {
  const baseLifeExpectancy = 93; // Default for 'good' health
  
  switch (healthStatus) {
    case 'excellent':
      return baseLifeExpectancy + 3; // 96
    case 'good':
      return baseLifeExpectancy; // 93
    case 'fair':
      return baseLifeExpectancy - 3; // 90
    case 'poor':
      return baseLifeExpectancy - 5; // 88
    default:
      return baseLifeExpectancy; // 93
  }
}

// State-specific property tax rates (annual as % of market value) - 2024-2025 data
const PROPERTY_TAX_RATES: Record<string, number> = {
  AL: 0.004, AK: 0.012, AZ: 0.006, AR: 0.006, CA: 0.007, CO: 0.0055, CT: 0.020,
  DE: 0.005, DC: 0.006, FL: 0.008, GA: 0.009, HI: 0.003, ID: 0.007, IL: 0.022,
  IN: 0.0075, IA: 0.015, KS: 0.012, KY: 0.008, LA: 0.005, ME: 0.013, MD: 0.011,
  MA: 0.011, MI: 0.015, MN: 0.011, MS: 0.006, MO: 0.010, MT: 0.008, NE: 0.019,
  NV: 0.006, NH: 0.020, NJ: 0.024, NM: 0.008, NY: 0.017, NC: 0.008, ND: 0.010,
  OH: 0.014, OK: 0.009, OR: 0.010, PA: 0.015, RI: 0.013, SC: 0.006, SD: 0.014,
  TN: 0.006, TX: 0.018, UT: 0.006, VT: 0.017, VA: 0.008, WA: 0.009, WV: 0.006,
  WI: 0.018, WY: 0.006
};

function getPropertyTaxRate(state?: string): number {
  return PROPERTY_TAX_RATES[(state || '').toUpperCase()] ?? 0.011;
}

// Core retirement expense prediction algorithm based on CFP best practices
function estimateRetirementExpensesFromInputs(args: {
  monthlyExpenses: {
    housing?: number; 
    transportation?: number; 
    food?: number; 
    utilities?: number;
    healthcare?: number; 
    entertainment?: number; 
    creditCardPayments?: number;
    studentLoanPayments?: number; 
    otherDebtPayments?: number; 
    clothing?: number; 
    expectedAnnualTaxes?: number;
    other?: number;
  };
  primaryResidence: {
    marketValue?: number; 
    monthlyPayment?: number; 
    yearsToPayOffMortgage?: number;
  };
  yearsUntilRetirement: number;
  maritalStatus: string | undefined;
  state: string | undefined;
  retirementState: string | undefined;
}): {
  total: number;
  essential: number;
  discretionary: number;
  notes: string[];
  housingAtRetirement: number;
  propertyTaxMonthly: number;
  mortgagePayoffSavings: number;
} {
  const e = args.monthlyExpenses || {};
  const pr = args.primaryResidence || {};
  const yearsLeftOnMortgage = pr.yearsToPayOffMortgage ?? 0;
  const mortgageIsGoneAtRetirement = yearsLeftOnMortgage > 0 && yearsLeftOnMortgage <= args.yearsUntilRetirement;

  // Calculate current total monthly expenses (baseline)
  const currentTotal = (e.housing || 0) + (e.transportation || 0) + (e.food || 0) + 
                      (e.utilities || 0) + (e.healthcare || 0) + (e.entertainment || 0) + 
                      (e.creditCardPayments || 0) + (e.studentLoanPayments || 0) + 
                      (e.otherDebtPayments || 0) + (e.clothing || 0) + 
                      ((e.expectedAnnualTaxes || 0) / 12) + (e.other || 0);

  // Housing adjustments - the biggest change in retirement
  const housingNow = e.housing ?? 0;
  const stateForTaxes = (args.retirementState || args.state || '').toUpperCase();
  const propertyTaxMonthly = (getPropertyTaxRate(stateForTaxes) * (pr.marketValue || 0)) / 12;
  
  // Home maintenance and insurance baseline (1% of home value annually)
  const maintenanceInsuranceMonthly = (pr.marketValue || 0) > 0 ? ((pr.marketValue || 0) * 0.01) / 12 : 0;

  let housingAtRetirement: number;
  let mortgagePayoffSavings = 0;

  if ((pr.marketValue || 0) > 0) {
    if (mortgageIsGoneAtRetirement) {
      // Mortgage paid off: remove P&I, keep/add property taxes and maintenance
      mortgagePayoffSavings = pr.monthlyPayment || 0;
      const baseCosts = Math.max(0, housingNow - mortgagePayoffSavings);
      housingAtRetirement = baseCosts + propertyTaxMonthly + maintenanceInsuranceMonthly;
    } else {
      // Still paying mortgage in retirement
      housingAtRetirement = housingNow;
    }
  } else {
    // Renter: assume modest reduction from downsizing/location flexibility
    housingAtRetirement = Math.round(housingNow * 0.85);
  }

  // Transportation: significant reduction due to no commuting
  const transportation = Math.round((e.transportation ?? 0) * 0.75); // 25% reduction

  // Food: modest reduction from eating out less for work
  const food = Math.round((e.food ?? 0) * 0.90);

  // Utilities: small reduction from being home more efficiently
  const utilities = Math.round((e.utilities ?? 0) * 0.95);

  // Healthcare: increase to realistic Medicare + supplement levels
  const currentHealthcare = e.healthcare ?? 0;
  const isMarried = args.maritalStatus === 'married';
  const healthcareFloor = isMarried ? 1200 : 700; // Medicare + Medigap realistic costs
  const healthcare = Math.max(currentHealthcare, healthcareFloor);

  // Debt payments: assume eliminated by retirement (conservative planning)
  const creditCards = 0;
  const studentLoans = 0;
  const otherDebt = 0;

  // Taxes: retirement income typically lower, but depends on tax-deferred withdrawals
  const taxes = Math.round(((e.expectedAnnualTaxes || 0) / 12) * 0.70); // 30% reduction

  // Other: reduce significantly (work-related expenses gone)
  const other = Math.round((e.other ?? 0) * 0.40);

  // Discretionary: keep as-is (user can adjust based on goals)
  const entertainment = e.entertainment ?? 0;
  const clothing = Math.round((e.clothing ?? 0) * 0.60); // Less work clothes needed

  // Calculate essential vs discretionary
  const essential = Math.max(0, housingAtRetirement) + transportation + food + utilities + healthcare + taxes;
  const discretionary = entertainment + clothing + other;
  const total = Math.round(essential + discretionary);

  // Generate explanatory notes
  const notes: string[] = [];
  if (mortgageIsGoneAtRetirement) {
    notes.push(`Mortgage paid off by retirement: saves $${Math.round(pr.monthlyPayment || 0).toLocaleString()}/mo`);
  }
  if ((pr.marketValue || 0) > 0) {
    notes.push(`Property tax: ${(getPropertyTaxRate(stateForTaxes) * 100).toFixed(2)}% of $${Math.round((pr.marketValue || 0) / 1000)}k home value`);
  }
  notes.push('Transportation reduced 25% (no commuting)');
  notes.push(`Healthcare raised to $${healthcareFloor}/mo floor (Medicare + supplements)`);
  notes.push('Debt payments assumed eliminated by retirement');
  if (total < currentTotal) {
    const savings = currentTotal - total;
    notes.push(`Total reduction: $${Math.round(savings).toLocaleString()}/mo from current expenses`);
  }

  return { 
    total, 
    essential, 
    discretionary, 
    notes, 
    housingAtRetirement, 
    propertyTaxMonthly,
    mortgagePayoffSavings
  };
}

interface FormData {
  // Step 1: Personal Information
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  maritalStatus: string;
  dependents: number;
  state?: string;
  spouseName?: string;
  spouseDateOfBirth?: string;
  
  // Step 2: Employment & Income
  employmentStatus: string;
  annualIncome: number;
  taxWithholdingStatus: string; // 'employer' | 'self' | 'none'
  takeHomeIncome?: number; // For employer withholding
  otherIncome: number;
  savingsRate?: number;
  spouseEmploymentStatus?: string;
  spouseAnnualIncome?: number;
  spouseTaxWithholdingStatus?: string;
  spouseTakeHomeIncome?: number;
  
  // Step 3: Assets & Liabilities
  assets: Array<{
    type: string;
    description: string;
    value: number;
    owner: string;
    // Annuity-specific fields
    annuityType?: 'immediate' | 'deferred';
    payoutStartDate?: string;
    payoutAmount?: number;
    payoutFrequency?: 'monthly' | 'quarterly' | 'annually';
    costBasis?: number; // For non-qualified annuities
    exclusionRatio?: number; // For non-qualified annuities
    growthRate?: number; // For deferred annuities
    survivorBenefit?: number; // Percentage for spouse
    guaranteedYears?: number; // Period certain option
  }>;
  liabilities: Array<{
    type: string;
    description: string;
    balance: number;
    monthlyPayment: number;
    interestRate: number;
    owner: string;
  }>;
  
  // Step 4: Real Estate
  primaryResidence: {
    marketValue: number;
    mortgageBalance: number;
    monthlyPayment: number;
    interestRate: number;
    yearsToPayOffMortgage?: number;
    owner: string;
  };
  additionalProperties: Array<{
    type: string;
    marketValue: number;
    mortgageBalance: number;
    monthlyPayment: number;
    rentalIncome: number;
    owner: string;
  }>;
  
  // Step 5: Monthly Expenses
  monthlyExpenses: {
    housing: number;
    transportation: number;
    food: number;
    utilities: number;
    healthcare: number;
    entertainment: number;
    creditCardPayments: number;
    studentLoanPayments: number;
    otherDebtPayments: number;
    clothing: number;
    expectedAnnualTaxes: number;
    other: number;
  };
  // Optional manual override for total monthly expenses
  totalMonthlyExpenses?: number;
  emergencyFundSize: number;
  
  // Step 6: Insurance
  lifeInsurance: {
    hasPolicy: boolean;
    coverageAmount: number;
  };
  autoInsurance: {
    hasPolicy: boolean;
    coverageAmount: number;
  };
  homeownerInsurance: {
    hasPolicy: boolean;
    coverageAmount: number;
  };
  umbrellaInsurance: {
    hasPolicy: boolean;
    coverageAmount: number;
  };
  businessLiabilityInsurance: {
    hasPolicy: boolean;
    coverageAmount: number;
  };
  spouseLifeInsurance?: {
    hasPolicy: boolean;
    coverageAmount: number;
  };
  spouseDisabilityInsurance?: {
    hasDisability: boolean;
    benefitAmount: number;
  };
  healthInsurance: {
    hasHealthInsurance: boolean;
  };
  disabilityInsurance: {
    hasDisability: boolean;
    benefitAmount: number;
  };
  insurance: {
    home: boolean;
    homeDwellingLimit: number;
    auto: boolean;
    autoLiabilityLimits: {
      bodilyInjuryPerPerson: number;
      bodilyInjuryPerAccident: number;
      propertyDamage: number;
    };
    umbrella: boolean;
    umbrellaLimit: number;
    business: boolean;
    businessLiabilityLimits: {
      perOccurrence: number;
      aggregate: number;
    };
  };
  
  // Step 7: Risk Profile
  riskQuestions: Array<number>;
  currentAllocation: {
    usStocks: number;
    intlStocks: number;
    bonds: number;
    alternatives: number;
    cash: number;
  };
  
  // Step 8: Spouse Risk Profile (only if married)
  spouseRiskQuestions?: Array<number>;
  spouseAllocation?: {
    usStocks: number;
    intlStocks: number;
    bonds: number;
    alternatives: number;
    cash: number;
  };
  
  // Step 9: Estate Planning
  hasWill: boolean;
  hasTrust: boolean;
  hasPowerOfAttorney: boolean;
  hasHealthcareProxy: boolean;
  hasBeneficiaries: boolean;
  
  // Step 10: Tax Information
  lastYearAGI: number;
  deductionAmount: number;
  taxFilingStatus: string;
  
  // Step 11: Retirement Planning
  desiredRetirementAge: number;
  spouseDesiredRetirementAge?: number;
  socialSecurityClaimAge: number;
  spouseSocialSecurityClaimAge?: number;
  userHealthStatus?: 'excellent' | 'good' | 'fair' | 'poor';
  spouseHealthStatus?: 'excellent' | 'good' | 'fair' | 'poor';
  userLifeExpectancy: number;
  spouseLifeExpectancy?: number;
  expectedMonthlyExpensesRetirement: number;
  retirementState?: string;
  partTimeIncomeRetirement?: number;
  spousePartTimeIncomeRetirement?: number;
  spousePensionBenefit?: number;
  expectedInflationRate: number;
  
  // IRA Contributions
  traditionalIRAContribution?: number;
  rothIRAContribution?: number;
  spouseTraditionalIRAContribution?: number;
  spouseRothIRAContribution?: number;
  
  // Legacy Retirement Planning (Step 12)
  retirementAge: number;
  retirementIncome: number;
  additionalNotes: string;
  
  // Additional Fields for Retirement Confidence Score Calculation
  lifeExpectancy: number; // User's life expectancy assumption
  retirementExpenseBudget: {
    essential: number; // Essential monthly expenses in retirement
    discretionary: number; // Discretionary monthly expenses in retirement
  };
  socialSecurityBenefit: number; // Expected monthly social security benefit
  spouseSocialSecurityBenefit?: number; // Expected monthly social security benefit for spouse
  pensionBenefit: number; // Expected monthly pension benefit (if any)
  retirementContributions: {
    employee: number; // Monthly employee contribution to retirement accounts
    employer: number; // Monthly employer match/contribution
  };
  spouseRetirementContributions?: {
    employee: number; // Monthly spouse employee contribution to retirement accounts
    employer: number; // Monthly spouse employer match/contribution
  };

  withdrawalRate: number; // Sustainable withdrawal rate (default 4%)
  hasLongTermCareInsurance: boolean;
  legacyGoal: number; // Amount desired to leave as legacy
}

const getDefaultFormData = (): FormData => ({
  // Step 1: Personal Information
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  maritalStatus: "",
  dependents: 0,
  state: "",
  spouseName: "",
  spouseDateOfBirth: "",
  
  // Step 2: Employment & Income
  employmentStatus: "",
  annualIncome: 0,
  taxWithholdingStatus: "employer",
  takeHomeIncome: 0,
  otherIncome: 0,
  spouseEmploymentStatus: "",
  spouseAnnualIncome: 0,
  spouseTaxWithholdingStatus: "employer",
  spouseTakeHomeIncome: 0,
  
  // Step 3: Assets & Liabilities
  assets: [],
  liabilities: [],
  
  // Step 4: Real Estate
  primaryResidence: {
    marketValue: 0,
    mortgageBalance: 0,
    monthlyPayment: 0,
    interestRate: 0,
    yearsToPayOffMortgage: 0,
    owner: "User",
  },
  additionalProperties: [],
  
  // Step 5: Monthly Expenses
  monthlyExpenses: {
    housing: 0,
    transportation: 0,
    food: 0,
    utilities: 0,
    healthcare: 0,
    entertainment: 0,
    creditCardPayments: 0,
    studentLoanPayments: 0,
    otherDebtPayments: 0,
    clothing: 0,
    expectedAnnualTaxes: 0,
    other: 0,
  },
  // Manual override for total monthly expenses (optional)
  totalMonthlyExpenses: 0,
  emergencyFundSize: 0,
  
  // Step 6: Insurance
  lifeInsurance: {
    hasPolicy: false,
    coverageAmount: 0,
  },
  autoInsurance: {
    hasPolicy: false,
    coverageAmount: 0,
  },
  homeownerInsurance: {
    hasPolicy: false,
    coverageAmount: 0,
  },
  umbrellaInsurance: {
    hasPolicy: false,
    coverageAmount: 0,
  },
  businessLiabilityInsurance: {
    hasPolicy: false,
    coverageAmount: 0,
  },
  spouseLifeInsurance: {
    hasPolicy: false,
    coverageAmount: 0,
  },
  spouseDisabilityInsurance: {
    hasDisability: false,
    benefitAmount: 0,
  },
  healthInsurance: {
    hasHealthInsurance: false,
  },
  disabilityInsurance: {
    hasDisability: false,
    benefitAmount: 0,
  },
  insurance: {
    home: false,
    homeDwellingLimit: 0,
    auto: false,
    autoLiabilityLimits: {
      bodilyInjuryPerPerson: 0,
      bodilyInjuryPerAccident: 0,
      propertyDamage: 0,
    },
    umbrella: false,
    umbrellaLimit: 0,
    business: false,
    businessLiabilityLimits: {
      perOccurrence: 0,
      aggregate: 0,
    },
  },
  
  // Step 7: Risk Profile
  riskQuestions: [3], // Single question, defaulting to 3 (Moderate)
  currentAllocation: {
    usStocks: 0,
    intlStocks: 0,
    bonds: 0,
    alternatives: 0,
    cash: 0,
  },
  
  // Step 8: Spouse Risk Profile (only if married)
  spouseRiskQuestions: [3], // Single question, defaulting to 3 (Moderate)
  spouseAllocation: {
    usStocks: 0,
    intlStocks: 0,
    bonds: 0,
    alternatives: 0,
    cash: 0,
  },
  
  // Step 8: Estate Planning
  hasWill: false,
  hasTrust: false,
  hasPowerOfAttorney: false,
  hasHealthcareProxy: false,
  hasBeneficiaries: false,
  
  // Step 10: Tax Information
  lastYearAGI: 0,
  deductionAmount: 0,
  taxFilingStatus: "",
  
  // Step 11: Retirement Planning
  desiredRetirementAge: 65,
  spouseDesiredRetirementAge: 65,
  socialSecurityClaimAge: 65, // Default to retirement age (same as desiredRetirementAge)
  spouseSocialSecurityClaimAge: 65, // Default to retirement age (same as spouseDesiredRetirementAge)
  userHealthStatus: 'good',
  spouseHealthStatus: 'good',
  userLifeExpectancy: 93,
  spouseLifeExpectancy: 93,
  expectedMonthlyExpensesRetirement: 0,
  retirementState: "",
  partTimeIncomeRetirement: 0,
  spousePartTimeIncomeRetirement: 0,
  spousePensionBenefit: 0,
  expectedInflationRate: 2,
  
  // Legacy Retirement Planning (Step 12)
  retirementAge: 65,
  retirementIncome: 0,
  additionalNotes: "",
  
  // Additional Fields for Retirement Confidence Score
  lifeExpectancy: 93,
  retirementExpenseBudget: {
    essential: 0,
    discretionary: 0,
  },
  socialSecurityBenefit: 0,
  spouseSocialSecurityBenefit: 0,
  pensionBenefit: 0,
  retirementContributions: {
    employee: 0,
    employer: 0,
  },
  spouseRetirementContributions: {
    employee: 0,
    employer: 0,
  },

  withdrawalRate: 4, // 4% default SWR
  hasLongTermCareInsurance: false,
  legacyGoal: 0,
});

// Helper function to merge Plaid-imported data with manual entries
function mergeAssets(existingAssets: any[]): any[] {
  if (!Array.isArray(existingAssets)) return [];
  
  // Separate Plaid-imported and manual assets
  const plaidAssets = existingAssets.filter(a => a._source?.isImported);
  const manualAssets = existingAssets.filter(a => !a._source?.isImported);
  
  // Map Plaid asset types to intake form types
  const mappedPlaidAssets = plaidAssets.map(asset => ({
    ...asset,
    // Ensure type matches intake form dropdown values
    type: mapPlaidTypeToIntakeType(asset.type),
    // Normalize owner casing to match Select values
    owner: normalizeOwner(asset.owner),
    // Preserve all other fields including value, description
  }));
  
  // Normalize owners and types for manual assets as well
  const normalizedManualAssets = manualAssets.map(asset => ({
    ...asset,
    type: mapPlaidTypeToIntakeType(asset.type),
    owner: normalizeOwner(asset.owner),
  }));

  // Return combined array with Plaid assets first (most accurate/recent)
  return [...mappedPlaidAssets, ...normalizedManualAssets];
}

function mergeLiabilities(existingLiabilities: any[]): any[] {
  if (!Array.isArray(existingLiabilities)) return [];
  
  // Separate Plaid-imported and manual liabilities
  const plaidLiabilities = existingLiabilities.filter(l => l._source?.isImported);
  const manualLiabilities = existingLiabilities.filter(l => !l._source?.isImported);
  
  // Map Plaid liability types to intake form types  
  const mappedPlaidLiabilities = plaidLiabilities.map(liability => ({
    ...liability,
    // Ensure type matches intake form dropdown values
    type: mapPlaidLiabilityTypeToIntakeType(liability.type),
    // Normalize owner casing to match Select values
    owner: normalizeOwner(liability.owner),
  }));
  
  // Normalize owners and types for manual liabilities as well
  const normalizedManualLiabilities = manualLiabilities.map(liability => ({
    ...liability,
    type: mapPlaidLiabilityTypeToIntakeType(liability.type),
    owner: normalizeOwner(liability.owner),
  }));

  // Return combined array with Plaid liabilities first
  return [...mappedPlaidLiabilities, ...normalizedManualLiabilities];
}

// Normalize owner values to the canonical Select values
function normalizeOwner(owner: any): 'User' | 'Spouse' | 'Joint' | undefined {
  if (!owner) return undefined;
  const val = String(owner).toLowerCase();
  if (val === 'user' || val === 'you') return 'User';
  if (val === 'spouse' || val === 'partner') return 'Spouse';
  if (val === 'joint') return 'Joint';
  // If already correct (e.g., 'User'), return as-is
  if (owner === 'User' || owner === 'Spouse' || owner === 'Joint') return owner;
  return undefined;
}

// Map Plaid asset types to intake form dropdown values
function mapPlaidTypeToIntakeType(plaidType: string): string {
  const typeMap: Record<string, string> = {
    'Checking Account': 'checking',
    'Saving Account': 'savings', 
    'Savings Account': 'savings',
    '401(k)': '401k',
    '403(b)': '403b',
    'Traditional IRA': 'traditional-ira',
    'Roth IRA': 'roth-ira',
    'Taxable Brokerage': 'taxable-brokerage',
    'HSA': 'hsa',
    'Qualified Annuities': 'qualified-annuities',
    'Cash Value Life Insurance': 'cash-value-life-insurance',
    'Vehicle': 'vehicle',
    'Business Interest': 'business',
    'Other': 'other'
  };
  return typeMap[plaidType] || plaidType;
}

// Map Plaid liability types to intake form dropdown values
function mapPlaidLiabilityTypeToIntakeType(plaidType: string): string {
  const typeMap: Record<string, string> = {
    'Credit Card': 'credit-card',
    'Auto Loan': 'auto-loan',
    'Private Student Loan': 'private-student-loan',
    'Other': 'other'
  };
  return typeMap[plaidType] || plaidType;
}

// Convert server data (from database) to form data format
function convertServerDataToFormData(serverData: any): FormData {
  // Start with default form data to ensure all fields are present
  const formData = getDefaultFormData();
  
  // Helper function to safely get nested values
  const getNestedValue = (obj: any, path: string, defaultValue: any = null) => {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }
    return value ?? defaultValue;
  };
  
  // Merge and map assets/liabilities from Plaid imports
  const mergedAssets = mergeAssets(serverData.assets);
  const mergedLiabilities = mergeLiabilities(serverData.liabilities);
  
  // Extract mortgage data from primaryResidence if it has Plaid import
  let primaryResidence = serverData.primaryResidence || formData.primaryResidence;
  if (primaryResidence?._source?.isImported && primaryResidence.mortgageBalance) {
    // Ensure mortgage balance from Plaid is populated
    primaryResidence = {
      ...primaryResidence,
      mortgageBalance: primaryResidence.mortgageBalance || 0,
      // Keep other fields that user may need to fill manually
      monthlyPayment: primaryResidence.monthlyPayment || 0,
      interestRate: primaryResidence.interestRate || 0,
      yearsToPayOffMortgage: primaryResidence.yearsToPayOffMortgage || 0,
      // Preserve owner field from Plaid import (User, Spouse, or Joint)
      owner: normalizeOwner(primaryResidence.owner) || formData.primaryResidence.owner
    };
  }
  
  // Map server data to form data, handling any differences in structure
  return {
    ...formData,
    // Step 1: Personal Information
    firstName: serverData.firstName || formData.firstName,
    lastName: serverData.lastName || formData.lastName,
    dateOfBirth: serverData.dateOfBirth || formData.dateOfBirth,
    maritalStatus: serverData.maritalStatus || formData.maritalStatus,
    dependents: serverData.dependents || formData.dependents,
    state: serverData.state || formData.state,
    spouseName: serverData.spouseName || formData.spouseName,
    // Handle spouseName splitting for legacy compatibility
    spouseFirstName: (() => {
      if (serverData.spouseFirstName) return serverData.spouseFirstName;
      if (serverData.spouseName) {
        const nameParts = serverData.spouseName.split(' ');
        return nameParts[0] || '';
      }
      return formData.spouseFirstName;
    })(),
    spouseLastName: (() => {
      if (serverData.spouseLastName) return serverData.spouseLastName;
      if (serverData.spouseName) {
        const nameParts = serverData.spouseName.split(' ');
        return nameParts.slice(1).join(' ') || '';
      }
      return formData.spouseLastName;
    })(),
    spouseDateOfBirth: serverData.spouseDateOfBirth || formData.spouseDateOfBirth,
    
    // Step 2: Employment & Income
    employmentStatus: serverData.employmentStatus || formData.employmentStatus,
    annualIncome: serverData.annualIncome || formData.annualIncome,
    taxWithholdingStatus: serverData.taxWithholdingStatus || formData.taxWithholdingStatus,
    takeHomeIncome: serverData.takeHomeIncome || formData.takeHomeIncome,
    otherIncome: serverData.otherIncome || formData.otherIncome,
    spouseEmploymentStatus: serverData.spouseEmploymentStatus || formData.spouseEmploymentStatus,
    spouseAnnualIncome: serverData.spouseAnnualIncome || formData.spouseAnnualIncome,
    spouseTaxWithholdingStatus: serverData.spouseTaxWithholdingStatus || formData.spouseTaxWithholdingStatus,
    spouseTakeHomeIncome: serverData.spouseTakeHomeIncome || formData.spouseTakeHomeIncome,
    
    // Step 3: Savings
    savingsRate: serverData.savingsRate || formData.savingsRate,
    
    // Step 4: Assets & Liabilities - Use merged data with Plaid imports
    assets: mergedAssets.length > 0 ? mergedAssets : formData.assets,
    liabilities: mergedLiabilities.length > 0 ? mergedLiabilities : formData.liabilities,
    primaryResidence: {
      ...primaryResidence,
      owner: normalizeOwner(primaryResidence?.owner) || formData.primaryResidence.owner,
    },
    additionalProperties: Array.isArray(serverData.additionalProperties)
      ? serverData.additionalProperties.map((p: any) => ({
          ...p,
          owner: normalizeOwner(p?.owner) || formData.primaryResidence.owner,
        }))
      : formData.additionalProperties,
    
    // Step 5: Expenses - Deep merge for nested object
    monthlyExpenses: {
      ...formData.monthlyExpenses,
      ...(serverData.monthlyExpenses || {}),
      housing: getNestedValue(serverData, 'monthlyExpenses.housing', formData.monthlyExpenses.housing),
      transportation: getNestedValue(serverData, 'monthlyExpenses.transportation', formData.monthlyExpenses.transportation),
      food: getNestedValue(serverData, 'monthlyExpenses.food', formData.monthlyExpenses.food),
      utilities: getNestedValue(serverData, 'monthlyExpenses.utilities', formData.monthlyExpenses.utilities),
      healthcare: getNestedValue(serverData, 'monthlyExpenses.healthcare', formData.monthlyExpenses.healthcare),
      entertainment: getNestedValue(serverData, 'monthlyExpenses.entertainment', formData.monthlyExpenses.entertainment),
      creditCardPayments: getNestedValue(serverData, 'monthlyExpenses.creditCardPayments', formData.monthlyExpenses.creditCardPayments),
      studentLoanPayments: getNestedValue(serverData, 'monthlyExpenses.studentLoanPayments', formData.monthlyExpenses.studentLoanPayments),
      otherDebtPayments: getNestedValue(serverData, 'monthlyExpenses.otherDebtPayments', formData.monthlyExpenses.otherDebtPayments),
      clothing: getNestedValue(serverData, 'monthlyExpenses.clothing', formData.monthlyExpenses.clothing),
      expectedAnnualTaxes: getNestedValue(serverData, 'monthlyExpenses.expectedAnnualTaxes', formData.monthlyExpenses.expectedAnnualTaxes),
      other: getNestedValue(serverData, 'monthlyExpenses.other', formData.monthlyExpenses.other)
    },
    emergencyFundSize: serverData.emergencyFundSize || formData.emergencyFundSize,
    
    // Step 6: Insurance - Deep merge for nested objects
    lifeInsurance: {
      ...formData.lifeInsurance,
      ...(serverData.lifeInsurance || {}),
      hasPolicy: getNestedValue(serverData, 'lifeInsurance.hasPolicy', formData.lifeInsurance.hasPolicy),
      coverage: getNestedValue(serverData, 'lifeInsurance.coverage', formData.lifeInsurance.coverage),
      monthlyPremium: getNestedValue(serverData, 'lifeInsurance.monthlyPremium', formData.lifeInsurance.monthlyPremium)
    },
    spouseLifeInsurance: {
      ...formData.spouseLifeInsurance,
      ...(serverData.spouseLifeInsurance || {}),
      hasPolicy: getNestedValue(serverData, 'spouseLifeInsurance.hasPolicy', formData.spouseLifeInsurance.hasPolicy),
      coverage: getNestedValue(serverData, 'spouseLifeInsurance.coverage', formData.spouseLifeInsurance.coverage),
      monthlyPremium: getNestedValue(serverData, 'spouseLifeInsurance.monthlyPremium', formData.spouseLifeInsurance.monthlyPremium)
    },
    healthInsurance: {
      ...formData.healthInsurance,
      ...(serverData.healthInsurance || {}),
      hasHealthInsurance: getNestedValue(serverData, 'healthInsurance.hasHealthInsurance', formData.healthInsurance.hasHealthInsurance),
      monthlyPremium: getNestedValue(serverData, 'healthInsurance.monthlyPremium', formData.healthInsurance.monthlyPremium),
      deductible: getNestedValue(serverData, 'healthInsurance.deductible', formData.healthInsurance.deductible)
    },
    disabilityInsurance: {
      ...formData.disabilityInsurance,
      ...(serverData.disabilityInsurance || {}),
      hasDisability: getNestedValue(serverData, 'disabilityInsurance.hasDisability', formData.disabilityInsurance.hasDisability),
      monthlyBenefit: getNestedValue(serverData, 'disabilityInsurance.monthlyBenefit', formData.disabilityInsurance.monthlyBenefit),
      monthlyPremium: getNestedValue(serverData, 'disabilityInsurance.monthlyPremium', formData.disabilityInsurance.monthlyPremium)
    },
    spouseDisabilityInsurance: {
      ...formData.spouseDisabilityInsurance,
      ...(serverData.spouseDisabilityInsurance || {}),
      hasDisability: getNestedValue(serverData, 'spouseDisabilityInsurance.hasDisability', formData.spouseDisabilityInsurance.hasDisability),
      monthlyBenefit: getNestedValue(serverData, 'spouseDisabilityInsurance.monthlyBenefit', formData.spouseDisabilityInsurance.monthlyBenefit),
      monthlyPremium: getNestedValue(serverData, 'spouseDisabilityInsurance.monthlyPremium', formData.spouseDisabilityInsurance.monthlyPremium)
    },
    autoInsurance: serverData.autoInsurance || formData.autoInsurance,
    homeownerInsurance: serverData.homeownerInsurance || formData.homeownerInsurance,
    umbrellaInsurance: serverData.umbrellaInsurance || formData.umbrellaInsurance,
    businessLiabilityInsurance: serverData.businessLiabilityInsurance || formData.businessLiabilityInsurance,
    insurance: {
      ...formData.insurance,
      ...(serverData.insurance || {}),
      home: getNestedValue(serverData, 'insurance.home', formData.insurance.home),
      auto: getNestedValue(serverData, 'insurance.auto', formData.insurance.auto),
      umbrella: getNestedValue(serverData, 'insurance.umbrella', formData.insurance.umbrella),
      business: getNestedValue(serverData, 'insurance.business', formData.insurance.business)
    },
    
    // Step 7: Risk Profile
    riskQuestions: Array.isArray(serverData.riskQuestions) ? serverData.riskQuestions : formData.riskQuestions,
    currentAllocation: serverData.currentAllocation || formData.currentAllocation,
    
    // Step 8: Spouse Risk Profile
    spouseRiskQuestions: Array.isArray(serverData.spouseRiskQuestions) ? serverData.spouseRiskQuestions : formData.spouseRiskQuestions,
    spouseAllocation: serverData.spouseAllocation || formData.spouseAllocation,
    
    // Step 9: Estate Planning
    hasWill: serverData.hasWill !== undefined ? serverData.hasWill : formData.hasWill,
    hasTrust: serverData.hasTrust !== undefined ? serverData.hasTrust : formData.hasTrust,
    hasPowerOfAttorney: serverData.hasPowerOfAttorney !== undefined ? serverData.hasPowerOfAttorney : formData.hasPowerOfAttorney,
    hasHealthcareProxy: serverData.hasHealthcareProxy !== undefined ? serverData.hasHealthcareProxy : formData.hasHealthcareProxy,
    hasBeneficiaries: serverData.hasBeneficiaries !== undefined ? serverData.hasBeneficiaries : formData.hasBeneficiaries,
    
    // Step 11: Retirement Planning
    retirementAge: serverData.retirementAge || formData.retirementAge,
    retirementIncome: serverData.retirementIncome || formData.retirementIncome,
    additionalNotes: serverData.additionalNotes || formData.additionalNotes,
    lifeExpectancy: serverData.lifeExpectancy || formData.lifeExpectancy,
    retirementExpenseBudget: serverData.retirementExpenseBudget || formData.retirementExpenseBudget,
    socialSecurityBenefit: serverData.socialSecurityBenefit || formData.socialSecurityBenefit,
    spouseSocialSecurityBenefit: serverData.spouseSocialSecurityBenefit || formData.spouseSocialSecurityBenefit,
    pensionBenefit: serverData.pensionBenefit || formData.pensionBenefit,
    retirementContributions: serverData.retirementContributions || formData.retirementContributions,
    spouseRetirementContributions: serverData.spouseRetirementContributions || formData.spouseRetirementContributions,
    expectedRealReturn: serverData.expectedRealReturn || formData.expectedRealReturn,
    investmentStrategy: serverData.investmentStrategy || formData.investmentStrategy,
    withdrawalRate: serverData.withdrawalRate || formData.withdrawalRate,
    hasLongTermCareInsurance: serverData.hasLongTermCareInsurance !== undefined ? serverData.hasLongTermCareInsurance : formData.hasLongTermCareInsurance,
    legacyGoal: serverData.legacyGoal || formData.legacyGoal,
    desiredRetirementAge: serverData.desiredRetirementAge || formData.desiredRetirementAge,
    spouseDesiredRetirementAge: serverData.spouseDesiredRetirementAge || formData.spouseDesiredRetirementAge,
    socialSecurityClaimAge: serverData.socialSecurityClaimAge || serverData.desiredRetirementAge || formData.socialSecurityClaimAge,
    spouseSocialSecurityClaimAge: serverData.spouseSocialSecurityClaimAge || serverData.spouseDesiredRetirementAge || formData.spouseSocialSecurityClaimAge,
    userHealthStatus: serverData.userHealthStatus || formData.userHealthStatus,
    spouseHealthStatus: serverData.spouseHealthStatus || formData.spouseHealthStatus,
    userLifeExpectancy: serverData.userLifeExpectancy || formData.userLifeExpectancy,
    spouseLifeExpectancy: serverData.spouseLifeExpectancy || formData.spouseLifeExpectancy,
    expectedMonthlyExpensesRetirement: serverData.expectedMonthlyExpensesRetirement || formData.expectedMonthlyExpensesRetirement,
    
    // Tax Information
    lastYearAGI: serverData.lastYearAGI || formData.lastYearAGI,
    deductionAmount: serverData.deductionAmount || formData.deductionAmount,
    taxFilingStatus: serverData.taxFilingStatus || formData.taxFilingStatus,
    
    // Additional retirement fields
    retirementState: serverData.retirementState || formData.retirementState,
    partTimeIncomeRetirement: serverData.partTimeIncomeRetirement || formData.partTimeIncomeRetirement,
    spousePartTimeIncomeRetirement: serverData.spousePartTimeIncomeRetirement || formData.spousePartTimeIncomeRetirement,
    spousePensionBenefit: serverData.spousePensionBenefit || formData.spousePensionBenefit,
    expectedInflationRate: serverData.expectedInflationRate || formData.expectedInflationRate,
    
    // IRA Contributions
    traditionalIRAContribution: serverData.traditionalIRAContribution || formData.traditionalIRAContribution,
    rothIRAContribution: serverData.rothIRAContribution || formData.rothIRAContribution,
    spouseTraditionalIRAContribution: serverData.spouseTraditionalIRAContribution || formData.spouseTraditionalIRAContribution,
    spouseRothIRAContribution: serverData.spouseRothIRAContribution || formData.spouseRothIRAContribution,
  };
}

// Helper function to transform form data for database submission
function transformDataForSubmission(data: FormData) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    maritalStatus: data.maritalStatus,
    dependents: data.dependents,
    state: data.state,
    retirementState: data.retirementState || data.state,
    employmentStatus: data.employmentStatus,
    annualIncome: data.annualIncome,
    taxWithholdingStatus: data.taxWithholdingStatus,
    takeHomeIncome: data.takeHomeIncome,
    otherIncome: data.otherIncome || 0,
    spouseName: data.spouseName || `${data.spouseFirstName || ''} ${data.spouseLastName || ''}`.trim(),
    spouseDateOfBirth: data.spouseDateOfBirth,
    spouseEmploymentStatus: data.spouseEmploymentStatus,
    spouseAnnualIncome: data.spouseAnnualIncome,
    spouseTaxWithholdingStatus: data.spouseTaxWithholdingStatus,
    spouseTakeHomeIncome: data.spouseTakeHomeIncome,
    savingsRate: data.savingsRate,
    assets: data.assets,
    liabilities: data.liabilities,
    primaryResidence: data.primaryResidence,
    additionalProperties: data.additionalProperties,
    monthlyExpenses: data.monthlyExpenses,
    emergencyFundSize: data.emergencyFundSize,
    lifeInsurance: data.lifeInsurance,
    spouseLifeInsurance: data.spouseLifeInsurance,
    healthInsurance: data.healthInsurance,
    disabilityInsurance: data.disabilityInsurance,
    spouseDisabilityInsurance: data.spouseDisabilityInsurance,
    insurance: data.insurance,
    hasWill: data.hasWill,
    hasTrust: data.hasTrust,
    hasPowerOfAttorney: data.hasPowerOfAttorney,
    hasHealthcareProxy: data.hasHealthcareProxy,
    hasBeneficiaries: data.hasBeneficiaries,
    riskProfile: {
      questions: data.riskQuestions || [3],
      allocation: data.allocation
    },
    spouseRiskProfile: data.maritalStatus === "married" ? {
      questions: data.spouseRiskQuestions || [3],
      allocation: data.spouseAllocation
    } : undefined,
    // Tax information
    lastYearAGI: data.lastYearAGI || 0,
    deductionAmount: data.deductionAmount || 0,
    taxFilingStatus: data.taxFilingStatus || "single",
    taxReturns: {
      lastYearAGI: data.lastYearAGI || 0,
      deductionAmount: data.deductionAmount || 0,
      taxFilingStatus: data.taxFilingStatus || "single"
    },
    // Retirement Planning
    desiredRetirementAge: data.desiredRetirementAge || 65,
    spouseDesiredRetirementAge: data.spouseDesiredRetirementAge || 65,
    socialSecurityClaimAge: data.socialSecurityClaimAge || data.desiredRetirementAge || 65,
    spouseSocialSecurityClaimAge: data.spouseSocialSecurityClaimAge || data.spouseDesiredRetirementAge || 65,
    userHealthStatus: data.userHealthStatus || 'good',
    spouseHealthStatus: data.spouseHealthStatus || 'good',
    userLifeExpectancy: data.userLifeExpectancy || 93,
    spouseLifeExpectancy: data.spouseLifeExpectancy || 93,
    expectedMonthlyExpensesRetirement: data.expectedMonthlyExpensesRetirement || 0,
    retirementAge: data.retirementAge || 65,
    retirementIncome: data.retirementIncome || 0,
    additionalNotes: data.additionalNotes || "",
    lifeGoals: {
      retirementAge: data.retirementAge || 65,
      retirementIncome: data.retirementIncome || 0,
      additionalNotes: data.additionalNotes || ""
    },
    lifeExpectancy: data.lifeExpectancy || 90,
    retirementExpenseBudget: data.retirementExpenseBudget || { essential: 0, discretionary: 0 },
    socialSecurityBenefit: data.socialSecurityBenefit || 0,
    spouseSocialSecurityBenefit: data.spouseSocialSecurityBenefit || 0,
    pensionBenefit: data.pensionBenefit || 0,
    spousePensionBenefit: data.spousePensionBenefit || 0,
    retirementContributions: data.retirementContributions || { employee: 0, employer: 0 },
    spouseRetirementContributions: data.spouseRetirementContributions || { employee: 0, employer: 0 },
    expectedRealReturn: -3, // Special marker: use risk profile-based returns
    investmentStrategy: "risk-based",
    withdrawalRate: data.withdrawalRate || 4,
    hasLongTermCareInsurance: Boolean(data.hasLongTermCareInsurance),
    legacyGoal: data.legacyGoal || 0,
    partTimeIncomeRetirement: data.partTimeIncomeRetirement || 0,
    spousePartTimeIncomeRetirement: data.spousePartTimeIncomeRetirement || 0,
    traditionalIRAContribution: data.traditionalIRAContribution || 0,
    rothIRAContribution: data.rothIRAContribution || 0,
    spouseTraditionalIRAContribution: data.spouseTraditionalIRAContribution || 0,
    spouseRothIRAContribution: data.spouseRothIRAContribution || 0,
    expectedInflationRate: data.expectedInflationRate || 2,
    riskQuestions: data.riskQuestions || [3],
    currentAllocation: data.currentAllocation || { usStocks: 0, intlStocks: 0, bonds: 0, alternatives: 0, cash: 0 },
    spouseRiskQuestions: data.spouseRiskQuestions || [3],
    spouseAllocation: data.spouseAllocation || { usStocks: 0, intlStocks: 0, bonds: 0, alternatives: 0, cash: 0 }
  };
}

function IntakeFormContent({ onSubmissionStart }: { onSubmissionStart?: () => void }) {
  const { user, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [saveElapsedTime, setSaveElapsedTime] = useState(0);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [lastCompletedStep, setLastCompletedStep] = useState(0);
  const [editMode, setEditMode] = useState<'initial' | 'edit'>('initial');
  const [viewMode, setViewMode] = useState<'step' | 'overview'>('step');
  const [sessionStartTime] = useState(Date.now());
  const [sessionTime, setSessionTime] = useState(0);
  const [momentum, setMomentum] = useState(0);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitTimer, setSubmitTimer] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'asset' | 'liability' | 'property'; index: number; name?: string } | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  
  // State for expense categorization in Step 5
  const [isCategorizingExpenses, setIsCategorizingExpenses] = useState(false);
  const [categorizedData, setCategorizedData] = useState<any>(null);
  const [hasPlaidAccounts, setHasPlaidAccounts] = useState(false);
  
  // State for investment allocation import
  const [isLoadingAllocation, setIsLoadingAllocation] = useState(false);
  const [isLoadingSpouseAllocation, setIsLoadingSpouseAllocation] = useState(false);
  const totalSteps = 11; // Step 11 is the final step (Comprehensive Retirement Planning)
  const { toast } = useToast();
  const { trackAction } = useGamification();

  // Initialize form with defaultValues that may come from localStorage/sessionStorage
  const storedFormData = useMemo(() => {
    try {
      const sessionData = sessionStorage.getItem('intake-form-draft');
      if (sessionData) {
        const { data, timestamp } = JSON.parse(sessionData);
        // Use session data if less than 24 hours old
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          return data;
        }
      }
    } catch (e) {
      console.error('Failed to load draft data:', e);
    }
    return getDefaultFormData();
  }, []);

  const methods = useForm<FormData>({
    defaultValues: storedFormData,
  });

  const { control, handleSubmit, reset, watch, setValue, register, trigger, formState: { errors, dirtyFields, isDirty } } = methods;
  
  const watchedMaritalStatus = watch("maritalStatus");
  const watchedAssets = watch("assets");
  const watchedLiabilities = watch("liabilities");
  const watchedAdditionalProperties = watch("additionalProperties");
  const watchedHasWill = watch("hasWill");
  const watchedHasTrust = watch("hasTrust");
  const watchedHasPowerOfAttorney = watch("hasPowerOfAttorney");
  const watchedHasHealthcareProxy = watch("hasHealthcareProxy");
  const watchedLifeInsurance = watch("lifeInsurance.hasPolicy");
  const watchedSpouseLifeInsurance = watch("spouseLifeInsurance.hasPolicy");
  const watchedHealthInsurance = watch("healthInsurance.hasHealthInsurance");
  const watchedDisabilityInsurance = watch("disabilityInsurance.hasDisability");
  const watchedSpouseDisabilityInsurance = watch("spouseDisabilityInsurance.hasDisability");
  const watchedHomeInsurance = watch("insurance.home");
  const watchedAutoInsurance = watch("insurance.auto");
  const watchedUmbrellaInsurance = watch("insurance.umbrella");
  const watchedBusinessInsurance = watch("insurance.business");
  const watchedTaxWithholdingStatus = watch("taxWithholdingStatus");
  const watchedSpouseTaxWithholdingStatus = watch("spouseTaxWithholdingStatus");
  
  // Retirement contribution validations
  const userRetirementValidation = useRetirementContributionValidation({
    birthDate: watch("dateOfBirth"),
    monthlyEmployeeContribution: watch("retirementContributions.employee") || 0,
    monthlyEmployerContribution: watch("retirementContributions.employer") || 0,
    assets: watch("assets")
  });
  
  const spouseRetirementValidation = useRetirementContributionValidation({
    birthDate: watch("spouseDateOfBirth"),
    monthlyEmployeeContribution: watch("spouseRetirementContributions.employee") || 0,
    monthlyEmployerContribution: watch("spouseRetirementContributions.employer") || 0,
    assets: watch("assets")?.filter(asset => asset.owner === 'spouse')
  });

  const queryClient = useQueryClient();

  // Auto-save functionality
  const saveFormDataToDatabase = async (data: FormData) => {
    try {
      setIsAutoSaving(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Add flags for partial save to skip calculations
      const saveData = {
        ...data,
        isPartialSave: true,
        skipCalculations: true,
        currentStep: currentStep
      };

      const doSave = () => fetch('/api/financial-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(saveData),
        signal: controller.signal
      });

      let response = await doSave();
      if (!response.ok) {
        // brief single retry
        await new Promise(r => setTimeout(r, 750));
        response = await doSave();
      }

      clearTimeout(timeoutId);

      if (response.ok) {
        setLastSaveTime(new Date());
        console.log('Auto-save successful at step', currentStep);
        return true;
      }
      return false;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Save request timed out, data preserved in session');
      } else {
        console.error('Auto-save error:', error);
      }
      return false;
    } finally {
      setIsAutoSaving(false);
    }
  };

  // Debounced auto-save hook
  const { debouncedSave } = useDebouncedSave({
    onSave: saveFormDataToDatabase,
    delay: 3000, // Auto-save after 3 seconds of inactivity
    enabled: !isSubmitting && !isLoading
  });

  // Session persistence hook
  const { clearStorage: clearSessionStorage } = useFormPersistence({
    formKey: 'intake-form-draft',
    watch,
    reset,
    setValue,
    storageType: 'sessionStorage',
    debounceMs: 1000,
    excludeFields: ['password'] // Exclude sensitive fields if any
  });

  // Watch for form changes and trigger auto-save
  // DB fetch helper so we can call it from multiple effects
  const fetchFinancialProfile = async () => {
    try {
      const response = await fetch('/api/financial-profile', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched financial profile:', data);
        
        if (data && Object.keys(data).length > 0) {
          // Convert server data to form data format
          const convertedData = convertServerDataToFormData(data);

          // Merge from session draft if DB arrays empty; never drop user input
          let mergedFromDraft = false;
          let draft: any = null;
          try { draft = JSON.parse(sessionStorage.getItem('intake-form-draft') || 'null'); } catch {}
          const draftData = draft?.data;
          if (draftData) {
            if ((!Array.isArray(convertedData.assets) || convertedData.assets.length === 0) &&
                Array.isArray(draftData.assets) && draftData.assets.length > 0) {
              (convertedData as any).assets = draftData.assets;
              mergedFromDraft = true;
            }
            if ((!Array.isArray(convertedData.liabilities) || convertedData.liabilities.length === 0) &&
                Array.isArray(draftData.liabilities) && draftData.liabilities.length > 0) {
              (convertedData as any).liabilities = draftData.liabilities;
              mergedFromDraft = true;
            }
          }

          setFormData(convertedData);
          // Reset entire form with fetched/merged data
          reset(convertedData);
          // Clear draft only if not relied upon
          if (!mergedFromDraft) {
            try {
              sessionStorage.removeItem('intake-form-draft');
              localStorage.removeItem('intake-form-data');
            } catch {}
          }
          
          setEditMode('edit'); // Set to edit mode since user has existing data
        }
      } else if (response.status === 401) {
        console.log('Profile fetch 401 (unauthenticated) — will refetch after login');
      }
    } catch (error) {
      console.error('Error fetching financial profile:', error);
    } finally {
      setLoadingSeconds(0);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isDirty || isLoading || isSubmitting) return;

    const subscription = watch((data) => {
      // Auto-save to database
      debouncedSave(data);
    });

    return () => subscription.unsubscribe();
  }, [watch, debouncedSave, isDirty, isLoading, isSubmitting]);

  // Retirement state auto-selection
  const hasSetRetirementState = useRef(false);

  useEffect(() => {
    if (currentStep === 11 && !hasSetRetirementState.current) {
      const retirementState = methods.getValues("retirementState");
      const state = methods.getValues("state");
      if (!retirementState && state) {
        methods.setValue("retirementState", state, { shouldDirty: true });
        hasSetRetirementState.current = true;
      }
    } else if (currentStep !== 11) {
      hasSetRetirementState.current = false;
    }
  }, [currentStep, methods]);

  useEffect(() => {
    // Timer to track loading seconds
    let secondsTimer: NodeJS.Timeout;
    if (isLoading) {
      secondsTimer = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    }
    
    // Fallback to ensure loading state is cleared after maximum time
    const fallbackTimer = setTimeout(() => {
      console.log('Fallback: clearing loading state after timeout');
      setIsLoading(false);
    }, 5000); // 5 second fallback

    // Initial fetch
    fetchFinancialProfile();
    
    // Cleanup function
    return () => {
      clearTimeout(fallbackTimer);
      if (secondsTimer) clearInterval(secondsTimer);
    };
  }, []); // Only run once on component mount

  // Refetch once the user logs in (handles case where component mounted unauthenticated)
  useEffect(() => {
    if (!authLoading && user && !isLoading) {
      fetchFinancialProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // Social Security calculation useEffect to prevent infinite re-renders
  useEffect(() => {
    const userIncome = watch("annualIncome") || 0;
    const userDOB = watch("dateOfBirth");
    const userLifeExpectancy = watch("userLifeExpectancy") || 93;
    const userSelectedSSAge = watch("socialSecurityClaimAge") || watch("desiredRetirementAge") || 65;
    const spouseIncome = watch("spouseAnnualIncome") || 0;
    const spouseDOB = watch("spouseDateOfBirth");
    const spouseLifeExpectancy = watch("spouseLifeExpectancy") || 93;
    const spouseSelectedSSAge = watch("spouseSocialSecurityClaimAge") || watch("spouseDesiredRetirementAge") || 65;
    const maritalStatus = watch("maritalStatus");

    // Only calculate if we have minimum required data
    if (userIncome > 0 && userDOB) {
      const userAge = new Date().getFullYear() - new Date(userDOB).getFullYear();
      
      // Calculate optimal Social Security claiming age for user
      const userAIME = calculateAIME(userIncome, userAge, 67);
      const userPIA = calculatePrimaryInsuranceAmount(userAIME);
      const userSSAnalysis = calculateOptimalSocialSecurityAge(
        userAge,
        67, // Full retirement age for most people
        userPIA,
        userLifeExpectancy,
        0.03 // 3% discount rate
      );

      // Calculate benefits at user-selected ages
      const userBenefitAtSelectedAge = calculateBenefitAtAge(userSelectedSSAge, 67, userPIA);
      
      // Save user Social Security benefit to form
      setValue("socialSecurityBenefit", userBenefitAtSelectedAge, { shouldDirty: true });

      // Calculate spouse Social Security if married and spouse data available
      if (maritalStatus === "married" && spouseIncome > 0 && spouseDOB) {
        const spouseAge = new Date().getFullYear() - new Date(spouseDOB).getFullYear();
        
        const spouseAIME = calculateAIME(spouseIncome, spouseAge, 67);
        const spousePIA = calculatePrimaryInsuranceAmount(spouseAIME);
        const spouseSSAnalysis = calculateOptimalSocialSecurityAge(
          spouseAge,
          67,
          spousePIA,
          spouseLifeExpectancy,
          0.03
        );

        // Calculate spouse benefit at selected age
        const spouseBenefitAtSelectedAge = calculateBenefitAtAge(spouseSelectedSSAge, 67, spousePIA);
        
        // Save spouse Social Security benefit to form
        setValue("spouseSocialSecurityBenefit", spouseBenefitAtSelectedAge, { shouldDirty: true });
      } else {
        // Clear spouse benefit if not married or no spouse data
        setValue("spouseSocialSecurityBenefit", 0, { shouldDirty: true });
      }
    }
  }, [
    watch("annualIncome"),
    watch("dateOfBirth"),
    watch("userLifeExpectancy"),
    watch("socialSecurityClaimAge"),
    watch("spouseAnnualIncome"),
    watch("spouseDateOfBirth"),
    watch("spouseLifeExpectancy"),
    watch("spouseSocialSecurityClaimAge"),
    watch("maritalStatus"),
    setValue
  ]);

  // Auto-prefill AGI field in step 10 based on annual incomes from step 2
  useEffect(() => {
    // Only prefill if we're on step 10 and AGI is not already set
    if (currentStep === 10) {
      const currentAGI = watch("lastYearAGI");
      const annualIncome = watch("annualIncome") || 0;
      const spouseAnnualIncome = watch("spouseAnnualIncome") || 0;
      const maritalStatus = watch("maritalStatus");
      
      // Calculate household AGI
      let calculatedAGI = annualIncome;
      if (maritalStatus === "married" && spouseAnnualIncome > 0) {
        calculatedAGI += spouseAnnualIncome;
      }
      
      // Only set if AGI is currently 0 or undefined (not manually entered)
      if (!currentAGI && calculatedAGI > 0) {
        setValue("lastYearAGI", calculatedAGI, { shouldDirty: false });
      }
    }
  }, [currentStep, watch("annualIncome"), watch("spouseAnnualIncome"), watch("maritalStatus"), setValue]);

  // Auto-populate mortgage from Plaid when reaching Step 4
  useEffect(() => {
    const autoPopulateMortgage = async () => {
      // Only auto-populate if we're on Step 4 and haven't imported yet
      if (currentStep === 4) {
        const currentMortgageBalance = watch("primaryResidence.mortgageBalance") || 0;
        const source = watch("primaryResidence._source");
        
        // Only auto-populate if no mortgage is set yet and not already imported
        if (currentMortgageBalance === 0 && !source?.isImported) {
          try {
            const response = await fetch('/api/plaid/accounts');
            if (response.ok) {
              const data = await response.json();
              
              // Flatten accounts from all institutions
              let allAccounts: any[] = [];
              if (data.accounts && Array.isArray(data.accounts)) {
                data.accounts.forEach((institution: any) => {
                  if (institution.accounts && Array.isArray(institution.accounts)) {
                    institution.accounts.forEach((account: any) => {
                      allAccounts.push({
                        ...account,
                        institutionName: institution.institutionName
                      });
                    });
                  }
                });
              }
              
              // Find mortgage account
              const mortgageAccount = allAccounts.find((account: any) => 
                account.type === 'loan' && account.subtype === 'mortgage'
              );
              
              if (mortgageAccount) {
                const mortgageBalance = Math.abs(mortgageAccount.currentBalance || 0);
                console.log('Auto-populating mortgage from Plaid:', mortgageBalance);
                
                setValue('primaryResidence.mortgageBalance', mortgageBalance, { shouldDirty: true });
                setValue('primaryResidence._source', {
                  isImported: true,
                  institutionName: mortgageAccount.institutionName || 'Bank',
                  accountId: mortgageAccount.accountId,
                  accountName: mortgageAccount.name || mortgageAccount.officialName,
                  lastUpdated: new Date().toISOString(),
                  autoPopulated: true
                }, { shouldDirty: true });
                
                toast({
                  title: "Mortgage Auto-Imported",
                  description: `Mortgage balance of $${mortgageBalance.toLocaleString()} automatically imported from ${mortgageAccount.institutionName || 'your bank'}`,
                });
              }
            }
          } catch (error) {
            console.log('Auto-populate mortgage skipped:', error);
            // Silently fail - user can still manually import
          }
        }
      }
    };
    
    autoPopulateMortgage();
  }, [currentStep]); // Re-run when step changes

  // Auto-set Social Security claim age to retirement age when retirement age changes
  useEffect(() => {
    const desiredRetirementAge = watch("desiredRetirementAge");
    const spouseDesiredRetirementAge = watch("spouseDesiredRetirementAge");
    const currentSSClaimAge = watch("socialSecurityClaimAge");
    const currentSpouseSSClaimAge = watch("spouseSocialSecurityClaimAge");
    
    // Set Social Security claim age to retirement age if not already set
    // or if it's still at the old default of 67
    if (desiredRetirementAge) {
      // If SS claim age is not set or is the old default (67), update it to retirement age
      if (!currentSSClaimAge || (currentSSClaimAge === 67 && desiredRetirementAge !== 67)) {
        setValue("socialSecurityClaimAge", desiredRetirementAge);
      }
    }
    
    if (spouseDesiredRetirementAge && watch("maritalStatus") === "married") {
      // If spouse SS claim age is not set or is the old default (67), update it to retirement age
      if (!currentSpouseSSClaimAge || (currentSpouseSSClaimAge === 67 && spouseDesiredRetirementAge !== 67)) {
        setValue("spouseSocialSecurityClaimAge", spouseDesiredRetirementAge);
      }
    }
  }, [
    watch("desiredRetirementAge"),
    watch("spouseDesiredRetirementAge"),
    watch("maritalStatus"),
    setValue
  ]);

  // Health status effect to automatically adjust life expectancy
  useEffect(() => {
    const userHealthStatus = watch("userHealthStatus");
    const spouseHealthStatus = watch("spouseHealthStatus");
    const maritalStatus = watch("maritalStatus");
    
    // Update user life expectancy based on health status
    if (userHealthStatus) {
      const adjustedLifeExpectancy = calculateLifeExpectancyFromHealth(userHealthStatus);
      setValue("userLifeExpectancy", adjustedLifeExpectancy);
    }
    
    // Update spouse life expectancy based on health status (only if married/partnered)
    if (spouseHealthStatus && (maritalStatus === "married" || maritalStatus === "partnered")) {
      const adjustedSpouseLifeExpectancy = calculateLifeExpectancyFromHealth(spouseHealthStatus);
      setValue("spouseLifeExpectancy", adjustedSpouseLifeExpectancy);
    }
  }, [
    watch("userHealthStatus"),
    watch("spouseHealthStatus"),
    watch("maritalStatus"),
    setValue
  ]);

  const addAsset = () => {
    setValue("assets", [...watchedAssets, { type: "", value: 0, owner: 'User', description: '' }], { shouldDirty: true });
  };

  const removeAsset = (index: number) => {
    const asset = watchedAssets[index];
    const name = asset?.description || asset?.type || 'this asset';
    setItemToDelete({ type: 'asset', index, name });
    setDeleteConfirmOpen(true);
  };

  const addLiability = () => {
    setValue("liabilities", [...watchedLiabilities, { type: "", description: "", balance: 0, monthlyPayment: 0, interestRate: 0, owner: 'User' }], { shouldDirty: true });
  };


  const removeLiability = (index: number) => {
    const liability = watchedLiabilities[index];
    const name = liability?.description || liability?.type || 'this liability';
    setItemToDelete({ type: 'liability', index, name });
    setDeleteConfirmOpen(true);
  };

  const importMortgageFromPlaid = async () => {
    try {
      setIsLoading(true);
      
      // Fetch connected Plaid accounts
      const response = await fetch('/api/plaid/accounts');
      if (!response.ok) {
        throw new Error('Failed to fetch Plaid accounts');
      }
      
      const data = await response.json();
      
      // The API returns accounts grouped by institution, we need to flatten them
      let allAccounts: any[] = [];
      if (data.accounts && Array.isArray(data.accounts)) {
        // Each element in data.accounts is an institution object with its own accounts array
        data.accounts.forEach((institution: any) => {
          if (institution.accounts && Array.isArray(institution.accounts)) {
            // Add institution name to each account for reference
            institution.accounts.forEach((account: any) => {
              allAccounts.push({
                ...account,
                institutionName: institution.institutionName
              });
            });
          }
        });
      }
      
      console.log('All Plaid accounts flattened:', allAccounts);
      
      // Find mortgage accounts (loan type with subtype 'mortgage')
      const mortgageAccount = allAccounts.find((account: any) => 
        account.type === 'loan' && account.subtype === 'mortgage'
      );
      
      console.log('Mortgage account found:', mortgageAccount);
      
      if (mortgageAccount) {
        // Import mortgage data into primary residence
        const mortgageBalance = Math.abs(mortgageAccount.currentBalance || 0);
        setValue('primaryResidence', {
          ...watch('primaryResidence'),
          mortgageBalance: mortgageBalance,
          _source: {
            isImported: true,
            institutionName: mortgageAccount.institutionName || 'Bank',
            accountId: mortgageAccount.accountId,
            accountName: mortgageAccount.name || mortgageAccount.officialName,
            lastUpdated: new Date().toISOString()
          }
        }, { shouldDirty: true });
        
        toast({
          title: "Mortgage Imported",
          description: `Mortgage balance of $${mortgageBalance.toLocaleString()} imported from ${mortgageAccount.institutionName || 'your bank'}`,
        });
      } else {
        // No mortgage found, show message
        toast({
          title: "No Mortgage Found",
          description: "No mortgage accounts found in your connected Plaid accounts. Please connect your mortgage lender first.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error importing mortgage from Plaid:', error);
      toast({
        title: "Import Failed",
        description: "Failed to import mortgage data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addProperty = () => {
    const currentProperties = watchedAdditionalProperties || [];
    setValue("additionalProperties", [...currentProperties, { type: "", marketValue: 0, mortgageBalance: 0, monthlyPayment: 0, rentalIncome: 0, owner: "User" }], { shouldDirty: true });
  };

  const removeProperty = (index: number) => {
    const property = watchedAdditionalProperties[index];
    const name = property?.type || 'this property';
    setItemToDelete({ type: 'property', index, name });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'asset') {
      const newAssets = [...watchedAssets];
      newAssets.splice(itemToDelete.index, 1);
      setValue("assets", newAssets, { shouldDirty: true });
    } else if (itemToDelete.type === 'liability') {
      const newLiabilities = [...watchedLiabilities];
      newLiabilities.splice(itemToDelete.index, 1);
      setValue("liabilities", newLiabilities, { shouldDirty: true });
    } else if (itemToDelete.type === 'property') {
      const newProperties = [...watchedAdditionalProperties];
      newProperties.splice(itemToDelete.index, 1);
      setValue("additionalProperties", newProperties, { shouldDirty: true });
    }

    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };

  // Check if user has Plaid accounts connected (for Step 5 auto-fill)
  useEffect(() => {
    const checkPlaidAccounts = async () => {
      try {
        const response = await fetch('/api/plaid/accounts', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setHasPlaidAccounts(data.accounts?.length > 0);
        }
      } catch (error) {
        console.error('Error checking Plaid accounts:', error);
      }
    };
    checkPlaidAccounts();
  }, []);

  // Handler for auto-filling expenses from Plaid transactions
  const handleAutoFillExpenses = async () => {
    setIsCategorizingExpenses(true);
    try {
      const response = await fetch('/api/plaid/transactions/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ daysBack: 30 })
      });
      
      if (!response.ok) {
        throw new Error('Failed to categorize transactions');
      }
      
      const data = await response.json();
      setCategorizedData(data);
      
      // Auto-fill the form fields with categorized expenses
      if (data.categorizedExpenses) {
        Object.entries(data.categorizedExpenses).forEach(([category, amount]) => {
          if (category !== 'expectedAnnualTaxes') {
            setValue(`monthlyExpenses.${category}`, amount as number, { shouldDirty: true });
          }
        });
        
        toast({
          title: "Expenses Auto-filled",
          description: `Analyzed ${data.transactionCount} transactions from ${data.accountCount} accounts`,
        });
      }
    } catch (error) {
      console.error('Error categorizing expenses:', error);
      toast({
        title: "Auto-fill Failed",
        description: "Unable to categorize transactions. Please enter expenses manually.",
        variant: "destructive"
      });
    } finally {
      setIsCategorizingExpenses(false);
    }
  };

  const nextStep = async () => {
    console.log('NextStep called - Current step:', currentStep, 'Total steps:', totalSteps);
    if (currentStep <= totalSteps) {
      setIsSavingStep(true);
      setSaveElapsedTime(0);
      
      // Start timer
      const timerInterval = setInterval(() => {
        setSaveElapsedTime(prev => prev + 1);
      }, 1000);
      
      try {
        // Get current form values
        const currentFormData = methods.getValues();
        
        // Save current form data immediately with proper validation
        const cleanData = {
          ...currentFormData,
          // Ensure all dynamic arrays are properly saved
          assets: Array.isArray(currentFormData.assets) ? currentFormData.assets : [],
          liabilities: Array.isArray(currentFormData.liabilities) ? currentFormData.liabilities : [],
          additionalProperties: Array.isArray(currentFormData.additionalProperties) ? currentFormData.additionalProperties : [],
          riskQuestions: Array.isArray(currentFormData.riskQuestions) ? currentFormData.riskQuestions : [3],
          spouseRiskQuestions: Array.isArray(currentFormData.spouseRiskQuestions) ? currentFormData.spouseRiskQuestions : [3],
          // Ensure monthlyExpenses is an object, not a string or other type
          monthlyExpenses: (typeof currentFormData.monthlyExpenses === 'object' && currentFormData.monthlyExpenses !== null) 
            ? currentFormData.monthlyExpenses 
            : {
                housing: 0,
                transportation: 0,
                food: 0,
                utilities: 0,
                healthcare: 0,
                entertainment: 0,
                creditCardPayments: 0,
                studentLoanPayments: 0,
                otherDebtPayments: 0,
                clothing: 0,
                expectedAnnualTaxes: 0,
                other: 0
              }
        };
        
        // Optimistic update - save to session storage immediately
        sessionStorage.setItem('intake-form-draft', JSON.stringify({
          data: cleanData,
          timestamp: Date.now()
        }));
        
        // Show immediate feedback
        setLastSaveTime(new Date());
        
        // Save to localStorage as secondary backup
        localStorage.setItem('intake-form-data', JSON.stringify(cleanData));
        
        // Background save to database (non-blocking)
        const saveToDatabase = async () => {
          try {
            console.log('Background save to database after step', currentStep);
            
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const doSave = () => fetch('/api/financial-profile', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                ...cleanData,  // Send raw data without transformation
                isPartialSave: true, // Flag to indicate this is a step-by-step save
                currentStep: currentStep,
                skipCalculations: true // Tell backend to skip heavy calculations
              }),
              signal: controller.signal
            });
            let response = await doSave();
            if (!response.ok) {
              await new Promise(r => setTimeout(r, 750));
              response = await doSave();
            }
            
            clearTimeout(timeoutId);

            if (!response.ok) {
              console.error('Failed to save to database:', response.status);
              // Try to get error details from response
              try {
                const errorData = await response.json();
                console.error('Server error details:', errorData);
                throw new Error(errorData.message || errorData.details || 'Database save failed');
              } catch (e) {
                throw new Error('Database save failed');
              }
            }
            
            console.log('Successfully saved step', currentStep, 'to database');
          } catch (dbError: any) {
            console.error('Database save error:', dbError);
            
            // If timeout, still continue
            if (dbError.name === 'AbortError') {
              console.log('Save request timed out, data preserved in session');
            }
            // Data is safe in session/local storage
          }
        };
        
        // Fire and forget the database save
        saveToDatabase();
        
        // Determine next step - skip step 8 if not married
        let nextStepNumber = currentStep + 1;
        if (currentStep === 7 && currentFormData.maritalStatus !== "married") {
          nextStepNumber = 9; // Skip step 8 (spouse risk profile)
        }
        
        localStorage.setItem('intake-form-step', nextStepNumber.toString());
        
        toast({
          title: "Progress Saved",
          description: "Your information has been saved.",
        });
        console.log('Setting next step to:', nextStepNumber);
        setCurrentStep(nextStepNumber);
      } catch (error) {
        console.error('Error saving progress:', error);
        toast({
          title: "Save Warning",
          description: "Progress saved locally. Will sync when connection is restored.",
          variant: "default",
        });
        // Still navigate even if save fails
        const currentFormData = methods.getValues();
        let nextStepNumber = currentStep + 1;
        if (currentStep === 7 && currentFormData.maritalStatus !== "married") {
          nextStepNumber = 9;
        }
        setCurrentStep(nextStepNumber);
      } finally {
        clearInterval(timerInterval);
        setIsSavingStep(false);
        setSaveElapsedTime(0);
      }
    } else {
      console.log('Not advancing - currentStep >= totalSteps');
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      try {
        // Determine previous step - skip step 8 if not married
        const currentFormData = methods.getValues();
        let prevStepNumber = currentStep - 1;
        if (currentStep === 9 && currentFormData.maritalStatus !== "married") {
          prevStepNumber = 7; // Skip back over step 8 (spouse risk profile)
        }
        
        // Update step in localStorage
        localStorage.setItem('intake-form-step', prevStepNumber.toString());
        setCurrentStep(prevStepNumber);
      } catch (error) {
        console.error('Error updating step:', error);
        const currentFormData = methods.getValues();
        let prevStepNumber = currentStep - 1;
        if (currentStep === 9 && currentFormData.maritalStatus !== "married") {
          prevStepNumber = 7;
        }
        setCurrentStep(prevStepNumber);
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    console.log("Complete form submitted:", data);
    console.log("Long-term care insurance value:", data.hasLongTermCareInsurance);
    
    // Basic validation - check for essential fields
    if (!data.firstName || !data.lastName) {
      toast({
        title: "Validation Error",
        description: "Please provide your first and last name.",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.annualIncome || data.annualIncome <= 0) {
      toast({
        title: "Validation Error", 
        description: "Please provide a valid annual income.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate retirement contributions
    const { validateContribution, getAgeCatchUpEligibility, CONTRIBUTION_LIMITS_2025 } = await import('@shared/retirement-contribution-limits');
    
    if (data.retirementContributions) {
      const annualEmployeeContribution = (data.retirementContributions.employee || 0) * 12;
      const annualEmployerContribution = (data.retirementContributions.employer || 0) * 12;
      const totalAnnualContribution = annualEmployeeContribution + annualEmployerContribution;
      
      const catchUpEligibility = getAgeCatchUpEligibility(data.dateOfBirth);
      const employeeLimit = CONTRIBUTION_LIMITS_2025.standard.baseLimit + catchUpEligibility.catchUpAmount;
      let totalLimit = CONTRIBUTION_LIMITS_2025.standard.totalAnnualAdditionsLimit;
      
      if (catchUpEligibility.isEligibleForEnhancedCatchUp) {
        totalLimit = CONTRIBUTION_LIMITS_2025.standard.totalWithEnhancedCatchUp;
      } else if (catchUpEligibility.isEligibleForCatchUp) {
        totalLimit = CONTRIBUTION_LIMITS_2025.standard.totalWithCatchUp;
      }
      
      if (annualEmployeeContribution > employeeLimit) {
        toast({
          title: "Contribution Limit Exceeded",
          description: `Your annual contribution of $${annualEmployeeContribution.toLocaleString()} exceeds the 2025 limit of $${employeeLimit.toLocaleString()}.`,
          variant: "destructive",
          duration: 5000,
        });
        setCurrentStep(11);
        return;
      }
      
      if (totalAnnualContribution > totalLimit) {
        toast({
          title: "Total Contribution Limit Exceeded",
          description: `Total annual contributions (employee + employer) of $${totalAnnualContribution.toLocaleString()} exceed the 2025 limit of $${totalLimit.toLocaleString()}.`,
          variant: "destructive",
          duration: 5000,
        });
        setCurrentStep(11);
        return;
      }
    }
    
    // Validate spouse retirement contributions if married
    if (data.maritalStatus === "married" && data.spouseRetirementContributions && data.spouseDateOfBirth) {
      const annualSpouseEmployeeContribution = (data.spouseRetirementContributions.employee || 0) * 12;
      const annualSpouseEmployerContribution = (data.spouseRetirementContributions.employer || 0) * 12;
      const totalSpouseAnnualContribution = annualSpouseEmployeeContribution + annualSpouseEmployerContribution;
      
      const spouseCatchUpEligibility = getAgeCatchUpEligibility(data.spouseDateOfBirth);
      const spouseEmployeeLimit = CONTRIBUTION_LIMITS_2025.standard.baseLimit + spouseCatchUpEligibility.catchUpAmount;
      let spouseTotalLimit = CONTRIBUTION_LIMITS_2025.standard.totalAnnualAdditionsLimit;
      
      if (spouseCatchUpEligibility.isEligibleForEnhancedCatchUp) {
        spouseTotalLimit = CONTRIBUTION_LIMITS_2025.standard.totalWithEnhancedCatchUp;
      } else if (spouseCatchUpEligibility.isEligibleForCatchUp) {
        spouseTotalLimit = CONTRIBUTION_LIMITS_2025.standard.totalWithCatchUp;
      }
      
      if (annualSpouseEmployeeContribution > spouseEmployeeLimit) {
        toast({
          title: "Spouse Contribution Limit Exceeded",
          description: `Your spouse's annual contribution of $${annualSpouseEmployeeContribution.toLocaleString()} exceeds the 2025 limit of $${spouseEmployeeLimit.toLocaleString()}.`,
          variant: "destructive",
          duration: 5000,
        });
        setCurrentStep(11);
        return;
      }
      
      if (totalSpouseAnnualContribution > spouseTotalLimit) {
        toast({
          title: "Spouse Total Contribution Limit Exceeded",
          description: `Spouse's total annual contributions (employee + employer) of $${totalSpouseAnnualContribution.toLocaleString()} exceed the 2025 limit of $${spouseTotalLimit.toLocaleString()}.`,
          variant: "destructive",
          duration: 5000,
        });
        setCurrentStep(11);
        return;
      }
    }
    
    setIsSubmitting(true);
    setSubmitProgress(0);
    setSubmitTimer(0);
    
    // Disable achievement tracking during submission
    if (onSubmissionStart) {
      onSubmissionStart();
    }

    // Progress simulation with timer
    const progressSteps = [
      { progress: 20, message: "Validating financial data...", delay: 1000 },
      { progress: 40, message: "Calculating financial health metrics...", delay: 2000 },
      { progress: 60, message: "Generating personalized recommendations...", delay: 2500 },
      { progress: 80, message: "Creating your dashboard...", delay: 1500 },
      { progress: 100, message: "Finalizing your financial plan...", delay: 1000 }
    ];

    // Start timer
    const timerInterval = setInterval(() => {
      setSubmitTimer(prev => prev + 1);
    }, 1000);

    try {
      let currentStep = 0;
      
      // Execute progress steps
      for (const step of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, step.delay));
        setSubmitProgress(step.progress);
        
        // Make the actual API call when we reach the calculation step
        if (step.progress === 40) {
          console.log('Submitting form data:', data);
          console.log('Spouse risk data being submitted:', {
            maritalStatus: data.maritalStatus,
            spouseRiskQuestions: data.spouseRiskQuestions,
            spouseAllocation: data.spouseAllocation
          });
          
          // Track form completion once
          trackAction('form-complete', 'intake-form', 1);
          
          // Log spouse risk data for debugging
          console.log('Spouse Risk Data Debug:', {
            maritalStatus: data.maritalStatus,
            spouseRiskQuestions: data.spouseRiskQuestions,
            spouseRiskQuestionsLength: data.spouseRiskQuestions?.length,
            spouseAllocation: data.spouseAllocation
          });
          
          // Transform the data to match the database schema
          console.log('Form data hasLongTermCareInsurance before transform:', data.hasLongTermCareInsurance);
          const transformedData = {
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: data.dateOfBirth,
            maritalStatus: data.maritalStatus,
            dependents: data.dependents,
            state: data.state,
            spouseName: data.spouseName,
            spouseDateOfBirth: data.spouseDateOfBirth,
            employmentStatus: data.employmentStatus,
            annualIncome: data.annualIncome,
            taxWithholdingStatus: data.taxWithholdingStatus,
            takeHomeIncome: data.takeHomeIncome,
            otherIncome: data.otherIncome,
            spouseEmploymentStatus: data.spouseEmploymentStatus,
            spouseAnnualIncome: data.spouseAnnualIncome,
            spouseTaxWithholdingStatus: data.spouseTaxWithholdingStatus,
            spouseTakeHomeIncome: data.spouseTakeHomeIncome,
            savingsRate: data.savingsRate,
            assets: data.assets,
            liabilities: data.liabilities,
            primaryResidence: data.primaryResidence,
            additionalProperties: data.additionalProperties,
            monthlyExpenses: data.monthlyExpenses,
            totalMonthlyExpenses: data.totalMonthlyExpenses,
            emergencyFundSize: data.emergencyFundSize,
            lifeInsurance: data.lifeInsurance,
            spouseLifeInsurance: data.spouseLifeInsurance,
            healthInsurance: data.healthInsurance,
            disabilityInsurance: data.disabilityInsurance,
            spouseDisabilityInsurance: data.spouseDisabilityInsurance,
            autoInsurance: data.autoInsurance,
            homeownerInsurance: data.homeownerInsurance,
            umbrellaInsurance: data.umbrellaInsurance,
            businessLiabilityInsurance: data.businessLiabilityInsurance,
            // Also send the nested insurance object for complete data persistence
            insurance: data.insurance,
            riskQuestions: data.riskQuestions,
            currentAllocation: data.currentAllocation,
            spouseRiskQuestions: data.spouseRiskQuestions,
            spouseAllocation: data.spouseAllocation,
            // Estate planning data - individual fields
            hasWill: data.hasWill || false,
            hasTrust: data.hasTrust || false,
            hasPowerOfAttorney: data.hasPowerOfAttorney || false,
            hasHealthcareProxy: data.hasHealthcareProxy || false,
            hasBeneficiaries: data.hasBeneficiaries || false,
            // Also send as nested object for backward compatibility
            estatePlanning: {
              hasWill: data.hasWill || false,
              hasTrust: data.hasTrust || false,
              hasPowerOfAttorney: data.hasPowerOfAttorney || false,
              hasHealthcareProxy: data.hasHealthcareProxy || false,
              hasBeneficiaries: data.hasBeneficiaries || false
            },
            // Tax information - individual fields
            lastYearAGI: data.lastYearAGI || 0,
            deductionAmount: data.deductionAmount || 0,
            taxFilingStatus: data.taxFilingStatus || "single",
            // Also send as nested object for backward compatibility
            taxReturns: {
              lastYearAGI: data.lastYearAGI || 0,
              deductionAmount: data.deductionAmount || 0,
              taxFilingStatus: data.taxFilingStatus || "single"
            },
            // Step 11: Retirement Planning - new fields
            desiredRetirementAge: data.desiredRetirementAge || 65,
            spouseDesiredRetirementAge: data.spouseDesiredRetirementAge || 65,
            socialSecurityClaimAge: data.socialSecurityClaimAge || data.desiredRetirementAge || 65,
            spouseSocialSecurityClaimAge: data.spouseSocialSecurityClaimAge || data.spouseDesiredRetirementAge || 65,
            userHealthStatus: data.userHealthStatus || 'good',
            spouseHealthStatus: data.spouseHealthStatus || 'good',
            userLifeExpectancy: data.userLifeExpectancy || 93,
            spouseLifeExpectancy: data.spouseLifeExpectancy || 93,
            expectedMonthlyExpensesRetirement: data.expectedMonthlyExpensesRetirement || 0,
            // Life goals and retirement data - individual fields (legacy step 12)
            retirementAge: data.retirementAge || 65,
            retirementIncome: data.retirementIncome || 0,
            additionalNotes: data.additionalNotes || "",
            // Also send as nested object for backward compatibility
            lifeGoals: {
              retirementAge: data.retirementAge || 65,
              retirementIncome: data.retirementIncome || 0,
              additionalNotes: data.additionalNotes || ""
            },
            // Fields for Monte Carlo retirement confidence calculation
            lifeExpectancy: data.lifeExpectancy || 90,
            retirementExpenseBudget: data.retirementExpenseBudget || { essential: 0, discretionary: 0 },
            socialSecurityBenefit: data.socialSecurityBenefit || 0,
            spouseSocialSecurityBenefit: data.spouseSocialSecurityBenefit || 0,
            pensionBenefit: data.pensionBenefit || 0,
            spousePensionBenefit: data.spousePensionBenefit || 0,
            retirementContributions: data.retirementContributions || { employee: 0, employer: 0 },
            spouseRetirementContributions: data.spouseRetirementContributions || { employee: 0, employer: 0 },
            // Use risk profile-based returns (marker for backend to calculate based on risk profiles)
            expectedRealReturn: -3, // Special marker: use risk profile-based returns
            investmentStrategy: "risk-based", // Uses risk profile-based returns for each asset
            withdrawalRate: data.withdrawalRate || 4,
            hasLongTermCareInsurance: Boolean(data.hasLongTermCareInsurance),
            legacyGoal: data.legacyGoal || 0,
            partTimeIncomeRetirement: data.partTimeIncomeRetirement || 0,
            spousePartTimeIncomeRetirement: data.spousePartTimeIncomeRetirement || 0,
            // IRA Contributions - IMPORTANT for retirement optimization prefill
            traditionalIRAContribution: data.traditionalIRAContribution || 0,
            rothIRAContribution: data.rothIRAContribution || 0,
            spouseTraditionalIRAContribution: data.spouseTraditionalIRAContribution || 0,
            spouseRothIRAContribution: data.spouseRothIRAContribution || 0,
            isComplete: true
          };
          
          console.log('Transformed spouse risk data:', {
            maritalStatus: transformedData.maritalStatus,
            spouseRiskQuestions: transformedData.spouseRiskQuestions,
            spouseAllocation: transformedData.spouseAllocation
          });

          // Check authentication status first
          const authCheck = await fetch('/api/user', {
            credentials: 'include'
          });
          
          if (!authCheck.ok) {
            toast({
              title: "Authentication Error",
              description: "Your session has expired. Please log in again.",
              variant: "destructive"
            });
            return;
          }
          
          console.log('Sending PUT request to /api/financial-profile');
          // Remove any circular references before stringifying
          const safeData = JSON.parse(JSON.stringify(transformedData));
          
          const response = await fetch('/api/financial-profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies for authentication
            body: JSON.stringify(safeData),
          }).catch(fetchError => {
            console.error('Fetch error:', fetchError);
            throw new Error(`Network error: ${fetchError.message}`);
          });

          console.log('PUT response status:', response?.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { details: errorText };
            }
            throw new Error(errorData?.details || `Server error: ${response.status}`);
          }
          
          const savedProfile = await response.json();
          console.log('Profile saved successfully:', savedProfile);
          
          // Auto-sync debts to debt management center
          try {
            const syncResponse = await fetch('/api/debts/sync-from-intake', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });
            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              console.log('Debts synced to debt management center:', syncData);
            }
          } catch (syncError) {
            console.error('Failed to sync debts, but profile was saved:', syncError);
          }
          
          // Trigger recalculation to ensure risk profiles and recommendations are updated
          try {
            const recalcResponse = await fetch('/api/financial-profile/recalculate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });
            if (recalcResponse.ok) {
              const recalcData = await recalcResponse.json();
              console.log('Financial metrics recalculated:', recalcData);
            }
          } catch (recalcError) {
            console.error('Failed to recalculate metrics, but profile was saved:', recalcError);
          }
          
          // Invalidate queries to force fresh data fetches
          await queryClient.invalidateQueries({ queryKey: ['/api/financial-profile'] });
          await queryClient.invalidateQueries({ queryKey: ['estate-plan'] });
          await queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
          await queryClient.invalidateQueries({ queryKey: ['estate-beneficiaries'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/debts'] });
        }
      }

      // Clear localStorage and sessionStorage after successful submission
      localStorage.removeItem('intake-form-data');
      localStorage.removeItem('intake-form-step');
      clearSessionStorage(); // Clear session storage draft
      
      clearInterval(timerInterval);
      
      // Dispatch profileUpdated event to refresh dashboard
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      
      // Wait a moment then redirect to dashboard
      setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent('navigateToDashboard'));
        } catch (error) {
          console.warn('Navigation event error (expected in some environments):', error);
          // Fallback: direct navigation if event fails
          window.location.reload();
        }
      }, 500);
      
    } catch (error) {
      console.error('Error saving profile:', error);
      clearInterval(timerInterval);
      setIsSubmitting(false);
      setSubmitProgress(0);
      
      // Show more specific error message
      const errorMessage = error instanceof Error ? error.message : "Failed to save your financial information";
      
      toast({
        title: "Submission Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      // Step 1: Personal and Household Information
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">Personal and Household Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="firstName" className="text-white">First Name</Label>
                <Input
                  id="firstName"
                  {...register("firstName", { required: "First name is required" })}
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
                {errors.firstName && (
                  <p className="text-red-400 text-sm mt-1">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName" className="text-white">Last Name</Label>
                <Input
                  id="lastName"
                  {...register("lastName", { required: "Last name is required" })}
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
                {errors.lastName && (
                  <p className="text-red-400 text-sm mt-1">{errors.lastName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="dateOfBirth" className="text-white">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  {...register("dateOfBirth", { required: "Date of birth is required" })}
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
                {errors.dateOfBirth && (
                  <p className="text-red-400 text-sm mt-1">{errors.dateOfBirth.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="maritalStatus" className="text-white">Marital Status</Label>
                <Select value={watch("maritalStatus")} onValueChange={(value) => setValue("maritalStatus", value, { shouldDirty: true })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-primary">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="single" className="text-white">Single</SelectItem>
                    <SelectItem value="married" className="text-white">Married</SelectItem>
                    <SelectItem value="divorced" className="text-white">Divorced</SelectItem>
                    <SelectItem value="widowed" className="text-white">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="state" className="text-white">State of Residence</Label>
                <Select value={watch("state") || ""} onValueChange={(value) => setValue("state", value, { shouldDirty: true })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-primary">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="AL" className="text-white">Alabama</SelectItem>
                    <SelectItem value="AK" className="text-white">Alaska</SelectItem>
                    <SelectItem value="AZ" className="text-white">Arizona</SelectItem>
                    <SelectItem value="AR" className="text-white">Arkansas</SelectItem>
                    <SelectItem value="CA" className="text-white">California</SelectItem>
                    <SelectItem value="CO" className="text-white">Colorado</SelectItem>
                    <SelectItem value="CT" className="text-white">Connecticut</SelectItem>
                    <SelectItem value="DE" className="text-white">Delaware</SelectItem>
                    <SelectItem value="DC" className="text-white">District of Columbia</SelectItem>
                    <SelectItem value="FL" className="text-white">Florida</SelectItem>
                    <SelectItem value="GA" className="text-white">Georgia</SelectItem>
                    <SelectItem value="HI" className="text-white">Hawaii</SelectItem>
                    <SelectItem value="ID" className="text-white">Idaho</SelectItem>
                    <SelectItem value="IL" className="text-white">Illinois</SelectItem>
                    <SelectItem value="IN" className="text-white">Indiana</SelectItem>
                    <SelectItem value="IA" className="text-white">Iowa</SelectItem>
                    <SelectItem value="KS" className="text-white">Kansas</SelectItem>
                    <SelectItem value="KY" className="text-white">Kentucky</SelectItem>
                    <SelectItem value="LA" className="text-white">Louisiana</SelectItem>
                    <SelectItem value="ME" className="text-white">Maine</SelectItem>
                    <SelectItem value="MD" className="text-white">Maryland</SelectItem>
                    <SelectItem value="MA" className="text-white">Massachusetts</SelectItem>
                    <SelectItem value="MI" className="text-white">Michigan</SelectItem>
                    <SelectItem value="MN" className="text-white">Minnesota</SelectItem>
                    <SelectItem value="MS" className="text-white">Mississippi</SelectItem>
                    <SelectItem value="MO" className="text-white">Missouri</SelectItem>
                    <SelectItem value="MT" className="text-white">Montana</SelectItem>
                    <SelectItem value="NE" className="text-white">Nebraska</SelectItem>
                    <SelectItem value="NV" className="text-white">Nevada</SelectItem>
                    <SelectItem value="NH" className="text-white">New Hampshire</SelectItem>
                    <SelectItem value="NJ" className="text-white">New Jersey</SelectItem>
                    <SelectItem value="NM" className="text-white">New Mexico</SelectItem>
                    <SelectItem value="NY" className="text-white">New York</SelectItem>
                    <SelectItem value="NC" className="text-white">North Carolina</SelectItem>
                    <SelectItem value="ND" className="text-white">North Dakota</SelectItem>
                    <SelectItem value="OH" className="text-white">Ohio</SelectItem>
                    <SelectItem value="OK" className="text-white">Oklahoma</SelectItem>
                    <SelectItem value="OR" className="text-white">Oregon</SelectItem>
                    <SelectItem value="PA" className="text-white">Pennsylvania</SelectItem>
                    <SelectItem value="RI" className="text-white">Rhode Island</SelectItem>
                    <SelectItem value="SC" className="text-white">South Carolina</SelectItem>
                    <SelectItem value="SD" className="text-white">South Dakota</SelectItem>
                    <SelectItem value="TN" className="text-white">Tennessee</SelectItem>
                    <SelectItem value="TX" className="text-white">Texas</SelectItem>
                    <SelectItem value="UT" className="text-white">Utah</SelectItem>
                    <SelectItem value="VT" className="text-white">Vermont</SelectItem>
                    <SelectItem value="VA" className="text-white">Virginia</SelectItem>
                    <SelectItem value="WA" className="text-white">Washington</SelectItem>
                    <SelectItem value="WV" className="text-white">West Virginia</SelectItem>
                    <SelectItem value="WI" className="text-white">Wisconsin</SelectItem>
                    <SelectItem value="WY" className="text-white">Wyoming</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Spouse Information */}
              {(watchedMaritalStatus === "married") && (
                <>
                  <div className="md:col-span-2">
                    <h4 className="text-lg font-medium text-white mb-4">Spouse/Partner Information</h4>
                  </div>
                  <div>
                    <Label htmlFor="spouseName" className="text-white">Spouse Full Name</Label>
                    <Input
                      id="spouseName"
                      {...register("spouseName")}
                      className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                    />
                  </div>
                  <div>
                    <Label htmlFor="spouseDateOfBirth" className="text-white">Spouse Date of Birth</Label>
                    <Input
                      id="spouseDateOfBirth"
                      type="date"
                      {...register("spouseDateOfBirth")}
                      className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                    />
                  </div>
                </>
              )}
              
              {/* Dependents - Show after user info for single, after spouse info for married */}
              <div className="md:col-span-2">
                <Label htmlFor="dependents" className="text-white">Number of Dependents</Label>
                <Input
                  id="dependents"
                  type="number"
                  min="0"
                  {...register("dependents", { valueAsNumber: true })}
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
                <p className="text-gray-400 text-sm mt-1">Include children and other dependents who rely on your financial support</p>
              </div>
            </div>
          </div>
        );
      
      // Step 2: Employment and Income Details
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">Household Employment and Income Details</h3>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="employmentStatus" className="text-white">Your Employment Status</Label>
                <Select value={watch("employmentStatus")} onValueChange={(value) => setValue("employmentStatus", value, { shouldDirty: true })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-primary">
                    <SelectValue placeholder="Select employment status" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="full-time" className="text-white">Full-time Employee</SelectItem>
                    <SelectItem value="part-time" className="text-white">Part-time Employee</SelectItem>
                    <SelectItem value="self-employed" className="text-white">Self-employed</SelectItem>
                    <SelectItem value="unemployed" className="text-white">Unemployed</SelectItem>
                    <SelectItem value="retired" className="text-white">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="annualIncome" className="text-white">Your Annual Gross Income</Label>
                  <Input
                    id="annualIncome"
                    type="number"
                    placeholder="$0"
                    {...register("annualIncome", { valueAsNumber: true })}
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                </div>
                <div>
                  <Label htmlFor="taxWithholdingStatus" className="text-white">Tax Withholding Status</Label>
                  <Select value={watch("taxWithholdingStatus")} onValueChange={(value) => setValue("taxWithholdingStatus", value, { shouldDirty: true })}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-primary">
                      <SelectValue placeholder="Select tax withholding" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="employer" className="text-white">Employer Withholds Taxes</SelectItem>
                      <SelectItem value="self" className="text-white">Self-Employed (I handle taxes)</SelectItem>
                      <SelectItem value="none" className="text-white">No Tax Withholding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Take-home income field for employer withholding */}
              {watchedTaxWithholdingStatus === "employer" && (
                <div>
                  <Label htmlFor="takeHomeIncome" className="text-white">Your Annual Take-Home Income (After Taxes)</Label>
                  <Input
                    id="takeHomeIncome"
                    type="number"
                    placeholder="$0"
                    {...register("takeHomeIncome", { valueAsNumber: true })}
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                  <p className="text-sm text-gray-400 mt-1">Enter your annual income after taxes are withheld by your employer</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="otherIncome" className="text-white">Your Other Income Sources</Label>
                  <Input
                    id="otherIncome"
                    type="number"
                    placeholder="$0"
                    {...register("otherIncome", { valueAsNumber: true })}
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                </div>
              </div>
              
              {/* Spouse Employment */}
              {(watchedMaritalStatus === "married") && (
                <>
                  <h4 className="text-lg font-medium text-white mt-8 mb-4">Spouse Employment & Income</h4>
                  <div>
                    <Label htmlFor="spouseEmploymentStatus" className="text-white">Spouse Employment Status</Label>
                    <Select value={watch("spouseEmploymentStatus")} onValueChange={(value) => setValue("spouseEmploymentStatus", value, { shouldDirty: true })}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-primary">
                        <SelectValue placeholder="Select spouse employment status" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="full-time" className="text-white">Full-time Employee</SelectItem>
                        <SelectItem value="part-time" className="text-white">Part-time Employee</SelectItem>
                        <SelectItem value="self-employed" className="text-white">Self-employed</SelectItem>
                        <SelectItem value="unemployed" className="text-white">Unemployed</SelectItem>
                        <SelectItem value="retired" className="text-white">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="spouseAnnualIncome" className="text-white">Spouse Annual Gross Income</Label>
                    <Input
                      id="spouseAnnualIncome"
                      type="number"
                      placeholder="$0"
                      {...register("spouseAnnualIncome", { valueAsNumber: true })}
                      className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                    />
                  </div>
                  <div>
                    <Label htmlFor="spouseTaxWithholdingStatus" className="text-white">Spouse Tax Withholding Status</Label>
                    <Select value={watch("spouseTaxWithholdingStatus")} onValueChange={(value) => setValue("spouseTaxWithholdingStatus", value, { shouldDirty: true })}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-primary">
                        <SelectValue placeholder="Select spouse tax withholding" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="employer" className="text-white">Employer Withholds Taxes</SelectItem>
                        <SelectItem value="self" className="text-white">Self-Employed (I handle taxes)</SelectItem>
                        <SelectItem value="none" className="text-white">No Tax Withholding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Spouse take-home income field for employer withholding */}
                  {watchedSpouseTaxWithholdingStatus === "employer" && (
                    <div className="md:col-span-2">
                      <Label htmlFor="spouseTakeHomeIncome" className="text-white">Spouse Annual Take-Home Income (After Taxes)</Label>
                      <Input
                        id="spouseTakeHomeIncome"
                        type="number"
                        placeholder="$0"
                        {...register("spouseTakeHomeIncome", { valueAsNumber: true })}
                        className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                      />
                      <p className="text-sm text-gray-400 mt-1">Enter spouse's annual income after taxes are withheld by employer</p>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        );
      
      // Step 3: Assets and Liabilities
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">Household Assets and Liabilities</h3>
            
            {/* Auto-populated Notice */}
            {(watchedAssets?.some(a => a._source?.isImported) || watchedLiabilities?.some(l => l._source?.isImported)) && (
              <div className="mb-6">
                <div className="border border-green-500/30 bg-green-900/10 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <p className="text-green-400 text-sm">
                      Connected accounts have been automatically imported from your bank connections
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Assets Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-white">Assets</h4>
                <Button type="button" onClick={addAsset} className="gradient-bg text-white hover:opacity-90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Asset
                </Button>
              </div>
              <p className="text-gray-400 text-sm mb-4">List your savings, investments, and other valuable assets (excluding real estate, which is covered in the next section)</p>
              
              {watchedAssets?.map((asset, index) => (
                <div key={index} className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg mb-4 relative ${
                  asset._source?.isImported ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-gray-800'
                }`}>
                  {/* Plaid Import Indicator */}
                  {asset._source?.isImported && (
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium">From {asset._source.institutionName || 'Bank'}</span>
                    </div>
                  )}
                  <div>
                    <Label className="text-white">Asset Type</Label>
                    <Select value={watch(`assets.${index}.type`)} onValueChange={(value) => setValue(`assets.${index}.type`, value, { shouldDirty: true })}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="checking" className="text-white">Checking Account</SelectItem>
                        <SelectItem value="savings" className="text-white">Savings Account</SelectItem>
                        <SelectItem value="taxable-brokerage" className="text-white">Taxable Brokerage</SelectItem>
                        <SelectItem value="401k" className="text-white">401(k)</SelectItem>
                        <SelectItem value="403b" className="text-white">403(b)</SelectItem>
                        <SelectItem value="traditional-ira" className="text-white">Traditional IRA</SelectItem>
                        <SelectItem value="roth-ira" className="text-white">Roth IRA</SelectItem>
                        <SelectItem value="other-tax-deferred" className="text-white">Other Tax-Deferred Accounts</SelectItem>
                        <SelectItem value="hsa" className="text-white">HSA</SelectItem>
                        <SelectItem value="qualified-annuities" className="text-white">Qualified Annuities</SelectItem>
                        <SelectItem value="non-qualified-annuities" className="text-white">Non-Qualified Annuities</SelectItem>
                        <SelectItem value="roth-annuities" className="text-white">Roth Annuities</SelectItem>
                        <SelectItem value="vehicle" className="text-white">Vehicle</SelectItem>
                        <SelectItem value="business" className="text-white">Business Interest</SelectItem>
                        <SelectItem value="cash-value-life-insurance" className="text-white">Cash Value Life Insurance</SelectItem>
                        <SelectItem value="other" className="text-white">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Description</Label>
                    <Input
                      {...register(`assets.${index}.description`)}
                      placeholder="e.g., Chase Savings"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Current Value ($)</Label>
                    <Input
                      type="number"
                      {...register(`assets.${index}.value`, { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div className="flex items-end space-x-2">
                    <div className="flex-1">
                      <Label className="text-white">Owner</Label>
                      <Select value={watch(`assets.${index}.owner`)} onValueChange={(value) => setValue(`assets.${index}.owner`, value, { shouldDirty: true })}>
                        <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                          <SelectValue placeholder="Owner" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="User" className="text-white">You</SelectItem>
                          <SelectItem value="Spouse" className="text-white">Spouse</SelectItem>
                          <SelectItem value="Joint" className="text-white">Joint</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" onClick={() => removeAsset(index)} variant="destructive" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  
                  {/* Conditional Annuity Fields */}
                  {(watch(`assets.${index}.type`) === 'qualified-annuities' || 
                    watch(`assets.${index}.type`) === 'non-qualified-annuities' || 
                    watch(`assets.${index}.type`) === 'roth-annuities') && (
                    <div className="md:col-span-4 mt-4 p-4 bg-gray-900 rounded-lg space-y-4">
                      <h5 className="text-sm font-medium text-purple-400 mb-3">Annuity Details</h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-white">Annuity Type</Label>
                          <Select value={watch(`assets.${index}.annuityType`)} onValueChange={(value) => setValue(`assets.${index}.annuityType`, value as 'immediate' | 'deferred', { shouldDirty: true })}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="immediate" className="text-white">Immediate Annuity</SelectItem>
                              <SelectItem value="deferred" className="text-white">Deferred Annuity</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-white">Payout Start Date</Label>
                          <Input
                            type="date"
                            {...register(`assets.${index}.payoutStartDate`)}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-white">Monthly Payout Amount ($)</Label>
                          <Input
                            type="number"
                            {...register(`assets.${index}.payoutAmount`, { valueAsNumber: true })}
                            placeholder="0"
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-white">Payout Frequency</Label>
                          <Select value={watch(`assets.${index}.payoutFrequency`)} onValueChange={(value) => setValue(`assets.${index}.payoutFrequency`, value as 'monthly' | 'quarterly' | 'annually', { shouldDirty: true })}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="monthly" className="text-white">Monthly</SelectItem>
                              <SelectItem value="quarterly" className="text-white">Quarterly</SelectItem>
                              <SelectItem value="annually" className="text-white">Annually</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Non-Qualified Annuity specific fields */}
                        {watch(`assets.${index}.type`) === 'non-qualified-annuities' && (
                          <>
                            <div>
                              <Label className="text-white">Cost Basis ($)</Label>
                              <Input
                                type="number"
                                {...register(`assets.${index}.costBasis`, { valueAsNumber: true })}
                                placeholder="0"
                                className="bg-gray-700 border-gray-600 text-white"
                              />
                              <p className="text-xs text-gray-400 mt-1">Total after-tax contributions</p>
                            </div>
                            
                            <div>
                              <Label className="text-white">Exclusion Ratio (%)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                {...register(`assets.${index}.exclusionRatio`, { valueAsNumber: true })}
                                placeholder="0"
                                className="bg-gray-700 border-gray-600 text-white"
                              />
                              <p className="text-xs text-gray-400 mt-1">Tax-free portion of payout</p>
                            </div>
                          </>
                        )}
                        
                        {/* Deferred Annuity specific fields */}
                        {watch(`assets.${index}.annuityType`) === 'deferred' && (
                          <div>
                            <Label className="text-white">Expected Growth Rate (%)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              {...register(`assets.${index}.growthRate`, { valueAsNumber: true })}
                              placeholder="5"
                              className="bg-gray-700 border-gray-600 text-white"
                            />
                          </div>
                        )}
                        
                        {/* Survivor benefit field */}
                        {(watchedMaritalStatus === "married") && (
                          <div>
                            <Label className="text-white">Survivor Benefit (%)</Label>
                            <Input
                              type="number"
                              step="5"
                              min="0"
                              max="100"
                              {...register(`assets.${index}.survivorBenefit`, { valueAsNumber: true })}
                              placeholder="50"
                              className="bg-gray-700 border-gray-600 text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">Percentage spouse receives</p>
                          </div>
                        )}
                        
                        <div>
                          <Label className="text-white">Period Certain (Years)</Label>
                          <Input
                            type="number"
                            {...register(`assets.${index}.guaranteedYears`, { valueAsNumber: true })}
                            placeholder="0"
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                          <p className="text-xs text-gray-400 mt-1">Guaranteed payment period</p>
                        </div>
                      </div>
                      
                      <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-3 mt-4">
                        <p className="text-purple-200 text-xs">
                          {watch(`assets.${index}.type`) === 'qualified-annuities' && 
                            "Qualified annuities are funded with pre-tax dollars. The entire payout will be taxable income."}
                          {watch(`assets.${index}.type`) === 'non-qualified-annuities' && 
                            "Non-qualified annuities are funded with after-tax dollars. Only the earnings portion is taxable."}
                          {watch(`assets.${index}.type`) === 'roth-annuities' && 
                            "Roth annuities are funded with after-tax dollars. Qualified distributions are tax-free."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Liabilities Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-white">Liabilities</h4>
                <Button type="button" onClick={addLiability} className="gradient-bg text-white hover:opacity-90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Liability
                </Button>
              </div>
              <p className="text-gray-400 text-sm mb-4">List your debts excluding mortgages (covered in real estate section)</p>
              
              {watchedLiabilities?.map((liability, index) => (
                <div key={index} className={`p-4 rounded-lg mb-4 relative ${
                  liability._source?.isImported ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-gray-800'
                }`}>
                  {/* Plaid Import Indicator */}
                  {liability._source?.isImported && (
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium">From {liability._source.institutionName || 'Bank'}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div>
                      <Label className="text-white">Debt Type</Label>
                      <Select value={watch(`liabilities.${index}.type`)} onValueChange={(value) => setValue(`liabilities.${index}.type`, value, { shouldDirty: true })}>
                        <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="credit-card" className="text-white">Credit Card</SelectItem>
                          <SelectItem value="federal-student-loan" className="text-white">Federal Student Loan</SelectItem>
                          <SelectItem value="private-student-loan" className="text-white">Private Student Loan</SelectItem>
                          <SelectItem value="auto-loan" className="text-white">Auto Loan</SelectItem>
                          <SelectItem value="personal-loan" className="text-white">Personal Loan</SelectItem>
                          <SelectItem value="other" className="text-white">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-white">Description</Label>
                      <Input
                        {...register(`liabilities.${index}.description`)}
                        placeholder="e.g., Chase Visa"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Balance ($)</Label>
                      <Input
                        type="number"
                        {...register(`liabilities.${index}.balance`, { valueAsNumber: true })}
                        placeholder="0"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Monthly Payment ($)</Label>
                      <Input
                        type="number"
                        {...register(`liabilities.${index}.monthlyPayment`, { valueAsNumber: true })}
                        placeholder="0"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Interest Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`liabilities.${index}.interestRate`, { valueAsNumber: true })}
                        placeholder="0.00"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-white">Owner</Label>
                        <Select value={watch(`liabilities.${index}.owner`)} onValueChange={(value) => setValue(`liabilities.${index}.owner`, value, { shouldDirty: true })}>
                          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                            <SelectValue placeholder="Owner" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="User" className="text-white">You</SelectItem>
                            <SelectItem value="Spouse" className="text-white">Spouse</SelectItem>
                            <SelectItem value="Joint" className="text-white">Joint</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="button" onClick={() => removeLiability(index)} variant="destructive" size="icon">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      
      // Step 4: Real Estate Details
      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">Household Real Estate Details</h3>
            
            {/* Primary Residence */}
            <div className={`p-4 rounded-lg ${
              watch("primaryResidence._source.isImported") ? 'bg-purple-900/20 border border-purple-500/30' : ''
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-white">Primary Residence</h4>
                <div className="flex items-center gap-2">
                  {watch("primaryResidence._source.isImported") ? (
                    <div className="flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium">
                        Mortgage from {watch("primaryResidence._source.institutionName") || 'Bank'}
                      </span>
                    </div>
                  ) : (
                    <Button 
                      type="button" 
                      onClick={importMortgageFromPlaid}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1"
                    >
                      <Link2 className="w-3 h-3 mr-1" />
                      Import Mortgage from Plaid
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-white">Ownership</Label>
                  <Select value={watch("primaryResidence.owner")} onValueChange={(value) => setValue("primaryResidence.owner", value, { shouldDirty: true })}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-primary">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="User" className="text-white">You</SelectItem>
                      <SelectItem value="Spouse" className="text-white">Spouse</SelectItem>
                      <SelectItem value="Joint" className="text-white">Joint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-white">Estimated Market Value ($)</Label>
                  <Input
                    type="number"
                    {...register("primaryResidence.marketValue", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                </div>
                <div>
                  <Label className="text-white">Mortgage Balance ($)</Label>
                  <Input
                    type="number"
                    {...register("primaryResidence.mortgageBalance", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                </div>
                <div>
                  <Label className="text-white">Monthly Mortgage Payment ($)</Label>
                  <Input
                    type="number"
                    {...register("primaryResidence.monthlyPayment", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                </div>
                <div>
                  <Label className="text-white">Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register("primaryResidence.interestRate", { valueAsNumber: true })}
                    placeholder="0.00"
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                </div>
                <div>
                  <Label className="text-white">Years Until Mortgage is Paid Off</Label>
                  <Input
                    type="number"
                    {...register("primaryResidence.yearsToPayOffMortgage", { valueAsNumber: true })}
                    placeholder="e.g., 15"
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                </div>
              </div>
            </div>
            
            {/* Additional Properties */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-white">Additional Properties</h4>
                <Button type="button" onClick={addProperty} className="gradient-bg text-white hover:opacity-90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Property
                </Button>
              </div>
              
              {watchedAdditionalProperties?.map((property, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-4 p-4 bg-gray-800 rounded-lg mb-4">
                  <div>
                    <Label className="text-white">Property Type</Label>
                    <Select onValueChange={(value) => setValue(`additionalProperties.${index}.type`, value, { shouldDirty: true })}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="rental" className="text-white">Rental Property</SelectItem>
                        <SelectItem value="vacation" className="text-white">Vacation Home</SelectItem>
                        <SelectItem value="investment" className="text-white">Investment Property</SelectItem>
                        <SelectItem value="land" className="text-white">Land</SelectItem>
                        <SelectItem value="other" className="text-white">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Market Value ($)</Label>
                    <Input
                      type="number"
                      {...register(`additionalProperties.${index}.marketValue`, { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Mortgage Balance ($)</Label>
                    <Input
                      type="number"
                      {...register(`additionalProperties.${index}.mortgageBalance`, { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Monthly Payment ($)</Label>
                    <Input
                      type="number"
                      {...register(`additionalProperties.${index}.monthlyPayment`, { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Rental Income ($)</Label>
                    <Input
                      type="number"
                      {...register(`additionalProperties.${index}.rentalIncome`, { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Owner</Label>
                    <Select value={watch(`additionalProperties.${index}.owner`)} onValueChange={(value) => setValue(`additionalProperties.${index}.owner`, value, { shouldDirty: true })}>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Owner" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="User" className="text-white">You</SelectItem>
                        <SelectItem value="Spouse" className="text-white">Spouse</SelectItem>
                        <SelectItem value="Joint" className="text-white">Joint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={() => removeProperty(index)} variant="destructive" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      
      // Step 5: Monthly Expenses
      case 5:
        const watchedExpenses = watch("monthlyExpenses");
        
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white">Household Monthly Expenses & Emergency Fund</h3>
                <p className="text-gray-400 mt-2">Enter your typical monthly expenses in each category</p>
              </div>
              {hasPlaidAccounts && (
                <Button
                  type="button"
                  onClick={handleAutoFillExpenses}
                  disabled={isCategorizingExpenses}
                  variant="outline"
                  className="bg-purple-900/20 border-purple-500/30 hover:bg-purple-800/30 text-white"
                >
                  {isCategorizingExpenses ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Calculating Total...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      Calculate Total from Checking
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {/* Total Monthly Expenses with Manual Override */}
            <div className="bg-gray-800 p-6 rounded-lg mb-4">
              <h4 className="text-lg font-medium text-white mb-4">Total Monthly Expenses</h4>
              
              {categorizedData && (
                <Card className="bg-purple-900/20 border-purple-500/30 mb-4">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-purple-300 font-medium">
                        Checking Account Outflows (Last 30 Days)
                      </span>
                      <span className="text-2xl font-bold text-white">
                        ${categorizedData.totalExpenses?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>• {categorizedData.transactionCount} outflows from {categorizedData.accountCount} checking accounts</p>
                      <p>• Includes bills, credit card payments, transfers, purchases</p>
                      <p>• No double-counting (credit card transactions excluded)</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div>
                <Label className="text-white">Total Monthly Expenses (Manual Override)</Label>
                <Input
                  type="number"
                  {...register("totalMonthlyExpenses", { valueAsNumber: true })}
                  placeholder={categorizedData?.totalExpenses ? `$${Math.round(categorizedData.totalExpenses)}` : "Enter total monthly expenses"}
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Override the auto-calculated amount if needed. This total will be used for cash flow and retirement calculations.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-white">Housing (rent/mortgage, property tax, maintenance)</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.housing", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Transportation (car payment, gas, insurance)</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.transportation", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Food & Groceries</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.food", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Utilities</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.utilities", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Healthcare & Medical</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.healthcare", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Credit Card Debt Payments</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.creditCardPayments", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Student Loan Payments</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.studentLoanPayments", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Other Debt Payments</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.otherDebtPayments", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Clothing & Personal Care</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.clothing", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Entertainment & Recreation</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.entertainment", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-white">Other Expenses (e.g. expected income tax payments)</Label>
                <Input
                  type="number"
                  {...register("monthlyExpenses.other", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>
            </div>
            
            {/* Sum of Categorized Expenses */}
            {(() => {
              const expenses = watch("monthlyExpenses") || {};
              const categorizedSum = Object.values(expenses).reduce((sum: number, val: any) => {
                const num = typeof val === 'number' ? val : parseFloat(val) || 0;
                return sum + num;
              }, 0);
              
              if (categorizedSum > 0) {
                return (
                  <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-300 font-medium">
                        Sum of Categorized Expenses
                      </span>
                      <span className="text-xl font-bold text-white">
                        ${categorizedSum.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-blue-200 mt-1">
                      This detailed breakdown will be used for all calculations
                    </p>
                  </div>
                );
              }
              return null;
            })()}
            
{/* Emergency Fund */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-white mb-4">Emergency Fund</h4>
              <div>
                <Label className="text-white">Current Emergency Fund Size ($)</Label>
                <Input
                  type="number"
                  {...register("emergencyFundSize", { valueAsNumber: true })}
                  placeholder="$0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                />
              </div>

            </div>
          </div>
        );
      
      // Step 6: Insurance Coverage
      case 6:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">Household Insurance Coverage</h3>
            <p className="text-gray-400 mb-6">Please provide insurance details for all household members</p>
            
            {/* Your Life Insurance */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-white mb-4">Your Life Insurance</h4>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasLifeInsurance"
                    checked={watch("lifeInsurance.hasPolicy") || false}
                    onCheckedChange={(checked) => {
                      setValue("lifeInsurance.hasPolicy", checked as boolean, { shouldDirty: true });
                      trigger("lifeInsurance.hasPolicy");
                    }}
                  />
                  <Label htmlFor="hasLifeInsurance" className="text-white">I have life insurance</Label>
                </div>
                <div>
                  <Label className="text-white">Your Coverage Amount ($)</Label>
                  <Input
                    type="number"
                    {...register("lifeInsurance.coverageAmount", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Recommended: 10x your annual income</p>
                </div>
              </div>
            </div>

            {/* Spouse Life Insurance */}
            {(watchedMaritalStatus === "married") && (
              <div className="bg-gray-800 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-white mb-4">Spouse Life Insurance</h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasSpouseLifeInsurance"
                      checked={watch("spouseLifeInsurance.hasPolicy") || false}
                      onCheckedChange={(checked) => {
                        setValue("spouseLifeInsurance.hasPolicy", checked as boolean, { shouldDirty: true });
                        trigger("spouseLifeInsurance.hasPolicy");
                      }}
                    />
                    <Label htmlFor="hasSpouseLifeInsurance" className="text-white">Spouse has life insurance</Label>
                  </div>
                  <div>
                    <Label className="text-white">Spouse Coverage Amount ($)</Label>
                    <Input
                      type="number"
                      {...register("spouseLifeInsurance.coverageAmount", { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Recommended: 10x spouse's annual income</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Health Insurance */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-white mb-4">Household Health Insurance</h4>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasHealthInsurance"
                    checked={watch("healthInsurance.hasHealthInsurance") || false}
                    onCheckedChange={(checked) => {
                      setValue("healthInsurance.hasHealthInsurance", checked as boolean, { shouldDirty: true });
                      trigger("healthInsurance.hasHealthInsurance");
                    }}
                  />
                  <Label htmlFor="hasHealthInsurance" className="text-white">We have health insurance coverage</Label>
                </div>
                <p className="text-sm text-gray-400">Health insurance premiums should be included in your monthly healthcare expenses (Step 5).</p>
              </div>
            </div>
            
            {/* Your Disability Insurance */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-white mb-4">Your Disability Insurance</h4>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasDisabilityInsurance"
                    checked={watch("disabilityInsurance.hasDisability") || false}
                    onCheckedChange={(checked) => {
                      setValue("disabilityInsurance.hasDisability", checked as boolean, { shouldDirty: true });
                      trigger("disabilityInsurance.hasDisability");
                    }}
                  />
                  <Label htmlFor="hasDisabilityInsurance" className="text-white">I have disability insurance</Label>
                </div>
                <div>
                  <Label className="text-white">Monthly Benefit Amount ($)</Label>
                  <Input
                    type="number"
                    {...register("disabilityInsurance.benefitAmount", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Recommended: 60-70% of your monthly income</p>
                </div>
              </div>
            </div>

            {/* Spouse Disability Insurance */}
            {(watchedMaritalStatus === "married") && (
              <div className="bg-gray-800 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-white mb-4">Spouse Disability Insurance</h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasSpouseDisabilityInsurance"
                      checked={watch("spouseDisabilityInsurance.hasDisability") || false}
                      onCheckedChange={(checked) => {
                        setValue("spouseDisabilityInsurance.hasDisability", checked as boolean, { shouldDirty: true });
                        trigger("spouseDisabilityInsurance.hasDisability");
                      }}
                    />
                    <Label htmlFor="hasSpouseDisabilityInsurance" className="text-white">Spouse has disability insurance</Label>
                  </div>
                  <div>
                    <Label className="text-white">Spouse Monthly Benefit ($)</Label>
                    <Input
                      type="number"
                      {...register("spouseDisabilityInsurance.benefitAmount", { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Recommended: 60-70% of spouse's monthly income</p>
                  </div>
                </div>
              </div>
            )}

            {/* Home/Renters Insurance */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-white mb-4">Home/Renters Insurance</h4>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasHomeInsurance"
                    checked={watch("insurance.home") || false}
                    onCheckedChange={(checked) => {
                      setValue("insurance.home", checked as boolean, { shouldDirty: true });
                      trigger("insurance.home");
                    }}
                  />
                  <Label htmlFor="hasHomeInsurance" className="text-white">We have home/renters insurance</Label>
                </div>
                <div>
                  <Label className="text-white">Dwelling Coverage Limit ($)</Label>
                  <Input
                    type="number"
                    {...register("insurance.homeDwellingLimit", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Recommended: Replacement cost of your home</p>
                </div>
              </div>
            </div>

            {/* Auto Insurance */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-white mb-4">Auto Insurance</h4>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasAutoInsurance"
                    checked={watch("insurance.auto") || false}
                    onCheckedChange={(checked) => {
                      setValue("insurance.auto", checked as boolean, { shouldDirty: true });
                      trigger("insurance.auto");
                    }}
                  />
                  <Label htmlFor="hasAutoInsurance" className="text-white">We have auto insurance</Label>
                </div>
                <p className="text-sm text-gray-400">Enter liability limits (e.g., 100/300/100 means $100k per person, $300k per accident, $100k property damage)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-white">Bodily Injury Per Person ($)</Label>
                    <Input
                      type="number"
                      {...register("insurance.autoLiabilityLimits.bodilyInjuryPerPerson", { valueAsNumber: true })}
                      placeholder="100000"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Bodily Injury Per Accident ($)</Label>
                    <Input
                      type="number"
                      {...register("insurance.autoLiabilityLimits.bodilyInjuryPerAccident", { valueAsNumber: true })}
                      placeholder="300000"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Property Damage ($)</Label>
                    <Input
                      type="number"
                      {...register("insurance.autoLiabilityLimits.propertyDamage", { valueAsNumber: true })}
                      placeholder="100000"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Recommended minimum: 100/300/100 coverage. Auto insurance premiums should be included in your transportation expenses (Step 5).</p>
              </div>
            </div>

            {/* Umbrella Insurance */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-white mb-4">Umbrella Insurance</h4>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasUmbrellaInsurance"
                    checked={watch("insurance.umbrella") || false}
                    onCheckedChange={(checked) => {
                      setValue("insurance.umbrella", checked as boolean, { shouldDirty: true });
                      trigger("insurance.umbrella");
                    }}
                  />
                  <Label htmlFor="hasUmbrellaInsurance" className="text-white">We have umbrella insurance</Label>
                </div>
                <div>
                  <Label className="text-white">Coverage Limit ($)</Label>
                  <Input
                    type="number"
                    {...register("insurance.umbrellaLimit", { valueAsNumber: true })}
                    placeholder="1000000"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Recommended: $1-5 million for additional liability protection</p>
                </div>
              </div>
            </div>

            {/* Business Insurance (if self-employed) */}
            {watch("employmentStatus") === "self-employed" && (
              <div className="bg-gray-800 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-white mb-4">Business Insurance</h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasBusinessInsurance"
                      checked={watch("insurance.business") || false}
                      onCheckedChange={(checked) => {
                        setValue("insurance.business", checked as boolean, { shouldDirty: true });
                        trigger("insurance.business");
                      }}
                    />
                    <Label htmlFor="hasBusinessInsurance" className="text-white">I have business/general liability insurance</Label>
                  </div>
                  <p className="text-sm text-gray-400">Enter general liability (GL) limits</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white">Per Occurrence Limit ($)</Label>
                      <Input
                        type="number"
                        {...register("insurance.businessLiabilityLimits.perOccurrence", { valueAsNumber: true })}
                        placeholder="1000000"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Aggregate Limit ($)</Label>
                      <Input
                        type="number"
                        {...register("insurance.businessLiabilityLimits.aggregate", { valueAsNumber: true })}
                        placeholder="2000000"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Business insurance premiums should be included in your other expenses (Step 5).</p>
                </div>
              </div>
            )}
          </div>
        );
      
      // Step 7: Risk Profile & Investment Allocation
      case 7:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">Your Investment Risk Profile & Current Allocation</h3>
            
            {/* Simplified Risk Profile Question */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-white mb-4">Investment Risk Profile</h4>
              <p className="text-gray-400 mb-6">This single question will help determine your investment risk profile and recommended asset allocation.</p>
              
              <div className="space-y-4">
                <Label className="text-white text-base font-medium block mb-3">
                  What is your primary goal for this investment?
                </Label>
                <Select 
                  value={(() => {
                    // Map the stored risk score to the dropdown value
                    const riskScore = watch("riskQuestions")?.[0] || 1;
                    return riskScore.toString();
                  })()}
                  onValueChange={(value) => {
                    // Store the selected value as the risk score
                    const score = parseInt(value);
                    setValue("riskQuestions", [score], { shouldDirty: true });
                    trigger("riskQuestions");
                  }}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Select your primary investment goal" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="1" className="text-white">
                      <div>
                        <div className="font-medium">Preservation</div>
                        <div className="text-sm text-gray-400">My main goal is to protect my initial capital from any loss. I accept very low returns.</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="2" className="text-white">
                      <div>
                        <div className="font-medium">Income</div>
                        <div className="text-sm text-gray-400">My main goal is to generate regular income, with a small focus on growth. I accept low levels of risk.</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="3" className="text-white">
                      <div>
                        <div className="font-medium">Balance</div>
                        <div className="text-sm text-gray-400">I am seeking a balance between growth and capital preservation. I am willing to take on moderate risk for moderate returns.</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="4" className="text-white">
                      <div>
                        <div className="font-medium">Growth</div>
                        <div className="text-sm text-gray-400">My main goal is long-term capital growth. I am comfortable with significant market fluctuations to achieve higher returns.</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="5" className="text-white">
                      <div>
                        <div className="font-medium">Aggressive Growth</div>
                        <div className="text-sm text-gray-400">My main goal is to maximize my returns. I am willing to take on substantial risk, including the potential for major losses, for the highest possible growth.</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Display the mapped risk profile */}
                {watch("riskQuestions")?.[0] && (
                  <div className="mt-4 p-4 bg-purple-900/20 border border-purple-700 rounded-lg">
                    <p className="text-purple-200 text-sm">
                      <strong>Your Risk Profile:</strong> {
                        watch("riskQuestions")[0] === 1 ? "Conservative" :
                        watch("riskQuestions")[0] === 2 ? "Moderately Conservative" :
                        watch("riskQuestions")[0] === 3 ? "Moderate" :
                        watch("riskQuestions")[0] === 4 ? "Moderately Aggressive" :
                        "Aggressive"
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Current Allocation */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-medium text-white">Your Current Investment Allocation</h4>
                  <p className="text-gray-400 text-sm mt-1">Please enter the approximate percentage of your total investment portfolio allocated to each category.</p>
                </div>
                {hasPlaidAccounts && (
                  <Button
                    type="button"
                    onClick={async () => {
                      setIsLoadingAllocation(true);
                      try {
                        const response = await fetch('/api/plaid/portfolio-allocation', {
                          method: 'GET',
                          credentials: 'include',
                        });
                        const data = await response.json();
                        
                        if (data.success && data.allocation) {
                          // Auto-populate with user's allocation
                          const userAllocation = data.allocation.User;
                          const totalAllocation = data.allocation.Total;
                          
                          // Use user allocation if available, otherwise use total
                          const allocation = (userAllocation.stocks > 0 || userAllocation.bonds > 0 || userAllocation.cash > 0) 
                            ? userAllocation 
                            : totalAllocation;
                          
                          // All stocks are US stocks as per requirement
                          setValue('currentAllocation.usStocks', allocation.stocks);
                          setValue('currentAllocation.intlStocks', 0);
                          setValue('currentAllocation.bonds', allocation.bonds);
                          setValue('currentAllocation.alternatives', allocation.alternatives);
                          setValue('currentAllocation.cash', allocation.cash);
                          
                          toast({
                            title: 'Success',
                            description: `Imported allocation from ${data.accountCount} investment accounts`,
                          });
                        } else {
                          toast({
                            title: 'No Investment Accounts',
                            description: 'No investment accounts found to import from',
                            variant: 'destructive',
                          });
                        }
                      } catch (error) {
                        console.error('Failed to fetch allocation:', error);
                        toast({
                          title: 'Error',
                          description: 'Failed to import investment allocation',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsLoadingAllocation(false);
                      }
                    }}
                    disabled={isLoadingAllocation}
                    variant="outline"
                    className="bg-purple-900/20 border-purple-500/30 hover:bg-purple-800/30 text-white"
                  >
                    {isLoadingAllocation ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        Import from Investment Accounts
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-white">US Stocks (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("currentAllocation.usStocks", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">International Stocks (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("currentAllocation.intlStocks", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Bonds (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("currentAllocation.bonds", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Alternatives (REITs, Commodities) (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("currentAllocation.alternatives", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Cash (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("currentAllocation.cash", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>
              
              {/* Allocation Total Validation */}
              <div className="mt-4">
                {(() => {
                  const currentAllocation = watch("currentAllocation");
                  const total = (currentAllocation?.usStocks || 0) + 
                               (currentAllocation?.intlStocks || 0) + 
                               (currentAllocation?.bonds || 0) + 
                               (currentAllocation?.alternatives || 0) + 
                               (currentAllocation?.cash || 0);
                  
                  if (total > 0) {
                    return (
                      <div className={`p-3 rounded ${total === 100 ? 'bg-green-900/20 border border-green-700' : 'bg-orange-900/20 border border-orange-700'}`}>
                        <p className={`text-sm ${total === 100 ? 'text-green-200' : 'text-orange-200'}`}>
                          Total allocation: {total}%
                          {total !== 100 && (
                            <span className="block mt-1">
                              {total < 100 ? 
                                `Missing ${100 - total}% allocation` : 
                                `Over-allocated by ${total - 100}%`
                              }
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

          </div>
        );
      
      // Step 8: Spouse Risk Profile & Investment Allocation (only if married)
      case 8:
        if (watch("maritalStatus") !== "married") {
          // Skip to estate planning if not married - handle in nextStep function instead
          return (
            <div className="space-y-6">
              <p className="text-gray-400">Skipping spouse risk profile as you are not married. Click Next to continue.</p>
            </div>
          );
        }
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">{watch("spouseName") || "Spouse"}'s Investment Risk Profile & Current Allocation</h3>
            
            {/* Simplified Spouse Risk Profile Question */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-white mb-4">Investment Risk Profile</h4>
              <p className="text-gray-400 mb-6">This single question will help determine your spouse's investment risk profile and recommended asset allocation.</p>
              
              <div className="space-y-4">
                <Label className="text-white text-base font-medium block mb-3">
                  What is your spouse's primary goal for their investments?
                </Label>
                <Select 
                  value={(() => {
                    // Map the stored risk score to the dropdown value
                    const riskScore = watch("spouseRiskQuestions")?.[0] || 1;
                    return riskScore.toString();
                  })()}
                  onValueChange={(value) => {
                    // Store the selected value as the risk score
                    const score = parseInt(value);
                    setValue("spouseRiskQuestions", [score], { shouldDirty: true });
                    trigger("spouseRiskQuestions");
                  }}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Select your spouse's primary investment goal" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="1" className="text-white">
                      <div>
                        <div className="font-medium">Preservation</div>
                        <div className="text-sm text-gray-400">Main goal is to protect initial capital from any loss. Accepts very low returns.</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="2" className="text-white">
                      <div>
                        <div className="font-medium">Income</div>
                        <div className="text-sm text-gray-400">Main goal is to generate regular income, with a small focus on growth. Accepts low levels of risk.</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="3" className="text-white">
                      <div>
                        <div className="font-medium">Balance</div>
                        <div className="text-sm text-gray-400">Seeking a balance between growth and capital preservation. Willing to take on moderate risk for moderate returns.</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="4" className="text-white">
                      <div>
                        <div className="font-medium">Growth</div>
                        <div className="text-sm text-gray-400">Main goal is long-term capital growth. Comfortable with significant market fluctuations to achieve higher returns.</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="5" className="text-white">
                      <div>
                        <div className="font-medium">Aggressive Growth</div>
                        <div className="text-sm text-gray-400">Main goal is to maximize returns. Willing to take on substantial risk, including the potential for major losses, for the highest possible growth.</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Display the mapped risk profile */}
                {watch("spouseRiskQuestions")?.[0] && (
                  <div className="mt-4 p-4 bg-purple-900/20 border border-purple-700 rounded-lg">
                    <p className="text-purple-200 text-sm">
                      <strong>{watch("spouseName") || "Spouse"}'s Risk Profile:</strong> {
                        watch("spouseRiskQuestions")?.[0] === 1 ? "Conservative" :
                        watch("spouseRiskQuestions")?.[0] === 2 ? "Moderately Conservative" :
                        watch("spouseRiskQuestions")?.[0] === 3 ? "Moderate" :
                        watch("spouseRiskQuestions")?.[0] === 4 ? "Moderately Aggressive" :
                        "Aggressive"
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Spouse Current Allocation */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-medium text-white">{watch("spouseName") || "Spouse"}'s Current Investment Allocation</h4>
                  <p className="text-gray-400 text-sm mt-1">Please enter the approximate percentage of your spouse's total investment portfolio allocated to each category.</p>
                </div>
                {hasPlaidAccounts && (
                  <Button
                    type="button"
                    onClick={async () => {
                      setIsLoadingSpouseAllocation(true);
                      try {
                        const response = await fetch('/api/plaid/portfolio-allocation', {
                          method: 'GET',
                          credentials: 'include',
                        });
                        const data = await response.json();
                        
                        if (data.success && data.allocation) {
                          // Auto-populate with spouse's allocation
                          const spouseAllocation = data.allocation.Spouse;
                          const jointAllocation = data.allocation.Joint;
                          const totalAllocation = data.allocation.Total;
                          
                          // Use spouse allocation if available, then joint, then total
                          const allocation = (spouseAllocation.stocks > 0 || spouseAllocation.bonds > 0 || spouseAllocation.cash > 0) 
                            ? spouseAllocation 
                            : (jointAllocation.stocks > 0 || jointAllocation.bonds > 0 || jointAllocation.cash > 0)
                            ? jointAllocation
                            : totalAllocation;
                          
                          // All stocks are US stocks as per requirement
                          setValue('spouseAllocation.usStocks', allocation.stocks);
                          setValue('spouseAllocation.intlStocks', 0);
                          setValue('spouseAllocation.bonds', allocation.bonds);
                          setValue('spouseAllocation.alternatives', allocation.alternatives);
                          setValue('spouseAllocation.cash', allocation.cash);
                          
                          toast({
                            title: 'Success',
                            description: `Imported spouse allocation from ${data.accountCount} investment accounts`,
                          });
                        } else {
                          toast({
                            title: 'No Investment Accounts',
                            description: 'No investment accounts found to import from',
                            variant: 'destructive',
                          });
                        }
                      } catch (error) {
                        console.error('Failed to fetch allocation:', error);
                        toast({
                          title: 'Error',
                          description: 'Failed to import investment allocation',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsLoadingSpouseAllocation(false);
                      }
                    }}
                    disabled={isLoadingSpouseAllocation}
                    variant="outline"
                    className="bg-purple-900/20 border-purple-500/30 hover:bg-purple-800/30 text-white"
                  >
                    {isLoadingSpouseAllocation ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        Import from Investment Accounts
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-white">US Stocks (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("spouseAllocation.usStocks", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">International Stocks (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("spouseAllocation.intlStocks", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Bonds (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("spouseAllocation.bonds", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Alternatives (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("spouseAllocation.alternatives", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">REITs, commodities, private equity</p>
                </div>
                <div>
                  <Label className="text-white">Cash & Money Market (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...register("spouseAllocation.cash", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>
              <div className="mt-4 p-3 bg-purple-900/20 border border-purple-700 rounded-lg">
                <p className="text-purple-200 text-sm">
                  <strong>Note:</strong> All percentages should add up to 100%. If you're unsure about your spouse's exact allocation, provide your best estimate based on their investment accounts.
                </p>
              </div>
            </div>
          </div>
        );

      // Step 9: Estate Planning
      case 9:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">Household Estate Planning</h3>
            <p className="text-gray-400 mb-6">Let us know about your existing estate planning documents</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="hasWill"
                    checked={watch("hasWill") || false}
                    onCheckedChange={(checked) => {
                      setValue("hasWill", checked as boolean, { shouldDirty: true });
                      trigger("hasWill");
                    }}
                  />
                  <Label htmlFor="hasWill" className="text-white">I have a signed Will</Label>
                </div>
              </div>
              
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="hasTrust"
                    checked={watch("hasTrust") || false}
                    onCheckedChange={(checked) => {
                      setValue("hasTrust", checked as boolean, { shouldDirty: true });
                      trigger("hasTrust");
                    }}
                  />
                  <Label htmlFor="hasTrust" className="text-white">I have a Living Trust</Label>
                </div>
              </div>
              
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="hasPowerOfAttorney"
                    checked={watch("hasPowerOfAttorney") || false}
                    onCheckedChange={(checked) => {
                      setValue("hasPowerOfAttorney", checked as boolean, { shouldDirty: true });
                      trigger("hasPowerOfAttorney");
                    }}
                  />
                  <Label htmlFor="hasPowerOfAttorney" className="text-white">I have Power of Attorney</Label>
                </div>
              </div>
              
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="hasHealthcareProxy"
                    checked={watch("hasHealthcareProxy") || false}
                    onCheckedChange={(checked) => {
                      setValue("hasHealthcareProxy", checked as boolean, { shouldDirty: true });
                      trigger("hasHealthcareProxy");
                    }}
                  />
                  <Label htmlFor="hasHealthcareProxy" className="text-white">I have Healthcare Proxy</Label>
                </div>
              </div>
              
              <div className="bg-gray-800 p-6 rounded-lg md:col-span-2">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="hasBeneficiaries"
                    checked={watch("hasBeneficiaries") || false}
                    onCheckedChange={(checked) => {
                      setValue("hasBeneficiaries", checked as boolean, { shouldDirty: true });
                      trigger("hasBeneficiaries");
                    }}
                  />
                  <Label htmlFor="hasBeneficiaries" className="text-white">I have designated beneficiaries on all accounts</Label>
                </div>
              </div>
            </div>
          </div>
        );
      
      // Step 10: Tax Information
      case 10:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">Household Tax Information</h3>
            <p className="text-gray-400 mb-6">Provide information from your most recent tax return</p>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-white">Last Year's Adjusted Gross Income (AGI) ($)</Label>
                  <Input
                    type="number"
                    {...register("lastYearAGI", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                  {watch("lastYearAGI") > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {watch("maritalStatus") === "married" && watch("spouseAnnualIncome") > 0
                        ? "Auto-filled with household income (your income + spouse income)"
                        : "Auto-filled with your annual income from Step 2"}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-white">Total Deductions ($)</Label>
                  <Input
                    type="number"
                    {...register("deductionAmount", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-800 border-gray-700 text-white focus:border-primary"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-white">Tax Filing Status</Label>
                <Select value={watch("taxFilingStatus")} onValueChange={(value) => setValue("taxFilingStatus", value, { shouldDirty: true })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white focus:border-primary">
                    <SelectValue placeholder="Select filing status" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="single" className="text-white">Single</SelectItem>
                    <SelectItem value="married-jointly" className="text-white">Married Filing Jointly</SelectItem>
                    <SelectItem value="married-separately" className="text-white">Married Filing Separately</SelectItem>
                    <SelectItem value="head-of-household" className="text-white">Head of Household</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              

            </div>
          </div>
        );
      
      // Step 11: Comprehensive Retirement Planning (Combined)
      case 11:
        console.log('Rendering step 11 - Retirement Planning');
        
        // Get current values for display (but don't calculate in render)
        const userIncome = watch("annualIncome") || 0;
        const userAge = watch("dateOfBirth") ? new Date().getFullYear() - new Date(watch("dateOfBirth")).getFullYear() : 30;
        const userLifeExpectancy = watch("userLifeExpectancy") || 93;
        const desiredRetirementAge = watch("desiredRetirementAge") || 65;
        const userSelectedSSAge = watch("socialSecurityClaimAge") || watch("desiredRetirementAge") || 65;
        const spouseSelectedSSAge = watch("spouseSocialSecurityClaimAge") || watch("spouseDesiredRetirementAge") || 65;
        const spouseIncome = watch("spouseAnnualIncome") || 0;
        const spouseDOB = watch("spouseDateOfBirth");
        const spouseAge = spouseDOB ? new Date().getFullYear() - new Date(spouseDOB).getFullYear() : 30;
        const spouseLifeExpectancy = watch("spouseLifeExpectancy") || 93;
        
        // Get calculated benefits for display (these will be set by useEffect)
        const userBenefitAtSelectedAge = watch("socialSecurityBenefit") || 0;
        const spouseBenefitAtSelectedAge = watch("spouseSocialSecurityBenefit") || 0;
        
        // Calculate optimal ages for display only (no setValue calls)
        const userAIME = userIncome > 0 ? calculateAIME(userIncome, userAge, 67) : 0;
        const userPIA = userAIME > 0 ? calculatePrimaryInsuranceAmount(userAIME) : 0;
        const userSSAnalysis = userPIA > 0 ? calculateOptimalSocialSecurityAge(
          userAge,
          67,
          userPIA,
          userLifeExpectancy,
          0.03
        ) : { optimalClaimingAge: 67, monthlyBenefitAtOptimal: 0 };
        
        const spouseAIME = spouseIncome > 0 && watchedMaritalStatus === "married" ? calculateAIME(spouseIncome, spouseAge, 67) : 0;
        const spousePIA = spouseAIME > 0 ? calculatePrimaryInsuranceAmount(spouseAIME) : 0;
        const spouseSSAnalysis = spousePIA > 0 && watchedMaritalStatus === "married" ? calculateOptimalSocialSecurityAge(
          spouseAge,
          67,
          spousePIA,
          spouseLifeExpectancy,
          0.03
        ) : null;
        
        // Auto-calculate retirement expenses - use explicit budget if set, otherwise default 70/30
        const totalRetirementExpenses = watch("expectedMonthlyExpensesRetirement") || 0;
        const budgetEssential = watch("retirementExpenseBudget.essential") || 0;
        const budgetDiscretionary = watch("retirementExpenseBudget.discretionary") || 0;
        const retirementEssentialExpenses = budgetEssential > 0 ? Math.round(budgetEssential) : Math.round(totalRetirementExpenses * 0.7);
        const retirementDiscretionaryExpenses = budgetDiscretionary > 0 ? Math.round(budgetDiscretionary) : Math.round(totalRetirementExpenses * 0.3);
        
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-6 text-white">Comprehensive Retirement Planning</h3>
            
            {/* Incentive Message */}
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="bg-blue-600 rounded-full p-2 flex-shrink-0">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="text-blue-100 font-medium mb-2">Why This Step Matters</h4>
                  <p className="text-blue-200 text-sm leading-relaxed">
                    This information will be used to calculate your <strong>Retirement Confidence Score</strong> based on Monte Carlo simulations, 
                    a comprehensive assessment that models thousands of scenarios to determine your probability of retirement success.
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-gray-400 mb-6">Tell us about your retirement goals and we'll calculate your retirement success probability</p>
            
            {/* User Retirement Information */}
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
              <h4 className="text-lg font-medium text-white mb-4">Your Retirement Planning</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Desired Retirement Age</Label>
                  <Input
                    type="number"
                    min="50"
                    max="85"
                    {...register("desiredRetirementAge", { valueAsNumber: true })}
                    placeholder="65"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Age you plan to retire</p>
                </div>
                
                <div>
                  <Label className="text-white">Social Security Claim Age</Label>
                  <div className="space-y-2">
                    <Select
                      value={watch("socialSecurityClaimAge")?.toString() || desiredRetirementAge?.toString() || "65"}
                      onValueChange={(value) => setValue("socialSecurityClaimAge", parseInt(value))}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select claim age" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="62" className="text-white hover:bg-gray-700">
                          Age 62 (Earliest - Reduced Benefits)
                        </SelectItem>
                        {/* Always show retirement age as an option if it's different from standard ages */}
                        {desiredRetirementAge && desiredRetirementAge !== 62 && desiredRetirementAge !== 67 && desiredRetirementAge !== 70 && (
                          <SelectItem value={desiredRetirementAge.toString()} className="text-white hover:bg-gray-700">
                            Age {desiredRetirementAge} (Your Retirement Age)
                          </SelectItem>
                        )}
                        {desiredRetirementAge === 67 ? (
                          <SelectItem value="67" className="text-white hover:bg-gray-700">
                            Age 67 (Full Retirement Age / Your Retirement Age)
                          </SelectItem>
                        ) : (
                          <SelectItem value="67" className="text-white hover:bg-gray-700">
                            Age 67 (Full Retirement Age)
                          </SelectItem>
                        )}
                        {desiredRetirementAge === 70 ? (
                          <SelectItem value="70" className="text-white hover:bg-gray-700">
                            Age 70 (Maximum Benefits / Your Retirement Age)
                          </SelectItem>
                        ) : (
                          <SelectItem value="70" className="text-white hover:bg-gray-700">
                            Age 70 (Maximum Benefits)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">
                      Claiming at {watch("socialSecurityClaimAge") || desiredRetirementAge || 65}: 
                      ${userBenefitAtSelectedAge?.toFixed(0) || 0}/month
                    </p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-white">Health Status</Label>
                  <Select
                    value={watch("userHealthStatus") || "good"}
                    onValueChange={(value) => setValue("userHealthStatus", value as 'excellent' | 'good' | 'fair' | 'poor')}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Select health status" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="excellent" className="text-white hover:bg-gray-700">
                        Excellent Health
                      </SelectItem>
                      <SelectItem value="good" className="text-white hover:bg-gray-700">
                        Good Health (Default)
                      </SelectItem>
                      <SelectItem value="fair" className="text-white hover:bg-gray-700">
                        Fair Health
                      </SelectItem>
                      <SelectItem value="poor" className="text-white hover:bg-gray-700">
                        Poor Health / Chronic Conditions
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400 mt-1">Your health status affects life expectancy assumptions</p>
                </div>
                
                <div>
                  <Label className="text-white">Life Expectancy</Label>
                  <Input
                    type="number"
                    min="70"
                    max="120"
                    {...register("userLifeExpectancy", { valueAsNumber: true })}
                    placeholder="93"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Automatically adjusted based on health status (can override)</p>
                </div>
                
                <div>
                  <Label className="text-white">Expected Monthly Expenses in Retirement (Today's Dollars) ($)</Label>
                  <Input
                    type="number"
                    {...register("expectedMonthlyExpensesRetirement", { valueAsNumber: true })}
                    placeholder="5000"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Enter the amount in today's dollars - we'll automatically adjust for inflation. Total monthly expenses you expect in retirement (if healthcare not included, we'll add ~$1,500-2,500/month for a couple)</p>
                </div>

                {/* Retirement Expense Estimator */}
                <div className="bg-blue-900/30 border border-blue-600/30 rounded-lg p-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-5 w-5 text-blue-400" />
                    <h5 className="text-sm font-medium text-blue-100">Smart Expense Estimator</h5>
                  </div>
                  
                  {(() => {
                    // Get current form values for calculation
                    const currentExpenses = watch("monthlyExpenses") || {};
                    const totalMonthlyExpenses = watch("totalMonthlyExpenses");
                    const primaryResidence = watch("primaryResidence") || {};
                    const currentAge = watch("dateOfBirth") ? new Date().getFullYear() - new Date(watch("dateOfBirth")!).getFullYear() : 30;
                    const retirementAge = watch("desiredRetirementAge") || 65;
                    const maritalStatus = watch("maritalStatus");
                    const state = watch("state");
                    const retirementState = watch("retirementState") || state;

                    // Normalize numeric inputs (server may return strings)
                    const toNum = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : parseFloat(v as any) || 0);
                    const expenseValues = Object.values(currentExpenses).map(toNum);
                    const hasCategorizedExpenses = expenseValues.some(n => n > 0);
                    const monthlyPaymentNum = toNum((primaryResidence as any).monthlyPayment);

                    // Calculate years until retirement (allow 0 = retiring now)
                    const yearsUntilRetirement = Math.max(0, retirementAge - currentAge);

                    // Use total monthly expenses if available, otherwise sum categorized expenses
                    const hasTotalExpenses = toNum(totalMonthlyExpenses) > 0;
                    const hasEnoughData = currentAge > 0 && yearsUntilRetirement >= 0 &&
                      (hasTotalExpenses || hasCategorizedExpenses || monthlyPaymentNum > 0);

                    if (!hasEnoughData) {
                      return (
                        <p className="text-sm text-gray-400 text-center py-4">
                          Complete your monthly expenses to see estimated retirement expenses
                        </p>
                      );
                    }

                    // Calculate estimate
                    let estimate;
                    
                    if (hasTotalExpenses) {
                      const retirementTotal = Math.round(toNum(totalMonthlyExpenses) * 0.7);
                      estimate = {
                        total: retirementTotal,
                        essential: Math.round(retirementTotal * 0.7),
                        discretionary: Math.round(retirementTotal * 0.3),
                        breakdown: {
                          housing: 0,
                          healthcare: Math.round(retirementTotal * 0.2),
                          food: Math.round(retirementTotal * 0.15),
                          other: Math.round(retirementTotal * 0.65)
                        },
                        notes: [`Based on 70% of current total expenses ($${toNum(totalMonthlyExpenses).toLocaleString()})`]
                      };
                    } else {
                      // Use detailed categorized calculation
                      estimate = estimateRetirementExpensesFromInputs({
                        monthlyExpenses: Object.fromEntries(Object.entries(currentExpenses).map(([k, v]) => [k, toNum(v as any)])),
                        primaryResidence,
                        yearsUntilRetirement,
                        maritalStatus,
                        state,
                        retirementState
                      });
                    }

                    return (
                      <div className="space-y-3">
                        <div className="bg-gray-800/50 rounded p-3">
                          <div className="text-center mb-3">
                            <div className="text-2xl font-bold text-blue-300">
                              ${estimate.total.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-400">Estimated Monthly Retirement Expenses</div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-green-400 font-medium">Essential: ${estimate.essential.toLocaleString()}</div>
                              <div className="text-xs text-gray-400">Housing, food, healthcare, etc.</div>
                            </div>
                            <div>
                              <div className="text-orange-400 font-medium">Discretionary: ${estimate.discretionary.toLocaleString()}</div>
                              <div className="text-xs text-gray-400">Entertainment, travel, etc.</div>
                            </div>
                          </div>
                          
                          {estimate.mortgagePayoffSavings > 0 && (
                            <div className="mt-2 p-2 bg-green-900/30 rounded text-xs">
                              <div className="text-green-300">💰 Mortgage payoff savings: ${estimate.mortgagePayoffSavings.toLocaleString()}/month</div>
                            </div>
                          )}
                        </div>
                        
                        {estimate.notes.length > 0 && (
                          <div className="text-xs text-gray-400 space-y-1">
                            <div className="font-medium">Calculation notes:</div>
                            {estimate.notes.map((note, index) => (
                              <div key={index}>• {note}</div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              // Update the retirement expenses field
                              setValue("expectedMonthlyExpensesRetirement", estimate.total);
                              
                              // Update retirement expense budget with detailed breakdown
                              setValue("retirementExpenseBudget", {
                                essential: estimate.essential,
                                discretionary: estimate.discretionary
                              });
                              
                              // Show success feedback
                              const successToast = document.createElement('div');
                              successToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50';
                              successToast.textContent = '✓ Estimate applied successfully!';
                              document.body.appendChild(successToast);
                              setTimeout(() => document.body.removeChild(successToast), 3000);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Use This Estimate
                          </Button>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Show detailed breakdown in a styled modal
                              const modal = document.createElement('div');
                              modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
                              
                              const modalContent = document.createElement('div');
                              modalContent.className = 'bg-gray-800 border border-gray-600 rounded-lg max-w-md w-full p-6 text-white';
                              
                              const header = document.createElement('div');
                              header.className = 'flex justify-between items-center mb-4';
                              header.innerHTML = '<h3 class="text-lg font-semibold">Detailed Breakdown</h3>';
                              
                              const closeBtn = document.createElement('button');
                              closeBtn.className = 'text-gray-400 hover:text-white';
                              closeBtn.textContent = '✕';
                              closeBtn.onclick = () => modal.remove();
                              header.appendChild(closeBtn);
                              
                              const content = document.createElement('div');
                              content.className = 'space-y-3 text-sm';
                              content.innerHTML = 
                                '<div class="text-center p-3 bg-gray-700 rounded">' +
                                  '<div class="text-xl font-bold text-blue-300">$' + estimate.total.toLocaleString() + '/month</div>' +
                                  '<div class="text-gray-400">Total Estimated Expenses</div>' +
                                '</div>' +
                                '<div class="grid grid-cols-2 gap-3">' +
                                  '<div class="bg-green-900/30 p-3 rounded">' +
                                    '<div class="font-medium text-green-300">Essential: $' + estimate.essential.toLocaleString() + '</div>' +
                                    '<div class="text-xs text-gray-400 mt-1">Housing: $' + estimate.housingAtRetirement.toLocaleString() + '</div>' +
                                    '<div class="text-xs text-gray-400">Property Tax: $' + estimate.propertyTaxMonthly.toLocaleString() + '</div>' +
                                  '</div>' +
                                  '<div class="bg-orange-900/30 p-3 rounded">' +
                                    '<div class="font-medium text-orange-300">Discretionary: $' + estimate.discretionary.toLocaleString() + '</div>' +
                                    '<div class="text-xs text-gray-400 mt-1">Travel, entertainment, hobbies</div>' +
                                  '</div>' +
                                '</div>' +
                                (estimate.mortgagePayoffSavings > 0 ? 
                                  '<div class="bg-green-900/30 border border-green-600/30 rounded p-2">' +
                                    '<div class="text-green-300 text-xs">💰 Mortgage payoff savings: $' + estimate.mortgagePayoffSavings.toLocaleString() + '/month</div>' +
                                  '</div>' : '') +
                                (estimate.notes.length > 0 ? 
                                  '<div class="bg-gray-700 rounded p-3">' +
                                    '<div class="font-medium mb-2 text-gray-300">Calculation Notes:</div>' +
                                    estimate.notes.map(note => '<div class="text-xs text-gray-400">• ' + note + '</div>').join('') +
                                  '</div>' : '');
                              
                              const closeButton = document.createElement('button');
                              closeButton.className = 'mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded';
                              closeButton.textContent = 'Close';
                              closeButton.onclick = () => modal.remove();
                              
                              modalContent.appendChild(header);
                              modalContent.appendChild(content);
                              modalContent.appendChild(closeButton);
                              modal.appendChild(modalContent);
                              
                              modal.onclick = (e) => {
                                if (e.target === modal) modal.remove();
                              };
                              
                              document.body.appendChild(modal);
                            }}
                            className="border-gray-600 text-gray-300 hover:bg-gray-700 bg-gray-800"
                          >
                            <Info className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            
            {/* Spouse Retirement Information - only show if married */}
            {watchedMaritalStatus === "married" && (
              <div className="bg-gray-800 p-6 rounded-lg space-y-4">
                <h4 className="text-lg font-medium text-white mb-4">Spouse Retirement Planning</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Spouse Desired Retirement Age</Label>
                    <Input
                      type="number"
                      min="50"
                      max="85"
                      {...register("spouseDesiredRetirementAge", { valueAsNumber: true })}
                      placeholder="65"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Age your spouse plans to retire</p>
                  </div>
                  
                  <div>
                    <Label className="text-white">Spouse Social Security Claim Age</Label>
                    <div className="space-y-2">
                      <Select
                        value={watch("spouseSocialSecurityClaimAge")?.toString() || watch("spouseDesiredRetirementAge")?.toString() || "65"}
                        onValueChange={(value) => setValue("spouseSocialSecurityClaimAge", parseInt(value))}
                      >
                        <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                          <SelectValue placeholder="Select claim age" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="62" className="text-white hover:bg-gray-700">
                            Age 62 (Earliest - Reduced Benefits)
                          </SelectItem>
                          {/* Always show spouse retirement age as an option if it's different from standard ages */}
                          {watch("spouseDesiredRetirementAge") && watch("spouseDesiredRetirementAge") !== 62 && watch("spouseDesiredRetirementAge") !== 67 && watch("spouseDesiredRetirementAge") !== 70 && (
                            <SelectItem value={watch("spouseDesiredRetirementAge")!.toString()} className="text-white hover:bg-gray-700">
                              Age {watch("spouseDesiredRetirementAge")} (Spouse's Retirement Age)
                            </SelectItem>
                          )}
                          {(watch("spouseDesiredRetirementAge") || 0) === 67 ? (
                            <SelectItem value="67" className="text-white hover:bg-gray-700">
                              Age 67 (Full Retirement Age / Spouse's Retirement Age)
                            </SelectItem>
                          ) : (
                            <SelectItem value="67" className="text-white hover:bg-gray-700">
                              Age 67 (Full Retirement Age)
                            </SelectItem>
                          )}
                          {watch("spouseDesiredRetirementAge") === 70 ? (
                            <SelectItem value="70" className="text-white hover:bg-gray-700">
                              Age 70 (Maximum Benefits / Spouse's Retirement Age)
                            </SelectItem>
                          ) : (
                            <SelectItem value="70" className="text-white hover:bg-gray-700">
                              Age 70 (Maximum Benefits)
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-400">
                        Claiming at {watch("spouseSocialSecurityClaimAge") || watch("spouseDesiredRetirementAge") || 65}: 
                        ${spouseBenefitAtSelectedAge?.toFixed(0) || 0}/month
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-white">Spouse Health Status</Label>
                    <Select
                      value={watch("spouseHealthStatus") || "good"}
                      onValueChange={(value) => setValue("spouseHealthStatus", value as 'excellent' | 'good' | 'fair' | 'poor')}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select health status" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="excellent" className="text-white hover:bg-gray-700">
                          Excellent Health
                        </SelectItem>
                        <SelectItem value="good" className="text-white hover:bg-gray-700">
                          Good Health (Default)
                        </SelectItem>
                        <SelectItem value="fair" className="text-white hover:bg-gray-700">
                          Fair Health
                        </SelectItem>
                        <SelectItem value="poor" className="text-white hover:bg-gray-700">
                          Poor Health / Chronic Conditions
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400 mt-1">Spouse's health status affects life expectancy assumptions</p>
                  </div>
                  
                  <div>
                    <Label className="text-white">Spouse Life Expectancy</Label>
                    <Input
                      type="number"
                      min="70"
                      max="120"
                      {...register("spouseLifeExpectancy", { valueAsNumber: true })}
                      placeholder="93"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Automatically adjusted based on health status (can override)</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Legacy Planning */}
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
              <h4 className="text-lg font-medium text-white mb-4">Legacy Planning</h4>
              
              <div>
                <Label className="text-white">Legacy Goal ($)</Label>
                <Input
                  type="number"
                  {...register("legacyGoal", { valueAsNumber: true })}
                  placeholder="0"
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">Amount you wish to leave as inheritance</p>
              </div>
            </div>
            
            {/* Additional Retirement Details */}
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
              <h4 className="text-lg font-medium text-white mb-4">Additional Retirement Details</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Retirement State</Label>
                  <p className="text-sm text-gray-400 mb-2">
                    Tax-friendly states: FL, TX, NV, WA, AK, SD, WY, TN, NH (no income tax), 
                    IL, PA (no tax on retirement income)
                  </p>
                  <Select value={watch("retirementState") || ""} onValueChange={(value) => setValue("retirementState", value, { shouldDirty: true })}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Select a state" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      <SelectItem value="AL" className="text-white">Alabama</SelectItem>
                      <SelectItem value="AK" className="text-white">Alaska</SelectItem>
                      <SelectItem value="AZ" className="text-white">Arizona</SelectItem>
                      <SelectItem value="AR" className="text-white">Arkansas</SelectItem>
                      <SelectItem value="CA" className="text-white">California</SelectItem>
                      <SelectItem value="CO" className="text-white">Colorado</SelectItem>
                      <SelectItem value="CT" className="text-white">Connecticut</SelectItem>
                      <SelectItem value="DE" className="text-white">Delaware</SelectItem>
                      <SelectItem value="FL" className="text-white">Florida</SelectItem>
                      <SelectItem value="GA" className="text-white">Georgia</SelectItem>
                      <SelectItem value="HI" className="text-white">Hawaii</SelectItem>
                      <SelectItem value="ID" className="text-white">Idaho</SelectItem>
                      <SelectItem value="IL" className="text-white">Illinois</SelectItem>
                      <SelectItem value="IN" className="text-white">Indiana</SelectItem>
                      <SelectItem value="IA" className="text-white">Iowa</SelectItem>
                      <SelectItem value="KS" className="text-white">Kansas</SelectItem>
                      <SelectItem value="KY" className="text-white">Kentucky</SelectItem>
                      <SelectItem value="LA" className="text-white">Louisiana</SelectItem>
                      <SelectItem value="ME" className="text-white">Maine</SelectItem>
                      <SelectItem value="MD" className="text-white">Maryland</SelectItem>
                      <SelectItem value="MA" className="text-white">Massachusetts</SelectItem>
                      <SelectItem value="MI" className="text-white">Michigan</SelectItem>
                      <SelectItem value="MN" className="text-white">Minnesota</SelectItem>
                      <SelectItem value="MS" className="text-white">Mississippi</SelectItem>
                      <SelectItem value="MO" className="text-white">Missouri</SelectItem>
                      <SelectItem value="MT" className="text-white">Montana</SelectItem>
                      <SelectItem value="NE" className="text-white">Nebraska</SelectItem>
                      <SelectItem value="NV" className="text-white">Nevada</SelectItem>
                      <SelectItem value="NH" className="text-white">New Hampshire</SelectItem>
                      <SelectItem value="NJ" className="text-white">New Jersey</SelectItem>
                      <SelectItem value="NM" className="text-white">New Mexico</SelectItem>
                      <SelectItem value="NY" className="text-white">New York</SelectItem>
                      <SelectItem value="NC" className="text-white">North Carolina</SelectItem>
                      <SelectItem value="ND" className="text-white">North Dakota</SelectItem>
                      <SelectItem value="OH" className="text-white">Ohio</SelectItem>
                      <SelectItem value="OK" className="text-white">Oklahoma</SelectItem>
                      <SelectItem value="OR" className="text-white">Oregon</SelectItem>
                      <SelectItem value="PA" className="text-white">Pennsylvania</SelectItem>
                      <SelectItem value="RI" className="text-white">Rhode Island</SelectItem>
                      <SelectItem value="SC" className="text-white">South Carolina</SelectItem>
                      <SelectItem value="SD" className="text-white">South Dakota</SelectItem>
                      <SelectItem value="TN" className="text-white">Tennessee</SelectItem>
                      <SelectItem value="TX" className="text-white">Texas</SelectItem>
                      <SelectItem value="UT" className="text-white">Utah</SelectItem>
                      <SelectItem value="VT" className="text-white">Vermont</SelectItem>
                      <SelectItem value="VA" className="text-white">Virginia</SelectItem>
                      <SelectItem value="WA" className="text-white">Washington</SelectItem>
                      <SelectItem value="WV" className="text-white">West Virginia</SelectItem>
                      <SelectItem value="WI" className="text-white">Wisconsin</SelectItem>
                      <SelectItem value="WY" className="text-white">Wyoming</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400 mt-1">State where you plan to retire</p>
                </div>
                
                <div>
                  <Label className="text-white">Expected Inflation Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    {...register("expectedInflationRate", { valueAsNumber: true })}
                    placeholder="2"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Expected annual inflation rate (default: 2% - Fed target rate)</p>
                </div>
              </div>
              
              {/* Part-time Work Section */}
              <div className="mt-6">
                <h5 className="text-md font-medium text-white mb-4">Part-time Work in Retirement</h5>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* User Part-time Income */}
                  <div className="space-y-2">
                    <Label className="text-white">Your Monthly Part-time Income ($)</Label>
                    <Input
                      type="number"
                      {...register("partTimeIncomeRetirement", { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-xs text-gray-400">Expected monthly income from part-time work (enter 0 if none)</p>
                  </div>
                  
                  {/* Spouse Part-time Income */}
                  {watchedMaritalStatus === "married" && (
                    <div className="space-y-2">
                      <Label className="text-white">Spouse's Monthly Part-time Income ($)</Label>
                      <Input
                        type="number"
                        {...register("spousePartTimeIncomeRetirement", { valueAsNumber: true })}
                        placeholder="0"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                      <p className="text-xs text-gray-400">Expected monthly income from spouse's part-time work (enter 0 if none)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            

            {/* Auto-calculated Social Security Benefits */}
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
              <h4 className="text-lg font-medium text-white mb-4">Estimated Social Security Benefits</h4>
              <p className="text-sm text-gray-400 mb-4">Calculated using 2025 benefit formula with 2.6% annual COLA adjustments • Maximum benefits capped per SSA limits</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700 p-4 rounded">
                  <Label className="text-white">Your Estimated Benefit at Selected Claim Age</Label>
                  <p className="text-2xl font-semibold text-green-400">${Math.round(userBenefitAtSelectedAge)}/month</p>
                  <p className="text-xs text-gray-400 mt-1">Based on ${(watch("annualIncome") || 0).toLocaleString()}/year income (claiming at age {watch("socialSecurityClaimAge") || watch("desiredRetirementAge") || 65})</p>
                  <input type="hidden" {...register("socialSecurityBenefit", { valueAsNumber: true })} />
                </div>
                
                {watchedMaritalStatus === "married" && (
                  <div className="bg-gray-700 p-4 rounded">
                    <Label className="text-white">Spouse's Estimated Benefit at Selected Claim Age</Label>
                    <p className="text-2xl font-semibold text-green-400">${Math.round(spouseBenefitAtSelectedAge)}/month</p>
                    <p className="text-xs text-gray-400 mt-1">Based on ${(watch("spouseAnnualIncome") || 0).toLocaleString()}/year income (claiming at age {watch("spouseSocialSecurityClaimAge") || watch("spouseDesiredRetirementAge") || 65})</p>
                  </div>
                )}
                
                <div>
                  <Label className="text-white">Your Pension Benefits ($/month)</Label>
                  <Input
                    type="number"
                    {...register("pensionBenefit", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">If you have a pension plan</p>
                </div>
                
                {watchedMaritalStatus === "married" && (
                  <div>
                    <Label className="text-white">Spouse's Pension Benefits ($/month)</Label>
                    <Input
                      type="number"
                      {...register("spousePensionBenefit", { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">If your spouse has a pension plan</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Retirement Contributions */}
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
              <h4 className="text-lg font-medium text-white mb-4">Current Retirement Contributions</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Your Monthly Contribution ($)</Label>
                  <Input
                    type="number"
                    {...register("retirementContributions.employee", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">401(k), 403(b), 457(b), etc.</p>
                </div>
                
                <div>
                  <Label className="text-white">Employer Match/Contribution ($/month)</Label>
                  <Input
                    type="number"
                    {...register("retirementContributions.employer", { valueAsNumber: true })}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Employer matching contributions</p>
                </div>
              </div>
              
              {/* IRA Contributions */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <h5 className="text-md font-medium text-white mb-4">Annual IRA Contributions</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Your Traditional IRA ($)</Label>
                    <Input
                      type="number"
                      {...register("traditionalIRAContribution", { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Annual Traditional IRA contribution</p>
                  </div>
                  
                  <div>
                    <Label className="text-white">Your Roth IRA ($)</Label>
                    <Input
                      type="number"
                      {...register("rothIRAContribution", { valueAsNumber: true })}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Annual Roth IRA contribution</p>
                  </div>
                </div>
                
                {/* 2025 IRA Contribution Limits Info */}
                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-300">
                    <span className="font-semibold">2025 IRA Contribution Limits:</span> $7,000 per year (under age 50), $8,000 per year (age 50+)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Combined Traditional + Roth IRA contributions cannot exceed annual limit
                  </p>
                </div>
              </div>
              
              {/* User Contribution Validation */}
              <ContributionLimitInfo birthDate={watch("dateOfBirth")} showDetails={true} />
              <ContributionValidationMessage validation={userRetirementValidation} />
              
              {/* Spouse Retirement Contributions - only show if married */}
              {watchedMaritalStatus === "married" && (
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <h5 className="text-md font-medium text-white mb-4">Spouse Retirement Contributions</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white">Spouse Monthly Contribution ($)</Label>
                      <Input
                        type="number"
                        {...register("spouseRetirementContributions.employee", { valueAsNumber: true })}
                        placeholder="0"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">401(k), 403(b), 457(b), etc.</p>
                    </div>
                    
                    <div>
                      <Label className="text-white">Spouse Employer Match/Contribution ($/month)</Label>
                      <Input
                        type="number"
                        {...register("spouseRetirementContributions.employer", { valueAsNumber: true })}
                        placeholder="0"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">Spouse employer matching</p>
                    </div>
                  </div>
                  
                  {/* Spouse Contribution Validation */}
                  <ContributionLimitInfo birthDate={watch("spouseDateOfBirth")} showDetails={true} />
                  <ContributionValidationMessage validation={spouseRetirementValidation} />
                  
                  {/* Spouse IRA Contributions */}
                  <div className="mt-6 pt-6 border-t border-gray-700">
                    <h5 className="text-md font-medium text-white mb-4">Spouse Annual IRA Contributions</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white">Spouse Traditional IRA ($)</Label>
                        <Input
                          type="number"
                          {...register("spouseTraditionalIRAContribution", { valueAsNumber: true })}
                          placeholder="0"
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">Annual Traditional IRA contribution</p>
                      </div>
                      
                      <div>
                        <Label className="text-white">Spouse Roth IRA ($)</Label>
                        <Input
                          type="number"
                          {...register("spouseRothIRAContribution", { valueAsNumber: true })}
                          placeholder="0"
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">Annual Roth IRA contribution</p>
                      </div>
                    </div>
                    
                    {/* 2025 IRA Contribution Limits Info */}
                    <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-300">
                        <span className="font-semibold">2025 IRA Contribution Limits:</span> $7,000 per year (under age 50), $8,000 per year (age 50+)
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Combined Traditional + Roth IRA contributions cannot exceed annual limit
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Investment Assumptions */}
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
              <h4 className="text-lg font-medium text-white mb-4">Investment Assumptions</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Investment Strategy removed - now uses risk profile-based returns */}
                <div>
                  <Label className="text-white">Withdrawal Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    {...register("withdrawalRate", { valueAsNumber: true })}
                    placeholder="4"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Safe withdrawal rate in retirement</p>
                </div>
              </div>
            </div>
            
            {/* Long-term Care Insurance */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasLongTermCareInsurance"
                  {...register("hasLongTermCareInsurance")}
                  className="border-gray-600"
                  checked={watch("hasLongTermCareInsurance") || false}
                  onCheckedChange={(checked) => setValue("hasLongTermCareInsurance", checked as boolean)}
                />
                <Label htmlFor="hasLongTermCareInsurance" className="text-white cursor-pointer">
                  I have long-term care insurance
                </Label>
              </div>
            </div>
            
            {/* Additional Notes */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <Label className="text-white">Additional Notes</Label>
              <textarea
                {...register("additionalNotes")}
                placeholder="Any additional retirement planning details you'd like to share..."
                className="w-full h-24 px-3 py-2 mt-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
            
            <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
              <p className="text-purple-200 text-sm">
                This information will be used to calculate your Retirement Confidence Score based on 
                Monte Carlo simulations, a comprehensive assessment that models thousands of scenarios 
                to determine your probability of retirement success.
              </p>
            </div>
          </div>
        );
      
      // Step 12 removed - combined with Step 11
      case 12:
        // Step 12 is now combined with Step 11 - redirect to default
        return null;
      
      default:
        return (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold mb-4 text-white">Step {currentStep}</h3>
            <p className="text-gray-400">This step is not yet implemented.</p>
          </div>
        );
    }
  };

  const progress = (currentStep / totalSteps) * 100;

  // Section configurations for navigation
  const sectionConfig = [
    { 
      id: 'personal',
      name: 'Personal',
      icon: User,
      steps: [1, 2],
      description: 'Personal & Income'
    },
    { 
      id: 'financial',
      name: 'Financial',
      icon: DollarSign,
      steps: [3, 4, 5],
      description: 'Assets & Expenses'
    },
    { 
      id: 'protection',
      name: 'Protection',
      icon: Shield,
      steps: [6],
      description: 'Insurance Coverage'
    },
    { 
      id: 'investment',
      name: 'Investment',
      icon: TrendingUp,
      steps: [7, 8],
      description: 'Risk & Allocation'
    },
    { 
      id: 'planning',
      name: 'Planning',
      icon: Target,
      steps: [9, 10, 11],
      description: 'Estate & Retirement'
    }
  ];

  // Get section completion status
  const getSectionStatus = (sectionSteps: number[]) => {
    // For initial mode, check if we've passed all steps in the section
    if (editMode === 'initial') {
      const maxStepInSection = Math.max(...sectionSteps);
      if (currentStep > maxStepInSection) return 'completed';
      if (sectionSteps.includes(currentStep)) return 'active';
      return 'pending';
    }
    
    // For edit mode, check if section has data (simplified)
    return 'completed'; // Assume completed for edit mode
  };

  // Jump to specific section
  const jumpToSection = (sectionSteps: number[]) => {
    const firstStep = Math.min(...sectionSteps);
    setCurrentStep(firstStep);
  };

  // Map section types to step numbers
  const getSectionStepsBySectionType = (sectionType: string): number[] => {
    switch (sectionType) {
      case 'personal': return [1, 2];
      case 'financial': return [3, 4, 5];
      case 'protection': return [6];
      case 'investment': return [7, 8];
      case 'planning': return [9, 10, 11];
      default: return [1];
    }
  };

  // Session timer for gamification
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStartTime]);

  // Listen for section jump events from dashboard
  useEffect(() => {
    const handleJumpToSection = (event: CustomEvent) => {
      const { sectionType } = event.detail;
      const steps = getSectionStepsBySectionType(sectionType);
      jumpToSection(steps);
      setEditMode('edit');
    };

    const handleGoToStep = (event: CustomEvent) => {
      const { step } = event.detail;
      if (step >= 1 && step <= totalSteps) {
        setCurrentStep(step);
        setEditMode('edit');
      }
    };

    window.addEventListener('jumpToSection', handleJumpToSection as EventListener);
    window.addEventListener('goToStep', handleGoToStep as EventListener);

    return () => {
      window.removeEventListener('jumpToSection', handleJumpToSection as EventListener);
      window.removeEventListener('goToStep', handleGoToStep as EventListener);
    };
  }, []);

  // Gamification event handlers
  const handleMomentumBoost = () => {
    setMomentum(prev => Math.min(100, prev + 20));
  };

  const handleNewAchievement = (achievement: any) => {
    console.log('Achievement unlocked:', achievement.title);
  };

  const handleCelebrationComplete = () => {
    // Celebration completed
  };

  // Show loading state while data is being loaded
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{loadingSeconds}s</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-white text-lg font-medium">Loading your financial information...</p>
                <p className="text-gray-400 text-sm">
                  {loadingSeconds < 2 && "Retrieving your data..."}
                  {loadingSeconds >= 2 && loadingSeconds < 4 && "Processing financial details..."}
                  {loadingSeconds >= 4 && "Almost there..."}
                </p>
              </div>
              {loadingSeconds > 3 && (
                <div className="mt-4">
                  <div className="w-48 h-2 bg-gray-700 rounded-full mx-auto overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((loadingSeconds / 5) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading screen during submission
  if (isSubmitting) {
    const getProgressMessage = () => {
      if (submitProgress <= 20) return "Validating financial data...";
      if (submitProgress <= 40) return "Calculating financial health metrics...";
      if (submitProgress <= 60) return "Generating personalized recommendations...";
      if (submitProgress <= 80) return "Creating your dashboard...";
      return "Finalizing your financial plan...";
    };

    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="card-gradient border-gray-700">
            <CardContent className="p-12 text-center">
              <div className="mb-8">
                <div className="w-16 h-16 mx-auto mb-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <h2 className="text-2xl font-bold mb-2 text-white">Processing Your Financial Plan</h2>
                <p className="text-gray-400">
                  Please wait while we analyze your information and create personalized recommendations
                </p>
              </div>
              
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-white">{getProgressMessage()}</span>
                  <span className="text-sm text-primary font-medium">{submitProgress}%</span>
                </div>
                <Progress value={submitProgress} className="h-3" />
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                <div className="text-2xl font-mono text-primary mb-1">
                  {Math.floor(submitTimer / 60).toString().padStart(2, '0')}:
                  {(submitTimer % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-400">Processing Time</div>
              </div>

              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Data validation complete</span>
                </div>
                {submitProgress >= 40 && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Financial calculations complete</span>
                  </div>
                )}
                {submitProgress >= 60 && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Recommendations generated</span>
                  </div>
                )}
                {submitProgress >= 80 && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Dashboard created</span>
                  </div>
                )}
                {submitProgress >= 100 && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Redirecting to dashboard...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Form Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2 text-white">Financial Information Intake</h2>
          <p className="text-gray-400">
            Please provide your financial information to get personalized recommendations. Your progress is automatically saved.
          </p>
        </div>
        
        {/* Section Navigation */}
        <div className="mb-8">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="grid grid-cols-5 gap-2 max-w-5xl mx-auto">
              {sectionConfig.map((section) => {
                const status = getSectionStatus(section.steps);
                const IconComponent = section.icon;
                const isActive = section.steps.includes(currentStep);
                
                return (
                  <button
                    key={section.id}
                    onClick={() => jumpToSection(section.steps)}
                    className={`
                      flex flex-col items-center gap-1 px-3 py-3 rounded-lg transition-all min-h-[80px] relative
                      ${isActive 
                        ? 'bg-[#B040FF] text-white shadow-lg' 
                        : status === 'completed'
                        ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                      }
                    `}
                  >
                    <div className="flex items-center gap-1">
                      <IconComponent className="w-4 h-4" />
                      {status === 'completed' && (
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      )}
                      {isActive && (
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <div className="text-center flex-1 flex flex-col justify-center">
                      <div className="text-sm font-medium">{section.name}</div>
                      <div className="text-xs opacity-80 leading-tight">{section.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gamification Components */}
        <SessionTracker 
          currentStep={currentStep}
          totalSteps={totalSteps}
          onMomentumBoost={handleMomentumBoost}
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <AchievementBadges 
              currentStep={currentStep}
              totalSteps={totalSteps}
              sessionTime={sessionTime}
              onNewAchievement={handleNewAchievement}
            />
            
            <LiveInsights 
              formData={watch()}
              currentStep={currentStep}
            />
          </div>
          
          <div>
            <ActivityFeed currentStep={currentStep} />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-white">Progress</span>
            <span className="text-sm text-gray-400">
              Step {currentStep} of {totalSteps}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Form */}
        <Card className="card-gradient border-gray-700 relative">
          {/* Loading Overlay */}
          {isSavingStep && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 rounded-lg flex items-center justify-center">
              <div className="bg-gray-800/90 rounded-lg p-6 shadow-xl border border-gray-700">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  <div className="text-center">
                    <p className="text-white font-semibold">Saving your progress...</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {saveElapsedTime > 0 ? `${saveElapsedTime} second${saveElapsedTime !== 1 ? 's' : ''} elapsed` : 'Please wait'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Auto-save indicator */}
          {isAutoSaving && (
            <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {!isAutoSaving && lastSaveTime && (
            <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-green-500">
              <CheckCircle className="h-4 w-4" />
              <span>Saved {new Date(lastSaveTime).toLocaleTimeString()}</span>
            </div>
          )}
          <CardContent className="p-8">
            <form onSubmit={handleSubmit(onSubmit)}>
              {renderStep()}
              
              {/* Navigation Buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-700">
                <TrackingButton
                  type="button"
                  onClick={previousStep}
                  disabled={currentStep === 1 || isSavingStep}
                  className="
                    px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 transform hover:scale-105
                    bg-gray-800 text-gray-300 border-2 border-gray-600 
                    hover:bg-gray-700 hover:border-gray-500 hover:text-white
                    disabled:bg-gray-900 disabled:text-gray-500 disabled:border-gray-700 
                    disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100
                    shadow-lg hover:shadow-xl
                    min-w-[120px]
                  "
                  actionType="form-navigation"
                  actionTarget="intake-form"
                  actionValue={-1}
                >
                  ← Previous
                </TrackingButton>
                
                {/* Progress indicator in center */}
                <div className="flex items-center space-x-2 px-4">
                  <div className="text-xs font-medium text-gray-400">
                    Step {currentStep} of {totalSteps}
                  </div>
                </div>

                <TrackingButton
                  type={currentStep === totalSteps ? "submit" : "button"}
                  onClick={currentStep === totalSteps ? undefined : nextStep}
                  disabled={isSavingStep}
                  className="
                    px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 transform hover:scale-105
                    bg-gradient-to-r from-[#8A00C4] to-[#a020f0] text-white
                    hover:from-[#7A00B4] hover:to-[#9010e0] hover:shadow-lg hover:shadow-purple-500/25
                    active:scale-95 shadow-lg
                    min-w-[140px]
                    disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100
                  "
                  actionType={currentStep === totalSteps ? "form-completion" : "form-navigation"}
                  actionTarget="intake-form"
                  actionValue={1}
                  celebrationText={currentStep === totalSteps ? "Form Complete! 🎉" : "Progress Made!"}
                  xpReward={currentStep === totalSteps ? 100 : 10}
                >
                  {isSavingStep ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                      {saveElapsedTime > 0 && (
                        <span className="text-xs opacity-80">({saveElapsedTime}s)</span>
                      )}
                    </div>
                  ) : (
                    <>
                      {currentStep === totalSteps ? "Submit ✓" : "Next →"}
                      {/* Debug info */}
                      <span className="ml-2 text-xs text-white opacity-80">
                        (Step {currentStep}/{totalSteps})
                      </span>
                    </>
                  )}
                </TrackingButton>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Celebration Effects */}
        <CelebrationEffects 
          currentStep={currentStep}
          totalSteps={totalSteps}
          momentum={momentum}
          onCelebrationComplete={handleCelebrationComplete}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent className="bg-gray-800 border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Remove Item</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Are you sure you want to remove <span className="text-white font-medium">{itemToDelete?.name}</span>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConfirm}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Main exported component with gamification wrapper
export function IntakeForm() {
  const { user } = useAuth();
  const [disableTracking, setDisableTracking] = useState(false);

  const handleSubmissionStart = React.useCallback(() => {
    setDisableTracking(true);
  }, []);

  return (
    <GamificationWrapper
      userId={user?.id || null}
      section="intake-form"
      trackActions={!disableTracking}
      trackTime={!disableTracking}
    >
      <IntakeFormContent onSubmissionStart={handleSubmissionStart} />
    </GamificationWrapper>
  );
}
