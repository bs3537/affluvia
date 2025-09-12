import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, PiggyBank, AlertTriangle, CheckCircle, Eye } from 'lucide-react';

interface LiveInsightsProps {
  formData: any;
  currentStep: number;
}

interface Insight {
  id: string;
  title: string;
  value: string | number;
  description: string;
  icon: any;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  unlockStep: number;
}

export function LiveInsights({ formData, currentStep }: LiveInsightsProps) {
  const [visibleInsights, setVisibleInsights] = useState<Set<string>>(new Set());
  const [newInsight, setNewInsight] = useState<string | null>(null);

  
  // Calculate real-time insights based on form data
  const insights = useMemo<Insight[]>(() => {
    const netWorth = calculateNetWorth();
    const monthlyCashFlow = calculateMonthlyCashFlow();
    const emergencyMonths = calculateEmergencyMonths();
    const savingsRate = calculateSavingsRate();

    return [
      {
        id: 'net-worth',
        title: 'Net Worth',
        value: `$${netWorth.toLocaleString()}`,
        description: 'Your total assets minus liabilities',
        icon: TrendingUp,
        color: netWorth >= 0 ? 'text-green-400' : 'text-red-400',
        trend: netWorth >= 0 ? 'up' : 'down',
        unlockStep: 4
      },
      {
        id: 'monthly-cashflow',
        title: 'Monthly Cash Flow',
        value: isNaN(monthlyCashFlow) ? '$NaN' : `${monthlyCashFlow >= 0 ? '+' : ''}$${Math.round(monthlyCashFlow).toLocaleString()}`,
        description: 'Money left over each month',
        icon: DollarSign,
        color: isNaN(monthlyCashFlow) ? 'text-gray-400' : monthlyCashFlow >= 0 ? 'text-green-400' : 'text-red-400',
        trend: isNaN(monthlyCashFlow) ? 'neutral' : monthlyCashFlow >= 0 ? 'up' : 'down',
        unlockStep: 5
      },
      {
        id: 'emergency-fund',
        title: 'Emergency Coverage',
        value: `${emergencyMonths.toFixed(1)} months`,
        description: 'How long your emergency fund lasts',
        icon: PiggyBank,
        color: emergencyMonths >= 6 ? 'text-green-400' : emergencyMonths >= 3 ? 'text-yellow-400' : 'text-red-400',
        trend: emergencyMonths >= 6 ? 'up' : emergencyMonths >= 3 ? 'neutral' : 'down',
        unlockStep: 5
      },
      {
        id: 'savings-rate',
        title: 'Savings Rate',
        value: isNaN(savingsRate) ? 'NaN%' : `${savingsRate.toFixed(1)}%`,
        description: 'Percentage of income you save',
        icon: TrendingUp,
        color: isNaN(savingsRate) ? 'text-gray-400' : savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-yellow-400' : 'text-red-400',
        trend: isNaN(savingsRate) ? 'neutral' : savingsRate >= 20 ? 'up' : savingsRate >= 10 ? 'neutral' : 'down',
        unlockStep: 5
      }
    ];
  }, [formData]);

  function calculateNetWorth(): number {
    const assets = formData?.assets || [];
    const liabilities = formData?.liabilities || [];
    const residence = formData?.primaryResidence;

    const totalAssets = assets.reduce((sum: number, asset: any) => {
      const value = Number(asset?.value || 0);
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
    
    const totalLiabilities = liabilities.reduce((sum: number, liability: any) => {
      const balance = Number(liability?.balance || 0);
      return sum + (isNaN(balance) ? 0 : balance);
    }, 0);
    
    const marketValue = Number(residence?.marketValue || 0);
    const mortgageBalance = Number(residence?.mortgageBalance || 0);
    const homeEquity = (isNaN(marketValue) ? 0 : marketValue) - (isNaN(mortgageBalance) ? 0 : mortgageBalance);

    const result = totalAssets + homeEquity - totalLiabilities;
    return isNaN(result) ? 0 : result;
  }

  function calculateMonthlyCashFlow(): number {
    const annualIncome = Number(formData?.annualIncome || 0);
    const spouseAnnualIncome = Number(formData?.spouseAnnualIncome || 0);
    const monthlyIncome = (annualIncome + spouseAnnualIncome) / 12;
    
    const expenses = formData?.monthlyExpenses || {};
    const totalExpenses = Object.values(expenses).reduce((sum: number, expense: any) => {
      const expenseValue = Number(expense || 0);
      return sum + (isNaN(expenseValue) ? 0 : expenseValue);
    }, 0);
    
    const liabilities = formData?.liabilities || [];
    const debtPayments = liabilities.reduce((sum: number, liability: any) => {
      const payment = Number(liability?.monthlyPayment || 0);
      return sum + (isNaN(payment) ? 0 : payment);
    }, 0);
    
    const mortgagePayment = Number(formData?.primaryResidence?.monthlyPayment || 0);
    const finalMortgagePayment = isNaN(mortgagePayment) ? 0 : mortgagePayment;

    const result = monthlyIncome - totalExpenses - debtPayments - finalMortgagePayment;
    return isNaN(result) ? 0 : result;
  }

  function calculateEmergencyMonths(): number {
    const emergencyFund = Number(formData?.emergencyFundSize || 0);
    const expenses = formData?.monthlyExpenses || {};
    
    const essentialExpenses = 
      Number(expenses.housing || 0) +
      Number(expenses.food || 0) +
      Number(expenses.transportation || 0) +
      Number(expenses.utilities || 0) +
      Number(expenses.healthcare || 0);

    if (essentialExpenses <= 0 || isNaN(essentialExpenses) || isNaN(emergencyFund)) {
      return 0;
    }

    const result = emergencyFund / essentialExpenses;
    return isNaN(result) ? 0 : result;
  }

  function calculateSavingsRate(): number {
    const annualIncome = Number(formData?.annualIncome || 0) + Number(formData?.spouseAnnualIncome || 0);
    const monthlyCashFlow = calculateMonthlyCashFlow();
    const annualSavings = monthlyCashFlow * 12;

    if (annualIncome <= 0 || isNaN(annualIncome) || isNaN(monthlyCashFlow)) {
      return 0;
    }

    const rate = (annualSavings / annualIncome) * 100;
    return isNaN(rate) ? 0 : rate;
  }

  // Show new insights as they unlock
  useEffect(() => {
    insights.forEach(insight => {
      if (currentStep >= insight.unlockStep && !visibleInsights.has(insight.id)) {
        setVisibleInsights(prev => new Set(Array.from(prev).concat([insight.id])));
        setNewInsight(insight.id);

        // Clear new insight highlight after 2 seconds
        setTimeout(() => {
          setNewInsight(null);
        }, 2000);
      }
    });
  }, [currentStep, insights, visibleInsights]);

  const displayInsights = insights.filter(insight => visibleInsights.has(insight.id));

  if (displayInsights.length === 0) return null;

  return (
    <Card className="bg-gray-800/30 border-gray-700 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-[#B040FF]" />
        <span className="text-white font-medium text-sm">Live Financial Insights</span>
        <Badge variant="secondary" className="bg-green-600/20 text-green-400 text-xs">
          Real-time
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {displayInsights.map(insight => {
          const IconComponent = insight.icon;
          const isNew = newInsight === insight.id;

          return (
            <div
              key={insight.id}
              className={`
                p-3 rounded-lg border transition-all duration-500
                ${isNew 
                  ? 'bg-[#B040FF]/20 border-[#B040FF] shadow-lg animate-pulse' 
                  : 'bg-gray-700/30 border-gray-600'
                }
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <IconComponent className={`w-4 h-4 ${insight.color}`} />
                  <span className="text-white text-sm font-medium">{insight.title}</span>
                </div>
                
                {insight.trend && (
                  <div className={`text-xs ${
                    insight.trend === 'up' ? 'text-green-400' : 
                    insight.trend === 'down' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {insight.trend === 'up' ? '↗' : insight.trend === 'down' ? '↘' : '→'}
                  </div>
                )}
              </div>

              <div className={`text-lg font-bold ${insight.color} mb-1`}>
                {insight.value}
              </div>

              <div className="text-xs text-gray-400">
                {insight.description}
              </div>

              {isNew && (
                <div className="mt-2 flex items-center gap-1 text-xs text-[#B040FF]">
                  <CheckCircle className="w-3 h-3" />
                  <span>Just calculated!</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Encouragement */}
      {displayInsights.length > 0 && currentStep < 12 && (
        <div className="mt-3 p-2 bg-blue-600/10 border border-blue-600/20 rounded-lg">
          <div className="text-xs text-blue-200 text-center">
            💡 Complete more sections to unlock additional insights about your financial health
          </div>
        </div>
      )}
    </Card>
  );
}