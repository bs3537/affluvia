// Ensure DNS prefers IPv4 before any other imports run
import { setDefaultResultOrder } from 'node:dns';
try { setDefaultResultOrder('ipv4first'); } catch {}

// Load environment early
import dotenv from 'dotenv';
dotenv.config({ override: true });

// Defer loading the main server until after DNS/env is set
await import('./index');
