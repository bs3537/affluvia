import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Mock profile data with low retirement confidence score
const mockProfile = {
  desiredRetirementAge: 62,
  spouseDesiredRetirementAge: 62,
  annualIncome: 120000,
  spouseAnnualIncome: 80000,
  expectedMonthlyExpensesRetirement: 10000,
  retirementContributions: { employee: 500, employer: 500 },
  spouseRetirementContributions: { employee: 300, employer: 300 },
  hasLongTermCareInsurance: false,
  spouseHasLongTermCareInsurance: false,
  expectedRealReturn: -1, // Glide path
  riskQuestions: [3], // Moderate risk
  spouseRiskQuestions: [3]
};

// Mock Monte Carlo result with low confidence score
const mockCurrentResult = {
  probabilityOfSuccess: 55 // Low confidence score to trigger delay recommendation
};

const mockOptimalAges = {
  userOptimalSSAge: 70,
  spouseOptimalSSAge: 70,
  currentAge: 45,
  spouseAge: 43
};

async function testRetirementDelayRecommendations() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const userRiskProfile = mockProfile.riskQuestions?.[0] || 3;
  const spouseRiskProfile = mockProfile.spouseRiskQuestions?.[0] || 3;
  const riskProfileMap = {
    1: "Conservative",
    2: "Moderately Conservative", 
    3: "Moderate",
    4: "Moderately Aggressive",
    5: "Aggressive"
  };

  const monthlyContributions = ((mockProfile.retirementContributions?.employee || 0) + (mockProfile.retirementContributions?.employer || 0) + 
    (mockProfile.spouseRetirementContributions?.employee || 0) + (mockProfile.spouseRetirementContributions?.employer || 0)) / 12;
  
  const monthlyIncome = ((mockProfile.annualIncome || 0) + (mockProfile.spouseAnnualIncome || 0)) / 12;
  const monthlyExpenses = mockProfile.expectedMonthlyExpensesRetirement || 8000;
  const monthlyCashFlow = monthlyIncome - monthlyExpenses - monthlyContributions;
  
  const hasLTC = mockProfile.hasLongTermCareInsurance;
  const spouseHasLTC = mockProfile.spouseHasLongTermCareInsurance;
    
  const prompt = `As a financial advisor, analyze this retirement plan and provide EXACTLY 5 optimization suggestions.

Current Retirement Confidence Score: ${mockCurrentResult.probabilityOfSuccess.toFixed(1)}%
User Age: ${mockOptimalAges.currentAge}, Spouse Age: ${mockOptimalAges.spouseAge}
Current Retirement Ages: User ${mockProfile.desiredRetirementAge || 65}, Spouse ${mockProfile.spouseDesiredRetirementAge || 65}
Current SS Claim Strategy: Not optimized
SS Optimization Available: Yes (requires retirement variable optimization first)
Risk Profiles: User ${riskProfileMap[userRiskProfile]}, Spouse ${riskProfileMap[spouseRiskProfile]}
Investment Strategy: Glide Path
Monthly Retirement Contributions: $${monthlyContributions}
Expected Monthly Expenses: $${mockProfile.expectedMonthlyExpensesRetirement || 8000}
Annual Income: $${mockProfile.annualIncome || 0}
Spouse Annual Income: $${mockProfile.spouseAnnualIncome || 0}
Monthly Cash Flow Available: $${monthlyCashFlow.toFixed(0)}
Has Long-Term Care Insurance: ${hasLTC ? 'Yes' : 'No'}
Spouse Has LTC Insurance: ${spouseHasLTC ? 'Yes' : 'No'}

Retirement Account Opportunities Found: 2
- Traditional IRA: up to $7000/year
- Roth IRA: up to $7000/year

PRIORITY ORDER (MUST follow this):
1. Long-term care insurance (if not covered)
2. Maximize 401(k) retirement contributions (if cash flow available)
3. Contribute to Traditional or Roth IRA (if room based on cash flow)
4. Consider delaying retirement (if below 80% confidence)
5. Reduce monthly planned expenses in retirement
6. Optimize Social Security claiming strategy
7. Consider part-time work in retirement

Return EXACTLY 5 suggestions in this format:
1. [Action Item] | +X.X% expected improvement
2. [Action Item] | +X.X% expected improvement
3. [Action Item] | +X.X% expected improvement
4. [Action Item] | +X.X% expected improvement
5. [Action Item] | +X.X% expected improvement

Rules:
- Each action item must be ONE SHORT LINE (max 12 words)
- Be SPECIFIC with numbers (e.g., "Open Traditional IRA, contribute $7,000/year")
- Rank by the PRIORITY ORDER above, not just by impact
- Include realistic improvement estimates based on the action
- If LTC insurance missing, it MUST be first recommendation
- If cash flow positive and 401(k) available, MUST recommend it before IRA
- If cash flow allows IRA after 401(k), recommend Traditional or Roth IRA
- Consider delaying retirement if below 80% confidence score
- Include part-time work option if struggling to reach goals
- NEVER mention specific ages for Social Security claiming (no "age 67", "age 70", etc.)
- For Social Security, only say "Optimize Social Security claiming strategy"`;

  console.log('Testing retirement delay recommendations with low confidence score (55%)...\n');
  console.log('Expected recommendations should include:');
  console.log('1. LTC insurance (since not covered)');
  console.log('2. Maximize 401(k) if cash flow available');
  console.log('3. IRA contributions if cash flow allows');
  console.log('4. Delay retirement (since below 80% confidence)');
  console.log('5. Other recommendations\n');
  console.log('-----------------------------------\n');

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const recommendations = response.text();
    
    console.log('AI Generated Recommendations:');
    console.log(recommendations);
    console.log('\n-----------------------------------\n');
    
    // Check if delay retirement is mentioned
    if (recommendations.toLowerCase().includes('delay retirement')) {
      console.log('✅ SUCCESS: "Delay retirement" recommendation is included!');
    } else {
      console.log('❌ WARNING: "Delay retirement" recommendation is missing!');
    }
    
    // Check if LTC insurance is first
    const lines = recommendations.split('\n').filter(line => line.trim());
    if (lines[0] && lines[0].toLowerCase().includes('long-term care')) {
      console.log('✅ LTC insurance is correctly prioritized first');
    } else {
      console.log('⚠️  LTC insurance should be first recommendation');
    }
    
  } catch (error) {
    console.error('Error generating recommendations:', error);
    
    // Test fallback logic
    console.log('\nTesting fallback recommendations logic...\n');
    
    const fallbackSuggestions = [];
    
    // Priority 1: LTC Insurance
    if (!hasLTC || !spouseHasLTC) {
      const who = !hasLTC && !spouseHasLTC ? 'both spouses' : !hasLTC ? 'user' : 'spouse';
      fallbackSuggestions.push(`1. Get long-term care insurance for ${who} | +6.5% expected improvement`);
    }
    
    // Priority 2: Maximize 401(k) contributions
    if (monthlyCashFlow > 500) {
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Maximize 401(k): contribute $24,000/year | +5.2% expected improvement`);
    }
    
    // Priority 3: IRA contributions
    if (monthlyCashFlow > 300) {
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Open Traditional IRA, contribute $7,000/year | +3.8% expected improvement`);
    }
    
    // Priority 4: Delay retirement
    if (mockCurrentResult.probabilityOfSuccess < 80) {
      const yearsToDelay = mockCurrentResult.probabilityOfSuccess < 60 ? 3 : 2;
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Delay retirement by ${yearsToDelay} years | +${yearsToDelay === 3 ? '10.5' : '8.3'}% expected improvement`);
    }
    
    // Priority 5: Reduce monthly expenses
    if (mockProfile.expectedMonthlyExpensesRetirement > 6000) {
      const reduction = Math.min(1000, Math.round(mockProfile.expectedMonthlyExpensesRetirement * 0.1));
      fallbackSuggestions.push(`${fallbackSuggestions.length + 1}. Reduce retirement expenses by $${reduction}/month | +3.2% expected improvement`);
    }
    
    console.log('Fallback Recommendations:');
    fallbackSuggestions.slice(0, 5).forEach(rec => console.log(rec));
    
    if (fallbackSuggestions.some(rec => rec.toLowerCase().includes('delay retirement'))) {
      console.log('\n✅ Fallback logic correctly includes "Delay retirement" recommendation!');
    }
  }
}

// Run the test
testRetirementDelayRecommendations().catch(console.error);