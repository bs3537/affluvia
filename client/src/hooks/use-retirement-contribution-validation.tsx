import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getContributionLimit,
  validateContribution,
  validateCombinedContributions,
  getAgeCatchUpEligibility,
  CONTRIBUTION_LIMITS_2025
} from '@shared/retirement-contribution-limits';

export interface ContributionValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  limits: {
    employee: number;
    total: number;
    catchUpAmount: number;
  };
}

export interface UseRetirementContributionValidationProps {
  birthDate?: string;
  monthlyEmployeeContribution: number;
  monthlyEmployerContribution: number;
  assets?: Array<{ type: string; value?: number; description?: string }>;
  accountType?: string; // For specific account validation
}

export function useRetirementContributionValidation({
  birthDate,
  monthlyEmployeeContribution,
  monthlyEmployerContribution,
  assets = [],
  accountType
}: UseRetirementContributionValidationProps): ContributionValidation {
  const [validation, setValidation] = useState<ContributionValidation>({
    isValid: true,
    warnings: [],
    errors: [],
    limits: {
      employee: 0,
      total: 0,
      catchUpAmount: 0
    }
  });
  
  // Stabilize assets array to prevent infinite re-renders
  const stableAssets = useMemo(() => assets, [JSON.stringify(assets)]);

  const validateContributions = useCallback(() => {
    if (!birthDate) {
      setValidation({
        isValid: true,
        warnings: [],
        errors: [],
        limits: {
          employee: CONTRIBUTION_LIMITS_2025.standard.baseLimit,
          total: CONTRIBUTION_LIMITS_2025.standard.totalAnnualAdditionsLimit,
          catchUpAmount: 0
        }
      });
      return;
    }

    const warnings: string[] = [];
    const errors: string[] = [];
    let isValid = true;

    // Get age-based limits
    const catchUpEligibility = getAgeCatchUpEligibility(birthDate);
    const employeeLimit = CONTRIBUTION_LIMITS_2025.standard.baseLimit + catchUpEligibility.catchUpAmount;
    
    // Calculate annual amounts
    const annualEmployeeContribution = monthlyEmployeeContribution * 12;
    const annualEmployerContribution = monthlyEmployerContribution * 12;
    const totalAnnualContribution = annualEmployeeContribution + annualEmployerContribution;

    // Determine total limit based on catch-up eligibility
    let totalLimit = CONTRIBUTION_LIMITS_2025.standard.totalAnnualAdditionsLimit;
    if (catchUpEligibility.isEligibleForEnhancedCatchUp) {
      totalLimit = CONTRIBUTION_LIMITS_2025.standard.totalWithEnhancedCatchUp;
    } else if (catchUpEligibility.isEligibleForCatchUp) {
      totalLimit = CONTRIBUTION_LIMITS_2025.standard.totalWithCatchUp;
    }

    // Validate employee contribution
    if (annualEmployeeContribution > employeeLimit) {
      isValid = false;
      const excess = annualEmployeeContribution - employeeLimit;
      let errorMessage = `Your annual contribution of $${annualEmployeeContribution.toLocaleString()} exceeds the 2025 limit of $${employeeLimit.toLocaleString()} by $${excess.toLocaleString()}.`;
      
      if (catchUpEligibility.isEligibleForEnhancedCatchUp) {
        errorMessage += ` This limit includes the enhanced catch-up contribution of $${CONTRIBUTION_LIMITS_2025.standard.enhancedCatchUpLimit.toLocaleString()} for ages 60-63.`;
      } else if (catchUpEligibility.isEligibleForCatchUp) {
        errorMessage += ` This limit includes the catch-up contribution of $${CONTRIBUTION_LIMITS_2025.standard.catchUpLimit.toLocaleString()} for ages 50+.`;
      } else {
        const age = new Date().getFullYear() - new Date(birthDate).getFullYear();
        if (age < 50) {
          errorMessage += ` You'll be eligible for an additional $${CONTRIBUTION_LIMITS_2025.standard.catchUpLimit.toLocaleString()} catch-up contribution at age 50.`;
        }
      }
      
      errors.push(errorMessage);
    } else if (annualEmployeeContribution > employeeLimit * 0.9) {
      // Warning when approaching limit (90% or more)
      const remaining = employeeLimit - annualEmployeeContribution;
      warnings.push(`You're approaching the contribution limit. You have $${remaining.toLocaleString()} remaining for 2025.`);
    }

    // Validate total contributions (employee + employer)
    if (totalAnnualContribution > totalLimit) {
      isValid = false;
      const excess = totalAnnualContribution - totalLimit;
      errors.push(`Total annual contributions (employee + employer) of $${totalAnnualContribution.toLocaleString()} exceed the 2025 limit of $${totalLimit.toLocaleString()} by $${excess.toLocaleString()}.`);
    } else if (totalAnnualContribution > totalLimit * 0.9) {
      // Warning when approaching total limit
      const remaining = totalLimit - totalAnnualContribution;
      warnings.push(`You're approaching the total contribution limit. You have $${remaining.toLocaleString()} remaining for combined employee and employer contributions.`);
    }

    // Check for high employer match that might limit employee contributions
    if (annualEmployerContribution > employeeLimit) {
      warnings.push(`Your employer's contribution alone ($${annualEmployerContribution.toLocaleString()}) exceeds your employee contribution limit. This may limit your ability to contribute.`);
    }

    // Check retirement account assets for additional context
    const retirementAccounts = stableAssets.filter(asset => 
      ['401k', '403b', '457b', 'traditional-ira', 'roth-ira', 'sep-ira'].includes(asset.type.toLowerCase())
    );

    if (retirementAccounts.length > 1) {
      const accountTypes = Array.from(new Set(retirementAccounts.map(a => a.type)));
      
      // Check for multiple account types that share limits
      const has401k = accountTypes.some(t => t.toLowerCase() === '401k');
      const has403b = accountTypes.some(t => t.toLowerCase() === '403b');
      const hasTraditionalIRA = accountTypes.some(t => t.toLowerCase() === 'traditional-ira');
      const hasRothIRA = accountTypes.some(t => t.toLowerCase() === 'roth-ira');

      if (has401k && has403b) {
        warnings.push(`You have both 401(k) and 403(b) accounts. The $${employeeLimit.toLocaleString()} annual limit applies to your combined contributions to these accounts.`);
      }

      if (hasTraditionalIRA && hasRothIRA) {
        const iraLimit = getContributionLimit('traditional-ira', birthDate);
        warnings.push(`You have both Traditional and Roth IRA accounts. The $${iraLimit.toLocaleString()} annual limit applies to your combined IRA contributions.`);
      }
    }

    // Special message for enhanced catch-up eligibility
    if (catchUpEligibility.isEligibleForEnhancedCatchUp && annualEmployeeContribution <= CONTRIBUTION_LIMITS_2025.standard.baseLimit + CONTRIBUTION_LIMITS_2025.standard.catchUpLimit) {
      const additionalAmount = CONTRIBUTION_LIMITS_2025.standard.enhancedCatchUpLimit - CONTRIBUTION_LIMITS_2025.standard.catchUpLimit;
      warnings.push(`You're eligible for the enhanced catch-up contribution (ages 60-63). You can contribute an additional $${additionalAmount.toLocaleString()} beyond the standard catch-up limit.`);
    }

    setValidation({
      isValid,
      warnings,
      errors,
      limits: {
        employee: employeeLimit,
        total: totalLimit,
        catchUpAmount: catchUpEligibility.catchUpAmount
      }
    });
  }, [birthDate, monthlyEmployeeContribution, monthlyEmployerContribution, stableAssets, accountType]);

  useEffect(() => {
    validateContributions();
  }, [validateContributions]);

  return validation;
}

// Helper component for displaying validation messages
export function ContributionValidationMessage({ validation }: { validation: ContributionValidation }) {
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-2">
      {validation.errors.map((error, index) => (
        <div key={`error-${index}`} className="bg-red-900/20 border border-red-700 rounded-lg p-3">
          <p className="text-red-400 text-sm flex items-start gap-2">
            <span className="text-red-500 mt-0.5">⚠️</span>
            <span>{error}</span>
          </p>
        </div>
      ))}
      {validation.warnings.map((warning, index) => (
        <div key={`warning-${index}`} className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
          <p className="text-yellow-400 text-sm flex items-start gap-2">
            <span className="text-yellow-500 mt-0.5">ℹ️</span>
            <span>{warning}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

// Helper to format contribution limit information
export function ContributionLimitInfo({ birthDate, showDetails = false }: { birthDate?: string; showDetails?: boolean }) {
  if (!birthDate) {
    return (
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mt-2">
        <p className="text-blue-400 text-xs">
          2025 contribution limit: ${CONTRIBUTION_LIMITS_2025.standard.baseLimit.toLocaleString()}/year
        </p>
      </div>
    );
  }

  const catchUpEligibility = getAgeCatchUpEligibility(birthDate);
  const employeeLimit = CONTRIBUTION_LIMITS_2025.standard.baseLimit + catchUpEligibility.catchUpAmount;
  const age = new Date().getFullYear() - new Date(birthDate).getFullYear();

  return (
    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mt-2">
      <div className="space-y-1">
        <p className="text-blue-400 text-xs">
          2025 employee contribution limit: ${employeeLimit.toLocaleString()}/year (${(employeeLimit / 12).toFixed(0)}/month)
        </p>
        {catchUpEligibility.isEligibleForEnhancedCatchUp && (
          <p className="text-blue-300 text-xs">
            ✨ Enhanced catch-up eligible (age {age}): includes ${catchUpEligibility.catchUpAmount.toLocaleString()} catch-up
          </p>
        )}
        {catchUpEligibility.isEligibleForCatchUp && !catchUpEligibility.isEligibleForEnhancedCatchUp && (
          <p className="text-blue-300 text-xs">
            ✓ Catch-up eligible (age {age}): includes ${catchUpEligibility.catchUpAmount.toLocaleString()} catch-up
          </p>
        )}
        {!catchUpEligibility.isEligibleForCatchUp && age >= 45 && (
          <p className="text-blue-300 text-xs">
            → Catch-up eligible at age 50 (in {50 - age} years): +${CONTRIBUTION_LIMITS_2025.standard.catchUpLimit.toLocaleString()}
          </p>
        )}
        {showDetails && (
          <p className="text-blue-300 text-xs mt-2">
            Total limit (employee + employer): ${
              catchUpEligibility.isEligibleForEnhancedCatchUp
                ? CONTRIBUTION_LIMITS_2025.standard.totalWithEnhancedCatchUp.toLocaleString()
                : catchUpEligibility.isEligibleForCatchUp
                ? CONTRIBUTION_LIMITS_2025.standard.totalWithCatchUp.toLocaleString()
                : CONTRIBUTION_LIMITS_2025.standard.totalAnnualAdditionsLimit.toLocaleString()
            }/year
          </p>
        )}
      </div>
    </div>
  );
}