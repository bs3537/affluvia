import type { EducationGoal, FinancialProfile } from "./types.ts";
import { RNG, hash32 } from "./rng.ts";

export interface EducationMonteCarloOptions {
  iterations?: number; // default 1000
  targetSuccessRate?: number; // default 80 (%)
  allowLoans?: boolean; // default true if goal.loanPerYear > 0
  extraYearProbability?: number; // default 0.18 (18%)
}

export interface EducationMonteCarloSummary {
  // PRIMARY: Affordability-constrained comprehensive coverage
  probabilityOfSuccess: number; // percent 0-100 (affordability-constrained)
  probabilityOfComprehensiveCoverage: number; // percent 0-100
  probabilityNoLoan: number; // percent 0-100
  scenarios: { successful: number; failed: number; total: number };
  shortfallPercentiles: { p10: number; p50: number; p90: number };
  recommendedMonthlyContribution: number; // to reach target success rate
}

/**
 * Compute American Opportunity Tax Credit for a given year based on cash-paid qualified expenses and MAGI.
 * Assumptions (2025):
 * - Max credit $2,500 (100% of first $2k + 25% of next $2k of qualified expenses paid with non-529 dollars)
 * - Phaseout: Single $80k–$90k; MFJ $160k–$180k; HOH treated as Single here
 * - Up to $1,000 refundable portion ignored in cashflow timing (credit not used as direct funding in success test)
 */
function computeAOTC(cashQualifiedSpend: number, filingStatus?: string | null, magi?: number | null): number {
  const base = Math.max(0, cashQualifiedSpend);
  const prePhase = Math.min(2000, base) + 0.25 * Math.min(Math.max(base - 2000, 0), 2000);
  const maxCredit = 2500;
  const gross = Math.min(prePhase, maxCredit);

  const fs = (filingStatus || "single").toLowerCase();
  const isSingleLike = fs === "single" || fs === "head_of_household";
  const lo = isSingleLike ? 80000 : 160000;
  const hi = isSingleLike ? 90000 : 180000;

  if (magi == null) return gross; // if unknown, do not phase out
  if (magi <= lo) return gross;
  if (magi >= hi) return 0;
  const phase = 1 - (magi - lo) / (hi - lo);
  return Math.max(0, gross * phase);
}

/** Determine annual return params from risk profile. */
function getReturnParams(risk?: string | null): { mu: number; sigma: number } {
  const rp = (risk || "moderate").toLowerCase();
  switch (rp) {
    case "conservative":
      return { mu: 0.045, sigma: 0.08 };
    case "aggressive":
      return { mu: 0.08, sigma: 0.20 };
    case "glide":
      return { mu: 0.06, sigma: 0.12 };
    default:
      return { mu: 0.06, sigma: 0.15 };
  }
}

/**
 * AR(1) year-over-year inflation generator around a long-run mean.
 * pi_y = mu + phi*(pi_{y-1}-mu) + sigma*eps
 */
function nextInflation(prev: number, mu: number, rng: RNG, phi = 0.6, sigma = 0.02): number {
  const eps = rng.normal();
  const val = mu + phi * (prev - mu) + sigma * eps;
  return Math.max(-0.05, Math.min(0.20, val)); // clamp to reasonable bounds
}

/** Draw net price shock (institutional grant volatility) as log-normal multiplier. */
function drawNetPriceShock(rng: RNG, sigma: number = 0.10): number {
  // lognormal with median 1.0
  const z = rng.normal();
  const s = sigma;
  const m = -0.5 * s * s;
  return Math.exp(m + s * z);
}

// Amortize a loan (Parent PLUS-like default unless goal overrides)
function amortizeMonthlyPayment(totalLoan: number, annualRatePct: number, years: number): number {
  if (totalLoan <= 0 || years <= 0) return 0;
  const r = (annualRatePct / 100) / 12;
  const n = years * 12;
  if (r === 0) return totalLoan / n;
  return totalLoan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function getMonthlyIncome(profile: FinancialProfile | null): number {
  if (!profile) return 0;
  const a = Number(profile.annualIncome ?? 0);
  const b = Number(profile.spouseAnnualIncome ?? 0);
  return (a + b) / 12;
}

function getExistingMonthlyDebt(profile: FinancialProfile | null): number {
  if (!profile || !Array.isArray((profile as any).liabilities)) return 0;
  return ((profile as any).liabilities as any[])
    .filter(l => l.type === 'mortgage' || l.type === 'auto_loan' || l.type === 'personal_loan')
    .reduce((sum, l) => sum + (Number(l.monthlyPayment || 0)), 0);
}

// Expected first-year salary (explicit or default heuristic)
function getExpectedStartingSalary(goal: EducationGoal, profile: FinancialProfile | null): number {
  const explicit = Number((goal as any).expectedStartingSalary ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const degree = (((goal as any).degreeType) || "undergraduate").toString().toLowerCase();
  // Simple heuristic defaults; can be replaced with NACE/BLS integration
  return degree === "masters" ? 75000 : 55000;
}

// Option C affordability: payment <= 8–10% of gross monthly income AND DTI <= 43%
// Also enforce total loans <= expected first-year salary and be supportable by household monthly cash flow
function isAffordable(totalLoans: number, goal: EducationGoal, profile: FinancialProfile | null): boolean {
  if (totalLoans <= 0) return true;
  const monthlyIncome = getMonthlyIncome(profile);
  if (monthlyIncome <= 0) return false;
  // Salary-based soft cap
  const startingSalary = getExpectedStartingSalary(goal, profile);
  if (startingSalary > 0 && totalLoans > startingSalary) return false;
  const rate = Number((goal as any).loanInterestRate ?? 10);
  const years = Number((goal as any).loanRepaymentTerm ?? 10);
  const pay = amortizeMonthlyPayment(totalLoans, rate, years);
  const existingDebt = getExistingMonthlyDebt(profile);
  const dti = (existingDebt + pay) / monthlyIncome;
  const burden = pay / monthlyIncome;
  const burdenMax = Math.min(0.10, Number((goal as any).loanBurdenMaxPct ?? 0.10));
  // Cash flow margin check: payment must fit within surplus cash if known
  let hasCashflowInfo = false;
  let monthlyExpenses = 0;
  if (profile && profile.totalMonthlyExpenses != null) {
    monthlyExpenses = Number(profile.totalMonthlyExpenses || 0);
    hasCashflowInfo = true;
  } else if ((profile as any)?.monthlyExpenses && typeof (profile as any).monthlyExpenses === 'object') {
    try {
      const me: any = (profile as any).monthlyExpenses;
      monthlyExpenses = Object.values(me).reduce((s: number, v: any) => s + (Number(v || 0)), 0);
      hasCashflowInfo = true;
    } catch {}
  }
  const surplus = hasCashflowInfo ? Math.max(0, monthlyIncome - monthlyExpenses) : null;
  const cashflowOk = surplus == null ? true : pay <= surplus;
  return burden <= burdenMax && dti <= 0.43 && cashflowOk;
}

interface PathResult {
  // strict path (legacy) used for shortfall percentiles only
  success: boolean;
  maxYearShortfall: number;
  // comprehensive coverage path (uses all in-year cash before 529/loans)
  successComprehensive: boolean;
  totalLoansComprehensive: number;
  noLoanComprehensive: boolean;
}

function simulatePath(
  goal: EducationGoal,
  profile: FinancialProfile | null,
  rng: RNG,
  opts: Required<EducationMonteCarloOptions>
): PathResult {
  const currentYear = new Date().getFullYear();

  // Inputs
  const baseAnnualCost = (() => {
    if (goal.costPerYear != null && goal.costPerYear !== "") return Number(goal.costPerYear);
    return goal.goalType === "college" ? 35000 : 15000;
  })();
  const scholarshipPerYear = Number(goal.scholarshipPerYear ?? 0);
  const coverPercent = Math.max(0, Math.min(100, Number(goal.coverPercent ?? 100))) / 100;
  const monthlyContribution0 = Math.max(0, Number(goal.monthlyContribution ?? 0));
  const loanPerYear = Math.max(0, Number(goal.loanPerYear ?? 0));
  const allowLoans = opts.allowLoans || loanPerYear > 0;

  // No hard per-year caps; use requested loanPerYear and let affordability checks govern feasibility

  const { mu, sigma } = getReturnParams(goal.riskProfile);
  const eduInflMean = (Number(goal.inflationRate ?? 2.4) || 2.4) / 100; // long-run education inflation mean

  // MAGI and filing for AOTC
  const filingStatus = (profile?.taxFilingStatus as ("single" | "married" | "head_of_household") | undefined) ??
    ((profile?.maritalStatus || "single").toLowerCase() === "married" ? "married" : "single");
  const magi = profile?.lastYearAGI ?? null;

  // Growth before start year (annual step approximation)
  let balance = Math.max(0, Number(goal.currentSavings ?? 0));
  // Independent state for comprehensive coverage path
  let balanceComp = balance;
  let totalLoansComp = 0;
  let noLoanComp = true;
  const yearsUntilStart = Math.max(0, goal.startYear - currentYear);
  for (let y = 0; y < yearsUntilStart; y++) {
    const annualReturn = mu + sigma * rng.normal();
    // Contributions assumed spread across the year. Approximate by adding then applying return.
    balance = (balance + monthlyContribution0 * 12) * (1 + annualReturn);
    balance = Math.max(0, balance);
    balanceComp = (balanceComp + monthlyContribution0 * 12) * (1 + annualReturn);
    balanceComp = Math.max(0, balanceComp);
  }

  // Time-to-degree slip: +1 year with probability
  const extraYear = (goal.goalType === "college" && rng.next() < opts.extraYearProbability) ? 1 : 0;
  const totalYears = Math.max(0, Number(goal.years || 0)) + extraYear;

  // Inflation AR(1) setup
  let piPrev = eduInflMean;

  // AOTC can be claimed up to 4 years
  let aotcYearsUsed = 0;

  let success = true;
  let successComp = true;
  let maxYearShortfall = 0;
  // Track variables only for reporting

  // Iterate each academic year
  for (let y = 0; y < totalYears; y++) {
    // Draw and apply education inflation (AR(1)) for this year
    const piY = nextInflation(piPrev, eduInflMean, rng);
    piPrev = piY;

    // Apply net price dispersion shock
    const netPriceShock = drawNetPriceShock(rng, 0.10);

    // Inflate cost from base to this year (years from now = yearsUntilStart + y)
    // Approximate by compounding by piY once per year since we already compounded pre-start yearly.
    const yearsFromNow = yearsUntilStart + y + 1; // +1 to reflect end of academic year
    const inflatedCost = baseAnnualCost * Math.pow(1 + eduInflMean, yearsFromNow); // use long-run mean for baseline ladder
    const shockedCost = inflatedCost * netPriceShock;
    const netCost = Math.max(0, (shockedCost - scholarshipPerYear) * coverPercent);

    // AOTC coordination: reserve up to $4,000 of qualified expenses paid from non-529 cash
    let reservedCashForAOTC = 0;
    let aotcCredit = 0;
    if (aotcYearsUsed < 4) {
      const annualCash = monthlyContribution0 * 12; // available cash that could be directed away from 529
      reservedCashForAOTC = Math.min(4000, netCost, annualCash);
      aotcCredit = computeAOTC(reservedCashForAOTC, filingStatus, magi);
      if (reservedCashForAOTC > 0) aotcYearsUsed += 1;
    }

    // Funding need to be paid from 529/loans after reserving cash for AOTC
    const fundingNeed = Math.max(0, netCost - reservedCashForAOTC);

    // Withdraw from 529 balance first
    const from529 = Math.min(balance, fundingNeed);
    balance -= from529;
    let remaining = fundingNeed - from529;

    // Loan fallback if allowed (strict path used only for shortfall stats)
    if (remaining > 0 && allowLoans && loanPerYear > 0) {
      const loanUsed = Math.min(loanPerYear, remaining);
      remaining -= loanUsed;
    }

    if (remaining > 0) {
      success = false;
      maxYearShortfall = Math.max(maxYearShortfall, remaining);
      // Continue simulation but mark failure
    }

    // Contributions this year that still go into 529 after reserving for AOTC
    const contribTo529 = Math.max(0, monthlyContribution0 * 12 - reservedCashForAOTC);

    // Grow remaining balance over the year, contributions included
    const annualReturn = mu + sigma * rng.normal();
    balance = (balance + contribTo529) * (1 + annualReturn);
    balance = Math.max(0, balance);

    // Note: We do not apply aotcCredit as direct funding; it improves after-tax outcome but does not change success test here.

    // ===== Comprehensive coverage path (Option B/C base): use all annual cash first =====
    {
      const cashThisYear = monthlyContribution0 * 12;
      const reservedForComp = Math.min(netCost, cashThisYear);
      const fundingNeedComp = Math.max(0, netCost - reservedForComp);
      const from529Comp = Math.min(balanceComp, fundingNeedComp);
      balanceComp -= from529Comp;
      let remainingComp = fundingNeedComp - from529Comp;
      if (remainingComp > 0 && allowLoans && loanPerYear > 0) {
        const loanUsedComp = Math.min(loanPerYear, remainingComp);
        remainingComp -= loanUsedComp;
        totalLoansComp += loanUsedComp;
        if (loanUsedComp > 0) noLoanComp = false;
      }
      if (remainingComp > 0) {
        successComp = false;
      }
      // Any leftover cash goes into 529 in the comprehensive state
      const leftoverCash = Math.max(0, cashThisYear - reservedForComp);
      const annualReturnComp = mu + sigma * rng.normal();
      balanceComp = (balanceComp + leftoverCash) * (1 + annualReturnComp);
      balanceComp = Math.max(0, balanceComp);
    }
  }

  return {
    success,
    maxYearShortfall: Math.round(maxYearShortfall),
    successComprehensive: successComp,
    totalLoansComprehensive: Math.round(totalLoansComp),
    noLoanComprehensive: successComp && noLoanComp,
  };
}

function estimateSuccessRate(
  goal: EducationGoal,
  profile: FinancialProfile | null,
  baseSeed: number,
  monthlyContributionOverride: number | null,
  opts: Required<EducationMonteCarloOptions>
): { successPct: number; successPctComprehensive: number; successPctNoLoan: number; shortfalls: number[] } {
  const iterations = opts.iterations;
  let successes = 0;
  let successesComp = 0;
  let successesNoLoan = 0;
  const shortfalls: number[] = [];

  // Create deterministic per-path seeds so repeated calls are comparable
  for (let i = 0; i < iterations; i++) {
    const pathSeed = (baseSeed + i * 2654435761) >>> 0; // Knuth's multiplicative hash step
    const rng = new RNG(pathSeed);
    const goalCopy: EducationGoal = { ...goal };
    if (monthlyContributionOverride != null) goalCopy.monthlyContribution = monthlyContributionOverride;
    const res = simulatePath(goalCopy, profile, rng, opts);
    // Option C: success = comprehensive coverage AND affordability of total loans
    const affordable = res.successComprehensive && isAffordable(res.totalLoansComprehensive, goalCopy, profile);
    if (affordable) successes += 1;
    if (res.successComprehensive) successesComp += 1;
    if (res.noLoanComprehensive) successesNoLoan += 1;
    if (!res.success) shortfalls.push(res.maxYearShortfall);
  }

  return {
    successPct: (successes / iterations) * 100,
    successPctComprehensive: (successesComp / iterations) * 100,
    successPctNoLoan: (successesNoLoan / iterations) * 100,
    shortfalls,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

export function runEducationMonteCarlo(
  goal: EducationGoal,
  profile: FinancialProfile | null,
  options?: EducationMonteCarloOptions
): EducationMonteCarloSummary {
  const opts: Required<EducationMonteCarloOptions> = {
    iterations: options?.iterations ?? 1000,
    targetSuccessRate: options?.targetSuccessRate ?? 80,
    allowLoans: options?.allowLoans ?? (Number(goal.loanPerYear ?? 0) > 0),
    extraYearProbability: options?.extraYearProbability ?? 0.18,
  };

  const baseSeed = hash32(`edu|goal:${goal.id ?? "na"}|user:${goal.userId ?? "na"}|v1`);
  const { successPct, successPctComprehensive, successPctNoLoan, shortfalls } = estimateSuccessRate(goal, profile, baseSeed, null, opts);

  // Shortfall percentiles across failed scenarios
  shortfalls.sort((a, b) => a - b);
  const p10 = percentile(shortfalls, 10);
  const p50 = percentile(shortfalls, 50);
  const p90 = percentile(shortfalls, 90);

  // If below target, find recommended monthly contribution via bisection
  let recommended = Math.max(0, Number(goal.monthlyContribution ?? 0));
  if (successPct < opts.targetSuccessRate) {
    let low = recommended;
    let high = Math.max(low + 50, low * 2 + 100); // initial upper bound guess

    // Expand upper bound until success meets target or cap out
    for (let i = 0; i < 8; i++) {
      const { successPct: sp } = estimateSuccessRate(goal, profile, baseSeed, high, opts);
      if (sp >= opts.targetSuccessRate) break;
      low = high;
      high = high * 1.5 + 100;
      if (high > 20000) break; // sanity cap
    }

    // Bisection to refine within ~$10 accuracy
    for (let i = 0; i < 12; i++) {
      const mid = (low + high) / 2;
      const { successPct: sp } = estimateSuccessRate(goal, profile, baseSeed, mid, opts);
      if (sp >= opts.targetSuccessRate) {
        high = mid;
      } else {
        low = mid;
      }
      if (high - low < 10) break;
    }
    recommended = Math.ceil(high);
  }

  return {
    probabilityOfSuccess: Math.round(successPct * 10) / 10, // Option C (affordability-constrained)
    probabilityOfComprehensiveCoverage: Math.round(successPctComprehensive * 10) / 10,
    probabilityNoLoan: Math.round(successPctNoLoan * 10) / 10,
    scenarios: { successful: Math.round((successPct / 100) * opts.iterations), failed: opts.iterations - Math.round((successPct / 100) * opts.iterations), total: opts.iterations },
    shortfallPercentiles: { p10, p50, p90 },
    recommendedMonthlyContribution: recommended,
  };
}
