/**
 * Monte Carlo Validation and Data Standardization Utilities
 *
 * This module provides comprehensive validation for Monte Carlo parameters
 * and standardizes probability data units across the system.
 */
/**
 * Probability utility functions - standardizes all probability handling
 * Internal system uses 0-1 decimal, external display uses 0-100 percentage
 */
export class ProbabilityUtils {
    /**
     * Convert any probability value to standardized 0-1 decimal format
     */
    static toDecimal(value) {
        if (value > 1.0) {
            // Assume it's already a percentage (0-100), convert to decimal
            return Math.min(1.0, Math.max(0.0, value / 100));
        }
        // Already a decimal (0-1)
        return Math.min(1.0, Math.max(0.0, value));
    }
    /**
     * Convert standardized 0-1 decimal to 0-100 percentage for display
     */
    static toPercentage(decimal) {
        return Math.round(decimal * 100);
    }
    /**
     * Validate that a probability value is reasonable
     */
    static isValidProbability(value) {
        return typeof value === 'number' &&
            !isNaN(value) &&
            isFinite(value) &&
            value >= 0;
    }
    /**
     * Safely format probability for display with proper bounds checking
     */
    static formatForDisplay(value) {
        const decimal = this.toDecimal(value);
        const percentage = this.toPercentage(decimal);
        return `${percentage}%`;
    }
}
/**
 * Comprehensive validation for Monte Carlo parameters
 */
export class MonteCarloValidator {
    /**
     * Validate all required parameters for Monte Carlo simulation
     */
    static validateParameters(params) {
        const errors = [];
        const warnings = [];
        // Basic demographic validation
        this.validateDemographics(params, errors, warnings);
        // Financial parameters validation
        this.validateFinancialParameters(params, errors, warnings);
        // Retirement expenses validation
        this.validateExpenses(params, errors, warnings);
        // Asset allocation validation
        this.validateAssetAllocation(params, errors, warnings);
        // Market assumptions validation
        this.validateMarketAssumptions(params, errors, warnings);
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Validate demographic parameters
     */
    static validateDemographics(params, errors, warnings) {
        // Age validation
        if (!params.currentAge || params.currentAge < 18 || params.currentAge > 100) {
            errors.push({
                field: 'currentAge',
                message: 'Current age must be between 18 and 100',
                severity: 'error'
            });
        }
        if (!params.retirementAge || params.retirementAge < 50 || params.retirementAge > 80) {
            errors.push({
                field: 'retirementAge',
                message: 'Retirement age must be between 50 and 80',
                severity: 'error'
            });
        }
        if (params.currentAge && params.retirementAge && params.currentAge >= params.retirementAge) {
            warnings.push({
                field: 'retirementAge',
                message: 'Retirement age should be greater than current age',
                severity: 'warning'
            });
        }
        if (!params.lifeExpectancy || params.lifeExpectancy < 70 || params.lifeExpectancy > 120) {
            errors.push({
                field: 'lifeExpectancy',
                message: 'Life expectancy must be between 70 and 120',
                severity: 'error'
            });
        }
        // Spouse validation if married
        if (params.spouseAge !== undefined) {
            if (params.spouseAge < 18 || params.spouseAge > 100) {
                errors.push({
                    field: 'spouseAge',
                    message: 'Spouse age must be between 18 and 100',
                    severity: 'error'
                });
            }
            if (!params.spouseLifeExpectancy || params.spouseLifeExpectancy < 70 || params.spouseLifeExpectancy > 120) {
                errors.push({
                    field: 'spouseLifeExpectancy',
                    message: 'Spouse life expectancy must be between 70 and 120',
                    severity: 'error'
                });
            }
        }
    }
    /**
     * Validate financial parameters
     */
    static validateFinancialParameters(params, errors, warnings) {
        // Asset validation
        if (!params.currentRetirementAssets || params.currentRetirementAssets < 0) {
            errors.push({
                field: 'currentRetirementAssets',
                message: 'Current retirement assets must be a positive number',
                severity: 'error'
            });
        }
        // Minimum asset threshold check
        if (params.currentRetirementAssets && params.currentRetirementAssets < 10000) {
            warnings.push({
                field: 'currentRetirementAssets',
                message: 'Very low retirement assets may result in unreliable projections',
                severity: 'warning'
            });
        }
        // Guaranteed income validation
        if (params.annualGuaranteedIncome < 0) {
            errors.push({
                field: 'annualGuaranteedIncome',
                message: 'Annual guaranteed income cannot be negative',
                severity: 'error'
            });
        }
        // Annual savings validation
        if (params.annualSavings < 0) {
            errors.push({
                field: 'annualSavings',
                message: 'Annual savings cannot be negative',
                severity: 'error'
            });
        }
        // Social Security validation
        if (params.socialSecurityBenefit !== undefined && params.socialSecurityBenefit < 0) {
            errors.push({
                field: 'socialSecurityBenefit',
                message: 'Social Security benefit cannot be negative',
                severity: 'error'
            });
        }
        if (params.socialSecurityClaimAge !== undefined &&
            (params.socialSecurityClaimAge < 62 || params.socialSecurityClaimAge > 70)) {
            errors.push({
                field: 'socialSecurityClaimAge',
                message: 'Social Security claiming age must be between 62 and 70',
                severity: 'error'
            });
        }
    }
    /**
     * Validate expense parameters
     */
    static validateExpenses(params, errors, warnings) {
        if (!params.annualRetirementExpenses || params.annualRetirementExpenses <= 0) {
            errors.push({
                field: 'annualRetirementExpenses',
                message: 'Annual retirement expenses must be greater than zero',
                severity: 'error'
            });
        }
        // Reasonableness check - expenses should be at least $20K annually
        if (params.annualRetirementExpenses && params.annualRetirementExpenses < 20000) {
            warnings.push({
                field: 'annualRetirementExpenses',
                message: 'Annual expenses below $20,000 may be unrealistically low',
                severity: 'warning'
            });
        }
        // Healthcare costs validation
        if (params.annualHealthcareCosts !== undefined && params.annualHealthcareCosts < 0) {
            errors.push({
                field: 'annualHealthcareCosts',
                message: 'Healthcare costs cannot be negative',
                severity: 'error'
            });
        }
        // Healthcare inflation rate validation
        if (params.healthcareInflationRate !== undefined &&
            (params.healthcareInflationRate < 0 || params.healthcareInflationRate > 0.15)) {
            warnings.push({
                field: 'healthcareInflationRate',
                message: 'Healthcare inflation rate should be between 0% and 15%',
                severity: 'warning'
            });
        }
    }
    /**
     * Validate asset allocation parameters
     */
    static validateAssetAllocation(params, errors, warnings) {
        // Stock allocation validation
        if (params.stockAllocation < 0 || params.stockAllocation > 1) {
            errors.push({
                field: 'stockAllocation',
                message: 'Stock allocation must be between 0 and 1',
                severity: 'error'
            });
        }
        // Bond allocation validation
        if (params.bondAllocation < 0 || params.bondAllocation > 1) {
            errors.push({
                field: 'bondAllocation',
                message: 'Bond allocation must be between 0 and 1',
                severity: 'error'
            });
        }
        // Cash allocation validation
        if (params.cashAllocation < 0 || params.cashAllocation > 1) {
            errors.push({
                field: 'cashAllocation',
                message: 'Cash allocation must be between 0 and 1',
                severity: 'error'
            });
        }
        // Total allocation should sum to approximately 1.0
        const totalAllocation = params.stockAllocation + params.bondAllocation + params.cashAllocation;
        if (Math.abs(totalAllocation - 1.0) > 0.01) {
            errors.push({
                field: 'assetAllocation',
                message: `Asset allocations must sum to 100% (currently ${(totalAllocation * 100).toFixed(1)}%)`,
                severity: 'error'
            });
        }
        // Reasonableness checks
        if (params.stockAllocation > 0.95) {
            warnings.push({
                field: 'stockAllocation',
                message: 'Very high stock allocation (>95%) increases volatility risk',
                severity: 'warning'
            });
        }
        if (params.cashAllocation > 0.3) {
            warnings.push({
                field: 'cashAllocation',
                message: 'High cash allocation (>30%) may limit growth potential',
                severity: 'warning'
            });
        }
    }
    /**
     * Validate market assumption parameters
     */
    static validateMarketAssumptions(params, errors, warnings) {
        // Expected return validation
        if (!params.expectedReturn || params.expectedReturn < -0.1 || params.expectedReturn > 0.2) {
            errors.push({
                field: 'expectedReturn',
                message: 'Expected return must be between -10% and 20%',
                severity: 'error'
            });
        }
        // Return volatility validation
        if (!params.returnVolatility || params.returnVolatility < 0 || params.returnVolatility > 0.5) {
            errors.push({
                field: 'returnVolatility',
                message: 'Return volatility must be between 0% and 50%',
                severity: 'error'
            });
        }
        // Inflation rate validation
        if (!params.inflationRate || params.inflationRate < -0.05 || params.inflationRate > 0.15) {
            errors.push({
                field: 'inflationRate',
                message: 'Inflation rate must be between -5% and 15%',
                severity: 'error'
            });
        }
        // Tax rate validation - allow 0% tax rate for legitimate low-income scenarios
        if (params.taxRate === undefined || params.taxRate === null || params.taxRate < 0 || params.taxRate > 0.6) {
            errors.push({
                field: 'taxRate',
                message: 'Tax rate must be between 0% and 60%',
                severity: 'error'
            });
        }
        // Withdrawal rate validation
        if (!params.withdrawalRate || params.withdrawalRate < 0.01 || params.withdrawalRate > 0.15) {
            errors.push({
                field: 'withdrawalRate',
                message: 'Withdrawal rate must be between 1% and 15%',
                severity: 'error'
            });
        }
        // Reasonableness warnings
        if (params.expectedReturn && params.expectedReturn < 0.03) {
            warnings.push({
                field: 'expectedReturn',
                message: 'Very low expected return (<3%) may be overly conservative',
                severity: 'warning'
            });
        }
        if (params.withdrawalRate && params.withdrawalRate > 0.05) {
            warnings.push({
                field: 'withdrawalRate',
                message: 'High withdrawal rate (>5%) increases sequence risk',
                severity: 'warning'
            });
        }
    }
    /**
     * Check for critical missing parameters that would prevent Monte Carlo simulation
     */
    static checkRequiredParameters(params) {
        const missing = [];
        if (!params.currentAge)
            missing.push('currentAge');
        if (!params.retirementAge)
            missing.push('retirementAge');
        if (!params.lifeExpectancy)
            missing.push('lifeExpectancy');
        if (params.currentRetirementAssets === undefined || params.currentRetirementAssets === null)
            missing.push('currentRetirementAssets');
        if (params.annualRetirementExpenses === undefined || params.annualRetirementExpenses === null)
            missing.push('annualRetirementExpenses');
        if (!params.expectedReturn)
            missing.push('expectedReturn');
        if (!params.returnVolatility)
            missing.push('returnVolatility');
        if (!params.inflationRate)
            missing.push('inflationRate');
        if (params.taxRate === undefined || params.taxRate === null)
            missing.push('taxRate');
        if (!params.withdrawalRate)
            missing.push('withdrawalRate');
        if (params.stockAllocation === undefined || params.stockAllocation === null)
            missing.push('stockAllocation');
        if (params.bondAllocation === undefined || params.bondAllocation === null)
            missing.push('bondAllocation');
        return missing;
    }
    /**
     * Generate a detailed validation report
     */
    static generateValidationReport(result) {
        let report = '=== Monte Carlo Parameter Validation Report ===\n\n';
        if (result.isValid) {
            report += '✅ All parameters are valid\n';
        }
        else {
            report += `❌ Validation failed with ${result.errors.length} error(s)\n`;
        }
        if (result.errors.length > 0) {
            report += '\n🚨 ERRORS (must be fixed):\n';
            result.errors.forEach(error => {
                report += `  • ${error.field}: ${error.message}\n`;
            });
        }
        if (result.warnings.length > 0) {
            report += '\n⚠️  WARNINGS (should be reviewed):\n';
            result.warnings.forEach(warning => {
                report += `  • ${warning.field}: ${warning.message}\n`;
            });
        }
        return report;
    }
}
/**
 * Safe parameter extraction from user profile data
 */
export class ParameterExtractor {
    /**
     * Safely extract and validate a numeric parameter
     */
    static extractNumber(value, fieldName, defaultValue) {
        if (value === undefined || value === null || value === '') {
            return defaultValue;
        }
        const parsed = Number(value);
        if (isNaN(parsed) || !isFinite(parsed)) {
            console.warn(`Invalid numeric value for ${fieldName}: ${value}`);
            return defaultValue;
        }
        return parsed;
    }
    /**
     * Safely extract a probability value and standardize to 0-1 decimal
     */
    static extractProbability(value, fieldName, defaultValue) {
        const numericValue = this.extractNumber(value, fieldName, defaultValue);
        return numericValue !== undefined ? ProbabilityUtils.toDecimal(numericValue) : undefined;
    }
    /**
     * Extract boolean parameter with proper type checking
     */
    static extractBoolean(value, defaultValue = false) {
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true' || value === '1';
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        return defaultValue;
    }
    /**
     * Extract string parameter with proper validation
     */
    static extractString(value, allowedValues, defaultValue) {
        if (typeof value !== 'string' || value.trim() === '') {
            return defaultValue;
        }
        const trimmed = value.trim();
        if (allowedValues && !allowedValues.includes(trimmed)) {
            console.warn(`Invalid value for field: ${value}. Allowed: ${allowedValues.join(', ')}`);
            return defaultValue;
        }
        return trimmed;
    }
}
