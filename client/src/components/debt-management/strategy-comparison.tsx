import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingDown,
  TrendingUp,
  Zap,
  DollarSign,
  Calendar,
  Trophy,
  AlertCircle,
  Info,
  ChevronRight,
  Snowflake,
  Mountain,
  Target,
  Clock,
  Percent
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

interface StrategyResult {
  strategy: string;
  payoffDate: Date;
  totalInterestPaid: number;
  totalAmountPaid: number;
  monthsToPayoff: number;
  debtOrder: number[];
  firstDebtPaidOff: {
    debtId: number;
    debtName: string;
    monthsToPay: number;
  };
  payoffSchedule: Array<{
    month: number;
    payments: Array<{
      debtId: number;
      payment: number;
      principal: number;
      interest: number;
      balance: number;
    }>;
    totalPayment: number;
  }>;
}

interface StrategyComparisonProps {
  debts: Debt[];
  extraPayment: number;
  onStrategySelect: (strategy: "snowball" | "avalanche" | "hybrid") => void;
  onExtraPaymentChange: (amount: number) => void;
}

export function StrategyComparison({ 
  debts, 
  extraPayment, 
  onStrategySelect, 
  onExtraPaymentChange 
}: StrategyComparisonProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<"snowball" | "avalanche" | "hybrid">("snowball");
  const [snowballResult, setSnowballResult] = useState<StrategyResult | null>(null);
  const [avalancheResult, setAvalancheResult] = useState<StrategyResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const activeDebts = debts.filter(d => d.status === 'active');
  const totalMinimumPayment = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.currentBalance, 0);

  // Calculate strategies when debts or extra payment changes
  useEffect(() => {
    if (activeDebts.length > 0) {
      calculateStrategies();
    }
  }, [debts, extraPayment]);

  const calculateStrategies = async () => {
    setIsCalculating(true);
    
    // Simulate calculation (in real app, this would be an API call)
    // For now, let's create mock results
    const snowball = calculateSnowball(activeDebts, extraPayment);
    const avalanche = calculateAvalanche(activeDebts, extraPayment);
    
    setSnowballResult(snowball);
    setAvalancheResult(avalanche);
    setIsCalculating(false);
  };

  // Simplified snowball calculation (lowest balance first)
  const calculateSnowball = (debts: Debt[], extra: number): StrategyResult => {
    const sortedDebts = [...debts].sort((a, b) => a.currentBalance - b.currentBalance);
    return calculatePayoff(sortedDebts, extra, "snowball");
  };

  // Simplified avalanche calculation (highest interest first)
  const calculateAvalanche = (debts: Debt[], extra: number): StrategyResult => {
    const sortedDebts = [...debts].sort((a, b) => b.annualInterestRate - a.annualInterestRate);
    return calculatePayoff(sortedDebts, extra, "avalanche");
  };

  // Generic payoff calculation
  const calculatePayoff = (sortedDebts: Debt[], extra: number, strategy: string): StrategyResult => {
    let months = 0;
    let totalInterest = 0;
    let debtsRemaining = sortedDebts.map(d => ({
      ...d,
      remainingBalance: d.currentBalance,
      paidOff: false,
      monthPaidOff: 0
    }));
    
    let firstDebtPaidOff = null;
    const payoffSchedule = [];

    while (debtsRemaining.some(d => !d.paidOff)) {
      months++;
      let availableExtra = extra;
      const monthPayments = [];

      for (let debt of debtsRemaining) {
        if (debt.paidOff) continue;

        const monthlyRate = debt.annualInterestRate / 100 / 12;
        const interestCharge = debt.remainingBalance * monthlyRate;
        totalInterest += interestCharge;

        let payment = debt.minimumPayment;
        
        // Add extra payment to first unpaid debt
        if (availableExtra > 0 && !debtsRemaining.find(d => !d.paidOff && d.id !== debt.id)) {
          payment += availableExtra;
          availableExtra = 0;
        }

        const principal = Math.min(payment - interestCharge, debt.remainingBalance);
        debt.remainingBalance -= principal;

        if (debt.remainingBalance <= 0.01) {
          debt.paidOff = true;
          debt.monthPaidOff = months;
          if (!firstDebtPaidOff) {
            firstDebtPaidOff = {
              debtId: debt.id,
              debtName: debt.debtName,
              monthsToPay: months
            };
          }
          // Roll over payment to next debt
          availableExtra += debt.minimumPayment;
        }

        monthPayments.push({
          debtId: debt.id,
          payment,
          principal,
          interest: interestCharge,
          balance: debt.remainingBalance
        });
      }

      payoffSchedule.push({
        month: months,
        payments: monthPayments,
        totalPayment: monthPayments.reduce((sum, p) => sum + p.payment, 0)
      });

      // Safety check to prevent infinite loop
      if (months > 360) break; // 30 years max
    }

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);

    return {
      strategy,
      payoffDate,
      totalInterestPaid: totalInterest,
      totalAmountPaid: totalDebt + totalInterest,
      monthsToPayoff: months,
      debtOrder: sortedDebts.map(d => d.id),
      firstDebtPaidOff: firstDebtPaidOff!,
      payoffSchedule: payoffSchedule.slice(0, 12) // First year only for display
    };
  };

  const handleStrategySelect = (strategy: "snowball" | "avalanche" | "hybrid") => {
    setSelectedStrategy(strategy);
    onStrategySelect(strategy);
  };

  if (activeDebts.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-12 text-center">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Active Debts!</h3>
          <p className="text-gray-400">Add your debts to see strategy comparisons</p>
        </CardContent>
      </Card>
    );
  }

  const getMonthDifference = () => {
    if (!snowballResult || !avalancheResult) return 0;
    return Math.abs(snowballResult.monthsToPayoff - avalancheResult.monthsToPayoff);
  };

  const getInterestDifference = () => {
    if (!snowballResult || !avalancheResult) return 0;
    return Math.abs(snowballResult.totalInterestPaid - avalancheResult.totalInterestPaid);
  };

  return (
    <div className="space-y-6">
      {/* Extra Payment Input */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Extra Monthly Payment</CardTitle>
          <CardDescription className="text-gray-400">
            How much extra can you pay toward debt each month?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Slider
                value={[extraPayment]}
                onValueChange={([value]) => onExtraPaymentChange(value)}
                max={2000}
                step={50}
                className="flex-1"
              />
            </div>
            <div className="w-32">
              <Input
                type="number"
                value={extraPayment}
                onChange={(e) => onExtraPaymentChange(parseFloat(e.target.value) || 0)}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Minimum only</span>
            <span className="text-white font-semibold">
              Total monthly: {formatCurrency(totalMinimumPayment + extraPayment)}
            </span>
            <span>$2,000 extra</span>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Debt Snowball Card */}
        <Card className={`bg-gray-800 border-2 transition-all ${
          selectedStrategy === 'snowball' ? 'border-blue-500' : 'border-gray-700'
        }`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-blue-400" />
                Debt Snowball
              </div>
              {selectedStrategy === 'snowball' && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                  Selected
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-gray-400">
              Pay smallest balances first for quick wins
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snowballResult && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Debt-Free Date</p>
                    <p className="text-lg font-semibold text-white">
                      {snowballResult.payoffDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Time to Freedom</p>
                    <p className="text-lg font-semibold text-white">
                      {snowballResult.monthsToPayoff} months
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Total Interest</p>
                    <p className="text-lg font-semibold text-white">
                      {formatCurrency(snowballResult.totalInterestPaid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">First Win</p>
                    <p className="text-lg font-semibold text-white">
                      {snowballResult.firstDebtPaidOff.monthsToPay} months
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">Payoff Order</p>
                  <div className="space-y-1">
                    {snowballResult.debtOrder.slice(0, 3).map((debtId, index) => {
                      const debt = activeDebts.find(d => d.id === debtId);
                      if (!debt) return null;
                      return (
                        <div key={debtId} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">{index + 1}.</span>
                          <span className="text-white">{debt.debtName}</span>
                          <span className="text-gray-400">
                            ({formatCurrency(debt.currentBalance)})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleStrategySelect('snowball')}
                >
                  Select Snowball Strategy
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Debt Avalanche Card */}
        <Card className={`bg-gray-800 border-2 transition-all ${
          selectedStrategy === 'avalanche' ? 'border-red-500' : 'border-gray-700'
        }`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mountain className="w-5 h-5 text-red-400" />
                Debt Avalanche
              </div>
              {selectedStrategy === 'avalanche' && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                  Selected
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-gray-400">
              Pay highest interest rates first to minimize cost
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {avalancheResult && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Debt-Free Date</p>
                    <p className="text-lg font-semibold text-white">
                      {avalancheResult.payoffDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Time to Freedom</p>
                    <p className="text-lg font-semibold text-white">
                      {avalancheResult.monthsToPayoff} months
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Total Interest</p>
                    <p className="text-lg font-semibold text-white">
                      {formatCurrency(avalancheResult.totalInterestPaid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">First Win</p>
                    <p className="text-lg font-semibold text-white">
                      {avalancheResult.firstDebtPaidOff.monthsToPay} months
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">Payoff Order</p>
                  <div className="space-y-1">
                    {avalancheResult.debtOrder.slice(0, 3).map((debtId, index) => {
                      const debt = activeDebts.find(d => d.id === debtId);
                      if (!debt) return null;
                      return (
                        <div key={debtId} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">{index + 1}.</span>
                          <span className="text-white">{debt.debtName}</span>
                          <span className="text-gray-400">
                            ({debt.annualInterestRate}% APR)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={() => handleStrategySelect('avalanche')}
                >
                  Select Avalanche Strategy
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Summary */}
      {snowballResult && avalancheResult && (
        <Card className="bg-gradient-to-r from-blue-900/20 to-red-900/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Strategy Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getMonthDifference() > 0 && (
                <Alert className="bg-gray-800/50 border-gray-700">
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    {avalancheResult.monthsToPayoff < snowballResult.monthsToPayoff ? (
                      <>
                        <span className="font-semibold text-red-400">Avalanche</span> gets you debt-free{' '}
                        <span className="font-semibold text-white">{getMonthDifference()} months faster</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-blue-400">Snowball</span> gets you debt-free{' '}
                        <span className="font-semibold text-white">{getMonthDifference()} months faster</span>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {getInterestDifference() > 0 && (
                <Alert className="bg-gray-800/50 border-gray-700">
                  <DollarSign className="w-4 h-4" />
                  <AlertDescription>
                    {avalancheResult.totalInterestPaid < snowballResult.totalInterestPaid ? (
                      <>
                        <span className="font-semibold text-red-400">Avalanche</span> saves you{' '}
                        <span className="font-semibold text-white">
                          {formatCurrency(getInterestDifference())}
                        </span> in interest
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-blue-400">Snowball</span> saves you{' '}
                        <span className="font-semibold text-white">
                          {formatCurrency(getInterestDifference())}
                        </span> in interest
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-sm text-gray-400">Snowball First Win</p>
                  <p className="text-lg font-semibold text-blue-400">
                    {snowballResult.firstDebtPaidOff.monthsToPay} months
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-400">Avalanche First Win</p>
                  <p className="text-lg font-semibold text-red-400">
                    {avalancheResult.firstDebtPaidOff.monthsToPay} months
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}