import type { EstateScenario, EstateProfile } from '@/types/estate'

interface TaxCalculationResult {
  grossEstate: number
  deductions: number
  taxableEstate: number
  federalExemption: number
  federalTaxableAmount: number
  federalTax: number
  stateExemption: number
  stateTaxableAmount: number
  stateTax: number
  totalTax: number
  effectiveRate: number
  netToHeirs: number
  liquidityGap: number
}

// Federal estate tax brackets (2024)
const FEDERAL_TAX_BRACKETS = [
  { min: 0, max: 10000, rate: 0.18 },
  { min: 10000, max: 20000, rate: 0.20 },
  { min: 20000, max: 40000, rate: 0.22 },
  { min: 40000, max: 60000, rate: 0.24 },
  { min: 60000, max: 80000, rate: 0.26 },
  { min: 80000, max: 100000, rate: 0.28 },
  { min: 100000, max: 150000, rate: 0.30 },
  { min: 150000, max: 250000, rate: 0.32 },
  { min: 250000, max: 500000, rate: 0.34 },
  { min: 500000, max: 750000, rate: 0.37 },
  { min: 750000, max: 1000000, rate: 0.39 },
  { min: 1000000, max: Infinity, rate: 0.40 },
]

// State estate tax rates by state
const STATE_TAX_CONFIG: Record<string, { exemption: number; rates: Array<{ min: number; max: number; rate: number }> }> = {
  CT: {
    exemption: 12920000,
    rates: [
      { min: 0, max: Infinity, rate: 0.12 },
    ],
  },
  DC: {
    exemption: 4528800,
    rates: [
      { min: 0, max: Infinity, rate: 0.16 },
    ],
  },
  HI: {
    exemption: 5490000,
    rates: [
      { min: 0, max: Infinity, rate: 0.20 },
    ],
  },
  IL: {
    exemption: 4000000,
    rates: [
      { min: 0, max: Infinity, rate: 0.16 },
    ],
  },
  MA: {
    exemption: 2000000,
    rates: [
      { min: 0, max: Infinity, rate: 0.16 },
    ],
  },
  MD: {
    exemption: 5000000,
    rates: [
      { min: 0, max: Infinity, rate: 0.16 },
    ],
  },
  ME: {
    exemption: 6410000,
    rates: [
      { min: 0, max: Infinity, rate: 0.12 },
    ],
  },
  MN: {
    exemption: 3000000,
    rates: [
      { min: 0, max: Infinity, rate: 0.16 },
    ],
  },
  NY: {
    exemption: 6580000,
    rates: [
      { min: 0, max: Infinity, rate: 0.16 },
    ],
  },
  OR: {
    exemption: 1000000,
    rates: [
      { min: 0, max: Infinity, rate: 0.16 },
    ],
  },
  RI: {
    exemption: 1733264,
    rates: [
      { min: 0, max: Infinity, rate: 0.16 },
    ],
  },
  VT: {
    exemption: 5000000,
    rates: [
      { min: 0, max: Infinity, rate: 0.16 },
    ],
  },
  WA: {
    exemption: 2193000,
    rates: [
      { min: 0, max: Infinity, rate: 0.20 },
    ],
  },
}

function calculateTaxFromBrackets(taxableAmount: number, brackets: Array<{ min: number; max: number; rate: number }>): number {
  let tax = 0
  let remainingAmount = taxableAmount

  for (const bracket of brackets) {
    if (remainingAmount <= 0) break
    
    const taxableInBracket = Math.min(remainingAmount, bracket.max - bracket.min)
    tax += taxableInBracket * bracket.rate
    remainingAmount -= taxableInBracket
  }

  return tax
}

export function calculateEstateTax(
  profile: EstateProfile,
  scenario: Partial<EstateScenario>
): TaxCalculationResult {
  const assumptions = scenario.assumptions || {
    yearOfDeath: new Date().getFullYear() + 10,
    federalExemption: 13610000,
    stateExemption: 0,
    portability: false,
    dsueAmount: 0,
    annualGiftAmount: 0,
    lifetimeGiftAmount: 0,
    appreciationRate: 5,
    discountRate: 0,
    strategies: [],
    trustFunding: {},
    liquidityTarget: 110,
  }

  // Calculate years until death
  const yearsUntilDeath = assumptions.yearOfDeath - new Date().getFullYear()
  
  // Calculate gross estate with appreciation
  const appreciationFactor = Math.pow(1 + assumptions.appreciationRate / 100, yearsUntilDeath)
  let grossEstate = profile.netWorth * appreciationFactor
  
  // Apply annual gifting reduction
  if (assumptions.annualGiftAmount > 0) {
    const totalAnnualGifts = assumptions.annualGiftAmount * yearsUntilDeath
    grossEstate -= totalAnnualGifts
  }
  
  // Apply lifetime gifting reduction
  grossEstate -= assumptions.lifetimeGiftAmount
  
  // Apply trust funding reductions
  const totalTrustFunding = Object.values(assumptions.trustFunding).reduce((sum, amount) => sum + amount, 0)
  grossEstate -= totalTrustFunding
  
  // Apply valuation discounts
  if (assumptions.discountRate > 0) {
    const discountableAssets = grossEstate * 0.3 // Assume 30% of estate is eligible for discounts
    const discountAmount = discountableAssets * (assumptions.discountRate / 100)
    grossEstate -= discountAmount
  }
  
  // Standard deductions (simplified)
  const deductions = grossEstate * 0.03 // 3% for admin expenses, debts, etc.
  const taxableEstate = Math.max(0, grossEstate - deductions)
  
  // Calculate federal exemption with portability
  let federalExemption = assumptions.federalExemption
  if (assumptions.portability && assumptions.dsueAmount > 0) {
    federalExemption += assumptions.dsueAmount
  }
  
  // Calculate federal tax
  const federalTaxableAmount = Math.max(0, taxableEstate - federalExemption)
  const federalTax = calculateTaxFromBrackets(federalTaxableAmount, FEDERAL_TAX_BRACKETS)
  
  // Calculate state tax
  let stateTax = 0
  let stateExemption = assumptions.stateExemption
  
  if (STATE_TAX_CONFIG[profile.state]) {
    const stateConfig = STATE_TAX_CONFIG[profile.state]
    stateExemption = stateConfig.exemption
    const stateTaxableAmount = Math.max(0, taxableEstate - stateExemption)
    stateTax = calculateTaxFromBrackets(stateTaxableAmount, stateConfig.rates)
  }
  
  // Calculate totals
  const totalTax = federalTax + stateTax
  const netToHeirs = grossEstate - totalTax
  const effectiveRate = grossEstate > 0 ? (totalTax / grossEstate) * 100 : 0
  
  // Calculate liquidity gap (simplified)
  const liquidAssets = grossEstate * 0.2 // Assume 20% of estate is liquid
  const requiredLiquidity = totalTax * (assumptions.liquidityTarget / 100)
  const liquidityGap = Math.max(0, requiredLiquidity - liquidAssets)
  
  return {
    grossEstate,
    deductions,
    taxableEstate,
    federalExemption,
    federalTaxableAmount,
    federalTax,
    stateExemption,
    stateTaxableAmount: Math.max(0, taxableEstate - stateExemption),
    stateTax,
    totalTax,
    effectiveRate,
    netToHeirs,
    liquidityGap,
  }
}

export function compareScenarios(
  baseScenario: TaxCalculationResult,
  compareScenario: TaxCalculationResult
): {
  taxSavings: number
  taxSavingsPercent: number
  netToHeirsIncrease: number
  netToHeirsIncreasePercent: number
  liquidityImprovement: number
} {
  const taxSavings = baseScenario.totalTax - compareScenario.totalTax
  const taxSavingsPercent = baseScenario.totalTax > 0 ? (taxSavings / baseScenario.totalTax) * 100 : 0
  
  const netToHeirsIncrease = compareScenario.netToHeirs - baseScenario.netToHeirs
  const netToHeirsIncreasePercent = baseScenario.netToHeirs > 0 
    ? (netToHeirsIncrease / baseScenario.netToHeirs) * 100 
    : 0
  
  const liquidityImprovement = baseScenario.liquidityGap - compareScenario.liquidityGap
  
  return {
    taxSavings,
    taxSavingsPercent,
    netToHeirsIncrease,
    netToHeirsIncreasePercent,
    liquidityImprovement,
  }
}