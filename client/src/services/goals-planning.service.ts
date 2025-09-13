import type { Goal, GoalTask } from '@shared/schema';
import { RNG, hash32, type RandomSource } from '../workers/rng';

interface GoalProbability {
  goalId: number;
  probabilityPct: number;
}

interface MonteCarloScenario {
  monthlySavings: number;
  targetAmount: number;
  targetDate: Date;
  stockAllocation: number;
  inflationRate: number;
}

class GoalsPlanningService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private rng: RandomSource | null = null;

  /**
   * Get all goals for the user
   */
  async getGoals(): Promise<Goal[]> {
    const response = await fetch('/api/goals', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch goals');
    }
    
    return response.json();
  }

  /**
   * Get a single goal by ID
   */
  async getGoal(goalId: number): Promise<Goal> {
    const response = await fetch(`/api/goals/${goalId}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch goal');
    }
    
    return response.json();
  }

  /**
   * Create a new goal
   */
  async createGoal(goal: Partial<Goal>): Promise<Goal> {
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(goal),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create goal');
    }
    
    return response.json();
  }

  /**
   * Update an existing goal
   */
  async updateGoal(goalId: number, updates: Partial<Goal>): Promise<Goal> {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update goal');
    }
    
    return response.json();
  }

  /**
   * Delete a goal
   */
  async deleteGoal(goalId: number): Promise<void> {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete goal');
    }
  }

  /**
   * Get goal probabilities
   */
  async getGoalProbabilities(): Promise<GoalProbability[]> {
    const cacheKey = 'goal-probabilities';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    const response = await fetch('/api/goals/probability', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch goal probabilities');
    }
    
    const data = await response.json();
    
    // Cache the result
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
    
    return data;
  }

  /**
   * Run Monte Carlo simulation for a scenario
   */
  async runMonteCarloSimulation(scenario: MonteCarloScenario, seed?: number): Promise<number> {
    // In production, this would call the actual Monte Carlo endpoint
    // For now, we'll simulate it client-side
    // Seed RNG deterministically for reproducibility
    const baseSeed = (typeof seed === 'number' ? seed >>> 0 : hash32(JSON.stringify(scenario))) >>> 0;
    this.rng = new RNG(baseSeed);
    
    const currentYear = new Date().getFullYear();
    const targetYear = scenario.targetDate.getFullYear();
    const yearsToGoal = Math.max(1, targetYear - currentYear);
    
    // Risk-adjusted return rates
    const stockReturn = 0.10; // 10% average stock return
    const bondReturn = 0.04; // 4% average bond return
    const stockVolatility = 0.18; // 18% stock volatility
    const bondVolatility = 0.05; // 5% bond volatility
    
    const stockWeight = scenario.stockAllocation / 100;
    const bondWeight = 1 - stockWeight;
    
    const expectedReturn = stockWeight * stockReturn + bondWeight * bondReturn;
    const volatility = Math.sqrt(
      Math.pow(stockWeight * stockVolatility, 2) + 
      Math.pow(bondWeight * bondVolatility, 2)
    );
    
    // Run 1000 simulations
    const simulations = 1000;
    let successCount = 0;
    
    for (let i = 0; i < simulations; i++) {
      let balance = 0;
      
      for (let year = 0; year < yearsToGoal; year++) {
        // Generate random return using normal distribution
        const randomReturn = this.normalRandom(expectedReturn, volatility);
        
        // Apply return and add monthly contributions
        balance = balance * (1 + randomReturn) + scenario.monthlySavings * 12;
      }
      
      // Adjust target for inflation
      const inflationAdjustedTarget = scenario.targetAmount * 
        Math.pow(1 + scenario.inflationRate / 100, yearsToGoal);
      
      if (balance >= inflationAdjustedTarget) {
        successCount++;
      }
    }
    
    return Math.round((successCount / simulations) * 100);
  }

  /**
   * Get tasks for a goal
   */
  async getGoalTasks(goalId: number): Promise<GoalTask[]> {
    const response = await fetch(`/api/goals/${goalId}/tasks`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }
    
    return response.json();
  }

  /**
   * Create a task for a goal
   */
  async createGoalTask(goalId: number, task: Partial<GoalTask>): Promise<GoalTask> {
    const response = await fetch(`/api/goals/${goalId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(task),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create task');
    }
    
    return response.json();
  }

  /**
   * Update a task
   */
  async updateGoalTask(taskId: number, updates: Partial<GoalTask>): Promise<GoalTask> {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update task');
    }
    
    return response.json();
  }

  /**
   * Delete a task
   */
  async deleteGoalTask(taskId: number): Promise<void> {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete task');
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Normal distribution random number generator (Box-Muller transform)
   */
  private normalRandom(mean: number, stdDev: number): number {
    if (!this.rng) this.rng = new RNG(hash32('goals-default'));
    const z = this.rng.normal();
    return z * stdDev + mean;
  }
}

// Export singleton instance
export const goalsPlanningService = new GoalsPlanningService();

// Export types
export type { GoalProbability, MonteCarloScenario };
