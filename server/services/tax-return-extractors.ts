function toNumber(x: any): number | undefined {
  if (x == null) return undefined;
  const n = Number(String(x).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function grabContext(text: string, idxStart: number, idxEnd: number): string {
  const pad = 120; // capture ~120 chars around match
  const start = Math.max(0, idxStart - pad);
  const end = Math.min(text.length, idxEnd + pad);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export interface Extracted1040Fields {
  adjustedGrossIncome?: number;
  totalDeductions?: number;
  taxableIncome?: number;
  federalTaxesPaid?: number;
  stateTaxesPaid?: number;
  filingStatus?: string | null;
  dependentCount?: number;
  snippets: Array<{ field: string; context: string }>;
}

export function extract1040Fields(raw: string): Extracted1040Fields {
  const text = (raw || "").replace(/\u00A0/g, " ");
  const out: Extracted1040Fields = { snippets: [] };

  const patterns: Array<{ key: keyof Extracted1040Fields; re: RegExp[] }> = [
    {
      key: "adjustedGrossIncome",
      re: [
        /(line\s*11\b[^\n]*?)\$?\s*([\d,]+(?:\.\d{2})?)/i,
        /(adjusted\s*gross\s*income[^\n]*?)\$?\s*([\d,]+(?:\.\d{2})?)/i,
      ],
    },
    {
      key: "totalDeductions",
      re: [
        /(line\s*12\b[^\n]*?)\$?\s*([\d,]+(?:\.\d{2})?)/i,
        /(standard\s*deduction[^\n]*?)\$?\s*([\d,]+(?:\.\d{2})?)/i,
        /(itemized\s*deductions[^\n]*?)\$?\s*([\d,]+(?:\.\d{2})?)/i,
      ],
    },
    {
      key: "taxableIncome",
      re: [
        /(line\s*15\b[^\n]*?)\$?\s*([\d,]+(?:\.\d{2})?)/i,
        /(taxable\s*income[^\n]*?)\$?\s*([\d,]+(?:\.\d{2})?)/i,
      ],
    },
    {
      key: "federalTaxesPaid",
      re: [
        /(line\s*24\b[^\n]*?)\$?\s*([\d,]+(?:\.\d{2})?)/i,
        /(total\s*tax\b[^\n]*?)\$?\s*([\d,]+(?:\.\d{2})?)/i,
      ],
    },
  ];

  for (const { key, re } of patterns) {
    for (const rx of re) {
      const m = text.match(rx);
      if (m) {
        const val = toNumber(m[2]);
        if (val != null) {
          (out as any)[key] = Math.round(val);
          out.snippets.push({ field: String(key), context: grabContext(text, m.index || 0, (m.index || 0) + m[0].length) });
          break;
        }
      }
    }
  }

  // Filing status (best-effort)
  const fs = text.match(/(Single|Married filing jointly|Married filing separately|Head of household|Qualifying surviving spouse)/i);
  if (fs) {
    out.filingStatus = fs[1];
    out.snippets.push({ field: "filingStatus", context: grabContext(text, fs.index || 0, (fs.index || 0) + fs[0].length) });
  }

  // Dependents (best-effort count)
  const depMatches = text.match(/Dependents?/gi);
  if (depMatches && depMatches.length > 0) {
    out.dependentCount = out.dependentCount ?? undefined; // leave undefined; deriving exact count robustly needs structured forms
  }

  return out;
}

