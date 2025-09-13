// State and Federal Tax Calculator for Retirement Planning
// Tax rates and brackets are based on 2024 tax year
// 2024 Federal Tax Brackets
const FEDERAL_TAX_BRACKETS_2024 = {
    single: [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 }
    ],
    married: [
        { min: 0, max: 23200, rate: 0.10 },
        { min: 23200, max: 94300, rate: 0.12 },
        { min: 94300, max: 201050, rate: 0.22 },
        { min: 201050, max: 383900, rate: 0.24 },
        { min: 383900, max: 487450, rate: 0.32 },
        { min: 487450, max: 731200, rate: 0.35 },
        { min: 731200, max: Infinity, rate: 0.37 }
    ]
};
// 2024 Federal Standard Deductions
const FEDERAL_STANDARD_DEDUCTION_2024 = {
    single: 14600,
    married: 29200,
    // Additional standard deduction for seniors (65+)
    seniorAddition: {
        single: 1950,
        married: 1550 // per person
    }
};
// State Tax Information (2024 rates)
const STATE_TAX_INFO = {
    // No Income Tax States
    'AK': { name: 'Alaska', hasIncomeTax: false, brackets: { single: [], married: [] } },
    'FL': { name: 'Florida', hasIncomeTax: false, brackets: { single: [], married: [] } },
    'NV': { name: 'Nevada', hasIncomeTax: false, brackets: { single: [], married: [] } },
    'NH': { name: 'New Hampshire', hasIncomeTax: false, brackets: { single: [], married: [] } }, // Only taxes interest & dividends
    'SD': { name: 'South Dakota', hasIncomeTax: false, brackets: { single: [], married: [] } },
    'TN': { name: 'Tennessee', hasIncomeTax: false, brackets: { single: [], married: [] } },
    'TX': { name: 'Texas', hasIncomeTax: false, brackets: { single: [], married: [] } },
    'WA': { name: 'Washington', hasIncomeTax: false, brackets: { single: [], married: [] } }, // Has capital gains tax for high earners
    'WY': { name: 'Wyoming', hasIncomeTax: false, brackets: { single: [], married: [] } },
    // States with Income Tax (Progressive Brackets)
    'CA': {
        name: 'California',
        hasIncomeTax: true,
        brackets: {
            single: [
                { min: 0, max: 10099, rate: 0.01 },
                { min: 10099, max: 23942, rate: 0.02 },
                { min: 23942, max: 37788, rate: 0.04 },
                { min: 37788, max: 52455, rate: 0.06 },
                { min: 52455, max: 66295, rate: 0.08 },
                { min: 66295, max: 338639, rate: 0.093 },
                { min: 338639, max: 406364, rate: 0.103 },
                { min: 406364, max: 677275, rate: 0.113 },
                { min: 677275, max: Infinity, rate: 0.123 }
            ],
            married: [
                { min: 0, max: 20198, rate: 0.01 },
                { min: 20198, max: 47884, rate: 0.02 },
                { min: 47884, max: 75576, rate: 0.04 },
                { min: 75576, max: 104910, rate: 0.06 },
                { min: 104910, max: 132590, rate: 0.08 },
                { min: 132590, max: 677278, rate: 0.093 },
                { min: 677278, max: 812728, rate: 0.103 },
                { min: 812728, max: 1354550, rate: 0.113 },
                { min: 1354550, max: Infinity, rate: 0.123 }
            ]
        },
        standardDeduction: { single: 5202, married: 10404 },
        socialSecurityTaxed: false
    },
    'NY': {
        name: 'New York',
        hasIncomeTax: true,
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
        standardDeduction: { single: 8000, married: 16050 },
        socialSecurityTaxed: false,
        pensionExclusion: 20000 // NY excludes up to $20k of pension/retirement income
    },
    'IL': {
        name: 'Illinois',
        hasIncomeTax: true,
        brackets: {
            single: [{ min: 0, max: Infinity, rate: 0.0495 }], // Flat tax
            married: [{ min: 0, max: Infinity, rate: 0.0495 }]
        },
        personalExemption: 2425,
        socialSecurityTaxed: false,
        pensionExclusion: Infinity // Illinois doesn't tax retirement income!
    },
    'PA': {
        name: 'Pennsylvania',
        hasIncomeTax: true,
        brackets: {
            single: [{ min: 0, max: Infinity, rate: 0.0307 }], // Flat tax
            married: [{ min: 0, max: Infinity, rate: 0.0307 }]
        },
        socialSecurityTaxed: false,
        pensionExclusion: Infinity // PA doesn't tax retirement income!
    },
    'NC': {
        name: 'North Carolina',
        hasIncomeTax: true,
        brackets: {
            single: [{ min: 0, max: Infinity, rate: 0.0475 }], // Flat tax
            married: [{ min: 0, max: Infinity, rate: 0.0475 }]
        },
        standardDeduction: { single: 12750, married: 25500 },
        socialSecurityTaxed: false
    },
    'GA': {
        name: 'Georgia',
        hasIncomeTax: true,
        brackets: {
            single: [
                { min: 0, max: 750, rate: 0.01 },
                { min: 750, max: 2250, rate: 0.02 },
                { min: 2250, max: 3750, rate: 0.03 },
                { min: 3750, max: 5250, rate: 0.04 },
                { min: 5250, max: 7000, rate: 0.05 },
                { min: 7000, max: Infinity, rate: 0.0575 }
            ],
            married: [
                { min: 0, max: 1000, rate: 0.01 },
                { min: 1000, max: 3000, rate: 0.02 },
                { min: 3000, max: 5000, rate: 0.03 },
                { min: 5000, max: 7000, rate: 0.04 },
                { min: 7000, max: 10000, rate: 0.05 },
                { min: 10000, max: Infinity, rate: 0.0575 }
            ]
        },
        standardDeduction: { single: 5400, married: 7100 },
        personalExemption: 3700,
        seniorExemption: 1300, // Additional for 65+
        socialSecurityTaxed: false,
        pensionExclusion: 65000 // For 65+
    },
    'AZ': {
        name: 'Arizona',
        hasIncomeTax: true,
        brackets: {
            single: [
                { min: 0, max: 28653, rate: 0.025 },
                { min: 28653, max: 57305, rate: 0.035 },
                { min: 57305, max: Infinity, rate: 0.045 }
            ],
            married: [
                { min: 0, max: 57305, rate: 0.025 },
                { min: 57305, max: 114610, rate: 0.035 },
                { min: 114610, max: Infinity, rate: 0.045 }
            ]
        },
        standardDeduction: { single: 13850, married: 27700 },
        socialSecurityTaxed: false
    },
    'CO': {
        name: 'Colorado',
        hasIncomeTax: true,
        brackets: {
            single: [{ min: 0, max: Infinity, rate: 0.044 }], // Flat tax
            married: [{ min: 0, max: Infinity, rate: 0.044 }]
        },
        standardDeduction: { single: 14600, married: 29200 }, // Same as federal
        socialSecurityTaxed: false,
        pensionExclusion: 24000 // For 65+
    },
    'VA': {
        name: 'Virginia',
        hasIncomeTax: true,
        brackets: {
            single: [
                { min: 0, max: 3000, rate: 0.02 },
                { min: 3000, max: 5000, rate: 0.03 },
                { min: 5000, max: 17000, rate: 0.05 },
                { min: 17000, max: Infinity, rate: 0.0575 }
            ],
            married: [
                { min: 0, max: 3000, rate: 0.02 },
                { min: 3000, max: 5000, rate: 0.03 },
                { min: 5000, max: 17000, rate: 0.05 },
                { min: 17000, max: Infinity, rate: 0.0575 }
            ]
        },
        standardDeduction: { single: 8000, married: 16000 },
        socialSecurityTaxed: false,
        seniorExemption: 12000 // Age deduction for 65+
    },
    'OH': {
        name: 'Ohio',
        hasIncomeTax: true,
        brackets: {
            single: [
                { min: 0, max: 26050, rate: 0 },
                { min: 26050, max: 46100, rate: 0.02765 },
                { min: 46100, max: 92150, rate: 0.03226 },
                { min: 92150, max: 115300, rate: 0.03688 },
                { min: 115300, max: Infinity, rate: 0.0399 }
            ],
            married: [
                { min: 0, max: 26050, rate: 0 },
                { min: 26050, max: 46100, rate: 0.02765 },
                { min: 46100, max: 92150, rate: 0.03226 },
                { min: 92150, max: 115300, rate: 0.03688 },
                { min: 115300, max: Infinity, rate: 0.0399 }
            ]
        },
        personalExemption: 2400,
        socialSecurityTaxed: false
    },
    'NJ': {
        name: 'New Jersey',
        hasIncomeTax: true,
        brackets: {
            single: [
                { min: 0, max: 20000, rate: 0.014 },
                { min: 20000, max: 35000, rate: 0.0175 },
                { min: 35000, max: 40000, rate: 0.035 },
                { min: 40000, max: 75000, rate: 0.05525 },
                { min: 75000, max: 125000, rate: 0.0637 },
                { min: 125000, max: 500000, rate: 0.0897 },
                { min: 500000, max: 1000000, rate: 0.1075 },
                { min: 1000000, max: Infinity, rate: 0.1175 }
            ],
            married: [
                { min: 0, max: 20000, rate: 0.014 },
                { min: 20000, max: 50000, rate: 0.0175 },
                { min: 50000, max: 70000, rate: 0.0245 },
                { min: 70000, max: 80000, rate: 0.035 },
                { min: 80000, max: 150000, rate: 0.05525 },
                { min: 150000, max: 250000, rate: 0.0637 },
                { min: 250000, max: 500000, rate: 0.0897 },
                { min: 500000, max: 1000000, rate: 0.1075 },
                { min: 1000000, max: Infinity, rate: 0.1175 }
            ]
        },
        personalExemption: 1000,
        socialSecurityTaxed: false,
        pensionExclusion: 100000 // For retirement income over 62
    }
};
// Calculate tax for a given income and brackets
function calculateProgressiveTax(income, brackets) {
    let tax = 0;
    for (const bracket of brackets) {
        if (income <= bracket.min)
            break;
        const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
        tax += taxableInBracket * bracket.rate;
    }
    return tax;
}
// Main function to calculate combined federal and state tax rate
export function calculateCombinedTaxRate(annualIncome, retirementState, filingStatus, isRetired = true, age = 65, spouseAge) {
    // Handle invalid state codes
    const stateInfo = STATE_TAX_INFO[retirementState?.toUpperCase()] || STATE_TAX_INFO['TX']; // Default to TX (no tax)
    // Federal tax calculation
    const federalBrackets = FEDERAL_TAX_BRACKETS_2024[filingStatus];
    let federalStandardDeduction = FEDERAL_STANDARD_DEDUCTION_2024[filingStatus];
    // Add senior standard deduction if applicable
    if (age >= 65) {
        federalStandardDeduction += FEDERAL_STANDARD_DEDUCTION_2024.seniorAddition[filingStatus];
        if (filingStatus === 'married' && spouseAge && spouseAge >= 65) {
            federalStandardDeduction += FEDERAL_STANDARD_DEDUCTION_2024.seniorAddition.married;
        }
    }
    const federalTaxableIncome = Math.max(0, annualIncome - federalStandardDeduction);
    const federalTax = calculateProgressiveTax(federalTaxableIncome, federalBrackets);
    // State tax calculation
    let stateTax = 0;
    if (stateInfo.hasIncomeTax) {
        let stateTaxableIncome = annualIncome;
        // Apply state standard deduction if available
        if (stateInfo.standardDeduction) {
            stateTaxableIncome -= stateInfo.standardDeduction[filingStatus];
        }
        // Apply personal exemptions
        if (stateInfo.personalExemption) {
            stateTaxableIncome -= stateInfo.personalExemption;
            if (filingStatus === 'married') {
                stateTaxableIncome -= stateInfo.personalExemption; // Second exemption for spouse
            }
        }
        // Apply senior exemptions
        if (stateInfo.seniorExemption && age >= 65) {
            stateTaxableIncome -= stateInfo.seniorExemption;
            if (filingStatus === 'married' && spouseAge && spouseAge >= 65) {
                stateTaxableIncome -= stateInfo.seniorExemption;
            }
        }
        // Apply pension exclusions for retirees
        if (isRetired && stateInfo.pensionExclusion) {
            if (stateInfo.pensionExclusion === Infinity) {
                // States like IL and PA don't tax retirement income at all
                stateTaxableIncome = 0;
            }
            else {
                // Partial exclusion
                stateTaxableIncome = Math.max(0, stateTaxableIncome - stateInfo.pensionExclusion);
            }
        }
        stateTaxableIncome = Math.max(0, stateTaxableIncome);
        const stateBrackets = stateInfo.brackets[filingStatus];
        stateTax = calculateProgressiveTax(stateTaxableIncome, stateBrackets);
    }
    // Calculate effective tax rate
    const totalTax = federalTax + stateTax;
    const effectiveTaxRate = annualIncome > 0 ? totalTax / annualIncome : 0;
    // Log calculation details for debugging
    // console.log(`=== TAX CALCULATION for ${retirementState} ===`);
    // console.log(`Annual Income: $${annualIncome.toLocaleString()}`);
    // console.log(`Filing Status: ${filingStatus}`);
    // console.log(`Age: ${age}${spouseAge ? `, Spouse Age: ${spouseAge}` : ''}`);
    // console.log(`Federal Tax: $${federalTax.toFixed(0)} (${((federalTax/annualIncome)*100).toFixed(1)}%)`);
    // console.log(`State Tax: $${stateTax.toFixed(0)} (${((stateTax/annualIncome)*100).toFixed(1)}%)`);
    // console.log(`Total Tax: $${totalTax.toFixed(0)}`);
    // console.log(`Effective Tax Rate: ${(effectiveTaxRate * 100).toFixed(1)}%`);
    // console.log(`=== END TAX CALCULATION ===`);
    return effectiveTaxRate;
}
// Helper function to get tax-friendly states for retirees
export function getTaxFriendlyStates() {
    const taxFriendlyStates = [];
    for (const [code, info] of Object.entries(STATE_TAX_INFO)) {
        if (!info.hasIncomeTax || info.pensionExclusion === Infinity) {
            taxFriendlyStates.push(code);
        }
    }
    return taxFriendlyStates;
}
// Helper to estimate tax savings by moving states
export function compareStateTaxes(annualIncome, currentState, proposedState, filingStatus, age = 65, spouseAge) {
    const currentRate = calculateCombinedTaxRate(annualIncome, currentState, filingStatus, true, age, spouseAge);
    const proposedRate = calculateCombinedTaxRate(annualIncome, proposedState, filingStatus, true, age, spouseAge);
    const currentTax = annualIncome * currentRate;
    const proposedTax = annualIncome * proposedRate;
    const annualSavings = currentTax - proposedTax;
    return { currentTax, proposedTax, annualSavings };
}
// Calculate capital gains tax based on income level and filing status
export function calculateCapitalGainsTax(capitalGainsIncome, totalTaxableIncome, filingStatus) {
    if (capitalGainsIncome <= 0)
        return 0;
    // 2024 Long-term capital gains tax brackets
    const brackets = filingStatus === 'married' ? {
        zeroRate: 94050, // 0% rate up to this amount
        fifteenRate: 583750 // 15% rate up to this amount, 20% above
    } : {
        zeroRate: 47025, // 0% rate up to this amount
        fifteenRate: 518900 // 15% rate up to this amount, 20% above
    };
    let tax = 0;
    // Calculate tax based on total income including capital gains
    if (totalTaxableIncome <= brackets.zeroRate) {
        // All gains taxed at 0%
        tax = 0;
    }
    else if (totalTaxableIncome <= brackets.fifteenRate) {
        // Some gains may be at 0%, rest at 15%
        const incomeWithoutGains = totalTaxableIncome - capitalGainsIncome;
        if (incomeWithoutGains < brackets.zeroRate) {
            const gainsAt0Rate = brackets.zeroRate - incomeWithoutGains;
            const gainsAt15Rate = capitalGainsIncome - gainsAt0Rate;
            tax = gainsAt15Rate * 0.15;
        }
        else {
            // All gains at 15%
            tax = capitalGainsIncome * 0.15;
        }
    }
    else {
        // Some gains may be at 15%, rest at 20%
        const incomeWithoutGains = totalTaxableIncome - capitalGainsIncome;
        if (incomeWithoutGains < brackets.fifteenRate) {
            const gainsAt15Rate = brackets.fifteenRate - incomeWithoutGains;
            const gainsAt20Rate = capitalGainsIncome - gainsAt15Rate;
            tax = gainsAt15Rate * 0.15 + gainsAt20Rate * 0.20;
        }
        else {
            // All gains at 20%
            tax = capitalGainsIncome * 0.20;
        }
    }
    // Add Net Investment Income Tax (3.8%) for high earners
    const niitThreshold = filingStatus === 'married' ? 250000 : 200000;
    if (totalTaxableIncome > niitThreshold) {
        const niitIncome = Math.min(capitalGainsIncome, totalTaxableIncome - niitThreshold);
        tax += niitIncome * 0.038;
    }
    return tax;
}
