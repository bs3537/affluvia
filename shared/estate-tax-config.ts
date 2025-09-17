// Estate and inheritance tax configuration for US jurisdictions (2025+)
// Federal OBBA: $15M/person from 2026 (indexed from 2025); portability unchanged

export type StateTaxBracket = { min: number; max: number; rate: number };

export interface StateEstateTaxConfig {
  exemption: number; // filing threshold / exclusion amount (estate tax)
  brackets: StateTaxBracket[]; // simplified progressive schedule (approximate)
}

export const FederalExemptionByYear: { [year: number]: number } = {
  2024: 13_610_000,
  2025: 13_990_000, // rounded based on industry commentary
};

export function getFederalExemption(yearOfDeath: number): number {
  if (yearOfDeath <= 2025) {
    return FederalExemptionByYear[yearOfDeath] ?? 13_990_000;
  }
  // OBBA from 2026: $15M base year (indexed from 2025). Use 15M as baseline.
  return 15_000_000;
}

// 2025 state estate tax exemptions (estate tax only). Inheritance taxes handled separately.
export const StateEstateTaxByCode: Record<string, StateEstateTaxConfig> = {
  CT: { exemption: 13_990_000, brackets: [{ min: 0, max: Infinity, rate: 0.12 }] },
  DC: { exemption: 4_873_200, brackets: [{ min: 0, max: Infinity, rate: 0.16 }] },
  HI: { exemption: 5_490_000, brackets: [{ min: 0, max: Infinity, rate: 0.20 }] },
  IL: { exemption: 4_000_000, brackets: [{ min: 0, max: Infinity, rate: 0.16 }] },
  ME: { exemption: 7_000_000, brackets: [{ min: 0, max: Infinity, rate: 0.12 }] },
  MD: { exemption: 5_000_000, brackets: [{ min: 0, max: Infinity, rate: 0.16 }] },
  MA: { exemption: 2_000_000, brackets: [{ min: 0, max: Infinity, rate: 0.16 }] },
  MN: { exemption: 3_000_000, brackets: [{ min: 0, max: Infinity, rate: 0.16 }] },
  NY: { exemption: 7_160_000, brackets: [{ min: 0, max: Infinity, rate: 0.16 }] },
  OR: { exemption: 1_000_000, brackets: [{ min: 0, max: Infinity, rate: 0.16 }] },
  RI: { exemption: 1_802_431, brackets: [{ min: 0, max: Infinity, rate: 0.16 }] },
  VT: { exemption: 5_000_000, brackets: [{ min: 0, max: Infinity, rate: 0.16 }] },
  WA: { exemption: 3_000_000, brackets: [{ min: 0, max: Infinity, rate: 0.20 }] }, // simplified (10–35% range)
};

