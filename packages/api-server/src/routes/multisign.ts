/**
 * Multi-Sign Route
 *
 * POST /v1/multi-sign          — Start a multi-party signing session
 * GET  /v1/multi-sign/:id      — Get session status
 * POST /v1/multi-sign/:id/cancel — Cancel session
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import jwt from "jsonwebtoken";
import {
  generateSessionId,
  generateSignatureId,
  hashBuffer,
} from "@pdf-signature/crypto";
import { prisma } from "../db/client.js";
import { storageService } from "../services/storageService.js";
import { emailService } from "../services/emailService.js";
import { checkAndIncrementQuota } from "../middleware/quota.js";

const multiSignerSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  order: z.number().int().min(1),
  role: z.string().max(100).optional(),
  signaturePosition: z.object({
    page: z.number().int().min(1),
    x: z.number(), y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
  message: z.string().max(1000).optional(),
});

const multiSignSchema = z.object({
  fileBase64: z.string().min(100),
  mimeType: z.literal("application/pdf"),
  fileName: z.string().max(255),
  signers: z.array(multiSignerSchema).min(2).max(20),
  legal: z.enum(["eIDAS", "ESIGN", "UETA", "KSA-ETL"]).default("eIDAS"),
  webhookUrl: z.string().url().optional(),
  notifyAllOnComplete: z.boolean().default(false),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  documentTitle: z.string().max(200).optional(),
});

export async function multiSignRoute(fastify: FastifyInstance): Promise<void> {

  // ── POST /v1/multi-sign ───────────────────────────────────────────────────
  fastify.post("/multi-sign", async (request: FastifyRequest, reply) => {
    const userId = (request as FastifyRequest & { userId: string }).userId;
    const userPlan = (request as FastifyRequest & { userPlan: string }).userPlan as "FREE" | "PRO" | "TEAM" | "ENTERPRISE";

    const parseResult = multiSignSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Validation Error",
        message: parseResult.error.issues[0]?.message ?? "Invalid request",
      });
    }
    const body = parseResult.data;

    // Check quota (counts as N signatures where N = number of signers)
    for (let i = 0; i < body.signers.length; i++) {
      await checkAndIncrementQuota(userId, userPlan);
    }

    // Decode PDF
    const pdfBuffer = Buffer.from(body.fileBase64, "base64");
    const originalHash = hashBuffer(pdfBuffer, "sha256");

    // Generate session ID
    const sessionId = generateSessionId();

    // Upload original PDF
    const fileKey = `originals/${userId}/${sessionId}/original.pdf`;
    await storageService.upload(fileKey, pdfBuffer, {
      contentType: "application/pdf",
      signatureId: sessionId,
      originalHash,
    });

    // Sort signers by order
    const sortedSigners = [...body.signers].sort((a, b) => a.order - b.order);

    // Create session in database
    const session = await prisma.multiSignSession.create({
      data: {
        id: sessionId,
        userId,
        originalFileKey: fileKey,
        originalHash,
        totalCount: sortedSigners.length,
        webhookUrl: body.webhookUrl,
        notifyAllOnComplete: body.notifyAllOnComplete,
        legalStandard: body.legal,
        metadata: body.metadata ?? {},
      },
    });

    // Create individual signature requests for each signer
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    const signerRecords = [];
    for (const signer of sortedSigners) {
      const signatureId = generateSignatureId();

      const signingToken = jwt.sign(
        {
          signatureId,
          signerEmail: signer.email,
          signerName: signer.name,
          fileKey,
          fileHash: originalHash,
          legalStandard: body.legal,
          signatureLevel: "AdES-B-T",
          signaturePosition: signer.signaturePosition,
          ownerId: userId,
          locale: "en",
          documentTitle: body.documentTitle ?? body.fileName,
          multiSignSessionId: sessionId,
        },
        process.env["JWT_SECRET"]!,
        { expiresIn: "72h" }
      );

      const sigRequest = await prisma.signatureRequest.create({
        data: {
          id: signatureId,
          userId,
          signerEmail: signer.email,
          signerName: signer.name,
          status: signer.order === 1 ? "PENDING" : "PENDING", // All pending, but only first gets email
          originalFileKey: fileKey,
          originalHash,
          legalStandard: body.legal as "EIDAS" | "KSA_ETL" | "ESIGN" | "UETA",
          signatureLevel: "AdES-B-T",
          signingToken,
          expiresAt,
          webhookUrl: body.webhookUrl,
          multiSignSessionId: sessionId,
          signerOrder: signer.order,
          signerRole: signer.role,
          signaturePosition: signer.signaturePosition ?? null,
          auditTrail: {
            create: {
              id: `audit_${signatureId.slice(4)}`,
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

      signerRecords.push({
        signatureId,
        signer,
        signingToken,
        sigRequest,
      });
    }

    // Send email ONLY to the first signer
    const firstSigner = signerRecords[0]!;
    const signingUrl = `${process.env["SIGNING_PAGE_URL"]}/s/${firstSigner.signingToken}`;

    await emailService.sendSigningRequest({
      to: firstSigner.signer.email,
      signerName: firstSigner.signer.name ?? firstSigner.signer.email,
      senderName: "The pdf-signature Team",
      documentTitle: body.documentTitle ?? body.fileName,
      signingUrl,
      expiresAt,
      message: firstSigner.signer.message,
    });

    // Build response
    const signerProgress = signerRecords.map(({ signer, signingToken: token }, i) => ({
      email: signer.email,
      name: signer.name,
      order: signer.order,
      role: signer.role,
      status: "pending",
      signingUrl: i === 0 ? signingUrl : undefined, // Only first signer's URL for now
      expiresAt: expiresAt.toISOString(),
    }));

    return reply.send({
      success: true,
      sessionId,
      signers: signerProgress,
      overallStatus: "in_progress",
      nextSignerEmail: firstSigner.signer.email,
      completedCount: 0,
      totalCount: sortedSigners.length,
      webhookUrl: body.webhookUrl,
      auditTrailId: `audit_${sessionId.slice(6)}`,
    });
  });

  // ── GET /v1/multi-sign/:id — Get session status ───────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/multi-sign/:id",
    async (request, reply) => {
      const userId = (request as FastifyRequest & { userId: string }).userId;
      const { id } = request.params;

      const session = await prisma.multiSignSession.findFirst({
        where: { id, userId },
        include: {
          signatures: {
            orderBy: { signerOrder: "asc" },
            select: {
              id: true, signerEmail: true, signerName: true,
              status: true, signerOrder: true, signerRole: true,
              signedAt: true, expiresAt: true, signingToken: true,
            },
          },
        },
      });

      if (!session) {
        return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Session not found" });
      }

      const nextPending = session.signatures.find((s) => s.status === "PENDING");
      const signingPageUrl = process.env["SIGNING_PAGE_URL"];

      return reply.send({
        success: true,
        sessionId: session.id,
        signers: session.signatures.map((s) => ({
          email: s.signerEmail,
          name: s.signerName,
          order: s.signerOrder,
          role: s.signerRole,
          status: s.status.toLowerCase(),
          signingUrl: s.status === "PENDING"
            ? `${signingPageUrl}/s/${s.signingToken}`
            : undefined,
          signedAt: s.signedAt?.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        })),
        overallStatus: session.overallStatus,
        nextSignerEmail: nextPending?.signerEmail ?? null,
        completedCount: session.completedCount,
        totalCount: session.totalCount,
        auditTrailId: session.auditTrailId,
      });
    }
  );

  // ── POST /v1/multi-sign/:id/cancel ────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/multi-sign/:id/cancel",
    async (request, reply) => {
      const userId = (request as FastifyRequest & { userId: string }).userId;
      const { id } = request.params;

      const session = await prisma.multiSignSession.findFirst({
        where: { id, userId },
      });

      if (!session || session.overallStatus === "completed") {
        return reply.status(404).send({ error: "Session not found or already completed" });
      }

      await prisma.multiSignSession.update({
        where: { id },
        data: { overallStatus: "cancelled" },
      });

      await prisma.signatureRequest.updateMany({
        where: { multiSignSessionId: id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      return reply.send({
        success: true,
        sessionId: id,
        cancelledAt: new Date().toISOString(),
      });
    }
  );
}
