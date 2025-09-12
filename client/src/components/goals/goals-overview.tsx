import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Target, 
  Plus, 
  Calendar,
  DollarSign,
  TrendingUp,
  Edit,
  Home,
  GraduationCap,
  Plane,
  Heart,
  MoreHorizontal,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
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

interface GoalsOverviewProps {
  goals: Goal[];
  probabilities: any;
  onGoalSelect: (goal: Goal) => void;
  onAddGoal: () => void;
}

export function GoalsOverview({ goals, probabilities, onGoalSelect, onAddGoal }: GoalsOverviewProps) {
  const getGoalIcon = (type: string) => {
    const Icon = goalTypeIcons[type as keyof typeof goalTypeIcons] || MoreHorizontal;
    return Icon;
  };

  const getGoalProbability = (goalId: number) => {
    return probabilities?.find((p: any) => p.goalId === goalId)?.probabilityPct || 0;
  };

  const getProgressColor = (probability: number) => {
    if (probability >= 70) return 'text-green-400 bg-green-400';
    if (probability >= 40) return 'text-yellow-400 bg-yellow-400';
    return 'text-red-400 bg-red-400';
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };

  // Get top tasks due this week
  const getUpcomingTasks = () => {
    // This would fetch tasks from the API in a real implementation
    return [
      { id: 1, title: 'Review investment allocation', dueDate: new Date(), goalTitle: 'Retirement' },
      { id: 2, title: 'Set up 529 plan', dueDate: new Date(), goalTitle: 'College Fund' },
    ];
  };

  const upcomingTasks = getUpcomingTasks();

  if (goals.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Target className="h-12 w-12 text-gray-600" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No goals yet</h3>
        <p className="text-gray-400 mb-6">Start planning your financial future by adding your first goal</p>
        <Button onClick={onAddGoal} className="bg-[#8A00C4] hover:bg-[#7000A4]">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Goal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Tasks Section */}
      {upcomingTasks.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-400" />
              Tasks Due This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{task.title}</p>
                    <p className="text-gray-400 text-sm">{task.goalTitle}</p>
                  </div>
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                    Due Today
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map(goal => {
          const Icon = getGoalIcon(goal.type);
          const probability = getGoalProbability(goal.id);
          const progressColor = getProgressColor(probability);

          return (
            <Card 
              key={goal.id} 
              className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all cursor-pointer"
              onClick={() => onGoalSelect(goal)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-700 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-lg">{goal.description}</CardTitle>
                      <Badge variant="outline" className="mt-1 text-xs">
                        Priority {goal.priority}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGoalSelect(goal);
                    }}
                  >
                    <Edit className="h-4 w-4 text-gray-400" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress Ring */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Success Probability</span>
                    <span className={`font-bold ${progressColor.split(' ')[0]}`}>
                      {probability}%
                    </span>
                  </div>
                  <Progress value={probability} className="h-2" />
                </div>

                {/* Goal Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Target Amount</p>
                    <p className="text-white font-medium">
                      {formatCurrency(goal.targetAmountToday)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Target Date</p>
                    <p className="text-white font-medium">
                      {formatDate(goal.targetDate)}
                    </p>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                  <div className="flex items-center gap-2">
                    {probability >= 70 ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-green-400 text-sm">On Track</span>
                      </>
                    ) : probability >= 40 ? (
                      <>
                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                        <span className="text-yellow-400 text-sm">Needs Attention</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <span className="text-red-400 text-sm">At Risk</span>
                      </>
                    )}
                  </div>
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add Goal Card */}
        <Card 
          className="bg-gray-800/50 border-gray-700 border-dashed hover:border-gray-600 transition-all cursor-pointer flex items-center justify-center min-h-[300px]"
          onClick={onAddGoal}
        >
          <div className="text-center">
            <Plus className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Add New Goal</p>
          </div>
        </Card>
      </div>
    </div>
  );
}