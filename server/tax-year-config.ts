// Tax Year Configuration Module with CPI Indexing
// Provides year-aware tax brackets, standard deductions, and IRMAA thresholds

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

interface StandardDeduction {
  single: number;
  married: number;
  head_of_household?: number;
}

interface LTCGBracket {
  min: number;
  max: number;
  rate: number;
}

interface IRMAABracket {
  min: number;
  max: number;
  partBTotal: number;
  partDAdd: number;
}

interface TaxYearConfig {
  year: number;
  federalBrackets: {
    single: TaxBracket[];
    married: TaxBracket[];
    head_of_household: TaxBracket[];
  };
  standardDeduction: StandardDeduction;
  // Additional standard deduction for seniors (65+)
  seniorAdditionalDeduction: StandardDeduction;
  ltcgBrackets: {
    single: LTCGBracket[];
    married: LTCGBracket[];
    head_of_household: LTCGBracket[];
  };
  irmaaBrackets: {
    single: IRMAABracket[];
    married: IRMAABracket[];
  };
  irmaaBasePremium: number;
  niitThreshold: {
    single: number;
    married: number;
    head_of_household: number;
  };
  socialSecurityWageBase: number;
}

// Base 2024 tax configuration
const TAX_CONFIG_2024: TaxYearConfig = {
  year: 2024,
  federalBrackets: {
    married: [
      { min: 0, max: 23200, rate: 0.10 },
      { min: 23200, max: 94300, rate: 0.12 },
      { min: 94300, max: 201050, rate: 0.22 },
      { min: 201050, max: 383900, rate: 0.24 },
      { min: 383900, max: 487450, rate: 0.32 },
      { min: 487450, max: 731200, rate: 0.35 },
      { min: 731200, max: Infinity, rate: 0.37 }
    ],
    single: [
      { min: 0, max: 11600, rate: 0.10 },
      { min: 11600, max: 47150, rate: 0.12 },
      { min: 47150, max: 100525, rate: 0.22 },
      { min: 100525, max: 191950, rate: 0.24 },
      { min: 191950, max: 243725, rate: 0.32 },
      { min: 243725, max: 609350, rate: 0.35 },
      { min: 609350, max: Infinity, rate: 0.37 }
    ],
    head_of_household: [
      { min: 0, max: 16550, rate: 0.10 },
      { min: 16550, max: 63100, rate: 0.12 },
      { min: 63100, max: 100500, rate: 0.22 },
      { min: 100500, max: 191950, rate: 0.24 },
      { min: 191950, max: 243700, rate: 0.32 },
      { min: 243700, max: 609350, rate: 0.35 },
      { min: 609350, max: Infinity, rate: 0.37 }
    ]
  },
  standardDeduction: {
    single: 14600,
    married: 29200,
    head_of_household: 21900
  },
  seniorAdditionalDeduction: {
    // 2024 IRS amounts
    single: 1950,     // Single or not surviving spouse
    married: 1550,    // Per spouse (MFJ)
    head_of_household: 1950
  },
  ltcgBrackets: {
    single: [
      { min: 0, max: 47025, rate: 0.00 },
      { min: 47025, max: 518900, rate: 0.15 },
      { min: 518900, max: Infinity, rate: 0.20 }
    ],
    married: [
      { min: 0, max: 94050, rate: 0.00 },
      { min: 94050, max: 583750, rate: 0.15 },
      { min: 583750, max: Infinity, rate: 0.20 }
    ],
    head_of_household: [
      { min: 0, max: 63000, rate: 0.00 },
      { min: 63000, max: 551350, rate: 0.15 },
      { min: 551350, max: Infinity, rate: 0.20 }
    ]
  },
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
  irmaaBasePremium: 174.70,
  niitThreshold: {
    single: 200000,
    married: 250000,
    head_of_household: 200000
  },
  socialSecurityWageBase: 168600
};

// Historical CPI-U data for calibration (annual averages)
const CPI_HISTORY: Record<number, number> = {
  2020: 258.811,
  2021: 270.970,
  2022: 292.655,
  2023: 304.702,
  2024: 310.326  // Estimated
};

// Apply CPI inflation to tax brackets and thresholds
function inflateTaxConfig(baseConfig: TaxYearConfig, targetYear: number, cpiInflationRate?: number): TaxYearConfig {
  if (targetYear === baseConfig.year) {
    return baseConfig;
  }

  // Calculate cumulative inflation factor
  let inflationFactor: number;
  
  if (targetYear <= 2024 && CPI_HISTORY[targetYear]) {
    // Use historical CPI for past years
    inflationFactor = CPI_HISTORY[targetYear] / CPI_HISTORY[baseConfig.year];
  } else {
    // Use provided inflation rate or default to 2.5% annually
    const annualRate = cpiInflationRate ?? 0.025;
    const yearsDiff = targetYear - baseConfig.year;
    inflationFactor = Math.pow(1 + annualRate, yearsDiff);
  }

  // Helper function to inflate a bracket
  const inflateBracket = <T extends { min: number; max: number }>(bracket: T): T => ({
    ...bracket,
    min: Math.round(bracket.min * inflationFactor / 50) * 50, // Round to nearest $50
    max: bracket.max === Infinity ? Infinity : Math.round(bracket.max * inflationFactor / 50) * 50
  });

  return {
    year: targetYear,
    federalBrackets: {
      single: baseConfig.federalBrackets.single.map(inflateBracket),
      married: baseConfig.federalBrackets.married.map(inflateBracket),
      head_of_household: baseConfig.federalBrackets.head_of_household.map(inflateBracket)
    },
    standardDeduction: {
      single: Math.round(baseConfig.standardDeduction.single * inflationFactor / 50) * 50,
      married: Math.round(baseConfig.standardDeduction.married * inflationFactor / 50) * 50,
      head_of_household: Math.round((baseConfig.standardDeduction.head_of_household || 0) * inflationFactor / 50) * 50
    },
    seniorAdditionalDeduction: {
      single: Math.round(baseConfig.seniorAdditionalDeduction.single * inflationFactor / 50) * 50,
      married: Math.round(baseConfig.seniorAdditionalDeduction.married * inflationFactor / 50) * 50,
      head_of_household: Math.round((baseConfig.seniorAdditionalDeduction.head_of_household || baseConfig.seniorAdditionalDeduction.single) * inflationFactor / 50) * 50
    },
    ltcgBrackets: {
      single: baseConfig.ltcgBrackets.single.map(inflateBracket),
      married: baseConfig.ltcgBrackets.married.map(inflateBracket),
      head_of_household: baseConfig.ltcgBrackets.head_of_household.map(inflateBracket)
    },
    irmaaBrackets: {
      single: baseConfig.irmaaBrackets.single.map(bracket => ({
        ...inflateBracket(bracket),
        partBTotal: bracket.partBTotal * inflationFactor,
        partDAdd: bracket.partDAdd * inflationFactor
      })),
      married: baseConfig.irmaaBrackets.married.map(bracket => ({
        ...inflateBracket(bracket),
        partBTotal: bracket.partBTotal * inflationFactor,
        partDAdd: bracket.partDAdd * inflationFactor
      }))
    },
    irmaaBasePremium: baseConfig.irmaaBasePremium * inflationFactor,
    niitThreshold: {
      single: Math.round(baseConfig.niitThreshold.single * inflationFactor / 1000) * 1000,
      married: Math.round(baseConfig.niitThreshold.married * inflationFactor / 1000) * 1000,
      head_of_household: Math.round(baseConfig.niitThreshold.head_of_household * inflationFactor / 1000) * 1000
    },
    socialSecurityWageBase: Math.round(baseConfig.socialSecurityWageBase * inflationFactor / 100) * 100
  };
}

// Cache for tax configurations by year
const taxConfigCache = new Map<number, TaxYearConfig>();

// Get tax configuration for a specific year
export function getTaxConfig(year: number, cpiInflationRate?: number): TaxYearConfig {
  // Check cache first
  const cacheKey = year;
  if (taxConfigCache.has(cacheKey)) {
    return taxConfigCache.get(cacheKey)!;
  }

  // Generate configuration
  const config = inflateTaxConfig(TAX_CONFIG_2024, year, cpiInflationRate);
  
  // Cache for future use
  taxConfigCache.set(cacheKey, config);
  
  return config;
}

// Calculate federal tax using year-specific configuration
export function calculateFederalTaxWithYear(
  grossIncome: number,
  filingStatus: 'single' | 'married' | 'head_of_household',
  year: number
): number {
  if (grossIncome <= 0) return 0;
  
  const config = getTaxConfig(year);
  const standardDeduction = config.standardDeduction[filingStatus];
  
  // Apply standard deduction
  const taxableIncome = Math.max(0, grossIncome - standardDeduction);
  
  if (taxableIncome <= 0) return 0;
  
  const brackets = config.federalBrackets[filingStatus];
  
  let tax = 0;
  let previousMax = 0;
  
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - previousMax;
    tax += taxableInBracket * bracket.rate;
    previousMax = bracket.max;
    
    if (taxableIncome <= bracket.max) break;
  }
  
  return tax;
}

// Calculate capital gains tax using year-specific configuration
export function calculateCapitalGainsTaxWithYear(
  capitalGainsIncome: number,
  ordinaryIncome: number,
  filingStatus: 'single' | 'married' | 'head_of_household',
  year: number
): number {
  if (capitalGainsIncome <= 0) return 0;
  
  const config = getTaxConfig(year);
  const brackets = config.ltcgBrackets[filingStatus];
  const totalIncome = ordinaryIncome + capitalGainsIncome;
  
  let tax = 0;
  let previousMax = 0;
  
  for (const bracket of brackets) {
    if (ordinaryIncome >= bracket.max) continue;
    
    const gainsTaxableAtThisRate = Math.min(
      capitalGainsIncome,
      Math.max(0, bracket.max - Math.max(ordinaryIncome, previousMax))
    );
    
    tax += gainsTaxableAtThisRate * bracket.rate;
    previousMax = bracket.max;
    
    if (totalIncome <= bracket.max) break;
  }
  
  // Add NIIT if applicable
  const niitThreshold = config.niitThreshold[filingStatus];
  if (totalIncome > niitThreshold) {
    const niitIncome = Math.min(capitalGainsIncome, totalIncome - niitThreshold);
    tax += niitIncome * 0.038;
  }
  
  return tax;
}

// Calculate IRMAA using year-specific configuration
export function calculateIRMAAWithYear(
  modifiedAGI: number,
  filingStatus: 'single' | 'married',
  year: number
): { partBPremium: number; partDPremium: number; surcharge: number; bracketName: string } {
  const config = getTaxConfig(year);
  const brackets = config.irmaaBrackets[filingStatus];
  
  for (const bracket of brackets) {
    if (modifiedAGI < bracket.max) {
      const surcharge = bracket.partBTotal - config.irmaaBasePremium;
      return {
        partBPremium: bracket.partBTotal,
        partDPremium: bracket.partDAdd,
        surcharge,
        bracketName: bracket.min === 0 ? 'Base' : `Tier ${brackets.indexOf(bracket)}`
      };
    }
  }
  
  // Highest bracket
  const highestBracket = brackets[brackets.length - 1];
  return {
    partBPremium: highestBracket.partBTotal,
    partDPremium: highestBracket.partDAdd,
    surcharge: highestBracket.partBTotal - config.irmaaBasePremium,
    bracketName: 'Highest'
  };
}

// Export types and main functions
export type { TaxYearConfig, TaxBracket, LTCGBracket, IRMAABracket, StandardDeduction };
export { TAX_CONFIG_2024, inflateTaxConfig };
