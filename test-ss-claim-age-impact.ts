// Test the impact of Social Security claim age on retirement success probability
import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';

async function testSSClaimAgeImpact() {
    console.log('🧪 TESTING SOCIAL SECURITY CLAIM AGE IMPACT');
    console.log('===========================================\n');

    const plaidUser = await storage.getUserByEmail('plaid@gmail.com');
    if (!plaidUser) return;
    const profile = await storage.getFinancialProfile(plaidUser.id);
    if (!profile) return;

    // Test different scenarios
    const scenarios = [
        { claimAge: 65, description: 'Current (Problematic)' },
        { claimAge: 67, description: 'Full Retirement Age (Expected Fix)' },
        { claimAge: 62, description: 'Early Claiming (Worst Case)' },
        { claimAge: 70, description: 'Delayed Claiming (Best Case)' }
    ];

    for (const scenario of scenarios) {
        console.log(`📊 SCENARIO: Social Security at age ${scenario.claimAge} (${scenario.description})`);
        console.log('='.repeat(60));
        
        const testProfile = {
            ...profile,
            socialSecurityClaimAge: scenario.claimAge,
            spouseSocialSecurityClaimAge: scenario.claimAge
        };
        
        const params = profileToRetirementParams(testProfile);
        
        console.log(`Retirement Age: ${params.retirementAge}`);
        console.log(`SS Claim Age: ${params.socialSecurityClaimAge}`);
        console.log(`Years without SS: ${Math.max(0, params.socialSecurityClaimAge - params.retirementAge)}`);
        console.log(`Monthly SS Benefit: $${params.socialSecurityBenefit}`);
        console.log(`Annual Guaranteed Income: $${params.annualGuaranteedIncome.toLocaleString()}`);
        console.log(`Annual Expenses: $${params.annualRetirementExpenses.toLocaleString()}`);
        console.log(`Net Withdrawal Needed: $${(params.annualRetirementExpenses - params.annualGuaranteedIncome).toLocaleString()}`);
        
        // Run a smaller simulation for speed
        const result = await runEnhancedMonteCarloSimulation(params, 500);
        console.log(`\n🎯 SUCCESS RATE: ${result.probabilityOfSuccess.toFixed(1)}%`);
        
        if (result.probabilityOfSuccess >= 70) {
            console.log('✅ HIGH SUCCESS - This looks like the expected result');
        } else if (result.probabilityOfSuccess >= 40) {
            console.log('⚠️  MODERATE SUCCESS - Some improvement but not ideal');
        } else {
            console.log('❌ LOW SUCCESS - Still problematic');
        }
        
        console.log('\n' + '-'.repeat(60) + '\n');
    }
    
    console.log('🔍 ANALYSIS:');
    console.log('If claim age 67 shows significantly higher success rate, that confirms the root cause.');
    console.log('The gap years (retirement to SS start) require higher asset withdrawals.');
}

testSSClaimAgeImpact().catch(console.error);