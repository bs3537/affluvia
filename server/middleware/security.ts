import { Request, Response, NextFunction } from 'express';
import { SecurityConfig } from '../services/encryption-service';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cors from 'cors';
import { db } from '../db';
import { userConsents } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Security middleware for Express application
 */
export function setupSecurityMiddleware(app: any) {
  // Disable CSP entirely in development for Plaid Link
  if (process.env.NODE_ENV === 'development') {
    console.log('[Security] Running in development mode - CSP relaxed for Plaid Link');
    app.use(helmet({
      contentSecurityPolicy: false,  // Disable CSP in development
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));
  } else {
    // Production CSP configuration
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", "https://*.plaid.com"],
          scriptSrc: [
            "'self'", 
            "'unsafe-inline'", 
            "'unsafe-eval'",
            "https://cdn.plaid.com", 
            "https://*.plaid.com",
            "https://cdn.jsdelivr.net"
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.plaid.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:", "https://*.plaid.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: [
            "'self'",
            "https://*.plaid.com",
            "https://api.plaid.com",
            "https://cdn.plaid.com",
            "https://sandbox.plaid.com",
            "https://production.plaid.com",
            "https://generativelanguage.googleapis.com",
            "wss://*",
            "ws://*"
          ],
          frameSrc: [
            "'self'", 
            "https://cdn.plaid.com",
            "https://*.plaid.com"
          ],
          frameAncestors: ["'self'"],
          childSrc: ["'self'", "https://*.plaid.com", "https://cdn.plaid.com"],
          workerSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));
  }

  // Additional security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    const headers = SecurityConfig.getSecurityHeaders();
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    next();
  });

  // Rate limiting for API endpoints
  // General API rate limit
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  });

  // Strict rate limit for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true
  });

  // Plaid webhook rate limit (more lenient for webhooks)
  const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Allow up to 30 webhook calls per minute
    message: 'Webhook rate limit exceeded'
  });

  // Apply rate limiters
  app.use('/api/', apiLimiter);
  app.use('/api/auth/', authLimiter);
  app.use('/api/plaid/webhook', webhookLimiter);

  // Request sanitization
  app.use(mongoSanitize());

  // XSS protection
  app.use(xss());

  // Prevent parameter pollution
  app.use(hpp());

  // CORS configuration for production
  const corsOptions = {
    origin: function (origin: string, callback: any) {
      const allowedOrigins = process.env.NODE_ENV === 'development' 
        ? [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
          'http://localhost:3004',
          'http://localhost:5173',
          'http://localhost:5174',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3002',
          'http://127.0.0.1:3003',
          'http://127.0.0.1:3004',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:5174'
        ]
        : [
          'https://affluvia.com',
          'https://www.affluvia.com',
          'https://app.affluvia.com'
        ];
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In development, log the origin for debugging CORS issues
      if (process.env.NODE_ENV === 'development' && allowedOrigins.indexOf(origin) === -1) {
        console.log(`[CORS] Rejected origin: ${origin}`);
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200
  };
  
  app.use(cors(corsOptions));

  // Request logging for security audit
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Log security-relevant requests
    if (req.path.includes('/api/plaid') || 
        req.path.includes('/api/auth') ||
        req.path.includes('/api/financial-profile')) {
      console.log(`[Security Audit] ${req.method} ${req.path} from ${req.ip}`);
    }
    next();
  });

  // Error handling middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // Log security errors
    if (err.name === 'UnauthorizedError') {
      console.error('[Security] Unauthorized access attempt:', {
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Don't leak error details in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    next(err);
  });
}

/**
 * Configure TLS settings for HTTPS server
 */
export function getTLSConfig() {
  const tlsConfig = SecurityConfig.getTLSConfig();
  
  return {
    // TLS version settings
    secureProtocol: 'TLSv1_3_method',
    
    // Cipher suites
    ciphers: tlsConfig.ciphers,
    
    // Reject unauthorized connections
    rejectUnauthorized: true,
    
    // Enable OCSP stapling
    requestOCSP: true,
    
    // Session resumption
    sessionTimeout: 300,
    
    // Honor cipher order
    honorCipherOrder: true
  };
}

/**
 * Middleware to check user consent before processing Plaid data
 */
export async function requirePlaidConsent(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user has granted Plaid consent
  // Database imports are already at the top
  
  const consent = await db
    .select()
    .from(userConsents)
    .where(
      and(
        eq(userConsents.userId, req.user.id),
        eq(userConsents.consentType, 'plaid_data_sharing'),
        eq(userConsents.granted, true)
      )
    )
    .limit(1);

  if (consent.length === 0) {
    return res.status(403).json({ 
      error: 'Consent required',
      message: 'Please grant consent to connect your financial accounts'
    });
  }

  next();
}

export default {
  setupSecurityMiddleware,
  getTLSConfig,
  requirePlaidConsent
};