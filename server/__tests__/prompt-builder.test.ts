import { buildAuthoritativeMetricsBlock, buildDashboardInsightsBlock } from '../lib/prompt-builder';

describe('prompt-builder formatting', () => {
  test('authoritative metrics prints IAS numeric when present', () => {
    const canonical: any = { ersScore: 74, insuranceAdequacyScore: 83, savingsRate: 35.7 };
    const metrics: any = { retirementScore: 69 };
    const out = buildAuthoritativeMetricsBlock(canonical, metrics);
    expect(out).toContain('Emergency Readiness Score (ERS): 74/100');
    expect(out).toContain('Insurance Adequacy Score (IAS): 83/100');
    expect(out).toContain('Retirement Readiness Score: 69/100');
    expect(out).toContain('Savings Rate (NET, widget-aligned): 35.7%');
  });

  test('authoritative metrics prints IAS Not available when missing', () => {
    const canonical: any = { ersScore: 74, insuranceAdequacyScore: null, savingsRate: 35.7 };
    const metrics: any = { retirementScore: 69 };
    const out = buildAuthoritativeMetricsBlock(canonical, metrics);
    expect(out).toContain('Insurance Adequacy Score (IAS): Not available');
  });

  test('dashboard insights block prints IAS numeric and savings', () => {
    const snapshot: any = {
      savingsRate: 35.7,
      dashboardData: { healthScores: { overall: 78, emergency: 74, riskManagement: 83 } }
    };
    const out = buildDashboardInsightsBlock(snapshot);
    expect(out).toContain('Overall Financial Health Score: 78/100');
    expect(out).toContain('Emergency Readiness Score: 74/100');
    expect(out).toContain('Insurance Adequacy Score: 83/100');
    expect(out).toContain('Savings Rate (NET): 35.7%');
  });

  test('dashboard insights block prints IAS Not available when missing', () => {
    const snapshot: any = {
      savingsRate: 35.7,
      dashboardData: { healthScores: { overall: 78, emergency: 74, riskManagement: null } }
    };
    const out = buildDashboardInsightsBlock(snapshot);
    expect(out).toContain('Insurance Adequacy Score: Not available');
  });
});

