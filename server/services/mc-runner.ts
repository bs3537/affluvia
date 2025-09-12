import os from 'os';
import { mcPool } from '../services/mc-pool';
import { DEFAULT_VARIANCE_REDUCTION } from '../monte-carlo-enhanced';

type ScorePart = {
  successes: number;
  total: number;
  medianEndingBalance: number;
  percentile10: number;
  percentile90: number;
  fullResult?: any;
};

type BandsPerYear = { [yearIndex: number]: { p05: number; p25: number; p50: number; p75: number; p95: number; count: number; age: number } };

export const RUNS_DEFAULT = Number(process.env.MC_SCENARIOS || 1000);
export const MAX_THREADS = Math.min(8, Math.max(2, os.cpus().length));

// Merge helper for score parts (weighted by runs per part)
function mergeScoreParts(parts: ScorePart[]) {
  const total = parts.reduce((s, p) => s + (p.total || 0), 0) || 0;
  const successes = parts.reduce((s, p) => s + (p.successes || 0), 0) || 0;

  // Weighted medians/percentiles (approximate)
  const w = (field: keyof ScorePart) =>
    Math.round(parts.reduce((s, p) => s + ((p[field] as number || 0) * ((p.total || 0) / (total || 1))), 0));

  const medianEndingBalance = w('medianEndingBalance');
  const percentile10 = w('percentile10');
  const percentile90 = w('percentile90');

  return { successes, total, medianEndingBalance, percentile10, percentile90 };
}

// Merge per-year percentiles from multiple workers by reconstructing approximate distributions per year
export function mergePerYearPercentiles(workerResults: BandsPerYear[]): BandsPerYear {
  const merged: { [yearIndex: number]: { values: number[]; age: number } } = {};

  workerResults.forEach(workerResult => {
    Object.keys(workerResult).forEach(yearIndexStr => {
      const yearIndex = parseInt(yearIndexStr);
      const yearData = workerResult[yearIndex];

      if (!merged[yearIndex]) {
        merged[yearIndex] = { values: [], age: yearData.age };
      }

      // Simulate a distribution from given percentiles using provided count
      const count = yearData.count || 100;
      const values: number[] = [];
      for (let i = 0; i < count; i++) {
        const percentile = (i / (count - 1)) * 100;
        if (percentile <= 5) values.push(yearData.p05);
        else if (percentile <= 25) values.push(yearData.p25);
        else if (percentile <= 50) values.push(yearData.p50);
        else if (percentile <= 75) values.push(yearData.p75);
        else values.push(yearData.p95);
      }
      merged[yearIndex].values.push(...values);
    });
  });

  const result: BandsPerYear = {};
  Object.keys(merged).forEach(yearIndexStr => {
    const yearIndex = parseInt(yearIndexStr);
    const yearData = merged[yearIndex];
    const sortedValues = yearData.values.sort((a, b) => a - b);
    if (sortedValues.length === 0) return;

    const pct = (p: number) => {
      const index = (p / 100) * (sortedValues.length - 1);
      if (index % 1 === 0) return sortedValues[index];
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    };

    result[yearIndex] = {
      p05: pct(5),
      p25: pct(25),
      p50: pct(50),
      p75: pct(75),
      p95: pct(95),
      count: sortedValues.length,
      age: yearData.age,
    };
  });

  return result;
}

export async function runMcScore(params: any, runs = RUNS_DEFAULT) {
  const threads = MAX_THREADS;
  const per = Math.floor(runs / threads);
  const remainder = runs - per * threads;

  const tasks = Array.from({ length: threads }, (_, i) => per + (i < remainder ? 1 : 0))
    .filter(n => n > 0)
    .map((n, i) => mcPool.run({ type: 'score', params, simulationCount: n, variance: DEFAULT_VARIANCE_REDUCTION, seed: i * 1000 }));

  const parts: ScorePart[] = await Promise.all(tasks);
  const merged = mergeScoreParts(parts);
  return { ...merged };
}

export async function runMcBands(params: any, runs = RUNS_DEFAULT, clampLongevityAge = 93) {
  const threads = MAX_THREADS;
  const per = Math.floor(runs / threads);
  const remainder = runs - per * threads;

  const tasks = Array.from({ length: threads }, (_, i) => per + (i < remainder ? 1 : 0))
    .filter(n => n > 0)
    .map((n, i) => mcPool.run({ type: 'bands', params, simulationCount: n, variance: DEFAULT_VARIANCE_REDUCTION, seed: i * 1000 }));

  const parts: { kind: 'bands'; perYear: BandsPerYear }[] = await Promise.all(tasks);

  // Merge per-year percentiles from all tasks
  const mergedPerYear = mergePerYearPercentiles(parts.map(p => p.perYear));

  // Convert merged object to arrays
  const sortedYears = Object.keys(mergedPerYear).map(k => parseInt(k)).sort((a, b) => a - b);
  const ages: number[] = [];
  const p05: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];

  for (const yearIdx of sortedYears) {
    const y = mergedPerYear[yearIdx];
    ages.push(y.age);
    p05.push(Math.max(0, y.p05));
    p25.push(Math.max(0, y.p25));
    p50.push(Math.max(0, y.p50));
    p75.push(Math.max(0, y.p75));
    p95.push(Math.max(0, y.p95));
  }

  // Longevity clamp to specified age (default 93)
  if (clampLongevityAge && ages.length > 0) {
    const currentAge = ages[0];
    const maxLen = Math.max(0, Math.min(ages.length, (clampLongevityAge - currentAge + 1)));
    if (maxLen > 0 && maxLen < ages.length) {
      ages.splice(maxLen);
      p05.splice(maxLen); p25.splice(maxLen); p50.splice(maxLen); p75.splice(maxLen); p95.splice(maxLen);
    }
  }

  return {
    ages,
    percentiles: { p05, p25, p50, p75, p95 },
    meta: {
      currentAge: ages[0] ?? undefined,
      retirementAge: undefined, // caller can set from params if needed
      longevityAge: ages.length ? ages[ages.length - 1] : undefined,
      runs,
      calculatedAt: new Date().toISOString(),
    },
  };
}

