// Debug the profile data being used
const fetch = require('node-fetch');

async function debugProjection() {
  try {
    // First get the profile
    const profileRes = await fetch('http://localhost:3002/api/financial-profile', {
      headers: {
        'Cookie': 'connect.sid=s%3ACGWzxz4yB75CnGxqhWcqo1PKwQ69dmxo.a0tINpJqLKoFdqiJxxHGiHw%2F4JuBXDwCxY%2FdBQ2T7mA'
      }
    });
    
    const profile = await profileRes.json();
    console.log("Profile retirement expenses:", profile.expectedMonthlyExpensesRetirement);
    console.log("Profile desired retirement age:", profile.desiredRetirementAge);
    console.log("Profile SS benefit:", profile.socialSecurityBenefit);
    console.log("Profile spouse SS benefit:", profile.spouseSocialSecurityBenefit);
    
    // Now get projections
    const projRes = await fetch('http://localhost:3002/api/calculate-net-worth-projections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3ACGWzxz4yB75CnGxqhWcqo1PKwQ69dmxo.a0tINpJqLKoFdqiJxxHGiHw%2F4JuBXDwCxY%2FdBQ2T7mA'
      }
    });
    
    const projData = await projRes.json();
    console.log("\n=== PROJECTION RESULTS ===");
    console.log("Current Net Worth:", projData.currentNetWorth);
    console.log("Target Net Worth:", projData.targetNetWorth);
    
    // Find key years
    const proj = projData.projections;
    const age65 = proj.find(p => p.age === 65);
    const age72 = proj.find(p => p.age === 72);
    const age80 = proj.find(p => p.age === 80);
    
    console.log("\nAge 65:", age65 ? `Savings: ${age65.savings}, NW: ${age65.totalNetWorth}` : "Not found");
    console.log("Age 72:", age72 ? `Savings: ${age72.savings}, NW: ${age72.totalNetWorth}` : "Not found");
    console.log("Age 80:", age80 ? `Savings: ${age80.savings}, NW: ${age80.totalNetWorth}` : "Not found");
    
    // Check for depletion
    const depleted = proj.find(p => p.savings <= 0 && p.age > 65);
    if (depleted) {
      console.log("\n*** ASSETS DEPLETED AT AGE", depleted.age, "***");
    }
    
  } catch (err) {
    console.error("Error:", err.message);
  }
}

debugProjection();
