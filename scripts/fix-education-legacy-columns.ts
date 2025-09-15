import { pool } from "../server/db.ts";

async function ensureNullable(client: any, table: string, column: string) {
  const res = await client.query(
    `SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column]
  );
  const isNullable = res.rows[0]?.is_nullable === 'YES';
  if (!isNullable) {
    console.log(`Dropping NOT NULL on ${table}.${column} ...`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL;`);
    console.log(`✅ ${table}.${column} is now nullable.`);
  } else {
    console.log(`${table}.${column} already nullable.`);
  }
}

async function renameIfMissing(client: any, table: string, fromCol: string, toCol: string) {
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  const names: string[] = cols.rows.map((r: any) => r.column_name);
  const hasFrom = names.includes(fromCol);
  const hasTo = names.includes(toCol);
  if (hasFrom && !hasTo) {
    console.log(`Renaming ${table}.${fromCol} -> ${toCol} ...`);
    await client.query(`ALTER TABLE ${table} RENAME COLUMN ${fromCol} TO ${toCol};`);
    console.log(`✅ Renamed ${fromCol} to ${toCol}.`);
  } else if (hasFrom && hasTo) {
    console.log(`Both ${fromCol} and ${toCol} exist; keeping ${toCol} and relaxing ${fromCol}.`);
    await ensureNullable(client, table, fromCol);
  } else {
    console.log(`No action for ${fromCol} -> ${toCol}.`);
  }
}

async function main() {
  console.log("🔧 Reconciling legacy education_goals columns with Drizzle schema...");
  const client = await pool.connect();
  try {
    // Ensure expected modern columns exist; if not, rename legacy
    await renameIfMissing(client, 'education_goals', 'child_name', 'student_name');
    await renameIfMissing(client, 'education_goals', 'child_age', 'student_birth_year');
    await renameIfMissing(client, 'education_goals', 'college_start_year', 'start_year');

    // Make sure legacy columns (if retained) are nullable and non-blocking
    const legacy = ['child_name', 'child_age', 'college_start_year'];
    for (const col of legacy) {
      const exists = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='education_goals' AND column_name=$1`,
        [col]
      );
      if (exists.rowCount) {
        await ensureNullable(client, 'education_goals', col);
      }
    }

    console.log("✅ Education schema reconciliation complete.");
  } finally {
    client.release();
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

