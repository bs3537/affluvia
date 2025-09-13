# Net Worth Widget Calculation Inconsistency Analysis

## 🚨 CRITICAL ISSUE IDENTIFIED

After server restart and browser cache clearing, the net worth graph shows different calculations than before restart.

## 🔍 ROOT CAUSE ANALYSIS

### **Problem: Multiple Calculation Sources Creating Inconsistency**

There are **4 different places** where net worth is calculated/displayed, each potentially using different data sources:

### 1. **NetWorthWidgetV2** (`client/src/components/net-worth-widget-v2.tsx`)
```typescript
// CLIENT-SIDE CALCULATION - Always recalculates from raw profile data
const calculateNetWorth = (): NetWorthBreakdown => {
  // Recalculates from profile.assets[], profile.liabilities[], etc.
  // This is ALWAYS fresh from database profile data
}
```
**Data Source**: Fresh calculation from `profile.assets[]` and `profile.liabilities[]`

### 2. **NetWorthProjectionWidget** (`client/src/components/net-worth-projection-widget.tsx`)
```typescript
// Uses multiple fallback data sources in priority order:
// 1. profile.netWorthProjections.projectionData (saved projections)
// 2. monteCarloData.retirementSimulation.results (Monte Carlo data)
// 3. Fresh API call to calculate-retirement-monte-carlo
```
**Data Source**: Cached projections OR Monte Carlo results OR fresh API calculation

### 3. **Dashboard Main Net Worth Display** (`client/src/components/dashboard.tsx:1043-1045`)
```typescript
// MIXED DATA SOURCE - Can use either persisted or calculated values
const netWorth = profile?.netWorth !== undefined && profile?.netWorth !== null 
  ? Number(profile.netWorth)  // PERSISTED database value
  : (profile?.calculations?.netWorth ?? calculateNetWorth()); // FRESH calculation
```
**Data Source**: Persisted `profile.netWorth` OR `profile.calculations.netWorth` OR fresh calculation

### 4. **Server-side Intake Form Processing** (`server/routes.ts:867`)
```typescript
// Stores calculated netWorth in profile during intake form submission
netWorth: calculations?.netWorth || 0,
```
**Data Source**: Calculation engine results stored to database

## 🐛 **THE INCONSISTENCY PROBLEM**

### **Before Server Restart:**
- Dashboard shows values from `profile.netWorth` (persisted database value)
- NetWorthProjectionWidget shows values from cached `netWorthProjections`
- Both widgets use **saved/cached data**

### **After Server Restart + Cache Clear:**
- In-memory caches are cleared
- `profile.netWorthProjections` may be stale or missing
- Monte Carlo cache may be expired
- Widgets fall back to **fresh calculations**
- **Different calculation engines may produce different results**

## 💥 **SPECIFIC FAILURE POINTS**

### 1. **Stale netWorthProjections Data**
```typescript
// In routes.ts - netWorthProjections are saved to database
await storage.updateFinancialProfile(req.user!.id, {
  netWorthProjections: netWorthProjectionsData  // This might be stale
});
```

### 2. **Different Asset Categorization Logic**
NetWorthWidgetV2 vs other calculations may categorize assets differently:
```typescript
// NetWorthWidgetV2 categorization
if (type.includes('checking') || type.includes('savings')) {
  bankAccounts += value;
} else if (type.includes('investment') || type.includes('brokerage')) {
  investments += value;
} else if (type.includes('401k') || type.includes('ira') || type.includes('retirement')) {
  retirementAccounts += value;
}
```

### 3. **Timing Issues with Calculations**
- Fresh calculations may use different market assumptions
- Real estate values may have different growth rates applied
- Monte Carlo vs deterministic calculations produce different results

### 4. **Database vs Client-side Calculation Discrepancies**
```typescript
// Dashboard.tsx line 1043-1045 - Priority logic issue
const netWorth = profile?.netWorth !== undefined && profile?.netWorth !== null 
  ? Number(profile.netWorth)      // Could be stale database value
  : (profile?.calculations?.netWorth ?? calculateNetWorth()); // Fresh calculation
```

## 🔧 **IMMEDIATE FIXES REQUIRED**

### **Fix 1: Ensure Data Source Consistency**
All net worth displays should use the same data source priority:

```typescript
// Consistent priority order for ALL widgets:
// 1. Fresh calculations from profile data (most reliable)
// 2. Cached calculations only if timestamp is recent (< 1 hour)
// 3. Force recalculation if data is stale
```

### **Fix 2: Add Calculation Timestamps**
```typescript
// Add timestamps to all calculations
const calculationData = {
  netWorth: calculatedNetWorth,
  calculatedAt: new Date().toISOString(),
  dataVersion: profile.lastUpdated // Tie to profile version
}
```

### **Fix 3: Invalidate Stale Projections**
```typescript
// Check if netWorthProjections are stale
const projectionsAge = profile.netWorthProjections?.calculatedAt;
const isStale = !projectionsAge || 
  (Date.now() - new Date(projectionsAge).getTime()) > (60 * 60 * 1000); // 1 hour

if (isStale) {
  // Force fresh calculation
}
```

### **Fix 4: Standardize Asset Categorization**
Create a shared utility function that all components use:
```typescript
// shared/asset-categorization.ts
export function categorizeAssets(assets: Asset[]) {
  // Single source of truth for asset categorization
}
```

## 🚨 **CRITICAL ACTION ITEMS**

1. **Immediate**: Add logging to identify which calculation path each widget is using
2. **Short-term**: Implement consistent data source priority across all widgets  
3. **Medium-term**: Add calculation versioning and staleness detection
4. **Long-term**: Consolidate all net worth calculations into a single, cached service

## 📊 **DEBUGGING STEPS**

1. Add console logs to identify which data source each widget uses
2. Compare calculation results between fresh vs cached data
3. Check for timing issues in data loading order
4. Validate that all widgets use identical asset categorization logic

## ⚡ **QUICK TEMPORARY FIX**

Force all net worth displays to use fresh calculations until caching issues are resolved:

```typescript
// In dashboard.tsx - Force fresh calculation
const netWorth = calculateNetWorth(); // Always fresh, ignore cached values

// In NetWorthProjectionWidget - Force fresh Monte Carlo
useEffect(() => {
  fetchSimulationData(); // Always fetch fresh, ignore cached data
}, []);
```

This will ensure consistency but may impact performance until proper caching is implemented.