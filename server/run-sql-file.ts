/**
 * Apply a SQL migration file to the configured database.
 * Usage: npx tsx server/run-sql-file.ts migrations/0011_add_advisor_support.sql
 */
import pg from 'pg';
const { Pool } = pg;
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: tsx server/run-sql-file.ts <path-to-sql>');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL must be set');
    process.exit(1);
  }

  const absPath = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(absPath, 'utf8');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  console.log(`Applying migration file: ${absPath}`);

  // Basic split by semicolon; skip comments and blank lines.
  const statements = content
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const [i, stmt] of statements.entries()) {
    try {
      console.log(`\n[${i+1}/${statements.length}] Executing:`);
      console.log(stmt.substring(0, 160) + (stmt.length > 160 ? '…' : ''));
      const client = await pool.connect();
      try {
        await client.query(stmt);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Statement ${i+1} failed:`);
      console.error(err);
      process.exit(1);
    }
  }

  await pool.end();
  console.log('\n✓ Migration applied successfully');
}

main();
