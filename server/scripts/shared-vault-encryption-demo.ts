import { encryptFileBuffer, decryptFileBuffer } from '../services/shared-vault-encryption';

if (!process.env.SHARED_VAULT_MASTER_KEY) {
  process.env.SHARED_VAULT_MASTER_KEY = 'test-master-key';
}

const sample = Buffer.from('shared vault test payload');
const encrypted = encryptFileBuffer(sample);
const decrypted = decryptFileBuffer({
  encryptedData: encrypted.encryptedData,
  iv: encrypted.iv,
  authTag: encrypted.authTag,
  keySalt: encrypted.keySalt,
});

if (decrypted.toString() !== sample.toString()) {
  console.error('Decryption mismatch');
  process.exit(1);
}

console.log('Shared vault encryption round-trip success:', decrypted.toString());
