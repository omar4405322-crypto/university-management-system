import crypto from 'crypto';
import { getSecretStrengthValidationError } from './secretValidation';

/**
 * Reusable AES-256-GCM symmetric encryption utility for protecting sensitive
 * data at rest (e.g. RFID device signing keys, secrets).
 *
 * Requirements:
 * - Environment variable ENCRYPTION_KEY must be configured as a 32-byte key
 *   (either a 64-character hex string or 44-character base64 string).
 * - Uses 12-byte (96-bit) cryptographically random IVs per encryption (NIST recommendation for GCM).
 * - Generates and verifies a 16-byte (128-bit) GCM authentication tag.
 * - Format: `${ivHex}:${authTagHex}:${ciphertextHex}`
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128 bits

/**
 * Resolves and validates the 32-byte master encryption key from the environment.
 */
export function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY?.trim();
  if (!rawKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not configured. A 32-byte key (64 hex characters or 44 base64 characters) is required.'
    );
  }

  const strengthError = getSecretStrengthValidationError(rawKey, 'ENCRYPTION_KEY');
  if (strengthError) {
    throw new Error(strengthError);
  }

  let keyBuffer: Buffer;
  // Try 64-char hex
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    keyBuffer = Buffer.from(rawKey, 'hex');
  } else if (/^[A-Za-z0-9+/=]{43,44}$/.test(rawKey)) {
    // Try base64
    keyBuffer = Buffer.from(rawKey, 'base64');
  } else if (Buffer.byteLength(rawKey, 'utf8') === 32) {
    keyBuffer = Buffer.from(rawKey, 'utf8');
  } else {
    throw new Error(
      'Invalid ENCRYPTION_KEY format: Expected 32 bytes (64-character hex string or 44-character base64 string).'
    );
  }

  if (keyBuffer.length !== 32) {
    throw new Error(
      `Invalid ENCRYPTION_KEY length: Key resolved to ${keyBuffer.length} bytes, but exactly 32 bytes (256 bits) are required for AES-256-GCM.`
    );
  }

  const decodedStrengthError = getSecretStrengthValidationError(
    keyBuffer.toString('hex'),
    'ENCRYPTION_KEY'
  );
  if (decodedStrengthError) {
    throw new Error(decodedStrengthError);
  }

  return keyBuffer;
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 *
 * @param plaintext The string to encrypt
 * @returns Colon-separated string: `${ivHex}:${authTagHex}:${ciphertextHex}`
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encrypt requires a string plaintext');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertextHex = cipher.update(plaintext, 'utf8', 'hex');
  ciphertextHex += cipher.final('hex');

  const authTagHex = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');

  return `${ivHex}:${authTagHex}:${ciphertextHex}`;
}

/**
 * Decrypts a payload encrypted by `encrypt()`.
 *
 * @param encryptedPayload Colon-separated string: `${ivHex}:${authTagHex}:${ciphertextHex}`
 * @returns Decrypted plaintext string
 * @throws Error if authentication tag verification fails or format is invalid
 */
export function decrypt(encryptedPayload: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new TypeError('decrypt requires a non-empty string payload');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted payload format. Expected 3 colon-delimited components (iv:authTag:ciphertext).'
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH_BYTES} bytes, got ${iv.length} bytes`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error(
      `Invalid auth tag length: expected ${AUTH_TAG_LENGTH_BYTES} bytes, got ${authTag.length} bytes`
    );
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    let plaintext = decipher.update(ciphertextHex, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch (error) {
    throw new Error(
      'Decryption failed: Message authentication failed or ciphertext corrupted (tamper detected).'
    );
  }
}

/**
 * Helper to generate a fresh 256-bit cryptographically secure key in hex format.
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
