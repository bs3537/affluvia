// Monte Carlo Simulation Constants
// Centralized configuration for all magic numbers and constants

// Simulation Limits
export const MAX_RETIREMENT_YEARS = 60; // Maximum years to simulate in retirement
export const MIN_LIFE_EXPECTANCY_AGE = 70;
export const MAX_LIFE_EXPECTANCY_AGE = 105;
export const DEFAULT_LIFE_EXPECTANCY = 90;

// Stochastic Life Expectancy Distribution
export const LIFE_EXPECTANCY_DISTRIBUTION = {
  EARLY_MORTALITY_CHANCE: 0.25,
  MEDIAN_RANGE_CHANCE: 0.50, // 0.25 to 0.75
  LONGEVITY_TAIL_CHANCE: 0.25, // 0.75 to 1.00
  EARLY_MORTALITY_RANGE: { min: -8, max: -3 },
  MEDIAN_RANGE: { min: -2, max: 2 },
  LONGEVITY_RANGE: { min: 3, max: 7 }
};

// Couples Correlation
export const COUPLES_LIFE_CORRELATION = 0.4; // Correlation between spouse life expectancies
export const SPOUSE_EXPENSE_REDUCTION = 0.75; // Expenses reduce to 75% when one spouse dies
export const SPOUSE_SS_SURVIVOR_BENEFIT = 0.60; // Social Security survivor benefit

// Asset Correlations
export const ASSET_CORRELATIONS = {
  stocks: { stocks: 1.00, bonds: 0.15, cash: 0.00 },
  bonds: { stocks: 0.15, bonds: 1.00, cash: 0.30 },
  cash: { stocks: 0.00, bonds: 0.30, cash: 1.00 }
};

// Asset Return Multipliers
export const ASSET_RETURN_FACTORS = {
  stocks: { returnMultiplier: 1.2, volatilityMultiplier: 1.2 },
  bonds: { returnMultiplier: 0.5, volatilityMultiplier: 0.3 },
  cash: { returnMultiplier: 0.3, volatilityMultiplier: 0.1 }
};

// Guyton-Klinger Guardrails
export const GUARDRAILS = {
  CAPITAL_PRESERVATION_TRIGGER: 1.2, // 120% of initial withdrawal rate
  CAPITAL_PRESERVATION_ADJUSTMENT: 0.9, // Reduce withdrawal by 10%
  PROSPERITY_TRIGGER: 0.8, // 80% of initial withdrawal rate
  PROSPERITY_ADJUSTMENT: 1.1, // Increase withdrawal by 10%
};

// Health Status Adjustments for Mortality
export const HEALTH_ADJUSTMENTS: { [status: string]: number } = {
  excellent: 0.7,  // 30% lower mortality rate
  good: 1.0,       // Base mortality rate
  fair: 1.5,       // 50% higher mortality rate
  poor: 2.2        // 120% higher mortality rate
};

// Dynamic Mortality Table (SSA 2020 Period Life Table)
export const MORTALITY_RATES: { [age: number]: number } = {
  50: 0.003410, 51: 0.003684, 52: 0.003992, 53: 0.004345, 54: 0.004748,
  55: 0.005198, 56: 0.005686, 57: 0.006213, 58: 0.006788, 59: 0.007429,
  60: 0.008156, 61: 0.008959, 62: 0.009829, 63: 0.010760, 64: 0.011760,
  65: 0.012843, 66: 0.014014, 67: 0.015278, 68: 0.016645, 69: 0.018134,
  70: 0.019771, 71: 0.021572, 72: 0.023551, 73: 0.025707, 74: 0.028050,
  75: 0.030618, 76: 0.033460, 77: 0.036620, 78: 0.040124, 79: 0.043994,
  80: 0.048252, 81: 0.052921, 82: 0.058025, 83: 0.063588, 84: 0.069637,
  85: 0.076197, 86: 0.083295, 87: 0.090958, 88: 0.099210, 89: 0.108077,
  90: 0.117583, 91: 0.127754, 92: 0.138612, 93: 0.150180, 94: 0.162481,
  95: 0.175535, 96: 0.189365, 97: 0.203989, 98: 0.219427, 99: 0.235696,
  100: 0.252813, 101: 0.270796, 102: 0.289661, 103: 0.309426, 104: 0.330105,
  105: 0.351716, 106: 0.374274, 107: 0.397795, 108: 0.422293, 109: 0.447784,
  110: 0.474285, 111: 0.501809, 112: 0.530372, 113: 0.559990, 114: 0.590677,
  115: 0.622450, 116: 0.655324, 117: 0.689314, 118: 0.724436, 119: 0.760707,
  120: 1.000000
};

// Tax Rates
export const DEFAULT_TAX_RATE = 0.22;

// Withdrawal Rates
export const DEFAULT_WITHDRAWAL_RATE = 0.04; // 4% rule
export const TARGET_SUCCESS_PROBABILITY = 80; // Target 80% success rate

// Worker Configuration
export const WORKER_BATCH_SIZE = 100;
export const DEFAULT_ITERATIONS = 1000;

// Long-Term Care (LTC) Constants
export const LTC_PROBABILITY = {
  age65to74: 0.17,
  age75to84: 0.28,
  age85plus: 0.44,
  overall: 0.35 // 35% chance of needing LTC at some point
};

export const LTC_AVERAGE_DURATION_YEARS = 3;
export const LTC_ANNUAL_COST = {
  home: 54000,       // Home health care
  assisted: 51600,   // Assisted living
  nursing: 94900     // Nursing home
};

// Healthcare Cost Estimates
export const HEALTHCARE_COSTS = {
  preMedicare: {
    single: 12000,
    couple: 24000
  },
  medicare: {
    single: 3600,
    couple: 7200
  }
};

// Inflation Rates
export const INFLATION_RATES = {
  general: 0.025,      // 2.5% general inflation
  healthcare: 0.045,   // 4.5% healthcare inflation
  education: 0.05      // 5% education inflation
};

// Default Portfolio Allocations by Risk Profile
export const DEFAULT_ALLOCATIONS = {
  conservative: { stocks: 0.30, bonds: 0.60, cash: 0.10 },
  moderate: { stocks: 0.50, bonds: 0.40, cash: 0.10 },
  balanced: { stocks: 0.60, bonds: 0.35, cash: 0.05 },
  growth: { stocks: 0.70, bonds: 0.25, cash: 0.05 },
  aggressive: { stocks: 0.85, bonds: 0.10, cash: 0.05 }
};

// Success Rate Thresholds
export const SUCCESS_THRESHOLDS = {
  excellent: 90,  // 90%+ is excellent
  good: 80,       // 80-89% is good
  fair: 70,       // 70-79% is fair
  poor: 60        // Below 60% is poor
};

// Percentile Points for Confidence Intervals
export const PERCENTILE_POINTS = [5, 10, 25, 50, 75, 90, 95];

// Sequence of Returns Risk Window (years before/after retirement)
export const SEQUENCE_RISK_WINDOW = {
  before: 5,
  after: 5
};