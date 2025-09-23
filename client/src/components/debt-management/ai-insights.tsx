import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Brain,
  Lightbulb,
  AlertTriangle,
  Info,
  Target,
  DollarSign,
  ChevronRight,
  RefreshCw,
  Loader2,
  Zap
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Debt {
  id: number;
  debtName: string;
  debtType: string;
  currentBalance: number;
  annualInterestRate: number;
  minimumPayment: number;
  status: string;
}

interface DebtSummary {
  totalDebt: number;
  totalMinimumPayment: number;
  averageInterestRate: number;
  highestInterestDebt: Debt | null;
  lowestBalanceDebt: Debt | null;
  activeDebtsCount: number;
  paidOffDebtsCount: number;
}

interface PayoffPlan {
  id: number;
  planName: string;
  strategy: string;
  payoffDate: string;
  totalInterestPaid: number;
  monthsToPayoff: number;
  isActive: boolean;
}

interface Insight {
  id: string;
  type: 'recommendation' | 'warning' | 'opportunity' | 'tip';
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  potentialSavings?: number;
  relatedDebtId?: number;
}

interface AIInsightsProps {
  debts: Debt[];
  summary: DebtSummary;
  activePlan: PayoffPlan | null;
}

export function AIInsights({ debts, summary, activePlan }: AIInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

  // Load saved insights on mount and when debts change
  useEffect(() => {
    if (debts.length === 0) {
      setInsights([]);
      setLastGeneratedAt(null);
      return;
    }
    (async () => {
      try {
        const resp = await fetch('/api/ai-debt-insights', { credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          setInsights(Array.isArray(data.insights) ? data.insights : []);
          setLastGeneratedAt(data.generatedAt || null);
        }
      } catch {
        // ignore, UI will allow manual refresh
      }
    })();
  }, [debts]);

  // Generate AI insights mutation
  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ai-debt-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          debts,
          summary,
          activePlan,
        }),
      });
      if (!response.ok) throw new Error("Failed to generate insights");
      return response.json();
    },
    onSuccess: (data) => {
      setInsights(data.insights || getMockInsights());
      if (data.generatedAt) setLastGeneratedAt(data.generatedAt);
    },
    onError: () => {
      // Use mock insights as fallback
      setInsights(getMockInsights());
    }
  });

  const generateInsights = () => {
    setIsGenerating(true);
    generateInsightsMutation.mutate();
    setTimeout(() => setIsGenerating(false), 1500);
  };

  const getMockInsights = (): Insight[] => {
    const mockInsights: Insight[] = [];

    // High interest rate warning
    if (summary.highestInterestDebt && summary.highestInterestDebt.annualInterestRate > 18) {
      mockInsights.push({
        id: '1',
        type: 'warning',
        title: 'High Interest Alert',
        content: `Your ${summary.highestInterestDebt.debtName} has a ${summary.highestInterestDebt.annualInterestRate}% interest rate. Consider balance transfer options or negotiating a lower rate with your lender.`,
        priority: 'high',
        actionable: true,
        potentialSavings: summary.highestInterestDebt.currentBalance * 0.05,
        relatedDebtId: summary.highestInterestDebt.id
      });
    }

    // Strategy recommendation
    if (activePlan?.strategy === 'snowball' && summary.averageInterestRate > 15) {
      mockInsights.push({
        id: '2',
        type: 'recommendation',
        title: 'Consider Avalanche Strategy',
        content: `With an average interest rate of ${summary.averageInterestRate.toFixed(1)}%, the Avalanche method could save you significant money in interest payments while paying off debt faster.`,
        priority: 'medium',
        actionable: true,
        potentialSavings: summary.totalDebt * 0.03
      });
    }

    // Quick win opportunity
    if (summary.lowestBalanceDebt && summary.lowestBalanceDebt.currentBalance < 500) {
      mockInsights.push({
        id: '3',
        type: 'opportunity',
        title: 'Quick Win Available',
        content: `Your ${summary.lowestBalanceDebt.debtName} has only ${formatCurrency(summary.lowestBalanceDebt.currentBalance)} remaining. Consider paying it off quickly for a motivational boost!`,
        priority: 'medium',
        actionable: true,
        relatedDebtId: summary.lowestBalanceDebt.id
      });
    }

    // Extra payment tip
    mockInsights.push({
      id: '4',
      type: 'tip',
      title: 'Accelerate Your Payoff',
      content: `Adding just $100 extra per month could reduce your payoff time by approximately ${Math.floor(summary.activeDebtsCount * 2)} months and save ${formatCurrency(summary.totalDebt * 0.02)} in interest.`,
      priority: 'medium',
      actionable: true,
      potentialSavings: summary.totalDebt * 0.02
    });

    // Credit utilization tip for credit cards
    const creditCards = debts.filter(d => d.debtType === 'credit_card' && d.status === 'active');
    if (creditCards.length > 0) {
      mockInsights.push({
        id: '5',
        type: 'tip',
        title: 'Credit Score Optimization',
        content: 'Keep credit card balances below 30% of their limits to improve your credit score, which could qualify you for better refinancing rates.',
        priority: 'low',
        actionable: true
      });
    }

    return mockInsights;
  };

  // Chat assistant removed per design update.

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'warning': return AlertTriangle;
      case 'recommendation': return Target;
      case 'opportunity': return Zap;
      case 'tip': return Lightbulb;
      default: return Info;
    }
  };

  const getInsightColor = (type: Insight['type']) => {
    switch (type) {
      case 'warning': return 'text-red-400';
      case 'recommendation': return 'text-blue-400';
      case 'opportunity': return 'text-green-400';
      case 'tip': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getPriorityBadge = (priority: Insight['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Medium</Badge>;
      case 'low':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Low</Badge>;
    }
  };

  if (debts.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-12 text-center">
          <Brain className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Insights</h3>
          <p className="text-gray-400">Add your debts to receive personalized AI recommendations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Insights Header */}
      <Card className="bg-gradient-to-r from-purple-950 via-fuchsia-900 to-purple-950 border-fuchsia-700/60 shadow-lg shadow-fuchsia-900/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-300" />
              Insights
            </div>
            <div className="flex items-center gap-3">
              {lastGeneratedAt && (
                <span className="text-xs text-purple-200/80">Updated {new Date(lastGeneratedAt).toLocaleString()}</span>
              )}
              <Button
                size="sm"
                onClick={generateInsights}
                disabled={isGenerating}
                title="Refresh insights"
                className="bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-700/50 p-2"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="text-purple-200/80">
            Personalized AI-powered insights
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Key Insights */}
      <div className="space-y-4">
        {insights.map((insight) => {
          const Icon = getInsightIcon(insight.type);
          const colorClass = getInsightColor(insight.type);
          
          return (
            <Card key={insight.id} className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 bg-gray-900 rounded-lg ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-white">{insight.title}</h4>
                      {getPriorityBadge(insight.priority)}
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{insight.content}</p>
                    
                    {insight.potentialSavings && (
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400">
                          Potential savings: {formatCurrency(insight.potentialSavings)}
                        </span>
                      </div>
                    )}
                    
                    {/* Action button removed per design change */}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chat assistant removed per design update */}

      {/* Quick stats tiles removed per design update */}
    </div>
  );
}
