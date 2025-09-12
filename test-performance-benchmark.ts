import { 
  runEnhancedMonteCarloSimulation,
  runParallelMonteCarloSimulation,
  StreamingStatistics,
  CalculationCache,
  globalCache,
  DEFAULT_RETURN_CONFIG,
  DEFAULT_VARIANCE_REDUCTION
} from './server/monte-carlo-enhanced';
import { RetirementMonteCarloParams } from './server/monte-carlo-base';
import * as os from 'os';

console.log('=== Monte Carlo Performance Benchmark ===\n');
console.log('System Information:');
console.log(`  CPU Cores: ${os.cpus().length}`);
console.log(`  CPU Model: ${os.cpus()[0].model}`);
console.log(`  Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`  Free Memory: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB\n`);

// Test profile
const testParams: RetirementMonteCarloParams = {
  currentAge: 50,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentRetirementAssets: 500000,
  annualSavings: 20000,
  annualRetirementExpenses: 60000,
  annualGuaranteedIncome: 20000,
  expectedReturn: 0.07,
  returnVolatility: 0.15,
  inflationRate: 0.025,
  withdrawalRate: 0.04,
  stockAllocation: 0.60,
  bondAllocation: 0.35,
  cashAllocation: 0.05,
  taxRate: 0.22,
  filingStatus: 'single' as const,
  useGuardrails: true,
  assetBuckets: {
    taxDeferred: 350000,
    taxFree: 100000,
    capitalGains: 50000,
    cashEquivalents: 0,
    totalAssets: 500000
  }
};

// Test configurations
interface TestConfig {
  name: string;
  iterations: number;
  useParallel?: boolean;
  workers?: number;
  useStreaming?: boolean;
  useVarianceReduction?: boolean;
  useCache?: boolean;
}

const testConfigs: TestConfig[] = [
  {
    name: 'Baseline (1000 iterations)',
    iterations: 1000,
    useParallel: false,
    useStreaming: false,
    useVarianceReduction: false,
    useCache: false
  },
  {
    name: 'With Streaming Stats',
    iterations: 1000,
    useParallel: false,
    useStreaming: true,
    useVarianceReduction: false,
    useCache: false
  },
  {
    name: 'With Caching',
    iterations: 1000,
    useParallel: false,
    useStreaming: false,
    useVarianceReduction: false,
    useCache: true
  },
  {
    name: 'With Variance Reduction',
    iterations: 1000,
    useParallel: false,
    useStreaming: false,
    useVarianceReduction: true,
    useCache: false
  },
  {
    name: 'All Optimizations (Sequential)',
    iterations: 1000,
    useParallel: false,
    useStreaming: true,
    useVarianceReduction: true,
    useCache: true
  },
  {
    name: 'Parallel (2 workers)',
    iterations: 1000,
    useParallel: true,
    workers: 2,
    useStreaming: true,
    useVarianceReduction: true,
    useCache: true
  },
  {
    name: 'Parallel (4 workers)',
    iterations: 1000,
    useParallel: true,
    workers: 4,
    useStreaming: true,
    useVarianceReduction: true,
    useCache: true
  },
  {
    name: 'Parallel (8 workers)',
    iterations: 1000,
    useParallel: true,
    workers: 8,
    useStreaming: true,
    useVarianceReduction: true,
    useCache: true
  },
  {
    name: 'Large Scale (10000 iterations, 4 workers)',
    iterations: 10000,
    useParallel: true,
    workers: 4,
    useStreaming: true,
    useVarianceReduction: true,
    useCache: true
  }
];

// Results storage
interface BenchmarkResult {
  name: string;
  iterations: number;
  timeMs: number;
  memoryUsedMB: number;
  successRate: number;
  speedup: number;
  throughput: number;
}

const results: BenchmarkResult[] = [];

// Memory measurement helper
function getMemoryUsageMB(): number {
  if (global.gc) {
    global.gc(); // Force garbage collection if available
  }
  const usage = process.memoryUsage();
  return usage.heapUsed / 1024 / 1024;
}

// Run benchmarks
async function runBenchmarks() {
  console.log('Starting benchmarks...\n');
  console.log('='.repeat(80));
  
  let baselineTime = 0;
  
  for (const config of testConfigs) {
    console.log(`\n${config.name}`);
    console.log('-'.repeat(40));
    
    // Clear cache before each test
    globalCache.clear();
    
    const memBefore = getMemoryUsageMB();
    const startTime = Date.now();
    
    let result: any;
    
    try {
      if (config.useParallel) {
        // Run parallel simulation
        result = await runParallelMonteCarloSimulation(
          testParams,
          config.iterations,
          config.workers || 4,
          false, // verbose
          DEFAULT_RETURN_CONFIG,
          config.useVarianceReduction ? DEFAULT_VARIANCE_REDUCTION : {
            useAntitheticVariates: false,
            useControlVariates: false,
            useStratifiedSampling: false
          }
        );
      } else {
        // Run sequential simulation
        result = runEnhancedMonteCarloSimulation(
          testParams,
          config.iterations,
          false, // verbose
          DEFAULT_RETURN_CONFIG,
          config.useVarianceReduction ? DEFAULT_VARIANCE_REDUCTION : {
            useAntitheticVariates: false,
            useControlVariates: false,
            useStratifiedSampling: false
          },
          config.useStreaming || false
        );
      }
      
      const elapsed = Date.now() - startTime;
      const memAfter = getMemoryUsageMB();
      const memUsed = memAfter - memBefore;
      
      // Store baseline time
      if (config.name.includes('Baseline')) {
        baselineTime = elapsed;
      }
      
      const speedup = baselineTime > 0 ? baselineTime / elapsed : 1;
      const throughput = (config.iterations / elapsed) * 1000; // iterations per second
      
      results.push({
        name: config.name,
        iterations: config.iterations,
        timeMs: elapsed,
        memoryUsedMB: memUsed,
        successRate: result.successProbability || result.probabilityOfSuccess,
        speedup,
        throughput
      });
      
      console.log(`  Time: ${elapsed}ms`);
      console.log(`  Memory Used: ${memUsed.toFixed(2)} MB`);
      console.log(`  Success Rate: ${((result.successProbability || result.probabilityOfSuccess) * 100).toFixed(2)}%`);
      console.log(`  Throughput: ${throughput.toFixed(1)} iter/s`);
      console.log(`  Speedup: ${speedup.toFixed(2)}x`);
      
      // Show cache stats if caching was used
      if (config.useCache) {
        const cacheStats = globalCache.getStats();
        console.log(`  Cache Size: ${cacheStats.size} entries`);
      }
      
    } catch (error) {
      console.log(`  ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n### PERFORMANCE SUMMARY ###\n');
  
  // Sort by speedup
  const sortedResults = [...results].sort((a, b) => b.speedup - a.speedup);
  
  console.log('Top Performers by Speedup:');
  console.log('-'.repeat(40));
  for (let i = 0; i < Math.min(5, sortedResults.length); i++) {
    const r = sortedResults[i];
    console.log(`${i + 1}. ${r.name}`);
    console.log(`   Speedup: ${r.speedup.toFixed(2)}x | Time: ${r.timeMs}ms | Throughput: ${r.throughput.toFixed(1)} iter/s`);
  }
  
  // Memory efficiency
  console.log('\n\nMemory Efficiency:');
  console.log('-'.repeat(40));
  const memoryResults = [...results].sort((a, b) => a.memoryUsedMB - b.memoryUsedMB);
  for (let i = 0; i < Math.min(3, memoryResults.length); i++) {
    const r = memoryResults[i];
    console.log(`${i + 1}. ${r.name}: ${r.memoryUsedMB.toFixed(2)} MB`);
  }
  
  // Scaling analysis
  console.log('\n\nParallel Scaling Analysis:');
  console.log('-'.repeat(40));
  const parallelResults = results.filter(r => r.name.includes('Parallel'));
  for (const r of parallelResults) {
    const workers = parseInt(r.name.match(/(\d+) workers?/)?.[1] || '1');
    const efficiency = (r.speedup / workers) * 100;
    console.log(`${workers} workers: ${r.speedup.toFixed(2)}x speedup, ${efficiency.toFixed(1)}% efficiency`);
  }
  
  // Optimization impact
  console.log('\n\nOptimization Impact:');
  console.log('-'.repeat(40));
  const baseline = results.find(r => r.name.includes('Baseline'));
  const allOpt = results.find(r => r.name.includes('All Optimizations'));
  if (baseline && allOpt) {
    const improvement = ((baseline.timeMs - allOpt.timeMs) / baseline.timeMs) * 100;
    const memReduction = ((baseline.memoryUsedMB - allOpt.memoryUsedMB) / baseline.memoryUsedMB) * 100;
    console.log(`Time Reduction: ${improvement.toFixed(1)}%`);
    console.log(`Memory Reduction: ${memReduction.toFixed(1)}%`);
    console.log(`Overall Speedup: ${(baseline.timeMs / allOpt.timeMs).toFixed(2)}x`);
  }
  
  // Recommendations
  console.log('\n\n### RECOMMENDATIONS ###');
  console.log('-'.repeat(40));
  
  const cpuCores = os.cpus().length;
  const optimalWorkers = Math.min(cpuCores - 1, 4);
  console.log(`✓ Optimal worker count for this system: ${optimalWorkers}`);
  
  const bestConfig = sortedResults[0];
  console.log(`✓ Best configuration: ${bestConfig.name}`);
  console.log(`  - ${bestConfig.speedup.toFixed(1)}x faster than baseline`);
  console.log(`  - ${bestConfig.throughput.toFixed(0)} iterations/second`);
  
  if (bestConfig.memoryUsedMB < 100) {
    console.log(`✓ Memory usage is excellent (${bestConfig.memoryUsedMB.toFixed(1)} MB)`);
  }
  
  console.log('\n=== Benchmark Complete ===');
}

// Run the benchmarks
runBenchmarks().catch(console.error);