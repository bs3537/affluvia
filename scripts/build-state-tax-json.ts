/**
 * Build full 50-state + DC income tax dataset (2024) into server/state-tax-2024.json
 * Data source: Tax Foundation – State Individual Income Tax Rates and Brackets, 2024 (Excel)
 * URL: https://taxfoundation.org/wp-content/uploads/2024/02/State-Individual-Income-Tax-Rates-and-Brackets-2015-2024_Tax_Foundation.xlsx
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import * as XLSX from 'xlsx';

interface StateTaxBracket { min: number; max: number; rate: number; }
interface StateConfigOut {
  name: string;
  abbreviation: string;
  hasIncomeTax: boolean;
  standardDeduction: { single: number; married: number };
  brackets: { single: StateTaxBracket[]; married: StateTaxBracket[] };
  retireeExemptions?: { pensionExemption?: number; socialSecurityTaxed?: boolean; ageThreshold?: number };
}

const EXCEL_URL = 'https://taxfoundation.org/wp-content/uploads/2024/02/State-Individual-Income-Tax-Rates-and-Brackets-2015-2024_Tax_Foundation.xlsx';

async function main() {
  console.log('Downloading Tax Foundation dataset...');
  const res = await fetch(EXCEL_URL);
  if (!res.ok) throw new Error('Failed to download Excel: ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log('Parsing workbook...');
  const wb = XLSX.read(buf, { type: 'buffer' });

  // Use 2024 sheet directly
  const sheetName = wb.SheetNames.includes('2024') ? '2024' : wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][];

  // Find header row index and column indices
  let headerIdx = rows.findIndex(r => Array.isArray(r) && r.some(c => typeof c === 'string' && /State/i.test(c)));
  if (headerIdx < 0) throw new Error('Header row not found');
  const header = rows[headerIdx].map((x: any) => (x || '').toString().trim());

  const idxState = header.findIndex((h: string) => /^State$/i.test(h));
  let idxSingleRates = header.findIndex((h: string) => /Single.*Rates/i.test(h));
  let idxSingleBrk = header.findIndex((h: string) => /Single.*Brackets/i.test(h));
  let idxMarriedRates = header.findIndex((h: string) => /Married.*Rates/i.test(h));
  let idxMarriedBrk = header.findIndex((h: string) => /Married.*Brackets/i.test(h));
  let idxStdSingle = header.findIndex((h: string) => /Standard Deduction.*Single/i.test(h));
  let idxStdMarried = header.findIndex((h: string) => /Standard Deduction.*Couple/i.test(h));

  // Fallback positional mapping for the 2024 sheet variant: State | Rates |  | Brackets | Rates |  | Brackets | Single | Couple | Single | Couple | Dependent
  if ([idxSingleRates, idxSingleBrk, idxMarriedRates, idxMarriedBrk].some(i => i < 0) && idxState === 0) {
    if ((header[1] || '').match(/Rates/i) && (header[3] || '').match(/Brackets/i) &&
        (header[4] || '').match(/Rates/i) && (header[6] || '').match(/Brackets/i)) {
      idxSingleRates = 1; idxSingleBrk = 3; idxMarriedRates = 4; idxMarriedBrk = 6;
    }
  }
  if (idxStdSingle < 0 && /Single/i.test(header[7] || '')) idxStdSingle = 7;
  if (idxStdMarried < 0 && /Couple/i.test(header[8] || '')) idxStdMarried = 8;

  if ([idxState, idxSingleRates, idxSingleBrk, idxMarriedRates, idxMarriedBrk].some(i => i < 0)) {
    throw new Error('Required columns not found in header: ' + header.join(' | '));
  }

  // Helper parsers
  const money = (s: string): number => {
    if (!s || s.toLowerCase() === 'n.a.' || s.toLowerCase() === 'na') return 0;
    const n = Number((s || '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const rate = (s: string): number => {
    if (!s || /none/i.test(s)) return 0;
    const n = Number((s || '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n / 100 : 0;
  };

  // Build state entries (some states span multiple rows: we accumulate by name)
  const map = new Map<string, StateConfigOut & { _single: Array<{ r: number; t: number }>; _married: Array<{ r: number; t: number }> }>();

  let lastStateName = '';
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    let stateCell = (r[idxState] || '').toString();
    stateCell = stateCell && stateCell.trim();
    if (!stateCell) stateCell = lastStateName; // carry forward state name across multiple rows
    if (!stateCell) continue;
    // Stop if reached next section
    if (/Notes:/i.test(stateCell)) break;
    lastStateName = stateCell;

    const singleRateStr = (r[idxSingleRates] || '').toString();
    const singleBrStr = (r[idxSingleBrk] || '').toString();
    const marriedRateStr = (r[idxMarriedRates] || '').toString();
    const marriedBrStr = (r[idxMarriedBrk] || '').toString();

    let entry = map.get(stateCell);
    if (!entry) {
      const stdSingle = idxStdSingle >= 0 ? money((r[idxStdSingle] || '').toString()) : 0;
      const stdMarried = idxStdMarried >= 0 ? money((r[idxStdMarried] || '').toString()) : 0;
      const abbr = normalizeAbbr(stateCell);
      entry = {
        name: stateCell,
        abbreviation: abbr,
        hasIncomeTax: true,
        standardDeduction: { single: stdSingle, married: stdMarried },
        brackets: { single: [], married: [] },
        retireeExemptions: { socialSecurityTaxed: false },
        _single: [],
        _married: []
      };
      map.set(stateCell, entry);
    }

    // Handle no-tax states
    if (/none/i.test(singleRateStr) || /none/i.test(marriedRateStr)) {
      entry.hasIncomeTax = false;
      entry._single = [];
      entry._married = [];
      continue;
    }

    // Handle NH & WA special notes in dataset (we still treat wages as not taxed)
    if (/New Hampshire/i.test(stateCell) || /Washington$/.test(stateCell)) {
      entry.hasIncomeTax = false;
      entry._single = [];
      entry._married = [];
      continue;
    }

    // Parse current row threshold and rate (\"> | $X")
    const sr = rate(singleRateStr);
    const sthr = money(singleBrStr);
    const mr = rate(marriedRateStr);
    const mthr = money(marriedBrStr);

    if (sr > 0 || sthr >= 0) entry._single.push({ r: sr, t: sthr });
    if (mr > 0 || mthr >= 0) entry._married.push({ r: mr, t: mthr });
  }

  // Finalize brackets: sort by threshold asc; convert to [min,max,rate]
  const out: Record<string, StateConfigOut> = {};
  const validAbbr = new Set<string>(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);
  for (const [name, e] of map) {
    if (!validAbbr.has(e.abbreviation)) continue;
    if (!e.hasIncomeTax) {
      out[e.abbreviation] = {
        name: e.name,
        abbreviation: e.abbreviation,
        hasIncomeTax: false,
        standardDeduction: e.standardDeduction,
        brackets: { single: [], married: [] },
        retireeExemptions: e.retireeExemptions
      };
      continue;
    }
    const s = e._single.sort((a,b)=>a.t-b.t);
    const m = e._married.sort((a,b)=>a.t-b.t);
    const sBr: StateTaxBracket[] = thresholdsToBrackets(s);
    const mBr: StateTaxBracket[] = thresholdsToBrackets(m);
    // Fallback flat if empty
    const finalS = sBr.length ? sBr : [{ min: 0, max: Infinity, rate: e._single[0]?.r || 0 }];
    const finalM = mBr.length ? mBr : [{ min: 0, max: Infinity, rate: e._married[0]?.r || 0 }];

    out[e.abbreviation] = {
      name: e.name,
      abbreviation: e.abbreviation,
      hasIncomeTax: finalS.length > 0 || finalM.length > 0,
      standardDeduction: e.standardDeduction,
      brackets: { single: finalS, married: finalM },
      retireeExemptions: e.retireeExemptions
    };
  }

  // Known no-wage-tax jurisdictions ensure false
  ['AK','FL','NV','SD','TN','TX','WY','NH','WA'].forEach(k => {
    if (out[k]) out[k].hasIncomeTax = false;
  });

  // Write JSON
  const dest = path.resolve(process.cwd(), 'server', 'state-tax-2024.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log('Wrote', Object.keys(out).length, 'state entries to', dest);
}

function thresholdsToBrackets(items: Array<{ r: number; t: number }>): StateTaxBracket[] {
  if (!items.length) return [];
  // Remove zero-rate rows (some states show 0% on $0 as a base row)
  const filtered = items.filter(x => x.r >= 0);
  filtered.sort((a,b)=>a.t-b.t);
  const br: StateTaxBracket[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const min = filtered[i].t;
    const max = i < filtered.length - 1 ? filtered[i+1].t : Infinity;
    br.push({ min, max, rate: filtered[i].r });
  }
  return br;
}

function normalizeAbbr(nameRaw: string): string {
  // Strip footnotes and non-letters, normalize spacing
  let s = (nameRaw || '').replace(/\(.*?\)/g, '');
  s = s.replace(/[^A-Za-z, ]+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\bD\.?\s*C\.?\b/i, 'DC');
  // Canonical names
  const nameMap: Record<string,string> = {
    'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO',
    'Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL',
    'Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
    'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT',
    'Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY',
    'North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA',
    'Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT',
    'Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
    'Washington, DC':'DC','District of Columbia':'DC'
  };
  // Try exact match
  for (const [nm, ab] of Object.entries(nameMap)) {
    if (s.toLowerCase() === nm.toLowerCase()) return ab;
  }
  // Try contains
  for (const [nm, ab] of Object.entries(nameMap)) {
    if (s.toLowerCase().includes(nm.toLowerCase())) return ab;
  }
  // Fallback: first two letters uppercased
  return s.substring(0,2).toUpperCase();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
