import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const DEFAULT_ITERATIONS = parseInt(process.env.SHARED_VAULT_KEY_ITERATIONS || '150000', 10);
const KEY_VERSION = process.env.SHARED_VAULT_KEY_VERSION || 'v1';

function getMasterSecret(): Buffer {
  const secret = process.env.SHARED_VAULT_MASTER_KEY || process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('Shared vault encryption requires SHARED_VAULT_MASTER_KEY or ENCRYPTION_KEY to be set');
  }
  return Buffer.isBuffer(secret) ? secret : Buffer.from(secret, 'utf8');
}

function deriveFileKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(getMasterSecret(), salt, DEFAULT_ITERATIONS, KEY_LENGTH, 'sha256');
}

export function encryptFileBuffer(data: Buffer): {
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keySalt: Buffer;
  algorithm: string;
  keyVersion: string;
} {
  const keySalt = crypto.randomBytes(SALT_LENGTH);
  const fileKey = deriveFileKey(keySalt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, fileKey, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv,
    authTag,
    keySalt,
    algorithm: ALGORITHM,
    keyVersion: KEY_VERSION,
  };
}

export function decryptFileBuffer(payload: {
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keySalt: Buffer;
}): Buffer {
  const fileKey = deriveFileKey(payload.keySalt);
  const decipher = crypto.createDecipheriv(ALGORITHM, fileKey, payload.iv);
  decipher.setAuthTag(payload.authTag);
  return Buffer.concat([decipher.update(payload.encryptedData), decipher.final()]);
}

export function calculateFileChecksum(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export const sharedVaultEncryptionMetadata = {
  algorithm: ALGORITHM,
  keyVersion: KEY_VERSION,
  iterations: DEFAULT_ITERATIONS,
};
