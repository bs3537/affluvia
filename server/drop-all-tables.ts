import { sql } from 'drizzle-orm';
import { db } from './db';

async function dropAllTables() {
  try {
    console.log('Dropping all tables...\n');
    
    // Get all table names
    const result = await db.execute(sql`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    const tables = result.rows as { tablename: string }[];
    
    // Drop each table
    for (const table of tables) {
      console.log(`Dropping table: ${table.tablename}`);
      await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table.tablename} CASCADE`));
    }
    
    console.log('\n✅ All tables dropped successfully!');
    console.log('\nNow run: npm run db:push');
    console.log('Then select option 1 (create column) for all prompts');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error dropping tables:', error);
    process.exit(1);
  }
}

dropAllTables();