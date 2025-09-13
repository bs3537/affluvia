# Self-Employed Tax Strategies Feature

## Overview
The Self-Employed Tax Strategies feature is a comprehensive tax planning tool designed specifically for self-employed individuals, freelancers, and small business owners. It provides personalized retirement planning, tax optimization strategies, and business structure recommendations based on the latest 2025 IRS guidelines.

## Feature Activation
The feature automatically activates when:
- User indicates they are self-employed (`isSelfEmployed = true`)
- User has self-employment income > $0
- User does not have an existing 401(k) or IRA

## Key Components

### 1. Retirement Plan Comparison
**Location**: `client/src/components/retirement-plan-comparison.tsx`

Compares three main retirement options:
- **Solo 401(k)**: Maximum contribution limits, employer/employee contributions
- **SEP IRA**: Simplified setup, 25% of net SE income contribution
- **SIMPLE IRA**: Lower contribution limits but easier administration

#### 2025 Contribution Limits:
- Solo 401(k): $70,000 employee deferral + 25% employer contribution (max $345,000)
- SEP IRA: 25% of net SE income (max $70,000)
- SIMPLE IRA: $16,000 + $3,500 catch-up + 3% match

### 2. Tax Deduction Optimizer
**Location**: `client/src/components/deduction-optimizer.tsx`

Calculates available deductions:
- Home office deduction (simplified vs actual)
- Vehicle expenses (standard mileage vs actual)
- Health insurance premiums
- HSA contributions ($4,300 single / $8,550 family for 2025)
- QBI deduction (20% of qualified business income)
- Business expenses

### 3. Quarterly Tax Calculator
**Location**: `client/src/components/quarterly-tax-calculator.tsx`

Features:
- Safe Harbor vs Current Year calculation methods
- 2025 quarterly payment due dates
- Automatic penalty protection calculations
- Payment schedule generation
- Integration with IRS Direct Pay and EFTPS

### 4. S-Corporation Analysis
**Location**: `client/src/components/s-corp-analyzer.tsx`

Analyzes potential S-Corp election benefits:
- Reasonable salary calculation (60% of net income guideline)
- Payroll tax savings estimation
- Additional costs analysis (payroll service, tax prep)
- Break-even point calculation
- Net benefit projection

### 5. Business Structure Advisor
**Location**: `client/src/components/business-structure-advisor.tsx`

Compares business structures:
- Sole Proprietorship
- LLC (Single-member)
- S-Corporation
- C-Corporation

Provides recommendations based on:
- Income level
- Liability protection needs
- Tax implications
- Administrative complexity

## API Endpoints

### `/api/self-employed/recommendations`
- **Method**: POST
- **Purpose**: Generate personalized recommendations
- **Input**: User profile data
- **Output**: Array of prioritized recommendations

### `/api/self-employed/analyze-retirement-options`
- **Method**: POST
- **Purpose**: Compare retirement plan options
- **Input**: Self-employment income, age, filing status
- **Output**: Detailed comparison with contribution limits and tax savings

### `/api/self-employed/calculate-quarterly-taxes`
- **Method**: POST
- **Purpose**: Calculate quarterly estimated tax payments
- **Input**: SE income, previous year AGI/tax, calculation method
- **Output**: Payment schedule with amounts and due dates

### `/api/self-employed/s-corp-analysis`
- **Method**: POST
- **Purpose**: Analyze S-Corp election benefits
- **Input**: Net SE income, state, existing expenses
- **Output**: Tax savings analysis and recommendation

### `/api/self-employed/deduction-optimizer`
- **Method**: POST
- **Purpose**: Calculate available tax deductions
- **Input**: Business expenses, home office details, vehicle usage
- **Output**: Total deductions and category breakdown

## Database Schema

Added fields to `financial_profiles` table:
```sql
isSelfEmployed: boolean DEFAULT false
selfEmploymentIncome: decimal(12,2)
businessType: text
hasRetirementPlan: boolean DEFAULT false
quarterlyTaxPayments: jsonb
selfEmployedData: jsonb
```

## Tax Calculations

### Self-Employment Tax
- Rate: 15.3% (12.4% Social Security + 2.9% Medicare)
- Applied to: 92.35% of net self-employment income
- Social Security wage base (2025): $176,100
- Medicare additional tax: 0.9% on income > $200,000 (single) / $250,000 (married)

### Retirement Contribution Calculations
1. **Net SE Income**: Gross SE Income - Business Expenses
2. **SE Tax**: Net SE Income × 92.35% × 15.3%
3. **Adjusted Net**: Net SE Income - (SE Tax ÷ 2)
4. **Max Employer Contribution**: Adjusted Net × 20%

### Quarterly Tax Safe Harbor Rules
- **General Rule**: Pay 100% of prior year tax
- **High Income (AGI > $150,000)**: Pay 110% of prior year tax
- **Current Year Method**: Pay 90% of current year estimated tax

## User Experience Flow

1. **Initial Assessment**
   - Quick evaluation of self-employment status
   - Income and expense collection
   - Current retirement plan check

2. **Priority Recommendations**
   - Displays top 3-5 actionable items
   - Color-coded by urgency (red/yellow/green)
   - Estimated tax savings for each

3. **Detailed Analysis Tabs**
   - Retirement Plans: Side-by-side comparison
   - Tax Deductions: Interactive calculator
   - Quarterly Taxes: Payment schedule generator
   - S-Corp Analysis: Detailed cost-benefit
   - Business Structure: Comprehensive comparison

4. **Implementation Guidance**
   - Step-by-step instructions
   - Links to IRS forms and resources
   - Payment portal integrations
   - Calendar reminders for deadlines

## Integration Points

### With Existing Features
- **Tax Strategies Center**: Appears as additional tab when conditions met
- **Retirement Planning**: Coordinates with main retirement projections
- **Cash Flow Analysis**: Incorporates quarterly tax payments
- **Financial Health Score**: Includes SE tax optimization metrics

### External Resources
- IRS Form 1040-ES (Quarterly Taxes)
- IRS Publication 560 (Retirement Plans)
- IRS Form 2553 (S-Corp Election)
- State tax authority links

## Testing Scenarios

### Test User Profiles
1. **Low Income SE ($50,000/year)**
   - Focus: Basic retirement savings, quarterly taxes
   - Recommended: SIMPLE IRA or SEP IRA

2. **Medium Income SE ($150,000/year)**
   - Focus: Solo 401(k), S-Corp analysis
   - Recommended: Solo 401(k) + S-Corp consideration

3. **High Income SE ($300,000+/year)**
   - Focus: Maximum retirement contributions, S-Corp
   - Recommended: Solo 401(k) max + S-Corp election

### Key Test Cases
- Retirement contribution limit calculations
- S-Corp break-even analysis accuracy
- Quarterly tax payment schedules
- QBI deduction calculations
- Home office deduction comparison

## Performance Considerations

- Calculations cached for 24 hours
- Lazy loading of component tabs
- Debounced input fields for real-time calculations
- Memoized complex calculations

## Security & Compliance

- No storage of SSN or EIN
- Encrypted transmission of financial data
- Compliance with IRS guidelines
- Regular updates for tax law changes

## Future Enhancements

1. **State Tax Integration**
   - State-specific deductions
   - State retirement plan benefits
   - Multi-state business considerations

2. **Advanced Business Features**
   - Multiple business support
   - Partnership tax strategies
   - Cost segregation studies

3. **Automation Features**
   - Quarterly tax payment reminders
   - Automatic S-Corp threshold alerts
   - Year-end tax planning automation

4. **Professional Integration**
   - CPA collaboration tools
   - Tax software export
   - Bookkeeping integration

## Support Resources

- User Guide: In-app tooltips and help icons
- IRS Resources: Direct links to relevant publications
- Video Tutorials: Planned for Q2 2025
- Email Support: support@affluvia.com

## Regulatory Compliance

All calculations and recommendations follow:
- IRS Revenue Procedures 2024-40 (2025 limits)
- Treasury Regulations on SE tax
- State-specific tax guidelines
- ERISA requirements for retirement plans

## Version History

- v1.0.0 (2025-01-20): Initial release
  - Core SE tax calculations
  - Retirement plan comparison
  - Quarterly tax calculator
  - S-Corp analyzer
  - Business structure advisor