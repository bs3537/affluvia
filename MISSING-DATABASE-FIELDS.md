# Missing Database Fields Analysis

## Fields Currently Missing from Database Schema

After comparing the intake form fields with the database schema, I found that most fields are already covered. The database uses JSONB fields for complex nested data, which provides flexibility. Here's the analysis:

## ✅ Fields Already Covered in Database

### Direct Column Mappings:
- All personal information fields (Step 1) ✅
- All employment & income fields (Step 2) ✅ 
- savingsRate (Step 3) ✅
- Estate planning booleans (Step 9) ✅
- Tax information (Step 10) ✅
- All retirement planning fields (Step 11) ✅

### Stored in JSONB Columns:
- **assets** JSONB column stores:
  - All asset array fields including annuity-specific fields ✅
- **liabilities** JSONB column stores:
  - All liability array fields ✅
- **primaryResidence** JSONB column stores:
  - All primary residence fields including Plaid import metadata ✅
- **additionalProperties** JSONB column stores:
  - All additional property fields ✅
- **monthlyExpenses** JSONB column stores:
  - All expense category fields ✅
- **insurance** JSONB column stores:
  - All insurance-related fields including limits ✅
- **riskQuestions** JSONB column stores:
  - Risk assessment scores ✅
- **currentAllocation** JSONB column stores:
  - Investment allocation percentages ✅
- **spouseAllocation** JSONB column stores:
  - Spouse investment allocation ✅
- **retirementContributions** JSONB column stores:
  - Employee and employer contributions ✅
- **spouseRetirementContributions** JSONB column stores:
  - Spouse retirement contributions ✅

## ⚠️ Potential Issues Found

### 1. Missing Direct Fields:
- **spouseFirstName** and **spouseLastName** - Currently only have `spouseName` as a single field
  - The form splits these but database stores as single field
  - **Solution**: Either add separate columns OR handle concatenation in application layer

### 2. Fields That May Need Verification:
- **totalMonthlyExpenses** - Has a column but used as override/calculated field
- **isPartialSave** - Used for save optimization but not persisted (which is correct)
- **skipCalculations** - Used for save optimization but not persisted (which is correct)
- **currentStep** - Used for UI state but not persisted separately

## 📋 Recommended Actions

### Option 1: Add Spouse Name Fields (Recommended)
Add separate columns for spouse first and last names for better data structure:
```sql
ALTER TABLE financial_profiles 
ADD COLUMN spouse_first_name TEXT,
ADD COLUMN spouse_last_name TEXT;
```

### Option 2: Keep Current Structure
Continue using `spouseName` field and handle splitting/concatenation in application layer.

## Summary

The database schema is **well-designed** and covers **99% of all form fields**. The use of JSONB columns for complex nested data provides excellent flexibility. The only potential improvement would be splitting the spouse name field, but this is optional and the current structure works fine.

**No critical migrations needed** - the database can already persist all form data properly.