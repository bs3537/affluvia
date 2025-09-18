import { differenceInYears, parseISO } from "date-fns";
import { getFederalExemption, StateEstateTaxByCode } from "@shared/estate-tax-config";

export interface EstateProjectionSummary {
  projectedEstateValue: number;
  projectedTaxableEstate: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  netToHeirs: number;
  effectiveTaxRate: number;
  liquidity: {
    available: number;
    required: number;
    gap: number;
    insuranceNeed: number;
    ilitCoverage: number;
    existingLifeInsuranceUser?: number;
    existingLifeInsuranceSpouse?: number;
    probateCosts?: number;
    funeralCost?: number;
    settlementExpenses?: number;
    charitableReserve?: number;
  };
  heirTaxEstimate: {
    taxDeferredBalance: number;
    assumedRate: number;
    projectedIncomeTax: number;
    netAfterIncomeTax: number;
  };
  charitableImpact: {
    charitableBequests: number;
    percentOfEstate: number;
  };
  strategyAdjustments: {
    lifetimeGifts: number;
    annualGifts: number;
    trustFunding: number;
    appreciationFactor: number;
    bypassTrustApplied: boolean;
  };
  assumptions: {
    yearOfDeath: number;
    deathAge: number;
    currentAge: number;
    state: string | null;
    maritalStatus: string | null;
    portability: boolean;
    dsueAmount: number;
    federalExemption: number;
    stateExemption: number;
  };
}

export interface EstateStrategyInputs {
  lifetimeGifts?: number;
  annualGiftAmount?: number;
  trustFunding?: Array<{ label: string; amount: number }>;
  charitableBequest?: number;
  ilitDeathBenefit?: number;
  bypassTrust?: boolean;
}

export interface EstateAssetComposition {
  taxable: number;
  taxDeferred: number;
  roth: number;
  illiquid: number;
}

export interface EstateAssumptionInputs {
  federalExemptionOverride?: number;
  stateOverride?: string;
  portability?: boolean;
  dsueAmount?: number;
  projectedDeathAge?: number;
  liquidityTargetPercent?: number;
  appreciationRate?: number;
  assumedHeirIncomeTaxRate?: number;
  currentAge?: number;
}

export interface EstateCalculationInput {
  baseEstateValue: number;
  assetComposition: EstateAssetComposition;
  strategies?: EstateStrategyInputs;
  assumptions?: EstateAssumptionInputs;
  profile?: any;
}

const DEFAULT_FEDERAL_EXEMPTION_2024 = 13_610_000; // fallback
const DEFAULT_HEIR_INCOME_TAX_RATE = 0.25;

function resolveCurrentAge(profile: any): number {
  if (typeof profile?.currentAge === "number" && Number.isFinite(profile.currentAge)) {
    return profile.currentAge;
  }

  if (profile?.dateOfBirth) {
    try {
      return differenceInYears(new Date(), parseISO(profile.dateOfBirth));
    } catch {}
  }

  return 55;
}

function resolveDeathAge(input: EstateAssumptionInputs | undefined, profile: any, currentAge: number): number {
  if (input?.projectedDeathAge && input.projectedDeathAge > currentAge) {
    return input.projectedDeathAge;
  }
  if (typeof profile?.longevityAge === "number" && profile.longevityAge > currentAge) {
    return profile.longevityAge;
  }
  return Math.max(93, currentAge + 5);
}

function resolveYearOfDeath(currentAge: number, deathAge: number): number {
  const yearsUntilDeath = Math.max(0, deathAge - currentAge);
  return new Date().getFullYear() + yearsUntilDeath;
}

function resolveFederalExemption(yearOfDeath: number, override?: number): number {
  if (typeof override === "number" && override > 0) return override;
  return getFederalExemption(yearOfDeath) || DEFAULT_FEDERAL_EXEMPTION_2024;
}

function sumTrustFunding(strategies?: EstateStrategyInputs): number {
  if (!strategies?.trustFunding || !Array.isArray(strategies.trustFunding)) return 0;
  return strategies.trustFunding.reduce((total, item) => total + (Number(item?.amount) || 0), 0);
}

function calculateAppreciatedEstate(
  baseEstateValue: number,
  currentAge: number,
  deathAge: number,
  appreciationRate?: number
): { appreciatedValue: number; appreciationFactor: number } {
  const yearsUntilDeath = Math.max(0, deathAge - currentAge);
  if (!appreciationRate || appreciationRate <= 0) {
    return { appreciatedValue: baseEstateValue, appreciationFactor: 1 };
  }
  const factor = Math.pow(1 + appreciationRate / 100, yearsUntilDeath);
  return { appreciatedValue: baseEstateValue * factor, appreciationFactor: factor };
}

function calculateStateTax(
  taxableEstate: number,
  state: string | null,
  overrideState?: string
): { stateTax: number; stateExemption: number } {
  const stateKey = (overrideState || state || "").toUpperCase();
  const cfg = StateEstateTaxByCode[stateKey];
  const exemption = cfg?.exemption ?? 0;
  const brackets = cfg?.brackets ?? [];

  const taxableAmount = Math.max(0, taxableEstate - exemption);
  if (taxableAmount <= 0) return { stateTax: 0, stateExemption: exemption };

  let tax = 0;
  let remaining = taxableAmount;
  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const max = (bracket as any).max ?? Infinity;
    const min = (bracket as any).min ?? 0;
    const span = Math.min(remaining, max === Infinity ? remaining : Math.max(0, max - min));
    tax += span * (bracket as any).rate;
    remaining -= span;
  }
  return { stateTax: tax, stateExemption: exemption };
}

export function calculateEstateProjection(input: EstateCalculationInput): EstateProjectionSummary {
  const { baseEstateValue, assetComposition, strategies, assumptions, profile } = input;

  const currentAge = assumptions?.currentAge ?? resolveCurrentAge(profile);
  const deathAge = resolveDeathAge(assumptions, profile, currentAge);
  const yearOfDeath = resolveYearOfDeath(currentAge, deathAge);
  const federalExemption = resolveFederalExemption(yearOfDeath, assumptions?.federalExemptionOverride);

  const { appreciatedValue, appreciationFactor } = calculateAppreciatedEstate(
    baseEstateValue,
    currentAge,
    deathAge,
    assumptions?.appreciationRate
  );

  const lifetimeGifts = Math.max(0, Number(strategies?.lifetimeGifts) || 0);
  const annualGifts = Math.max(0, Number(strategies?.annualGiftAmount) || 0) * Math.max(0, deathAge - currentAge);
  const trustFunding = sumTrustFunding(strategies);
  const charitableBequest = Math.max(0, Number(strategies?.charitableBequest) || 0);
  const ilitDeathBenefit = Math.max(0, Number(strategies?.ilitDeathBenefit) || 0);

  const grossEstateBeforeAdjustments = appreciatedValue;
  const grossEstate = Math.max(0, grossEstateBeforeAdjustments - lifetimeGifts - annualGifts - trustFunding);

  const adminExpenses = grossEstate * 0.03;
  const deductions = Math.min(grossEstate, adminExpenses + charitableBequest);
  const taxableEstate = Math.max(0, grossEstate - deductions);

  const portability = Boolean(assumptions?.portability ?? (profile?.maritalStatus === "married"));
  const dsueAmount = portability ? Math.max(0, Number(assumptions?.dsueAmount) || Number(profile?.dsueAmount) || 0) : 0;
  let effectiveExemption = federalExemption + dsueAmount;
  if (strategies?.bypassTrust && (profile?.maritalStatus || "").toLowerCase() === "married") {
    effectiveExemption = Math.max(effectiveExemption, federalExemption * 2);
  }

  const federalTaxableAmount = Math.max(0, taxableEstate - effectiveExemption);
  const federalTax = federalTaxableAmount > 0 ? federalTaxableAmount * 0.4 : 0;

  const { stateTax, stateExemption } = calculateStateTax(
    taxableEstate,
    profile?.state || profile?.primaryResidence?.state || null,
    assumptions?.stateOverride
  );

  const totalTax = federalTax + stateTax;
  const netToHeirs = Math.max(0, grossEstate - totalTax);
  const effectiveRate = grossEstate > 0 ? (totalTax / grossEstate) * 100 : 0;

  const liquidityTarget = (assumptions?.liquidityTargetPercent ?? 110) / 100;
  const userLifeCoverage = (() => {
    try {
      const li = (profile as any)?.lifeInsurance;
      if (li?.hasPolicy && typeof li?.coverageAmount === "number") return Math.max(0, li.coverageAmount);
    } catch {}
    return 0;
  })();
  const spouseLifeCoverage = (() => {
    try {
      const sli = (profile as any)?.spouseLifeInsurance;
      if (sli?.hasPolicy && typeof sli?.coverageAmount === "number") return Math.max(0, sli.coverageAmount);
    } catch {}
    return 0;
  })();
  const availableLiquidityPreReserve = Math.max(
    0,
    assetComposition.taxable + assetComposition.roth + ilitDeathBenefit + userLifeCoverage + spouseLifeCoverage
  );
  const charitableReserve = Math.max(0, Math.min(charitableBequest, availableLiquidityPreReserve));
  const availableLiquidity = Math.max(0, availableLiquidityPreReserve - charitableReserve);
  const probateCosts = Math.round(grossEstate * 0.05);
  const funeralCost = 10000 * ((String(profile?.maritalStatus || "").toLowerCase() === "married") ? 2 : 1);
  const settlementExpenses = probateCosts + funeralCost;
  const requiredLiquidity = Math.max(0, totalTax * liquidityTarget + settlementExpenses);
  const liquidityGap = Math.max(0, requiredLiquidity - availableLiquidity);
  const insuranceNeed = Math.max(0, liquidityGap - ilitDeathBenefit);

  const heirIncomeTaxRate = assumptions?.assumedHeirIncomeTaxRate ?? DEFAULT_HEIR_INCOME_TAX_RATE;
  const projectedIncomeTax = assetComposition.taxDeferred * heirIncomeTaxRate;
  const netAfterIncomeTax = Math.max(0, netToHeirs - projectedIncomeTax);

  return {
    projectedEstateValue: grossEstate,
    projectedTaxableEstate: taxableEstate,
    federalTax,
    stateTax,
    totalTax,
    netToHeirs,
    effectiveTaxRate: effectiveRate,
    liquidity: {
      available: availableLiquidity,
      required: requiredLiquidity,
      gap: liquidityGap,
      insuranceNeed,
      ilitCoverage: ilitDeathBenefit,
      existingLifeInsuranceUser: userLifeCoverage,
      existingLifeInsuranceSpouse: spouseLifeCoverage,
      probateCosts,
      funeralCost,
      settlementExpenses,
      charitableReserve,
    },
    heirTaxEstimate: {
      taxDeferredBalance: assetComposition.taxDeferred,
      assumedRate: heirIncomeTaxRate,
      projectedIncomeTax,
      netAfterIncomeTax,
    },
    charitableImpact: {
      charitableBequests: charitableBequest,
      percentOfEstate: grossEstate > 0 ? (charitableBequest / grossEstate) * 100 : 0,
    },
    strategyAdjustments: {
      lifetimeGifts,
      annualGifts,
      trustFunding,
      appreciationFactor,
      bypassTrustApplied: Boolean(strategies?.bypassTrust),
    },
    assumptions: {
      yearOfDeath,
      deathAge,
      currentAge,
      state: (assumptions?.stateOverride || profile?.state || profile?.primaryResidence?.state || null) ?? null,
      maritalStatus: profile?.maritalStatus || null,
      portability,
      dsueAmount,
      federalExemption: effectiveExemption,
      stateExemption,
    },
  };
}

export function buildAssetCompositionFromProfile(profile: any): EstateAssetComposition {
  const assets = Array.isArray(profile?.assets) ? profile.assets : [];
  const taxStrategyBalances = profile?.taxStrategy?.accountBalances || {};

  const normalize = (value: any): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  let taxable = 0;
  let taxDeferred = 0;
  let roth = 0;
  let illiquid = 0;

  for (const asset of assets) {
    const value = normalize(asset?.value || asset?.balance || 0);
    const type = String(asset?.type || "").toLowerCase();
    if (!value) continue;

    if (type.includes("roth")) {
      roth += value;
    } else if (/(401k|403b|ira|retirement|pension|457|tsp|sep|simple)/.test(type)) {
      taxDeferred += value;
    } else if (/(real|property|business|collectible)/.test(type)) {
      illiquid += value;
    } else {
      taxable += value;
    }
  }

  taxDeferred += normalize(taxStrategyBalances.traditional401k)
    + normalize(taxStrategyBalances.traditionalIRA);
  roth += normalize(taxStrategyBalances.roth401k) + normalize(taxStrategyBalances.rothIRA);
  taxable += normalize(taxStrategyBalances.taxableBrokerage);
  taxable += normalize(profile?.cashReserves);
  taxable += normalize(profile?.savingsBalance);

  if (profile?.primaryResidence?.marketValue) {
    const equity = normalize(profile.primaryResidence.marketValue) - normalize(profile.primaryResidence.mortgageBalance);
    illiquid += Math.max(0, equity);
  }

  return { taxable, taxDeferred, roth, illiquid };
}

