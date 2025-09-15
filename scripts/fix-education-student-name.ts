import { pool } from "../server/db.ts";

async function main() {
  console.log("Checking education_goals column naming...");
  const client = await pool.connect();
  try {
    const colsRes = await client.query(
      `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'education_goals'`
    );
    const cols = colsRes.rows.map(r => r.column_name);
    const hasStudent = cols.includes("student_name");
    const hasChild = cols.includes("child_name");
    console.log("Columns:", cols.join(", "));

    if (!hasChild && !hasStudent) {
      console.log("Neither child_name nor student_name present; nothing to do.");
      return;
    }

    if (hasChild && !hasStudent) {
      console.log("Renaming column child_name -> student_name ...");
      await client.query(`ALTER TABLE education_goals RENAME COLUMN child_name TO student_name;`);
      console.log("Done. Verifying...");
      const verify = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'education_goals' AND column_name = 'student_name'`
      );
      if (verify.rows.length === 1) {
        console.log("✅ student_name column is now present.");
      } else {
        throw new Error("student_name column not found after rename");
      }
    } else if (hasStudent && hasChild) {
      // Ensure legacy child_name is nullable to avoid NOT NULL violations on insert
      const childRow = colsRes.rows.find(r => r.column_name === 'child_name');
      if (childRow && childRow.is_nullable === 'NO') {
        console.log("Dropping NOT NULL constraint on legacy column child_name ...");
        await client.query(`ALTER TABLE education_goals ALTER COLUMN child_name DROP NOT NULL;`);
        console.log("✅ child_name is now nullable.");
      } else {
        console.log("child_name is already nullable.");
      }
      console.log("student_name already present. No rename required.");
      return;
    }
  } finally {
    client.release();
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
