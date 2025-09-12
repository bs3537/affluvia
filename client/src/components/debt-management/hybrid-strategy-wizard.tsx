import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  TrendingDown,
  TrendingUp,
  DollarSign,
  Target,
  Trophy,
  Calendar,
  Info,
  ChevronRight,
  Sparkles,
  Zap,
  Mountain,
  Snowflake,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Calculator,
  PiggyBank,
  Play,
  Settings,
  LineChart,
  BarChart3,
  HelpCircle,
  ExternalLink,
  X
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

interface Debt {
  id: number;
  debtName: string;
  debtType: string;
  currentBalance: number;
  annualInterestRate: number;
  minimumPayment: number;
  paymentDueDate?: number;
  isPromotionalRate?: boolean;
  promotionalRate?: number;
  promotionalRateEndDate?: string;
  status?: string;
}

interface PayoffProjection {
  strategy: 'hybrid' | 'snowball' | 'avalanche';
  monthsToPayoff: number;
  totalInterestPaid: number;
  payoffDate: string;
  monthlySchedule: MonthlyPayment[];
  debtOrder: number[];
  switchPoint?: number; // Month when hybrid switches from snowball to avalanche
}

interface MonthlyPayment {
  month: number;
  targetDebt: number;
  payment: number;
  remainingBalance: number;
  interestPaid: number;
  principalPaid: number;
  paidOffDebts: number[];
}

interface HybridConfig {
  quickWinCount: number;
  switchTrigger: 'afterWins' | 'afterMonths' | 'whenInterestSaved';
  switchValue: number;
  excludeTypes: string[];
  extraMonthlyPayment: number;
  startDate: Date;
  maintainEmergencyFund: boolean;
  emergencyFundTarget: number;
}

export function HybridStrategyWizard({ debts, onClose }: { debts: Debt[], onClose?: () => void }) {
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [currentStep, setCurrentStep] = useState(1);
  const [isOpen, setIsOpen] = useState(true);
  
  // Hybrid strategy configuration
  const [config, setConfig] = useState<HybridConfig>({
    quickWinCount: 1,
    switchTrigger: 'afterWins',
    switchValue: 1,
    excludeTypes: ['mortgage', 'auto'],
    extraMonthlyPayment: 0,
    startDate: new Date(),
    maintainEmergencyFund: true,
    emergencyFundTarget: 1000
  });

  // Projections for all three strategies
  const [projections, setProjections] = useState<{
    hybrid?: PayoffProjection;
    snowball?: PayoffProjection;
    avalanche?: PayoffProjection;
  }>({});

  const [selectedComparison, setSelectedComparison] = useState<'hybrid' | 'snowball' | 'avalanche'>('hybrid');
  const [isSimulating, setIsSimulating] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);

  // Filter out excluded debt types
  const eligibleDebts = useMemo(() => {
    return debts.filter(d => !config.excludeTypes.includes(d.debtType.toLowerCase()));
  }, [debts, config.excludeTypes]);

  // Calculate total minimum payments
  const totalMinimumPayment = useMemo(() => {
    return eligibleDebts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  }, [eligibleDebts]);

  // Simulate payoff projections
  const simulateProjections = useMutation({
    mutationFn: async (config: HybridConfig) => {
      const response = await fetch('/api/debts/simulate-strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debts: eligibleDebts,
          config
        })
      });
      if (!response.ok) throw new Error('Failed to simulate strategies');
      return response.json();
    },
    onSuccess: (data) => {
      setProjections(data);
    }
  });

  // Auto-simulate when config changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (eligibleDebts.length > 0) {
        simulateProjections.mutate(config);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [config, eligibleDebts]);

  // Save strategy
  const saveStrategy = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/debts/save-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'hybrid',
          config,
          projection: projections.hybrid,
          autoPayEnabled
        })
      });
      if (!response.ok) throw new Error('Failed to save strategy');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-strategy'] });
      if (onClose) onClose();
    }
  });

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <QuickWinsStep config={config} setConfig={setConfig} debts={eligibleDebts} />;
      case 2:
        return <BudgetSwitchStep config={config} setConfig={setConfig} totalMinimum={totalMinimumPayment} />;
      case 3:
        return <PlanPreviewStep projections={projections} config={config} debts={eligibleDebts} selectedComparison={selectedComparison} setSelectedComparison={setSelectedComparison} />;
      case 4:
        return <AutomateCommitStep config={config} autoPayEnabled={autoPayEnabled} setAutoPayEnabled={setAutoPayEnabled} projection={projections.hybrid} />;
      default:
        return null;
    }
  };

  const stepTitles = ['Quick Wins', 'Budget & Switch', 'Plan Preview', 'Automate & Track'];

  // Mobile-responsive drawer/modal
  const content = (
    <div className="flex flex-col h-full">
      {/* Header with stepper */}
      <div className="border-b p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Hybrid Payoff Strategy</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Build momentum with quick wins, then optimize for interest savings
            </p>
          </div>
          {isMobile && onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Stepper */}
        <div className="flex items-center justify-between">
          {stepTitles.map((title, index) => (
            <div key={index} className="flex items-center flex-1">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                currentStep > index + 1 ? "bg-primary text-primary-foreground" :
                currentStep === index + 1 ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" :
                "bg-muted text-muted-foreground"
              )}>
                {currentStep > index + 1 ? <CheckCircle className="h-4 w-4" /> : index + 1}
              </div>
              {index < stepTitles.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2",
                  currentStep > index + 1 ? "bg-primary" : "bg-muted"
                )} />
              )}
              {!isMobile && (
                <span className={cn(
                  "text-xs ml-2 hidden sm:inline",
                  currentStep === index + 1 ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {title}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {renderStepContent()}
      </div>

      {/* Footer with navigation */}
      <div className="border-t p-4 sm:p-6">
        <div className="flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            Previous
          </Button>
          
          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={simulateProjections.isPending}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => saveStrategy.mutate()}
              disabled={saveStrategy.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {saveStrategy.isPending ? (
                <>Saving...</>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Activate Strategy
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Use Sheet for mobile, Dialog for desktop
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 flex flex-col">
        {content}
      </DialogContent>
    </Dialog>
  );
}

// Step 1: Quick Wins Configuration
function QuickWinsStep({ config, setConfig, debts }: any) {
  const sortedByBalance = [...debts].sort((a, b) => a.currentBalance - b.currentBalance);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Your Quick Wins</h3>
        <p className="text-sm text-muted-foreground">
          Research shows that paying off small debts first builds momentum and increases success rates.
        </p>
      </div>

      {/* Quick win count slider */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Number of Quick Wins</Label>
          <Badge variant="secondary">{config.quickWinCount} {config.quickWinCount === 1 ? 'debt' : 'debts'}</Badge>
        </div>
        <Slider
          value={[config.quickWinCount]}
          onValueChange={([value]) => setConfig({ ...config, quickWinCount: value })}
          min={0}
          max={Math.min(3, debts.length)}
          step={1}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          We recommend 1-2 quick wins for optimal balance between motivation and interest savings
        </p>
      </div>

      {/* Preview of debt order */}
      <div className="space-y-3">
        <Label>Your Payoff Order Preview</Label>
        <div className="space-y-2">
          {sortedByBalance.slice(0, config.quickWinCount).map((debt, index) => (
            <Card key={debt.id} className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-green-500/10 text-green-600">
                      <Trophy className="h-3 w-3 mr-1" />
                      Quick Win {index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{debt.debtName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(debt.currentBalance)} at {debt.annualInterestRate}%
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {debt.debtType}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {sortedByBalance.slice(config.quickWinCount).length > 0 && (
            <>
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">Then switch to highest interest</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              
              {sortedByBalance
                .slice(config.quickWinCount)
                .sort((a, b) => b.annualInterestRate - a.annualInterestRate)
                .slice(0, 2)
                .map((debt) => (
                  <Card key={debt.id} className="opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">
                            <Mountain className="h-3 w-3 mr-1" />
                            Avalanche
                          </Badge>
                          <div>
                            <p className="font-medium">{debt.debtName}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(debt.currentBalance)} at {debt.annualInterestRate}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </>
          )}
        </div>
      </div>

      {/* Exclude certain debt types */}
      <div className="space-y-3">
        <Label>Exclude from aggressive payoff</Label>
        <div className="space-y-2">
          {['mortgage', 'auto', 'student'].map(type => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                checked={config.excludeTypes.includes(type)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setConfig({ ...config, excludeTypes: [...config.excludeTypes, type] });
                  } else {
                    setConfig({ ...config, excludeTypes: config.excludeTypes.filter(t => t !== type) });
                  }
                }}
              />
              <Label className="capitalize">{type} loans</Label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Low-interest secured debts are often better paid on schedule
        </p>
      </div>
    </div>
  );
}

// Step 2: Budget and Switch Configuration
function BudgetSwitchStep({ config, setConfig, totalMinimum }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Set Your Budget & Switch Point</h3>
        <p className="text-sm text-muted-foreground">
          Determine how much extra you can pay monthly and when to switch strategies
        </p>
      </div>

      {/* Extra monthly payment */}
      <div className="space-y-4">
        <Label>Extra Monthly Payment</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              value={config.extraMonthlyPayment}
              onChange={(e) => setConfig({ ...config, extraMonthlyPayment: parseFloat(e.target.value) || 0 })}
              className="pl-10"
              placeholder="0"
            />
          </div>
          <Button variant="outline" size="icon">
            <Calculator className="h-4 w-4" />
          </Button>
        </div>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your total monthly payment will be {formatCurrency(totalMinimum + config.extraMonthlyPayment)}
            ({formatCurrency(totalMinimum)} minimum + {formatCurrency(config.extraMonthlyPayment)} extra)
          </AlertDescription>
        </Alert>

        {/* Budget finder suggestions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="justify-start">
            <PiggyBank className="h-4 w-4 mr-2" />
            Find savings in budget
          </Button>
          <Button variant="outline" size="sm" className="justify-start">
            <TrendingUp className="h-4 w-4 mr-2" />
            Increase income ideas
          </Button>
        </div>
      </div>

      {/* Switch trigger configuration */}
      <div className="space-y-4">
        <Label>When to switch from quick wins to avalanche?</Label>
        <Select value={config.switchTrigger} onValueChange={(value: any) => setConfig({ ...config, switchTrigger: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="afterWins">After completing quick wins</SelectItem>
            <SelectItem value="afterMonths">After specific time period</SelectItem>
            <SelectItem value="whenInterestSaved">When interest savings reach target</SelectItem>
          </SelectContent>
        </Select>

        {config.switchTrigger === 'afterMonths' && (
          <div className="flex items-center gap-2">
            <Label>Switch after</Label>
            <Input
              type="number"
              value={config.switchValue}
              onChange={(e) => setConfig({ ...config, switchValue: parseInt(e.target.value) || 3 })}
              className="w-20"
            />
            <span className="text-sm">months</span>
          </div>
        )}

        {config.switchTrigger === 'whenInterestSaved' && (
          <div className="flex items-center gap-2">
            <Label>Switch when monthly interest saved reaches</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={config.switchValue}
                onChange={(e) => setConfig({ ...config, switchValue: parseFloat(e.target.value) || 50 })}
                className="pl-10 w-32"
              />
            </div>
          </div>
        )}
      </div>

      {/* Emergency fund guardrail */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={config.maintainEmergencyFund}
            onCheckedChange={(checked) => setConfig({ ...config, maintainEmergencyFund: checked })}
          />
          <Label>Maintain emergency fund buffer</Label>
        </div>
        
        {config.maintainEmergencyFund && (
          <div className="flex items-center gap-2 ml-6">
            <Label>Keep at least</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={config.emergencyFundTarget}
                onChange={(e) => setConfig({ ...config, emergencyFundTarget: parseFloat(e.target.value) || 1000 })}
                className="pl-10 w-32"
              />
            </div>
            <span className="text-sm">in savings</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Step 3: Plan Preview with Comparisons
function PlanPreviewStep({ projections, config, debts, selectedComparison, setSelectedComparison }: any) {
  const comparison = projections[selectedComparison];
  const hybrid = projections.hybrid;
  
  if (!comparison || !hybrid) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Calculating projections...</p>
        </div>
      </div>
    );
  }

  const savingsVsSnowball = hybrid.totalInterestPaid - (projections.snowball?.totalInterestPaid || 0);
  const savingsVsAvalanche = hybrid.totalInterestPaid - (projections.avalanche?.totalInterestPaid || 0);
  const timeVsSnowball = hybrid.monthsToPayoff - (projections.snowball?.monthsToPayoff || 0);
  const timeVsAvalanche = hybrid.monthsToPayoff - (projections.avalanche?.monthsToPayoff || 0);

  return (
    <div className="space-y-6">
      {/* Strategy comparison tabs */}
      <Tabs value={selectedComparison} onValueChange={setSelectedComparison}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hybrid" className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Hybrid
          </TabsTrigger>
          <TabsTrigger value="snowball" className="flex items-center gap-1">
            <Snowflake className="h-3 w-3" />
            Snowball
          </TabsTrigger>
          <TabsTrigger value="avalanche" className="flex items-center gap-1">
            <Mountain className="h-3 w-3" />
            Avalanche
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedComparison} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Time to Freedom</span>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{comparison.monthsToPayoff} months</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(comparison.payoffDate).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Interest</span>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(comparison.totalInterestPaid)}</p>
                {selectedComparison === 'hybrid' && (
                  <p className="text-xs text-green-600 mt-1">
                    Saves {formatCurrency(Math.abs(savingsVsSnowball))} vs Snowball
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Strategy</span>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold capitalize">{selectedComparison}</p>
                {selectedComparison === 'hybrid' && hybrid.switchPoint && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Switches at month {hybrid.switchPoint}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payoff order */}
          <div>
            <h4 className="font-medium mb-3">Payoff Order</h4>
            <div className="space-y-2">
              {comparison.debtOrder.map((debtId, index) => {
                const debt = debts.find(d => d.id === debtId);
                if (!debt) return null;
                
                const isQuickWin = selectedComparison === 'hybrid' && index < config.quickWinCount;
                
                return (
                  <div key={debtId} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{debt.debtName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(debt.currentBalance)} at {debt.annualInterestRate}%
                      </p>
                    </div>
                    {isQuickWin && (
                      <Badge className="bg-green-500/10 text-green-600">
                        <Trophy className="h-3 w-3 mr-1" />
                        Quick Win
                      </Badge>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            {isQuickWin ? 
                              "Starting with small balances builds momentum and motivation (Harvard Business Review)" :
                              "High interest rate means more savings when paid off early (CFPB)"
                            }
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly payment timeline preview */}
          {comparison.monthlySchedule && comparison.monthlySchedule.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">First 6 Months Preview</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Month</th>
                      <th className="text-left p-2">Target Debt</th>
                      <th className="text-right p-2">Payment</th>
                      <th className="text-right p-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.monthlySchedule.slice(0, 6).map((month) => {
                      const targetDebt = debts.find(d => d.id === month.targetDebt);
                      return (
                        <tr key={month.month} className="border-b">
                          <td className="p-2">{month.month}</td>
                          <td className="p-2">{targetDebt?.debtName || 'Unknown'}</td>
                          <td className="text-right p-2">{formatCurrency(month.payment)}</td>
                          <td className="text-right p-2">{formatCurrency(month.remainingBalance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Explainability section */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Why Hybrid?</strong> Research from Northwestern's Kellogg School shows that 
          "small wins" increase debt payoff completion rates. Our hybrid approach gives you 
          {config.quickWinCount} quick {config.quickWinCount === 1 ? 'win' : 'wins'} for motivation, 
          then switches to the avalanche method to minimize interest costs.
          <a href="#" className="text-primary underline ml-1">Learn more</a>
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Step 4: Automate and Commit
function AutomateCommitStep({ config, autoPayEnabled, setAutoPayEnabled, projection }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Automate Your Success</h3>
        <p className="text-sm text-muted-foreground">
          Set up automation to ensure you stick to your plan
        </p>
      </div>

      {/* Automation options */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                checked={autoPayEnabled}
                onCheckedChange={setAutoPayEnabled}
              />
              <div className="flex-1">
                <Label className="text-base">Enable Auto-Execute</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically schedule extra payments to your target debt each month
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Checkbox />
              <div className="flex-1">
                <Label className="text-base">Due Date Alignment</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Optimize payment timing to reduce interest charges
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Checkbox defaultChecked />
              <div className="flex-1">
                <Label className="text-base">Progress Notifications</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Get alerts for milestones and when debts are paid off
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestones preview */}
      <div>
        <h4 className="font-medium mb-3">Your Journey Milestones</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10">
              <Trophy className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">First Quick Win</p>
              <p className="text-sm text-muted-foreground">
                Complete in ~{Math.ceil((projection?.monthlySchedule?.[0]?.remainingBalance || 0) / (config.extraMonthlyPayment + 100))} months
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium">Switch to Avalanche</p>
              <p className="text-sm text-muted-foreground">
                After {config.quickWinCount} {config.quickWinCount === 1 ? 'debt is' : 'debts are'} paid off
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10">
              <Target className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium">Debt Freedom</p>
              <p className="text-sm text-muted-foreground">
                Achieve in {projection?.monthsToPayoff || 0} months
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What-if scenarios link */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Want to explore other scenarios?</p>
              <p className="text-sm text-muted-foreground">
                Try balance transfers, increased payments, or different strategies
              </p>
            </div>
            <Button variant="outline" size="sm">
              <LineChart className="h-4 w-4 mr-2" />
              What-If Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}