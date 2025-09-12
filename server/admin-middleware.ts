import { Request, Response, NextFunction } from 'express';

const ADMIN_EMAIL = 'bhav@live.com';

export function isAdmin(req: Request): boolean {
  return req.user?.email === ADMIN_EMAIL;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}