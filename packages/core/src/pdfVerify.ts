/**
 * pdf-signature — pdfVerify()
 *
 * Verify the cryptographic integrity and legal validity of a signed PDF.
 * Works both with locally-stored signed PDFs and with remote signatures via ID.
 *
 * @example
 * import { pdfVerify } from 'pdf-signature';
 *
 * // Verify a local signed PDF
 * const result = await pdfVerify('./signed-contract.pdf');
 *
 * // Verify by signature ID (fetches from cloud)
 * const result = await pdfVerify({ signatureId: 'sig_8f3a9c2d1e4b7a6f' });
 *
 * if (result.valid) {
 *   console.log('Document is legally binding!');
 *   console.log('Signed by:', result.signatures[0].signerEmail);
 * }
 */

import { z } from "zod";
import { httpRequest, preparePdfPayload } from "./http.js";
import {
  PdfVerifyResult,
  PdfVerifyOptions,
  ValidationError,
} from "./types.js";

// ─────────────────────────────────────────────
// Input Validation
// ─────────────────────────────────────────────

const verifyByIdSchema = z.object({
  signatureId: z
    .string()
    .min(1, "signatureId cannot be empty")
    .regex(
      /^sig_[a-f0-9]{16}$/,
      'signatureId must match pattern: sig_<16 hex chars>'
    ),
  includeComplianceReport: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// API Shapes
// ─────────────────────────────────────────────

interface VerifyByFileRequest {
  fileBase64: string;
  mimeType: "application/pdf";
  includeComplianceReport?: boolean;
}

interface VerifyByIdRequest {
  signatureId: string;
  includeComplianceReport?: boolean;
}

// ─────────────────────────────────────────────
// Main Function
// ─────────────────────────────────────────────

/**
 * Verify a signed PDF document.
 *
 * Performs the following checks:
 * - PKCS#7 signature cryptographic validity
 * - X.509 certificate chain trust
 * - RFC 3161 timestamp verification
 * - Document integrity (hash comparison before/after)
 * - Legal compliance standard adherence
 *
 * @param source - Signed PDF file path, Buffer, or { signatureId: '...' }
 * @param options - Optional verification configuration
 * @returns Detailed verification result
 *
 * @example Verify a local file
 * ```typescript
 * const result = await pdfVerify('./signed-contract.pdf');
 * console.log(result.valid);           // true/false
 * console.log(result.legallyBinding);  // true/false
 * console.log(result.signatures[0].integrityCheck); // 'PASSED'/'FAILED'
 * ```
 *
 * @example Verify by ID with compliance report
 * ```typescript
 * const result = await pdfVerify(
 *   { signatureId: 'sig_abc123def456789a' },
 *   { includeComplianceReport: true }
 * );
 * console.log(result.complianceReport); // URL to PDF report
 * ```
 */
export async function pdfVerify(
  source:
    | string
    | Buffer
    | Uint8Array
    | (PdfVerifyOptions & { signatureId: string }),
  options?: PdfVerifyOptions
): Promise<PdfVerifyResult> {

  // ── Case 1: Verify by signature ID (remote) ──────────────────────────────
  if (
    source !== null &&
    typeof source === "object" &&
    !Buffer.isBuffer(source) &&
    !(source instanceof Uint8Array) &&
    "signatureId" in source
  ) {
    const parseResult = verifyByIdSchema.safeParse(source);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      throw new ValidationError(
        firstError?.message ?? "Invalid signatureId",
        "signatureId"
      );
    }

    const requestBody: VerifyByIdRequest = {
      signatureId: source.signatureId,
      includeComplianceReport:
        options?.includeComplianceReport ?? source.includeComplianceReport,
    };

    return await httpRequest<PdfVerifyResult>({
      method: "GET",
      url: `/v1/verify/${requestBody.signatureId}`,
      params: {
        includeComplianceReport: requestBody.includeComplianceReport,
      },
    });
  }

  // ── Case 2: Verify a local file (upload + verify) ────────────────────────
  const { base64, mimeType } = await preparePdfPayload(
    source as string | Buffer | Uint8Array
  );

  const requestBody: VerifyByFileRequest = {
    fileBase64: base64,
    mimeType,
    includeComplianceReport: options?.includeComplianceReport,
  };

  return await httpRequest<PdfVerifyResult>({
    method: "POST",
    url: "/v1/verify",
    data: requestBody,
  });
}
