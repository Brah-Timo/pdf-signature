/**
 * @pdf-signature/crypto — RSA Module
 *
 * RSA-PSS encryption/decryption and utility functions.
 * Used for key generation, encryption of stored data, and JWT signing.
 *
 * All RSA operations use industry-standard parameters:
 * - Key size: 2048-bit minimum, 4096-bit recommended for long-lived keys
 * - Padding: PKCS#1 v2.1 PSS for signatures, OAEP for encryption
 * - Hash: SHA-256
 */

import { createSign, createVerify, generateKeyPairSync, createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RsaKeyPair {
  publicKey: string;  // PEM-encoded public key
  privateKey: string; // PEM-encoded private key (PKCS#8)
  keyBits: 2048 | 4096;
}

export interface EncryptedData {
  /** AES-256-GCM encrypted ciphertext (base64) */
  ciphertext: string;
  /** Random initialization vector (base64) */
  iv: string;
  /** GCM authentication tag (base64) */
  authTag: string;
  /** AES key encrypted with recipient's RSA public key (base64) */
  encryptedKey: string;
}

// ─────────────────────────────────────────────
// Key Generation
// ─────────────────────────────────────────────

/**
 * Generate an RSA key pair.
 * Use 4096-bit for CA/root keys, 2048-bit for ephemeral signing keys.
 *
 * @param bits - Key size in bits (2048 or 4096)
 * @returns PEM-encoded public and private keys
 */
export function generateRsaKeyPair(bits: 2048 | 4096 = 2048): RsaKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: bits,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return { publicKey, privateKey, keyBits: bits };
}

// ─────────────────────────────────────────────
// RSA-PSS Signing (for JWT / API tokens)
// ─────────────────────────────────────────────

/**
 * Sign data using RSA-PSS with SHA-256.
 * Returns base64-encoded signature.
 *
 * @example
 * const sig = rsaSign(Buffer.from(data), privateKeyPem);
 */
export function rsaSign(
  data: Buffer | string,
  privateKeyPem: string
): string {
  const signer = createSign("SHA256");
  signer.update(data);
  return signer.sign(
    {
      key: privateKeyPem,
      padding: 6, // RSA_PKCS1_PSS_PADDING
      saltLength: 32,
    },
    "base64"
  );
}

/**
 * Verify an RSA-PSS signature.
 *
 * @returns true if the signature is valid
 */
export function rsaVerify(
  data: Buffer | string,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  try {
    const verifier = createVerify("SHA256");
    verifier.update(data);
    return verifier.verify(
      {
        key: publicKeyPem,
        padding: 6, // RSA_PKCS1_PSS_PADDING
        saltLength: 32,
      },
      signatureBase64,
      "base64"
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Symmetric Encryption (AES-256-GCM)
// ─────────────────────────────────────────────

/**
 * Encrypt data using AES-256-GCM.
 * This is used to encrypt PDF files at rest in S3/R2 storage.
 *
 * @param data - Plaintext data to encrypt
 * @param key - 32-byte AES key (Buffer or hex string)
 * @returns Encrypted data with IV and auth tag
 */
export function aesEncrypt(
  data: Buffer,
  key: Buffer | string
): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const keyBuffer = typeof key === "string" ? Buffer.from(key, "hex") : key;

  if (keyBuffer.length !== 32) {
    throw new Error("AES-256 requires a 32-byte (256-bit) key");
  }

  const iv = randomBytes(16); // 128-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);

  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag };
}

/**
 * Decrypt AES-256-GCM encrypted data.
 *
 * @throws Error if decryption fails (wrong key or data tampered)
 */
export function aesDecrypt(
  ciphertext: Buffer,
  key: Buffer | string,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  const keyBuffer = typeof key === "string" ? Buffer.from(key, "hex") : key;

  if (keyBuffer.length !== 32) {
    throw new Error("AES-256 requires a 32-byte (256-bit) key");
  }

  const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Generate a random 32-byte AES-256 key.
 * @returns Hex-encoded key string
 */
export function generateAesKey(): string {
  return randomBytes(32).toString("hex");
}

// ─────────────────────────────────────────────
// Key Derivation (for deterministic encryption)
// ─────────────────────────────────────────────

/**
 * Derive a 32-byte encryption key from a secret and a unique identifier.
 * Uses HKDF-SHA256 (RFC 5869).
 *
 * @param secret - The master secret (e.g., ENCRYPTION_KEY env var)
 * @param salt - Unique salt (e.g., signatureId)
 * @returns 32-byte derived key as Buffer
 */
export function deriveKey(secret: string | Buffer, salt: string): Buffer {
  const { createHmac } = require("crypto") as typeof import("crypto");

  // HKDF Extract
  const secretBuffer = typeof secret === "string"
    ? Buffer.from(secret, "hex")
    : secret;
  const prk = createHmac("sha256", salt).update(secretBuffer).digest();

  // HKDF Expand (single block, L=32)
  const info = "pdf-signature-file-encryption-v1";
  const okm = createHmac("sha256", prk)
    .update(Buffer.from(info + "\x01"))
    .digest();

  return okm.subarray(0, 32);
}

// ─────────────────────────────────────────────
// Secure String Comparison
// ─────────────────────────────────────────────

/**
 * Constant-time string comparison to prevent timing attacks.
 * Use instead of `===` when comparing secrets (API keys, tokens).
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ─────────────────────────────────────────────
// API Key Generation
// ─────────────────────────────────────────────

/**
 * Generate a new API key in the format: pdf_live_<32 random hex chars>
 * For test keys: pdf_test_<32 random hex chars>
 */
export function generateApiKey(
  environment: "live" | "test" = "live"
): string {
  const random = randomBytes(16).toString("hex");
  return `pdf_${environment}_${random}`;
}

/**
 * Hash an API key for secure storage in the database.
 * Store the hash, never the raw key.
 */
export function hashApiKey(apiKey: string): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(apiKey).digest("hex");
}
