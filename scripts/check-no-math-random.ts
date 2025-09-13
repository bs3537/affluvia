#!/usr/bin/env tsx
/**
 * Lint check to prevent Math.random() usage in Monte Carlo engine files.
 * Scans selected server modules and fails with non-zero exit if any match is found.
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const targets = [
  'server/monte-carlo-enhanced.ts',
  'server/ltc-modeling.ts',
  'server/mortality-tables.ts',
  'server/stochastic-life-expectancy.ts',
];

let violations: string[] = [];

for (const rel of targets) {
  const file = path.join(repoRoot, rel);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (line.includes('Math.random(')) {
      violations.push(`${rel}:${idx + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('\n❌ Math.random() found in Monte Carlo engine files:');
  console.error(violations.map(v => '  ' + v).join('\n'));
  process.exit(1);
} else {
  console.log('✅ No Math.random() found in selected Monte Carlo engine files.');
}

