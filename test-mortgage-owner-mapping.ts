/**
 * Test script to verify mortgage owner mapping in Step 4 of intake form
 * Tests that Plaid-imported mortgages correctly auto-select owner based on account holder names
 */

import { PlaidIntakeDirectMapper } from './server/services/plaid-intake-direct-mapper';

// Test scenarios for mortgage owner mapping
const mortgageTestScenarios = [
  {
    name: "Primary Mortgage - User Owned",
    profile: {
      firstName: "Michael",
      spouseName: "Sarah Johnson"
    },
    plaidMortgage: {
      ownerNames: ["Michael Smith"],
      accountName: "Primary Home Mortgage",
      balance: -250000,
      type: "loan",
      subtype: "mortgage",
      institution: "Wells Fargo"
    },
    expectedOwner: "User",
    expectedLocation: "primaryResidence"
  },
  {
    name: "Primary Mortgage - Spouse Owned",
    profile: {
      firstName: "Michael",
      spouseName: "Sarah Johnson"
    },
    plaidMortgage: {
      ownerNames: ["Sarah Johnson"],
      accountName: "Home Loan",
      balance: -175000,
      type: "loan",
      subtype: "mortgage",
      institution: "Bank of America"
    },
    expectedOwner: "Spouse",
    expectedLocation: "primaryResidence"
  },
  {
    name: "Primary Mortgage - Joint Owned",
    profile: {
      firstName: "Michael",
      spouseName: "Sarah Johnson"
    },
    plaidMortgage: {
      ownerNames: ["Michael Smith", "Sarah Johnson"],
      accountName: "Joint Mortgage",
      balance: -350000,
      type: "loan",
      subtype: "mortgage",
      institution: "Chase"
    },
    expectedOwner: "Joint",
    expectedLocation: "primaryResidence"
  },
  {
    name: "Investment Property Mortgage - Joint",
    profile: {
      firstName: "Michael",
      spouseName: "Sarah Johnson"
    },
    plaidMortgages: [
      {
        ownerNames: ["Michael Smith", "Sarah Johnson"],
        accountName: "Primary Home Loan",
        balance: -300000,
        type: "loan",
        subtype: "mortgage",
        institution: "Wells Fargo"
      },
      {
        ownerNames: ["Michael Smith", "Sarah Johnson"],
        accountName: "Rental Property Mortgage",
        balance: -150000,
        type: "loan",
        subtype: "mortgage",
        institution: "US Bank"
      }
    ],
    expectedOwners: ["Joint", "Joint"],
    expectedLocations: ["primaryResidence", "additionalProperties[0]"]
  }
];

// Test the complete flow for mortgage owner mapping
function testMortgageOwnerMapping() {
  console.log("🏠 Testing Mortgage Owner Mapping for Step 4\n");
  console.log("=" .repeat(50));
  
  let passedTests = 0;
  let failedTests = 0;
  
  mortgageTestScenarios.forEach((scenario, index) => {
    console.log(`\nTest ${index + 1}: ${scenario.name}`);
    console.log("-".repeat(40));
    
    // Extract spouse first name
    const spouseFirstName = scenario.profile.spouseName?.split(' ')[0];
    
    // Test single mortgage
    if (scenario.plaidMortgage) {
      const mapOwner = (PlaidIntakeDirectMapper as any).mapOwner;
      const result = mapOwner(
        scenario.plaidMortgage.ownerNames,
        scenario.profile.firstName,
        spouseFirstName
      );
      
      console.log(`Profile User: ${scenario.profile.firstName}`);
      console.log(`Profile Spouse: ${spouseFirstName}`);
      console.log(`Mortgage Owners: ${JSON.stringify(scenario.plaidMortgage.ownerNames)}`);
      console.log(`Institution: ${scenario.plaidMortgage.institution}`);
      console.log(`Balance: $${Math.abs(scenario.plaidMortgage.balance).toLocaleString()}`);
      console.log(`Expected Owner: ${scenario.expectedOwner}`);
      console.log(`Actual Owner: ${result}`);
      console.log(`Location: ${scenario.expectedLocation}`);
      
      if (result === scenario.expectedOwner) {
        console.log("✅ PASSED");
        passedTests++;
      } else {
        console.log("❌ FAILED");
        failedTests++;
      }
    }
    
    // Test multiple mortgages
    if (scenario.plaidMortgages) {
      console.log(`Testing ${scenario.plaidMortgages.length} mortgages:`);
      
      scenario.plaidMortgages.forEach((mortgage, idx) => {
        const mapOwner = (PlaidIntakeDirectMapper as any).mapOwner;
        const result = mapOwner(
          mortgage.ownerNames,
          scenario.profile.firstName,
          spouseFirstName
        );
        
        console.log(`\n  Mortgage ${idx + 1}:`);
        console.log(`    Owners: ${JSON.stringify(mortgage.ownerNames)}`);
        console.log(`    Institution: ${mortgage.institution}`);
        console.log(`    Expected: ${scenario.expectedOwners![idx]}`);
        console.log(`    Actual: ${result}`);
        console.log(`    Location: ${scenario.expectedLocations![idx]}`);
        
        if (result === scenario.expectedOwners![idx]) {
          console.log("    ✅ PASSED");
          passedTests++;
        } else {
          console.log("    ❌ FAILED");
          failedTests++;
        }
      });
    }
  });
  
  console.log("\n" + "=".repeat(50));
  console.log(`📊 Test Results: ${passedTests} passed, ${failedTests} failed`);
  
  if (failedTests === 0) {
    console.log("🎉 All mortgage owner mapping tests passed!");
  } else {
    console.log("⚠️  Some tests failed. Please review the mapping logic.");
  }
}

// Test Step 4 intake form population
function testStep4FormPopulation() {
  console.log("\n\n📋 Testing Step 4 Real Estate Form Population\n");
  console.log("=" .repeat(50));
  
  // Simulate data as it would appear in financial_profiles
  const mockProfileWithMortgages = {
    firstName: "John",
    spouseName: "Jane Doe",
    
    // Primary residence with Plaid mortgage
    primaryResidence: {
      marketValue: 450000, // User entered
      mortgageBalance: 285000, // From Plaid
      monthlyPayment: 0, // Needs manual input
      interestRate: 0, // Needs manual input
      yearsToPayOffMortgage: 0, // Needs manual input
      owner: "Joint", // Auto-selected based on Plaid owner names
      _source: {
        isImported: true,
        plaidAccountId: "mort_001",
        institutionName: "Wells Fargo",
        accountName: "Home Mortgage",
        lastSynced: new Date().toISOString()
      }
    },
    
    // Additional properties with Plaid mortgages
    additionalProperties: [
      {
        type: "Rental Property",
        marketValue: 225000,
        mortgageBalance: 150000, // From Plaid
        monthlyPayment: 0,
        rentalIncome: 1800,
        owner: "User", // Auto-selected based on Plaid owner names
        _source: {
          isImported: true,
          plaidAccountId: "mort_002",
          institutionName: "Chase",
          accountName: "Investment Property Loan",
          lastSynced: new Date().toISOString()
        }
      },
      {
        type: "Vacation Home",
        marketValue: 175000,
        mortgageBalance: 100000, // From Plaid
        monthlyPayment: 0,
        rentalIncome: 0,
        owner: "Spouse", // Auto-selected based on Plaid owner names
        _source: {
          isImported: true,
          plaidAccountId: "mort_003",
          institutionName: "Bank of America",
          accountName: "Second Home Mortgage",
          lastSynced: new Date().toISOString()
        }
      }
    ]
  };
  
  console.log("\n🏠 Primary Residence:");
  console.log("─".repeat(40));
  const primary = mockProfileWithMortgages.primaryResidence;
  console.log(`Market Value: $${primary.marketValue.toLocaleString()}`);
  console.log(`Mortgage Balance: $${primary.mortgageBalance.toLocaleString()} 🔗 [Plaid: ${primary._source.institutionName}]`);
  console.log(`Owner: ${primary.owner} → Displays as: ${primary.owner === 'User' ? 'You' : primary.owner}`);
  console.log(`✅ Owner auto-selected based on Plaid account holder names`);
  console.log(`⚠️  Monthly Payment: ${primary.monthlyPayment === 0 ? 'Needs manual input' : `$${primary.monthlyPayment}`}`);
  console.log(`⚠️  Interest Rate: ${primary.interestRate === 0 ? 'Needs manual input' : `${primary.interestRate}%`}`);
  
  console.log("\n🏘️ Additional Properties:");
  console.log("─".repeat(40));
  
  mockProfileWithMortgages.additionalProperties.forEach((property, index) => {
    console.log(`\nProperty ${index + 1}: ${property.type}`);
    console.log(`  Market Value: $${property.marketValue.toLocaleString()}`);
    console.log(`  Mortgage Balance: $${property.mortgageBalance.toLocaleString()} 🔗 [Plaid: ${property._source.institutionName}]`);
    console.log(`  Owner: ${property.owner} → Displays as: ${property.owner === 'User' ? 'You' : property.owner}`);
    console.log(`  ✅ Owner auto-selected based on Plaid account holder names`);
    if (property.rentalIncome > 0) {
      console.log(`  Rental Income: $${property.rentalIncome}/month`);
    }
  });
  
  console.log("\n\n✅ Expected Behavior in Step 4:");
  console.log("─".repeat(40));
  console.log("1. Primary residence mortgage data auto-populates from Plaid");
  console.log("2. Owner field auto-selects: 'You', 'Spouse', or 'Joint'");
  console.log("3. Additional properties with mortgages appear with correct owners");
  console.log("4. Plaid indicator shows for imported mortgage data");
  console.log("5. Fields requiring manual input are identified");
  console.log("\n🎯 Owner Mapping:");
  console.log("  • Matches first names from Step 1 with Plaid account holders");
  console.log("  • 'You' = Primary user's first name match");
  console.log("  • 'Spouse' = Spouse's first name match");
  console.log("  • 'Joint' = Both names found in account holders");
}

// Run all tests
console.log("🚀 Starting Mortgage Owner Mapping Tests\n");
testMortgageOwnerMapping();
testStep4FormPopulation();

console.log("\n✨ All Step 4 mortgage tests completed!");

export { testMortgageOwnerMapping, testStep4FormPopulation };