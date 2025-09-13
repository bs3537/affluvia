// Debug script to examine exact Monte Carlo parameters being passed
import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';

async function debugMonteCarloParams() {
    console.log('🔍 DEBUGGING MONTE CARLO PARAMETERS');
    console.log('====================================\n');

    const plaidUser = await storage.getUserByEmail('plaid@gmail.com');
    if (!plaidUser) {
        console.log('❌ User not found');
        return;
    }

    const profile = await storage.getFinancialProfile(plaidUser.id);
    if (!profile) {
        console.log('❌ Profile not found');
        return;
    }

    console.log('✅ Retrieved profile for plaid@gmail.com\n');

    // Get parameters that would be passed to Monte Carlo
    const params = profileToRetirementParams(profile);

    console.log('📊 DETAILED MONTE CARLO PARAMETERS:');
    console.log('=====================================');
    Object.entries(params).forEach(([key, value]) => {
        if (typeof value === 'number') {
            console.log(`${key}: ${value.toLocaleString()}`);
        } else {
            console.log(`${key}: ${value}`);
        }
    });

    console.log('\n🎯 KEY FINANCIAL METRICS:');
    console.log('==========================');
    console.log(`Current Age: ${params.currentAge}`);
    console.log(`Retirement Age: ${params.retirementAge}`);
    console.log(`Years to Retirement: ${params.retirementAge - params.currentAge}`);
    console.log(`Life Expectancy: ${params.lifeExpectancy}`);
    console.log(`Years in Retirement: ${params.lifeExpectancy - params.retirementAge}`);
    console.log('');
    console.log(`Current Retirement Assets: $${params.currentRetirementAssets.toLocaleString()}`);
    console.log(`Annual Guaranteed Income: $${params.annualGuaranteedIncome.toLocaleString()}`);
    console.log(`Annual Retirement Expenses: $${params.annualRetirementExpenses.toLocaleString()}`);
    console.log(`Net Withdrawal Needed: $${(params.annualRetirementExpenses - params.annualGuaranteedIncome).toLocaleString()}`);
    console.log('');
    console.log(`Social Security (monthly): $${params.socialSecurityBenefit || 0}`);
    console.log(`Spouse Social Security (monthly): $${params.spouseSocialSecurityBenefit || 0}`);
    console.log(`Pension (monthly): $${params.pensionBenefit || 0}`);
    console.log(`Part-time Income (monthly): $${params.partTimeIncomeRetirement || 0}`);
    console.log('');
    console.log(`Expected Return: ${(params.expectedReturn * 100).toFixed(1)}%`);
    console.log(`Return Volatility: ${(params.returnVolatility * 100).toFixed(1)}%`);
    console.log(`Inflation Rate: ${(params.inflationRate * 100).toFixed(1)}%`);
    console.log(`Stock Allocation: ${(params.stockAllocation * 100).toFixed(0)}%`);
    console.log(`Bond Allocation: ${(params.bondAllocation * 100).toFixed(0)}%`);
    console.log(`Cash Allocation: ${(params.cashAllocation * 100).toFixed(0)}%`);

    // Test some basic math
    console.log('\n🧮 BASIC FEASIBILITY CHECK:');
    console.log('============================');
    const netWithdrawal = params.annualRetirementExpenses - params.annualGuaranteedIncome;
    const withdrawalRate = netWithdrawal / params.currentRetirementAssets;
    const yearsInRetirement = params.lifeExpectancy - params.retirementAge;
    const totalWithdrawalNeeded = netWithdrawal * yearsInRetirement;
    
    console.log(`Net Annual Withdrawal: $${netWithdrawal.toLocaleString()}`);
    console.log(`Initial Withdrawal Rate: ${(withdrawalRate * 100).toFixed(2)}%`);
    console.log(`Years in Retirement: ${yearsInRetirement}`);
    console.log(`Total Withdrawal Needed (no growth): $${totalWithdrawalNeeded.toLocaleString()}`);
    console.log(`Current Assets: $${params.currentRetirementAssets.toLocaleString()}`);
    
    if (totalWithdrawalNeeded < params.currentRetirementAssets) {
        console.log('✅ BASIC FEASIBILITY: Assets exceed total withdrawal needs even with NO GROWTH');
        console.log('   This should result in HIGH success probability (80%+)');
    } else {
        console.log('⚠️  BASIC FEASIBILITY: Total withdrawal needs exceed current assets');
        console.log('   Success depends on investment growth during retirement');
    }

    // Check for suspicious values
    console.log('\n🚨 PARAMETER VALIDATION:');
    console.log('=========================');
    const issues = [];
    
    if (params.annualRetirementExpenses <= 0) issues.push('❌ Zero or negative retirement expenses');
    if (params.currentRetirementAssets <= 0) issues.push('❌ Zero or negative retirement assets');
    if (params.retirementAge <= params.currentAge) issues.push('❌ Retirement age not in future');
    if (params.lifeExpectancy <= params.retirementAge) issues.push('❌ Life expectancy not after retirement');
    if (params.expectedReturn <= 0) issues.push('❌ Zero or negative expected return');
    if (params.returnVolatility < 0) issues.push('❌ Negative volatility');
    if (params.inflationRate < 0) issues.push('❌ Negative inflation rate');
    
    if (issues.length > 0) {
        console.log('Issues found:');
        issues.forEach(issue => console.log('  ' + issue));
    } else {
        console.log('✅ All parameters look reasonable');
    }

    console.log('\n🎯 EXPECTED vs ACTUAL:');
    console.log('========================');
    console.log(`Expected Success Rate: 72% (from intake)`);
    console.log(`Actual Success Rate: ~1% (from current calculation)`);
    console.log(`Discrepancy: ~71 percentage points`);
    console.log('');
    console.log('Based on the parameters above, this scenario should have HIGH success rate.');
    console.log('The low success rate suggests an issue in the Monte Carlo simulation itself.');
}

debugMonteCarloParams().catch(console.error);