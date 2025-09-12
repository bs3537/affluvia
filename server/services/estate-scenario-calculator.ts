import { EstateProfile } from '@/types/estate'

// 2025 Federal Estate Tax Parameters
const FEDERAL_EXEMPTION_2025 = 13990000 // $13.99M per person
const FEDERAL_EXEMPTION_2026 = 7000000  // ~$7M per person (post-sunset)
const FEDERAL_TAX_RATE = 0.40 // 40% on amounts above exemption
const IRS_7520_RATE = 0.05 // Assumed hurdle rate for GRAT calculations

// State Estate Tax Parameters (for common states with estate tax)
const STATE_TAX_CONFIG: Record<string, { exemption: number; rate: number }> = {
  MA: { exemption: 1000000, rate: 0.16 },
  NY: { exemption: 6580000, rate: 0.16 },
  CT: { exemption: 12920000, rate: 0.12 },
  OR: { exemption: 1000000, rate: 0.16 },
  IL: { exemption: 4000000, rate: 0.16 },
  MD: { exemption: 5000000, rate: 0.16 },
  WA: { exemption: 2193000, rate: 0.20 },
  DC: { exemption: 4528800, rate: 0.16 },
  HI: { exemption: 5490000, rate: 0.20 },
  ME: { exemption: 6410000, rate: 0.12 },
  MN: { exemption: 3000000, rate: 0.16 },
  RI: { exemption: 1733264, rate: 0.16 },
  VT: { exemption: 5000000, rate: 0.16 }
}

export interface ClientEstateData {
  totalEstateValue: number
  spouseEstateValue?: number
  state?: string
  growthRate?: number
  deathYearClient?: number
  deathYearSpouse?: number
  liquidAssets?: number
  maritalStatus?: string
  clientAge?: number
  spouseAge?: number
}

export interface ScenarioResult {
  scenarioId: string
  title: string
  summary: string
  metrics: { [key: string]: string | number }
  actionItem?: string
  savings?: number
  recommendation?: string
  assumptions?: string[]
  visualData?: {
    chartType: string
    data: any
  }
}

export class EstateTaxScenarioCalculator {
  private data: ClientEstateData

  constructor(data: ClientEstateData) {
    this.data = data
  }

  // Helper function to calculate federal estate tax
  private calcFederalEstateTax(estateValue: number, exemption: number): number {
    const taxableAmount = Math.max(0, estateValue - exemption)
    return taxableAmount * FEDERAL_TAX_RATE
  }

  // Helper function to calculate state estate tax
  private calcStateEstateTax(estateValue: number, state?: string): number {
    if (!state || !STATE_TAX_CONFIG[state]) return 0
    
    const config = STATE_TAX_CONFIG[state]
    const taxableAmount = Math.max(0, estateValue - config.exemption)
    return taxableAmount * config.rate
  }

  // Helper function to calculate total estate tax (federal + state)
  private calcTotalEstateTax(estateValue: number, federalExemption: number, state?: string): number {
    const federalTax = this.calcFederalEstateTax(estateValue, federalExemption)
    const stateTax = this.calcStateEstateTax(estateValue, state)
    return federalTax + stateTax
  }

  // Scenario 1: 2026 Sunset vs. Current Law
  scenario1_SunsetVsCurrent(): ScenarioResult {
    const isMarried = this.data.spouseEstateValue !== undefined
    const exemptionNow = isMarried ? FEDERAL_EXEMPTION_2025 * 2 : FEDERAL_EXEMPTION_2025
    const exemption2026 = isMarried ? FEDERAL_EXEMPTION_2026 * 2 : FEDERAL_EXEMPTION_2026
    
    const taxNow = this.calcTotalEstateTax(this.data.totalEstateValue, exemptionNow, this.data.state)
    const tax2026 = this.calcTotalEstateTax(this.data.totalEstateValue, exemption2026, this.data.state)
    const taxIncrease = tax2026 - taxNow

    return {
      scenarioId: 'sunset_vs_current',
      title: '2026 Sunset vs. Current Law',
      summary: 'Compare estate tax under current law versus after the 2026 TCJA sunset when exemptions drop by ~50%.',
      metrics: {
        'Estate Value': `$${this.data.totalEstateValue.toLocaleString()}`,
        'Tax (Current Law)': `$${taxNow.toLocaleString()}`,
        'Tax (2026 Sunset)': `$${tax2026.toLocaleString()}`,
        'Additional Tax Due': `$${taxIncrease.toLocaleString()}`,
        'Percentage Increase': taxNow > 0 ? `${((taxIncrease / taxNow) * 100).toFixed(0)}%` : 'N/A'
      },
      savings: -taxIncrease, // Negative because it's additional cost
      actionItem: taxIncrease > 0 
        ? `The 2026 sunset will cost your estate an additional $${taxIncrease.toLocaleString()}. Consider using your increased exemption before 2026 through gifting or other strategies.`
        : 'Your estate is below the future exemption threshold. The sunset may not significantly impact your estate tax.',
      assumptions: [
        `Current federal exemption: $${(exemptionNow / 1000000).toFixed(2)}M`,
        `2026 federal exemption: $${(exemption2026 / 1000000).toFixed(2)}M`,
        'Estate tax rate: 40% on amounts above exemption'
      ],
      visualData: {
        chartType: 'bar',
        data: {
          labels: ['Current Law (2025)', 'After Sunset (2026)'],
          datasets: [{
            label: 'Estate Tax',
            data: [taxNow, tax2026],
            backgroundColor: ['#4ade80', '#ef4444']
          }]
        }
      }
    }
  }

  // Scenario 2: Portability Election vs. Bypass Trust
  scenario2_PortabilityVsBypass(): ScenarioResult {
    if (!this.data.spouseEstateValue || this.data.maritalStatus !== 'married') {
      return {
        scenarioId: 'portability_vs_bypass',
        title: 'Portability vs. Bypass Trust',
        summary: 'This scenario requires married status to compare strategies.',
        metrics: {
          'Status': 'Not applicable - single or no spouse data'
        }
      }
    }

    const totalEstate = this.data.totalEstateValue
    const growthRate = this.data.growthRate || 0.05
    const yearsBetweenDeaths = 10 // Assume 10 years between deaths
    
    // Portability scenario
    const dsue = FEDERAL_EXEMPTION_2025 // Full unused exemption transfers
    const survivorExemptionWithDSUE = FEDERAL_EXEMPTION_2025 + dsue
    const survivorEstatePort = totalEstate * Math.pow(1 + growthRate, yearsBetweenDeaths)
    const taxPort = this.calcTotalEstateTax(survivorEstatePort, survivorExemptionWithDSUE, this.data.state)
    
    // Bypass trust scenario
    const trustFunding = Math.min(FEDERAL_EXEMPTION_2025, totalEstate / 2)
    const trustGrowth = trustFunding * Math.pow(1 + growthRate, yearsBetweenDeaths)
    const survivorEstateBypass = (totalEstate - trustFunding) * Math.pow(1 + growthRate, yearsBetweenDeaths)
    const taxBypass = this.calcTotalEstateTax(survivorEstateBypass, FEDERAL_EXEMPTION_2025, this.data.state)
    
    const taxSavings = taxPort - taxBypass
    const netToHeirsPort = survivorEstatePort - taxPort
    const netToHeirsBypass = survivorEstateBypass - taxBypass + trustGrowth

    return {
      scenarioId: 'portability_vs_bypass',
      title: 'Portability vs. Bypass Trust',
      summary: 'Compare using portability election versus funding a bypass trust at first death.',
      metrics: {
        'Estate Tax (Portability)': `$${taxPort.toLocaleString()}`,
        'Estate Tax (Bypass Trust)': `$${taxBypass.toLocaleString()}`,
        'Tax Savings (Bypass)': `$${taxSavings.toLocaleString()}`,
        'Net to Heirs (Portability)': `$${netToHeirsPort.toLocaleString()}`,
        'Net to Heirs (Bypass)': `$${netToHeirsBypass.toLocaleString()}`,
        'Growth Sheltered': `$${(trustGrowth - trustFunding).toLocaleString()}`
      },
      savings: taxSavings,
      actionItem: taxSavings > 100000
        ? `A bypass trust can save $${taxSavings.toLocaleString()} by sheltering $${(trustGrowth - trustFunding).toLocaleString()} of growth from estate tax. Consider trust planning over simple portability.`
        : 'Portability appears sufficient for your estate size. A bypass trust may add complexity without significant tax savings.',
      assumptions: [
        `Growth rate: ${(growthRate * 100).toFixed(1)}% annually`,
        `Years between deaths: ${yearsBetweenDeaths}`,
        `Trust funding: Up to $${(trustFunding / 1000000).toFixed(2)}M`
      ],
      visualData: {
        chartType: 'comparison',
        data: {
          portability: { tax: taxPort, netToHeirs: netToHeirsPort },
          bypass: { tax: taxBypass, netToHeirs: netToHeirsBypass }
        }
      }
    }
  }

  // Scenario 3: Maximize 2025 Gifting vs. No Gifting
  scenario3_LifetimeGifts(): ScenarioResult {
    const currentYear = new Date().getFullYear()
    const yearsToProjectedDeath = this.data.deathYearClient 
      ? this.data.deathYearClient - currentYear
      : 20 // Default 20 years
    const growthRate = this.data.growthRate || 0.06
    const currentValue = this.data.totalEstateValue
    
    // Determine maximum gift based on marital status
    const isMarried = this.data.spouseEstateValue !== undefined
    const maxGiftPerPerson = Math.min(currentValue / (isMarried ? 2 : 1), FEDERAL_EXEMPTION_2025)
    const totalMaxGift = isMarried ? maxGiftPerPerson * 2 : maxGiftPerPerson
    
    // Case A: Maximum gifting in 2025
    const estateAfterGift = currentValue - totalMaxGift
    const futureEstateWithGift = estateAfterGift * Math.pow(1 + growthRate, yearsToProjectedDeath)
    const giftedAssetsFuture = totalMaxGift * Math.pow(1 + growthRate, yearsToProjectedDeath)
    const futureExemption = isMarried ? FEDERAL_EXEMPTION_2026 * 2 : FEDERAL_EXEMPTION_2026
    const taxWithGift = this.calcTotalEstateTax(futureEstateWithGift, futureExemption, this.data.state)
    
    // Case B: No major gifts
    const futureEstateNoGift = currentValue * Math.pow(1 + growthRate, yearsToProjectedDeath)
    const taxNoGift = this.calcTotalEstateTax(futureEstateNoGift, futureExemption, this.data.state)
    
    const taxSavings = taxNoGift - taxWithGift
    const totalToHeirsWithGift = giftedAssetsFuture + (futureEstateWithGift - taxWithGift)
    const totalToHeirsNoGift = futureEstateNoGift - taxNoGift

    return {
      scenarioId: 'lifetime_gifts',
      title: '2025 Gifting vs. No Gifting',
      summary: 'Compare using the elevated 2025 exemption for lifetime gifts versus keeping assets until death.',
      metrics: {
        'Maximum Gift (2025)': `$${totalMaxGift.toLocaleString()}`,
        'Gift Value at Death': `$${giftedAssetsFuture.toLocaleString()}`,
        'Estate Tax (With Gift)': `$${taxWithGift.toLocaleString()}`,
        'Estate Tax (No Gift)': `$${taxNoGift.toLocaleString()}`,
        'Tax Savings': `$${taxSavings.toLocaleString()}`,
        'Total to Heirs (Gift)': `$${totalToHeirsWithGift.toLocaleString()}`,
        'Total to Heirs (No Gift)': `$${totalToHeirsNoGift.toLocaleString()}`
      },
      savings: taxSavings,
      actionItem: taxSavings > 100000
        ? `Gifting $${totalMaxGift.toLocaleString()} in 2025 could save $${taxSavings.toLocaleString()} in estate taxes. The gifted assets would grow to $${giftedAssetsFuture.toLocaleString()} outside your taxable estate.`
        : 'Your estate may not benefit significantly from large lifetime gifts. Consider annual exclusion gifting instead.',
      assumptions: [
        `Growth rate: ${(growthRate * 100).toFixed(1)}% annually`,
        `Years to death: ${yearsToProjectedDeath}`,
        `2025 exemption used: $${(totalMaxGift / 1000000).toFixed(2)}M`,
        'No clawback on pre-2026 gifts (IRS confirmed)'
      ],
      visualData: {
        chartType: 'timeline',
        data: {
          withGift: {
            initial: currentValue,
            gifted: totalMaxGift,
            final: futureEstateWithGift,
            giftGrowth: giftedAssetsFuture
          },
          noGift: {
            initial: currentValue,
            final: futureEstateNoGift
          }
        }
      }
    }
  }

  // Scenario 4: GRAT/SLAT Trust vs. No Trust
  scenario4_TrustFreeze(): ScenarioResult {
    const transferValue = Math.min(5000000, this.data.totalEstateValue * 0.3) // 30% of estate or $5M
    const growthRate = this.data.growthRate || 0.08 // Assume 8% for high-growth assets
    const years = this.data.deathYearClient 
      ? this.data.deathYearClient - new Date().getFullYear()
      : 15
    const futureValue = transferValue * Math.pow(1 + growthRate, years)
    
    // No trust scenario
    const taxNoTrust = this.calcFederalEstateTax(futureValue, 0) // Asset above exemption
    
    // GRAT scenario (assuming successful GRAT)
    const hurdleRate = IRS_7520_RATE
    const hurdleGrowth = transferValue * Math.pow(1 + hurdleRate, years)
    const excessGrowth = Math.max(0, futureValue - hurdleGrowth)
    const taxWithGRAT = 0 // Excess growth passes tax-free
    
    // SLAT scenario
    const taxWithSLAT = 0 // All growth outside estate
    
    const taxSavings = taxNoTrust
    const wealthTransferred = excessGrowth

    return {
      scenarioId: 'trust_freeze',
      title: 'GRAT/SLAT vs. No Trust',
      summary: 'Model estate freeze strategies using trusts to shift future growth out of your taxable estate.',
      metrics: {
        'Asset Value Today': `$${transferValue.toLocaleString()}`,
        'Projected Future Value': `$${futureValue.toLocaleString()}`,
        'Growth Above Hurdle (GRAT)': `$${excessGrowth.toLocaleString()}`,
        'Estate Tax (No Trust)': `$${taxNoTrust.toLocaleString()}`,
        'Estate Tax (With Trust)': '$0',
        'Tax Savings': `$${taxSavings.toLocaleString()}`,
        'Wealth Transferred Tax-Free': `$${wealthTransferred.toLocaleString()}`
      },
      savings: taxSavings,
      actionItem: taxSavings > 100000
        ? `A GRAT or SLAT could transfer $${wealthTransferred.toLocaleString()} of growth tax-free, saving $${taxSavings.toLocaleString()} in estate taxes. Consider these strategies for high-growth assets.`
        : 'Trust strategies may add complexity without significant benefit for your asset profile.',
      assumptions: [
        `Asset growth rate: ${(growthRate * 100).toFixed(1)}%`,
        `IRS §7520 rate: ${(hurdleRate * 100).toFixed(1)}%`,
        `Trust term: ${years} years`,
        'GRAT zeros out gift value',
        'SLAT uses current exemption'
      ],
      visualData: {
        chartType: 'growth',
        data: {
          initial: transferValue,
          hurdle: hurdleGrowth,
          total: futureValue,
          taxFree: excessGrowth
        }
      }
    }
  }

  // Scenario 5: ILIT Life Insurance vs. Self-Funding
  scenario5_LifeInsurance(): ScenarioResult {
    // Calculate projected estate tax
    const isMarried = this.data.spouseEstateValue !== undefined
    const exemption = isMarried ? FEDERAL_EXEMPTION_2026 * 2 : FEDERAL_EXEMPTION_2026
    const projectedEstate = this.data.totalEstateValue * Math.pow(1 + (this.data.growthRate || 0.05), 20)
    const estateTax = this.calcTotalEstateTax(projectedEstate, exemption, this.data.state)
    
    // Liquidity analysis
    const liquidAssets = this.data.liquidAssets || (this.data.totalEstateValue * 0.2) // Assume 20% liquid
    const liquidityGap = Math.max(0, estateTax - liquidAssets)
    const liquidityRatio = estateTax > 0 ? liquidAssets / estateTax : 1
    
    // Insurance needs
    const insuranceNeeded = estateTax + (estateTax * 0.1) // Add 10% buffer
    const annualPremium = insuranceNeeded * 0.02 // Rough estimate: 2% of face value
    
    return {
      scenarioId: 'life_insurance',
      title: 'Estate Liquidity: ILIT vs. Self-Fund',
      summary: 'Evaluate using life insurance in an ILIT to provide estate liquidity versus paying taxes from estate assets.',
      metrics: {
        'Projected Estate Tax': `$${estateTax.toLocaleString()}`,
        'Liquid Assets Available': `$${liquidAssets.toLocaleString()}`,
        'Liquidity Gap': `$${liquidityGap.toLocaleString()}`,
        'Liquidity Coverage': `${(liquidityRatio * 100).toFixed(0)}%`,
        'Insurance Recommended': `$${insuranceNeeded.toLocaleString()}`,
        'Estimated Annual Premium': `$${annualPremium.toLocaleString()}`,
        'Estate Disruption Risk': liquidityRatio < 0.5 ? 'High' : liquidityRatio < 0.8 ? 'Medium' : 'Low'
      },
      savings: liquidityGap, // Preventing forced asset sales
      actionItem: liquidityGap > 100000
        ? `Your estate faces a $${liquidityGap.toLocaleString()} liquidity shortfall. An ILIT with $${insuranceNeeded.toLocaleString()} of life insurance could prevent forced asset sales and preserve your legacy.`
        : 'Your liquid assets appear sufficient to cover estate taxes. Life insurance could still provide leverage but is less critical.',
      assumptions: [
        'Liquid assets: 20% of estate value',
        'Insurance owned by ILIT (outside estate)',
        'Premium estimate: 2% of face value',
        'Tax due within 9 months of death'
      ],
      visualData: {
        chartType: 'liquidity',
        data: {
          taxDue: estateTax,
          liquidAvailable: liquidAssets,
          gap: liquidityGap,
          insuranceCoverage: insuranceNeeded
        }
      }
    }
  }

  // Run all scenarios and return results
  runAllScenarios(): ScenarioResult[] {
    return [
      this.scenario1_SunsetVsCurrent(),
      this.scenario2_PortabilityVsBypass(),
      this.scenario3_LifetimeGifts(),
      this.scenario4_TrustFreeze(),
      this.scenario5_LifeInsurance()
    ]
  }
}

// Helper function to create calculator from estate profile
export function createCalculatorFromProfile(profile: EstateProfile): EstateTaxScenarioCalculator {
  const clientData: ClientEstateData = {
    totalEstateValue: profile.netWorth || 0,
    spouseEstateValue: profile.spouseDetails ? profile.netWorth / 2 : undefined,
    state: profile.state || 'CA',
    growthRate: 0.06, // Default 6% growth
    liquidAssets: profile.totalAssets * 0.2, // Assume 20% liquid
    maritalStatus: profile.maritalStatus,
    clientAge: 55, // Default if not provided
    spouseAge: 53, // Default if not provided
    deathYearClient: new Date().getFullYear() + 25, // Default 25 years
    deathYearSpouse: new Date().getFullYear() + 27
  }
  
  return new EstateTaxScenarioCalculator(clientData)
}