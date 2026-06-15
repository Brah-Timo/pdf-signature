/**
 * pdf-signature — pdfMultiSign()
 *
 * Orchestrate sequential multi-party signing workflows.
 * Signers are contacted in order — the next signer only receives the
 * document after the previous signer completes.
 *
 * @example
 * import { pdfMultiSign } from 'pdf-signature';
 *
 * const result = await pdfMultiSign('partnership.pdf', {
 *   signers: [
 *     { email: 'ali@company.com', name: 'Ali Al-Ghamdi', order: 1, role: 'Party A' },
 *     { email: 'sara@partner.com', name: 'Sara Al-Shehri', order: 2, role: 'Party B' },
 *     { email: 'ceo@company.com', name: 'CEO', order: 3, role: 'Witness' },
 *   ],
 *   legal: 'eIDAS',
 *   webhookUrl: 'https://yourapp.com/webhooks/signed',
 *   notifyAllOnComplete: true,
 * });
 */

import { z } from "zod";
import { httpRequest, preparePdfPayload } from "./http.js";
import {
  PdfMultiSignOptions,
  PdfMultiSignResult,
  ValidationError,
  SignerProgress,
} from "./types.js";

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const multiSignerSchema = z.object({
  email: z
    .string()
    .email("Each signer must have a valid email address"),

  name: z.string().max(200).optional(),

  order: z
    .number()
    .int()
    .min(1, "Order must be >= 1"),

  role: z
    .string()
    .max(100, "Role label must be under 100 characters")
    .optional(),

  signaturePosition: z
    .object({
      page: z.number().int().min(1),
      x: z.number().min(0),
      y: z.number().min(0),
      width: z.number().min(50).max(800).optional(),
      height: z.number().min(20).max(300).optional(),
    })
    .optional(),

  message: z.string().max(1000).optional(),

  smsNotify: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "smsNotify must be E.164 format")
    .optional(),
});

const multiSignOptionsSchema = z.object({
  signers: z
    .array(multiSignerSchema)
    .min(2, "Multi-sign requires at least 2 signers")
    .max(20, "Multi-sign supports at most 20 signers"),

  legal: z
    .enum(["eIDAS", "ESIGN", "UETA", "KSA-ETL"])
    .default("eIDAS"),

  webhookUrl: z
    .string()
    .url()
    .startsWith("https://")
    .optional(),

  notifyAllOnComplete: z.boolean().default(false).optional(),

  metadata: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .optional(),

  documentTitle: z.string().max(200).optional(),
  brandLogoUrl: z.string().url().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

// ─────────────────────────────────────────────
// API Shapes
// ─────────────────────────────────────────────

interface MultiSignApiRequest {
  fileBase64: string;
  mimeType: "application/pdf";
  fileName: string;
  signers: PdfMultiSignOptions["signers"];
  legal: string;
  webhookUrl?: string;
  notifyAllOnComplete?: boolean;
  metadata?: Record<string, string | number | boolean>;
  documentTitle?: string;
  brandLogoUrl?: string;
  brandColor?: string;
}

interface MultiSignApiResponse {
  success: true;
  sessionId: string;
  signers: SignerProgress[];
  overallStatus: "in_progress";
  nextSignerEmail: string;
  completedCount: 0;
  totalCount: number;
  webhookUrl?: string;
  auditTrailId: string;
}

// ─────────────────────────────────────────────
// Status Polling
// ─────────────────────────────────────────────

/**
 * Check the current status of a multi-sign session.
 *
 * @param sessionId - The session ID returned from pdfMultiSign()
 * @returns Current signing progress
 *
 * @example
 * const status = await getMultiSignStatus('msign_abc123...');
 * console.log(`${status.completedCount}/${status.totalCount} signed`);
 */
export async function getMultiSignStatus(
  sessionId: string
): Promise<PdfMultiSignResult> {
  if (!sessionId || !sessionId.startsWith("msign_")) {
    throw new ValidationError(
      "Invalid sessionId. Expected format: msign_<id>",
      "sessionId"
    );
  }

  return await httpRequest<PdfMultiSignResult>({
    method: "GET",
    url: `/v1/multi-sign/${sessionId}`,
  });
}

/**
 * Cancel a multi-sign session before all parties have signed.
 * Already-completed signatures in the chain are unaffected.
 *
 * @param sessionId - The session ID to cancel
 */
export async function cancelMultiSign(
  sessionId: string
): Promise<{ success: true; sessionId: string; cancelledAt: string }> {
  if (!sessionId) {
    throw new ValidationError("sessionId is required", "sessionId");
  }

  return await httpRequest({
    method: "POST",
    url: `/v1/multi-sign/${sessionId}/cancel`,
  });
}

// ─────────────────────────────────────────────
// Main Function
// ─────────────────────────────────────────────

/**
 * Start a sequential multi-party signing workflow.
 *
 * Signers are contacted in the order specified by their `order` field.
 * Each signer receives a notification only after all previous signers have completed.
 *
 * @param file - PDF file path, Buffer, or Uint8Array
 * @param options - Multi-sign configuration including the signers array
 * @returns Session details with signing URLs for the first signer
 *
 * @throws {ValidationError} If signers array is invalid (min 2, max 20)
 * @throws {AuthenticationError} If API key is missing/invalid
 * @throws {QuotaExceededError} On free plan quota overflow
 *
 * @example Partnership agreement with 3 parties
 * ```typescript
 * const session = await pdfMultiSign('partnership.pdf', {
 *   signers: [
 *     {
 *       email: 'ali@company.com',
 *       name: 'Ali Al-Ghamdi',
 *       order: 1,
 *       role: 'Party A',
 *       signaturePosition: { page: 5, x: 100, y: 200, width: 180, height: 50 },
 *     },
 *     {
 *       email: 'sara@partner.com',
 *       name: 'Sara Al-Shehri',
 *       order: 2,
 *       role: 'Party B',
 *       signaturePosition: { page: 5, x: 350, y: 200, width: 180, height: 50 },
 *     },
 *   ],
 *   legal: 'eIDAS',
 *   notifyAllOnComplete: true,
 *   webhookUrl: 'https://yourapp.com/hooks/contract-signed',
 * });
 *
 * // Poll for status
 * setInterval(async () => {
 *   const status = await getMultiSignStatus(session.sessionId);
 *   if (status.overallStatus === 'completed') {
 *     console.log('All parties signed!');
 *   }
 * }, 30_000);
 * ```
 */
export async function pdfMultiSign(
  file: string | Buffer | Uint8Array,
  options: PdfMultiSignOptions
): Promise<PdfMultiSignResult> {
  // 1. Validate options
  const parseResult = multiSignOptionsSchema.safeParse(options);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    throw new ValidationError(
      firstError?.message ?? "Invalid multi-sign options",
      firstError?.path.join(".") ?? undefined
    );
  }
  const validated = parseResult.data;

  // 2. Check for duplicate orders
  const orders = validated.signers.map((s) => s.order);
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length) {
    throw new ValidationError(
      "Each signer must have a unique order value",
      "signers.order"
    );
  }

  // 3. Check for duplicate emails
  const emails = validated.signers.map((s) => s.email.toLowerCase());
  const uniqueEmails = new Set(emails);
  if (uniqueEmails.size !== emails.length) {
    throw new ValidationError(
      "Each signer must have a unique email address",
      "signers.email"
    );
  }

  // 4. Prepare PDF payload
  const { base64, mimeType, fileName } = await preparePdfPayload(file);

  // 5. Sort signers by order for clean API submission
  const sortedSigners = [...validated.signers].sort(
    (a, b) => a.order - b.order
  );

  // 6. Build API request
  const requestBody: MultiSignApiRequest = {
    fileBase64: base64,
    mimeType,
    fileName: validated.documentTitle
      ? `${validated.documentTitle}.pdf`
      : fileName,
    signers: sortedSigners,
    legal: validated.legal,
    webhookUrl: validated.webhookUrl,
    notifyAllOnComplete: validated.notifyAllOnComplete,
    metadata: validated.metadata,
    documentTitle: validated.documentTitle,
    brandLogoUrl: validated.brandLogoUrl,
    brandColor: validated.brandColor,
  };

  // 7. Submit to API
  const response = await httpRequest<MultiSignApiResponse>({
    method: "POST",
    url: "/v1/multi-sign",
    data: requestBody,
  });

  return {
    success: response.success,
    sessionId: response.sessionId,
    signers: response.signers,
    overallStatus: response.overallStatus,
    nextSignerEmail: response.nextSignerEmail,
    completedCount: response.completedCount,
    totalCount: response.totalCount,
    webhookUrl: response.webhookUrl,
    auditTrailId: response.auditTrailId,
  };
}
