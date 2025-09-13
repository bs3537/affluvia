import type { Express, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Add req.realUser typing via declaration merging if needed (kept as any to avoid repo-wide type updates)

export function setupActingAsMiddleware(app: Express) {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only authenticated sessions can act-as
      if (!req.isAuthenticated || !req.isAuthenticated()) return next();

      // Preserve the real user for audit purposes
      (req as any).realUser = req.user;

      const path = req.path || '';
      // Skip swapping for auth/user/advisor/invite endpoints
      if (
        path.startsWith('/api/user') ||
        path.startsWith('/api/logout') ||
        path.startsWith('/api/advisor') ||
        path.startsWith('/api/invite')
      ) {
        return next();
      }

      const actingAsClientId = (req.session as any)?.actingAsClientId as number | undefined;
      if (!actingAsClientId) return next();

      const realUser = (req as any).realUser;
      if (!realUser || realUser.role !== 'advisor') {
        // Only advisors can act-as
        delete (req.session as any).actingAsClientId;
        return next();
      }

      // Verify advisor-client link is active
      const link = await storage.getAdvisorClientLink(realUser.id, actingAsClientId);
      if (!link || link.status !== 'active') {
        delete (req.session as any).actingAsClientId;
        return next();
      }

      // Load client and swap req.user for downstream routes
      const client = await storage.getUser(actingAsClientId);
      if (client) {
        (req as any).clientUser = client;
        (req as any).user = client;
      }
      return next();
    } catch (err) {
      console.error('Acting-as middleware error:', err);
      return next();
    }
  });
}

