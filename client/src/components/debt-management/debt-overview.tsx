import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  Calendar,
  Target,
  Trophy,
  AlertCircle,
  ChevronRight,
  Percent,
  Clock,
  CreditCard,
  Zap,
  Home,
  Car,
  GraduationCap,
  User,
  Trash2,
  Calculator,
  RefreshCw
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Debt {
  id: number;
  debtName: string;
  debtType: string;
  currentBalance: number;
  annualInterestRate: number;
  minimumPayment: number;
  status: string;
  owner: string;
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

interface DebtOverviewProps {
  debts: Debt[];
  summary: DebtSummary;
  activePlan: PayoffPlan | null;
  onRefresh?: () => void;
  lastUpdatedLabel?: string | null;
  isRefreshing?: boolean;
  onNavigateToStrategies?: () => void;
}

export function DebtOverview({ debts, summary, activePlan, onRefresh, lastUpdatedLabel, isRefreshing, onNavigateToStrategies }: DebtOverviewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  
  const activeDebts = debts.filter(d => d.status === 'active');
  const progressPercentage = summary.totalDebt > 0 && (summary.activeDebtsCount + summary.paidOffDebtsCount) > 0
    ? (summary.paidOffDebtsCount / (summary.activeDebtsCount + summary.paidOffDebtsCount)) * 100
    : 0;

  // Calculate monthly interest cost
  const monthlyInterestCost = activeDebts.reduce((sum, debt) => {
    return sum + (debt.currentBalance * (debt.annualInterestRate / 100 / 12));
  }, 0);

  // Delete debt mutation
  const deleteDebtMutation = useMutation({
    mutationFn: async (debtId: number) => {
      const response = await fetch(`/api/debts/${debtId}/delete-with-sync`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete debt');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/debts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-profile'] });
      toast({
        title: "Debt Deleted",
        description: "The debt has been removed and your financial metrics have been updated.",
      });
      setDeleteDialogOpen(false);
      setDebtToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the debt. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (debt: Debt) => {
    setDebtToDelete(debt);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (debtToDelete) {
      deleteDebtMutation.mutate(debtToDelete.id);
    }
  };

  const getDebtIcon = (type: string) => {
    switch (type) {
      case 'mortgage': return Home;
      case 'auto_loan': return Car;
      case 'federal_student_loan':
      case 'private_student_loan': return GraduationCap;
      case 'personal_loan': return User;
      case 'credit_card': 
      default: return CreditCard;
    }
  };

  const getDebtColor = (type: string) => {
    switch (type) {
      case 'mortgage': return 'text-green-400';
      case 'auto_loan': return 'text-blue-400';
      case 'federal_student_loan':
      case 'private_student_loan': return 'text-purple-400';
      case 'personal_loan': return 'text-orange-400';
      case 'credit_card': 
      default: return 'text-red-400';
    }
  };

  // Get strategy icon and color
  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'snowball':
        return { icon: TrendingDown, color: 'text-blue-400', label: 'Debt Snowball' };
      case 'avalanche':
        return { icon: TrendingUp, color: 'text-red-400', label: 'Debt Avalanche' };
      case 'hybrid':
        return { icon: Zap, color: 'text-yellow-400', label: 'Hybrid Strategy' };
      default:
        return { icon: Target, color: 'text-gray-400', label: 'Custom Strategy' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {lastUpdatedLabel && <span>Updated {lastUpdatedLabel}</span>}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 border border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh debts from intake"
            >
              {isRefreshing ? (
                <svg className="h-4 w-4 animate-spin text-purple-200" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 0v4a8 8 0 100 16v-4l-3.5 3.5L12 24v-4a8 8 0 01-8-8z"></path>
                </svg>
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="sr-only">Refresh debts</span>
            </Button>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <Card className="bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>Your Debt Freedom Journey</span>
            {progressPercentage > 0 && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                {progressPercentage.toFixed(0)}% Complete
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">
              {summary.paidOffDebtsCount} debts paid off
            </span>
            <span className="text-gray-400">
              {summary.activeDebtsCount} debts remaining
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700 hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Debt</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(summary.totalDebt)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-red-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700 hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Monthly Payment</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(summary.totalMinimumPayment)}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700 hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Avg Interest Rate</p>
                <p className="text-2xl font-bold text-white">
                  {summary.averageInterestRate.toFixed(2)}%
                </p>
              </div>
              <Percent className="w-8 h-8 text-yellow-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700 hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Interest Cost/Month</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(monthlyInterestCost)}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Plan Summary */}
      {activePlan && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Active Payoff Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const strategy = getStrategyIcon(activePlan.strategy);
                  const StrategyIcon = strategy.icon;
                  return (
                    <>
                      <StrategyIcon className={`w-5 h-5 ${strategy.color}`} />
                      <div>
                        <p className="font-semibold text-white">{strategy.label}</p>
                        <p className="text-sm text-gray-400">{activePlan.planName}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                Active
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <p className="text-xs text-gray-400">Debt-Free Date</p>
                <p className="text-sm font-semibold text-white">
                  {new Date(activePlan.payoffDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Months to Freedom</p>
                <p className="text-sm font-semibold text-white">{activePlan.monthsToPayoff}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Interest</p>
                <p className="text-sm font-semibold text-white">
                  {formatCurrency(activePlan.totalInterestPaid)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summary.highestInterestDebt && (
          <Card className="bg-gray-900 border-red-900/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <div>
                  <p className="text-sm text-gray-400">Highest Interest Debt</p>
                  <p className="font-semibold text-white">{summary.highestInterestDebt.debtName}</p>
                  <p className="text-sm text-red-400 font-medium">
                    {summary.highestInterestDebt.annualInterestRate}% APR • {formatCurrency(summary.highestInterestDebt.currentBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {summary.lowestBalanceDebt && (
          <Card className="bg-gray-900 border-blue-900/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-sm text-gray-400">Smallest Balance (Quick Win)</p>
                  <p className="font-semibold text-white">{summary.lowestBalanceDebt.debtName}</p>
                  <p className="text-sm text-blue-400 font-medium">
                    {formatCurrency(summary.lowestBalanceDebt.currentBalance)} • {summary.lowestBalanceDebt.annualInterestRate}% APR
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Debts with Better Styling */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Active Debts</h3>
        <p className="text-gray-400">
          These debts are synced from your intake form. To update your debts, please modify them in the intake form and click the "Refresh" icon to refresh.
        </p>
        {activeDebts.length === 0 ? (
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-8">
              <div className="text-center">
                <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <p className="text-gray-400">No active debts! You're debt-free!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {activeDebts.map((debt) => {
              const Icon = getDebtIcon(debt.debtType);
              const colorClass = getDebtColor(debt.debtType);

              return (
                <Card key={debt.id} className="bg-gray-900 border-gray-700 hover:border-gray-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 bg-gray-800 rounded-lg ${colorClass}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-white">{debt.debtName}</p>
                            {debt.owner === 'spouse' && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                                Spouse
                              </Badge>
                            )}
                            {debt.owner === 'joint' && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                                Joint
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>{(() => {
                              const typeDisplay: Record<string, string> = {
                                'credit_card': 'Credit Card',
                                'federal_student_loan': 'Federal Student Loan',
                                'private_student_loan': 'Private Student Loan',
                                'auto_loan': 'Auto Loan',
                                'personal_loan': 'Personal Loan',
                                'mortgage': 'Mortgage',
                                'other': 'Other'
                              };
                              return typeDisplay[debt.debtType] || debt.debtType.replace(/_/g, ' ').split(' ').map(word => 
                                word.charAt(0).toUpperCase() + word.slice(1)
                              ).join(' ');
                            })()}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Due: 1st
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">
                            {formatCurrency(debt.currentBalance)}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Percent className="w-3 h-3" />
                              {debt.annualInterestRate}%
                            </span>
                            <span>•</span>
                            <span>{formatCurrency(debt.minimumPayment)}/mo</span>
                          </div>
                        </div>
                        <Checkbox
                          className="border-gray-600 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleDeleteClick(debt);
                            }
                          }}
                          aria-label={`Delete ${debt.debtName}`}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigate to Strategies Button */}
      {onNavigateToStrategies && activeDebts.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={onNavigateToStrategies}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-3 flex items-center gap-2"
            size="lg"
          >
            <Calculator className="w-5 h-5" />
            Explore Payoff Strategies
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Delete Debt
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-white">{debtToDelete?.debtName}</span>?
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove the debt from your debt management center</li>
                <li>Update your total debt and monthly payments</li>
                <li>Remove it from your intake form data</li>
                <li>Recalculate your net worth and financial health score</li>
              </ul>
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteDebtMutation.isPending}
            >
              {deleteDebtMutation.isPending ? "Deleting..." : "Delete Debt"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
