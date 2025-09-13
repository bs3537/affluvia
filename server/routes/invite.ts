import type { Express, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { storage } from '../storage';
import { users } from '@shared/schema';

import { promisify } from 'util';
import { scrypt, randomBytes } from 'crypto';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export function setupInviteRoutes(app: Express) {
  // Validate invite
  app.get('/api/invite/validate', async (req: Request, res: Response) => {
    const token = (req.query.token as string) || '';
    if (!token) return res.status(400).json({ error: 'token_required' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = await storage.getInviteByTokenHash(tokenHash);
    if (!invite) return res.status(404).json({ error: 'invalid_token' });
    if (invite.status !== 'sent') return res.status(400).json({ error: 'already_used' });
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return res.status(400).json({ error: 'expired' });
    const advisor = await storage.getUser(invite.advisorId);
    const maskedEmail = invite.email.replace(/(^.).*(@.*$)/, (_m, a, b) => `${a}*****${b}`);
    res.json({ ok: true, advisorName: advisor?.fullName || advisor?.email, email: maskedEmail, emailPlain: invite.email });
  });

  // Accept invite (new user flow)
  app.post('/api/invite/accept', async (req: Request, res: Response) => {
    const { token, password, email } = req.body as { token: string; password: string; email: string };
    if (!token || !password || !email) return res.status(400).json({ error: 'token_email_password_required' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = await storage.getInviteByTokenHash(tokenHash);
    if (!invite) return res.status(404).json({ error: 'invalid_token' });
    if (invite.status !== 'sent') return res.status(400).json({ error: 'already_used' });
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return res.status(400).json({ error: 'expired' });
    // Enforce email matches the invite email
    if (invite.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return res.status(400).json({ error: 'email_mismatch' });
    }

    const existingUser = await storage.getUserByEmail(invite.email);
    if (existingUser) {
      // Link immediately and mark accepted; user will log in next
      await storage.linkAdvisorToClient(invite.advisorId, existingUser.id);
      await storage.markInviteAccepted(invite.id, existingUser.id);
      return res.status(200).json({ ok: true, requiresLogin: true });
    }

    // Create new individual user (but do not auto-login); redirect to login afterwards
    const hashed = await hashPassword(password);
    const newUser = await storage.createUser({ email: invite.email, password: hashed, role: 'individual' });

    // Create link and mark invite accepted
    await storage.linkAdvisorToClient(invite.advisorId, newUser.id);
    await storage.markInviteAccepted(invite.id, newUser.id);

    return res.status(201).json({ ok: true, userCreated: true });
  });
}
