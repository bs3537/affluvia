import type { EducationGoal, FinancialProfile } from "./types.ts";
import { RNG, hash32 } from "./rng.ts";

export interface EducationMonteCarloOptions {
  iterations?: number; // default 1000
  targetSuccessRate?: number; // default 80 (%)
  allowLoans?: boolean; // default true if goal.loanPerYear > 0
  extraYearProbability?: number; // default 0.18 (18%)
}

export interface EducationMonteCarloSummary {
  probabilityOfSuccess: number; // percent 0-100
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

interface PathResult { success: boolean; maxYearShortfall: number; }

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

  const { mu, sigma } = getReturnParams(goal.riskProfile);
  const eduInflMean = (Number(goal.inflationRate ?? 5) || 5) / 100; // long-run education inflation mean

  // MAGI and filing for AOTC
  const filingStatus = (profile?.taxFilingStatus as ("single" | "married" | "head_of_household") | undefined) ??
    ((profile?.maritalStatus || "single").toLowerCase() === "married" ? "married" : "single");
  const magi = profile?.lastYearAGI ?? null;

  // Growth before start year (annual step approximation)
  let balance = Math.max(0, Number(goal.currentSavings ?? 0));
  const yearsUntilStart = Math.max(0, goal.startYear - currentYear);
  for (let y = 0; y < yearsUntilStart; y++) {
    const annualReturn = mu + sigma * rng.normal();
    // Contributions assumed spread across the year. Approximate by adding then applying return.
    balance = (balance + monthlyContribution0 * 12) * (1 + annualReturn);
    balance = Math.max(0, balance);
  }

  // Time-to-degree slip: +1 year with probability
  const extraYear = (goal.goalType === "college" && rng.next() < opts.extraYearProbability) ? 1 : 0;
  const totalYears = Math.max(0, Number(goal.years || 0)) + extraYear;

  // Inflation AR(1) setup
  let piPrev = eduInflMean;

  // AOTC can be claimed up to 4 years
  let aotcYearsUsed = 0;

  let success = true;
  let maxYearShortfall = 0;

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

    // Loan fallback if allowed
    if (remaining > 0) {
      if (allowLoans && loanPerYear > 0) {
        const loanUsed = Math.min(loanPerYear, remaining);
        remaining -= loanUsed;
      }
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
  }

  return { success, maxYearShortfall: Math.round(maxYearShortfall) };
}

function estimateSuccessRate(
  goal: EducationGoal,
  profile: FinancialProfile | null,
  baseSeed: number,
  monthlyContributionOverride: number | null,
  opts: Required<EducationMonteCarloOptions>
): { successPct: number; shortfalls: number[] } {
  const iterations = opts.iterations;
  let successes = 0;
  const shortfalls: number[] = [];

  // Create deterministic per-path seeds so repeated calls are comparable
  for (let i = 0; i < iterations; i++) {
    const pathSeed = (baseSeed + i * 2654435761) >>> 0; // Knuth's multiplicative hash step
    const rng = new RNG(pathSeed);
    const goalCopy: EducationGoal = { ...goal };
    if (monthlyContributionOverride != null) goalCopy.monthlyContribution = monthlyContributionOverride;
    const res = simulatePath(goalCopy, profile, rng, opts);
    if (res.success) successes += 1;
    if (!res.success) shortfalls.push(res.maxYearShortfall);
  }

  return { successPct: (successes / iterations) * 100, shortfalls };
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
  const { successPct, shortfalls } = estimateSuccessRate(goal, profile, baseSeed, null, opts);

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
    probabilityOfSuccess: Math.round(successPct * 10) / 10, // 0.1% precision
    scenarios: { successful: Math.round((successPct / 100) * opts.iterations), failed: opts.iterations - Math.round((successPct / 100) * opts.iterations), total: opts.iterations },
    shortfallPercentiles: { p10, p50, p90 },
    recommendedMonthlyContribution: recommended,
  };
}

