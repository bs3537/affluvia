/**
 * Test script to verify Plaid account import and owner mapping
 * This script simulates the complete flow from Plaid import to intake form population
 */

import { PlaidIntakeDirectMapper } from './server/services/plaid-intake-direct-mapper';

// Test data representing different ownership scenarios
const testScenarios = [
  {
    name: "Single Owner - User",
    profile: {
      firstName: "John",
      spouseName: "Jane Smith"
    },
    plaidAccount: {
      ownerNames: ["John Doe"],
      accountName: "Checking Account",
      balance: 5000,
      type: "depository",
      subtype: "checking"
    },
    expectedOwner: "User"
  },
  {
    name: "Single Owner - Spouse",
    profile: {
      firstName: "John",
      spouseName: "Jane Smith"
    },
    plaidAccount: {
      ownerNames: ["Jane Smith"],
      accountName: "Savings Account",
      balance: 10000,
      type: "depository",
      subtype: "savings"
    },
    expectedOwner: "Spouse"
  },
  {
    name: "Joint Ownership",
    profile: {
      firstName: "John",
      spouseName: "Jane Smith"
    },
    plaidAccount: {
      ownerNames: ["John Doe", "Jane Smith"],
      accountName: "Joint Checking",
      balance: 15000,
      type: "depository",
      subtype: "checking"
    },
    expectedOwner: "Joint"
  },
  {
    name: "No Match - Defaults to User",
    profile: {
      firstName: "John",
      spouseName: "Jane Smith"
    },
    plaidAccount: {
      ownerNames: ["Robert Johnson"],
      accountName: "Investment Account",
      balance: 25000,
      type: "investment",
      subtype: "brokerage"
    },
    expectedOwner: "User"
  },
  {
    name: "Empty Owner Names - Defaults to User",
    profile: {
      firstName: "John",
      spouseName: "Jane Smith"
    },
    plaidAccount: {
      ownerNames: [],
      accountName: "Mystery Account",
      balance: 1000,
      type: "depository",
      subtype: "savings"
    },
    expectedOwner: "User"
  }
];

// Test the private mapOwner method using reflection
function testOwnerMapping() {
  console.log("🧪 Testing Plaid Account Owner Mapping\n");
  console.log("=" .repeat(50));
  
  let passedTests = 0;
  let failedTests = 0;
  
  testScenarios.forEach((scenario, index) => {
    console.log(`\nTest ${index + 1}: ${scenario.name}`);
    console.log("-".repeat(40));
    
    // Extract spouse first name from full name
    const spouseFirstName = scenario.profile.spouseName?.split(' ')[0];
    
    // Access the private method for testing
    const mapOwner = (PlaidIntakeDirectMapper as any).mapOwner;
    
    const result = mapOwner(
      scenario.plaidAccount.ownerNames,
      scenario.profile.firstName,
      spouseFirstName
    );
    
    console.log(`Profile User: ${scenario.profile.firstName}`);
    console.log(`Profile Spouse: ${spouseFirstName}`);
    console.log(`Plaid Owners: ${JSON.stringify(scenario.plaidAccount.ownerNames)}`);
    console.log(`Expected: ${scenario.expectedOwner}`);
    console.log(`Actual: ${result}`);
    
    if (result === scenario.expectedOwner) {
      console.log("✅ PASSED");
      passedTests++;
    } else {
      console.log("❌ FAILED");
      failedTests++;
    }
  });
  
  console.log("\n" + "=".repeat(50));
  console.log(`📊 Test Results: ${passedTests} passed, ${failedTests} failed`);
  
  if (failedTests === 0) {
    console.log("🎉 All tests passed!");
  } else {
    console.log("⚠️  Some tests failed. Please review the mapping logic.");
  }
}

// Test data flow to intake form
function testIntakeFormMapping() {
  console.log("\n\n🔄 Testing Complete Data Flow to Intake Form\n");
  console.log("=" .repeat(50));
  
  // Simulate a complete asset/liability structure as it would appear in the intake form
  const testAssets = [
    {
      type: "Checking Account",
      description: "Chase Checking",
      value: 5000,
      owner: "User",
      _source: {
        isImported: true,
        institutionName: "Chase Bank",
        plaidAccountId: "account_123"
      }
    },
    {
      type: "Savings Account", 
      description: "Joint Savings",
      value: 15000,
      owner: "Joint",
      _source: {
        isImported: true,
        institutionName: "Bank of America",
        plaidAccountId: "account_456"
      }
    },
    {
      type: "401(k)",
      description: "Spouse 401k",
      value: 50000,
      owner: "Spouse",
      _source: {
        isImported: true,
        institutionName: "Fidelity",
        plaidAccountId: "account_789"
      }
    }
  ];
  
  const testLiabilities = [
    {
      type: "Credit Card",
      description: "Chase Sapphire",
      balance: 2500,
      owner: "User",
      monthlyPayment: 0,
      interestRate: 0,
      _source: {
        isImported: true,
        institutionName: "Chase",
        plaidAccountId: "account_cc1"
      }
    },
    {
      type: "Auto Loan",
      description: "Toyota Financing",
      balance: 15000,
      owner: "Joint",
      monthlyPayment: 0,
      interestRate: 0,
      _source: {
        isImported: true,
        institutionName: "Toyota Financial",
        plaidAccountId: "account_auto1"
      }
    }
  ];
  
  console.log("\n📦 Assets to be populated in Step 3:");
  testAssets.forEach(asset => {
    console.log(`  - ${asset.description}: $${asset.value.toLocaleString()} | Owner: ${asset.owner} ${asset._source.isImported ? '(Plaid Import)' : ''}`);
  });
  
  console.log("\n💳 Liabilities to be populated in Step 3:");
  testLiabilities.forEach(liability => {
    console.log(`  - ${liability.description}: $${liability.balance.toLocaleString()} | Owner: ${liability.owner} ${liability._source.isImported ? '(Plaid Import)' : ''}`);
  });
  
  console.log("\n🏠 Step 4 - Real Estate (if mortgage detected):");
  console.log("  - Mortgages are separated and populated in primaryResidence or additionalProperties");
  
  console.log("\n✅ Expected Behavior in Intake Form:");
  console.log("  1. Step 3 shows all assets/liabilities with correct owner selection");
  console.log("  2. Owner dropdown auto-selects: 'You', 'Spouse', or 'Joint'");
  console.log("  3. Plaid imported items show purple indicator");
  console.log("  4. Step 4 receives mortgage data separately");
}

// Run all tests
console.log("🚀 Starting Plaid Account Import Tests\n");
testOwnerMapping();
testIntakeFormMapping();

// Export for use in other tests
export { testOwnerMapping, testIntakeFormMapping };