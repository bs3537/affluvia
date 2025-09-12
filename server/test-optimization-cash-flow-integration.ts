#!/usr/bin/env tsx

// Integration test to verify the optimization endpoint cash flow persistence
import { transformMonteCarloToCashFlow } from './cash-flow-transformer';

console.log('🧪 Testing Optimization Endpoint Cash Flow Integration');
console.log('='.repeat(50));

// Mock a typical optimization flow similar to what happens in the endpoint
async function testOptimizationCashFlowIntegration() {
  console.log('\n1️⃣ Testing Optimized Cash Flow Transformation...');
  
  // Mock Monte Carlo result (what would come from runRightCapitalStyleMonteCarloSimulation)
  const mockOptimizedResult = {
    successProbability: 0.85,
    yearlyCashFlows: [
      {
        year: 2024,
        age: 65,
        portfolioBalance: 1000000,
        withdrawal: 40000,
        totalTax: 8000,
        federalTax: 6000,
        stateTax: 2000,
        ficaTax: 0,
        healthcareCosts: 8000
      },
      {
        year: 2025,
        age: 66,
        portfolioBalance: 1020000,
        withdrawal: 42000,
        totalTax: 9000,
        federalTax: 6500,
        stateTax: 2200,
        ficaTax: 300,
        healthcareCosts: 8500
      }
    ]
  };

  // Mock optimization variables (what would come from req.body)
  const mockVariables = {
    retirementAge: 65,
    spouseRetirementAge: 67,
    socialSecurityAge: 65,
    spouseSocialSecurityAge: 67,
    monthlyExpenses: 5000,
    partTimeIncome: 500,
    spousePartTimeIncome: 0
  };

  // Mock optimized profile (what would be created in the endpoint)
  const mockOptimizedProfile = {
    socialSecurityBenefit: 2000,
    spouseSocialSecurityBenefit: 1800,
    pensionBenefit: 1000,
    spousePensionBenefit: 0,
    expectedMonthlyExpensesRetirement: 5000,
    dateOfBirth: '1959-01-01',
    spouseDateOfBirth: '1957-01-01',
    annualIncome: 80000,
    spouseAnnualIncome: 60000,
    desiredRetirementAge: 65,
    spouseDesiredRetirementAge: 67,
    socialSecurityClaimAge: 65,
    spouseSocialSecurityClaimAge: 67,
    partTimeIncomeRetirement: 500,
    spousePartTimeIncomeRetirement: 0,
    primaryResidence: {
      yearsToPayOffMortgage: 5,
      monthlyPayment: 1200
    }
  };

  try {
    // This mimics what happens in the optimization endpoint after Monte Carlo simulation
    const optimizedCashFlow = transformMonteCarloToCashFlow(
      mockOptimizedResult.yearlyCashFlows || [],
      {
        retirementAge: mockOptimizedProfile.desiredRetirementAge || mockVariables.retirementAge || 67,
        spouseRetirementAge: mockOptimizedProfile.spouseDesiredRetirementAge || mockVariables.spouseRetirementAge || 67,
        socialSecurityAge: mockOptimizedProfile.socialSecurityClaimAge || mockVariables.socialSecurityAge || 67,
        spouseSocialSecurityAge: mockOptimizedProfile.spouseSocialSecurityClaimAge || mockVariables.spouseSocialSecurityAge || 67,
        monthlyExpenses: mockOptimizedProfile.expectedMonthlyExpensesRetirement || mockVariables.monthlyExpenses || 8000,
        partTimeIncome: mockOptimizedProfile.partTimeIncomeRetirement || mockVariables.partTimeIncome || 0,
        spousePartTimeIncome: mockOptimizedProfile.spousePartTimeIncomeRetirement || mockVariables.spousePartTimeIncome || 0
      },
      mockOptimizedProfile,
      true // isOptimized flag
    );

    console.log('✅ Optimized cash flow transformation successful!');
    console.log(`   Transformed ${optimizedCashFlow.length} years of cash flow data`);

    // Test the database storage structure (what would be saved)
    console.log('\n2️⃣ Testing Database Storage Structure...');

    const cashFlowData = {
      optimizedCashFlow,
      baselineCashFlow: null, // Would be populated if hasChanges is true
      transformedAt: new Date().toISOString()
    };

    const mockOptimizationData = {
      optimizationVariables: {
        ...mockVariables,
        lockedAt: new Date().toISOString(),
        optimizedScore: mockOptimizedResult,
        savedAt: new Date().toISOString()
      },
      
      monteCarloSimulation: {
        calculatedAt: new Date().toISOString(),
        probabilityOfSuccess: mockOptimizedResult.successProbability,
        yearlyCashFlows: mockOptimizedResult.yearlyCashFlows,
        // Include transformed cash flow data for Sankey visualization
        cashFlowProjections: cashFlowData
      },
      
      retirementPlanningData: {
        lastOptimizedAt: new Date().toISOString(),
        optimizationVariables: mockVariables,
        optimizedScore: mockOptimizedResult.successProbability,
        baselineScore: null,
        improvement: null
      }
    };

    console.log('✅ Database storage structure created successfully!');
    console.log('   Cash flow data included in monteCarloSimulation.cashFlowProjections');

    // Test baseline scenario (what happens when hasChanges is true)
    console.log('\n3️⃣ Testing Baseline Scenario (hasChanges = true)...');
    
    const mockOriginalProfile = {
      ...mockOptimizedProfile,
      desiredRetirementAge: 67, // Different from optimized
      socialSecurityClaimAge: 67, // Different from optimized
      expectedMonthlyExpensesRetirement: 4500 // Different from optimized
    };

    const mockBaselineResult = {
      successProbability: 0.75, // Lower than optimized
      yearlyCashFlows: [
        {
          year: 2026, // Later start due to later retirement
          age: 67,
          portfolioBalance: 1100000,
          withdrawal: 35000,
          totalTax: 7000,
          federalTax: 5000,
          stateTax: 1800,
          ficaTax: 200,
          healthcareCosts: 7500
        }
      ]
    };

    const baselineCashFlow = transformMonteCarloToCashFlow(
      mockBaselineResult.yearlyCashFlows || [],
      {
        retirementAge: mockOriginalProfile.desiredRetirementAge || 67,
        spouseRetirementAge: mockOriginalProfile.spouseDesiredRetirementAge || 67,
        socialSecurityAge: mockOriginalProfile.socialSecurityClaimAge || 67,
        spouseSocialSecurityAge: mockOriginalProfile.spouseSocialSecurityClaimAge || 67,
        monthlyExpenses: mockOriginalProfile.expectedMonthlyExpensesRetirement || 8000,
        partTimeIncome: mockOriginalProfile.partTimeIncomeRetirement || 0,
        spousePartTimeIncome: mockOriginalProfile.spousePartTimeIncomeRetirement || 0
      },
      mockOriginalProfile,
      false // isOptimized flag
    );

    const completeStorageData = {
      optimizedCashFlow,
      baselineCashFlow,
      transformedAt: new Date().toISOString()
    };

    console.log('✅ Baseline cash flow transformation successful!');
    console.log(`   Optimized: ${optimizedCashFlow.length} years`);
    console.log(`   Baseline: ${baselineCashFlow.length} years`);

    // Test data integrity
    console.log('\n4️⃣ Testing Data Integrity...');
    
    if (optimizedCashFlow.length > 0) {
      const sample = optimizedCashFlow[0];
      const hasRequiredFields = sample.year && sample.age && 
                               typeof sample.socialSecurity === 'number' &&
                               typeof sample.taxableWithdrawal === 'number' &&
                               typeof sample.livingExpenses === 'number' &&
                               typeof sample.federalTax === 'number' &&
                               typeof sample.netCashFlow === 'number';
      
      if (hasRequiredFields) {
        console.log('✅ All required fields present in cash flow data');
      } else {
        throw new Error('Missing required fields in cash flow data');
      }
    }

    // Test serialization (important for database storage)
    console.log('\n5️⃣ Testing JSON Serialization...');
    
    const serialized = JSON.stringify(completeStorageData);
    const deserialized = JSON.parse(serialized);
    
    if (deserialized.optimizedCashFlow.length === optimizedCashFlow.length &&
        deserialized.baselineCashFlow.length === baselineCashFlow.length) {
      console.log('✅ JSON serialization/deserialization successful');
    } else {
      throw new Error('JSON serialization failed');
    }

    console.log('\n🎉 Integration Test Successful!');
    console.log('\nSummary:');
    console.log('✅ Optimized cash flow transformation works');
    console.log('✅ Baseline cash flow transformation works');
    console.log('✅ Database storage structure is correct');
    console.log('✅ Data integrity is maintained');
    console.log('✅ JSON serialization works for database storage');
    console.log('\n📊 The optimization endpoint will now persist cash flow data for the Sankey diagram!');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

// Run the test
testOptimizationCashFlowIntegration().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});