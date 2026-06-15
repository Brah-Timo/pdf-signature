/**
 * API Server — Signing Route
 *
 * POST /v1/sign      — Initiate a signing request (upload PDF, send email)
 * POST /v1/sign/execute — Execute the signature (called from signing page)
 * GET  /v1/sign/:id  — Get signing request status
 * POST /v1/sign/:id/cancel — Cancel a pending signature
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import {
  generateSignatureId,
  generateAuditTrailId,
  generateEphemeralCertificate,
  loadCertificateFromPem,
  loadCertOnlyFromPem,
  hashBuffer,
} from "@pdf-signature/crypto";
import { signPdf } from "@pdf-signature/pdf";
import { prisma } from "../db/client.js";
import { storageService } from "../services/storageService.js";
import { emailService } from "../services/emailService.js";
import { auditService } from "../services/auditService.js";
import { notifyService } from "../services/notifyService.js";
import { checkAndIncrementQuota } from "../middleware/quota.js";

// ─────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────

const initiateSignSchema = z.object({
  fileBase64: z.string().min(100, "File content too short"),
  mimeType: z.literal("application/pdf"),
  fileName: z.string().max(255),
  signerEmail: z.string().email(),
  signerName: z.string().max(200).optional(),
  legal: z.enum(["eIDAS", "ESIGN", "UETA", "KSA-ETL"]).default("eIDAS"),
  signingOrder: z.number().int().min(1).default(1),
  message: z.string().max(1000).optional(),
  expiresIn: z.number().int().min(1).max(720).default(72),
  webhookUrl: z.string().url().optional(),
  signaturePosition: z.object({
    page: z.number().int().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  signatureLevel: z.string().default("AdES-B-T"),
  smsNotify: z.string().optional(),
  documentTitle: z.string().max(200).optional(),
  brandLogoUrl: z.string().url().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  requireNameConfirmation: z.boolean().optional(),
  locale: z.enum(["en", "ar", "fr", "de", "es"]).default("en"),
});

const executeSignSchema = z.object({
  token: z.string().min(10),
  signatureImage: z.string().startsWith("data:image/"),
  deviceInfo: z.object({
    userAgent: z.string().max(500),
    language: z.string().max(20),
    timezone: z.string().max(100),
    screenResolution: z.string().max(30),
    timestamp: z.string().datetime(),
  }),
});

// ─────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────

export async function signRoute(fastify: FastifyInstance): Promise<void> {

  // ── POST /v1/sign — Initiate signing request ──────────────────────────────
  fastify.post("/sign", async (request: FastifyRequest, reply) => {
    const userId = (request as FastifyRequest & { userId: string }).userId;
    const userPlan = (request as FastifyRequest & { userPlan: string }).userPlan as "FREE" | "PRO" | "TEAM" | "ENTERPRISE";

    // 1. Parse and validate request body
    const parseResult = initiateSignSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Validation Error",
        message: parseResult.error.issues[0]?.message ?? "Invalid request",
        field: parseResult.error.issues[0]?.path.join("."),
      });
    }
    const body = parseResult.data;

    // 2. Check quota (increments counter for FREE plan)
    await checkAndIncrementQuota(userId, userPlan);

    // 3. Decode PDF from base64
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = Buffer.from(body.fileBase64, "base64");
    } catch {
      return reply.status(400).send({
        statusCode: 400,
        error: "Invalid File",
        message: "Could not decode the PDF file from base64",
      });
    }

    // 4. Validate PDF magic bytes
    if (pdfBuffer[0] !== 0x25 || pdfBuffer[1] !== 0x50) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Invalid PDF",
        message: "The uploaded file does not appear to be a valid PDF",
      });
    }

    // 5. Generate IDs
    const signatureId = generateSignatureId();
    const auditTrailId = generateAuditTrailId();

    // 6. Compute original file hash for integrity checking
    const originalHash = hashBuffer(pdfBuffer, "sha256");

    // 7. Upload original PDF to storage (encrypted)
    const fileKey = `originals/${userId}/${signatureId}.pdf`;
    await storageService.upload(fileKey, pdfBuffer, {
      contentType: "application/pdf",
      signatureId,
      originalHash,
    });

    // 8. Generate signing JWT (signer uses this to authenticate)
    const expiresAt = new Date(
      Date.now() + (body.expiresIn ?? 72) * 60 * 60 * 1000
    );

    const signingToken = jwt.sign(
      {
        signatureId,
        signerEmail: body.signerEmail,
        signerName: body.signerName,
        fileKey,
        fileHash: originalHash,
        legalStandard: body.legal,
        signatureLevel: body.signatureLevel,
        signaturePosition: body.signaturePosition,
        ownerId: userId,
        locale: body.locale,
        requireNameConfirmation: body.requireNameConfirmation,
        documentTitle: body.documentTitle ?? body.fileName,
        brandLogoUrl: body.brandLogoUrl,
        brandColor: body.brandColor,
      },
      process.env["JWT_SECRET"]!,
      { expiresIn: `${body.expiresIn ?? 72}h` }
    );

    // 9. Store in database
    await prisma.signatureRequest.create({
      data: {
        id: signatureId,
        userId,
        signerEmail: body.signerEmail,
        signerName: body.signerName,
        status: "PENDING",
        originalFileKey: fileKey,
        originalHash,
        legalStandard: body.legal as "EIDAS" | "KSA_ETL" | "ESIGN" | "UETA",
        signatureLevel: body.signatureLevel,
        signingToken,
        expiresAt,
        webhookUrl: body.webhookUrl,
        metadata: body.metadata ?? {},
        auditTrail: {
          create: {
            id: auditTrailId,
            ipAddress: "pending",
            userAgent: "pending",
            timezone: "pending",
            screenResolution: "pending",
            certificateSerial: "pending",
            pkcs7Size: 0,
          },
        },
      },
    });

    // 10. Send signing email to the signer
    const signingUrl = `${process.env["SIGNING_PAGE_URL"]}/s/${signingToken}`;

    await emailService.sendSigningRequest({
      to: body.signerEmail,
      signerName: body.signerName ?? body.signerEmail,
      senderName: "The pdf-signature Team",
      documentTitle: body.documentTitle ?? body.fileName,
      signingUrl,
      expiresAt,
      message: body.message,
      locale: body.locale,
    });

    // 11. Return result to the developer
    return reply.status(200).send({
      success: true,
      signatureId,
      signingUrl,
      expiresAt: expiresAt.toISOString(),
      status: "pending",
      auditTrailId,
      estimatedCompletionSeconds: null,
    });
  });

  // ── POST /v1/sign/execute — Execute the signature (from signing page) ─────
  fastify.post("/sign/execute", {
    // This endpoint does NOT require API key — it's called from the signing page
    // with a signing JWT instead
    config: { skipAuth: true },
  }, async (request: FastifyRequest, reply) => {

    const parseResult = executeSignSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Validation Error",
        message: parseResult.error.issues[0]?.message ?? "Invalid request",
      });
    }
    const body = parseResult.data;

    // 1. Verify signing JWT
    let tokenPayload: {
      signatureId: string;
      signerEmail: string;
      signerName?: string;
      fileKey: string;
      fileHash: string;
      legalStandard: string;
      signatureLevel: string;
      signaturePosition?: {
        page: number; x: number; y: number; width?: number; height?: number;
      };
      ownerId: string;
      locale: string;
      documentTitle: string;
    };

    try {
      tokenPayload = jwt.verify(
        body.token,
        process.env["JWT_SECRET"]!
      ) as typeof tokenPayload;
    } catch (error) {
      const isExpired = (error as Error).name === "TokenExpiredError";
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: isExpired
          ? "Signing link has expired. Please request a new one from the document owner."
          : "Invalid signing link. This link is not valid.",
      });
    }

    // 2. Check signature hasn't been completed or cancelled
    const existingRequest = await prisma.signatureRequest.findUnique({
      where: { id: tokenPayload.signatureId },
      select: { status: true, originalFileKey: true, originalHash: true },
    });

    if (!existingRequest) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Signature request not found",
      });
    }

    if (existingRequest.status !== "PENDING") {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: `This document has already been ${existingRequest.status.toLowerCase()}. ` +
          `You cannot sign it again.`,
        status: existingRequest.status,
      });
    }

    // 3. Download original PDF
    const pdfBuffer = await storageService.download(tokenPayload.fileKey);

    // 4. Verify file integrity (detect tampering between upload and signing)
    const currentHash = hashBuffer(pdfBuffer, "sha256");
    if (currentHash !== existingRequest.originalHash) {
      fastify.log.error({
        msg: "PDF TAMPERING DETECTED",
        signatureId: tokenPayload.signatureId,
        expectedHash: existingRequest.originalHash,
        actualHash: currentHash,
      });

      await auditService.logTampering(tokenPayload.signatureId);

      return reply.status(409).send({
        statusCode: 409,
        error: "Integrity Check Failed",
        message: "The document has been modified since it was uploaded. Signing refused.",
      });
    }

    // 5. Load CA certificate (cached in memory at startup)
    const caData = loadCertificateFromPem(
      process.env["CA_CERT_PEM"]!.replace(/\\n/g, "\n"),
      process.env["CA_KEY_PEM"]!.replace(/\\n/g, "\n")
    );

    const rootCert = loadCertOnlyFromPem(
      process.env["ROOT_CERT_PEM"]!.replace(/\\n/g, "\n")
    );

    // 6. Generate ephemeral certificate for this signer
    const { cert: signerCert, privateKey: signerKey } = generateEphemeralCertificate({
      signerEmail: tokenPayload.signerEmail,
      signerName: tokenPayload.signerName ?? tokenPayload.signerEmail,
      validityHours: 1,
      caCert: caData.cert,
      caKey: caData.key,
    });

    // 7. Perform the full PDF signing
    const signingTime = new Date(body.deviceInfo.timestamp);
    const { signedPdf, documentHash, byteRanges, pkcs7Size } = await signPdf({
      pdfBuffer,
      signerCert,
      signerKey,
      caCerts: [caData.cert, rootCert],
      signingTime,
      tspUrl: process.env["TSP_URL"],
      signatureByteSize: 32768, // 32KB — generous for full chain + TSP
      visualSignature: tokenPayload.signaturePosition
        ? {
            imageBase64: body.signatureImage,
            position: {
              page: tokenPayload.signaturePosition.page,
              x: tokenPayload.signaturePosition.x,
              y: tokenPayload.signaturePosition.y,
              width: tokenPayload.signaturePosition.width,
              height: tokenPayload.signaturePosition.height,
            },
            signerName: tokenPayload.signerName ?? tokenPayload.signerEmail,
            legalStandard: tokenPayload.legalStandard,
            signatureLevel: tokenPayload.signatureLevel,
            locale: tokenPayload.locale,
          }
        : undefined,
    });

    // 8. Upload signed PDF
    const signedFileKey = `signed/${tokenPayload.ownerId}/${tokenPayload.signatureId}.pdf`;
    await storageService.upload(signedFileKey, signedPdf, {
      contentType: "application/pdf",
      signatureId: tokenPayload.signatureId,
      signedHash: documentHash,
    });

    const downloadUrl = await storageService.getSignedUrl(signedFileKey, 24 * 7 * 3600); // 7 days

    // 9. Update database: mark as SIGNED
    await prisma.signatureRequest.update({
      where: { id: tokenPayload.signatureId },
      data: {
        status: "SIGNED",
        signedFileKey,
        signedHash: documentHash,
        signedAt: signingTime,
        auditTrail: {
          update: {
            ipAddress: request.ip ?? "unknown",
            userAgent: body.deviceInfo.userAgent.slice(0, 500),
            timezone: body.deviceInfo.timezone,
            screenResolution: body.deviceInfo.screenResolution,
            language: body.deviceInfo.language,
            certificateSerial: signerCert.serialNumber,
            pkcs7Size,
            timestampAuthority: process.env["TSP_URL"] ?? null,
          },
        },
      },
    });

    // 10. Dispatch notifications
    await notifyService.signatureCompleted(tokenPayload.ownerId, {
      signatureId: tokenPayload.signatureId,
      signerName: tokenPayload.signerName ?? tokenPayload.signerEmail,
      signerEmail: tokenPayload.signerEmail,
      documentTitle: tokenPayload.documentTitle,
      downloadUrl,
    });

    return reply.status(200).send({
      success: true,
      message: "Document signed successfully",
      downloadUrl,
      signedAt: signingTime.toISOString(),
    });
  });

  // ── GET /v1/sign/:id — Get signature status ───────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/sign/:id",
    async (request, reply) => {
      const userId = (request as FastifyRequest & { userId: string }).userId;
      const { id } = request.params;

      const sigRequest = await prisma.signatureRequest.findFirst({
        where: { id, userId },
        include: { auditTrail: true },
      });

      if (!sigRequest) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Signature request not found",
        });
      }

      const downloadUrl = sigRequest.signedFileKey
        ? await storageService.getSignedUrl(sigRequest.signedFileKey, 3600)
        : null;

      return reply.send({
        signatureId: sigRequest.id,
        status: sigRequest.status.toLowerCase(),
        signerEmail: sigRequest.signerEmail,
        signerName: sigRequest.signerName,
        legalStandard: sigRequest.legalStandard,
        signatureLevel: sigRequest.signatureLevel,
        createdAt: sigRequest.createdAt,
        expiresAt: sigRequest.expiresAt,
        signedAt: sigRequest.signedAt,
        downloadUrl,
        auditTrailId: sigRequest.auditTrail?.id,
      });
    }
  );

  // ── POST /v1/sign/:id/cancel — Cancel a pending signature ─────────────────
  fastify.post<{ Params: { id: string } }>(
    "/sign/:id/cancel",
    async (request, reply) => {
      const userId = (request as FastifyRequest & { userId: string }).userId;
      const { id } = request.params;

      const updated = await prisma.signatureRequest.updateMany({
        where: { id, userId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      if (updated.count === 0) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Pending signature request not found",
        });
      }

      return reply.send({
        success: true,
        signatureId: id,
        cancelledAt: new Date().toISOString(),
      });
    }
  );
}
