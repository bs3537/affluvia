// Singleton Worker Pool Manager
// Manages a pool of web workers for Monte Carlo simulations

import { WORKER_BATCH_SIZE, DEFAULT_ITERATIONS } from './monte-carlo.constants';
import { seedFromParams } from '@/lib/seed';

interface WorkerTask {
  id: string;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId: NodeJS.Timeout;
}

class MonteCarloWorkerPool {
  private static instance: MonteCarloWorkerPool | null = null;
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private busyWorkers: Map<Worker, WorkerTask> = new Map();
  private taskQueue: Array<{
    params: any;
    iterations: number;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private isInitialized = false;
  private readonly maxWorkers = 8;
  private readonly defaultWorkerCount = 4;
  private readonly workerTimeout = 30000; // 30 seconds
  
  private constructor() {
    // Private constructor for singleton
  }
  
  static getInstance(): MonteCarloWorkerPool {
    if (!MonteCarloWorkerPool.instance) {
      MonteCarloWorkerPool.instance = new MonteCarloWorkerPool();
    }
    return MonteCarloWorkerPool.instance;
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Check Worker support
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported');
      this.isInitialized = true;
      return;
    }
    
    const workerCount = Math.min(
      navigator.hardwareConcurrency || this.defaultWorkerCount,
      this.maxWorkers
    );
    
    console.log(`Initializing worker pool with ${workerCount} workers`);
    
    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = new Worker(
          new URL('./monte-carlo.worker.server-parity.ts', import.meta.url),
          { type: 'module' }
        );
        
        // Set up permanent message handler
        worker.onmessage = (e) => this.handleWorkerMessage(worker, e);
        worker.onerror = (e) => this.handleWorkerError(worker, e);
        
        this.workers.push(worker);
        this.availableWorkers.push(worker);
        
      } catch (error) {
        console.error(`Failed to create worker ${i}:`, error);
      }
    }
    
    this.isInitialized = true;
    console.log(`Worker pool initialized with ${this.workers.length} workers`);
  }
  
  private handleWorkerMessage(worker: Worker, e: MessageEvent) {
    const task = this.busyWorkers.get(worker);
    if (!task) return;
    
    if (e.data.type === 'COMPLETE') {
      clearTimeout(task.timeoutId);
      task.resolve(e.data.result);
      this.releaseWorker(worker);
    } else if (e.data.type === 'ERROR') {
      clearTimeout(task.timeoutId);
      task.reject(new Error(e.data.error));
      this.releaseWorker(worker);
    }
  }
  
  private handleWorkerError(worker: Worker, e: ErrorEvent) {
    const task = this.busyWorkers.get(worker);
    if (task) {
      clearTimeout(task.timeoutId);
      task.reject(new Error(`Worker error: ${e.message}`));
      this.releaseWorker(worker);
    }
    
    // Try to recover the worker
    this.recoverWorker(worker);
  }
  
  private releaseWorker(worker: Worker) {
    const task = this.busyWorkers.get(worker);
    if (task) {
      clearTimeout(task.timeoutId);
      this.busyWorkers.delete(worker);
    }
    
    // Make worker available again
    if (!this.availableWorkers.includes(worker)) {
      this.availableWorkers.push(worker);
    }
    
    // Process next task in queue if any
    this.processQueue();
  }
  
  private recoverWorker(worker: Worker) {
    const index = this.workers.indexOf(worker);
    if (index === -1) return;
    
    try {
      // Terminate the broken worker
      worker.terminate();
      
      // Create a new worker to replace it
      const newWorker = new Worker(
        new URL('./monte-carlo.worker.server-parity.ts', import.meta.url),
        { type: 'module' }
      );
      
      newWorker.onmessage = (e) => this.handleWorkerMessage(newWorker, e);
      newWorker.onerror = (e) => this.handleWorkerError(newWorker, e);
      
      this.workers[index] = newWorker;
      
      // Remove from busy if it was busy
      if (this.busyWorkers.has(worker)) {
        this.busyWorkers.delete(worker);
      }
      
      // Add to available
      const availIndex = this.availableWorkers.indexOf(worker);
      if (availIndex !== -1) {
        this.availableWorkers[availIndex] = newWorker;
      } else {
        this.availableWorkers.push(newWorker);
      }
      
      console.log(`Worker ${index} recovered`);
      
    } catch (error) {
      console.error(`Failed to recover worker ${index}:`, error);
    }
  }
  
  private processQueue() {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        this.runSimulation(task.params, task.iterations)
          .then(task.resolve)
          .catch(task.reject);
      }
    }
  }
  
  async runSimulation(params: any, iterations: number = DEFAULT_ITERATIONS): Promise<any> {
    // Ensure pool is initialized
    await this.initialize();
    
    // If no workers available, fall back to server
    if (this.workers.length === 0) {
      return this.runServerSimulation(params);
    }
    
    // If all workers busy, queue the task
    if (this.availableWorkers.length === 0) {
      return new Promise((resolve, reject) => {
        this.taskQueue.push({ params, iterations, resolve, reject });
      });
    }
    
    // Distribute work across available workers
    const numWorkers = Math.min(this.availableWorkers.length, Math.ceil(iterations / 100));
    const iterationsPerWorker = Math.floor(iterations / numWorkers);
    const remainder = iterations % numWorkers;
    
    const workerPromises: Promise<any>[] = [];
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = this.availableWorkers.shift();
      if (!worker) break;
      
      const workerIterations = iterationsPerWorker + (i < remainder ? 1 : 0);
      const taskId = `${Date.now()}-${i}`;
      
      const promise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Worker timeout after ${this.workerTimeout}ms`));
          this.releaseWorker(worker);
        }, this.workerTimeout);
        
        const task: WorkerTask = {
          id: taskId,
          resolve,
          reject,
          timeoutId
        };
        
        this.busyWorkers.set(worker, task);
        
        const baseSeed = seedFromParams(params, 'workerPool');
        worker.postMessage({
          type: 'RUN_SIMULATION',
          id: taskId,
          params,
          iterations: workerIterations,
          batchSize: WORKER_BATCH_SIZE,
          startSeed: (baseSeed + i * 1000003) >>> 0
        });
      });
      
      workerPromises.push(promise);
    }
    
    try {
      const results = await Promise.all(workerPromises);
      return this.aggregateResults(results, iterations, params);
    } catch (error) {
      console.error('Worker pool simulation error:', error);
      throw error;
    }
  }
  
  private aggregateResults(results: any[], totalIterations: number, params: any): any {
    // Aggregate multiple worker results
    let totalSuccessful = 0;
    let totalFailed = 0;
    const allEndingBalances: number[] = [];
    
    results.forEach(result => {
      totalSuccessful += result.scenarios.successful;
      totalFailed += result.scenarios.failed;
      
      // Collect ending balances (simplified - in real implementation would be more sophisticated)
      for (let i = 0; i < result.scenarios.total; i++) {
        allEndingBalances.push(result.medianEndingBalance);
      }
    });
    
    allEndingBalances.sort((a, b) => a - b);
    
    const getPercentile = (p: number): number => {
      const index = Math.floor((p / 100) * (allEndingBalances.length - 1));
      return allEndingBalances[index] || 0;
    };
    
    return {
      probabilityOfSuccess: (totalSuccessful / totalIterations) * 100,
      medianEndingBalance: getPercentile(50),
      percentile10EndingBalance: getPercentile(10),
      percentile90EndingBalance: getPercentile(90),
      scenarios: {
        successful: totalSuccessful,
        failed: totalFailed,
        total: totalIterations
      },
      yearlyCashFlows: results[0]?.yearlyCashFlows || [],
      confidenceIntervals: {
        percentile10: getPercentile(10),
        percentile25: getPercentile(25),
        percentile50: getPercentile(50),
        percentile75: getPercentile(75),
        percentile90: getPercentile(90)
      }
    };
  }
  
  private async runServerSimulation(params: any): Promise<any> {
    // Provide a deterministic seed derived from params
    const baseSeed = seedFromParams(params, 'server-fallback');
    const response = await fetch('/api/calculate-retirement-monte-carlo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params, skipCache: true, seed: baseSeed })
    });
    
    if (!response.ok) {
      throw new Error('Server simulation failed');
    }
    
    return response.json();
  }
  
  getStatus(): {
    initialized: boolean;
    totalWorkers: number;
    availableWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
  } {
    return {
      initialized: this.isInitialized,
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      busyWorkers: this.busyWorkers.size,
      queuedTasks: this.taskQueue.length
    };
  }
  
  async terminate(): Promise<void> {
    // Clear all tasks
    this.taskQueue = [];
    
    // Clear timeouts and reject pending tasks
    this.busyWorkers.forEach((task, worker) => {
      clearTimeout(task.timeoutId);
      task.reject(new Error('Worker pool terminated'));
    });
    this.busyWorkers.clear();
    
    // Terminate all workers
    this.workers.forEach(worker => {
      try {
        worker.terminate();
      } catch (e) {
        console.error('Error terminating worker:', e);
      }
    });
    
    this.workers = [];
    this.availableWorkers = [];
    this.isInitialized = false;
    
    // Clear singleton instance
    MonteCarloWorkerPool.instance = null;
  }
}

// Export singleton instance getter
export const getWorkerPool = () => MonteCarloWorkerPool.getInstance();
