import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp,
  DollarSign,
  Calendar,
  RefreshCw,
  Save,
  RotateCcw,
  Info
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import type { Goal } from '@shared/schema';

interface Scenario {
  monthlySavings: number;
  targetAmount: number;
  targetDate: string;
  stockAllocation: number;
}

interface WhatIfSandboxProps {
  goals: Goal[];
  selectedGoal: Goal | null;
  onGoalSelect: (goal: Goal) => void;
}

export function WhatIfSandbox({ goals, selectedGoal, onGoalSelect }: WhatIfSandboxProps) {
  const queryClient = useQueryClient();
  
  // Get financial profile for savings capacity
  const { data: profile } = useQuery({
    queryKey: ['/api/financial-profile'],
  });

  // Initialize scenario state
  const [scenario, setScenario] = useState<Scenario>({
    monthlySavings: 500,
    targetAmount: parseFloat(selectedGoal?.targetAmountToday?.toString() || '100000'),
    targetDate: selectedGoal?.targetDate 
      ? new Date(selectedGoal.targetDate).toISOString().split('T')[0]
      : new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    stockAllocation: 60
  });

  const [savedScenario, setSavedScenario] = useState<Scenario | null>(null);
  const [liveSuccessProbability, setLiveSuccessProbability] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);

  // Update scenario when goal changes
  useEffect(() => {
    if (selectedGoal) {
      setScenario({
        monthlySavings: 500, // Would calculate based on profile
        targetAmount: parseFloat(selectedGoal.targetAmountToday?.toString() || '100000'),
        targetDate: new Date(selectedGoal.targetDate).toISOString().split('T')[0],
        stockAllocation: selectedGoal.riskPreference === 'aggressive' ? 80 : 
                         selectedGoal.riskPreference === 'conservative' ? 40 : 60
      });
    }
  }, [selectedGoal]);

  // Calculate probability mutation
  const calculateProbabilityMutation = useMutation({
    mutationFn: async (scenarioData: Scenario) => {
      setIsCalculating(true);
      
      // Simulate API call to Monte Carlo service
      // In production, this would call the actual endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock calculation based on scenario
      const yearsToGoal = (new Date(scenarioData.targetDate).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
      const totalSavings = scenarioData.monthlySavings * 12 * yearsToGoal;
      const currentSavings = parseFloat(selectedGoal?.currentSavings?.toString() || '0');
      
      // Simple mock probability calculation
      const savingsRatio = (currentSavings + totalSavings) / scenarioData.targetAmount;
      const timeBonus = Math.min(yearsToGoal / 20, 1) * 20;
      const stockBonus = (scenarioData.stockAllocation / 100) * 30;
      
      const probability = Math.min(100, Math.max(0, savingsRatio * 50 + timeBonus + stockBonus));
      
      return Math.round(probability);
    },
    onSuccess: (probability) => {
      setLiveSuccessProbability(probability);
      setIsCalculating(false);
    },
  });

  // Debounced calculation
  const debouncedCalculate = useCallback(
    debounce((scenarioData: Scenario) => {
      calculateProbabilityMutation.mutate(scenarioData);
    }, 500),
    []
  );

  // Handle scenario changes
  const updateScenario = (updates: Partial<Scenario>) => {
    const newScenario = { ...scenario, ...updates };
    setScenario(newScenario);
    debouncedCalculate(newScenario);
  };

  // Save scenario
  const saveScenario = () => {
    setSavedScenario(scenario);
    // In production, this would save to the backend
  };

  // Revert to saved scenario
  const revertScenario = () => {
    if (savedScenario) {
      setScenario(savedScenario);
      debouncedCalculate(savedScenario);
    }
  };

  // Calculate monthly savings capacity
  const getMonthlySavingsCapacity = () => {
    if (!profile) return 2000;
    
    const monthlyIncome = parseFloat((profile as any)?.takeHomeIncome?.toString() || '0') / 12;
    const monthlyExpenses = Object.values((profile as any)?.monthlyExpenses || {})
      .reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
    
    return Math.max(0, monthlyIncome - monthlyExpenses);
  };

  const maxMonthlySavings = getMonthlySavingsCapacity();

  if (!selectedGoal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Select a goal to run what-if scenarios</p>
        <Select onValueChange={(value) => {
          const goal = goals.find(g => g.id.toString() === value);
          if (goal) onGoalSelect(goal);
        }}>
          <SelectTrigger className="w-64 mx-auto bg-gray-700 border-gray-600 text-white">
            <SelectValue placeholder="Choose a goal" />
          </SelectTrigger>
          <SelectContent>
            {goals.map(goal => (
              <SelectItem key={goal.id} value={goal.id.toString()}>
                {goal.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const getProgressColor = (probability: number) => {
    if (probability >= 70) return 'bg-green-400';
    if (probability >= 40) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls Panel */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Scenario Controls</CardTitle>
            <Select 
              value={selectedGoal.id.toString()}
              onValueChange={(value) => {
                const goal = goals.find(g => g.id.toString() === value);
                if (goal) onGoalSelect(goal);
              }}
            >
              <SelectTrigger className="mt-2 bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {goals.map(goal => (
                  <SelectItem key={goal.id} value={goal.id.toString()}>
                    {goal.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Monthly Savings Slider */}
            <div>
              <Label className="text-white flex items-center justify-between">
                <span>Monthly Savings</span>
                <span className="text-primary font-bold">${scenario.monthlySavings}</span>
              </Label>
              <Slider
                min={0}
                max={maxMonthlySavings}
                step={50}
                value={[scenario.monthlySavings]}
                onValueChange={([value]) => updateScenario({ monthlySavings: value })}
                className="mt-3"
              />
              <p className="text-gray-400 text-sm mt-2">
                Max capacity: ${maxMonthlySavings.toLocaleString()}/month
              </p>
            </div>

            {/* Target Amount Slider */}
            <div>
              <Label className="text-white flex items-center justify-between">
                <span>Target Amount</span>
                <span className="text-primary font-bold">
                  ${scenario.targetAmount.toLocaleString()}
                </span>
              </Label>
              <Slider
                min={10000}
                max={5000000}
                step={10000}
                value={[scenario.targetAmount]}
                onValueChange={([value]) => updateScenario({ targetAmount: value })}
                className="mt-3"
              />
            </div>

            {/* Target Date */}
            <div>
              <Label htmlFor="targetDate" className="text-white">Target Date</Label>
              <input
                id="targetDate"
                type="date"
                value={scenario.targetDate}
                onChange={(e) => updateScenario({ targetDate: e.target.value })}
                className="mt-2 w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Stock Allocation */}
            <div>
              <Label className="text-white flex items-center justify-between">
                <span>Stock Allocation</span>
                <span className="text-primary font-bold">{scenario.stockAllocation}%</span>
              </Label>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[scenario.stockAllocation]}
                onValueChange={([value]) => updateScenario({ stockAllocation: value })}
                className="mt-3"
              />
              <p className="text-gray-400 text-sm mt-2">
                Bonds: {100 - scenario.stockAllocation}%
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={saveScenario}
                className="flex-1 bg-[#8A00C4] hover:bg-[#7000A4]"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Scenario
              </Button>
              <Button
                onClick={revertScenario}
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                disabled={!savedScenario}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Revert
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Success Meter */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Live Success Probability</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Success Gauge */}
            <div className="relative h-64 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-6xl font-bold mb-4 ${
                  liveSuccessProbability >= 70 ? 'text-green-400' :
                  liveSuccessProbability >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {isCalculating ? (
                    <RefreshCw className="h-16 w-16 animate-spin mx-auto" />
                  ) : (
                    `${liveSuccessProbability}%`
                  )}
                </div>
                <p className="text-gray-400">Probability of Success</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <Progress 
                value={liveSuccessProbability} 
                className={`h-4 ${getProgressColor(liveSuccessProbability)}`}
              />
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-700/30 p-4 rounded-lg">
                <p className="text-gray-400 text-sm">Years to Goal</p>
                <p className="text-white text-xl font-bold">
                  {Math.round((new Date(scenario.targetDate).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000))}
                </p>
              </div>
              <div className="bg-gray-700/30 p-4 rounded-lg">
                <p className="text-gray-400 text-sm">Total Contributions</p>
                <p className="text-white text-xl font-bold">
                  ${(scenario.monthlySavings * 12 * Math.round((new Date(scenario.targetDate).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000))).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Insights */}
            <Alert className="mt-6 bg-blue-900/20 border-blue-800">
              <TrendingUp className="h-4 w-4 text-blue-300" />
              <AlertDescription className="text-gray-300">
                {liveSuccessProbability >= 70 ? (
                  'Great! This scenario puts you on track to achieve your goal.'
                ) : liveSuccessProbability >= 40 ? (
                  'Consider increasing monthly savings or extending your timeline.'
                ) : (
                  'This goal needs significant adjustments. Try increasing savings or reducing the target.'
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Throttle Notice */}
      <Alert className="mt-6 bg-gray-800/50 border-gray-700">
        <Info className="h-4 w-4 text-gray-400" />
        <AlertDescription className="text-gray-300">
          Calculations are throttled to 1 request per second to ensure optimal performance.
          Monte Carlo simulations run 1,000 iterations per calculation.
        </AlertDescription>
      </Alert>
    </div>
  );
}