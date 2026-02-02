/**
 * Encryption utilities for securing private keys
 * Uses AES-256-GCM for encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY not set in environment');
  }
  // Derive a key from the master key
  return crypto.pbkdf2Sync(masterKey, 'clawtrade-salt', ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a private key
 * @param privateKey - Private key to encrypt (with or without 0x prefix)
 * @returns Encrypted string in format: salt:iv:encrypted:tag (all hex encoded)
 */
export function encryptPrivateKey(privateKey: string): string {
  try {
    // Remove 0x prefix if present
    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

    // Generate random IV and salt
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from master key + salt
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('ENCRYPTION_MASTER_KEY not set');
    }
    const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(cleanKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Return format: salt:iv:encrypted:tag
    return [
      salt.toString('hex'),
      iv.toString('hex'),
      encrypted,
      tag.toString('hex'),
    ].join(':');
  } catch (error) {
    throw new Error(`Failed to encrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt a private key
 * @param encryptedData - Encrypted string in format: salt:iv:encrypted:tag
 * @returns Decrypted private key with 0x prefix
 */
export function decryptPrivateKey(encryptedData: string): string {
  try {
    // Parse encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [saltHex, ivHex, encrypted, tagHex] = parts;

    // Convert from hex
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    // Derive key from master key + salt
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('ENCRYPTION_MASTER_KEY not set');
    }
    const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Return with 0x prefix
    return `0x${decrypted}`;
  } catch (error) {
    throw new Error(`Failed to decrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a random encryption master key
 * Use this once to generate a key for production
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Test encryption/decryption
 */
export function testEncryption(): boolean {
  try {
    const testKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const encrypted = encryptPrivateKey(testKey);
    const decrypted = decryptPrivateKey(encrypted);
    return testKey === decrypted;
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}
