import dotenv from "dotenv";
dotenv.config();
// Prefer IPv4 when resolving DB hosts (avoids EHOSTUNREACH on IPv6-only resolution)
import { setDefaultResultOrder } from 'node:dns';
try { setDefaultResultOrder('ipv4first'); } catch {}

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import PlaidSyncScheduler from "./services/plaid-sync-scheduler";
import { setupSecurityMiddleware } from "./middleware/security";

const app = express();

// Temporarily disable ALL security headers for Plaid testing in development
if (process.env.NODE_ENV === 'development') {
  console.log('[Server] DEVELOPMENT MODE - Security completely disabled for Plaid testing');
  
  // Add middleware to remove ALL security headers
  app.use((req, res, next) => {
    // Remove any CSP headers that might be set
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Content-Security-Policy');
    res.removeHeader('X-WebKit-CSP');
    res.removeHeader('Content-Security-Policy-Report-Only');
    
    // Allow everything for development
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    
    next();
  });
  
  // Basic CORS for development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });
} else {
  // Apply security middleware only in production
  setupSecurityMiddleware(app);
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Ignore harmless session table creation errors
    if (err && err.code === '42P07' && err.message?.includes('session_pkey')) {
      // Log it but don't send to client
      console.log('[SessionStore] Ignoring harmless duplicate key error');
      return res.status(200).json({ status: 'ok' });
    }
    
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('Error caught in middleware:', err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  // Use NODE_ENV directly instead of app.get("env") to ensure consistent behavior
  if (process.env.NODE_ENV === "development" && process.env.USE_VITE === "true") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 3007;
  log(`Attempting to start server on port ${port}...`);
  
  server.listen(port, () => {
    log(`Server successfully started and listening on port ${port}`);

    // Initialize Plaid sync scheduler (allow disabling via env)
    if (process.env.PLAID_SYNC_ENABLED !== 'false' && process.env.DISABLE_PLAID_AUTO_SYNC !== 'true') {
      PlaidSyncScheduler.initialize();
      log(`Plaid sync scheduler initialized`);
    } else {
      log(`Plaid sync scheduler disabled by env`);
    }

    // Start Plaid sync recovery scheduler
    import('./services/plaid-sync-recovery').then(({ startSyncRecoveryScheduler }) => {
      startSyncRecoveryScheduler();
      log(`Plaid sync recovery scheduler started`);
    });
  });
  
  server.on('error', (err: any) => {
    log(`Server error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use`);
    }
    process.exit(1);
  });
})();
