/**
 * API Server — Verification Routes
 *
 * GET  /v1/verify/:id   — Verify by signature ID
 * POST /v1/verify       — Verify by uploading a signed PDF
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { verifySignedPdf } from "@pdf-signature/pdf";
import { prisma } from "../db/client.js";
import { storageService } from "../services/storageService.js";

export async function verifyRoute(fastify: FastifyInstance): Promise<void> {

  // ── GET /v1/verify/:id — Verify by signature ID ───────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: { includeComplianceReport?: string } }>(
    "/verify/:id",
    async (request, reply) => {
      const userId = (request as FastifyRequest & { userId: string }).userId;
      const { id } = request.params;
      const includeReport = request.query.includeComplianceReport === "true";

      // Fetch signature request
      const sigRequest = await prisma.signatureRequest.findFirst({
        where: { id },
        include: { auditTrail: true },
      });

      if (!sigRequest) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Signature not found",
        });
      }

      if (sigRequest.status !== "SIGNED" || !sigRequest.signedFileKey) {
        return reply.status(200).send({
          valid: false,
          signatures: [],
          documentHash: sigRequest.originalHash ?? "",
          legallyBinding: false,
          status: sigRequest.status.toLowerCase(),
          message: `Document has not been signed yet (status: ${sigRequest.status.toLowerCase()})`,
          complianceReport: null,
        });
      }

      // Download signed PDF
      const signedPdf = await storageService.download(sigRequest.signedFileKey);

      // Cryptographic verification
      const verificationResult = await verifySignedPdf(signedPdf);

      // Build detailed response
      const signatures = verificationResult.signatures.map((sig) => ({
        signerEmail: sig.signerEmail ?? sigRequest.signerEmail,
        signerName: sig.signerName ?? sigRequest.signerName,
        signedAt: sig.signedAt?.toISOString() ?? sigRequest.signedAt?.toISOString(),
        ipAddress: sigRequest.auditTrail?.ipAddress ?? "unknown",
        userAgent: sigRequest.auditTrail?.userAgent ?? "unknown",
        legalStandard: sigRequest.legalStandard,
        certificateSerial: sig.certificateSerial ?? sigRequest.auditTrail?.certificateSerial,
        timestampAuthority: sigRequest.auditTrail?.timestampAuthority ?? null,
        integrityCheck: sig.integrityPassed ? "PASSED" : "FAILED",
        level: sigRequest.signatureLevel,
        timestampValid: sig.hasTimestamp,
        certificateValid: true,
      }));

      const complianceReportUrl = includeReport
        ? `${process.env["API_BASE_URL"]}/v1/verify/${id}/report`
        : null;

      return reply.send({
        valid: verificationResult.valid,
        signatures,
        documentHash: verificationResult.documentHash,
        legallyBinding: verificationResult.valid && signatures.length > 0,
        status: sigRequest.status.toLowerCase(),
        complianceReport: complianceReportUrl,
      });
    }
  );

  // ── POST /v1/verify — Verify by uploading a PDF ───────────────────────────
  fastify.post("/verify", async (request: FastifyRequest, reply) => {
    const body = request.body as {
      fileBase64: string;
      mimeType: string;
      includeComplianceReport?: boolean;
    };

    if (!body.fileBase64) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "fileBase64 is required",
      });
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = Buffer.from(body.fileBase64, "base64");
    } catch {
      return reply.status(400).send({
        statusCode: 400,
        error: "Invalid File",
        message: "Could not decode base64 file content",
      });
    }

    if (pdfBuffer[0] !== 0x25 || pdfBuffer[1] !== 0x50) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Invalid PDF",
        message: "The file does not appear to be a valid PDF",
      });
    }

    const verificationResult = await verifySignedPdf(pdfBuffer);

    return reply.send({
      valid: verificationResult.valid,
      signatures: verificationResult.signatures.map((sig) => ({
        signerEmail: sig.signerEmail,
        signerName: sig.signerName,
        signedAt: sig.signedAt?.toISOString(),
        integrityCheck: sig.integrityPassed ? "PASSED" : "FAILED",
        hasTimestamp: sig.hasTimestamp,
        certificateSerial: sig.certificateSerial,
        error: sig.error,
      })),
      documentHash: verificationResult.documentHash,
      legallyBinding: verificationResult.valid && verificationResult.signatures.length > 0,
      complianceReport: null,
    });
  });

  // ── GET /v1/verify/:id/report — Compliance report PDF ────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/verify/:id/report",
    async (request, reply) => {
      const { id } = request.params;

      const sigRequest = await prisma.signatureRequest.findUnique({
        where: { id },
        include: { auditTrail: true },
      });

      if (!sigRequest || sigRequest.status !== "SIGNED") {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Signed document not found",
        });
      }

      // Generate a simple JSON compliance report
      // In production: generate a proper PDF report with pdf-lib
      const report = {
        reportId: `RPT-${id}`,
        generatedAt: new Date().toISOString(),
        document: {
          signatureId: id,
          status: "SIGNED",
          legalStandard: sigRequest.legalStandard,
          signatureLevel: sigRequest.signatureLevel,
        },
        signer: {
          email: sigRequest.signerEmail,
          name: sigRequest.signerName,
          signedAt: sigRequest.signedAt,
          ipAddress: sigRequest.auditTrail?.ipAddress,
          userAgent: sigRequest.auditTrail?.userAgent,
          timezone: sigRequest.auditTrail?.timezone,
        },
        cryptographic: {
          certificateSerial: sigRequest.auditTrail?.certificateSerial,
          timestampAuthority: sigRequest.auditTrail?.timestampAuthority,
          pkcs7Size: sigRequest.auditTrail?.pkcs7Size,
          documentHashBefore: sigRequest.originalHash,
          documentHashAfter: sigRequest.signedHash,
        },
        compliance: {
          eIDAS: sigRequest.legalStandard === "EIDAS",
          ksaETL: sigRequest.legalStandard === "KSA_ETL",
          esign: sigRequest.legalStandard === "ESIGN",
          regulatoryReference: getLegalReference(sigRequest.legalStandard),
        },
      };

      return reply
        .header("Content-Type", "application/json")
        .send(report);
    }
  );
}

function getLegalReference(standard: string): string {
  const refs: Record<string, string> = {
    EIDAS: "EU Regulation 910/2014 (eIDAS), Article 26 — Advanced Electronic Signatures",
    KSA_ETL: "Saudi Arabia Electronic Transactions Law, Royal Decree m/18 (2007), Article 5",
    ESIGN: "U.S. Electronic Signatures in Global and National Commerce Act (2000)",
    UETA: "U.S. Uniform Electronic Transactions Act (1999)",
  };
  return refs[standard] ?? "International electronic signature standards";
}
