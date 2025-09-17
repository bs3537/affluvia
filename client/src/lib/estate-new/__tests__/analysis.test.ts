import { calculateEstateProjection } from "@/lib/estate-new/analysis";

describe("calculateEstateProjection", () => {
  const baseComposition = {
    taxable: 1_000_000,
    taxDeferred: 500_000,
    roth: 250_000,
    illiquid: 250_000,
  };

  it("returns zero estate tax for estates under the federal exemption", () => {
    const result = calculateEstateProjection({
      baseEstateValue: 3_000_000,
      assetComposition: baseComposition,
      profile: {
        maritalStatus: "single",
        state: "CA",
        currentAge: 58,
      },
    });

    expect(result.totalTax).toBe(0);
    expect(result.netToHeirs).toBeCloseTo(result.projectedEstateValue, 2);
    expect(result.charitableImpact.charitableBequests).toBe(0);
  });

  it("doubles the exemption when a bypass trust is modeled for married clients", () => {
    const baseline = calculateEstateProjection({
      baseEstateValue: 20_000_000,
      assetComposition: baseComposition,
      profile: {
        maritalStatus: "married",
        state: "NY",
        currentAge: 60,
      },
    });

    const result = calculateEstateProjection({
      baseEstateValue: 20_000_000,
      assetComposition: baseComposition,
      strategies: {
        bypassTrust: true,
      },
      profile: {
        maritalStatus: "married",
        state: "NY",
        currentAge: 60,
      },
    });

    expect(result.assumptions.federalExemption).toBeGreaterThanOrEqual(baseline.assumptions.federalExemption * 2);
    expect(result.federalTax).toBeLessThan(baseline.federalTax);
  });

  it("reduces taxable estate when charitable bequests are entered", () => {
    const result = calculateEstateProjection({
      baseEstateValue: 15_000_000,
      assetComposition: baseComposition,
      strategies: {
        charitableBequest: 2_000_000,
      },
      profile: {
        maritalStatus: "single",
        state: "MA",
        currentAge: 62,
      },
    });

    expect(result.charitableImpact.charitableBequests).toBe(2_000_000);
    expect(result.projectedEstateValue).toBeLessThan(15_000_000);
    expect(result.projectedTaxableEstate).toBeLessThan(15_000_000);
    expect(result.stateTax).toBeGreaterThan(0); // Massachusetts estate tax should trigger
  });
});
