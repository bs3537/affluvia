import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Piscina from 'piscina';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const maxThreads = Math.min(8, Math.max(2, os.cpus().length));

const tsWorkerPath = path.resolve(__dirname, '../workers/education-optimizer.worker.ts');
const jsWorkerPath = path.resolve(__dirname, '../workers/education-optimizer.worker.js');

const workerFilename = fs.existsSync(jsWorkerPath) ? jsWorkerPath : tsWorkerPath;
const workerExecArgv = workerFilename.endsWith('.ts') ? ['--import=tsx'] : [];

console.log(`[Education Optimizer] Piscina pool using ${maxThreads} threads (${path.basename(workerFilename)})`);

export const educationOptimizerPool = new Piscina({
  filename: workerFilename,
  minThreads: Math.min(2, maxThreads),
  maxThreads,
  idleTimeout: 30_000,
  concurrentTasksPerWorker: 1,
  execArgv: workerExecArgv,
});

let shuttingDown = false;
async function shutdownPool(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    console.log(`[Education Optimizer] ${signal} received, shutting down pool`);
    await educationOptimizerPool.destroy();
  } catch (err) {
    console.warn('[Education Optimizer] destroy failed:', (err as any)?.message || err);
  } finally {
    setTimeout(() => process.exit(0), 0);
  }
}

process.on('SIGTERM', () => void shutdownPool('SIGTERM'));
process.on('SIGINT', () => void shutdownPool('SIGINT'));

