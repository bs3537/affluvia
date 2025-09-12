
import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';
import { resolve4 } from 'node:dns/promises';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Parse DATABASE_URL
const url = new URL(process.env.DATABASE_URL);
const host = url.hostname;
const port = Number(url.port || 6543); // Default to pooler port
const user = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
const database = decodeURIComponent(url.pathname.replace(/^\//, ''));

// Initialize IPv4 host resolution
let ipv4Host = host;
const resolveIPv4 = async () => {
  try {
    const addrs = await resolve4(host);
    if (addrs.length) {
      ipv4Host = addrs[0];
      console.log(`[Database] Resolved ${host} -> ${ipv4Host} (IPv4)`);
    }
  } catch (e) {
    console.warn(`[Database] IPv4 DNS resolve failed for ${host}, falling back to hostname:`, e?.message || e);
  }
};

// Resolve IPv4 asynchronously
resolveIPv4();

// Transaction pooler connection with conservative settings
const pool = new Pool({
  host: ipv4Host,
  port,
  database,
  user,
  password,
  max: Number(process.env.DB_POOL_MAX || 10),
  min: Number(process.env.DB_POOL_MIN || 1),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 10000),
  connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT || 30000),
  query_timeout: Number(process.env.DB_QUERY_TIMEOUT || 60000),
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT || 60000),
  idle_in_transaction_session_timeout: 120000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: { rejectUnauthorized: false, require: true },
  application_name: 'affluvia-app',
  allowExitOnIdle: true
});

pool.on('error', (err) => {
  console.error('[Database] Pool error:', err);
});

pool.on('connect', (client) => {
  // Wrap session-level settings in try/catch as they may be ignored in transaction pooling
  client.query('SET statement_timeout = 60000').catch(err => {
    console.error('[Database] Failed to set statement timeout:', err);
  });
  client.query('SET lock_timeout = 10000').catch(err => {
    console.error('[Database] Failed to set lock timeout:', err);
  });
});

const db = drizzlePg(pool, { schema });

// Graceful shutdown
let dbShuttingDown = false;
const gracefulShutdown = async (signal: string) => {
  if (dbShuttingDown) return;
  dbShuttingDown = true;
  console.log(`[Database] ${signal} received, closing pool...`);
  try {
    await pool.end();
    console.log('[Database] Pool closed successfully');
  } catch (err) {
    console.error('[Database] Error closing pool:', err);
  } finally {
    // Exit to prevent continued use after pool end during dev restarts
    setTimeout(() => process.exit(0), 0);
  }
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return false;
  }
}

// Get pool statistics for monitoring
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
}

console.log('[Database] Using TRANSACTION POOLER connection (IPv4) with conservative pool settings');

export { db, pool };
