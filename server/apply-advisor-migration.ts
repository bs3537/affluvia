import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
  const sql = async (text: string) => {
    const client = await pool.connect();
    try { await client.query(text); } finally { client.release(); }
  };

  console.log('Applying advisor support migration…');
  // 1) users columns
  await sql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS full_name text,
      ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'individual';
  `);

  // 2) advisor_clients table
  await sql(`
    CREATE TABLE IF NOT EXISTS advisor_clients (
      id serial PRIMARY KEY,
      advisor_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'active',
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT advisor_clients_unique UNIQUE (advisor_id, client_id)
    );
  `);
  await sql(`CREATE INDEX IF NOT EXISTS idx_advisor_clients_advisor ON advisor_clients(advisor_id);`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_advisor_clients_client ON advisor_clients(client_id);`);

  // 3) advisor_invites table
  await sql(`
    CREATE TABLE IF NOT EXISTS advisor_invites (
      id serial PRIMARY KEY,
      advisor_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email text NOT NULL,
      token_hash text NOT NULL,
      status text NOT NULL DEFAULT 'sent',
      expires_at timestamp with time zone NOT NULL,
      client_id integer REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamp DEFAULT now()
    );
  `);
  await sql(`CREATE INDEX IF NOT EXISTS idx_advisor_invites_email ON advisor_invites(email);`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_advisor_invites_token_hash ON advisor_invites(token_hash);`);

  // 4) advisor_audit_logs table
  await sql(`
    CREATE TABLE IF NOT EXISTS advisor_audit_logs (
      id serial PRIMARY KEY,
      actor_advisor_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity text NOT NULL,
      entity_id integer,
      action text NOT NULL,
      before jsonb,
      after jsonb,
      created_at timestamp DEFAULT now()
    );
  `);
  await sql(`CREATE INDEX IF NOT EXISTS idx_advisor_audit_client_created ON advisor_audit_logs(client_id, created_at);`);

  await pool.end();
  console.log('✓ Advisor migration applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
