import fs from 'node:fs';
import path from 'node:path';

export interface HistoricalReturns {
  usStocks: number[];
  intlStocks: number[];
  bonds: number[];
  reits: number[];
  cash: number[];
}

let cached: HistoricalReturns | null = null;

export function loadHistoricalReturns(): HistoricalReturns | null {
  if (cached) return cached;
  const candidates = [
    path.join(process.cwd(), 'data', 'historical-returns.json'),
    path.join(process.cwd(), 'server', 'data', 'historical-returns.json')
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const obj = JSON.parse(raw);
        if (obj && obj.usStocks && obj.intlStocks && obj.bonds && obj.reits && obj.cash) {
          cached = obj as HistoricalReturns;
          return cached;
        }
      }
    } catch {}
  }
  return null;
}
