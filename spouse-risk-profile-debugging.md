# Spouse Risk Profile Debugging Guide

## Data Flow Summary

The spouse risk profile data flows through the following path:

1. **Intake Form** (`client/src/components/intake-form.tsx`)
   - User fills out spouse risk questions (10 questions) in Step 8
   - Data is stored in `formData.spouseRiskQuestions` array
   - On submit, data is included in the API request

2. **API Submission** (`PUT /api/financial-profile`)
   - Server receives the data including `spouseRiskQuestions`
   - `calculateFinancialMetrics` function processes the data
   - Results are stored in database with calculations

3. **Database Storage** (`server/storage.ts`)
   - `spouseRiskQuestions` is stored as JSONB in the database
   - Field exists in schema: `spouse_risk_questions`

4. **Financial Calculations** (`server/routes.ts`)
   - `calculateFinancialMetrics` function calculates:
     - `spouseRiskScore` (sum of risk question answers)
     - `spouseRiskProfile` (Conservative, Moderate, Aggressive, etc.)
     - `spouseTargetAllocation` (recommended asset allocation)
   - These are returned in the calculations object

5. **Dashboard Display** (`client/src/components/dashboard.tsx`)
   - Fetches data via `GET /api/financial-profile`
   - Displays `profile.calculations.spouseRiskProfile`
   - Shows spouse target allocation chart

## Debugging Steps Added

### 1. Intake Form Logging
```javascript
// Lines 790-795: Log data being submitted
console.log('Spouse risk data being submitted:', {
  maritalStatus: data.maritalStatus,
  spouseRiskQuestions: data.spouseRiskQuestions,
  spouseAllocation: data.spouseAllocation
});

// Lines 879-883: Log transformed data
console.log('Transformed spouse risk data:', {
  maritalStatus: transformedData.maritalStatus,
  spouseRiskQuestions: transformedData.spouseRiskQuestions,
  spouseAllocation: transformedData.spouseAllocation
});
```

### 2. Server-side Logging
```javascript
// PUT endpoint (lines 41-54): Log incoming data and calculations
console.log('Calculated financial metrics:', {
  spouseRiskProfile: calculations.spouseRiskProfile,
  spouseRiskScore: calculations.spouseRiskScore,
  spouseTargetAllocation: calculations.spouseTargetAllocation
});

console.log('Incoming profile data:', {
  maritalStatus: req.body.maritalStatus,
  hasSpouseRiskQuestions: !!req.body.spouseRiskQuestions,
  spouseRiskQuestionsLength: req.body.spouseRiskQuestions?.length,
  spouseRiskQuestions: req.body.spouseRiskQuestions
});

// GET endpoint (lines 20-30): Log data retrieval
console.log('Profile data for calculations:', {
  maritalStatus: profile.maritalStatus,
  hasSpouseRiskQuestions: !!profile.spouseRiskQuestions,
  spouseRiskQuestions: profile.spouseRiskQuestions
});

console.log('Calculated spouse risk data:', {
  spouseRiskProfile: calculations.spouseRiskProfile,
  spouseRiskScore: calculations.spouseRiskScore,
  spouseTargetAllocation: calculations.spouseTargetAllocation
});
```

### 3. Dashboard Logging
```javascript
// Lines 157-160: Log received data
spouseRiskProfile: data?.calculations?.spouseRiskProfile,
spouseRiskScore: data?.calculations?.spouseRiskScore,
spouseTargetAllocation: data?.calculations?.spouseTargetAllocation,
spouseRiskQuestions: data?.spouseRiskQuestions,

// Lines 1037-1042: Log when rendering spouse risk profile
console.log('Spouse risk profile data:', {
  hasCalculations: !!profile?.calculations,
  spouseRiskProfile: profile?.calculations?.spouseRiskProfile,
  spouseRiskScore: profile?.calculations?.spouseRiskScore,
  rawProfile: profile
});
```

## Known Working Parts

1. ✅ Database schema includes `spouse_risk_questions` field
2. ✅ Intake form collects spouse risk questions (Step 8)
3. ✅ Form submission includes `spouseRiskQuestions` in the request
4. ✅ `calculateFinancialMetrics` function processes spouse risk data
5. ✅ Calculations return `spouseRiskProfile`, `spouseRiskScore`, and `spouseTargetAllocation`
6. ✅ Dashboard attempts to display `profile.calculations.spouseRiskProfile`

## Potential Issues to Check

1. **Data Persistence**: Check if `spouseRiskQuestions` is being properly saved to the database
2. **Data Retrieval**: Verify that `spouseRiskQuestions` is being loaded from the database
3. **Marital Status Check**: The calculation only runs if `maritalStatus === 'married'`
4. **Risk Score Threshold**: The profile is only calculated if `spouseRiskScore >= 10`

## How to Debug

1. Open browser developer console
2. Complete the intake form including spouse risk questions
3. Check console logs for:
   - "Spouse risk data being submitted" - should show the array of risk questions
   - "Transformed spouse risk data" - should confirm data is included
4. After submission, go to dashboard
5. Check console logs for:
   - "Received profile data" - should show spouse risk data
   - "Spouse risk profile data" - should show the calculated profile

## Expected Behavior

For a married user who completes the spouse risk questions:
- `spouseRiskQuestions` should be an array of 10 numbers (1-5)
- `spouseRiskScore` should be the sum (10-50)
- `spouseRiskProfile` should be one of: Conservative, Moderately Conservative, Moderate, Moderately Aggressive, Aggressive
- `spouseTargetAllocation` should be an object with allocation percentages