// Healthcare Cost Calculator for Retirement Planning
// Based on 2025 Medicare costs and industry research
// 2025 Medicare costs (updated based on CMS and current data)
const MEDICARE_COSTS_2025 = {
    partB: {
        standardPremium: 185, // Monthly premium for 2025
        deductible: 257, // Annual deductible
        coinsurance: 0.20 // 20% after deductible
    },
    partD: {
        averagePremium: 34, // Monthly average (national base beneficiary premium)
        deductible: 590, // Maximum annual deductible
        outOfPocketMax: 2000 // 2025 cap on out-of-pocket costs
    },
    partA: {
        deductible: 1676, // Per benefit period
        hospitalDaily: {
            days1to60: 0,
            days61to90: 419,
            days91to150: 838, // Lifetime reserve days
            beyond150: 'all costs'
        }
    },
    medigap: {
        averagePremium: 150 // Monthly average for Plan G (adjusted to realistic range)
    }
};
// Healthcare inflation rates based on research
const HEALTHCARE_INFLATION = {
    general: 0.026, // 2.6% general inflation (25-year average)
    medical: 0.0269, // 2.69% medical inflation (historical average)
    prescription: 0.085, // 8.5% prescription drug inflation
    longTermCare: 0.045 // 4.5% long-term care inflation
};
// Updated estimates based on 2024 research
const FIDELITY_ESTIMATES = {
    singleRetiree: 165000, // Total healthcare costs for single 65-year-old (Fidelity 2024)
    marriedCouple: 330000, // Total for married couple both 65 (Fidelity 2024)
    annualGrowthRate: 0.055 // 5.5% annual growth (historical medical inflation)
};
export function calculateHealthcareCosts(params) {
    const { currentAge, retirementAge, lifeExpectancy, isMarried, spouseAge = currentAge, spouseLifeExpectancy = lifeExpectancy, healthStatus = 'good', hasEmployerCoverage = false, coverageEndAge = 65 } = params;
    // Calculate years to retirement and years in retirement
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const yearsInRetirement = lifeExpectancy - retirementAge;
    // For married couples, use the longer life expectancy
    const effectiveLifeExpectancy = isMarried
        ? Math.max(lifeExpectancy, spouseLifeExpectancy || lifeExpectancy)
        : lifeExpectancy;
    const effectiveYearsInRetirement = effectiveLifeExpectancy - retirementAge;
    // Calculate Medicare premiums (inflated to retirement year)
    const inflationFactor = Math.pow(1 + HEALTHCARE_INFLATION.medical, yearsToRetirement);
    // Monthly premiums at retirement
    const partBPremium = MEDICARE_COSTS_2025.partB.standardPremium * inflationFactor;
    const partDPremium = MEDICARE_COSTS_2025.partD.averagePremium * inflationFactor;
    const medigapPremium = MEDICARE_COSTS_2025.medigap.averagePremium * inflationFactor;
    // Annual premiums
    const annualPartBPremium = partBPremium * 12;
    const annualPartDPremium = partDPremium * 12;
    const annualMedigapPremium = medigapPremium * 12;
    // Calculate out-of-pocket costs based on health status
    let healthStatusMultiplier = 1.0;
    switch (healthStatus) {
        case 'excellent':
            healthStatusMultiplier = 0.7;
            break;
        case 'good':
            healthStatusMultiplier = 1.0;
            break;
        case 'fair':
            healthStatusMultiplier = 1.3;
            break;
        case 'poor':
            healthStatusMultiplier = 1.6;
            break;
    }
    // Annual out-of-pocket costs (based on updated research)
    // Average couple age 65-74 spends ~$13,000/year total on healthcare
    // After premiums (Part B, D, Medigap), OOP is roughly $3,000-4,000/year per person
    const baseAnnualOOP = 3500 * inflationFactor; // More realistic OOP estimate per person
    const adjustedAnnualOOP = baseAnnualOOP * healthStatusMultiplier;
    // Breakdown of out-of-pocket costs
    const breakdown = {
        dental: adjustedAnnualOOP * 0.15, // 15% for dental
        vision: adjustedAnnualOOP * 0.05, // 5% for vision
        hearing: adjustedAnnualOOP * 0.05, // 5% for hearing
        prescriptions: adjustedAnnualOOP * 0.35, // 35% for prescriptions
        deductibles: adjustedAnnualOOP * 0.20, // 20% for deductibles
        copays: adjustedAnnualOOP * 0.20, // 20% for copays
        longTermCare: 0 // Calculated separately if needed
    };
    // Total annual healthcare costs at retirement
    let annualHealthcareCosts = annualPartBPremium + annualPartDPremium +
        annualMedigapPremium + adjustedAnnualOOP;
    // Double costs for married couples
    if (isMarried) {
        annualHealthcareCosts *= 2;
        Object.keys(breakdown).forEach(key => {
            breakdown[key] *= 2;
        });
    }
    // Calculate pre-Medicare costs if retiring before 65
    let preMedicareCosts = 0;
    if (retirementAge < 65) {
        const preMedicareYears = 65 - retirementAge;
        if (!hasEmployerCoverage || coverageEndAge < 65) {
            // Need private insurance or ACA coverage
            // Average ACA premium for 60-64 age group: ~$700-800/month
            const monthlyPreMedicarePremium = 750 * inflationFactor;
            const annualPreMedicareCost = monthlyPreMedicarePremium * 12;
            // Add out-of-pocket costs (typically higher than Medicare)
            const preOOP = adjustedAnnualOOP * 1.3; // 30% higher than Medicare OOP
            preMedicareCosts = (annualPreMedicareCost + preOOP) * (isMarried ? 2 : 1);
        }
    }
    // Calculate total lifetime healthcare costs
    let totalLifetimeHealthcareCosts = 0;
    // Pre-Medicare phase
    if (retirementAge < 65) {
        const preMedicareYears = Math.min(65 - retirementAge, effectiveYearsInRetirement);
        for (let year = 0; year < preMedicareYears; year++) {
            const yearInflation = Math.pow(1 + HEALTHCARE_INFLATION.medical, year);
            totalLifetimeHealthcareCosts += preMedicareCosts * yearInflation;
        }
    }
    // Medicare phase (65+)
    const medicareStartYear = Math.max(0, 65 - retirementAge);
    const medicareYears = effectiveYearsInRetirement - medicareStartYear;
    for (let year = 0; year < medicareYears; year++) {
        const yearInflation = Math.pow(1 + HEALTHCARE_INFLATION.medical, medicareStartYear + year);
        totalLifetimeHealthcareCosts += annualHealthcareCosts * yearInflation;
    }
    return {
        annualHealthcareCosts: Math.round(annualHealthcareCosts),
        totalLifetimeHealthcareCosts: Math.round(totalLifetimeHealthcareCosts),
        medicarePartBPremium: Math.round(annualPartBPremium),
        medicarePartDPremium: Math.round(annualPartDPremium),
        medigapPremium: Math.round(annualMedigapPremium),
        outOfPocketCosts: Math.round(adjustedAnnualOOP),
        preMedicareCosts: preMedicareCosts > 0 ? Math.round(preMedicareCosts) : undefined,
        breakdown: {
            dental: Math.round(breakdown.dental),
            vision: Math.round(breakdown.vision),
            hearing: Math.round(breakdown.hearing),
            prescriptions: Math.round(breakdown.prescriptions),
            deductibles: Math.round(breakdown.deductibles),
            copays: Math.round(breakdown.copays)
        }
    };
}
// Calculate healthcare costs with inflation over time
export function projectHealthcareCostsOverTime(params) {
    const baseResult = calculateHealthcareCosts(params);
    const projections = [];
    let cumulativeCost = 0;
    const yearsInRetirement = params.lifeExpectancy - params.retirementAge;
    for (let year = 0; year < yearsInRetirement; year++) {
        const age = params.retirementAge + year;
        let annualCost;
        if (age < 65 && params.retirementAge < 65) {
            // Pre-Medicare phase
            const inflationFactor = Math.pow(1 + HEALTHCARE_INFLATION.medical, year);
            annualCost = (baseResult.preMedicareCosts || 0) * inflationFactor;
        }
        else {
            // Medicare phase
            const yearsSinceRetirement = year;
            const inflationFactor = Math.pow(1 + HEALTHCARE_INFLATION.medical, yearsSinceRetirement);
            annualCost = baseResult.annualHealthcareCosts * inflationFactor;
        }
        cumulativeCost += annualCost;
        projections.push({
            year: year + 1,
            age,
            annualCost: Math.round(annualCost),
            cumulativeCost: Math.round(cumulativeCost)
        });
    }
    return projections;
}
// Integrate healthcare costs into retirement expenses
export function addHealthcareCostsToRetirementExpenses(baseMonthlyExpenses, healthcareCostParams) {
    const healthcareCosts = calculateHealthcareCosts(healthcareCostParams);
    const monthlyHealthcareCosts = healthcareCosts.annualHealthcareCosts / 12;
    const totalMonthlyExpenses = baseMonthlyExpenses + monthlyHealthcareCosts;
    const percentageOfTotal = (monthlyHealthcareCosts / totalMonthlyExpenses) * 100;
    return {
        totalMonthlyExpenses: Math.round(totalMonthlyExpenses),
        healthcarePortion: Math.round(monthlyHealthcareCosts),
        percentageOfTotal: Math.round(percentageOfTotal)
    };
}
