import { DashboardSnapshot, pickWidget } from "@/hooks/useDashboardSnapshot";

export type EmergencyReadinessMetrics = {
  score: number;
  monthsCovered: number;
  emergencyFundAmount: number;
  essentialMonthlyExpenses: number;
};

type ComputeOptions = {
  snapshot?: DashboardSnapshot | null;
  snapshotScore?: number | null;
};

const SAVINGS_TYPE_MATCHERS = ["emergency", "savings", "checking"];

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const clampScore = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const resolveEmergencyFundSize = (profile: any): number => {
  if (!profile) return 0;
  let emergencyFundSize = toNumber(profile?.emergencyFundSize ?? 0);

  if (emergencyFundSize === 0 && Array.isArray(profile?.assets)) {
    emergencyFundSize = profile.assets.reduce((sum: number, asset: any) => {
      const typeLabel = String(asset?.type ?? "").toLowerCase();
      if (!typeLabel) return sum;
      const matches = SAVINGS_TYPE_MATCHERS.some((keyword) => typeLabel.includes(keyword));
      if (!matches) return sum;
      return sum + toNumber(asset?.value ?? asset?.balance ?? asset?.currentValue ?? 0);
    }, 0);
  }

  return emergencyFundSize;
};

const resolveEssentialMonthlyExpenses = (profile: any): number => {
  if (!profile) return 0;
  const expenses = (profile?.monthlyExpenses ?? {}) as Record<string, any>;
  const keys = [
    "housing",
    "transportation",
    "food",
    "utilities",
    "healthcare",
    "creditCardPayments",
    "studentLoanPayments",
    "otherDebtPayments",
    "householdExpenses",
    "monthlyTaxes",
    "other",
  ];

  return keys.reduce((total, key) => total + toNumber(expenses?.[key]), 0);
};

export function estimateEmergencyReadinessScore(profile: any): number {
  if (!profile) return 0;

  const emergencyFundSize = resolveEmergencyFundSize(profile);
  const expenses = (profile?.monthlyExpenses ?? {}) as Record<string, any>;
  const essentialExpenses =
    (toNumber(expenses?.housing) || 0) +
    (toNumber(expenses?.food) || 0) +
    (toNumber(expenses?.transportation) || 0) +
    (toNumber(expenses?.utilities) || 0) +
    (toNumber(expenses?.healthcare) || 0) +
    (toNumber(expenses?.insurance) || 0) +
    (toNumber(expenses?.childcare) || 0) +
    (toNumber(expenses?.otherDebtPayments) || 0) +
    (toNumber(expenses?.householdExpenses) || 0) +
    (toNumber(expenses?.monthlyTaxes) || 0);

  const monthsCovered = essentialExpenses > 0 ? emergencyFundSize / essentialExpenses : 0;

  let score = Math.min(100, (monthsCovered / 6) * 100);
  if (monthsCovered >= 6) score = 100;
  else if (monthsCovered >= 3) score = 50 + ((monthsCovered - 3) / 3) * 50;
  else if (monthsCovered >= 1) score = 25 + ((monthsCovered - 1) / 2) * 25;
  else score = Math.max(0, monthsCovered * 25);

  return clampScore(score);
}

export function computeEmergencyReadinessMetrics(
  profile: any,
  options: ComputeOptions = {}
): EmergencyReadinessMetrics {
  const emergencyFundAmount = resolveEmergencyFundSize(profile);
  const essentialMonthlyExpenses = resolveEssentialMonthlyExpenses(profile);
  const monthsCovered = essentialMonthlyExpenses > 0 ? emergencyFundAmount / essentialMonthlyExpenses : 0;

  const providedSnapshotScore =
    typeof options.snapshotScore === "number" && !Number.isNaN(options.snapshotScore)
      ? options.snapshotScore
      : null;

  let snapshotScore = providedSnapshotScore;
  if (snapshotScore === null && options.snapshot) {
    const snapshotWidget = pickWidget<any>(options.snapshot, "emergency_readiness");
    if (typeof snapshotWidget?.score === "number" && !Number.isNaN(snapshotWidget.score)) {
      snapshotScore = snapshotWidget.score;
    }
  }

  let scoreSource: number;
  if (snapshotScore !== null) {
    scoreSource = snapshotScore;
  } else if (profile?.emergencyReadinessScore !== undefined && profile?.emergencyReadinessScore !== null) {
    scoreSource = toNumber(profile.emergencyReadinessScore);
  } else {
    const derived =
      profile?.calculations?.emergencyReadinessScoreCFP ||
      profile?.emergencyReadinessScoreCFP ||
      estimateEmergencyReadinessScore(profile);
    scoreSource = toNumber(derived);
  }

  return {
    score: clampScore(scoreSource),
    monthsCovered: Number.isFinite(monthsCovered) ? monthsCovered : 0,
    emergencyFundAmount,
    essentialMonthlyExpenses,
  };
}
