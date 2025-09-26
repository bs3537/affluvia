import crypto from 'crypto';
import { db } from '../db';
import { auditLogs } from '../../shared/schema';

/**
 * Enhanced Encryption Service with AES-256-GCM
 * Provides encryption at rest for all sensitive financial data
 */
export class EncryptionService {
  private static algorithm = 'aes-256-gcm';
  private static keyDerivationIterations = 100000; // PBKDF2 iterations
  
  /**
   * Get or generate encryption key
   * In production, this should use AWS KMS, HashiCorp Vault, or similar
   */
  private static getEncryptionKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
    if (!secret) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // Use PBKDF2 for key derivation with proper iterations
    return crypto.pbkdf2Sync(secret, 'plaid-encryption-salt', this.keyDerivationIterations, 32, 'sha256');
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  static encrypt(plaintext: string | object): string {
    try {
      const text = typeof plaintext === 'object' ? JSON.stringify(plaintext) : plaintext;
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Format: iv:authTag:encryptedData:timestamp
      const timestamp = Date.now().toString(16);
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}:${timestamp}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length < 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const key = this.getEncryptionKey();
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Hash sensitive data for comparison (e.g., account numbers)
   */
  static hash(data: string): string {
    return crypto.createHmac('sha256', this.getEncryptionKey())
      .update(data)
      .digest('hex');
  }

  /**
   * Generate secure random tokens
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt PII fields in an object
   */
  static encryptPII(data: any): any {
    const piiFields = [
      'ssn', 'socialSecurityNumber', 'taxId', 'ein',
      'accountNumber', 'routingNumber', 'creditCard',
      'dateOfBirth', 'dob', 'driverLicense'
    ];
    
    const encrypted = { ...data };
    
    for (const field of piiFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
        encrypted[`${field}_hash`] = this.hash(encrypted[field]);
      }
    }
    
    return encrypted;
  }

  /**
   * Verify data integrity
   */
  static verifyIntegrity(encryptedText: string): boolean {
    try {
      const parts = encryptedText.split(':');
      if (parts.length < 4) return false;
      
      const timestamp = parseInt(parts[3], 16);
      const age = Date.now() - timestamp;
      
      // Check if data is older than 1 year (configurable)
      const maxAge = 365 * 24 * 60 * 60 * 1000;
      if (age > maxAge) {
        console.warn('Encrypted data is older than maximum allowed age');
      }
      
      // Try to decrypt to verify integrity
      this.decrypt(encryptedText);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Audit Logging Service for compliance
 */
export class AuditLogger {
  static async log(
    userId: number,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: any,
    ipAddress?: string
  ): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId,
        action,
        resourceType,
        resourceId: resourceId || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ipAddress || null,
        userAgent: null,
        createdAt: new Date()
      });
    } catch (error) {
      // Log to console but don't fail the operation
      console.error('Audit logging failed:', error);
    }
  }

  static async logPlaidOperation(
    userId: number,
    operation: string,
    itemId?: string,
    success: boolean = true,
    error?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log(
      userId,
      operation,
      'plaid_operation',
      itemId,
      {
        success,
        error,
        timestamp: new Date().toISOString()
      },
      ipAddress
    );
  }

  static async logDataAccess(
    userId: number,
    dataType: string,
    purpose: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log(
      userId,
      'data_access',
      dataType,
      undefined,
      { purpose },
      ipAddress
    );
  }

  static async logConsentUpdate(
    userId: number,
    consentType: string,
    granted: boolean,
    ipAddress?: string
  ): Promise<void> {
    await this.log(
      userId,
      'consent_update',
      'user_consent',
      undefined,
      { consentType, granted },
      ipAddress
    );
  }
}

/**
 * Token rotation and management
 */
export class TokenManager {
  private static readonly TOKEN_ROTATION_INTERVAL = 90 * 24 * 60 * 60 * 1000; // 90 days

  /**
   * Check if token needs rotation
   */
  static shouldRotateToken(tokenCreatedAt: Date): boolean {
    const age = Date.now() - tokenCreatedAt.getTime();
    return age > this.TOKEN_ROTATION_INTERVAL;
  }

  /**
   * Generate new access token with Plaid
   */
  static async rotateAccessToken(currentToken: string): Promise<string | null> {
    try {
      // This would call Plaid's token rotation API
      // For now, return null to indicate no rotation needed
      console.log('Token rotation check performed');
      return null;
    } catch (error) {
      console.error('Token rotation failed:', error);
      throw error;
    }
  }

  /**
   * Store temporary link token in memory cache
   * In production, use Redis or similar
   */
  private static linkTokenCache = new Map<string, { token: string; expires: Date }>();

  static storeLinkToken(key: string, token: string, expiresInMinutes: number = 30): void {
    const expires = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    this.linkTokenCache.set(key, { token, expires });
    
    // Clean up expired tokens
    this.cleanupExpiredTokens();
  }

  static getLinkToken(key: string): string | null {
    const cached = this.linkTokenCache.get(key);
    if (!cached) return null;
    
    if (cached.expires < new Date()) {
      this.linkTokenCache.delete(key);
      return null;
    }
    
    return cached.token;
  }

  private static cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [key, value] of this.linkTokenCache.entries()) {
      if (value.expires < now) {
        this.linkTokenCache.delete(key);
      }
    }
  }
}

/**
 * Security headers and TLS configuration helper
 */
export class SecurityConfig {
  static getSecurityHeaders() {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.plaid.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.plaid.com https://cdn.plaid.com",
      'Permissions-Policy': 'fullscreen=(self "https://cdn.plaid.com")',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
  }

  static getTLSConfig() {
    return {
      minVersion: 'TLSv1.3',
      ciphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_AES_128_GCM_SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256'
      ].join(':')
    };
  }
}

export default {
  EncryptionService,
  AuditLogger,
  TokenManager,
  SecurityConfig
};
