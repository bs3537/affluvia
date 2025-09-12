import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  GripVertical,
  Info,
  Save,
  RefreshCw,
  Target,
  Home,
  GraduationCap,
  Plane,
  Heart,
  MoreHorizontal
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

interface TradeOffVisualizerProps {
  goals: Goal[];
  onPrioritiesChange: () => void;
}

export function TradeOffVisualizer({ goals, onPrioritiesChange }: TradeOffVisualizerProps) {
  const queryClient = useQueryClient();
  const [prioritizedGoals, setPrioritizedGoals] = useState<Goal[]>(() => 
    [...goals].sort((a, b) => a.priority - b.priority)
  );
  const [hasChanges, setHasChanges] = useState(false);

  // Update priorities mutation
  const updatePrioritiesMutation = useMutation({
    mutationFn: async (updatedGoals: Goal[]) => {
      // Update each goal's priority
      const updates = updatedGoals.map((goal, index) => 
        fetch(`/api/goals/${goal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ priority: index + 1 }),
        })
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      setHasChanges(false);
      onPrioritiesChange();
    },
  });

  // Handle drag end
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(prioritizedGoals);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setPrioritizedGoals(items);
    setHasChanges(true);
  };

  // Save new priorities
  const savePriorities = () => {
    updatePrioritiesMutation.mutate(prioritizedGoals);
  };

  // Reset priorities
  const resetPriorities = () => {
    setPrioritizedGoals([...goals].sort((a, b) => a.priority - b.priority));
    setHasChanges(false);
  };

  // Calculate resource allocation
  const calculateResourceAllocation = () => {
    const totalWeight = prioritizedGoals.reduce((sum, goal, index) => {
      const weight = 1 / (index + 1); // Higher priority gets more weight
      return sum + weight;
    }, 0);

    return prioritizedGoals.map((goal, index) => {
      const weight = 1 / (index + 1);
      const allocation = (weight / totalWeight) * 100;
      
      return {
        name: goal.description,
        allocation: Math.round(allocation),
        amount: parseFloat(goal.targetAmountToday.toString()),
        priority: index + 1,
        type: goal.type
      };
    });
  };

  const resourceData = calculateResourceAllocation();

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
        <p className="text-white font-medium">{data.name}</p>
        <p className="text-gray-400 text-sm">Priority: #{data.priority}</p>
        <p className="text-primary text-sm">Allocation: {data.allocation}%</p>
        <p className="text-gray-400 text-sm">
          Target: ${data.amount.toLocaleString()}
        </p>
      </div>
    );
  };

  // Get color for each goal type
  const getGoalColor = (type: string) => {
    const colors = {
      retirement: '#8B5CF6',
      college: '#3B82F6',
      home: '#10B981',
      travel: '#F59E0B',
      healthcare: '#EF4444',
      custom: '#6B7280'
    };
    return colors[type as keyof typeof colors] || '#6B7280';
  };

  const getGoalIcon = (type: string) => {
    const Icon = goalTypeIcons[type as keyof typeof goalTypeIcons] || MoreHorizontal;
    return Icon;
  };

  if (goals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No goals to prioritize yet. Add some goals first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert className="bg-blue-900/20 border-blue-800">
        <Info className="h-4 w-4 text-blue-300" />
        <AlertDescription className="text-gray-300">
          Drag and drop goals to reprioritize. Higher priority goals receive more resource allocation.
          Changes affect recommendations in Tax Strategies and Investment Picks.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority List */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Goal Priorities</CardTitle>
              {hasChanges && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetPriorities}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={savePriorities}
                    disabled={updatePrioritiesMutation.isPending}
                    className="bg-[#8A00C4] hover:bg-[#7000A4]"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="goals">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {prioritizedGoals.map((goal, index) => {
                      const Icon = getGoalIcon(goal.type);
                      return (
                        <Draggable key={goal.id} draggableId={goal.id.toString()} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`p-4 rounded-lg border transition-all ${
                                snapshot.isDragging
                                  ? 'bg-gray-700 border-[#8A00C4] shadow-lg'
                                  : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="h-5 w-5 text-gray-500" />
                                </div>
                                <div className="flex-1 flex items-center gap-3">
                                  <div className={`p-2 rounded-lg`} style={{ backgroundColor: getGoalColor(goal.type) + '20' }}>
                                    <Icon className="h-5 w-5" style={{ color: getGoalColor(goal.type) }} />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-white font-medium">{goal.description}</p>
                                    <p className="text-gray-400 text-sm">
                                      ${parseFloat(goal.targetAmountToday.toString()).toLocaleString()} by {new Date(goal.targetDate).getFullYear()}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-2xl font-bold text-primary">#{index + 1}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardContent>
        </Card>

        {/* Resource Allocation Chart */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Resource Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resourceData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fill: '#9CA3AF' }}
                    label={{ value: 'Allocation %', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="allocation" radius={[8, 8, 0, 0]}>
                    {resourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getGoalColor(entry.type)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary */}
            <div className="mt-6 space-y-3">
              <div className="bg-gray-700/30 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-2">Impact Summary</p>
                <ul className="space-y-1 text-sm">
                  <li className="text-gray-300">
                    • Top priority receives {resourceData[0]?.allocation || 0}% of resources
                  </li>
                  <li className="text-gray-300">
                    • Tax strategies will optimize for top {Math.min(3, goals.length)} goals
                  </li>
                  <li className="text-gray-300">
                    • Investment allocation adjusted by goal timeline
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}