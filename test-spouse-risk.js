// Test script to verify spouse risk profile calculation
import fetch from 'node-fetch';
import fs from 'fs';

// Read cookies from cookies.txt file
const cookieContent = fs.readFileSync('cookies.txt', 'utf8');
const cookieMatch = cookieContent.match(/connect\.sid=([^;]+)/);
const sessionCookie = cookieMatch ? cookieMatch[1] : '';

console.log('Using session cookie:', sessionCookie);

// Test data with spouse risk questions
const testData = {
  // Personal Information
  firstName: "Test",
  lastName: "User",
  dateOfBirth: "1985-01-01",
  maritalStatus: "married",
  dependents: 2,
  spouseName: "Test Spouse",
  spouseDateOfBirth: "1987-01-01",
  
  // Employment & Income
  employmentStatus: "employed",
  annualIncome: 120000,
  otherIncome: 5000,
  spouseEmploymentStatus: "employed",
  spouseAnnualIncome: 80000,
  
  // Monthly Expenses
  monthlyExpenses: {
    housing: 2000,
    food: 800,
    transportation: 500,
    utilities: 200,
    healthcare: 300,
    entertainment: 200,
    other: 500
  },
  
  // Assets
  assets: [
    { name: "Checking", type: "checking", value: 10000 },
    { name: "Savings", type: "savings", value: 50000 },
    { name: "401k", type: "401k", value: 150000 }
  ],
  
  // Risk Questions for primary user (moderate profile)
  riskQuestions: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], // Total: 30 = Moderate
  
  // Current allocation
  currentAllocation: {
    usStocks: 40,
    intlStocks: 20,
    bonds: 30,
    alternatives: 5,
    cash: 5
  },
  
  // Spouse Risk Questions (aggressive profile)
  spouseRiskQuestions: [5, 5, 4, 4, 5, 4, 5, 4, 4, 5], // Total: 45 = Aggressive
  
  // Spouse current allocation
  spouseAllocation: {
    usStocks: 30,
    intlStocks: 10,
    bonds: 40,
    alternatives: 10,
    cash: 10
  },
  
  // Other required fields
  emergencyFundSize: 30000,
  liabilities: [],
  goals: [
    { name: "Retirement", targetDate: "2050-01-01", targetAmount: 2000000 }
  ]
};

async function testSpouseRiskProfile() {
  try {
    console.log('\n=== Submitting test financial profile ===');
    
    const response = await fetch('http://localhost:3000/api/financial-profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `connect.sid=${sessionCookie}`
      },
      body: JSON.stringify(testData)
    });
    
    if (!response.ok) {
      console.error('Failed to submit profile:', response.status, response.statusText);
      return;
    }
    
    console.log('Profile submitted successfully');
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fetch the profile to see calculations
    console.log('\n=== Fetching profile with calculations ===');
    
    const getResponse = await fetch('http://localhost:3000/api/financial-profile', {
      headers: {
        'Cookie': `connect.sid=${sessionCookie}`
      }
    });
    
    if (!getResponse.ok) {
      console.error('Failed to fetch profile:', getResponse.status, getResponse.statusText);
      return;
    }
    
    const profile = await getResponse.json();
    
    console.log('\n=== Results ===');
    console.log('Primary Risk Profile:', profile.calculations?.riskProfile);
    console.log('Primary Risk Score:', profile.calculations?.riskScore);
    console.log('Primary Target Allocation:', profile.calculations?.targetAllocation);
    
    console.log('\nSpouse Risk Profile:', profile.calculations?.spouseRiskProfile);
    console.log('Spouse Risk Score:', profile.calculations?.spouseRiskScore);
    console.log('Spouse Target Allocation:', profile.calculations?.spouseTargetAllocation);
    
    // Verify spouse data is calculated
    if (profile.calculations?.spouseRiskProfile === 'Not Assessed') {
      console.error('\n❌ ERROR: Spouse risk profile was not calculated!');
      console.log('\nDebugging info:');
      console.log('Marital Status:', profile.maritalStatus);
      console.log('Spouse Risk Questions:', profile.spouseRiskQuestions);
    } else {
      console.log('\n✅ SUCCESS: Spouse risk profile calculated correctly!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testSpouseRiskProfile();