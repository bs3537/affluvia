import { Router } from "express";
import { storage } from "../storage";
import path from "path";
import fs from "fs/promises";
import { generateWillDocuments, generateCombinedPdfPacket, generatePdfDocuments } from "../services/will/renderer";
import { WillForm as WillFormSchema } from "@shared/will-types";

const router = Router();

function ensureAuth(req: any, res: any): number | undefined {
  if (!req.isAuthenticated()) {
    res.sendStatus(401);
    return undefined;
  }
  const actingAsClientId = (req.session as any).actingAsClientId as number | undefined;
  const userId = actingAsClientId || req.user!.id;
  return userId;
}

router.get("/current", async (req, res) => {
  const userId = ensureAuth(req, res);
  if (!userId) return;
  const profile = await storage.getFinancialProfile(userId);
  const will = (profile as any)?.estatePlanning?.will;
  if (will) return res.json(will);
  // Build a minimal default from profile
  const person = {
    first: profile?.firstName || "",
    last: profile?.lastName || "",
    city: profile?.primaryResidence?.city || undefined,
    state: (profile as any)?.state || undefined,
  };
  const defaultForm = {
    person,
    maritalStatus: (profile?.maritalStatus as any) || "single",
    spouse: profile?.spouseName ? { name: profile.spouseName } : undefined,
    children: [],
    executors: [{ name: profile?.spouseName || `${person.first} ${person.last}` }],
    digitalExecutor: { useSame: true, accessComms: true },
    residuary: {
      primary: {
        slices: profile?.spouseName
          ? [{ kind: "person", name: profile.spouseName, percent: 100 }]
          : [{ kind: "person", name: `${person.first} ${person.last} Heirs`, percent: 100 }],
      },
      takersOfLastResort: "heirs" as const,
    },
    gifts: [],
    provisions: { independentAdmin: true, noContest: true, selfProving: true, nonprofitConsent: false, includeSpecialNeedsTrust: true },
    funeral: { agents: [profile?.spouseName || `${person.first} ${person.last}`] },
    messages: [],
  };
  return res.json(defaultForm);
});

router.post("/", async (req, res) => {
  const userId = ensureAuth(req, res);
  if (!userId) return;
  try {
    const parsed = WillFormSchema.parse(req.body);
    const existing = (await storage.getFinancialProfile(userId)) || ({} as any);
    const estatePlanning = { ...(existing as any).estatePlanning, will: parsed };
    const updated = await storage.updateFinancialProfile(userId, { estatePlanning });
    res.json({ ok: true, estatePlanning: updated.estatePlanning });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Invalid will form" });
  }
});

router.post("/generate", async (req, res) => {
  const userId = ensureAuth(req, res);
  if (!userId) return;
  try {
    const input = req.body && Object.keys(req.body || {}).length ? req.body : undefined;
    let willData: any;
    if (input) {
      willData = WillFormSchema.parse(input);
    } else {
      const profile = await storage.getFinancialProfile(userId);
      willData = (profile as any)?.estatePlanning?.will;
      if (!willData) {
        // If nothing saved yet, synthesize a default and proceed
        const resp = await fetch(`http://localhost:${process.env.PORT || 3007}/api/wills/current`, { headers: { cookie: (req.headers.cookie || "") as string } } as any).catch(() => null);
        willData = resp ? await resp.json() : {};
      }
    }

    // If client requests direct PDF download, generate a single combined PDF and stream it
    const format = String(req.query.format || '').toLowerCase();
    const download = String(req.query.download || '').toLowerCase();
    const combined = String(req.query.combined || req.query.bundle || '') === '1';

    if ((format === 'pdf' && combined) || (format === 'pdf' && download === '1')) {
      const ts = Date.now();
      const dir = path.join(process.cwd(), "uploads", "wills", `${userId}-${ts}`);
      const pdf = await generateCombinedPdfPacket(dir, willData);
      if (!pdf) return res.status(501).json({ error: 'pdf_generation_unavailable' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Will Packet.pdf"');
      const buf = await fs.readFile(pdf.filePath);
      return res.send(buf);
    }

    // ZIP of individual PDFs
    if (format === 'zip' || download === 'zip' || req.query.bundle === 'zip') {
      const ts = Date.now();
      const dir = path.join(process.cwd(), "uploads", "wills", `${userId}-${ts}`);
      const pdfs = await generatePdfDocuments(dir, willData);
      if (!pdfs?.length) return res.status(501).json({ error: 'pdf_generation_unavailable' });

      // Attempt to dynamically import archiver
      let archiver: any;
      try {
        archiver = (await import('archiver')).default;
      } catch (e) {
        console.error('[ZIP] archiver not available:', e);
        return res.status(501).json({ error: 'zip_generation_unavailable' });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="Will Packet.zip"');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err: any) => {
        console.error('[ZIP] Error:', err);
        try { res.status(500).end(); } catch {}
      });
      archive.pipe(res);

      for (const f of pdfs) {
        // Put files under a folder named "Will Packet/" inside the zip
        const nameInZip = `Will Packet/${path.basename(f.name)}`;
        archive.file(f.filePath, { name: nameInZip });
      }

      await archive.finalize();
      return; // streamed
    }

    // Otherwise, generate individual HTML docs and return their URLs
    const ts = Date.now();
    const dir = path.join(process.cwd(), "uploads", "wills", `${userId}-${ts}`);
    const generated = await generateWillDocuments(dir, willData);

    // Create/update an estate document record for the main will
    try {
      await storage.createEstateDocument(userId, {
        userId,
        documentType: "will",
        documentName: `Last Will and Testament (${ts})`,
        description: "Draft generated by Affluvia",
        status: "draft",
        documentUrl: generated.find((d) => d.kind === "last-will-and-testament")?.urlPath || null,
        notarized: false,
      } as any);
    } catch {}

    res.json({ ok: true, files: generated });
  } catch (e: any) {
    console.error("/api/wills/generate error", e);
    res.status(400).json({ error: e?.message || "Failed to generate will" });
  }
});

export default router;
