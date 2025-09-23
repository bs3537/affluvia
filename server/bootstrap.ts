// Ensure DNS prefers IPv4 before any other imports run
import { setDefaultResultOrder } from 'node:dns';
try { setDefaultResultOrder('ipv4first'); } catch {}

// Load environment early
import dotenv from 'dotenv';
dotenv.config({ override: true });

// Ensure PATH includes common Homebrew locations for CLI tools used by OCR (pdftoppm, tesseract)
try {
  const extra = ['/opt/homebrew/bin', '/usr/local/bin'];
  const sep = process.platform === 'win32' ? ';' : ':';
  const curr = process.env.PATH || '';
  const parts = new Set(curr.split(sep).filter(Boolean));
  for (const p of extra) parts.add(p);
  process.env.PATH = Array.from(parts).join(sep);
} catch {}

// Defer loading the main server until after DNS/env is set
await import('./index');
