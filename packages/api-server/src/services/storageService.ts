/**
 * Storage Service
 *
 * Handles PDF file storage in AWS S3 or Cloudflare R2.
 * All files are encrypted at rest using AES-256-GCM.
 * Access is controlled via pre-signed URLs with short expiry.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { aesEncrypt, aesDecrypt, deriveKey } from "@pdf-signature/crypto";

// ─────────────────────────────────────────────
// S3 Client Setup
// ─────────────────────────────────────────────

const s3Client = new S3Client({
  region: process.env["AWS_REGION"] ?? "eu-west-1",
  credentials: {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"]!,
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"]!,
  },
  // For Cloudflare R2 or MinIO, override the endpoint:
  ...(process.env["S3_ENDPOINT"]
    ? { endpoint: process.env["S3_ENDPOINT"] }
    : {}),
});

const BUCKET_NAME = process.env["S3_BUCKET_NAME"]!;
const ENCRYPTION_MASTER_KEY = process.env["ENCRYPTION_KEY"]!;

// ─────────────────────────────────────────────
// Upload Service
// ─────────────────────────────────────────────

export interface UploadOptions {
  contentType?: string;
  signatureId?: string;
  originalHash?: string;
  signedHash?: string;
  expiresAfterDays?: number;
}

/**
 * Upload a PDF to S3/R2 with AES-256-GCM encryption.
 *
 * The file is encrypted before upload using a key derived from
 * the master ENCRYPTION_KEY and the signatureId salt.
 * This ensures even if S3 is compromised, files are unreadable.
 */
export async function upload(
  key: string,
  data: Buffer,
  options: UploadOptions = {}
): Promise<void> {
  const {
    contentType = "application/pdf",
    signatureId,
    originalHash,
    signedHash,
    expiresAfterDays = 365 * 5, // 5 years default
  } = options;

  // Derive encryption key from master key + file key (unique per file)
  const encryptionKey = deriveKey(ENCRYPTION_MASTER_KEY, key);

  // Encrypt the file
  const { ciphertext, iv, authTag } = aesEncrypt(data, encryptionKey);

  // Combine into a single buffer: [iv(16)] + [authTag(16)] + [ciphertext]
  const encryptedData = Buffer.concat([iv, authTag, ciphertext]);

  // Set metadata for S3 object
  const metadata: Record<string, string> = {
    "x-pdf-sig-encrypted": "aes-256-gcm",
    "x-pdf-sig-version": "1",
  };
  if (signatureId) metadata["x-pdf-sig-id"] = signatureId;
  if (originalHash) metadata["x-pdf-sig-hash-before"] = originalHash;
  if (signedHash) metadata["x-pdf-sig-hash-after"] = signedHash;

  // Upload to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: encryptedData,
      ContentType: "application/octet-stream", // Encrypted — not application/pdf
      Metadata: metadata,
      // Server-side encryption as additional layer
      ServerSideEncryption: "AES256",
    })
  );
}

// ─────────────────────────────────────────────
// Download Service
// ─────────────────────────────────────────────

/**
 * Download and decrypt a PDF from S3/R2.
 *
 * @param key - The S3 object key
 * @returns Decrypted PDF buffer
 */
export async function download(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`Storage: File not found at key: ${key}`);
  }

  // Convert stream to Buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const encryptedData = Buffer.concat(chunks);

  // Extract IV, auth tag, and ciphertext
  const iv = encryptedData.subarray(0, 16);
  const authTag = encryptedData.subarray(16, 32);
  const ciphertext = encryptedData.subarray(32);

  // Derive the same encryption key used during upload
  const encryptionKey = deriveKey(ENCRYPTION_MASTER_KEY, key);

  // Decrypt
  const decrypted = aesDecrypt(ciphertext, encryptionKey, iv, authTag);

  return decrypted;
}

// ─────────────────────────────────────────────
// Pre-signed URLs
// ─────────────────────────────────────────────

/**
 * Generate a pre-signed URL for direct download.
 *
 * Note: This URL serves the ENCRYPTED file. For serving decrypted
 * PDFs to end users, use a server-side proxy endpoint instead.
 *
 * For the download URL we serve via our API proxy which decrypts on-the-fly.
 *
 * @param key - S3 object key
 * @param expiresInSeconds - URL expiry in seconds (default: 1 hour)
 */
export async function getSignedUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  // We proxy downloads through our API to decrypt before serving
  const apiBase = process.env["API_BASE_URL"] ?? "https://api.pdf-signature.dev";
  const token = generateDownloadToken(key, expiresInSeconds);

  return `${apiBase}/v1/download?token=${token}`;
}

/**
 * Generate a raw S3 pre-signed URL (used internally, not for end users).
 */
export async function getRawSignedUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ResponseContentType: "application/pdf",
    ResponseContentDisposition: `attachment; filename="${key.split("/").pop() ?? "document.pdf"}"`,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────

/**
 * Delete a file from storage.
 * Called when a signature request is cancelled and we want to clean up.
 */
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Check if a file exists in storage.
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Internal: Download Token
// ─────────────────────────────────────────────

function generateDownloadToken(key: string, expiresInSeconds: number): string {
  const { signHmac } = require("@pdf-signature/crypto");
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = Buffer.from(JSON.stringify({ key, expires })).toString("base64url");
  const sig = signHmac(payload, process.env["ENCRYPTION_KEY"]!).replace("sha256=", "");
  return `${payload}.${sig}`;
}

// Export as service object for easy mocking in tests
export const storageService = {
  upload,
  download,
  getSignedUrl,
  getRawSignedUrl,
  deleteFile,
  fileExists,
};
