"use strict";
/**
 * Enhanced Long-Term Care (LTC) Modeling for Monte Carlo Simulations
 * Implements sophisticated multi-state LTC risk modeling with insurance options
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_LTC_COSTS = exports.REGIONAL_LTC_COST_FACTORS = void 0;
exports.getAnnualLTCProbability = getAnnualLTCProbability;
exports.getLTCTransitionProbabilities = getLTCTransitionProbabilities;
exports.generateLTCDuration = generateLTCDuration;
exports.calculateAnnualLTCCost = calculateAnnualLTCCost;
exports.calculateLTCInsurancePremium = calculateLTCInsurancePremium;
exports.calculateLTCInsuranceBenefit = calculateLTCInsuranceBenefit;
exports.calculateLTCTaxBenefit = calculateLTCTaxBenefit;
exports.simulateLTCTransition = simulateLTCTransition;
exports.modelLTCEvents = modelLTCEvents;
exports.calculateDeterministicLTCCosts = calculateDeterministicLTCCosts;
// Regional Cost Adjustments (relative to national average)
exports.REGIONAL_LTC_COST_FACTORS = {
    'AL': 0.85, 'AK': 1.45, 'AZ': 0.95, 'AR': 0.80, 'CA': 1.35,
    'CO': 1.10, 'CT': 1.30, 'DE': 1.15, 'FL': 0.90, 'GA': 0.85,
    'HI': 1.40, 'ID': 0.95, 'IL': 1.05, 'IN': 0.90, 'IA': 0.85,
    'KS': 0.85, 'KY': 0.85, 'LA': 0.80, 'ME': 1.10, 'MD': 1.20,
    'MA': 1.35, 'MI': 0.95, 'MN': 1.15, 'MS': 0.75, 'MO': 0.85,
    'MT': 0.95, 'NE': 0.90, 'NV': 1.05, 'NH': 1.20, 'NJ': 1.25,
    'NM': 0.90, 'NY': 1.40, 'NC': 0.85, 'ND': 1.00, 'OH': 0.90,
    'OK': 0.80, 'OR': 1.10, 'PA': 1.00, 'RI': 1.20, 'SC': 0.85,
    'SD': 0.90, 'TN': 0.85, 'TX': 0.90, 'UT': 0.95, 'VT': 1.15,
    'VA': 0.95, 'WA': 1.20, 'WV': 0.85, 'WI': 0.95, 'WY': 1.00
};
// 2024 National median costs from Genworth/CareScout Cost of Care Survey
exports.BASE_LTC_COSTS = {
    homeHealthAide: 61776, // $5,148/month for 44 hours/week
    homemakerServices: 59488, // $4,957/month  
    adultDayHealth: 26000, // $2,167/month (5 days/week)
    assistedLiving: 70800, // $5,900/month (2024 median)
    nursingHomeSemi: 104025, // $8,669/month semi-private room
    nursingHomePrivate: 127800 // $10,650/month private room
};
;
// Age-based LTC probability (annual probability of needing any LTC)
function getAnnualLTCProbability(age, gender, healthStatus) {
    // Base probabilities by age - calibrated for ~48% paid care (ASPE/Urban Institute data)
    // These are ANNUAL probabilities that compound to lifetime risk
    let baseProbability;
    if (age < 65) {
        baseProbability = 0.001; // Very low before 65
    }
    else if (age < 70) {
        baseProbability = 0.003; // Ages 65-69: 0.3% annual
    }
    else if (age < 75) {
        baseProbability = 0.008; // Ages 70-74: 0.8% annual
    }
    else if (age < 80) {
        baseProbability = 0.018; // Ages 75-79: 1.8% annual
    }
    else if (age < 85) {
        baseProbability = 0.035; // Ages 80-84: 3.5% annual (calibrated for 48% lifetime)
    }
    else if (age < 90) {
        baseProbability = 0.065; // Ages 85-89: 6.5% annual
    }
    else if (age < 95) {
        baseProbability = 0.095; // Ages 90-94: 9.5% annual
    }
    else {
        baseProbability = 0.12; // Ages 95+: 12% annual but capped
    }
    // Gender adjustment (women have longer duration but similar incidence)
    // Women: 3.7 years average, Men: 2.2 years average (ACL data)
    const genderMultiplier = gender === 'female' ? 1.15 : 1.0;
    // Health status adjustment (affects both incidence and severity)
    const healthMultipliers = {
        'excellent': 0.5, // ~25% lifetime risk
        'good': 0.85, // ~40% lifetime risk  
        'fair': 1.3, // ~62% lifetime risk
        'poor': 2.0 // ~96% lifetime risk (nearly certain)
    };
    return baseProbability * genderMultiplier * healthMultipliers[healthStatus];
}
// Markov transition matrix for LTC states
function getLTCTransitionProbabilities(currentState, age, hasInsurance) {
    // Transition probabilities depend on current state, age, and insurance
    switch (currentState) {
        case 'healthy':
            return {
                'healthy': 0.94,
                'needs_assistance': 0.04,
                'home_care': 0.015,
                'assisted_living': 0.004,
                'nursing_home': 0.001,
                'deceased': 0.000
            };
        case 'needs_assistance':
            return {
                'healthy': hasInsurance ? 0.15 : 0.10, // Better recovery with insurance
                'needs_assistance': 0.50,
                'home_care': 0.20,
                'assisted_living': 0.10,
                'nursing_home': 0.03,
                'deceased': 0.02
            };
        case 'home_care':
            return {
                'healthy': 0.05,
                'needs_assistance': 0.10,
                'home_care': 0.60,
                'assisted_living': 0.15,
                'nursing_home': 0.07,
                'deceased': 0.03
            };
        case 'assisted_living':
            return {
                'healthy': 0.02,
                'needs_assistance': 0.03,
                'home_care': 0.05,
                'assisted_living': 0.65,
                'nursing_home': 0.20,
                'deceased': 0.05
            };
        case 'nursing_home':
            const deathProb = Math.min(0.30, 0.10 + (age - 80) * 0.02);
            return {
                'healthy': 0.01,
                'needs_assistance': 0.02,
                'home_care': 0.02,
                'assisted_living': 0.05,
                'nursing_home': 0.90 - deathProb,
                'deceased': deathProb
            };
        case 'deceased':
            return {
                'healthy': 0,
                'needs_assistance': 0,
                'home_care': 0,
                'assisted_living': 0,
                'nursing_home': 0,
                'deceased': 1
            };
    }
}
// Generate LTC duration based on state and demographics
function generateLTCDuration(state, gender, hasInsurance) {
    // Average durations by state (in years) - based on ASPE/Urban Institute data
    // Overall averages: Women 3.7 years, Men 2.2 years
    const baseDurations = {
        'needs_assistance': 0.8, // Short-term assistance
        'home_care': 1.5, // Most common setting
        'assisted_living': 2.0, // Medium-term facility
        'nursing_home': 1.8, // Only 15% spend >2 years here
        'healthy': 0,
        'deceased': 0
    };
    // Gender adjustment - Women: 3.7y average, Men: 2.2y average (ACL data)
    const genderMultiplier = gender === 'female' ? 1.68 : 1.0; // 3.7/2.2 = 1.68
    // Insurance can reduce duration through better care
    const insuranceMultiplier = hasInsurance ? 0.85 : 1.0;
    const baseDuration = baseDurations[state] || 0;
    const adjustedDuration = baseDuration * genderMultiplier * insuranceMultiplier;
    // Add randomness using exponential distribution
    const randomFactor = -Math.log(Math.random());
    return Math.max(0.25, adjustedDuration * randomFactor);
}
// Calculate annual LTC costs based on care type and location
function calculateAnnualLTCCost(state, retirementState, year, ltcInflationRate = 0.045 // Parameter kept for backward compatibility but not used
) {
    // Get base cost for care type
    let baseCost;
    switch (state) {
        case 'needs_assistance':
            baseCost = exports.BASE_LTC_COSTS.adultDayHealth * 0.5; // Part-time assistance
            break;
        case 'home_care':
            baseCost = exports.BASE_LTC_COSTS.homeHealthAide;
            break;
        case 'assisted_living':
            baseCost = exports.BASE_LTC_COSTS.assistedLiving;
            break;
        case 'nursing_home':
            baseCost = exports.BASE_LTC_COSTS.nursingHomeSemi;
            break;
        default:
            baseCost = 0;
    }
    // Apply regional adjustment
    const regionalFactor = exports.REGIONAL_LTC_COST_FACTORS[retirementState] || 1.0;
    // Real dollar model: Keep costs in today's purchasing power
    // No inflation adjustment applied
    return baseCost * regionalFactor;
}
// Calculate LTC insurance premiums based on age and policy details
function calculateLTCInsurancePremium(age, gender, healthStatus, policy) {
    // Base premium factors (per $100 daily benefit)
    const baseRatesPer100Daily = {
        40: 600,
        50: 900,
        55: 1200,
        60: 1800,
        65: 2800,
        70: 4500
    };
    // Interpolate for exact age
    const ages = Object.keys(baseRatesPer100Daily).map(Number).sort((a, b) => a - b);
    let baseRate;
    if (age <= ages[0]) {
        baseRate = baseRatesPer100Daily[ages[0]];
    }
    else if (age >= ages[ages.length - 1]) {
        baseRate = baseRatesPer100Daily[ages[ages.length - 1]] * Math.pow(1.15, age - ages[ages.length - 1]);
    }
    else {
        // Linear interpolation
        for (let i = 0; i < ages.length - 1; i++) {
            if (age >= ages[i] && age <= ages[i + 1]) {
                const rate1 = baseRatesPer100Daily[ages[i]];
                const rate2 = baseRatesPer100Daily[ages[i + 1]];
                const fraction = (age - ages[i]) / (ages[i + 1] - ages[i]);
                baseRate = rate1 + (rate2 - rate1) * fraction;
                break;
            }
        }
    }
    // Adjust for policy features
    let premium = baseRate * (policy.dailyBenefit / 100);
    // Benefit period adjustment
    const periodMultipliers = {
        2: 0.75,
        3: 0.85,
        5: 1.0,
        100: 1.35 // Lifetime
    };
    premium *= periodMultipliers[policy.benefitPeriodYears] || 1.0;
    // Elimination period adjustment
    const eliminationMultipliers = {
        30: 1.1,
        60: 1.0,
        90: 0.9
    };
    premium *= eliminationMultipliers[policy.eliminationPeriodDays] || 1.0;
    // Inflation protection adjustment
    const inflationMultipliers = {
        'none': 0.7,
        '3%_compound': 1.5,
        '5%_simple': 1.2,
        'cpi': 1.3
    };
    premium *= inflationMultipliers[policy.inflationProtection] || 1.0;
    // Gender adjustment
    premium *= gender === 'female' ? 1.3 : 1.0;
    // Health adjustment
    const healthMultipliers = {
        'excellent': 0.85,
        'good': 1.0,
        'fair': 1.5,
        'poor': 2.5 // May be uninsurable
    };
    premium *= healthMultipliers[healthStatus];
    // Shared care discount for couples
    if (policy.sharedCareBenefit) {
        premium *= 0.85;
    }
    return Math.round(premium);
}
// Calculate insurance benefits for LTC event
function calculateLTCInsuranceBenefit(policy, ltcEvent, currentYear) {
    if (policy.type === 'none') {
        return { benefitAmount: 0, remainingBenefit: 0 };
    }
    // Check if still in elimination period
    // Support both calendar days and service days elimination
    const daysIntoEvent = ltcEvent.duration * 365;
    let effectiveElimination = policy.eliminationPeriodDays;
    // If service day elimination and not full-time care, adjust accordingly
    // Assume home care is 5 days/week, so 90 service days = ~126 calendar days
    if (policy.eliminationType === 'service' && ltcEvent.state === 'home_care') {
        effectiveElimination = policy.eliminationPeriodDays * 1.4; // 7/5 = 1.4
    }
    if (daysIntoEvent < effectiveElimination) {
        return { benefitAmount: 0, remainingBenefit: policy.dailyBenefit * policy.benefitPeriodYears * 365 };
    }
    // Calculate daily benefit with inflation adjustment
    let adjustedDailyBenefit = policy.dailyBenefit;
    const yearsSincePolicyStart = currentYear - policy.policyStartAge;
    switch (policy.inflationProtection) {
        case '3%_compound':
            adjustedDailyBenefit *= Math.pow(1.03, yearsSincePolicyStart);
            break;
        case '5%_simple':
            adjustedDailyBenefit *= (1 + 0.05 * yearsSincePolicyStart);
            break;
        case 'cpi':
            adjustedDailyBenefit *= Math.pow(1.025, yearsSincePolicyStart); // Approximate CPI
            break;
    }
    // Calculate annual benefit (capped by actual care costs)
    const maxAnnualBenefit = adjustedDailyBenefit * 365;
    const actualBenefit = Math.min(maxAnnualBenefit, ltcEvent.careCostAnnual);
    // Track remaining benefit pool (inflation riders increase the pool)
    let totalBenefitPool = policy.dailyBenefit * policy.benefitPeriodYears * 365;
    // Apply inflation to the total pool for compound inflation riders
    if (policy.inflationProtection === '3%_compound') {
        totalBenefitPool *= Math.pow(1.03, yearsSincePolicyStart);
    }
    const usedBenefit = ltcEvent.insuranceBenefitUsed + actualBenefit;
    const remainingBenefit = Math.max(0, totalBenefitPool - usedBenefit);
    return {
        benefitAmount: remainingBenefit > 0 ? actualBenefit : 0,
        remainingBenefit
    };
}
// Calculate tax treatment for LTC expenses and insurance benefits
function calculateLTCTaxBenefit(ltcExpenses, insuranceBenefits, insurancePremiums, adjustedGrossIncome, age, policy) {
    // Medical expense deduction threshold: 7.5% of AGI
    const MEDICAL_EXPENSE_THRESHOLD = 0.075;
    // 2025 per-diem cap for tax-free benefits
    const PER_DIEM_CAP_2025 = 420 * 365; // $420/day = $153,300/year
    // Age-based premium deduction limits (2025)
    const premiumDeductionLimits = {
        40: 470, // Age 40 and under
        50: 890, // Age 41-50
        60: 1790, // Age 51-60
        70: 4770, // Age 61-70
        71: 5960 // Age 71 and over
    };
    // Calculate deductible medical expenses
    const totalMedicalExpenses = ltcExpenses - insuranceBenefits + insurancePremiums;
    const agiThreshold = adjustedGrossIncome * MEDICAL_EXPENSE_THRESHOLD;
    const deductibleExpenses = Math.max(0, totalMedicalExpenses - agiThreshold);
    // Calculate taxable insurance benefits
    let taxableBenefits = 0;
    if (policy?.taxQualified === false) {
        // Non-qualified policies: benefits may be taxable
        taxableBenefits = insuranceBenefits;
    }
    else {
        // Tax-qualified policies: benefits tax-free up to per-diem cap
        taxableBenefits = Math.max(0, insuranceBenefits - PER_DIEM_CAP_2025);
    }
    // Calculate deductible premiums (subject to age-based limits)
    let maxPremiumDeduction = 0;
    if (age <= 40)
        maxPremiumDeduction = premiumDeductionLimits[40];
    else if (age <= 50)
        maxPremiumDeduction = premiumDeductionLimits[50];
    else if (age <= 60)
        maxPremiumDeduction = premiumDeductionLimits[60];
    else if (age <= 70)
        maxPremiumDeduction = premiumDeductionLimits[70];
    else
        maxPremiumDeduction = premiumDeductionLimits[71];
    const deductiblePremiums = Math.min(insurancePremiums, maxPremiumDeduction);
    return {
        deductibleExpenses,
        taxableBenefits,
        deductiblePremiums
    };
}
// Simulate LTC state transitions for a single year
function simulateLTCTransition(currentState, age, gender, healthStatus, hasInsurance) {
    // Special handling for healthy state - check if LTC needed
    if (currentState === 'healthy') {
        const ltcProbability = getAnnualLTCProbability(age, gender, healthStatus);
        if (Math.random() < ltcProbability) {
            // Determine initial LTC state based on age and health
            const rand = Math.random();
            if (age < 75 && healthStatus !== 'poor') {
                // Younger, healthier people more likely to start with home care
                if (rand < 0.5)
                    return 'needs_assistance';
                else if (rand < 0.8)
                    return 'home_care';
                else
                    return 'assisted_living';
            }
            else {
                // Older or less healthy more likely to need higher care
                if (rand < 0.2)
                    return 'needs_assistance';
                else if (rand < 0.5)
                    return 'home_care';
                else if (rand < 0.8)
                    return 'assisted_living';
                else
                    return 'nursing_home';
            }
        }
        return 'healthy';
    }
    // Get transition probabilities for current state
    const transitions = getLTCTransitionProbabilities(currentState, age, hasInsurance);
    // Generate next state using probabilities
    const rand = Math.random();
    let cumProb = 0;
    for (const [nextState, prob] of Object.entries(transitions)) {
        cumProb += prob;
        if (rand <= cumProb) {
            return nextState;
        }
    }
    return currentState; // Fallback
}
// Model LTC events throughout retirement
function modelLTCEvents(startAge, endAge, gender, healthStatus, retirementState, ltcInsurance, spouseInfo) {
    // RightCapital-style simplified LTC modeling
    // Uses fixed annual cost in today's purchasing power (real dollar model)
    const BASE_ANNUAL_LTC_COST = 75504; // National average from RightCapital in today's dollars
    // Gender-specific duration based on ACL data
    // Women: 3.7 years average, Men: 2.2 years average
    const avgDuration = gender === 'female' ? 3.7 : 2.2;
    // Add variability: 50% to 150% of average with exponential distribution
    const durationVariability = 0.5 + Math.random() * 1.0; // 0.5 to 1.5 multiplier
    const LTC_DURATION_YEARS = Math.min(avgDuration * durationVariability, endAge - startAge);
    // No inflation applied - all costs remain in today's purchasing power
    const ltcEvents = [];
    let totalLTCCosts = 0;
    let totalInsuranceBenefits = 0;
    let totalOutOfPocketCosts = 0;
    let maxSimultaneousCost = 0;
    let yearsInLTC = 0;
    // LTC can occur anytime after age 75 (not just at end of life)
    // Average onset age is 80, but can vary
    const minLTCAge = 75;
    const ltcStartAge = Math.max(minLTCAge + Math.floor(Math.random() * (endAge - minLTCAge - LTC_DURATION_YEARS + 1)), startAge);
    // Determine if LTC event occurs based on probability
    // Using age-based probability for the entire retirement period
    const yearsInRetirement = endAge - startAge;
    const avgAge = (startAge + endAge) / 2;
    // ASPE/Urban Institute data: 48% lifetime risk of paid care, adjusted by health status
    // Note: 57% need LTSS but only 48% receive paid care (rest is family/unpaid)
    const healthMultiplier = {
        'excellent': 0.5, // ~24% lifetime risk of paid care
        'good': 0.85, // ~40% lifetime risk of paid care
        'fair': 1.3, // ~62% lifetime risk of paid care
        'poor': 2.0 // ~96% lifetime risk (nearly certain)
    }[healthStatus];
    const lifetimeLTCProbability = Math.min(0.48 * healthMultiplier, 0.95);
    // Simulate whether LTC event occurs
    const hasLTCEvent = Math.random() < lifetimeLTCProbability;
    // Store user's annual cost for later reference when checking overlaps
    let userAnnualCost = 0;
    if (hasLTCEvent && ltcStartAge <= endAge) {
        // Use base cost without inflation adjustment (real dollar model)
        const annualCost = BASE_ANNUAL_LTC_COST;
        userAnnualCost = annualCost; // Store for overlap calculation
        // Create single LTC event for primary user
        const userEvent = {
            startAge: ltcStartAge,
            duration: Math.min(LTC_DURATION_YEARS, endAge - ltcStartAge + 1),
            state: 'assisted_living',
            careCostAnnual: annualCost,
            insuranceBenefitUsed: 0,
            outOfPocketCost: 0
        };
        // Calculate insurance benefits if applicable
        for (let year = 0; year < userEvent.duration; year++) {
            // Use consistent annual cost without inflation
            const yearCost = userEvent.careCostAnnual;
            if (ltcInsurance.type !== 'none') {
                const annualBenefit = Math.min(ltcInsurance.dailyBenefit * 365, yearCost);
                userEvent.insuranceBenefitUsed += annualBenefit;
                userEvent.outOfPocketCost += yearCost - annualBenefit;
                totalInsuranceBenefits += annualBenefit;
            }
            else {
                userEvent.outOfPocketCost += yearCost;
            }
            totalLTCCosts += yearCost;
            yearsInLTC++;
        }
        ltcEvents.push(userEvent);
        maxSimultaneousCost = userEvent.careCostAnnual;
    }
    // Handle spouse LTC if applicable
    if (spouseInfo) {
        // Gender-specific duration for spouse
        const spouseAvgDuration = spouseInfo.gender === 'female' ? 3.7 : 2.2;
        const spouseDurationVariability = 0.5 + Math.random() * 1.0;
        const spouseLTCDuration = Math.min(spouseAvgDuration * spouseDurationVariability, endAge - startAge);
        const spouseEndAge = spouseInfo.startAge + (endAge - startAge);
        const spouseLTCStartAge = Math.max(spouseEndAge - spouseLTCDuration + 1, spouseInfo.startAge);
        // Spouse has independent probability - ASPE data: 48% paid care
        const spouseHealthMultiplier = {
            'excellent': 0.5, // ~24% lifetime risk
            'good': 0.85, // ~40% lifetime risk
            'fair': 1.3, // ~62% lifetime risk
            'poor': 2.0 // ~96% lifetime risk
        }[spouseInfo.healthStatus];
        const spouseLTCProbability = Math.min(0.48 * spouseHealthMultiplier, 0.95);
        const spouseHasLTC = Math.random() < spouseLTCProbability;
        if (spouseHasLTC && spouseLTCStartAge <= spouseEndAge) {
            // Use base cost without inflation adjustment (real dollar model)
            const spouseCost = BASE_ANNUAL_LTC_COST;
            const spouseEvent = {
                startAge: spouseLTCStartAge,
                duration: Math.min(spouseLTCDuration, spouseEndAge - spouseLTCStartAge + 1),
                state: 'assisted_living',
                careCostAnnual: spouseCost,
                insuranceBenefitUsed: 0,
                outOfPocketCost: 0
            };
            // Calculate spouse insurance benefits
            for (let year = 0; year < spouseEvent.duration; year++) {
                // Use consistent annual cost without inflation
                const yearCost = spouseEvent.careCostAnnual;
                if (spouseInfo.ltcInsurance.type !== 'none') {
                    const annualBenefit = Math.min(spouseInfo.ltcInsurance.dailyBenefit * 365, yearCost);
                    spouseEvent.insuranceBenefitUsed += annualBenefit;
                    spouseEvent.outOfPocketCost += yearCost - annualBenefit;
                    totalInsuranceBenefits += annualBenefit;
                }
                else {
                    spouseEvent.outOfPocketCost += yearCost;
                }
                totalLTCCosts += yearCost;
            }
            ltcEvents.push(spouseEvent);
            // Check if both events overlap
            const userLTCEnd = hasLTCEvent ? ltcStartAge + LTC_DURATION_YEARS - 1 : 0;
            const spouseLTCEnd = spouseLTCStartAge + spouseEvent.duration - 1;
            if (hasLTCEvent &&
                ((ltcStartAge <= spouseLTCStartAge && userLTCEnd >= spouseLTCStartAge) ||
                    (spouseLTCStartAge <= ltcStartAge && spouseLTCEnd >= ltcStartAge))) {
                // Events overlap - both costs apply simultaneously
                maxSimultaneousCost = userAnnualCost + spouseCost;
            }
            else {
                maxSimultaneousCost = Math.max(maxSimultaneousCost, spouseCost);
            }
        }
    }
    // Calculate total out-of-pocket costs
    totalOutOfPocketCosts = ltcEvents.reduce((sum, event) => sum + event.outOfPocketCost, 0);
    // Medicaid spend-down determination
    // Based on state-specific asset thresholds (using national averages)
    // Individual: $2,000 assets, Couple: $3,000 assets (most states)
    // Home equity limit: $688,000 (2024)
    // Income limits vary by state but typically ~$2,829/month individual
    const MEDICAID_ASSET_LIMIT = spouseInfo ? 3000 : 2000;
    const MEDICAID_HOME_EQUITY_LIMIT = 688000;
    // Simplified: Assume Medicaid required if OOP costs would deplete assets below limits
    // In reality, complex spend-down rules and look-back periods apply
    const medicaidRequired = totalOutOfPocketCosts > 200000; // Threshold for likely asset depletion
    return {
        hadLTCEvent: ltcEvents.length > 0,
        totalLTCCosts,
        totalInsuranceBenefits,
        totalOutOfPocketCosts,
        ltcEvents,
        maxSimultaneousCost,
        medicaidRequired,
        yearsInLTC
    };
}
// Deterministic LTC cost calculation for projections (no randomness)
function calculateDeterministicLTCCosts(startAge, endAge, gender, healthStatus, ltcInsurance, spouseInfo) {
    const BASE_ANNUAL_LTC_COST = 75504;
    const LTC_DURATION_YEARS = 2;
    // Real dollar model: No inflation applied
    const yearlyLTCCosts = new Map();
    let totalExpectedCost = 0;
    let totalExpectedBenefit = 0;
    // Calculate expected LTC costs for last 2 years
    const ltcStartAge = Math.max(endAge - LTC_DURATION_YEARS + 1, startAge);
    // Health-adjusted probability
    const healthMultiplier = {
        'excellent': 0.7,
        'good': 1.0,
        'fair': 1.3,
        'poor': 1.6
    }[healthStatus];
    const ltcProbability = Math.min(0.7 * healthMultiplier, 0.95);
    // Apply expected costs for primary user
    if (ltcStartAge <= endAge) {
        for (let age = ltcStartAge; age <= endAge; age++) {
            // Use base cost without inflation adjustment (real dollar model)
            const cost = BASE_ANNUAL_LTC_COST;
            const expectedCost = cost * ltcProbability;
            const currentCost = yearlyLTCCosts.get(age) || 0;
            yearlyLTCCosts.set(age, currentCost + expectedCost);
            totalExpectedCost += expectedCost;
            // Calculate insurance benefit
            if (ltcInsurance.type !== 'none') {
                const annualBenefit = Math.min(ltcInsurance.dailyBenefit * 365, expectedCost);
                totalExpectedBenefit += annualBenefit;
            }
        }
    }
    // Add spouse costs if applicable
    if (spouseInfo) {
        const spouseEndAge = spouseInfo.startAge + (endAge - startAge);
        const spouseLTCStartAge = Math.max(spouseEndAge - LTC_DURATION_YEARS + 1, spouseInfo.startAge);
        const spouseHealthMultiplier = {
            'excellent': 0.7,
            'good': 1.0,
            'fair': 1.3,
            'poor': 1.6
        }[spouseInfo.healthStatus];
        const spouseLTCProbability = Math.min(0.7 * spouseHealthMultiplier, 0.95);
        if (spouseLTCStartAge <= spouseEndAge) {
            for (let spouseAge = spouseLTCStartAge; spouseAge <= spouseEndAge; spouseAge++) {
                const correspondingUserAge = startAge + (spouseAge - spouseInfo.startAge);
                // Use base cost without inflation adjustment (real dollar model)
                const cost = BASE_ANNUAL_LTC_COST;
                const expectedCost = cost * spouseLTCProbability;
                const currentCost = yearlyLTCCosts.get(correspondingUserAge) || 0;
                yearlyLTCCosts.set(correspondingUserAge, currentCost + expectedCost);
                totalExpectedCost += expectedCost;
                // Calculate spouse insurance benefit
                if (spouseInfo.ltcInsurance.type !== 'none') {
                    const annualBenefit = Math.min(spouseInfo.ltcInsurance.dailyBenefit * 365, expectedCost);
                    totalExpectedBenefit += annualBenefit;
                }
            }
        }
    }
    return {
        yearlyLTCCosts,
        totalExpectedCost,
        totalExpectedBenefit
    };
}
