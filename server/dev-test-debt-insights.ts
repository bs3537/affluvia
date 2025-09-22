import 'dotenv/config';
import { generateDebtInsightsForUser } from './debt-gemini-insights';

async function main() {
  const userId = Number(process.argv[2] || '13');
  const { insights } = await generateDebtInsightsForUser(userId);
  console.log('Generated', insights.length, 'insights');
  for (const i of insights) {
    console.log('-', `[${i.priority}]`, i.title, '=> $', i.potentialSavings || 0);
  }
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});

