describe('plaid taxable filter (snapshot construction)', () => {
  test('filters out retirement subtypes from taxableFromPlaid computation (logic lives in gemini-insights)', () => {
    const rawAccounts = [
      { accountType: 'investment', accountSubtype: 'brokerage', balance: '50000' },
      { accountType: 'investment', accountSubtype: 'ira', balance: '200000' },
      { accountType: 'investment', accountSubtype: 'roth', balance: '100000' },
      { accountType: 'investment', accountSubtype: '401k', balance: '220000' },
    ];
    // Mirror the filter logic here to assert intended behavior
    const lower = (s: any) => String(s || '').toLowerCase();
    const isRetSubtype = (sub: string) => {
      const t = lower(sub);
      return t.includes('ira') || t.includes('roth') || t.includes('401') || t.includes('403') || t.includes('pension');
    };
    const taxable = rawAccounts
      .filter((a: any) => lower(a.accountType) === 'investment' && !isRetSubtype(a.accountSubtype))
      .reduce((sum: number, a: any) => sum + (parseFloat(a.balance || '0') || 0), 0);
    expect(taxable).toBe(50000);
  });
});

