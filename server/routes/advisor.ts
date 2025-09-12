import type { Express, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { storage } from '../storage';
import { users, advisorClients, chatMessages, estateDocuments, goals } from '@shared/schema';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { sendAdvisorInviteEmail } from '../email-service';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.sendStatus(401);
  next();
}

function requireAdvisor(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user || (req as any).user.role !== 'advisor') return res.sendStatus(403);
  next();
}

export function setupAdvisorRoutes(app: Express) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
  // List clients
  app.get('/api/advisor/clients', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const clients = await storage.getAdvisorClients(advisorId);
    res.json(clients);
  });

  // Link existing client by email
  app.post('/api/advisor/link-client', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: 'email required' });
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'client_not_found' });
    const link = await storage.linkAdvisorToClient(advisorId, user.id);
    res.json({ ok: true, link });
  });

  // Unlink client
  app.delete('/api/advisor/clients/:clientId', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const clientId = parseInt(req.params.clientId, 10);
    const [updated] = await db
      .update(advisorClients)
      .set({ status: 'removed' })
      .where(and(eq(advisorClients.advisorId, advisorId), eq(advisorClients.clientId, clientId)))
      .returning();
    res.json({ ok: true, link: updated });
  });

  // Create invite
  app.post('/api/advisor/invite', requireAuth, requireAdvisor, async (req, res) => {
    const advisor = (req as any).user as any;
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: 'email required' });
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await storage.createAdvisorInvite(advisor.id, email, tokenHash, expiresAt);
    const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    const link = `${origin}/invite/accept?token=${token}`;
    await sendAdvisorInviteEmail({ 
      to: email, 
      advisorName: advisor.fullName || advisor.email, 
      link, 
      replyTo: advisor.email 
    });
    res.json({ ok: true, inviteId: invite.id });
  });

  // List pending invites
  app.get('/api/advisor/invites', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const invites = await storage.getAdvisorInvites(advisorId);
    res.json(invites);
  });

  // Resend invite (regenerate token and expiry)
  app.post('/api/advisor/invites/:inviteId/resend', requireAuth, requireAdvisor, async (req, res) => {
    const advisor = (req as any).user as any;
    const inviteId = parseInt(req.params.inviteId, 10);
    const invites = await storage.getAdvisorInvites(advisor.id);
    const invite = invites.find(i => i.id === inviteId);
    if (!invite) return res.status(404).json({ error: 'invite_not_found' });
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storage.updateAdvisorInviteToken(inviteId, tokenHash, expiresAt);
    const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    const link = `${origin}/invite/accept?token=${token}`;
    await sendAdvisorInviteEmail({ 
      to: invite.email, 
      advisorName: advisor.fullName || advisor.email, 
      link, 
      replyTo: advisor.email
    });
    res.json({ ok: true });
  });

  // Cancel invite
  app.delete('/api/advisor/invites/:inviteId', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const inviteId = parseInt(req.params.inviteId, 10);
    // Optional: ensure invite belongs to advisor
    const invites = await storage.getAdvisorInvites(advisorId);
    if (!invites.find(i => i.id === inviteId)) return res.status(404).json({ error: 'invite_not_found' });
    await storage.cancelAdvisorInvite(inviteId);
    res.json({ ok: true });
  });

  // Acting-as: open client
  app.post('/api/advisor/open-client/:clientId', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const clientId = parseInt(req.params.clientId, 10);
    const link = await storage.getAdvisorClientLink(advisorId, clientId);
    if (!link || link.status !== 'active') return res.status(403).json({ error: 'not_linked' });
    (req.session as any).actingAsClientId = clientId;
    req.session.save(() => res.json({ ok: true }));
  });

  // Acting-as: close
  app.post('/api/advisor/close-client', requireAuth, requireAdvisor, async (req, res) => {
    delete (req.session as any).actingAsClientId;
    req.session.save(() => res.json({ ok: true }));
  });

  // Acting-as session status
  app.get('/api/advisor/session', requireAuth, requireAdvisor, async (req, res) => {
    const clientId = (req.session as any).actingAsClientId as number | undefined;
    if (!clientId) return res.json({ isActingAs: false, client: null });
    const client = await storage.getUser(clientId);
    res.json({ isActingAs: true, client: client ? { id: client.id, email: client.email, fullName: client.fullName } : null });
  });

  // Client summary (for details drawer)
  app.get('/api/advisor/client-summary/:clientId', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const clientId = parseInt(req.params.clientId, 10);
    const link = await storage.getAdvisorClientLink(advisorId, clientId);
    if (!link || link.status === 'removed') return res.status(403).json({ error: 'not_linked' });

    const client = await storage.getUser(clientId);
    if (!client) return res.status(404).json({ error: 'not_found' });
    const profile = await storage.getFinancialProfile(clientId);

    const chats = await db.execute(sql`SELECT COUNT(*)::int AS count, MAX(timestamp) AS last FROM chat_messages WHERE user_id = ${clientId}`);
    const goalsCount = await db.execute(sql`SELECT COUNT(*)::int AS count, MAX(updated_at) AS last FROM goals WHERE user_id = ${clientId}`);
    const docs = await db.execute(sql`SELECT COUNT(*)::int AS count, MAX(updated_at) AS last FROM estate_documents WHERE user_id = ${clientId}`);

    const chatCount = Number(chats.rows[0]?.count || 0);
    const goalsNum = Number(goalsCount.rows[0]?.count || 0);
    const docsCount = Number(docs.rows[0]?.count || 0);

    const lastTimes = [
      chats.rows[0]?.last ? new Date(chats.rows[0].last as any).getTime() : 0,
      goalsCount.rows[0]?.last ? new Date(goalsCount.rows[0].last as any).getTime() : 0,
      docs.rows[0]?.last ? new Date(docs.rows[0].last as any).getTime() : 0,
      profile?.lastUpdated ? new Date(profile.lastUpdated as any).getTime() : 0,
    ];
    const lastActivityTs = Math.max(...lastTimes);

    const composedName = (client.fullName && client.fullName.trim().length > 0)
      ? client.fullName
      : ((profile?.firstName || profile?.lastName) ? `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() : null);

    res.json({
      client: { id: client.id, email: client.email, fullName: composedName, createdAt: client.createdAt },
      profile: profile ? { lastUpdated: profile.lastUpdated, isComplete: profile.isComplete, scores: {
        financialHealth: (profile as any).financialHealthScore ?? null,
        retirementReadiness: (profile as any).retirementReadinessScore ?? null,
      }} : null,
      counts: { chats: chatCount, goals: goalsNum, documents: docsCount },
      lastActivity: lastActivityTs > 0 ? new Date(lastActivityTs) : null,
    });
  });

  // Branding (white label) - get current advisor profile
  app.get('/api/advisor/branding', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const profile = await storage.getWhiteLabelProfile(advisorId);
    res.json(profile || null);
  });

  // Branding (white label) - update settings with optional logo upload
  app.put('/api/advisor/branding', requireAuth, requireAdvisor, upload.single('logo'), async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const { firmName, address, phone, email, defaultDisclaimer } = req.body as Record<string, string | undefined>;

    let logoUrl: string | undefined = undefined;
    if (req.file) {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'branding');
      await fs.mkdir(uploadsDir, { recursive: true });
      const ts = Date.now();
      const ext = path.extname(req.file.originalname).toLowerCase();
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext) ? ext : '.png';
      const fileName = `advisor_${advisorId}_${ts}${safeExt}`;
      const filePath = path.join(uploadsDir, fileName);
      await fs.writeFile(filePath, req.file.buffer);
      logoUrl = `/uploads/branding/${fileName}`;
    }

    const data: any = {
      firmName: firmName ?? null,
      address: address ?? null,
      phone: phone ?? null,
      email: email ?? null,
      defaultDisclaimer: defaultDisclaimer ?? null,
    };
    if (logoUrl) data.logoUrl = logoUrl;

    const updated = await storage.upsertWhiteLabelProfile(advisorId, data);
    res.json(updated);
  });
}
