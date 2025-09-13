import { db } from "./server/db";
import { debts, financialProfiles } from "./shared/schema";
import { eq } from "drizzle-orm";

async function verifyDebtDeletion() {
  try {
    console.log("🔍 Verifying debt deletion...\n");
    
    const TEST_USER_ID = 1; // Same as in test script
    const TEST_DEBT_ID = 15; // The ID from our test creation
    const TEST_DEBT_NAME = "TEST Credit Card - DELETE ME";
    
    console.log("=".repeat(60));
    console.log("DELETION VERIFICATION REPORT");
    console.log("=".repeat(60));
    
    // Check 1: Verify debt is removed from debts table
    console.log("\n1️⃣  Checking debts table...");
    const [debtRecord] = await db
      .select()
      .from(debts)
      .where(eq(debts.id, TEST_DEBT_ID))
      .limit(1);
    
    if (debtRecord) {
      console.log("   ❌ FAILED: Test debt still exists in debts table!");
      console.log("      ID:", debtRecord.id);
      console.log("      Name:", debtRecord.debtName);
    } else {
      console.log("   ✅ SUCCESS: Test debt removed from debts table");
    }
    
    // Check 2: Verify debt is removed from financial profile liabilities
    console.log("\n2️⃣  Checking financial profile liabilities...");
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, TEST_USER_ID))
      .limit(1);
    
    if (profile) {
      const liabilities = (profile.liabilities as any[]) || [];
      const testDebtStillExists = liabilities.some(
        (liability: any) => liability.description === TEST_DEBT_NAME
      );
      
      if (testDebtStillExists) {
        console.log("   ❌ FAILED: Test debt still exists in financial profile!");
        const testLiability = liabilities.find(
          (l: any) => l.description === TEST_DEBT_NAME
        );
        console.log("      Found:", testLiability);
      } else {
        console.log("   ✅ SUCCESS: Test debt removed from financial profile");
      }
      
      console.log("\n   Current liabilities in profile:");
      if (liabilities.length === 0) {
        console.log("      (No liabilities)");
      } else {
        liabilities.forEach((liability: any) => {
          console.log(`      - ${liability.description || liability.type}: $${liability.balance}`);
        });
      }
    }
    
    // Check 3: Show current state of all debts
    console.log("\n3️⃣  Current state of all debts for user:");
    const allDebts = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, TEST_USER_ID));
    
    console.log(`   Total debts remaining: ${allDebts.length}`);
    if (allDebts.length > 0) {
      console.log("   Remaining debts:");
      allDebts.forEach(debt => {
        console.log(`     - [ID: ${debt.id}] ${debt.debtName}: $${debt.currentBalance}`);
      });
    } else {
      console.log("   (No debts remaining)");
    }
    
    // Check 4: Verify financial metrics were recalculated
    console.log("\n4️⃣  Checking if financial metrics were recalculated...");
    if (profile) {
      const calculations = profile.calculations as any;
      if (calculations && calculations.lastUpdated) {
        const lastUpdated = new Date(calculations.lastUpdated);
        const now = new Date();
        const timeDiff = now.getTime() - lastUpdated.getTime();
        const minutesAgo = Math.floor(timeDiff / 60000);
        
        if (minutesAgo < 5) {
          console.log("   ✅ Financial metrics were recently recalculated");
          console.log(`      Last updated: ${minutesAgo} minutes ago`);
        } else {
          console.log("   ⚠️  Financial metrics may not have been recalculated");
          console.log(`      Last updated: ${minutesAgo} minutes ago`);
        }
        
        if (calculations.netWorth) {
          console.log(`      Current Net Worth: $${calculations.netWorth.toLocaleString()}`);
        }
        if (calculations.totalDebt) {
          console.log(`      Current Total Debt: $${calculations.totalDebt.toLocaleString()}`);
        }
      }
    }
    
    console.log("\n" + "=".repeat(60));
    
    // Final verdict
    const debtDeleted = !debtRecord;
    const liabilitiesUpdated = profile && 
      !((profile.liabilities as any[]) || []).some(
        (l: any) => l.description === TEST_DEBT_NAME
      );
    
    if (debtDeleted && liabilitiesUpdated) {
      console.log("🎉 DELETION TEST PASSED!");
      console.log("The debt was successfully removed from both:");
      console.log("  ✅ Debt Management Center (debts table)");
      console.log("  ✅ Intake Form Data (financial profile liabilities)");
    } else {
      console.log("⚠️  DELETION TEST PARTIALLY FAILED");
      if (!debtDeleted) {
        console.log("  ❌ Debt still exists in debts table");
      }
      if (!liabilitiesUpdated) {
        console.log("  ❌ Debt still exists in financial profile");
      }
    }
    
    console.log("=".repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during verification:", error);
    process.exit(1);
  }
}

// Run the verification
verifyDebtDeletion();