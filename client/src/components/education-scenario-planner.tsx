import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sliders, 
  TrendingUp, 
  DollarSign,
  Calculator,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  RefreshCcw,
  Save,
  Info,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Bar } from 'react-chartjs-2';

interface EducationGoal {
  id?: string;
  studentName: string;
  goalType: 'college' | 'pre-college';
  startYear: number;
  endYear: number;
  years: number;
  costPerYear?: number;
  scholarshipPerYear?: number;
  loanPerYear?: number;
  loanInterestRate?: number;
  loanRepaymentTerm?: number;
  coverPercent: number;
  currentSavings?: number;
  monthlyContribution?: number;
  expectedReturn?: number;
  riskProfile?: string;
  projection?: {
    totalCost: number;
    totalFunded: number;
    totalLoans?: number;
    fundingPercentage: number;
    monthlyContributionNeeded: number;
    probabilityOfSuccess?: number;
  };
}

interface ScenarioAdjustments {
  monthlyContribution: number;
  currentSavings: number;
  expectedReturn: number;
  costPerYear: number;
  scholarshipPerYear: number;
  loanPerYear: number;
  startYear: number;
}

interface ScenarioResult {
  fundingPercentage: number;
  totalFunded: number;
  totalLoans: number;
  comprehensiveFundingPercentage: number;
  monthlyContributionNeeded: number;
  probabilityOfSuccess: number;
  projectedShortfall: number;
  loanDetails?: {
    monthlyPayment: number;
    totalInterest: number;
    totalRepayment: number;
  };
  savingsScore?: number;
  loanScore?: number;
  loanBurdenPenalty?: number;
}

interface EducationScenarioPlannerProps {
  goal: EducationGoal;
  onSaveScenario?: (scenario: ScenarioAdjustments) => void;
}

export function EducationScenarioPlanner({ goal, onSaveScenario }: EducationScenarioPlannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [adjustments, setAdjustments] = useState<ScenarioAdjustments>({
    monthlyContribution: goal.monthlyContribution || 0,
    currentSavings: goal.currentSavings || 0,
    expectedReturn: goal.expectedReturn || 6,
    costPerYear: goal.costPerYear || 0,
    scholarshipPerYear: goal.scholarshipPerYear || 0,
    loanPerYear: goal.loanPerYear || 0,
    startYear: goal.startYear,
  });

  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Calculate scenario results
  const calculateScenario = useCallback(() => {
    const currentYear = new Date().getFullYear();
    const yearsUntilStart = adjustments.startYear - currentYear;
    const inflationRate = 0.05; // 5% inflation
    
    // Ensure we have valid values
    const endYear = goal.endYear || (adjustments.startYear + (goal.years || 4));
    const coverPercent = goal.coverPercent || 100;
    
    // Calculate total cost with inflation
    let totalCost = 0;
    // Use goal.years to iterate exactly the specified number of years
    for (let i = 0; i < (goal.years || 4); i++) {
      const year = adjustments.startYear + i;
      const yearsFromNow = year - currentYear;
      const inflatedCost = adjustments.costPerYear * Math.pow(1 + inflationRate, yearsFromNow);
      const netCost = (inflatedCost - adjustments.scholarshipPerYear) * (coverPercent / 100);
      totalCost += netCost;
    }
    
    // Calculate future value of savings
    let futureValue = adjustments.currentSavings || 0;
    const monthlyReturn = (adjustments.expectedReturn || 0) / 100 / 12;
    
    if (yearsUntilStart > 0) {
      // Future value of current savings
      if (adjustments.currentSavings > 0) {
        futureValue = adjustments.currentSavings * Math.pow(1 + (adjustments.expectedReturn || 0) / 100, yearsUntilStart);
      }
      
      // Future value of monthly contributions
      if (adjustments.monthlyContribution > 0 && monthlyReturn > 0) {
        const monthsUntilStart = yearsUntilStart * 12;
        const fvFactor = (Math.pow(1 + monthlyReturn, monthsUntilStart) - 1) / monthlyReturn;
        futureValue += adjustments.monthlyContribution * fvFactor;
      } else if (adjustments.monthlyContribution > 0 && monthlyReturn === 0) {
        // Handle zero return case
        futureValue += adjustments.monthlyContribution * yearsUntilStart * 12;
      }
    }
    
    // Calculate total loans over the education period
    const numYears = goal.years || 4;
    const totalLoans = adjustments.loanPerYear * numYears;
    
    const fundingPercentage = totalCost > 0 ? (futureValue / totalCost) * 100 : 0;
    const comprehensiveFundingPercentage = totalCost > 0 ? ((futureValue + totalLoans) / totalCost) * 100 : 0;
    const shortfall = Math.max(0, totalCost - futureValue - totalLoans);
    
    // Calculate loan repayment details
    let loanDetails = undefined;
    if (totalLoans > 0) {
      const loanInterestRate = (goal.loanInterestRate || 10) / 100;
      const repaymentYears = goal.loanRepaymentTerm || 10;
      const monthlyRate = loanInterestRate / 12;
      const numPayments = repaymentYears * 12;
      
      const monthlyPayment = totalLoans * 
        (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
        (Math.pow(1 + monthlyRate, numPayments) - 1);
      
      const totalRepayment = monthlyPayment * numPayments;
      const totalInterest = totalRepayment - totalLoans;
      
      loanDetails = {
        monthlyPayment: Math.round(monthlyPayment),
        totalInterest: Math.round(totalInterest),
        totalRepayment: Math.round(totalRepayment),
      };
    }
    
    // Calculate required monthly contribution for 100% funding (considering loans)
    let monthlyContributionNeeded = 0;
    const remainingShortfall = shortfall;
    if (remainingShortfall > 0 && yearsUntilStart > 0) {
      if (monthlyReturn > 0) {
        const monthsUntilStart = yearsUntilStart * 12;
        const fvFactor = (Math.pow(1 + monthlyReturn, monthsUntilStart) - 1) / monthlyReturn;
        monthlyContributionNeeded = remainingShortfall / fvFactor;
      } else {
        // Handle zero return case
        monthlyContributionNeeded = remainingShortfall / (yearsUntilStart * 12);
      }
    }
    
    // Enhanced probability calculation - no debt penalty per research
    // Base success from savings
    const savingsScore = fundingPercentage;
    
    // Loan component - loans contribute fully to funding success
    const loanPercentage = totalCost > 0 ? (totalLoans / totalCost) * 100 : 0;
    const loanScore = loanPercentage; // Loans contribute 100% value - no penalty
    
    // Combined success score
    const weightedSuccess = savingsScore + loanScore;
    
    // For backward compatibility, keep these calculations but set penalty to 0
    const annualLoanPayment = loanDetails ? loanDetails.monthlyPayment * 12 : 0;
    const estimatedPostGradIncome = 50000; // Conservative estimate
    const loanBurdenRatio = annualLoanPayment / estimatedPostGradIncome;
    const loanBurdenPenalty = 0; // No penalty applied per research findings
    
    // Final probability of success
    const probabilityOfSuccess = Math.min(100, Math.max(0, weightedSuccess));
    
    const result = {
      fundingPercentage: Math.round(Math.min(999, Math.max(0, fundingPercentage))),
      totalFunded: Math.round(futureValue),
      totalLoans: Math.round(totalLoans),
      comprehensiveFundingPercentage: Math.round(Math.min(999, Math.max(0, comprehensiveFundingPercentage))),
      monthlyContributionNeeded: Math.round(Math.min(999999, Math.max(0, monthlyContributionNeeded))),
      probabilityOfSuccess: Math.round(probabilityOfSuccess),
      projectedShortfall: Math.round(shortfall),
      loanDetails,
      savingsScore: Math.round(savingsScore),
      loanScore: Math.round(loanScore),
      loanBurdenPenalty: Math.round(loanBurdenPenalty),
    };
    
    setScenarioResult(result);
  }, [adjustments, goal]);

  useEffect(() => {
    calculateScenario();
  }, [calculateScenario]);

  const handleAdjustment = (field: keyof ScenarioAdjustments, value: number) => {
    setAdjustments(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const resetScenario = () => {
    setAdjustments({
      monthlyContribution: goal.monthlyContribution || 0,
      currentSavings: goal.currentSavings || 0,
      expectedReturn: goal.expectedReturn || 6,
      costPerYear: goal.costPerYear || 0,
      scholarshipPerYear: goal.scholarshipPerYear || 0,
      loanPerYear: goal.loanPerYear || 0,
      startYear: goal.startYear,
    });
    setIsDirty(false);
  };

  const saveScenario = () => {
    if (onSaveScenario) {
      onSaveScenario(adjustments);
      toast.success('Scenario saved successfully');
      setIsDirty(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Chart data
  const chartData = {
    labels: ['Original Plan', 'Current Scenario'],
    datasets: [
      {
        label: '529 Savings',
        data: [
          goal.projection?.totalFunded || 0,
          scenarioResult?.totalFunded || 0
        ],
        backgroundColor: ['#10b981', '#8b5cf6'],
      },
      {
        label: 'Loans',
        data: [
          goal.projection?.totalLoans || 0,
          scenarioResult?.totalLoans || 0
        ],
        backgroundColor: ['#3b82f6', '#06b6d4'],
      },
      {
        label: 'Remaining Gap',
        data: [
          Math.max(0, (goal.projection?.totalCost || 0) - (goal.projection?.totalFunded || 0) - (goal.projection?.totalLoans || 0)),
          scenarioResult?.projectedShortfall || 0
        ],
        backgroundColor: ['#ef4444', '#f59e0b'],
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#ffffff' }
      },
      datalabels: {
        display: false // Disable data labels for bar chart
      }
    },
    scales: {
      x: { 
        ticks: { color: '#ffffff' },
        grid: { color: '#374151' }
      },
      y: { 
        ticks: { color: '#ffffff' },
        grid: { color: '#374151' }
      }
    }
  };

  // Calculate current funding gap
  const currentFundingGap = goal.projection ? 
    Math.max(0, goal.projection.totalCost - goal.projection.totalFunded) : 0;

  return (
    <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-white">
              <Sliders className="h-5 w-5 text-purple-400" />
              What-If Scenario Planner
            </CardTitle>
            {!isExpanded && currentFundingGap > 0 && (
              <p className="text-sm text-amber-400 mt-1">
                Your plan has a ${currentFundingGap.toLocaleString()} funding gap. See how you can close it.
              </p>
            )}
          </div>
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Quick Results Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <p className="text-sm text-gray-400">529 Savings</p>
              <p className={`text-2xl font-bold ${
                scenarioResult && scenarioResult.fundingPercentage >= 100 ? 'text-green-400' :
                scenarioResult && scenarioResult.fundingPercentage >= 75 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {scenarioResult?.fundingPercentage}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(scenarioResult?.totalFunded || 0)}
              </p>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <p className="text-sm text-gray-400">With Loans</p>
              <p className={`text-2xl font-bold ${
                scenarioResult && scenarioResult.comprehensiveFundingPercentage >= 100 ? 'text-green-400' :
                scenarioResult && scenarioResult.comprehensiveFundingPercentage >= 75 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {scenarioResult?.comprehensiveFundingPercentage}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                +{formatCurrency(scenarioResult?.totalLoans || 0)} loans
              </p>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <p className="text-sm text-gray-400">Remaining Gap</p>
              <p className="text-2xl font-bold text-orange-400">
                {formatCurrency(scenarioResult?.projectedShortfall || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {scenarioResult?.loanDetails ? `Loan: ${formatCurrency(scenarioResult.loanDetails.monthlyPayment)}/mo` : 'No loans'}
              </p>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg relative">
              <p className="text-sm text-gray-400">Success Rate</p>
              <p className={`text-2xl font-bold ${
                scenarioResult && scenarioResult.probabilityOfSuccess >= 80 ? 'text-green-400' :
                scenarioResult && scenarioResult.probabilityOfSuccess >= 60 ? 'text-yellow-400' : 
                scenarioResult && scenarioResult.probabilityOfSuccess >= 40 ? 'text-orange-400' : 'text-red-400'
              }`}>
                {scenarioResult?.probabilityOfSuccess}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Weighted score
              </p>
              {scenarioResult && scenarioResult.totalLoans > 0 && (
                <div className="absolute top-2 right-2">
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                    Includes loans
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Success Rate Breakdown */}
          {scenarioResult && (
            <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-purple-400" />
                <h4 className="text-sm font-medium text-white">How Success Rate is Calculated</h4>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Savings Coverage</span>
                  <span className="text-green-400 font-medium">{scenarioResult.savingsScore || 0}%</span>
                </div>
                
                {scenarioResult.totalLoans > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Loan Coverage</span>
                      <span className="text-yellow-400 font-medium">+{scenarioResult.loanScore || 0}%</span>
                    </div>
                  </>
                )}
                
                <div className="border-t border-gray-700 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-medium">Final Success Rate</span>
                    <span className={`font-bold ${
                      scenarioResult.probabilityOfSuccess >= 80 ? 'text-green-400' :
                      scenarioResult.probabilityOfSuccess >= 60 ? 'text-yellow-400' : 
                      scenarioResult.probabilityOfSuccess >= 40 ? 'text-orange-400' : 'text-red-400'
                    }`}>{scenarioResult.probabilityOfSuccess}%</span>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 mt-3">
                  <p className="italic">
                    {scenarioResult.probabilityOfSuccess >= 80 ? 
                      "Excellent! This plan has a strong funding strategy to cover education costs." :
                     scenarioResult.probabilityOfSuccess >= 60 ?
                      "Good plan. Consider increasing savings to reduce future loan payments." :
                     scenarioResult.probabilityOfSuccess >= 40 ?
                      "Moderate funding level. Explore additional funding sources like scholarships." :
                      "Low funding level. Consider more affordable options or increase savings/scholarships."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Sliders */}
          <div className="space-y-6">
            {/* Monthly Contribution Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  Monthly Contribution
                </Label>
                <span className="text-sm font-medium text-purple-400">
                  {formatCurrency(adjustments.monthlyContribution)}
                </span>
              </div>
              <Slider
                value={[adjustments.monthlyContribution]}
                onValueChange={(value) => handleAdjustment('monthlyContribution', value[0])}
                min={0}
                max={5000}
                step={50}
                className="flex-1"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>$0</span>
                <span>Recommended: {formatCurrency(goal.projection?.monthlyContributionNeeded || 0)}</span>
                <span>$5,000</span>
              </div>
            </div>

            {/* Current Savings Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-gray-400" />
                  Current Savings
                </Label>
                <span className="text-sm font-medium text-purple-400">
                  {formatCurrency(adjustments.currentSavings)}
                </span>
              </div>
              <Slider
                value={[adjustments.currentSavings]}
                onValueChange={(value) => handleAdjustment('currentSavings', value[0])}
                min={0}
                max={100000}
                step={1000}
                className="flex-1"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>$0</span>
                <span>$100,000</span>
              </div>
            </div>

            {/* Expected Return Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                  Expected Annual Return
                </Label>
                <span className="text-sm font-medium text-purple-400">
                  {adjustments.expectedReturn}%
                </span>
              </div>
              <Slider
                value={[adjustments.expectedReturn]}
                onValueChange={(value) => handleAdjustment('expectedReturn', value[0])}
                min={0}
                max={12}
                step={0.5}
                className="flex-1"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0% (Cash)</span>
                <span>6% (Moderate)</span>
                <span>12% (Aggressive)</span>
              </div>
            </div>

            {/* Annual Cost Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">Annual Education Cost</Label>
                <span className="text-sm font-medium text-purple-400">
                  {formatCurrency(adjustments.costPerYear)}
                </span>
              </div>
              <Slider
                value={[adjustments.costPerYear]}
                onValueChange={(value) => handleAdjustment('costPerYear', value[0])}
                min={0}
                max={100000}
                step={1000}
                className="flex-1"
              />
            </div>

            {/* Scholarship Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">Expected Scholarships (per year)</Label>
                <span className="text-sm font-medium text-purple-400">
                  {formatCurrency(adjustments.scholarshipPerYear)}
                </span>
              </div>
              <Slider
                value={[adjustments.scholarshipPerYear]}
                onValueChange={(value) => handleAdjustment('scholarshipPerYear', value[0])}
                min={0}
                max={50000}
                step={500}
                className="flex-1"
              />
            </div>

            {/* Loan Amount Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  Education Loans (per year)
                </Label>
                <span className="text-sm font-medium text-purple-400">
                  {formatCurrency(adjustments.loanPerYear)}
                </span>
              </div>
              <Slider
                value={[adjustments.loanPerYear]}
                onValueChange={(value) => handleAdjustment('loanPerYear', value[0])}
                min={0}
                max={100000}
                step={1000}
                className="flex-1"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>$0</span>
                <span>Federal limits: ~$31k (dependent)</span>
                <span>$100,000</span>
              </div>
              {adjustments.loanPerYear > 0 && scenarioResult?.loanDetails && (
                <div className="mt-2 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
                  <p className="text-xs text-blue-300">
                    Total loans: {formatCurrency(scenarioResult.totalLoans)} • 
                    Monthly payment: {formatCurrency(scenarioResult.loanDetails.monthlyPayment)} • 
                    Total interest: {formatCurrency(scenarioResult.loanDetails.totalInterest)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Comparison Chart */}
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <Button
              onClick={resetScenario}
              variant="outline"
              className="border-gray-700 hover:bg-gray-800"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <div className="flex gap-2">
              {isDirty && (
                <Alert className="bg-amber-900/20 border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-amber-200 text-sm">
                    Unsaved changes
                  </AlertDescription>
                </Alert>
              )}
              <Button
                onClick={saveScenario}
                disabled={!isDirty}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Scenario
              </Button>
            </div>
          </div>

          {/* Info Alert */}
          <Alert className="bg-gray-800/50 border-gray-700">
            <Info className="h-4 w-4 text-gray-400" />
            <AlertDescription className="text-gray-300 text-sm">
              Adjust the sliders to see how changes affect your education funding plan. 
              These are estimates based on projected returns and inflation.
            </AlertDescription>
          </Alert>
        </CardContent>
      )}
    </Card>
  );
}