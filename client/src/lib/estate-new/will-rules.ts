export type WillStateRule = {
  state: string;
  witnessCount: number;
  allowSelfProving: boolean;
  notes?: string;
  citationUrl?: string;
  eWillAllowed?: boolean; // informational only; UX still defaults to paper signing
  tip?: string; // short user-facing tip for modal and review
};

// Minimal starter rules (conservative defaults). Many states: 2 witnesses; self‑proving affidavit generally allowed.
const RULES: Record<string, WillStateRule> = {
  AL: { state: 'AL', witnessCount: 2, allowSelfProving: true, citationUrl: 'https://www.nolo.com/legal-encyclopedia/self-proving-affidavits.html' },
  AK: { state: 'AK', witnessCount: 2, allowSelfProving: true },
  AZ: { state: 'AZ', witnessCount: 2, allowSelfProving: true, eWillAllowed: true, citationUrl: 'https://www.uniformlaws.org/acts/catalog/current/E', tip: 'Community property state; spousal rights can affect distribution.' },
  CA: { state: 'CA', witnessCount: 2, allowSelfProving: true, citationUrl: 'https://www.nolo.com/legal-encyclopedia/how-sign-your-will-the-will-signing-ceremony.html', tip: 'Community property state; consider spousal consent and characterization.' },
  CO: { state: 'CO', witnessCount: 2, allowSelfProving: true },
  CT: { state: 'CT', witnessCount: 2, allowSelfProving: true },
  DC: { state: 'DC', witnessCount: 2, allowSelfProving: false, notes: 'Self‑proving affidavit not recognized; follow local probate guidance.', citationUrl: 'https://www.law.cornell.edu/wex/self-proving_will', tip: 'Expect witnesses to be called unless other proof is provided.' },
  FL: { state: 'FL', witnessCount: 2, allowSelfProving: true, eWillAllowed: true, citationUrl: 'https://www.docusign.com/blog/are-electronic-signatures-legal' },
  GA: { state: 'GA', witnessCount: 2, allowSelfProving: true },
  HI: { state: 'HI', witnessCount: 2, allowSelfProving: true },
  ID: { state: 'ID', witnessCount: 2, allowSelfProving: true },
  IL: { state: 'IL', witnessCount: 2, allowSelfProving: true },
  IN: { state: 'IN', witnessCount: 2, allowSelfProving: true },
  IA: { state: 'IA', witnessCount: 2, allowSelfProving: true },
  KS: { state: 'KS', witnessCount: 2, allowSelfProving: true },
  KY: { state: 'KY', witnessCount: 2, allowSelfProving: true },
  LA: { state: 'LA', witnessCount: 2, allowSelfProving: true, notes: 'Louisiana has unique will formalities; consider attorney review.', tip: 'Civil law state; formality traps common—review carefully.' },
  ME: { state: 'ME', witnessCount: 2, allowSelfProving: true },
  MD: { state: 'MD', witnessCount: 2, allowSelfProving: false, notes: 'Affidavit treatment differs; check local guidance.' },
  MA: { state: 'MA', witnessCount: 2, allowSelfProving: true },
  MI: { state: 'MI', witnessCount: 2, allowSelfProving: true },
  MN: { state: 'MN', witnessCount: 2, allowSelfProving: true },
  MS: { state: 'MS', witnessCount: 2, allowSelfProving: true },
  MO: { state: 'MO', witnessCount: 2, allowSelfProving: true },
  MT: { state: 'MT', witnessCount: 2, allowSelfProving: true },
  NE: { state: 'NE', witnessCount: 2, allowSelfProving: true },
  NC: { state: 'NC', witnessCount: 2, allowSelfProving: true, eWillAllowed: true, citationUrl: 'https://lrs.sog.unc.edu/lrs-subscr-view/bills_summaries/531029/S307' },
  NJ: { state: 'NJ', witnessCount: 2, allowSelfProving: true },
  NV: { state: 'NV', witnessCount: 2, allowSelfProving: true, eWillAllowed: true, citationUrl: 'https://www.uniformlaws.org/acts/catalog/current/E' },
  NH: { state: 'NH', witnessCount: 2, allowSelfProving: true },
  NY: { state: 'NY', witnessCount: 2, allowSelfProving: true },
  OH: { state: 'OH', witnessCount: 2, allowSelfProving: false, citationUrl: 'https://www.law.cornell.edu/wex/self-proving_will' },
  OK: { state: 'OK', witnessCount: 2, allowSelfProving: true },
  OR: { state: 'OR', witnessCount: 2, allowSelfProving: true },
  PA: { state: 'PA', witnessCount: 2, allowSelfProving: true },
  RI: { state: 'RI', witnessCount: 2, allowSelfProving: true },
  SC: { state: 'SC', witnessCount: 2, allowSelfProving: true },
  SD: { state: 'SD', witnessCount: 2, allowSelfProving: true },
  TN: { state: 'TN', witnessCount: 2, allowSelfProving: true },
  TX: { state: 'TX', witnessCount: 2, allowSelfProving: true, tip: 'Community property state; consider spousal characterization.' },
  UT: { state: 'UT', witnessCount: 2, allowSelfProving: true },
  VA: { state: 'VA', witnessCount: 2, allowSelfProving: true },
  VT: { state: 'VT', witnessCount: 2, allowSelfProving: false, citationUrl: 'https://www.law.cornell.edu/wex/self-proving_will' },
  WA: { state: 'WA', witnessCount: 2, allowSelfProving: true, tip: 'Community property state; document spousal interests.' },
  WV: { state: 'WV', witnessCount: 2, allowSelfProving: true },
  WI: { state: 'WI', witnessCount: 2, allowSelfProving: true, tip: 'Community property state (marital property) considerations apply.' },
  WY: { state: 'WY', witnessCount: 2, allowSelfProving: true },
};

export function getWillRules(stateCode?: string): WillStateRule {
  const key = String(stateCode || '').trim().toUpperCase();
  if (key && RULES[key]) return RULES[key];
  return { state: key || '—', witnessCount: 2, allowSelfProving: true, citationUrl: 'https://www.nolo.com/legal-encyclopedia/how-sign-your-will-the-will-signing-ceremony.html' };
}
