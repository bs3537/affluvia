import type { CanonicalMetrics } from "./canonical-metrics";

/**
 * Builds the "AUTHORITATIVE METRICS" block shown at the top of insights prompts.
 * - Uses canonical NET Savings Rate (widget-aligned)
 * - Uses canonical ERS and IAS with presence guards
 */
export function buildAuthoritativeMetricsBlock(
  canonical: CanonicalMetrics,
  metrics: any
): string {
  const ers = typeof canonical.ersScore === "number" ? canonical.ersScore : 0;
  const ias = canonical.insuranceAdequacyScore;
  const iasText = (ias === null || ias === undefined) ? "Not available" : `${ias}/100`;
  const rr = typeof metrics?.retirementScore === "number" ? metrics.retirementScore : 0;
  const sr = (canonical.savingsRate ?? metrics?.savingsRate);
  const srText = typeof sr === "number" ? sr.toFixed(1) : "0.0";

  return (
`AUTHORITATIVE METRICS (use as-is; do NOT recompute):
- Emergency Readiness Score (ERS): ${ers}/100
- Insurance Adequacy Score (IAS): ${iasText}
- Retirement Readiness Score: ${rr}/100
- Savings Rate (NET, widget-aligned): ${srText}% (use net take-home; do not recompute)`
  );
}

/**
 * Builds the "DASHBOARD INSIGHTS (Calculated Results)" section using a canonical snapshot-like object.
 * Expects fields:
 *  - dashboardData.healthScores.{overall, emergency, riskManagement}
 *  - savingsRate
 */
export function buildDashboardInsightsBlock(snapshot: any): string {
  const hs = snapshot?.dashboardData?.healthScores;
  const overall = hs?.overall;
  const emergency = hs?.emergency;
  const ias = hs?.riskManagement;
  const iasText = (ias === null || ias === undefined) ? 'Not available' : `${ias}/100`;
  const savings = typeof snapshot?.savingsRate === 'number' ? snapshot.savingsRate.toFixed(1) : '0.0';

  const head = 'DASHBOARD INSIGHTS (Calculated Results):';
  if (!hs) return head; // no scores available

  return (
`${head}
- Overall Financial Health Score: ${overall}/100
- Emergency Readiness Score: ${emergency}/100
- Insurance Adequacy Score: ${iasText} (comprehensive insurance coverage assessment)
- Savings Rate (NET): ${savings}%`
  );
}

