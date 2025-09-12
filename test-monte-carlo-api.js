// Test script to verify Monte Carlo API response
const fetch = require('node-fetch');

async function testMonteCarloAPI() {
  console.log('Testing Monte Carlo API endpoint...\n');
  
  try {
    // First, we need to get the session cookie
    // For testing, you'll need to be logged in and provide your session cookie
    const COOKIE = 'YOUR_SESSION_COOKIE_HERE'; // Replace with actual session cookie
    
    const response = await fetch('http://localhost:3001/api/calculate-retirement-monte-carlo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': COOKIE
      }
    });
    
    if (!response.ok) {
      console.error('API request failed with status:', response.status);
      if (response.status === 401) {
        console.error('Authentication required. Please provide a valid session cookie.');
      }
      return;
    }
    
    const data = await response.json();
    
    console.log('=== API RESPONSE ANALYSIS ===\n');
    
    // Check for results array
    console.log('1. Results Array:');
    console.log(`   - Has results: ${!!data.results}`);
    console.log(`   - Results length: ${data.results?.length || 0}`);
    console.log(`   - Expected: 1000 iterations\n`);
    
    // Check for yearly data in first result
    if (data.results && data.results.length > 0) {
      const firstResult = data.results[0];
      console.log('2. First Trial Data:');
      console.log(`   - Has yearlyData: ${!!firstResult.yearlyData}`);
      console.log(`   - YearlyData length: ${firstResult.yearlyData?.length || 0}`);
      console.log(`   - Success: ${firstResult.success}`);
      console.log(`   - Final portfolio value: $${firstResult.finalPortfolioValue?.toLocaleString() || 0}\n`);
      
      if (firstResult.yearlyData && firstResult.yearlyData.length > 0) {
        const firstYear = firstResult.yearlyData[0];
        console.log('3. First Year Data Structure:');
        console.log(`   - Year: ${firstYear.year}`);
        console.log(`   - Age: ${firstYear.age}`);
        console.log(`   - Portfolio Value: $${firstYear.portfolioValue?.toLocaleString() || 0}`);
        console.log(`   - Has portfolioBalance field: ${firstYear.portfolioBalance !== undefined}`);
        console.log(`   - Has portfolioValue field: ${firstYear.portfolioValue !== undefined}\n`);
      }
    }
    
    // Check summary data
    console.log('4. Summary Data:');
    console.log(`   - Probability of Success: ${data.probabilityOfSuccess}%`);
    console.log(`   - Scenarios: ${JSON.stringify(data.scenarios)}`);
    console.log(`   - Has summary: ${!!data.summary}`);
    console.log(`   - Summary successful runs: ${data.summary?.successfulRuns || 0}`);
    console.log(`   - Summary total runs: ${data.summary?.totalRuns || 0}\n`);
    
    // Check cash flow data
    console.log('5. Cash Flow Data:');
    console.log(`   - Has yearlyCashFlows: ${!!data.yearlyCashFlows}`);
    console.log(`   - YearlyCashFlows length: ${data.yearlyCashFlows?.length || 0}`);
    console.log(`   - Has percentile10CashFlows: ${!!data.percentile10CashFlows}`);
    console.log(`   - Has percentile90CashFlows: ${!!data.percentile90CashFlows}\n`);
    
    // Final verdict
    console.log('=== VISUALIZATION READINESS ===');
    const isReady = !!(
      data.results && 
      data.results.length > 0 && 
      data.results[0].yearlyData &&
      data.results[0].yearlyData[0].portfolioValue !== undefined
    );
    
    if (isReady) {
      console.log('✅ Data is ready for visualization!');
      console.log('   - All required fields are present');
      console.log('   - Data structure matches frontend expectations');
    } else {
      console.log('❌ Data is NOT ready for visualization');
      console.log('   - Missing required fields or data structure mismatch');
      if (!data.results) {
        console.log('   - Missing: results array');
      }
      if (data.results && data.results.length === 0) {
        console.log('   - Issue: results array is empty');
      }
      if (data.results && data.results[0] && !data.results[0].yearlyData) {
        console.log('   - Missing: yearlyData in trials');
      }
      if (data.results && data.results[0]?.yearlyData && !data.results[0].yearlyData[0].portfolioValue) {
        console.log('   - Missing: portfolioValue field (has portfolioBalance instead?)');
      }
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Instructions for running the test
console.log('=== MONTE CARLO API TEST ===\n');
console.log('To run this test:');
console.log('1. Make sure your server is running on http://localhost:3001');
console.log('2. Log into the app in your browser');
console.log('3. Open browser DevTools > Network tab');
console.log('4. Find any API request and copy the Cookie header value');
console.log('5. Replace YOUR_SESSION_COOKIE_HERE with the actual cookie');
console.log('6. Run: node test-monte-carlo-api.js\n');

// Uncomment to run the test
// testMonteCarloAPI();