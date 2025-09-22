import 'dotenv/config';
import { db } from './db';
import { debtScenarios, users } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const userIdArg = process.argv[2];
  if (!userIdArg) {
    console.error('Usage: tsx server/inspect-debt-scenarios.ts <userId>');
    process.exit(1);
  }
  const userId = parseInt(userIdArg, 10);
  if (Number.isNaN(userId)) {
    console.error('Invalid userId');
    process.exit(1);
  }

  // Verify user exists (optional)
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user.length === 0) {
    console.error(`User ${userId} not found`);
  }

  const rows = await db
    .select()
    .from(debtScenarios)
    .where(eq(debtScenarios.userId, userId))
    .orderBy(desc(debtScenarios.createdAt));

  console.log(`Found ${rows.length} debt scenario(s) for user ${userId}`);
  for (const r of rows) {
    console.log(`- [${r.id}] ${r.scenarioName} | type=${r.scenarioType} | payoffDate=${r.payoffDate} | months=${r.monthsToPayoff} | interestSaved=${r.interestSaved}`);
  }
}

main().catch((e) => {
  console.error('Error inspecting debt scenarios:', e);
  process.exit(1);
});

