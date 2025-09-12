import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  PiggyBank,
  Percent,
  AlertCircle,
  Info,
  Plus,
  Minus,
  RefreshCw,
  Target,
  Zap,
  Gift,
  Briefcase,
  Home,
  CheckCircle,
  Save
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

interface PayoffPlan {
  id: number;
  planName: string;
  strategy: string;
  payoffDate: string;
  totalInterestPaid: number;
  monthsToPayoff: number;
  isActive: boolean;
}

interface Scenario {
  name: string;
  type: string;
  parameters: any;
  results: {
    payoffDate: Date;
    monthsToPayoff: number;
    totalInterestPaid: number;
    monthsSaved: number;
    interestSaved: number;
  };
}

interface ScenarioPlannerProps {
  debts: Debt[];
  activePlan: PayoffPlan | null;
}

export function ScenarioPlanner({ debts, activePlan }: ScenarioPlannerProps) {
  const [selectedScenarioType, setSelectedScenarioType] = useState("extra_payment");
  const [currentScenario, setCurrentScenario] = useState({
    extraPayment: 100,
    lumpSum: 1000,
    lumpSumMonth: 3,
    rateChangeDebtId: debts[0]?.id || 0,
    newRate: 10,
    consolidationAmount: 0,
    consolidationRate: 8,
    consolidationTerm: 60,
    incomeChange: 0,
    incomeChangeMonth: 6,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch saved scenarios from database
  const { data: savedScenarios = [], refetch: refetchScenarios } = useQuery({
    queryKey: ['/api/debt-scenarios'],
    queryFn: async () => {
      const response = await fetch('/api/debt-scenarios');
      if (!response.ok) throw new Error('Failed to fetch scenarios');
      return response.json();
    }
  });

  // Mutation to save scenario
  const saveScenarioMutation = useMutation({
    mutationFn: async (scenario: any) => {
      const response = await fetch('/api/debt-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario)
      });
      if (!response.ok) throw new Error('Failed to save scenario');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/debt-scenarios'] });
      toast({
        title: "Scenario Saved",
        description: "Your what-if scenario has been saved successfully.",
        className: "bg-green-900 border-green-800 text-white",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save scenario. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Mutation to delete scenario
  const deleteScenarioMutation = useMutation({
    mutationFn: async (scenarioId: number) => {
      const response = await fetch(`/api/debt-scenarios/${scenarioId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete scenario');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/debt-scenarios'] });
      toast({
        title: "Scenario Deleted",
        description: "The scenario has been removed.",
        className: "bg-gray-900 border-gray-800 text-white",
      });
    }
  });

  const activeDebts = debts.filter(d => d.status === 'active');
  const totalDebt = activeDebts.reduce((sum, d) => {
    const balance = typeof d.currentBalance === 'string' 
      ? parseFloat(d.currentBalance) 
      : d.currentBalance;
    return sum + (isNaN(balance) ? 0 : balance);
  }, 0);
  const totalMinimumPayment = activeDebts.reduce((sum, d) => {
    const payment = typeof d.minimumPayment === 'string'
      ? parseFloat(d.minimumPayment)
      : d.minimumPayment;
    return sum + (isNaN(payment) ? 0 : payment);
  }, 0);

  const calculateScenario = () => {
    // In a real app, this would call an API endpoint
    // For now, we'll simulate results
    let results: Scenario['results'];
    const baseMonths = activePlan?.monthsToPayoff || 36;
    const baseInterest = activePlan?.totalInterestPaid || totalDebt * 0.15;

    switch (selectedScenarioType) {
      case 'extra_payment':
        const monthsSavedByExtra = Math.floor(currentScenario.extraPayment / 50);
        const interestSavedByExtra = currentScenario.extraPayment * baseMonths * 0.1;
        results = {
          payoffDate: new Date(Date.now() + (baseMonths - monthsSavedByExtra) * 30 * 24 * 60 * 60 * 1000),
          monthsToPayoff: baseMonths - monthsSavedByExtra,
          totalInterestPaid: baseInterest - interestSavedByExtra,
          monthsSaved: monthsSavedByExtra,
          interestSaved: interestSavedByExtra,
        };
        break;

      case 'lump_sum':
        const monthsSavedByLump = Math.floor(currentScenario.lumpSum / 500);
        const interestSavedByLump = currentScenario.lumpSum * 0.15;
        results = {
          payoffDate: new Date(Date.now() + (baseMonths - monthsSavedByLump) * 30 * 24 * 60 * 60 * 1000),
          monthsToPayoff: baseMonths - monthsSavedByLump,
          totalInterestPaid: baseInterest - interestSavedByLump,
          monthsSaved: monthsSavedByLump,
          interestSaved: interestSavedByLump,
        };
        break;

      case 'consolidation':
        // Calculate weighted average current interest rate
        const weightedCurrentRate = totalDebt > 0 ? activeDebts.reduce((sum, debt) => {
          const balance = typeof debt.currentBalance === 'string' 
            ? parseFloat(debt.currentBalance) 
            : debt.currentBalance;
          const rate = typeof debt.annualInterestRate === 'string'
            ? parseFloat(debt.annualInterestRate)
            : debt.annualInterestRate;
          return sum + (rate * balance / totalDebt);
        }, 0) : 0;
        
        // Calculate current total interest with proper amortization for each debt
        let currentTotalInterestProper = 0;
        let maxMonthsCurrent = 0;
        
        activeDebts.forEach(debt => {
          const balance = typeof debt.currentBalance === 'string' 
            ? parseFloat(debt.currentBalance) 
            : debt.currentBalance;
          const annualRate = typeof debt.annualInterestRate === 'string'
            ? parseFloat(debt.annualInterestRate)
            : debt.annualInterestRate;
          const rate = annualRate / 100 / 12;
          const payment = typeof debt.minimumPayment === 'string'
            ? parseFloat(debt.minimumPayment)
            : debt.minimumPayment;
          
          if (rate > 0 && payment > balance * rate) {
            // Calculate months to payoff for this debt
            const months = Math.ceil(
              Math.log(payment / (payment - balance * rate)) / Math.log(1 + rate)
            );
            maxMonthsCurrent = Math.max(maxMonthsCurrent, months);
            
            // Calculate total interest for this debt
            const totalPaid = payment * months;
            const interest = totalPaid - balance;
            currentTotalInterestProper += interest;
          } else if (rate === 0) {
            // No interest debt
            const months = Math.ceil(balance / payment);
            maxMonthsCurrent = Math.max(maxMonthsCurrent, months);
          } else {
            // Payment doesn't cover interest - use a large number
            currentTotalInterestProper += balance * 0.5; // Estimate 50% interest over time
            maxMonthsCurrent = Math.max(maxMonthsCurrent, 360); // 30 years max
          }
        });
        
        // Use the calculated value or fallback to estimate if not available
        const currentTotalInterest = currentTotalInterestProper > 0 ? currentTotalInterestProper : baseInterest;
        const currentMonths = maxMonthsCurrent > 0 ? maxMonthsCurrent : baseMonths;
        
        // Calculate new consolidation loan details
        const consolidationAmount = currentScenario.consolidationAmount || totalDebt;
        const consolidationMonthlyRate = currentScenario.consolidationRate / 100 / 12;
        
        let consolidationMonthlyPayment: number;
        let consolidationTotalInterest: number;
        
        if (consolidationMonthlyRate > 0) {
          // Standard amortization formula for loans with interest
          consolidationMonthlyPayment = consolidationAmount * 
            (consolidationMonthlyRate * Math.pow(1 + consolidationMonthlyRate, currentScenario.consolidationTerm)) /
            (Math.pow(1 + consolidationMonthlyRate, currentScenario.consolidationTerm) - 1);
          
          const consolidationTotalPayments = consolidationMonthlyPayment * currentScenario.consolidationTerm;
          consolidationTotalInterest = consolidationTotalPayments - consolidationAmount;
        } else {
          // 0% interest consolidation
          consolidationMonthlyPayment = consolidationAmount / currentScenario.consolidationTerm;
          consolidationTotalInterest = 0;
        }
        
        // Calculate savings (can be negative if consolidation is worse)
        const interestSavedByConsolidation = currentTotalInterest - consolidationTotalInterest;
        const monthsSavedByConsolidation = currentMonths - currentScenario.consolidationTerm;
        
        results = {
          payoffDate: new Date(Date.now() + currentScenario.consolidationTerm * 30 * 24 * 60 * 60 * 1000),
          monthsToPayoff: currentScenario.consolidationTerm,
          totalInterestPaid: consolidationTotalInterest,
          monthsSaved: monthsSavedByConsolidation,
          interestSaved: interestSavedByConsolidation,
        };
        break;

      default:
        results = {
          payoffDate: new Date(Date.now() + baseMonths * 30 * 24 * 60 * 60 * 1000),
          monthsToPayoff: baseMonths,
          totalInterestPaid: baseInterest,
          monthsSaved: 0,
          interestSaved: 0,
        };
    }

    // Save scenario to database
    const scenarioData = {
      scenarioName: getScenarioName(),
      scenarioType: selectedScenarioType,
      parameters: { ...currentScenario },
      results,
      payoffDate: results.payoffDate,
      totalInterestPaid: results.totalInterestPaid,
      monthsToPayoff: results.monthsToPayoff,
      monthsSaved: results.monthsSaved,
      interestSaved: results.interestSaved
    };

    saveScenarioMutation.mutate(scenarioData);
  };

  const getScenarioName = () => {
    switch (selectedScenarioType) {
      case 'extra_payment':
        return `Extra $${currentScenario.extraPayment}/month`;
      case 'lump_sum':
        return `$${currentScenario.lumpSum} lump sum`;
      case 'rate_change':
        return `Rate change to ${currentScenario.newRate}%`;
      case 'consolidation':
        return `Consolidation at ${currentScenario.consolidationRate}%`;
      case 'income_change':
        return `Income ${currentScenario.incomeChange > 0 ? 'increase' : 'decrease'}`;
      default:
        return 'Custom scenario';
    }
  };

  const removeScenario = (scenarioId: number) => {
    deleteScenarioMutation.mutate(scenarioId);
  };

  if (activeDebts.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-12 text-center">
          <Calculator className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Active Debts</h3>
          <p className="text-gray-400">Add debts to explore what-if scenarios</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scenario Type Selection */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">What-If Analysis</CardTitle>
          <CardDescription className="text-gray-400">
            Explore how different scenarios affect your debt payoff timeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario Type Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant={selectedScenarioType === 'extra_payment' ? 'default' : 'outline'}
              className={selectedScenarioType === 'extra_payment' 
                ? 'bg-primary hover:bg-primary/90 text-white' 
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white'}
              onClick={() => setSelectedScenarioType('extra_payment')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Extra Payment
            </Button>
            <Button
              variant={selectedScenarioType === 'lump_sum' ? 'default' : 'outline'}
              className={selectedScenarioType === 'lump_sum' 
                ? 'bg-primary hover:bg-primary/90 text-white' 
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white'}
              onClick={() => setSelectedScenarioType('lump_sum')}
            >
              <Gift className="w-4 h-4 mr-2" />
              Lump Sum
            </Button>
            <Button
              variant={selectedScenarioType === 'consolidation' ? 'default' : 'outline'}
              className={selectedScenarioType === 'consolidation' 
                ? 'bg-primary hover:bg-primary/90 text-white' 
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white'}
              onClick={() => setSelectedScenarioType('consolidation')}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Consolidation
            </Button>
            <Button
              variant={selectedScenarioType === 'rate_change' ? 'default' : 'outline'}
              className={selectedScenarioType === 'rate_change' 
                ? 'bg-primary hover:bg-primary/90 text-white' 
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white'}
              onClick={() => setSelectedScenarioType('rate_change')}
            >
              <Percent className="w-4 h-4 mr-2" />
              Rate Change
            </Button>
          </div>

          {/* Scenario Parameters */}
          <div className="space-y-4 p-4 bg-gray-900 rounded-lg">
            {selectedScenarioType === 'extra_payment' && (
              <>
                <Label className="text-white">Additional Monthly Payment</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[currentScenario.extraPayment]}
                    onValueChange={([value]) => setCurrentScenario({ ...currentScenario, extraPayment: value })}
                    max={1000}
                    step={25}
                    className="flex-1"
                  />
                  <div className="w-24">
                    <Input
                      type="number"
                      value={currentScenario.extraPayment}
                      onChange={(e) => setCurrentScenario({ 
                        ...currentScenario, 
                        extraPayment: parseFloat(e.target.value) || 0 
                      })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  Increase your monthly payment from {formatCurrency(totalMinimumPayment)} to{' '}
                  {formatCurrency(totalMinimumPayment + currentScenario.extraPayment)}
                </p>
              </>
            )}

            {selectedScenarioType === 'lump_sum' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Lump Sum Amount</Label>
                    <Input
                      type="number"
                      value={currentScenario.lumpSum}
                      onChange={(e) => setCurrentScenario({ 
                        ...currentScenario, 
                        lumpSum: parseFloat(e.target.value) || 0 
                      })}
                      className="bg-gray-800 border-gray-700 text-white"
                      placeholder="1000"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Apply in Month</Label>
                    <Input
                      type="number"
                      value={currentScenario.lumpSumMonth}
                      onChange={(e) => setCurrentScenario({ 
                        ...currentScenario, 
                        lumpSumMonth: parseInt(e.target.value) || 1 
                      })}
                      className="bg-gray-800 border-gray-700 text-white"
                      placeholder="3"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  Apply a one-time payment (tax refund, bonus, etc.) to accelerate payoff
                </p>
              </>
            )}

            {selectedScenarioType === 'consolidation' && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-white">Consolidation Amount</Label>
                    <Input
                      type="number"
                      value={currentScenario.consolidationAmount || totalDebt}
                      onChange={(e) => setCurrentScenario({ 
                        ...currentScenario, 
                        consolidationAmount: parseFloat(e.target.value) || 0 
                      })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Interest Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={currentScenario.consolidationRate}
                      onChange={(e) => setCurrentScenario({ 
                        ...currentScenario, 
                        consolidationRate: parseFloat(e.target.value) || 0 
                      })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Term (months)</Label>
                    <Input
                      type="number"
                      value={currentScenario.consolidationTerm}
                      onChange={(e) => setCurrentScenario({ 
                        ...currentScenario, 
                        consolidationTerm: parseInt(e.target.value) || 0 
                      })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg mt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-400">Current total minimum payments:</p>
                    <span className="text-white font-semibold">{formatCurrency(totalMinimumPayment)}/mo</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-400">Estimated consolidation payment:</p>
                    <span className="text-white font-semibold">
                      {(() => {
                        const amount = currentScenario.consolidationAmount || totalDebt;
                        const rate = currentScenario.consolidationRate / 100 / 12;
                        const term = currentScenario.consolidationTerm;
                        if (rate > 0) {
                          const payment = amount * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
                          return formatCurrency(payment) + '/mo';
                        } else {
                          return formatCurrency(amount / term) + '/mo';
                        }
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-400">Current weighted avg rate:</p>
                    <span className="text-white font-semibold">
                      {totalDebt > 0 ? activeDebts.reduce((sum, debt) => {
                        const balance = typeof debt.currentBalance === 'string' 
                          ? parseFloat(debt.currentBalance) 
                          : debt.currentBalance;
                        const rate = typeof debt.annualInterestRate === 'string'
                          ? parseFloat(debt.annualInterestRate)
                          : debt.annualInterestRate;
                        return sum + ((rate || 0) * (balance || 0) / totalDebt);
                      }, 0).toFixed(2) : '0.00'}%
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-700">
                    {(() => {
                      const currentAvgRate = totalDebt > 0 ? activeDebts.reduce((sum, debt) => {
                        const balance = typeof debt.currentBalance === 'string' 
                          ? parseFloat(debt.currentBalance) 
                          : debt.currentBalance;
                        const rate = typeof debt.annualInterestRate === 'string'
                          ? parseFloat(debt.annualInterestRate)
                          : debt.annualInterestRate;
                        return sum + ((rate || 0) * (balance || 0) / totalDebt);
                      }, 0) : 0;
                      
                      return currentScenario.consolidationRate < currentAvgRate ? (
                        <span className="text-green-400 text-sm">✓ Lower rate will likely save interest</span>
                      ) : (
                        <span className="text-yellow-400 text-sm">⚠ Higher rate may cost more in interest</span>
                      );
                    })()}
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Consolidate multiple debts into a single loan with potentially lower interest
                </p>
              </>
            )}

            {selectedScenarioType === 'rate_change' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Select Debt</Label>
                    <Select
                      value={currentScenario.rateChangeDebtId.toString()}
                      onValueChange={(value) => setCurrentScenario({ 
                        ...currentScenario, 
                        rateChangeDebtId: parseInt(value) 
                      })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {activeDebts.map(debt => (
                          <SelectItem key={debt.id} value={debt.id.toString()}>
                            {debt.debtName} ({debt.annualInterestRate}% APR)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">New Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={currentScenario.newRate}
                      onChange={(e) => setCurrentScenario({ 
                        ...currentScenario, 
                        newRate: parseFloat(e.target.value) || 0 
                      })}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  Model the impact of refinancing or rate changes on specific debts
                </p>
              </>
            )}

            <Button 
              className="w-full bg-primary hover:bg-primary/90"
              onClick={calculateScenario}
              disabled={saveScenarioMutation.isPending}
            >
              {saveScenarioMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving Scenario...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4 mr-2" />
                  Calculate & Save Scenario
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Plan Baseline */}
      {activePlan && (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Current Plan Baseline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400">Payoff Date</p>
                <p className="text-sm font-semibold text-white">
                  {new Date(activePlan.payoffDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Months</p>
                <p className="text-sm font-semibold text-white">{activePlan.monthsToPayoff}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Interest</p>
                <p className="text-sm font-semibold text-white">
                  {formatCurrency(activePlan.totalInterestPaid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Strategy</p>
                <p className="text-sm font-semibold text-white capitalize">{activePlan.strategy}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scenario Results */}
      {savedScenarios.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Saved Scenarios</h3>
          {savedScenarios.map((scenario: any) => (
            <Card key={scenario.id} className="bg-gray-900 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="font-semibold text-white">{scenario.scenarioName}</p>
                      <p className="text-sm text-gray-400">
                        {scenario.scenarioType.replace('_', ' ').charAt(0).toUpperCase() + 
                         scenario.scenarioType.replace('_', ' ').slice(1)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeScenario(scenario.id)}
                    disabled={deleteScenarioMutation.isPending}
                  >
                    <Minus className="w-4 h-4 text-red-400" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">New Payoff Date</p>
                    <p className="text-sm font-semibold text-white">
                      {scenario.payoffDate ? new Date(scenario.payoffDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        year: 'numeric' 
                      }) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Months to Payoff</p>
                    <p className="text-sm font-semibold text-white">
                      {scenario.monthsToPayoff || scenario.results?.monthsToPayoff || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Months {(scenario.monthsSaved || 0) >= 0 ? 'Saved' : 'Added'}</p>
                    <p className={`text-sm font-semibold ${(scenario.monthsSaved || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Math.abs(scenario.monthsSaved || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Interest {(parseFloat(scenario.interestSaved) || 0) >= 0 ? 'Saved' : 'Added'}</p>
                    <p className={`text-sm font-semibold ${(parseFloat(scenario.interestSaved) || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(Math.abs(parseFloat(scenario.interestSaved) || 0))}
                    </p>
                  </div>
                </div>
                
                {/* Show created date */}
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-500">
                    Created: {new Date(scenario.createdAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tips */}
      <Alert className="bg-blue-900/20 border-blue-800">
        <Info className="w-4 h-4 text-blue-400" />
        <AlertDescription className="text-gray-300">
          <strong>Pro Tip:</strong> Try combining scenarios! An extra $100/month plus a $2,000 tax refund 
          could dramatically accelerate your debt freedom date.
        </AlertDescription>
      </Alert>
    </div>
  );
}