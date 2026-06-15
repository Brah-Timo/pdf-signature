/**
 * @pdf-signature/crypto — Hash Module
 *
 * Cryptographic hashing utilities.
 * Supports SHA-256, SHA-384, SHA-512 via Node.js built-in crypto.
 * These are used to generate document fingerprints for integrity checks.
 */

import { createHash, createHmac } from "crypto";

export type HashAlgorithm = "sha256" | "sha384" | "sha512";

// ─────────────────────────────────────────────
// Core Hashing
// ─────────────────────────────────────────────

/**
 * Compute the hash of a Buffer.
 * @returns Hex-encoded hash string, prefixed with algorithm name.
 *
 * @example
 * const hash = hashBuffer(pdfBuffer, 'sha256');
 * // → 'sha256:e3b0c44298fc1c149afb4c8996fb924...'
 */
export function hashBuffer(
  data: Buffer | Uint8Array,
  algorithm: HashAlgorithm = "sha256"
): string {
  const hash = createHash(algorithm)
    .update(data)
    .digest("hex");
  return `${algorithm}:${hash}`;
}

/**
 * Compute the raw hex hash of a Buffer (no algorithm prefix).
 * Used internally when embedding in PDF structures.
 */
export function hashBufferRaw(
  data: Buffer | Uint8Array,
  algorithm: HashAlgorithm = "sha256"
): string {
  return createHash(algorithm).update(data).digest("hex");
}

/**
 * Compute a binary hash (Buffer output) — required by PKCS#7 builder.
 */
export function hashBufferBinary(
  data: Buffer | Uint8Array,
  algorithm: HashAlgorithm = "sha256"
): Buffer {
  return createHash(algorithm).update(data).digest();
}

/**
 * Compute the hash of a string.
 */
export function hashString(
  text: string,
  algorithm: HashAlgorithm = "sha256",
  encoding: BufferEncoding = "utf8"
): string {
  return createHash(algorithm).update(text, encoding).digest("hex");
}

// ─────────────────────────────────────────────
// HMAC (Webhook Signing)
// ─────────────────────────────────────────────

/**
 * Generate an HMAC-SHA256 signature for webhook payloads.
 * Returns in the format "sha256=<hex>" as expected by the SDK.
 *
 * @example
 * const sig = signHmac(JSON.stringify(payload), process.env.WEBHOOK_SECRET);
 * // → 'sha256:d2a84f4b8b650937ec8f73cd8be2c74add5a911ba64df27458ed8229da804a26'
 */
export function signHmac(
  data: string | Buffer,
  secret: string,
  algorithm: HashAlgorithm = "sha256"
): string {
  const sig = createHmac(algorithm, secret)
    .update(data)
    .digest("hex");
  return `${algorithm}=${sig}`;
}

/**
 * Verify an HMAC signature in constant-time (prevents timing attacks).
 *
 * @example
 * const isValid = verifyHmac(JSON.stringify(payload), receivedSig, secret);
 */
export function verifyHmac(
  data: string | Buffer,
  receivedSignature: string,
  secret: string,
  algorithm: HashAlgorithm = "sha256"
): boolean {
  const expected = signHmac(data, secret, algorithm);

  // Constant-time comparison
  if (expected.length !== receivedSignature.length) return false;

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ receivedSignature.charCodeAt(i);
  }

  return result === 0;
}

// ─────────────────────────────────────────────
// PDF Byte Range Hashing
// ─────────────────────────────────────────────

/**
 * Hash only the bytes that are covered by the PDF signature byte range.
 * The byte range excludes the signature placeholder (which is filled with zeros).
 *
 * @param pdfBuffer - The full PDF buffer
 * @param byteRanges - [offset1, length1, offset2, length2]
 * @param algorithm - Hash algorithm (default: sha256)
 */
export function hashPdfByteRanges(
  pdfBuffer: Buffer,
  byteRanges: [number, number, number, number],
  algorithm: HashAlgorithm = "sha256"
): Buffer {
  const [offset1, length1, offset2, length2] = byteRanges;

  const hasher = createHash(algorithm);

  // First segment: bytes before the signature placeholder
  hasher.update(pdfBuffer.subarray(offset1, offset1 + length1));

  // Second segment: bytes after the signature placeholder
  hasher.update(pdfBuffer.subarray(offset2, offset2 + length2));

  return hasher.digest();
}

// ─────────────────────────────────────────────
// Random bytes
// ─────────────────────────────────────────────

/**
 * Generate cryptographically secure random bytes.
 * Used for nonces, serial numbers, etc.
 */
export function randomHex(byteLength = 16): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return randomBytes(byteLength).toString("hex");
}

/**
 * Generate a unique signature ID in the format: sig_<16 random hex chars>
 */
export function generateSignatureId(): string {
  return `sig_${randomHex(8)}`;
}

/**
 * Generate a unique audit trail ID.
 */
export function generateAuditTrailId(): string {
  return `audit_${randomHex(8)}`;
}

/**
 * Generate a unique multi-sign session ID.
 */
export function generateSessionId(): string {
  return `msign_${randomHex(8)}`;
}
