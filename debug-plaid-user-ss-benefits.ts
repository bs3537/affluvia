// Debug script to investigate Social Security benefit data issue
// for plaid@gmail.com user showing 72% vs 43% discrepancy

import { storage } from './server/storage';
import { profileToRetirementParams } from './server/monte-carlo-base';
import { runEnhancedMonteCarloSimulation } from './server/monte-carlo-enhanced';

async function debugPlaidUserSSBenefits() {
    console.log('🔍 DEBUGGING SOCIAL SECURITY BENEFIT ISSUE');
    console.log('User: plaid@gmail.com');
    console.log('Issue: 72% (intake) vs 43% (dashboard refresh)\n');

    try {
        // 1. Get the stored profile from database
        console.log('1️⃣ RETRIEVING STORED PROFILE FROM DATABASE...');
        const plaidUser = await storage.getUserByEmail('plaid@gmail.com');
        
        if (!plaidUser) {
            console.log('❌ User plaid@gmail.com not found in database');
            return;
        }

        const profile = await storage.getFinancialProfile(plaidUser.id);
        if (!profile) {
            console.log('❌ No financial profile found for plaid@gmail.com');
            return;
        }

        console.log('✅ Profile retrieved successfully');
        console.log(`Profile ID: ${profile.id}`);
        
        // 2. Check raw Social Security benefit values
        console.log('\n2️⃣ CHECKING RAW SOCIAL SECURITY BENEFIT VALUES...');
        console.log('Raw profileData.socialSecurityBenefit:', profile.socialSecurityBenefit);
        console.log('Type:', typeof profile.socialSecurityBenefit);
        console.log('Raw profileData.spouseSocialSecurityBenefit:', profile.spouseSocialSecurityBenefit);
        console.log('Type:', typeof profile.spouseSocialSecurityBenefit);

        // 3. Check what Number() conversion produces
        console.log('\n3️⃣ TESTING Number() CONVERSION...');
        const userSS = Number(profile.socialSecurityBenefit) || 0;
        const spouseSS = Number(profile.spouseSocialSecurityBenefit) || 0;
        console.log('Number(profile.socialSecurityBenefit):', userSS);
        console.log('Number(profile.spouseSocialSecurityBenefit):', spouseSS);

        // 4. Test profileToRetirementParams with current profile
        console.log('\n4️⃣ TESTING profileToRetirementParams CONVERSION...');
        console.log('Creating retirement parameters from stored profile...');
        
        // TEMPORARY FIX: Override Social Security claim age to Full Retirement Age
        const fixedProfile = {
            ...profile,
            socialSecurityClaimAge: 67,  // Fix the claim age
            spouseSocialSecurityClaimAge: 67
        };
        
        console.log('🔧 APPLYING TEMPORARY FIX: Setting SS claim age to 67 (FRA)');
        console.log('Original claim age:', profile.socialSecurityClaimAge);
        console.log('Fixed claim age:', fixedProfile.socialSecurityClaimAge);
        console.log();
        
        // Enable verbose logging in profileToRetirementParams
        const params = profileToRetirementParams(fixedProfile);
        
        console.log('\n📊 KEY RETIREMENT PARAMETERS:');
        console.log(`  Current Retirement Assets: $${params.currentRetirementAssets.toLocaleString()}`);
        console.log(`  Annual Guaranteed Income: $${params.annualGuaranteedIncome.toLocaleString()}`);
        console.log(`  Social Security Benefit (monthly): $${params.socialSecurityBenefit || 0}`);
        console.log(`  Spouse Social Security Benefit (monthly): $${params.spouseSocialSecurityBenefit || 0}`);
        console.log(`  Annual Retirement Expenses: $${params.annualRetirementExpenses.toLocaleString()}`);
        console.log(`  Net Withdrawal Needed: $${(params.annualRetirementExpenses - params.annualGuaranteedIncome).toLocaleString()}`);

        // 5. Run Monte Carlo simulation to see current result
        console.log('\n5️⃣ RUNNING MONTE CARLO SIMULATION...');
        console.log('This should reproduce the 43% result...');
        
        const result = await runEnhancedMonteCarloSimulation(params, 1000);
        console.log(`\n🎯 MONTE CARLO RESULT: ${result.probabilityOfSuccess.toFixed(1)}%`);
        
        if (result.probabilityOfSuccess < 50) {
            console.log('❌ LOW SUCCESS RATE - Likely missing Social Security benefits!');
        } else if (result.probabilityOfSuccess > 70) {
            console.log('✅ GOOD SUCCESS RATE - Social Security benefits seem to be included');
        }

        // 6. Check for any stored Monte Carlo results
        console.log('\n6️⃣ CHECKING STORED MONTE CARLO RESULTS...');
        if (profile.monteCarloSimulation) {
            const storedResult = profile.monteCarloSimulation as any;
            console.log('Stored Monte Carlo result found:');
            if (storedResult.retirementSimulation?.results) {
                const storedProb = storedResult.retirementSimulation.results.probabilityOfSuccess || 
                                 storedResult.retirementSimulation.results.successProbability;
                console.log(`  Stored success probability: ${storedProb}`);
                console.log(`  Stored calculation timestamp: ${storedResult.retirementSimulation.calculatedAt}`);
            }
            if (storedResult.probabilityOfSuccess) {
                console.log(`  Legacy stored probability: ${storedResult.probabilityOfSuccess}`);
            }
        } else {
            console.log('No stored Monte Carlo results found');
        }

        // 7. Compare with expected values
        console.log('\n7️⃣ DIAGNOSTIC SUMMARY:');
        console.log('Expected (from intake form): 72% success rate');
        console.log(`Actual (from dashboard): ${result.probabilityOfSuccess.toFixed(1)}% success rate`);
        
        if (Math.abs(result.probabilityOfSuccess - 72) > 5) {
            console.log('\n🚨 DISCREPANCY CONFIRMED!');
            console.log('Possible causes:');
            console.log('  - Social Security benefits are missing or corrupted');
            console.log('  - Asset values have changed');
            console.log('  - Retirement expenses have changed');
            console.log('  - Other profile data has been modified');
            
            // Check if SS benefits are the likely culprit
            if (userSS === 0 && spouseSS === 0) {
                console.log('\n💡 LIKELY ROOT CAUSE: Social Security benefits are $0!');
                console.log('This would explain the ~29% drop in success probability.');
            }
        } else {
            console.log('\n✅ NO SIGNIFICANT DISCREPANCY FOUND');
            console.log('The issue may have been resolved or is intermittent.');
        }

    } catch (error) {
        console.error('❌ Error during debugging:', error);
    }
}

// Execute the debug script
debugPlaidUserSSBenefits();