import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Calculator,
  Target,
  Trophy,
  Calendar,
  FileText,
  Info,
  AlertCircle,
  CheckCircle,
  Loader2,
  Brain,
  PiggyBank,
  ChevronRight,
  Plus,
  Trash2,
  Edit,
  BarChart3,
  LineChart,
  Lightbulb,
  Snowflake,
  Mountain,
  Zap,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Database
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/utils";

// Sub-components (to be implemented)
import { DebtOverview } from "./debt-management/debt-overview";
import { DebtIntakeForm } from "./debt-management/debt-intake-form";
import { StrategyComparison } from "./debt-management/strategy-comparison";
import { AIInsights } from "./debt-management/ai-insights";
import { StrategiesNew } from "./debt-management/strategies-new";

interface Debt {
  id: number;
  debtName: string;
  debtType: string;
  currentBalance: number | string;
  annualInterestRate: number | string;
  minimumPayment: number | string;
  status: string;
  owner?: string;
  lender?: string;
  paymentDueDate?: number;
  notes?: string;
}

interface PayoffPlan {
  id: number;
  planName: string;
  strategy: string;
  payoffDate: string;
  totalInterestPaid: number;
  monthsToPayoff: number;
  isActive: boolean;
  debtOrder?: number[];
  payoffSchedule?: any;
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

export function DebtManagementCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedStrategy, setSelectedStrategy] = useState<"snowball" | "avalanche" | "hybrid">("snowball");
  const [extraMonthlyPayment, setExtraMonthlyPayment] = useState(0);
  const [hasSyncedOnce, setHasSyncedOnce] = useState(false);

  // Sync debts from intake form mutation
  const syncDebtsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/debts/sync-from-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        console.error("Sync error:", error);
        throw new Error(error.error || "Failed to sync debts");
      }
      const data = await response.json();
      console.log("Sync response:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("Sync successful:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      setHasSyncedOnce(true);
    },
    onError: (error) => {
      console.error("Sync failed:", error);
    },
  });

  // Clear all debts mutation
  const clearAllDebtsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/debts/clear-all", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to clear debts");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-payoff-plan/active"] });
      setHasSyncedOnce(false);
    },
  });

  // Fetch user's debts
  const { data: debts, isLoading: debtsLoading, isError: debtsError } = useQuery({
    queryKey: ["/api/debts"],
    enabled: !!user,
  });

  // Fetch active payoff plan
  const { data: activePlan, isLoading: planLoading } = useQuery({
    queryKey: ["/api/debt-payoff-plan/active"],
    enabled: !!user,
  });

  // Auto-sync on first load if no debts exist
  useEffect(() => {
    if (!debtsLoading && user && (!debts || debts.length === 0)) {
      console.log('Auto-syncing debts because no debts found');
      syncDebtsMutation.mutate();
    }
  }, [debtsLoading, user]); // Removed debts and hasSyncedOnce from dependencies to always sync when empty

  // Calculate debt summary
  const debtSummary: DebtSummary = debts ? {
    totalDebt: debts.reduce((sum: number, d: Debt) => sum + (typeof d.currentBalance === 'string' ? parseFloat(d.currentBalance) : d.currentBalance), 0),
    totalMinimumPayment: debts.reduce((sum: number, d: Debt) => sum + (typeof d.minimumPayment === 'string' ? parseFloat(d.minimumPayment) : d.minimumPayment), 0),
    averageInterestRate: debts.length > 0 
      ? debts.reduce((sum: number, d: Debt) => sum + (typeof d.annualInterestRate === 'string' ? parseFloat(d.annualInterestRate) : d.annualInterestRate), 0) / debts.length 
      : 0,
    highestInterestDebt: debts.reduce((highest: Debt | null, d: Debt) => {
      const rate = typeof d.annualInterestRate === 'string' ? parseFloat(d.annualInterestRate) : d.annualInterestRate;
      const highestRate = highest ? (typeof highest.annualInterestRate === 'string' ? parseFloat(highest.annualInterestRate) : highest.annualInterestRate) : 0;
      return !highest || rate > highestRate ? d : highest;
    }, null),
    lowestBalanceDebt: debts.reduce((lowest: Debt | null, d: Debt) => {
      const balance = typeof d.currentBalance === 'string' ? parseFloat(d.currentBalance) : d.currentBalance;
      const lowestBalance = lowest ? (typeof lowest.currentBalance === 'string' ? parseFloat(lowest.currentBalance) : lowest.currentBalance) : Infinity;
      return !lowest || balance < lowestBalance ? d : lowest;
    }, null),
    activeDebtsCount: debts.filter((d: Debt) => d.status === 'active').length,
    paidOffDebtsCount: debts.filter((d: Debt) => d.status === 'paid_off').length,
  } : {
    totalDebt: 0,
    totalMinimumPayment: 0,
    averageInterestRate: 0,
    highestInterestDebt: null,
    lowestBalanceDebt: null,
    activeDebtsCount: 0,
    paidOffDebtsCount: 0,
  };

  // Calculate strategies mutation
  const calculateStrategiesMutation = useMutation({
    mutationFn: async (data: { strategy: string; extraPayment: number }) => {
      const response = await fetch("/api/calculate-debt-strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to calculate strategies");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debt-payoff-plan"] });
    },
  });

  if (debtsLoading || planLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-primary" />
            Debt Management Center
          </h1>
          <p className="text-gray-400 mt-2">
            Take control of your debt and achieve financial freedom
          </p>
        </div>
        
      </div>

      {/* Alert for no debts */}
      {(!debts || debts.length === 0) && !syncDebtsMutation.isPending && (
        <Alert className="bg-blue-900/20 border-blue-800">
          <Info className="w-4 h-4 text-blue-400" />
          <AlertDescription className="text-gray-300">
            Welcome to your Debt Management Center! Your debts will be automatically synced from the intake form. 
            If you haven't completed the intake form yet, please do so to see your debts here.
          </AlertDescription>
        </Alert>
      )}

      {/* Success message after sync */}
      {syncDebtsMutation.isSuccess && syncDebtsMutation.data && (
        <Alert className="bg-green-900/20 border-green-800">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <AlertDescription className="text-gray-300">
            {syncDebtsMutation.data.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full bg-gray-800">
          <TabsTrigger value="overview" className="text-gray-300 data-[state=active]:bg-primary data-[state=active]:text-white">
            Overview
          </TabsTrigger>
          <TabsTrigger value="strategies-new" className="text-gray-300 data-[state=active]:bg-primary data-[state=active]:text-white">
            Strategies
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-gray-300 data-[state=active]:bg-primary data-[state=active]:text-white">
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <DebtOverview 
            debts={debts || []}
            summary={debtSummary}
            activePlan={activePlan}
            onNavigateToStrategies={() => setActiveTab("strategies-new")}
          />
        </TabsContent>

        {/* Strategies New Tab */}
        <TabsContent value="strategies-new" className="space-y-6">
          <StrategiesNew 
            totalDebt={debtSummary.totalDebt}
            monthlyPayment={debtSummary.totalMinimumPayment}
            debts={debts || []}
          />
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <AIInsights 
            debts={debts || []}
            summary={debtSummary}
            activePlan={activePlan}
          />
        </TabsContent>
      </Tabs>

    </div>
  );
}
