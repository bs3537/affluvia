import { EducationGoal, FinancialProfile } from "./types";
import { runEducationMonteCarlo } from "./education-monte-carlo";
import { RNG, hash32 } from "./rng";

const DEFAULT_SEARCH = {
  iterations: 400,
  finalIterations: 800,
  targetSuccess: 80,
  maxCandidates: 160,
  monthlyStep: 50,
  monthlyMin: 0,
  monthlyMax: 5000,
  scholarshipRange: { min: 0, max: 20000, step: 500 },
  tuitionInflationRange: { min: 0.02, max: 0.06, step: 0.005 },
  loanRangeDependent: { min: 0, max: 7500, step: 500 },
  loanRangeIndependent: { min: 0, max: 12500, step: 500 },
  extraYearRange: { min: 0, max: 0.25, step: 0.01 },
  strategies: [
    "conservative",
    "mod-conservative",
    "balanced",
    "mod-aggressive",
    "aggressive",
    "glide"
  ] as const
};

type Strategy = (typeof DEFAULT_SEARCH.strategies)[number];

type StrategyRisk = "conservative" | "moderate" | "aggressive" | "glide";

export interface EducationOptimizationConstraints {
  maxMonthlyContribution?: number;
  maxLoanPerYear?: number;
  preferLowerLoans?: boolean;
  preferLowerMonthly?: boolean;
}

export interface EducationOptimizationRequest {
  goal: EducationGoal;
  profile: FinancialProfile | null;
  constraints?: EducationOptimizationConstraints;
  overrides?: CandidateOverrides;
  targetSuccessRate?: number;
}

export interface EducationOptimizationResult {
  probabilityOfSuccess: number;
  variables: {
    monthlyContribution: number;
    investmentStrategy: Strategy;
    loanPerYear: number;
    tuitionInflationRate: number;
    annualScholarships: number;
    extraYearProbability: number;
  };
  years: number[];
  costs: number[];
  funded: number[];
  loanAmounts: number[];
  totalCost: number;
  totalFunded: number;
  totalLoans: number;
  fundingPercentage: number;
  comprehensiveFundingPercentage: number;
  monteCarlo: ReturnType<typeof runEducationMonteCarlo>;
}

interface Candidate {
  monthlyContribution: number;
  strategy: Strategy;
  loanPerYear: number;
  tuitionInflation: number;
  annualScholarships: number;
  extraYearProbability: number;
}

interface CandidateOverrides {
  strategy?: Strategy;
  tuitionInflation?: number;
  annualScholarships?: number;
  extraYearProbability?: number;
}

interface CandidateScore {

  probability: number;
  totalLoans: number;
  totalContributions: number;
}

export function mapStrategyToRisk(strategy: Strategy): StrategyRisk {
  switch (strategy) {
    case "conservative":
      return "conservative";
    case "mod-conservative":
    case "balanced":
      return "moderate";
    case "mod-aggressive":
    case "aggressive":
      return "aggressive";
    case "glide":
      return "glide";
    default:
      return "moderate";
  }
}

function deterministicReturn(risk: StrategyRisk): number {
  switch (risk) {
    case "conservative":
      return 0.045;
    case "aggressive":
      return 0.08;
    case "glide":
      return 0.06;
    default:
      return 0.06;
  }
}

function applyCandidate(goal: EducationGoal, candidate: Candidate): EducationGoal {
  return {
    ...goal,
    monthlyContribution: candidate.monthlyContribution,
    riskProfile: mapStrategyToRisk(candidate.strategy),
    loanPerYear: candidate.loanPerYear,
    scholarshipPerYear: candidate.annualScholarships,
    inflationRate: Math.round(candidate.tuitionInflation * 1000) / 10,
  };
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildDeterministicProjection(goal: EducationGoal, candidate: Candidate): {
  years: number[];
  costs: number[];
  funded: number[];
  loanAmounts: number[];
  totalCost: number;
  totalFunded: number;
  totalLoans: number;
  fundingPercentage: number;
  comprehensiveFundingPercentage: number;
} {
  const risk = mapStrategyToRisk(candidate.strategy);
  const expectedReturn = deterministicReturn(risk);
  const currentYear = new Date().getFullYear();

  const years: number[] = [];
  const costs: number[] = [];
  const funded: number[] = [];
  const loanAmounts: number[] = [];

  const baseCost = goal.costPerYear != null && goal.costPerYear !== ""
    ? Number(goal.costPerYear)
    : goal.goalType === "college" ? 35000 : 15000;

  const coverPercent = Math.max(0, Math.min(100, Number(goal.coverPercent ?? 100))) / 100;
  const inflationRate = Number(goal.inflationRate ?? 2.4) / 100;
  const scholarship = Number(goal.scholarshipPerYear ?? 0);
  const loanPerYear = Number(goal.loanPerYear ?? 0);
  const monthlyContribution = Math.max(0, Number(goal.monthlyContribution ?? 0));
  let currentSavings = Math.max(0, Number(goal.currentSavings ?? 0));

  const yearsUntilStart = Math.max(0, goal.startYear - currentYear);
  for (let i = 0; i < yearsUntilStart; i++) {
    currentSavings = (currentSavings + monthlyContribution * 12) * (1 + expectedReturn);
  }

  const totalYears = Math.max(0, Number(goal.years ?? 0));

  let totalCost = 0;
  let totalFunded = 0;
  let totalLoans = 0;

  for (let yearIndex = 0; yearIndex < totalYears; yearIndex++) {
    const schoolYear = goal.startYear + yearIndex;
    years.push(schoolYear);
    const yearsFromNow = schoolYear - currentYear;
    const inflatedCost = baseCost * Math.pow(1 + inflationRate, yearsFromNow);
    const netCost = Math.max(0, (inflatedCost - scholarship) * coverPercent);
    costs.push(Math.round(netCost));

    const fundedFromSavings = Math.min(currentSavings, netCost);
    const remainingAfterSavings = Math.max(0, netCost - fundedFromSavings);
    const loansUsed = Math.min(loanPerYear, remainingAfterSavings);

    funded.push(Math.round(fundedFromSavings));
    loanAmounts.push(Math.round(loansUsed));

    currentSavings = Math.max(0, currentSavings - fundedFromSavings);
    const annualContribGrowth = monthlyContribution > 0
      ? monthlyContribution * 12 * (1 + expectedReturn / 2)
      : 0;
    currentSavings = (currentSavings + annualContribGrowth) * (1 + expectedReturn);

    totalCost += netCost;
    totalFunded += fundedFromSavings;
    totalLoans += loansUsed;
  }

  const fundingPercentage = totalCost > 0 ? Math.round((totalFunded / totalCost) * 100) : 0;
  const comprehensiveFundingPercentage = totalCost > 0
    ? Math.round(((totalFunded + totalLoans) / totalCost) * 100)
    : 0;

  return {
    years,
    costs,
    funded,
    loanAmounts,
    totalCost: Math.round(totalCost),
    totalFunded: Math.round(totalFunded),
    totalLoans: Math.round(totalLoans),
    fundingPercentage,
    comprehensiveFundingPercentage,
  };
}

function scoreCandidate(
  candidate: Candidate,
  goal: EducationGoal,
  profile: FinancialProfile | null,
  opts: { iterations: number; targetSuccess: number },
  existingMonteCarlo?: ReturnType<typeof runEducationMonteCarlo>
): { monteCarlo: ReturnType<typeof runEducationMonteCarlo>; finalGoal: EducationGoal; score: CandidateScore } {
  const adjustedGoal = applyCandidate(goal, candidate);
  const monteCarlo = existingMonteCarlo ?? runEducationMonteCarlo(adjustedGoal, profile, {
    iterations: opts.iterations,
    targetSuccessRate: opts.targetSuccess,
    allowLoans: candidate.loanPerYear > 0,
    extraYearProbability: candidate.extraYearProbability,
  });

  const years = Math.max(1, Number(goal.years ?? 4));
  const score: CandidateScore = {
    probability: monteCarlo.probabilityOfSuccess,
    totalLoans: candidate.loanPerYear * years,
    totalContributions: candidate.monthlyContribution * 12 * years,
  };

  return { monteCarlo, finalGoal: adjustedGoal, score };
}

function isBetterCandidate(
  current: CandidateScore | null,
  candidate: CandidateScore,
  preferences: { preferLowerLoans: boolean; preferLowerMonthly: boolean }
): boolean {
  if (!current) return true;
  if (candidate.probability > current.probability + 1e-6) return true;
  if (candidate.probability < current.probability - 1e-6) return false;

  if (preferences.preferLowerLoans) {
    if (candidate.totalLoans < current.totalLoans) return true;
    if (candidate.totalLoans > current.totalLoans) return false;
  }

  if (preferences.preferLowerMonthly) {
    if (candidate.totalContributions < current.totalContributions) return true;
    if (candidate.totalContributions > current.totalContributions) return false;
  }

  return candidate.totalLoans + candidate.totalContributions < current.totalLoans + current.totalContributions;
}

export async function optimizeEducationGoal(
  request: EducationOptimizationRequest
): Promise<EducationOptimizationResult> {
  const { goal, profile } = request;
  const targetSuccess = request.targetSuccessRate ?? DEFAULT_SEARCH.targetSuccess;

  const rngSeed = hash32(`edu-opt|goal:${goal.id ?? "na"}|user:${goal.userId ?? "na"}`);
  const rng = new RNG(rngSeed);
  const overrides: CandidateOverrides = request.overrides ?? {};

  const maxMonthly = request.constraints?.maxMonthlyContribution ?? DEFAULT_SEARCH.monthlyMax;
  const maxLoanDefault = goal.relationship?.toLowerCase() === "independent"
    ? DEFAULT_SEARCH.loanRangeIndependent.max
    : DEFAULT_SEARCH.loanRangeDependent.max;
  const maxLoanPerYear = request.constraints?.maxLoanPerYear ?? maxLoanDefault;

  const preferences = {
    preferLowerLoans: request.constraints?.preferLowerLoans !== false,
    preferLowerMonthly: request.constraints?.preferLowerMonthly !== false,
  };

  let bestCandidate: Candidate | null = null;
  let bestScore: CandidateScore | null = null;
  let bestMonteCarlo: ReturnType<typeof runEducationMonteCarlo> | null = null;
  let bestGoal: EducationGoal | null = null;

  for (let i = 0; i < DEFAULT_SEARCH.maxCandidates; i++) {
    const randomStrategy = DEFAULT_SEARCH.strategies[Math.floor(rng.uniform(0, DEFAULT_SEARCH.strategies.length))];
    const strategy = overrides.strategy ?? randomStrategy;
    const baseRange = goal.relationship?.toLowerCase() === "independent"
      ? DEFAULT_SEARCH.loanRangeIndependent
      : DEFAULT_SEARCH.loanRangeDependent;
    // Respect the user's maxLoanPerYear even if it exceeds the default program caps
    const maxLoan = Number.isFinite(maxLoanPerYear)
      ? Math.max(baseRange.min, maxLoanPerYear)
      : baseRange.max;
    const goalMonthlyRaw = Number(goal.monthlyContribution ?? 0);
    const goalMonthlyContribution = Number.isFinite(goalMonthlyRaw) ? goalMonthlyRaw : 0;
    const randomMonthly = roundToStep(
      rng.uniform(DEFAULT_SEARCH.monthlyMin, maxMonthly + DEFAULT_SEARCH.monthlyStep),
      DEFAULT_SEARCH.monthlyStep
    );
    const baseMonthly = i === 0 && goalMonthlyContribution > 0
      ? clamp(roundToStep(goalMonthlyContribution, DEFAULT_SEARCH.monthlyStep), DEFAULT_SEARCH.monthlyMin, maxMonthly)
      : clamp(randomMonthly, DEFAULT_SEARCH.monthlyMin, maxMonthly);
    const existingLoan = Number(goal.loanPerYear ?? 0);
    const randomLoan = roundToStep(rng.uniform(baseRange.min, maxLoan + baseRange.step), baseRange.step);
    const loanPerYear = clamp(
      i === 0 && existingLoan >= baseRange.min ? existingLoan : randomLoan,
      baseRange.min,
      maxLoan
    );
    const goalInflation = Number(goal.inflationRate ?? 2.4) / 100;
    const randomInflation = roundToStep(
      rng.uniform(DEFAULT_SEARCH.tuitionInflationRange.min, DEFAULT_SEARCH.tuitionInflationRange.max + DEFAULT_SEARCH.tuitionInflationRange.step),
      DEFAULT_SEARCH.tuitionInflationRange.step
    );
    const inflationOverride = overrides.tuitionInflation;
    const tuitionInflation = clamp(
      inflationOverride != null ? inflationOverride : (i === 0 ? goalInflation : randomInflation),
      DEFAULT_SEARCH.tuitionInflationRange.min,
      DEFAULT_SEARCH.tuitionInflationRange.max
    );
    const goalScholarship = Number(goal.scholarshipPerYear ?? 0);
    const randomScholarship = roundToStep(
      rng.uniform(DEFAULT_SEARCH.scholarshipRange.min, DEFAULT_SEARCH.scholarshipRange.max + DEFAULT_SEARCH.scholarshipRange.step),
      DEFAULT_SEARCH.scholarshipRange.step
    );
    const scholarshipOverride = overrides.annualScholarships;
    const annualScholarships = clamp(
      scholarshipOverride != null ? scholarshipOverride : (i === 0 ? goalScholarship : randomScholarship),
      DEFAULT_SEARCH.scholarshipRange.min,
      DEFAULT_SEARCH.scholarshipRange.max
    );
    const randomExtraYear = roundToStep(
      rng.uniform(DEFAULT_SEARCH.extraYearRange.min, DEFAULT_SEARCH.extraYearRange.max + DEFAULT_SEARCH.extraYearRange.step),
      DEFAULT_SEARCH.extraYearRange.step
    );
    const extraYearOverride = overrides.extraYearProbability;
    const extraYearProbability = clamp(
      extraYearOverride != null ? extraYearOverride : (i === 0 ? 0.18 : randomExtraYear),
      DEFAULT_SEARCH.extraYearRange.min,
      DEFAULT_SEARCH.extraYearRange.max
    );

    const candidate: Candidate = {
      monthlyContribution: baseMonthly,
      strategy,
      loanPerYear,
      tuitionInflation,
      annualScholarships,
      extraYearProbability
    };

    // Escalate monthly contribution until target success or cap reached
    let adjustedMonthly = candidate.monthlyContribution;
    let currentMonteCarlo = runEducationMonteCarlo(
      applyCandidate(goal, { ...candidate, monthlyContribution: adjustedMonthly }),
      profile,
      {
        iterations: DEFAULT_SEARCH.iterations,
        targetSuccessRate: targetSuccess,
        allowLoans: candidate.loanPerYear > 0,
        extraYearProbability: candidate.extraYearProbability
      }
    );

    let bumps = 0;
    while (currentMonteCarlo.probabilityOfSuccess + 0.1 < targetSuccess && adjustedMonthly < maxMonthly && bumps < 12) {
      adjustedMonthly = clamp(adjustedMonthly + DEFAULT_SEARCH.monthlyStep, DEFAULT_SEARCH.monthlyMin, maxMonthly);
      currentMonteCarlo = runEducationMonteCarlo(
        applyCandidate(goal, { ...candidate, monthlyContribution: adjustedMonthly }),
        profile,
        {
          iterations: DEFAULT_SEARCH.iterations,
          targetSuccessRate: targetSuccess,
          allowLoans: candidate.loanPerYear > 0,
          extraYearProbability: candidate.extraYearProbability
        }
      );
      bumps += 1;
      if (adjustedMonthly >= maxMonthly) break;
    }

    const evaluated = scoreCandidate(
      { ...candidate, monthlyContribution: adjustedMonthly },
      goal,
      profile,
      { iterations: DEFAULT_SEARCH.iterations, targetSuccess },
      currentMonteCarlo
    );

    if (isBetterCandidate(bestScore, evaluated.score, preferences)) {
      bestScore = evaluated.score;
      bestCandidate = { ...candidate, monthlyContribution: adjustedMonthly };
      bestMonteCarlo = evaluated.monteCarlo;
      bestGoal = evaluated.finalGoal;
    }

    if (bestScore && bestScore.probability >= 95 && bestScore.totalLoans === 0) {
      break;
    }
  }

  if (!bestCandidate || !bestGoal || !bestMonteCarlo) {
    throw new Error("Unable to identify an optimized education strategy");
  }

  const refinedMonteCarlo = runEducationMonteCarlo(bestGoal, profile, {
    iterations: DEFAULT_SEARCH.finalIterations,
    targetSuccessRate: targetSuccess,
    allowLoans: bestCandidate.loanPerYear > 0,
    extraYearProbability: bestCandidate.extraYearProbability
  });

  const projection = buildDeterministicProjection(bestGoal, bestCandidate);

  return {
    probabilityOfSuccess: Math.round(refinedMonteCarlo.probabilityOfSuccess * 10) / 10,
    variables: {
      monthlyContribution: bestCandidate.monthlyContribution,
      investmentStrategy: bestCandidate.strategy,
      loanPerYear: bestCandidate.loanPerYear,
      tuitionInflationRate: bestCandidate.tuitionInflation,
      annualScholarships: bestCandidate.annualScholarships,
      extraYearProbability: bestCandidate.extraYearProbability,
    },
    years: projection.years,
    costs: projection.costs,
    funded: projection.funded,
    loanAmounts: projection.loanAmounts,
    totalCost: projection.totalCost,
    totalFunded: projection.totalFunded,
    totalLoans: projection.totalLoans,
    fundingPercentage: projection.fundingPercentage,
    comprehensiveFundingPercentage: projection.comprehensiveFundingPercentage,
    monteCarlo: refinedMonteCarlo,
  };
}
