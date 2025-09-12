# 🔧 Long-Term Care Monte Carlo Technical Integration Analysis
## Deep Dive: Current System Architecture & Integration Points

---

## 🏗️ **Current Monte Carlo Architecture Analysis**

### **Core Engine Location & Structure**
```typescript
// server/monte-carlo-enhanced.ts:2501+
export function runRightCapitalStyleMonteCarloSimulation(
  params: RetirementMonteCarloParams,
  iterations: number = 1000,
  enableDetailedLogging: boolean = false
): MonteCarloResult {
  const results: SimulationIteration[] = [];
  // ... 1000 iteration loop ...
}
```

### **Current Parameter Structure**
```typescript
interface RetirementMonteCarloParams {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentRetirementAssets: number;
  annualGuaranteedIncome: number;     // SS + pensions
  annualRetirementExpenses: number;   // ⚠️ No LTC component
  expectedReturn: number;
  returnVolatility: number;
  inflationRate: number;
  taxRate: number;
  annualSavings: number;
  legacyGoal: number;
  // ... other params
}
```

### **Critical Integration Points**

#### **1. Parameter Generation** (`server/routes.ts:1431+`)
```typescript
// GET /api/financial-profile
const params = profileToRetirementParams(profile);
const monteCarloResult = runRightCapitalStyleMonteCarloSimulation(params, 1000);

// ⚠️ INTEGRATION POINT: profileToRetirementParams() needs LTC enhancement
```

#### **2. Single Iteration Loop** (`server/monte-carlo-enhanced.ts:2572+`)
```typescript
function runSingleRightCapitalStyleIteration(
  params: RetirementMonteCarloParams,
  iterationNumber: number,
  enableDetailedLogging: boolean
): SimulationIteration {
  // ⚠️ INTEGRATION POINT: Add LTC cost calculation per year
  // Current yearly loop processes standard expenses
  // Need to inject LTC episode costs here
}
```

#### **3. Widget Data Flow** (`client/src/components/retirement-monte-carlo-widget.tsx`)
```typescript
// POST /api/calculate-retirement-monte-carlo → Monte Carlo Engine
// Result flows to dashboard retirement confidence widget
// ⚠️ INTEGRATION POINT: Widget needs to display LTC impact
```

---

## 🎯 **Specific Code Modification Points**

### **1. Enhanced Parameter Interface**
```typescript
// server/monte-carlo-enhanced.ts - ADD to existing interface
interface RetirementMonteCarloParams {
  // ... existing fields ...
  
  // NEW: LTC Modeling Parameters
  ltcModeling?: {
    enabled: boolean;
    approach: 'simple' | 'stochastic' | 'episodes';
    
    // Simple shock parameters
    lifetimeProbability: number;        // 0.70 default
    averageDuration: number;            // 3.0 years default  
    averageAnnualCost: number;         // $90K default (regional adjusted)
    onsetAgeRange: [number, number];   // [75, 85] default
    costInflationRate: number;         // 4.9% vs general 3%
    
    // Personal factors
    gender: 'M' | 'F';                // Affects duration (F=longer)
    maritalStatus: string;            // Affects care options
    familySupport: 'High' | 'Medium' | 'Low'; // Affects home care probability
    
    // Insurance parameters (Phase 3)
    ltcInsurance?: {
      dailyBenefit: number;
      eliminationDays: number;
      benefitYears: number;
      annualPremium: number;
      inflationRider: boolean;
    };
  };
}
```

### **2. Parameter Generation Enhancement**
```typescript
// server/monte-carlo-enhanced.ts - MODIFY existing function
export function profileToRetirementParams(profile: any): RetirementMonteCarloParams {
  // ... existing parameter mapping ...
  
  // NEW: Add LTC parameters
  const ltcModeling = profile.ltcModelingEnabled !== false ? {
    enabled: true,
    approach: 'simple' as const,
    lifetimeProbability: profile.ltcLifetimeProbability || 0.70,
    averageDuration: profile.gender === 'F' ? 3.7 : 2.2,
    averageAnnualCost: calculateRegionalLTCCost(profile.state || 'National'),
    onsetAgeRange: [75, 85] as [number, number],
    costInflationRate: 0.049, // 4.9% LTC-specific inflation
    gender: profile.gender || 'F',
    maritalStatus: profile.maritalStatus || 'Single',
    familySupport: profile.familySupport || 'Medium',
    ltcInsurance: profile.ltcInsurance // Will be undefined initially
  } : undefined;

  return {
    // ... existing parameters ...
    ltcModeling
  };
}

// NEW: Regional cost calculator
function calculateRegionalLTCCost(state: string): number {
  const stateCostMultipliers = {
    'CA': 1.4,  // California - high cost
    'NY': 1.3,  // New York - high cost  
    'FL': 0.9,  // Florida - moderate cost
    'TX': 0.8,  // Texas - lower cost
    // ... all states
    'National': 1.0
  };
  
  const nationalBaseCost = 90000; // $90K average
  return nationalBaseCost * (stateCostMultipliers[state] || 1.0);
}
```

### **3. Single Iteration Enhancement**
```typescript
// server/monte-carlo-enhanced.ts - MODIFY existing iteration function
function runSingleRightCapitalStyleIteration(
  params: RetirementMonteCarloParams,
  iterationNumber: number,
  enableDetailedLogging: boolean
): SimulationIteration {
  // ... existing setup code ...

  // NEW: Generate LTC episode for this iteration
  const ltcEpisode = params.ltcModeling?.enabled 
    ? generateLTCEpisodeForIteration(params.ltcModeling, iterationNumber)
    : null;

  const yearlyData: YearData[] = [];
  let portfolioValue = params.currentRetirementAssets;

  // Existing yearly loop with LTC integration
  for (let year = 0; year < totalYears; year++) {
    const age = currentAge + year;
    
    // ... existing market return, inflation calculations ...
    
    // NEW: Calculate LTC cost for this year
    const ltcCostThisYear = ltcEpisode 
      ? calculateLTCCostForYear(ltcEpisode, age, year, inflationRate, ltcInflationRate)
      : 0;
    
    // MODIFIED: Enhanced expense calculation
    const baseExpenses = calculateBaseRetirementExpenses(age, params);
    const totalExpenses = baseExpenses + ltcCostThisYear;
    
    // ... existing portfolio calculation with new totalExpenses ...
    
    yearlyData.push({
      // ... existing fields ...
      ltcCost: ltcCostThisYear,
      baseExpenses: baseExpenses,
      totalExpenses: totalExpenses,
      ltcCumulative: yearlyData.reduce((sum, y) => sum + (y.ltcCost || 0), 0) + ltcCostThisYear
    });
  }

  // ... existing success calculation with enhanced expense tracking ...
}

// NEW: LTC Episode Generator
interface LTCEpisode {
  hasEpisode: boolean;
  onsetAge?: number;
  durationYears?: number;
  careType: 'HomeCare' | 'AssistedLiving' | 'NursingHome' | 'Memory';
  baseDailyCost?: number;
}

function generateLTCEpisodeForIteration(
  ltcParams: RetirementMonteCarloParams['ltcModeling'],
  iteration: number
): LTCEpisode {
  // Deterministic randomness using iteration as seed
  const rng = createSeededRNG(iteration + 10000); // Offset to avoid collision
  
  // Probability check: does this iteration have LTC need?
  if (rng() > ltcParams.lifetimeProbability) {
    return { hasEpisode: false, careType: 'HomeCare' };
  }
  
  // Generate onset age within range
  const [minAge, maxAge] = ltcParams.onsetAgeRange;
  const onsetAge = minAge + (maxAge - minAge) * rng();
  
  // Generate duration with gender adjustment
  const baseDuration = ltcParams.averageDuration;
  const genderMultiplier = ltcParams.gender === 'F' ? 1.15 : 0.85;
  const durationYears = Math.max(0.5, baseDuration * genderMultiplier * (0.5 + rng()));
  
  // Determine care type and base cost
  const careTypeProbs = {
    'HomeCare': 0.4,
    'AssistedLiving': 0.35, 
    'NursingHome': 0.20,
    'Memory': 0.05
  };
  
  const careType = sampleFromDistribution(careTypeProbs, rng);
  const baseDailyCost = {
    'HomeCare': ltcParams.averageAnnualCost * 0.6 / 365,      // 60% of average
    'AssistedLiving': ltcParams.averageAnnualCost * 0.8 / 365, // 80% of average
    'NursingHome': ltcParams.averageAnnualCost * 1.2 / 365,    // 120% of average
    'Memory': ltcParams.averageAnnualCost * 1.4 / 365         // 140% of average
  }[careType];

  return {
    hasEpisode: true,
    onsetAge: Math.round(onsetAge),
    durationYears,
    careType,
    baseDailyCost
  };
}

// NEW: Calculate LTC cost for specific year
function calculateLTCCostForYear(
  episode: LTCEpisode,
  currentAge: number,
  yearIndex: number,
  generalInflation: number,
  ltcInflation: number
): number {
  if (!episode.hasEpisode || !episode.onsetAge || !episode.baseDailyCost) return 0;
  
  // Check if this year falls within the LTC episode
  const episodeEndAge = episode.onsetAge + episode.durationYears;
  if (currentAge < episode.onsetAge || currentAge > episodeEndAge) return 0;
  
  // Apply LTC-specific inflation from year 0
  const inflatedDailyCost = episode.baseDailyCost * Math.pow(1 + ltcInflation, yearIndex);
  
  // Calculate partial year costs if episode starts/ends mid-year
  const yearsIntoEpisode = currentAge - episode.onsetAge;
  const fractionOfYear = Math.min(1, Math.max(0, 
    episode.durationYears - yearsIntoEpisode
  ));
  
  return inflatedDailyCost * 365 * fractionOfYear;
}
```

### **4. API Response Enhancement**
```typescript
// server/routes.ts - MODIFY existing Monte Carlo endpoint response
app.post("/api/calculate-retirement-monte-carlo", async (req, res, next) => {
  try {
    // ... existing setup ...
    
    const result = runRightCapitalStyleMonteCarloSimulation(params, ITERATIONS);
    
    // NEW: Calculate LTC-specific statistics
    const ltcStats = calculateLTCStatistics(result, params);
    
    // ENHANCED: Response with LTC data
    const response = {
      // ... existing fields ...
      successProbability: result.successProbability,
      
      // NEW: LTC impact analysis
      ltcAnalysis: ltcStats.enabled ? {
        modelingEnabled: true,
        lifetimeRisk: ltcStats.lifetimeRisk,
        averageLifetimeCost: ltcStats.averageLifetimeCost,
        impactOnSuccess: ltcStats.impactOnSuccess,
        withoutLTCSuccessRate: ltcStats.withoutLTCSuccessRate,
        percentagePointReduction: ltcStats.percentagePointReduction,
        
        // Scenario breakdown
        scenarios: {
          noLTC: ltcStats.scenarios.noLTC,
          shortTerm: ltcStats.scenarios.shortTerm,  // <2 years
          longTerm: ltcStats.scenarios.longTerm,    // 2-5 years  
          catastrophic: ltcStats.scenarios.catastrophic // >5 years
        },
        
        // Recommendations
        recommendations: ltcStats.recommendations
      } : { modelingEnabled: false }
    };
    
    res.json(response);
    // ... rest of existing logic ...
  }
  // ... existing error handling ...
});

// NEW: LTC Statistics Calculator
function calculateLTCStatistics(
  monteCarloResult: MonteCarloResult, 
  params: RetirementMonteCarloParams
): any {
  if (!params.ltcModeling?.enabled || !monteCarloResult.results) {
    return { enabled: false };
  }

  const results = monteCarloResult.results;
  let episodeCount = 0;
  let totalLTCCosts = 0;
  let successWithoutLTC = 0;
  
  // Analyze each iteration's LTC costs and success
  results.forEach(iteration => {
    const ltcCosts = iteration.yearlyData?.reduce((sum, year) => 
      sum + (year.ltcCost || 0), 0) || 0;
    
    if (ltcCosts > 1000) episodeCount++; // Had meaningful LTC costs
    totalLTCCosts += ltcCosts;
    
    // Re-check success without LTC costs
    const totalWithoutLTC = iteration.yearlyData?.reduce((sum, year) => 
      sum + (year.baseExpenses || 0), 0) || 0;
    // ... recalculate portfolio survival without LTC ...
    if (portfolioSurvivesWithoutLTC) successWithoutLTC++;
  });

  const lifetimeRisk = episodeCount / results.length;
  const averageLifetimeCost = totalLTCCosts / results.length;
  const withoutLTCRate = successWithoutLTC / results.length;
  const impactOnSuccess = withoutLTCRate - monteCarloResult.successProbability;

  return {
    enabled: true,
    lifetimeRisk,
    averageLifetimeCost,
    impactOnSuccess,
    withoutLTCSuccessRate: withoutLTCRate,
    percentagePointReduction: impactOnSuccess * 100,
    
    scenarios: calculateScenarioBreakdown(results),
    recommendations: generateLTCRecommendations(impactOnSuccess, averageLifetimeCost)
  };
}
```

### **5. Frontend Widget Enhancement**
```typescript
// client/src/components/retirement-monte-carlo-widget.tsx
// ADD to existing widget interface
interface MonteCarloResult {
  // ... existing fields ...
  
  // NEW: LTC Analysis
  ltcAnalysis?: {
    modelingEnabled: boolean;
    lifetimeRisk: number;
    averageLifetimeCost: number;
    impactOnSuccess: number;
    withoutLTCSuccessRate: number;
    percentagePointReduction: number;
    scenarios: {
      noLTC: { count: number; successRate: number };
      shortTerm: { count: number; successRate: number };
      longTerm: { count: number; successRate: number };
      catastrophic: { count: number; successRate: number };
    };
    recommendations: string[];
  };
}

// MODIFY: Enhanced widget display
const RetirementMonteCarloWidget = ({ /* props */ }) => {
  // ... existing state and logic ...

  return (
    <Card>
      {/* Existing success rate display */}
      <div className="success-rate-display">
        <Gauge value={monteCarloResult.probabilityOfSuccess * 100} />
        <span className="success-rate">{Math.round(monteCarloResult.probabilityOfSuccess * 100)}</span>
        
        {/* NEW: LTC Impact Indicator */}
        {monteCarloResult.ltcAnalysis?.modelingEnabled && (
          <div className="ltc-impact-indicator">
            <Tooltip content={`Without LTC costs: ${Math.round(monteCarloResult.ltcAnalysis.withoutLTCSuccessRate * 100)}% success rate`}>
              <Badge variant="secondary" className="text-xs">
                Includes LTC (-{Math.round(monteCarloResult.ltcAnalysis.percentagePointReduction)}%)
              </Badge>
            </Tooltip>
          </div>
        )}
      </div>

      {/* NEW: Expandable LTC Analysis Section */}
      {isExpanded && monteCarloResult.ltcAnalysis?.modelingEnabled && (
        <div className="ltc-analysis-section mt-4">
          <h4 className="text-sm font-medium text-white mb-2">
            Long-Term Care Impact Analysis
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="stat-item">
              <span className="text-gray-400">Lifetime LTC Risk:</span>
              <span className="text-white font-medium">
                {Math.round(monteCarloResult.ltcAnalysis.lifetimeRisk * 100)}%
              </span>
            </div>
            <div className="stat-item">
              <span className="text-gray-400">Average LTC Cost:</span>
              <span className="text-white font-medium">
                ${Math.round(monteCarloResult.ltcAnalysis.averageLifetimeCost / 1000)}K
              </span>
            </div>
          </div>

          <div className="scenario-breakdown mt-3">
            <h5 className="text-xs font-medium text-gray-300 mb-2">Scenario Analysis</h5>
            {Object.entries(monteCarloResult.ltcAnalysis.scenarios).map(([key, data]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-gray-400">{formatScenarioName(key)}:</span>
                <span className="text-gray-300">
                  {data.count} scenarios ({Math.round(data.successRate * 100)}% success)
                </span>
              </div>
            ))}
          </div>

          {monteCarloResult.ltcAnalysis.recommendations.length > 0 && (
            <div className="recommendations mt-3">
              <h5 className="text-xs font-medium text-gray-300 mb-2">Recommendations</h5>
              <ul className="text-xs text-gray-400 space-y-1">
                {monteCarloResult.ltcAnalysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* ... rest of existing widget ... */}
    </Card>
  );
};
```

---

## 🔄 **Data Flow Preservation Strategy**

### **Backward Compatibility Checkpoints**

#### **1. Parameter Structure**
```typescript
// ✅ SAFE: Optional ltcModeling field doesn't break existing code
interface RetirementMonteCarloParams {
  // All existing fields remain unchanged
  currentAge: number;           // ✅ Unchanged
  retirementAge: number;        // ✅ Unchanged
  annualRetirementExpenses: number; // ✅ Unchanged (base expenses)
  
  // NEW field is optional - no breaking changes
  ltcModeling?: LTCModelingParams; // ✅ Optional, defaults to undefined
}
```

#### **2. API Response Structure**
```typescript
// ✅ SAFE: New ltcAnalysis field is optional
interface MonteCarloResponse {
  // All existing fields remain unchanged
  successProbability: number;   // ✅ Unchanged value when LTC disabled
  medianEndingBalance: number;  // ✅ Unchanged calculation
  
  // NEW field doesn't break existing clients
  ltcAnalysis?: LTCAnalysis;    // ✅ Optional, only present when enabled
}
```

#### **3. Database Schema**
```typescript
// ✅ SAFE: New columns with defaults don't affect existing queries
ALTER TABLE financial_profiles 
ADD COLUMN ltc_modeling_enabled BOOLEAN DEFAULT TRUE;     // ✅ Default true for new users
ADD COLUMN ltc_lifetime_probability DECIMAL(3,2);        // ✅ NULL for existing users
ADD COLUMN monte_carlo_ltc_stats JSONB;                  // ✅ NULL for existing results
```

### **Migration Strategy for Existing Data**

#### **Existing Profiles**
```sql
-- Existing profiles get sensible defaults
UPDATE financial_profiles 
SET ltc_modeling_enabled = TRUE,
    ltc_lifetime_probability = 0.70
WHERE ltc_modeling_enabled IS NULL;

-- Existing Monte Carlo results remain valid
-- ltc_stats will be NULL until recalculated
```

#### **Existing Widgets**
```typescript
// Widgets gracefully handle missing LTC data
const ltcImpact = monteCarloResult.ltcAnalysis?.percentagePointReduction || 0;
const showLTCBadge = ltcImpact > 0 && monteCarloResult.ltcAnalysis?.modelingEnabled;

// Old results without ltcAnalysis still display correctly
```

---

## ⚡ **Performance Impact Analysis**

### **Computational Overhead**
```typescript
// Current: 1000 iterations × ~30 years × basic calculations = ~30K operations
// With LTC: 1000 iterations × ~30 years × (basic + LTC episode check) = ~35K operations
// Expected overhead: ~15-20% increase in execution time

// Mitigation: Optimize LTC calculations
function optimizedLTCCalculation(episode: LTCEpisode, age: number): number {
  // Cache calculations where possible
  // Pre-compute inflation factors
  // Use lookup tables for common scenarios
  return cachedOrCalculatedCost;
}
```

### **Memory Usage Impact**
```typescript
// Additional memory per iteration:
interface YearData {
  // Existing fields: ~200 bytes per year
  age: number;
  portfolioValue: number;
  // ... other existing fields
  
  // NEW fields: ~50 bytes per year
  ltcCost: number;              // 8 bytes
  baseExpenses: number;         // 8 bytes  
  ltcCumulative: number;        // 8 bytes
  ltcEpisodeActive: boolean;    // 1 byte
  // ... padding
}

// Total additional memory: 1000 iterations × 30 years × 50 bytes = ~1.5MB
// Current memory usage: ~6MB for full results
// New memory usage: ~7.5MB (25% increase)
// Acceptable for the additional functionality provided
```

### **API Response Size Impact**
```typescript
// Additional response payload:
ltcAnalysis: {
  // ~500 bytes additional JSON data
  modelingEnabled: boolean,     // 4 bytes
  lifetimeRisk: number,         // 8 bytes  
  averageLifetimeCost: number,  // 8 bytes
  impactOnSuccess: number,      // 8 bytes
  withoutLTCSuccessRate: number,// 8 bytes
  percentagePointReduction: number, // 8 bytes
  scenarios: { /* ... */ },     // ~300 bytes
  recommendations: string[]     // ~200 bytes
}

// Current response: ~2KB
// New response: ~2.5KB (25% increase)
// Well within acceptable limits
```

---

## 🧪 **Integration Testing Strategy**

### **Unit Tests for Core Functions**
```typescript
describe('LTC Monte Carlo Integration', () => {
  describe('generateLTCEpisodeForIteration', () => {
    test('generates no episode when probability is 0', () => {
      const params = { ...defaultLTCParams, lifetimeProbability: 0 };
      const episode = generateLTCEpisodeForIteration(params, 1);
      expect(episode.hasEpisode).toBe(false);
    });
    
    test('always generates episode when probability is 1', () => {
      const params = { ...defaultLTCParams, lifetimeProbability: 1 };
      const episode = generateLTCEpisodeForIteration(params, 1);
      expect(episode.hasEpisode).toBe(true);
    });
    
    test('respects gender duration adjustments', () => {
      const maleParams = { ...defaultLTCParams, gender: 'M' };
      const femaleParams = { ...defaultLTCParams, gender: 'F' };
      
      // Run many iterations to test statistical differences
      const maleDurations = [];
      const femaleDurations = [];
      
      for (let i = 0; i < 100; i++) {
        const maleEpisode = generateLTCEpisodeForIteration(maleParams, i);
        const femaleEpisode = generateLTCEpisodeForIteration(femaleParams, i);
        
        if (maleEpisode.hasEpisode) maleDurations.push(maleEpisode.durationYears);
        if (femaleEpisode.hasEpisode) femaleDurations.push(femaleEpisode.durationYears);
      }
      
      const avgMaleDuration = average(maleDurations);
      const avgFemaleDuration = average(femaleDurations);
      
      expect(avgFemaleDuration).toBeGreaterThan(avgMaleDuration);
    });
  });

  describe('calculateLTCCostForYear', () => {
    test('returns 0 when no episode', () => {
      const noEpisode = { hasEpisode: false, careType: 'HomeCare' };
      const cost = calculateLTCCostForYear(noEpisode, 75, 0, 0.03, 0.049);
      expect(cost).toBe(0);
    });
    
    test('applies LTC-specific inflation correctly', () => {
      const episode = {
        hasEpisode: true,
        onsetAge: 75,
        durationYears: 3,
        careType: 'AssistedLiving',
        baseDailyCost: 200
      };
      
      // Year 0: no inflation
      const year0Cost = calculateLTCCostForYear(episode, 75, 0, 0.03, 0.049);
      expect(year0Cost).toBe(200 * 365);
      
      // Year 1: 4.9% LTC inflation  
      const year1Cost = calculateLTCCostForYear(episode, 76, 1, 0.03, 0.049);
      expect(year1Cost).toBeCloseTo(200 * 365 * 1.049, -2);
    });
  });

  describe('Full Integration Test', () => {
    test('Monte Carlo with LTC produces lower success rate', () => {
      const baseProfile = createTestProfile();
      
      // Run without LTC
      const paramsWithoutLTC = { 
        ...profileToRetirementParams(baseProfile),
        ltcModeling: { enabled: false }
      };
      const resultWithoutLTC = runRightCapitalStyleMonteCarloSimulation(paramsWithoutLTC, 100);
      
      // Run with LTC
      const paramsWithLTC = profileToRetirementParams(baseProfile);
      const resultWithLTC = runRightCapitalStyleMonteCarloSimulation(paramsWithLTC, 100);
      
      // LTC should reduce success rate
      expect(resultWithLTC.successProbability).toBeLessThan(resultWithoutLTC.successProbability);
      
      // Reduction should be realistic (5-25 percentage points)
      const reduction = resultWithoutLTC.successProbability - resultWithLTC.successProbability;
      expect(reduction).toBeGreaterThan(0.05);
      expect(reduction).toBeLessThan(0.25);
    });
  });
});
```

### **Integration Tests**
```typescript
describe('API Integration', () => {
  test('POST /api/calculate-retirement-monte-carlo includes LTC analysis', async () => {
    const response = await request(app)
      .post('/api/calculate-retirement-monte-carlo')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);
    
    expect(response.body).toHaveProperty('ltcAnalysis');
    expect(response.body.ltcAnalysis).toHaveProperty('modelingEnabled', true);
    expect(response.body.ltcAnalysis).toHaveProperty('percentagePointReduction');
    expect(response.body.ltcAnalysis.percentagePointReduction).toBeGreaterThan(0);
  });
  
  test('Legacy requests without LTC still work', async () => {
    // Test with profile that has ltcModelingEnabled = false
    const response = await request(app)
      .post('/api/calculate-retirement-monte-carlo')
      .set('Authorization', `Bearer ${testTokenLegacy}`)
      .expect(200);
    
    expect(response.body).toHaveProperty('successProbability');
    expect(response.body.ltcAnalysis?.modelingEnabled).toBe(false);
  });
});
```

### **Frontend Widget Tests**
```typescript
describe('Retirement Monte Carlo Widget', () => {
  test('displays LTC impact badge when modeling enabled', () => {
    const mockResult = {
      successProbability: 0.80,
      ltcAnalysis: {
        modelingEnabled: true,
        percentagePointReduction: 12,
        withoutLTCSuccessRate: 0.92
      }
    };
    
    render(<RetirementMonteCarloWidget monteCarloResult={mockResult} />);
    
    expect(screen.getByText(/Includes LTC \(-12%\)/)).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument(); // Success rate display
  });
  
  test('does not display LTC badge when modeling disabled', () => {
    const mockResult = {
      successProbability: 0.85,
      ltcAnalysis: { modelingEnabled: false }
    };
    
    render(<RetirementMonteCarloWidget monteCarloResult={mockResult} />);
    
    expect(screen.queryByText(/Includes LTC/)).not.toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });
});
```

---

## 📈 **Monitoring & Validation Strategy**

### **Success Rate Distribution Monitoring**
```typescript
// Add monitoring for success rate distributions
app.post('/api/calculate-retirement-monte-carlo', async (req, res, next) => {
  try {
    const result = runRightCapitalStyleMonteCarloSimulation(params, 1000);
    
    // Monitor for anomalous results
    if (result.successProbability < 0.1 || result.successProbability > 0.99) {
      console.warn('Anomalous success rate detected:', {
        userId: req.user.id,
        successRate: result.successProbability,
        ltcEnabled: params.ltcModeling?.enabled,
        ltcImpact: result.ltcAnalysis?.percentagePointReduction
      });
      
      // Send to monitoring system
      analytics.track('anomalous_success_rate', {
        userId: req.user.id,
        successRate: result.successProbability,
        ltcImpact: result.ltcAnalysis?.percentagePointReduction
      });
    }
    
    // ... rest of response logic
  }
});
```

### **Calibration Validation**
```typescript
// Automated calibration checks
const validateLTCCalibration = () => {
  const testProfiles = [
    createTypicalProfile(), 
    createAffluentProfile(),
    createSingleFemaleProfile()
  ];
  
  testProfiles.forEach(profile => {
    const withoutLTC = runMonteCarloWithoutLTC(profile);
    const withLTC = runMonteCarloWithLTC(profile);
    const impact = withoutLTC.successProbability - withLTC.successProbability;
    
    // Validate against research benchmarks
    if (profile.type === 'typical' && (impact < 0.08 || impact > 0.22)) {
      console.error('LTC impact out of expected range for typical profile:', impact);
    }
    if (profile.type === 'affluent' && (impact < 0.02 || impact > 0.08)) {
      console.error('LTC impact out of expected range for affluent profile:', impact);
    }
  });
};
```

---

## 🔧 **Development Environment Setup**

### **Feature Flag Implementation**
```typescript
// Environment variables
const LTC_MODELING_DEFAULT = process.env.NODE_ENV === 'production' ? 'true' : 'false';
const LTC_FEATURE_FLAG = process.env.LTC_FEATURE_ENABLED || LTC_MODELING_DEFAULT;

// Per-user override in database
interface FinancialProfile {
  // ... existing fields ...
  ltcModelingEnabled?: boolean; // User preference override
  ltcFeatureOverride?: boolean; // Admin override for testing
}

// Runtime feature check
function isLTCModelingEnabled(profile: any): boolean {
  // Admin override takes precedence
  if (profile.ltcFeatureOverride !== undefined) {
    return profile.ltcFeatureOverride;
  }
  
  // User preference
  if (profile.ltcModelingEnabled !== undefined) {
    return profile.ltcModelingEnabled;
  }
  
  // Global feature flag
  return LTC_FEATURE_FLAG === 'true';
}
```

### **Local Development Testing**
```typescript
// Create test profiles for different scenarios
const createLTCTestProfiles = () => {
  return {
    noLTCRisk: {
      ...baseProfile,
      ltcModelingEnabled: true,
      ltcLifetimeProbability: 0.0 // Force no LTC episodes
    },
    
    guaranteedLTC: {
      ...baseProfile, 
      ltcModelingEnabled: true,
      ltcLifetimeProbability: 1.0, // Force LTC episode
      ltcAverageAnnualCost: 100000
    },
    
    regionalVariation: {
      california: { ...baseProfile, state: 'CA' },    // High cost
      florida: { ...baseProfile, state: 'FL' },       // Moderate cost  
      texas: { ...baseProfile, state: 'TX' }          // Lower cost
    }
  };
};
```

---

This technical analysis provides the specific integration points and code modifications needed to implement LTC modeling in your Monte Carlo simulation without breaking existing functionality. The approach maintains backward compatibility while adding comprehensive LTC risk modeling capabilities.
