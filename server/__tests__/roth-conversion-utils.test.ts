import { normalizeStoredRothAnalysis, buildRothAnalysisMeta } from "../services/roth-conversion-utils";

const mockDate = new Date("2025-09-25T12:00:00.000Z");

describe('normalizeStoredRothAnalysis', () => {
  it('returns null when analysis payload is missing', () => {
    const result = normalizeStoredRothAnalysis(null);
    expect(result).toBeNull();
  });

  it('parses JSON analysis payload and returns ISO timestamps', () => {
    const record: any = {
      analysis: JSON.stringify({ lifetimeTaxSavings: 12345 }),
      updatedAt: mockDate,
      createdAt: mockDate,
    };

    const normalized = normalizeStoredRothAnalysis(record);
    expect(normalized).not.toBeNull();
    expect(normalized?.analysis).toEqual({ lifetimeTaxSavings: 12345 });
    expect(normalized?.updatedAtIso).toBe(mockDate.toISOString());
  });

  it('returns null when JSON parsing fails (triggering fresh analysis fallback)', () => {
    const record: any = {
      analysis: "{invalid json",
      updatedAt: mockDate,
      createdAt: mockDate,
    };

    const normalized = normalizeStoredRothAnalysis(record);
    expect(normalized).toBeNull();
  });
});

describe('buildRothAnalysisMeta', () => {
  it('builds meta object with fallback timestamps', () => {
    const normalized = {
      analysis: {
        lifetimeTaxSavings: 5000,
        totalConversions: 3,
        strategy: 'moderate'
      },
      updatedAtIso: mockDate.toISOString(),
      createdAtIso: mockDate.toISOString(),
    };

    const meta = buildRothAnalysisMeta(normalized);
    expect(meta).toEqual({
      calculatedAt: mockDate.toISOString(),
      updatedAt: mockDate.toISOString(),
      strategy: 'moderate',
      lifetimeTaxSavings: 5000,
      totalConversions: 3,
      estateValueIncrease: undefined,
    });
  });

  it('returns null when normalized payload is null', () => {
    expect(buildRothAnalysisMeta(null)).toBeNull();
  });
});
