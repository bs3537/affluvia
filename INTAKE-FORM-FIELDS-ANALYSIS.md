# Intake Form Fields Analysis - Complete Field List

## Step 1: Personal Information
- firstName (string)
- lastName (string)
- dateOfBirth (date)
- maritalStatus (select: single/married/divorced/widowed)
- state (select: US states)
- dependents (number)
- spouseName (string) - if married
- spouseDateOfBirth (date) - if married

## Step 2: Employment & Income
- employmentStatus (select: full-time/part-time/self-employed/unemployed/retired)
- annualIncome (number)
- taxWithholdingStatus (select: employer/self/none)
- takeHomeIncome (number) - if employer withholds
- otherIncome (number)
- spouseEmploymentStatus (select) - if married
- spouseAnnualIncome (number) - if married
- spouseTaxWithholdingStatus (select) - if married
- spouseTakeHomeIncome (number) - if married

## Step 3: Savings Rate
- savingsRate (number/percentage)

## Step 4: Assets & Liabilities
### Assets (array of objects):
- type (select: various asset types)
- description (string)
- value (number)
- owner (select: User/Spouse/Joint)
- For annuities:
  - annuityType (select: immediate/deferred)
  - payoutStartDate (date)
  - payoutAmount (number)
  - payoutFrequency (select: monthly/quarterly/annually)
  - costBasis (number) - non-qualified only
  - exclusionRatio (number) - non-qualified only
  - growthRate (number) - deferred only
  - survivorBenefit (number)
  - guaranteedYears (number)

### Liabilities (array of objects):
- type (select: various liability types)
- description (string)
- balance (number)
- monthlyPayment (number)
- interestRate (number)
- owner (select: User/Spouse/Joint)

### Primary Residence:
- owner (select: User/Spouse/Joint)
- marketValue (number)
- mortgageBalance (number)
- monthlyPayment (number)
- interestRate (number)
- yearsToPayOffMortgage (number)
- _source.isImported (boolean) - for Plaid imports
- _source.institutionName (string) - for Plaid imports

### Additional Properties (array of objects):
- type (select: investment/vacation/commercial)
- marketValue (number)
- mortgageBalance (number)
- monthlyPayment (number)
- rentalIncome (number)
- owner (select: User/Spouse/Joint)

## Step 5: Monthly Expenses
- totalMonthlyExpenses (number) - calculated/override
- monthlyExpenses (object):
  - housing (number)
  - transportation (number)
  - food (number)
  - utilities (number)
  - healthcare (number)
  - creditCardPayments (number)
  - studentLoanPayments (number)
  - otherDebtPayments (number)
  - clothing (number)
  - entertainment (number)
  - expectedAnnualTaxes (number)
  - other (number)
- emergencyFundSize (number)

## Step 6: Insurance Coverage
- lifeInsurance (object):
  - hasPolicy (boolean)
  - coverageAmount (number)
  - monthlyPremium (number)
- spouseLifeInsurance (object):
  - hasPolicy (boolean)
  - coverageAmount (number)
  - monthlyPremium (number)
- healthInsurance (object):
  - hasHealthInsurance (boolean)
  - monthlyPremium (number)
  - deductible (number)
- disabilityInsurance (object):
  - hasDisability (boolean)
  - benefitAmount (number)
  - monthlyBenefit (number)
  - monthlyPremium (number)
- spouseDisabilityInsurance (object):
  - hasDisability (boolean)
  - benefitAmount (number)
  - monthlyBenefit (number)
  - monthlyPremium (number)
- insurance (object):
  - home (boolean)
  - homeDwellingLimit (number)
  - auto (boolean)
  - autoLiabilityLimits (object):
    - bodilyInjuryPerPerson (number)
    - bodilyInjuryPerAccident (number)
    - propertyDamage (number)
  - umbrella (boolean)
  - umbrellaLimit (number)
  - business (boolean) - if self-employed
  - businessLiabilityLimits (object):
    - perOccurrence (number)
    - aggregate (number)

## Step 7: Risk Profile (User)
- riskQuestions (array: [1-5] risk score)
- currentAllocation (object):
  - usStocks (number/percentage)
  - intlStocks (number/percentage)
  - bonds (number/percentage)
  - alternatives (number/percentage)
  - cash (number/percentage)

## Step 8: Risk Profile (Spouse) - if married
- spouseRiskQuestions (array: [1-5] risk score)
- spouseAllocation (object):
  - usStocks (number/percentage)
  - intlStocks (number/percentage)
  - bonds (number/percentage)
  - alternatives (number/percentage)
  - cash (number/percentage)

## Step 9: Estate Planning
- hasWill (boolean)
- hasTrust (boolean)
- hasPowerOfAttorney (boolean)
- hasHealthcareProxy (boolean)
- hasBeneficiaries (boolean)

## Step 10: Tax Information
- lastYearAGI (number)
- deductionAmount (number)
- taxFilingStatus (select: single/married-jointly/married-separately/head-of-household)

## Step 11: Retirement Planning
- desiredRetirementAge (number)
- spouseDesiredRetirementAge (number) - if married
- retirementState (select: US states)
- expectedMonthlyExpensesRetirement (number)
- userHealthStatus (select: excellent/good/fair/poor)
- spouseHealthStatus (select: excellent/good/fair/poor) - if married
- userLifeExpectancy (number)
- spouseLifeExpectancy (number) - if married
- socialSecurityClaimAge (number)
- spouseSocialSecurityClaimAge (number) - if married
- socialSecurityBenefit (number) - calculated
- spouseSocialSecurityBenefit (number) - calculated
- pensionBenefit (number)
- spousePensionBenefit (number) - if married
- retirementContributions (object):
  - employee (number)
  - employer (number)
- spouseRetirementContributions (object): - if married
  - employee (number)
  - employer (number)
- hasLongTermCareInsurance (boolean)
- legacyGoal (number)
- partTimeIncomeRetirement (number)
- spousePartTimeIncomeRetirement (number) - if married
- traditionalIRAContribution (number)
- rothIRAContribution (number)
- spouseTraditionalIRAContribution (number) - if married
- spouseRothIRAContribution (number) - if married
- withdrawalRate (number)
- expectedInflationRate (number)
- expectedRealReturn (number) - special marker -3 for risk-based
- investmentStrategy (string) - "risk-based"

## Additional Metadata Fields
- isComplete (boolean)
- currentStep (number)
- isPartialSave (boolean)
- skipCalculations (boolean)

## Calculated/Derived Fields (Backend)
- retirementAge (derived from desiredRetirementAge)
- retirementIncome (calculated)
- additionalNotes (string)
- lifeExpectancy (derived from userLifeExpectancy)
- retirementExpenseBudget (object):
  - essential (number)
  - discretionary (number)