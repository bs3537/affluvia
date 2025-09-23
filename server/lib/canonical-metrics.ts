import type { DashboardSnapshot } from "../services/dashboard-snapshot";

type Num = number | null | undefined;

function toNum(v: any): number | null {
  const n = typeof v === "string" ? parseFloat(v) : (typeof v === "number" ? v : NaN);
  return Number.isFinite(n) ? n : null;
}

function pick<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) if (v !== null && v !== undefined) return v as T;
  return null;
}

export interface CanonicalMetrics {
  ersScore: number; // 0-100
  insuranceAdequacyScore: number | null; // null when unavailable
  savingsRate: number | null; // percent
  monthlyCashFlow: number | null; // dollars
  retirementMonthlyExpenses: number; // dollars
}

/**
 * Derive canonical dashboard metrics used by insights to avoid drift.
 * Prefers persisted widget/calculation values; falls back to intake fields; snapshot is optional.
 */
export function deriveCanonicalMetrics(
  profile: any,
  calculations: any,
  snapshot?: DashboardSnapshot | null
): CanonicalMetrics {
  // ERS precedence: profile.emergencyReadinessScore -> calculations.emergencyScore -> calculations.emergencyReadinessScoreCFP
  const ersScore = pick<number>(
    toNum(profile?.emergencyReadinessScore),
    toNum(calculations?.emergencyScore),
    toNum(calculations?.emergencyReadinessScoreCFP)
  ) ?? 0;

  // Insurance Adequacy precedence: calculations.insuranceAdequacy.score -> calculations.insuranceScore -> profile.riskManagementScore -> snapshot widget
  const ias = pick<number>(
    toNum(calculations?.insuranceAdequacy?.score),
    toNum(calculations?.insuranceScore),
    toNum(profile?.riskManagementScore),
    toNum(
      snapshot?.widgets?.find((w) => w.id === "insurance_adequacy")?.data?.score
    )
  );

  // Monthly cash flow: prefer persisted calculations/profile; fallback to snapshot cash_flow widget
  const monthlyCashFlow = pick<number>(
    toNum(calculations?.monthlyCashFlow),
    toNum(profile?.monthlyCashFlow),
    toNum(snapshot?.widgets?.find((w) => w.id === "cash_flow")?.data?.monthly)
  );

  // Savings rate: prefer calculations.savingsRate; otherwise compute from net monthly income vs monthly cash flow
  let savingsRate: number | null = toNum(calculations?.savingsRate);
  if (savingsRate === null) {
    const takeHomeIncomeMonthly =
      (toNum(profile?.takeHomeIncome) ?? 0) +
      (toNum(profile?.spouseTakeHomeIncome) ?? 0) +
      (toNum(profile?.otherIncome) ?? 0);
    const mcf = monthlyCashFlow ?? null;
    if (takeHomeIncomeMonthly > 0 && mcf !== null) {
      savingsRate = (mcf / takeHomeIncomeMonthly) * 100;
    }
  }

  // Retirement monthly expenses (Step 11 is canonical)
  const retirementMonthlyExpenses = pick<number>(
    toNum(profile?.expectedMonthlyExpensesRetirement),
    toNum(profile?.optimizationVariables?.monthlyExpenses),
    toNum(profile?.retirementPlanningData?.monthlyExpenses)
  ) ?? 0;

  // Clamp savings rate to [0,100]
  const clampedSavings = savingsRate !== null
    ? Math.max(0, Math.min(100, Math.round(savingsRate * 10) / 10))
    : null;

  return {
    ersScore: Math.max(0, Math.min(100, Math.round(ersScore))),
    insuranceAdequacyScore: ias !== null ? Math.max(0, Math.min(100, Math.round(ias))) : null,
    savingsRate: clampedSavings,
    monthlyCashFlow: monthlyCashFlow !== null ? Math.round(monthlyCashFlow) : null,
    retirementMonthlyExpenses,
  };
}
