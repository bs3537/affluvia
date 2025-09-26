import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth';
import { storage } from '../storage';
import { encryptFileBuffer, decryptFileBuffer, calculateFileChecksum } from '../services/shared-vault-encryption';
import { sendSharedVaultUploadEmail } from '../email-service';

const router = Router();

const MAX_FILE_BYTES = parseInt(process.env.SHARED_VAULT_MAX_FILE_BYTES || `${30 * 1024 * 1024}`, 10); // default 30 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

type VaultContext = {
  ownerClientId: number;
  actingAsAdvisor: boolean;
  advisorId: number | null;
  advisorIds: number[];
};

async function resolveVaultContext(req: Request, res: Response, requireAdvisors: boolean = false): Promise<VaultContext | undefined> {
  const user = req.user!;
  const actingAsClientId = (req.session as any)?.actingAsClientId as number | undefined;

  if (actingAsClientId) {
    if (user.role !== 'advisor') {
      res.status(403).json({ error: 'forbidden', message: 'Only advisors can act on behalf of a client.' });
      return undefined;
    }

    const link = await storage.getAdvisorClientLink(user.id, actingAsClientId);
    if (!link || link.status !== 'active') {
      res.status(403).json({ error: 'forbidden', message: 'Advisor is not linked to this client.' });
      return undefined;
    }

    return {
      ownerClientId: actingAsClientId,
      actingAsAdvisor: true,
      advisorId: user.id,
      advisorIds: [user.id],
    };
  }

  if (user.role === 'advisor') {
    res.status(400).json({ error: 'select_client', message: 'Select a client before accessing the shared vault.' });
    return undefined;
  }

  const ownerClientId = user.id;
  const advisors = await storage.getActiveAdvisorsForClient(ownerClientId);
  const advisorIds = advisors.map((link) => link.advisorId);

  if (requireAdvisors && advisorIds.length === 0) {
    res.status(400).json({ error: 'no_advisor_link', message: 'No advisor linked to this account yet.' });
    return undefined;
  }

  return {
    ownerClientId,
    actingAsAdvisor: false,
    advisorId: advisorIds[0] ?? null,
    advisorIds,
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const context = await resolveVaultContext(req, res);
    if (!context) return;

    const files = await storage.listSharedVaultFiles(context.ownerClientId);
    res.json({
      files: files.map((file) => ({
        id: file.id,
        originalFilename: file.originalFilename,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        checksum: file.checksum,
        advisorId: file.advisorId,
        uploaderId: file.uploaderId,
        uploaderName: file.uploaderName || file.uploaderEmail || 'Unknown',
        createdAt: file.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to list shared vault files:', error);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const context = await resolveVaultContext(req, res, false);
    if (!context) return;

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'no_file', message: 'No file uploaded.' });
      return;
    }

    if (file.size <= 0) {
      res.status(400).json({ error: 'empty_file', message: 'Uploaded file is empty.' });
      return;
    }

    const encryptionPayload = encryptFileBuffer(file.buffer);
    const checksum = calculateFileChecksum(file.buffer);

    const record = await storage.createSharedVaultFile({
      ownerClientId: context.ownerClientId,
      advisorId: context.advisorId ?? null,
      uploaderId: req.user!.id,
      originalFilename: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      fileSize: file.size,
      checksum,
      encryptionAlgorithm: encryptionPayload.algorithm,
      keySalt: encryptionPayload.keySalt.toString('base64'),
      encryptionIv: encryptionPayload.iv.toString('base64'),
      authTag: encryptionPayload.authTag.toString('base64'),
      encryptedData: encryptionPayload.encryptedData.toString('base64'),
    });

    const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    const vaultUrl = `${origin}/#shared-vault`;
    const uploaderName = req.user!.fullName || req.user!.email;

    const recipients = new Set<string>();
    let clientName: string | null = null;

    if (context.actingAsAdvisor) {
      const client = await storage.getUser(context.ownerClientId);
      if (client?.email) {
        recipients.add(client.email);
        clientName = client.fullName || client.email;
      }
    } else {
      const advisorLinks = await storage.getActiveAdvisorsForClient(context.ownerClientId);
      for (const link of advisorLinks) {
        const advisorUser = await storage.getUser(link.advisorId);
        if (advisorUser?.email) {
          recipients.add(advisorUser.email);
        }
      }
    }

    console.log('[SharedVaultUpload] Upload complete, preparing notifications', {
      uploaderId: req.user!.id,
      ownerClientId: context.ownerClientId,
      recipientCount: recipients.size,
    });

    if (recipients.size > 0) {
      await sendSharedVaultUploadEmail({
        recipients: Array.from(recipients),
        uploaderName,
        fileName: file.originalname,
        vaultUrl,
        clientName,
      });
    }

    res.status(201).json({
      file: {
        id: record.id,
        originalFilename: record.originalFilename,
        mimeType: record.mimeType,
        fileSize: record.fileSize,
        checksum: record.checksum,
        createdAt: record.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to upload shared vault file:', error);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

router.get('/:fileId/download', requireAuth, async (req, res) => {
  try {
    const context = await resolveVaultContext(req, res);
    if (!context) return;

    const fileId = Number(req.params.fileId);
    if (!Number.isFinite(fileId)) {
      res.status(400).json({ error: 'invalid_file_id' });
      return;
    }

    const record = await storage.getSharedVaultFileById(fileId);
    if (!record || record.ownerClientId !== context.ownerClientId) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const decrypted = decryptFileBuffer({
      encryptedData: Buffer.from(record.encryptedData, 'base64'),
      iv: Buffer.from(record.encryptionIv, 'base64'),
      authTag: Buffer.from(record.authTag, 'base64'),
      keySalt: Buffer.from(record.keySalt, 'base64'),
    });

    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.originalFilename)}"`);
    res.setHeader('Content-Length', decrypted.length.toString());
    res.send(decrypted);
  } catch (error) {
    console.error('Failed to download shared vault file:', error);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

router.delete('/:fileId', requireAuth, async (req, res) => {
  try {
    const context = await resolveVaultContext(req, res);
    if (!context) return;

    const fileId = Number(req.params.fileId);
    if (!Number.isFinite(fileId)) {
      res.status(400).json({ error: 'invalid_file_id' });
      return;
    }

    const record = await storage.getSharedVaultFileById(fileId);
    if (!record || record.ownerClientId !== context.ownerClientId) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await storage.deleteSharedVaultFile(fileId);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete shared vault file:', error);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

export default router;
