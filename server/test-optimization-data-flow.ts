import { runRightCapitalStyleMonteCarloSimulation } from './monte-carlo-enhanced';
import { profileToRetirementParams } from './monte-carlo-base';
import { calculateAIME, calculatePIA as calculatePrimaryInsuranceAmount, adjustPIAForClaimAge as calculateBenefitAtAge } from './social-security-calculator';

// Test scenarios to verify data flow between intake form and optimization
const testScenarios = [
  {
    name: "Single person with Social Security and 401k",
    profile: {
      maritalStatus: 'single',
      dateOfBirth: '1960-01-01',
      annualIncome: 100000,
      desiredRetirementAge: 65,
      socialSecurityClaimAge: 67,
      socialSecurityBenefit: 2500, // Monthly benefit from intake
      pensionBenefit: 0,
      partTimeIncomeRetirement: 0,
      expectedMonthlyExpensesRetirement: 6000,
      retirementContributions: { employee: 500, employer: 250 }, // Monthly
      traditionalIRAContribution: 7000, // Annual
      rothIRAContribution: 0,
      hasLongTermCareInsurance: false,
      assets: [
        { type: '401k', value: 500000, owner: 'user' },
        { type: 'taxable-brokerage', value: 100000, owner: 'user' }
      ]
    },
    optimizationVariables: {
      retirementAge: 67,
      socialSecurityAge: 70, // Delay to maximize benefits
      monthlyEmployee401k: 1000, // Increase contributions
      monthlyEmployer401k: 500,
      annualTraditionalIRA: 8000,
      annualRothIRA: 0,
      monthlyExpenses: 5500, // Reduce expenses
      partTimeIncome: 1000, // Add part-time work
      hasLongTermCareInsurance: true, // Add LTC insurance
      assetAllocation: '6.1' // 6.1% return (Moderate)
    }
  },
  {
    name: "Married couple with dual incomes and benefits",
    profile: {
      maritalStatus: 'married',
      dateOfBirth: '1965-01-01',
      spouseDateOfBirth: '1967-01-01',
      annualIncome: 120000,
      spouseAnnualIncome: 80000,
      desiredRetirementAge: 65,
      spouseDesiredRetirementAge: 65,
      socialSecurityClaimAge: 67,
      spouseSocialSecurityClaimAge: 67,
      socialSecurityBenefit: 2800,
      spouseSocialSecurityBenefit: 2000,
      pensionBenefit: 1500,
      spousePensionBenefit: 0,
      partTimeIncomeRetirement: 0,
      spousePartTimeIncomeRetirement: 0,
      expectedMonthlyExpensesRetirement: 8000,
      retirementContributions: { employee: 800, employer: 400 },
      spouseRetirementContributions: { employee: 600, employer: 300 },
      traditionalIRAContribution: 7000,
      rothIRAContribution: 0,
      spouseTraditionalIRAContribution: 7000,
      spouseRothIRAContribution: 0,
      hasLongTermCareInsurance: false,
      assets: [
        { type: '401k', value: 600000, owner: 'user' },
        { type: '401k', value: 400000, owner: 'spouse' },
        { type: 'traditional-ira', value: 150000, owner: 'joint' },
        { type: 'taxable-brokerage', value: 200000, owner: 'joint' }
      ]
    },
    optimizationVariables: {
      retirementAge: 67,
      spouseRetirementAge: 65,
      socialSecurityAge: 70,
      spouseSocialSecurityAge: 67,
      monthlyEmployee401k: 1200,
      monthlyEmployer401k: 600,
      annualTraditionalIRA: 8000,
      annualRothIRA: 0,
      spouseMonthlyEmployee401k: 800,
      spouseMonthlyEmployer401k: 400,
      spouseAnnualTraditionalIRA: 8000,
      spouseAnnualRothIRA: 0,
      monthlyExpenses: 7500,
      partTimeIncome: 1500,
      spousePartTimeIncome: 1000,
      hasLongTermCareInsurance: true,
      assetAllocation: '6.6', // 6.6% return (Moderately Aggressive)
      spouseAssetAllocation: '5.6' // 5.6% return (Moderately Conservative)
    }
  },
  {
    name: "Early retiree with pension and no Social Security delay",
    profile: {
      maritalStatus: 'single',
      dateOfBirth: '1965-01-01',
      annualIncome: 150000,
      desiredRetirementAge: 62,
      socialSecurityClaimAge: 62, // Claim early
      socialSecurityBenefit: 1800, // Reduced benefit
      pensionBenefit: 3000, // Strong pension
      partTimeIncomeRetirement: 0,
      expectedMonthlyExpensesRetirement: 7000,
      retirementContributions: { employee: 1500, employer: 750 },
      traditionalIRAContribution: 7000,
      rothIRAContribution: 7000, // Max out both
      hasLongTermCareInsurance: true,
      assets: [
        { type: '401k', value: 800000, owner: 'user' },
        { type: 'roth-ira', value: 200000, owner: 'user' },
        { type: 'taxable-brokerage', value: 300000, owner: 'user' }
      ]
    },
    optimizationVariables: {
      retirementAge: 62,
      socialSecurityAge: 62, // Keep early claim
      monthlyEmployee401k: 1875, // Max out 401k
      monthlyEmployer401k: 937,
      annualTraditionalIRA: 8000,
      annualRothIRA: 8000,
      monthlyExpenses: 6500,
      partTimeIncome: 2000, // Significant part-time income
      hasLongTermCareInsurance: true,
      assetAllocation: '7' // 7% return (Aggressive)
    }
  }
];

async function testOptimizationDataFlow() {
  console.log('=== TESTING OPTIMIZATION DATA FLOW ===\n');
  
  for (const scenario of testScenarios) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SCENARIO: ${scenario.name}`);
    console.log('='.repeat(60));
    
    // 1. Calculate baseline Monte Carlo (intake form data)
    console.log('\n--- BASELINE (Intake Form Data) ---');
    const baselineParams = profileToRetirementParams(scenario.profile);
    
    console.log('Baseline Parameters:');
    console.log('  Annual Guaranteed Income: $', baselineParams.annualGuaranteedIncome.toLocaleString());
    console.log('    - Social Security: $', ((scenario.profile.socialSecurityBenefit || 0) * 12).toLocaleString());
    if (scenario.profile.maritalStatus === 'married') {
      console.log('    - Spouse SS: $', ((scenario.profile.spouseSocialSecurityBenefit || 0) * 12).toLocaleString());
    }
    console.log('    - Pension: $', ((scenario.profile.pensionBenefit || 0) * 12).toLocaleString());
    console.log('  Annual Expenses: $', baselineParams.annualRetirementExpenses.toLocaleString());
    console.log('  Current Assets: $', baselineParams.currentRetirementAssets.toLocaleString());
    console.log('  Annual Savings: $', baselineParams.annualSavings.toLocaleString());
    console.log('  Expected Return:', (baselineParams.expectedReturn * 100).toFixed(1) + '%');
    console.log('  Has LTC Insurance:', baselineParams.hasLongTermCareInsurance);
    
    const baselineResult = runRightCapitalStyleMonteCarloSimulation(baselineParams, 100);
    console.log('\nBaseline Monte Carlo Result:');
    console.log('  Success Probability:', (baselineResult.successProbability * 100).toFixed(1) + '%');
    console.log('  Median Final Value: $', baselineResult.summary.medianFinalValue.toLocaleString());
    
    // 2. Apply optimization variables and recalculate
    console.log('\n--- OPTIMIZED (With Optimization Variables) ---');
    const optimizedProfile = { ...scenario.profile };
    const variables = scenario.optimizationVariables;
    
    // Apply retirement ages
    if (variables.retirementAge !== undefined) {
      optimizedProfile.desiredRetirementAge = variables.retirementAge;
    }
    if (variables.spouseRetirementAge !== undefined) {
      optimizedProfile.spouseDesiredRetirementAge = variables.spouseRetirementAge;
    }
    
    // Apply Social Security claim ages and recalculate benefits
    if (variables.socialSecurityAge !== undefined) {
      optimizedProfile.socialSecurityClaimAge = variables.socialSecurityAge;
      
      // Recalculate SS benefit if claim age changed
      if (variables.socialSecurityAge !== scenario.profile.socialSecurityClaimAge) {
        const currentAge = new Date().getFullYear() - new Date(optimizedProfile.dateOfBirth).getFullYear();
        const monthlyIncome = (optimizedProfile.annualIncome || 0) / 12;
        const userAIME = calculateAIME(monthlyIncome, currentAge, 67);
        const userPIA = calculatePrimaryInsuranceAmount(userAIME);
        const adjustedBenefit = calculateBenefitAtAge(userPIA, variables.socialSecurityAge, 67);
        optimizedProfile.socialSecurityBenefit = adjustedBenefit;
        console.log(`  Recalculated SS benefit: $${scenario.profile.socialSecurityBenefit} -> $${adjustedBenefit.toFixed(0)} (age ${variables.socialSecurityAge})`);
      }
    }
    
    if (variables.spouseSocialSecurityAge !== undefined && scenario.profile.maritalStatus === 'married') {
      optimizedProfile.spouseSocialSecurityClaimAge = variables.spouseSocialSecurityAge;
      
      if (variables.spouseSocialSecurityAge !== scenario.profile.spouseSocialSecurityClaimAge && optimizedProfile.spouseAnnualIncome) {
        const spouseAge = new Date().getFullYear() - new Date(optimizedProfile.spouseDateOfBirth).getFullYear();
        const spouseMonthlyIncome = (optimizedProfile.spouseAnnualIncome || 0) / 12;
        const spouseAIME = calculateAIME(spouseMonthlyIncome, spouseAge, 67);
        const spousePIA = calculatePrimaryInsuranceAmount(spouseAIME);
        const adjustedSpouseBenefit = calculateBenefitAtAge(spousePIA, variables.spouseSocialSecurityAge, 67);
        optimizedProfile.spouseSocialSecurityBenefit = adjustedSpouseBenefit;
        console.log(`  Recalculated Spouse SS benefit: $${scenario.profile.spouseSocialSecurityBenefit} -> $${adjustedSpouseBenefit.toFixed(0)} (age ${variables.spouseSocialSecurityAge})`);
      }
    }
    
    // Apply asset allocation
    if (variables.assetAllocation) {
      if (variables.assetAllocation === 'current-allocation') {
        optimizedProfile.expectedRealReturn = -2;
      } else if (variables.assetAllocation === 'glide-path') {
        optimizedProfile.expectedRealReturn = -1;
      } else {
        optimizedProfile.expectedRealReturn = parseFloat(variables.assetAllocation) / 100;
      }
    }
    
    // Apply contributions
    if (variables.monthlyEmployee401k !== undefined || variables.monthlyEmployer401k !== undefined) {
      optimizedProfile.retirementContributions = {
        employee: variables.monthlyEmployee401k ?? (optimizedProfile.retirementContributions?.employee || 0),
        employer: variables.monthlyEmployer401k ?? (optimizedProfile.retirementContributions?.employer || 0)
      };
    }
    
    if (variables.annualTraditionalIRA !== undefined) {
      optimizedProfile.traditionalIRAContribution = variables.annualTraditionalIRA;
    }
    if (variables.annualRothIRA !== undefined) {
      optimizedProfile.rothIRAContribution = variables.annualRothIRA;
    }
    
    // Apply spouse contributions if married
    if (scenario.profile.maritalStatus === 'married') {
      if (variables.spouseMonthlyEmployee401k !== undefined || variables.spouseMonthlyEmployer401k !== undefined) {
        optimizedProfile.spouseRetirementContributions = {
          employee: variables.spouseMonthlyEmployee401k ?? (optimizedProfile.spouseRetirementContributions?.employee || 0),
          employer: variables.spouseMonthlyEmployer401k ?? (optimizedProfile.spouseRetirementContributions?.employer || 0)
        };
      }
      
      if (variables.spouseAnnualTraditionalIRA !== undefined) {
        optimizedProfile.spouseTraditionalIRAContribution = variables.spouseAnnualTraditionalIRA;
      }
      if (variables.spouseAnnualRothIRA !== undefined) {
        optimizedProfile.spouseRothIRAContribution = variables.spouseAnnualRothIRA;
      }
    }
    
    // Apply expenses and income
    if (variables.monthlyExpenses !== undefined) {
      optimizedProfile.expectedMonthlyExpensesRetirement = variables.monthlyExpenses;
    }
    if (variables.partTimeIncome !== undefined) {
      optimizedProfile.partTimeIncomeRetirement = variables.partTimeIncome;
    }
    if (variables.spousePartTimeIncome !== undefined) {
      optimizedProfile.spousePartTimeIncomeRetirement = variables.spousePartTimeIncome;
    }
    if (variables.hasLongTermCareInsurance !== undefined) {
      optimizedProfile.hasLongTermCareInsurance = variables.hasLongTermCareInsurance;
    }
    
    const optimizedParams = profileToRetirementParams(optimizedProfile);
    
    console.log('\nOptimized Parameters:');
    console.log('  Annual Guaranteed Income: $', optimizedParams.annualGuaranteedIncome.toLocaleString());
    console.log('    - Social Security: $', ((optimizedProfile.socialSecurityBenefit || 0) * 12).toLocaleString());
    if (scenario.profile.maritalStatus === 'married') {
      console.log('    - Spouse SS: $', ((optimizedProfile.spouseSocialSecurityBenefit || 0) * 12).toLocaleString());
    }
    console.log('    - Pension: $', ((optimizedProfile.pensionBenefit || 0) * 12).toLocaleString());
    console.log('    - Part-time Income: $', ((optimizedProfile.partTimeIncomeRetirement || 0) * 12).toLocaleString());
    console.log('  Annual Expenses: $', optimizedParams.annualRetirementExpenses.toLocaleString());
    console.log('  Current Assets: $', optimizedParams.currentRetirementAssets.toLocaleString());
    console.log('  Annual Savings: $', optimizedParams.annualSavings.toLocaleString());
    console.log('  Expected Return:', (optimizedParams.expectedReturn * 100).toFixed(1) + '%');
    console.log('  Has LTC Insurance:', optimizedParams.hasLongTermCareInsurance);
    
    const optimizedResult = runRightCapitalStyleMonteCarloSimulation(optimizedParams, 100);
    console.log('\nOptimized Monte Carlo Result:');
    console.log('  Success Probability:', (optimizedResult.successProbability * 100).toFixed(1) + '%');
    console.log('  Median Final Value: $', optimizedResult.summary.medianFinalValue.toLocaleString());
    
    // 3. Compare results
    console.log('\n--- COMPARISON ---');
    const successDelta = (optimizedResult.successProbability - baselineResult.successProbability) * 100;
    const medianDelta = optimizedResult.summary.medianFinalValue - baselineResult.summary.medianFinalValue;
    
    console.log('Success Probability Change: ' + 
      (successDelta >= 0 ? '+' : '') + successDelta.toFixed(1) + '%');
    console.log('Median Final Value Change: ' + 
      (medianDelta >= 0 ? '+$' : '-$') + Math.abs(medianDelta).toLocaleString());
    
    // Verify key data points are included
    console.log('\n--- DATA FLOW VERIFICATION ---');
    const checks = [
      {
        name: 'Social Security included',
        baseline: baselineParams.annualGuaranteedIncome >= (scenario.profile.socialSecurityBenefit || 0) * 12,
        optimized: optimizedParams.annualGuaranteedIncome >= (optimizedProfile.socialSecurityBenefit || 0) * 12
      },
      {
        name: 'Pension included',
        baseline: scenario.profile.pensionBenefit ? 
          baselineParams.annualGuaranteedIncome >= scenario.profile.pensionBenefit * 12 : true,
        optimized: optimizedProfile.pensionBenefit ? 
          optimizedParams.annualGuaranteedIncome >= optimizedProfile.pensionBenefit * 12 : true
      },
      {
        name: 'LTC Insurance applied',
        baseline: baselineParams.hasLongTermCareInsurance === scenario.profile.hasLongTermCareInsurance,
        optimized: optimizedParams.hasLongTermCareInsurance === variables.hasLongTermCareInsurance
      },
      {
        name: 'Contributions updated',
        baseline: true,
        optimized: optimizedParams.annualSavings !== baselineParams.annualSavings
      },
      {
        name: 'Expenses updated',
        baseline: true,
        optimized: optimizedParams.annualRetirementExpenses !== baselineParams.annualRetirementExpenses
      }
    ];
    
    checks.forEach(check => {
      console.log(`  ${check.name}: Baseline ${check.baseline ? '✓' : '✗'}, Optimized ${check.optimized ? '✓' : '✗'}`);
    });
  }
  
  console.log('\n=== TEST COMPLETE ===\n');
}

// Run the test
testOptimizationDataFlow().catch(console.error);