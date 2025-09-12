/**
 * Year-indexed tax tables for accurate tax calculations
 * Centralizes all tax-related thresholds and brackets
 */

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface IRMAABracket {
  min: number;
  max: number;
  partBTotal: number;
  partDAdd: number;
}

export interface TaxYear {
  year: number;
  standardDeduction: {
    single: number;
    married: number;
  };
  socialSecurityThresholds: {
    single: { first: number; second: number };
    married: { first: number; second: number };
  };
  capitalGainsBrackets: {
    single: { zeroRate: number; fifteenRate: number };
    married: { zeroRate: number; fifteenRate: number };
  };
  niitThreshold: {
    single: number;
    married: number;
  };
  irmaaBrackets: {
    single: IRMAABracket[];
    married: IRMAABracket[];
  };
  medicarePartBBase: number;
  federalTaxBrackets: {
    single: TaxBracket[];
    married: TaxBracket[];
  };
  rmdFactors: Map<number, number>; // Age -> Factor
}

// 2024 Tax Tables
const TAX_TABLES_2024: TaxYear = {
  year: 2024,
  standardDeduction: {
    single: 14600,
    married: 29200
  },
  socialSecurityThresholds: {
    single: { first: 25000, second: 34000 },
    married: { first: 32000, second: 44000 }
  },
  capitalGainsBrackets: {
    single: { zeroRate: 47025, fifteenRate: 518900 },
    married: { zeroRate: 94050, fifteenRate: 583750 }
  },
  niitThreshold: {
    single: 200000,
    married: 250000
  },
  medicarePartBBase: 174.70,
  irmaaBrackets: {
    single: [
      { min: 0, max: 103000, partBTotal: 174.70, partDAdd: 0 },
      { min: 103000, max: 129000, partBTotal: 244.60, partDAdd: 12.90 },
      { min: 129000, max: 161000, partBTotal: 349.40, partDAdd: 33.30 },
      { min: 161000, max: 193000, partBTotal: 454.20, partDAdd: 53.80 },
      { min: 193000, max: 500000, partBTotal: 559.00, partDAdd: 74.20 },
      { min: 500000, max: Infinity, partBTotal: 594.00, partDAdd: 81.00 }
    ],
    married: [
      { min: 0, max: 206000, partBTotal: 174.70, partDAdd: 0 },
      { min: 206000, max: 258000, partBTotal: 244.60, partDAdd: 12.90 },
      { min: 258000, max: 322000, partBTotal: 349.40, partDAdd: 33.30 },
      { min: 322000, max: 386000, partBTotal: 454.20, partDAdd: 53.80 },
      { min: 386000, max: 750000, partBTotal: 559.00, partDAdd: 74.20 },
      { min: 750000, max: Infinity, partBTotal: 594.00, partDAdd: 81.00 }
    ]
  },
  federalTaxBrackets: {
    single: [
      { min: 0, max: 11600, rate: 0.10 },
      { min: 11600, max: 47150, rate: 0.12 },
      { min: 47150, max: 100525, rate: 0.22 },
      { min: 100525, max: 191950, rate: 0.24 },
      { min: 191950, max: 243725, rate: 0.32 },
      { min: 243725, max: 609350, rate: 0.35 },
      { min: 609350, max: Infinity, rate: 0.37 }
    ],
    married: [
      { min: 0, max: 23200, rate: 0.10 },
      { min: 23200, max: 94300, rate: 0.12 },
      { min: 94300, max: 201050, rate: 0.22 },
      { min: 201050, max: 383900, rate: 0.24 },
      { min: 383900, max: 487450, rate: 0.32 },
      { min: 487450, max: 731200, rate: 0.35 },
      { min: 731200, max: Infinity, rate: 0.37 }
    ]
  },
  rmdFactors: new Map([
    [72, 27.4],
    [73, 26.5],
    [74, 25.5],
    [75, 24.6],
    [76, 23.7],
    [77, 22.9],
    [78, 22.0],
    [79, 21.1],
    [80, 20.2],
    [81, 19.4],
    [82, 18.5],
    [83, 17.7],
    [84, 16.8],
    [85, 16.0],
    [86, 15.2],
    [87, 14.4],
    [88, 13.7],
    [89, 12.9],
    [90, 12.2],
    [95, 8.8],
    [100, 6.1],
    [105, 4.3],
    [110, 3.1],
    [115, 2.3],
    [120, 2.0]
  ])
};

// 2025 Tax Tables (projected with ~3% inflation adjustment)
const TAX_TABLES_2025: TaxYear = {
  year: 2025,
  standardDeduction: {
    single: 15050,
    married: 30100
  },
  socialSecurityThresholds: {
    single: { first: 25000, second: 34000 }, // These don't adjust for inflation
    married: { first: 32000, second: 44000 }
  },
  capitalGainsBrackets: {
    single: { zeroRate: 48450, fifteenRate: 534450 },
    married: { zeroRate: 96900, fifteenRate: 601250 }
  },
  niitThreshold: {
    single: 200000, // These don't adjust for inflation
    married: 250000
  },
  medicarePartBBase: 185.00, // Projected increase
  irmaaBrackets: {
    single: [
      { min: 0, max: 106000, partBTotal: 185.00, partDAdd: 0 },
      { min: 106000, max: 133000, partBTotal: 259.00, partDAdd: 13.30 },
      { min: 133000, max: 166000, partBTotal: 370.00, partDAdd: 34.30 },
      { min: 166000, max: 199000, partBTotal: 481.00, partDAdd: 55.40 },
      { min: 199000, max: 515000, partBTotal: 592.00, partDAdd: 76.40 },
      { min: 515000, max: Infinity, partBTotal: 629.00, partDAdd: 83.40 }
    ],
    married: [
      { min: 0, max: 212000, partBTotal: 185.00, partDAdd: 0 },
      { min: 212000, max: 266000, partBTotal: 259.00, partDAdd: 13.30 },
      { min: 266000, max: 332000, partBTotal: 370.00, partDAdd: 34.30 },
      { min: 332000, max: 398000, partBTotal: 481.00, partDAdd: 55.40 },
      { min: 398000, max: 773000, partBTotal: 592.00, partDAdd: 76.40 },
      { min: 773000, max: Infinity, partBTotal: 629.00, partDAdd: 83.40 }
    ]
  },
  federalTaxBrackets: {
    single: [
      { min: 0, max: 11950, rate: 0.10 },
      { min: 11950, max: 48575, rate: 0.12 },
      { min: 48575, max: 103550, rate: 0.22 },
      { min: 103550, max: 197700, rate: 0.24 },
      { min: 197700, max: 251050, rate: 0.32 },
      { min: 251050, max: 627650, rate: 0.35 },
      { min: 627650, max: Infinity, rate: 0.37 }
    ],
    married: [
      { min: 0, max: 23900, rate: 0.10 },
      { min: 23900, max: 97150, rate: 0.12 },
      { min: 97150, max: 207100, rate: 0.22 },
      { min: 207100, max: 395400, rate: 0.24 },
      { min: 395400, max: 502100, rate: 0.32 },
      { min: 502100, max: 753150, rate: 0.35 },
      { min: 753150, max: Infinity, rate: 0.37 }
    ]
  },
  rmdFactors: TAX_TABLES_2024.rmdFactors // RMD factors don't change yearly
};

// Tax table registry
const TAX_TABLES: Map<number, TaxYear> = new Map([
  [2024, TAX_TABLES_2024],
  [2025, TAX_TABLES_2025]
]);

/**
 * Get tax tables for a specific year
 * Falls back to nearest available year if exact year not found
 */
export function getTaxTables(year: number): TaxYear {
  // Try exact year
  if (TAX_TABLES.has(year)) {
    return TAX_TABLES.get(year)!;
  }
  
  // Find closest year
  const availableYears = Array.from(TAX_TABLES.keys()).sort((a, b) => a - b);
  
  // If year is before earliest available, use earliest
  if (year < availableYears[0]) {
    return TAX_TABLES.get(availableYears[0])!;
  }
  
  // If year is after latest available, use latest with inflation adjustment
  if (year > availableYears[availableYears.length - 1]) {
    const latestYear = availableYears[availableYears.length - 1];
    const latestTables = TAX_TABLES.get(latestYear)!;
    
    // Apply estimated 2.5% annual inflation adjustment to thresholds
    const yearsDiff = year - latestYear;
    const inflationFactor = Math.pow(1.025, yearsDiff);
    
    return adjustTablesForInflation(latestTables, inflationFactor, year);
  }
  
  // Find nearest year
  let closestYear = availableYears[0];
  let minDiff = Math.abs(year - closestYear);
  
  for (const availableYear of availableYears) {
    const diff = Math.abs(year - availableYear);
    if (diff < minDiff) {
      minDiff = diff;
      closestYear = availableYear;
    }
  }
  
  return TAX_TABLES.get(closestYear)!;
}

/**
 * Adjust tax tables for inflation
 */
function adjustTablesForInflation(tables: TaxYear, inflationFactor: number, targetYear: number): TaxYear {
  return {
    ...tables,
    year: targetYear,
    standardDeduction: {
      single: Math.round(tables.standardDeduction.single * inflationFactor / 50) * 50,
      married: Math.round(tables.standardDeduction.married * inflationFactor / 50) * 50
    },
    capitalGainsBrackets: {
      single: {
        zeroRate: Math.round(tables.capitalGainsBrackets.single.zeroRate * inflationFactor / 50) * 50,
        fifteenRate: Math.round(tables.capitalGainsBrackets.single.fifteenRate * inflationFactor / 50) * 50
      },
      married: {
        zeroRate: Math.round(tables.capitalGainsBrackets.married.zeroRate * inflationFactor / 50) * 50,
        fifteenRate: Math.round(tables.capitalGainsBrackets.married.fifteenRate * inflationFactor / 50) * 50
      }
    },
    medicarePartBBase: Math.round(tables.medicarePartBBase * inflationFactor * 10) / 10,
    irmaaBrackets: {
      single: tables.irmaaBrackets.single.map(bracket => ({
        ...bracket,
        min: bracket.min === 0 ? 0 : Math.round(bracket.min * inflationFactor / 1000) * 1000,
        max: bracket.max === Infinity ? Infinity : Math.round(bracket.max * inflationFactor / 1000) * 1000,
        partBTotal: Math.round(bracket.partBTotal * inflationFactor * 10) / 10,
        partDAdd: Math.round(bracket.partDAdd * inflationFactor * 10) / 10
      })),
      married: tables.irmaaBrackets.married.map(bracket => ({
        ...bracket,
        min: bracket.min === 0 ? 0 : Math.round(bracket.min * inflationFactor / 1000) * 1000,
        max: bracket.max === Infinity ? Infinity : Math.round(bracket.max * inflationFactor / 1000) * 1000,
        partBTotal: Math.round(bracket.partBTotal * inflationFactor * 10) / 10,
        partDAdd: Math.round(bracket.partDAdd * inflationFactor * 10) / 10
      }))
    },
    federalTaxBrackets: {
      single: adjustBrackets(tables.federalTaxBrackets.single, inflationFactor),
      married: adjustBrackets(tables.federalTaxBrackets.married, inflationFactor)
    }
  };
}

function adjustBrackets(brackets: TaxBracket[], inflationFactor: number): TaxBracket[] {
  return brackets.map(bracket => ({
    ...bracket,
    min: bracket.min === 0 ? 0 : Math.round(bracket.min * inflationFactor / 50) * 50,
    max: bracket.max === Infinity ? Infinity : Math.round(bracket.max * inflationFactor / 50) * 50
  }));
}

/**
 * Get RMD factor for a given age
 */
export function getRMDFactor(age: number, year: number): number {
  const tables = getTaxTables(year);
  
  // If exact age exists, return it
  if (tables.rmdFactors.has(age)) {
    return tables.rmdFactors.get(age)!;
  }
  
  // For ages below 72, no RMD required
  if (age < 72) {
    return 0;
  }
  
  // For ages above 120, use 2.0
  if (age > 120) {
    return 2.0;
  }
  
  // Interpolate between nearest ages
  const ages = Array.from(tables.rmdFactors.keys()).sort((a, b) => a - b);
  
  for (let i = 0; i < ages.length - 1; i++) {
    if (age > ages[i] && age < ages[i + 1]) {
      const lowerAge = ages[i];
      const upperAge = ages[i + 1];
      const lowerFactor = tables.rmdFactors.get(lowerAge)!;
      const upperFactor = tables.rmdFactors.get(upperAge)!;
      
      // Linear interpolation
      const ratio = (age - lowerAge) / (upperAge - lowerAge);
      return lowerFactor + (upperFactor - lowerFactor) * ratio;
    }
  }
  
  // Fallback (shouldn't reach here)
  return 10.0;
}

/**
 * State tax information
 */
export interface StateTaxInfo {
  incomeRate: number;
  capitalGainsRate: number;
  socialSecurityTaxed: boolean;
  pensionExclusion: number;
  retirementFriendly: boolean;
}

export const STATE_TAX_RATES: Map<string, StateTaxInfo> = new Map([
  ['FL', { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: true }],
  ['TX', { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: true }],
  ['WA', { incomeRate: 0, capitalGainsRate: 0.07, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: true }],
  ['NV', { incomeRate: 0, capitalGainsRate: 0, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: true }],
  ['CA', { incomeRate: 0.133, capitalGainsRate: 0.133, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: false }],
  ['NY', { incomeRate: 0.109, capitalGainsRate: 0.109, socialSecurityTaxed: false, pensionExclusion: 20000, retirementFriendly: false }],
  ['MA', { incomeRate: 0.05, capitalGainsRate: 0.05, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: false }],
  ['NC', { incomeRate: 0.0475, capitalGainsRate: 0.0475, socialSecurityTaxed: false, pensionExclusion: 0, retirementFriendly: true }],
  ['AZ', { incomeRate: 0.025, capitalGainsRate: 0.025, socialSecurityTaxed: false, pensionExclusion: 2500, retirementFriendly: true }],
  ['CO', { incomeRate: 0.044, capitalGainsRate: 0.044, socialSecurityTaxed: true, pensionExclusion: 24000, retirementFriendly: false }]
]);

export function getStateTaxInfo(state: string): StateTaxInfo {
  return STATE_TAX_RATES.get(state.toUpperCase()) || {
    incomeRate: 0.05,
    capitalGainsRate: 0.05,
    socialSecurityTaxed: false,
    pensionExclusion: 0,
    retirementFriendly: false
  };
}