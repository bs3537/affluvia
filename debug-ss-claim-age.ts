// Debug Social Security claim age issue
import { storage } from './server/storage';

async function debugSSClaimAge() {
    console.log('🔍 DEBUGGING SOCIAL SECURITY CLAIM AGE');
    
    const plaidUser = await storage.getUserByEmail('plaid@gmail.com');
    if (!plaidUser) return;
    
    const profile = await storage.getFinancialProfile(plaidUser.id);
    if (!profile) return;
    
    console.log('Raw profile socialSecurityClaimAge:', profile.socialSecurityClaimAge);
    console.log('Type:', typeof profile.socialSecurityClaimAge);
    console.log('Number conversion:', Number(profile.socialSecurityClaimAge));
    console.log('Number conversion || 67:', Number(profile.socialSecurityClaimAge) || 67);
    
    console.log('\nRaw profile spouseSocialSecurityClaimAge:', profile.spouseSocialSecurityClaimAge);
    console.log('Type:', typeof profile.spouseSocialSecurityClaimAge);
    console.log('Number conversion:', Number(profile.spouseSocialSecurityClaimAge));
    console.log('Number conversion || 67:', Number(profile.spouseSocialSecurityClaimAge) || 67);
    
    // Check retirement age for comparison
    console.log('\nRetirement age comparison:');
    console.log('desiredRetirementAge:', profile.desiredRetirementAge);
    console.log('Type:', typeof profile.desiredRetirementAge);
    
    if (Number(profile.socialSecurityClaimAge) < 67) {
        console.log('\n🚨 CRITICAL ISSUE FOUND:');
        console.log(`Social Security claim age (${profile.socialSecurityClaimAge}) is less than Full Retirement Age (67)`);
        console.log('This will create a gap in guaranteed income during early retirement years!');
        
        const retirementAge = Number(profile.desiredRetirementAge) || 65;
        const ssClaimAge = Number(profile.socialSecurityClaimAge) || 67;
        
        if (retirementAge < ssClaimAge) {
            const gapYears = ssClaimAge - retirementAge;
            console.log(`Gap period: ${gapYears} years without Social Security benefits`);
            console.log(`This explains the low success rate!`);
        }
    }
}

debugSSClaimAge().catch(console.error);