import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Info,
  Plus,
  Trash2,
  Wallet,
  Banknote,
  X
} from "lucide-react";

interface FundingSource {
  id: string;
  type: 'asset' | 'loan' | 'monthly_savings';
  name: string;
  amount: number;
  interestRate?: number; // For loans
  termMonths?: number; // For loans
  monthlyAmount?: number; // For monthly savings
}

interface GoalData {
  id?: number;
  goalType: string;
  goalName: string;
  description?: string;
  targetDate: string;
  targetAmount: number;
  currentAmount?: number;
  fundingSources: FundingSource[];
  fundingPercentage?: number;
  priority?: 'high' | 'medium' | 'low';
  status?: 'on-track' | 'at-risk' | 'behind' | 'completed';
  metadata?: Record<string, unknown>;
}

interface UniversalGoalFormEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  goalType: string;
  initialGoal?: GoalData;
}

export function UniversalGoalFormEnhanced({
  isOpen,
  onClose,
  goalType,
  initialGoal
}: UniversalGoalFormEnhancedProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('details');
  
  // Form state
  const [goalName, setGoalName] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([]);
  const [showLoanOptions, setShowLoanOptions] = useState(false);
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

  // Fetch financial profile to get liquid assets
  const { data: profile } = useQuery({
    queryKey: ['/api/financial-profile'],
    queryFn: async () => {
      const response = await fetch('/api/financial-profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    }
  });

  // Extract liquid assets from profile
  const liquidAssets = React.useMemo(() => {
    if (!profile) return [];
    
    const assets = [];
    
    // Parse assets from profile
    if (profile.assets && Array.isArray(profile.assets)) {
      profile.assets.forEach((asset: any) => {
        if (['checking', 'savings', 'taxable-brokerage', 'money-market'].includes(asset.type)) {
          const owner = asset.owner === 'user' ? 'Your' : 
                       asset.owner === 'spouse' ? "Spouse's" : 
                       'Joint';
          assets.push({
            id: `asset-${assets.length}`,
            name: `${owner} ${asset.description || asset.type}`,
            value: Number(asset.value) || 0,
            type: asset.type,
            owner: asset.owner
          });
        }
      });
    }
    
    return assets;
  }, [profile]);

  // Calculate funding coverage
  const fundingCoverage = React.useMemo(() => {
    const target = Number(targetAmount) || 0;
    if (target === 0) return 0;
    
    let totalFunding = 0;
    
    fundingSources.forEach(source => {
      if (source.type === 'asset') {
        totalFunding += source.amount;
      } else if (source.type === 'loan') {
        totalFunding += source.amount;
      } else if (source.type === 'monthly_savings' && targetDate) {
        const monthsToGoal = Math.max(0, 
          (new Date(targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        totalFunding += (source.monthlyAmount || 0) * monthsToGoal;
      }
    });
    
    return Math.min(100, (totalFunding / target) * 100);
  }, [fundingSources, targetAmount, targetDate]);

  // Add funding source
  const addFundingSource = (type: 'asset' | 'loan' | 'monthly_savings') => {
    const newSource: FundingSource = {
      id: `source-${Date.now()}`,
      type,
      name: type === 'loan' ? 'New Loan' : 
            type === 'monthly_savings' ? 'Monthly Savings' : 
            'Select Asset',
      amount: 0,
      interestRate: type === 'loan' ? 5 : undefined,
      termMonths: type === 'loan' ? 60 : undefined,
      monthlyAmount: type === 'monthly_savings' ? 500 : undefined
    };
    setFundingSources([...fundingSources, newSource]);
  };

  // Remove funding source
  const removeFundingSource = (id: string) => {
    setFundingSources(fundingSources.filter(s => s.id !== id));
  };

  // Update funding source
  const updateFundingSource = (id: string, updates: Partial<FundingSource>) => {
    setFundingSources(fundingSources.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  // Save goal mutation
  const saveGoalMutation = useMutation({
    mutationFn: async (data: GoalData) => {
      const url = data.id ? `/api/life-goals/${data.id}` : '/api/life-goals';
      const method = data.id ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Server response:', errorData);
        let errorMessage = 'Failed to save goal';
        
        try {
          const parsedError = JSON.parse(errorData);
          if (parsedError.details) {
            errorMessage = parsedError.details.map((d: any) => `${d.field}: ${d.message}`).join(', ');
          } else if (parsedError.error) {
            errorMessage = parsedError.error;
          }
        } catch (e) {
          // Use default error message
        }
        
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/life-goals'] });
      toast.success('Goal saved successfully');
      onClose();
    },
    onError: (error: Error) => {
      console.error('Save error:', error);
      toast.error(error.message || 'Failed to save goal');
    }
  });

  // Initialize form with existing goal data
  useEffect(() => {
    if (initialGoal) {
      setGoalName(initialGoal.goalName || '');
      setDescription(initialGoal.description || '');
      setTargetDate(initialGoal.targetDate || '');
      setTargetAmount(String(initialGoal.targetAmount || ''));
      setFundingSources(initialGoal.fundingSources || []);
      setPriority(initialGoal.priority || 'medium');
    } else {
      // Set default goal name based on type
      const defaultNames: Record<string, string> = {
        'home-purchase': 'First Home Purchase',
        'investment-property': 'Investment Property',
        'debt-free': 'Become Debt Free',
        'business': 'Start a Business',
        'custom': 'Custom Goal'
      };
      setGoalName(defaultNames[goalType] || 'New Goal');
    }
  }, [initialGoal, goalType]);

  const handleSave = () => {
    if (!goalName || !targetDate || !targetAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!fundingSources || fundingSources.length === 0) {
      toast.error('Please add at least one funding source');
      setActiveTab('funding');
      return;
    }

    const goalData: GoalData = {
      id: initialGoal?.id,
      goalType,
      goalName,
      description,
      targetDate,
      targetAmount: Number(targetAmount),
      fundingSources,
      fundingPercentage: fundingCoverage,
      priority,
      status: fundingCoverage >= 80 ? 'on-track' : 
              fundingCoverage >= 50 ? 'at-risk' : 'behind',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    saveGoalMutation.mutate(goalData);
  };

  const getGoalIcon = () => {
    const icons: Record<string, React.ElementType> = {
      'home-purchase': Home,
      'investment-property': Building2,
      'debt-free': CreditCard,
      'business': Briefcase,
      'custom': Sparkles
    };
    return icons[goalType] || Sparkles;
  };

  const Icon = getGoalIcon();

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) return; }}>
      <DrawerContent className="bg-gray-900 border-gray-800 text-white h-[90vh] mt-0 left-0 sm:left-16 md:left-64 right-0 overflow-y-auto">
        <DrawerHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-3 text-xl">
              <Icon className="h-6 w-6 text-primary" />
              {initialGoal ? 'Edit Goal' : 'Create New Goal'}
            </DrawerTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full text-gray-400 hover:text-white hover:bg-gray-800"
              aria-label="Cancel"
              title="Cancel"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="px-6 pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="details" className="text-white data-[state=active]:bg-primary data-[state=active]:text-white">
                Goal Details
              </TabsTrigger>
              <TabsTrigger value="funding" className="text-white data-[state=active]:bg-primary data-[state=active]:text-white">
                Funding Sources
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="goalName" className="text-white">Goal Name *</Label>
                  <Input
                    id="goalName"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="e.g., Dream Home Purchase"
                  />
                </div>
                
                <div>
                  <Label htmlFor="priority" className="text-white">Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="high" className="text-white">High</SelectItem>
                      <SelectItem value="medium" className="text-white">Medium</SelectItem>
                      <SelectItem value="low" className="text-white">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-white">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="Describe your goal..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="targetDate" className="text-white">Target Date *</Label>
                  <Input
                    id="targetDate"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                
                <div>
                  <Label htmlFor="targetAmount" className="text-white">Target Amount ($) *</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Next Button for Goal Details Tab */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setActiveTab('funding')}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!goalName || !targetDate || !targetAmount}
                >
                  Next
                </Button>
              </div>

            {/* Removed Funding Coverage Preview - moved to Funding Sources tab only */}
            </TabsContent>

          <TabsContent value="funding" className="space-y-6 mt-6">
            <Alert className="bg-blue-900/20 border-blue-800">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-gray-300">
                Add funding sources to show how you'll achieve this goal. You can use existing assets, 
                take a loan, or save monthly.
              </AlertDescription>
            </Alert>

            {/* Funding Sources List */}
            <div className="space-y-3">
              {fundingSources.map((source) => (
                <Card key={source.id} className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        {source.type === 'asset' && <Wallet className="h-4 w-4 text-green-400" />}
                        {source.type === 'loan' && <Banknote className="h-4 w-4 text-yellow-400" />}
                        {source.type === 'monthly_savings' && <PiggyBank className="h-4 w-4 text-blue-400" />}
                        <span className="font-medium text-white">
                          {source.type === 'asset' ? 'Asset' :
                           source.type === 'loan' ? 'Loan' : 'Monthly Savings'}
                        </span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeFundingSource(source.id)}
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {source.type === 'asset' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm text-gray-400">Select Asset</Label>
                          <Select 
                            value={source.name}
                            onValueChange={(value) => {
                              const asset = liquidAssets.find(a => a.name === value);
                              updateFundingSource(source.id, {
                                name: value,
                                amount: asset?.value || 0
                              });
                            }}
                          >
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                              <SelectValue placeholder="Choose asset" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              {liquidAssets.map(asset => (
                                <SelectItem key={asset.id} value={asset.name} className="text-white">
                                  {asset.name} (${asset.value.toLocaleString()})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm text-gray-400">Amount to Use ($)</Label>
                          <Input
                            type="number"
                            value={source.amount}
                            onChange={(e) => updateFundingSource(source.id, { 
                              amount: Number(e.target.value) 
                            })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                      </div>
                    )}

                    {source.type === 'loan' && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-sm text-gray-400">Loan Amount ($)</Label>
                          <Input
                            type="number"
                            value={source.amount}
                            onChange={(e) => updateFundingSource(source.id, { 
                              amount: Number(e.target.value) 
                            })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-gray-400">Interest Rate (%)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={source.interestRate}
                            onChange={(e) => updateFundingSource(source.id, { 
                              interestRate: Number(e.target.value) 
                            })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-gray-400">Term (months)</Label>
                          <Input
                            type="number"
                            value={source.termMonths}
                            onChange={(e) => updateFundingSource(source.id, { 
                              termMonths: Number(e.target.value) 
                            })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                      </div>
                    )}

                    {source.type === 'monthly_savings' && (
                      <div>
                        <Label className="text-sm text-gray-400">Monthly Savings Amount ($)</Label>
                        <Input
                          type="number"
                          value={source.monthlyAmount}
                          onChange={(e) => updateFundingSource(source.id, { 
                            monthlyAmount: Number(e.target.value) 
                          })}
                          className="bg-gray-700 border-gray-600 text-white"
                          placeholder="500"
                        />
                        {targetDate && (
                          <p className="text-xs text-gray-400 mt-1">
                            Total savings by target date: ${
                              ((source.monthlyAmount || 0) * 
                               Math.max(0, (new Date(targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30))
                              ).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add Funding Source Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => addFundingSource('asset')}
                variant="outline"
                className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
              <Button
                onClick={() => addFundingSource('loan')}
                variant="outline"
                className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                <Banknote className="h-4 w-4 mr-2" />
                Add Loan
              </Button>
              <Button
                onClick={() => addFundingSource('monthly_savings')}
                variant="outline"
                className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                <PiggyBank className="h-4 w-4 mr-2" />
                Add Monthly Savings
              </Button>
            </div>
            {/* Save Goal Button - Only on Funding Sources Tab */}
            <div className="flex justify-between pt-4">
              <Button
                onClick={() => setActiveTab('details')}
                variant="outline"
                className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                Back
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveGoalMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {saveGoalMutation.isPending ? 'Saving...' : 'Save Goal'}
              </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* DrawerFooter removed; save handled within Funding tab */}
      </DrawerContent>
    </Drawer>
  );
}
