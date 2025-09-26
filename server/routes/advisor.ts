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
import {
  MAX_BULK_INVITES,
  parseBulkInviteBuffer,
  type BulkInviteSkipReason,
  type ParsedBulkInviteRow,
} from './advisor-bulk-invite';

interface BulkInviteSkippedEntry {
  email?: string;
  fullName?: string | null;
  row?: number;
  reason: BulkInviteSkipReason;
  message?: string;
}

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

  async function ensureAdvisorTables() {
    try {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS advisor_clients (
        id SERIAL PRIMARY KEY,
        advisor_id INTEGER NOT NULL REFERENCES users(id),
        client_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT advisor_clients_unique UNIQUE (advisor_id, client_id)
      );`);
    } catch {}
    try {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS advisor_invites (
        id SERIAL PRIMARY KEY,
        advisor_id INTEGER NOT NULL REFERENCES users(id),
        email TEXT NOT NULL,
        invite_token TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'sent',
        expires_at TIMESTAMPTZ NOT NULL,
        client_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );`);
    } catch {}
    try {
      await db.execute(sql`ALTER TABLE advisor_invites ADD COLUMN IF NOT EXISTS invite_token TEXT`);
    } catch {}
    try {
      await db.execute(sql`UPDATE advisor_invites SET invite_token = token_hash WHERE invite_token IS NULL`);
    } catch {}
    try {
      await db.execute(sql`ALTER TABLE advisor_invites ALTER COLUMN invite_token SET NOT NULL`);
    } catch {}
    try {
      await db.execute(sql`ALTER TABLE advisor_invites ADD COLUMN IF NOT EXISTS full_name TEXT`);
    } catch {}
    try {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS white_label_profiles (
        id SERIAL PRIMARY KEY,
        advisor_id INTEGER NOT NULL REFERENCES users(id),
        firm_name TEXT,
        logo_url TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        default_disclaimer TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );`);
    } catch {}
  }
  // List clients
  app.get('/api/advisor/clients', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    try {
      const clients = await storage.getAdvisorClients(advisorId);
      res.json(clients);
    } catch (e: any) {
      if (e?.code === '42P01') {
        await ensureAdvisorTables();
        return res.json([]);
      }
      console.error('Error listing advisor clients:', e);
      res.status(500).json({ error: 'failed_to_list_clients' });
    }
  });

  // Link existing client by email
  app.post('/api/advisor/link-client', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: 'email required' });
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'client_not_found' });
    try {
      const link = await storage.linkAdvisorToClient(advisorId, user.id);
      res.json({ ok: true, link });
    } catch (e: any) {
      if (e?.code === '42P01') {
        await ensureAdvisorTables();
        const link = await storage.linkAdvisorToClient(advisorId, user.id);
        return res.json({ ok: true, link });
      }
      console.error('Error linking client:', e);
      res.status(500).json({ error: 'failed_to_link' });
    }
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

    const invite = await storage.createAdvisorInvite(advisor.id, email, token, tokenHash, expiresAt);
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

  // Bulk invite via CSV/XLSX upload
  app.post('/api/advisor/invites/bulk', requireAuth, requireAdvisor, upload.single('file'), async (req, res) => {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'file_required' });
    }

    let parsed;
    try {
      parsed = parseBulkInviteBuffer(req.file.buffer);
    } catch (err: any) {
      console.error('Error parsing bulk invite file:', err);
      return res.status(400).json({ error: 'invalid_file', message: err?.message || String(err) });
    }

    const { entries, issues } = parsed;
    if (entries.length === 0 && issues.length === 0) {
      return res.status(400).json({ error: 'no_data' });
    }

    if (entries.length === 0 && issues.length > 0) {
      return res.status(400).json({ error: 'no_valid_emails', skipped: issues });
    }

    const duplicates: BulkInviteSkippedEntry[] = [];
    const uniqueEntries: ParsedBulkInviteRow[] = [];
    const seenEmails = new Set<string>();
    for (const entry of entries) {
      if (seenEmails.has(entry.emailLower)) {
        duplicates.push({ email: entry.email, fullName: entry.fullName, row: entry.row, reason: 'duplicate_in_file' });
        continue;
      }
      seenEmails.add(entry.emailLower);
      uniqueEntries.push(entry);
    }

    if (uniqueEntries.length === 0) {
      const initialSkipped = [
        ...issues.map((issue) => ({ email: issue.email, fullName: issue.fullName, row: issue.row, reason: issue.reason } as BulkInviteSkippedEntry)),
        ...duplicates,
      ];
      return res.status(400).json({ error: 'no_unique_emails', skipped: initialSkipped });
    }

    if (uniqueEntries.length > MAX_BULK_INVITES) {
      return res.status(400).json({ error: 'too_many_invites', max: MAX_BULK_INVITES, count: uniqueEntries.length });
    }

    const advisor = (req as any).user as any;
    let existingClients: Array<{ email: string }> = [];
    let existingInvites: Array<{ email: string }> = [];
    try {
      [existingClients, existingInvites] = await Promise.all([
        storage.getAdvisorClients(advisor.id) as any,
        storage.getAdvisorInvites(advisor.id) as any,
      ]);
    } catch (err) {
      console.error('Error loading advisor state for bulk invites:', err);
      return res.status(500).json({ error: 'failed_to_load_state' });
    }

    const existingClientEmails = new Set(existingClients.map((c) => (c.email || '').toLowerCase()).filter(Boolean));
    const existingInviteEmails = new Set(existingInvites.map((i) => (i.email || '').toLowerCase()).filter(Boolean));

    const skipped: BulkInviteSkippedEntry[] = [];
    const reasonCounts: Record<BulkInviteSkipReason, number> = {
      missing_email: 0,
      invalid_email: 0,
      duplicate_in_file: 0,
      already_client: 0,
      already_invited: 0,
      email_failed: 0,
      failed: 0,
    };
    const pushSkipped = (entry: BulkInviteSkippedEntry) => {
      skipped.push(entry);
      reasonCounts[entry.reason] = (reasonCounts[entry.reason] ?? 0) + 1;
    };

    issues.forEach((issue) => {
      pushSkipped({ email: issue.email, fullName: issue.fullName, row: issue.row, reason: issue.reason });
    });
    duplicates.forEach((dup) => pushSkipped(dup));

    const created: Array<{ id: number; email: string; fullName: string | null; status: string; createdAt: Date | string | null; expiresAt: Date | string | null }> = [];
    const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;

    for (const entry of uniqueEntries) {
      if (existingClientEmails.has(entry.emailLower)) {
        pushSkipped({ email: entry.email, fullName: entry.fullName, row: entry.row, reason: 'already_client' });
        continue;
      }
      if (existingInviteEmails.has(entry.emailLower)) {
        pushSkipped({ email: entry.email, fullName: entry.fullName, row: entry.row, reason: 'already_invited' });
        continue;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      try {
        const invite = await storage.createAdvisorInvite(advisor.id, entry.email, token, tokenHash, expiresAt, { fullName: entry.fullName });
        const emailSent = await sendAdvisorInviteEmail({
          to: entry.email,
          advisorName: advisor.fullName || advisor.email,
          link: `${origin}/invite/accept?token=${token}`,
          replyTo: advisor.email,
        });

        if (!emailSent) {
          await storage.cancelAdvisorInvite(invite.id);
          pushSkipped({ email: entry.email, fullName: entry.fullName, row: entry.row, reason: 'email_failed' });
          continue;
        }

        existingInviteEmails.add(entry.emailLower);
        created.push({
          id: invite.id,
          email: invite.email,
          fullName: invite.fullName ?? entry.fullName ?? null,
          status: invite.status,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
        });
      } catch (err: any) {
        console.error('Failed to create bulk advisor invite', { email: entry.email, error: err });
        pushSkipped({ email: entry.email, fullName: entry.fullName, row: entry.row, reason: 'failed', message: err?.message || String(err) });
      }
    }

    res.json({
      ok: true,
      created,
      skipped,
      counts: {
        totalRows: entries.length + issues.length,
        uniqueProcessed: uniqueEntries.length,
        invited: created.length,
        skipped: skipped.length,
        reasons: reasonCounts,
      },
    });
  });

  // List pending invites
  app.get('/api/advisor/invites', requireAuth, requireAdvisor, async (req, res) => {
    const advisorId = (req as any).user.id as number;
    try {
      const invites = await storage.getAdvisorInvites(advisorId);
      res.json(invites);
    } catch (e: any) {
      if (e?.code === '42P01') {
        await ensureAdvisorTables();
        return res.json([]);
      }
      console.error('Error listing invites:', e);
      res.status(500).json({ error: 'failed_to_list_invites' });
    }
  });

  // Resend invite (regenerate token and expiry)
  app.post('/api/advisor/invites/:inviteId/resend', requireAuth, requireAdvisor, async (req, res) => {
    const advisor = (req as any).user as any;
    const inviteId = parseInt(req.params.inviteId, 10);
    let invites: any[] = [];
    try {
      invites = await storage.getAdvisorInvites(advisor.id);
    } catch (e: any) {
      if (e?.code === '42P01') {
        await ensureAdvisorTables();
        invites = await storage.getAdvisorInvites(advisor.id);
      } else {
        console.error('Error fetching invites for resend:', e);
        return res.status(500).json({ error: 'failed_to_fetch_invites' });
      }
    }
    const invite = invites.find(i => i.id === inviteId);
    if (!invite) return res.status(404).json({ error: 'invite_not_found' });
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storage.updateAdvisorInviteToken(inviteId, token, tokenHash, expiresAt);
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
    try {
      const invites = await storage.getAdvisorInvites(advisorId);
      if (!invites.find(i => i.id === inviteId)) return res.status(404).json({ error: 'invite_not_found' });
      await storage.cancelAdvisorInvite(inviteId);
      res.json({ ok: true });
    } catch (e: any) {
      if (e?.code === '42P01') {
        await ensureAdvisorTables();
        const invites = await storage.getAdvisorInvites(advisorId);
        if (!invites.find(i => i.id === inviteId)) return res.status(404).json({ error: 'invite_not_found' });
        await storage.cancelAdvisorInvite(inviteId);
        return res.json({ ok: true });
      }
      console.error('Error canceling invite:', e);
      res.status(500).json({ error: 'failed_to_cancel_invite' });
    }
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
    if (logoUrl !== undefined) {
      data.logoUrl = logoUrl;
    }

    const updated = await storage.upsertWhiteLabelProfile(advisorId, data);
    res.json(updated);
  });
}
