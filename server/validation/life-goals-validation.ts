import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Life goal schema for creation and updates
export const lifeGoalSchema = z.object({
  goalType: z.enum([
    'retirement',
    'education', 
    'home-purchase',
    'investment-property',
    'debt-free',
    'business',
    'custom'
  ]),
  goalName: z.string().min(1, 'Goal name is required').max(255),
  description: z.string().optional().nullable(),
  targetDate: z.string().refine((val) => {
    if (!val) return true; // Allow null/undefined
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Invalid date format').optional().nullable(),
  targetAmount: z.number().min(0).optional().nullable(),
  currentAmount: z.number().min(0).default(0),
  monthlyContribution: z.number().min(0).default(0),
  fundingPercentage: z.number().min(0).max(10000).default(0), // Allow up to 10000% for overfunded goals
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  status: z.enum(['on-track', 'at-risk', 'behind', 'completed']).default('behind'),
  fundingSources: z.any().optional().nullable(), // JSON field
  metadata: z.any().optional().nullable(), // JSON field
  linkedEntityId: z.string().optional().nullable(),
  linkedEntityType: z.string().optional().nullable()
});

// Partial schema for updates
export const lifeGoalUpdateSchema = lifeGoalSchema.partial();

// ID parameter schema
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid ID format').transform(val => parseInt(val, 10))
});

// Validation middleware
export function validateLifeGoalCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = lifeGoalSchema.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    next(error);
  }
}

export function validateLifeGoalUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = lifeGoalUpdateSchema.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    next(error);
  }
}

export function validateIdParam(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    req.params.id = id.toString();
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid ID parameter',
        details: error.errors
      });
    }
    next(error);
  }
}

// Business logic validation
export async function validateLifeGoalBusinessLogic(
  goalData: any,
  userId: number
): Promise<{ valid: boolean; errors?: string[] }> {
  const errors: string[] = [];

  // Validate target date is in the future
  if (goalData.targetDate) {
    const targetDate = new Date(goalData.targetDate);
    if (targetDate <= new Date()) {
      errors.push('Target date must be in the future');
    }
  }

  // Validate funding percentage calculation
  if (goalData.targetAmount && goalData.currentAmount !== undefined) {
    const calculatedPercentage = (goalData.currentAmount / goalData.targetAmount) * 100;
    // Allow some tolerance for rounding
    if (Math.abs(calculatedPercentage - (goalData.fundingPercentage || 0)) > 1) {
      // Just a warning, auto-correct it
      goalData.fundingPercentage = calculatedPercentage;
    }
  }

  // Validate monthly contribution is reasonable
  if (goalData.monthlyContribution > 100000) {
    errors.push('Monthly contribution seems unreasonably high (> $100,000)');
  }

  // Validate linked entities exist (if specified)
  if (goalData.linkedEntityId && goalData.linkedEntityType === 'education_goals') {
    // TODO: Check if education goal exists for this user
    // This would require database query
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}