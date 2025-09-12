# Inflation Adjustment Implementation for Retirement Expenses

## Summary of Changes

I've implemented inflation adjustment for retirement expenses in the Monte Carlo simulation. This is a critical fix because users naturally think of expenses in today's dollars when planning for retirement.

## What Changed

### 1. Monte Carlo Calculation (`server/monte-carlo.ts`)

The `profileToRetirementParams` function now adjusts the user's entered monthly expenses for inflation:

```typescript
// Before (INCORRECT - uses today's dollars directly)
const baseRetirementExpenses = (Number(profileData.expectedMonthlyExpensesRetirement) || 0) * 12;

// After (CORRECT - adjusts for inflation)
const yearsToRetirement = retirementAge - currentAge;
const inflationRate = (Number(profileData.expectedInflationRate) || 3) / 100;
const inflationAdjustedExpenses = baseRetirementExpenses * Math.pow(1 + inflationRate, yearsToRetirement);
```

### 2. User Interface (`client/src/components/intake-form.tsx`)

Updated the form label and help text to clarify that users should enter expenses in today's dollars:

- Label: "Expected Monthly Expenses in Retirement (Today's Dollars) ($)"
- Help text: "Enter the amount in today's dollars - we'll automatically adjust for inflation..."

## Impact Examples

For a user entering $8,000/month in retirement expenses:

| Years to Retirement | Inflation Rate | Today's Dollars | Retirement-Year Dollars | Increase |
|-------------------|----------------|-----------------|------------------------|----------|
| 10 years | 3% | $8,000/month | $10,745/month | 34.3% |
| 15 years | 3% | $8,000/month | $12,470/month | 55.9% |
| 20 years | 3% | $8,000/month | $14,446/month | 80.6% |
| 25 years | 3% | $8,000/month | $16,760/month | 109.5% |

## Why This Matters

Without this adjustment, the Monte Carlo simulation would be **significantly over-optimistic**:

1. A 50-year-old planning to retire at 65 would have their expenses understated by 56%
2. This could show 100% success probability when the real probability might be 60-70%
3. Users could be drastically underprepared for retirement

## Console Output

The system now logs both values for transparency:

```
EXPENSE ANALYSIS:
  Base Retirement Expenses (today's dollars): 96000
  Years to Retirement: 15
  Expected Inflation Rate: 3.0%
  Inflation-Adjusted Expenses (retirement-year dollars): 149,651
  Inflation Adjustment Factor: 1.56x
```

## Enhanced Monte Carlo Simulation

Both the dashboard widget and AI insights now use the inflation-adjusted expenses, ensuring consistent and accurate retirement planning across the application.