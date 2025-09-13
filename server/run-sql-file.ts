import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: tsx server/run-sql-file.ts <path-to-sql-file>');
    process.exit(1);
  }

  const sqlPath = path.resolve(process.cwd(), fileArg);
  const sql = await fs.readFile(sqlPath, 'utf8');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL must be set');
    process.exit(1);
  }

  // Supabase typically requires SSL even in dev; enforce SSL here.
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  const client = await pool.connect();
  try {
    console.log(`Applying SQL from: ${sqlPath}`);
    await client.query(sql);
    console.log('✓ SQL applied successfully');
  } catch (err) {
    console.error('Failed to apply SQL:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

