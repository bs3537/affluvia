import { db } from './db.js';
import { sql } from 'drizzle-orm';

async function checkPlaidAccounts() {
  try {
    const accounts = await db.execute(sql`
      SELECT 
        account_id,
        name,
        official_name,
        type,
        subtype,
        current_balance,
        institution_name
      FROM plaid_accounts
      ORDER BY type, subtype
    `);
    
    console.log('\nAll Plaid Accounts in Database:');
    console.log('================================');
    accounts.rows.forEach((acc: any) => {
      console.log(`
Account: ${acc.name || acc.official_name}
  - ID: ${acc.account_id}
  - Type: ${acc.type}
  - Subtype: ${acc.subtype}
  - Balance: $${acc.current_balance}
  - Institution: ${acc.institution_name || 'Unknown'}
      `);
    });
    
    const mortgages = accounts.rows.filter((acc: any) => 
      acc.type === 'loan' && acc.subtype === 'mortgage'
    );
    
    console.log(`\nMortgage Accounts Found: ${mortgages.length}`);
    
    if (mortgages.length > 0) {
      console.log('\nMortgage Details:');
      mortgages.forEach((m: any) => {
        console.log(`- ${m.name}: $${Math.abs(m.current_balance)} (${m.institution_name})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPlaidAccounts();