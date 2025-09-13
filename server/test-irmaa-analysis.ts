// Analysis of when IRMAA surcharges kick in

console.log('IRMAA SURCHARGE ANALYSIS\n');
console.log('='.repeat(60));

console.log('\nWHAT IS IRMAA?');
console.log('- Income-Related Monthly Adjustment Amount');
console.log('- Additional Medicare premiums for high-income beneficiaries');
console.log('- Affects both Part B (medical) and Part D (drug) premiums\n');

console.log('WHEN DOES IRMAA APPLY?');
console.log('1. Must be on Medicare (age 65+)');
console.log('2. Modified AGI exceeds thresholds');
console.log('3. Based on income from 2 years prior (lookback period)\n');

console.log('2024 IRMAA THRESHOLDS (Single Filers):');
console.log('Income Range          | Part B Monthly | Part D Add');
console.log('-'.repeat(55));
console.log('< $103,000           | $174.70        | $0');
console.log('$103,000 - $129,000  | $244.60        | $12.90');
console.log('$129,000 - $161,000  | $349.40        | $33.30');
console.log('$161,000 - $193,000  | $454.20        | $53.80');
console.log('$193,000 - $500,000  | $559.00        | $74.20');
console.log('> $500,000           | $594.00        | $81.00\n');

console.log('2024 IRMAA THRESHOLDS (Married Filing Jointly):');
console.log('Income Range          | Part B Monthly | Part D Add');
console.log('-'.repeat(55));
console.log('< $206,000           | $174.70        | $0');
console.log('$206,000 - $258,000  | $244.60        | $12.90');
console.log('$258,000 - $322,000  | $349.40        | $33.30');
console.log('$322,000 - $386,000  | $454.20        | $53.80');
console.log('$386,000 - $750,000  | $559.00        | $74.20');
console.log('> $750,000           | $594.00        | $81.00\n');

console.log('WHEN IRMAA TRIGGERS:');
console.log('1. Regular retirement withdrawals that push MAGI over thresholds');
console.log('2. Required Minimum Distributions (RMDs) after age 73');
console.log('3. Roth conversions that increase taxable income');
console.log('4. Capital gains from taxable account sales');
console.log('5. Pension income, rental income, etc.\n');

console.log('EXAMPLE SCENARIOS:\n');

// Example 1: Below threshold
console.log('Scenario 1: Retired couple, age 67');
console.log('- Social Security: $60,000/year');
console.log('- IRA withdrawals: $40,000/year');
console.log('- MAGI: ~$100,000 (below $206,000 threshold)');
console.log('- IRMAA: $0 additional surcharge\n');

// Example 2: Roth conversion triggers IRMAA
console.log('Scenario 2: Same couple does $150,000 Roth conversion');
console.log('- Base income: $100,000');
console.log('- Roth conversion: $150,000');
console.log('- MAGI: $250,000 (exceeds $206,000 threshold)');
console.log('- IRMAA Tier 1: Additional $840/year per person');
console.log('- Total additional: $1,680/year\n');

// Example 3: RMDs push into IRMAA
console.log('Scenario 3: Wealthy couple, age 75');
console.log('- Large IRA balance: $5M');
console.log('- RMD (~4%): $200,000/year');
console.log('- Social Security: $80,000/year');
console.log('- MAGI: $280,000');
console.log('- IRMAA Tier 2: Additional $2,100/year per person');
console.log('- Total additional: $4,200/year\n');

console.log('='.repeat(60));
console.log('\nKEY INSIGHTS:');
console.log('1. IRMAA only applies at age 65+ (on Medicare)');
console.log('2. NOT just from Roth conversions - any income source');
console.log('3. Affects high-income retirees significantly');
console.log('4. Important for tax planning strategies');
console.log('5. 2-year lookback means planning ahead is crucial\n');

console.log('CURRENT IMPLEMENTATION ISSUE:');
console.log('- Monte Carlo calculates IRMAA for all ages');
console.log('- Should only apply when age >= 65');
console.log('- Need to add age check before applying surcharge');