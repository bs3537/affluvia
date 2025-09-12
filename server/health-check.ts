import 'dotenv/config';
import { pool } from './db';
import { requireSupabase } from './supabase';

async function main() {
  const result: any = { db: { ok: false }, supabase: { ok: false } };
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT NOW() as now');
      result.db = {
        ok: true,
        now: r.rows?.[0]?.now,
        pool: {
          total: (pool as any).totalCount ?? undefined,
          idle: (pool as any).idleCount ?? undefined,
          waiting: (pool as any).waitingCount ?? undefined,
        }
      };
    } finally {
      client.release();
    }
  } catch (e: any) {
    result.db = { ok: false, error: e?.message || 'DB error' };
  }

  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    result.supabase = { ok: true, sample: (data && data.length) ? data[0] : null };
  } catch (e: any) {
    result.supabase = { ok: false, error: e?.message || 'Supabase error' };
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main();

