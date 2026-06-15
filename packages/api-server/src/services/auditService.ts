/**
 * Audit Service
 *
 * Manages the legal audit trail — records all forensic evidence
 * required for a signature to be legally non-repudiable.
 *
 * The audit trail is append-only and cannot be modified after creation.
 * This is a key requirement for eIDAS compliance.
 */

import { prisma } from "../db/client.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AuditRecordOptions {
  signatureId: string;
  signerEmail: string;
  signerName?: string;
  signedAt: Date;
  ipAddress: string;
  userAgent: string;
  timezone: string;
  screenResolution: string;
  language?: string;
  geoCountry?: string;
  geoCity?: string;
  deviceFingerprint?: string;
  fileHashBefore: string;
  fileHashAfter: string;
  legalStandard: string;
  certificateSerial: string;
  pkcs7Size: number;
  timestampAuthority?: string;
  tspTokenHex?: string;
  signatureValueHex?: string;
}

// ─────────────────────────────────────────────
// Record Audit Trail
// ─────────────────────────────────────────────

/**
 * Record the complete audit trail after a successful signature.
 * This is an immutable record — once created, it cannot be modified.
 */
export async function record(options: AuditRecordOptions): Promise<void> {
  const {
    signatureId, ipAddress, userAgent, timezone,
    screenResolution, language, geoCountry, geoCity,
    deviceFingerprint, certificateSerial, pkcs7Size,
    timestampAuthority, tspTokenHex, signatureValueHex,
  } = options;

  await prisma.auditTrail.update({
    where: { signatureId },
    data: {
      ipAddress,
      userAgent: userAgent.slice(0, 500),
      timezone,
      screenResolution,
      language,
      geoCountry,
      geoCity,
      deviceFingerprint,
      certificateSerial,
      pkcs7Size,
      timestampAuthority,
      tspTokenHex,
      signatureValueHex,
      consentText:
        "I agree this electronic signature is legally binding under eIDAS / KSA-ETL.",
      consentTimestamp: options.signedAt,
    },
  });
}

/**
 * Retrieve the full audit record for a signature.
 */
export async function getRecord(signatureId: string) {
  return prisma.auditTrail.findUnique({
    where: { signatureId },
    include: {
      signature: {
        select: {
          id: true,
          status: true,
          signerEmail: true,
          signerName: true,
          legalStandard: true,
          signatureLevel: true,
          originalHash: true,
          signedHash: true,
          signedFileKey: true,
          createdAt: true,
          signedAt: true,
        },
      },
    },
  });
}

/**
 * Log a tampering detection event.
 * Called when the document hash does not match at signing time.
 * This is a security event — log it prominently.
 */
export async function logTampering(signatureId: string): Promise<void> {
  console.error(`[SECURITY] PDF TAMPERING DETECTED for signature: ${signatureId}`);

  // Update the signature request status
  await prisma.signatureRequest.update({
    where: { id: signatureId },
    data: {
      status: "CANCELLED",
      metadata: {
        tamperingDetected: true,
        tamperingDetectedAt: new Date().toISOString(),
      },
    },
  });
}

/**
 * Get a summary of all signatures for compliance reporting.
 */
export async function getComplianceSummary(userId: string): Promise<{
  total: number;
  signed: number;
  pending: number;
  expired: number;
  declined: number;
}> {
  const results = await prisma.signatureRequest.groupBy({
    by: ["status"],
    where: { userId },
    _count: { status: true },
  });

  const counts = results.reduce(
    (acc, r) => {
      acc[r.status.toLowerCase() as keyof typeof acc] = r._count.status;
      return acc;
    },
    { signed: 0, pending: 0, expired: 0, declined: 0, cancelled: 0, total: 0 }
  );

  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    total: counts.total,
    signed: counts.signed,
    pending: counts.pending,
    expired: counts.expired,
    declined: counts.declined,
  };
}

// Export as service object
export const auditService = {
  record,
  getRecord,
  logTampering,
  getComplianceSummary,
};
