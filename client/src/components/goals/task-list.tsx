import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Plus,
  Edit,
  Trash2,
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Goal, GoalTask, InsertGoalTask } from '@shared/schema';

interface TaskListProps {
  goals: Goal[];
  selectedGoal: Goal | null;
  onGoalSelect: (goal: Goal) => void;
}

export function TaskList({ goals, selectedGoal, onGoalSelect }: TaskListProps) {
  const queryClient = useQueryClient();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<GoalTask | null>(null);
  const [filterGoal, setFilterGoal] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch tasks for selected goal or all goals
  const { data: tasks = [], isLoading } = useQuery<GoalTask[]>({
    queryKey: selectedGoal 
      ? [`/api/goals/${selectedGoal.id}/tasks`]
      : ['/api/all-tasks'], // This would need a new endpoint
    queryFn: async () => {
      if (selectedGoal) {
        const response = await fetch(`/api/goals/${selectedGoal.id}/tasks`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch tasks');
        return response.json();
      } else {
        // Fetch all tasks - would need to implement this endpoint
        // For now, return empty array
        return [];
      }
    },
    enabled: !!selectedGoal,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async ({ goalId, task }: { goalId: number; task: Partial<InsertGoalTask> }) => {
      const response = await fetch(`/api/goals/${goalId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(task),
      });
      if (!response.ok) throw new Error('Failed to create task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/goals/${selectedGoal?.id}/tasks`] });
      setIsAddingTask(false);
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: Partial<InsertGoalTask> }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/goals/${selectedGoal?.id}/tasks`] });
      setEditingTask(null);
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete task');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/goals/${selectedGoal?.id}/tasks`] });
    },
  });

  // Toggle task status
  const toggleTaskStatus = (task: GoalTask) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMutation.mutate({
      taskId: task.id,
      updates: { status: newStatus }
    });
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    return true;
  });

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'in_progress':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'cancelled':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'in_progress':
        return Clock;
      case 'cancelled':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  if (!selectedGoal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Select a goal to manage its tasks</p>
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

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Tasks</CardTitle>
              <Select 
                value={selectedGoal.id.toString()}
                onValueChange={(value) => {
                  const goal = goals.find(g => g.id.toString() === value);
                  if (goal) onGoalSelect(goal);
                }}
              >
                <SelectTrigger className="mt-2 w-64 bg-gray-700 border-gray-600 text-white">
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
            </div>
            <Button
              onClick={() => setIsAddingTask(true)}
              className="bg-[#8A00C4] hover:bg-[#7000A4]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Task List */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No tasks found. Add your first task!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const StatusIcon = getStatusIcon(task.status);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 p-4 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-all"
                  >
                    <Checkbox
                      checked={task.status === 'completed'}
                      onCheckedChange={() => toggleTaskStatus(task)}
                      className="border-gray-600"
                    />
                    
                    <div className="flex-1">
                      <p className={`font-medium ${
                        task.status === 'completed' ? 'text-gray-400 line-through' : 'text-white'
                      }`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-gray-400 text-sm mt-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        {task.assignee && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <User className="h-3 w-3" />
                            {task.assignee}
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <Badge variant="outline" className={getStatusColor(task.status)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {task.status.replace('_', ' ')}
                    </Badge>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingTask(task)}
                      >
                        <Edit className="h-4 w-4 text-gray-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                      >
                        <Trash2 className="h-4 w-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Task Dialog */}
      <TaskDialog
        isOpen={isAddingTask || !!editingTask}
        onClose={() => {
          setIsAddingTask(false);
          setEditingTask(null);
        }}
        task={editingTask}
        goalId={selectedGoal.id}
        onSave={(taskData) => {
          if (editingTask) {
            updateTaskMutation.mutate({
              taskId: editingTask.id,
              updates: taskData
            });
          } else {
            createTaskMutation.mutate({
              goalId: selectedGoal.id,
              task: taskData
            });
          }
        }}
      />
    </div>
  );
}

// Task Dialog Component
function TaskDialog({ 
  isOpen, 
  onClose, 
  task, 
  goalId, 
  onSave 
}: {
  isOpen: boolean;
  onClose: () => void;
  task: GoalTask | null;
  goalId: number;
  onSave: (task: Partial<InsertGoalTask>) => void;
}) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assignee: task?.assignee || '',
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
    status: task?.status || 'pending'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: formData.title,
      description: formData.description || undefined,
      assignee: formData.assignee || undefined,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      status: formData.status
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 text-white">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Add New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignee">Assignee</Label>
              <Select 
                value={formData.assignee} 
                onValueChange={(value) => setFormData({ ...formData, assignee: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  <SelectItem value="user">Me</SelectItem>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#8A00C4] hover:bg-[#7000A4]">
              {task ? 'Update' : 'Create'} Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}