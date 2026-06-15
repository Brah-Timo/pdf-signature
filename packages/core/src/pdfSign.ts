/**
 * pdf-signature — pdfSign()
 *
 * The primary entry point. Send a PDF for legal electronic signature
 * in a single function call.
 *
 * @example
 * import { pdfSign } from 'pdf-signature';
 *
 * const result = await pdfSign('contract.pdf', {
 *   signer: 'ali@company.com',
 *   legal: 'eIDAS',
 * });
 * console.log(result.signingUrl); // Send this to the signer
 */

import { z } from "zod";
import { httpRequest, preparePdfPayload } from "./http.js";
import {
  PdfSignOptions,
  PdfSignResult,
  ValidationError,
} from "./types.js";

// ─────────────────────────────────────────────
// Input Validation Schema
// ─────────────────────────────────────────────

const signaturePositionSchema = z.object({
  page: z.number().int().min(1, "Page must be >= 1"),
  x: z.number().min(0, "X coordinate must be >= 0"),
  y: z.number().min(0, "Y coordinate must be >= 0"),
  width: z.number().min(50).max(800).optional(),
  height: z.number().min(20).max(300).optional(),
  showBorder: z.boolean().optional(),
  showLabel: z.boolean().optional(),
});

const pdfSignOptionsSchema = z.object({
  signer: z
    .string()
    .email("Invalid signer email address")
    .max(320, "Email address too long"),

  signerName: z
    .string()
    .min(1, "Signer name cannot be empty")
    .max(200, "Signer name too long")
    .optional(),

  legal: z
    .enum(["eIDAS", "ESIGN", "UETA", "KSA-ETL"])
    .default("eIDAS"),

  signingOrder: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(1)
    .optional(),

  message: z
    .string()
    .max(1000, "Custom message must be under 1000 characters")
    .optional(),

  expiresIn: z
    .number()
    .int()
    .min(1, "Expiry must be at least 1 hour")
    .max(720, "Expiry cannot exceed 720 hours (30 days)")
    .default(72)
    .optional(),

  webhookUrl: z
    .string()
    .url("webhookUrl must be a valid HTTPS URL")
    .startsWith("https://", "webhookUrl must use HTTPS")
    .optional(),

  signaturePosition: signaturePositionSchema.optional(),

  metadata: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .optional(),

  signatureLevel: z
    .enum(["basic", "AdES-B", "AdES-B-T", "AdES-B-LT", "AdES-B-LTA"])
    .default("AdES-B-T")
    .optional(),

  smsNotify: z
    .string()
    .regex(
      /^\+[1-9]\d{1,14}$/,
      "smsNotify must be in E.164 format (e.g. +966501234567)"
    )
    .optional(),

  documentTitle: z.string().max(200).optional(),
  brandLogoUrl: z.string().url().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "brandColor must be a hex color like #1a73e8")
    .optional(),

  requireNameConfirmation: z.boolean().optional(),

  locale: z.enum(["en", "ar", "fr", "de", "es"]).default("en").optional(),
});

// ─────────────────────────────────────────────
// API Request/Response Shapes
// ─────────────────────────────────────────────

interface SignApiRequest {
  fileBase64: string;
  mimeType: "application/pdf";
  fileName: string;
  signerEmail: string;
  signerName?: string;
  legal: string;
  signingOrder: number;
  message?: string;
  expiresIn: number;
  webhookUrl?: string;
  signaturePosition?: PdfSignOptions["signaturePosition"];
  metadata?: Record<string, string | number | boolean>;
  signatureLevel: string;
  smsNotify?: string;
  documentTitle?: string;
  brandLogoUrl?: string;
  brandColor?: string;
  requireNameConfirmation?: boolean;
  locale: string;
}

interface SignApiResponse {
  success: true;
  signatureId: string;
  signingUrl: string;
  expiresAt: string;
  status: "pending";
  auditTrailId: string;
  estimatedCompletionSeconds: number | null;
}

// ─────────────────────────────────────────────
// Main Function
// ─────────────────────────────────────────────

/**
 * Send a PDF document for electronic signature.
 *
 * @param file - Path to PDF file, Buffer, or Uint8Array
 * @param options - Signing options (signer email is required)
 * @returns Promise resolving to signing details including the URL to send the signer
 *
 * @throws {ValidationError} If options are invalid
 * @throws {InvalidPdfError} If the file is not a valid PDF
 * @throws {AuthenticationError} If API key is missing or invalid
 * @throws {QuotaExceededError} If the monthly free quota is exceeded
 * @throws {RateLimitError} If too many requests are made
 * @throws {PdfSignatureError} For other API errors
 *
 * @example Basic usage
 * ```typescript
 * const result = await pdfSign('contract.pdf', {
 *   signer: 'ali@email.com',
 * });
 * console.log(`Signing URL: ${result.signingUrl}`);
 * ```
 *
 * @example Full options
 * ```typescript
 * const result = await pdfSign('./contracts/employment.pdf', {
 *   signer: 'ali@company.com',
 *   signerName: 'Ali Al-Ghamdi',
 *   legal: 'eIDAS',
 *   message: 'Please review and sign the employment contract.',
 *   expiresIn: 48,
 *   webhookUrl: 'https://yourapp.com/webhooks/signed',
 *   signaturePosition: { page: 1, x: 400, y: 100, width: 200, height: 60 },
 *   signatureLevel: 'AdES-B-LT',
 *   metadata: { contractId: 'CNT-2025-042', department: 'Legal' },
 * });
 * ```
 */
export async function pdfSign(
  file: string | Buffer | Uint8Array,
  options: PdfSignOptions
): Promise<PdfSignResult> {
  // 1. Validate options
  const parseResult = pdfSignOptionsSchema.safeParse(options);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    throw new ValidationError(
      firstError?.message ?? "Invalid options",
      firstError?.path.join(".") ?? undefined
    );
  }
  const validated = parseResult.data;

  // 2. Prepare PDF payload
  const { base64, mimeType, fileName } = await preparePdfPayload(file);

  // 3. Build API request
  const requestBody: SignApiRequest = {
    fileBase64: base64,
    mimeType,
    fileName: validated.documentTitle
      ? `${validated.documentTitle}.pdf`
      : fileName,
    signerEmail: validated.signer,
    signerName: validated.signerName,
    legal: validated.legal,
    signingOrder: validated.signingOrder ?? 1,
    message: validated.message,
    expiresIn: validated.expiresIn ?? 72,
    webhookUrl: validated.webhookUrl,
    signaturePosition: validated.signaturePosition,
    metadata: validated.metadata,
    signatureLevel: validated.signatureLevel ?? "AdES-B-T",
    smsNotify: validated.smsNotify,
    documentTitle: validated.documentTitle,
    brandLogoUrl: validated.brandLogoUrl,
    brandColor: validated.brandColor,
    requireNameConfirmation: validated.requireNameConfirmation,
    locale: validated.locale ?? "en",
  };

  // 4. Send to API
  const response = await httpRequest<SignApiResponse>({
    method: "POST",
    url: "/v1/sign",
    data: requestBody,
  });

  // 5. Return structured result
  return {
    success: response.success,
    signatureId: response.signatureId,
    signingUrl: response.signingUrl,
    expiresAt: response.expiresAt,
    status: response.status,
    auditTrailId: response.auditTrailId,
    estimatedCompletionSeconds: response.estimatedCompletionSeconds,
  };
}
