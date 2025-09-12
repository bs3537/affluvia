import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { 
  X, 
  Calendar, 
  Loader2, 
  ChevronRight, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  Zap, 
  DollarSign, 
  Calculator, 
  Brain, 
  Info 
} from "lucide-react";

interface Debt {
  id: number;
  debtName: string;
  debtType: string;
  currentBalance: number | string;
  annualInterestRate: number | string;
  minimumPayment: number | string;
  status?: string;
}

interface DebtPayoffTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  debts: Debt[];
  onDebtsUpdate?: () => void;
}

export function DebtPayoffTracker({ isOpen, onClose, debts = [], onDebtsUpdate }: DebtPayoffTrackerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [extraPayment, setExtraPayment] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState("hybrid");
  const [lumpSumAmount, setLumpSumAmount] = useState(0);
  const [consolidationRate, setConsolidationRate] = useState(7);
  const [rateChangePercentage, setRateChangePercentage] = useState(0);

  // Filter active debts
  const activeDebts = debts.filter(d => d.status !== 'paid_off');

  // Calculate totals
  const totalBalance = activeDebts.reduce((sum, debt) => {
    const balance = typeof debt.currentBalance === 'string' 
      ? parseFloat(debt.currentBalance) 
      : debt.currentBalance;
    return sum + balance;
  }, 0);

  const totalMinPayment = activeDebts.reduce((sum, debt) => {
    const payment = typeof debt.minimumPayment === 'string' 
      ? parseFloat(debt.minimumPayment) 
      : debt.minimumPayment;
    return sum + payment;
  }, 0);

  const avgInterestRate = activeDebts.length > 0
    ? activeDebts.reduce((sum, debt) => {
        const rate = typeof debt.annualInterestRate === 'string'
          ? parseFloat(debt.annualInterestRate)
          : debt.annualInterestRate;
        return sum + rate;
      }, 0) / activeDebts.length
    : 0;

  // Calculate payoff timeline for each debt
  const calculatePayoffTimeline = (debt: Debt, monthlyPayment?: number) => {
    const balance = typeof debt.currentBalance === 'string' 
      ? parseFloat(debt.currentBalance) 
      : debt.currentBalance;
    const rate = typeof debt.annualInterestRate === 'string'
      ? parseFloat(debt.annualInterestRate)
      : debt.annualInterestRate;
    const payment = monthlyPayment || (typeof debt.minimumPayment === 'string' 
      ? parseFloat(debt.minimumPayment) 
      : debt.minimumPayment);

    if (balance <= 0) return { months: 0, totalInterest: 0 };

    const monthlyRate = rate / 100 / 12;
    
    if (monthlyRate === 0) {
      return {
        months: Math.ceil(balance / payment),
        totalInterest: 0
      };
    }

    if (payment <= balance * monthlyRate) {
      return {
        months: Infinity,
        totalInterest: Infinity
      };
    }

    const months = Math.ceil(
      Math.log(payment / (payment - balance * monthlyRate)) / 
      Math.log(1 + monthlyRate)
    );

    const totalPaid = payment * months;
    const totalInterest = totalPaid - balance;

    return { months, totalInterest };
  };

  // Sort debts based on strategy
  const getSortedDebts = (strategy: string) => {
    const debtsCopy = [...activeDebts];
    
    switch (strategy) {
      case 'snowball':
        return debtsCopy.sort((a, b) => {
          const balanceA = typeof a.currentBalance === 'string' ? parseFloat(a.currentBalance) : a.currentBalance;
          const balanceB = typeof b.currentBalance === 'string' ? parseFloat(b.currentBalance) : b.currentBalance;
          return balanceA - balanceB;
        });
      
      case 'avalanche':
        return debtsCopy.sort((a, b) => {
          const rateA = typeof a.annualInterestRate === 'string' ? parseFloat(a.annualInterestRate) : a.annualInterestRate;
          const rateB = typeof b.annualInterestRate === 'string' ? parseFloat(b.annualInterestRate) : b.annualInterestRate;
          return rateB - rateA;
        });
      
      case 'hybrid':
      default:
        // Pay off 2 smallest debts first, then switch to avalanche
        const smallestTwo = debtsCopy
          .sort((a, b) => {
            const balanceA = typeof a.currentBalance === 'string' ? parseFloat(a.currentBalance) : a.currentBalance;
            const balanceB = typeof b.currentBalance === 'string' ? parseFloat(b.currentBalance) : b.currentBalance;
            return balanceA - balanceB;
          })
          .slice(0, 2);
        
        const remaining = debtsCopy
          .filter(d => !smallestTwo.includes(d))
          .sort((a, b) => {
            const rateA = typeof a.annualInterestRate === 'string' ? parseFloat(a.annualInterestRate) : a.annualInterestRate;
            const rateB = typeof b.annualInterestRate === 'string' ? parseFloat(b.annualInterestRate) : b.annualInterestRate;
            return rateB - rateA;
          });
        
        return [...smallestTwo, ...remaining];
    }
  };

  // Calculate scenario impact
  const calculateScenarioImpact = (scenario: string) => {
    let newMonths = 0;
    let newInterest = 0;
    let currentMonths = 0;
    let currentInterest = 0;

    activeDebts.forEach(debt => {
      const current = calculatePayoffTimeline(debt);
      currentMonths = Math.max(currentMonths, current.months);
      currentInterest += current.totalInterest;
    });

    switch (scenario) {
      case 'extra':
        const extraPerDebt = extraPayment / activeDebts.length;
        activeDebts.forEach(debt => {
          const minPayment = typeof debt.minimumPayment === 'string' 
            ? parseFloat(debt.minimumPayment) 
            : debt.minimumPayment;
          const updated = calculatePayoffTimeline(debt, minPayment + extraPerDebt);
          newMonths = Math.max(newMonths, updated.months);
          newInterest += updated.totalInterest;
        });
        break;

      case 'lumpsum':
        // Apply lump sum to highest interest debt first
        const sortedByRate = [...activeDebts].sort((a, b) => {
          const rateA = typeof a.annualInterestRate === 'string' ? parseFloat(a.annualInterestRate) : a.annualInterestRate;
          const rateB = typeof b.annualInterestRate === 'string' ? parseFloat(b.annualInterestRate) : b.annualInterestRate;
          return rateB - rateA;
        });

        let remainingLumpSum = lumpSumAmount;
        sortedByRate.forEach(debt => {
          const balance = typeof debt.currentBalance === 'string' 
            ? parseFloat(debt.currentBalance) 
            : debt.currentBalance;
          const reducedBalance = Math.max(0, balance - remainingLumpSum);
          remainingLumpSum = Math.max(0, remainingLumpSum - balance);
          
          const modifiedDebt = { ...debt, currentBalance: reducedBalance };
          const updated = calculatePayoffTimeline(modifiedDebt);
          newMonths = Math.max(newMonths, updated.months);
          newInterest += updated.totalInterest;
        });
        break;

      case 'consolidation':
        const totalBalanceForConsolidation = totalBalance;
        const consolidatedPayment = totalMinPayment;
        const monthlyRate = consolidationRate / 100 / 12;
        
        if (monthlyRate === 0) {
          newMonths = Math.ceil(totalBalanceForConsolidation / consolidatedPayment);
          newInterest = 0;
        } else if (consolidatedPayment > totalBalanceForConsolidation * monthlyRate) {
          newMonths = Math.ceil(
            Math.log(consolidatedPayment / (consolidatedPayment - totalBalanceForConsolidation * monthlyRate)) / 
            Math.log(1 + monthlyRate)
          );
          newInterest = (consolidatedPayment * newMonths) - totalBalanceForConsolidation;
        } else {
          newMonths = Infinity;
          newInterest = Infinity;
        }
        break;

      case 'ratechange':
        activeDebts.forEach(debt => {
          const currentRate = typeof debt.annualInterestRate === 'string'
            ? parseFloat(debt.annualInterestRate)
            : debt.annualInterestRate;
          const newRate = currentRate * (1 + rateChangePercentage / 100);
          const modifiedDebt = { ...debt, annualInterestRate: newRate };
          const updated = calculatePayoffTimeline(modifiedDebt);
          newMonths = Math.max(newMonths, updated.months);
          newInterest += updated.totalInterest;
        });
        break;

      default:
        newMonths = currentMonths;
        newInterest = currentInterest;
    }

    return {
      monthsSaved: currentMonths - newMonths,
      interestSaved: currentInterest - newInterest,
      newPayoffTime: newMonths,
      totalSavings: currentInterest - newInterest
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-7xl h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Brain className="w-7 h-7 text-purple-400" />
              Hybrid Debt Payoff Strategy
            </h2>
            <p className="text-gray-400 mt-1">
              Intelligent combination of Snowball and Avalanche methods for optimal results
            </p>
          </div>
          <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="w-full justify-start px-6 bg-gray-800 border-b border-gray-700">
              <TabsTrigger value="overview" className="data-[state=active]:bg-gray-700">
                Overview
              </TabsTrigger>
              <TabsTrigger value="strategy" className="data-[state=active]:bg-gray-700">
                Payoff Order
              </TabsTrigger>
              <TabsTrigger value="whatif" className="data-[state=active]:bg-gray-700">
                What-If Scenarios
              </TabsTrigger>
              <TabsTrigger value="insights" className="data-[state=active]:bg-gray-700">
                Insights
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(100%-60px)]">
              <div className="p-6">
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <span className="text-gray-400 text-sm">Total Debt</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{formatCurrency(totalBalance)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-5 h-5 text-blue-400" />
                        <span className="text-gray-400 text-sm">Monthly Payment</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{formatCurrency(totalMinPayment)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        <span className="text-gray-400 text-sm">Avg Interest Rate</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{avgInterestRate.toFixed(2)}%</p>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-400" />
                      Your Debts & Payoff Timeline
                    </h3>
                    <div className="space-y-4">
                      {getSortedDebts(selectedStrategy).map((debt, index) => {
                        const timeline = calculatePayoffTimeline(debt);
                        const balance = typeof debt.currentBalance === 'string' 
                          ? parseFloat(debt.currentBalance) 
                          : debt.currentBalance;
                        const payment = typeof debt.minimumPayment === 'string' 
                          ? parseFloat(debt.minimumPayment) 
                          : debt.minimumPayment;
                        
                        return (
                          <div key={debt.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={`${index === 0 ? 'bg-purple-600' : 'bg-gray-700'}`}>
                                    #{index + 1}
                                  </Badge>
                                  <h4 className="font-semibold text-white">{debt.debtName}</h4>
                                  <span className="text-xs text-gray-500">({debt.debtType})</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                                  <div>
                                    <p className="text-xs text-gray-500">Balance</p>
                                    <p className="text-sm font-semibold text-white">{formatCurrency(balance)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Rate</p>
                                    <p className="text-sm font-semibold text-white">{debt.annualInterestRate}%</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Min Payment</p>
                                    <p className="text-sm font-semibold text-white">{formatCurrency(payment)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Payoff Time</p>
                                    <p className="text-sm font-semibold text-blue-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {timeline.months === Infinity 
                                        ? 'Never (payment too low)' 
                                        : `${timeline.months} months`}
                                    </p>
                                  </div>
                                </div>
                                {timeline.totalInterest !== Infinity && (
                                  <div className="mt-2 pt-2 border-t border-gray-800">
                                    <p className="text-xs text-gray-500">
                                      Total interest to be paid: 
                                      <span className="text-red-400 font-semibold ml-1">
                                        {formatCurrency(timeline.totalInterest)}
                                      </span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* Strategy Tab */}
                <TabsContent value="strategy" className="space-y-6 mt-0">
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Select Your Strategy</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Label htmlFor="strategy" className="text-gray-300 min-w-[120px]">
                          Strategy Type:
                        </Label>
                        <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                          <SelectTrigger className="w-full bg-gray-900 border-gray-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-700">
                            <SelectItem value="hybrid">Hybrid (Recommended)</SelectItem>
                            <SelectItem value="snowball">Snowball (Smallest First)</SelectItem>
                            <SelectItem value="avalanche">Avalanche (Highest Rate First)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Payoff Order</h3>
                    <div className="space-y-3">
                      {getSortedDebts(selectedStrategy).map((debt, index) => {
                        const balance = typeof debt.currentBalance === 'string' 
                          ? parseFloat(debt.currentBalance) 
                          : debt.currentBalance;
                        const rate = typeof debt.annualInterestRate === 'string'
                          ? parseFloat(debt.annualInterestRate)
                          : debt.annualInterestRate;
                        
                        return (
                          <div key={debt.id} className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 text-white font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-white">{debt.debtName}</p>
                              <p className="text-sm text-gray-400">
                                {formatCurrency(balance)} at {rate}% APR
                              </p>
                            </div>
                            {index < getSortedDebts(selectedStrategy).length - 1 && (
                              <ChevronRight className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* What-If Tab */}
                <TabsContent value="whatif" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Extra Payment Scenario */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        Extra Monthly Payment
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="extra-payment" className="text-gray-300">
                            Additional Payment Amount
                          </Label>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-gray-400">$</span>
                            <Input
                              id="extra-payment"
                              type="number"
                              value={extraPayment}
                              onChange={(e) => setExtraPayment(Number(e.target.value))}
                              className="bg-gray-900 border-gray-700"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        {extraPayment > 0 && (
                          <div className="p-3 bg-green-900/20 rounded-lg border border-green-800/50">
                            <p className="text-sm text-green-400">
                              Impact: {calculateScenarioImpact('extra').monthsSaved} months saved
                            </p>
                            <p className="text-sm text-green-400">
                              Interest saved: {formatCurrency(calculateScenarioImpact('extra').interestSaved)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lump Sum Scenario */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        One-Time Lump Sum
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="lump-sum" className="text-gray-300">
                            Lump Sum Amount
                          </Label>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-gray-400">$</span>
                            <Input
                              id="lump-sum"
                              type="number"
                              value={lumpSumAmount}
                              onChange={(e) => setLumpSumAmount(Number(e.target.value))}
                              className="bg-gray-900 border-gray-700"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        {lumpSumAmount > 0 && (
                          <div className="p-3 bg-yellow-900/20 rounded-lg border border-yellow-800/50">
                            <p className="text-sm text-yellow-400">
                              Impact: {calculateScenarioImpact('lumpsum').monthsSaved} months saved
                            </p>
                            <p className="text-sm text-yellow-400">
                              Interest saved: {formatCurrency(calculateScenarioImpact('lumpsum').interestSaved)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Consolidation Scenario */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-400" />
                        Debt Consolidation
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="consolidation-rate" className="text-gray-300">
                            New Interest Rate: {consolidationRate}%
                          </Label>
                          <Slider
                            id="consolidation-rate"
                            min={3}
                            max={15}
                            step={0.5}
                            value={[consolidationRate]}
                            onValueChange={(value) => setConsolidationRate(value[0])}
                            className="mt-2"
                          />
                        </div>
                        <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800/50">
                          <p className="text-sm text-blue-400">
                            Impact: {calculateScenarioImpact('consolidation').monthsSaved} months saved
                          </p>
                          <p className="text-sm text-blue-400">
                            Interest saved: {formatCurrency(calculateScenarioImpact('consolidation').interestSaved)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Rate Change Scenario */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        Interest Rate Change
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="rate-change" className="text-gray-300">
                            Rate Change: {rateChangePercentage}%
                          </Label>
                          <Slider
                            id="rate-change"
                            min={-50}
                            max={50}
                            step={5}
                            value={[rateChangePercentage]}
                            onValueChange={(value) => setRateChangePercentage(value[0])}
                            className="mt-2"
                          />
                        </div>
                        <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-800/50">
                          <p className="text-sm text-purple-400">
                            Impact: {Math.abs(calculateScenarioImpact('ratechange').monthsSaved)} months {calculateScenarioImpact('ratechange').monthsSaved >= 0 ? 'saved' : 'added'}
                          </p>
                          <p className="text-sm text-purple-400">
                            Interest {calculateScenarioImpact('ratechange').interestSaved >= 0 ? 'saved' : 'added'}: {formatCurrency(Math.abs(calculateScenarioImpact('ratechange').interestSaved))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Insights Tab */}
                <TabsContent value="insights" className="space-y-6 mt-0">
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-400" />
                      AI-Powered Insights
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-600/20 rounded-lg">
                          <Zap className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">Quick Win Opportunity</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Paying off your smallest debt first will free up ${formatCurrency(
                              activeDebts.length > 0 
                                ? typeof activeDebts[0].minimumPayment === 'string' 
                                  ? parseFloat(activeDebts[0].minimumPayment) 
                                  : activeDebts[0].minimumPayment
                                : 0
                            )} per month for other debts.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                          <Info className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">Interest Rate Alert</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Your highest interest rate debt is costing you an extra ${formatCurrency(avgInterestRate * totalBalance / 100 / 12)} per month.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-yellow-600/20 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">Optimization Tip</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Adding just $100 extra per month could save you {calculateScenarioImpact('extra').monthsSaved} months and {formatCurrency(calculateScenarioImpact('extra').interestSaved)} in interest.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
