/**
 * pdf-signature — Complete TypeScript Type Definitions
 * @module pdf-signature/types
 */

// ─────────────────────────────────────────────
// ENUMS & LITERALS
// ─────────────────────────────────────────────

/** Supported legal compliance standards */
export type LegalStandard =
  | "eIDAS"      // EU Regulation 910/2014 — 27 EU member states + UK
  | "ESIGN"      // U.S. Electronic Signatures in Global and National Commerce Act
  | "UETA"       // U.S. Uniform Electronic Transactions Act
  | "KSA-ETL";   // Saudi Arabia — Electronic Transactions Law (Royal Decree m/18)

/** AdES signature level (progressive trust chain) */
export type SignatureLevel =
  | "basic"       // Simple image only — minimal legal weight
  | "AdES-B"      // Baseline — X.509 cert + PKCS#7 detached
  | "AdES-B-T"    // + RFC 3161 Trusted Timestamp
  | "AdES-B-LT"   // + Full certificate chain embedded (long-term validation)
  | "AdES-B-LTA"; // + Archive timestamp (ultra long-term)

/** Current state of a signature request */
export type SignatureStatus =
  | "pending"    // Waiting for signer action
  | "signed"     // Successfully completed
  | "expired"    // Link expired before signing
  | "declined"   // Signer explicitly declined
  | "cancelled"; // Requester cancelled

/** Subscription plan */
export type Plan = "FREE" | "PRO" | "TEAM" | "ENTERPRISE";

/** Webhook event types */
export type WebhookEvent =
  | "signature.completed"
  | "signature.declined"
  | "signature.expired"
  | "signature.viewed"
  | "signature.cancelled"
  | "multisign.progress"
  | "multisign.all_completed";

// ─────────────────────────────────────────────
// SIGNATURE POSITION
// ─────────────────────────────────────────────

/**
 * Visual position of the signature on the PDF page.
 * All measurements are in PDF points (pt), where 1pt = 1/72 inch.
 * Origin (0,0) is the bottom-left corner of the page.
 */
export interface SignaturePosition {
  /** Page number (1-indexed) */
  page: number;
  /** X coordinate from left edge in pt */
  x: number;
  /** Y coordinate from bottom edge in pt */
  y: number;
  /** Width of the signature box in pt (default: 200) */
  width?: number;
  /** Height of the signature box in pt (default: 60) */
  height?: number;
  /** Show border around signature box */
  showBorder?: boolean;
  /** Show date/name label below signature */
  showLabel?: boolean;
}

// ─────────────────────────────────────────────
// CORE API OPTIONS
// ─────────────────────────────────────────────

/** Options for a single-signer pdfSign() call */
export interface PdfSignOptions {
  /**
   * Email address of the person who must sign.
   * They will receive an email with a signing link.
   * @required
   */
  signer: string;

  /**
   * Display name of the signer (shown on signing page & audit trail).
   * If omitted, the email address is used as display name.
   */
  signerName?: string;

  /**
   * Legal compliance standard to apply.
   * @default "eIDAS"
   */
  legal?: LegalStandard;

  /**
   * Order in which this signer receives the document (for sequential multi-sign).
   * @default 1
   */
  signingOrder?: number;

  /**
   * Custom message displayed on the signing page and in the notification email.
   * Keep it concise and professional.
   */
  message?: string;

  /**
   * How long (in hours) the signing link stays valid.
   * @default 72
   * @min 1
   * @max 720 (30 days)
   */
  expiresIn?: number;

  /**
   * HTTPS URL to receive a POST request when the document is signed.
   * Must be publicly accessible. Payload is HMAC-SHA256 signed.
   */
  webhookUrl?: string;

  /**
   * Visual position of the signature on the PDF.
   * If omitted, signature is appended to the last page.
   */
  signaturePosition?: SignaturePosition;

  /**
   * Arbitrary key-value data embedded in the audit trail.
   * Useful for linking to your internal records (contract IDs, etc).
   */
  metadata?: Record<string, string | number | boolean>;

  /**
   * AdES signature level.
   * @default "AdES-B-T"
   */
  signatureLevel?: SignatureLevel;

  /**
   * Send an SMS notification to this phone number when the document is ready.
   * Requires Twilio credentials in server environment.
   * Format: E.164 (e.g., "+966501234567")
   */
  smsNotify?: string;

  /**
   * Custom title shown on the signing page.
   * Defaults to the PDF filename.
   */
  documentTitle?: string;

  /**
   * URL of your logo (PNG/SVG) to brand the signing page (Pro plan only).
   * Must be publicly accessible.
   */
  brandLogoUrl?: string;

  /**
   * Primary brand color for the signing page (Pro plan only).
   * Format: hex string (e.g., "#1a73e8")
   */
  brandColor?: string;

  /**
   * If true, the signer must type their full name to confirm consent.
   * @default false
   */
  requireNameConfirmation?: boolean;

  /**
   * Locale/language for the signing page.
   * @default "en"
   */
  locale?: "en" | "ar" | "fr" | "de" | "es";
}

/** Result returned from a successful pdfSign() call */
export interface PdfSignResult {
  /** Whether the request was successfully created */
  success: true;
  /** Unique identifier for this signature request */
  signatureId: string;
  /** URL to send to (or visit for) the signer — expires at expiresAt */
  signingUrl: string;
  /** ISO 8601 timestamp when the signing link expires */
  expiresAt: string;
  /** Current status */
  status: "pending";
  /** Audit trail identifier for compliance purposes */
  auditTrailId: string;
  /** Estimated seconds until completion (null = unknown) */
  estimatedCompletionSeconds: number | null;
}

// ─────────────────────────────────────────────
// MULTI-SIGN
// ─────────────────────────────────────────────

/** Configuration for a single signer within a multi-sign workflow */
export interface MultiSignerConfig {
  /** Signer's email address */
  email: string;
  /** Signer's display name */
  name?: string;
  /**
   * Position in the signing sequence.
   * Signer with order=1 is contacted first.
   * Next signer is contacted only after previous completes.
   * @min 1
   */
  order: number;
  /** Role label shown on the document (e.g., "Party A", "Witness", "Notary") */
  role?: string;
  /** Visual position of this signer's signature */
  signaturePosition?: SignaturePosition;
  /** Custom message for this specific signer */
  message?: string;
  /** Phone number for SMS notification */
  smsNotify?: string;
}

/** Options for a multi-signer pdfMultiSign() call */
export interface PdfMultiSignOptions {
  /** Array of signers (minimum 2, maximum 20) */
  signers: MultiSignerConfig[];
  /** Legal standard applied to all signatures */
  legal?: LegalStandard;
  /** Webhook URL notified after EACH individual signature */
  webhookUrl?: string;
  /** If true, also send webhook when ALL signers have completed */
  notifyAllOnComplete?: boolean;
  /** Additional metadata for the audit trail */
  metadata?: Record<string, string | number | boolean>;
  /** Document title shown on all signing pages */
  documentTitle?: string;
  /** Signing page branding (Pro only) */
  brandLogoUrl?: string;
  brandColor?: string;
}

/** Progress entry for a single signer */
export interface SignerProgress {
  email: string;
  name?: string;
  order: number;
  role?: string;
  status: SignatureStatus;
  signingUrl?: string;
  signedAt?: string;
  expiresAt: string;
}

/** Result from a pdfMultiSign() call */
export interface PdfMultiSignResult {
  success: true;
  sessionId: string;
  signers: SignerProgress[];
  overallStatus: "in_progress" | "completed" | "partially_expired";
  nextSignerEmail: string;
  completedCount: number;
  totalCount: number;
  webhookUrl?: string;
  auditTrailId: string;
}

// ─────────────────────────────────────────────
// VERIFICATION
// ─────────────────────────────────────────────

/** Integrity check result for a single signature */
export type IntegrityCheckResult = "PASSED" | "FAILED" | "UNKNOWN";

/** Detailed information about a single embedded signature */
export interface SignatureInfo {
  /** Signer's email (from X.509 certificate Subject Alternative Name) */
  signerEmail: string;
  /** Signer's name (from X.509 certificate Common Name) */
  signerName: string;
  /** ISO 8601 timestamp when signing occurred */
  signedAt: string;
  /** Signer's IP address at signing time */
  ipAddress: string;
  /** Browser/device User-Agent string */
  userAgent: string;
  /** Legal standard applied */
  legalStandard: LegalStandard;
  /** X.509 certificate serial number (hex) */
  certificateSerial: string;
  /** Timestamp Authority used for RFC 3161 token */
  timestampAuthority: string | null;
  /** Whether the document hash matches after signing */
  integrityCheck: IntegrityCheckResult;
  /** AdES signature level achieved */
  level: SignatureLevel;
  /** True if timestamp is within certificate validity period */
  timestampValid: boolean;
  /** Certificate chain validity */
  certificateValid: boolean;
}

/** Result from pdfVerify() */
export interface PdfVerifyResult {
  /** True if ALL signatures are valid and document is unmodified */
  valid: boolean;
  /** Array of all embedded signatures */
  signatures: SignatureInfo[];
  /** SHA-256 hash of the entire document */
  documentHash: string;
  /** True if all signatures meet the required legal standard */
  legallyBinding: boolean;
  /** URL to a human-readable compliance report PDF */
  complianceReport: string | null;
  /** Error message if verification failed unexpectedly */
  error?: string;
}

/** Options for pdfVerify() */
export interface PdfVerifyOptions {
  /** If provided, fetch the document from the API instead of reading locally */
  signatureId?: string;
  /** Whether to fetch and validate the full compliance report */
  includeComplianceReport?: boolean;
}

// ─────────────────────────────────────────────
// WEBHOOK PAYLOAD
// ─────────────────────────────────────────────

/** Payload sent to your webhookUrl */
export interface WebhookPayload {
  /** Event type */
  event: WebhookEvent;
  /** Unique signature/session ID */
  signatureId: string;
  /** ISO 8601 timestamp of the event */
  timestamp: string;
  /** Event-specific data */
  data: {
    signerEmail: string;
    signerName?: string;
    documentTitle?: string;
    downloadUrl?: string;
    legalStandard?: LegalStandard;
    signedAt?: string;
    /** For multi-sign events */
    completedCount?: number;
    totalCount?: number;
    nextSignerEmail?: string;
  };
  /**
   * HMAC-SHA256 signature of the payload body.
   * Format: "sha256=<hex>"
   * Use your webhook secret to verify authenticity.
   */
  signature: string;
}

// ─────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────

/** Base error class for all pdf-signature errors */
export class PdfSignatureError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "PdfSignatureError";
    Object.setPrototypeOf(this, PdfSignatureError.prototype);
  }
}

/** Thrown when the monthly free quota (20 signatures) is exceeded */
export class QuotaExceededError extends PdfSignatureError {
  constructor() {
    super(
      "Monthly free quota (20 signatures) exceeded. Upgrade to Pro at $22/month: https://pdf-signature.dev/pricing",
      "QUOTA_EXCEEDED",
      402
    );
    this.name = "QuotaExceededError";
  }
}

/** Thrown when the API key is missing or invalid */
export class AuthenticationError extends PdfSignatureError {
  constructor(message = "Invalid or missing API key. Get yours at https://pdf-signature.dev") {
    super(message, "AUTHENTICATION_FAILED", 401);
    this.name = "AuthenticationError";
  }
}

/** Thrown when input validation fails */
export class ValidationError extends PdfSignatureError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

/** Thrown when a rate limit is hit */
export class RateLimitError extends PdfSignatureError {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`,
      "RATE_LIMIT_EXCEEDED",
      429
    );
    this.name = "RateLimitError";
  }
}

/** Thrown when the PDF file cannot be read or is invalid */
export class InvalidPdfError extends PdfSignatureError {
  constructor(message = "The provided file is not a valid PDF document.") {
    super(message, "INVALID_PDF", 400);
    this.name = "InvalidPdfError";
  }
}

// ─────────────────────────────────────────────
// SDK CONFIG
// ─────────────────────────────────────────────

/** Internal SDK configuration (set via environment variables) */
export interface SdkConfig {
  apiKey: string;
  apiBaseUrl: string;
  timeout: number;
  retryAttempts: number;
  debug: boolean;
}
