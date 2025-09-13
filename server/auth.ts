import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Middleware to require authentication
export function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "affluvia-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: false, // Set to false for development to avoid HTTPS issues
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax' // Allow cross-site requests for Replit environment
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      // Development bypass when database is unreachable
      if (process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
        console.log('[Auth] DEV_AUTH_BYPASS enabled - creating stub user');
        const stubUser = {
          id: 1,
          email: email,
          password: 'stub',
          role: 'individual' as const,
          fullName: 'Dev User',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        return done(null, stubUser);
      }

      try {
        const user = await storage.getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (err) {
        console.error('Login DB error:', err);
        return done(null, false, { message: 'Service temporarily unavailable' });
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: any, done) => {
    // Development bypass when database is unreachable
    if (process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
      const stubUser = {
        id: 1,
        email: 'dev@example.com',
        password: 'stub',
        role: 'individual' as const,
        fullName: 'Dev User',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return done(null, stubUser);
    }

    try {
      const userId = Number(id);
      if (!Number.isFinite(userId)) {
        console.warn('Invalid user id in session:', id);
        return done(null, false);
      }
      const user = await storage.getUser(userId);
      if (!user) {
        console.warn('No user found for session id:', userId);
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error('Error deserializing user:', error);
      // Fail gracefully by clearing auth for this request
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).send("Email already exists");
      }

      const user = await storage.createUser({
        email: req.body.email,
        password: await hashPassword(req.body.password),
        role: req.body.role || 'individual',
        fullName: req.body.fullName,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }
      if (!user) {
        const msg = info?.message || 'Invalid credentials';
        const status = msg === 'Service temporarily unavailable' ? 503 : 401;
        console.log('Login failed:', msg);
        return res.status(status).json({ error: msg });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login session error:', err);
          return next(err);
        }
        
        console.log('User logged in successfully:', user.id);
        
        // Extend session if remember me is checked
        if (req.body.rememberMe) {
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        } else {
          req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
        }
        
        // Auto-link any pending invites for this email
        (async () => {
          try {
            const pending = await storage.getPendingInvitesByEmail(user.email);
            for (const inv of pending) {
              await storage.linkAdvisorToClient(inv.advisorId, user.id);
              await storage.markInviteAccepted(inv.id, user.id);
            }
            if (pending.length) {
              console.log(`Auto-linked ${pending.length} advisor invite(s) for user ${user.email}`);
            }
          } catch (e) {
            console.error('Error auto-linking invites:', e);
          }
        })();

        // Ensure session is saved
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ error: 'Session save failed' });
          }
          console.log('Session saved successfully for user:', user.id);
          res.status(200).json(user);
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Cache statistics endpoint
  app.get("/api/cache/stats", async (req, res) => {
    try {
      const { cacheService } = await import('./services/cache.service');
      const stats = await cacheService.getStats();
      res.json({
        redis: stats,
        message: stats.enabled ? 'Redis cache is active' : 'Redis cache is disabled'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get cache stats' });
    }
  });
}
