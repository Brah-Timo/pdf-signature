/**
 * pdf-signature
 *
 * Legal PDF e-signatures in one line of code.
 * eIDAS (EU) & KSA-ETL (Saudi Arabia) compliant.
 * PKCS#7 · X.509 · RFC 3161 · AdES-B-LT
 *
 * @see https://pdf-signature.dev
 * @see https://github.com/pdf-signature/pdf-signature
 *
 * @example Quick start
 * ```typescript
 * import { pdfSign } from 'pdf-signature';
 *
 * process.env.PDF_SIGN_API_KEY = 'pdf_live_your_key_here';
 *
 * const result = await pdfSign('contract.pdf', {
 *   signer: 'client@company.com',
 *   legal: 'eIDAS',
 * });
 *
 * console.log(result.signingUrl); // Send this to your client
 * ```
 */

// ── Core API functions ────────────────────────────────────────────────────────
export { pdfSign } from "./pdfSign.js";
export { pdfVerify } from "./pdfVerify.js";
export {
  pdfMultiSign,
  getMultiSignStatus,
  cancelMultiSign,
} from "./pdfMultiSign.js";

// ── SDK configuration ─────────────────────────────────────────────────────────
export { configure } from "./config.js";

// ── TypeScript types (all public types re-exported for consumers) ─────────────
export type {
  // Options
  PdfSignOptions,
  PdfMultiSignOptions,
  PdfVerifyOptions,
  MultiSignerConfig,
  SignaturePosition,

  // Results
  PdfSignResult,
  PdfMultiSignResult,
  PdfVerifyResult,
  SignerProgress,
  SignatureInfo,

  // Webhooks
  WebhookPayload,
  WebhookEvent,

  // Enums / Literals
  LegalStandard,
  SignatureLevel,
  SignatureStatus,
  Plan,
  IntegrityCheckResult,

  // SDK internals
  SdkConfig,
} from "./types.js";

// ── Error classes ─────────────────────────────────────────────────────────────
export {
  PdfSignatureError,
  QuotaExceededError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  InvalidPdfError,
} from "./types.js";

// ── Package metadata ──────────────────────────────────────────────────────────
export const VERSION = "1.0.0";
export const API_VERSION = "v1";
