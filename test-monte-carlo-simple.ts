// Simple test of Monte Carlo simulation to isolate the issue
import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';
import type { RetirementMonteCarloParams } from './server/monte-carlo-base';

async function testSimpleMonteCarlo() {
    console.log('🧪 TESTING SIMPLE MONTE CARLO SCENARIO');
    console.log('======================================\n');

    // Create a scenario that should have HIGH success probability
    const simpleParams: RetirementMonteCarloParams = {
        currentAge: 60,
        retirementAge: 65,
        lifeExpectancy: 90,
        
        // Assets
        currentRetirementAssets: 250000, // Projected value at retirement
        
        // Income (very reasonable)
        annualGuaranteedIncome: 33462, // Social Security
        socialSecurityBenefit: 2788.54,
        socialSecurityClaimAge: 65,
        
        // Expenses (reasonable)
        annualRetirementExpenses: 45000, // Includes healthcare
        annualHealthcareCosts: 6397,
        
        // Market assumptions (reasonable)
        expectedReturn: 0.066, // 6.6%
        returnVolatility: 0.15, // 15%
        inflationRate: 0.025, // 2.5%
        
        // Asset allocation
        stockAllocation: 0.6, // 60% stocks (age-appropriate)
        bondAllocation: 0.35, // 35% bonds
        cashAllocation: 0.05, // 5% cash
        
        // Basic settings
        withdrawalRate: 0.04,
        useGuardrails: true,
        taxRate: 0.02,
        filingStatus: 'single',
        annualSavings: 0, // No more savings during retirement
        
        // Required fields
        userRiskScore: 3,
        spouseRiskScore: 3,
        useGlidePath: false,
        useRiskProfile: true,
        enableDynamicWithdrawals: true,
        bearOnlyDynamicWithdrawals: true,
        legacyGoal: 0,
        hasLongTermCareInsurance: false,
        
        // Asset buckets (simplified)
        assetBuckets: {
            taxDeferred: 100000,
            taxFree: 0,
            capitalGains: 0,
            cashEquivalents: 150000,
            totalAssets: 250000
        },
        
        userAssetBuckets: {
            taxDeferred: 100000,
            taxFree: 0,
            capitalGains: 0,
            cashEquivalents: 150000,
            totalAssets: 250000
        },
        
        spouseAssetBuckets: {
            taxDeferred: 0,
            taxFree: 0,
            capitalGains: 0,
            cashEquivalents: 0,
            totalAssets: 0
        },
        
        jointAssetBuckets: {
            taxDeferred: 0,
            taxFree: 0,
            capitalGains: 0,
            cashEquivalents: 0,
            totalAssets: 0
        },
        
        userAssetTotal: 250000,
        spouseAssetTotal: 0,
        jointAssetTotal: 0,
        
        userAnnualSavings: 0,
        spouseAnnualSavings: 0,
        userAnnualIncome: 0,
        spouseAnnualIncome: 0,
        monthlyContribution401k: 0,
        monthlyContributionIRA: 0,
        monthlyContributionRothIRA: 0,
        monthlyContributionBrokerage: 0,
        
        userHealthStatus: 'good',
        spouseHealthStatus: 'good',
        userGender: 'male',
        spouseGender: 'female',
        retirementState: 'CT',
        
        profileData: {},
        
        ltcModeling: {
            enabled: false,
            approach: 'simple',
            lifetimeProbability: 0,
            averageDuration: 0,
            averageAnnualCost: 0,
            onsetAgeRange: [80, 85],
            costInflationRate: 0.02,
            gender: 'M',
            maritalStatus: 'single',
            familySupport: 'Medium',
            hasInsurance: false
        }
    };

    console.log('📊 SIMPLE SCENARIO PARAMETERS:');
    console.log('===============================');
    console.log(`Assets: $${simpleParams.currentRetirementAssets.toLocaleString()}`);
    console.log(`Annual Guaranteed Income: $${simpleParams.annualGuaranteedIncome.toLocaleString()}`);
    console.log(`Annual Expenses: $${simpleParams.annualRetirementExpenses.toLocaleString()}`);
    console.log(`Net Withdrawal Needed: $${(simpleParams.annualRetirementExpenses - simpleParams.annualGuaranteedIncome).toLocaleString()}`);
    console.log(`Withdrawal Rate: ${(((simpleParams.annualRetirementExpenses - simpleParams.annualGuaranteedIncome) / simpleParams.currentRetirementAssets) * 100).toFixed(2)}%`);
    console.log(`Expected Return: ${(simpleParams.expectedReturn * 100).toFixed(1)}%`);
    console.log(`Years in Retirement: ${simpleParams.lifeExpectancy - simpleParams.retirementAge}`);
    
    console.log('\n🎯 EXPECTED OUTCOME: This should have 70%+ success probability');
    console.log('   - Reasonable withdrawal rate (4.6%)');
    console.log('   - Good expected returns (6.6%)');
    console.log('   - Significant guaranteed income (73% of expenses)');
    
    console.log('\n🚀 RUNNING SIMULATION...');
    try {
        const result = await runEnhancedMonteCarloSimulation(simpleParams, 500);
        
        console.log('\n📈 RESULTS:');
        console.log('============');
        console.log(`Success Probability: ${result.probabilityOfSuccess.toFixed(1)}%`);
        console.log(`Median Ending Balance: $${result.medianEndingBalance?.toLocaleString() || 'N/A'}`);
        
        if (result.probabilityOfSuccess >= 70) {
            console.log('✅ EXPECTED RESULT - Monte Carlo is working correctly');
        } else if (result.probabilityOfSuccess >= 40) {
            console.log('⚠️  MODERATE RESULT - Some issue but not complete failure');
        } else {
            console.log('❌ LOW RESULT - Monte Carlo logic has a significant issue');
        }
        
    } catch (error) {
        console.error('❌ SIMULATION FAILED:', error);
    }
}

testSimpleMonteCarlo().catch(console.error);