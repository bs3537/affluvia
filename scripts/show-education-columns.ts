import { pool } from "../server/db.ts";

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='education_goals' ORDER BY ordinal_position`
    );
    console.table(res.rows);
  } finally {
    client.release();
  }
}

main().then(()=>process.exit(0)).catch(err=>{console.error(err);process.exit(1)});

