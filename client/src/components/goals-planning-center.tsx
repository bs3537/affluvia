import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Target, 
  Plus, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Home,
  GraduationCap,
  Plane,
  Heart,
  MoreHorizontal,
  Info
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GoalsOverview } from './goals/goals-overview';
import { AddEditGoal } from './goals/add-edit-goal';
import { WhatIfSandbox } from './goals/what-if-sandbox';
import { TradeOffVisualizer } from './goals/trade-off-visualizer';
import { TaskList } from './goals/task-list';
import type { Goal } from '@shared/schema';

// Goal type icons mapping
const goalTypeIcons = {
  retirement: Target,
  college: GraduationCap,
  home: Home,
  travel: Plane,
  healthcare: Heart,
  custom: MoreHorizontal
};

export function GoalsPlanningCenter() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch goals
  const { data: goals = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
  });

  // Fetch goal probabilities
  const { data: probabilities, refetch: refetchProbabilities } = useQuery({
    queryKey: ['/api/goals/probability'],
    enabled: goals.length > 0,
    refetchInterval: 60000, // Refresh every minute
  });

  // Calculate success probabilities when goals change
  useEffect(() => {
    if (goals.length > 0) {
      refetchProbabilities();
    }
  }, [goals.length, refetchProbabilities]);

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: number) => {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete goal');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      setSelectedGoal(null);
    },
  });

  const handleGoalSelect = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsAddingGoal(false);
    setActiveTab('edit');
  };

  const handleAddGoal = () => {
    setSelectedGoal(null);
    setIsAddingGoal(true);
    setActiveTab('edit');
  };

  const handleGoalSaved = () => {
    setIsAddingGoal(false);
    setSelectedGoal(null);
    setActiveTab('overview');
    queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
  };

  if (goalsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎯</span>
            <div>
              <h1 className="text-3xl font-bold text-white">Goals-Based Planning Center</h1>
              <p className="text-gray-400 mt-1">
                Your financial hub for tracking, planning, and achieving life goals
              </p>
            </div>
          </div>
          <Button onClick={handleAddGoal} className="bg-[#8A00C4] hover:bg-[#7000A4]">
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </div>

        {/* CFP Board Disclosure */}
        <Alert className="bg-blue-900/20 border-blue-800">
          <Info className="h-4 w-4 text-blue-300" />
          <AlertDescription className="text-gray-300">
            <strong>CFP Board Disclosure:</strong> Assumptions based on CFP Board Practice Standards. 
            Results are hypothetical and not guarantees of future performance.
          </AlertDescription>
        </Alert>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl mx-auto bg-gray-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#8A00C4]">
            Overview
          </TabsTrigger>
          <TabsTrigger value="edit" className="data-[state=active]:bg-[#8A00C4]">
            {isAddingGoal ? 'Add Goal' : 'Edit Goal'}
          </TabsTrigger>
          <TabsTrigger value="sandbox" className="data-[state=active]:bg-[#8A00C4]">
            What-If
          </TabsTrigger>
          <TabsTrigger value="tradeoff" className="data-[state=active]:bg-[#8A00C4]">
            Trade-Offs
          </TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-[#8A00C4]">
            Tasks
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <GoalsOverview 
            goals={goals}
            probabilities={probabilities}
            onGoalSelect={handleGoalSelect}
            onAddGoal={handleAddGoal}
          />
        </TabsContent>

        {/* Add/Edit Goal Tab */}
        <TabsContent value="edit">
          <AddEditGoal
            goal={selectedGoal}
            onSave={handleGoalSaved}
            onCancel={() => {
              setSelectedGoal(null);
              setIsAddingGoal(false);
              setActiveTab('overview');
            }}
          />
        </TabsContent>

        {/* What-If Sandbox Tab */}
        <TabsContent value="sandbox">
          <WhatIfSandbox 
            goals={goals}
            selectedGoal={selectedGoal}
            onGoalSelect={setSelectedGoal}
          />
        </TabsContent>

        {/* Trade-Off Visualizer Tab */}
        <TabsContent value="tradeoff">
          <TradeOffVisualizer 
            goals={goals}
            onPrioritiesChange={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
              refetchProbabilities();
            }}
          />
        </TabsContent>

        {/* Task List Tab */}
        <TabsContent value="tasks">
          <TaskList 
            goals={goals}
            selectedGoal={selectedGoal}
            onGoalSelect={setSelectedGoal}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Stats */}
      {goals.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Goals</p>
                  <p className="text-2xl font-bold text-white">{goals.length}</p>
                </div>
                <Target className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">On Track</p>
                  <p className="text-2xl font-bold text-green-400">
                    {goals.filter(g => {
                      const prob = Array.isArray(probabilities) ? probabilities.find((p: any) => p.goalId === g.id) : null;
                      return prob && prob.probabilityPct >= 70;
                    }).length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">At Risk</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {goals.filter(g => {
                      const prob = Array.isArray(probabilities) ? probabilities.find((p: any) => p.goalId === g.id) : null;
                      return prob && prob.probabilityPct >= 40 && prob.probabilityPct < 70;
                    }).length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Target</p>
                  <p className="text-2xl font-bold text-white">
                    ${goals.reduce((sum, g) => sum + parseFloat(g.targetAmountToday.toString()), 0).toLocaleString()}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}