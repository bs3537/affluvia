// Asset Tax Classification System for Retirement Planning
// Classifies assets by their tax treatment during retirement withdrawals

// Replace enum with const object + type for Node.js compatibility
export const AssetTaxType = {
  TAX_DEFERRED: 'TAX_DEFERRED',           // Fully taxable as ordinary income
  TAX_FREE: 'TAX_FREE',                   // No taxes on qualified withdrawals
  CAPITAL_GAINS: 'CAPITAL_GAINS',         // Taxed on gains only
  NON_RETIREMENT: 'NON_RETIREMENT',       // Not typically used for retirement
  SPECIAL: 'SPECIAL'                      // Special tax treatment
} as const;

export type AssetTaxType = typeof AssetTaxType[keyof typeof AssetTaxType];

export interface AssetTaxInfo {
  taxType: AssetTaxType;
  description: string;
  isRetirementAsset: boolean;
  hasRMD: boolean;  // Subject to Required Minimum Distributions
  rmdAge?: number;  // Age when RMDs begin (if applicable)
  expectedReturn?: number;  // Asset-specific expected annual return (e.g., 0.005 for 0.5%)
}

// Asset type to tax classification mapping
export const ASSET_TAX_CLASSIFICATION: { [key: string]: AssetTaxInfo } = {
  // Fully Tax-Deferred (Traditional retirement accounts)
  '401k': {
    taxType: AssetTaxType.TAX_DEFERRED,
    description: 'Traditional 401(k) - Fully taxable as ordinary income',
    isRetirementAsset: true,
    hasRMD: true,
    rmdAge: 73  // As of 2024
  },
  '401(k)': {  // Plaid format variant
    taxType: AssetTaxType.TAX_DEFERRED,
    description: 'Traditional 401(k) - Fully taxable as ordinary income',
    isRetirementAsset: true,
    hasRMD: true,
    rmdAge: 73
  },
  '403b': {
    taxType: AssetTaxType.TAX_DEFERRED,
    description: 'Traditional 403(b) - Fully taxable as ordinary income',
    isRetirementAsset: true,
    hasRMD: true,
    rmdAge: 73
  },
  '403(b)': {  // Plaid format variant
    taxType: AssetTaxType.TAX_DEFERRED,
    description: 'Traditional 403(b) - Fully taxable as ordinary income',
    isRetirementAsset: true,
    hasRMD: true,
    rmdAge: 73
  },
  'traditional-ira': {
    taxType: AssetTaxType.TAX_DEFERRED,
    description: 'Traditional IRA - Fully taxable as ordinary income',
    isRetirementAsset: true,
    hasRMD: true,
    rmdAge: 73
  },
  'Traditional IRA': {  // Plaid format variant
    taxType: AssetTaxType.TAX_DEFERRED,
    description: 'Traditional IRA - Fully taxable as ordinary income',
    isRetirementAsset: true,
    hasRMD: true,
    rmdAge: 73
  },
  'other-tax-deferred': {
    taxType: AssetTaxType.TAX_DEFERRED,
    description: 'Other tax-deferred accounts (457, SEP, SIMPLE) - Fully taxable',
    isRetirementAsset: true,
    hasRMD: true,
    rmdAge: 73
  },
  'qualified-annuities': {
    taxType: AssetTaxType.TAX_DEFERRED,
    description: 'Qualified annuities - Fully taxable as ordinary income',
    isRetirementAsset: true,
    hasRMD: true,
    rmdAge: 73
  },

  // Tax-Free Accounts (Roth)
  'roth-ira': {
    taxType: AssetTaxType.TAX_FREE,
    description: 'Roth IRA - Tax-free qualified withdrawals',
    isRetirementAsset: true,
    hasRMD: false  // No RMDs for original owner
  },
  'Roth IRA': {  // Plaid format variant
    taxType: AssetTaxType.TAX_FREE,
    description: 'Roth IRA - Tax-free qualified withdrawals',
    isRetirementAsset: true,
    hasRMD: false
  },
  'roth-annuities': {
    taxType: AssetTaxType.TAX_FREE,
    description: 'Roth annuities - Tax-free qualified withdrawals',
    isRetirementAsset: true,
    hasRMD: false
  },

  // Capital Gains Treatment
  'taxable-brokerage': {
    taxType: AssetTaxType.CAPITAL_GAINS,
    description: 'Taxable brokerage - Capital gains tax on profits only',
    isRetirementAsset: true,
    hasRMD: false
  },
  // Common lowercase alias used in some profiles
  'brokerage': {
    taxType: AssetTaxType.CAPITAL_GAINS,
    description: 'Taxable brokerage - Capital gains tax on profits only',
    isRetirementAsset: true,
    hasRMD: false
  },
  'Brokerage Account': {  // Plaid format variant
    taxType: AssetTaxType.CAPITAL_GAINS,
    description: 'Taxable brokerage - Capital gains tax on profits only',
    isRetirementAsset: true,
    hasRMD: false
  },
  'non-qualified-annuities': {
    taxType: AssetTaxType.CAPITAL_GAINS,
    description: 'Non-qualified annuities - Partially taxable (gains only)',
    isRetirementAsset: true,
    hasRMD: false
  },
  'cash-value-life-insurance': {
    taxType: AssetTaxType.CAPITAL_GAINS,
    description: 'Cash value life insurance - ~3% average return, tax-free up to basis',
    isRetirementAsset: true,
    hasRMD: false,
    expectedReturn: 0.03  // 3% average return for cash value life insurance
  },

  // Special Tax Treatment
  'hsa': {
    taxType: AssetTaxType.SPECIAL,
    description: 'HSA - Tax-free for medical, ordinary income after 65 for non-medical',
    isRetirementAsset: true,
    hasRMD: false
  },
  'HSA': {  // Plaid format variant (uppercase)
    taxType: AssetTaxType.SPECIAL,
    description: 'HSA - Tax-free for medical, ordinary income after 65 for non-medical',
    isRetirementAsset: true,
    hasRMD: false
  },

  // Liquid Assets (conservative returns, minimal tax impact)
  'savings': {
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Savings account - ~0.5% average return, interest taxed annually',
    isRetirementAsset: true,
    hasRMD: false,
    expectedReturn: 0.005  // 0.5% US average savings rate
  },
  'Savings Account': {  // Plaid format variant
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Savings account - ~0.5% average return, interest taxed annually',
    isRetirementAsset: true,
    hasRMD: false,
    expectedReturn: 0.005
  },
  'Saving Account': {  // Plaid format variant (singular)
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Savings account - ~0.5% average return, interest taxed annually',
    isRetirementAsset: true,
    hasRMD: false,
    expectedReturn: 0.005
  },
  'checking': {
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Checking account - Not suitable for retirement projections',
    isRetirementAsset: false,  // EXCLUDED from retirement calculations
    hasRMD: false
  },
  'Checking Account': {  // Plaid format variant
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Checking account - Not suitable for retirement projections',
    isRetirementAsset: false,  // EXCLUDED from retirement calculations
    hasRMD: false
  },

  // Non-Retirement Assets
  'vehicle': {
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Vehicle - Not a retirement asset',
    isRetirementAsset: false,
    hasRMD: false
  },
  'business': {
    taxType: AssetTaxType.SPECIAL,
    description: 'Business interest - Complex tax treatment',
    isRetirementAsset: false,
    hasRMD: false
  },
  'other': {
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Other assets - Tax treatment varies',
    isRetirementAsset: true,
    hasRMD: false
  },
  'Other': {  // Plaid format variant (capitalized)
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Other assets - Tax treatment varies',
    isRetirementAsset: true,
    hasRMD: false
  },
  'Money Market': {  // Plaid format variant
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Money Market - ~0.5% average return, interest taxed annually',
    isRetirementAsset: true,
    hasRMD: false,
    expectedReturn: 0.005
  },
  'CD': {  // Certificate of Deposit - Plaid format
    taxType: AssetTaxType.NON_RETIREMENT,
    description: 'Certificate of Deposit - Fixed return, interest taxed annually',
    isRetirementAsset: true,
    hasRMD: false,
    expectedReturn: 0.02  // ~2% average CD rate
  }
};

// Calculate Required Minimum Distribution
export function calculateRMD(accountBalance: number, age: number): number {
  // IRS Uniform Lifetime Table (simplified version)
  // In production, use complete IRS tables
  const rmdFactors: { [key: number]: number } = {
    73: 26.5,
    74: 25.5,
    75: 24.6,
    76: 23.7,
    77: 22.9,
    78: 22.0,
    79: 21.1,
    80: 20.2,
    81: 19.4,
    82: 18.5,
    83: 17.7,
    84: 16.8,
    85: 16.0,
    86: 15.2,
    87: 14.4,
    88: 13.7,
    89: 12.9,
    90: 12.2,
    95: 8.9,
    100: 6.4,
    105: 4.6,
    110: 3.5,
    115: 2.8,
    120: 2.0
  };

  if (age < 73) return 0; // No RMD required yet

  // Find the appropriate factor
  let factor = rmdFactors[age];
  if (!factor) {
    // Interpolate or use closest age
    const ages = Object.keys(rmdFactors).map(Number).sort((a, b) => a - b);
    const closestAge = ages.reduce((prev, curr) => 
      Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev
    );
    factor = rmdFactors[closestAge];
  }

  return accountBalance / factor;
}

// Asset allocation for tax-efficient withdrawal strategy
export interface AssetBuckets {
  taxDeferred: number;      // 401k, Traditional IRA, etc.
  taxFree: number;          // Roth IRA, Roth 401k
  capitalGains: number;     // Taxable brokerage (market value)
  cashEquivalents: number;  // Savings, checking
  totalAssets: number;
  taxableBasis?: number;    // Cost basis for capitalGains bucket (for accurate tax calculation)
}

// Categorize assets by tax treatment
export function categorizeAssetsByTax(assets: any[]): AssetBuckets {
  const buckets: AssetBuckets = {
    taxDeferred: 0,
    taxFree: 0,
    capitalGains: 0,
    cashEquivalents: 0,
    totalAssets: 0,
    taxableBasis: 0  // Initialize cost basis tracking
  };

  for (const asset of assets) {
    const value = Number(asset.value) || 0;
    const taxInfo = ASSET_TAX_CLASSIFICATION[asset.type];
    
    if (!taxInfo || !taxInfo.isRetirementAsset || value <= 0) continue;

    buckets.totalAssets += value;

    switch (taxInfo.taxType) {
      case AssetTaxType.TAX_DEFERRED:
        buckets.taxDeferred += value;
        break;
      case AssetTaxType.TAX_FREE:
        buckets.taxFree += value;
        break;
      case AssetTaxType.CAPITAL_GAINS:
        buckets.capitalGains += value;
        // Initialize basis as value (assuming no built-in gains initially)
        // This will be refined with actual cost basis data if available
        buckets.taxableBasis! += value;
        break;
      case AssetTaxType.NON_RETIREMENT:
        if (asset.type === 'savings' || asset.type === 'checking' ||
            asset.type === 'Savings Account' || asset.type === 'Saving Account' ||
            asset.type === 'Checking Account' || asset.type === 'Money Market' ||
            asset.type === 'CD' || asset.type === 'Other') {
          buckets.cashEquivalents += value;
        }
        break;
      case AssetTaxType.SPECIAL:
        // HSA: After age 65, treated as tax-deferred for non-medical withdrawals
        // For simplicity in retirement planning, we categorize it as tax-deferred
        if (asset.type === 'hsa' || asset.type === 'HSA') {
          buckets.taxDeferred += value;
        }
        break;
    }
  }

  return buckets;
}

// Calculate tax-efficient withdrawal order
// Generally: Taxable first, then tax-deferred, then tax-free (Roth) last
export interface WithdrawalStrategy {
  fromCash: number;
  fromCapitalGains: number;
  fromTaxDeferred: number;
  fromTaxFree: number;
  totalGrossWithdrawal: number;
  estimatedTaxes: number;
  netAmountReceived: number; // Add this to track actual net amount after taxes
  updatedBuckets: AssetBuckets; // Add this to return updated bucket balances
}

// Calculate optimal Roth conversion amount to fill low tax brackets
export function calculateOptimalRothConversion(
  buckets: AssetBuckets,
  age: number,
  currentTaxableIncome: number,
  filingStatus: 'single' | 'married'
): number {
  // Don't convert after RMDs start (age 73)
  if (age >= 73 || buckets.taxDeferred <= 0) {
    return 0;
  }
  
  // Get tax bracket thresholds for 2025 (simplified reference points)
  const brackets = filingStatus === 'married' ? {
    '10%': 23850,
    '12%': 96950,
    '22%': 206700,
    '24%': 394600
  } : {
    '10%': 11925,
    '12%': 48475,
    '22%': 103350,
    '24%': 197300
  };
  
  // Target filling up to the 12% bracket for optimal long-term tax efficiency
  // This preserves low rates while reducing future RMDs
  const targetBracket = brackets['12%'];
  const roomInBracket = Math.max(0, targetBracket - currentTaxableIncome);
  
  // Don't convert more than 20% of tax-deferred balance in a single year
  // This prevents large tax hits and preserves flexibility
  const maxConversion = buckets.taxDeferred * 0.2;
  
  // Calculate optimal conversion amount
  const optimalConversion = Math.min(roomInBracket, maxConversion, buckets.taxDeferred);
  
  // Only convert if it makes sense (at least $5,000)
  return optimalConversion >= 5000 ? optimalConversion : 0;
}

export function calculateTaxEfficientWithdrawal(
  netNeeded: number,  // Amount needed after taxes
  buckets: AssetBuckets,
  taxRate: number,  // Dynamic tax rate, not fixed 25%
  age: number,
  capitalGainsRate: number = 0.15,  // Assume 15% LTCG rate
  hasQualifiedMedicalExpenses: boolean = false  // For HSA treatment
): WithdrawalStrategy {
  const strategy: WithdrawalStrategy = {
    fromCash: 0,
    fromCapitalGains: 0,
    fromTaxDeferred: 0,
    fromTaxFree: 0,
    totalGrossWithdrawal: 0,
    estimatedTaxes: 0,
    netAmountReceived: 0,
    updatedBuckets: { ...buckets } // Clone the buckets to track updates
  };

  let remainingNeed = netNeeded;

  // Create a mutable copy of the buckets to track withdrawals
  const updatedBuckets = { ...buckets };

  // Step 1: Calculate any Required Minimum Distributions
  let requiredRMD = 0;
  if (age >= 73 && buckets.taxDeferred > 0) {
    // Simplified - in reality, would calculate RMD for each account
    requiredRMD = calculateRMD(buckets.taxDeferred, age);
  }

  // Step 2: Withdraw from cash/equivalents first (no tax impact)
  if (remainingNeed > 0 && updatedBuckets.cashEquivalents > 0) {
    strategy.fromCash = Math.min(remainingNeed, updatedBuckets.cashEquivalents);
    remainingNeed -= strategy.fromCash;
    updatedBuckets.cashEquivalents -= strategy.fromCash;
  }

  // Step 3: Smart withdrawal order based on age and tax situation
  
  // Before age 73 (RMD age), prioritize preserving tax-deferred for growth
  // and using taxable accounts first to allow for tax-efficient conversions
  if (age < 73) {
    // Step 3a: Use taxable brokerage first (lower tax on capital gains)
    if (remainingNeed > 0 && updatedBuckets.capitalGains > 0) {
      // Use more realistic 20% gains for long-held brokerage accounts
      const gainsRatio = 0.2;
      const netToGrossMultiplier = 1 / (1 - capitalGainsRate * gainsRatio);
      const neededFromBrokerage = remainingNeed * netToGrossMultiplier;
      
      strategy.fromCapitalGains = Math.min(neededFromBrokerage, updatedBuckets.capitalGains);
      
      const gains = strategy.fromCapitalGains * gainsRatio;
      const capitalGainsTax = gains * capitalGainsRate;
      strategy.estimatedTaxes += capitalGainsTax;
      
      const netFromBrokerage = strategy.fromCapitalGains - capitalGainsTax;
      remainingNeed -= netFromBrokerage;
      updatedBuckets.capitalGains -= strategy.fromCapitalGains;
    }
    
    // Step 3b: Use tax-deferred only if necessary before RMDs
    if (remainingNeed > 0 && updatedBuckets.taxDeferred > 0) {
      const grossNeededFromNeed = remainingNeed / (1 - taxRate);
      strategy.fromTaxDeferred = Math.min(grossNeededFromNeed, updatedBuckets.taxDeferred);
      
      const ordinaryIncomeTax = strategy.fromTaxDeferred * taxRate;
      strategy.estimatedTaxes += ordinaryIncomeTax;
      
      const netFromTaxDeferred = strategy.fromTaxDeferred - ordinaryIncomeTax;
      remainingNeed -= netFromTaxDeferred;
      updatedBuckets.taxDeferred -= strategy.fromTaxDeferred;
    }
  } else {
    // After age 73, must handle RMDs first
    
    // Step 3a: Withdraw RMD from tax-deferred first
    if (requiredRMD > 0) {
      strategy.fromTaxDeferred = Math.min(requiredRMD, updatedBuckets.taxDeferred);
      
      const ordinaryIncomeTax = strategy.fromTaxDeferred * taxRate;
      strategy.estimatedTaxes += ordinaryIncomeTax;
      
      const netFromTaxDeferred = strategy.fromTaxDeferred - ordinaryIncomeTax;
      remainingNeed -= netFromTaxDeferred;
      updatedBuckets.taxDeferred -= strategy.fromTaxDeferred;
    }
    
    // Step 3b: Use taxable brokerage for remaining needs
    if (remainingNeed > 0 && updatedBuckets.capitalGains > 0) {
      const gainsRatio = 0.2;
      const netToGrossMultiplier = 1 / (1 - capitalGainsRate * gainsRatio);
      const neededFromBrokerage = remainingNeed * netToGrossMultiplier;
      
      strategy.fromCapitalGains = Math.min(neededFromBrokerage, updatedBuckets.capitalGains);
      
      const gains = strategy.fromCapitalGains * gainsRatio;
      const capitalGainsTax = gains * capitalGainsRate;
      strategy.estimatedTaxes += capitalGainsTax;
      
      const netFromBrokerage = strategy.fromCapitalGains - capitalGainsTax;
      remainingNeed -= netFromBrokerage;
      updatedBuckets.capitalGains -= strategy.fromCapitalGains;
    }
    
    // Step 3c: Use additional tax-deferred if needed beyond RMD
    if (remainingNeed > 0 && updatedBuckets.taxDeferred > 0) {
      const grossNeededFromNeed = remainingNeed / (1 - taxRate);
      const additionalTaxDeferred = Math.min(grossNeededFromNeed, updatedBuckets.taxDeferred);
      
      strategy.fromTaxDeferred += additionalTaxDeferred;
      
      const ordinaryIncomeTax = additionalTaxDeferred * taxRate;
      strategy.estimatedTaxes += ordinaryIncomeTax;
      
      const netFromTaxDeferred = additionalTaxDeferred - ordinaryIncomeTax;
      remainingNeed -= netFromTaxDeferred;
      updatedBuckets.taxDeferred -= additionalTaxDeferred;
    }
  }

  // Step 4: Only use Roth as last resort (preserve tax-free growth)
  if (remainingNeed > 0 && updatedBuckets.taxFree > 0) {
    strategy.fromTaxFree = Math.min(remainingNeed, updatedBuckets.taxFree);
    remainingNeed -= strategy.fromTaxFree;
    updatedBuckets.taxFree -= strategy.fromTaxFree;
  }

  // Calculate total gross withdrawal
  strategy.totalGrossWithdrawal = 
    strategy.fromCash + 
    strategy.fromCapitalGains + 
    strategy.fromTaxDeferred + 
    strategy.fromTaxFree;

  // Update total assets in the bucket
  updatedBuckets.totalAssets = 
    updatedBuckets.taxDeferred + 
    updatedBuckets.taxFree + 
    updatedBuckets.capitalGains + 
    updatedBuckets.cashEquivalents;
    
  strategy.updatedBuckets = updatedBuckets;

  return strategy;
}

// Helper to estimate blended tax rate based on asset mix
export function estimateBlendedTaxRate(
  buckets: AssetBuckets,
  ordinaryTaxRate: number,
  capitalGainsRate: number = 0.15
): number {
  if (buckets.totalAssets === 0) return ordinaryTaxRate;

  // Weight the tax rates by asset allocation
  const taxDeferredWeight = buckets.taxDeferred / buckets.totalAssets;
  const capitalGainsWeight = buckets.capitalGains / buckets.totalAssets;
  const taxFreeWeight = buckets.taxFree / buckets.totalAssets;
  const cashWeight = buckets.cashEquivalents / buckets.totalAssets;

  // Blended rate calculation
  // Tax-deferred: full ordinary rate
  // Capital gains: assume 50% gains at LTCG rate
  // Tax-free and cash: 0% rate
  const blendedRate = 
    (taxDeferredWeight * ordinaryTaxRate) +
    (capitalGainsWeight * capitalGainsRate * 0.5) +
    (taxFreeWeight * 0) +
    (cashWeight * 0);

  return blendedRate;
}

// Calculate asset-weighted returns considering specific asset types
export function calculateAssetWeightedReturns(
  assets: any[],
  defaultStockReturn: number = 0.07,
  defaultBondReturn: number = 0.04
): number {
  if (!assets || assets.length === 0) return defaultStockReturn;

  let totalValue = 0;
  let weightedReturn = 0;

  for (const asset of assets) {
    const value = Number(asset.value) || 0;
    if (value <= 0) continue;

    const taxInfo = ASSET_TAX_CLASSIFICATION[asset.type];
    if (!taxInfo || !taxInfo.isRetirementAsset) continue;

    totalValue += value;

    // Use asset-specific return if available, otherwise use defaults based on type
    let assetReturn = taxInfo.expectedReturn;
    
    if (!assetReturn) {
      // Default returns based on asset type
      switch (asset.type) {
        case 'taxable-brokerage':
          assetReturn = defaultStockReturn; // Use user's stock allocation return
          break;
        case '401k':
        case '403b':
        case 'traditional-ira':
        case 'roth-ira':
        case 'other-tax-deferred':
          assetReturn = defaultStockReturn; // Use user's allocation return
          break;
        case 'hsa':
          assetReturn = defaultStockReturn; // HSA typically invested aggressively
          break;
        default:
          assetReturn = defaultStockReturn;
      }
    }

    weightedReturn += value * assetReturn;
  }

  return totalValue > 0 ? weightedReturn / totalValue : defaultStockReturn;
}
