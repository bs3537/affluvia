import { z } from 'zod';

// Enum for debt types
export const debtTypeEnum = z.enum([
  'credit_card',
  'federal_student_loan',
  'private_student_loan',
  'auto_loan',
  'personal_loan',
  'mortgage',
  'other'
]);

// Enum for payoff strategies
export const payoffStrategyEnum = z.enum([
  'avalanche',
  'snowball',
  'hybrid',
  'custom'
]);

// Base debt schema for creation and updates
export const debtSchema = z.object({
  debtName: z.string()
    .min(1, 'Debt name is required')
    .max(100, 'Debt name must be less than 100 characters')
    .trim(),
  
  debtType: debtTypeEnum,
  
  currentBalance: z.number()
    .positive('Current balance must be positive')
    .max(10000000, 'Balance cannot exceed $10,000,000')
    .refine(val => !isNaN(val), 'Must be a valid number'),
  
  originalBalance: z.number()
    .positive('Original balance must be positive')
    .max(10000000, 'Balance cannot exceed $10,000,000')
    .optional(),
  
  annualInterestRate: z.number()
    .min(0, 'Interest rate cannot be negative')
    .max(100, 'Interest rate cannot exceed 100%')
    .refine(val => !isNaN(val), 'Must be a valid number'),
  
  minimumPayment: z.number()
    .positive('Minimum payment must be positive')
    .max(100000, 'Minimum payment cannot exceed $100,000'),
  
  paymentDueDate: z.number()
    .int()
    .min(1, 'Payment due date must be between 1 and 31')
    .max(31, 'Payment due date must be between 1 and 31')
    .optional(),
  
  extraPayment: z.number()
    .min(0, 'Extra payment cannot be negative')
    .max(100000, 'Extra payment cannot exceed $100,000')
    .optional()
    .default(0),
  
  isPromotionalRate: z.boolean().optional().default(false),
  
  promotionalRateEndDate: z.string()
    .optional()
    .refine(val => !val || !isNaN(Date.parse(val)), 'Must be a valid date'),
  
  promotionalRate: z.number()
    .min(0)
    .max(100)
    .optional(),
  
  creditorName: z.string()
    .max(200)
    .optional(),
  
  accountNumber: z.string()
    .max(50)
    .optional(),
  
  notes: z.string()
    .max(1000)
    .optional(),
  
  isActive: z.boolean().optional().default(true)
});

// Validation with business logic
export const validateDebtWithBusinessLogic = (debt: z.infer<typeof debtSchema>) => {
  const errors: string[] = [];
  
  // Check if minimum payment covers at least the interest
  const monthlyInterestRate = debt.annualInterestRate / 100 / 12;
  const monthlyInterest = debt.currentBalance * monthlyInterestRate;
  
  if (debt.minimumPayment < monthlyInterest) {
    errors.push(`Minimum payment ($${debt.minimumPayment}) must be at least equal to monthly interest ($${monthlyInterest.toFixed(2)})`);
  }
  
  // Check promotional rate logic
  if (debt.isPromotionalRate) {
    if (!debt.promotionalRate && debt.promotionalRate !== 0) {
      errors.push('Promotional rate is required when promotional rate is enabled');
    }
    if (!debt.promotionalRateEndDate) {
      errors.push('Promotional rate end date is required when promotional rate is enabled');
    } else {
      const endDate = new Date(debt.promotionalRateEndDate);
      if (endDate <= new Date()) {
        errors.push('Promotional rate end date must be in the future');
      }
    }
  }
  
  // Validate payment due date based on current month
  if (debt.paymentDueDate) {
    const currentDate = new Date();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    if (debt.paymentDueDate > daysInMonth) {
      errors.push(`Payment due date (${debt.paymentDueDate}) exceeds days in current month (${daysInMonth})`);
    }
  }
  
  return errors;
};

// Payoff plan creation schema
export const payoffPlanSchema = z.object({
  planName: z.string()
    .min(1, 'Plan name is required')
    .max(100)
    .trim(),
  
  strategy: payoffStrategyEnum,
  
  totalMonthlyPayment: z.number()
    .positive('Monthly payment must be positive')
    .max(1000000),
  
  targetPayoffMonths: z.number()
    .int()
    .min(1)
    .max(600)
    .optional(),
  
  customOrder: z.array(z.number().int().positive()).optional(),
  
  includeWinfall: z.boolean().optional().default(false),
  
  winfallAmount: z.number()
    .min(0)
    .optional(),
  
  winfallFrequency: z.enum(['once', 'monthly', 'quarterly', 'annually']).optional()
});

// Scenario planning schema
export const scenarioSchema = z.object({
  scenarioName: z.string()
    .min(1)
    .max(100)
    .trim(),
  
  scenarioType: z.enum([
    'extra_payment',
    'rate_change',
    'balance_transfer',
    'consolidation',
    'settlement'
  ]),
  
  parameters: z.record(z.any()),
  
  notes: z.string().max(1000).optional()
});

// Payment recording schema
export const paymentSchema = z.object({
  debtId: z.number().int().positive(),
  
  paymentAmount: z.number()
    .positive('Payment amount must be positive')
    .max(1000000),
  
  paymentDate: z.string()
    .refine(val => !isNaN(Date.parse(val)), 'Must be a valid date'),
  
  principalPaid: z.number()
    .min(0)
    .optional(),
  
  interestPaid: z.number()
    .min(0)
    .optional(),
  
  remainingBalance: z.number()
    .min(0)
    .optional(),
  
  notes: z.string().max(500).optional()
});

// ID validation schema
export const idParamSchema = z.object({
  id: z.string().transform((val, ctx) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid ID parameter'
      });
      return z.NEVER;
    }
    return parsed;
  })
});

// Batch operations schema
export const batchDebtUpdateSchema = z.object({
  debtIds: z.array(z.number().int().positive()),
  updates: z.object({
    isActive: z.boolean().optional(),
    extraPayment: z.number().min(0).optional()
  })
});

// Export validation middleware factory
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.validatedBody = validated;
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
      return res.status(500).json({ error: 'Internal validation error' });
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.params);
      req.validatedParams = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      return res.status(500).json({ error: 'Internal validation error' });
    }
  };
};