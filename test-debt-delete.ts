import { db } from "./server/db";
import { debts, financialProfiles } from "./shared/schema";
import { eq } from "drizzle-orm";

async function testDebtDelete() {
  try {
    console.log("🔧 Starting debt delete test...\n");
    
    // Replace with actual user ID from your test environment
    const TEST_USER_ID = 1; // You may need to adjust this
    
    // Step 1: Create a test debt entry
    console.log("📝 Creating test debt entry...");
    const [testDebt] = await db
      .insert(debts)
      .values({
        userId: TEST_USER_ID,
        debtName: "TEST Credit Card - DELETE ME",
        debtType: "credit_card",
        originalBalance: "5000",
        currentBalance: "3500",
        annualInterestRate: "18.99",
        minimumPayment: "150",
        paymentDueDate: 1,
        lender: "Test Bank",
        notes: "This is a test debt for deletion testing",
        status: "active",
        owner: "user",
        isIncludedInPayoff: true,
        isSecured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    console.log("✅ Test debt created:");
    console.log("   ID:", testDebt.id);
    console.log("   Name:", testDebt.debtName);
    console.log("   Balance:", testDebt.currentBalance);
    console.log("   Type:", testDebt.debtType);
    
    // Step 2: Also add it to the financial profile as a liability
    console.log("\n📝 Adding test debt to financial profile liabilities...");
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, TEST_USER_ID))
      .limit(1);
    
    if (profile) {
      const currentLiabilities = (profile.liabilities as any[]) || [];
      const newLiability = {
        type: "credit-card",
        description: "TEST Credit Card - DELETE ME",
        balance: "3500",
        interestRate: "18.99",
        monthlyPayment: "150",
        owner: "user"
      };
      
      const updatedLiabilities = [...currentLiabilities, newLiability];
      
      await db
        .update(financialProfiles)
        .set({
          liabilities: updatedLiabilities,
          updatedAt: new Date()
        })
        .where(eq(financialProfiles.userId, TEST_USER_ID));
        
      console.log("✅ Test debt added to financial profile liabilities");
    }
    
    // Step 3: Verify the debt exists
    console.log("\n🔍 Verifying test debt exists in database...");
    const [verifyDebt] = await db
      .select()
      .from(debts)
      .where(eq(debts.id, testDebt.id))
      .limit(1);
    
    if (verifyDebt) {
      console.log("✅ Test debt confirmed in debts table");
    } else {
      console.log("❌ Test debt not found in debts table");
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("📋 TEST DEBT CREATED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n📌 Test Instructions:");
    console.log("1. Go to the Debt Management Center in the UI");
    console.log("2. Look for the debt named: 'TEST Credit Card - DELETE ME'");
    console.log("3. Click the checkbox next to it");
    console.log("4. Confirm deletion in the popup dialog");
    console.log("5. Verify it's removed from both the UI and database");
    console.log("\n🎯 Debt ID to delete:", testDebt.id);
    console.log("=".repeat(60));
    
    // Step 4: Query to show current state
    console.log("\n📊 Current debt count for user:");
    const allDebts = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, TEST_USER_ID));
    
    console.log(`   Total debts: ${allDebts.length}`);
    console.log("   Debts list:");
    allDebts.forEach(debt => {
      console.log(`     - ${debt.debtName} (${debt.debtType}): $${debt.currentBalance}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during test:", error);
    process.exit(1);
  }
}

// Run the test
testDebtDelete();