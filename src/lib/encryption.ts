/**
 * Prismatic — API Key Encryption Utilities
 * AES-256-GCM encryption for user-provided API keys.
 * The encryption key lives in server-side environment variables — never exposed to the client.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get the master encryption key from environment.
 * Must be set in .env.local / Vercel environment variables.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  // Derive a consistent 32-byte key from the env string using scrypt
  return scryptSync(key, 'prismatic-salt', 32);
}

/**
 * Encrypt an API key using AES-256-GCM.
 * Returns { encrypted: base64-encoded ciphertext, iv: base64-encoded IV }.
 */
export function encryptApiKey(plaintext: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine ciphertext + authTag and encode as base64
  const combined = Buffer.concat([Buffer.from(encrypted, 'base64'), authTag]);

  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt an API key.
 * Takes { encrypted: base64, iv: base64 } and returns the plaintext key.
 */
export function decryptApiKey(encrypted: string, iv: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encrypted, 'base64');
  const ivBuf = Buffer.from(iv, 'base64');

  // Extract authTag (last 16 bytes) and ciphertext
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Create a safe display representation of an API key.
 * Shows first 8 chars + "..." + last 4 chars, e.g. "sk-xxxx...xxxx".
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '***';
  const prefix = key.slice(0, 8);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Hash the API key for logging/audit purposes (one-way, not reversible).
 * Uses SHA-256 truncated to 8 chars.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}
