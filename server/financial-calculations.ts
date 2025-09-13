// Re-export functions from their original locations for shared use
export { 
  // Keep legacy export for tests if needed (but do not use in routes)
  runRightCapitalStyleMonteCarloSimulation,
  // Preferred enhanced engine export
  runEnhancedMonteCarloSimulation,
  profileToRetirementParams,
  calculateEducationProjectionWithMonteCarlo 
} from './monte-carlo-enhanced';

// Re-export from routes.ts (we'll need to move these functions here)
import type { EstatePlan } from "@shared/schema";
import { storage } from "./storage";

// Financial calculations - moved from routes.ts for reusability
export async function calculateFinancialMetrics(profileData: any, estateDocuments: any[] = []) {
  const assets = Array.isArray(profileData.assets) ? profileData.assets : [];
  const liabilities = Array.isArray(profileData.liabilities) ? profileData.liabilities : [];

  // Calculate basic metrics
  const totalAssets = assets.reduce((sum: number, asset: any) => sum + (parseFloat(asset.value) || 0), 0);
  const totalLiabilities = liabilities.reduce((sum: number, debt: any) => sum + (parseFloat(debt.balance) || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Get annual income
  const annualIncome = parseFloat(profileData.annualIncome) || 0;
  const spouseAnnualIncome = parseFloat(profileData.spouseAnnualIncome) || 0;
  const totalAnnualIncome = annualIncome + spouseAnnualIncome;

  // Calculate monthly expenses - 3-tier hierarchy
  const monthlyExpenses = profileData.monthlyExpenses || {};
  
  // 1. First priority: Sum of categorized expenses if user entered them
  const categorizedExpenses = Object.values(monthlyExpenses).reduce((sum: number, expense: any) => {
    const val = parseFloat(expense) || 0;
    return sum + val;
  }, 0);
  
  // 2. Second priority: Manual total override
  const manualTotalExpenses = parseFloat(profileData.totalMonthlyExpenses) || 0;
  
  // 3. Third priority: Auto-calculated from checking (stored in _lastAutoFill metadata)
  const autoCalculatedExpenses = monthlyExpenses._lastAutoFill?.total || 0;
  
  // Use hierarchy: categorized > manual > auto-calculated
  let totalMonthlyExpenses = 0;
  if (categorizedExpenses > 0) {
    totalMonthlyExpenses = categorizedExpenses;
  } else if (manualTotalExpenses > 0) {
    totalMonthlyExpenses = manualTotalExpenses;
  } else {
    totalMonthlyExpenses = autoCalculatedExpenses;
  }
  const annualExpenses = totalMonthlyExpenses * 12;

  // Calculate monthly cash flow
  const monthlyIncome = totalAnnualIncome / 12;
  const monthlyCashFlow = monthlyIncome - totalMonthlyExpenses;

  // Calculate emergency fund metrics
  const emergencyFundSize = parseFloat(profileData.emergencyFundSize) || 0;
  const emergencyMonths = totalMonthlyExpenses > 0 ? emergencyFundSize / totalMonthlyExpenses : 0;

  // Determine emergency fund target based on earner status
  // If both user and spouse have income > 0, then dual earner (3 months target)
  // If only one has income > 0, then single earner (6 months target)
  const isDualEarner = annualIncome > 0 && spouseAnnualIncome > 0;
  const emergencyFundTargetMonths = isDualEarner ? 3 : 6;

  // Calculate debt-to-income ratio
  const monthlyDebtPayments = liabilities.reduce((sum: number, debt: any) => sum + (parseFloat(debt.monthlyPayment) || 0), 0);
  const dtiRatio = monthlyIncome > 0 ? (monthlyDebtPayments / monthlyIncome) * 100 : 0;

  // Calculate savings rate
  const savingsRate = monthlyIncome > 0 ? (monthlyCashFlow / monthlyIncome) * 100 : 0;

  // Calculate emergency readiness score (CFP guidelines) - now based on dynamic target
  let emergencyReadinessScoreCFP = 0;
  if (emergencyMonths >= emergencyFundTargetMonths) emergencyReadinessScoreCFP = 100;
  else if (emergencyMonths >= emergencyFundTargetMonths * 0.5) emergencyReadinessScoreCFP = 70;
  else if (emergencyMonths >= 1) emergencyReadinessScoreCFP = 40;
  else emergencyReadinessScoreCFP = 10;

  // Calculate basic health score (simplified version)
  let healthScore = 0;
  
  // Net worth component (0-25 points)
  if (netWorth > 0) healthScore += Math.min(25, netWorth / 10000);
  
  // Emergency fund component (0-25 points) - uses the CFP-aligned emergency readiness score
  // Scale the emergencyReadinessScoreCFP (0-100) to health score points (0-25)
  healthScore += (emergencyReadinessScoreCFP / 100) * 25;
  
  // Debt ratio component (0-25 points)
  if (dtiRatio <= 20) healthScore += 25;
  else if (dtiRatio <= 36) healthScore += 15;
  else if (dtiRatio <= 50) healthScore += 5;
  
  // Savings rate component (0-25 points)
  if (savingsRate >= 20) healthScore += 25;
  else if (savingsRate >= 10) healthScore += 15;
  else if (savingsRate >= 5) healthScore += 5;

  // Basic retirement score calculation
  const currentAge = profileData.dateOfBirth ? 
    new Date().getFullYear() - new Date(profileData.dateOfBirth).getFullYear() : 30;
  const retirementAge = parseInt(profileData.retirementAge) || 67;
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  
  // Get retirement assets
  const retirementAssets = assets.filter((asset: any) => 
    asset.type && (
      asset.type.toLowerCase().includes('401') ||
      asset.type.toLowerCase().includes('ira') ||
      asset.type.toLowerCase().includes('retirement') ||
      asset.type.toLowerCase().includes('pension')
    )
  );
  const totalRetirementAssets = retirementAssets.reduce((sum: number, asset: any) => sum + (parseFloat(asset.value) || 0), 0);
  
  // Simple retirement score based on current savings vs target
  const targetRetirementSavings = annualExpenses * 25; // 4% rule
  const retirementScore = targetRetirementSavings > 0 ? 
    Math.min(100, (totalRetirementAssets / targetRetirementSavings) * 100) : 0;

  // Risk profile calculation (simplified)
  const riskScore = parseInt(profileData.riskTolerance) || 3;
  let riskProfile = 'Moderate';
  if (riskScore <= 2) riskProfile = 'Conservative';
  else if (riskScore >= 4) riskProfile = 'Aggressive';

  // Target allocation based on age and risk profile
  const stockPercentage = Math.max(20, Math.min(90, 100 - currentAge + (riskScore - 3) * 10));
  const bondPercentage = Math.min(60, Math.max(10, currentAge - (riskScore - 3) * 10));
  const alternativePercentage = Math.min(20, Math.max(0, riskScore - 2) * 5);
  const cashPercentage = Math.max(5, 100 - stockPercentage - bondPercentage - alternativePercentage);

  const targetAllocation = {
    usStocks: Math.round(stockPercentage * 0.7),
    intlStocks: Math.round(stockPercentage * 0.3),
    bonds: bondPercentage,
    alternatives: alternativePercentage,
    cash: cashPercentage
  };

  // Generate comprehensive financial health recommendations
  const recommendations = [];
  
  // 1. Emergency Fund Adequacy Analysis
  // Use the same logic as the scoring system for consistency
  const recommendedEmergencyMonths = emergencyFundTargetMonths;
  
  if (emergencyMonths < recommendedEmergencyMonths) {
    const shortfall = (recommendedEmergencyMonths - emergencyMonths) * totalMonthlyExpenses;
    const reasonText = isDualEarner ? 'dual income household (both earners provide income diversification)' : 
                      'single earner household (higher income concentration risk)';
    
    recommendations.push({
      title: "Build Emergency Fund",
      description: `You need ${recommendedEmergencyMonths} months of expenses (${shortfall.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} more) for a ${reasonText}`,
      priority: emergencyMonths < 1 ? 1 : 2,
      potentialImprovement: 25,
      actionSteps: [
        "Set up automatic transfer to high-yield savings account",
        `Save additional $${Math.round(shortfall/12).toLocaleString()} monthly`,
        "Consider money market account for better rates"
      ]
    });
  }

  // 2. Life Insurance Analysis (for earning spouses)
  const hasSpouseIncome = spouseAnnualIncome > 0;
  const hasLifeInsurance = profileData.lifeInsurance && parseFloat(profileData.lifeInsurance) > 0;
  const lifeInsuranceCoverage = parseFloat(profileData.lifeInsurance || '0');
  
  if (hasSpouseIncome && (!hasLifeInsurance || lifeInsuranceCoverage < totalAnnualIncome * 10)) {
    const recommendedCoverage = totalAnnualIncome * 10;
    const currentGap = recommendedCoverage - lifeInsuranceCoverage;
    recommendations.push({
      title: "Increase Life Insurance Coverage",
      description: `With ${totalAnnualIncome.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} annual income, you need ${recommendedCoverage.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} in coverage (${currentGap.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} gap)`,
      priority: profileData.dependents > 0 ? 1 : 2,
      potentialImprovement: 30,
      actionSteps: [
        "Get term life insurance quotes from multiple providers",
        "Consider 20-30 year level term policy",
        "Review beneficiaries annually"
      ]
    });
  }

  // 3. Disability Insurance Analysis
  const hasDisabilityInsurance = profileData.disabilityInsurance;
  if ((annualIncome > 0 || spouseAnnualIncome > 0) && !hasDisabilityInsurance) {
    recommendations.push({
      title: "Get Disability Insurance",
      description: `Protect ${totalAnnualIncome.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} annual income with disability coverage`,
      priority: profileData.dependents > 0 ? 1 : 2,
      potentialImprovement: 25,
      actionSteps: [
        "Check employer-provided coverage first",
        "Consider supplemental individual policy",
        "Aim for 60-70% income replacement"
      ]
    });
  }

  // 4. High-Interest Debt Management
  const highInterestDebt = liabilities.filter((debt: any) => 
    parseFloat(debt.interestRate || '0') > 7
  );
  const totalHighInterestDebt = highInterestDebt.reduce((sum: number, debt: any) => 
    sum + (parseFloat(debt.balance) || 0), 0);
  
  if (totalHighInterestDebt > 0) {
    recommendations.push({
      title: "Pay Down High-Interest Debt",
      description: `Eliminate ${totalHighInterestDebt.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} in high-interest debt (>7% APR) before investing`,
      priority: 1,
      potentialImprovement: 20,
      actionSteps: [
        "List debts by interest rate (avalanche method)",
        "Pay minimums on all, extra on highest rate",
        "Consider debt consolidation if beneficial"
      ]
    });
  }

  // 5. Negative Cash Flow Analysis
  if (monthlyCashFlow < 0) {
    const monthlyDeficit = Math.abs(monthlyCashFlow);
    recommendations.push({
      title: "Address Negative Cash Flow",
      description: `Monthly deficit of ${monthlyDeficit.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} needs immediate attention`,
      priority: 1,
      potentialImprovement: 35,
      actionSteps: [
        "Review and cut discretionary expenses",
        "Consider additional income sources",
        "Create zero-based budget",
        "Track spending for 30 days"
      ]
    });
  }

  // 6. Retirement Savings Analysis
  const currentRetirementContribution = parseFloat(profileData.retirementContribution || '0');
  const recommendedContribution = Math.min(totalAnnualIncome * 0.15, 
    currentAge >= 50 ? 30000 : 23000); // 2024 401k limits with catch-up
  
  if (currentRetirementContribution < recommendedContribution) {
    const additionalSavingsNeeded = recommendedContribution - currentRetirementContribution;
    recommendations.push({
      title: "Increase Retirement Savings",
      description: `Save ${additionalSavingsNeeded.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} more annually (currently ${((currentRetirementContribution/totalAnnualIncome)*100).toFixed(1)}%, target 15%)`,
      priority: currentRetirementContribution < totalAnnualIncome * 0.10 ? 1 : 2,
      potentialImprovement: 30,
      actionSteps: [
        currentAge >= 50 ? "Maximize catch-up contributions ($7,500 extra)" : "Increase by 1% annually",
        "Ensure employer match is maximized",
        "Consider Roth vs Traditional allocation"
      ]
    });
  }

  // 7. Tax Optimization Analysis
  const taxableInvestments = assets.filter((asset: any) => 
    asset.type && asset.type.toLowerCase().includes('taxable')
  ).reduce((sum: number, asset: any) => sum + (parseFloat(asset.value) || 0), 0);

  if (taxableInvestments > 50000 && !profileData.taxLossHarvesting) {
    recommendations.push({
      title: "Implement Tax-Loss Harvesting",
      description: `With ${taxableInvestments.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} in taxable investments, harvest losses to reduce taxes`,
      priority: 3,
      potentialImprovement: 10,
      actionSteps: [
        "Review portfolio for unrealized losses",
        "Avoid wash sale rules (30-day period)",
        "Reinvest in similar but not identical assets"
      ]
    });
  }

  // 8. Investment Diversification Analysis
  const stockAllocation = parseFloat(profileData.currentStockAllocation || '0');
  const bondAllocation = parseFloat(profileData.currentBondAllocation || '0');
  const targetStockAllocation = targetAllocation.usStocks + targetAllocation.intlStocks;
  
  if (Math.abs(stockAllocation - targetStockAllocation) > 15) {
    recommendations.push({
      title: "Rebalance Portfolio",
      description: `Current ${stockAllocation}% stocks vs ${targetStockAllocation}% target - rebalance for optimal risk/return`,
      priority: 2,
      potentialImprovement: 15,
      actionSteps: [
        "Use new contributions to rebalance",
        "Consider tax implications in taxable accounts",
        "Set calendar reminder for quarterly review"
      ]
    });
  }

  // 9. Estate Planning Documentation
  const hasWill = estateDocuments.some((doc: any) => 
    doc.type && doc.type.toLowerCase().includes('will'));
  const hasPowerOfAttorney = estateDocuments.some((doc: any) => 
    doc.type && doc.type.toLowerCase().includes('power'));
  
  if (!hasWill || !hasPowerOfAttorney) {
    const missingDocs = [];
    if (!hasWill) missingDocs.push("Will");
    if (!hasPowerOfAttorney) missingDocs.push("Power of Attorney");
    
    recommendations.push({
      title: "Complete Estate Planning Documents",
      description: `Missing essential documents: ${missingDocs.join(', ')}`,
      priority: profileData.dependents > 0 || netWorth > 100000 ? 1 : 2,
      potentialImprovement: 20,
      actionSteps: [
        "Consult with estate planning attorney",
        "Review beneficiaries on all accounts",
        "Update documents every 3-5 years"
      ]
    });
  }

  // 10. Long-Term Care Planning
  if (currentAge >= 50 && !profileData.hasLongTermCareInsurance) {
    recommendations.push({
      title: "Consider Long-Term Care Planning",
      description: "Plan for potential long-term care costs (avg. $55,000+ annually)",
      priority: 3,
      potentialImprovement: 15,
      actionSteps: [
        "Research LTC insurance options",
        "Consider hybrid life/LTC policies",
        "Include LTC costs in retirement planning"
      ]
    });
  }

  // 11. Education Funding Analysis
  if (profileData.dependents > 0 && !profileData.education529Plan) {
    const childrenCount = parseInt(profileData.dependents) || 1;
    const estimatedCollegeCost = 200000 * childrenCount; // Rough estimate
    
    recommendations.push({
      title: "Start Education Savings",
      description: `Save for college costs (est. ${estimatedCollegeCost.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} for ${childrenCount} child${childrenCount > 1 ? 'ren' : ''})`,
      priority: 2,
      potentialImprovement: 20,
      actionSteps: [
        "Open 529 education savings plan",
        "Start with automated monthly contributions",
        "Research state tax benefits for 529 contributions"
      ]
    });
  }

  // 12. Account Beneficiary Review
  if (!profileData.beneficiariesUpdated || 
      new Date(profileData.beneficiariesUpdated) < new Date(Date.now() - 365*24*60*60*1000)) {
    recommendations.push({
      title: "Update Account Beneficiaries",
      description: "Review and update beneficiaries on all financial accounts annually",
      priority: 2,
      potentialImprovement: 10,
      actionSteps: [
        "Review 401(k) and IRA beneficiaries",
        "Update life insurance beneficiaries",
        "Ensure contingent beneficiaries are named"
      ]
    });
  }

  // Sort recommendations by priority and potential improvement
  recommendations.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.potentialImprovement - a.potentialImprovement;
  });

  // Pass through current allocation if available
  const currentAllocation = profileData.currentAllocation || {};
  
  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    monthlyCashFlow,
    emergencyMonths,
    emergencyFundTargetMonths,
    isDualEarner,
    dtiRatio,
    savingsRate,
    healthScore: Math.round(healthScore),
    emergencyReadinessScoreCFP,
    retirementScore: Math.round(retirementScore),
    riskScore,
    riskProfile,
    targetAllocation,
    recommendations,
    // Include current allocation for reference
    allocation: currentAllocation
  };
}

// Generate cash flow data for the interactive map
export function generateCashFlowData(profile: any, options: { scenarioId: string; percentile: number }) {
  const currentYear = new Date().getFullYear();
  const currentAge = profile.age || (profile.dateOfBirth ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : 30);
  
  // Get basic financial data
  const annualIncome = parseFloat(profile.annualIncome) || 0;
  const spouseAnnualIncome = parseFloat(profile.spouseAnnualIncome) || 0;
  const totalAnnualIncome = annualIncome + spouseAnnualIncome;
  
  const monthlyExpenses = profile.monthlyExpenses || {};
  
  // Filter out metadata before calculating sum
  const categorizedExpenses = Object.entries(monthlyExpenses)
    .filter(([key]) => !key.startsWith('_'))
    .reduce((sum: number, [, expense]: [string, any]) => sum + (parseFloat(expense) || 0), 0);
  
  const manualTotalExpenses = parseFloat(profile.totalMonthlyExpenses) || 0;
  const autoCalculatedExpenses = monthlyExpenses._lastAutoFill?.total || 0;
  
  // Use hierarchy: categorized > manual > auto-calculated
  let totalMonthlyExpenses = 0;
  if (categorizedExpenses > 0) {
    totalMonthlyExpenses = categorizedExpenses;
  } else if (manualTotalExpenses > 0) {
    totalMonthlyExpenses = manualTotalExpenses;
  } else {
    totalMonthlyExpenses = autoCalculatedExpenses;
  }
  const annualExpenses = totalMonthlyExpenses * 12;
  
  // Generate projections for next 30 years
  const projections = [];
  const inflationRate = 0.025; // 2.5% inflation
  const salaryGrowthRate = 0.03; // 3% salary growth
  
  for (let i = 0; i < 30; i++) {
    const year = currentYear + i;
    const age = currentAge + i;
    
    // Apply inflation and salary growth
    const inflationMultiplier = Math.pow(1 + inflationRate, i);
    const salaryMultiplier = Math.pow(1 + salaryGrowthRate, i);
    
    const grossIncome = totalAnnualIncome * salaryMultiplier;
    const expenses = annualExpenses * inflationMultiplier;
    
    // Simple tax calculation
    const taxRate = grossIncome < 50000 ? 0.12 : 
                   grossIncome < 100000 ? 0.22 : 
                   grossIncome < 200000 ? 0.24 : 0.32;
    
    const taxes = grossIncome * taxRate;
    const netIncome = grossIncome - taxes;
    const cashFlow = netIncome - expenses;
    
    projections.push({
      year,
      age,
      inflows: {
        grossIncome: Math.round(grossIncome),
        netIncome: Math.round(netIncome)
      },
      outflows: {
        taxes: Math.round(taxes),
        fixed: Math.round(expenses),
        total: Math.round(expenses)
      },
      netCashFlow: Math.round(cashFlow),
      effectiveTaxRate: taxRate
    });
  }
  
  return projections;
}

// Calculate estate analysis with tax projections
export async function calculateEstateAnalysis(plan: EstatePlan, userId: number): Promise<any> {
  const profile = await storage.getFinancialProfile(userId);
  if (!profile) return {};

  const totalEstateValue = parseFloat(plan.totalEstateValue || '0');
  const federalExemption = 12920000; // 2023 federal exemption
  const stateExemption = getStateEstateExemption(profile.state || '');
  
  const federalTaxableEstate = Math.max(0, totalEstateValue - federalExemption);
  const stateTaxableEstate = Math.max(0, totalEstateValue - stateExemption);
  
  const federalEstateTax = federalTaxableEstate * 0.40; // 40% federal rate
  const stateEstateTax = stateTaxableEstate * getStateEstateRate(profile.state || '');
  
  const totalEstateTax = federalEstateTax + stateEstateTax;
  const netToHeirs = totalEstateValue - totalEstateTax;
  
  return {
    totalEstateValue,
    federalExemption,
    stateExemption,
    federalTaxableEstate,
    stateTaxableEstate,
    federalEstateTax,
    stateEstateTax,
    totalEstateTax,
    netToHeirs
  };
}

function getStateEstateExemption(state: string): number {
  const stateExemptions: { [key: string]: number } = {
    'NY': 6580000,
    'CA': 12920000, // Follows federal
    'WA': 2193000,
    'OR': 1000000,
    // Add more states as needed
  };
  return stateExemptions[state] || 12920000; // Default to federal
}

function getStateEstateRate(state: string): number {
  const stateRates: { [key: string]: number } = {
    'NY': 0.16,
    'WA': 0.20,
    'OR': 0.10,
    // Add more states as needed
  };
  return stateRates[state] || 0; // Most states have no estate tax
}
