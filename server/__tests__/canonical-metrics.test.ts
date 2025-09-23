import { deriveCanonicalMetrics } from '../lib/canonical-metrics';

describe('deriveCanonicalMetrics', () => {
  test('savings rate uses net take-home sum (parentheses bug fixed)', () => {
    const profile = { takeHomeIncome: 20000, spouseTakeHomeIncome: 10000, otherIncome: 0 };
    const calculations = { monthlyCashFlow: 9000 };
    const res = deriveCanonicalMetrics(profile, calculations as any, null);
    // monthly take home = 20000 + 10000 = 30000; savings = 9000/30000=30%
    expect(res.savingsRate).toBe(30);
  });

  test('clamps negative savings rate to 0 and >100 to 100', () => {
    const resNeg = deriveCanonicalMetrics({ takeHomeIncome: 10000 }, { monthlyCashFlow: -5000 } as any, null);
    expect(resNeg.savingsRate).toBe(0);
    const resHigh = deriveCanonicalMetrics({ takeHomeIncome: 1000 }, { monthlyCashFlow: 2000 } as any, null);
    expect(resHigh.savingsRate).toBe(100);
  });
});

