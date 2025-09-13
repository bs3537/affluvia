import fetch from 'node-fetch';

async function main() {
  const base = process.env.MC_BASE || 'http://localhost:3001';
  const cookie = process.env.MC_COOKIE || '';
  const headers: any = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;

  const seedA = 12345678;
  const seedB = 87654321;

  const call = async (seed: number) => {
    const res = await fetch(`${base}/api/calculate-retirement-monte-carlo`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ skipCache: true, seed })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  };

  console.log('Running API determinism test...');
  const a1 = await call(seedA);
  const a2 = await call(seedA);
  const b1 = await call(seedB);

  const fields = [
    'probabilityOfSuccess',
    'medianEndingBalance',
    'percentile10EndingBalance',
    'percentile90EndingBalance'
  ] as const;

  let okSame = true;
  for (const f of fields) {
    const v1 = Number(a1[f] || (a1.summary?.[f] ?? 0));
    const v2 = Number(a2[f] || (a2.summary?.[f] ?? 0));
    const same = Math.abs(v1 - v2) < 1e-6;
    console.log(`same-seed ${f}: ${v1} vs ${v2} => ${same ? 'OK' : 'DIFF'}`);
    if (!same) okSame = false;
  }

  let diffAny = false;
  for (const f of fields) {
    const v1 = Number(a1[f] || (a1.summary?.[f] ?? 0));
    const vB = Number(b1[f] || (b1.summary?.[f] ?? 0));
    if (Math.abs(v1 - vB) > 1e-6) diffAny = true;
  }
  console.log(`different-seed difference: ${diffAny ? 'OK' : 'NO-DIFF'}`);

  if (okSame && diffAny) console.log('✅ API determinism test passed.');
  else console.log('❌ API determinism test failed.');
}

main().catch(e => { console.error(e); process.exit(1); });

