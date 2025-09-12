import { db } from "./server/db";
import { debts, financialProfiles } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkTestDebt() {
  const TEST_USER_ID = 1;
  const TEST_DEBT_NAME = "TEST Credit Card - DELETE ME";
  
  console.log("🔍 Checking for test debt...\n");
  
  // Check debts table
  const allDebts = await db
    .select()
    .from(debts)
    .where(eq(debts.userId, TEST_USER_ID));
  
  const testDebt = allDebts.find(d => d.debtName === TEST_DEBT_NAME);
  
  if (testDebt) {
    console.log("✅ Test debt found in debts table:");
    console.log("   ID:", testDebt.id);
    console.log("   Name:", testDebt.debtName);
    console.log("   Balance:", testDebt.currentBalance);
    console.log("   Type:", testDebt.debtType);
  } else {
    console.log("❌ Test debt NOT found in debts table");
  }
  
  // Check financial profile
  const [profile] = await db
    .select()
    .from(financialProfiles)
    .where(eq(financialProfiles.userId, TEST_USER_ID))
    .limit(1);
  
  if (profile) {
    const liabilities = (profile.liabilities as any[]) || [];
    const testLiability = liabilities.find(
      (l: any) => l.description === TEST_DEBT_NAME
    );
    
    if (testLiability) {
      console.log("\n✅ Test debt found in financial profile:");
      console.log("   Description:", testLiability.description);
      console.log("   Balance:", testLiability.balance);
      console.log("   Interest:", testLiability.interestRate);
    } else {
      console.log("\n❌ Test debt NOT found in financial profile");
    }
  }
  
  console.log("\n📊 Summary of all debts:");
  console.log(`Total debts in system: ${allDebts.length}`);
  allDebts.forEach(debt => {
    console.log(`  - [ID: ${debt.id}] ${debt.debtName}: $${debt.currentBalance}`);
  });
  
  process.exit(0);
}

checkTestDebt();