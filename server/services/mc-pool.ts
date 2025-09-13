import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Piscina from 'piscina';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const maxThreads = Math.min(8, Math.max(2, os.cpus().length));

// Resolve worker file path for dev (TS) vs prod (compiled JS)
const tsWorkerPath = path.resolve(__dirname, '../workers/monte-carlo.worker.ts');
const jsWorkerPath = path.resolve(__dirname, '../workers/monte-carlo.worker.js');

const workerFilename = fs.existsSync(jsWorkerPath) ? jsWorkerPath : tsWorkerPath;
const workerExecArgv = workerFilename.endsWith('.ts') ? ['--import=tsx'] : [];

console.log(`[MC Pool] Initializing Piscina pool with ${maxThreads} max threads (worker: ${path.basename(workerFilename)})`);

export const mcPool = new Piscina({
  filename: workerFilename,
  minThreads: Math.min(2, maxThreads),
  maxThreads,
  idleTimeout: 30_000,
  // Use default TaskQueue for better compatibility
  concurrentTasksPerWorker: 1, // Each worker handles one MC simulation at a time
  execArgv: workerExecArgv, // Use tsx in dev, none in prod
});

// Graceful shutdown (ensure process exits promptly to avoid half-closed state during dev restarts)
let mcShuttingDown = false;
async function shutdownPool(signal: string) {
  if (mcShuttingDown) return;
  mcShuttingDown = true;
  try {
    console.log(`[MC Pool] ${signal} received, destroying worker pool...`);
    await mcPool.destroy();
  } catch (e) {
    console.warn('[MC Pool] Destroy failed:', (e as any)?.message || e);
  } finally {
    // Exit to allow tsx/vite to restart cleanly without using destroyed resources
    setTimeout(() => process.exit(0), 0);
  }
}

process.on('SIGTERM', () => void shutdownPool('SIGTERM'));
process.on('SIGINT', () => void shutdownPool('SIGINT'));
