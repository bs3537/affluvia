import fetch from 'node-fetch';

async function testAPIResponse() {
  console.log('🔍 Testing API response for user 18...\n');
  
  try {
    // Simulate a logged-in session
    const response = await fetch('http://localhost:3004/api/financial-profile?t=' + Date.now(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Note: You'd need proper authentication cookies in a real scenario
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('✅ API Response Received');
      console.log('=' .repeat(50));
      
      console.log('\n📋 BASIC INFO:');
      console.log(`  Name: ${data.firstName} ${data.lastName}`);
      console.log(`  User ID: ${data.userId}`);
      console.log(`  Income: $${data.annualIncome?.toLocaleString() || 0}`);
      
      console.log('\n📊 CALCULATIONS:');
      if (data.calculations) {
        console.log(`  Health Score: ${data.calculations.healthScore || 'N/A'}`);
        console.log(`  Net Worth: $${data.calculations.netWorth?.toLocaleString() || 'N/A'}`);
        console.log(`  Monthly Cash Flow: $${data.calculations.monthlyCashFlow?.toLocaleString() || 'N/A'}`);
        console.log(`  Retirement Score: ${data.calculations.retirementScore || 'N/A'}`);
        console.log(`  Risk Profile: ${data.calculations.riskProfile || 'N/A'}`);
      } else {
        console.log('  ❌ No calculations object');
      }
      
      console.log('\n💰 ASSETS & LIABILITIES:');
      console.log(`  Assets: ${data.assets ? data.assets.length + ' items' : 'None'}`);
      console.log(`  Liabilities: ${data.liabilities ? data.liabilities.length + ' items' : 'None'}`);
      console.log(`  Monthly Expenses: ${data.monthlyExpenses ? 'Yes' : 'No'}`);
      
      console.log('\n🎲 MONTE CARLO:');
      if (data.monteCarloSimulation) {
        const mc = data.monteCarloSimulation;
        console.log(`  Has Simulation: Yes`);
        console.log(`  Success Rate: ${mc.summary?.successRate || 'N/A'}%`);
      } else {
        console.log('  ❌ No Monte Carlo simulation');
      }
      
      console.log('\n📈 NET WORTH PROJECTIONS:');
      if (data.netWorthProjections) {
        console.log('  Has Projections: Yes');
        if (data.netWorthProjections.years) {
          console.log(`  Years of data: ${data.netWorthProjections.years.length}`);
        }
      } else {
        console.log('  ❌ No net worth projections');
      }
      
      console.log('\n✅ SUMMARY:');
      console.log('  API is returning data successfully');
      console.log('  Dashboard widgets should be able to display this data');
      
    } else {
      console.log(`❌ API returned status: ${response.status}`);
      console.log('This likely means authentication is required');
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testAPIResponse();