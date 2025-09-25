import type { RothConversionAnalysis } from "@shared/schema";

export interface NormalizedRothAnalysis {
  analysis: any;
  updatedAtIso?: string;
  createdAtIso?: string;
}

function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

export function normalizeStoredRothAnalysis(
  record?: RothConversionAnalysis | null
): NormalizedRothAnalysis | null {
  if (!record || record.analysis == null) {
    return null;
  }

  let analysis = record.analysis as any;
  if (typeof analysis === "string") {
    try {
      analysis = JSON.parse(analysis);
    } catch (error) {
      console.warn('[normalizeStoredRothAnalysis] Failed to parse stored analysis JSON:', error);
      return null;
    }
  }

  return {
    analysis,
    updatedAtIso: toIso(record.updatedAt),
    createdAtIso: toIso(record.createdAt),
  };
}

export function buildRothAnalysisMeta(normalized: NormalizedRothAnalysis | null) {
  if (!normalized) return null;
  const { analysis, updatedAtIso, createdAtIso } = normalized;
  if (!analysis) return null;

  return {
    calculatedAt: analysis?.calculatedAt || analysis?.updatedAt || updatedAtIso || createdAtIso,
    updatedAt: updatedAtIso || createdAtIso,
    strategy: analysis?.strategy,
    lifetimeTaxSavings: analysis?.lifetimeTaxSavings,
    totalConversions: analysis?.totalConversions,
    estateValueIncrease: analysis?.estateValueIncrease,
  };
}
