import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Trophy, TrendingUp, Clock, Calendar, CheckCircle, Loader2, Calculator } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { ScenarioPlanner } from "./scenario-planner";

interface Debt {
  id: number;
  debtName: string;
  debtType: string;
  currentBalance: number | string;
  annualInterestRate: number | string;
  minimumPayment: number | string;
  status?: string;
}

interface DebtPayoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: Debt[];
}

// Calculate payoff timeline for a debt
function calculatePayoffTimeline(debt: Debt, monthlyPayment?: number) {
  const balance = typeof debt.currentBalance === 'string' 
    ? parseFloat(debt.currentBalance) 
    : debt.currentBalance;
  const rate = typeof debt.annualInterestRate === 'string'
    ? parseFloat(debt.annualInterestRate)
    : debt.annualInterestRate;
  const payment = monthlyPayment || (typeof debt.minimumPayment === 'string' 
    ? parseFloat(debt.minimumPayment) 
    : debt.minimumPayment);

  if (balance <= 0) return { months: 0, totalInterest: 0, payoffDate: new Date() };

  const monthlyRate = rate / 100 / 12;
  
  // For 0% interest
  if (monthlyRate === 0) {
    const months = Math.ceil(balance / payment);
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);
    return {
      months,
      totalInterest: 0,
      payoffDate
    };
  }

  // Check if payment covers interest
  if (payment <= balance * monthlyRate) {
    return {
      months: Infinity,
      totalInterest: Infinity,
      payoffDate: null
    };
  }

  // Calculate using amortization formula
  const months = Math.ceil(
    Math.log(payment / (payment - balance * monthlyRate)) / 
    Math.log(1 + monthlyRate)
  );
  
  const totalPaid = payment * months;
  const totalInterest = totalPaid - balance;
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);
  
  return { months, totalInterest, payoffDate };
}

export function DebtPayoffModal({ isOpen, onClose, debts = [] }: DebtPayoffModalProps) {
  const [activeTab, setActiveTab] = useState("strategy");
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; debt: Debt | null }>({
    isOpen: false,
    debt: null
  });
  const queryClient = useQueryClient();

  // Fetch active payoff plan for scenarios
  const { data: activePlan } = useQuery({
    queryKey: ['/api/debt-payoff-plan/active'],
    queryFn: async () => {
      const response = await fetch('/api/debt-payoff-plan/active');
      if (!response.ok) return null;
      return response.json();
    },
    enabled: isOpen
  });

  // Mutation to mark debt as paid and remove from all systems
  const markAsPaidMutation = useMutation({
    mutationFn: async (debtId: number) => {
      const response = await fetch(`/api/debts/${debtId}/delete-with-sync`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark debt as paid");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-payoff-plan/active"] });
      
      // Close confirmation dialog
      setConfirmDialog({ isOpen: false, debt: null });
    },
    onError: (error) => {
      console.error("Failed to mark debt as paid:", error);
    }
  });

  if (!isOpen) return null;

  // Filter active debts
  const activeDebts = debts.filter(d => d.status !== 'paid_off');

  // Sort debts according to hybrid strategy:
  // 1. Smallest debt first (quick win)
  // 2. Then remaining debts by highest interest rate
  // 3. If same interest rate, smallest balance first
  const sortedDebts = (() => {
    if (activeDebts.length === 0) return [];
    
    // Find the smallest debt
    const debtsCopy = [...activeDebts];
    const smallestDebtIndex = debtsCopy.reduce((minIdx, debt, idx, arr) => {
      const minBalance = typeof arr[minIdx].currentBalance === 'string' 
        ? parseFloat(arr[minIdx].currentBalance) 
        : arr[minIdx].currentBalance;
      const currentBalance = typeof debt.currentBalance === 'string' 
        ? parseFloat(debt.currentBalance) 
        : debt.currentBalance;
      return currentBalance < minBalance ? idx : minIdx;
    }, 0);
    
    const smallestDebt = debtsCopy.splice(smallestDebtIndex, 1)[0];
    
    // Sort remaining debts by highest interest rate, then by smallest balance
    const remainingDebts = debtsCopy.sort((a, b) => {
      const rateA = typeof a.annualInterestRate === 'string' 
        ? parseFloat(a.annualInterestRate) 
        : a.annualInterestRate;
      const rateB = typeof b.annualInterestRate === 'string' 
        ? parseFloat(b.annualInterestRate) 
        : b.annualInterestRate;
      
      // First sort by interest rate (highest first)
      if (rateA !== rateB) {
        return rateB - rateA;
      }
      
      // If same interest rate, sort by balance (smallest first)
      const balanceA = typeof a.currentBalance === 'string' 
        ? parseFloat(a.currentBalance) 
        : a.currentBalance;
      const balanceB = typeof b.currentBalance === 'string' 
        ? parseFloat(b.currentBalance) 
        : b.currentBalance;
      return balanceA - balanceB;
    });
    
    return [smallestDebt, ...remainingDebts];
  })();

  const handleCheckboxChange = (debt: Debt, checked: boolean) => {
    if (checked) {
      setConfirmDialog({ isOpen: true, debt });
    }
  };

  const handleConfirmPaidOff = () => {
    if (confirmDialog.debt) {
      markAsPaidMutation.mutate(confirmDialog.debt.id);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal sliding from bottom */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          height: '90vh', // Slightly less than full height for better UX
          maxHeight: '90vh',
        }}
      >
        <div className="bg-gray-900 h-full border-l border-t border-gray-700 rounded-tl-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">
              Personalized Debt Payoff Strategy
            </h2>
            <Button 
              onClick={onClose}
              variant="ghost" 
              size="icon"
              className="text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start px-6 bg-gray-800 border-b border-gray-700 rounded-none flex-shrink-0">
              <TabsTrigger 
                value="strategy" 
                className="data-[state=active]:bg-primary data-[state=active]:text-white text-gray-300 hover:text-white transition-colors"
              >
                Strategy Overview
              </TabsTrigger>
              <TabsTrigger 
                value="scenarios" 
                className="data-[state=active]:bg-primary data-[state=active]:text-white text-gray-300 hover:text-white transition-colors flex items-center"
              >
                <Calculator className="w-4 h-4 mr-2" />
                What-If Scenarios
              </TabsTrigger>
            </TabsList>

            {/* Tab Contents */}
            <TabsContent value="strategy" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
              <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                <div className="space-y-6">
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Hybrid Strategy (Snowball + Avalanche)
                    </h3>
                    <p className="text-gray-400">
                      This personalized strategy combines the psychological wins of the snowball method 
                      with the mathematical efficiency of the avalanche method.
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 flex flex-col" style={{ maxHeight: '400px' }}>
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Your Payoff Order
                    </h3>
                    <div className="space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800" style={{ maxHeight: '320px' }}>
                      {sortedDebts.map((debt, index) => {
                        const balance = typeof debt.currentBalance === 'string' 
                          ? parseFloat(debt.currentBalance) 
                          : debt.currentBalance;
                        const rate = typeof debt.annualInterestRate === 'string'
                          ? parseFloat(debt.annualInterestRate)
                          : debt.annualInterestRate;
                        
                        return (
                          <div key={debt.id} className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                            <Checkbox
                              id={`debt-${debt.id}`}
                              className="border-gray-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                              onCheckedChange={(checked) => handleCheckboxChange(debt, checked as boolean)}
                            />
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 text-white font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-white">{debt.debtName}</p>
                                {index === 0 && (
                                  <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                                    <Trophy className="w-3 h-3 mr-1" />
                                    Quick Win
                                  </Badge>
                                )}
                                {index > 0 && (
                                  <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    High Interest
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-400">
                                {formatCurrency(balance)} at {rate}% APR
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs">
                                {(() => {
                                  const timeline = calculatePayoffTimeline(debt);
                                  if (timeline.months === Infinity) {
                                    return (
                                      <span className="text-red-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Payment too low to cover interest
                                      </span>
                                    );
                                  }
                                  return (
                                    <>
                                      <span className="text-blue-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {timeline.months} months
                                      </span>
                                      <span className="text-gray-500 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {timeline.payoffDate?.toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          year: 'numeric' 
                                        })}
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scenarios" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
              <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                <ScenarioPlanner 
                  debts={debts} 
                  activePlan={activePlan}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !markAsPaidMutation.isPending && setConfirmDialog({ isOpen: open, debt: null })}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Confirm Debt Paid Off
            </DialogTitle>
            <DialogDescription className="text-gray-400 mt-2">
              {confirmDialog.debt && (
                <>
                  Has <span className="text-white font-semibold">{confirmDialog.debt.debtName}</span> been fully paid off?
                  <div className="mt-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-sm">
                      Balance: {formatCurrency(
                        typeof confirmDialog.debt.currentBalance === 'string' 
                          ? parseFloat(confirmDialog.debt.currentBalance) 
                          : confirmDialog.debt.currentBalance
                      )}
                    </p>
                  </div>
                  <div className="mt-3 p-3 bg-yellow-900/20 rounded-lg border border-yellow-600/30">
                    <p className="text-sm text-yellow-400">
                      ⚠️ This action will:
                    </p>
                    <ul className="text-xs text-gray-400 mt-2 space-y-1 ml-4">
                      <li>• Remove this debt from your debt management center</li>
                      <li>• Update your financial profile</li>
                      <li>• Remove it from your intake form data</li>
                      <li>• This action cannot be undone</li>
                    </ul>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ isOpen: false, debt: null })}
              disabled={markAsPaidMutation.isPending}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPaidOff}
              disabled={markAsPaidMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {markAsPaidMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Yes, Mark as Paid Off
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}