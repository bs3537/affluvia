// State Tax Configuration Module
// Provides tax calculations for major US states with significant populations

interface StateTaxBracket {
  min: number;
  max: number;
  rate: number;
}

interface StateConfig {
  name: string;
  abbreviation: string;
  hasIncomeTax: boolean;
  standardDeduction: {
    single: number;
    married: number;
  };
  brackets: {
    single: StateTaxBracket[];
    married: StateTaxBracket[];
  };
  retireeExemptions?: {
    pensionExemption?: number;      // Amount of pension income exempt
    socialSecurityTaxed?: boolean;  // Whether SS is taxed
    ageThreshold?: number;          // Age for senior exemptions
  };
}

import fs from 'fs';
import path from 'path';

// Major state tax configurations (2024)
// Built-in minimal set (fallback). Full coverage can be loaded from server/state-tax-2024.json
let STATE_TAX_CONFIGS: Record<string, StateConfig> = {
  // No income tax states
  FL: {
    name: 'Florida',
    abbreviation: 'FL',
    hasIncomeTax: false,
    standardDeduction: { single: 0, married: 0 },
    brackets: { single: [], married: [] },
    retireeExemptions: {
      socialSecurityTaxed: false
    }
  },
  
  TX: {
    name: 'Texas', 
    abbreviation: 'TX',
    hasIncomeTax: false,
    standardDeduction: { single: 0, married: 0 },
    brackets: { single: [], married: [] },
    retireeExemptions: {
      socialSecurityTaxed: false
    }
  },
  
  WA: {
    name: 'Washington',
    abbreviation: 'WA', 
    hasIncomeTax: false,
    standardDeduction: { single: 0, married: 0 },
    brackets: { single: [], married: [] },
    retireeExemptions: {
      socialSecurityTaxed: false
    }
  },
  
  // High tax states
  CA: {
    name: 'California',
    abbreviation: 'CA',
    hasIncomeTax: true,
    standardDeduction: { single: 5202, married: 10404 },
    brackets: {
      single: [
        { min: 0, max: 10099, rate: 0.01 },
        { min: 10099, max: 23942, rate: 0.02 },
        { min: 23942, max: 37788, rate: 0.04 },
        { min: 37788, max: 52455, rate: 0.06 },
        { min: 52455, max: 66295, rate: 0.08 },
        { min: 66295, max: 338639, rate: 0.093 },
        { min: 338639, max: 406364, rate: 0.103 },
        { min: 406364, max: 677278, rate: 0.113 },
        { min: 677278, max: Infinity, rate: 0.123 }
      ],
      married: [
        { min: 0, max: 20198, rate: 0.01 },
        { min: 20198, max: 47884, rate: 0.02 },
        { min: 47884, max: 75576, rate: 0.04 },
        { min: 75576, max: 104910, rate: 0.06 },
        { min: 104910, max: 132590, rate: 0.08 },
        { min: 132590, max: 677278, rate: 0.093 },
        { min: 677278, max: 812728, rate: 0.103 },
        { min: 812728, max: 1354556, rate: 0.113 },
        { min: 1354556, max: Infinity, rate: 0.123 }
      ]
    },
    retireeExemptions: {
      socialSecurityTaxed: false,
      // CA doesn't tax SS but taxes all other retirement income
    }
  },
  
  NY: {
    name: 'New York',
    abbreviation: 'NY',
    hasIncomeTax: true,
    standardDeduction: { single: 8000, married: 16050 },
    brackets: {
      single: [
        { min: 0, max: 8500, rate: 0.04 },
        { min: 8500, max: 11700, rate: 0.045 },
        { min: 11700, max: 13900, rate: 0.0525 },
        { min: 13900, max: 80650, rate: 0.0585 },
        { min: 80650, max: 215400, rate: 0.0625 },
        { min: 215400, max: 1077550, rate: 0.0685 },
        { min: 1077550, max: 5000000, rate: 0.0965 },
        { min: 5000000, max: 25000000, rate: 0.103 },
        { min: 25000000, max: Infinity, rate: 0.109 }
      ],
      married: [
        { min: 0, max: 17150, rate: 0.04 },
        { min: 17150, max: 23600, rate: 0.045 },
        { min: 23600, max: 27900, rate: 0.0525 },
        { min: 27900, max: 161550, rate: 0.0585 },
        { min: 161550, max: 323200, rate: 0.0625 },
        { min: 323200, max: 2155350, rate: 0.0685 },
        { min: 2155350, max: 5000000, rate: 0.0965 },
        { min: 5000000, max: 25000000, rate: 0.103 },
        { min: 25000000, max: Infinity, rate: 0.109 }
      ]
    },
    retireeExemptions: {
      pensionExemption: 20000,  // Up to $20k pension income exempt
      socialSecurityTaxed: false
    }
  },
  
  // Moderate tax states with retiree benefits
  PA: {
    name: 'Pennsylvania',
    abbreviation: 'PA',
    hasIncomeTax: true,
    standardDeduction: { single: 0, married: 0 }, // No standard deduction
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.0307 }], // Flat 3.07%
      married: [{ min: 0, max: Infinity, rate: 0.0307 }]
    },
    retireeExemptions: {
      pensionExemption: Infinity, // All retirement income exempt
      socialSecurityTaxed: false
    }
  },
  
  IL: {
    name: 'Illinois',
    abbreviation: 'IL',
    hasIncomeTax: true,
    standardDeduction: { single: 2425, married: 4850 },
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.0495 }], // Flat 4.95%
      married: [{ min: 0, max: Infinity, rate: 0.0495 }]
    },
    retireeExemptions: {
      socialSecurityTaxed: false
      // IL taxes retirement income but not SS
    }
  },
  
  // Moderate tax, retirement-friendly states
  NC: {
    name: 'North Carolina', 
    abbreviation: 'NC',
    hasIncomeTax: true,
    standardDeduction: { single: 12750, married: 25500 },
    brackets: {
      single: [{ min: 0, max: Infinity, rate: 0.0475 }], // Flat 4.75%
      married: [{ min: 0, max: Infinity, rate: 0.0475 }]
    },
    retireeExemptions: {
      socialSecurityTaxed: false
      // NC lowered rates and is retirement-friendly
    }
  }
};

// Attempt to load external full 50-state dataset (server/state-tax-2024.json)
try {
  const jsonPath = path.resolve(process.cwd(), 'server', 'state-tax-2024.json');
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      // Normalize keys to uppercase state abbreviations
      const normalized: Record<string, StateConfig> = {} as any;
      for (const [key, cfg] of Object.entries<any>(data)) {
        if (!cfg) continue;
        const abbr = (cfg.abbreviation || key).toUpperCase();
        normalized[abbr] = cfg as StateConfig;
      }
      if (Object.keys(normalized).length >= 30) {
        STATE_TAX_CONFIGS = normalized; // Use external dataset if it looks reasonably complete
        // console.log('[state-tax-config] Loaded external state-tax-2024.json with', Object.keys(normalized).length, 'entries.');
      }
    }
  }
} catch (e) {
  // Ignore and keep built-in fallback
}

// Helper: compute taxable Social Security at state level (simplified overlay)
function computeStateTaxableSocialSecurity(
  ssGross: number,
  otherIncome: number,
  filingStatus: 'single' | 'married',
  state: string,
  age?: number
): number {
  if (!ssGross || ssGross <= 0) return 0;
  const st = (state || '').toUpperCase();

  // States that may tax Social Security in 2024 (simplified)
  const TAX_SSN = new Set(['CO','CT','MN','MT','NM','RI','UT','VT','WV']);
  if (!TAX_SSN.has(st)) return 0; // default: not taxed

  // Federal-style provisional income to estimate taxable portion
  const provisional = otherIncome + 0.5 * ssGross;
  const thresholds = filingStatus === 'single' ? { first: 25000, second: 34000 } : { first: 32000, second: 44000 };
  let federalTaxable = 0;
  if (provisional <= thresholds.first) federalTaxable = 0;
  else if (provisional <= thresholds.second) federalTaxable = Math.min((provisional - thresholds.first) * 0.5, ssGross * 0.5);
  else {
    const firstTier = (thresholds.second - thresholds.first) * 0.5;
    const secondTier = (provisional - thresholds.second) * 0.85;
    federalTaxable = Math.min(firstTier + secondTier, ssGross * 0.85);
  }

  // State-specific simplifications
  // Colorado: age 65+ fully excludes SS; 55-64 exclude if AGI under thresholds (HB24-1142)
  if (st === 'CO') {
    const agi = otherIncome + ssGross; // rough proxy
    if ((age || 0) >= 65) return 0;
    if ((age || 0) >= 55) {
      const capSingle = 75000;
      const capMarried = 95000;
      const cap = filingStatus === 'married' ? capMarried : capSingle;
      if (agi <= cap) return 0;
    }
  }

  // Connecticut: exempt if AGI under thresholds; otherwise cap at 25% of gross SS taxed
  if (st === 'CT') {
    const agi = provisional - 0.5 * ssGross; // rough AGI proxy
    const capSingle = 75000;
    const capMarried = 100000;
    const cap = filingStatus === 'married' ? capMarried : capSingle;
    if (agi <= cap) return 0;
    return Math.min(federalTaxable, ssGross * 0.25);
  }

  // Minnesota: simplified 2024 thresholds per MN DoR (simplified method)
  if (st === 'MN') {
    const agi = otherIncome + ssGross;
    const thrSingle = 82190; // 2024
    const thrMarried = 105380; // 2024
    const thr = filingStatus === 'married' ? thrMarried : thrSingle;
    if (agi <= thr) return 0;
    // Phase-out: reduce exemption by 10% for each $4,000 (MFJ) or $2,000 (MFS); approximate using $4,000
    const over = agi - thr;
    const steps = Math.ceil(over / 4000);
    const phase = Math.min(1, steps * 0.10);
    // Taxable portion is federalTaxable times phase-out fraction
    return Math.max(0, Math.min(federalTaxable, federalTaxable * phase));
  }

  // Montana: tiered deduction based on AGI
  if (st === 'MT') {
    const agi = otherIncome + ssGross;
    let deductiblePct = 0;
    if (filingStatus === 'married') {
      if (agi < 32000) deductiblePct = 1.0;
      else if (agi <= 44000) deductiblePct = 0.5;
      else deductiblePct = 0.15; // only 15% deductible above 44k
    } else {
      if (agi < 25000) deductiblePct = 1.0;
      else if (agi <= 34000) deductiblePct = 0.5;
      else deductiblePct = 0.15;
    }
    const maxTaxableFromGross = ssGross * (1 - deductiblePct);
    return Math.max(0, Math.min(federalTaxable, maxTaxableFromGross));
  }

  // New Mexico: exempt if AGI under thresholds (tax year 2022+), otherwise tax federally taxable portion
  if (st === 'NM') {
    const agi = otherIncome + ssGross;
    const capSingle = 100000;
    const capMarried = 150000;
    const cap = filingStatus === 'married' ? capMarried : capSingle;
    if (agi <= cap) return 0;
    return Math.max(0, federalTaxable);
  }

  // Rhode Island: exempt at/after FRA if AGI under threshold; otherwise tax federal portion (approx 2024 thresholds)
  if (st === 'RI') {
    const agi = otherIncome + ssGross;
    const fraAge = 67;
    const capSingle = 101000; // approximate 2024
    const capMarried = 126000; // approximate 2024
    const cap = filingStatus === 'married' ? capMarried : capSingle;
    if ((age || 0) >= fraAge && agi <= cap) return 0;
    return Math.max(0, federalTaxable);
  }

  // Vermont: exempt if AGI under threshold; otherwise tax federal portion (baseline)
  if (st === 'VT') {
    const agi = otherIncome + ssGross;
    const capSingle = 50000;
    const capMarried = 65000;
    const cap = filingStatus === 'married' ? capMarried : capSingle;
    if (agi <= cap) return 0;
    return Math.max(0, federalTaxable);
  }

  // West Virginia: 2024 phase-out – 100% exempt if AGI <= $50k single/$100k MFJ; otherwise 35% exemption of gross SS
  if (st === 'WV') {
    const agi = otherIncome + ssGross;
    const capSingle = 50000;
    const capMarried = 100000;
    const cap = filingStatus === 'married' ? capMarried : capSingle;
    if (agi <= cap) return 0;
    const maxTaxableFromGross = ssGross * 0.65; // 35% exempt in 2024
    return Math.max(0, Math.min(federalTaxable, maxTaxableFromGross));
  }

  // Others (MN, MT, NM, RI, UT, VT, WV): tax up to federally taxable amount (many offer credits—this is a reasonable baseline)
  return Math.max(0, federalTaxable);
}

// Calculate state income tax
export function calculateStateTax(
  grossIncome: number,
  pensionIncome: number,
  socialSecurityIncome: number,
  filingStatus: 'single' | 'married' | 'head_of_household',
  state: string,
  age?: number
): { tax: number; effectiveRate: number; marginalRate: number } {
  
  const stateConfig = STATE_TAX_CONFIGS[state.toUpperCase()];
  
  if (!stateConfig || !stateConfig.hasIncomeTax) {
    return { tax: 0, effectiveRate: 0, marginalRate: 0 };
  }
  
  // Start with base income (excludes Social Security from caller)
  let taxableIncome = grossIncome;

  // Add state-taxable portion of Social Security (overlay)
  const otherIncome = grossIncome; // SS not included in base
  const stateTaxableSS = computeStateTaxableSocialSecurity(socialSecurityIncome || 0, otherIncome, filingStatus, state, age);
  taxableIncome += stateTaxableSS;

  // Apply pension/age exemptions if configured for the state
  if (stateConfig.retireeExemptions) {
    const exemptions = stateConfig.retireeExemptions;
    if (exemptions.pensionExemption && pensionIncome > 0) {
      const exemptAmount = Math.min(pensionIncome, exemptions.pensionExemption);
      taxableIncome -= exemptAmount;
    }
    if (exemptions.ageThreshold && age && age >= exemptions.ageThreshold) {
      // Placeholder for states with senior-specific deductions
    }
  }
  
  // Apply standard deduction
  const stateFiling: 'single' | 'married' = filingStatus === 'married' ? 'married' : 'single';
  const standardDeduction = stateConfig.standardDeduction[stateFiling];
  taxableIncome = Math.max(0, taxableIncome - standardDeduction);
  
  if (taxableIncome <= 0) {
    return { tax: 0, effectiveRate: 0, marginalRate: 0 };
  }
  
  // Calculate tax using brackets
  const brackets = stateConfig.brackets[stateFiling];
  let tax = 0;
  let marginalRate = 0;
  
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
    marginalRate = bracket.rate; // Last applicable rate
    
    if (taxableIncome <= bracket.max) break;
  }
  
  const effectiveRate = grossIncome > 0 ? tax / grossIncome : 0;
  
  return { tax, effectiveRate, marginalRate };
}

// Get list of available states
export function getAvailableStates(): { abbreviation: string; name: string; hasIncomeTax: boolean }[] {
  return Object.entries(STATE_TAX_CONFIGS).map(([abbr, config]) => ({
    abbreviation: abbr,
    name: config.name,
    hasIncomeTax: config.hasIncomeTax
  }));
}

// Get state configuration for reference
export function getStateConfig(state: string): StateConfig | null {
  return STATE_TAX_CONFIGS[state.toUpperCase()] || null;
}

// Calculate combined federal + state effective rate
export function calculateCombinedTaxRate(
  grossIncome: number,
  pensionIncome: number,
  socialSecurityIncome: number,
  capitalGains: number,
  filingStatus: 'single' | 'married',
  state: string,
  federalTax: number,
  age?: number
): { 
  stateTax: number; 
  totalTax: number; 
  effectiveRate: number; 
  stateEffectiveRate: number;
  marginalRate: number;
} {
  
  const stateResult = calculateStateTax(
    grossIncome, 
    pensionIncome, 
    socialSecurityIncome, 
    filingStatus, 
    state, 
    age
  );
  
  const totalTax = federalTax + stateResult.tax;
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;
  
  return {
    stateTax: stateResult.tax,
    totalTax,
    effectiveRate,
    stateEffectiveRate: stateResult.effectiveRate,
    marginalRate: stateResult.marginalRate
  };
}

// Export types and configurations
export type { StateConfig, StateTaxBracket };
export { STATE_TAX_CONFIGS };
