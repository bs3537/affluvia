// Debug healthcare cost calculation discrepancy
import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';

async function debugHealthcareCosts() {
    console.log('🏥 DEBUGGING HEALTHCARE COST CALCULATION');
    console.log('========================================\n');

    const plaidUser = await storage.getUserByEmail('plaid@gmail.com');
    if (!plaidUser) return;
    const profile = await storage.getFinancialProfile(plaidUser.id);
    if (!profile) return;

    const params = profileToRetirementParams(profile);
    
    console.log('📊 HEALTHCARE COST BREAKDOWN:');
    console.log('==============================');
    console.log(`Base retirement expenses (monthly): $${(params.annualRetirementExpenses / 12).toFixed(0)}`);
    console.log(`Base retirement expenses (annual): $${params.annualRetirementExpenses.toLocaleString()}`);
    console.log(`Annual healthcare costs: $${params.annualHealthcareCosts || 0}`);
    console.log(`Expenses include healthcare: ${params.expensesIncludeHealthcare}`);
    
    console.log('\n🧮 WITHDRAWAL CALCULATION:');
    console.log('===========================');
    console.log(`Annual guaranteed income: $${params.annualGuaranteedIncome.toLocaleString()}`);
    console.log(`Annual retirement expenses: $${params.annualRetirementExpenses.toLocaleString()}`);
    console.log(`Net withdrawal needed: $${(params.annualRetirementExpenses - params.annualGuaranteedIncome).toLocaleString()}`);
    
    // Check if healthcare is being double-counted
    const potentialDoubleCount = params.annualRetirementExpenses + (params.annualHealthcareCosts || 0);
    console.log(`Potential double-count total: $${potentialDoubleCount.toLocaleString()}`);
    
    console.log('\n💡 ANALYSIS:');
    console.log('=============');
    if (params.expensesIncludeHealthcare) {
        console.log('✅ Healthcare should be included in base expenses, not added separately');
        console.log(`Correct total expenses: $${params.annualRetirementExpenses.toLocaleString()}`);
    } else {
        console.log('⚠️  Healthcare should be added to base expenses');
        console.log(`Correct total expenses: $${potentialDoubleCount.toLocaleString()}`);
    }
    
    const correctWithdrawal = params.expensesIncludeHealthcare 
        ? params.annualRetirementExpenses - params.annualGuaranteedIncome
        : potentialDoubleCount - params.annualGuaranteedIncome;
    
    console.log(`Correct net withdrawal: $${correctWithdrawal.toLocaleString()}`);
    console.log(`Current assets: $${params.currentRetirementAssets.toLocaleString()}`);
    console.log(`Withdrawal rate: ${((correctWithdrawal / params.currentRetirementAssets) * 100).toFixed(2)}%`);
    
    // Check with asset growth projections
    const yearsToRetirement = params.retirementAge - params.currentAge;
    const expectedReturn = params.expectedReturn || 0.066;
    const annualSavings = params.annualSavings || 18000;
    
    console.log('\n🚀 ASSET GROWTH PROJECTION:');
    console.log('=============================');
    console.log(`Years to retirement: ${yearsToRetirement}`);
    console.log(`Expected annual return: ${(expectedReturn * 100).toFixed(1)}%`);
    console.log(`Annual savings: $${annualSavings.toLocaleString()}`);
    
    // Simple compound growth calculation
    let projectedAssets = params.currentRetirementAssets;
    for (let year = 0; year < yearsToRetirement; year++) {
        projectedAssets = projectedAssets * (1 + expectedReturn) + annualSavings;
    }
    
    console.log(`Projected assets at retirement: $${projectedAssets.toLocaleString()}`);
    console.log(`Projected withdrawal rate: ${((correctWithdrawal / projectedAssets) * 100).toFixed(2)}%`);
    
    if ((correctWithdrawal / projectedAssets) < 0.04) {
        console.log('✅ This should result in HIGH success probability (80%+)');
    } else if ((correctWithdrawal / projectedAssets) < 0.05) {
        console.log('⚠️  Moderate withdrawal rate - should be 60-80% success');
    } else {
        console.log('❌ High withdrawal rate - explains low success probability');
    }
}

debugHealthcareCosts().catch(console.error);