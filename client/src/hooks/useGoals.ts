import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsPlanningService } from '@/services/goals-planning.service';
import type { Goal, InsertGoal, GoalTask, InsertGoalTask } from '@shared/schema';

/**
 * Hook to fetch all goals
 */
export function useGoals() {
  return useQuery({
    queryKey: ['/api/goals'],
    queryFn: () => goalsPlanningService.getGoals(),
  });
}

/**
 * Hook to fetch a single goal
 */
export function useGoal(goalId: number | null) {
  return useQuery({
    queryKey: [`/api/goals/${goalId}`],
    queryFn: () => goalsPlanningService.getGoal(goalId!),
    enabled: !!goalId,
  });
}

/**
 * Hook to fetch goal probabilities
 */
export function useGoalProbabilities() {
  return useQuery({
    queryKey: ['/api/goals/probability'],
    queryFn: () => goalsPlanningService.getGoalProbabilities(),
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Hook to create a goal
 */
export function useCreateGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (goal: InsertGoal) => goalsPlanningService.createGoal(goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/goals/probability'] });
    },
  });
}

/**
 * Hook to update a goal
 */
export function useUpdateGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ goalId, updates }: { goalId: number; updates: Partial<InsertGoal> }) => 
      goalsPlanningService.updateGoal(goalId, updates),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      queryClient.invalidateQueries({ queryKey: [`/api/goals/${goalId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/goals/probability'] });
    },
  });
}

/**
 * Hook to delete a goal
 */
export function useDeleteGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (goalId: number) => goalsPlanningService.deleteGoal(goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/goals/probability'] });
    },
  });
}

/**
 * Hook to fetch tasks for a goal
 */
export function useGoalTasks(goalId: number | null) {
  return useQuery({
    queryKey: [`/api/goals/${goalId}/tasks`],
    queryFn: () => goalsPlanningService.getGoalTasks(goalId!),
    enabled: !!goalId,
  });
}

/**
 * Hook to create a task
 */
export function useCreateGoalTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ goalId, task }: { goalId: number; task: InsertGoalTask }) => 
      goalsPlanningService.createGoalTask(goalId, task),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/goals/${goalId}/tasks`] });
    },
  });
}

/**
 * Hook to update a task
 */
export function useUpdateGoalTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: number; updates: Partial<InsertGoalTask> }) => 
      goalsPlanningService.updateGoalTask(taskId, updates),
    onSuccess: () => {
      // Invalidate all task queries since we don't know the goalId here
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().includes('/tasks') || false
      });
    },
  });
}

/**
 * Hook to delete a task
 */
export function useDeleteGoalTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (taskId: number) => goalsPlanningService.deleteGoalTask(taskId),
    onSuccess: () => {
      // Invalidate all task queries since we don't know the goalId here
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().includes('/tasks') || false
      });
    },
  });
}

/**
 * Hook to run Monte Carlo simulation
 */
export function useMonteCarloSimulation() {
  return useMutation({
    mutationFn: goalsPlanningService.runMonteCarloSimulation,
  });
}