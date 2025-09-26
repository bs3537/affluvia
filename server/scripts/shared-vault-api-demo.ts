import express from 'express';
import request from 'supertest';
import session from 'express-session';
import bodyParser from 'body-parser';
import sharedVaultRoutes from '../routes/shared-vault';
import { storage } from '../storage';
import { encryptFileBuffer } from '../services/shared-vault-encryption';

process.env.SHARED_VAULT_MASTER_KEY = process.env.SHARED_VAULT_MASTER_KEY || 'demo-master-key';

const app = express();
app.use(bodyParser.json());
app.use(session({ secret: 'demo', resave: false, saveUninitialized: true }));
app.use((req: any, _res, next) => {
  req.user = { id: 100, role: 'individual', email: 'client@example.com', fullName: 'Demo Client' };
  req.isAuthenticated = () => true;
  next();
});
app.use('/api/shared-vault', sharedVaultRoutes);

async function run() {
  (storage.getActiveAdvisorsForClient as any) = async () => [{ advisorId: 200, status: 'active' }];
  (storage.createSharedVaultFile as any) = async (payload: any) => ({
    id: 1,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  (storage.listSharedVaultFiles as any) = async () => [];
  (storage.getUser as any) = async () => ({ id: 200, email: 'advisor@example.com', fullName: 'Advisor Demo' });
  (storage.getSharedVaultFileById as any) = async (id: number) => {
    if (id !== 1) return undefined;
    const encrypted = encryptFileBuffer(Buffer.from('hello vault demo'));
    return {
      id,
      ownerClientId: 100,
      advisorId: 200,
      uploaderId: 100,
      originalFilename: 'demo.txt',
      mimeType: 'text/plain',
      fileSize: 16,
      checksum: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      encryptionAlgorithm: encrypted.algorithm,
      keySalt: encrypted.keySalt.toString('base64'),
      encryptionIv: encrypted.iv.toString('base64'),
      authTag: encrypted.authTag.toString('base64'),
      encryptedData: encrypted.encryptedData.toString('base64'),
    };
  };

  const uploadResponse = await request(app)
    .post('/api/shared-vault/upload')
    .attach('file', Buffer.from('hello vault demo'), 'demo.txt');

  console.log('Upload status:', uploadResponse.status);

  const downloadResponse = await request(app).get('/api/shared-vault/1/download');
  console.log('Download status:', downloadResponse.status);
  console.log('Download payload:', downloadResponse.text);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
