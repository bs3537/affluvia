// Demonstrate the impact of retirement spending smile

const monthlyExpense = 8000;
const annualExpense = monthlyExpense * 12;

console.log('Impact of Retirement Spending Smile on Expenses\n');
console.log('='.repeat(50));
console.log('Starting expense: $' + annualExpense.toLocaleString() + '/year\n');

// With spending smile (what we removed)
console.log('WITH Spending Smile (old model):');
let expenseWithSmile = annualExpense;
for (let age = 65; age <= 85; age++) {
  const ageAdjustmentFactor = age < 75 ? 0.995 :  // Decrease before 75
                              age < 85 ? 1.0 :    // Stable 75-85
                              1.01;               // Increase after 85
  
  expenseWithSmile *= ageAdjustmentFactor;
  
  if (age === 65 || age === 70 || age === 75 || age === 80 || age === 85) {
    console.log(`  Age ${age}: $${Math.round(expenseWithSmile).toLocaleString()}/year`);
  }
}

// Without spending smile (current model)
console.log('\nWITHOUT Spending Smile (new model):');
let expenseWithoutSmile = annualExpense;
for (let age = 65; age <= 85; age++) {
  // No adjustment - use user's input directly
  if (age === 65 || age === 70 || age === 75 || age === 80 || age === 85) {
    console.log(`  Age ${age}: $${Math.round(expenseWithoutSmile).toLocaleString()}/year`);
  }
}

console.log('\n' + '='.repeat(50));
console.log('Key Insight:');
console.log('The spending smile was REDUCING expenses by ~5% in early retirement');
console.log('Removing it means higher expenses → lower success rate');
console.log('\nPhilosophy:');
console.log('We should use the user\'s exact $96,000/year input');
console.log('If they want age-based adjustments, that\'s a Step 5 scenario');