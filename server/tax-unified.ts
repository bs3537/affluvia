import { getTaxConfig, calculateFederalTaxWithYear, calculateCapitalGainsTaxWithYear } from './tax-year-config.ts';
import { calculateStateTax } from './state-tax-config.ts';

export interface UnifiedTaxInputs {
  year: number;
  filingStatus: 'single' | 'married' | 'head_of_household';
  state: string;

  ordinaryIncome: number;
  capitalGainsIncome: number;
  socialSecurityGross?: number;
  pensionIncome?: number;

  // Optional details for enhanced accuracy
  age?: number;          // taxpayer age (for senior additional deduction)
  spouseAge?: number;    // spouse age (for senior additional deduction)
  earnedIncome?: number; // W-2/SE income for Additional Medicare Tax

  useItemized?: boolean;
  saltPaid?: number;
  mortgageInterest?: number;
  charitableGifts?: number;
  medicalExpenses?: number;
  otherItemized?: number;

  qbiIncome?: number;

  // Optional ACA reconciliation inputs
  aca?: {
    aptcApplied: number;            // APTC actually applied (from monthly advance credits)
    benchmarkAnnual: number;        // Annual household SLCSP benchmark
    months: number;                 // Months enrolled on exchange (1-12)
    householdSize: number;          // Household size for FPL
    state?: string;                 // State for FPL adjustment
  };
}

export interface UnifiedTaxResult {
  federalTax: number;
  stateTax: number;
  capitalGainsTax: number;
  niitTax: number;
  additionalMedicareTax: number;
  amtTax: number;
  totalTax: number;
  deductionType: 'standard' | 'itemized';
  deductionAmount: number;
  taxableOrdinaryIncome: number;
  taxableCapitalGains: number;
  acaReconciliation?: number; // negative = additional credit, positive = repayment
}

function taxableSocialSecurity(ssGross: number, otherIncome: number, filingStatus: 'single' | 'married' | 'head_of_household'): number {
  if (ssGross <= 0) return 0;
  const provisionalIncome = otherIncome + 0.5 * ssGross;
  const singleLike = filingStatus === 'single' || filingStatus === 'head_of_household';
  const thresholds = singleLike ? { first: 25000, second: 34000 } : { first: 32000, second: 44000 };
  if (provisionalIncome <= thresholds.first) return 0;
  if (provisionalIncome <= thresholds.second) {
    const excess = provisionalIncome - thresholds.first;
    return Math.min(excess * 0.5, ssGross * 0.5);
  }
  const firstTier = (thresholds.second - thresholds.first) * 0.5;
  const secondTier = (provisionalIncome - thresholds.second) * 0.85;
  return Math.min(firstTier + secondTier, ssGross * 0.85);
}

// ACA support: simplified FPL and expected contribution
function fplAmount(year: number, householdSize: number, state?: string): number {
  const base2024 = 15060;
  const addl = 5380;
  const st = (state || '').toUpperCase();
  let fpl = base2024 + Math.max(0, householdSize - 1) * addl;
  if (st === 'AK') fpl *= 1.25;
  if (st === 'HI') fpl *= 1.15;
  const yrs = Math.max(0, year - 2024);
  return fpl * Math.pow(1.015, yrs);
}

function acaExpectedContributionPct(incomeAsFpl: number): number {
  if (incomeAsFpl <= 1.5) return 0.00;
  if (incomeAsFpl <= 2.0) return 0.02 * (incomeAsFpl - 1.5) / 0.5;
  if (incomeAsFpl <= 2.5) return 0.02 + (0.04 - 0.02) * (incomeAsFpl - 2.0) / 0.5;
  if (incomeAsFpl <= 3.0) return 0.04 + (0.06 - 0.04) * (incomeAsFpl - 2.5) / 0.5;
  if (incomeAsFpl <= 4.0) return 0.06 + (0.085 - 0.06) * (incomeAsFpl - 3.0) / 1.0;
  return 0.085;
}

function acaRepaymentCap(fplRatio: number, filingStatus: 'single' | 'married' | 'head_of_household'): number {
  // Simplified 2024 repayment caps (approximate, USD). HoH treated as single.
  const isMarried = filingStatus === 'married';
  if (fplRatio <= 2.0) return isMarried ? 650 : 325;
  if (fplRatio <= 3.0) return isMarried ? 1300 : 650;
  if (fplRatio <= 4.0) return isMarried ? 2800 : 1400;
  return Infinity;
}

export function calculateUnifiedTaxes(inp: UnifiedTaxInputs): UnifiedTaxResult {
  const year = inp.year;
  const cfg = getTaxConfig(year);

  const ssTaxableEstimate = taxableSocialSecurity(inp.socialSecurityGross || 0, inp.ordinaryIncome, inp.filingStatus);
  const agiBase = Math.max(0, inp.ordinaryIncome + ssTaxableEstimate);

  // Standard deduction with senior adders (65+)
  let standardDeduction = cfg.standardDeduction[inp.filingStatus];
  const isMarried = inp.filingStatus === 'married';
  const age = inp.age ?? 0;
  const spouseAge = inp.spouseAge ?? 0;
  if (isMarried) {
    let seniorAdd = 0;
    if (age >= 65) seniorAdd += cfg.seniorAdditionalDeduction.married;
    if (spouseAge >= 65) seniorAdd += cfg.seniorAdditionalDeduction.married;
    standardDeduction += seniorAdd;
  } else {
    if (age >= 65) standardDeduction += cfg.seniorAdditionalDeduction.single;
  }
  let medicalDeductible = 0;
  if (inp.medicalExpenses && inp.medicalExpenses > 0) {
    const threshold = 0.075 * agiBase;
    medicalDeductible = Math.max(0, inp.medicalExpenses - threshold);
  }
  const saltCap = 10000;
  const saltDeduct = Math.min(saltCap, Math.max(0, inp.saltPaid || 0));
  const itemized = (saltDeduct + (inp.mortgageInterest || 0) + (inp.charitableGifts || 0) + medicalDeductible + (inp.otherItemized || 0));

  const chooseItemized = inp.useItemized ? true : itemized > standardDeduction;
  const deductionAmount = chooseItemized ? itemized : standardDeduction;
  const deductionType: 'standard' | 'itemized' = chooseItemized ? 'itemized' : 'standard';

  let taxableOrdinary = Math.max(0, agiBase - deductionAmount);
  let qbiDeduction = 0;
  if (inp.qbiIncome && inp.qbiIncome > 0 && taxableOrdinary > 0) {
    qbiDeduction = Math.min(0.20 * inp.qbiIncome, 0.20 * taxableOrdinary);
    taxableOrdinary = Math.max(0, taxableOrdinary - qbiDeduction);
  }

  const capitalGainsTax = calculateCapitalGainsTaxWithYear(inp.capitalGainsIncome, taxableOrdinary, inp.filingStatus, year);
  const federalOrdTax = calculateFederalTaxWithYear(taxableOrdinary, inp.filingStatus, year);

  const niitThreshold = cfg.niitThreshold[inp.filingStatus];
  const totalTaxableIncomeForNIIT = taxableOrdinary + inp.capitalGainsIncome;
  let niitTax = 0;
  if (totalTaxableIncomeForNIIT > niitThreshold && inp.capitalGainsIncome > 0) {
    const niitBase = Math.min(inp.capitalGainsIncome, totalTaxableIncomeForNIIT - niitThreshold);
    niitTax = 0.038 * niitBase;
  }

  // Additional Medicare Tax (0.9%) on wages over thresholds
  let additionalMedicareTax = 0;
  if ((inp.earnedIncome || 0) > 0) {
    const threshold = inp.filingStatus === 'married' ? 250000 : 200000;
    const base = Math.max(0, (inp.earnedIncome as number) - threshold);
    additionalMedicareTax = 0.009 * base;
  }

  // Simplified AMT calculation
  const amtExemption = inp.filingStatus === 'married' ? 133300 : 85700; // 2024
  const amtPhaseoutStart = inp.filingStatus === 'married' ? 1218700 : 609350; // 2024
  const amtIncome = taxableOrdinary + inp.capitalGainsIncome; // Approximate AMTI base
  const excess = Math.max(0, amtIncome - amtPhaseoutStart);
  const exemption = Math.max(0, amtExemption - 0.25 * excess);
  const amtBaseOrdinary = Math.max(0, taxableOrdinary - exemption);
  const amt26Cap = 232600; // 2024 26%/28% breakpoint
  const amtOrdTax = Math.min(amtBaseOrdinary, amt26Cap) * 0.26 + Math.max(0, amtBaseOrdinary - amt26Cap) * 0.28;
  const tentativeMinTax = amtOrdTax + capitalGainsTax; // LTCG at pref rates under AMT
  const regularFedTax = federalOrdTax + capitalGainsTax + niitTax + additionalMedicareTax;
  const amtTax = Math.max(0, tentativeMinTax - regularFedTax);
  // ACA APTC reconciliation (optional)
  let acaReconciliation = 0;
  if (inp.aca) {
    const months = Math.max(0, Math.min(12, Math.round(inp.aca.months || 12)));
    const hhSize = Math.max(1, Math.round(inp.aca.householdSize || 1));
    const fpl = fplAmount(year, hhSize, inp.aca.state || inp.state);
    const agiForACA = taxableOrdinary + inp.capitalGainsIncome; // approx MAGI base (excludes SS exempt portion)
    const fplRatio = fpl > 0 ? (agiForACA / fpl) : 5;
    const expPct = acaExpectedContributionPct(fplRatio);
    const annualExpectedContribution = expPct * agiForACA;
    const allowedPTCFullYear = Math.max(0, (inp.aca.benchmarkAnnual || 0) - annualExpectedContribution);
    const allowedPTC = allowedPTCFullYear * (months / 12);
    const aptcApplied = Math.max(0, inp.aca.aptcApplied || 0);
    let delta = allowedPTC - aptcApplied; // negative => repayment? Actually if allowed < applied, delta < 0 (repayment)
    if (delta < 0) {
      // Repayment (limit by cap)
      const cap = acaRepaymentCap(fplRatio, inp.filingStatus);
      const repay = Math.min(-delta, cap);
      acaReconciliation = repay; // add to tax
    } else if (delta > 0) {
      // Additional credit
      acaReconciliation = -delta; // reduce tax
    }
  }

  const federalTax = regularFedTax + amtTax + (acaReconciliation > 0 ? acaReconciliation : 0);

  // State base income excludes Social Security; we add state-taxable SS inside calculateStateTax
  const stateBaseIncome = (inp.ordinaryIncome + inp.capitalGainsIncome);
  const stateRes = calculateStateTax(stateBaseIncome, inp.pensionIncome || 0, inp.socialSecurityGross || 0, inp.filingStatus, inp.state, inp.age);
  const stateTax = Math.max(0, stateRes.tax);

  return {
    federalTax,
    stateTax,
    capitalGainsTax,
    niitTax,
    additionalMedicareTax,
    amtTax,
    totalTax: federalTax + stateTax + (acaReconciliation < 0 ? acaReconciliation : 0),
    deductionType,
    deductionAmount,
    taxableOrdinaryIncome: taxableOrdinary,
    taxableCapitalGains: inp.capitalGainsIncome,
    acaReconciliation
  };
}
