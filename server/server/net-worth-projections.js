"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNetWorthProjections = calculateNetWorthProjections;
const tax_calculator_1 = require("./tax-calculator");
const ltc_modeling_1 = require("./ltc-modeling");
// RMD divisor table based on IRS Uniform Lifetime Table
const RMD_DIVISORS = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4
};
// Calculate Required Minimum Distribution
function calculateRMD(age, taxDeferredBalance) {
    // RMDs start at age 73 (as of 2023)
    if (age < 73)
        return 0;
    // Get the divisor for the age, or use age 100 divisor for ages over 100
    const divisor = RMD_DIVISORS[age] || RMD_DIVISORS[100];
    return taxDeferredBalance / divisor;
}
// Calculate taxable portion of Social Security benefits
function calculateTaxableSocialSecurity(ssBenefit, otherIncome, filingStatus) {
    if (ssBenefit <= 0)
        return 0;
    // Calculate provisional income (other income + 50% of SS benefits)
    const provisionalIncome = otherIncome + (ssBenefit * 0.5);
    // 2024 thresholds
    const thresholds = filingStatus === 'single' ?
        { first: 25000, second: 34000 } :
        { first: 32000, second: 44000 };
    if (provisionalIncome <= thresholds.first) {
        return 0; // No SS is taxable
    }
    else if (provisionalIncome <= thresholds.second) {
        // Up to 50% is taxable
        const excess = provisionalIncome - thresholds.first;
        return Math.min(excess * 0.5, ssBenefit * 0.5);
    }
    else {
        // Up to 85% is taxable
        const firstTier = (thresholds.second - thresholds.first) * 0.5;
        const secondTier = (provisionalIncome - thresholds.second) * 0.85;
        return Math.min(firstTier + secondTier, ssBenefit * 0.85);
    }
}
// Helper function to calculate annuity income
function calculateAnnuityIncome(profile, currentYear) {
    const allAssets = profile.assets || [];
    const annuityTypes = ['qualified-annuities', 'non-qualified-annuities', 'roth-annuities'];
    const annuities = allAssets.filter((asset) => annuityTypes.includes(asset.type));
    let monthlyAnnuityIncome = 0;
    const isMarriedOrPartnered = profile.maritalStatus === 'married' || profile.maritalStatus === 'partnered';
    annuities.forEach((annuity) => {
        // Only include if owned by user or joint (or all if married/partnered)
        const owner = (annuity.owner || 'user').toLowerCase();
        if (isMarriedOrPartnered || owner === 'user' || owner === 'joint') {
            if (annuity.annuityType === 'immediate' ||
                (annuity.annuityType === 'deferred' && annuity.payoutStartDate)) {
                // Check if payout has started
                const payoutStartDate = annuity.payoutStartDate ? new Date(annuity.payoutStartDate) : null;
                const hasStartedPayout = !payoutStartDate || payoutStartDate.getFullYear() <= currentYear;
                if (hasStartedPayout && annuity.payoutAmount) {
                    const payoutAmount = Number(annuity.payoutAmount) || 0;
                    const frequency = annuity.payoutFrequency || 'monthly';
                    // Convert to monthly amount
                    let monthlyAmount = payoutAmount;
                    if (frequency === 'quarterly')
                        monthlyAmount = payoutAmount / 3;
                    if (frequency === 'annually')
                        monthlyAmount = payoutAmount / 12;
                    monthlyAnnuityIncome += monthlyAmount;
                }
            }
        }
    });
    return monthlyAnnuityIncome * 12; // Return annual amount
}
function calculateNetWorthProjections(profile) {
    // Extract current age and retirement info
    const currentYear = new Date().getFullYear();
    const birthYear = profile.dateOfBirth ? new Date(profile.dateOfBirth).getFullYear() : currentYear - 35;
    const currentAge = currentYear - birthYear;
    const spouseBirthYear = profile.spouseDateOfBirth ? new Date(profile.spouseDateOfBirth).getFullYear() : null;
    const spouseCurrentAge = spouseBirthYear ? currentYear - spouseBirthYear : null;
    // Determine projection period (to life expectancy or spouse life expectancy)
    const lifeExpectancy = profile.lifeExpectancy || 85;
    const spouseLifeExpectancy = profile.spouseLifeExpectancy || 85;
    const maxAge = Math.max(lifeExpectancy, spouseCurrentAge ? spouseLifeExpectancy : 0);
    const yearsToProject = maxAge - currentAge;
    // Calculate current net worth components
    let currentSavings = 0;
    let currentRealEstate = 0;
    let currentOtherAssets = 0;
    let currentCVLI = 0; // Track CVLI separately for proper growth modeling
    let currentDebt = 0;
    // Track different types of savings for tax purposes
    let currentTaxDeferred = 0; // 401k, Traditional IRA, etc.
    let currentTaxFree = 0; // Roth IRA, Roth 401k
    let currentTaxable = 0; // Brokerage, savings, checking
    // Define account type categories
    const taxDeferredTypes = ['401k', '403b', 'ira', 'sep-ira', 'simple-ira'];
    const taxFreeTypes = ['roth-ira', 'roth-401k'];
    const taxableTypes = ['taxable-brokerage', 'savings', 'checking'];
    const savingsAssetTypes = [...taxDeferredTypes, ...taxFreeTypes, ...taxableTypes, 'hsa'];
    if (profile.assets && Array.isArray(profile.assets)) {
        profile.assets.forEach((asset) => {
            const value = Number(asset.value) || 0;
            const type = asset.type || '';
            if (savingsAssetTypes.includes(type)) {
                currentSavings += value;
                // Categorize by tax treatment
                if (taxDeferredTypes.includes(type)) {
                    currentTaxDeferred += value;
                }
                else if (taxFreeTypes.includes(type)) {
                    currentTaxFree += value;
                }
                else if (taxableTypes.includes(type) || type === 'hsa') {
                    currentTaxable += value;
                }
            }
            else if (type === 'cash-value-life-insurance') {
                // Track CVLI separately for proper growth modeling
                currentCVLI += value;
            }
            else if (type === 'other-real-estate') {
                currentRealEstate += value;
            }
            else {
                currentOtherAssets += value;
            }
        });
    }
    // Add primary residence to real estate
    if (profile.primaryResidence?.marketValue) {
        currentRealEstate += Number(profile.primaryResidence.marketValue) || 0;
    }
    // Calculate total debt
    if (profile.liabilities && Array.isArray(profile.liabilities)) {
        profile.liabilities.forEach((liability) => {
            currentDebt += Number(liability.balance) || 0;
        });
    }
    // Add mortgage to debt
    if (profile.primaryResidence?.mortgageBalance) {
        currentDebt += Number(profile.primaryResidence.mortgageBalance) || 0;
    }
    const currentNetWorth = currentSavings + currentRealEstate + currentOtherAssets + currentCVLI - currentDebt;
    // Get financial assumptions
    // Individual contribution amounts are now used directly in the projection loop
    // to maintain accurate account-type allocations
    // Get expected returns from Step 11 of intake form (retirement questions)
    // If expectedRealReturn is -1, it means user selected Glide Path strategy
    const useGlidePath = Number(profile.expectedRealReturn) === -1;
    let expectedReturn;
    // Use real returns (inflation-adjusted) to match Monte Carlo methodology
    // This provides consistent modeling with expenses in today's dollars
    const useNominalReturns = false; // Using REAL returns to match Monte Carlo
    const inflationRate = 0.026; // 2.6% annual
    if (useGlidePath) {
        // For glide path, start with higher returns and decrease as retirement approaches
        const yearsToRetirement = Math.max(0, (Number(profile.desiredRetirementAge) || 65) - currentAge);
        if (yearsToRetirement > 20) {
            expectedReturn = useNominalReturns ? 0.106 : 0.08; // 10.6% nominal / 8% real for 20+ years
        }
        else if (yearsToRetirement > 10) {
            expectedReturn = useNominalReturns ? 0.096 : 0.07; // 9.6% nominal / 7% real for 10-20 years
        }
        else if (yearsToRetirement > 5) {
            expectedReturn = useNominalReturns ? 0.086 : 0.06; // 8.6% nominal / 6% real for 5-10 years
        }
        else {
            expectedReturn = useNominalReturns ? 0.076 : 0.05; // 7.6% nominal / 5% real for < 5 years
        }
    }
    else {
        // Use the return rate from Step 11 (convert from percentage to decimal)
        const baseReturn = (Number(profile.expectedRealReturn) || 6) / 100;
        expectedReturn = useNominalReturns ? baseReturn + inflationRate : baseReturn;
    }
    // Real estate typically appreciates at inflation + 1.6% (historical average)
    const realEstateAppreciation = useNominalReturns ? 0.042 : 0.016; // 4.2% nominal / 1.6% real
    // CVLI typically has a crediting rate of 4-5% nominal (1.4-2.4% real)
    const cvliCreditingRate = useNominalReturns ? 0.045 : 0.019; // 4.5% nominal / 1.9% real
    // Project net worth year by year
    const projections = [];
    let projectedSavings = currentSavings;
    let projectedRealEstate = currentRealEstate;
    let projectedOtherAssets = currentOtherAssets;
    let projectedCVLI = currentCVLI;
    let projectedDebt = currentDebt;
    // Track account types separately for RMD calculations
    let projectedTaxDeferred = currentTaxDeferred;
    let projectedTaxFree = currentTaxFree;
    let projectedTaxable = currentTaxable;
    // Extract income data for wage growth modeling
    const userIncome = Number(profile.annualIncome) || 0;
    const spouseIncome = Number(profile.spouseAnnualIncome) || 0;
    const totalIncome = userIncome + spouseIncome;
    // Define base contribution amounts (annual)
    const baseAnnual401k = (Number(profile.monthlyContribution401k) || 0) * 12;
    const baseAnnualIRA = (Number(profile.monthlyContributionIRA) || 0) * 12;
    const baseAnnualRoth = (Number(profile.monthlyContributionRothIRA) || 0) * 12;
    const baseAnnualBrokerage = (Number(profile.monthlyContributionBrokerage) || 0) * 12;
    const totalBaseContributions = baseAnnual401k + baseAnnualIRA + baseAnnualRoth + baseAnnualBrokerage;
    // Calculate monthly debt payments first (needed for cash flow calculation)
    let monthlyDebtPayment = 0;
    let monthlyMortgagePayment = 0;
    let mortgageBalance = Number(profile.primaryResidence?.mortgageBalance) || 0;
    const mortgageRate = Number(profile.primaryResidence?.mortgageRate) || 0.045; // Default 4.5% if not specified
    if (profile.liabilities && Array.isArray(profile.liabilities)) {
        profile.liabilities.forEach((liability) => {
            monthlyDebtPayment += Number(liability.monthlyPayment) || 0;
        });
    }
    if (profile.primaryResidence?.monthlyPayment) {
        monthlyMortgagePayment = Number(profile.primaryResidence.monthlyPayment) || 0;
        monthlyDebtPayment += monthlyMortgagePayment;
    }
    const annualDebtPayment = monthlyDebtPayment * 12;
    const annualNonMortgageDebt = (monthlyDebtPayment - monthlyMortgagePayment) * 12;
    // Calculate LTC costs for projections
    const retirementAge = Number(profile.desiredRetirementAge) || 65;
    const userGender = profile.gender || 'male';
    const userHealthStatus = profile.healthStatus || 'good';
    // Setup LTC insurance info
    const ltcInsurance = profile.ltcInsurance ? {
        type: profile.ltcInsurance.type || 'none',
        dailyBenefit: Number(profile.ltcInsurance.dailyBenefit) || 0,
        benefitPeriodYears: Number(profile.ltcInsurance.benefitPeriodYears) || 0,
        eliminationPeriodDays: Number(profile.ltcInsurance.eliminationPeriodDays) || 0,
        inflationProtection: profile.ltcInsurance.inflationProtection || 'none',
        premiumAnnual: Number(profile.ltcInsurance.premiumAnnual) || 0,
        policyStartAge: currentAge
    } : {
        type: 'none',
        dailyBenefit: 0,
        benefitPeriodYears: 0,
        eliminationPeriodDays: 0,
        inflationProtection: 'none',
        premiumAnnual: 0,
        policyStartAge: currentAge
    };
    const spouseLTCInsurance = profile.spouseLtcInsurance ? {
        type: profile.spouseLtcInsurance.type || 'none',
        dailyBenefit: Number(profile.spouseLtcInsurance.dailyBenefit) || 0,
        benefitPeriodYears: Number(profile.spouseLtcInsurance.benefitPeriodYears) || 0,
        eliminationPeriodDays: Number(profile.spouseLtcInsurance.eliminationPeriodDays) || 0,
        inflationProtection: profile.spouseLtcInsurance.inflationProtection || 'none',
        premiumAnnual: Number(profile.spouseLtcInsurance.premiumAnnual) || 0,
        policyStartAge: spouseCurrentAge || currentAge
    } : {
        type: 'none',
        dailyBenefit: 0,
        benefitPeriodYears: 0,
        eliminationPeriodDays: 0,
        inflationProtection: 'none',
        premiumAnnual: 0,
        policyStartAge: spouseCurrentAge || currentAge
    };
    // Get deterministic LTC costs for all retirement years
    const ltcCostModel = (0, ltc_modeling_1.calculateDeterministicLTCCosts)(retirementAge, lifeExpectancy, userGender, userHealthStatus, ltcInsurance, spouseCurrentAge ? {
        startAge: spouseCurrentAge + (retirementAge - currentAge),
        gender: profile.spouseGender || 'female',
        healthStatus: profile.spouseHealthStatus || 'good',
        ltcInsurance: spouseLTCInsurance
    } : undefined);
    for (let year = 0; year <= yearsToProject; year++) {
        // Calculate age for this year
        const projectionAge = currentAge + year;
        const projectionSpouseAge = spouseCurrentAge ? spouseCurrentAge + year : undefined;
        // Apply investment returns
        if (year > 0) {
            // For glide path, adjust returns based on years to retirement
            let currentYearReturn = expectedReturn;
            if (useGlidePath) {
                const yearsToRetirement = Math.max(0, (Number(profile.desiredRetirementAge) || 65) - projectionAge);
                if (yearsToRetirement > 20) {
                    currentYearReturn = useNominalReturns ? 0.106 : 0.08; // 10.6% nominal / 8% real for 20+ years
                }
                else if (yearsToRetirement > 10) {
                    currentYearReturn = useNominalReturns ? 0.096 : 0.07; // 9.6% nominal / 7% real for 10-20 years
                }
                else if (yearsToRetirement > 5) {
                    currentYearReturn = useNominalReturns ? 0.086 : 0.06; // 8.6% nominal / 6% real for 5-10 years
                }
                else {
                    currentYearReturn = useNominalReturns ? 0.076 : 0.05; // 7.6% nominal / 5% real for < 5 years or in retirement
                }
            }
            // Apply returns to each account type
            projectedTaxDeferred *= (1 + currentYearReturn);
            projectedTaxFree *= (1 + currentYearReturn);
            // For taxable accounts, we'll handle dividend taxes in the retirement section
            // For now, just apply full returns
            projectedTaxable *= (1 + currentYearReturn);
            projectedRealEstate *= (1 + realEstateAppreciation);
            projectedCVLI *= (1 + cvliCreditingRate); // Apply CVLI crediting rate
            projectedOtherAssets *= (1 + inflationRate); // Conservative growth
            // Reduce debt by payments with proper mortgage amortization
            // For mortgage: calculate principal portion based on current balance
            if (mortgageBalance > 0 && monthlyMortgagePayment > 0) {
                let remainingMortgage = mortgageBalance;
                for (let month = 0; month < 12 && remainingMortgage > 0; month++) {
                    const monthlyInterest = remainingMortgage * (mortgageRate / 12);
                    const principalPayment = Math.min(monthlyMortgagePayment - monthlyInterest, remainingMortgage);
                    remainingMortgage -= principalPayment;
                }
                const mortgagePrincipalReduction = mortgageBalance - remainingMortgage;
                mortgageBalance = remainingMortgage;
                // Reduce projected debt by actual principal payments
                projectedDebt = Math.max(0, projectedDebt - mortgagePrincipalReduction - annualNonMortgageDebt);
            }
            else {
                // No mortgage, just reduce other debts
                projectedDebt = Math.max(0, projectedDebt - annualNonMortgageDebt);
            }
            const retirementAge = Number(profile.desiredRetirementAge) || 65;
            if (projectionAge < retirementAge) {
                // Pre-retirement: Add contributions with wage growth modeling
                // Apply 4% annual wage growth to maintain constant savings rate
                const wageGrowthFactor = Math.pow(1.04, year); // 4% compound annual growth
                // Calculate wage-adjusted income and expenses
                const adjustedIncome = totalIncome * wageGrowthFactor;
                const monthlyExpenses = Number(profile.monthlyExpenses) || 5000;
                const adjustedExpenses = monthlyExpenses * 12 * wageGrowthFactor; // Expenses grow with wages
                const adjustedDebtPayment = annualDebtPayment; // Debt payments typically fixed
                // Calculate surplus cash flow that can be invested
                const totalExplicitContributions = totalBaseContributions * wageGrowthFactor;
                const surplusCashFlow = Math.max(0, adjustedIncome - adjustedExpenses - adjustedDebtPayment - totalExplicitContributions);
                // Allocate surplus: 70% to 401k/IRA, 30% to taxable brokerage
                const surplusTo401k = surplusCashFlow * 0.35;
                const surplusToIRA = surplusCashFlow * 0.35;
                const surplusToBrokerage = surplusCashFlow * 0.30;
                // Calculate wage-adjusted contributions for each account type (including surplus)
                let annual401k = baseAnnual401k * wageGrowthFactor + surplusTo401k;
                let annualIRA = baseAnnualIRA * wageGrowthFactor + surplusToIRA;
                let annualRoth = baseAnnualRoth * wageGrowthFactor;
                let annualBrokerage = baseAnnualBrokerage * wageGrowthFactor + surplusToBrokerage;
                // Apply IRS contribution limits (with 2% annual growth in limits)
                const limitGrowthFactor = Math.pow(1.02, year); // IRS limits grow ~2% annually
                const max401k = 23000 * limitGrowthFactor; // 2024 limit: $23,000
                const maxIRA = 7000 * limitGrowthFactor; // 2024 limit: $7,000
                const maxRoth = 7000 * limitGrowthFactor; // 2024 limit: $7,000
                // Add catch-up contributions if age 50+
                const catchUp401k = projectionAge >= 50 ? 7500 * limitGrowthFactor : 0;
                const catchUpIRA = projectionAge >= 50 ? 1000 * limitGrowthFactor : 0;
                // Apply contribution limits
                annual401k = Math.min(annual401k, max401k + catchUp401k);
                annualIRA = Math.min(annualIRA, maxIRA + catchUpIRA);
                annualRoth = Math.min(annualRoth, maxRoth + catchUpIRA);
                // If contributions exceed limits, overflow to brokerage
                const totalDesired = (baseAnnual401k + baseAnnualIRA + baseAnnualRoth + baseAnnualBrokerage) * wageGrowthFactor;
                const totalLimited = annual401k + annualIRA + annualRoth;
                if (totalDesired > totalLimited) {
                    annualBrokerage += (totalDesired - totalLimited);
                }
                // Add to appropriate account types
                projectedTaxDeferred += annual401k + annualIRA; // Both 401k and Traditional IRA are tax-deferred
                projectedTaxFree += annualRoth; // Roth accounts are tax-free
                projectedTaxable += annualBrokerage; // Brokerage accounts are taxable
            }
            else {
                // In retirement: Handle withdrawals and RMDs with proper tax calculations
                // Debug log to check the value
                if (projectionAge === retirementAge) {
                    console.log('Retirement expenses from profile:', profile.expectedMonthlyExpensesRetirement);
                }
                let annualExpenses = (Number(profile.expectedMonthlyExpensesRetirement) || 11000) * 12; // Changed default from 5000 to 11000
                // Add expected LTC costs for this year
                const ltcCostForYear = ltcCostModel.yearlyLTCCosts.get(projectionAge) || 0;
                // LTC insurance premiums (stop at age 85 or when claim starts)
                let ltcPremiums = 0;
                if (projectionAge < 85 && ltcCostForYear === 0) {
                    if (ltcInsurance.type !== 'none') {
                        ltcPremiums += ltcInsurance.premiumAnnual;
                    }
                    if (projectionSpouseAge && projectionSpouseAge < 85 && spouseLTCInsurance.type !== 'none') {
                        ltcPremiums += spouseLTCInsurance.premiumAnnual;
                    }
                }
                // Adjust expenses: add LTC costs and premiums, but reduce base expenses when in LTC
                // (as some living expenses are replaced by LTC facility costs)
                let expenseReplacementFactor = 0;
                if (ltcCostForYear > 0) {
                    // Assume 40% of regular expenses are replaced when in LTC facility
                    expenseReplacementFactor = 0.4;
                }
                annualExpenses = annualExpenses * (1 - expenseReplacementFactor) + ltcCostForYear + ltcPremiums;
                // Calculate guaranteed income including Social Security only if eligible based on claim age
                const socialSecurityClaimAge = Number(profile.socialSecurityClaimAge) || 67;
                const spouseSocialSecurityClaimAge = Number(profile.spouseSocialSecurityClaimAge) || 67;
                const userSSBenefit = projectionAge >= socialSecurityClaimAge ?
                    (Number(profile.socialSecurityBenefit) || 0) * 12 : 0;
                const spouseSSBenefit = projectionSpouseAge && projectionSpouseAge >= spouseSocialSecurityClaimAge ?
                    (Number(profile.spouseSocialSecurityBenefit) || 0) * 12 : 0;
                const totalSSBenefit = userSSBenefit + spouseSSBenefit;
                // Calculate part-time income with decline over time (10% per year, stops at 75)
                const yearsInRetirement = projectionAge - retirementAge;
                const spouseYearsInRetirement = projectionSpouseAge ? projectionSpouseAge - (Number(profile.spouseDesiredRetirementAge) || retirementAge) : 0;
                const userPartTimeIncome = projectionAge < 75 && yearsInRetirement >= 0 ?
                    (Number(profile.partTimeIncomeRetirement) || 0) * 12 * Math.max(0, 1 - yearsInRetirement * 0.1) : 0;
                const spousePartTimeIncome = projectionSpouseAge && projectionSpouseAge < 75 && spouseYearsInRetirement >= 0 ?
                    (Number(profile.spousePartTimeIncomeRetirement) || 0) * 12 * Math.max(0, 1 - spouseYearsInRetirement * 0.1) : 0;
                const totalPartTimeIncome = userPartTimeIncome + spousePartTimeIncome;
                // Calculate pension income
                const totalPensionIncome = (Number(profile.pensionAmount) || 0) * 12 +
                    (Number(profile.spousePensionAmount) || 0) * 12;
                // Calculate annuity income for the projection year
                const annuityIncome = calculateAnnuityIncome(profile, currentYear + year);
                // Calculate RMD first as it's required
                const rmdAmount = calculateRMD(projectionAge, projectedTaxDeferred);
                // Determine filing status
                const filingStatus = (profile.maritalStatus === 'married' || profile.maritalStatus === 'partnered') ?
                    'married' : 'single';
                // Calculate other taxable income (before withdrawals)
                const otherTaxableIncome = totalPartTimeIncome + totalPensionIncome + annuityIncome + rmdAmount;
                // Calculate taxable portion of Social Security
                const taxableSSAmount = calculateTaxableSocialSecurity(totalSSBenefit, otherTaxableIncome, filingStatus);
                // Total guaranteed income (gross)
                const guaranteedIncome = totalSSBenefit + totalPartTimeIncome + totalPensionIncome + annuityIncome;
                // Calculate tax rate on current income
                const currentTaxableIncome = otherTaxableIncome + taxableSSAmount;
                const effectiveTaxRate = (0, tax_calculator_1.calculateCombinedTaxRate)(currentTaxableIncome, profile.retirementState || profile.state || 'FL', filingStatus, true, // isRetirement
                projectionAge, projectionSpouseAge);
                // Calculate after-tax guaranteed income
                const guaranteedIncomeTax = (otherTaxableIncome + taxableSSAmount) * effectiveTaxRate;
                const afterTaxGuaranteedIncome = guaranteedIncome - guaranteedIncomeTax;
                // Calculate withdrawal needed to meet expenses after taxes
                let grossWithdrawalNeeded = 0;
                if (afterTaxGuaranteedIncome < annualExpenses) {
                    // Need to withdraw enough to cover expenses after paying taxes
                    const netWithdrawalNeeded = annualExpenses - afterTaxGuaranteedIncome;
                    // Calculate proper gross withdrawal with iterative tax calculation
                    // Start with net amount and iterate to find gross that yields net after taxes
                    let grossEstimate = netWithdrawalNeeded;
                    for (let i = 0; i < 3; i++) {
                        // Calculate tax on this withdrawal amount
                        const newTaxableIncome = currentTaxableIncome + grossEstimate;
                        const newTaxRate = (0, tax_calculator_1.calculateCombinedTaxRate)(newTaxableIncome, profile.retirementState || profile.state || 'FL', filingStatus, true, projectionAge, projectionSpouseAge);
                        // Tax on the additional withdrawal
                        const withdrawalTax = grossEstimate * newTaxRate;
                        const netAfterTax = grossEstimate - withdrawalTax;
                        // Adjust estimate based on shortfall
                        if (netAfterTax < netWithdrawalNeeded) {
                            grossEstimate = netWithdrawalNeeded + withdrawalTax;
                        }
                        else {
                            break;
                        }
                    }
                    grossWithdrawalNeeded = grossEstimate;
                }
                // Ensure we withdraw at least the RMD amount (already calculated above)
                const totalWithdrawal = Math.max(grossWithdrawalNeeded, rmdAmount);
                // Tax-efficient withdrawal order:
                // 1. RMD from tax-deferred (required)
                // 2. Taxable accounts (no additional tax)
                // 3. Tax-deferred beyond RMD
                // 4. Tax-free (Roth) last
                let remainingWithdrawal = totalWithdrawal;
                // First, take RMD from tax-deferred
                if (rmdAmount > 0) {
                    projectedTaxDeferred = Math.max(0, projectedTaxDeferred - rmdAmount);
                    remainingWithdrawal -= rmdAmount;
                }
                // Then from taxable accounts
                if (remainingWithdrawal > 0 && projectedTaxable > 0) {
                    const taxableWithdrawal = Math.min(remainingWithdrawal, projectedTaxable);
                    projectedTaxable -= taxableWithdrawal;
                    remainingWithdrawal -= taxableWithdrawal;
                }
                // Then additional from tax-deferred
                if (remainingWithdrawal > 0 && projectedTaxDeferred > 0) {
                    const additionalTaxDeferred = Math.min(remainingWithdrawal, projectedTaxDeferred);
                    projectedTaxDeferred -= additionalTaxDeferred;
                    remainingWithdrawal -= additionalTaxDeferred;
                }
                // Finally from tax-free (Roth)
                if (remainingWithdrawal > 0 && projectedTaxFree > 0) {
                    const taxFreeWithdrawal = Math.min(remainingWithdrawal, projectedTaxFree);
                    projectedTaxFree -= taxFreeWithdrawal;
                    remainingWithdrawal -= taxFreeWithdrawal;
                }
            }
            // Update total savings
            projectedSavings = projectedTaxDeferred + projectedTaxFree + projectedTaxable;
        }
        // Add projection for this year
        projections.push({
            year: currentYear + year,
            age: projectionAge,
            spouseAge: projectionSpouseAge,
            savings: Math.round(projectedSavings),
            realEstate: Math.round(projectedRealEstate),
            otherAssets: Math.round(projectedOtherAssets + projectedCVLI), // Include CVLI in otherAssets for display
            debt: Math.round(projectedDebt),
            totalNetWorth: Math.round(projectedSavings + projectedRealEstate + projectedOtherAssets + projectedCVLI - projectedDebt)
        });
    }
    // Determine target year and net worth
    const targetProjection = projections[projections.length - 1];
    return {
        projections,
        currentNetWorth: Math.round(currentNetWorth),
        targetYear: targetProjection.year,
        targetNetWorth: targetProjection.totalNetWorth
    };
}
