import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3
} from 'lucide-react';

interface MonteCarloAnalysis {
  probabilityOfSuccess: number;
  confidenceIntervals: {
    percentile10: number;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    percentile90: number;
  };
  scenarios: {
    successful: number;
    failed: number;
    total: number;
  };
  projectedValues: {
    best: number;
    worst: number;
    median: number;
    mean: number;
  };
  recommendedMonthlyContribution: number;
  riskProfile: string;
  volatilityUsed: number;
  confidenceLevels: {
    veryLikely: boolean;
    likely: boolean;
    possible: boolean;
    unlikely: boolean;
  };
}

interface MonteCarloDisplayProps {
  analysis: MonteCarloAnalysis;
  totalCost: number;
  currentMonthlyContribution: number;
}

export function MonteCarloDisplay({ 
  analysis, 
  totalCost,
  currentMonthlyContribution 
}: MonteCarloDisplayProps) {
  const getSuccessColor = (probability: number) => {
    if (probability >= 90) return 'text-green-400';
    if (probability >= 75) return 'text-yellow-400';
    if (probability >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSuccessIcon = () => {
    if (analysis.confidenceLevels.veryLikely) return <CheckCircle className="h-5 w-5 text-green-400" />;
    if (analysis.confidenceLevels.likely) return <TrendingUp className="h-5 w-5 text-yellow-400" />;
    if (analysis.confidenceLevels.possible) return <TrendingDown className="h-5 w-5 text-orange-400" />;
    return <AlertTriangle className="h-5 w-5 text-red-400" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(0)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Probability of Success */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            Monte Carlo Analysis Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Success Probability */}
          <div className="text-center p-6 bg-gray-900/50 rounded-lg">
            <div className="flex items-center justify-center gap-3 mb-2">
              {getSuccessIcon()}
              <h3 className="text-lg font-semibold text-gray-300">Probability of Success</h3>
            </div>
            <p className={`text-4xl font-bold ${getSuccessColor(analysis.probabilityOfSuccess)}`}>
              {formatPercentage(analysis.probabilityOfSuccess)}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Based on {analysis.scenarios.total.toLocaleString()} simulated scenarios
            </p>
          </div>

          {/* Success/Failure Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-900/10 p-4 rounded-lg border border-green-500/20">
              <p className="text-sm text-green-400">Successful Scenarios</p>
              <p className="text-2xl font-bold text-white">
                {analysis.scenarios.successful.toLocaleString()}
              </p>
              <Progress 
                value={(analysis.scenarios.successful / analysis.scenarios.total) * 100} 
                className="mt-2 h-2"
              />
            </div>
            <div className="bg-red-900/10 p-4 rounded-lg border border-red-500/20">
              <p className="text-sm text-red-400">Failed Scenarios</p>
              <p className="text-2xl font-bold text-white">
                {analysis.scenarios.failed.toLocaleString()}
              </p>
              <Progress 
                value={(analysis.scenarios.failed / analysis.scenarios.total) * 100} 
                className="mt-2 h-2"
              />
            </div>
          </div>

          {/* Confidence Intervals */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Projected Portfolio Values at Goal Start</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Worst Case (10th percentile)</span>
                <span className="text-sm font-medium text-red-400">
                  {formatCurrency(analysis.confidenceIntervals.percentile10)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">25th percentile</span>
                <span className="text-sm font-medium text-orange-400">
                  {formatCurrency(analysis.confidenceIntervals.percentile25)}
                </span>
              </div>
              <div className="flex justify-between items-center bg-gray-900/30 p-2 rounded">
                <span className="text-sm text-gray-300 font-medium">Median (50th percentile)</span>
                <span className="text-sm font-bold text-white">
                  {formatCurrency(analysis.confidenceIntervals.percentile50)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">75th percentile</span>
                <span className="text-sm font-medium text-yellow-400">
                  {formatCurrency(analysis.confidenceIntervals.percentile75)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Best Case (90th percentile)</span>
                <span className="text-sm font-medium text-green-400">
                  {formatCurrency(analysis.confidenceIntervals.percentile90)}
                </span>
              </div>
            </div>
          </div>

          {/* Target vs Current */}
          <div className="bg-purple-900/10 p-4 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-400" />
              <h4 className="text-sm font-semibold text-purple-400">Monthly Contribution Analysis</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Current Monthly Contribution</span>
                <span className="text-sm font-medium text-white">
                  {formatCurrency(currentMonthlyContribution)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Recommended for 80% Success</span>
                <span className="text-sm font-bold text-purple-400">
                  {formatCurrency(analysis.recommendedMonthlyContribution)}
                </span>
              </div>
              {analysis.recommendedMonthlyContribution > currentMonthlyContribution && (
                <div className="flex justify-between items-center text-amber-400">
                  <span className="text-sm">Additional Needed</span>
                  <span className="text-sm font-medium">
                    +{formatCurrency(analysis.recommendedMonthlyContribution - currentMonthlyContribution)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Risk Profile Info */}
          <Alert className="bg-gray-800/50 border-gray-700">
            <Info className="h-4 w-4 text-gray-400" />
            <AlertDescription className="text-gray-300 text-sm">
              Analysis based on <span className="font-medium">{analysis.riskProfile}</span> risk profile 
              with {formatPercentage(analysis.volatilityUsed * 100)} annual volatility. 
              The median projected value is {formatCurrency(analysis.projectedValues.median)} compared 
              to the {formatCurrency(totalCost)} goal.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}