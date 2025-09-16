import { optimizeEducationGoal } from '../education-optimizer';

interface EducationOptimizeTask {
  type: 'education-optimize';
  payload: Parameters<typeof optimizeEducationGoal>[0];
}

export default async function handler(task: EducationOptimizeTask) {
  if (task?.type !== 'education-optimize') {
    throw new Error(`[Education Optimizer Worker] Unknown task: ${JSON.stringify(task)}`);
  }
  return optimizeEducationGoal(task.payload);
}

