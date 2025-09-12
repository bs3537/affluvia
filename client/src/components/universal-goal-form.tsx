import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from 'sonner';
import {
  Home,
  Building2,
  Briefcase,
  CreditCard,
  Sparkles,
  Calculator,
  DollarSign,
  Calendar,
  TrendingUp,
  PiggyBank,
  AlertCircle,
  Info
} from "lucide-react";

interface GoalData {
  id?: number;
  goalName?: string;
  description?: string;
  targetDate?: string;
  targetAmount?: number;
  currentAmount?: number;
  monthlyContribution?: number;
  fundingPercentage?: number;
  priority?: 'high' | 'medium' | 'low';
  status?: 'on-track' | 'at-risk' | 'behind' | 'completed';
  metadata?: Record<string, unknown>;
}

interface UniversalGoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalType: string;
  initialGoal?: GoalData;
}

interface FundingSource {
  type: string;
  amount: number;
  frequency: 'monthly' | 'annual' | 'one-time';
}

interface GoalTypeConfig {
  label: string;
  icon: React.ElementType;
  fields: string[];
  defaults: {
    purchasePrice?: number;
    downPaymentPercent?: number;
    closingCosts?: number;
    renovationCosts?: number;
    totalDebt?: number;
    startupCosts?: number;
    workingCapital?: number;
    equipmentCosts?: number;
    targetAmount?: number;
    expectedReturn: number;
    inflationRate: number;
  };
}

const goalTypeDefaults: Record<string, GoalTypeConfig> = {
  'home-purchase': {
    label: 'First Home Purchase',
    icon: Home,
    fields: ['purchasePrice', 'downPaymentPercent', 'closingCosts', 'targetDate'],
    defaults: {
      purchasePrice: 500000,
      downPaymentPercent: 20,
      closingCosts: 15000,
      expectedReturn: 5,
      inflationRate: 3
    }
  },
  'investment-property': {
    label: 'Investment Property',
    icon: Building2,
    fields: ['purchasePrice', 'downPaymentPercent', 'closingCosts', 'renovationCosts', 'targetDate'],
    defaults: {
      purchasePrice: 400000,
      downPaymentPercent: 25,
      closingCosts: 12000,
      renovationCosts: 20000,
      expectedReturn: 6,
      inflationRate: 3
    }
  },
  'debt-free': {
    label: 'Debt Freedom',
    icon: CreditCard,
    fields: ['totalDebt', 'monthlyPayment', 'targetDate'],
    defaults: {
      totalDebt: 50000,
      monthlyPayment: 1500,
      expectedReturn: 0,
      inflationRate: 0
    }
  },
  'business': {
    label: 'Start a Business',
    icon: Briefcase,
    fields: ['startupCosts', 'workingCapital', 'equipmentCosts', 'targetDate'],
    defaults: {
      startupCosts: 100000,
      workingCapital: 50000,
      equipmentCosts: 25000,
      expectedReturn: 7,
      inflationRate: 3
    }
  },
  'custom': {
    label: 'Custom Goal',
    icon: Sparkles,
    fields: ['goalName', 'description', 'targetAmount', 'targetDate'],
    defaults: {
      targetAmount: 50000,
      expectedReturn: 6,
      inflationRate: 3
    }
  }
};

export function UniversalGoalFormModal({
  isOpen,
  onClose,
  goalType,
  initialGoal
}: UniversalGoalFormModalProps) {
  const queryClient = useQueryClient();
  const config = goalTypeDefaults[goalType] || goalTypeDefaults.custom;
  const Icon = config.icon;

  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    goalName: '',
    description: '',
    targetDate: '',
    priority: 'medium',
    
    // Financial fields
    purchasePrice: config.defaults.purchasePrice || 0,
    downPaymentPercent: config.defaults.downPaymentPercent || 20,
    closingCosts: config.defaults.closingCosts || 0,
    renovationCosts: config.defaults.renovationCosts || 0,
    totalDebt: config.defaults.totalDebt || 0,
    startupCosts: config.defaults.startupCosts || 0,
    workingCapital: config.defaults.workingCapital || 0,
    equipmentCosts: config.defaults.equipmentCosts || 0,
    targetAmount: config.defaults.targetAmount || 0,
    
    // Savings & contributions
    currentSavings: 0,
    monthlyContribution: 0,
    
    // Projection settings
    expectedReturn: config.defaults.expectedReturn || 6,
    inflationRate: config.defaults.inflationRate || 3,
    
    // Funding sources
    fundingSources: [] as FundingSource[]
  });

  interface ProjectionResult {
    targetAmount: number;
    projectedAmount: number;
    fundingPercentage: number;
    shortfall: number;
    requiredMonthly: number;
    monthsToGoal: number;
    currentMonthly: number;
  }
  
  const [projectionResult, setProjectionResult] = useState<ProjectionResult | null>(null);

  useEffect(() => {
    if (initialGoal) {
      setFormData({
        ...formData,
        ...initialGoal,
        ...initialGoal.metadata
      });
    } else {
      // Set default goal name based on type
      setFormData(prev => ({
        ...prev,
        goalName: goalType === 'custom' ? '' : config.label
      }));
    }
  }, [initialGoal, goalType]);

  // Calculate target amount based on goal type
  const calculateTargetAmount = () => {
    switch (goalType) {
      case 'home-purchase':
      case 'investment-property':
        const downPayment = (formData.purchasePrice * formData.downPaymentPercent) / 100;
        return downPayment + formData.closingCosts + (formData.renovationCosts || 0);
      
      case 'debt-free':
        return formData.totalDebt;
      
      case 'business':
        return formData.startupCosts + formData.workingCapital + formData.equipmentCosts;
      
      case 'custom':
      default:
        return formData.targetAmount;
    }
  };

  // Calculate projection
  const calculateProjection = () => {
    const targetAmount = calculateTargetAmount();
    const monthsToGoal = formData.targetDate ? 
      Math.max(1, Math.ceil((new Date(formData.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))) : 
      60;
    
    const monthlyReturn = formData.expectedReturn / 100 / 12;
    const inflationRate = formData.inflationRate / 100;
    const adjustedTarget = targetAmount * Math.pow(1 + inflationRate, monthsToGoal / 12);
    
    // Calculate future value of current savings
    const futureValueCurrent = formData.currentSavings * Math.pow(1 + monthlyReturn, monthsToGoal);
    
    // Calculate future value of monthly contributions
    const futureValueMonthly = monthlyReturn > 0 ?
      formData.monthlyContribution * ((Math.pow(1 + monthlyReturn, monthsToGoal) - 1) / monthlyReturn) :
      formData.monthlyContribution * monthsToGoal;
    
    // Add funding sources
    const additionalFunding = formData.fundingSources.reduce((sum, source) => {
      if (source.frequency === 'monthly') {
        const fv = monthlyReturn > 0 ?
          source.amount * ((Math.pow(1 + monthlyReturn, monthsToGoal) - 1) / monthlyReturn) :
          source.amount * monthsToGoal;
        return sum + fv;
      } else if (source.frequency === 'annual') {
        const annualContributions = Math.floor(monthsToGoal / 12);
        return sum + (source.amount * annualContributions * Math.pow(1 + monthlyReturn, monthsToGoal / 2));
      } else {
        return sum + source.amount;
      }
    }, 0);
    
    const totalProjected = futureValueCurrent + futureValueMonthly + additionalFunding;
    const fundingPercentage = (totalProjected / adjustedTarget) * 100;
    const shortfall = Math.max(0, adjustedTarget - totalProjected);
    
    // Calculate required monthly contribution for 100% funding
    const requiredMonthly = monthlyReturn > 0 ?
      (adjustedTarget - futureValueCurrent - additionalFunding) / ((Math.pow(1 + monthlyReturn, monthsToGoal) - 1) / monthlyReturn) :
      (adjustedTarget - futureValueCurrent - additionalFunding) / monthsToGoal;
    
    setProjectionResult({
      targetAmount: adjustedTarget,
      projectedAmount: totalProjected,
      fundingPercentage: Math.min(100, fundingPercentage),
      shortfall,
      requiredMonthly: Math.max(0, requiredMonthly),
      monthsToGoal,
      currentMonthly: formData.monthlyContribution
    });
  };

  useEffect(() => {
    if (formData.targetDate && (calculateTargetAmount() > 0)) {
      calculateProjection();
    }
  }, [
    formData.purchasePrice,
    formData.downPaymentPercent,
    formData.closingCosts,
    formData.renovationCosts,
    formData.totalDebt,
    formData.startupCosts,
    formData.workingCapital,
    formData.equipmentCosts,
    formData.targetAmount,
    formData.currentSavings,
    formData.monthlyContribution,
    formData.targetDate,
    formData.expectedReturn,
    formData.inflationRate,
    formData.fundingSources
  ]);

  // Save goal mutation
  const saveGoalMutation = useMutation({
    mutationFn: async (data: GoalData) => {
      const url = initialGoal?.id && typeof initialGoal.id === 'number' ? 
        `/api/life-goals/${initialGoal.id}` : '/api/life-goals';
      const method = initialGoal?.id && typeof initialGoal.id === 'number' ? 'PATCH' : 'POST';
      
      // Remove id field for POST requests
      const bodyData = method === 'POST' ? 
        { ...data, id: undefined } : 
        data;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      
      if (!response.ok) throw new Error('Failed to save goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/life-goals'] });
      toast.success('Goal saved successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to save goal');
    },
  });

  const validateForm = (): boolean => {
    const errors: string[] = [];
    
    if (!formData.goalName || formData.goalName.trim().length === 0) {
      errors.push('Goal name is required');
    }
    
    if (!formData.targetDate) {
      errors.push('Target date is required');
    } else {
      const targetDate = new Date(formData.targetDate);
      if (targetDate <= new Date()) {
        errors.push('Target date must be in the future');
      }
    }
    
    const targetAmount = calculateTargetAmount();
    if (targetAmount <= 0) {
      errors.push('Target amount must be greater than zero');
    }
    
    if (formData.monthlyContribution < 0) {
      errors.push('Monthly contribution cannot be negative');
    }
    
    if (formData.currentSavings < 0) {
      errors.push('Current savings cannot be negative');
    }
    
    if (formData.expectedReturn < 0 || formData.expectedReturn > 30) {
      errors.push('Expected return must be between 0% and 30%');
    }
    
    if (formData.inflationRate < 0 || formData.inflationRate > 20) {
      errors.push('Inflation rate must be between 0% and 20%');
    }
    
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error));
      return false;
    }
    
    return true;
  };
  
  const handleSave = () => {
    if (!validateForm()) {
      return;
    }
    
    const targetAmount = calculateTargetAmount();
    
    const goalData = {
      goalType,
      goalName: formData.goalName,
      description: formData.description,
      targetDate: formData.targetDate,
      targetAmount,
      currentAmount: formData.currentSavings,
      monthlyContribution: formData.monthlyContribution,
      fundingPercentage: projectionResult?.fundingPercentage || 0,
      priority: formData.priority,
      status: projectionResult?.fundingPercentage >= 80 ? 'on-track' : 
              projectionResult?.fundingPercentage >= 60 ? 'at-risk' : 'behind',
      metadata: {
        ...formData,
        projection: projectionResult
      }
    };
    
    saveGoalMutation.mutate(goalData);
  };

  const addFundingSource = () => {
    setFormData(prev => ({
      ...prev,
      fundingSources: [
        ...prev.fundingSources,
        { type: 'savings', amount: 0, frequency: 'monthly' }
      ]
    }));
  };

  const removeFundingSource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fundingSources: prev.fundingSources.filter((_, i) => i !== index)
    }));
  };

  const updateFundingSource = (index: number, field: keyof FundingSource, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      fundingSources: prev.fundingSources.map((source, i) => 
        i === index ? { ...source, [field]: value } : source
      )
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {initialGoal ? `Edit ${config.label}` : `Add ${config.label}`}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-gray-800">
            <TabsTrigger value="basic" className="text-white data-[state=active]:bg-primary data-[state=active]:text-white">Basic Info</TabsTrigger>
            <TabsTrigger value="financial" className="text-white data-[state=active]:bg-primary data-[state=active]:text-white">Financial Details</TabsTrigger>
            <TabsTrigger value="funding" className="text-white data-[state=active]:bg-primary data-[state=active]:text-white">Funding Sources</TabsTrigger>
            <TabsTrigger value="projection" className="text-white data-[state=active]:bg-primary data-[state=active]:text-white">Projection</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goalName">Goal Name</Label>
              <Input
                id="goalName"
                value={formData.goalName}
                onChange={(e) => setFormData({ ...formData, goalName: e.target.value })}
                placeholder={goalType === 'custom' ? "Enter your goal name" : config.label}
              />
            </div>

            {goalType === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your goal..."
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="targetDate">Target Date</Label>
              <Input
                id="targetDate"
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            {(goalType === 'home-purchase' || goalType === 'investment-property') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice">Purchase Price</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="downPaymentPercent">Down Payment (%)</Label>
                  <Input
                    id="downPaymentPercent"
                    type="number"
                    value={formData.downPaymentPercent}
                    onChange={(e) => setFormData({ ...formData, downPaymentPercent: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="100"
                  />
                  <p className="text-sm text-gray-400">
                    Amount: ${((formData.purchasePrice * formData.downPaymentPercent) / 100).toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="closingCosts">Closing Costs</Label>
                  <Input
                    id="closingCosts"
                    type="number"
                    value={formData.closingCosts}
                    onChange={(e) => setFormData({ ...formData, closingCosts: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {goalType === 'investment-property' && (
                  <div className="space-y-2">
                    <Label htmlFor="renovationCosts">Renovation Costs</Label>
                    <Input
                      id="renovationCosts"
                      type="number"
                      value={formData.renovationCosts}
                      onChange={(e) => setFormData({ ...formData, renovationCosts: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </>
            )}

            {goalType === 'debt-free' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="totalDebt">Total Debt Amount</Label>
                  <Input
                    id="totalDebt"
                    type="number"
                    value={formData.totalDebt}
                    onChange={(e) => setFormData({ ...formData, totalDebt: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Track your debt payoff journey. Consider linking to the Debt Management Center for detailed strategies.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {goalType === 'business' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="startupCosts">Startup Costs</Label>
                  <Input
                    id="startupCosts"
                    type="number"
                    value={formData.startupCosts}
                    onChange={(e) => setFormData({ ...formData, startupCosts: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workingCapital">Working Capital</Label>
                  <Input
                    id="workingCapital"
                    type="number"
                    value={formData.workingCapital}
                    onChange={(e) => setFormData({ ...formData, workingCapital: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="equipmentCosts">Equipment & Setup Costs</Label>
                  <Input
                    id="equipmentCosts"
                    type="number"
                    value={formData.equipmentCosts}
                    onChange={(e) => setFormData({ ...formData, equipmentCosts: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}

            {goalType === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="targetAmount">Target Amount</Label>
                <Input
                  id="targetAmount"
                  type="number"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentSavings">Current Savings</Label>
                <Input
                  id="currentSavings"
                  type="number"
                  value={formData.currentSavings}
                  onChange={(e) => setFormData({ ...formData, currentSavings: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyContribution">Monthly Contribution</Label>
                <Input
                  id="monthlyContribution"
                  type="number"
                  value={formData.monthlyContribution}
                  onChange={(e) => setFormData({ ...formData, monthlyContribution: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expectedReturn">Expected Return (%)</Label>
                  <Input
                    id="expectedReturn"
                    type="number"
                    value={formData.expectedReturn}
                    onChange={(e) => setFormData({ ...formData, expectedReturn: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inflationRate">Inflation Rate (%)</Label>
                  <Input
                    id="inflationRate"
                    type="number"
                    value={formData.inflationRate}
                    onChange={(e) => setFormData({ ...formData, inflationRate: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="10"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="funding" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Additional Funding Sources</h3>
              <Button size="sm" onClick={addFundingSource}>
                Add Source
              </Button>
            </div>

            {formData.fundingSources.map((source, index) => (
              <Card key={index} className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select 
                      value={source.type}
                      onValueChange={(value) => updateFundingSource(index, 'type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="savings">Savings Account</SelectItem>
                        <SelectItem value="investment">Investment Account</SelectItem>
                        <SelectItem value="gift">Gift/Inheritance</SelectItem>
                        <SelectItem value="bonus">Work Bonus</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={source.amount}
                      onChange={(e) => updateFundingSource(index, 'amount', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={source.frequency}
                        onValueChange={(value) => updateFundingSource(index, 'frequency', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="one-time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeFundingSource(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {formData.fundingSources.length === 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Add additional funding sources beyond your regular monthly contribution to boost your goal progress.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="projection" className="space-y-4">
            {projectionResult ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Funding Projection
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400">Target Amount (inflation-adjusted)</p>
                        <p className="text-xl font-semibold">
                          ${projectionResult.targetAmount.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400">Projected Amount</p>
                        <p className="text-xl font-semibold">
                          ${projectionResult.projectedAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Funding Coverage</span>
                        <span className={`font-semibold ${
                          projectionResult.fundingPercentage >= 80 ? 'text-green-500' :
                          projectionResult.fundingPercentage >= 60 ? 'text-yellow-500' :
                          'text-red-500'
                        }`}>
                          {projectionResult.fundingPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            projectionResult.fundingPercentage >= 80 ? 'bg-green-500' :
                            projectionResult.fundingPercentage >= 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, projectionResult.fundingPercentage)}%` }}
                        />
                      </div>
                    </div>

                    {projectionResult.shortfall > 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-semibold mb-2">Funding Gap: ${projectionResult.shortfall.toLocaleString()}</p>
                          <p>To reach 100% funding, you need to contribute ${projectionResult.requiredMonthly.toLocaleString()}/month</p>
                          <p className="mt-1 text-sm">Current contribution: ${projectionResult.currentMonthly.toLocaleString()}/month</p>
                        </AlertDescription>
                      </Alert>
                    )}

                    {projectionResult.fundingPercentage >= 100 && (
                      <Alert className="border-green-500 bg-green-500/10">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-400">
                          Great! You're on track to exceed your goal with current contributions.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Goal Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-400">Time to Goal</p>
                        <p className="text-lg font-semibold">
                          {Math.floor(projectionResult.monthsToGoal / 12)} years, {projectionResult.monthsToGoal % 12} months
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Target Date</p>
                        <p className="text-lg font-semibold">
                          {new Date(formData.targetDate).toLocaleDateString('en-US', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Complete the financial details and set a target date to see your funding projection.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-center gap-2 pt-4 pb-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveGoalMutation.isPending}>
            {saveGoalMutation.isPending ? 'Saving...' : 'Save Goal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}