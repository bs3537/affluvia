// Test impact of LTC on our example couple

const coupleAge = 50;
const retirementAge = 65;
const lifeExpectancy = 85;
const monthlyExpenses = 8000;
const annualExpenses = monthlyExpenses * 12;

console.log('LTC IMPACT ON EXAMPLE COUPLE\n');
console.log('='.repeat(50));
console.log('Couple: Both age 50, retiring at 65, life expectancy 85');
console.log('Annual retirement expenses: $96,000\n');

// LTC costs in last 2 years (ages 84-85)
const yearsUntilLTC = 84 - retirementAge; // 19 years
const baseLTCCost = 75504;
const inflationRate = 0.045;
const inflatedLTCCost = baseLTCCost * Math.pow(1 + inflationRate, yearsUntilLTC);

console.log('LTC COST CALCULATION:');
console.log(`Base cost: $${baseLTCCost.toLocaleString()}/year`);
console.log(`Years until LTC (age 84): ${yearsUntilLTC}`);
console.log(`Inflated cost at age 84: $${Math.round(inflatedLTCCost).toLocaleString()}/year`);
console.log(`Total for 2 years: $${Math.round(inflatedLTCCost * 2).toLocaleString()}\n`);

// Probability calculations
const userProbability = 0.70; // Good health
const spouseProbability = 0.70; // Good health
const bothProbability = userProbability * spouseProbability;
const eitherProbability = 1 - (1 - userProbability) * (1 - spouseProbability);

console.log('PROBABILITY ANALYSIS:');
console.log(`User needs LTC: ${(userProbability * 100).toFixed(0)}%`);
console.log(`Spouse needs LTC: ${(spouseProbability * 100).toFixed(0)}%`);
console.log(`Both need LTC: ${(bothProbability * 100).toFixed(0)}%`);
console.log(`At least one needs LTC: ${(eitherProbability * 100).toFixed(0)}%\n`);

// Expected costs
const expectedUserCost = inflatedLTCCost * 2 * userProbability;
const expectedSpouseCost = inflatedLTCCost * 2 * spouseProbability;
const totalExpectedCost = expectedUserCost + expectedSpouseCost;

console.log('EXPECTED COSTS:');
console.log(`User expected LTC cost: $${Math.round(expectedUserCost).toLocaleString()}`);
console.log(`Spouse expected LTC cost: $${Math.round(expectedSpouseCost).toLocaleString()}`);
console.log(`Total expected LTC cost: $${Math.round(totalExpectedCost).toLocaleString()}\n`);

// Impact on retirement
const retirementYears = lifeExpectancy - retirementAge;
const annualizedLTCCost = totalExpectedCost / retirementYears;
const percentOfExpenses = (annualizedLTCCost / annualExpenses) * 100;

console.log('IMPACT ON RETIREMENT:');
console.log(`Retirement duration: ${retirementYears} years`);
console.log(`Annualized LTC cost: $${Math.round(annualizedLTCCost).toLocaleString()}/year`);
console.log(`As % of annual expenses: ${percentOfExpenses.toFixed(1)}%\n`);

console.log('='.repeat(50));
console.log('\nTHE PROBLEM:');
console.log('- Adding $25,000/year (26% of expenses) for LTC');
console.log('- 91% chance at least one spouse needs LTC');
console.log('- This is overly pessimistic!\n');

console.log('RECOMMENDATIONS:');
console.log('1. Reduce base probability to 50-60%');
console.log('2. Vary duration (not always 2 years)');
console.log('3. Not always in last 2 years of life');
console.log('4. Make LTC modeling optional or adjustable');