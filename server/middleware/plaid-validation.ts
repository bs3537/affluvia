import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Validation middleware for Plaid API endpoints
 */

// Date validation schema
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// Common validation schemas
const schemas = {
  // Exchange public token
  exchangeToken: z.object({
    publicToken: z.string().min(1, 'Public token is required'),
    institutionId: z.string().optional(),
    institutionName: z.string().optional()
  }),

  // Update link mode
  updateLinkMode: z.object({
    itemId: z.string().min(1, 'Item ID is required')
  }),

  // Sync transactions with date range
  syncTransactions: z.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    itemId: z.string().optional(),
    count: z.number().min(1).max(500).optional()
  }),

  // Manual sync
  manualSync: z.object({
    syncTypes: z.array(z.enum(['accounts', 'transactions', 'investments', 'liabilities'])).optional()
  }),

  // Account mapping
  accountMapping: z.object({
    accountId: z.string().min(1, 'Account ID is required'),
    accountCategory: z.enum([
      'checking',
      'savings',
      'emergency_fund',
      'retirement_401k',
      'retirement_ira',
      'retirement_roth',
      'investment_taxable',
      'investment_529',
      'investment_other',
      'credit_card',
      'mortgage',
      'student_loan',
      'personal_loan',
      'auto_loan',
      'other_asset',
      'other_liability'
    ]),
    isEmergencyFund: z.boolean().optional(),
    is529Account: z.boolean().optional(),
    excludeFromCalculations: z.boolean().optional(),
    customName: z.string().max(100).optional(),
    notes: z.string().max(500).optional()
  }),

  // Get accounts
  getAccounts: z.object({
    itemId: z.string().optional(),
    includeBalances: z.boolean().optional()
  }),

  // Get transactions
  getTransactions: z.object({
    accountId: z.string().optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    limit: z.number().min(1).max(500).optional(),
    offset: z.number().min(0).optional(),
    categories: z.array(z.string()).optional()
  }),

  // Get investment holdings
  getInvestments: z.object({
    accountId: z.string().optional()
  }),

  // Delete item
  deleteItem: z.object({
    itemId: z.string().min(1, 'Item ID is required')
  }),

  // Financial data aggregation
  getAggregatedData: z.object({
    forceRefresh: z.boolean().optional()
  }),

  // Cash flow calculation
  getCashFlow: z.object({
    months: z.number().min(1).max(12).optional(),
    includeProjections: z.boolean().optional()
  }),

  // Auto categorize
  autoCategorize: z.object({
    overwriteExisting: z.boolean().optional()
  }),

  // Update consent
  updateConsent: z.object({
    consentType: z.enum(['plaid_data_sync', 'transaction_analysis', 'investment_tracking']),
    granted: z.boolean()
  }),

  // Webhook
  webhook: z.object({
    webhook_type: z.string(),
    webhook_code: z.string(),
    item_id: z.string().optional(),
    error: z.object({
      error_code: z.string(),
      error_message: z.string()
    }).optional(),
    new_accounts: z.number().optional(),
    removed_accounts: z.array(z.string()).optional(),
    new_transactions: z.number().optional(),
    removed_transactions: z.array(z.string()).optional()
  })
};

/**
 * Validate request body against schema
 */
function validateBody(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }
      
      return res.status(400).json({
        error: 'Invalid request data'
      });
    }
  };
}

/**
 * Validate query parameters against schema
 */
function validateQuery(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Convert string values to appropriate types
      const query = { ...req.query };
      
      // Convert string 'true'/'false' to boolean
      Object.keys(query).forEach(key => {
        if (query[key] === 'true') query[key] = true as any;
        if (query[key] === 'false') query[key] = false as any;
        
        // Convert numeric strings to numbers
        if (typeof query[key] === 'string' && !isNaN(Number(query[key]))) {
          const num = Number(query[key]);
          if (key === 'limit' || key === 'offset' || key === 'months' || key === 'count') {
            query[key] = num as any;
          }
        }
      });
      
      const validated = await schema.parseAsync(query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: errors
        });
      }
      
      return res.status(400).json({
        error: 'Invalid query parameters'
      });
    }
  };
}

/**
 * Rate limiting tracking (in-memory, use Redis in production)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: Date }>();

/**
 * Simple rate limiting middleware
 */
export function rateLimit(maxRequests: number = 10, windowMinutes: number = 1) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.sendStatus(401);
    
    const key = `${req.user.id}:${req.path}`;
    const now = new Date();
    const windowMs = windowMinutes * 60 * 1000;
    
    const userLimit = rateLimitStore.get(key);
    
    if (!userLimit || userLimit.resetAt < now) {
      // New window
      rateLimitStore.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + windowMs)
      });
      return next();
    }
    
    if (userLimit.count >= maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetAt.getTime() - now.getTime()) / 1000);
      
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', userLimit.resetAt.toISOString());
      
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter,
        resetAt: userLimit.resetAt
      });
    }
    
    userLimit.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - userLimit.count).toString());
    res.setHeader('X-RateLimit-Reset', userLimit.resetAt.toISOString());
    
    next();
  };
}

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = new Date();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// Export validation middleware
export const validate = {
  body: {
    exchangeToken: validateBody(schemas.exchangeToken),
    updateLinkMode: validateBody(schemas.updateLinkMode),
    syncTransactions: validateBody(schemas.syncTransactions),
    manualSync: validateBody(schemas.manualSync),
    accountMapping: validateBody(schemas.accountMapping),
    deleteItem: validateBody(schemas.deleteItem),
    updateConsent: validateBody(schemas.updateConsent),
    webhook: validateBody(schemas.webhook)
  },
  query: {
    getAccounts: validateQuery(schemas.getAccounts),
    getTransactions: validateQuery(schemas.getTransactions),
    getInvestments: validateQuery(schemas.getInvestments),
    getAggregatedData: validateQuery(schemas.getAggregatedData),
    getCashFlow: validateQuery(schemas.getCashFlow),
    autoCategorize: validateQuery(schemas.autoCategorize)
  }
};

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove any HTML tags and script content
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Middleware to sanitize all incoming data
 */
export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction) {
  req.body = sanitizeInput(req.body);
  req.query = sanitizeInput(req.query) as any;
  req.params = sanitizeInput(req.params) as any;
  next();
}