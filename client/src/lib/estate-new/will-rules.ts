export type WillStateRule = {
  state: string;
  witnessCount: number;
  allowSelfProving: boolean;
  notes?: string;
  citationUrl?: string;
  eWillAllowed?: boolean; // informational only; UX still defaults to paper signing
};

// Minimal starter rules (conservative defaults). Many states: 2 witnesses; self‑proving affidavit generally allowed.
const RULES: Record<string, WillStateRule> = {
  AL: { state: 'AL', witnessCount: 2, allowSelfProving: true, citationUrl: 'https://www.nolo.com/legal-encyclopedia/self-proving-affidavits.html' },
  AK: { state: 'AK', witnessCount: 2, allowSelfProving: true },
  AZ: { state: 'AZ', witnessCount: 2, allowSelfProving: true, eWillAllowed: true, citationUrl: 'https://www.uniformlaws.org/acts/catalog/current/E' },
  CA: { state: 'CA', witnessCount: 2, allowSelfProving: true, citationUrl: 'https://www.nolo.com/legal-encyclopedia/how-sign-your-will-the-will-signing-ceremony.html' },
  CO: { state: 'CO', witnessCount: 2, allowSelfProving: true },
  CT: { state: 'CT', witnessCount: 2, allowSelfProving: true },
  DC: { state: 'DC', witnessCount: 2, allowSelfProving: false, notes: 'Self‑proving affidavit not recognized; follow local probate guidance.', citationUrl: 'https://www.law.cornell.edu/wex/self-proving_will' },
  FL: { state: 'FL', witnessCount: 2, allowSelfProving: true, eWillAllowed: true, citationUrl: 'https://www.docusign.com/blog/are-electronic-signatures-legal' },
  GA: { state: 'GA', witnessCount: 2, allowSelfProving: true },
  ID: { state: 'ID', witnessCount: 2, allowSelfProving: true },
  IL: { state: 'IL', witnessCount: 2, allowSelfProving: true },
  IN: { state: 'IN', witnessCount: 2, allowSelfProving: true },
  LA: { state: 'LA', witnessCount: 2, allowSelfProving: true, notes: 'Louisiana has unique will formalities; consider attorney review.' },
  MD: { state: 'MD', witnessCount: 2, allowSelfProving: false, notes: 'Affidavit treatment differs; check local guidance.' },
  MA: { state: 'MA', witnessCount: 2, allowSelfProving: true },
  MI: { state: 'MI', witnessCount: 2, allowSelfProving: true },
  MN: { state: 'MN', witnessCount: 2, allowSelfProving: true },
  NC: { state: 'NC', witnessCount: 2, allowSelfProving: true, eWillAllowed: true, citationUrl: 'https://lrs.sog.unc.edu/lrs-subscr-view/bills_summaries/531029/S307' },
  NJ: { state: 'NJ', witnessCount: 2, allowSelfProving: true },
  NV: { state: 'NV', witnessCount: 2, allowSelfProving: true, eWillAllowed: true, citationUrl: 'https://www.uniformlaws.org/acts/catalog/current/E' },
  NY: { state: 'NY', witnessCount: 2, allowSelfProving: true },
  OH: { state: 'OH', witnessCount: 2, allowSelfProving: false, citationUrl: 'https://www.law.cornell.edu/wex/self-proving_will' },
  OR: { state: 'OR', witnessCount: 2, allowSelfProving: true },
  PA: { state: 'PA', witnessCount: 2, allowSelfProving: true },
  TN: { state: 'TN', witnessCount: 2, allowSelfProving: true },
  TX: { state: 'TX', witnessCount: 2, allowSelfProving: true },
  UT: { state: 'UT', witnessCount: 2, allowSelfProving: true },
  VA: { state: 'VA', witnessCount: 2, allowSelfProving: true },
  VT: { state: 'VT', witnessCount: 2, allowSelfProving: false, citationUrl: 'https://www.law.cornell.edu/wex/self-proving_will' },
  WA: { state: 'WA', witnessCount: 2, allowSelfProving: true },
  WI: { state: 'WI', witnessCount: 2, allowSelfProving: true },
};

export function getWillRules(stateCode?: string): WillStateRule {
  const key = String(stateCode || '').trim().toUpperCase();
  if (key && RULES[key]) return RULES[key];
  return { state: key || '—', witnessCount: 2, allowSelfProving: true, citationUrl: 'https://www.nolo.com/legal-encyclopedia/how-sign-your-will-the-will-signing-ceremony.html' };
}
