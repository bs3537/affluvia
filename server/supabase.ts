import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.warn('[Supabase] SUPABASE_URL is not set. Set it to your project URL.');
}

// Prefer service role on server; fall back to anon if necessary (RLS must allow intended operations)
const serverKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

export const supabaseServer: SupabaseClient | null = (SUPABASE_URL && serverKey)
  ? createClient(SUPABASE_URL, serverKey, { auth: { persistSession: false } })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabaseServer) {
    throw new Error('Supabase server client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).');
  }
  return supabaseServer;
}

